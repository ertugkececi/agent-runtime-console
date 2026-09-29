// FastAPI answers route errors with `{detail: "..."}` and request-validation
// errors with `{detail: [{msg: "..."}, ...]}`. Both shapes become one line for
// the screen; anything else falls back to the HTTP status.
export function apiErrorMessage(error: unknown, status: number): string {
  if (isRecord(error)) {
    const detail = error.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => (isRecord(item) && typeof item.msg === "string" ? item.msg : null))
        .filter((message): message is string => Boolean(message));
      if (messages.length > 0) {
        return messages.join("; ");
      }
    }
  }
  return `İstek HTTP ${status} durumuyla başarısız oldu.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
