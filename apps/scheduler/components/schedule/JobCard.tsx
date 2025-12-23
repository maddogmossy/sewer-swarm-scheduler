import { format } from "date-fns";
import { MapPin, User, Truck, Clock, MoreHorizontal } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export interface Job {
  id: string;
  title: string;
  customer: string;
  jobNumber?: string;
  address: string;
  date: Date;
  startTime: string;
  onsiteTime: string;
  employeeId: string;
  vehicleId: string;
  assistantId?: string;
  color: string;
  depotId: string;
  crewId?: string; // Added crewId
}

interface JobCardProps {
  job: Job;
  employees: { id: string; name: string }[];
  vehicles: { id: string; name: string }[];
  onEdit: (job: Job) => void;
  onDelete: (id: string) => void;
  onDuplicate: (job: Job) => void;
}

export function JobCard({ job, employees, vehicles, onEdit, onDelete, onDuplicate }: JobCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id, data: job });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const employee = employees.find((e) => e.id === job.employeeId);
  const vehicle = vehicles.find((v) => v.id === job.vehicleId);

  // Modern Pastel Colors based on Sewer Swarm Style
  const colorClasses: Record<string, string> = {
    blue: "bg-[#BFDBFE] border-[#3B82F6] text-[#1E3A8A]",
    green: "bg-[#BBF7D0] border-[#22C55E] text-[#14532D]",
    yellow: "bg-[#FEF08A] border-[#EAB308] text-[#713F12]",
    orange: "bg-[#FED7AA] border-[#F97316] text-[#7C2D12]",
    red: "bg-[#FECACA] border-[#EF4444] text-[#7F1D1D]",
    purple: "bg-[#E9D5FF] border-[#A855F7] text-[#581C87]",
    pink: "bg-[#FBCFE8] border-[#EC4899] text-[#831843]",
    teal: "bg-[#99F6E4] border-[#14B8A6] text-[#134E4A]",
    gray: "bg-[#E2E8F0] border-[#64748B] text-[#1E293B]",
  };

  const headerColors: Record<string, string> = {
    blue: "bg-[#3B82F6] text-white",
    green: "bg-[#22C55E] text-white",
    yellow: "bg-[#EAB308] text-white",
    orange: "bg-[#F97316] text-white",
    red: "bg-[#EF4444] text-white",
    purple: "bg-[#A855F7] text-white",
    pink: "bg-[#EC4899] text-white",
    teal: "bg-[#14B8A6] text-white",
    gray: "bg-[#64748B] text-white",
  };

  const baseColor = colorClasses[job.color] || colorClasses.blue;
  const headerColor = headerColors[job.color] || headerColors.blue;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative rounded-lg border shadow-sm cursor-grab active:cursor-grabbing transition-all mb-2 select-none overflow-hidden",
        "bg-white border-l-4", // Use white background with colored border
        `border-l-${job.color === 'blue' ? 'blue-500' : job.color === 'red' ? 'red-500' : job.color === 'green' ? 'green-500' : job.color === 'yellow' ? 'yellow-500' : job.color === 'purple' ? 'purple-500' : job.color === 'orange' ? 'orange-500' : job.color === 'pink' ? 'pink-500' : job.color === 'teal' ? 'teal-500' : 'slate-500'}`
      )}
    >
      {/* Colored Category Header */}
      <div className={cn("px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide flex justify-between items-center", baseColor)}>
        <span className="truncate max-w-[85%]">{job.customer}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-black/10 text-current">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32 bg-white border-slate-200 text-slate-700 shadow-md">
              <DropdownMenuItem onClick={() => onEdit(job)} className="cursor-pointer hover:bg-slate-100">
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(job)} className="cursor-pointer hover:bg-slate-100">
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(job.id)} className="text-red-600 cursor-pointer hover:bg-red-50">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2 bg-white">
        {/* Job Number */}
        <div className="text-xs font-bold text-slate-800">
           {job.jobNumber || "No Job #"}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 col-span-2 font-mono text-slate-500">
                <Clock className="w-3 h-3" />
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border border-slate-200">{job.startTime} - {job.onsiteTime}</span>
            </div>

            <div className="flex items-center gap-1.5 col-span-2">
                <User className="w-3 h-3 text-slate-400" />
                <span className="font-medium text-slate-800">{employee?.name || "Unassigned"}</span>
            </div>

            {/* Only show vehicle if one is assigned (Lead) */}
            {job.vehicleId ? (
              <div className="flex items-center gap-1.5 col-span-2 text-blue-600">
                  <Truck className="w-3 h-3" />
                  <span className="font-medium">{vehicle?.name || "No Vehicle"}</span>
              </div>
            ) : (
               <div className="col-span-2 text-[10px] text-slate-400 italic pl-5">
                  (Passenger)
               </div>
            )}
        </div>

        {/* Address */}
        <div className="pt-2 border-t border-slate-100 mt-1">
            <div className="flex items-start gap-1.5 text-[10px] text-slate-500 leading-tight">
                <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                <span className="line-clamp-2">{job.address}</span>
            </div>
        </div>
      </div>
    </div>
  );
}
