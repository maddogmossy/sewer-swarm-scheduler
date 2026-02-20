import { useState, useEffect, useCallback, useRef } from "react";

export interface UISettings {
  showStartTime: boolean;
  showOnsiteTime: boolean;
  showOffsiteTime: boolean;
  showDurationBadge: boolean;
  // Whether to prompt for scope when moving operatives/assistants (day vs remainder of week)
  promptOperativeMoveScope: boolean;
  // Whether to show the vehicle pairing detected popup (CCTV + Jet Vac/Recycler)
  promptVehiclePairingDetected: boolean;
  // Whether to auto-calculate job start time from employee/depot location
  autoCalculateStartFromLocation: boolean;
  // Default start times for jobs (24h)
  defaultDayStartTime: string;
  defaultNightStartTime: string;
  // Extra minutes before start for traffic / vehicle checks
  preStartBufferMinutes: number;
  // Approval workflow settings
  requireApprovalForBookings: boolean;
  approvalMethod: 'email' | 'internal';
}

const DEFAULT_SETTINGS: UISettings = {
  showStartTime: true,
  showOnsiteTime: true,
  showOffsiteTime: true,
  showDurationBadge: true,
  promptOperativeMoveScope: true,
  promptVehiclePairingDetected: true,
  autoCalculateStartFromLocation: true,
  defaultDayStartTime: "08:30",
  defaultNightStartTime: "20:00",
  preStartBufferMinutes: 15,
  requireApprovalForBookings: true,
  approvalMethod: 'internal',
};

const STORAGE_KEY = "sewer-swarm-ui-settings";
const SETTINGS_CHANGED_EVENT = "sewer-swarm-ui-settings-changed";

function broadcastSettings(updated: UISettings) {
  try {
    if (typeof window === "undefined") return;
    // Defer to avoid cross-component updates during React render.
    const dispatch = () =>
      window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: updated }));
    if (typeof queueMicrotask === "function") queueMicrotask(dispatch);
    else Promise.resolve().then(dispatch);
  } catch {
    // ignore
  }
}

export function useUISettings() {
  const [settings, setSettings] = useState<UISettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const settingsRef = useRef<UISettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const apply = (next: unknown) => {
      try {
        // next may be a partial; always merge with defaults
        const merged = { ...DEFAULT_SETTINGS, ...(next as any) } as UISettings;
        setSettings(merged);
      } catch {
        // ignore
      }
    };

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        apply(parsed);
      } else {
      }
    } catch (error) {
      console.error("Failed to load UI settings:", error);
    } finally {
      setIsLoaded(true);
    }

    const onSettingsChanged = (e: Event) => {
      const ce = e as CustomEvent;
      apply(ce.detail);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (!e.newValue) {
        apply({});
        return;
      }
      try {
        apply(JSON.parse(e.newValue));
      } catch {
        // ignore
      }
    };

    try {
      window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as any);
      window.addEventListener("storage", onStorage);
    } catch {
      // ignore
    }

    return () => {
      try {
        window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as any);
        window.removeEventListener("storage", onStorage);
      } catch {
        // ignore
      }
    };
  }, []);

  // Save settings to localStorage
  const updateSetting = useCallback(<K extends keyof UISettings>(
    key: K,
    value: UISettings[K]
  ) => {
    const prev = settingsRef.current;
    const updated = { ...prev, [key]: value };

    setSettings(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save UI settings:", error);
    }
    broadcastSettings(updated);
  }, []);

  // Update multiple settings at once
  const updateSettings = useCallback((newSettings: Partial<UISettings>) => {
    const prev = settingsRef.current;
    const updated = { ...prev, ...newSettings };
    setSettings(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save UI settings:", error);
    }
    broadcastSettings(updated);
  }, []);

  return {
    settings,
    updateSetting,
    updateSettings,
    isLoaded,
  };
}
