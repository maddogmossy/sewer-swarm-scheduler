import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useUISettings } from "@/hooks/useUISettings";
import { useVehicleCombinations } from "@/hooks/useVehicleCombinations";
import { mergeAndSortVehicleTypes, normalizeVehicleTypeName } from "@/lib/vehicleTypes";
import type { VehicleTypesConfig, VehicleCombinationConfig } from "@/lib/vehicleTypes";
import { Clock, MapPin, Timer, Calendar, Mail, Bell, ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const AVAILABLE_COLORS = [
  { value: "blue", class: "bg-[#BFDBFE] border-[#3B82F6]" },
  { value: "green", class: "bg-[#BBF7D0] border-[#22C55E]" },
  { value: "yellow", class: "bg-[#FEF08A] border-[#EAB308]" },
  { value: "orange", class: "bg-[#FED7AA] border-[#F97316]" },
  { value: "red", class: "bg-[#FECACA] border-[#EF4444]" },
  { value: "purple", class: "bg-[#E9D5FF] border-[#A855F7]" },
  { value: "pink", class: "bg-[#FBCFE8] border-[#EC4899]" },
  { value: "teal", class: "bg-[#99F6E4] border-[#14B8A6]" },
  { value: "gray", class: "bg-[#E2E8F0] border-[#64748B]" },
  { value: "indigo", class: "bg-[#C7D2FE] border-[#6366F1]" },
  { value: "cyan", class: "bg-[#A5F3FC] border-[#06B6D4]" },
  { value: "lime", class: "bg-[#D9F99D] border-[#84CC16]" },
];

interface UISettingsProps {
  vehicleTypes?: VehicleTypesConfig;
  /** When provided, Settings uses this state so the schedule grid updates when you change combination color */
  vehicleCombinations?: VehicleCombinationConfig[];
  onAddCombination?: () => void;
  onUpdateCombination?: (index: number, updated: Partial<VehicleCombinationConfig>) => void;
  onRemoveCombination?: (index: number) => void;
}

export function UISettings({
  vehicleTypes,
  vehicleCombinations: vehicleCombinationsFromParent,
  onAddCombination,
  onUpdateCombination,
  onRemoveCombination,
}: UISettingsProps) {
  const { settings, updateSetting } = useUISettings();
  const hook = useVehicleCombinations();
  const useParent = vehicleCombinationsFromParent != null && onUpdateCombination != null;
  const combinations = useParent ? vehicleCombinationsFromParent : hook.combinations;
  const addCombination = useParent ? (onAddCombination ?? (() => {})) : hook.addCombination;
  const updateCombination = useParent ? (onUpdateCombination ?? (() => {})) : hook.updateCombination;
  const removeCombination = useParent ? (onRemoveCombination ?? (() => {})) : hook.removeCombination;

  const combinationLabelsNorm = new Set(combinations.map((c) => normalizeVehicleTypeName(c.label)));
  const typeOptions = vehicleTypes
    ? mergeAndSortVehicleTypes(vehicleTypes)
        .map((t) => t.type)
        .filter((type) => !combinationLabelsNorm.has(normalizeVehicleTypeName(type)))
    : [];

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
          <h4 className="text-sm font-semibold text-slate-900">Scheduling</h4>
          <p className="text-xs text-slate-600 mt-0.5">
            Control prompts and behaviors while editing the schedule.
          </p>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200">
              <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <Label htmlFor="prompt-operative-move-scope" className="text-slate-900 font-medium cursor-pointer">
                Prompt for operative move scope
              </Label>
              <p className="text-sm text-slate-600 mt-0.5">
                When dragging an operative/assistant to another day, ask whether to apply to this day only or remainder of week.
              </p>
            </div>
          </div>
          <Switch
            id="prompt-operative-move-scope"
            checked={settings.promptOperativeMoveScope}
            onCheckedChange={(checked) => updateSetting("promptOperativeMoveScope", checked)}
            className="data-[state=checked]:bg-indigo-600"
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center border border-pink-200">
              <Bell className="h-5 w-5 text-pink-600" />
            </div>
            <div>
              <Label htmlFor="prompt-vehicle-pairing" className="text-slate-900 font-medium cursor-pointer">
                Vehicle Pairing Detected
              </Label>
              <p className="text-sm text-slate-600 mt-0.5">
                Show the popup when CCTV is paired with Jet Vac/Recycler, asking whether to combine or keep separate.
              </p>
            </div>
          </div>
          <Switch
            id="prompt-vehicle-pairing"
            checked={settings.promptVehiclePairingDetected}
            onCheckedChange={(checked) => updateSetting("promptVehiclePairingDetected", checked)}
            className="data-[state=checked]:bg-pink-600"
          />
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <h5 className="text-sm font-medium text-slate-800">Vehicle unit combinations</h5>
            <p className="text-xs text-slate-600 mt-0.5">
              When these unit types appear together in a cell, show one combined label and colour. First match wins.
            </p>
          </div>
          <div className="space-y-3">
            {combinations.map((combo, index) => (
              <div
                key={index}
                className="flex flex-wrap items-start gap-3 p-4 rounded-lg border border-slate-200 bg-white"
              >
                <div className="space-y-1 min-w-[120px]">
                  <Label className="text-xs text-slate-600">Label</Label>
                  <Input
                    value={combo.label}
                    onChange={(e) => updateCombination(index, { label: e.target.value.trim() || combo.label })}
                    placeholder="e.g. CCTV/Jet Vac"
                    className="h-8 text-sm bg-white border-slate-300 text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Colour</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-8 gap-1.5 border-slate-300 text-slate-700",
                          AVAILABLE_COLORS.find((c) => c.value === combo.defaultColor)?.class
                        )}
                      >
                        <span className="w-3 h-3 rounded-full border border-slate-400 shrink-0" />
                        {combo.defaultColor}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2 bg-white" align="start">
                      <div className="flex flex-wrap gap-1">
                        {AVAILABLE_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => updateCombination(index, { defaultColor: c.value })}
                            className={cn(
                              "w-6 h-6 rounded border-2 shrink-0",
                              c.class,
                              combo.defaultColor === c.value ? "ring-2 ring-offset-1 ring-slate-400" : "border-transparent"
                            )}
                            title={c.value}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1 min-w-[140px]">
                  <Label className="text-xs text-slate-600">Group A (at least one)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 w-full justify-between border-slate-300 text-slate-700 text-xs">
                        {combo.groupA.length ? `${combo.groupA.length} selected` : "Select types"}
                        <span className="ml-1 opacity-70">▼</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 bg-white max-h-48 overflow-auto" align="start">
                      {typeOptions.length === 0 ? (
                        <p className="text-xs text-slate-500 py-2">Add vehicle types in Manage Depot first.</p>
                      ) : (
                        typeOptions.map((type) => (
                          <label
                            key={type}
                            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={combo.groupA.includes(type)}
                              onCheckedChange={(checked) => {
                                const next = checked
                                  ? [...combo.groupA, type]
                                  : combo.groupA.filter((t) => t !== type);
                                updateCombination(index, { groupA: next });
                              }}
                            />
                            {type}
                          </label>
                        ))
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1 min-w-[140px]">
                  <Label className="text-xs text-slate-600">Group B (at least one)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 w-full justify-between border-slate-300 text-slate-700 text-xs">
                        {combo.groupB.length ? `${combo.groupB.length} selected` : "Select types"}
                        <span className="ml-1 opacity-70">▼</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 bg-white max-h-48 overflow-auto" align="start">
                      {typeOptions.length === 0 ? (
                        <p className="text-xs text-slate-500 py-2">Add vehicle types in Manage Depot first.</p>
                      ) : (
                        typeOptions.map((type) => (
                          <label
                            key={type}
                            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={combo.groupB.includes(type)}
                              onCheckedChange={(checked) => {
                                const next = checked
                                  ? [...combo.groupB, type]
                                  : combo.groupB.filter((t) => t !== type);
                                updateCombination(index, { groupB: next });
                              }}
                            />
                            {type}
                          </label>
                        ))
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCombination(index)}
                  className="h-8 text-slate-500 hover:text-red-600 shrink-0"
                  title="Remove combination"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCombination}
              className="border-slate-300 text-slate-700"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add combination
            </Button>
          </div>
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

      <div className="space-y-4 pt-2 border-t border-slate-100">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Approval Workflow</h4>
          <p className="text-xs text-slate-600 mt-0.5">
            Control how bookings from availability search require approval.
          </p>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center border border-purple-200">
              <Bell className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <Label htmlFor="require-approval" className="text-slate-900 font-medium cursor-pointer">
                Require approval for bookings
              </Label>
              <p className="text-sm text-slate-600 mt-0.5">
                When enabled, bookings from availability search will be marked as provisional and require operations manager approval.
              </p>
            </div>
          </div>
          <Switch
            id="require-approval"
            checked={settings.requireApprovalForBookings}
            onCheckedChange={(checked) => updateSetting("requireApprovalForBookings", checked)}
            className="data-[state=checked]:bg-purple-600"
          />
        </div>
        {settings.requireApprovalForBookings && (
          <div className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
            <Label htmlFor="approval-method" className="text-sm font-medium text-slate-700">
              Approval Method
            </Label>
            <Select
              value={settings.approvalMethod}
              onValueChange={(value: 'email' | 'internal') => updateSetting("approvalMethod", value)}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="internal">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-slate-500" />
                    Internal Popup
                  </div>
                </SelectItem>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-500" />
                    Email Notification
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              {settings.approvalMethod === 'internal' 
                ? 'Operations manager will see a popup notification in the app when a booking requires approval.'
                : 'Operations manager will receive an email notification when a booking requires approval.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
