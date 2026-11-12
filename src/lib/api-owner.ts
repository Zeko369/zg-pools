import { matchesSecret } from "./owner-session";

export function bearerOwner(request: Request) {
  const header = request.headers.get("authorization");
  return (
    !!header?.startsWith("Bearer ") &&
    matchesSecret(header.slice(7), process.env.POOLS_API_SECRET)
  );
}
