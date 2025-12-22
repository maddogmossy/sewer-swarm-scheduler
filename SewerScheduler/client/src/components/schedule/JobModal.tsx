import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Clock, MapPin, User, Truck, Briefcase, Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const jobSchema = z.object({
  title: z.string().min(1, "Job title is required"),
  customer: z.string().min(1, "Customer is required"),
  jobNumber: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  date: z.date(),
  startTime: z.string(),
  onsiteTime: z.string(),
  employeeId: z.string().min(1, "Lead employee is required"),
  vehicleId: z.string().min(1, "Vehicle is required"),
  assistantId: z.string().optional(),
  color: z.string().default("blue"),
  crewId: z.string().optional(), // Added crewId
});

export type JobFormData = z.infer<typeof jobSchema>;

interface JobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: JobFormData) => void;
  initialData?: Partial<JobFormData>;
  employees: { id: string; name: string }[];
  vehicles: { id: string; name: string }[];
  crews?: { id: string; name: string }[];
}

// Updated Colors based on Sewer Swarm Style (Pastels)
const COLORS = [
  { name: "Blue", value: "blue", class: "bg-[#BFDBFE] border-[#3B82F6]" },
  { name: "Green", value: "green", class: "bg-[#BBF7D0] border-[#22C55E]" },
  { name: "Yellow", value: "yellow", class: "bg-[#FEF08A] border-[#EAB308]" },
  { name: "Orange", value: "orange", class: "bg-[#FED7AA] border-[#F97316]" },
  { name: "Red", value: "red", class: "bg-[#FECACA] border-[#EF4444]" },
  { name: "Purple", value: "purple", class: "bg-[#E9D5FF] border-[#A855F7]" },
  { name: "Pink", value: "pink", class: "bg-[#FBCFE8] border-[#EC4899]" },
  { name: "Teal", value: "teal", class: "bg-[#99F6E4] border-[#14B8A6]" },
  { name: "Gray", value: "gray", class: "bg-[#E2E8F0] border-[#64748B]" },
];

export function JobModal({ open, onOpenChange, onSubmit, initialData, employees, vehicles, crews }: JobModalProps) {
  const form = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: initialData?.title || "Standard Job",
      customer: initialData?.customer || "",
      jobNumber: initialData?.jobNumber || "",
      address: initialData?.address || "",
      date: initialData?.date || new Date(),
      startTime: initialData?.startTime || "08:00",
      onsiteTime: initialData?.onsiteTime || "08:30",
      employeeId: initialData?.employeeId || "",
      vehicleId: initialData?.vehicleId || "",
      assistantId: initialData?.assistantId || "",
      color: initialData?.color || "blue",
      crewId: initialData?.crewId || (crews && crews.length > 0 ? crews[0].id : ""),
    },
  });

  // Reset form when modal opens with new data
  // Note: In a real app, use useEffect to sync initialData with form
  
  const handleSubmit = (data: JobFormData) => {
    onSubmit(data);
    onOpenChange(false);
    form.reset();
  };

  const selectedColor = form.watch("color");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto bg-white text-slate-900 border-slate-200 shadow-lg">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <Briefcase className="w-5 h-5 text-blue-600" />
            {initialData ? "Edit Job Schedule" : "New Job Schedule"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-4">
          {/* Color Picker - Top for visibility like reference */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <Label className="text-slate-700 font-semibold">Category / Color</Label>
            <div className="flex flex-wrap gap-3">
               {COLORS.map((c) => (
                 <div 
                    key={c.value}
                    onClick={() => form.setValue("color", c.value)}
                    className={cn(
                      "w-8 h-8 rounded-md cursor-pointer transition-all flex items-center justify-center border-2",
                      c.class,
                      selectedColor === c.value ? "scale-110 shadow-md ring-2 ring-offset-2 ring-slate-400" : "opacity-70 hover:opacity-100"
                    )}
                    title={c.name}
                 >
                   {selectedColor === c.value && <Check className="w-4 h-4 text-slate-800" />}
                 </div>
               ))}
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="customer">Customer / Project</Label>
              <Input 
                id="customer" 
                {...form.register("customer")} 
                placeholder="e.g. Apex Construction"
                className="bg-white border-slate-300 focus:ring-blue-500"
              />
              {form.formState.errors.customer && <p className="text-red-500 text-xs">{form.formState.errors.customer.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobNumber">Job Number</Label>
              <Input 
                id="jobNumber" 
                {...form.register("jobNumber")} 
                placeholder="J-2024-001"
                className="bg-white border-slate-300"
              />
            </div>
            
            {crews && (
              <div className="space-y-2">
                <Label>Crew Allocation</Label>
                <Select 
                  onValueChange={(val) => form.setValue("crewId", val)}
                  defaultValue={form.getValues("crewId")}
                >
                  <SelectTrigger className="bg-white border-slate-300">
                    <SelectValue placeholder="Select Crew" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    {crews.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Location & Time */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
              <MapPin className="w-4 h-4 text-blue-500" /> Location & Timing
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="address">Site Address</Label>
              <Textarea 
                id="address" 
                {...form.register("address")} 
                placeholder="123 Construction Way, London..."
                className="bg-white border-slate-300 min-h-[80px]"
              />
              {form.formState.errors.address && <p className="text-red-500 text-xs">{form.formState.errors.address.message}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal bg-white border-slate-300 hover:bg-slate-50",
                        !form.watch("date") && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch("date") ? format(form.watch("date"), "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border-slate-200" align="start">
                    <Calendar
                      mode="single"
                      selected={form.watch("date")}
                      onSelect={(date) => date && form.setValue("date", date)}
                      initialFocus
                      className="text-slate-900"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input 
                  type="time" 
                  id="startTime" 
                  {...form.register("startTime")}
                  className="bg-white border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onsiteTime">Onsite Time</Label>
                <Input 
                  type="time" 
                  id="onsiteTime" 
                  {...form.register("onsiteTime")}
                  className="bg-white border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
              <User className="w-4 h-4 text-blue-500" /> Resources
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lead Employee (Driver)</Label>
                <Select 
                  onValueChange={(val) => form.setValue("employeeId", val)}
                  defaultValue={form.getValues("employeeId")}
                >
                  <SelectTrigger className="bg-white border-slate-300">
                    <SelectValue placeholder="Select Lead" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.employeeId && <p className="text-red-500 text-xs">{form.formState.errors.employeeId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Vehicle</Label>
                <Select 
                  onValueChange={(val) => form.setValue("vehicleId", val)}
                  defaultValue={form.getValues("vehicleId")}
                >
                  <SelectTrigger className="bg-white border-slate-300">
                    <SelectValue placeholder="Select Vehicle" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.vehicleId && <p className="text-red-500 text-xs">{form.formState.errors.vehicleId.message}</p>}
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Assistant (Optional)</Label>
                <Select 
                  onValueChange={(val) => form.setValue("assistantId", val)}
                  defaultValue={form.getValues("assistantId")}
                >
                  <SelectTrigger className="bg-white border-slate-300">
                    <SelectValue placeholder="Select Assistant" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    <SelectItem value="none">None</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">Selecting an assistant will create a separate calendar entry for them.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-300 hover:bg-slate-50 text-slate-700">Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">Save Schedule</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
