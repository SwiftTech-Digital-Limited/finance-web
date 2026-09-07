import { describe, expect, it } from "vitest";
import { serializeZonedDateTime, snapshotBoundary } from "./backfill-dates";

describe("backfill date serialization", () => {
  it("serializes a Lagos wall-clock value with an explicit offset", () => {
    expect(serializeZonedDateTime("2026-09-04T00:00", "Africa/Lagos")).toBe(
      "2026-09-04T00:00:00+01:00",
    );
    expect(snapshotBoundary("2026-08-31", "Africa/Lagos")).toBe(
      "2026-08-31T23:59:59+01:00",
    );
  });

  it("uses the selected timezone and rejects incomplete values", () => {
    expect(serializeZonedDateTime("2026-01-15T12:30", "America/New_York")).toBe(
      "2026-01-15T12:30:00-05:00",
    );
    expect(() => serializeZonedDateTime("2026-09-04", "Africa/Lagos")).toThrow(
      "complete date and time",
    );
  });
});
