import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle, Mail, User } from "lucide-react";
import { format } from "date-fns";
import { ScheduleItem } from "./CalendarGrid";

interface StaffMember {
    id: string;
    name: string;
    role: 'operative' | 'assistant';
    email?: string;
}

interface EmailPreviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date: Date;
    items: ScheduleItem[];
    employees: { id: string; name: string; status: 'active' | 'holiday' | 'sick'; email?: string; jobRole: 'operative' | 'assistant' }[];
    onUpdateEmail: (id: string, email: string) => void;
    onSend: (date: Date, recipientCount: number) => void;
}

export function EmailPreviewModal({
    open,
    onOpenChange,
    date,
    items,
    employees,
    onUpdateEmail,
    onSend
}: EmailPreviewModalProps) {
    const [recipients, setRecipients] = useState<StaffMember[]>([]);
    const [isSending, setIsSending] = useState(false);

    // Identify recipients based on the schedule for the given date
    useEffect(() => {
        if (!open) return;

        const scheduledItems = items.filter(i => 
            (i.type === 'operative' || i.type === 'assistant') &&
            new Date(i.date).toDateString() === date.toDateString()
        );

        const uniqueEmployeeIds = new Set(scheduledItems.map(i => i.employeeId));
        
        const staffList = employees
            .filter(e => uniqueEmployeeIds.has(e.id))
            .map(e => ({
                id: e.id,
                name: e.name,
                role: e.jobRole,
                email: e.email
            }));

        setRecipients(staffList);
    }, [open, date, items, employees]);

    const handleEmailChange = (id: string, newEmail: string) => {
        // Update local state for immediate feedback
        setRecipients(prev => prev.map(r => r.id === id ? { ...r, email: newEmail } : r));
        // Update global state
        onUpdateEmail(id, newEmail);
    };

    const handleSend = () => {
        setIsSending(true);
        
        // Simulate network request
        setTimeout(() => {
            setIsSending(false);
            const validRecipients = recipients.filter(r => r.email && r.email.includes('@'));
            onSend(date, validRecipients.length);
            onOpenChange(false);
        }, 800);
    };

    const validCount = recipients.filter(r => r.email && r.email.includes('@')).length;
    const totalCount = recipients.length;
    const missingCount = totalCount - validCount;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-white text-slate-900 max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-600" />
                        Email Schedule for {format(date, "EEEE, MMM do")}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">Summary</span>
                            <Badge variant={missingCount > 0 ? "destructive" : "default"} className={missingCount > 0 ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : "bg-green-100 text-green-700 hover:bg-green-100"}>
                                {missingCount > 0 ? `${missingCount} Missing Emails` : "Ready to Send"}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                            Review recipients below. Add missing emails to ensure everyone receives their job details.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-md divide-y">
                        {recipients.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                No staff scheduled for this day.
                            </div>
                        ) : (
                            recipients.map(staff => (
                                <div key={staff.id} className="p-3 flex items-center gap-3 hover:bg-slate-50">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                                        <User className="w-4 h-4" />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{staff.name}</span>
                                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-slate-500">
                                                {staff.role}
                                            </Badge>
                                        </div>
                                        <Input 
                                            value={staff.email || ""}
                                            onChange={(e) => handleEmailChange(staff.id, e.target.value)}
                                            placeholder="Enter email address..."
                                            className="mt-1 h-7 text-xs bg-white"
                                        />
                                    </div>

                                    <div className="shrink-0">
                                        {staff.email && staff.email.includes('@') ? (
                                            <Check className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <AlertCircle className="w-5 h-5 text-amber-500" />
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <div className="flex-1 flex items-center text-xs text-slate-500">
                        Sending to {validCount} of {totalCount} recipients
                    </div>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button 
                        onClick={handleSend} 
                        disabled={validCount === 0 || isSending}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                    >
                        {isSending ? "Sending..." : "Send Emails"}
                        <Mail className="w-4 h-4" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
