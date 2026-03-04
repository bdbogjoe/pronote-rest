/**
 * Returns a sort key for a pawnote object.
 * Checks field paths in priority order (adapted from pronotepy's get_sort).
 */
export function getSort(data: unknown): unknown {
  if (data === null || data === undefined || typeof data !== "object") {
    return undefined;
  }

  const obj = data as Record<string, unknown>;

  // Field paths to check in priority order
  // Each entry is [key, subKey?] – subKey means obj[key][subKey]
  const fields: Array<[string, string?]> = [
    ["deadline"],          // Assignment
    ["startDate"],         // TimetableClass (pronotepy: start)
    ["date"],              // Grade, NotebookAbsence
    ["creationDate"],      // NewsInformation (pronotepy: creation_date)
    ["fromDate"],          // NotebookAbsence (pronotepy: from_date)
    ["name"],              // Period
    ["subject", "name"],   // Grade, Assignment (pronotepy: subject,name)
    ["id"],                // fallback
  ];

  for (const [key, subKey] of fields) {
    if (!(key in obj)) continue;

    let value: unknown = obj[key];
    if (subKey !== undefined) {
      if (value === null || typeof value !== "object") continue;
      const sub = value as Record<string, unknown>;
      if (!(subKey in sub)) continue;
      value = sub[subKey];
    }

    if (value === undefined || value === null) continue;

    if (value instanceof Date) return value;
    if (typeof value === "string") {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
      return value;
    }
    return value;
  }

  return undefined;
}

export function sortByField<T>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ka = getSort(a);
    const kb = getSort(b);
    if (ka === undefined && kb === undefined) return 0;
    if (ka === undefined) return 1;
    if (kb === undefined) return -1;
    if (ka instanceof Date && kb instanceof Date) return ka.getTime() - kb.getTime();
    if (typeof ka === "string" && typeof kb === "string") return ka.localeCompare(kb);
    if (typeof ka === "number" && typeof kb === "number") return ka - kb;
    return 0;
  });
}

export function sortByFieldDesc<T>(arr: T[]): T[] {
  return sortByField(arr).reverse();
}
