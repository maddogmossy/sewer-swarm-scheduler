import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Truck, Link2 } from "lucide-react";

interface VehiclePairingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  vehiclePairing: string; // e.g., "CCTV/Jet Vac" or "CCTV/Van Pack"
  applyPeriod: "none" | "week" | "month" | "6months" | "12months";
  onApplyPeriodChange: (value: "none" | "week" | "month" | "6months" | "12months") => void;
}

export function VehiclePairingDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  vehiclePairing,
  applyPeriod,
  onApplyPeriodChange,
}: VehiclePairingDialogProps) {
  const handleConfirm = () => {
    // Parent controls closing; avoid double-calling cancel via onOpenChange(false)
    onConfirm();
  };

  const handleCancel = () => {
    // Parent controls closing; avoid double-calling cancel via onOpenChange(false)
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white text-slate-900">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-blue-600" />
            </div>
            <DialogTitle className="text-xl font-semibold text-slate-900">
              Vehicle Pairing Detected
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-700 mt-2">
            Vehicles have been paired in this cell: <span className="font-semibold text-slate-900">{vehiclePairing}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-slate-700 mb-4">
            Would you like to combine these vehicles into a single job, or keep them as separate jobs?
          </p>

          <div className="mb-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Apply combine across:</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={applyPeriod === "none" ? "default" : "outline"}
                onClick={() => onApplyPeriodChange("none")}
                className={applyPeriod === "none" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}
              >
                This Day Only
              </Button>
              <Button
                type="button"
                variant={applyPeriod === "week" ? "default" : "outline"}
                onClick={() => onApplyPeriodChange("week")}
                className={applyPeriod === "week" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}
              >
                Remainder of Week
              </Button>
              <Button
                type="button"
                variant={applyPeriod === "month" ? "default" : "outline"}
                onClick={() => onApplyPeriodChange("month")}
                className={applyPeriod === "month" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}
              >
                Month
              </Button>
              <Button
                type="button"
                variant={applyPeriod === "6months" ? "default" : "outline"}
                onClick={() => onApplyPeriodChange("6months")}
                className={applyPeriod === "6months" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}
              >
                6 Months
              </Button>
              <Button
                type="button"
                variant={applyPeriod === "12months" ? "default" : "outline"}
                onClick={() => onApplyPeriodChange("12months")}
                className={applyPeriod === "12months" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}
              >
                12 Months
              </Button>
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Truck className="w-4 h-4" />
              <span>Combining will update all jobs in this cell to use the {vehiclePairing} color.</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Keep Separate
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Combine Them
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
