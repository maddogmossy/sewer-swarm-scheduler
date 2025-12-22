import { FileText, MoreHorizontal, Copy, Trash2, Edit, CalendarDays, CalendarRange } from "lucide-react";
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

interface NoteCardProps {
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string, mode: 'single' | 'week' | 'remainder_month' | 'remainder_year' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months') => void;
  onDuplicate: (item: ScheduleItem, mode: 'single' | 'week' | 'following_week' | 'custom' | 'remainder_month' | 'remainder_year' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months', days?: number) => void;
  isReadOnly?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string, multi: boolean) => void;
}

export function NoteCard({ item, onEdit, onDelete, onDuplicate, isReadOnly = false, isSelected = false, onToggleSelection }: NoteCardProps) {
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
                // Note Style - Red Border as requested
                "bg-red-50 border-red-300 hover:border-red-400"
            )}
            >
            <div className={cn("p-1 rounded-full shrink-0 relative bg-red-100 text-red-600")}>
                    <FileText className="w-3 h-3" />
                </div>
                
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[10px] font-medium text-red-900 leading-tight line-clamp-2 whitespace-normal break-words">
                        {item.noteContent || "Empty Note"}
                    </span>
                </div>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 p-0 hover:bg-black/5 text-red-400 hover:text-red-700">
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