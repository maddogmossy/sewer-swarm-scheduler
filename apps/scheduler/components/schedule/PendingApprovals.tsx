import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, X, Loader2, Calendar, MapPin, User, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  usePendingScheduleItems,
  useApproveScheduleItem,
  useRejectScheduleItem,
  type PendingScheduleItem,
} from "@/hooks/useOrganization";

export function PendingApprovals() {
  const { toast } = useToast();
  const [rejectingItem, setRejectingItem] = useState<PendingScheduleItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: pendingItems = [], isLoading } = usePendingScheduleItems();
  const approveMutation = useApproveScheduleItem();
  const rejectMutation = useRejectScheduleItem();

  const handleApprove = async (item: PendingScheduleItem) => {
    try {
      await approveMutation.mutateAsync(item.id);
      toast({
        title: "Booking approved",
        description: `The booking for ${item.customer || "Unknown customer"} has been approved.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve booking",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!rejectingItem || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        id: rejectingItem.id,
        reason: rejectionReason.trim(),
      });
      toast({
        title: "Booking rejected",
        description: `The booking has been rejected.`,
      });
      setRejectingItem(null);
      setRejectionReason("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject booking",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="pending-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pendingItems.length === 0) {
    return (
      <Card data-testid="no-pending-approvals">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
          <p className="text-muted-foreground text-center">
            There are no pending bookings waiting for approval.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="pending-approvals">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            Pending Approvals
          </h2>
          <p className="text-muted-foreground">
            {pendingItems.length} booking{pendingItems.length !== 1 ? "s" : ""} awaiting your review
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {pendingItems.map((item) => (
          <Card key={item.id} data-testid={`pending-item-${item.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      {item.type}
                    </Badge>
                    {item.requestedByUser && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Requested by {item.requestedByUser.username}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(item.date), "EEEE, d MMMM yyyy")}</span>
                    </div>
                    {item.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{item.location}</span>
                      </div>
                    )}
                  </div>

                  {item.customer && (
                    <div className="text-sm">
                      <span className="font-medium">Customer:</span> {item.customer}
                    </div>
                  )}

                  {item.notes && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Notes:</span> {item.notes}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      setRejectingItem(item);
                      setRejectionReason("");
                    }}
                    disabled={rejectMutation.isPending}
                    data-testid={`button-reject-${item.id}`}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(item)}
                    disabled={approveMutation.isPending}
                    data-testid={`button-approve-${item.id}`}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Approve
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!rejectingItem} onOpenChange={() => setRejectingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Booking</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this booking. This will be visible to the person who requested it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Reason for rejection</Label>
              <Input
                id="rejection-reason"
                placeholder="e.g., Crew not available on this date"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingItem(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
