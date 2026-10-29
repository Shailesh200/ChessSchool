import { describe, expect, it } from "vitest";
import { isUsersEmailUniqueViolation } from "./sqlite-errors";

describe("isUsersEmailUniqueViolation", () => {
  it("matches the libSQL file driver extended code without reading the message", () => {
    const err = {
      message: "Failed query: insert into users",
      cause: {
        name: "LibsqlError",
        code: "SQLITE_CONSTRAINT",
        extendedCode: "SQLITE_CONSTRAINT_UNIQUE",
        rawCode: 2067,
        message: "",
        cause: { code: "SQLITE_CONSTRAINT_UNIQUE", rawCode: 2067, message: "" },
      },
    };
    expect(isUsersEmailUniqueViolation(err)).toBe(true);
  });

  it("matches a remote Hrana constraint that only names the base code", () => {
    const err = {
      message: "Failed query: insert into users",
      cause: {
        code: "SQLITE_CONSTRAINT",
        message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email",
      },
    };
    expect(isUsersEmailUniqueViolation(err)).toBe(true);
  });

  it("ignores other constraint failures and message text with no constraint code", () => {
    expect(
      isUsersEmailUniqueViolation({
        code: "SQLITE_CONSTRAINT",
        rawCode: 19,
        message: "cs23 simulated progress insert failure",
      }),
    ).toBe(false);
    expect(
      isUsersEmailUniqueViolation({
        code: "SQLITE_CONSTRAINT_PRIMARYKEY",
        rawCode: 1555,
        message: "UNIQUE constraint failed: users.email",
      }),
    ).toBe(false);
    expect(
      isUsersEmailUniqueViolation({
        message: "UNIQUE constraint failed: users.email",
      }),
    ).toBe(false);
  });
});
