// Field readers for the untyped payloads of the platform API.
//
// The contract types writes, but several reads answer plain objects:
// GET /agents, GET /conversations/{id}, GET /runs/{id}, GET /codex/models,
// GET /opencode/models and GET /mcp/tools. Every screen narrows those payloads
// once, at the boundary with the generated client, through these readers; the
// message for a wrong payload shape stays with the screen that knows it.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`Yanıttaki "${key}" alanı metin değil.`);
  }
  return value;
}

export function readOptionalString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Yanıttaki "${key}" alanı metin değil.`);
  }
  return value;
}

export function readBoolean(source: Record<string, unknown>, key: string): boolean {
  const value = source[key];
  if (typeof value !== "boolean") {
    throw new Error(`Yanıttaki "${key}" alanı doğru/yanlış değil.`);
  }
  return value;
}

export function readNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== "number") {
    throw new Error(`Yanıttaki "${key}" alanı sayı değil.`);
  }
  return value;
}

export function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) {
    throw new Error(`Yanıttaki "${key}" alanı metin listesi değil.`);
  }
  return value;
}

export function readRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  if (!isRecord(value)) {
    throw new Error(`Yanıttaki "${key}" alanı nesne değil.`);
  }
  return value;
}
