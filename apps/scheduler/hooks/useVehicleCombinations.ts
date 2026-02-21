import { useState, useEffect, useCallback } from "react";
import type { VehicleCombinationConfig } from "@/lib/vehicleTypes";
import { DEFAULT_VEHICLE_COMBINATION } from "@/lib/vehicleTypes";

const STORAGE_KEY = "sewer-swarm-vehicle-combinations";

function loadCombinations(): VehicleCombinationConfig[] {
  if (typeof window === "undefined") return [DEFAULT_VEHICLE_COMBINATION];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [DEFAULT_VEHICLE_COMBINATION];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEFAULT_VEHICLE_COMBINATION];
    return parsed as VehicleCombinationConfig[];
  } catch {
    return [DEFAULT_VEHICLE_COMBINATION];
  }
}

function saveCombinations(combinations: VehicleCombinationConfig[]) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(combinations));
  } catch (e) {
    console.error("Failed to save vehicle combinations:", e);
  }
}

export function useVehicleCombinations() {
  const [combinations, setCombinations] = useState<VehicleCombinationConfig[]>(() => loadCombinations());

  useEffect(() => {
    setCombinations(loadCombinations());
  }, []);

  const persist = useCallback((next: VehicleCombinationConfig[]) => {
    setCombinations(next);
    saveCombinations(next);
  }, []);

  const addCombination = useCallback(() => {
    const next: VehicleCombinationConfig = {
      label: "New combination",
      defaultColor: "blue",
      groupA: [],
      groupB: [],
    };
    persist([...combinations, next]);
  }, [combinations, persist]);

  const updateCombination = useCallback(
    (index: number, updated: Partial<VehicleCombinationConfig>) => {
      if (index < 0 || index >= combinations.length) return;
      const next = combinations.map((c, i) =>
        i === index ? { ...c, ...updated } : c
      );
      persist(next);
    },
    [combinations, persist]
  );

  const removeCombination = useCallback(
    (index: number) => {
      if (index < 0 || index >= combinations.length) return;
      const next = combinations.filter((_, i) => i !== index);
      persist(next.length > 0 ? next : [DEFAULT_VEHICLE_COMBINATION]);
    },
    [combinations, persist]
  );

  const setCombinationsList = useCallback(
    (next: VehicleCombinationConfig[]) => {
      persist(next.length > 0 ? next : [DEFAULT_VEHICLE_COMBINATION]);
    },
    [persist]
  );

  return {
    combinations,
    addCombination,
    updateCombination,
    removeCombination,
    setCombinations: setCombinationsList,
  };
}
