// Server-side logging that only ever records safe fields: event names, codes, counts and timings.
// Never pass image data, API keys or full provider responses in here.

type Fields = Record<string, string | number | boolean | undefined>;

export function logEvent(level: "info" | "warn" | "error", event: string, fields: Fields = {}) {
  const line = JSON.stringify({ level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
