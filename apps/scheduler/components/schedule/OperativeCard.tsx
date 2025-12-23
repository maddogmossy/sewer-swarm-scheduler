import { User, Truck, MoreHorizontal, Copy, Trash2, Edit, AlertCircle, CalendarDays, CalendarRange } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { ScheduleItem } from "./CalendarGrid";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OperativeCardProps {
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string, mode: 'single' | 'week' | 'remainder_month' | 'remainder_year' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months') => void;
  onDuplicate: (item: ScheduleItem, mode: 'single' | 'week' | 'following_week' | 'custom' | 'remainder_month' | 'remainder_year' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months', days?: number) => void;
  vehicles: { id: string; name: string; status?: string }[];
  employees: { id: string; name: string; status?: string }[];
  isReadOnly?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string, multi: boolean) => void;
}

export function OperativeCard({ item, onEdit, onDelete, onDuplicate, vehicles, employees, isReadOnly = false, isSelected = false, onToggleSelection }: OperativeCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: item, disabled: isReadOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const employee = employees.find(e => e.id === item.employeeId);
  const vehicle = vehicles.find(v => v.id === item.vehicleId);
  const isAssistant = item.type === 'assistant';

  const isEmployeeUnavailable = employee?.status && employee.status !== 'active';
  const isVehicleUnavailable = vehicle?.status && vehicle.status !== 'active';
  const hasWarning = isEmployeeUnavailable || isVehicleUnavailable;

  return (
    <ContextMenu>
        <ContextMenuTrigger>
            <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onEdit(item);
            }}
            onClick={(e) => {
                if (e.shiftKey && onToggleSelection) {
                    e.stopPropagation();
                    onToggleSelection(item.id, true);
                } else if (onToggleSelection) {
                    // Optional: Click without shift selects just this one?
                    // onToggleSelection(item.id, false);
                }
            }}
            className={cn(
                "group relative rounded-lg border shadow-sm cursor-grab active:cursor-grabbing transition-all select-none overflow-hidden p-1 flex items-center gap-1",
                isSelected ? "ring-2 ring-black ring-inset z-20 border-transparent" : "",
                // Grid cell behavior: fill the cell
                "w-full h-full min-w-0 mb-1",
                isAssistant 
                    ? "bg-amber-50 border-amber-200 hover:border-amber-300" // Assistant Style
                    : "bg-slate-50 border-slate-200 hover:border-blue-300", // Operative Style
                hasWarning && "border-red-300 bg-red-50/50"
            )}
            >
            <div className={cn("p-1 rounded-full shrink-0 relative", isAssistant ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600")}>
                    <User className="w-3 h-3" />
                    {isEmployeeUnavailable && (
                        <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 border border-white" title={`Employee is ${employee?.status}`}>
                            <AlertCircle className="w-2 h-2 text-white" />
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col min-w-0 flex-1">
                    <span className={cn("text-[10px] font-bold truncate leading-tight", hasWarning ? "text-red-700" : "text-slate-800")}>
                        {employee?.name || "Unknown"}
                    </span>
                    
                    {!isAssistant && vehicle && (
                        <div className={cn("flex items-center gap-1 text-[9px] leading-tight", hasWarning ? "text-red-600" : "text-blue-600")}>
                            <Truck className="w-2.5 h-2.5" />
                            <span className="truncate">{vehicle.name}</span>
                            {isVehicleUnavailable && (
                                <AlertCircle className="w-2.5 h-2.5 text-red-500 ml-1" />
                            )}
                        </div>
                    )}
                    {isAssistant && (
                        <span className="text-[8px] text-amber-600 uppercase font-bold tracking-wider leading-tight">
                            Assistant
                        </span>
                    )}
                </div>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 p-0 hover:bg-black/5 text-slate-400 hover:text-slate-700">
                        <MoreHorizontal className="h-3 w-3" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                    {!isReadOnly && (
                        <>
                        <DropdownMenuItem onClick={() => onEdit(item)}>
                            <Edit className="w-3 h-3 mr-2" /> Edit
                        </DropdownMenuItem>
                        
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Copy className="w-3 h-3 mr-2" /> Duplicate
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-48">
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'single')}>
                                    Duplicate Single
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'custom', 5)}>
                                    <CalendarDays className="w-3 h-3 mr-2" /> Next 5 Days
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'week')}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Week
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'following_week')}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Following Week
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'remainder_month')}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Month
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'remainder_year')}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Year
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'next_2_months')}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 2 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'next_3_months')}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 3 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'next_4_months')}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 4 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'next_5_months')}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 5 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'next_6_months')}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 6 Months
                                </DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSeparator />

                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="text-red-600">
                                <Trash2 className="w-3 h-3 mr-2" /> Delete
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-48">
                                <DropdownMenuItem onClick={() => onDelete(item.id, 'single')} className="text-red-600">
                                    Delete Single
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(item.id, 'week')} className="text-red-600">
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Week
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onDelete(item.id, 'remainder_month')} className="text-red-600">
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Month
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(item.id, 'remainder_year')} className="text-red-600">
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Year
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(item.id, 'next_2_months')} className="text-red-600">
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 2 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(item.id, 'next_3_months')} className="text-red-600">
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 3 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(item.id, 'next_4_months')} className="text-red-600">
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 4 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(item.id, 'next_5_months')} className="text-red-600">
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 5 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(item.id, 'next_6_months')} className="text-red-600">
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 6 Months
                                </DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        </>
                    )}
                    {isReadOnly && (
                        <DropdownMenuItem disabled className="text-xs text-slate-400">
                            Read Only Mode
                        </DropdownMenuItem>
                    )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
            {!isReadOnly && (
                <>
                <ContextMenuItem onClick={() => onEdit(item)}>
                    <Edit className="w-3 h-3 mr-2" /> Edit
                </ContextMenuItem>
                
                <ContextMenuSub>
                    <ContextMenuSubTrigger>
                        <Copy className="w-3 h-3 mr-2" /> Duplicate
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48">
                        <ContextMenuItem onClick={() => onDuplicate(item, 'single')}>
                            Duplicate Single
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'custom', 5)}>
                            <CalendarDays className="w-3 h-3 mr-2" /> Next 5 Days
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'week')}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Week
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'following_week')}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Following Week
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => onDuplicate(item, 'remainder_month')}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Month
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'remainder_year')}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Year
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'next_2_months')}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 2 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'next_3_months')}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 3 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'next_4_months')}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 4 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'next_5_months')}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 5 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'next_6_months')}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 6 Months
                        </ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>

                <ContextMenuSeparator />

                <ContextMenuSub>
                    <ContextMenuSubTrigger className="text-red-600">
                        <Trash2 className="w-3 h-3 mr-2" /> Delete
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48">
                        <ContextMenuItem onClick={() => onDelete(item.id, 'single')} className="text-red-600">
                            Delete Single
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'week')} className="text-red-600">
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Week
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => onDelete(item.id, 'remainder_month')} className="text-red-600">
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Month
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'remainder_year')} className="text-red-600">
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Year
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'next_2_months')} className="text-red-600">
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 2 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'next_3_months')} className="text-red-600">
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 3 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'next_4_months')} className="text-red-600">
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 4 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'next_5_months')} className="text-red-600">
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 5 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'next_6_months')} className="text-red-600">
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 6 Months
                        </ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>
                </>
            )}
            {isReadOnly && (
                <ContextMenuItem disabled className="text-xs text-slate-400">
                    Read Only Mode
                </ContextMenuItem>
            )}
        </ContextMenuContent>
    </ContextMenu>
  );
}
