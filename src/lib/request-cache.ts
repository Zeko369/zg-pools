/** Lazy TTL cache: expiry never schedules work. Requests alone can invoke load(). */
export class RequestCache<T> {
  private values = new Map<string, { value: T; at: number; scope: string }>();
  private running = new Map<string, Promise<{ value: T; stale: boolean }>>();
  private failures = new Map<string, { at: number; error: unknown }>();
  constructor(
    private ttl = 3_600_000,
    private cooldown = 60_000,
    private clock = Date.now,
  ) {}
  async get(
    key: string,
    scope: string,
    load: () => Promise<T>,
    force = false,
  ): Promise<{ value: T; stale: boolean }> {
    const now = this.clock(),
      cached = this.values.get(key),
      sameScope = cached?.scope === scope;
    const failed = this.failures.get(key);
    if (sameScope && now - cached.at < (force ? this.cooldown : this.ttl))
      return { value: cached.value, stale: !!failed && failed.at >= cached.at };
    const active = this.running.get(key);
    if (active) return active;
    if (failed && now - failed.at < this.cooldown) {
      if (sameScope) return { value: cached.value, stale: true };
      throw failed.error;
    }
    const task = (async () => {
      try {
        const value = await load();
        this.values.set(key, { value, at: this.clock(), scope });
        this.failures.delete(key);
        return { value, stale: false };
      } catch (error) {
        this.failures.set(key, { error, at: this.clock() });
        if (sameScope) return { value: cached.value, stale: true };
        throw error;
      } finally {
        this.running.delete(key);
      }
    })();
    this.running.set(key, task);
    return task;
  }
}
