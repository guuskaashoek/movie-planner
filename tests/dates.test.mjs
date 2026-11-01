import test from "node:test";
import assert from "node:assert/strict";
import { isCalendarDate } from "../lib/dates.ts";

test("accepts real calendar days", () => {
  for (const value of ["2026-11-01", "2028-02-29", "2026-12-31"]) {
    assert.equal(isCalendarDate(value), true, value);
  }
});

test("refuses days that do not exist", () => {
  for (const value of ["2026-13-45", "9999-99-99", "2026-02-31", "2027-02-29", "2026-00-10"]) {
    assert.equal(isCalendarDate(value), false, value);
  }
});

test("refuses anything that is not a YYYY-MM-DD string", () => {
  for (const value of ["", " 2026-11-01", "2026-11-1", "2026-11-01T00:00", ["2026-11-01"], 20261101, null]) {
    assert.equal(isCalendarDate(value), false, String(value));
  }
});
