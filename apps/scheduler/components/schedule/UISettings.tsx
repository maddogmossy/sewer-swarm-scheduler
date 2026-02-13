import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useUISettings } from "@/hooks/useUISettings";
import { Clock, MapPin, Timer, Calendar } from "lucide-react";

export function UISettings() {
  const { settings, updateSetting } = useUISettings();

  return (
    <div className="space-y-6" data-testid="ui-settings">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Job/Site Display Options</h3>
        <p className="text-sm text-slate-700 mt-1">Customize which information is shown on job and site cards</p>
      </div>

      <div className="space-y-4">
        {/* Start Time Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <Label htmlFor="show-start-time" className="text-slate-900 font-medium cursor-pointer">
                Show Start Time
              </Label>
              <p className="text-sm text-slate-600 mt-0.5">
                Display the start time (e.g., "08:00 -") on job cards
              </p>
            </div>
          </div>
          <Switch
            id="show-start-time"
            checked={settings.showStartTime}
            onCheckedChange={(checked) => updateSetting("showStartTime", checked)}
            className="data-[state=checked]:bg-blue-600"
          />
        </div>

        {/* Onsite Time Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center border border-green-200">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <Label htmlFor="show-onsite-time" className="text-slate-900 font-medium cursor-pointer">
                Show Onsite Time
              </Label>
              <p className="text-sm text-slate-600 mt-0.5">
                Display the onsite time duration on job cards
              </p>
            </div>
          </div>
          <Switch
            id="show-onsite-time"
            checked={settings.showOnsiteTime}
            onCheckedChange={(checked) => updateSetting("showOnsiteTime", checked)}
            className="data-[state=checked]:bg-green-600"
          />
        </div>

        {/* Offsite Time Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center border border-orange-200">
              <Timer className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <Label htmlFor="show-offsite-time" className="text-slate-900 font-medium cursor-pointer">
                Show Offsite Time
              </Label>
              <p className="text-sm text-slate-600 mt-0.5">
                Display the offsite time duration on job cards
              </p>
            </div>
          </div>
          <Switch
            id="show-offsite-time"
            checked={settings.showOffsiteTime}
            onCheckedChange={(checked) => updateSetting("showOffsiteTime", checked)}
            className="data-[state=checked]:bg-orange-600"
          />
        </div>

        {/* Duration Badge Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center border border-purple-200">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <Label htmlFor="show-duration-badge" className="text-slate-900 font-medium cursor-pointer">
                Show Duration Badge
              </Label>
              <p className="text-sm text-slate-600 mt-0.5">
                Display the duration badge (e.g., "8h") on job cards
              </p>
            </div>
          </div>
          <Switch
            id="show-duration-badge"
            checked={settings.showDurationBadge}
            onCheckedChange={(checked) => updateSetting("showDurationBadge", checked)}
            className="data-[state=checked]:bg-purple-600"
          />
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t border-slate-100">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Start Time Calculation</h4>
          <p className="text-xs text-slate-600 mt-0.5">
            Control whether start times auto-adjust based on employee home/depot and job postcode.
          </p>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
              <Clock className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <Label htmlFor="auto-calc-start" className="text-slate-900 font-medium cursor-pointer">
                Auto-calculate start time from location
              </Label>
              <p className="text-sm text-slate-600 mt-0.5">
                When on, jobs use employee home / depot and site postcode to suggest a start time.
              </p>
            </div>
          </div>
          <Switch
            id="auto-calc-start"
            checked={settings.autoCalculateStartFromLocation}
            onCheckedChange={(checked) => updateSetting("autoCalculateStartFromLocation", checked)}
            className="data-[state=checked]:bg-blue-600"
          />
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t border-slate-100">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Default Start Times</h4>
          <p className="text-xs text-slate-600 mt-0.5">
            Used as the default job start time for day and night crews. You can still override per job.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="default-day-start" className="text-xs text-slate-700 uppercase tracking-wide">
              Day shift start
            </Label>
            <Input
              id="default-day-start"
              type="time"
              value={settings.defaultDayStartTime}
              onChange={(e) => updateSetting("defaultDayStartTime", e.target.value || "08:30")}
              className="h-8 text-xs bg-white border-slate-300 text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="default-night-start" className="text-xs text-slate-700 uppercase tracking-wide">
              Night shift start
            </Label>
            <Input
              id="default-night-start"
              type="time"
              value={settings.defaultNightStartTime}
              onChange={(e) => updateSetting("defaultNightStartTime", e.target.value || "20:00")}
              className="h-8 text-xs bg-white border-slate-300 text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pre-start-buffer" className="text-xs text-slate-700 uppercase tracking-wide">
              Pre-start buffer (mins)
            </Label>
            <Input
              id="pre-start-buffer"
              type="number"
              min={0}
              value={settings.preStartBufferMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value || "0", 10);
                updateSetting("preStartBufferMinutes", Number.isNaN(val) ? 0 : val);
              }}
              className="h-8 text-xs bg-white border-slate-300 text-slate-900"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
