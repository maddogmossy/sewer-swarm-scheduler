export type VehicleTypesConfig = string[] | Array<{ type: string; defaultColor?: string }>;

/** Config for combined unit display (e.g. CCTV + Jet Vac). Defined in Scheduling settings, not in Vehicle Type dropdown. */
export interface VehicleCombinationConfig {
  label: string;
  defaultColor: string;
  groupA: string[];
  groupB: string[];
}

/** Default combination for backward compatibility; stored in Scheduling settings. */
export const DEFAULT_VEHICLE_COMBINATION: VehicleCombinationConfig = {
  label: "CCTV/Jet Vac",
  defaultColor: "pink",
  groupA: ["CCTV", "CCTV/Van Pack"],
  groupB: ["Jet Vac", "Recycler"],
};

// Normalize type names so lookups tolerate formatting/plural differences.
// Example: "CCTV/Van Packs" -> "cctvvanpack", "Jet-Vac" -> "jetvac", "Recyclers" -> "recycler"
export function normalizeVehicleTypeName(value?: string): string {
  const raw = (value || "").trim().toLowerCase();
  const stripped = raw.replace(/\s+/g, "").replace(/-/g, "").replace(/\//g, "");
  // tolerate plural forms
  if (stripped.endsWith("s") && stripped.length > 1) return stripped.slice(0, -1);
  return stripped;
}

export const CANONICAL_VEHICLE_TYPES: Array<{ type: string; defaultColor: string }> = [
  { type: "Lining", defaultColor: "purple" },
  { type: "Recycler", defaultColor: "orange" },
  { type: "CCTV", defaultColor: "blue" },
  { type: "CCTV/Van Pack", defaultColor: "indigo" },
  { type: "Jet Vac", defaultColor: "teal" },
];

function getTypeName(t: string | { type: string; defaultColor?: string }): string {
  return typeof t === "string" ? t : t.type;
}

function getTypeColor(t: string | { type: string; defaultColor?: string }): string | undefined {
  return typeof t === "string" ? undefined : t.defaultColor;
}

export function mergeAndSortVehicleTypes(
  existing: VehicleTypesConfig | undefined | null
): Array<{ type: string; defaultColor?: string }> {
  const existingArr: Array<string | { type: string; defaultColor?: string }> = Array.isArray(existing)
    ? existing
    : [];

  // Build a map by normalized name; prefer existing entries (to preserve custom colors).
  const byNorm = new Map<string, { type: string; defaultColor?: string }>();
  for (const entry of existingArr) {
    const name = getTypeName(entry);
    const norm = normalizeVehicleTypeName(name);
    if (!norm) continue;
    if (!byNorm.has(norm)) {
      byNorm.set(norm, { type: name, defaultColor: getTypeColor(entry) });
    }
  }

  // Ensure canonical types exist (fill missing defaultColor if not present)
  for (const c of CANONICAL_VEHICLE_TYPES) {
    const norm = normalizeVehicleTypeName(c.type);
    const existingEntry = byNorm.get(norm);
    if (!existingEntry) {
      byNorm.set(norm, { type: c.type, defaultColor: c.defaultColor });
    } else if (!existingEntry.defaultColor) {
      byNorm.set(norm, { ...existingEntry, defaultColor: c.defaultColor });
    }
  }

  // Produce ordered list: canonical order first, then remaining custom types (alpha by display name).
  const canonicalNormOrder = CANONICAL_VEHICLE_TYPES.map((c) => normalizeVehicleTypeName(c.type));
  const canonicalSet = new Set(canonicalNormOrder);

  const canonicalOrdered = canonicalNormOrder
    .map((norm) => byNorm.get(norm))
    .filter((v): v is { type: string; defaultColor?: string } => Boolean(v));

  const custom = Array.from(byNorm.entries())
    .filter(([norm]) => !canonicalSet.has(norm))
    .map(([, v]) => v)
    .sort((a, b) => a.type.localeCompare(b.type));

  return [...canonicalOrdered, ...custom];
}

export function getDefaultColorForVehicleType(type: string, vehicleTypes: VehicleTypesConfig | undefined): string | undefined {
  if (!vehicleTypes || vehicleTypes.length === 0) return undefined;
  const targetNorm = normalizeVehicleTypeName(type);
  const found = (vehicleTypes as any[]).find((t) => normalizeVehicleTypeName(typeof t === "string" ? t : t.type) === targetNorm);
  if (!found || typeof found === "string") return undefined;
  return found.defaultColor;
}

// Return the display string exactly as it appears in the merged vehicleTypes list,
// so UI text matches the dropdown even if the saved type uses plural/format variants.
export function getVehicleTypeDisplayName(requestedType: string | undefined, vehicleTypes: VehicleTypesConfig | undefined): string | undefined {
  if (!requestedType) return undefined;
  if (!vehicleTypes || vehicleTypes.length === 0) return requestedType;
  const targetNorm = normalizeVehicleTypeName(requestedType);
  const merged = mergeAndSortVehicleTypes(vehicleTypes);
  const found = merged.find((t) => normalizeVehicleTypeName(t.type) === targetNorm);
  return found?.type || requestedType;
}

