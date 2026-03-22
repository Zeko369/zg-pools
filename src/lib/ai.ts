import { generateObject, NoObjectGeneratedError } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { getWeekDates, type DayInfo } from "./pools";

const PARSER_MODEL = "gpt-5-nano";
const GENERATE_OBJECT_MAX_ATTEMPTS = 3;

const TextFromStringOrObjectSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    if ("alert" in value && typeof value.alert === "string") {
      return value.alert;
    }

    if ("message" in value && typeof value.message === "string") {
      return value.message;
    }

    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
  }

  return value;
}, z.string());

async function generateStructuredObject<T>({
  schema,
  prompt,
}: {
  schema: z.ZodType<T>;
  prompt: string;
}): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= GENERATE_OBJECT_MAX_ATTEMPTS; attempt++) {
    try {
      const { object } = await generateObject({
        model: openai(PARSER_MODEL),
        schema,
        prompt,
      });

      return object;
    } catch (error) {
      lastError = error;

      if (
        !NoObjectGeneratedError.isInstance(error) ||
        attempt === GENERATE_OBJECT_MAX_ATTEMPTS
      ) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw lastError;
}

// ============================================
// SHARED TYPES
// ============================================

const PoolType = z.enum(["olympic", "small"]).describe("Normalized pool type");

const TimeSlotSchema = z.object({
  hours: z.string().describe("Operating hours (e.g., 06:00 - 14:00)"),
  lanes: z
    .string()
    .optional()
    .describe(
      "Number of lanes or pool dimensions available (e.g., '2-4 staze', '25m x 50m')",
    ),
});

const PoolScheduleSchema = z.object({
  poolType: PoolType,
  slots: z
    .array(TimeSlotSchema)
    .describe("All time slots for this pool type on this day"),
});

// ============================================
// STEP 1: WEEKLY SCHEDULE EXTRACTION
// ============================================

const WeekdayScheduleSchema = z.object({
  dayName: z
    .string()
    .describe(
      "Day name in Croatian (Ponedjeljak, Utorak, Srijeda, Četvrtak, Petak, Subota, Nedjelja)",
    ),
  pools: z
    .array(PoolScheduleSchema)
    .describe("Schedule per pool type for this weekday"),
});

const HolidayScheduleSchema = z.object({
  pools: z
    .array(PoolScheduleSchema)
    .describe(
      "Default schedule for holidays (Blagdan) - empty array if closed on holidays",
    ),
});

const WeeklyScheduleSchema = z.object({
  poolName: z.string().describe("Name of the pool facility"),
  weekdays: z
    .array(WeekdayScheduleSchema)
    .length(7)
    .describe(
      "Schedule for each day of the week (Monday-Sunday), extracted from the regular schedule table",
    ),
  holidaySchedule: HolidayScheduleSchema.describe(
    "Default schedule for holidays (from Blagdan row in table, if present)",
  ),
  notices: z
    .array(TextFromStringOrObjectSchema)
    .describe(
      "General informational notices about the pool: entry rules, programs, facilities. No external links or contact info.",
    ),
});

export type WeeklySchedule = z.infer<typeof WeeklyScheduleSchema>;

// ============================================
// STEP 2: OVERRIDES EXTRACTION
// ============================================

const OverrideSchema = z.object({
  date: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Specific date this override applies to (DD.MM.YYYY or DD.MM.), or null if using dateRange",
    ),
  dateRangeStart: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Start date of range (DD.MM.YYYY or DD.MM.), or null if using single date",
    ),
  dateRangeEnd: z
    .string()
    .nullable()
    .optional()
    .describe(
      "End date of range (DD.MM.YYYY or DD.MM.), or null if using single date",
    ),
  holidayName: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Name of the holiday (e.g., Božić, Nova godina), or null if not a holiday",
    ),
  isClosed: z
    .boolean()
    .describe("True if the pool is completely closed on this date/range"),
  customHours: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Modified operating hours for this date if not closed (e.g., '06:00 - 14:00'), or null if closed or using regular hours",
    ),
  reason: z.string().describe("The original text/reason for this override"),
});

const OverridesSchema = z.object({
  overrides: z
    .array(OverrideSchema)
    .describe(
      "All schedule overrides found in notices, warnings, and announcements",
    ),
  alerts: z
    .array(TextFromStringOrObjectSchema)
    .describe(
      "URGENT notices: closures, out-of-service equipment, holiday closures with dates",
    ),
  generalHolidayRule: z
    .enum(["closed", "holiday_hours", "normal", "unknown"])
    .describe(
      "General rule for holidays if mentioned (e.g., 'blagdanima ne radi' = closed)",
    ),
});

export type Overrides = z.infer<typeof OverridesSchema>;
export type Override = z.infer<typeof OverrideSchema>;

// ============================================
// FINAL OUTPUT SCHEMA
// ============================================

const DayScheduleSchema = z.object({
  day: z
    .string()
    .describe(
      "Day name in Croatian (Ponedjeljak, Utorak, Srijeda, Četvrtak, Petak, Subota, Nedjelja)",
    ),
  date: z.string().describe("The actual date (DD.MM.YYYY)"),
  isHoliday: z.boolean().describe("True if this date is a public holiday"),
  holidayName: z
    .string()
    .optional()
    .describe("Name of the holiday if isHoliday is true"),
  pools: z
    .array(PoolScheduleSchema)
    .describe(
      "Schedule per pool type - MUST BE EMPTY [] if pool is closed on this day due to holiday",
    ),
});

const WeekScheduleSchema = z.object({
  weekStart: z.string().describe("Monday date of this week (DD.MM.YYYY)"),
  weekEnd: z.string().describe("Sunday date of this week (DD.MM.YYYY)"),
  days: z
    .array(DayScheduleSchema)
    .length(7)
    .describe("Exactly 7 days, Monday to Sunday"),
});

const PoolAvailabilitySchema = z.object({
  poolName: z.string().describe("Name of the pool facility"),
  currentWeek: WeekScheduleSchema.describe("Schedule for the current week"),
  nextWeek: WeekScheduleSchema.describe("Schedule for the next week"),
  alerts: z
    .array(z.string())
    .describe(
      "URGENT notices: closures, out-of-service equipment, holiday closures with dates",
    ),
  notices: z
    .array(z.string())
    .describe(
      "General informational notices directly about the pool: entry rules, programs, facilities. Do NOT include external links, contact info for other organizations, or unrelated content.",
    ),
  _debug: z
    .object({
      weeklySchedule: WeeklyScheduleSchema,
      overrides: OverridesSchema,
    })
    .optional(),
});

export type PoolAvailability = z.infer<typeof PoolAvailabilitySchema>;
export type PoolType = z.infer<typeof PoolType>;
export type WeekSchedule = z.infer<typeof WeekScheduleSchema>;
export type DaySchedule = z.infer<typeof DayScheduleSchema>;

// ============================================
// STEP 1: Extract Weekly Schedule from Table
// ============================================

async function extractWeeklySchedule(
  poolName: string,
  rawContent: string,
): Promise<WeeklySchedule> {
  return generateStructuredObject({
    schema: WeeklyScheduleSchema,
    prompt: `You are extracting the REGULAR weekly schedule from a swimming pool's HTML page in Zagreb, Croatia.

Pool being analyzed: ${poolName}

=== YOUR TASK ===
Extract the WEEKLY SCHEDULE TABLE only. This is the recurring schedule that shows:
- What hours the pool is open on each weekday (Monday-Sunday)
- Different pool types (olympic/big pool vs small/training pool)
- Lane availability if mentioned

=== WHAT TO EXTRACT ===

1. WEEKDAY SCHEDULE (7 days):
   Find the schedule table and extract hours for:
   - Ponedjeljak (Monday)
   - Utorak (Tuesday)
   - Srijeda (Wednesday)
   - Četvrtak (Thursday)
   - Petak (Friday)
   - Subota (Saturday)
   - Nedjelja (Sunday)

2. HOLIDAY SCHEDULE (Blagdan row):
   If the table has a "Blagdan" or "Blagdani" row, extract those hours.
   This is the DEFAULT schedule used on holidays (unless overridden).
   If no Blagdan row exists, set pools to empty array [].

3. POOL TYPE NORMALIZATION:
   - "olympic" = Olympic pool, Veliki bazen, Big pool, 50m pool
   - "small" = Mali bazen, Small pool, training pool

=== WHAT TO IGNORE ===
- DO NOT process any notices, warnings, or announcements about specific dates
- DO NOT process holiday closures or special schedules
- DO NOT include any date-specific information
- Just extract the REGULAR recurring schedule

=== NOTICES ===
Only include general informational notices about the facility (entry rules, programs).
No external links, phone numbers, or emails.

=== CONTENT TO ANALYZE ===
${rawContent}`,
  });
}

// ============================================
// STEP 2: Extract Overrides and Alerts
// ============================================

async function extractOverrides(
  poolName: string,
  rawContent: string,
): Promise<Overrides> {
  return generateStructuredObject({
    schema: OverridesSchema,
    prompt: `You are extracting SCHEDULE OVERRIDES from a swimming pool's HTML page in Zagreb, Croatia.

Pool being analyzed: ${poolName}

=== YOUR TASK ===
Find all EXCEPTIONS to the regular schedule:
- Holiday closures
- Special dates when the pool is closed
- Modified hours for specific dates
- Temporary closures
- Any announcements about schedule changes

=== WHAT TO EXTRACT ===

1. SPECIFIC DATE OVERRIDES:
   Look for notices like:
   - "Ne radimo 25.12." → date: "25.12.", isClosed: true, customHours: null
   - "Za Božić zatvoreno" → date: "25.12.", holidayName: "Božić", isClosed: true, customHours: null
   - "31.12. radimo od 06:00 - 14:00" → date: "31.12.", isClosed: false, customHours: "06:00 - 14:00"
   - "Od 24.12. do 26.12. ne radimo" → dateRangeStart: "24.12.", dateRangeEnd: "26.12.", isClosed: true

   For single dates: use "date" field, leave dateRangeStart/dateRangeEnd as null
   For date ranges: use "dateRangeStart" and "dateRangeEnd" fields, leave date as null

   IMPORTANT: If the notice specifies MODIFIED HOURS (not a full closure), set:
   - isClosed: false
   - customHours: the specific hours mentioned (e.g., "06:00 - 14:00")

2. GENERAL HOLIDAY RULES:
   Look for phrases like:
   - "blagdanima ne radi" or "blagdanima zatvoreno" → generalHolidayRule: "closed"
   - "blagdanima radimo po rasporedu" → generalHolidayRule: "holiday_hours"
   - If no general rule mentioned → generalHolidayRule: "unknown"

3. ALERTS:
   Extract URGENT notices:
   - Temporary closures
   - Equipment out of service
   - Holiday closures with specific dates
   - Anything time-sensitive

=== CROATIAN PUBLIC HOLIDAYS ===
If you see references to these, extract them as overrides:
- 25.12. = Božić (Christmas Day)
- 26.12. = Sveti Stjepan (St. Stephen's Day)
- 01.01. = Nova godina (New Year's Day)
- 06.01. = Sveta tri kralja (Epiphany)
- Uskrs = Easter (variable date)
- 01.05. = Praznik rada (Labor Day)
- And others

=== DATE FORMAT ===
Extract dates as they appear (DD.MM. or DD.MM.YYYY).
The merge step will handle matching to actual dates.

=== WHAT TO IGNORE ===
- The regular weekly schedule table (that's extracted separately)
- General facility information that isn't about schedule changes

=== CONTENT TO ANALYZE ===
${rawContent}`,
  });
}

// ============================================
// STEP 3: Merge Schedule with Overrides
// ============================================

// Croatian public holidays (fixed dates)
const CROATIAN_HOLIDAYS: Record<string, string> = {
  "01.01.": "Nova godina",
  "06.01.": "Sveta tri kralja",
  "01.05.": "Praznik rada",
  "30.05.": "Dan državnosti",
  "22.06.": "Dan antifašističke borbe",
  "05.08.": "Dan pobjede",
  "15.08.": "Velika Gospa",
  "01.11.": "Svi sveti",
  "18.11.": "Dan sjećanja",
  "25.12.": "Božić",
  "26.12.": "Sveti Stjepan",
};

function normalizeDate(dateStr: string): string {
  // Remove all spaces first, then convert DD.MM. or DD.MM.YYYY to DD.MM.
  const cleaned = dateStr.replace(/\s+/g, "");
  const match = cleaned.match(/^(\d{1,2})\.(\d{1,2})\./);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    return `${day}.${month}.`;
  }
  return cleaned;
}

function parseFullDate(dateStr: string): { day: number; month: number } | null {
  // Remove all spaces first
  const cleaned = dateStr.replace(/\s+/g, "");
  const match = cleaned.match(/^(\d{1,2})\.(\d{1,2})\./);
  if (match) {
    return { day: parseInt(match[1], 10), month: parseInt(match[2], 10) };
  }
  return null;
}

function isDateInRange(
  dateStr: string,
  range: { start: string; end: string },
): boolean {
  const date = parseFullDate(dateStr);
  const start = parseFullDate(range.start);
  const end = parseFullDate(range.end);

  if (!date || !start || !end) return false;

  const dateNum = date.month * 100 + date.day;
  const startNum = start.month * 100 + start.day;
  const endNum = end.month * 100 + end.day;

  // Handle year wrap (e.g., Dec 30 to Jan 2)
  if (startNum <= endNum) {
    return dateNum >= startNum && dateNum <= endNum;
  } else {
    return dateNum >= startNum || dateNum <= endNum;
  }
}

function findOverrideForDate(
  dateStr: string,
  overrides: Override[],
): Override | null {
  const normalizedDate = normalizeDate(dateStr);

  for (const override of overrides) {
    // Check specific date match
    if (override.date && normalizeDate(override.date) === normalizedDate) {
      return override;
    }

    // Check date range
    if (
      override.dateRangeStart &&
      override.dateRangeEnd &&
      isDateInRange(dateStr, {
        start: override.dateRangeStart,
        end: override.dateRangeEnd,
      })
    ) {
      return override;
    }
  }

  return null;
}

function isKnownHoliday(dateStr: string): {
  isHoliday: boolean;
  name?: string;
} {
  const normalized = normalizeDate(dateStr);
  const holidayName = CROATIAN_HOLIDAYS[normalized];
  return holidayName
    ? { isHoliday: true, name: holidayName }
    : { isHoliday: false };
}

function mergeSchedules(
  weeklySchedule: WeeklySchedule,
  overrides: Overrides,
  weekDays: DayInfo[],
  weekStart: string,
  weekEnd: string,
): WeekSchedule {
  const days: DaySchedule[] = weekDays.map((dayInfo) => {
    const dayIndex = [
      "Ponedjeljak",
      "Utorak",
      "Srijeda",
      "Četvrtak",
      "Petak",
      "Subota",
      "Nedjelja",
    ].indexOf(dayInfo.name);

    const baseSchedule = weeklySchedule.weekdays[dayIndex];
    const holidayInfo = isKnownHoliday(dayInfo.date);
    const override = findOverrideForDate(dayInfo.date, overrides.overrides);

    // Determine if this day should be treated as a holiday
    let isHoliday = holidayInfo.isHoliday;
    let holidayName = holidayInfo.name;

    // Check if override mentions a holiday
    if (override?.holidayName) {
      isHoliday = true;
      holidayName = override.holidayName;
    }

    // Determine the schedule for this day
    let pools = baseSchedule?.pools ?? [];

    if (override) {
      // Specific override takes priority
      if (override.isClosed) {
        pools = [];
      } else if (override.customHours) {
        // Modified hours - apply custom hours to all pool types
        pools = pools.map((pool) => ({
          ...pool,
          slots: [{ hours: override.customHours! }],
        }));
      }
      // If override exists but isClosed is false and no customHours, keep the regular schedule
    } else if (isHoliday) {
      // Apply holiday rules
      if (overrides.generalHolidayRule === "closed") {
        pools = [];
      } else if (
        overrides.generalHolidayRule === "holiday_hours" ||
        overrides.generalHolidayRule === "unknown"
      ) {
        // Use holiday schedule from table if available
        if (weeklySchedule.holidaySchedule.pools.length > 0) {
          pools = weeklySchedule.holidaySchedule.pools;
        }
        // Otherwise keep regular schedule (some pools operate normally on holidays)
      }
    }

    return {
      day: dayInfo.name,
      date: dayInfo.date,
      isHoliday,
      ...(isHoliday && holidayName ? { holidayName } : {}),
      pools,
    };
  });

  return {
    weekStart,
    weekEnd,
    days,
  };
}

// ============================================
// MAIN FUNCTION: Parse Pool Availability
// ============================================

export async function parsePoolAvailability(
  poolName: string,
  rawContent: string,
): Promise<PoolAvailability> {
  const { currentWeek, nextWeek } = getWeekDates();

  // Step 1: Extract weekly schedule (parallel)
  // Step 2: Extract overrides (parallel)
  const [weeklySchedule, overrides] = await Promise.all([
    extractWeeklySchedule(poolName, rawContent),
    extractOverrides(poolName, rawContent),
  ]);

  // Step 3: Merge schedules with overrides for both weeks
  const currentWeekSchedule = mergeSchedules(
    weeklySchedule,
    overrides,
    currentWeek.days,
    currentWeek.monday,
    currentWeek.sunday,
  );

  const nextWeekSchedule = mergeSchedules(
    weeklySchedule,
    overrides,
    nextWeek.days,
    nextWeek.monday,
    nextWeek.sunday,
  );

  return {
    poolName: weeklySchedule.poolName,
    currentWeek: currentWeekSchedule,
    nextWeek: nextWeekSchedule,
    alerts: overrides.alerts,
    notices: weeklySchedule.notices,
    // Debug: raw AI outputs
    _debug: {
      weeklySchedule,
      overrides,
    },
  };
}
