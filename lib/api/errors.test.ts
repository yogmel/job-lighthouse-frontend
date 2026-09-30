import { describe, expect, it } from "vitest";
import { ApiError, NetworkError } from "./client";
import { toFormErrors } from "./errors";

const FIELDS = ["email", "password"] as const;

describe("toFormErrors", () => {
  it("puts a 409 duplicate-email error on the email field", () => {
    const err = new ApiError(409, "Email already registered");
    expect(toFormErrors(err, FIELDS)).toEqual({
      fieldErrors: { email: "Email already registered" },
    });
  });

  it("maps FastAPI 422 issues to the field named in loc", () => {
    const err = new ApiError(422, [
      { loc: ["body", "password"], msg: "String should have at least 8 characters" },
      { loc: ["body", "email"], msg: "value is not a valid email address" },
    ]);
    expect(toFormErrors(err, FIELDS)).toEqual({
      fieldErrors: {
        password: "String should have at least 8 characters",
        email: "value is not a valid email address",
      },
      formError: undefined,
    });
  });

  it("sends 422 issues for unknown fields to the form-level error", () => {
    const err = new ApiError(422, [{ loc: ["body"], msg: "Field required" }]);
    expect(toFormErrors(err, FIELDS)).toEqual({
      fieldErrors: {},
      formError: "Field required",
    });
  });

  it("hides 5xx details behind a generic message", () => {
    const err = new ApiError(500, "Traceback ...");
    expect(toFormErrors(err, FIELDS).formError).toBe("Something went wrong. Please try again.");
  });

  it("reports network failures at form level", () => {
    const err = new NetworkError(new TypeError("Failed to fetch"));
    expect(toFormErrors(err, FIELDS).formError).toMatch(/can't reach the server/i);
  });
});
