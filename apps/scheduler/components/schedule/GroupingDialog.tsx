import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { ScheduleItem } from "./CalendarGrid";

interface GroupingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (applyToGroup: boolean) => void;
  itemType: 'delete' | 'color';
  groupCount: number;
  itemLabel?: string; // e.g., "Job JOB-123" or "3 items"
  groupedItems?: ScheduleItem[]; // Items with the same job number
  crews?: { id: string; name: string }[]; // Crew information for display
  currentItemId?: string; // ID of the current item being deleted/changed
}

export function GroupingDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  itemType, 
  groupCount,
  itemLabel,
  groupedItems = [],
  crews = [],
  currentItemId
}: GroupingDialogProps) {
  const handleConfirm = (applyToGroup: boolean) => {
    onConfirm(applyToGroup);
    onOpenChange(false);
  };

  // Get other items (excluding the current one)
  const otherItems = groupedItems.filter(item => item.id !== currentItemId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-slate-900 border-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            {itemType === 'delete' ? 'Delete Item' : 'Change Color'}
          </DialogTitle>
          <DialogDescription className="text-slate-700">
            {itemType === 'delete' ? (
              <>
                {groupCount > 1 ? (
                  <>
                    Found <strong className="text-slate-900">{groupCount} items</strong> with the same job number.
                    <br />
                    Do you want to delete just this one, or all {groupCount} items?
                  </>
                ) : (
                  <>Are you sure you want to delete this item?</>
                )}
              </>
            ) : (
              <>
                {groupCount > 1 ? (
                  <>
                    Found <strong className="text-slate-900">{groupCount} items</strong> with the same job number.
                    <br />
                    Do you want to change the color for just this one, or all {groupCount} items?
                  </>
                ) : (
                  <>Change the color for this item?</>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        {/* Show where other items are located */}
        {otherItems.length > 0 && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-sm font-semibold text-slate-900 mb-2">Other items are on:</div>
            <div className="space-y-1.5">
              {otherItems.map((item, idx) => {
                const crew = crews.find(c => c.id === item.crewId);
                return (
                  <div key={item.id || idx} className="flex items-center gap-2 text-sm text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-medium">{format(new Date(item.date), 'EEE, MMM d, yyyy')}</span>
                    {crew && (
                      <>
                        <Users className="w-3.5 h-3.5 text-slate-500 ml-2" />
                        <span>{crew.name}</span>
                      </>
                    )}
                    {item.customer && item.customer !== 'Free' && (
                      <span className="text-slate-500">• {item.customer}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 border-t border-slate-200 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-slate-700 hover:bg-slate-100 border-slate-300 bg-white"
          >
            Cancel
          </Button>
          {groupCount > 1 ? (
            <>
              <Button
                variant="default"
                onClick={() => handleConfirm(false)}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
              >
                {itemType === 'delete' ? 'Delete This One' : 'Change This One'}
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleConfirm(true)}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
              >
                {itemType === 'delete' ? `Delete All ${groupCount}` : `Change All ${groupCount}`}
              </Button>
            </>
          ) : (
            <Button
              variant={itemType === 'delete' ? 'destructive' : 'default'}
              onClick={() => handleConfirm(false)}
              className="w-full sm:w-auto"
            >
              {itemType === 'delete' ? 'Delete' : 'Change Color'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
