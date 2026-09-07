function parts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match) throw new Error("Enter a complete date and time.");
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    match[6] ? Number(match[6]) : 0,
  ];
}
export function serializeZonedDateTime(value: string, timeZone: string) {
  const [year, month, day, hour, minute, second = 0] = parts(value);
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetAt = (instant: number) => {
    const mapped = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(instant))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    return (
      Date.UTC(
        mapped.year,
        mapped.month - 1,
        mapped.day,
        mapped.hour,
        mapped.minute,
        mapped.second,
      ) - instant
    );
  };
  let offset = offsetAt(wallUtc);
  const instant = wallUtc - offset;
  offset = offsetAt(instant);
  const sign = offset >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(Math.round(offset / 60_000));
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${sign}${pad(Math.floor(absoluteMinutes / 60))}:${pad(absoluteMinutes % 60)}`;
}
export const snapshotBoundary = (date: string, timeZone: string) =>
  serializeZonedDateTime(`${date}T23:59:59`, timeZone);
