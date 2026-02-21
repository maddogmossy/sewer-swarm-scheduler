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
  selectedItemIds?: Set<string>;
  onDuplicateSelected?: (mode: 'single' | 'week' | 'following_week' | 'custom' | 'remainder_month' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months' | 'remainder_year', days?: number) => void;
  onDeleteSelected?: (mode: 'single' | 'week' | 'remainder_month' | 'remainder_year' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months') => void;
}

export function NoteCard({ item, onEdit, onDelete, onDuplicate, isReadOnly = false, isSelected = false, onToggleSelection, selectedItemIds, onDuplicateSelected, onDeleteSelected }: NoteCardProps) {
  const hasMultipleSelected = selectedItemIds && selectedItemIds.size > 1 && selectedItemIds.has(item.id);
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

  // Style 1 menu item classes (soft text, subtle hovers)
  const softMenuItemClass =
    "cursor-pointer flex items-center gap-2 text-slate-700 hover:bg-slate-50";
  const softSubTriggerClass =
    "cursor-pointer flex items-center gap-2 text-slate-700 data-[state=open]:bg-slate-50";
  const softDangerItemClass =
    "cursor-pointer flex items-center gap-2 text-red-500 hover:bg-slate-50 focus:bg-slate-50 focus:text-red-600";
  const softDangerSubTriggerClass =
    "cursor-pointer flex items-center gap-2 text-red-500 data-[state=open]:bg-slate-50 data-[state=open]:text-red-600";

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
                e.stopPropagation();
                if (e.shiftKey && onToggleSelection) {
                    onToggleSelection(item.id, true);
                } else if (onToggleSelection) {
                    onToggleSelection(item.id, false);
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
                    <DropdownMenuContent align="end" className="w-48 bg-white">
                    {!isReadOnly && (
                        <>
                        <DropdownMenuItem
                            onClick={() => onEdit(item)}
                            disabled={hasMultipleSelected}
                            className={hasMultipleSelected ? "opacity-50 cursor-not-allowed" : softMenuItemClass}
                        >
                            <Edit className="w-3 h-3 mr-2" /> Edit
                        </DropdownMenuItem>
                        
                        {hasMultipleSelected && onDuplicateSelected ? (
                            <>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className={softSubTriggerClass}>
                                        <Copy className="w-3 h-3 mr-2" /> Duplicate Selected ({selectedItemIds?.size || 0})
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-48 bg-white">
                                        <DropdownMenuItem onClick={() => onDuplicateSelected('single')} className={softMenuItemClass}>
                                            Duplicate Single
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDuplicateSelected('custom', 5)} className={softMenuItemClass}>
                                            <CalendarDays className="w-3 h-3 mr-2" /> Next 5 Days
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDuplicateSelected('week')} className={softMenuItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Week
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDuplicateSelected('following_week')} className={softMenuItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Following Week
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => onDuplicateSelected('remainder_month')} className={softMenuItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Month
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDuplicateSelected('remainder_year')} className={softMenuItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Year
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDuplicateSelected('next_2_months')} className={softMenuItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Next 2 Months
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDuplicateSelected('next_3_months')} className={softMenuItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Next 3 Months
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDuplicateSelected('next_4_months')} className={softMenuItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Next 4 Months
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDuplicateSelected('next_5_months')} className={softMenuItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Next 5 Months
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDuplicateSelected('next_6_months')} className={softMenuItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Next 6 Months
                                        </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                {onDeleteSelected && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className={softDangerSubTriggerClass}>
                                                <Trash2 className="w-3 h-3 mr-2" /> Delete Selected ({selectedItemIds?.size || 0})
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="w-48">
                                                <DropdownMenuItem onClick={() => onDeleteSelected('single')} className={softDangerItemClass}>
                                                    Delete Selected
                                                </DropdownMenuItem>
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className={softSubTriggerClass}>
                                        <Copy className="w-3 h-3 mr-2" /> Duplicate
                                    </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-48 bg-white">
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'single')} className={softMenuItemClass}>
                                    Duplicate Single
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'custom', 5)} className={softMenuItemClass}>
                                    <CalendarDays className="w-3 h-3 mr-2" /> Next 5 Days
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'week')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Week
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'following_week')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Following Week
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'remainder_month')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Month
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'remainder_year')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Year
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'next_2_months')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 2 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'next_3_months')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 3 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'next_4_months')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 4 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'next_5_months')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 5 Months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(item, 'next_6_months')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 6 Months
                                </DropdownMenuItem>
                            </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className={softDangerSubTriggerClass}>
                                        <Trash2 className="w-3 h-3 mr-2" /> Delete
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-48">
                                        <DropdownMenuItem onClick={() => onDelete(item.id, 'single')} className={softDangerItemClass}>
                                            Delete Single
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(item.id, 'week')} className={softDangerItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Week
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => onDelete(item.id, 'remainder_month')} className={softDangerItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Month
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(item.id, 'remainder_year')} className={softDangerItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Year
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(item.id, 'next_2_months')} className={softDangerItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Next 2 Months
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(item.id, 'next_3_months')} className={softDangerItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Next 3 Months
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(item.id, 'next_4_months')} className={softDangerItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Next 4 Months
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(item.id, 'next_5_months')} className={softDangerItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Next 5 Months
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(item.id, 'next_6_months')} className={softDangerItemClass}>
                                            <CalendarRange className="w-3 h-3 mr-2" /> Next 6 Months
                                        </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            </>
                        )}
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
        <ContextMenuContent className="w-48 bg-white">
            {!isReadOnly && (
                <>
                <ContextMenuItem onClick={() => onEdit(item)} className={softMenuItemClass}>
                    <Edit className="w-3 h-3 mr-2" /> Edit
                </ContextMenuItem>
                
                <ContextMenuSub>
                    <ContextMenuSubTrigger className={softSubTriggerClass}>
                        <Copy className="w-3 h-3 mr-2" /> Duplicate
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48 bg-white">
                        <ContextMenuItem onClick={() => onDuplicate(item, 'single')} className={softMenuItemClass}>
                            Duplicate Single
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'custom', 5)} className={softMenuItemClass}>
                            <CalendarDays className="w-3 h-3 mr-2" /> Next 5 Days
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'week')} className={softMenuItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Week
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'following_week')} className={softMenuItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Following Week
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => onDuplicate(item, 'remainder_month')} className={softMenuItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Month
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'remainder_year')} className={softMenuItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Year
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'next_2_months')} className={softMenuItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 2 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'next_3_months')} className={softMenuItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 3 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'next_4_months')} className={softMenuItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 4 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'next_5_months')} className={softMenuItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 5 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicate(item, 'next_6_months')} className={softMenuItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 6 Months
                        </ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>

                <ContextMenuSeparator />

                <ContextMenuSub>
                    <ContextMenuSubTrigger className={softDangerSubTriggerClass}>
                        <Trash2 className="w-3 h-3 mr-2" /> Delete
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48">
                        <ContextMenuItem onClick={() => onDelete(item.id, 'single')} className={softDangerItemClass}>
                            Delete Single
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'week')} className={softDangerItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Week
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => onDelete(item.id, 'remainder_month')} className={softDangerItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Month
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'remainder_year')} className={softDangerItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Year
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'next_2_months')} className={softDangerItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 2 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'next_3_months')} className={softDangerItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 3 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'next_4_months')} className={softDangerItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 4 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'next_5_months')} className={softDangerItemClass}>
                            <CalendarRange className="w-3 h-3 mr-2" /> Next 5 Months
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDelete(item.id, 'next_6_months')} className={softDangerItemClass}>
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