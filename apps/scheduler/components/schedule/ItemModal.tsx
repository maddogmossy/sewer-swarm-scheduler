import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isSameDay, isBefore, startOfDay } from "date-fns";
import { CalendarIcon, MapPin, Briefcase, Check, User, Truck, Edit2, AlertCircle, Plus, X, Trash2, Search, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleItem } from "./CalendarGrid";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { useUISettings } from "@/hooks/useUISettings";
import { calculateStartTime, calculateNextJobStartTime, calculateOnsiteTime, calculateJobEndTime, calculateTravelTime, extractPostcode } from "@/lib/travelTime";

// ------------------- SCHEMAS -------------------

// Base schema - all fields optional for free jobs, but if converting to booked job, customer and address are required
const siteSchema = z.object({
  customer: z.string().optional(),
  jobNumber: z.string().optional(),
  address: z.string().optional(),
  projectManager: z.string().optional(),
  startTime: z.string().optional(), // Start time (e.g. 08:00)
  onsiteTime: z.string().optional(), // Onsite time (e.g. 09:00)
  duration: z.string().optional(), // Duration in hours (string input from form)
  color: z.string().default("blue"),
}).superRefine((data, ctx) => {
  // Only validate if user is trying to convert to a booked job (has customer or address)
  const hasCustomer = data.customer && data.customer.trim() !== '' && data.customer !== 'Free';
  const hasAddress = data.address && data.address.trim() !== '' && data.address !== 'Free';
  
  // If either customer or address is provided (and not 'Free'), both are required
  if (hasCustomer || hasAddress) {
    if (!hasCustomer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Customer is required when converting to a booked job",
        path: ["customer"],
      });
    }
    if (!hasAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Address is required when converting to a booked job",
        path: ["address"],
      });
    }
  }
  // If neither is provided, that's fine (free job - no validation needed)
});

const operativeSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  vehicleId: z.string().optional(), // Optional for assistant
});

// ------------------- COLORS -------------------

const AVAILABLE_COLORS = [
    { value: "blue", class: "bg-[#BFDBFE] border-[#3B82F6]", defaultLabel: "Standard Job" },
    { value: "green", class: "bg-[#BBF7D0] border-[#22C55E]", defaultLabel: "Completed" },
    { value: "yellow", class: "bg-[#FEF08A] border-[#EAB308]", defaultLabel: "Pending" },
    { value: "orange", class: "bg-[#FED7AA] border-[#F97316]", defaultLabel: "Warning" },
    { value: "red", class: "bg-[#FECACA] border-[#EF4444]", defaultLabel: "Urgent" },
    { value: "purple", class: "bg-[#E9D5FF] border-[#A855F7]", defaultLabel: "Specialist" },
    { value: "pink", class: "bg-[#FBCFE8] border-[#EC4899]", defaultLabel: "Other" },
    { value: "teal", class: "bg-[#99F6E4] border-[#14B8A6]", defaultLabel: "Maintenance" },
    { value: "gray", class: "bg-[#E2E8F0] border-[#64748B]", defaultLabel: "Cancelled" },
    // Extra colors for expansion
    { value: "indigo", class: "bg-[#C7D2FE] border-[#6366F1]", defaultLabel: "New Category" },
    { value: "cyan", class: "bg-[#A5F3FC] border-[#06B6D4]", defaultLabel: "New Category" },
    { value: "lime", class: "bg-[#D9F99D] border-[#84CC16]", defaultLabel: "New Category" },
    { value: "emerald", class: "bg-[#A7F3D0] border-[#10B981]", defaultLabel: "New Category" },
    { value: "amber", class: "bg-[#FDE68A] border-[#D97706]", defaultLabel: "New Category" },
    { value: "rose", class: "bg-[#FECDD3] border-[#F43F5E]", defaultLabel: "New Category" },
    { value: "fuchsia", class: "bg-[#F5D0FE] border-[#E879F9]", defaultLabel: "New Category" },
    { value: "violet", class: "bg-[#DDD6FE] border-[#8B5CF6]", defaultLabel: "New Category" },
    { value: "sky", class: "bg-[#BAE6FD] border-[#0EA5E9]", defaultLabel: "New Category" },
    { value: "indigo_dark", class: "bg-[#C7D2FE] border-[#4F46E5]", defaultLabel: "New Category" },
    { value: "blue_gray", class: "bg-[#CBD5E1] border-[#64748B]", defaultLabel: "New Category" },
    { value: "stone", class: "bg-[#D6D3D1] border-[#78716C]", defaultLabel: "New Category" },
    { value: "red_dark", class: "bg-[#FECACA] border-[#B91C1C]", defaultLabel: "New Category" },
    { value: "orange_dark", class: "bg-[#FED7AA] border-[#C2410C]", defaultLabel: "New Category" },
    { value: "yellow_dark", class: "bg-[#FEF08A] border-[#A16207]", defaultLabel: "New Category" },
];

const MOCK_ADDRESSES = [
    "10 Downing Street, London, SW1A 2AA",
    "Buckingham Palace, London, SW1A 1AA",
    "Tower of London, London, EC3N 4AB",
    "The Shard, 32 London Bridge St, London, SE1 9SG",
    "Hyde Park Corner, London, W1J 7NT",
    "221B Baker Street, London, NW1 6XE",
    "Houses of Parliament, Westminster, London, SW1A 0AA",
    "British Museum, Great Russell St, London, WC1B 3DG",
    "Tate Modern, Bankside, London, SE1 9TG",
    "Wembley Stadium, London, HA9 0WS"
];


// ------------------- TYPES -------------------

interface ItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  type: 'job' | 'operative' | 'assistant' | 'note';
  initialData?: Partial<ScheduleItem>;
  employees: { 
    id: string; 
    name: string; 
    status: 'active' | 'holiday' | 'sick'; 
    jobRole?: 'operative' | 'assistant';
    homePostcode?: string;
    startsFromHome?: boolean;
    depotId?: string;
  }[];
  vehicles: { id: string; name: string; status: 'active' | 'off_road' | 'maintenance' }[];
  items: ScheduleItem[]; // For conflict detection
  crews?: { id: string; shift?: 'day' | 'night'; depotId?: string }[]; // For validating assignments against active crews
  depots?: { id: string; name: string; address: string }[]; // Depot addresses for employees who start from depot
  colorLabels?: Record<string, string>;
  onColorLabelUpdate?: (color: string, label: string) => void;
  isReadOnly?: boolean;
  onMoveDate?: (newDate: Date, moveGroup: boolean) => void; // For moving jobs to a new date
}

const noteSchema = z.object({
  noteContent: z.string().min(1, "Note content is required"),
});

export function ItemModal({ open, onOpenChange, onSubmit, type, initialData, employees, vehicles, items, crews, depots, colorLabels, onColorLabelUpdate, isReadOnly = false, onMoveDate }: ItemModalProps) {
  // We conditionally render different forms based on type
  if (type === 'job') {
    return <SiteForm open={open} onOpenChange={onOpenChange} onSubmit={onSubmit} initialData={initialData} employees={employees} depots={depots} crews={crews} colorLabels={colorLabels} onColorLabelUpdate={onColorLabelUpdate} isReadOnly={isReadOnly} onMoveDate={onMoveDate} items={items} />;
  }
  if (type === 'note') {
      return <NoteForm open={open} onOpenChange={onOpenChange} onSubmit={onSubmit} initialData={initialData} />;
  }
  return <OperativeForm open={open} onOpenChange={onOpenChange} onSubmit={onSubmit} type={type} initialData={initialData} employees={employees} vehicles={vehicles} items={items} crews={crews} />;
}

// ------------------- NOTE FORM -------------------

function NoteForm({ open, onOpenChange, onSubmit, initialData }: any) {
    const [applyPeriod, setApplyPeriod] = useState<'none' | 'week' | 'month' | '6months' | '12months'>('none');
    const form = useForm({
        resolver: zodResolver(noteSchema),
        defaultValues: {
            noteContent: initialData?.noteContent || "",
        },
    });

    useEffect(() => {
        if (open) {
            setApplyPeriod('none');
            form.reset({
                noteContent: initialData?.noteContent || "",
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData?.noteContent, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] bg-white text-slate-900">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-red-600" />
                        {initialData ? "Edit Note" : "Add Note"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit((data) => { onSubmit(data, applyPeriod); onOpenChange(false); form.reset(); })} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label>Note Content</Label>
                        <Textarea 
                            {...form.register("noteContent")} 
                            placeholder="Type your note here..." 
                            className="min-h-[100px]"
                        />
                    </div>

                    <DialogFooter className="flex items-center justify-between sm:justify-between gap-4">
                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-medium text-slate-600 mb-1">Apply to:</div>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center space-x-1.5">
                                    <Checkbox 
                                        id="applyWeekNote" 
                                        checked={applyPeriod === 'week'} 
                                        onCheckedChange={(c) => setApplyPeriod(c ? 'week' : 'none')} 
                                    />
                                    <label htmlFor="applyWeekNote" className="text-sm font-medium leading-none cursor-pointer">
                                        Remainder of Week
                                    </label>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                    <Checkbox 
                                        id="applyMonthNote" 
                                        checked={applyPeriod === 'month'} 
                                        onCheckedChange={(c) => setApplyPeriod(c ? 'month' : 'none')} 
                                    />
                                    <label htmlFor="applyMonthNote" className="text-sm font-medium leading-none cursor-pointer">
                                        Month
                                    </label>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                    <Checkbox 
                                        id="apply6MonthsNote" 
                                        checked={applyPeriod === '6months'} 
                                        onCheckedChange={(c) => setApplyPeriod(c ? '6months' : 'none')} 
                                    />
                                    <label htmlFor="apply6MonthsNote" className="text-sm font-medium leading-none cursor-pointer">
                                        6 Months
                                    </label>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                    <Checkbox 
                                        id="apply12MonthsNote" 
                                        checked={applyPeriod === '12months'} 
                                        onCheckedChange={(c) => setApplyPeriod(c ? '12months' : 'none')} 
                                    />
                                    <label htmlFor="apply12MonthsNote" className="text-sm font-medium leading-none cursor-pointer">
                                        12 Months
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white">Save Note</Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ------------------- SITE FORM -------------------

function SiteForm({ open, onOpenChange, onSubmit, initialData, employees = [], depots = [], crews = [], colorLabels, onColorLabelUpdate, isReadOnly = false, onMoveDate, items = [] }: any) {
  const [applyPeriod, setApplyPeriod] = useState<'none' | 'week' | 'month' | '6months' | '12months'>('none');
  const [moveDateOpen, setMoveDateOpen] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [moveGroupDialogOpen, setMoveGroupDialogOpen] = useState(false);
  const [pendingMoveDate, setPendingMoveDate] = useState<Date | null>(null);
  const [updateScope, setUpdateScope] = useState<'single' | 'group'>('single');
  
  // Check if item is in the past (only allow color changes for past items)
  const isPastItem = initialData?.date ? isBefore(startOfDay(new Date(initialData.date)), startOfDay(new Date())) : false;
  
  // Check if this is a free job being edited
  const isFreeJob = initialData?.jobStatus === 'free' || initialData?.customer === 'Free';
  
  // In read-only mode, only allow editing job status for past jobs
  const isReadOnlyPastJob = isReadOnly && isPastItem && initialData?.id;
  
  // Check if this job is part of a group (same job number)
  const groupItems = initialData?.id && initialData?.jobNumber ? items.filter((i: ScheduleItem) => 
    i.type === 'job' && 
    i.jobNumber === initialData.jobNumber && 
    i.jobNumber !== undefined &&
    i.id !== initialData.id
  ) : [];
  const isPartOfGroup = groupItems.length > 0;
  
  // Reset update scope when modal opens
  useEffect(() => {
    if (open && isReadOnlyPastJob) {
      setUpdateScope(isPartOfGroup ? 'single' : 'single');
    }
  }, [open, isReadOnlyPastJob, isPartOfGroup]);
  
  const { settings } = useUISettings();

  // Get crew shift for day/night default
  const getCrewShift = (): 'day' | 'night' => {
    if (initialData?.crewId && crews) {
      const crew = crews.find(c => c.id === initialData.crewId);
      return crew?.shift === 'night' ? 'night' : 'day';
    }
    return 'day';
  };

  // Calculate start time based on employee location and job address
  const calculateStartTimeFromLocation = (address: string, employeeId?: string, crewId?: string): string => {
    const shift = getCrewShift();
    const defaultStart = shift === 'night' ? settings.defaultNightStartTime : settings.defaultDayStartTime;

    // If user has turned off auto-calculation, always use default
    if (!settings.autoCalculateStartFromLocation) {
      return defaultStart;
    }
    
    if (!address) {
      return defaultStart;
    }

    // First, check if there are other jobs on the same day for this crew
    // If so, calculate based on the previous job's end time + travel
    if (initialData?.date && initialData?.crewId && items) {
      const sameDayJobs = items.filter((item: any) => 
        item.type === 'job' && 
        item.crewId === initialData.crewId &&
        item.id !== initialData.id &&
        item.customer !== 'Free' &&
        item.address !== 'Free' &&
        item.jobStatus !== 'free' &&
        isSameDay(new Date(item.date), new Date(initialData.date))
      );
      
      if (sameDayJobs.length > 0) {
        // Sort jobs by start time
        const sortedJobs = [...sameDayJobs].sort((a: any, b: any) => {
          if (!a.startTime || !b.startTime) return 0;
          return a.startTime.localeCompare(b.startTime);
        });
        
        // Find the latest job (or the one that would come before this one)
        const latestJob = sortedJobs[sortedJobs.length - 1];
        
        if (latestJob.startTime && latestJob.duration && latestJob.address) {
          // Calculate end time of previous job
          const previousEndTime = calculateJobEndTime(latestJob.startTime, Number(latestJob.duration));
          
          // Start time = when they leave previous job (end time of previous job)
          const nextStartTime = calculateNextJobStartTime(previousEndTime);
          
          return nextStartTime;
        }
      }
    }

    // If no previous jobs, calculate from employee/depot location
    // Determine start location (employee home/depot, or crew depot)
    let startLocation: string | null = null;

    // First, try to use employee location if employee is assigned
    if (employeeId) {
      const employee = employees.find(e => e.id === employeeId);
      if (employee) {
        if (employee.startsFromHome && employee.homePostcode) {
          // Employee starts from home - use their postcode
          startLocation = employee.homePostcode;
        } else if (employee.depotId && depots) {
          // Employee starts from depot - use depot address
          const depot = depots.find(d => d.id === employee.depotId);
          if (depot) {
            startLocation = depot.address;
          }
        }
      }
    }

    // If no employee location, try to use crew's depot
    if (!startLocation && crewId && crews && depots) {
      const crew = crews.find(c => c.id === crewId);
      if (crew?.depotId) {
        const depot = depots.find(d => d.id === crew.depotId);
        if (depot) {
          startLocation = depot.address;
        }
      }
    }

    // If we have both locations, calculate travel time
    if (startLocation) {
      return calculateStartTime(
        defaultStart,
        startLocation,
        address,
        settings.preStartBufferMinutes
      );
    }

    // Fallback to default
    return defaultStart;
  };

  const getDefaultStartTime = () => {
    if (initialData?.startTime) return initialData.startTime;
    
    // Calculate based on employee/crew location and job address if available
    if (initialData?.address) {
      return calculateStartTimeFromLocation(
        initialData.address, 
        initialData?.employeeId, 
        initialData?.crewId
      );
    }
    
    // Otherwise use day/night default
    const shift = getCrewShift();
    return shift === 'night' ? settings.defaultNightStartTime : settings.defaultDayStartTime;
  };

  const form = useForm({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      customer: initialData?.customer === 'Free' ? "" : (initialData?.customer || ""),
      jobNumber: initialData?.jobNumber || "",
      address: initialData?.address === 'Free' ? "" : (initialData?.address || ""),
      projectManager: initialData?.projectManager || "",
      startTime: initialData?.startTime || getDefaultStartTime() || "08:00",
      onsiteTime: initialData?.onsiteTime || "09:00",
      duration: initialData?.duration?.toString() || "8",
      color: initialData?.color || "blue",
    },
  });

  // Reset form when initialData changes or modal opens
  useEffect(() => {
    if (open) {
        setApplyPeriod('none');
        const isFree = initialData?.jobStatus === 'free' || initialData?.customer === 'Free';
        form.reset({
            customer: isFree ? "" : (initialData?.customer || ""),
            jobNumber: initialData?.jobNumber || "",
            address: isFree ? "" : (initialData?.address || ""),
            projectManager: initialData?.projectManager || "",
            startTime: initialData?.startTime || getDefaultStartTime() || "08:00",
            onsiteTime: initialData?.onsiteTime || "09:00",
            duration: initialData?.duration?.toString() || "8",
            color: initialData?.color || "blue",
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.customer, initialData?.jobNumber, initialData?.address, initialData?.projectManager, initialData?.startTime, initialData?.onsiteTime, initialData?.duration, initialData?.color, initialData?.jobStatus, open]);

  const selectedColor = form.watch("color");
  const watchedAddress = form.watch("address");
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState("");

  // Recalculate start time when address changes (if we have employee/crew info)
  useEffect(() => {
    if (!open || !watchedAddress || watchedAddress === 'Free') return;
    
    // Only auto-calculate if start time hasn't been manually set
    const currentStartTime = form.getValues("startTime");
    if (currentStartTime && currentStartTime !== getDefaultStartTime()) {
      // User has manually set start time, don't override
      return;
    }

    // Calculate new start time using employee or crew location (or previous job)
    const newStartTime = calculateStartTimeFromLocation(
      watchedAddress, 
      initialData?.employeeId, 
      initialData?.crewId
    );
    
    // Only update if it's different to avoid infinite loops
    if (newStartTime !== currentStartTime) {
      form.setValue("startTime", newStartTime, { shouldValidate: false });
      
      // Auto-calculate onsite time based on start time
      // Start time = when they leave, Onsite time = when they arrive
      let newOnsiteTime = newStartTime;
      
      // Check if this is based on a previous job by finding same-day jobs
      if (initialData?.date && initialData?.crewId && items && watchedAddress && watchedAddress !== 'Free') {
        const sameDayJobs = items.filter((item: any) => 
          item.type === 'job' && 
          item.crewId === initialData.crewId &&
          item.id !== initialData.id &&
          item.customer !== 'Free' &&
          item.address !== 'Free' &&
          item.jobStatus !== 'free' &&
          item.address &&
          item.startTime &&
          item.duration &&
          isSameDay(new Date(item.date), new Date(initialData.date))
        );
        
        if (sameDayJobs.length > 0) {
          // Sort jobs by start time to find the latest one
          const sortedJobs = [...sameDayJobs].sort((a: any, b: any) => {
            if (!a.startTime || !b.startTime) return 0;
            return a.startTime.localeCompare(b.startTime);
          });
          
          // Find the job that would end just before this one starts
          // Check if newStartTime matches the end time of any previous job
          let foundPreviousJob = null;
          for (const job of sortedJobs) {
            const jobEndTime = calculateJobEndTime(job.startTime, Number(job.duration));
            if (jobEndTime === newStartTime) {
              foundPreviousJob = job;
              break;
            }
          }
          
          // If we found a previous job that ends when this one starts, calculate travel
          if (foundPreviousJob && foundPreviousJob.address && foundPreviousJob.address !== 'Free') {
            // Onsite time = start time (leave time) + travel time to arrive
            newOnsiteTime = calculateOnsiteTime(
              newStartTime,
              foundPreviousJob.address,
              watchedAddress
            );
          } else if (sortedJobs.length > 0) {
            // Use the latest job even if times don't match exactly (might be approximate)
            const latestJob = sortedJobs[sortedJobs.length - 1];
            if (latestJob.address && latestJob.address !== 'Free') {
              newOnsiteTime = calculateOnsiteTime(
                newStartTime,
                latestJob.address,
                watchedAddress
              );
            } else {
              // Previous job has no address, use default
              const shift = getCrewShift();
              newOnsiteTime = shift === 'night' ? settings.defaultNightStartTime : settings.defaultDayStartTime;
            }
          } else {
            // Coming from depot/home - start time is leave time, onsite = default start time (arrival)
            const shift = getCrewShift();
            newOnsiteTime = shift === 'night' ? settings.defaultNightStartTime : settings.defaultDayStartTime;
          }
        } else {
          // Coming from depot/home - start time is leave time, onsite = default start time (arrival)
          const shift = getCrewShift();
          newOnsiteTime = shift === 'night' ? settings.defaultNightStartTime : settings.defaultDayStartTime;
        }
      } else {
        // No address or missing data - use default
        const shift = getCrewShift();
        newOnsiteTime = shift === 'night' ? settings.defaultNightStartTime : settings.defaultDayStartTime;
      }
      
      const currentOnsiteTime = form.getValues("onsiteTime");
      if (newOnsiteTime !== currentOnsiteTime) {
        form.setValue("onsiteTime", newOnsiteTime, { shouldValidate: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedAddress, open, initialData?.employeeId, initialData?.crewId, initialData?.date]);
  // Default visible colours: primary two unless user has customised
  const DEFAULT_ACTIVE_COLORS = ["gray", "red"];
  const [activeColors, setActiveColors] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("scheduler_color_active");
        const migrated = localStorage.getItem("scheduler_color_active_v2");

        // First run of new logic: ignore old saved list and force defaults
        if (migrated !== "1") {
          localStorage.setItem("scheduler_color_active", JSON.stringify(DEFAULT_ACTIVE_COLORS));
          localStorage.setItem("scheduler_color_active_v2", "1");
          return DEFAULT_ACTIVE_COLORS;
        }

        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    // Fallback if no browser storage: just the two defaults
    return DEFAULT_ACTIVE_COLORS;
  });
  const [isAddingColor, setIsAddingColor] = useState(false);

  // Persist active colors so toggles stick between sessions
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("scheduler_color_active", JSON.stringify(activeColors));
    } catch {
      // ignore storage errors
    }
  }, [activeColors]);


  const handleLabelEdit = (color: string) => {
    setEditingLabel(color);
    setLabelValue(colorLabels?.[color] || AVAILABLE_COLORS.find(c => c.value === color)?.defaultLabel || "New Category");
  };

  const handleLabelSave = (color: string) => {
    if (onColorLabelUpdate) {
        onColorLabelUpdate(color, labelValue);
    }
    setEditingLabel(null);
  };

  const handleAddColor = (color: string) => {
      if (!activeColors.includes(color)) {
          const newColors = [...activeColors, color];
          setActiveColors(newColors);
          // Also initialize its label
          if (onColorLabelUpdate) {
              const defaultLabel = AVAILABLE_COLORS.find(c => c.value === color)?.defaultLabel || "New Category";
              onColorLabelUpdate(color, defaultLabel);
          }
          // Select it immediately
          form.setValue("color", color);
      }
      setIsAddingColor(false);
  };

  const handleRemoveColor = (color: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent selecting the color when clicking delete
      if (activeColors.length <= 1) return; // Prevent deleting the last color
      
      const newColors = activeColors.filter(c => c !== color);
      setActiveColors(newColors);
      
      // If we deleted the selected color, select the first available one
      if (selectedColor === color) {
          form.setValue("color", newColors[0]);
      }
      // Note: we intentionally do NOT delete the label itself – this just hides the flag.
  };

  // --- Autocomplete State ---
  const [openClient, setOpenClient] = useState(false);
  const [openAddress, setOpenAddress] = useState(false);

  // --- Persistent Client Memory (local suggestions) ---
  const [clientHistory, setClientHistory] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("scheduler_clients");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setClientHistory(parsed);
        }
      }
    } catch (err) {
      console.error("Failed to load client history", err);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white text-slate-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            {isReadOnlyPastJob ? "Job Status Update" : (isFreeJob ? "Convert Free Job to Booking" : (initialData ? "Edit Site Details" : "Add New Site"))}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((data) => { 
            // If editing a free job, convert it to booked
            const isFree = initialData?.jobStatus === 'free' || initialData?.customer === 'Free';
            // In read-only mode for past jobs, only submit the color/jobStatus
            let submitData: any;
            if (isReadOnlyPastJob) {
              submitData = { color: data.color, jobStatus: initialData?.jobStatus || 'booked' };
            } else if (isFree) {
              // Converting free job to booked
              submitData = { ...data, jobStatus: 'booked' };
            } else if (!initialData?.id && (!data.customer || data.customer.trim() === '' || !data.address || data.address.trim() === '')) {
              // New job with empty customer/address = free job
              submitData = { 
                ...data, 
                jobStatus: 'free',
                customer: 'Free',
                address: 'Free'
              };
            } else {
              submitData = data;
            }

            // Persist customer into active memory list (for autocomplete)
            try {
              if (typeof window !== "undefined") {
                const rawName = (submitData.customer || "").trim();
                if (rawName && rawName !== "Free") {
                  setClientHistory((prev) => {
                    if (prev.includes(rawName)) return prev;
                    const next = [...prev, rawName].sort((a, b) => a.localeCompare(b));
                    localStorage.setItem("scheduler_clients", JSON.stringify(next));
                    return next;
                  });
                }
              }
            } catch (err) {
              console.error("Failed to save client to history", err);
            }

            onSubmit(submitData, applyPeriod); 
            onOpenChange(false); 
            form.reset(); 
        })} className="space-y-6 mt-4">
            
            {/* Color Picker / Categories */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between">
                    <Label>Job Status</Label>
                    {!isReadOnlyPastJob && (
                        <Popover open={isAddingColor} onOpenChange={setIsAddingColor}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-0">
                                    <Plus className="w-3 h-3 mr-1" /> Add Category
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2 bg-white" align="end">
                                <div className="text-xs font-semibold mb-2 text-slate-500 uppercase tracking-wider">Select Color to Add</div>
                                <div className="grid grid-cols-5 gap-2">
                                    {AVAILABLE_COLORS.filter(c => !activeColors.includes(c.value)).map(c => (
                                        <button
                                            key={c.value}
                                            type="button"
                                            onClick={() => handleAddColor(c.value)}
                                            className={cn("w-8 h-8 rounded-md border-2 hover:scale-110 transition-transform", c.class)}
                                            title={c.defaultLabel}
                                        />
                                    ))}
                                    {AVAILABLE_COLORS.every(c => activeColors.includes(c.value)) && (
                                        <div className="col-span-5 text-center text-xs text-slate-400 py-2">
                                            All colors used
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    {activeColors.map((colorValue) => {
                        const c = AVAILABLE_COLORS.find(ac => ac.value === colorValue) || { value: colorValue, class: "bg-slate-100 border-slate-300", defaultLabel: "Unknown" };
                        return (
                            <div key={c.value} className="flex items-center gap-2 p-1 rounded-md hover:bg-white hover:shadow-sm transition-all group/item relative pr-6">
                                <div 
                                    onClick={() => {
                                        const isSelected = selectedColor === c.value;
                                        // Toggle behaviour: clicking again clears the flag back to Standard Job (blue)
                                        const newColor = isSelected ? "blue" : c.value;
                                        form.setValue("color", newColor);
                                    }}
                                    className={cn(
                                        "w-8 h-8 rounded-md cursor-pointer transition-all flex items-center justify-center border-2 shrink-0",
                                        c.class,
                                        selectedColor === c.value ? "scale-110 shadow-md ring-2 ring-offset-2 ring-slate-400" : "opacity-70 hover:opacity-100"
                                    )}
                                >
                                    {selectedColor === c.value && <Check className="w-4 h-4 text-slate-800" />}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    {editingLabel === c.value ? (
                                        <div className="flex items-center gap-1">
                                            <Input 
                                                className="h-6 text-xs py-0" 
                                                value={labelValue} 
                                                onChange={(e) => setLabelValue(e.target.value)}
                                                autoFocus
                                                onBlur={() => handleLabelSave(c.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleLabelSave(c.value)}
                                            />
                                        </div>
                                    ) : (
                                        <div 
                                            className="text-sm text-slate-600 truncate cursor-text flex items-center gap-2 group"
                                            onClick={() => handleLabelEdit(c.value)}
                                        >
                                            {colorLabels?.[c.value] || c.defaultLabel}
                                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                                        </div>
                                    )}
                                </div>

                                {/* Delete Button (Hidden unless hovering) */}
                                <button
                                    type="button"
                                    onClick={(e) => handleRemoveColor(c.value, e)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 text-slate-300 hover:text-red-500 transition-colors"
                                    title="Remove Category"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {isReadOnlyPastJob && (
                <>
                    {/* Update Scope Selection */}
                    {isPartOfGroup && (
                        <div className="space-y-2 mb-4">
                            <Label className="text-sm font-medium text-slate-700">Update:</Label>
                            <div className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="updateSingle"
                                        name="updateScope"
                                        value="single"
                                        checked={updateScope === 'single'}
                                        onChange={(e) => setUpdateScope(e.target.value as 'single' | 'group')}
                                        className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                                    />
                                    <label htmlFor="updateSingle" className="text-sm font-medium text-slate-700 cursor-pointer">
                                        Single Day
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="updateGroup"
                                        name="updateScope"
                                        value="group"
                                        checked={updateScope === 'group'}
                                        onChange={(e) => setUpdateScope(e.target.value as 'single' | 'group')}
                                        className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                                    />
                                    <label htmlFor="updateGroup" className="text-sm font-medium text-slate-700 cursor-pointer">
                                        Group ({groupItems.length + 1} jobs)
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Save Button - Moved Up */}
                    <div className="flex justify-end gap-2 mb-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                        <Button 
                            type="button" 
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                                const submitData = { color: selectedColor, jobStatus: initialData?.jobStatus || 'booked' };
                                // Pass updateScope to determine if we should update the group
                                onSubmit(submitData, updateScope === 'group' ? 'group' : false);
                                onOpenChange(false);
                            }}
                        >
                            Save
                        </Button>
                    </div>
                </>
            )}

            {isPastItem && !isReadOnlyPastJob && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-amber-800 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>This is a past job. Only the category color can be changed. If this job is part of a group, you'll be asked if you want to apply the color change to all items in the group.</span>
                    </div>
                </div>
            )}

            {!isReadOnlyPastJob && (
            <div className="grid grid-cols-2 gap-4">
                {/* Customer Autocomplete */}
                <div className="space-y-2 col-span-2">
                    <Label>Customer / Project</Label>
                    <Popover open={openClient} onOpenChange={setOpenClient}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openClient}
                                disabled={isPastItem}
                                className="w-full justify-between font-normal text-slate-900 border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {form.watch("customer") || "Select or type customer..."}
                                <Briefcase className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 bg-white" align="start">
                            <div className="flex items-center border-b px-3 bg-white">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                                <input
                                    className="flex h-11 w-full rounded-md bg-white py-3 text-sm outline-none text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 border-0"
                                    placeholder="Search or type customer..."
                                    value={form.watch("customer")}
                                    onChange={(e) => form.setValue("customer", e.target.value)}
                                    disabled={isPastItem}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            setOpenClient(false);
                                        }
                                    }}
                                />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">
                                {(() => {
                                    const term = (form.watch("customer") || "").toLowerCase();
                                    const source = clientHistory;
                                    const filtered = source.filter(client =>
                                        client.toLowerCase().includes(term)
                                    );

                                    if (source.length === 0) {
                                        return (
                                            <div className="py-6 text-center text-sm text-slate-500">
                                                No saved clients yet. Type a name and save a job to remember it.
                                            </div>
                                        );
                                    }

                                    if (filtered.length === 0) {
                                        return (
                                            <div className="py-6 text-center text-sm text-slate-500">
                                                No matching client. Continue typing to add a new one.
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="overflow-hidden p-1 text-foreground bg-white">
                                            <div className="px-2 py-1.5 text-xs font-medium text-slate-500 bg-white">
                                                Recent clients
                                            </div>
                                            {filtered.map((client) => (
                                                <div
                                                    key={client}
                                                    onClick={() => {
                                                        form.setValue("customer", client);
                                                        setOpenClient(false);
                                                    }}
                                                    className={cn(
                                                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 bg-white",
                                                        form.watch("customer") === client && "bg-slate-100"
                                                    )}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            form.watch("customer") === client ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <span className="text-slate-900">{client}</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-2">
                    <Label>Job Number</Label>
                    <Input {...form.register("jobNumber")} placeholder="J-1234" disabled={isPastItem} />
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Input type="time" {...form.register("startTime")} disabled={isPastItem} />
                    </div>
                    <div className="space-y-2">
                        <Label>Onsite Time</Label>
                        <Input type="time" {...form.register("onsiteTime")} disabled={isPastItem} />
                    </div>
                    <div className="space-y-2">
                        <Label>PM Initials</Label>
                        <Input {...form.register("projectManager")} placeholder="e.g. JD" maxLength={5} disabled={isPastItem} />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label>Duration (Hrs)</Label>
                    <Input type="number" {...form.register("duration")} min="1" max="24" disabled={isPastItem} />
                </div>

                {/* Address Autocomplete */}
                <div className="space-y-2 col-span-2">
                    <Label>Address</Label>
                    <Popover open={openAddress} onOpenChange={setOpenAddress}>
                        <PopoverTrigger asChild>
                             <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openAddress}
                                disabled={isPastItem}
                                className="w-full justify-between font-normal text-slate-900 border-slate-200 bg-white hover:bg-slate-50 h-auto min-h-[80px] items-start p-3 whitespace-normal text-left disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {form.watch("address") || "Search address..."}
                                <MapPin className="ml-2 h-4 w-4 shrink-0 opacity-50 mt-0.5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 bg-white" align="start">
                            <div className="flex items-center border-b px-3 bg-white">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    className="flex h-11 w-full rounded-md bg-white py-3 text-sm outline-none text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 border-0"
                                    placeholder="Search address (Google Maps)..."
                                    value={form.watch("address")}
                                    onChange={(e) => form.setValue("address", e.target.value)}
                                    disabled={isPastItem}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            setOpenAddress(false);
                                        }
                                    }}
                                />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">
                                {(() => {
                                    const filtered = MOCK_ADDRESSES.filter(addr => 
                                        addr.toLowerCase().includes((form.watch("address") || "").toLowerCase())
                                    );
                                    
                                    if (filtered.length === 0) {
                                        return <div className="py-6 text-center text-sm text-slate-500">No address found. Type to add manually.</div>;
                                    }

                                    return (
                                        <div className="overflow-hidden p-1 text-foreground bg-white">
                                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-white">Google Maps Suggestions</div>
                                            {filtered.map((address) => (
                                                <div
                                                    key={address}
                                                    onClick={() => {
                                                        form.setValue("address", address);
                                                        setOpenAddress(false);
                                                    }}
                                                    className={cn(
                                                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 bg-white",
                                                        form.watch("address") === address && "bg-slate-100"
                                                    )}
                                                >
                                                    <MapPin className="mr-2 h-4 w-4 opacity-50" />
                                                    {address}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </PopoverContent>
                    </Popover>
                    <div className="text-[10px] text-slate-400 text-right">
                        Powered by Google Maps (Simulation)
                    </div>
                </div>
            </div>
            )}

            <DialogFooter className="flex items-center justify-between sm:justify-between gap-4">
                {!isReadOnlyPastJob && (
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-medium text-slate-600 mb-1">Apply to:</div>
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center space-x-1.5">
                                <Checkbox 
                                    id="applyWeek" 
                                    checked={applyPeriod === 'week'} 
                                    onCheckedChange={(c) => setApplyPeriod(c ? 'week' : 'none')} 
                                    disabled={isPastItem} 
                                />
                                <label htmlFor="applyWeek" className="text-sm font-medium leading-none cursor-pointer">
                                    Remainder of Week
                                </label>
                            </div>
                            <div className="flex items-center space-x-1.5">
                                <Checkbox 
                                    id="applyMonth" 
                                    checked={applyPeriod === 'month'} 
                                    onCheckedChange={(c) => setApplyPeriod(c ? 'month' : 'none')} 
                                    disabled={isPastItem} 
                                />
                                <label htmlFor="applyMonth" className="text-sm font-medium leading-none cursor-pointer">
                                    Month
                                </label>
                            </div>
                            <div className="flex items-center space-x-1.5">
                                <Checkbox 
                                    id="apply6Months" 
                                    checked={applyPeriod === '6months'} 
                                    onCheckedChange={(c) => setApplyPeriod(c ? '6months' : 'none')} 
                                    disabled={isPastItem} 
                                />
                                <label htmlFor="apply6Months" className="text-sm font-medium leading-none cursor-pointer">
                                    6 Months
                                </label>
                            </div>
                            <div className="flex items-center space-x-1.5">
                                <Checkbox 
                                    id="apply12Months" 
                                    checked={applyPeriod === '12months'} 
                                    onCheckedChange={(c) => setApplyPeriod(c ? '12months' : 'none')} 
                                    disabled={isPastItem} 
                                />
                                <label htmlFor="apply12Months" className="text-sm font-medium leading-none cursor-pointer">
                                    12 Months
                                </label>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex gap-2">
                    {!isReadOnlyPastJob && initialData?.id && (
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setMoveDateOpen(true)}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                            <CalendarIcon className="w-4 h-4 mr-2" /> Move Date
                        </Button>
                    )}
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    {!isReadOnlyPastJob && (
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                            Save Site
                        </Button>
                    )}
                </div>
            </DialogFooter>
        </form>
      </DialogContent>
      
      {/* Move Date Dialog */}
      <Dialog open={moveDateOpen} onOpenChange={setMoveDateOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white">
          <DialogHeader>
            <DialogTitle>Move Job Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select New Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDate ? format(newDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={(date) => {
                      setNewDate(date);
                      if (date && isPartOfGroup) {
                        setPendingMoveDate(date);
                        setMoveDateOpen(false);
                        setMoveGroupDialogOpen(true);
                      } else if (date && onMoveDate) {
                        onMoveDate(date, false);
                        setMoveDateOpen(false);
                        setNewDate(undefined);
                      }
                    }}
                    disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setMoveDateOpen(false);
              setNewDate(undefined);
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Move Group Confirmation Dialog */}
      <Dialog open={moveGroupDialogOpen} onOpenChange={setMoveGroupDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white">
          <DialogHeader>
            <DialogTitle>Move Job Group</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-4">
              This job is part of a group with {groupItems.length + 1} job(s) sharing the same job number ({initialData?.jobNumber}).
            </p>
            <p className="text-sm text-slate-600 mb-4">
              Would you like to move just this one job, or the entire group to the new date?
            </p>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                if (pendingMoveDate && onMoveDate) {
                  onMoveDate(pendingMoveDate, false);
                }
                setMoveGroupDialogOpen(false);
                setPendingMoveDate(null);
                setNewDate(undefined);
              }}
            >
              Move This Job Only
            </Button>
            <Button 
              type="button" 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                if (pendingMoveDate && onMoveDate) {
                  onMoveDate(pendingMoveDate, true);
                }
                setMoveGroupDialogOpen(false);
                setPendingMoveDate(null);
                setNewDate(undefined);
              }}
            >
              Move Entire Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ------------------- OPERATIVE FORM -------------------

function OperativeForm({ open, onOpenChange, onSubmit, type, initialData, employees, vehicles, items, crews }: any) {
  const [applyPeriod, setApplyPeriod] = useState<'none' | 'week' | 'month' | '6months' | '12months'>('none');
  const form = useForm({
    resolver: zodResolver(operativeSchema),
    defaultValues: {
      employeeId: initialData?.employeeId || "",
      vehicleId: initialData?.vehicleId || "",
    },
  });

  // Reset form when initialData changes or modal opens
  useEffect(() => {
    if (open) {
        setApplyPeriod('none');
        form.reset({
            employeeId: initialData?.employeeId || "",
            vehicleId: initialData?.vehicleId || "",
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.employeeId, initialData?.vehicleId, open]);

  // Check for conflicts
  const targetDate = initialData?.date ? new Date(initialData.date) : new Date();
  
  // Get valid crew IDs set for efficient lookup
  const validCrewIds = crews ? new Set(crews.map((c: any) => c.id)) : null;
  
  // Determine the shift of the crew we are assigning to
  const currentCrewId = initialData?.crewId;
  const currentCrew = crews?.find((c: any) => c.id === currentCrewId);
  const targetShift = currentCrew?.shift || 'day'; // Default to day if unknown

  // Get employees who are already assigned on this day
  const assignedEmployeeIds = items
    .filter((item: ScheduleItem) => 
        (item.type === 'operative' || item.type === 'assistant') && 
        isSameDay(new Date(item.date), targetDate) &&
        item.id !== initialData?.id && // Exclude self if editing
        (!validCrewIds || validCrewIds.has(item.crewId)) // Only count items for valid crews
    )
    .map((item: ScheduleItem) => item.employeeId);

  // Get vehicles who are already assigned on this day, AND their shift
  const assignedVehiclesInfo = items
    .filter((item: ScheduleItem) => 
        item.type === 'operative' && 
        isSameDay(new Date(item.date), targetDate) &&
        item.id !== initialData?.id && // Exclude self if editing
        (!validCrewIds || validCrewIds.has(item.crewId)) && // Only count items for valid crews
        item.vehicleId
    )
    .reduce((acc: Record<string, string>, item: ScheduleItem) => {
        // Find the shift of this assignment
        const itemCrew = crews?.find((c: any) => c.id === item.crewId);
        const itemShift = itemCrew?.shift || 'day';
        acc[item.vehicleId!] = itemShift;
        return acc;
    }, {});

  // Group vehicles by type
  const groupedVehicles = vehicles.reduce((acc: any, v: any) => {
    const type = v.vehicleType || "Other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(v);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            {type === 'operative' ? "Add Operative (Driver)" : "Add Assistant"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((data) => { onSubmit(data, applyPeriod); onOpenChange(false); form.reset(); })} className="space-y-6 mt-4">
            
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Employee</Label>
                    <Controller
                        name="employeeId"
                        control={form.control}
                        render={({ field }) => (
                            <Select 
                                value={field.value || ""} 
                                onValueChange={field.onChange}
                            >
                                <SelectTrigger><SelectValue placeholder="Select Person" /></SelectTrigger>
                                <SelectContent className="bg-white max-h-72 overflow-y-auto">
                                    {employees
                                        .filter((e: any) => {
                                            // Strict role filtering
                                            if (type === 'operative') return e.jobRole === 'operative';
                                            if (type === 'assistant') return e.jobRole === 'assistant';
                                            return true;
                                        })
                                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                                        .map((e: any) => {
                                        const isAssigned = assignedEmployeeIds.includes(e.id);
                                        const isUnavailable = e.status !== 'active';
                                        const isDisabled = isAssigned || isUnavailable;
                                        return (
                                            <SelectItem 
                                                key={e.id} 
                                                value={e.id}
                                                disabled={isDisabled}
                                                className={cn(
                                                    // Style 2: keep disabled options readable but gently muted
                                                    isDisabled && "bg-slate-50 text-slate-600 cursor-not-allowed"
                                                )}
                                            >
                                                <div className="flex items-center justify-between w-full gap-2 min-w-[220px]">
                                                    <span className="font-medium">{e.name}</span>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        {isUnavailable && (
                                                            <span className="text-red-500 font-semibold">
                                                                ({e.status})
                                                            </span>
                                                        )}
                                                        {isAssigned && (
                                                            <span className="text-slate-500 italic">
                                                                (Already Scheduled)
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {form.formState.errors.employeeId && (
                        <p className="text-sm text-red-500">{form.formState.errors.employeeId.message as string}</p>
                    )}
                </div>

                {type === 'operative' && (
                    <div className="space-y-2">
                        <Label>Vehicle</Label>
                        <Controller
                            name="vehicleId"
                            control={form.control}
                            render={({ field }) => (
                                <Select 
                                    value={field.value || ""} 
                                    onValueChange={field.onChange}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select Vehicle" /></SelectTrigger>
                            <SelectContent className="bg-white max-h-72 overflow-y-auto">
                                {Object.entries(groupedVehicles).sort(([typeA], [typeB]) => typeA.localeCompare(typeB)).map(([type, typeVehicles]) => (
                                    <div key={type}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0 z-10">
                                            {type}
                                        </div>
                                        {(typeVehicles as any[]).map((v: any) => {
                                            const assignedShift = assignedVehiclesInfo[v.id];
                                            const isGlobalUnavailable = v.status !== 'active';
                                            const isAssignedToSameShift = assignedShift === targetShift;
                                            const isAssignedToDifferentShift = assignedShift && assignedShift !== targetShift;
                                            
                                            // FIX: Ensure disabled is ONLY true if global unavailable or same shift conflict
                                            const isDisabled = isGlobalUnavailable || isAssignedToSameShift;

                                            return (
                                                <SelectItem 
                                                    key={v.id} 
                                                    value={v.id}
                                                    disabled={isDisabled}
                                                    className={cn(
                                                        isDisabled && "opacity-50"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between w-full gap-2">
                                                        <span>{v.name}</span>
                                                        {isGlobalUnavailable && <span className="text-xs text-red-500">({v.status === 'off_road' ? 'VOR' : v.status})</span>}
                                                        {isAssignedToSameShift && <span className="text-xs text-blue-500">(In Use)</span>}
                                                        {isAssignedToDifferentShift && <span className="text-xs text-amber-600 font-medium">(Used on {assignedShift === 'day' ? 'Day' : 'Night'})</span>}
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </div>
                                ))}
                            </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                )}
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <div className="text-xs font-medium text-slate-600 mb-1">Apply to:</div>
                    <div className="flex flex-wrap gap-3">
                        <div className="flex items-center space-x-1.5">
                            <Checkbox 
                                id="applyWeekOp" 
                                checked={applyPeriod === 'week'} 
                                onCheckedChange={(c) => setApplyPeriod(c ? 'week' : 'none')} 
                            />
                            <label htmlFor="applyWeekOp" className="text-sm font-medium leading-none cursor-pointer">
                                Remainder of Week
                            </label>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <Checkbox 
                                id="applyMonthOp" 
                                checked={applyPeriod === 'month'} 
                                onCheckedChange={(c) => setApplyPeriod(c ? 'month' : 'none')} 
                            />
                            <label htmlFor="applyMonthOp" className="text-sm font-medium leading-none cursor-pointer">
                                Month
                            </label>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <Checkbox 
                                id="apply6MonthsOp" 
                                checked={applyPeriod === '6months'} 
                                onCheckedChange={(c) => setApplyPeriod(c ? '6months' : 'none')} 
                            />
                            <label htmlFor="apply6MonthsOp" className="text-sm font-medium leading-none cursor-pointer">
                                6 Months
                            </label>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <Checkbox 
                                id="apply12MonthsOp" 
                                checked={applyPeriod === '12months'} 
                                onCheckedChange={(c) => setApplyPeriod(c ? '12months' : 'none')} 
                            />
                            <label htmlFor="apply12MonthsOp" className="text-sm font-medium leading-none cursor-pointer">
                                12 Months
                            </label>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Add Person</Button>
                </div>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
