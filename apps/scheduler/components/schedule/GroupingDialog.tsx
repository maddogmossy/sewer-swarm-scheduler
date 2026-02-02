import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface GroupingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (applyToGroup: boolean) => void;
  itemType: 'delete' | 'color';
  groupCount: number;
  itemLabel?: string; // e.g., "Job JOB-123" or "3 items"
}

export function GroupingDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  itemType, 
  groupCount,
  itemLabel 
}: GroupingDialogProps) {
  const handleConfirm = (applyToGroup: boolean) => {
    onConfirm(applyToGroup);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            {itemType === 'delete' ? 'Delete Item' : 'Change Color'}
          </DialogTitle>
          <DialogDescription>
            {itemType === 'delete' ? (
              <>
                {groupCount > 1 ? (
                  <>
                    Found <strong>{groupCount} items</strong> with the same job number.
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
                    Found <strong>{groupCount} items</strong> with the same job number.
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
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          {groupCount > 1 ? (
            <>
              <Button
                variant="default"
                onClick={() => handleConfirm(false)}
                className="w-full sm:w-auto"
              >
                {itemType === 'delete' ? 'Delete This One' : 'Change This One'}
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleConfirm(true)}
                className="w-full sm:w-auto"
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
