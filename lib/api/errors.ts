import { ApiError, NetworkError } from "./client";

export type FormErrors<Field extends string> = {
  fieldErrors: Partial<Record<Field, string>>;
  formError?: string;
};

const GENERIC_ERROR = "Something went wrong. Please try again.";
const NETWORK_ERROR = "Can't reach the server. Check your connection and try again.";

type ValidationIssue = { loc?: unknown[]; msg?: unknown };

function isValidationIssue(value: unknown): value is ValidationIssue {
  return typeof value === "object" && value !== null && "msg" in value;
}

/**
 * Maps a backend error to form errors.
 * - 422: FastAPI validation list `[{ loc: ["body", field], msg }]` → per field
 * - 409 on signup: duplicate email → email field
 * - anything else → form-level message
 */
export function toFormErrors<Field extends string>(
  err: unknown,
  fields: readonly Field[],
): FormErrors<Field> {
  if (err instanceof NetworkError) {
    return { fieldErrors: {}, formError: NETWORK_ERROR };
  }
  if (!(err instanceof ApiError)) {
    return { fieldErrors: {}, formError: GENERIC_ERROR };
  }

  const fieldErrors: Partial<Record<Field, string>> = {};

  if (err.status === 422 && Array.isArray(err.detail)) {
    const unmatched: string[] = [];
    for (const issue of err.detail) {
      if (!isValidationIssue(issue)) continue;
      const msg = String(issue.msg);
      const field = issue.loc?.[issue.loc.length - 1];
      if (typeof field === "string" && (fields as readonly string[]).includes(field)) {
        fieldErrors[field as Field] ??= msg;
      } else {
        unmatched.push(msg);
      }
    }
    return {
      fieldErrors,
      formError: unmatched.length > 0 ? unmatched.join(" ") : undefined,
    };
  }

  const message = typeof err.detail === "string" && err.detail ? err.detail : GENERIC_ERROR;

  if (err.status === 409 && (fields as readonly string[]).includes("email")) {
    fieldErrors["email" as Field] = message;
    return { fieldErrors };
  }

  return { fieldErrors, formError: err.status >= 500 ? GENERIC_ERROR : message };
}
