import { format } from "date-fns";
import { MapPin, Clock, MoreHorizontal, Copy, Trash2, Edit, CalendarDays, CalendarRange } from "lucide-react";
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

interface SiteCardProps {
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string, mode: 'single' | 'week' | 'remainder_month' | 'remainder_year' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months') => void;
  onDuplicate: (item: ScheduleItem, mode: 'single' | 'week' | 'following_week' | 'custom' | 'remainder_month' | 'remainder_year' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months', days?: number) => void;
  isReadOnly?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string, multi: boolean) => void;
}

export function SiteCard({ item, onEdit, onDelete, onDuplicate, isReadOnly = false, isSelected = false, onToggleSelection }: SiteCardProps) {
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

  // Pastel Colors
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
    indigo: "bg-[#C7D2FE] border-[#6366F1] text-[#312E81]",
    cyan: "bg-[#A5F3FC] border-[#06B6D4] text-[#164E63]",
    lime: "bg-[#D9F99D] border-[#84CC16] text-[#365314]",
    emerald: "bg-[#A7F3D0] border-[#10B981] text-[#064E3B]",
    amber: "bg-[#FDE68A] border-[#D97706] text-[#78350F]",
    rose: "bg-[#FECDD3] border-[#F43F5E] text-[#881337]",
    fuchsia: "bg-[#F5D0FE] border-[#E879F9] text-[#701A75]",
    violet: "bg-[#DDD6FE] border-[#8B5CF6] text-[#4C1D95]",
    sky: "bg-[#BAE6FD] border-[#0EA5E9] text-[#0C4A6E]",
    indigo_dark: "bg-[#C7D2FE] border-[#4F46E5] text-[#312E81]",
    blue_gray: "bg-[#CBD5E1] border-[#64748B] text-[#0F172A]",
    stone: "bg-[#D6D3D1] border-[#78716C] text-[#1C1917]",
    red_dark: "bg-[#FECACA] border-[#B91C1C] text-[#7F1D1D]",
    orange_dark: "bg-[#FED7AA] border-[#C2410C] text-[#7C2D12]",
    yellow_dark: "bg-[#FEF08A] border-[#A16207] text-[#713F12]",
    // Default fallback
    free: "bg-white border-dashed border-slate-300 text-slate-400", 
  };

  const baseColor = colorClasses[item.color || 'blue'] || colorClasses.blue;

  if (item.customer === "FREE_SLOT") {
      return (
          <div className="w-full mb-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 p-2 flex items-center justify-center text-xs text-slate-400 font-medium select-none">
              <Clock className="w-3 h-3 mr-1.5 opacity-50" />
              {item.duration}hrs Free
          </div>
      );
  }

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
                    // onToggleSelection(item.id, false);
                }
            }}
            className={cn(
                "group relative rounded-lg border shadow-sm cursor-grab active:cursor-grabbing transition-all select-none overflow-hidden",
                isSelected ? "ring-2 ring-black ring-inset z-20 border-transparent" : "",
                "w-full mb-1", // Jobs always take full width (100%)
                "bg-white border-l-4",
                // Map color classes dynamically or fallback to a default border
                item.color && colorClasses[item.color] ? colorClasses[item.color].replace('bg-', 'border-l-').split(' ')[1] : 'border-l-blue-500'
            )}
            >
            {/* Top Row: Customer | Site | Onsite Time */}
            <div className={cn("px-1.5 py-1 text-[10px] font-bold flex justify-between items-center bg-opacity-30", baseColor.split(' ')[0])}>
                <div className="flex items-center gap-1 truncate max-w-[90%] min-w-0">
                    <span className="truncate shrink-1">{item.customer}</span>
                    <span className="opacity-50">|</span>
                    <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        {item.startTime && <span className="opacity-75">{item.startTime} -</span>}
                        {item.onsiteTime || "TBC"}
                        {item.projectManager && <span className="ml-1 text-slate-500 opacity-75 font-sans font-semibold">({item.projectManager})</span>}
                    </span>
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-black/10 text-current">
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

            {/* Bottom Row: Job Number | Address */}
            <div className="p-2 space-y-1 bg-white flex items-center gap-2">
                {/* Compact Job Number */}
                <div className="flex items-center gap-1 shrink-0">
                     <span className="text-[9px] font-bold bg-slate-100 px-1 py-0.5 rounded text-slate-600 border border-slate-200">
                        {item.jobNumber || "NO REF"}
                     </span>
                     {/* Explicit Duration Badge */}
                     <span className="text-[9px] font-semibold bg-blue-50 px-1 py-0.5 rounded text-blue-600 border border-blue-100">
                        {item.duration}h
                     </span>
                </div>

                <div className="flex items-center gap-1 min-w-0 flex-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                    <span className="break-words whitespace-normal leading-tight text-[10px] text-slate-600 line-clamp-2">{item.address}</span>
                </div>
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
