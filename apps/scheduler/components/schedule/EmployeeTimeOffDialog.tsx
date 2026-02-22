import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon } from "lucide-react";
import { addDays, format, startOfDay, startOfWeek, endOfWeek } from "date-fns";

export interface EmployeeTimeOffDialogPayload {
  absenceType: "holiday" | "sick" | "other";
  mode: "single" | "range";
  startDate: Date;
  endDate: Date;
  recurrence: "none" | "weekly" | "biweekly";
}

interface EmployeeTimeOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  initialDate?: Date | null;
  /**
   * Optional callback so the diary can react (e.g. remove assignments).
   * If not provided we simply log the request (same behaviour as Resources modal today).
   */
  onApply?: (payload: EmployeeTimeOffDialogPayload) => void;
}

export function EmployeeTimeOffDialog({
  open,
  onOpenChange,
  employeeName,
  initialDate,
  onApply,
}: EmployeeTimeOffDialogProps) {
  const [absenceType, setAbsenceType] = useState<"holiday" | "sick" | "other">("holiday");
  const [mode, setMode] = useState<"single" | "range">("single");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "biweekly">("none");

  // When the dialog opens, default the date to the item date (if provided) or today.
  useEffect(() => {
    if (!open) return;

    const baseDate = initialDate ? startOfDay(initialDate) : startOfDay(new Date());
    const baseIso = format(baseDate, "yyyy-MM-dd");

    setStartDate(baseIso);
    setEndDate(baseIso);
    setMode("single");
    setRecurrence("none");
    setAbsenceType("holiday");
  }, [open, initialDate]);

  const handleSave = () => {
    if (!startDate) {
      // Simple guard – in practice the date input is always populated.
      return;
    }

    const start = startOfDay(new Date(startDate));
    const end =
      mode === "single" || !endDate ? startOfDay(new Date(startDate)) : startOfDay(new Date(endDate));

    const payload: EmployeeTimeOffDialogPayload = {
      absenceType,
      mode,
      startDate: start,
      endDate: end,
      recurrence,
    };

    if (onApply) {
      onApply(payload);
    } else {
      // Fallback: mirror existing behaviour from ResourcesModal (log only)
      // eslint-disable-next-line no-console
      console.log("[TimeOff] Requested (calendar quick action):", {
        employeeName,
        ...payload,
      });
    }

    onOpenChange(false);
  };

  const todayIso = format(startOfDay(new Date()), "yyyy-MM-dd");
  const baseDate = useMemo(() => {
    return startOfDay(initialDate ? initialDate : new Date());
  }, [initialDate]);
  const baseIso = useMemo(() => format(baseDate, "yyyy-MM-dd"), [baseDate]);
  const tomorrowIso = useMemo(() => format(addDays(baseDate, 1), "yyyy-MM-dd"), [baseDate]);
  const weekStart = useMemo(() => startOfWeek(baseDate, { weekStartsOn: 1 }), [baseDate]);
  const weekEnd = useMemo(() => endOfWeek(baseDate, { weekStartsOn: 1 }), [baseDate]);
  const weekStartIso = useMemo(() => format(weekStart, "yyyy-MM-dd"), [weekStart]);
  const weekEndIso = useMemo(() => format(weekEnd, "yyyy-MM-dd"), [weekEnd]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            Book Time Off – {employeeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Reason</Label>
            <Select value={absenceType} onValueChange={(v: any) => setAbsenceType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="sick">Sickness</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Dates</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="text-xs px-3 py-1 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setMode("single");
                  setStartDate(baseIso);
                  setEndDate(baseIso);
                }}
              >
                Today
              </button>
              <button
                type="button"
                className="text-xs px-3 py-1 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setMode("single");
                  setStartDate(tomorrowIso);
                  setEndDate(tomorrowIso);
                }}
              >
                Tomorrow
              </button>
              <button
                type="button"
                className="text-xs px-3 py-1 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setMode("range");
                  setStartDate(weekStartIso);
                  setEndDate(weekEndIso);
                }}
              >
                Full week
              </button>
            </div>
            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-1">
                <input
                  id="timeoff-single"
                  type="radio"
                  checked={mode === "single"}
                  onChange={() => setMode("single")}
                  className="h-4 w-4"
                />
                <Label htmlFor="timeoff-single" className="text-sm">
                  Single day
                </Label>
              </div>
              <div className="flex items-center gap-1">
                <input
                  id="timeoff-range"
                  type="radio"
                  checked={mode === "range"}
                  onChange={() => setMode("range")}
                  className="h-4 w-4"
                />
                <Label htmlFor="timeoff-range" className="text-sm">
                  Date range
                </Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                className="text-sm"
                value={startDate}
                min={todayIso}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {mode === "range" && (
                <Input
                  type="date"
                  className="text-sm"
                  value={endDate}
                  min={startDate || todayIso}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Recurrence</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${
                  recurrence === "none"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setRecurrence("none")}
              >
                None
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${
                  recurrence === "weekly"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setRecurrence("weekly")}
              >
                Weekly
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${
                  recurrence === "biweekly"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setRecurrence("biweekly")}
              >
                Every other week
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

