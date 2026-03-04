/**
 * Recursively serialize pawnote objects to plain JSON-compatible values.
 * - Date → ISO string
 * - Map → plain object
 * - Array → serialized array
 * - Object → serialized object (skip internal keys starting with _)
 * - Primitives → as-is
 */
export function serialize(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (data instanceof Date) return data.toISOString();
  if (data instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of data) {
      out[String(k)] = serialize(v);
    }
    return out;
  }
  if (Array.isArray(data)) return data.map(serialize);
  if (typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      if (!key.startsWith("_")) {
        out[key] = serialize((data as Record<string, unknown>)[key]);
      }
    }
    return out;
  }
  return data;
}
