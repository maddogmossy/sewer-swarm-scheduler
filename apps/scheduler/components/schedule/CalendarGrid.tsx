import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, isSameDay, endOfWeek, isAfter, isBefore, startOfDay, endOfMonth, addMonths, endOfYear } from "date-fns";
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, useDroppable, Modifier } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { SiteCard } from "./SiteCard";
import { OperativeCard } from "./OperativeCard";
import { NoteCard } from "./NoteCard";
import { ItemModal } from "./ItemModal";
import { ResourcesModal } from "./ResourcesModal";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, MoreHorizontal, Trash2, Briefcase, UserPlus, User, Truck, Settings, Edit, Search, Lock, Mail, Check, Sun, Moon, ChevronDown, ChevronRight as ChevronRightIcon, RotateCcw, RotateCw, FileText, LogOut, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { SmartSearchModal } from "./SmartSearchModal";
import { EmailPreviewModal } from "./EmailPreviewModal";
import { GroupingDialog } from "./GroupingDialog";

export interface Crew {
    id: string;
    name: string;
    depotId?: string;
    shift?: 'day' | 'night';
    archivedAt?: string | null;
}

// Unified Schedule Item Type
export interface ScheduleItem {
    id: string;
    type: 'job' | 'operative' | 'assistant' | 'note';
    date: Date;
    crewId: string;
    depotId: string;

    // Job Specifics
    customer?: string;
    jobNumber?: string;
    address?: string;
    projectManager?: string; // PM Initials
    startTime?: string;
    onsiteTime?: string;
    color?: string;
    duration?: number; // Duration in hours

    // Person Specifics
    employeeId?: string;
    vehicleId?: string;

    // Note Specifics
    noteContent?: string;
}

interface CalendarGridProps {
  items: ScheduleItem[];
  crews: Crew[];
  employees: { id: string; name: string; status: 'active' | 'holiday' | 'sick'; email?: string; jobRole?: 'operative' | 'assistant' }[];
  vehicles: { id: string; name: string; status: 'active' | 'off_road' | 'maintenance'; vehicleType: string }[];
  colorLabels: Record<string, string>;
  isReadOnly: boolean;
  depots: { id: string; name: string; address: string }[];
  allItems: ScheduleItem[];
  onItemUpdate: (item: ScheduleItem) => void;
  onItemCreate: (item: ScheduleItem) => void;
  onItemDelete: (id: string) => void;
  onItemReorder: (activeId: string, overId: string) => void;
  onCrewCreate: (name: string, shift: 'day' | 'night') => void;
  onCrewUpdate: (id: string, name: string, shift: 'day' | 'night') => void;
  onCrewDelete: (id: string) => void;
  onEmployeeCreate: (name: string) => void;
  onEmployeeUpdate: (id: string, name: string, status?: 'active' | 'holiday' | 'sick', jobRole?: 'operative' | 'assistant', email?: string) => void;
  onEmployeeDelete: (id: string) => void;
  onVehicleCreate: (name: string) => void;
  onVehicleUpdate: (id: string, name: string, status?: 'active' | 'off_road' | 'maintenance') => void;
  onVehicleDelete: (id: string) => void;
  onColorLabelUpdate: (color: string, label: string) => void;
  vehicleTypes?: string[];
  allCrews?: Crew[];
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onLogout?: () => void;
}

function DroppableCell({ id, children, className, style, onDoubleClick, disabled }: { id: string, children: React.ReactNode, className?: string, style?: React.CSSProperties, onDoubleClick?: (e: React.MouseEvent) => void, disabled?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  
  return (
    <td 
      ref={setNodeRef}
      className={cn(
        className, 
        isOver ? "bg-blue-50/80 ring-2 ring-inset ring-blue-300 transition-all" : "",
        "overflow-hidden", // Ensure content doesn't spill out of the cell
        disabled ? "bg-slate-50/40 opacity-60 cursor-not-allowed" : ""
      )}
      style={style}
      onDoubleClick={disabled ? undefined : onDoubleClick}
    >
      {children}
    </td>
  );
}

export function CalendarGrid({ 
    items, crews, employees, vehicles, colorLabels, isReadOnly,
    onItemUpdate, onItemCreate, onItemDelete, onItemReorder,
    onCrewCreate, onCrewUpdate, onCrewDelete,
    onEmployeeCreate, onEmployeeUpdate, onEmployeeDelete,
    onVehicleCreate, onVehicleUpdate, onVehicleDelete,
    onColorLabelUpdate, depots, allItems, vehicleTypes, allCrews,
    onUndo, onRedo, canUndo, canRedo, onLogout
}: CalendarGridProps) {
  // Always start on the current week - calculate fresh each time
  const getCurrentWeekStart = () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    return weekStart;
  };

  const [currentDate, setCurrentDate] = useState(() => {
    // Initialize with current week start
    return getCurrentWeekStart();
  });
  const today = startOfDay(new Date());
  const [viewDays, setViewDays] = useState(5); // 5 or 7 day view

  // Always reset to current week when component mounts (ensures it always opens on current week)
  useEffect(() => {
    // Force update to current week on mount
    const currentWeekStart = getCurrentWeekStart();
    setCurrentDate(currentWeekStart);
  }, []); // Empty deps - only run on mount
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  
  // Mock Email Status State
  const [emailStatus, setEmailStatus] = useState<Record<string, { sent: boolean, timestamp?: string }>>({});
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalDate, setEmailModalDate] = useState<Date | null>(null);

  // Modal States
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'job' | 'operative' | 'assistant' | 'note';
    data?: ScheduleItem;
    target?: { date: Date; crewId: string };
  }>({ isOpen: false, type: 'job' });

  const [selectionMenu, setSelectionMenu] = useState<{
    isOpen: boolean;
    date: Date;
    crewId: string;
  } | null>(null);
  
  const [crewModal, setCrewModal] = useState<{ isOpen: boolean, mode: 'create' | 'edit', id?: string, name: string, shift: 'day' | 'night' }>({ isOpen: false, mode: 'create', name: "", shift: 'day' });

  // Auto-generate name when shift changes in Create mode
  useEffect(() => {
      if (crewModal.isOpen && crewModal.mode === 'create') {
          const prefix = crewModal.shift === 'night' ? "Night" : "Day";
          // Count existing crews of this shift type to find the next number
          // Simple heuristic: Count how many start with the prefix
          const count = crews.filter(c => c.shift === crewModal.shift || (crewModal.shift === 'night' ? c.name.toLowerCase().includes("night") : !c.name.toLowerCase().includes("night"))).length;
          
          // Only auto-fill if name is empty or matches the pattern of the OTHER shift
          const otherPrefix = crewModal.shift === 'night' ? "Day" : "Night";
          if (!crewModal.name || crewModal.name.startsWith(otherPrefix)) {
               const numberWords = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
               const nextNumWord = numberWords[count] || (count + 1).toString();
               
               setCrewModal(prev => ({ ...prev, name: `${prefix} ${nextNumWord}` }));
          }
      }
  }, [crewModal.shift, crewModal.isOpen, crewModal.mode]); // Depend on shift change
  
  const [resourcesModalOpen, setResourcesModalOpen] = useState(false);
  const [smartSearchOpen, setSmartSearchOpen] = useState(false);
  const [expandedShifts, setExpandedShifts] = useState<{ night: boolean, day: boolean }>({ night: true, day: true });
  
  // Grouping dialog state
  const [groupingDialog, setGroupingDialog] = useState<{
    open: boolean;
    type: 'delete' | 'color';
    itemId: string;
    groupCount: number;
    onConfirm: (applyToGroup: boolean) => void;
  } | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: viewDays }).map((_, i) => addDays(weekStart, i));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // --- DRAG AND DROP ---

  const handleDragStart = (event: DragStartEvent) => {
    if (isReadOnly) return;
    const activeItem = items.find(i => i.id === event.active.id);
    if (activeItem && isBefore(startOfDay(new Date(activeItem.date)), startOfDay(new Date()))) return;

    setActiveId(event.active.id as string);
    // Check if Ctrl is held down at start of drag
    // @ts-ignore - dnd-kit doesn't expose native event directly in DragStartEvent type easily but it exists
    const nativeEvent = event.activatorEvent as MouseEvent;
    if (nativeEvent && (nativeEvent.ctrlKey || nativeEvent.metaKey)) {
        setIsCtrlPressed(true);
    } else {
        setIsCtrlPressed(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (isReadOnly) return;
    const { active, over } = event;
    setIsCtrlPressed(false);
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeItem = items.find(i => i.id === active.id);
    if (!activeItem) return;

    let targetCrewId = "";
    let targetDateStr = "";
    const overId = over.id as string;

    // Check if dropping onto another Item (Reordering) or onto a Cell (Moving/Empty Drop)
    const overItem = items.find(i => i.id === overId);
    const isDroppingOnItem = !!overItem;

    if (overId.includes("|")) {
        // Dropped on empty cell space
        const [cId, dStr] = overId.split("|");
        targetCrewId = cId;
        targetDateStr = dStr;
    } else if (overItem) {
        // Dropped on an item
        targetCrewId = overItem.crewId;
        targetDateStr = format(overItem.date, "yyyy-MM-dd");
    }

    if (targetCrewId && targetDateStr) {
        const newDate = new Date(targetDateStr);

        // Prevent dropping onto past dates
        if (isBefore(startOfDay(newDate), startOfDay(new Date()))) {
            setActiveId(null);
            return;
        }
        
        if (isCtrlPressed) {
             // Duplicate
             onItemCreate({
                ...activeItem,
                id: Math.random().toString(36).substr(2, 9),
                crewId: targetCrewId,
                date: newDate
            });
        } else {
             // Move or Reorder
             const isSameCell = activeItem.crewId === targetCrewId && isSameDay(activeItem.date, newDate);
             
             if (isSameCell && isDroppingOnItem && active.id !== over.id) {
                 // Reorder within same cell
                 onItemReorder(active.id as string, over.id as string);
             } else if (!isSameCell) {
                 // Move to new cell
                 onItemUpdate({ ...activeItem, crewId: targetCrewId, date: newDate });
             }
        }
    }
    setActiveId(null);
  };

  const handleSendDailyEmails = (date: Date) => {
      if (isReadOnly) return;
      
      const dateKey = format(date, "yyyy-MM-dd");
      const status = emailStatus[dateKey];
      
      if (status?.sent) {
          // Already sent, maybe confirm resend?
          if (!confirm(`Emails already sent at ${status.timestamp}. Resend?`)) return;
      }
      
      // Find operatives working on this day
      const peopleOnDay = items.filter(i => 
          (i.type === 'operative' || i.type === 'assistant') && 
          isSameDay(new Date(i.date), date)
      );
      
      if (peopleOnDay.length === 0) {
          alert("No operatives or assistants scheduled for this day.");
          return;
      }

      // Open the preview modal
      setEmailModalDate(date);
      setEmailModalOpen(true);
  };

  const handleEmailSent = (date: Date, count: number) => {
      const dateKey = format(date, "yyyy-MM-dd");
      setEmailStatus(prev => ({
          ...prev,
          [dateKey]: {
              sent: true,
              timestamp: format(new Date(), "HH:mm")
          }
      }));
      alert(`Success! Schedule sent to ${count} staff members.`);
  };

  // --- HANDLERS ---

  const handleCellDoubleClick = (date: Date, crewId: string) => {
     console.log("🔐 handleCellDoubleClick:", { isReadOnly, date, crewId });
     if (isReadOnly) {
       console.log("❌ Blocked: isReadOnly is true");
       return;
     }
     if (isBefore(startOfDay(date), startOfDay(new Date()))) {
       console.log("❌ Blocked: date is in the past");
       return;
     }
     console.log("✅ Opening selection menu");
     setSelectionMenu({ isOpen: true, date, crewId });
  };

  const handleSelection = (type: 'job' | 'operative' | 'assistant' | 'note') => {
    if (selectionMenu) {
        if (isBefore(startOfDay(selectionMenu.date), startOfDay(new Date()))) return;
        setModalState({ 
            isOpen: true, 
            type, 
            target: { date: selectionMenu.date, crewId: selectionMenu.crewId } 
        });
        setSelectionMenu(null);
    }
  };

  const handleToggleSelection = (id: string, multi: boolean) => {
      setSelectedItemIds(prev => {
          const newSet = new Set(multi ? prev : []);
          if (multi) {
              if (newSet.has(id)) {
                  newSet.delete(id);
              } else {
                  newSet.add(id);
              }
          } else {
              // If not holding shift, just select this one (clearing others)
              // This mimics standard file explorer behavior
              newSet.add(id);
          }
          return newSet;
      });
  };

  const handleEditItem = (item: ScheduleItem) => {
    if (isReadOnly) return;
    const itemDate = startOfDay(new Date(item.date));
    const today = startOfDay(new Date());
    const isPast = isBefore(itemDate, today);
    
    // Allow editing past items only if it's a job (for color changes)
    if (isPast && item.type !== 'job') {
      return;
    }
    
    setModalState({ isOpen: true, type: item.type, data: item });
  };

  const handleDuplicateItem = (item: ScheduleItem, mode: 'single' | 'week' | 'following_week' | 'custom' | 'remainder_month' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months' | 'remainder_year' = 'single', days = 1) => {
    if (isReadOnly) return;

    // Determine which items to process
    const targetItems = selectedItemIds.has(item.id) 
        ? items.filter(i => selectedItemIds.has(i.id))
        : [item];

    const itemsToCreate: ScheduleItem[] = [];

    targetItems.forEach(sourceItem => {
        const startDate = new Date(sourceItem.date);
        
        if (mode === 'single') {
             itemsToCreate.push({ ...sourceItem, id: Math.random().toString(36).substr(2, 9) });
        } else if (mode === 'week') {
            // Duplicate for remainder of the displayed week
            const currentViewEnd = addDays(weekStart, viewDays - 1);
            let nextDate = addDays(startDate, 1);
            
            while (isSameDay(nextDate, currentViewEnd) || isBefore(nextDate, currentViewEnd)) {
                itemsToCreate.push({
                    ...sourceItem,
                    id: Math.random().toString(36).substr(2, 9),
                    date: new Date(nextDate)
                });
                nextDate = addDays(nextDate, 1);
            }
        } else if (mode === 'following_week') {
            // Duplicate for the WHOLE of the following week
            const nextWeekStart = addDays(startOfWeek(startDate, { weekStartsOn: 1 }), 7);
            const daysToFill = viewDays; 
            
            for (let i = 0; i < daysToFill; i++) {
                 itemsToCreate.push({
                    ...sourceItem,
                    id: Math.random().toString(36).substr(2, 9),
                    date: addDays(nextWeekStart, i)
                });
            }
        } else if (mode === 'custom') {
            // Duplicate for X days
            for (let i = 1; i <= days; i++) {
                 itemsToCreate.push({
                    ...sourceItem,
                    id: Math.random().toString(36).substr(2, 9),
                    date: addDays(startDate, i)
                });
            }
        } else if (['remainder_month', 'next_2_months', 'next_3_months', 'next_4_months', 'next_5_months', 'next_6_months', 'remainder_year'].includes(mode)) {
            let endDate: Date;
            if (mode === 'remainder_month') {
                endDate = endOfMonth(startDate);
            } else if (mode === 'remainder_year') {
                endDate = endOfYear(startDate);
            } else {
                const monthsToAdd = parseInt(mode.split('_')[1]);
                endDate = addMonths(startDate, monthsToAdd);
            }
    
            let nextDate = addDays(startDate, 1);
            let safetyCounter = 0;
            const MAX_ITEMS_PER_SOURCE = 365; // Safety limit
    
            while ((isBefore(nextDate, endDate) || isSameDay(nextDate, endDate)) && safetyCounter < MAX_ITEMS_PER_SOURCE) {
                itemsToCreate.push({
                    ...sourceItem,
                    id: Math.random().toString(36).substr(2, 9),
                    date: new Date(nextDate)
                });
                nextDate = addDays(nextDate, 1);
                safetyCounter++;
            }
        }
    });

    itemsToCreate.forEach(newItem => onItemCreate(newItem));
  };

  // Helper function to find items with the same job number
  const findItemsWithSameJobNumber = (item: ScheduleItem): ScheduleItem[] => {
    if (item.type !== 'job' || !item.jobNumber) return [item];
    return items.filter(i => 
      i.type === 'job' && 
      i.jobNumber === item.jobNumber &&
      i.jobNumber !== undefined &&
      i.jobNumber !== ''
    );
  };

  const handleDeleteItem = (id: string, mode: 'single' | 'week' | 'remainder_month' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months' | 'remainder_year' = 'single') => {
      if (isReadOnly) return;
      
      // Determine items to delete
      const isSelected = selectedItemIds.has(id);
      const targetIds = isSelected ? Array.from(selectedItemIds) : [id];

      // Filter out past items from deletion
      const validTargetIds = targetIds.filter(tid => {
          const item = items.find(i => i.id === tid);
          if (!item) return false;
          // Prevent deleting past items
          return !isBefore(startOfDay(new Date(item.date)), startOfDay(new Date()));
      });

      if (validTargetIds.length === 0) return;
      
      // For single delete mode, check if it's a job with a job number group
      if (mode === 'single' && validTargetIds.length === 1) {
        const itemToDelete = items.find(i => i.id === validTargetIds[0]);
        if (itemToDelete && itemToDelete.type === 'job' && itemToDelete.jobNumber) {
          const groupItems = findItemsWithSameJobNumber(itemToDelete);
          if (groupItems.length > 1) {
            // Show grouping dialog
            setGroupingDialog({
              open: true,
              type: 'delete',
              itemId: validTargetIds[0],
              groupCount: groupItems.length,
              onConfirm: (applyToGroup: boolean) => {
                if (applyToGroup) {
                  // Delete all items with the same job number
                  groupItems.forEach(item => {
                    const itemDate = new Date(item.date);
                    if (!isBefore(startOfDay(itemDate), startOfDay(new Date()))) {
                      onItemDelete(item.id);
                    }
                  });
                } else {
                  // Delete just this one
                  onItemDelete(validTargetIds[0]);
                }
                // Clear selection if we deleted selected items
                if (isSelected) {
                  setSelectedItemIds(new Set());
                }
              }
            });
            return;
          }
        }
      }
      
      // Normal delete flow (no grouping or bulk delete)
      validTargetIds.forEach(targetId => {
          if (mode === 'single') {
              onItemDelete(targetId);
          } else {
              // Bulk Delete Modes
              const itemToDelete = items.find(i => i.id === targetId);
              if (!itemToDelete) return;
              
              const startDate = new Date(itemToDelete.date);
              let endDate: Date;
    
              if (mode === 'week') {
                  endDate = addDays(weekStart, viewDays - 1);
              } else if (mode === 'remainder_month') {
                  endDate = endOfMonth(startDate);
              } else if (mode === 'remainder_year') {
                  endDate = endOfYear(startDate);
              } else {
                 const monthsToAdd = parseInt(mode.split('_')[1]);
                 endDate = addMonths(startDate, monthsToAdd);
              }
              
              const idsToDelete = items.filter(i => {
                  if (i.id === targetId) return true;
                  
                  const iDate = new Date(i.date);
                  const isFuture = isAfter(iDate, startDate) && (isBefore(iDate, endDate) || isSameDay(iDate, endDate));
                  
                  if (!isFuture && i.id !== targetId) return false;
                  if (i.crewId !== itemToDelete.crewId) return false;
                  if (i.type !== itemToDelete.type) return false;
                  
                  if (i.type === 'job') {
                      return i.customer === itemToDelete.customer && i.address === itemToDelete.address;
                  } else {
                      return i.employeeId === itemToDelete.employeeId;
                  }
              }).map(i => i.id);
              
              idsToDelete.forEach(delId => onItemDelete(delId));
          }
      });
      
      // Clear selection if we deleted selected items
      if (isSelected) {
          setSelectedItemIds(new Set());
      }
  };

  // Duplicate selected items
  const handleDuplicateSelected = (mode: 'single' | 'week' | 'following_week' | 'custom' | 'remainder_month' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months' | 'remainder_year', days?: number) => {
    if (selectedItemIds.size === 0) return;
    
    const selectedItems = items.filter(i => selectedItemIds.has(i.id));
    selectedItems.forEach(item => {
      handleDuplicateItem(item, mode, days);
    });
    setSelectedItemIds(new Set());
  };

  // Delete selected items
  const handleDeleteSelected = (mode: 'single' | 'week' | 'remainder_month' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months' | 'remainder_year') => {
    if (selectedItemIds.size === 0) return;
    
    const selectedIds = Array.from(selectedItemIds);
    selectedIds.forEach(id => {
      handleDeleteItem(id, mode);
    });
    setSelectedItemIds(new Set());
  };

  // Copy selected items to week/month (keeping for backward compatibility but not using toolbar)
  const handleCopySelected = (mode: 'week' | 'month') => {
    if (selectedItemIds.size === 0) return;
    
    const selectedItems = items.filter(i => selectedItemIds.has(i.id));
    const itemsToCreate: ScheduleItem[] = [];
    
    selectedItems.forEach(sourceItem => {
      const sourceDate = new Date(sourceItem.date);
      const dayOfWeek = sourceDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const weekStartOfSource = startOfWeek(sourceDate, { weekStartsOn: 1 });
      
      let endDate: Date;
      if (mode === 'week') {
        endDate = addDays(weekStart, viewDays - 1);
      } else {
        endDate = endOfMonth(sourceDate);
      }
      
      // Copy to the same day of week in each week within the range
      let currentWeekStart = new Date(weekStartOfSource);
      while (currentWeekStart <= endDate) {
        // Calculate the target date (same day of week in this week)
        const targetDate = addDays(currentWeekStart, dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        
        // Only copy to future dates
        if (!isBefore(startOfDay(targetDate), startOfDay(new Date())) && targetDate <= endDate) {
          itemsToCreate.push({
            ...sourceItem,
            id: Math.random().toString(36).substr(2, 9),
            date: targetDate
          });
        }
        
        // Move to next week
        currentWeekStart = addDays(currentWeekStart, 7);
      }
    });
    
    itemsToCreate.forEach(newItem => onItemCreate(newItem));
    setSelectedItemIds(new Set());
  };

  const handleModalSubmit = (data: any, applyToWeek: boolean = false) => {
    if (modalState.data) {
        // UPDATE
        const itemDate = startOfDay(new Date(modalState.data.date));
        const today = startOfDay(new Date());
        const isPast = isBefore(itemDate, today);
        
        // For past items, only allow color changes for jobs
        if (isPast) {
          if (modalState.data.type !== 'job') {
            alert("Cannot edit past items. Only category colors can be changed for past jobs.");
            return;
          }
          
          // Check if only color is being changed
          const hasNonColorChanges = Object.keys(data).some(key => {
            if (key === 'color') return false;
            // Check if the value actually changed
            return data[key] !== modalState.data[key];
          });
          
          if (hasNonColorChanges) {
            alert("Cannot edit past jobs. Only category colors can be changed.");
            return;
          }
        }
        
        const updatedItem = { ...modalState.data, ...data };
        
        // Check if color changed and if it's a job with a job number
        if (data.color && data.color !== modalState.data.color && 
            updatedItem.type === 'job' && updatedItem.jobNumber) {
          // Show grouping dialog for color change
          const groupItems = findItemsWithSameJobNumber(updatedItem);
          if (groupItems.length > 1) {
            setGroupingDialog({
              open: true,
              type: 'color',
              itemId: updatedItem.id,
              groupCount: groupItems.length,
              onConfirm: (applyToGroup: boolean) => {
                if (applyToGroup) {
                  // Change color for all items with the same job number
                  groupItems.forEach(groupItem => {
                    onItemUpdate({ ...groupItem, color: data.color });
                  });
                } else {
                  // Change color for just this one
                  onItemUpdate(updatedItem);
                }
                // Also handle applyToWeek if needed
                if (applyToWeek) {
                  // Apply changes to future occurrences in this week
                  const startDate = new Date(updatedItem.date);
                  const currentViewEnd = addDays(weekStart, viewDays - 1);
                  
                  items.forEach(i => {
                    if (i.id === updatedItem.id) return;
                    
                    const iDate = new Date(i.date);
                    const isFuture = isAfter(iDate, startDate) && (isBefore(iDate, currentViewEnd) || isSameDay(iDate, currentViewEnd));
                    
                    if (isFuture && i.crewId === updatedItem.crewId && i.type === updatedItem.type) {
                      let isMatch = false;
                      
                      if (i.type === 'job') {
                        if (i.customer === modalState.data?.customer) isMatch = true;
                      } else {
                        if (i.employeeId === modalState.data?.employeeId) isMatch = true;
                      }
                      
                      if (isMatch) {
                        onItemUpdate({ ...i, color: data.color });
                      }
                    }
                  });
                }
              }
            });
            return;
          }
        }
        
        onItemUpdate(updatedItem);
        
        if (applyToWeek) {
            // Apply changes to future occurrences in this week
            const startDate = new Date(updatedItem.date);
            const currentViewEnd = addDays(weekStart, viewDays - 1);
            
            items.forEach(i => {
                if (i.id === updatedItem.id) return;
                
                const iDate = new Date(i.date);
                const isFuture = isAfter(iDate, startDate) && (isBefore(iDate, currentViewEnd) || isSameDay(iDate, currentViewEnd));
                
                // Simplified logic: If it looks like part of the same "series" (Same Crew + Same Type), update it.
                // This handles the "whole group" request by updating subsequent days.
                if (isFuture && i.crewId === updatedItem.crewId && i.type === updatedItem.type) {
                    let isMatch = false;
                    
                    if (i.type === 'job') {
                         // Match if it shares the same Customer (before edit)
                         // This assumes the user hasn't changed the customer yet, or we match loosely.
                         // If "Apply to week" is checked, we assume the user wants to update the "slot" for this job.
                         if (i.customer === modalState.data?.customer) isMatch = true;
                    } else {
                        // For people, match the Employee ID
                        if (i.employeeId === modalState.data?.employeeId) isMatch = true;
                    }
                    
                    if (isMatch) {
                        onItemUpdate({ ...i, ...data });
                    }
                }
            });
        }
        
    } else if (modalState.target) {
        // CREATE
        // Ensure date is included - it's required
        if (!modalState.target.date) {
            console.error('[handleModalSubmit] Missing date in modalState.target:', modalState.target);
            return;
        }
        
        onItemCreate({
            id: Math.random().toString(36).substr(2, 9),
            type: modalState.type,
            date: modalState.target.date,
            crewId: modalState.target.crewId,
            depotId: "",
            ...data
        });
        // Apply to week for Create? Usually handled by Duplicate. 
        // But if user checks it on create, we could loop create.
        if (applyToWeek) {
             const startDate = new Date(modalState.target.date);
             const currentViewEnd = addDays(weekStart, viewDays - 1);
             let nextDate = addDays(startDate, 1);
             
             while (isSameDay(nextDate, currentViewEnd) || isBefore(nextDate, currentViewEnd)) {
                onItemCreate({
                    id: Math.random().toString(36).substr(2, 9),
                    type: modalState.type,
                    date: new Date(nextDate),
                    crewId: modalState.target.crewId,
                    depotId: "",
                    ...data
                });
                nextDate = addDays(nextDate, 1);
             }
        }
    }
  };

  const handleCrewSubmit = () => {
    if (crewModal.name.trim()) {
        if (crewModal.mode === 'create') {
            onCrewCreate(crewModal.name, crewModal.shift);
        } else if (crewModal.mode === 'edit' && crewModal.id) {
            onCrewUpdate(crewModal.id, crewModal.name, crewModal.shift);
        }
        setCrewModal({ isOpen: false, mode: 'create', name: "", shift: 'day' });
    }
  };

  const activeItem = activeId ? items.find(i => i.id === activeId) : null;

  // --- FILTERING ---
  const filteredItems = items.filter(item => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      
      // Search in Job details
      if (item.type === 'job') {
          return (
              item.customer?.toLowerCase().includes(query) ||
              item.jobNumber?.toLowerCase().includes(query) ||
              item.address?.toLowerCase().includes(query)
          );
      }
      
      // Search in People details (Operative/Assistant)
      if (item.type === 'operative' || item.type === 'assistant') {
          const emp = employees.find(e => e.id === item.employeeId);
          const veh = vehicles.find(v => v.id === item.vehicleId);
          return (
              emp?.name.toLowerCase().includes(query) ||
              veh?.name.toLowerCase().includes(query)
          );
      }
      return false;
  });

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900"
        onKeyDown={(e) => { if(e.ctrlKey && !isReadOnly) setIsCtrlPressed(true); }}
        onKeyUp={(e) => { if(!e.ctrlKey && !isReadOnly) setIsCtrlPressed(false); }}
        tabIndex={0} // Make div focusable to catch key events
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 rounded-md border border-slate-200 p-0.5">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -7))} className="h-8 w-8 hover:bg-white text-slate-500 hover:text-slate-900">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-4 font-medium min-w-[140px] text-center flex items-center gap-2 justify-center text-sm">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              {format(weekStart, "MMM d")} - {format(addDays(weekStart, viewDays - 1), "MMM d, yyyy")}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))} className="h-8 w-8 hover:bg-white text-slate-500 hover:text-slate-900">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center bg-slate-100 rounded-md border border-slate-200 p-0.5">
             <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setViewDays(5)}
                className={cn("h-8 text-xs px-3", viewDays === 5 ? "bg-white shadow-sm text-blue-600 font-medium hover:bg-white" : "text-slate-500 hover:text-slate-900")}
             >
                5 Day
             </Button>
             <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setViewDays(7)}
                className={cn("h-8 text-xs px-3", viewDays === 7 ? "bg-white shadow-sm text-blue-600 font-medium hover:bg-white" : "text-slate-500 hover:text-slate-900")}
             >
                7 Day
             </Button>
          </div>
          <div className="flex items-center bg-slate-100 rounded-md border border-slate-200 p-0.5 mr-2">
             <Button 
                variant="ghost" 
                size="icon" 
                onClick={onUndo}
                disabled={!canUndo}
                className={cn("h-8 w-8", canUndo ? "text-slate-700 hover:bg-white hover:text-slate-900" : "text-slate-300")}
                title="Undo"
             >
                <RotateCcw className="w-4 h-4" />
             </Button>
             <Button 
                variant="ghost" 
                size="icon" 
                onClick={onRedo}
                disabled={!canRedo}
                className={cn("h-8 w-8", canRedo ? "text-slate-700 hover:bg-white hover:text-slate-900" : "text-slate-300")}
                title="Redo"
             >
                <RotateCw className="w-4 h-4" />
             </Button>
          </div>
          <Button variant="outline" onClick={() => setCurrentDate(getCurrentWeekStart())} className="border-slate-200 hover:bg-slate-50 text-slate-600">
            Today
          </Button>

           {/* Availability Search Button */}
           <Button 
              variant="outline" 
              className="ml-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300 shadow-sm transition-all"
              onClick={() => setSmartSearchOpen(true)}
              title="Find earliest availability"
           >
              <Truck className="w-4 h-4 mr-2" /> Check Availability
           </Button>

           {/* Job Search Bar */}
           <div className="relative w-64 ml-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search jobs, people..."
              className="pl-9 h-10 bg-slate-50 border-slate-200 text-slate-800 focus:ring-blue-600 focus:bg-white transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {!isReadOnly ? (
                <Button variant="outline" onClick={() => setResourcesModalOpen(true)} className="bg-white text-slate-700 border-slate-300 hover:bg-slate-50 gap-2">
                    <Settings className="w-4 h-4" /> Manage Resources
                </Button>
            ) : (
                <div className="flex items-center gap-2 text-slate-400 text-sm bg-slate-50 px-3 py-2 rounded-md border border-slate-200">
                    <Lock className="w-3 h-3" /> Read Only View
                </div>
            )}
            {onLogout && (
                <Button 
                    variant="outline" 
                    onClick={onLogout} 
                    className="bg-white text-slate-700 border-slate-300 hover:bg-slate-50 gap-2"
                    title="Logout"
                >
                    <LogOut className="w-4 h-4" /> Logout
                </Button>
            )}
        </div>
      </div>

      {/* Matrix Grid */}
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
        // Disable drag completely if read only
        // Note: DndContext doesn't have a disabled prop, but we handle it in sensors/events
      >
        <div className="flex-1 overflow-auto bg-slate-50 relative">
            <table className="w-full border-collapse table-fixed">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                    <tr>
                        <th className="w-14 p-3 border-b border-r border-slate-200 bg-slate-50 text-center font-semibold text-slate-600 text-sm">
                            <div className="flex items-center justify-center">
                                {!isReadOnly && (
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-6 w-6 p-0 hover:bg-slate-100"
                                        onClick={() => setCrewModal({ isOpen: true, mode: 'create', name: "", shift: 'day' })}
                                        title="Add new crew"
                                    >
                                        <Plus className="w-4 h-4 text-slate-500" />
                                    </Button>
                                )}
                            </div>
                        </th>
                        {weekDays.map((day) => {
                            const isToday = isSameDay(day, new Date());
                            const dateKey = format(day, "yyyy-MM-dd");
                            const status = emailStatus[dateKey];
                            
                            return (
                                <th key={day.toString()} className={cn("p-3 border-b border-r border-slate-200 relative group/header", isToday ? "bg-blue-50/50" : "bg-white")}>
                                    <div className="flex flex-col items-center justify-center">
                                        <div className={cn("text-xs font-medium uppercase tracking-wider", isToday ? "text-blue-600" : "text-slate-500")}>
                                            {format(day, "EEEE")}
                                        </div>
                                        <div className={cn("text-xl font-light mt-0.5", isToday ? "text-blue-700" : "text-slate-700")}>
                                            {format(day, "d")}
                                        </div>
                                        
                                        {/* Email Button */}
                                        <div className="mt-2 w-full flex justify-center">
                                            <Button 
                                                size="sm" 
                                                variant={status?.sent ? "outline" : "destructive"}
                                                className={cn(
                                                    "h-6 text-[10px] px-2 flex items-center gap-1 transition-all",
                                                    status?.sent 
                                                        ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" 
                                                        : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700 shadow-sm opacity-70 group-hover/header:opacity-100"
                                                )}
                                                onClick={() => handleSendDailyEmails(day)}
                                                title={status?.sent ? `Sent at ${status.timestamp}` : "Send daily schedule emails"}
                                            >
                                                {status?.sent ? (
                                                    <>
                                                        <Check className="w-3 h-3" /> Sent {status.timestamp}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Mail className="w-3 h-3" /> Email Schedule
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {/* Night Shift Header */}
                    <tr 
                        className="cursor-pointer hover:bg-slate-50 transition-colors bg-indigo-50/50"
                        onClick={() => setExpandedShifts(prev => ({ ...prev, night: !prev.night }))}
                    >
                        <td colSpan={viewDays + 1} className="p-2 border-b border-slate-200">
                            <div className="flex items-center gap-2 font-semibold text-indigo-900 text-sm">
                                {expandedShifts.night ? <ChevronDown className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                                <Moon className="w-4 h-4 text-indigo-600" />
                                <span>Night Shift</span>
                            </div>
                        </td>
                    </tr>

                    {expandedShifts.night && [...crews]
                        .filter(c => c.shift === 'night')
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((crew) => (
                        <tr key={crew.id} className="group">
                            <td className="p-2 border-b border-r border-slate-200 bg-white font-medium text-slate-700 align-top sticky left-0 z-10 w-14">
                                <div className="flex items-center justify-center h-full group relative">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 cursor-help transition-all hover:ring-2 hover:ring-indigo-200 hover:scale-105">
                                                    <Moon className="w-4 h-4 text-indigo-600" />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="flex flex-col gap-1 z-50">
                                                <p className="font-bold">{crew.name}{crew.archivedAt && <span className="text-amber-500 ml-1">(Archived)</span>}</p>
                                                <p className="text-xs text-slate-400 uppercase">Night Shift</p>
                                                {!isReadOnly && !crew.archivedAt && (
                                                    <div className="flex gap-1 mt-1 pt-1 border-t border-slate-700/50">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-6 px-2 text-xs hover:bg-white/10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCrewModal({ isOpen: true, mode: 'edit', id: crew.id, name: crew.name, shift: crew.shift || 'day' });
                                                            }}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-6 px-2 text-xs hover:bg-red-900/20 text-red-400 hover:text-red-300"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onCrewDelete(crew.id);
                                                            }}
                                                        >
                                                            Archive
                                                        </Button>
                                                    </div>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </td>

                            {weekDays.map((day) => {
                                const dateStr = format(day, "yyyy-MM-dd");
                                const cellId = `${crew.id}|${dateStr}`;
                                const cellItems = filteredItems.filter(i => 
                                    isSameDay(new Date(i.date), day) && 
                                    i.crewId === crew.id
                                );
                                
                                // Sort displayItems to match the visual rendering order (Notes first, then People, then Jobs)
                                const displayItems = [...cellItems].sort((a, b) => {
                                    // Define priority: note = 0, operative/assistant = 1, job = 2
                                    const getPriority = (type: string) => {
                                        if (type === 'note') return 0;
                                        if (type === 'operative' || type === 'assistant') return 1;
                                        if (type === 'job') return 2;
                                        return 3;
                                    };
                                    return getPriority(a.type) - getPriority(b.type);
                                });
                                
                                const peopleItems = displayItems.filter(i => i.type !== 'job' && i.type !== 'note');
                                const noteItems = displayItems.filter(i => i.type === 'note');
                                const jobItems = displayItems.filter(i => i.type === 'job');

                                const isToday = isSameDay(day, new Date());

                                return (
                                    <DroppableCell 
                                        key={cellId}
                                        id={cellId}
                                        disabled={isReadOnly || isBefore(startOfDay(day), today)}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleCellDoubleClick(day, crew.id);
                                        }}
                                        className={cn(
                                            "border-b border-r border-slate-200 align-top p-1.5 transition-colors hover:bg-slate-50",
                                            isReadOnly ? "" : "cursor-pointer",
                                            isToday ? "bg-blue-50/20" : ""
                                        )}
                                        style={{ minHeight: "120px" }}
                                    >
                                        <SortableContext 
                                            id={cellId} 
                                            items={displayItems.map(i => i.id)} 
                                            strategy={rectSortingStrategy}
                                            disabled={isReadOnly}
                                        >
                                            <div className="h-full min-h-[120px] w-full flex flex-col gap-1 min-w-0">
                                                {/* Notes appear first, above crew names */}
                                                {noteItems.map((item) => (
                                                    <NoteCard 
                                                        key={item.id} 
                                                        item={item} 
                                                        onEdit={handleEditItem} 
                                                        onDelete={(id, mode) => handleDeleteItem(id, mode)} 
                                                        onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)} 
                                                        isReadOnly={isReadOnly || isBefore(startOfDay(new Date(item.date)), startOfDay(new Date()))}
                                                        isSelected={selectedItemIds.has(item.id)}
                                                        onToggleSelection={handleToggleSelection}
                                                        selectedItemIds={selectedItemIds}
                                                        onDuplicateSelected={handleDuplicateSelected}
                                                        onDeleteSelected={handleDeleteSelected}
                                                    />
                                                ))}
                                                {/* Crew names (operatives/assistants) appear after notes */}
                                                {peopleItems.length > 0 && (
                                                    <div className={cn(
                                                        "w-full grid gap-1",
                                                        peopleItems.length === 1 ? "grid-cols-1" : "grid-cols-2"
                                                    )}>
                                                        {peopleItems.map((item) => (
                                                            <OperativeCard 
                                                                key={item.id} 
                                                                item={item}
                                                                onEdit={handleEditItem} 
                                                                onDelete={(id, mode) => handleDeleteItem(id, mode)} 
                                                                onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)} 
                                                                employees={employees}
                                                                vehicles={vehicles}
                                                                isReadOnly={isReadOnly || isBefore(startOfDay(new Date(item.date)), startOfDay(new Date()))}
                                                                isSelected={selectedItemIds.has(item.id)}
                                                                onToggleSelection={handleToggleSelection}
                                                                selectedItemIds={selectedItemIds}
                                                                onDuplicateSelected={handleDuplicateSelected}
                                                                onDeleteSelected={handleDeleteSelected}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Jobs appear last */}
                                                {jobItems.map((item) => (
                                                    <SiteCard 
                                                        key={item.id} 
                                                        item={item} 
                                                        onEdit={handleEditItem} 
                                                        onDelete={(id, mode) => handleDeleteItem(id, mode)} 
                                                        onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)} 
                                                        isReadOnly={isReadOnly || isBefore(startOfDay(new Date(item.date)), startOfDay(new Date()))}
                                                        isSelected={selectedItemIds.has(item.id)}
                                                        onToggleSelection={handleToggleSelection}
                                                        selectedItemIds={selectedItemIds}
                                                        onDuplicateSelected={handleDuplicateSelected}
                                                        onDeleteSelected={handleDeleteSelected}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DroppableCell>
                                );
                            })}
                        </tr>
                    ))}

                    {/* Day Shift Header */}
                    <tr 
                        className="cursor-pointer hover:bg-slate-50 transition-colors bg-amber-50/50"
                        onClick={() => setExpandedShifts(prev => ({ ...prev, day: !prev.day }))}
                    >
                        <td colSpan={viewDays + 1} className="p-2 border-b border-slate-200">
                            <div className="flex items-center gap-2 font-semibold text-amber-900 text-sm">
                                {expandedShifts.day ? <ChevronDown className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                                <Sun className="w-4 h-4 text-amber-500" />
                                <span>Day Shift</span>
                            </div>
                        </td>
                    </tr>

                    {expandedShifts.day && [...crews]
                        .filter(c => c.shift !== 'night')
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((crew) => (
                        <tr key={crew.id} className="group">
                            <td className="p-2 border-b border-r border-slate-200 bg-white font-medium text-slate-700 align-top sticky left-0 z-10 w-14">
                                <div className="flex items-center justify-center h-full group relative">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0 cursor-help transition-all hover:ring-2 hover:ring-amber-200 hover:scale-105">
                                                    <Sun className="w-4 h-4 text-amber-500" />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="flex flex-col gap-1 z-50">
                                                <p className="font-bold">{crew.name}{crew.archivedAt && <span className="text-amber-500 ml-1">(Archived)</span>}</p>
                                                <p className="text-xs text-slate-400 uppercase">Day Shift</p>
                                                {!isReadOnly && !crew.archivedAt && (
                                                    <div className="flex gap-1 mt-1 pt-1 border-t border-slate-700/50">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-6 px-2 text-xs hover:bg-white/10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCrewModal({ isOpen: true, mode: 'edit', id: crew.id, name: crew.name, shift: crew.shift || 'day' });
                                                            }}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-6 px-2 text-xs hover:bg-red-900/20 text-red-400 hover:text-red-300"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onCrewDelete(crew.id);
                                                            }}
                                                        >
                                                            Archive
                                                        </Button>
                                                    </div>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </td>

                            {weekDays.map((day) => {
                                const dateStr = format(day, "yyyy-MM-dd");
                                const cellId = `${crew.id}|${dateStr}`;
                                const cellItems = filteredItems.filter(i => 
                                    isSameDay(new Date(i.date), day) && 
                                    i.crewId === crew.id
                                );
                                
                                // Sort displayItems to match the visual rendering order (Notes first, then People, then Jobs)
                                const displayItems = [...cellItems].sort((a, b) => {
                                    // Define priority: note = 0, operative/assistant = 1, job = 2
                                    const getPriority = (type: string) => {
                                        if (type === 'note') return 0;
                                        if (type === 'operative' || type === 'assistant') return 1;
                                        if (type === 'job') return 2;
                                        return 3;
                                    };
                                    return getPriority(a.type) - getPriority(b.type);
                                });
                                
                                const peopleItems = displayItems.filter(i => i.type !== 'job' && i.type !== 'note');
                                const noteItems = displayItems.filter(i => i.type === 'note');
                                const jobItems = displayItems.filter(i => i.type === 'job');

                                const isToday = isSameDay(day, new Date());

                                return (
                                    <DroppableCell 
                                        key={cellId}
                                        id={cellId}
                                        disabled={isReadOnly || isBefore(startOfDay(day), today)}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleCellDoubleClick(day, crew.id);
                                        }}
                                        className={cn(
                                            "border-b border-r border-slate-200 align-top p-1.5 transition-colors hover:bg-slate-50",
                                            isReadOnly ? "" : "cursor-pointer",
                                            isToday ? "bg-blue-50/20" : ""
                                        )}
                                        style={{ minHeight: "120px" }}
                                    >
                                        <SortableContext 
                                            id={cellId} 
                                            items={displayItems.map(i => i.id)} 
                                            strategy={rectSortingStrategy}
                                            disabled={isReadOnly}
                                        >
                                            <div className="h-full min-h-[120px] w-full flex flex-col gap-1 min-w-0">
                                                {/* Notes appear first, above crew names */}
                                                {noteItems.map((item) => (
                                                    <NoteCard 
                                                        key={item.id} 
                                                        item={item} 
                                                        onEdit={handleEditItem} 
                                                        onDelete={(id, mode) => handleDeleteItem(id, mode)} 
                                                        onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)} 
                                                        isReadOnly={isReadOnly || isBefore(startOfDay(new Date(item.date)), startOfDay(new Date()))}
                                                        isSelected={selectedItemIds.has(item.id)}
                                                        onToggleSelection={handleToggleSelection}
                                                        selectedItemIds={selectedItemIds}
                                                        onDuplicateSelected={handleDuplicateSelected}
                                                        onDeleteSelected={handleDeleteSelected}
                                                    />
                                                ))}
                                                {/* Crew names (operatives/assistants) appear after notes */}
                                                {peopleItems.length > 0 && (
                                                    <div className={cn(
                                                        "w-full grid gap-1",
                                                        peopleItems.length === 1 ? "grid-cols-1" : "grid-cols-2"
                                                    )}>
                                                        {peopleItems.map((item) => (
                                                            <OperativeCard 
                                                                key={item.id} 
                                                                item={item}
                                                                onEdit={handleEditItem} 
                                                                onDelete={(id, mode) => handleDeleteItem(id, mode)} 
                                                                onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)} 
                                                                employees={employees}
                                                                vehicles={vehicles}
                                                                isReadOnly={isReadOnly || isBefore(startOfDay(new Date(item.date)), startOfDay(new Date()))}
                                                                isSelected={selectedItemIds.has(item.id)}
                                                                onToggleSelection={handleToggleSelection}
                                                                selectedItemIds={selectedItemIds}
                                                                onDuplicateSelected={handleDuplicateSelected}
                                                                onDeleteSelected={handleDeleteSelected}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Jobs appear last */}
                                                {jobItems.map((item) => (
                                                    <SiteCard 
                                                        key={item.id} 
                                                        item={item} 
                                                        onEdit={handleEditItem} 
                                                        onDelete={(id, mode) => handleDeleteItem(id, mode)} 
                                                        onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)} 
                                                        isReadOnly={isReadOnly || isBefore(startOfDay(new Date(item.date)), startOfDay(new Date()))}
                                                        isSelected={selectedItemIds.has(item.id)}
                                                        onToggleSelection={handleToggleSelection}
                                                        selectedItemIds={selectedItemIds}
                                                        onDuplicateSelected={handleDuplicateSelected}
                                                        onDeleteSelected={handleDeleteSelected}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DroppableCell>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <DragOverlay>
          {activeItem ? (
             activeItem.type === 'job' ? (
                <div className="w-[200px] opacity-90 rotate-2 cursor-grabbing shadow-xl">
                    <SiteCard 
                        item={activeItem} 
                        onEdit={() => {}} 
                        onDelete={() => {}} 
                        onDuplicate={() => {}} 
                    />
                </div>
             ) : (
                <div className="opacity-90 rotate-2 cursor-grabbing shadow-xl">
                    <OperativeCard 
                        item={activeItem} 
                        onEdit={() => {}} 
                        onDelete={() => {}} 
                        onDuplicate={() => {}} 
                        employees={employees}
                        vehicles={vehicles}
                    />
                </div>
             )
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Selection Menu Modal */}
      <Dialog open={!!selectionMenu} onOpenChange={(open) => !open && setSelectionMenu(null)}>
        <DialogContent className="sm:max-w-[400px] bg-white text-slate-900">
            <DialogHeader>
                <DialogTitle>Add Item to Schedule</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
                <Button 
                    onClick={() => {
                        console.log("🔐 Add Operative clicked, isReadOnly:", isReadOnly);
                        handleSelection('operative');
                    }} 
                    disabled={isReadOnly}
                    className="justify-start h-12 text-lg bg-slate-50 text-black hover:bg-slate-100 border border-slate-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <User className="mr-3 w-5 h-5" /> Add Operative
                </Button>
                <Button 
                    onClick={() => {
                        console.log("🔐 Add Assistant clicked, isReadOnly:", isReadOnly);
                        handleSelection('assistant');
                    }} 
                    disabled={isReadOnly}
                    className="justify-start h-12 text-lg bg-amber-50 text-black hover:bg-amber-100 border border-amber-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <UserPlus className="mr-3 w-5 h-5" /> Add Assistant
                </Button>
                <Button 
                    onClick={() => {
                        console.log("🔐 Add Note clicked, isReadOnly:", isReadOnly);
                        handleSelection('note');
                    }} 
                    disabled={isReadOnly}
                    className="justify-start h-12 text-lg bg-red-50 text-black hover:bg-red-100 border border-red-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <FileText className="mr-3 w-5 h-5" /> Add Note
                </Button>
                <Button 
                    onClick={() => {
                        console.log("🔐 Add Job clicked, isReadOnly:", isReadOnly);
                        handleSelection('job');
                    }} 
                    disabled={isReadOnly}
                    className="justify-start h-12 text-lg bg-blue-50 text-black hover:bg-blue-100 border border-blue-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Briefcase className="mr-3 w-5 h-5" /> Add Site / Job
                </Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* Grouping Dialog */}
      {groupingDialog && (
        <GroupingDialog
          open={groupingDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setGroupingDialog(null);
            }
          }}
          onConfirm={groupingDialog.onConfirm}
          itemType={groupingDialog.type}
          groupCount={groupingDialog.groupCount}
        />
      )}

      {/* Item Editor Modal */}
      <ItemModal 
        open={modalState.isOpen} 
        onOpenChange={(isOpen) => setModalState(prev => ({ ...prev, isOpen }))}
        onSubmit={handleModalSubmit}
        type={modalState.type}
        initialData={modalState.data || (modalState.target ? { date: modalState.target.date, crewId: modalState.target.crewId } : undefined)}
        employees={employees}
        vehicles={vehicles}
        items={items} // Pass items for conflict detection
        crews={crews} // Pass crews for validating assignments
        colorLabels={colorLabels}
        onColorLabelUpdate={onColorLabelUpdate}
      />

      {/* Crew Modal */}
      <Dialog open={crewModal.isOpen} onOpenChange={(open) => setCrewModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-[425px] bg-white text-slate-900">
            <DialogHeader>
                <DialogTitle>{crewModal.mode === 'create' ? 'Add New Crew' : 'Edit Crew'}</DialogTitle>
            </DialogHeader>
            
            {crewModal.mode === 'create' ? (
               <div className="py-4 flex gap-4">
                  <Button 
                    onClick={() => onCrewCreate(
                       (() => {
                           const prefix = "Day";
                           const count = crews.filter(c => c.shift === 'day' || !c.name.toLowerCase().includes("night")).length;
                           return `${prefix} ${count + 1}`;
                       })(), 
                       'day'
                    )} 
                    className="flex-1 h-24 flex flex-col gap-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                  >
                    <Sun className="w-8 h-8" />
                    <span className="font-semibold text-lg">Add Day Crew</span>
                  </Button>
                  
                  <Button 
                    onClick={() => onCrewCreate(
                       (() => {
                           const prefix = "Night";
                           const count = crews.filter(c => c.shift === 'night' || c.name.toLowerCase().includes("night")).length;
                           return `${prefix} ${count + 1}`;
                       })(), 
                       'night'
                    )}
                    className="flex-1 h-24 flex flex-col gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                  >
                    <Moon className="w-8 h-8" />
                    <span className="font-semibold text-lg">Add Night Crew</span>
                  </Button>
               </div>
            ) : (
                <>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={crewModal.name} onChange={(e) => setCrewModal(prev => ({ ...prev, name: e.target.value }))} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="shift" className="text-right">Shift</Label>
                            <Select 
                                value={crewModal.shift} 
                                onValueChange={(val) => setCrewModal(prev => ({ ...prev, shift: val as 'day' | 'night' }))}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select shift type" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="day">Day Shift</SelectItem>
                                    <SelectItem value="night">Night Shift</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setCrewModal(prev => ({ ...prev, isOpen: false }))}>Cancel</Button>
                        <Button type="submit" onClick={handleCrewSubmit} className="bg-blue-600 text-white hover:bg-blue-700">
                            Save Changes
                        </Button>
                    </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>

      {/* Resources Manager Modal */}
      <ResourcesModal 
        open={resourcesModalOpen} 
        onOpenChange={setResourcesModalOpen}
        employees={employees}
        vehicles={vehicles}
        onEmployeeCreate={onEmployeeCreate}
        onEmployeeUpdate={onEmployeeUpdate}
        onEmployeeDelete={onEmployeeDelete}
        onVehicleCreate={onVehicleCreate}
        onVehicleUpdate={onVehicleUpdate}
        onVehicleDelete={onVehicleDelete}
      />

      {/* Smart Search Modal */}
      <SmartSearchModal 
        open={smartSearchOpen}
        onOpenChange={setSmartSearchOpen}
        items={allItems}
        crews={allCrews || crews}
        depots={depots}
        vehicles={vehicles}
        vehicleTypes={vehicleTypes}
        colorLabels={colorLabels}
        onBookSlot={(date, crewId, depotId, duration, color) => {
            onItemCreate({
                id: Math.random().toString(36).substr(2, 9),
                type: 'job',
                date: date,
                crewId: crewId,
                depotId: depotId,
                duration: duration,
                color: color,
                customer: "New Booking",
                address: "TBC",
                startTime: "08:00",
                onsiteTime: "09:00"
            });
        }}
      />

      {/* Email Preview Modal */}
      {emailModalDate && (
          <EmailPreviewModal
            open={emailModalOpen}
            onOpenChange={setEmailModalOpen}
            date={emailModalDate}
            items={items}
            employees={employees.map(e => ({...e, jobRole: e.jobRole || 'operative'}))} // Normalize role just in case
            onUpdateEmail={(id, email) => onEmployeeUpdate(id, employees.find(e => e.id === id)?.name || "Unknown", undefined, undefined, email)}
            onSend={handleEmailSent}
          />
      )}
    </div>
  );
}
