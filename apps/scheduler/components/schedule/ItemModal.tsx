import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { format, isSameDay } from "date-fns";
import { CalendarIcon, MapPin, Briefcase, Check, User, Truck, Edit2, AlertCircle, Plus, X, Trash2, Search, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleItem } from "./CalendarGrid";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";

// ------------------- SCHEMAS -------------------

const siteSchema = z.object({
  customer: z.string().min(1, "Customer is required"),
  jobNumber: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  projectManager: z.string().optional(),
  startTime: z.string().optional(), // Start time (e.g. 08:00)
  onsiteTime: z.string().optional(), // Onsite time (e.g. 09:00)
  duration: z.string().optional(), // Duration in hours (string input from form)
  color: z.string().default("blue"),
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

// Mock Data for Address/Client Autocomplete
const MOCK_CLIENTS = [
    "Thames Water", "Balfour Beatty", "Murphy Group", "Skanska", "Costain", 
    "Network Rail", "United Utilities", "Severn Trent", "Anglian Water", 
    "Highways England", "Transport for London"
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
  employees: { id: string; name: string; status: 'active' | 'holiday' | 'sick'; jobRole?: 'operative' | 'assistant' }[];
  vehicles: { id: string; name: string; status: 'active' | 'off_road' | 'maintenance' }[];
  items: ScheduleItem[]; // For conflict detection
  crews?: { id: string }[]; // For validating assignments against active crews
  colorLabels?: Record<string, string>;
  onColorLabelUpdate?: (color: string, label: string) => void;
}

const noteSchema = z.object({
  noteContent: z.string().min(1, "Note content is required"),
});

export function ItemModal({ open, onOpenChange, onSubmit, type, initialData, employees, vehicles, items, crews, colorLabels, onColorLabelUpdate }: ItemModalProps) {
  // We conditionally render different forms based on type
  if (type === 'job') {
    return <SiteForm open={open} onOpenChange={onOpenChange} onSubmit={onSubmit} initialData={initialData} colorLabels={colorLabels} onColorLabelUpdate={onColorLabelUpdate} />;
  }
  if (type === 'note') {
      return <NoteForm open={open} onOpenChange={onOpenChange} onSubmit={onSubmit} initialData={initialData} />;
  }
  return <OperativeForm open={open} onOpenChange={onOpenChange} onSubmit={onSubmit} type={type} initialData={initialData} employees={employees} vehicles={vehicles} items={items} crews={crews} />;
}

// ------------------- NOTE FORM -------------------

function NoteForm({ open, onOpenChange, onSubmit, initialData }: any) {
    const [applyToWeek, setApplyToWeek] = useState(false);
    const form = useForm({
        resolver: zodResolver(noteSchema),
        defaultValues: {
            noteContent: initialData?.noteContent || "",
        },
    });

    useEffect(() => {
        if (open) {
            setApplyToWeek(false);
            form.reset({
                noteContent: initialData?.noteContent || "",
            });
        }
    }, [initialData, open, form]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] bg-white text-slate-900">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-red-600" />
                        {initialData ? "Edit Note" : "Add Note"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit((data) => { onSubmit(data, applyToWeek); onOpenChange(false); form.reset(); })} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label>Note Content</Label>
                        <Textarea 
                            {...form.register("noteContent")} 
                            placeholder="Type your note here..." 
                            className="min-h-[100px]"
                        />
                    </div>

                    <DialogFooter className="flex items-center justify-between sm:justify-between gap-4">
                         <div className="flex items-center space-x-2">
                            <Checkbox id="applyToWeek" checked={applyToWeek} onCheckedChange={(c) => setApplyToWeek(!!c)} />
                            <label
                                htmlFor="applyToWeek"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Apply to week?
                            </label>
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

function SiteForm({ open, onOpenChange, onSubmit, initialData, colorLabels, onColorLabelUpdate }: any) {
  const [applyToWeek, setApplyToWeek] = useState(false);
  const form = useForm({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      customer: initialData?.customer || "",
      jobNumber: initialData?.jobNumber || "",
      address: initialData?.address || "",
      projectManager: initialData?.projectManager || "",
      startTime: initialData?.startTime || "08:00",
      onsiteTime: initialData?.onsiteTime || "09:00",
      duration: initialData?.duration?.toString() || "8",
      color: initialData?.color || "blue",
    },
  });

  // Reset form when initialData changes or modal opens
  useEffect(() => {
    if (open) {
        setApplyToWeek(false);
        form.reset({
            customer: initialData?.customer || "",
            jobNumber: initialData?.jobNumber || "",
            address: initialData?.address || "",
            projectManager: initialData?.projectManager || "",
            startTime: initialData?.startTime || "08:00",
            onsiteTime: initialData?.onsiteTime || "09:00",
            duration: initialData?.duration?.toString() || "8",
            color: initialData?.color || "blue",
        });
    }
  }, [initialData, open, form]);

  const selectedColor = form.watch("color");
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState("");
  const [activeColors, setActiveColors] = useState<string[]>(() => {
      // Default visible colors are the ones that exist in colorLabels or defaults
      if (colorLabels) return Object.keys(colorLabels);
      return AVAILABLE_COLORS.slice(0, 9).map(c => c.value);
  });
  const [isAddingColor, setIsAddingColor] = useState(false);

  // Sync active colors if colorLabels prop updates
  useEffect(() => {
      if (colorLabels) {
          setActiveColors(Object.keys(colorLabels));
      }
  }, [colorLabels]);


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
      
      // Note: We don't strictly need to remove it from colorLabels in parent, 
      // but we could if we wanted to cleanup. For now, hiding it is enough.
  };

  // --- Autocomplete State ---
  const [openClient, setOpenClient] = useState(false);
  const [openAddress, setOpenAddress] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white text-slate-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            {initialData ? "Edit Site Details" : "Add New Site"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((data) => { onSubmit(data, applyToWeek); onOpenChange(false); form.reset(); })} className="space-y-6 mt-4">
            
            {/* Color Picker / Categories */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between">
                    <Label>Category & Color</Label>
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
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    {activeColors.map((colorValue) => {
                        const c = AVAILABLE_COLORS.find(ac => ac.value === colorValue) || { value: colorValue, class: "bg-slate-100 border-slate-300", defaultLabel: "Unknown" };
                        return (
                            <div key={c.value} className="flex items-center gap-2 p-1 rounded-md hover:bg-white hover:shadow-sm transition-all group/item relative pr-6">
                                <div 
                                    onClick={() => form.setValue("color", c.value)}
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
                                className="w-full justify-between font-normal text-slate-900 border-slate-200 bg-white hover:bg-slate-50"
                            >
                                {form.watch("customer") || "Select or type customer..."}
                                <Briefcase className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 bg-white" align="start">
                            <div className="flex items-center border-b px-3 bg-white">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    className="flex h-11 w-full rounded-md bg-white py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0"
                                    placeholder="Search customer..."
                                    value={form.watch("customer")}
                                    onChange={(e) => form.setValue("customer", e.target.value)}
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
                                    const filtered = MOCK_CLIENTS.filter(client => 
                                        client.toLowerCase().includes((form.watch("customer") || "").toLowerCase())
                                    );
                                    
                                    if (filtered.length === 0) {
                                        return <div className="py-6 text-center text-sm text-slate-500">No customer found. Type to add new.</div>;
                                    }

                                    return (
                                        <div className="overflow-hidden p-1 text-foreground bg-white">
                                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-white">Suggestions</div>
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
                                                    {client}
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
                    <Input {...form.register("jobNumber")} placeholder="J-1234" />
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Input type="time" {...form.register("startTime")} />
                    </div>
                    <div className="space-y-2">
                        <Label>Onsite Time</Label>
                        <Input type="time" {...form.register("onsiteTime")} />
                    </div>
                    <div className="space-y-2">
                        <Label>PM Initials</Label>
                        <Input {...form.register("projectManager")} placeholder="e.g. JD" maxLength={5} />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label>Duration (Hrs)</Label>
                    <Input type="number" {...form.register("duration")} min="1" max="24" />
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
                                className="w-full justify-between font-normal text-slate-900 border-slate-200 bg-white hover:bg-slate-50 h-auto min-h-[80px] items-start p-3 whitespace-normal text-left"
                            >
                                {form.watch("address") || "Search address..."}
                                <MapPin className="ml-2 h-4 w-4 shrink-0 opacity-50 mt-0.5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 bg-white" align="start">
                            <div className="flex items-center border-b px-3 bg-white">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    className="flex h-11 w-full rounded-md bg-white py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0"
                                    placeholder="Search address (Google Maps)..."
                                    value={form.watch("address")}
                                    onChange={(e) => form.setValue("address", e.target.value)}
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

            <DialogFooter className="flex items-center justify-between sm:justify-between gap-4">
                <div className="flex items-center space-x-2">
                    <Checkbox id="applyToWeek" checked={applyToWeek} onCheckedChange={(c) => setApplyToWeek(!!c)} />
                    <label
                        htmlFor="applyToWeek"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Apply to remainder of week?
                    </label>
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Save Site</Button>
                </div>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------- OPERATIVE FORM -------------------

function OperativeForm({ open, onOpenChange, onSubmit, type, initialData, employees, vehicles, items, crews }: any) {
  const [applyToWeek, setApplyToWeek] = useState(false);
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
        setApplyToWeek(false);
        form.reset({
            employeeId: initialData?.employeeId || "",
            vehicleId: initialData?.vehicleId || "",
        });
    }
  }, [initialData, open, form]);

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
        <form onSubmit={form.handleSubmit((data) => { onSubmit(data, applyToWeek); onOpenChange(false); form.reset(); })} className="space-y-6 mt-4">
            
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select 
                        onValueChange={(val) => form.setValue("employeeId", val)} 
                        defaultValue={form.getValues("employeeId") || initialData?.employeeId}
                    >
                        <SelectTrigger><SelectValue placeholder="Select Person" /></SelectTrigger>
                        <SelectContent className="bg-white">
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
                                return (
                                    <SelectItem 
                                        key={e.id} 
                                        value={e.id}
                                        disabled={isAssigned || isUnavailable}
                                        className={cn(
                                            (isAssigned || isUnavailable) && "opacity-50 bg-slate-50 text-slate-400 cursor-not-allowed"
                                        )}
                                    >
                                        <div className="flex items-center justify-between w-full gap-2 min-w-[200px]">
                                            <span>{e.name}</span>
                                            <div className="flex items-center gap-2">
                                                {isUnavailable && <span className="text-xs text-red-500 font-medium">({e.status})</span>}
                                                {isAssigned && <span className="text-xs text-slate-400 font-medium italic">(Already Scheduled)</span>}
                                            </div>
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>

                {type === 'operative' && (
                    <div className="space-y-2">
                        <Label>Vehicle</Label>
                        <Select 
                            onValueChange={(val) => form.setValue("vehicleId", val)} 
                            defaultValue={form.getValues("vehicleId") || initialData?.vehicleId}
                        >
                            <SelectTrigger><SelectValue placeholder="Select Vehicle" /></SelectTrigger>
                            <SelectContent className="bg-white">
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
                    </div>
                )}
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between gap-4">
                <div className="flex items-center space-x-2">
                    <Checkbox id="applyToWeekOp" checked={applyToWeek} onCheckedChange={(c) => setApplyToWeek(!!c)} />
                    <label
                        htmlFor="applyToWeekOp"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Apply to remainder of week?
                    </label>
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
