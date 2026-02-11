import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, isSameDay, endOfWeek, isAfter, isBefore, startOfDay, endOfMonth, addMonths, endOfYear, getDay } from "date-fns";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { EmployeeTimeOffDialog, EmployeeTimeOffDialogPayload } from "./EmployeeTimeOffDialog";
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

    // Job Status (free/booked/cancelled) - separate from approval status
    jobStatus?: 'free' | 'booked' | 'cancelled';

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

const isFreeJobItem = (item: ScheduleItem) =>
  item.type === "job" &&
  (item.jobStatus === "free" || item.customer === "Free");

function getGhostVehicleLabelForCell(
  peopleItems: ScheduleItem[],
  vehicles: { id: string; name: string; status: 'active' | 'off_road' | 'maintenance'; vehicleType: string; category?: string; color?: string }[]
): string | undefined {
  const vehicleIds = Array.from(
    new Set(
      peopleItems
        .map((p) => p.vehicleId)
        .filter((id): id is string => Boolean(id))
    )
  );
  if (vehicleIds.length === 0) return undefined;

  const cellVehicles = vehicles.filter((v) => vehicleIds.includes(v.id));
  if (cellVehicles.length === 0) return undefined;

  const normalize = (value?: string) =>
    (value || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "").replace(/\//g, "");

  const isCctv = (v: (typeof cellVehicles)[number]) => {
    const cat = normalize(v.category);
    const type = normalize(v.vehicleType);
    // Check for "cctv" in normalized category/type (handles "CCTV", "CCTV/Van", "CCTV/Van Pack", etc.)
    return cat.includes("cctv") || type.includes("cctv");
  };

  const isJetVac = (v: (typeof cellVehicles)[number]) => {
    const cat = normalize(v.category);
    const type = normalize(v.vehicleType);
    return cat.includes("jet") || type.includes("jet");
  };

  const hasCctv = cellVehicles.some(isCctv);
  const hasJetVac = cellVehicles.some(isJetVac);

  if (hasCctv && hasJetVac) return "CCTV/Jet Vac";
  if (hasCctv) return "CCTV";
  if (hasJetVac) return "Jet Vac";

  const first = cellVehicles[0];
  return first.vehicleType || first.category || undefined;
}

interface CalendarGridProps {
  items: ScheduleItem[];
  crews: Crew[];
  employees: { id: string; name: string; status: 'active' | 'holiday' | 'sick'; email?: string; jobRole?: 'operative' | 'assistant' }[];
  vehicles: { id: string; name: string; status: 'active' | 'off_road' | 'maintenance'; vehicleType: string; category?: string; color?: string }[];
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
  onVehicleUpdate: (id: string, name: string, status?: 'active' | 'off_road' | 'maintenance', category?: string, color?: string) => void;
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
  // Per-cell manual ordering for items (so users can shuffle people left/right without backend support)
  const [cellItemOrder, setCellItemOrder] = useState<Record<string, string[]>>({});
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

  const [employeeTimeOffModal, setEmployeeTimeOffModal] = useState<{
    open: boolean;
    employeeId: string | null;
    employeeName: string;
    defaultDate: Date | null;
  }>({
    open: false,
    employeeId: null,
    employeeName: "",
    defaultDate: null,
  });
  
  const [crewModal, setCrewModal] = useState<{ isOpen: boolean, mode: 'create' | 'edit', id?: string, name: string, shift: 'day' | 'night' }>({ isOpen: false, mode: 'create', name: "", shift: 'day' });

  // Removed auto-generate name useEffect - create mode is no longer used (users use + button directly)
  
  const [resourcesModalOpen, setResourcesModalOpen] = useState(false);
  const [smartSearchOpen, setSmartSearchOpen] = useState(false);
  const [expandedShifts, setExpandedShifts] = useState<{ night: boolean, day: boolean }>({ night: true, day: true });
  
  // Ensure shifts are always expanded by default when crews exist
  useEffect(() => {
    const nightCrews = crews.filter(c => c.shift === 'night');
    const dayCrews = crews.filter(c => c.shift !== 'night');
    
    // If there are crews but shifts are collapsed, expand them
    setExpandedShifts(prev => {
      const updates: Partial<{ night: boolean; day: boolean }> = {};
      if (nightCrews.length > 0 && !prev.night) {
        updates.night = true;
      }
      if (dayCrews.length > 0 && !prev.day) {
        updates.day = true;
      }
      // Always ensure at least one row is visible - if no crews exist, still expand
      if (nightCrews.length === 0 && !prev.night) {
        updates.night = true;
      }
      if (dayCrews.length === 0 && !prev.day) {
        updates.day = true;
      }
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, [crews]);
  
  // Grouping dialog state
  const [groupingDialog, setGroupingDialog] = useState<{
    open: boolean;
    type: 'delete' | 'color';
    itemId: string;
    groupCount: number;
    onConfirm: (applyToGroup: boolean) => void;
  } | null>(null);

  const [crewDeleteDialog, setCrewDeleteDialog] = useState<{
    open: boolean;
    crewId: string;
    crewName: string;
    hasPastItems: boolean;
    hasFutureItems: boolean;
    futureItemsCount: number;
    futureItems: Array<{ type: string; date: string; displayDate: string; customer?: string; employeeId?: string }>;
    previousCrewId: string | null;
    onConfirm: (moveItemsUp: boolean) => void;
  } | null>(null);

  const [crewDeleteErrorDialog, setCrewDeleteErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
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
                 // Reorder within same cell – store order locally per cell
                 const cellKey = `${targetCrewId}|${targetDateStr}`;
                 setCellItemOrder((prev) => {
                   const cellItems = items.filter(
                     (i) =>
                       i.crewId === targetCrewId &&
                       isSameDay(new Date(i.date), newDate)
                   );
                   const baseOrder =
                     prev[cellKey] && prev[cellKey].length
                       ? prev[cellKey]
                       : cellItems.map((i) => i.id);
                   const fromId = active.id as string;
                   const toId = over.id as string;
                   const fromIndex = baseOrder.indexOf(fromId);
                   const toIndex = baseOrder.indexOf(toId);
                   if (fromIndex === -1 || toIndex === -1) return prev;
                   const nextOrder = [...baseOrder];
                   nextOrder.splice(fromIndex, 1);
                   nextOrder.splice(toIndex, 0, fromId);
                   return { ...prev, [cellKey]: nextOrder };
                 });
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
    if (!selectionMenu) return;

    // Never allow creating items in the past
    if (isBefore(startOfDay(selectionMenu.date), startOfDay(new Date()))) return;

    // For jobs we ONLY want to drop a "ghost" / free box on the diary.
    // The full site UI (Convert Free Job to Booking) is used later when editing that box.
    if (type === 'job') {
      const baseItem: ScheduleItem = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'job',
        date: selectionMenu.date,
        crewId: selectionMenu.crewId,
        // depotId is intentionally left blank; parent handler will inject selected depot
        depotId: "",
        jobStatus: 'free',
        customer: 'Free',
        address: 'Free',
        startTime: '08:00',
        onsiteTime: '09:00',
        duration: 8,
        color: 'blue',
      };

      onItemCreate(baseItem);
      setSelectionMenu(null);
      return;
    }

    // For operatives, assistants, and notes we still open the detailed modal
    setModalState({
      isOpen: true,
      type,
      target: { date: selectionMenu.date, crewId: selectionMenu.crewId },
    });
    setSelectionMenu(null);
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

  const handleCrewDeleteWithValidation = (crewId: string, shift: 'day' | 'night', currentIndex: number) => {
    if (isReadOnly) return;
    
    const crew = crews.find(c => c.id === crewId);
    if (!crew) return;
    
    // Use the week being viewed in the calendar, not today's week
    const viewedWeekStart = weekStart; // This is the start of the week being displayed
    const viewedWeekEnd = addDays(viewedWeekStart, viewDays - 1); // End of the viewed week
    const nextWeekStart = addDays(viewedWeekEnd, 1); // Start of the week after the viewed week
    
    // Only check operatives, assistants, and jobs - notes don't prevent deletion
    // CRITICAL: Only check items in FUTURE weeks (after viewed week ends)
    // Items from the viewed week or past weeks should NEVER be moved or deleted
    const viewedWeekEndDay = startOfDay(viewedWeekEnd);
    const nextWeekStartDay = startOfDay(nextWeekStart);
    
    const crewItems = items.filter(item => {
      if (item.crewId !== crewId) return false;
      if (item.type !== 'operative' && item.type !== 'assistant' && item.type !== 'job') return false;
      
      const itemDate = startOfDay(new Date(item.date));
      const viewedWeekStartDay = startOfDay(viewedWeekStart);
      
      // CRITICAL: Only include items that are STRICTLY AFTER the viewed week ends
      // Items from the viewed week (viewedWeekStart to viewedWeekEnd) should NOT be included
      // Items from past weeks should NOT be included
      // Only items on or after nextWeekStart (the day after viewedWeekEnd) should be included
      
      // EXPLICIT EXCLUSION: Items from viewed week or before are NEVER included
      // Check if item is in the viewed week (including viewedWeekEnd)
      const isInViewedWeek = (isAfter(itemDate, viewedWeekStartDay) || isSameDay(itemDate, viewedWeekStartDay)) && 
                            (isBefore(itemDate, viewedWeekEndDay) || isSameDay(itemDate, viewedWeekEndDay));
      
      // Check if item is before viewed week
      const isBeforeViewedWeek = isBefore(itemDate, viewedWeekStartDay);
      
      // CRITICAL: If item is in viewed week OR before viewed week, EXCLUDE it
      if (isInViewedWeek || isBeforeViewedWeek) {
        // This item is from the viewed week or a past week - EXCLUDE it
        return false;
      }
      
      // Only include items that are strictly after viewedWeekEnd (not including viewedWeekEnd itself)
      // OR on nextWeekStart (the day after viewedWeekEnd)
      const isStrictlyAfterViewedWeek = isAfter(itemDate, viewedWeekEndDay);
      const isOnNextWeekStart = isSameDay(itemDate, nextWeekStartDay);
      
      // Final check: item must be on or after nextWeekStart
      const isOnOrAfterNextWeekStart = !isBefore(itemDate, nextWeekStartDay);
      
      return (isStrictlyAfterViewedWeek || isOnNextWeekStart) && isOnOrAfterNextWeekStart;
    });
    
    // Future items are items in future weeks (after viewed week)
    const futureItems = crewItems;
    
    // Debug logging with explicit date checks
    const allCrewItems = items.filter(i => i.crewId === crewId);
    const viewedWeekStartDay = startOfDay(viewedWeekStart);
    const allCrewItemDates = allCrewItems.map(i => {
      const itemDate = startOfDay(new Date(i.date));
      const isInViewedWeek = !isBefore(itemDate, viewedWeekStartDay) && !isAfter(itemDate, viewedWeekEndDay);
      const isBeforeViewedWeek = isBefore(itemDate, viewedWeekStartDay);
      const isAfterViewedWeek = isAfter(itemDate, viewedWeekEndDay);
      const isOnNextWeekStart = isSameDay(itemDate, nextWeekStartDay);
      const includedInValidation = crewItems.some(ci => ci.id === i.id);
      
      return {
        type: i.type,
        date: format(new Date(i.date), 'yyyy-MM-dd'),
        dateObj: format(itemDate, 'yyyy-MM-dd'), // Convert to string for logging
        isInViewedWeek,
        isBeforeViewedWeek,
        isAfterViewedWeek,
        isOnNextWeekStart,
        includedInValidation,
        shouldBeExcluded: isInViewedWeek || isBeforeViewedWeek
      };
    });
    
    // Check for violations - items from current week should NEVER be included
    const violations = allCrewItemDates.filter(item => 
      (item.isInViewedWeek || item.isBeforeViewedWeek) && item.includedInValidation
    );
    
    if (violations.length > 0) {
      console.error('🚨 DATA PRESERVATION VIOLATION: Items from current/past weeks are in validation:', violations);
    }
    
    console.log('🔍 Crew Delete Validation - DETAILED:', {
      crewId,
      crewName: crew.name,
      viewedWeekStart: format(viewedWeekStartDay, 'yyyy-MM-dd'),
      viewedWeekEnd: format(viewedWeekEndDay, 'yyyy-MM-dd'),
      nextWeekStart: format(nextWeekStartDay, 'yyyy-MM-dd'),
      viewDays,
      totalCrewItems: crewItems.length,
      futureItems: futureItems.length,
      futureItemDates: futureItems.map(i => format(new Date(i.date), 'yyyy-MM-dd')),
      allCrewItems: allCrewItemDates,
      violations: violations.length,
      warning: 'Items from viewed week or past weeks should NOT be in futureItems',
      // Add explicit date comparisons for debugging
      dateComparisons: allCrewItems.map(i => {
        const itemDate = startOfDay(new Date(i.date));
        return {
          date: format(new Date(i.date), 'yyyy-MM-dd'),
          isAfterViewedWeekEnd: isAfter(itemDate, viewedWeekEndDay),
          isBeforeViewedWeekEnd: isBefore(itemDate, viewedWeekEndDay),
          isSameAsViewedWeekEnd: isSameDay(itemDate, viewedWeekEndDay),
          isOnOrAfterNextWeekStart: !isBefore(itemDate, nextWeekStartDay),
          shouldBeIncluded: crewItems.some(ci => ci.id === i.id)
        };
      })
    });
    
    // If there are items in future weeks (after viewed week), ask if user wants to move them up
    if (futureItems.length > 0) {
      // Find the previous crew in the same shift (keep original order, don't sort)
      const sameShiftCrews = crews
        .filter(c => (c.shift === shift || (shift === 'night' ? c.shift === 'night' : c.shift !== 'night')));
      
      const currentCrewIndex = sameShiftCrews.findIndex(c => c.id === crewId);
      const previousCrew = currentCrewIndex > 0 ? sameShiftCrews[currentCrewIndex - 1] : null;
      
      if (!previousCrew) {
        setCrewDeleteErrorDialog({
          open: true,
          title: "Cannot Delete Crew",
          message: `This crew has ${futureItems.length} scheduled item(s) in future weeks, and there is no previous crew to move them to.`
        });
        return;
      }
      
      // Prepare future items details for display
      const futureItemsDetails = futureItems.map(item => {
        let displayName = '';
        if (item.type === 'job') {
          displayName = item.customer || 'Job';
        } else if (item.type === 'operative' || item.type === 'assistant') {
          const employee = employees.find(e => e.id === item.employeeId);
          displayName = employee?.name || item.employeeId || item.type;
        } else {
          displayName = item.type;
        }
        
        return {
          type: item.type,
          date: format(new Date(item.date), 'yyyy-MM-dd'),
          displayDate: format(new Date(item.date), 'EEE, MMM d'),
          customer: displayName
        };
      });
      
      setCrewDeleteDialog({
        open: true,
        crewId,
        crewName: crew.name,
        hasPastItems: false,
        hasFutureItems: true,
        futureItemsCount: futureItems.length,
        futureItems: futureItemsDetails,
        previousCrewId: previousCrew.id,
        onConfirm: (moveItemsUp: boolean) => {
          if (moveItemsUp) {
            // Only move future items (after viewed week) to the previous crew
            // futureItems already contains only items after viewedWeekEnd
            // CRITICAL SAFEGUARD: Triple-check to ensure we NEVER move items from current week or past weeks
            const viewedWeekStartDay = startOfDay(viewedWeekStart);
            const viewedWeekEndDay = startOfDay(viewedWeekEnd);
            const nextWeekStartDay = startOfDay(nextWeekStart);
            
            // FIRST: Check if ANY items in futureItems are from current/past weeks (this should never happen)
            const invalidItems = futureItems.filter(item => {
              const itemDate = startOfDay(new Date(item.date));
              const isInViewedWeek = (isAfter(itemDate, viewedWeekStartDay) || isSameDay(itemDate, viewedWeekStartDay)) && 
                                    (isBefore(itemDate, viewedWeekEndDay) || isSameDay(itemDate, viewedWeekEndDay));
              const isBeforeViewedWeek = isBefore(itemDate, viewedWeekStartDay);
              const isOnOrBeforeViewedWeekEnd = isBefore(itemDate, viewedWeekEndDay) || isSameDay(itemDate, viewedWeekEndDay);
              return isInViewedWeek || isBeforeViewedWeek || isOnOrBeforeViewedWeekEnd;
            });
            
            if (invalidItems.length > 0) {
              console.error('🚨 CRITICAL ERROR: futureItems contains items from current/past weeks! This should never happen:', {
                invalidItems: invalidItems.map(i => ({
                  id: i.id,
                  date: format(new Date(i.date), 'yyyy-MM-dd'),
                  type: i.type
                })),
                viewedWeekStart: format(viewedWeekStartDay, 'yyyy-MM-dd'),
                viewedWeekEnd: format(viewedWeekEndDay, 'yyyy-MM-dd'),
                message: 'BLOCKING ALL ITEM MOVES - Items remain with archived crew'
              });
              // DO NOT MOVE ANY ITEMS - there's a bug in the validation
              onCrewDelete(crewId);
              setCrewDeleteDialog(null);
              return;
            }
            
            const itemsToMove = futureItems.filter(item => {
              const itemDate = startOfDay(new Date(item.date));
              
              // CRITICAL SAFEGUARDS: Only move items that are STRICTLY AFTER the viewed week ends
              // This ensures items from the viewed week (viewedWeekStart to viewedWeekEnd) are NOT moved
              // This ensures items from past weeks are NOT moved
              
              // SAFETY CHECK 1: Check if item is in the viewed week (including viewedWeekEnd)
              const isInViewedWeek = (isAfter(itemDate, viewedWeekStartDay) || isSameDay(itemDate, viewedWeekStartDay)) && 
                                    (isBefore(itemDate, viewedWeekEndDay) || isSameDay(itemDate, viewedWeekEndDay));
              
              // SAFETY CHECK 2: Check if item is before viewed week
              const isBeforeViewedWeek = isBefore(itemDate, viewedWeekStartDay);
              
              // SAFETY CHECK 3: Item must be strictly after viewedWeekEnd (not including viewedWeekEnd)
              const isStrictlyAfterViewedWeek = isAfter(itemDate, viewedWeekEndDay);
              
              // SAFETY CHECK 4: Item can be on nextWeekStart (the day after viewedWeekEnd)
              const isOnNextWeekStart = isSameDay(itemDate, nextWeekStartDay);
              
              // SAFETY CHECK 5: Double-check - item must be on or after nextWeekStart
              const isOnOrAfterNextWeekStart = !isBefore(itemDate, nextWeekStartDay);
              
              // CRITICAL: If item is in viewed week OR before viewed week, BLOCK it
              if (isInViewedWeek || isBeforeViewedWeek) {
                console.error('🚨 BLOCKED: Attempted to move item from viewed/past week - DATA PRESERVATION VIOLATION:', {
                  itemId: item.id,
                  itemDate: format(itemDate, 'yyyy-MM-dd'),
                  viewedWeekStart: format(viewedWeekStartDay, 'yyyy-MM-dd'),
                  viewedWeekEnd: format(viewedWeekEndDay, 'yyyy-MM-dd'),
                  nextWeekStart: format(nextWeekStartDay, 'yyyy-MM-dd'),
                  type: item.type,
                  isInViewedWeek,
                  isBeforeViewedWeek,
                  message: 'This item will NOT be moved - it remains in the database associated with the archived crew'
                });
                return false;
              }
              
              if (!isOnOrAfterNextWeekStart) {
                console.error('🚨 BLOCKED: Item is before nextWeekStart - DATA PRESERVATION VIOLATION:', {
                  itemId: item.id,
                  itemDate: format(itemDate, 'yyyy-MM-dd'),
                  nextWeekStart: format(nextWeekStartDay, 'yyyy-MM-dd'),
                  type: item.type
                });
                return false;
              }
              
              // Only return true if item is strictly after viewedWeekEnd OR on nextWeekStart
              return (isStrictlyAfterViewedWeek || isOnNextWeekStart) && isOnOrAfterNextWeekStart;
            });
            
            // FINAL SAFETY CHECK: Verify no items from current/past weeks are being moved
            // This is the LAST line of defense - even if validation passed, we double-check here
            const itemsFromCurrentOrPastWeek = itemsToMove.filter(item => {
              const itemDate = startOfDay(new Date(item.date));
              
              // Explicit check: Is item in the viewed week?
              const isInViewedWeek = (isAfter(itemDate, viewedWeekStartDay) || isSameDay(itemDate, viewedWeekStartDay)) && 
                                    (isBefore(itemDate, viewedWeekEndDay) || isSameDay(itemDate, viewedWeekEndDay));
              
              // Explicit check: Is item before viewed week?
              const isBeforeViewedWeek = isBefore(itemDate, viewedWeekStartDay);
              
              // Explicit check: Is item on or before viewedWeekEnd?
              const isOnOrBeforeViewedWeekEnd = isBefore(itemDate, viewedWeekEndDay) || isSameDay(itemDate, viewedWeekEndDay);
              
              // If ANY of these are true, the item should NOT be moved
              return isInViewedWeek || isBeforeViewedWeek || isOnOrBeforeViewedWeekEnd;
            });
            
            if (itemsFromCurrentOrPastWeek.length > 0) {
              console.error('🚨 CRITICAL: Attempted to move items from current/past weeks - BLOCKING ALL:', {
                items: itemsFromCurrentOrPastWeek.map(i => ({
                  id: i.id,
                  date: format(new Date(i.date), 'yyyy-MM-dd'),
                  type: i.type
                })),
                viewedWeekStart: format(viewedWeekStartDay, 'yyyy-MM-dd'),
                viewedWeekEnd: format(viewedWeekEndDay, 'yyyy-MM-dd'),
                nextWeekStart: format(nextWeekStartDay, 'yyyy-MM-dd'),
                message: 'These items will NOT be moved - they remain in the database associated with the archived crew'
              });
              
              // DO NOT MOVE ANY ITEMS FROM CURRENT/PAST WEEKS
              // Only move items that are TRULY in future weeks (strictly after viewedWeekEnd)
              const safeItemsToMove = itemsToMove.filter(item => {
                const itemDate = startOfDay(new Date(item.date));
                
                // Item must be strictly after viewedWeekEnd (not including viewedWeekEnd)
                const isStrictlyAfterViewedWeekEnd = isAfter(itemDate, viewedWeekEndDay);
                
                // Item can be on nextWeekStart
                const isOnNextWeekStart = isSameDay(itemDate, nextWeekStartDay);
                
                // Final check: item must be on or after nextWeekStart
                const isOnOrAfterNextWeekStart = !isBefore(itemDate, nextWeekStartDay);
                
                return (isStrictlyAfterViewedWeekEnd || isOnNextWeekStart) && isOnOrAfterNextWeekStart;
              });
              
              console.log('✅ Moving only safe items (future weeks only):', {
                originalCount: itemsToMove.length,
                safeCount: safeItemsToMove.length,
                blockedCount: itemsFromCurrentOrPastWeek.length,
                blockedItems: itemsFromCurrentOrPastWeek.map(i => format(new Date(i.date), 'yyyy-MM-dd')),
                safeItems: safeItemsToMove.map(i => format(new Date(i.date), 'yyyy-MM-dd'))
              });
              
              // Only move the safe items
              safeItemsToMove.forEach(item => {
                onItemUpdate({ ...item, crewId: previousCrew.id });
              });
            } else {
              // Log what we're moving for debugging
              console.log('✅ Moving items to previous crew (all items verified as future weeks):', {
                totalFutureItems: futureItems.length,
                itemsToMove: itemsToMove.length,
                viewedWeekStart: format(viewedWeekStartDay, 'yyyy-MM-dd'),
                viewedWeekEnd: format(viewedWeekEndDay, 'yyyy-MM-dd'),
                nextWeekStart: format(nextWeekStartDay, 'yyyy-MM-dd'),
                itemsBeingMoved: itemsToMove.map(i => ({
                  id: i.id,
                  date: format(new Date(i.date), 'yyyy-MM-dd'),
                  type: i.type
                }))
              });
              
              itemsToMove.forEach(item => {
                onItemUpdate({ ...item, crewId: previousCrew.id });
              });
            }
          }
          // CRITICAL: Delete the crew (this only archives it - items remain in database)
          // The backend archiveCrew function ONLY sets archivedAt - it does NOT delete any schedule items
          // All items remain in the database:
          // - Items from past weeks: Preserved in database, associated with archived crew
          // - Items from current week: Preserved in database, associated with archived crew  
          // - Items from future weeks: Moved to previous crew (if user confirmed) OR preserved with archived crew
          // 
          // The database schema has onDelete: "cascade", but since we archive (not delete) the crew,
          // the cascade does NOT trigger. All historical and current data is preserved.
          onCrewDelete(crewId);
          setCrewDeleteDialog(null);
        }
      });
      return;
    }
    
    // No future items, safe to delete (archive) the crew
    // CRITICAL: This only archives the crew - all items remain in the database
    // Items from current week and past weeks are preserved and associated with the archived crew
    onCrewDelete(crewId);
  };

  const handleOpenEmployeeTimeOff = (item: ScheduleItem) => {
    if (!item.employeeId) return;
    const employee = employees.find((e) => e.id === item.employeeId);
    if (!employee) return;

    setEmployeeTimeOffModal({
      open: true,
      employeeId: employee.id,
      employeeName: employee.name,
      defaultDate: new Date(item.date),
    });
  };

  const handleEmployeeTimeOffApplied = (payload: EmployeeTimeOffDialogPayload) => {
    if (!employeeTimeOffModal.employeeId) return;

    const employeeId = employeeTimeOffModal.employeeId;
    const today = startOfDay(new Date());
    const start = startOfDay(payload.startDate);
    const end = startOfDay(payload.endDate);

    items.forEach((item) => {
      if (item.employeeId !== employeeId) return;
      if (item.type !== "operative" && item.type !== "assistant") return;

      const itemDate = startOfDay(new Date(item.date));

      // Never touch past days
      if (isBefore(itemDate, today)) return;

      const inRange =
        (isSameDay(itemDate, start) || isAfter(itemDate, start)) &&
        (isSameDay(itemDate, end) || isBefore(itemDate, end));

      if (inRange) {
        onItemDelete(item.id);
      }
    });
  };

  const handleEditItem = (item: ScheduleItem) => {
    const itemDate = startOfDay(new Date(item.date));
    const today = startOfDay(new Date());
    const isPast = isBefore(itemDate, today);
    
    // In read-only mode, only allow editing past jobs (for job status updates)
    if (isReadOnly) {
      if (!isPast || item.type !== 'job') {
        return; // Don't allow editing non-past items or non-jobs in read-only mode
      }
      // Allow editing past jobs in read-only mode (for job status only)
    } else {
      // In normal mode, allow editing past items only if it's a job (for color changes)
      if (isPast && item.type !== 'job') {
        return;
      }
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

  const handleMoveDate = (newDate: Date, moveGroup: boolean) => {
    if (!modalState.data?.id) return;
    
    const itemToMove = items.find(i => i.id === modalState.data?.id);
    if (!itemToMove) return;
    
    const newDateStart = startOfDay(newDate);
    const oldDateStart = startOfDay(new Date(itemToMove.date));
    const dateDiff = Math.round((newDateStart.getTime() - oldDateStart.getTime()) / (1000 * 60 * 60 * 24));
    
    if (moveGroup && itemToMove.type === 'job' && itemToMove.jobNumber) {
      // Move all items with the same job number
      const groupItems = findItemsWithSameJobNumber(itemToMove);
      groupItems.forEach(groupItem => {
        const groupItemDate = new Date(groupItem.date);
        const newGroupDate = addDays(groupItemDate, dateDiff);
        // Only move if the new date is not in the past
        if (!isBefore(startOfDay(newGroupDate), startOfDay(new Date()))) {
          onItemUpdate({ ...groupItem, date: newGroupDate });
        }
      });
      // Also move the current item
      if (!isBefore(startOfDay(newDate), startOfDay(new Date()))) {
        onItemUpdate({ ...itemToMove, date: newDate });
      }
    } else {
      // Move just this one item
      if (!isBefore(startOfDay(newDate), startOfDay(new Date()))) {
        onItemUpdate({ ...itemToMove, date: newDate });
      }
    }
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

  // Helper function to check if a date is a weekday (Monday-Friday)
  const isWeekday = (date: Date): boolean => {
    const day = getDay(date);
    return day >= 1 && day <= 5; // Monday = 1, Friday = 5
  };

  // Helper function to add weekdays only (skip weekends)
  const addWeekdays = (date: Date, weekdays: number): Date => {
    let result = new Date(date);
    let added = 0;
    while (added < weekdays) {
      result = addDays(result, 1);
      if (isWeekday(result)) {
        added++;
      }
    }
    return result;
  };

  // Helper function to calculate end date for month/6months/12months periods (weekdays only)
  const calculateWeekdayEndDate = (startDate: Date, period: 'month' | '6months' | '12months'): Date => {
    const monthEnd = endOfMonth(startDate);
    let targetWeekdays: number;
    
    switch (period) {
      case 'month':
        // Count weekdays in the month from start date
        targetWeekdays = 0;
        let currentDate = new Date(startDate);
        while (currentDate <= monthEnd) {
          if (isWeekday(currentDate)) {
            targetWeekdays++;
          }
          currentDate = addDays(currentDate, 1);
        }
        return addWeekdays(startDate, targetWeekdays - 1); // -1 because start date is included
      case '6months':
        // Approximately 130 weekdays in 6 months (6 * 22 weekdays per month average)
        targetWeekdays = 130;
        return addWeekdays(startDate, targetWeekdays - 1);
      case '12months':
        // Approximately 260 weekdays in 12 months (12 * 22 weekdays per month average)
        targetWeekdays = 260;
        return addWeekdays(startDate, targetWeekdays - 1);
      default:
        return startDate;
    }
  };

  const handleModalSubmit = (data: any, applyPeriod: 'none' | 'week' | 'month' | '6months' | '12months' | 'group' = 'none') => {
    // Only treat as UPDATE if modalState.data has an id (existing item)
    // If modalState.data exists but has no id, it's a CREATE with initial defaults
    if (modalState.data && modalState.data.id) {
        // UPDATE
        const itemDate = startOfDay(new Date(modalState.data.date));
        const today = startOfDay(new Date());
        const isPast = isBefore(itemDate, today);
        
        // In read-only mode, only allow job status updates for past jobs
        if (isReadOnly && isPast) {
          if (modalState.data.type !== 'job') {
            return; // Silently ignore - shouldn't happen as we prevent opening the modal
          }
          // Only allow color/jobStatus changes in read-only mode
          // Filter data to only include allowed keys
          const filteredData: any = {};
          if (data.color !== undefined) filteredData.color = data.color;
          if (data.jobStatus !== undefined) filteredData.jobStatus = data.jobStatus;
          
          // Only proceed if there are actual changes to allowed fields
          if (Object.keys(filteredData).length === 0) {
            return; // No changes to allowed fields
          }
          
          // Update only the allowed fields
          const updatedItem = { ...modalState.data, ...filteredData };
          
          // If applyPeriod is 'group', update all items with the same job number
          if (applyPeriod === 'group' && updatedItem.jobNumber) {
            const groupItems = findItemsWithSameJobNumber(updatedItem);
            groupItems.forEach(groupItem => {
              onItemUpdate({ ...groupItem, ...filteredData });
            });
          } else {
            // Update just this one item
            onItemUpdate(updatedItem);
          }
          return; // Exit early, don't show alerts or do other processing
        } else if (isPast) {
          // For past items in normal mode, only allow color changes for jobs
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
        
        // Check if color changed - for ANY job (past or future), show grouping dialog if there's a group
        if (data.color && data.color !== modalState.data.color && updatedItem.type === 'job') {
          const groupItems = findItemsWithSameJobNumber(updatedItem);
          if (groupItems.length > 1) {
            // Show grouping dialog for color change
            setGroupingDialog({
              open: true,
              type: 'color',
              itemId: updatedItem.id,
              groupCount: groupItems.length,
              onConfirm: (applyToGroup: boolean) => {
                if (applyToGroup) {
                  // Change color for all items with the same job number (including past items)
                  groupItems.forEach(groupItem => {
                    onItemUpdate({ ...groupItem, color: data.color });
                  });
                } else {
                  // Change color for just this one
                  onItemUpdate(updatedItem);
                }
              }
            });
            return;
          } else {
            // No group, just update this one item
            onItemUpdate(updatedItem);
            return;
          }
        }
        
        onItemUpdate(updatedItem);
        
        if (applyPeriod !== 'none') {
            // Calculate end date based on period
            const startDate = new Date(updatedItem.date);
            let endDate: Date;
            
            switch (applyPeriod) {
                case 'week':
                    endDate = addDays(weekStart, viewDays - 1);
                    break;
                case 'month':
                    endDate = calculateWeekdayEndDate(startDate, 'month');
                    break;
                case '6months':
                    endDate = calculateWeekdayEndDate(startDate, '6months');
                    break;
                case '12months':
                    endDate = calculateWeekdayEndDate(startDate, '12months');
                    break;
                default:
                    endDate = addDays(weekStart, viewDays - 1);
            }
            
            items.forEach(i => {
                if (i.id === updatedItem.id) return;
                
                const iDate = new Date(i.date);
                const isFuture = isAfter(iDate, startDate) && (isBefore(iDate, endDate) || isSameDay(iDate, endDate));
                
                // Simplified logic: If it looks like part of the same "series" (Same Crew + Same Type), update it.
                if (isFuture && i.crewId === updatedItem.crewId && i.type === updatedItem.type) {
                    let isMatch = false;
                    
                    if (i.type === 'job') {
                         // Match if it shares the same Customer (before edit)
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
        
    } else if (modalState.target || (modalState.data && !modalState.data.id)) {
        // CREATE (either from target or from data without id)
        // Get date and crewId from target or data
        const createDate = modalState.target?.date || modalState.data?.date;
        const createCrewId = modalState.target?.crewId || modalState.data?.crewId;
        const createDepotId = modalState.target?.depotId || modalState.data?.depotId || "";
        
        if (!createDate) {
            console.error('[handleModalSubmit] Missing date for create:', { target: modalState.target, data: modalState.data });
            return;
        }
        
        // Ensure jobStatus is set for jobs - if customer is 'Free' or empty, it's a free job
        const isFreeJob = modalState.type === 'job' && (data.customer === 'Free' || !data.customer || data.customer.trim() === '');
        
        const baseItem = {
            id: Math.random().toString(36).substr(2, 9),
            type: modalState.type,
            date: createDate,
            crewId: createCrewId,
            depotId: createDepotId,
            ...data,
            // Override for free jobs to ensure they're marked correctly
            ...(isFreeJob && modalState.type === 'job' ? {
                jobStatus: 'free',
                customer: 'Free',
                address: 'Free'
            } : {})
        };
        
        onItemCreate(baseItem);
        
        // Auto-generate free jobs and add operative when operative + vehicle
        const isOperativeWithVehicle = 
            modalState.type === 'operative' && 
            data.employeeId && 
            data.vehicleId;
        
        if (isOperativeWithVehicle) {
            // Find the vehicle to get its color
            const vehicle = vehicles.find((v: any) => v.id === data.vehicleId);
            const vehicleColor = vehicle?.color || 'blue';
            
            const startDate = new Date(createDate);
            
            // Determine end date based on applyPeriod, default to week if not set
            const periodToUse = applyPeriod !== 'none' ? applyPeriod : 'week';
            let endDate: Date;
            
            switch (periodToUse) {
                case 'week':
                    endDate = addDays(weekStart, viewDays - 1);
                    break;
                case 'month':
                    endDate = calculateWeekdayEndDate(startDate, 'month');
                    break;
                case '6months':
                    endDate = calculateWeekdayEndDate(startDate, '6months');
                    break;
                case '12months':
                    endDate = calculateWeekdayEndDate(startDate, '12months');
                    break;
                default:
                    endDate = addDays(weekStart, viewDays - 1);
            }
            
            // 1. Create free job on the same day (below the operative)
                onItemCreate({
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'job',
                    date: new Date(startDate),
                    crewId: createCrewId,
                    depotId: modalState.target?.depotId || modalState.data?.depotId || "",
                jobStatus: 'free',
                customer: 'Free',
                address: 'Free',
                startTime: '08:00',
                duration: 8,
                color: vehicleColor,
                employeeId: data.employeeId,
                vehicleId: data.vehicleId,
            });
            
            // 2. Add operative and free jobs for the selected period (weekdays only for month/6months/12months)
            let nextDate = addDays(startDate, 1);
            let safetyCounter = 0;
            const MAX_ITEMS = 1000; // Safety limit
            const skipWeekends = applyPeriod === 'month' || applyPeriod === '6months' || applyPeriod === '12months';
            
            while ((isSameDay(nextDate, endDate) || isBefore(nextDate, endDate)) && safetyCounter < MAX_ITEMS) {
                // Skip weekends for month/6months/12months periods
                if (skipWeekends && !isWeekday(nextDate)) {
                    nextDate = addDays(nextDate, 1);
                    continue;
                }
                
                // Create operative for this day
                onItemCreate({
                    id: Math.random().toString(36).substr(2, 9),
                    type: modalState.type,
                    date: new Date(nextDate),
                    crewId: createCrewId,
                    depotId: modalState.target?.depotId || modalState.data?.depotId || "",
                    ...data
                });
                
                // Create free job for this day
                onItemCreate({
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'job',
                    date: new Date(nextDate),
                    crewId: createCrewId,
                    depotId: createDepotId,
                    jobStatus: 'free',
                    customer: 'Free',
                    address: 'Free',
                    startTime: '08:00',
                    duration: 8,
                    color: vehicleColor,
                    employeeId: data.employeeId,
                    vehicleId: data.vehicleId,
                });
                
                nextDate = addDays(nextDate, 1);
                safetyCounter++;
            }
        } else if (applyPeriod !== 'none') {
            // For non-operative items or operatives without vehicles, use the applyPeriod checkbox
            const startDate = new Date(createDate);
            let endDate: Date;
            
            switch (applyPeriod) {
                case 'week':
                    endDate = addDays(weekStart, viewDays - 1);
                    break;
                case 'month':
                    endDate = calculateWeekdayEndDate(startDate, 'month');
                    break;
                case '6months':
                    endDate = calculateWeekdayEndDate(startDate, '6months');
                    break;
                case '12months':
                    endDate = calculateWeekdayEndDate(startDate, '12months');
                    break;
                default:
                    endDate = addDays(weekStart, viewDays - 1);
            }
            
            let nextDate = addDays(startDate, 1);
            let safetyCounter = 0;
            const MAX_ITEMS = 1000; // Safety limit
            const skipWeekends = applyPeriod === 'month' || applyPeriod === '6months' || applyPeriod === '12months';
             
            while ((isSameDay(nextDate, endDate) || isBefore(nextDate, endDate)) && safetyCounter < MAX_ITEMS) {
                // Skip weekends for month/6months/12months periods
                if (skipWeekends && !isWeekday(nextDate)) {
                    nextDate = addDays(nextDate, 1);
                    continue;
                }
                
                onItemCreate({
                    id: Math.random().toString(36).substr(2, 9),
                    type: modalState.type,
                    date: new Date(nextDate),
                    crewId: createCrewId,
                    depotId: modalState.target?.depotId || modalState.data?.depotId || "",
                    ...data
                });
                nextDate = addDays(nextDate, 1);
                safetyCounter++;
            }
        }
    }
  };

  const handleCrewSubmit = async () => {
    if (crewModal.name.trim()) {
        try {
            if (crewModal.mode === 'create') {
                // onCrewCreate may be async, so we await it
                await Promise.resolve(onCrewCreate(crewModal.name, crewModal.shift));
                // Close modal after successful creation
                setCrewModal({ isOpen: false, mode: 'create', name: "", shift: 'day' });
            } else if (crewModal.mode === 'edit' && crewModal.id) {
                // onCrewUpdate may be async, so we await it
                await Promise.resolve(onCrewUpdate(crewModal.id, crewModal.name, crewModal.shift));
                // Close modal after successful update
                setCrewModal({ isOpen: false, mode: 'create', name: "", shift: 'day' });
            }
        } catch (error) {
            // If there's an error, keep the modal open so user can retry
            console.error('Error creating/updating crew:', error);
        }
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
                                {/* Removed - users use the + button in crew rows now */}
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

                    {expandedShifts.night && (() => {
                        const nightCrews = crews.filter(c => c.shift === 'night');
                        // Always show at least one row, even if no crews exist
                        if (nightCrews.length === 0) {
                            // Show empty row with add button
                            const firstDepotId = depots.length > 0 ? depots[0].id : undefined;
                            return (
                                <>
                                <tr key="night-empty" className="group">
                                    <td className="p-2 border-b border-r border-slate-200 bg-white font-medium text-slate-700 align-top sticky left-0 z-10 w-14">
                                        <div className="flex flex-col items-center justify-center h-full group relative gap-1">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                                <Moon className="w-4 h-4 text-indigo-600" />
                                            </div>
                                            {!isReadOnly && (
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onCrewCreate("Night Shift", 'night');
                                                        }}
                                                        title="Add Night Crew"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    {weekDays.map((day) => (
                                        <td key={day.toString()} className="border-b border-r border-slate-200 align-top p-1.5" style={{ minHeight: "120px" }}>
                                            <div className="h-full min-h-[120px] w-full"></div>
                                        </td>
                                    ))}
                                </tr>
                                </>
                            );
                        }
                        // Render existing crews
                        return nightCrews.map((crew, index) => {
                            const isFirstRow = index === 0;
                            const isLastRow = index === nightCrews.length - 1;
                            
                            return (
                                <tr key={crew.id} className="group">
                            <td className="p-2 border-b border-r border-slate-200 bg-white font-medium text-slate-700 align-top sticky left-0 z-10 w-14">
                                <div className="flex flex-col items-center justify-center h-full group relative gap-1">
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
                                    {/* Add button on first row */}
                                    {isFirstRow && !isReadOnly && (
                                        <div className="flex flex-col items-center gap-0.5">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Directly create crew without modal
                                                    const prefix = "Night";
                                                    const depotId = crew.depotId;
                                                    const sameShiftCrews = crews.filter(c => 
                                                        (c.shift === 'night' || c.name.toLowerCase().includes("night")) && 
                                                        c.depotId === depotId
                                                    );
                                                    const count = sameShiftCrews.length;
                                                    const generatedName = `${prefix} ${count + 1}`;
                                                    onCrewCreate(generatedName, 'night');
                                                }}
                                                title="Add Night Crew"
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                            <span className="text-[10px] font-semibold text-indigo-600">{index + 1}</span>
                                        </div>
                                    )}
                                    {/* Show number on non-first rows */}
                                    {!isFirstRow && (
                                        <span className="text-[10px] font-semibold text-indigo-600">{index + 1}</span>
                                    )}
                                    {/* Delete button on extra rows */}
                                    {!isFirstRow && !isReadOnly && !crew.archivedAt && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 rounded-full hover:bg-red-100 hover:text-red-600 text-red-400"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCrewDeleteWithValidation(crew.id, 'night', index);
                                            }}
                                            title="Delete Crew"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </td>

                            {weekDays.map((day) => {
                                const dateStr = format(day, "yyyy-MM-dd");
                                const cellId = `${crew.id}|${dateStr}`;
                                const cellItems = filteredItems.filter(i => 
                                    isSameDay(new Date(i.date), day) && 
                                    i.crewId === crew.id
                                );
                                
                                // Base sort: Notes first, then People, then Jobs
                                const getPriority = (type: string) => {
                                  if (type === 'note') return 0;
                                  if (type === 'operative' || type === 'assistant') return 1;
                                  if (type === 'job') return 2;
                                  return 3;
                                };

                                let displayItems = [...cellItems].sort(
                                  (a, b) => getPriority(a.type) - getPriority(b.type)
                                );

                                // Default within-people order: Operatives on the left, Assistants on the right
                                const cellKey = cellId;
                                const manualOrder = cellItemOrder[cellKey];

                                if (manualOrder && manualOrder.length) {
                                  // Apply user-defined order for this cell (drag & drop)
                                  displayItems = [...displayItems].sort((a, b) => {
                                    const ia = manualOrder.indexOf(a.id);
                                    const ib = manualOrder.indexOf(b.id);
                                    if (ia === -1 && ib === -1) return 0;
                                    if (ia === -1) return 1;
                                    if (ib === -1) return -1;
                                    return ia - ib;
                                  });
                                } else {
                                  // No manual order: keep priority, but ensure operative appears before assistant
                                  displayItems = [...displayItems].sort((a, b) => {
                                    const pa = getPriority(a.type);
                                    const pb = getPriority(b.type);
                                    if (pa !== pb) return pa - pb;
                                    const aIsPerson = a.type === 'operative' || a.type === 'assistant';
                                    const bIsPerson = b.type === 'operative' || b.type === 'assistant';
                                    if (aIsPerson && bIsPerson && a.type !== b.type) {
                                      return a.type === 'operative' ? -1 : 1;
                                    }
                                    return 0;
                                  });
                                }
                                
                                const peopleItems = displayItems.filter(i => i.type !== 'job' && i.type !== 'note');
                                const noteItems = displayItems.filter(i => i.type === 'note');
                                const jobItems = displayItems.filter(i => i.type === 'job');

                                // Only ever show a single free/ghost job per crew/day.
                                const freeJobs = jobItems.filter(isFreeJobItem);
                                const nonFreeJobs = jobItems.filter(j => !isFreeJobItem(j));
                                const visibleJobItems = [
                                  ...(freeJobs[0] ? [freeJobs[0]] : []),
                                  ...nonFreeJobs,
                                ];

                                const ghostVehicleLabel = getGhostVehicleLabelForCell(peopleItems, vehicles);

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
                                                                onBookTimeOff={handleOpenEmployeeTimeOff}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Jobs appear last */}
                                                {visibleJobItems.map((item) => (
                                                    <SiteCard 
                                                        key={item.id} 
                                                        item={item} 
                                                        vehicles={vehicles}
                                                        onEdit={handleEditItem} 
                                                        onDelete={(id, mode) => handleDeleteItem(id, mode)} 
                                                        onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)} 
                                                        isReadOnly={isReadOnly || isBefore(startOfDay(new Date(item.date)), startOfDay(new Date()))}
                                                        isSelected={selectedItemIds.has(item.id)}
                                                        onToggleSelection={handleToggleSelection}
                                                        selectedItemIds={selectedItemIds}
                                                        onDuplicateSelected={handleDuplicateSelected}
                                                        onDeleteSelected={handleDeleteSelected}
                                                        ghostVehicleLabel={ghostVehicleLabel}
                                                        vehicleTypes={vehicleTypes}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DroppableCell>
                                );
                            })}
                                </tr>
                            );
                        });
                    })()}

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

                    {expandedShifts.day && (() => {
                        const dayCrews = crews.filter(c => c.shift !== 'night');
                        // Always show at least one row, even if no crews exist
                        if (dayCrews.length === 0) {
                            // Show empty row with add button
                            const firstDepotId = depots.length > 0 ? depots[0].id : undefined;
                            return (
                                <tr key="day-empty" className="group">
                                    <td className="p-2 border-b border-r border-slate-200 bg-white font-medium text-slate-700 align-top sticky left-0 z-10 w-14">
                                        <div className="flex flex-col items-center justify-center h-full group relative gap-1">
                                            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                                                <Sun className="w-4 h-4 text-amber-500" />
                                            </div>
                                            {!isReadOnly && (
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onCrewCreate("Day Shift", 'day');
                                                        }}
                                                        title="Add Day Crew"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    {weekDays.map((day) => (
                                        <td key={day.toString()} className="border-b border-r border-slate-200 align-top p-1.5" style={{ minHeight: "120px" }}>
                                            <div className="h-full min-h-[120px] w-full"></div>
                                        </td>
                                    ))}
                                </tr>
                            );
                        }
                        // Render existing crews
                        return dayCrews.map((crew, index) => {
                            const isFirstRow = index === 0;
                            const isLastRow = index === dayCrews.length - 1;
                            
                            return (
                        <tr key={crew.id} className="group">
                            <td className="p-2 border-b border-r border-slate-200 bg-white font-medium text-slate-700 align-top sticky left-0 z-10 w-14">
                                <div className="flex flex-col items-center justify-center h-full group relative gap-1">
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
                                    {/* Add button on first row */}
                                    {isFirstRow && !isReadOnly && (
                                        <div className="flex flex-col items-center gap-0.5">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Directly create crew without modal
                                                    const prefix = "Day";
                                                    const depotId = crew.depotId;
                                                    const sameShiftCrews = crews.filter(c => 
                                                        (c.shift === 'day' || !c.name.toLowerCase().includes("night")) && 
                                                        c.depotId === depotId
                                                    );
                                                    const count = sameShiftCrews.length;
                                                    const generatedName = `${prefix} ${count + 1}`;
                                                    onCrewCreate(generatedName, 'day');
                                                }}
                                                title="Add Day Crew"
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                            <span className="text-[10px] font-semibold text-amber-600">{index + 1}</span>
                                        </div>
                                    )}
                                    {/* Show number on non-first rows */}
                                    {!isFirstRow && (
                                        <span className="text-[10px] font-semibold text-amber-600">{index + 1}</span>
                                    )}
                                    {/* Delete button on extra rows */}
                                    {!isFirstRow && !isReadOnly && !crew.archivedAt && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 rounded-full hover:bg-red-100 hover:text-red-600 text-red-400"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCrewDeleteWithValidation(crew.id, 'day', index);
                                            }}
                                            title="Delete Crew"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
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

                                // Only ever show a single free/ghost job per crew/day.
                                const freeJobs = jobItems.filter(isFreeJobItem);
                                const nonFreeJobs = jobItems.filter(j => !isFreeJobItem(j));
                                const visibleJobItems = [
                                  ...(freeJobs[0] ? [freeJobs[0]] : []),
                                  ...nonFreeJobs,
                                ];

                                const ghostVehicleLabel = getGhostVehicleLabelForCell(peopleItems, vehicles);

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
                                                                onBookTimeOff={handleOpenEmployeeTimeOff}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Jobs appear last */}
                                                {visibleJobItems.map((item) => (
                                                    <SiteCard 
                                                        key={item.id} 
                                                        item={item} 
                                                        vehicles={vehicles}
                                                        onEdit={handleEditItem} 
                                                        onDelete={(id, mode) => handleDeleteItem(id, mode)} 
                                                        onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)} 
                                                        isReadOnly={isReadOnly || isBefore(startOfDay(new Date(item.date)), startOfDay(new Date()))}
                                                        isSelected={selectedItemIds.has(item.id)}
                                                        onToggleSelection={handleToggleSelection}
                                                        selectedItemIds={selectedItemIds}
                                                        onDuplicateSelected={handleDuplicateSelected}
                                                        onDeleteSelected={handleDeleteSelected}
                                                        ghostVehicleLabel={ghostVehicleLabel}
                                                        vehicleTypes={vehicleTypes}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DroppableCell>
                                );
                            })}
                                </tr>
                            );
                        });
                    })()}
                </tbody>
            </table>
        </div>

        <DragOverlay>
          {activeItem ? (
             activeItem.type === 'job' ? (
                <div className="w-[200px] opacity-90 rotate-2 cursor-grabbing shadow-xl">
                    <SiteCard 
                        item={activeItem} 
                        vehicles={vehicles}
                        onEdit={() => {}} 
                        onDelete={() => {}} 
                        onDuplicate={() => {}} 
                        vehicleTypes={vehicleTypes}
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

      {/* Crew Delete Confirmation Dialog */}
      {crewDeleteDialog && (
        <Dialog open={crewDeleteDialog.open} onOpenChange={(open) => {
          if (!open) {
            setCrewDeleteDialog(null);
          }
        }}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                Delete Crew: {crewDeleteDialog.crewName}
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                This crew has <strong>{crewDeleteDialog.futureItemsCount}</strong> scheduled item(s) in the future.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {crewDeleteDialog.futureItems.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Scheduled items:</p>
                  <ul className="space-y-1">
                    {crewDeleteDialog.futureItems.map((item, idx) => (
                      <li key={idx} className="text-sm text-slate-600 flex items-center gap-2">
                        <span className="font-medium text-slate-900">{item.displayDate}</span>
                        <span className="text-slate-400">•</span>
                        <span className="capitalize">{item.type}</span>
                        {item.customer && (
                          <>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-600">{item.customer}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-slate-700">
                Would you like to move these items to the previous crew row before deleting?
              </p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => setCrewDeleteDialog(null)}
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button 
                variant="outline"
                onClick={() => crewDeleteDialog.onConfirm(false)}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                Delete Without Moving
              </Button>
              <Button 
                onClick={() => crewDeleteDialog.onConfirm(true)}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Move Items Up & Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Crew Delete Error Dialog */}
      {crewDeleteErrorDialog && (
        <Dialog open={crewDeleteErrorDialog.open} onOpenChange={(open) => {
          if (!open) {
            setCrewDeleteErrorDialog(null);
          }
        }}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                {crewDeleteErrorDialog.title}
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                {crewDeleteErrorDialog.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                onClick={() => setCrewDeleteErrorDialog(null)}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Item Editor Modal */}
      <ItemModal 
        open={modalState.isOpen} 
        onOpenChange={(isOpen) => setModalState(prev => ({ ...prev, isOpen }))}
        onSubmit={handleModalSubmit}
        type={modalState.type}
        initialData={modalState.data || (modalState.target ? { 
          date: modalState.target.date, 
          crewId: modalState.target.crewId,
          ...(modalState.type === 'job' && modalState.data ? modalState.data : {})
        } : undefined)}
        employees={employees}
        vehicles={vehicles}
        items={items} // Pass items for conflict detection
        crews={crews} // Pass crews for validating assignments
        colorLabels={colorLabels}
        isReadOnly={isReadOnly}
        onColorLabelUpdate={onColorLabelUpdate}
        onMoveDate={handleMoveDate}
      />

      {/* Crew Modal */}
      {/* Edit Crew Dialog - Create mode removed, users use the + button now */}
      {crewModal.mode === 'edit' && (
        <Dialog open={crewModal.isOpen} onOpenChange={(open) => setCrewModal(prev => ({ ...prev, isOpen: open }))}>
          <DialogContent className="sm:max-w-[425px] bg-white text-slate-900">
              <DialogHeader>
                  <DialogTitle>Edit Crew</DialogTitle>
              </DialogHeader>
              
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
          </DialogContent>
        </Dialog>
      )}

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

      <EmployeeTimeOffDialog
        open={employeeTimeOffModal.open}
        onOpenChange={(open) =>
          setEmployeeTimeOffModal((prev) => ({ ...prev, open }))
        }
        employeeName={employeeTimeOffModal.employeeName}
        initialDate={employeeTimeOffModal.defaultDate || undefined}
        onApply={handleEmployeeTimeOffApplied}
      />
    </div>
  );
}
