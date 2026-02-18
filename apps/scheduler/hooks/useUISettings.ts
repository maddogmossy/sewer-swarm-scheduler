import { useState, useEffect, useCallback } from "react";

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

export function useUISettings() {
  const [settings, setSettings] = useState<UISettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error("Failed to load UI settings:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save settings to localStorage
  const updateSetting = useCallback(<K extends keyof UISettings>(
    key: K,
    value: UISettings[K]
  ) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save UI settings:", error);
      }
      return updated;
    });
  }, []);

  // Update multiple settings at once
  const updateSettings = useCallback((newSettings: Partial<UISettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save UI settings:", error);
      }
      return updated;
    });
  }, []);

  return {
    settings,
    updateSetting,
    updateSettings,
    isLoaded,
  };
}
