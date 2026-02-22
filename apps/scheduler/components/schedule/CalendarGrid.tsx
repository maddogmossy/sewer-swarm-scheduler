import { useState, useEffect, useRef } from "react";
import { format, startOfWeek, addDays, isSameDay, endOfWeek, isAfter, isBefore, startOfDay, endOfMonth, addMonths, endOfYear, getDay } from "date-fns";
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, useDroppable, Modifier } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { SiteCard } from "./SiteCard";
import { OperativeCard } from "./OperativeCard";
import { NoteCard } from "./NoteCard";
import { ItemModal } from "./ItemModal";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, MoreHorizontal, Trash2, Briefcase, UserPlus, User, Truck, Settings, Edit, Search, Lock, Mail, Check, Sun, Moon, ChevronDown, ChevronRight as ChevronRightIcon, RotateCcw, RotateCw, FileText, LogOut, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
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
import { useUISettings } from "@/hooks/useUISettings";
import { EmployeeTimeOffDialog, EmployeeTimeOffDialogPayload } from "./EmployeeTimeOffDialog";
import { GroupingDialog } from "./GroupingDialog";
import { VehiclePairingDialog } from "./VehiclePairingDialog";
import { calculateJobEndTime, calculateNextJobStartTime, calculateTravelTime, extractPostcode } from "@/lib/travelTime";
import { mergeAndSortVehicleTypes, normalizeVehicleTypeName, type VehicleCombinationConfig } from "@/lib/vehicleTypes";

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

    // Approval status (approved/pending/rejected) - separate from job status
    status?: 'approved' | 'pending' | 'rejected';

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

/** Calendar day string (yyyy-MM-dd) for item dates; avoids UTC shift for date-only or Z-suffix API dates. */
function itemDateToCalendarDay(date: Date | string): string {
  if (typeof date === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    if (date.endsWith("Z") || date.includes("T")) return date.slice(0, 10);
  }
  return format(startOfDay(new Date(date)), "yyyy-MM-dd");
}

function getGhostVehicleLabelForCell(
  peopleItems: ScheduleItem[],
  vehicles: { id: string; name: string; status: 'active' | 'off_road' | 'maintenance'; vehicleType: string; category?: string; color?: string }[],
  vehicleTypes?: string[] | Array<{ type: string; defaultColor?: string }>,
  vehicleCombinations?: VehicleCombinationConfig[]
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

  // Check configurable combinations first (Scheduling settings)
  if (vehicleCombinations && vehicleCombinations.length > 0) {
    for (const combo of vehicleCombinations) {
      const setA = new Set(combo.groupA.map((t) => normalizeVehicleTypeName(t)));
      const setB = new Set(combo.groupB.map((t) => normalizeVehicleTypeName(t)));
      const hasA = cellVehicles.some(
        (v) =>
          setA.has(normalizeVehicleTypeName(v.vehicleType)) ||
          setA.has(normalizeVehicleTypeName(v.category)) ||
          setA.has(normalizeVehicleTypeName(v.name))
      );
      const hasB = cellVehicles.some(
        (v) =>
          setB.has(normalizeVehicleTypeName(v.vehicleType)) ||
          setB.has(normalizeVehicleTypeName(v.category)) ||
          setB.has(normalizeVehicleTypeName(v.name))
      );
      if (hasA && hasB) return combo.label;
    }
  }

  // Check if vehicle is BJJ (should be treated as CCTV/Van Pack)
  const isBjj = (v: (typeof cellVehicles)[number]) => {
    const name = normalize(v.name);
    const cat = normalize(v.category);
    const type = normalize(v.vehicleType);
    return name.includes("bjj") || cat.includes("bjj") || type.includes("bjj");
  };

  // Check if vehicle has CCTV/Van Pack category (BJJ or explicit category)
  const isCctvVanPack = (v: (typeof cellVehicles)[number]) => {
    const cat = normalize(v.category);
    const type = normalize(v.vehicleType);
    const name = normalize(v.name);
    // Check for "cctvvanpack" or "cctv/vanpack" in normalized category/type/name
    // Also check for original category value (before normalization) for exact match
    const originalCat = (v.category || "").toLowerCase();
    const originalType = (v.vehicleType || "").toLowerCase();
    return cat.includes("cctvvanpack") || cat.includes("cctvvan") || 
           type.includes("cctvvanpack") || type.includes("cctvvan") ||
           name.includes("cctvvanpack") || name.includes("cctvvan") ||
           originalCat.includes("cctv/van pack") || originalCat.includes("cctv/vanpack") ||
           originalType.includes("cctv/van pack") || originalType.includes("cctv/vanpack") ||
           isBjj(v); // BJJ is also CCTV/Van Pack
  };

  const isCctv = (v: (typeof cellVehicles)[number]) => {
    const cat = normalize(v.category);
    const type = normalize(v.vehicleType);
    const name = normalize(v.name);
    // Check for "cctv" in normalized category/type/name (handles "CCTV", "CCTV/Van", "CCTV/Van Pack", etc.)
    // Also treat BJJ as CCTV
    return cat.includes("cctv") || type.includes("cctv") || name.includes("cctv") || isBjj(v);
  };

  const isJetVac = (v: (typeof cellVehicles)[number]) => {
    // Treat BJJ as Van Pack only (never as Jet Vac, even if the saved string is inconsistent)
    if (isBjj(v)) return false;
    const cat = normalize(v.category);
    const type = normalize(v.vehicleType);
    const name = normalize(v.name);
    return cat.includes("jet") || type.includes("jet") || name.includes("jet");
  };

  const isRecycler = (v: (typeof cellVehicles)[number]) => {
    // Treat BJJ as Van Pack only (never as Recycler, even if the saved string is inconsistent)
    if (isBjj(v)) return false;
    const cat = normalize(v.category);
    const type = normalize(v.vehicleType);
    const name = normalize(v.name);
    return cat.includes("recycl") || type.includes("recycl") || name.includes("recycl");
  };

  // Check if vehicle is Jet Vac or Recycler (both trigger CCTV/Jet Vac when paired with CCTV)
  const isJetVacOrRecycler = (v: (typeof cellVehicles)[number]) => {
    return isJetVac(v) || isRecycler(v);
  };

  const hasCctv = cellVehicles.some(isCctv);
  const hasJetVac = cellVehicles.some(isJetVac);
  const hasRecycler = cellVehicles.some(isRecycler);
  const hasJetVacOrRecycler = cellVehicles.some(isJetVacOrRecycler);
  const hasBjj = cellVehicles.some(isBjj);
  const hasCctvVanPack = cellVehicles.some(isCctvVanPack);

  const shouldDebugPairing = hasBjj || hasCctvVanPack;

  // Debug logs removed (kept pairing logic only)

  // Helper: map canonical labels to whatever is in the Vehicle Types dropdown (e.g. plural variants)
  const toDisplay = (label: string) => {
    if (!vehicleTypes || vehicleTypes.length === 0) return label;
    const merged = mergeAndSortVehicleTypes(vehicleTypes);
    const targetNorm = normalizeVehicleTypeName(label);
    const found = merged.find((t) => normalizeVehicleTypeName(t.type) === targetNorm);
    return found?.type || label;
  };

  // Priority: CCTV/Jet Vac > CCTV/Van Pack > CCTV
  // If CCTV/Van Pack (BJJ or category) and Jet Vac/Recycler are both present, return "CCTV/Jet Vac"
  if (hasCctvVanPack && hasJetVacOrRecycler) {
    return toDisplay("CCTV/Jet Vac");
  }
  // If only CCTV/Van Pack is present, return "CCTV/Van Pack"
  if (hasCctvVanPack && !hasJetVacOrRecycler) {
    return toDisplay("CCTV/Van Pack");
  }
  // Standard logic for other combinations
  if (hasCctv && hasJetVacOrRecycler) {
    return toDisplay("CCTV/Jet Vac");
  }
  if (hasCctv) {
    return toDisplay("CCTV");
  }
  if (hasJetVac) {
    return toDisplay("Jet Vac");
  }
  if (hasRecycler) {
    return toDisplay("Recycler");
  }

  const first = cellVehicles[0];
  return first.vehicleType || first.category || undefined;
}

// Helper function to get color for vehicle pairing based on ghostVehicleLabel
function getColorForVehiclePairing(
  peopleItems: ScheduleItem[],
  vehicles: { id: string; name: string; status: 'active' | 'off_road' | 'maintenance'; vehicleType: string; category?: string; color?: string }[],
  vehicleTypes?: string[] | Array<{ type: string; defaultColor?: string }>,
  vehicleCombinations?: VehicleCombinationConfig[]
): string | undefined {
  // Get the ghost vehicle label for this cell (pass combinations so label can come from config)
  const ghostVehicleLabel = getGhostVehicleLabelForCell(peopleItems, vehicles, vehicleTypes, vehicleCombinations);
  if (!ghostVehicleLabel) return undefined;

  // If label matches a combination, use that combination's color
  if (vehicleCombinations && vehicleCombinations.length > 0) {
    const match = vehicleCombinations.find(
      (c) => normalizeVehicleTypeName(c.label) === normalizeVehicleTypeName(ghostVehicleLabel)
    );
    if (match) return match.defaultColor;
  }

  // Helper to get default color for a vehicle type from vehicleTypes config
  const getDefaultColorForType = (type: string): string | undefined => {
    if (!vehicleTypes || vehicleTypes.length === 0) return undefined;
    const typeObj = vehicleTypes.find(t => {
      const typeName = typeof t === 'string' ? t : t.type;
      if (typeName === type) return true;
      return typeName?.toLowerCase() === type?.toLowerCase();
    });
    return (typeof typeObj === 'object' && typeObj?.defaultColor) ? typeObj.defaultColor : undefined;
  };

  return getDefaultColorForType(ghostVehicleLabel);
}

interface CalendarGridProps {
  items: ScheduleItem[];
  crews: Crew[];
  employees: {
    id: string
    name: string
    status: 'active' | 'holiday' | 'sick'
    email?: string
    jobRole?: 'operative' | 'assistant'
    homePostcode?: string
    startsFromHome?: boolean
  }[];
  vehicles: { id: string; name: string; status: 'active' | 'off_road' | 'maintenance'; vehicleType: string; category?: string; color?: string }[];
  employeeAbsences?: Array<{
    id: string;
    employeeId: string;
    absenceType: "holiday" | "sick";
    startDate: string;
    endDate: string;
  }>;
  colorLabels: Record<string, string>;
  isReadOnly: boolean;
  depots: { id: string; name: string; address: string }[];
  allItems: ScheduleItem[];
  onItemUpdate: (item: ScheduleItem) => void;
  onBatchItemUpdates?: (updates: { item: ScheduleItem; previousItem: ScheduleItem }[]) => void;
  revertedPairingCellKeys?: string[];
  onClearedRevertedPairing?: () => void;
  onItemCreate: (item: ScheduleItem) => void;
  onItemDelete: (id: string) => void;
  onItemReorder: (activeId: string, overId: string) => void;
  onCrewCreate: (name: string, shift: 'day' | 'night') => void;
  onCrewUpdate: (id: string, name: string, shift: 'day' | 'night') => void;
  onCrewDelete: (id: string) => void;
  onEmployeeCreate: (name: string) => void;
  onEmployeeUpdate: (
    id: string,
    name: string,
    status?: 'active' | 'holiday' | 'sick',
    jobRole?: 'operative' | 'assistant',
    email?: string,
    homePostcode?: string,
    startsFromHome?: boolean
  ) => void;
  onEmployeeDelete: (id: string) => void;
  onVehicleCreate: (name: string, vehicleType?: string, category?: string, color?: string) => void;
  onVehicleUpdate: (id: string, name: string, status?: 'active' | 'off_road' | 'maintenance', vehicleType?: string, category?: string, color?: string) => void;
  onVehicleDelete: (id: string) => void;
  onColorLabelUpdate: (color: string, label: string) => void;
  vehicleTypes?: string[] | Array<{ type: string; defaultColor?: string }>;
  vehicleCombinations?: VehicleCombinationConfig[];
  onVehicleTypeCreate?: (type: string, defaultColor?: string) => void;
  onVehicleTypeUpdate?: (oldType: string, newType: string, defaultColor?: string) => void;
  onVehicleTypeDelete?: (type: string) => void;
  allCrews?: Crew[];
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onLogout?: () => void;
}

function DroppableCell({ id, children, className, style, onDoubleClick, onClick, disabled }: { id: string, children: React.ReactNode, className?: string, style?: React.CSSProperties, onDoubleClick?: (e: React.MouseEvent) => void, onClick?: () => void, disabled?: boolean }) {
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
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </td>
  );
}

export function CalendarGrid({ 
    items, crews, employees, vehicles, employeeAbsences = [], colorLabels, isReadOnly,
    onItemUpdate, onBatchItemUpdates, revertedPairingCellKeys = [], onClearedRevertedPairing,
    onItemCreate, onItemDelete, onItemReorder,
    onCrewCreate, onCrewUpdate, onCrewDelete,
    onEmployeeCreate, onEmployeeUpdate, onEmployeeDelete,
    onVehicleCreate, onVehicleUpdate, onVehicleDelete,
    onColorLabelUpdate, depots, allItems, vehicleTypes, vehicleCombinations = [], allCrews,
    onUndo, onRedo, canUndo, canRedo, onLogout,
    onVehicleTypeCreate, onVehicleTypeUpdate, onVehicleTypeDelete
}: CalendarGridProps) {
  const { settings } = useUISettings();
  const isCombinationLabel = (label: string | undefined) =>
    !!label && vehicleCombinations.some((c) => normalizeVehicleTypeName(c.label) === normalizeVehicleTypeName(label));
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
  // Capture selection at drag start so we move all items that were selected when drag began (avoids stale/cleared selection on drop)
  const selectionAtDragStartRef = useRef<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Generate a unique ID to avoid collisions
  const generateUniqueId = () => {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const isPersonItem = (item: ScheduleItem) => item.type === "operative" || item.type === "assistant";

  const isAutoLinkedFreeJob = (item: ScheduleItem) =>
    isFreeJobItem(item) && item.type === "job" && !!item.employeeId;
  
  // Mock Email Status State
  const [emailStatus, setEmailStatus] = useState<Record<string, { sent: boolean, timestamp?: string }>>({});
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalDate, setEmailModalDate] = useState<Date | null>(null);

  // Modal States
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'job' | 'operative' | 'assistant' | 'note';
    data?: ScheduleItem;
    target?: { date: Date; crewId: string; depotId?: string };
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

  const [employeeTimeOffConfirm, setEmployeeTimeOffConfirm] = useState<{
    open: boolean;
    payload: EmployeeTimeOffDialogPayload;
    employeeId: string;
    employeeName: string;
    impacted: Array<{
      dateIso: string;
      crewName: string;
      shift: "day" | "night" | "unknown";
      itemId: string;
    }>;
  } | null>(null);
  
  const [crewModal, setCrewModal] = useState<{ isOpen: boolean, mode: 'create' | 'edit', id?: string, name: string, shift: 'day' | 'night' }>({ isOpen: false, mode: 'create', name: "", shift: 'day' });

  // Removed auto-generate name useEffect - create mode is no longer used (users use + button directly)
  
  const [smartSearchOpen, setSmartSearchOpen] = useState(false);
  const [expandedShifts, setExpandedShifts] = useState<{ night: boolean, day: boolean }>({ night: true, day: true });

  /** Cells to run pairing for after duplicate; processed in useEffect when items update. */
  const pendingDuplicatePairingCellsRef = useRef<Array<{ date: Date; crewId: string; cellKey: string }>>([]);
  /** Cells to apply combine to without showing dialog (user already chose "Combine" for week in pairing dialog). */
  const pendingCombineApplyRef = useRef<Array<{ date: Date; crewId: string; cellKey: string }>>([]);

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
    groupedItems?: ScheduleItem[];
    onConfirm: (applyToGroup: boolean) => void;
  } | null>(null);

  // Vehicle pairing dialog state
  const [vehiclePairingDialog, setVehiclePairingDialog] = useState<{
    open: boolean;
    cellKey: string; // e.g., "2024-01-15-crew-123"
    vehiclePairing: string; // e.g., "CCTV/Jet Vac"
    crewId: string;
    date: Date;
    vehicleSignature: string;
    applyPeriod: 'none' | 'week' | 'month' | '6months' | '12months';
  } | null>(null);

  // Drag-move scope dialog for operatives/assistants (day vs remainder of week)
  const [personMoveDialog, setPersonMoveDialog] = useState<{
    open: boolean;
    activeItem: ScheduleItem;
    targetCrewId: string;
    targetDate: Date;
  } | null>(null);

  type PairingDecision = "combined" | "separate";
  type PairingDecisionEntry = {
    decision: PairingDecision;
    vehicleSignature: string;
    crewId: string;
    date: Date;
  };

  // Remember per-cell decision so we don’t prompt again unless vehicles change
  const [pairingDecisionByCell, setPairingDecisionByCell] = useState<Record<string, PairingDecisionEntry>>({});

  // When page undoes a batch-update (combine), clear pairing decision for those cells so reverted item colors show
  useEffect(() => {
    if (revertedPairingCellKeys.length === 0 || !onClearedRevertedPairing) return;
    setPairingDecisionByCell((prev) => {
      const next = { ...prev };
      revertedPairingCellKeys.forEach((ck) => delete next[ck]);
      return next;
    });
    onClearedRevertedPairing();
  }, [revertedPairingCellKeys, onClearedRevertedPairing]);

  const getVehicleSignatureForPeople = (people: ScheduleItem[]) => {
    const ids = Array.from(
      new Set(
        people
          .map((p) => p.vehicleId)
          .filter((id): id is string => Boolean(id))
      )
    );
    ids.sort();
    return ids.join(",");
  };

  const getEffectivePairingDecision = (cellKey: string, signature: string): PairingDecision | undefined => {
    const entry = pairingDecisionByCell[cellKey];
    if (!entry) return undefined;
    if (entry.vehicleSignature !== signature) return undefined;
    return entry.decision;
  };

  // Clear stale pairing decisions when vehicles in a cell change (e.g. user removed jet vac then adds again)
  // so the "Vehicle Pairing Detected" popup can fire again when they add the pairing back.
  useEffect(() => {
    const keys = Object.keys(pairingDecisionByCell);
    if (keys.length === 0) return;
    let hasStale = false;
    const next = { ...pairingDecisionByCell };
    keys.forEach((cellKey) => {
      // cellKey is "yyyy-MM-dd-crewId"
      const dateKey = cellKey.slice(0, 10);
      const crewId = cellKey.slice(11);
      if (!dateKey || !crewId || dateKey.length !== 10) return;
      const dayPeople = items.filter(
        (i: ScheduleItem) =>
          (i.type === "operative" || i.type === "assistant") &&
          i.crewId === crewId &&
          format(startOfDay(new Date(i.date)), "yyyy-MM-dd") === dateKey &&
          i.vehicleId
      ) as ScheduleItem[];
      const currentSig = getVehicleSignatureForPeople(dayPeople);
      const entry = pairingDecisionByCell[cellKey];
      if (entry && entry.vehicleSignature !== currentSig) {
        delete next[cellKey];
        hasStale = true;
      }
    });
    if (hasStale) setPairingDecisionByCell(next);
  }, [items, pairingDecisionByCell]);

  const inferCombinedPairingFromPersistedColors = (
    itemsList: ScheduleItem[],
    crewId: string,
    date: Date,
    pairingColor: string | undefined,
    signature: string
  ): boolean => {
    if (!pairingColor) return false;
    const day = startOfDay(date);
    const cellKey = `${format(day, "yyyy-MM-dd")}-${crewId}`;
    const storedDecision = getEffectivePairingDecision(cellKey, signature);
    if (storedDecision === "combined") return true;

    // If we have no stored decision (e.g. after dev restart), infer "combined" if any job in the cell
    // is already colored with the pairingColor (this color is persisted in DB for bookings and auto-Free jobs).
    const jobsInCell = itemsList.filter(
      (j) => j.type === "job" && j.crewId === crewId && isSameDay(new Date(j.date), day)
    ) as any[];
    const match = jobsInCell.find((j) => j?.color === pairingColor);
    const inferred = Boolean(match);

    return inferred;
  };

  const getDefaultColorForType = (type: string): string | undefined => {
    if (!vehicleTypes || vehicleTypes.length === 0) return undefined;
    const merged = mergeAndSortVehicleTypes(vehicleTypes);
    const targetNorm = normalizeVehicleTypeName(type);
    const found = merged.find((t) => normalizeVehicleTypeName(t.type) === targetNorm);
    return found?.defaultColor;
  };

  const getVehicleTypeColorForVehicleId = (vehicleId?: string): string | undefined => {
    if (!vehicleId) return undefined;
    const v = vehicles.find((vv) => vv.id === vehicleId);
    if (!v) return undefined;
    const normalize = (value?: string) =>
      (value || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "").replace(/\//g, "");
    const name = normalize(v.name);
    const cat = normalize(v.category);
    const type = normalize(v.vehicleType);

    // BJJ is always treated as CCTV/Van Pack for color
    if (name.includes("bjj") || cat.includes("cctvvanpack") || cat.includes("cctvvan") || type.includes("cctvvanpack") || type.includes("cctvvan")) {
      return getDefaultColorForType("CCTV/Van Pack") || v.color || undefined;
    }

    return (v.vehicleType ? getDefaultColorForType(v.vehicleType) : undefined) || v.color || undefined;
  };

  const getVehicleTypeDisplayNameFromConfig = (label: string) => {
    if (!vehicleTypes || vehicleTypes.length === 0) return label;
    const merged = mergeAndSortVehicleTypes(vehicleTypes);
    const targetNorm = normalizeVehicleTypeName(label);
    const found = merged.find((t) => normalizeVehicleTypeName(t.type) === targetNorm);
    return found?.type || label;
  };

  const getPrimaryCctvLabelForCell = (peopleItems: ScheduleItem[]) => {
    const vehicleIds = Array.from(
      new Set(peopleItems.map((p) => p.vehicleId).filter((id): id is string => Boolean(id)))
    );
    if (vehicleIds.length === 0) return undefined;
    const cellVehicles = vehicles.filter((v) => vehicleIds.includes(v.id));
    if (cellVehicles.length === 0) return undefined;

    const normalize = (value?: string) =>
      (value || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "").replace(/\//g, "");

    const isBjj = (v: (typeof cellVehicles)[number]) => {
      const name = normalize(v.name);
      const cat = normalize(v.category);
      const type = normalize(v.vehicleType);
      return name.includes("bjj") || cat.includes("bjj") || type.includes("bjj");
    };

    const hasCctvVanPack = cellVehicles.some((v) => {
      const cat = normalize(v.category);
      const type = normalize(v.vehicleType);
      const name = normalize(v.name);
      const originalCat = (v.category || "").toLowerCase();
      const originalType = (v.vehicleType || "").toLowerCase();
      return (
        cat.includes("cctvvanpack") ||
        cat.includes("cctvvan") ||
        type.includes("cctvvanpack") ||
        type.includes("cctvvan") ||
        name.includes("cctvvanpack") ||
        name.includes("cctvvan") ||
        originalCat.includes("cctv/van pack") ||
        originalCat.includes("cctv/vanpack") ||
        originalType.includes("cctv/van pack") ||
        originalType.includes("cctv/vanpack") ||
        isBjj(v)
      );
    });

    const hasCctv = cellVehicles.some((v) => {
      const cat = normalize(v.category);
      const type = normalize(v.vehicleType);
      const name = normalize(v.name);
      return cat.includes("cctv") || type.includes("cctv") || name.includes("cctv") || isBjj(v);
    });

    if (hasCctvVanPack) return getVehicleTypeDisplayNameFromConfig("CCTV/Van Pack");
    if (hasCctv) return getVehicleTypeDisplayNameFromConfig("CCTV");
    return undefined;
  };

  const getGhostVehicleLabelForCellDisplay = (peopleItems: ScheduleItem[], crewId: string, date: Date) => {
    const baseLabel = getGhostVehicleLabelForCell(peopleItems, vehicles, vehicleTypes, vehicleCombinations);
    if (!baseLabel) return undefined;

    const pairingColor = getColorForVehiclePairing(peopleItems, vehicles, vehicleTypes, vehicleCombinations);
    const cellKey = `${format(startOfDay(date), "yyyy-MM-dd")}-${crewId}`;
    const signature = getVehicleSignatureForPeople(
      peopleItems.filter((p) => isPersonItem(p) && p.vehicleId)
    );
    const decision = getEffectivePairingDecision(cellKey, signature);

    const isActionablePairing =
      isCombinationLabel(baseLabel) && !!pairingColor;

    // Only show the combined label if the user explicitly chose “Combine”
    const inferredCombined = isActionablePairing
      ? inferCombinedPairingFromPersistedColors(items, crewId, date, pairingColor, signature)
      : false;

    if (isActionablePairing && decision !== "combined" && !inferredCombined) {
      return getPrimaryCctvLabelForCell(peopleItems) || baseLabel;
    }

    return baseLabel;
  };

  const syncAutoLinkedFreeJobsForCell = (itemsSnapshot: ScheduleItem[], crewId: string, date: Date) => {
    const day = startOfDay(date);

    const cellPeopleWithVehicles = itemsSnapshot.filter(
      (i) =>
        isPersonItem(i) &&
        i.crewId === crewId &&
        isSameDay(new Date(i.date), day) &&
        !!i.employeeId &&
        !!i.vehicleId
    );

    const cellAutoFreeJobs = itemsSnapshot.filter(
      (i) =>
        isAutoLinkedFreeJob(i) &&
        i.crewId === crewId &&
        isSameDay(new Date(i.date), day)
    );

    const cellJobs = itemsSnapshot.filter(
      (i) => i.type === "job" && i.crewId === crewId && isSameDay(new Date(i.date), day)
    );
    const bookedJobsInCell = cellJobs.filter((j) => !isFreeJobItem(j));
    const bookedJobsByEmployeeId = new Map<string, number>();
    bookedJobsInCell.forEach((j: any) => {
      if (j.employeeId) {
        bookedJobsByEmployeeId.set(j.employeeId, (bookedJobsByEmployeeId.get(j.employeeId) || 0) + 1);
      }
    });

    const peopleByEmployeeId = new Map<string, ScheduleItem>();
    cellPeopleWithVehicles.forEach((p) => {
      if (p.employeeId) peopleByEmployeeId.set(p.employeeId, p);
    });

    const cellKey = `${format(day, "yyyy-MM-dd")}-${crewId}`;
    const signature = getVehicleSignatureForPeople(cellPeopleWithVehicles);
    const decision = getEffectivePairingDecision(cellKey, signature);
    const ghostVehicleLabel = getGhostVehicleLabelForCell(cellPeopleWithVehicles, vehicles, vehicleTypes, vehicleCombinations);
    const pairingColor = getColorForVehiclePairing(cellPeopleWithVehicles, vehicles, vehicleTypes, vehicleCombinations);
    const isActionablePairing =
      isCombinationLabel(ghostVehicleLabel) && !!pairingColor;
    const inferredCombined = isActionablePairing
      ? inferCombinedPairingFromPersistedColors(itemsSnapshot, crewId, day, pairingColor, signature)
      : false;
    const isCombinedPairing = isActionablePairing && (decision === "combined" || inferredCombined);

    // In combined CCTV/Jet Vac mode, we treat the unit as a single resource:
    // - If there's ANY booked job in the cell, the unit is not "Free" → remove all auto-Free jobs.
    // - If there are no booked jobs, keep exactly ONE auto-Free job for the cell.
    if (isCombinedPairing && bookedJobsInCell.length > 0) {
      let deletedStale = 0;
      const ids = cellAutoFreeJobs.map((j) => j.id);
      cellAutoFreeJobs.forEach((job) => {
        onItemDelete(job.id);
        deletedStale++;
      });

      return;
    }

    // 1) Remove stale auto-Free jobs if the person is no longer in the cell
    let deletedStale = 0;
    cellAutoFreeJobs.forEach((job) => {
      const empId = job.employeeId;
      if (!empId) return;
      if (!peopleByEmployeeId.has(empId)) {
        onItemDelete(job.id);
        deletedStale++;
      }
    });

    // 2) Ensure auto-Free jobs exist and stay aligned.
    let createdAuto = 0;
    let updatedAuto = 0;
    let deletedDupes = 0;
    let skippedBecauseBooked = 0;
    const peopleToEnsure = isCombinedPairing ? cellPeopleWithVehicles.slice(0, 1) : cellPeopleWithVehicles;

    // In combined pairing with NO booked jobs, keep exactly one auto-free job total.
    if (isCombinedPairing) {
      // Delete extra auto-free jobs (keep the first)
      cellAutoFreeJobs.slice(1).forEach((dup) => {
        onItemDelete(dup.id);
        deletedDupes++;
      });
    }

    peopleToEnsure.forEach((person) => {
      const empId = person.employeeId!;
      const jobsForPerson = isCombinedPairing ? cellAutoFreeJobs.slice(0, 1) : cellAutoFreeJobs.filter((j) => j.employeeId === empId);
      const primary = jobsForPerson[0];

      // If this employee already has a booked job in this cell/day (bookings converted from Free retain employeeId),
      // don't keep or recreate an auto-Free slot for them.
      if (!isCombinedPairing && bookedJobsByEmployeeId.has(empId)) {
        jobsForPerson.forEach((j) => {
          onItemDelete(j.id);
          deletedStale++;
        });
        skippedBecauseBooked++;
        return;
      }

      const desiredColor =
        isActionablePairing && decision === "combined"
          ? pairingColor
          : getVehicleTypeColorForVehicleId(person.vehicleId) || "blue";

      if (!primary) {
        onItemCreate({
          id: generateUniqueId(),
          type: "job",
          date: new Date(day),
          crewId,
          depotId: person.depotId || "",
          jobStatus: "free",
          customer: "Free",
          address: "Free",
          startTime: "08:00",
          duration: 8,
          color: desiredColor,
          employeeId: empId,
          vehicleId: person.vehicleId,
        });
        createdAuto++;
      } else {
        const needsVehicleUpdate = person.vehicleId && primary.vehicleId !== person.vehicleId;
        const needsColorUpdate = desiredColor && primary.color !== desiredColor;

        if (needsVehicleUpdate || needsColorUpdate) {
          onItemUpdate({
            ...primary,
            vehicleId: person.vehicleId,
            color: desiredColor,
          });
          updatedAuto++;
        }

        // Remove duplicates (keep the first)
        if (!isCombinedPairing) {
          jobsForPerson.slice(1).forEach((dup) => {
            onItemDelete(dup.id);
            deletedDupes++;
          });
        }
      }
    });

  };

  // Clear decisions if vehicles change or pairing is no longer actionable
  useEffect(() => {
    const keys = Object.keys(pairingDecisionByCell);
    if (keys.length === 0) return;

    let didChange = false;
    const next: Record<string, PairingDecisionEntry> = { ...pairingDecisionByCell };

    keys.forEach((cellKey) => {
      const entry = pairingDecisionByCell[cellKey];
      if (!entry) return;

      const cellPeopleItems = items.filter(
        (i) =>
          (i.type === "operative" || i.type === "assistant") &&
          i.crewId === entry.crewId &&
          isSameDay(new Date(i.date), entry.date) &&
          i.vehicleId
      ) as ScheduleItem[];

      const signatureNow = getVehicleSignatureForPeople(cellPeopleItems);

      // If vehicles changed, re-prompt next time
      if (signatureNow !== entry.vehicleSignature) {
        const nowIds = signatureNow ? signatureNow.split(",").filter(Boolean) : [];
        const entryIds = entry.vehicleSignature ? entry.vehicleSignature.split(",").filter(Boolean) : [];
        const entrySet = new Set(entryIds);
        const isSubset =
          nowIds.length > 0 && nowIds.every((id) => entrySet.has(id));

        // If the "current" signature is only a subset of the stored signature, treat it as inconclusive.
        // This happens right after a move/duplicate when `items` may not yet reflect all vehicles.
        if (isSubset) {
          return;
        }
        delete next[cellKey];
        didChange = true;
        return;
      }

      const ghostVehicleLabel = getGhostVehicleLabelForCell(cellPeopleItems, vehicles, vehicleTypes, vehicleCombinations);
      const pairingColor = getColorForVehiclePairing(cellPeopleItems, vehicles, vehicleTypes, vehicleCombinations);
      const isActionablePairing =
        isCombinationLabel(ghostVehicleLabel) && !!pairingColor;

      if (!isActionablePairing) {
        delete next[cellKey];
        didChange = true;
      }
    });

    if (didChange) {
      setPairingDecisionByCell(next);
    }
  }, [pairingDecisionByCell, items, vehicles, vehicleTypes]);

  

  const [crewDeleteDialog, setCrewDeleteDialog] = useState<{
    open: boolean;
    crewId: string;
    crewName: string;
    hasPastItems: boolean;
    hasFutureItems: boolean;
    futureItemsCount: number;
    futureItems: Array<{ id: string; type: string; date: string; displayDate: string; customer?: string; employeeId?: string }>;
    previousCrewId: string | null;
    onConfirm: (moveItemsUp: boolean) => void;
  } | null>(null);

  const [crewDeleteErrorDialog, setCrewDeleteErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  } | null>(null);

  const [scheduleDeleteConfirm, setScheduleDeleteConfirm] = useState<{
    open: boolean;
    message: string;
    count: number;
    onConfirm: () => void;
  } | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: viewDays }).map((_, i) => addDays(weekStart, i));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // --- DRAG AND DROP ---
  const isEmployeeOnHoliday = (employeeId: string | undefined | null, date: Date) => {
    if (!employeeId) return false;
    const day = startOfDay(date);
    return (employeeAbsences || [])
      .filter((a) => a && a.employeeId === employeeId && a.absenceType === "holiday")
      .some((a) => {
        const start = startOfDay(new Date(a.startDate));
        const end = startOfDay(new Date(a.endDate));
        return (
          (isSameDay(day, start) || isAfter(day, start)) &&
          (isSameDay(day, end) || isBefore(day, end))
        );
      });
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (isReadOnly) return;
    const activeItem = items.find(i => i.id === event.active.id);
    if (activeItem && isBefore(startOfDay(new Date(activeItem.date)), startOfDay(new Date()))) return;

    selectionAtDragStartRef.current = new Set(selectedItemIds);
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

        // Prevent scheduling on holiday dates (date-based availability).
        if ((activeItem.type === "operative" || activeItem.type === "assistant") && isEmployeeOnHoliday(activeItem.employeeId, newDate)) {
          setCrewDeleteErrorDialog({
            open: true,
            title: "Employee unavailable",
            message: "This employee is booked as holiday for that date range. Pick another day or clear/update their holiday booking.",
          });
          setActiveId(null);
          return;
        }

        if (isCtrlPressed) {
             // Duplicate
             // Detect if this drop action would create an actionable pairing in the TARGET cell.
             // (We intentionally do this only in response to a user action, not on page load.)
             if (!vehiclePairingDialog?.open) {
               const simulatedPeopleItems = [
                 ...items.filter(
                   (i) =>
                     (i.type === "operative" || i.type === "assistant") &&
                     i.crewId === targetCrewId &&
                     isSameDay(new Date(i.date), newDate) &&
                     i.vehicleId
                 ),
                 ...(activeItem.type === "operative" || activeItem.type === "assistant"
                   ? [{ ...activeItem, crewId: targetCrewId, date: newDate }]
                   : []),
               ] as ScheduleItem[];

               const ghostVehicleLabel = getGhostVehicleLabelForCell(simulatedPeopleItems, vehicles, vehicleTypes, vehicleCombinations);
               const pairingColor = getColorForVehiclePairing(simulatedPeopleItems, vehicles, vehicleTypes, vehicleCombinations);
               const targetCellJobs = items.filter(
                 (i) =>
                   i.type === "job" &&
                   i.crewId === targetCrewId &&
                   isSameDay(new Date(i.date), newDate)
               );
               const freeCount = targetCellJobs.filter(isFreeJobItem).length;
               const bookedCount = targetCellJobs.filter((j) => !isFreeJobItem(j)).length;
               const hasAnyJobsInCell = targetCellJobs.length > 0; // Free counts as a job here
               const cellKey = `${targetDateStr}-${targetCrewId}`;
               const signature = getVehicleSignatureForPeople(simulatedPeopleItems);
               const decision = getEffectivePairingDecision(cellKey, signature);

               // (debug logs removed)

               const isActionablePairing =
                 isCombinationLabel(ghostVehicleLabel) &&
                 !!pairingColor;

               if (isActionablePairing) {
                 if (settings.promptVehiclePairingDetected && hasAnyJobsInCell && !decision) {
                   setVehiclePairingDialog({
                     open: true,
                     cellKey,
                     vehiclePairing: ghostVehicleLabel!,
                     crewId: targetCrewId,
                     date: newDate,
                     vehicleSignature: signature,
                     applyPeriod: "none",
                   });
                 } else {
                   autoCombineVehiclePairing({
                     cellKey,
                     vehiclePairing: ghostVehicleLabel!,
                     crewId: targetCrewId,
                     date: newDate,
                     vehicleSignature: signature,
                    applyPeriod: "none",
                   });
                 }
               }
             }

             onItemCreate({
                ...activeItem,
                id: generateUniqueId(),
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
             } else if (isSameCell && !isDroppingOnItem) {
                 // Dropped back onto the same cell whitespace; no reordering occurs (current behavior).
             } else if (!isSameCell) {
                 // Move all items that were selected when the drag started: change row (crew) only, keep each item's day.
                 const selectionAtStart = selectionAtDragStartRef.current;
                 if (selectionAtStart.has(activeItem.id) && selectionAtStart.size > 1) {
                   const toMove = Array.from(selectionAtStart)
                     .map((id) => items.find((i) => i.id === id))
                     .filter((item): item is ScheduleItem => item != null);
                   toMove.forEach((item) =>
                     onItemUpdate({ ...item, crewId: targetCrewId })
                   );
                   setActiveId(null);
                   return;
                 }
                 // For people items, optionally prompt for scope (day vs remainder of week) and move linked Free jobs too.
                 if (isPersonItem(activeItem)) {
                   if (settings.promptOperativeMoveScope) {
                     setPersonMoveDialog({
                       open: true,
                       activeItem,
                       targetCrewId,
                       targetDate: newDate,
                     });
                     setActiveId(null);
                     return;
                   }

                   // If prompt is disabled, default to day-only move.
                   performPersonMove(activeItem, targetCrewId, newDate, "day");
                   setActiveId(null);
                   return;
                 }

                 // Detect if this move action would create an actionable pairing in the TARGET cell.
                 if (!vehiclePairingDialog?.open) {
                   const simulatedPeopleItems = [
                     ...items.filter(
                       (i) =>
                         (i.type === "operative" || i.type === "assistant") &&
                         i.crewId === targetCrewId &&
                         isSameDay(new Date(i.date), newDate) &&
                         i.vehicleId
                     ),
                     ...(activeItem.type === "operative" || activeItem.type === "assistant"
                       ? [{ ...activeItem, crewId: targetCrewId, date: newDate }]
                       : []),
                   ] as ScheduleItem[];

                   const ghostVehicleLabel = getGhostVehicleLabelForCell(simulatedPeopleItems, vehicles, vehicleTypes, vehicleCombinations);
                   const pairingColor = getColorForVehiclePairing(simulatedPeopleItems, vehicles, vehicleTypes, vehicleCombinations);
                   const targetCellJobs = items.filter(
                     (i) =>
                       i.type === "job" &&
                       i.crewId === targetCrewId &&
                       isSameDay(new Date(i.date), newDate)
                   );
                   const freeCount = targetCellJobs.filter(isFreeJobItem).length;
                   const bookedCount = targetCellJobs.filter((j) => !isFreeJobItem(j)).length;
                   const hasAnyJobsInCell = targetCellJobs.length > 0; // Free counts as a job here
                   const cellKey = `${targetDateStr}-${targetCrewId}`;
                   const signature = getVehicleSignatureForPeople(simulatedPeopleItems);
                   const decision = getEffectivePairingDecision(cellKey, signature);

                   // (debug logs removed)

                   const isActionablePairing =
                     isCombinationLabel(ghostVehicleLabel) &&
                     !!pairingColor;

                   if (isActionablePairing) {
                     if (settings.promptVehiclePairingDetected && hasAnyJobsInCell && !decision) {
                       setVehiclePairingDialog({
                         open: true,
                         cellKey,
                         vehiclePairing: ghostVehicleLabel!,
                         crewId: targetCrewId,
                         date: newDate,
                         vehicleSignature: signature,
                         applyPeriod: "none",
                       });
                     } else {
                       autoCombineVehiclePairing({
                         cellKey,
                         vehiclePairing: ghostVehicleLabel!,
                         crewId: targetCrewId,
                         date: newDate,
                         vehicleSignature: signature,
                        applyPeriod: "none",
                       });
                     }
                   }
                 }
                 // Move to new cell (single item)
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
      const crew = crews.find(c => c.id === selectionMenu.crewId);
      const isNight = crew?.shift === 'night';
      const defaultStart = isNight ? settings.defaultNightStartTime : settings.defaultDayStartTime;
      // Keep onsite one hour after start by default
      const [h, m] = (defaultStart || "08:00").split(":").map(Number);
      const onsiteDate = new Date(2000, 0, 1, h ?? 8, m ?? 0);
      onsiteDate.setHours(onsiteDate.getHours() + 1);
      const onsiteTime = `${onsiteDate.getHours().toString().padStart(2, "0")}:${onsiteDate
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      const baseItem: ScheduleItem = {
        id: generateUniqueId(),
        type: 'job',
        date: selectionMenu.date,
        crewId: selectionMenu.crewId,
        // depotId is intentionally left blank; parent handler will inject selected depot
        depotId: "",
        jobStatus: 'free',
        customer: 'Free',
        address: 'Free',
        startTime: defaultStart || '08:00',
        onsiteTime,
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
              // If clicking (no shift) on an item that is already in a multi-selection, keep selection so drag moves all
              if (prev.size > 1 && prev.has(id)) return prev;
              const single = new Set<string>();
              single.add(id);
              return single;
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
      const futureItemsDetails = futureItems.map((item, idx) => {
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
          id: item.id || `future-item-${idx}-${Date.now()}`,
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

  // Handle vehicle pairing dialog confirm
  const handleVehiclePairingConfirm = () => {
    if (!vehiclePairingDialog) return;
    
    const { crewId, date, vehicleSignature, applyPeriod } = vehiclePairingDialog;
    const startDate = startOfDay(new Date(date));

    // When applying to week/month/etc., queue each day's cell so the effect runs with current items
    // (avoids stale items so every day gets combine applied consistently)
    if (applyPeriod && applyPeriod !== "none") {
      let endDate: Date = startDate;
      if (applyPeriod === "week") {
        const triggerWeekStart = startOfWeek(startDate, { weekStartsOn: 1 });
        endDate = addDays(triggerWeekStart, viewDays - 1);
        if (isBefore(endDate, startDate)) endDate = startDate;
      } else if (applyPeriod === "month" || applyPeriod === "6months" || applyPeriod === "12months") {
        endDate = calculateWeekdayEndDate(startDate, applyPeriod);
      }
      const skipWeekends = applyPeriod === "month" || applyPeriod === "6months" || applyPeriod === "12months";
      const touchedDates: Date[] = [];
      let d = new Date(startDate);
      let safety = 0;
      while ((isBefore(d, endDate) || isSameDay(d, endDate)) && safety < 5000) {
        if (!skipWeekends || isWeekday(d)) {
          touchedDates.push(new Date(d));
        }
        d = addDays(d, 1);
        safety++;
      }
      const weekCells = touchedDates.map((dt) => ({
        date: dt,
        crewId,
        cellKey: `${format(dt, "yyyy-MM-dd")}-${crewId}`,
      }));
      pendingCombineApplyRef.current = weekCells;
      setVehiclePairingDialog(null);
      return;
    }

    // Single-day apply (only reached when applyPeriod is "none")
    const applyAcrossPeriod = () => {
      const startDateLocal = startOfDay(new Date(date));
      const touchedDates: Date[] = [new Date(startDateLocal)];

      // Persist decision per-date cellKey so the UI stays combined across the period
      setPairingDecisionByCell((prev) => {
        const next = { ...prev };
        touchedDates.forEach((dt) => {
          const dateKey = format(dt, "yyyy-MM-dd");
          const ck = `${dateKey}-${crewId}`;
          // Recompute signature per day in case the cell differs; fall back to triggering signature
          const dayPeople = items.filter(
            (i: ScheduleItem) =>
              (i.type === "operative" || i.type === "assistant") &&
              i.crewId === crewId &&
              isSameDay(new Date(i.date), dt) &&
              i.vehicleId
          ) as ScheduleItem[];
          const daySig = dayPeople.length ? getVehicleSignatureForPeople(dayPeople) : vehicleSignature;
          next[ck] = { decision: "combined", vehicleSignature: daySig, crewId, date: dt };
        });
        return next;
      });

      // Collect all job color updates for this combine so one Undo reverts the whole operation
      const batchUpdates: { item: ScheduleItem; previousItem: ScheduleItem }[] = [];
      touchedDates.forEach((dt) => {
        const dayPeople = items.filter(
          (i: ScheduleItem) =>
            (i.type === "operative" || i.type === "assistant") &&
            i.crewId === crewId &&
            isSameDay(new Date(i.date), dt) &&
            i.vehicleId
        ) as ScheduleItem[];
        const pairingColor = getColorForVehiclePairing(dayPeople, vehicles, vehicleTypes, vehicleCombinations);
        if (!pairingColor) return;

        const cellJobs = items.filter(
          (i: ScheduleItem) => i.type === "job" && i.crewId === crewId && isSameDay(new Date(i.date), dt)
        );
        const bookedJobs = cellJobs.filter((j) => j.customer !== "Free" && j.jobStatus !== "free");
        const seedJobs = bookedJobs.length > 0 ? bookedJobs : cellJobs;
        const idsToUpdate = new Set<string>();
        seedJobs.forEach((job) => {
          const groupItems = findItemsWithSameJobNumber(job);
          groupItems.forEach((g) => idsToUpdate.add(g.id));
        });
        if (idsToUpdate.size === 0) {
          seedJobs.forEach((j) => idsToUpdate.add(j.id));
        }
        idsToUpdate.forEach((id) => {
          const previousItem = items.find((i) => i.id === id);
          if (previousItem && previousItem.type === "job" && previousItem.color !== pairingColor) {
            batchUpdates.push({ item: { ...previousItem, color: pairingColor }, previousItem });
          }
        });
      });
      if (batchUpdates.length > 0) {
        if (onBatchItemUpdates) {
          onBatchItemUpdates(batchUpdates);
        } else {
          batchUpdates.forEach(({ item }) => onItemUpdate(item));
        }
      }
    };

    applyAcrossPeriod();
    
    setVehiclePairingDialog(null);
  };

  const autoCombineVehiclePairing = (payload: {
    cellKey: string;
    crewId: string;
    date: Date;
    vehicleSignature: string;
    vehiclePairing: string;
    applyPeriod?: 'none' | 'week' | 'month' | '6months' | '12months';
  }) => {
    const { crewId, date, vehicleSignature } = payload;
    const applyPeriod = payload.applyPeriod ?? "none";

    const startDate = startOfDay(new Date(date));
    let endDate: Date = startDate;
    if (applyPeriod === "week") {
      const triggerWeekStart = startOfWeek(startDate, { weekStartsOn: 1 });
      endDate = addDays(triggerWeekStart, viewDays - 1);
      if (isBefore(endDate, startDate)) endDate = startDate;
    } else if (applyPeriod === "month" || applyPeriod === "6months" || applyPeriod === "12months") {
      endDate = calculateWeekdayEndDate(startDate, applyPeriod);
    }
    const skipWeekends = applyPeriod === "month" || applyPeriod === "6months" || applyPeriod === "12months";

    const touchedDates: Date[] = [];
    let d = new Date(startDate);
    let safety = 0;
    while ((isBefore(d, endDate) || isSameDay(d, endDate)) && safety < 5000) {
      if (!skipWeekends || isWeekday(d)) {
        touchedDates.push(new Date(d));
      }
      d = addDays(d, 1);
      safety++;
    }

    setPairingDecisionByCell((prev) => {
      const next = { ...prev };
      touchedDates.forEach((dt) => {
        const dateKey = format(dt, "yyyy-MM-dd");
        const ck = `${dateKey}-${crewId}`;
        // For period auto-combine, always store the triggering signature for every touched day.
        // This avoids persisting a partial signature on later days when `items` is not yet updated,
        // which would make the decision fail to match once both vehicles are present.
        next[ck] = { decision: "combined", vehicleSignature, crewId, date: dt };
      });
      return next;
    });

    const batchUpdates: { item: ScheduleItem; previousItem: ScheduleItem }[] = [];
    touchedDates.forEach((dt) => {
      const dayPeople = items.filter(
        (i: ScheduleItem) =>
          (i.type === "operative" || i.type === "assistant") &&
          i.crewId === crewId &&
          isSameDay(new Date(i.date), dt) &&
          i.vehicleId
      ) as ScheduleItem[];
      const pairingColor = getColorForVehiclePairing(dayPeople, vehicles, vehicleTypes, vehicleCombinations);
      if (!pairingColor) return;

      const cellJobs = items.filter(
        (i: ScheduleItem) => i.type === "job" && i.crewId === crewId && isSameDay(new Date(i.date), dt)
      );
      const bookedJobs = cellJobs.filter((j) => j.customer !== "Free" && j.jobStatus !== "free");
      const seedJobs = bookedJobs.length > 0 ? bookedJobs : cellJobs;
      const idsToUpdate = new Set<string>();
      seedJobs.forEach((job) => {
        const groupItems = findItemsWithSameJobNumber(job);
        groupItems.forEach((g) => idsToUpdate.add(g.id));
      });
      if (idsToUpdate.size === 0) {
        seedJobs.forEach((j) => idsToUpdate.add(j.id));
      }
      idsToUpdate.forEach((id) => {
        const previousItem = items.find((i) => i.id === id);
        if (previousItem && previousItem.type === "job" && previousItem.color !== pairingColor) {
          batchUpdates.push({ item: { ...previousItem, color: pairingColor }, previousItem });
        }
      });
    });
    if (batchUpdates.length > 0) {
      if (onBatchItemUpdates) {
        onBatchItemUpdates(batchUpdates);
      } else {
        batchUpdates.forEach(({ item }) => onItemUpdate(item));
      }
    }
  };
  
  // Handle vehicle pairing dialog cancel
  const handleVehiclePairingCancel = () => {
    if (!vehiclePairingDialog) return;
    const { cellKey, crewId, date, vehicleSignature } = vehiclePairingDialog;
    
    // Remember “Keep Separate” so it won’t prompt again for this cell unless vehicles change
    setPairingDecisionByCell((prev) => ({
      ...prev,
      [cellKey]: {
        decision: "separate",
        vehicleSignature,
        crewId,
        date,
      },
    }));
    setVehiclePairingDialog(null);
  };

  // After duplicating operative+vehicle for the week, or after user chose "Combine" for week in pairing dialog, run pairing per cell once items have updated.
  useEffect(() => {
    // User already chose "Combine" for week in the dialog: apply combine in one batch (single setState + single batch update) so all days get the decision and job colors.
    const combineCells = pendingCombineApplyRef.current;
    if (combineCells.length > 0) {
      const dayStrForDate = (d: Date) => format(startOfDay(d), "yyyy-MM-dd");
      const allReady = combineCells.every(({ date, crewId }) =>
        items.some(
          (i: ScheduleItem) =>
            (i.type === "operative" || i.type === "assistant") &&
            i.crewId === crewId &&
            itemDateToCalendarDay(i.date) === dayStrForDate(date) &&
            !!i.vehicleId
        )
      );
      const decisionUpdates: Record<string, { decision: "combined"; vehicleSignature: string; crewId: string; date: Date }> = {};
      const batchUpdates: { item: ScheduleItem; previousItem: ScheduleItem }[] = [];
      let weekSignature: string | null = null;
      combineCells.forEach(({ date, crewId, cellKey }) => {
        const dayStr = dayStrForDate(date);
        const cellPeople = items.filter(
          (i: ScheduleItem) =>
            (i.type === "operative" || i.type === "assistant") &&
            i.crewId === crewId &&
            itemDateToCalendarDay(i.date) === dayStr &&
            !!i.vehicleId
        );
        const pairingColor = getColorForVehiclePairing(cellPeople, vehicles, vehicleTypes, vehicleCombinations);
        const signature = getVehicleSignatureForPeople(cellPeople);
        const ghostVehicleLabel = getGhostVehicleLabelForCell(cellPeople, vehicles, vehicleTypes, vehicleCombinations);
        const hasPairing = isCombinationLabel(ghostVehicleLabel) && !!pairingColor;
        if (hasPairing && !weekSignature) weekSignature = signature;
        if (hasPairing) {
          const cellJobs = items.filter(
            (i: ScheduleItem) => i.type === "job" && i.crewId === crewId && itemDateToCalendarDay(i.date) === dayStr
          );
          const bookedJobs = cellJobs.filter((j) => j.customer !== "Free" && j.jobStatus !== "free");
          const seedJobs = bookedJobs.length > 0 ? bookedJobs : cellJobs;
          const idsToUpdate = new Set<string>();
          seedJobs.forEach((job) => {
            const groupItems = findItemsWithSameJobNumber(job);
            groupItems.forEach((g) => idsToUpdate.add(g.id));
          });
          if (idsToUpdate.size === 0) seedJobs.forEach((j) => idsToUpdate.add(j.id));
          idsToUpdate.forEach((id) => {
            const previousItem = items.find((i) => i.id === id);
            if (previousItem && previousItem.type === "job" && previousItem.color !== pairingColor) {
              batchUpdates.push({ item: { ...previousItem, color: pairingColor }, previousItem });
            }
          });
        }
      });
      if (weekSignature) {
        combineCells.forEach(({ date, crewId, cellKey }) => {
          decisionUpdates[cellKey] = { decision: "combined", vehicleSignature: weekSignature!, crewId, date };
        });
        if (Object.keys(decisionUpdates).length > 0) {
          setPairingDecisionByCell((prev) => ({ ...prev, ...decisionUpdates }));
          if (batchUpdates.length > 0) {
            if (onBatchItemUpdates) {
              onBatchItemUpdates(batchUpdates);
            } else {
              batchUpdates.forEach(({ item }) => onItemUpdate(item));
            }
          }
        }
      }
      if (allReady) pendingCombineApplyRef.current = [];
      return;
    }

    const cells = pendingDuplicatePairingCellsRef.current;
    if (cells.length === 0) return;
    const allCellsReady = cells.every(({ date, crewId }) =>
      items.some(
        (i: ScheduleItem) =>
          (i.type === "operative" || i.type === "assistant") &&
          i.crewId === crewId &&
          isSameDay(new Date(i.date), date) &&
          !!i.vehicleId
      )
    );
    if (!allCellsReady) return;
    cells.forEach(({ date, crewId, cellKey }) => {
      const cellPeople = items.filter(
        (i: ScheduleItem) =>
          (i.type === "operative" || i.type === "assistant") &&
          i.crewId === crewId &&
          isSameDay(new Date(i.date), date) &&
          !!i.vehicleId
      );
      const ghostVehicleLabel = getGhostVehicleLabelForCell(cellPeople, vehicles, vehicleTypes, vehicleCombinations);
      const pairingColor = getColorForVehiclePairing(cellPeople, vehicles, vehicleTypes, vehicleCombinations);
      const signature = getVehicleSignatureForPeople(cellPeople);
      if (isCombinationLabel(ghostVehicleLabel) && pairingColor && !vehiclePairingDialog?.open) {
        if (settings.promptVehiclePairingDetected && !getEffectivePairingDecision(cellKey, signature)) {
          setVehiclePairingDialog({
            open: true,
            cellKey,
            vehiclePairing: ghostVehicleLabel!,
            crewId,
            date,
            vehicleSignature: signature,
            applyPeriod: "none",
          });
        } else {
          autoCombineVehiclePairing({
            cellKey,
            vehiclePairing: ghostVehicleLabel!,
            crewId,
            date,
            vehicleSignature: signature,
            applyPeriod: "none",
          });
        }
      }
    });
    pendingDuplicatePairingCellsRef.current = [];
  }, [items, vehiclePairingDialog?.open, settings.promptVehiclePairingDetected, vehicles, vehicleTypes, vehicleCombinations]);

  // When "Vehicle Pairing Detected" prompt is off, default actionable pairings to combined: run autoCombine for any cell that has no decision yet.
  useEffect(() => {
    if (settings.promptVehiclePairingDetected || vehiclePairingDialog?.open) return;
    const cellKeys = new Set<string>();
    items.forEach((i: ScheduleItem) => {
      if ((i.type === "operative" || i.type === "assistant") && i.crewId && i.vehicleId && i.date) {
        const d = startOfDay(new Date(i.date));
        cellKeys.add(`${format(d, "yyyy-MM-dd")}-${i.crewId}`);
      }
    });
    cellKeys.forEach((cellKey) => {
      const [dateKey, crewId] = [cellKey.slice(0, 10), cellKey.slice(11)];
      if (!dateKey || !crewId) return;
      const day = new Date(dateKey + "T12:00:00");
      const cellPeople = items.filter(
        (i: ScheduleItem) =>
          (i.type === "operative" || i.type === "assistant") &&
          i.crewId === crewId &&
          isSameDay(new Date(i.date), day) &&
          !!i.vehicleId
      );
      const ghostVehicleLabel = getGhostVehicleLabelForCell(cellPeople, vehicles, vehicleTypes, vehicleCombinations);
      const pairingColor = getColorForVehiclePairing(cellPeople, vehicles, vehicleTypes, vehicleCombinations);
      const signature = getVehicleSignatureForPeople(cellPeople);
      const decision = getEffectivePairingDecision(cellKey, signature);
      if (isCombinationLabel(ghostVehicleLabel) && pairingColor && decision === undefined) {
        autoCombineVehiclePairing({
          cellKey,
          vehiclePairing: ghostVehicleLabel!,
          crewId,
          date: day,
          vehicleSignature: signature,
          applyPeriod: "none",
        });
      }
    });
  }, [items, settings.promptVehiclePairingDetected, vehiclePairingDialog?.open, vehicles, vehicleTypes, vehicleCombinations]);

  const performPersonMove = (activeItem: ScheduleItem, targetCrewId: string, targetDate: Date, scope: "day" | "week") => {
    const sourceDate = startOfDay(new Date(activeItem.date));
    const targetDateStart = startOfDay(new Date(targetDate));
    const dayMs = 1000 * 60 * 60 * 24;
    const dateDiff = Math.round((targetDateStart.getTime() - sourceDate.getTime()) / dayMs);

    const viewEnd = addDays(weekStart, viewDays - 1);
    const weekStartNorm = startOfDay(weekStart);

    const peopleToMove =
      scope === "day"
        ? [activeItem]
        : items.filter((i) => {
            if (!isPersonItem(i)) return false;
            if (!activeItem.employeeId || i.employeeId !== activeItem.employeeId) return false;
            if (i.crewId !== activeItem.crewId) return false;
            const d = startOfDay(new Date(i.date));
            return (isSameDay(d, weekStartNorm) || isAfter(d, weekStartNorm)) && (isSameDay(d, viewEnd) || isBefore(d, viewEnd));
          });

    let itemsAfter = [...items];
    const touchedCells = new Map<string, { crewId: string; date: Date }>();
    const touch = (crewId: string, date: Date) => {
      const d = startOfDay(date);
      touchedCells.set(`${crewId}|${format(d, "yyyy-MM-dd")}`, { crewId, date: d });
    };

    peopleToMove.forEach((person) => {
      const personSourceDate = startOfDay(new Date(person.date));
      const personTargetDate = scope === "day" ? targetDateStart : personSourceDate;

      // Touch both source and destination cells for sync
      touch(person.crewId, personSourceDate);
      touch(targetCrewId, personTargetDate);

      // Move the person
      const movedPerson = { ...person, crewId: targetCrewId, date: personTargetDate };
      onItemUpdate(movedPerson);
      itemsAfter = itemsAfter.map((i) => (i.id === movedPerson.id ? movedPerson : i));

      // Move linked auto-Free jobs for that person/day
      if (person.employeeId) {
        const linkedFreeJobs = itemsAfter.filter(
          (i) =>
            isAutoLinkedFreeJob(i) &&
            i.crewId === person.crewId &&
            isSameDay(new Date(i.date), personSourceDate) &&
            i.employeeId === person.employeeId
        );

        linkedFreeJobs.forEach((job) => {
          const movedJob = { ...job, crewId: targetCrewId, date: personTargetDate };
          onItemUpdate(movedJob);
          itemsAfter = itemsAfter.map((i) => (i.id === movedJob.id ? movedJob : i));
        });
      }
    });

    // Re-sync touched cells so the ghost/free jobs reflect the final operative+vehicle state
    touchedCells.forEach(({ crewId, date }) => {
      syncAutoLinkedFreeJobsForCell(itemsAfter, crewId, date);
    });

    // After move, re-check the destination for actionable pairing and prompt if needed (single-day target)
    const destPeople = itemsAfter.filter(
      (i) =>
        isPersonItem(i) &&
        i.crewId === targetCrewId &&
        isSameDay(new Date(i.date), targetDateStart) &&
        i.vehicleId
    ) as ScheduleItem[];

    const ghostVehicleLabel = getGhostVehicleLabelForCell(destPeople, vehicles, vehicleTypes, vehicleCombinations);
    const pairingColor = getColorForVehiclePairing(destPeople, vehicles, vehicleTypes, vehicleCombinations);
    const destJobs = itemsAfter.filter(
      (i) => i.type === "job" && i.crewId === targetCrewId && isSameDay(new Date(i.date), targetDateStart)
    );
    const hasAnyJobsInCell = destJobs.length > 0;
    const destCellKey = `${format(targetDateStart, "yyyy-MM-dd")}-${targetCrewId}`;
    const signature = getVehicleSignatureForPeople(destPeople);
    const decision = getEffectivePairingDecision(destCellKey, signature);

    const isActionablePairing =
      isCombinationLabel(ghostVehicleLabel) &&
      !!pairingColor;

    if (isActionablePairing && !vehiclePairingDialog?.open) {
      const pairingApplyPeriod = scope === "week" ? "week" : "none";
      if (settings.promptVehiclePairingDetected && hasAnyJobsInCell && !decision) {
        setVehiclePairingDialog({
          open: true,
          cellKey: destCellKey,
          vehiclePairing: ghostVehicleLabel!,
          crewId: targetCrewId,
          date: targetDateStart,
          vehicleSignature: signature,
          applyPeriod: pairingApplyPeriod,
        });
      } else {
        autoCombineVehiclePairing({
          cellKey: destCellKey,
          vehiclePairing: ghostVehicleLabel!,
          crewId: targetCrewId,
          date: targetDateStart,
          vehicleSignature: signature,
          applyPeriod: pairingApplyPeriod,
        });
      }
    }
  };

  const applyPersonMove = (scope: "day" | "week") => {
    if (!personMoveDialog) return;
    const { activeItem, targetCrewId, targetDate } = personMoveDialog;
    performPersonMove(activeItem, targetCrewId, targetDate, scope);
    setPersonMoveDialog(null);
  };

  const handleEmployeeTimeOffApplied = (payload: EmployeeTimeOffDialogPayload) => {
    if (!employeeTimeOffModal.employeeId) return;

    const employeeId = employeeTimeOffModal.employeeId;
    const employeeName = employeeTimeOffModal.employeeName;
    const today = startOfDay(new Date());
    const start = startOfDay(payload.startDate);
    const end = startOfDay(payload.endDate);

    const impacted = items
      .filter((item) => item.employeeId === employeeId)
      .filter((item) => item.type === "operative" || item.type === "assistant")
      .filter((item) => {
        const itemDate = startOfDay(new Date(item.date));
        if (isBefore(itemDate, today)) return false;
        const inRange =
          (isSameDay(itemDate, start) || isAfter(itemDate, start)) &&
          (isSameDay(itemDate, end) || isBefore(itemDate, end));
        return inRange;
      })
      .map((item) => {
        const crew = crews.find((c) => c.id === item.crewId);
        const shift: "day" | "night" | "unknown" =
          crew?.shift === "night" ? "night" : crew?.shift === "day" ? "day" : "unknown";
        return {
          dateIso: format(startOfDay(new Date(item.date)), "yyyy-MM-dd"),
          crewName: crew?.name || "Unknown crew",
          shift,
          itemId: item.id,
        };
      })
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));

    setEmployeeTimeOffConfirm({
      open: true,
      payload,
      employeeId,
      employeeName,
      impacted,
    });
  };

  const applyEmployeeTimeOffConfirmed = async (confirm: NonNullable<typeof employeeTimeOffConfirm>) => {
    const payload = confirm.payload;
    const employeeId = confirm.employeeId;
    const start = startOfDay(payload.startDate);
    const end = startOfDay(payload.endDate);
    const today = startOfDay(new Date());

    // Remove assignments in range (future only).
    items.forEach((item) => {
      if (item.employeeId !== employeeId) return;
      if (item.type !== "operative" && item.type !== "assistant") return;

      const itemDate = startOfDay(new Date(item.date));
      if (isBefore(itemDate, today)) return;
      const inRange =
        (isSameDay(itemDate, start) || isAfter(itemDate, start)) &&
        (isSameDay(itemDate, end) || isBefore(itemDate, end));
      if (!inRange) return;

      // Delete linked Free jobs in that cell too.
      if (isPersonItem(item) && item.employeeId) {
        const cellDate = startOfDay(new Date(item.date));
        const linkedFreeJobs = items.filter(
          (i) =>
            isAutoLinkedFreeJob(i) &&
            i.crewId === item.crewId &&
            isSameDay(new Date(i.date), cellDate) &&
            i.employeeId === item.employeeId
        );
        linkedFreeJobs.forEach((j) => onItemDelete(j.id));
      }

      onItemDelete(item.id);
    });

    // Persist absence record for holiday/sick.
    if (payload.absenceType === "holiday" || payload.absenceType === "sick") {
      await fetch("/api/employee-absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          absenceType: payload.absenceType,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        }),
      }).catch(() => {});
    }

    // Sickness: mark employee unavailable until manually cleared.
    if (payload.absenceType === "sick") {
      const emp = employees.find((e) => e.id === employeeId);
      const name = emp?.name || confirm.employeeName || "Employee";
      onEmployeeUpdate(employeeId, name, "sick");
    }

    setEmployeeTimeOffModal((prev) => ({ ...prev, open: false }));
    setEmployeeTimeOffConfirm(null);
  };

  const handleOpenItemModal = (initialData: Partial<ScheduleItem>) => {
    setModalState({
      isOpen: true,
      type: initialData.type || 'job',
      data: initialData as ScheduleItem,
    });
  };

  const handleEditItem = (item: ScheduleItem) => {
    // Check if this is a virtual remaining free time ghost item (not in database)
    const isRemainingFreeTimeGhost = item.id?.startsWith('free-remaining-');
    
    // For remaining-free ghosts (virtual, not DB-backed), open the Job modal in CREATE mode,
    // prefilled with the time window so the user can convert it into a real booking.
    if (isRemainingFreeTimeGhost) {
      // Create a new job payload WITHOUT an id so it goes through the CREATE path
      // IMPORTANT: don't force customer/address/jobStatus/color to Free/gray here; the user is booking time.
      const { id, customer, address, jobStatus, color, ...rest } = item as any;
      const newJobData: Partial<ScheduleItem> = {
        ...rest,
      };

      // Open the modal to create this new job; handleModalSubmit will treat data-without-id as CREATE
      setModalState({
        isOpen: true,
        type: 'job',
        data: newJobData as ScheduleItem,
      });
      return;
    }
    
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

  const handleDuplicateItem = (item: ScheduleItem, mode: 'single' | 'week' | 'following_week' | 'custom' | 'remainder_month' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months' | 'remainder_year' = 'single', days = 1, skipSelectedCheck = false) => {
    if (isReadOnly) return;

    // Determine which items to process
    // If skipSelectedCheck is true (called from handleDuplicateSelected), only process this one item
    // Otherwise, if item is selected, process all selected items
    const targetItems = (skipSelectedCheck || !selectedItemIds.has(item.id))
        ? [item]
        : items.filter(i => selectedItemIds.has(i.id));

    const itemsToCreate: ScheduleItem[] = [];

    targetItems.forEach(sourceItem => {
        const startDate = new Date(sourceItem.date);
        
        if (mode === 'single') {
             itemsToCreate.push({ ...sourceItem, id: generateUniqueId() });
        } else if (mode === 'week') {
            // Duplicate for remainder of the displayed week
            const currentViewEnd = addDays(weekStart, viewDays - 1);
            let nextDate = addDays(startDate, 1);
            
            while (isSameDay(nextDate, currentViewEnd) || isBefore(nextDate, currentViewEnd)) {
                itemsToCreate.push({
                    ...sourceItem,
                    id: generateUniqueId(),
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
                    id: generateUniqueId(),
                    date: addDays(nextWeekStart, i)
                });
            }
        } else if (mode === 'custom') {
            // Duplicate for X days
            for (let i = 1; i <= days; i++) {
                 itemsToCreate.push({
                    ...sourceItem,
                    id: generateUniqueId(),
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
                    id: generateUniqueId(),
                    date: new Date(nextDate)
                });
                nextDate = addDays(nextDate, 1);
                safetyCounter++;
            }
        }
    });

    // When duplicating an operative (or assistant) with vehicle, also create the linked free job per day so the jet vac/combined UI appears, then run pairing for each cell.
    const sourceItem = targetItems[0];
    const isOperativeWithVehicleDuplicate =
      (sourceItem?.type === 'operative' || sourceItem?.type === 'assistant') &&
      !!sourceItem?.vehicleId &&
      !!sourceItem?.employeeId;

    if (isOperativeWithVehicleDuplicate && itemsToCreate.length > 0) {
      const depotId = sourceItem.depotId || '';
      itemsToCreate.forEach((newItem) => {
        onItemCreate(newItem);
        onItemCreate({
          id: generateUniqueId(),
          type: 'job',
          date: new Date(newItem.date),
          crewId: newItem.crewId,
          depotId,
          jobStatus: 'free',
          customer: 'Free',
          address: 'Free',
          startTime: '08:00',
          duration: 8,
          color: 'blue',
          employeeId: sourceItem.employeeId!,
          vehicleId: sourceItem.vehicleId!,
        });
      });
      // Queue pairing for each unique cell; useEffect will run it when items have updated.
      const cells = Array.from(
        new Map(
          itemsToCreate.map((n) => {
            const d = new Date(n.date);
            const k = `${format(d, 'yyyy-MM-dd')}-${n.crewId}`;
            return [k, { date: d, crewId: n.crewId, cellKey: k }];
          })
        ).values()
      );
      pendingDuplicatePairingCellsRef.current = cells;
    } else {
      itemsToCreate.forEach((newItem) => onItemCreate(newItem));
    }
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
      
      const isSelected = selectedItemIds.has(id);
      const targetIds = isSelected ? Array.from(selectedItemIds) : [id];

      const validTargetIds = targetIds.filter(tid => {
          const item = items.find(i => i.id === tid);
          if (!item) return false;
          return !isBefore(startOfDay(new Date(item.date)), startOfDay(new Date()));
      });

      if (validTargetIds.length === 0) return;
      
      // Helper: collect all ids that would be deleted (including linked free jobs)
      const collectIdsToDelete = (): string[] => {
        const allIds: string[] = [];
        validTargetIds.forEach(targetId => {
          if (mode === 'single') {
            const itemToDelete = items.find((i) => i.id === targetId);
            if (itemToDelete && isPersonItem(itemToDelete) && itemToDelete.employeeId) {
              allIds.push(targetId);
              const cellDate = startOfDay(new Date(itemToDelete.date));
              const linkedFreeJobs = items.filter(
                (i) =>
                  isAutoLinkedFreeJob(i) &&
                  i.crewId === itemToDelete.crewId &&
                  isSameDay(new Date(i.date), cellDate) &&
                  i.employeeId === itemToDelete.employeeId
              );
              linkedFreeJobs.forEach((j) => allIds.push(j.id));
              return;
            }
            allIds.push(targetId);
          } else {
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
            const idsInRange = items.filter(i => {
              if (i.id === targetId) return true;
              const iDate = new Date(i.date);
              const isFuture = isAfter(iDate, startDate) && (isBefore(iDate, endDate) || isSameDay(iDate, endDate));
              if (!isFuture && i.id !== targetId) return false;
              if (i.crewId !== itemToDelete.crewId) return false;
              if (i.type !== itemToDelete.type) return false;
              if (i.type === 'job') {
                return i.customer === itemToDelete.customer && i.address === itemToDelete.address;
              }
              return i.employeeId === itemToDelete.employeeId;
            });
            idsInRange.forEach((delItem) => {
              allIds.push(delItem.id);
              if (isPersonItem(delItem) && delItem.employeeId) {
                const cellDate = startOfDay(new Date(delItem.date));
                const linkedFreeJobs = items.filter(
                  (i) =>
                    isAutoLinkedFreeJob(i) &&
                    i.crewId === delItem.crewId &&
                    isSameDay(new Date(i.date), cellDate) &&
                    i.employeeId === delItem.employeeId
                );
                linkedFreeJobs.forEach((j) => allIds.push(j.id));
              }
            });
          }
        });
        return allIds;
      };

      const showDeleteConfirm = (ids: string[]) => {
        const count = ids.length;
        setScheduleDeleteConfirm({
          open: true,
          message: `Are you sure you want to delete ${count} item(s)? This cannot be undone.`,
          count,
          onConfirm: () => {
            ids.forEach((delId) => onItemDelete(delId));
            if (isSelected) setSelectedItemIds(new Set());
            setScheduleDeleteConfirm(null);
          }
        });
      };
      
      if (mode === 'single' && validTargetIds.length === 1) {
        const itemToDelete = items.find(i => i.id === validTargetIds[0]);
        if (itemToDelete && itemToDelete.type === 'job' && itemToDelete.jobNumber) {
          const groupItems = findItemsWithSameJobNumber(itemToDelete);
          if (groupItems.length > 1) {
            setGroupingDialog({
              open: true,
              type: 'delete',
              itemId: validTargetIds[0],
              groupCount: groupItems.length,
              groupedItems: groupItems,
              onConfirm: (applyToGroup: boolean) => {
                const ids = applyToGroup
                  ? groupItems.filter(item => !isBefore(startOfDay(new Date(item.date)), startOfDay(new Date()))).map(item => item.id)
                  : [validTargetIds[0]];
                setGroupingDialog(null);
                showDeleteConfirm(ids);
              }
            });
            return;
          }
        }
      }
      
      const ids = collectIdsToDelete();
      showDeleteConfirm(ids);
  };

  // Duplicate selected items
  const handleDuplicateSelected = (mode: 'single' | 'week' | 'following_week' | 'custom' | 'remainder_month' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months' | 'remainder_year', days?: number) => {
    if (selectedItemIds.size === 0) return;
    
    const selectedItems = items.filter(i => selectedItemIds.has(i.id));
    // Pass skipSelectedCheck=true to prevent double-processing
    selectedItems.forEach(item => {
      handleDuplicateItem(item, mode, days || 1, true);
    });
    setSelectedItemIds(new Set());
  };

  // Delete selected items (call once; handleDeleteItem already uses all selected ids when isSelected)
  const handleDeleteSelected = (mode: 'single' | 'week' | 'remainder_month' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months' | 'remainder_year') => {
    if (selectedItemIds.size === 0) return;
    const firstId = Array.from(selectedItemIds)[0];
    handleDeleteItem(firstId, mode);
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
            id: generateUniqueId(),
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
          const hasNonColorChanges = Object.keys(data).some((key) => {
            if (key === 'color') return false;
            // Check if the value actually changed
            return (data as any)[key] !== (modalState.data as any)?.[key];
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
              groupedItems: groupItems,
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

        // Maintain Free/ghost jobs as a function of people+vehicles (single source of truth)
        let itemsAfterUpdate = items.map((i) => (i.id === updatedItem.id ? updatedItem : i));

        const isEditingFreeJob =
          updatedItem.type === "job" &&
          (normalizeVehicleTypeName((modalState.data as any)?.customer) === normalizeVehicleTypeName("Free") ||
            (modalState.data as any)?.jobStatus === "free" ||
            isFreeJobItem(modalState.data as any) ||
            isAutoLinkedFreeJob(modalState.data as any));

        // If we just converted a Free/ghost slot into a booking, re-sync auto-Free jobs for this cell.
        // This is especially important in combined CCTV/Jet Vac mode, where any booking should remove the remaining auto-Free ghost.
        if (isEditingFreeJob) {
          const cellDate = startOfDay(new Date(updatedItem.date));
          syncAutoLinkedFreeJobsForCell(itemsAfterUpdate, updatedItem.crewId, cellDate);
        }

        if (isPersonItem(updatedItem)) {
          const cellDate = startOfDay(new Date(updatedItem.date));
          const oldCrewId = modalState.data.crewId;
          const oldDate = startOfDay(new Date(modalState.data.date));
          const cellMoved = oldCrewId !== updatedItem.crewId || !isSameDay(oldDate, cellDate);
          const vehicleIdChanged = data.vehicleId !== undefined && data.vehicleId !== modalState.data.vehicleId;

          // Run pairing check when vehicle changed in place OR when person moved to another cell (so destination gets combined if applicable)
          if (vehicleIdChanged || cellMoved) {
            const cellPeopleItems = itemsAfterUpdate.filter(
              (i) =>
                isPersonItem(i) &&
                i.crewId === updatedItem.crewId &&
                isSameDay(new Date(i.date), cellDate) &&
                i.vehicleId
            ) as ScheduleItem[];

            const ghostVehicleLabel = getGhostVehicleLabelForCell(cellPeopleItems, vehicles, vehicleTypes, vehicleCombinations);
            const pairingColor = getColorForVehiclePairing(cellPeopleItems, vehicles, vehicleTypes, vehicleCombinations);
            const cellJobs = itemsAfterUpdate.filter(
              (i) => i.type === "job" && i.crewId === updatedItem.crewId && isSameDay(new Date(i.date), cellDate)
            );
            const hasAnyJobsInCell = cellJobs.length > 0;

            const cellKey = `${format(cellDate, "yyyy-MM-dd")}-${updatedItem.crewId}`;
            const signature = getVehicleSignatureForPeople(cellPeopleItems);
            const decision = getEffectivePairingDecision(cellKey, signature);

            const isActionablePairing =
              isCombinationLabel(ghostVehicleLabel) &&
              !!pairingColor;

            if (isActionablePairing) {
              if (settings.promptVehiclePairingDetected && hasAnyJobsInCell && !decision) {
                setVehiclePairingDialog({
                  open: true,
                  cellKey,
                  vehiclePairing: ghostVehicleLabel!,
                  crewId: updatedItem.crewId,
                  date: cellDate,
                  vehicleSignature: signature,
                  applyPeriod: "none",
                });
              } else {
                autoCombineVehiclePairing({
                  cellKey,
                  vehiclePairing: ghostVehicleLabel!,
                  crewId: updatedItem.crewId,
                  date: cellDate,
                  vehicleSignature: signature,
                  applyPeriod: "none",
                });
              }
            }
          }

          // Sync the destination cell
          syncAutoLinkedFreeJobsForCell(itemsAfterUpdate, updatedItem.crewId, cellDate);

          // If the item moved cells (rare via edit), also sync the source cell to clean up stale Free jobs
          if (cellMoved) {
            syncAutoLinkedFreeJobsForCell(itemsAfterUpdate, oldCrewId, oldDate);
          }
        }
        
        if (applyPeriod !== 'none' && isEditingFreeJob) {
            // Special-case: converting a Free/ghost slot to a booking across a period.
            // Never match by customer === "Free" (that would hit other ghost slots).
            // Instead, apply only to this person's own auto-linked Free jobs (employeeId) on future days.
            const employeeId = (modalState.data as any)?.employeeId as string | undefined;
            const vehicleId = (modalState.data as any)?.vehicleId as string | undefined;

            if (employeeId) {
              // Calculate end date based on period (same as the normal applyPeriod logic)
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

              const skipWeekends = applyPeriod === 'month' || applyPeriod === '6months' || applyPeriod === '12months';

              let nextDate = addDays(startDate, 1);
              let safetyCounter = 0;
              const MAX_ITEMS = 1000;

              let updatedSlots = 0;
              let createdSlots = 0;
              const touched: Array<{ id: string; dateKey: string; action: "updated" | "created" }> = [];
              const periodUpdatedById = new Map<string, Partial<ScheduleItem>>();
              const periodCreatedItems: ScheduleItem[] = [];

              while ((isSameDay(nextDate, endDate) || isBefore(nextDate, endDate)) && safetyCounter < MAX_ITEMS) {
                if (skipWeekends && !isWeekday(nextDate)) {
                  nextDate = addDays(nextDate, 1);
                  continue;
                }

                const day = startOfDay(nextDate);
                // Prefer updating this person's auto-linked Free job on that date (if it exists)
                const existingSlot = items.find((i: any) =>
                  isAutoLinkedFreeJob(i) &&
                  i.type === 'job' &&
                  i.crewId === updatedItem.crewId &&
                  isSameDay(new Date(i.date), day) &&
                  i.employeeId === employeeId &&
                  (!vehicleId || i.vehicleId === vehicleId)
                );

                if (existingSlot) {
                  onItemUpdate({ ...existingSlot, ...data, customer: data.customer, jobStatus: data.jobStatus });
                  updatedSlots++;
                  touched.push({ id: existingSlot.id, dateKey: format(day, "yyyy-MM-dd"), action: "updated" });
                  periodUpdatedById.set(existingSlot.id, { ...existingSlot, ...data, customer: data.customer, jobStatus: data.jobStatus });
                } else {
                  // If no slot exists (e.g. missing auto-free), create a booking job for that person/day
                  const created: ScheduleItem = {
                    ...updatedItem,
                    id: generateUniqueId(),
                    date: new Date(day),
                    employeeId,
                    vehicleId,
                  };
                  onItemCreate(created);
                  createdSlots++;
                  touched.push({ id: "(new)", dateKey: format(day, "yyyy-MM-dd"), action: "created" });
                  periodCreatedItems.push(created);
                }

                nextDate = addDays(nextDate, 1);
                safetyCounter++;
              }

              // After period updates, immediately sync each touched day so combined cells don't leave behind an auto-Free ghost.
              // We use a snapshot that includes the period updates we just issued.
              const snapshotAfterPeriod: ScheduleItem[] = (() => {
                const base = itemsAfterUpdate.map((i) => {
                  const patch = periodUpdatedById.get(i.id);
                  return patch ? ({ ...i, ...patch } as ScheduleItem) : i;
                });
                // Add any created items that aren't already present
                const ids = new Set(base.map((i) => i.id));
                periodCreatedItems.forEach((c) => {
                  if (!ids.has(c.id)) base.push(c);
                });
                return base;
              })();

              const touchedDateKeys = Array.from(new Set(touched.map((t) => t.dateKey))).slice(0, 31);
              touchedDateKeys.forEach((dk) => {
                const dObj = new Date(dk);
                syncAutoLinkedFreeJobsForCell(snapshotAfterPeriod, updatedItem.crewId, dObj);
              });
            }
        } else if (applyPeriod !== 'none' && !isEditingFreeJob) {
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
            
            const cellsNeedingSync = new Set<string>();
            const addCellToSync = (crewId: string, date: Date) => {
              cellsNeedingSync.add(`${crewId}|${format(startOfDay(date), "yyyy-MM-dd")}`);
            };

            // Always re-sync the edited item’s own cell if it’s a person item
            if (isPersonItem(updatedItem)) {
              addCellToSync(updatedItem.crewId, new Date(updatedItem.date));
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
                        const nextItem = { ...i, ...data };
                        onItemUpdate(nextItem);
                        if (isPersonItem(nextItem)) {
                          addCellToSync(nextItem.crewId, new Date(nextItem.date));
                        }
                    }
                }
            });

            // Best-effort: re-sync impacted cells so their auto-Free jobs don’t drift
            if (cellsNeedingSync.size > 0) {
              cellsNeedingSync.forEach((key) => {
                const [crewId, dStr] = key.split("|");
                if (!crewId || !dStr) return;
                syncAutoLinkedFreeJobsForCell(itemsAfterUpdate, crewId, new Date(dStr!));
              });
            }
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

        if (!createCrewId) {
            console.error('[handleModalSubmit] Missing crewId for create:', { target: modalState.target, data: modalState.data });
            return;
        }
        
        // Ensure jobStatus is set for jobs - if customer is 'Free' or empty, it's a free job
        const isFreeJob = modalState.type === 'job' && (data.customer === 'Free' || !data.customer || data.customer.trim() === '');
        
        // Check if this is a provisional booking from availability search
        // Only mark as pending if: 1) it's from search (isProvisional flag), 2) approval is required in settings, 3) it's a job
        const isProvisional = (modalState.data as any)?.isProvisional === true && 
                              settings.requireApprovalForBookings && 
                              modalState.type === 'job' &&
                              !isFreeJob; // Don't mark free jobs as pending
        
        // For jobs, get vehicle color from vehicleTypes configuration (not vehicle.color)
        // Helper to get default color for a vehicle type from vehicleTypes config
        const getDefaultColorForType = (type: string): string | undefined => {
          if (!vehicleTypes || vehicleTypes.length === 0) return undefined;
          const typeObj = vehicleTypes.find(t => (typeof t === 'string' ? t : t.type) === type);
          return (typeof typeObj === 'object' && typeObj?.defaultColor) ? typeObj.defaultColor : undefined;
        };

        const createDateObj = createDate ? new Date(createDate) : null;
        const createCellKey =
          createDateObj && createCrewId ? `${format(createDateObj, "yyyy-MM-dd")}-${createCrewId}` : "";

        let jobColor = data.color || 'blue';
        if (modalState.type === 'job') {
            // Find all people items (operatives/assistants) in the same cell to check for vehicle pairings
            const cellPeopleItems = items.filter((item: ScheduleItem) => 
                (item.type === 'operative' || item.type === 'assistant') &&
                item.crewId === createCrewId &&
                (createDateObj ? isSameDay(new Date(item.date), createDateObj) : false) &&
                item.vehicleId
            );
            
            // First, check for vehicle pairings (e.g., CCTV + Jet Vac/Recycler)
            const pairingColor = getColorForVehiclePairing(cellPeopleItems, vehicles, vehicleTypes, vehicleCombinations);
            const signature = getVehicleSignatureForPeople(cellPeopleItems);
            const decision = createCellKey ? getEffectivePairingDecision(createCellKey, signature) : undefined;

            // Only apply pairingColor automatically if the user has chosen “Combine Them” for this cell
            if (pairingColor && decision === "combined") {
                jobColor = pairingColor;
            } else if (cellPeopleItems.length > 0) {
                // Fallback: use the first operative's vehicle color if no pairing detected
                const operativeItem = cellPeopleItems.find((item: ScheduleItem) => item.type === 'operative');
                const itemToUse = operativeItem || cellPeopleItems[0];
                
                if (itemToUse?.vehicleId) {
                    const vehicle = vehicles.find((v: any) => v.id === itemToUse.vehicleId);
                    // ALWAYS get color from vehicleTypes based on vehicle's vehicleType
                    if (vehicle?.vehicleType) {
                      const typeColor = getDefaultColorForType(vehicle.vehicleType);
                      if (typeColor) {
                        jobColor = typeColor;
                      } else if (vehicle?.color) {
                        // Fallback to vehicle.color only if vehicleTypes doesn't have a color
                        jobColor = vehicle.color;
                      }
                    } else if (vehicle?.color) {
                      // Fallback if vehicle has no vehicleType
                      jobColor = vehicle.color;
                    }
                }
            }
        }
        
        const baseItem = {
            id: generateUniqueId(),
            type: modalState.type,
            date: createDate,
            crewId: createCrewId,
            depotId: createDepotId,
            ...data,
            color: modalState.type === 'job' ? jobColor : (data.color || 'blue'),
            // Override for free jobs to ensure they're marked correctly
            ...(isFreeJob && modalState.type === 'job' ? {
                jobStatus: 'free',
                customer: 'Free',
                address: 'Free'
            } : {}),
            // Mark as provisional if from availability search
            ...(isProvisional && modalState.type === 'job' ? {
                status: 'pending' as const
            } : {})
        };
        
        onItemCreate(baseItem);

        // If this is a person create, initialize a stable per-cell order so the newly added person
        // defaults AFTER existing people in this cell (until the user manually reorders).
        if (modalState.type === "operative" || modalState.type === "assistant") {
          const cellOrderKey = `${createCrewId}|${format(startOfDay(new Date(createDate)), "yyyy-MM-dd")}`;
          setCellItemOrder((prev) => {
            if (prev[cellOrderKey] && prev[cellOrderKey].length) return prev;
            const existingPeopleIds = items
              .filter(
                (i: ScheduleItem) =>
                  (i.type === "operative" || i.type === "assistant") &&
                  i.crewId === createCrewId &&
                  isSameDay(new Date(i.date), new Date(createDate))
              )
              .map((i) => i.id);
            const next = Array.from(new Set([...existingPeopleIds, baseItem.id]));
            return { ...prev, [cellOrderKey]: next };
          });
        }
        
        // Auto-generate free jobs and add operative when operative + vehicle
        const isOperativeWithVehicle = 
            modalState.type === 'operative' && 
            data.employeeId && 
            data.vehicleId;
        
        if (isOperativeWithVehicle) {
            const createDateObj = new Date(createDate);
            const cellKey = `${format(createDateObj, 'yyyy-MM-dd')}-${createCrewId}`;

            // Find all existing people items in the same cell (with vehicles)
            const cellPeopleItems = items.filter((item: ScheduleItem) => 
                (item.type === 'operative' || item.type === 'assistant') &&
                item.crewId === createCrewId &&
                isSameDay(new Date(item.date), createDateObj) &&
                item.vehicleId
            );

            // Simulate the *new* person being added so pairing detection runs immediately on create
            const simulatedPeopleItems = [
              ...cellPeopleItems,
              {
                id: baseItem.id,
                type: 'operative' as const,
                date: createDateObj,
                crewId: createCrewId,
                depotId: createDepotId,
                employeeId: data.employeeId!,
                vehicleId: data.vehicleId!,
              } as ScheduleItem,
            ];

            const ghostVehicleLabel = getGhostVehicleLabelForCell(simulatedPeopleItems, vehicles, vehicleTypes, vehicleCombinations);
            const pairingColor = getColorForVehiclePairing(simulatedPeopleItems, vehicles, vehicleTypes, vehicleCombinations);
            const signature = getVehicleSignatureForPeople(simulatedPeopleItems);
            const decision = getEffectivePairingDecision(cellKey, signature);

            // Open pairing dialog immediately on initial create when actionable pairing is formed
            if (
              isCombinationLabel(ghostVehicleLabel) &&
              pairingColor &&
              !vehiclePairingDialog?.open
            ) {
              if (settings.promptVehiclePairingDetected && !decision) {
                setVehiclePairingDialog({
                  open: true,
                  cellKey,
                  vehiclePairing: ghostVehicleLabel!,
                  crewId: createCrewId,
                  date: createDateObj,
                  vehicleSignature: signature,
                  applyPeriod: applyPeriod === "group" ? "none" : applyPeriod,
                });
              } else {
                autoCombineVehiclePairing({
                  cellKey,
                  vehiclePairing: ghostVehicleLabel!,
                  crewId: createCrewId,
                  date: createDateObj,
                  vehicleSignature: signature,
                  applyPeriod: applyPeriod === "group" ? "none" : applyPeriod,
                });
              }
            }
            
            // Check for vehicle pairings first (e.g., CCTV + Jet Vac/Recycler)
            // Only apply paired color automatically if decision is “combined”
            const hasActionablePairing = isCombinationLabel(ghostVehicleLabel) && !!pairingColor;
            let freeJobColor = hasActionablePairing ? pairingColor : (decision === "combined" ? pairingColor : undefined);
            if (!freeJobColor) {
                // Fallback: use the vehicle's color from vehicleTypes or vehicle.color
                const vehicle = vehicles.find((v: any) => v.id === data.vehicleId);
                if (vehicle?.vehicleType) {
                    const typeColor = getDefaultColorForType(vehicle.vehicleType);
                    freeJobColor = typeColor || vehicle?.color || 'blue';
                } else {
                    freeJobColor = vehicle?.color || 'blue';
                }
            }
            
            const startDate = new Date(createDateObj);
            
            // 1. Create free job on the same day (below the operative)
            onItemCreate({
                id: generateUniqueId(),
                type: 'job',
                date: new Date(startDate),
                crewId: createCrewId,
                depotId: modalState.target?.depotId || modalState.data?.depotId || "",
                jobStatus: 'free',
                customer: 'Free',
                address: 'Free',
                startTime: '08:00',
                duration: 8,
                color: freeJobColor,
                employeeId: data.employeeId!,
                vehicleId: data.vehicleId!,
            });
            
            // 2. Only add operative and free jobs for additional days if applyPeriod is not 'none'
            if (applyPeriod !== 'none') {
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
                
                // Add operative and free jobs for the selected period (weekdays only for month/6months/12months)
                let nextDate = addDays(startDate, 1);
                let safetyCounter = 0;
                const MAX_ITEMS = 1000; // Safety limit
                const skipWeekends = applyPeriod === 'month' || applyPeriod === '6months' || applyPeriod === '12months';
                const addForWeekCells: Array<{ date: Date; crewId: string; cellKey: string }> = [];
                
                while ((isSameDay(nextDate, endDate) || isBefore(nextDate, endDate)) && safetyCounter < MAX_ITEMS) {
                    // Skip weekends for month/6months/12months periods
                    if (skipWeekends && !isWeekday(nextDate)) {
                        nextDate = addDays(nextDate, 1);
                        continue;
                    }
                    
                    const dayObj = new Date(nextDate);
                    const ck = `${format(dayObj, "yyyy-MM-dd")}-${createCrewId}`;
                    addForWeekCells.push({ date: dayObj, crewId: createCrewId, cellKey: ck });
                    
                    // Create operative for this day
                    const createdPersonId = generateUniqueId();
                    onItemCreate({
                        id: createdPersonId,
                        type: modalState.type,
                        date: new Date(nextDate),
                        crewId: createCrewId,
                        depotId: modalState.target?.depotId || modalState.data?.depotId || "",
                        ...data
                    });

                    // Initialize stable order for that day/cell if no manual order exists yet
                    const loopCellOrderKey = `${createCrewId}|${format(startOfDay(new Date(nextDate)), "yyyy-MM-dd")}`;
                    setCellItemOrder((prev) => {
                      if (prev[loopCellOrderKey] && prev[loopCellOrderKey].length) return prev;
                      const existingPeopleIds = items
                        .filter(
                          (i: ScheduleItem) =>
                            (i.type === "operative" || i.type === "assistant") &&
                            i.crewId === createCrewId &&
                            isSameDay(new Date(i.date), new Date(nextDate))
                        )
                        .map((i) => i.id);
                      const nextOrder = Array.from(new Set([...existingPeopleIds, createdPersonId]));
                      return { ...prev, [loopCellOrderKey]: nextOrder };
                    });
                    
                    // Create free job for this day
                    onItemCreate({
                        id: generateUniqueId(),
                        type: 'job',
                        date: new Date(nextDate),
                        crewId: createCrewId,
                        depotId: createDepotId,
                        jobStatus: 'free',
                        customer: 'Free',
                        address: 'Free',
                        startTime: '08:00',
                        duration: 8,
                        color: freeJobColor,
                        employeeId: data.employeeId!,
                        vehicleId: data.vehicleId!,
                    });
                    
                    nextDate = addDays(nextDate, 1);
                    safetyCounter++;
                }
                if (addForWeekCells.length > 0) {
                  pendingDuplicatePairingCellsRef.current = addForWeekCells;
                }
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
                    id: generateUniqueId(),
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
  // Deduplicate items by ID before filtering (in case duplicates exist)
  const uniqueItems = items.reduce((acc, item) => {
    if (!acc.find(i => i.id === item.id)) {
      acc.push(item);
    }
    return acc;
  }, [] as ScheduleItem[]);

  const filteredItems = uniqueItems.filter(item => {
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
        onKeyDown={(e) => {
          if (/^Arrow/.test(e.key)) {
            e.preventDefault();
          }
          if(e.ctrlKey && !isReadOnly) setIsCtrlPressed(true);
        }}
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
            {isReadOnly && (
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
                                    itemDateToCalendarDay(i.date) === dateStr && 
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
                                  // No manual order: default 2-column layout should place Assistants on the right.
                                  // We do this by interleaving Operatives + Assistants: op0, asst0, op1, asst1, ...
                                  const getEmployeeName = (item: ScheduleItem) => {
                                    const emp = employees.find((e) => e.id === item.employeeId);
                                    return emp?.name || item.employeeId || item.id;
                                  };

                                  const operatives = displayItems
                                    .filter((i) => i.type === "operative")
                                    .slice()
                                    .sort((a, b) => getEmployeeName(a).localeCompare(getEmployeeName(b)));
                                  const assistants = displayItems
                                    .filter((i) => i.type === "assistant")
                                    .slice()
                                    .sort((a, b) => getEmployeeName(a).localeCompare(getEmployeeName(b)));

                                  const interleaved: ScheduleItem[] = [];
                                  const maxLen = Math.max(operatives.length, assistants.length);
                                  for (let idx = 0; idx < maxLen; idx++) {
                                    if (operatives[idx]) interleaved.push(operatives[idx]);
                                    if (assistants[idx]) interleaved.push(assistants[idx]);
                                  }

                                  const personRank = new Map<string, number>();
                                  interleaved.forEach((p, idx) => personRank.set(p.id, idx));

                                  displayItems = [...displayItems].sort((a, b) => {
                                    const pa = getPriority(a.type);
                                    const pb = getPriority(b.type);
                                    if (pa !== pb) return pa - pb;

                                    const aIsPerson = a.type === "operative" || a.type === "assistant";
                                    const bIsPerson = b.type === "operative" || b.type === "assistant";
                                    if (aIsPerson && bIsPerson) {
                                      const ra = personRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
                                      const rb = personRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
                                      if (ra !== rb) return ra - rb;
                                    }
                                    return 0;
                                  });
                                }
                                
                                const peopleItems = displayItems.filter(i => i.type !== 'job' && i.type !== 'note');
                                const noteItems = displayItems.filter(i => i.type === 'note');
                                const jobItems = displayItems.filter(i => i.type === 'job');

                                // Separate free and booked jobs
                                const freeJobs = jobItems.filter(isFreeJobItem);
                                const bookedJobs = jobItems.filter(j => !isFreeJobItem(j));

                                // Auto-linked Free jobs (created/maintained from operative+vehicle assignments)
                                const autoLinkedFreeJobs = freeJobs.filter(isAutoLinkedFreeJob);
                                const unlinkedFreeJobs = freeJobs.filter((j) => !isAutoLinkedFreeJob(j));

                                // If the user chose "Combine Them" for an actionable pairing in this cell,
                                // we should show ONE combined ghost/free card (CCTV/Jet Vac) instead of one per operative.
                                const decisionCellKey = `${dateStr}-${crew.id}`;
                                const signatureForDecision = getVehicleSignatureForPeople(
                                  peopleItems.filter((p) => isPersonItem(p) && p.vehicleId)
                                );
                                const rawGhostLabel = getGhostVehicleLabelForCell(peopleItems, vehicles, vehicleTypes, vehicleCombinations);
                                const pairingColorForDecision = getColorForVehiclePairing(peopleItems, vehicles, vehicleTypes, vehicleCombinations);
                                const isActionablePairing =
                                  isCombinationLabel(rawGhostLabel) && !!pairingColorForDecision;
                                const pairingDecision = getEffectivePairingDecision(decisionCellKey, signatureForDecision);
                                const inferredCombinedMode = isActionablePairing
                                  ? inferCombinedPairingFromPersistedColors(
                                      items,
                                      crew.id,
                                      day,
                                      pairingColorForDecision,
                                      signatureForDecision
                                    )
                                  : false;
                                // When "Vehicle Pairing Detected" prompt is off, default to combined for display when no decision yet
                                const defaultCombinedWhenPromptOff = !settings.promptVehiclePairingDetected && pairingDecision !== "separate";
                                const isCombinedMode =
                                  isActionablePairing && (pairingDecision === "combined" || inferredCombinedMode || defaultCombinedWhenPromptOff);

                                
                                // Calculate remaining free time ONLY if there are booked jobs and total < 8 hours
                                const totalBookedDuration = bookedJobs.reduce((sum, job) => {
                                  return sum + (Number(job.duration) || 0);
                                }, 0);
                                
                                let remainingFreeTimeItem: ScheduleItem | null = null;
                                
                                // Only show remaining free time if there are booked jobs and total < 8 hours
                                if (bookedJobs.length > 0 && totalBookedDuration < 8 && totalBookedDuration > 0) {
                                  // Sort jobs by start time to process them in order
                                  const sortedJobs = [...bookedJobs].sort((a, b) => {
                                    if (!a.startTime || !b.startTime) return 0;
                                    return a.startTime.localeCompare(b.startTime);
                                  });
                                  
                                  // Calculate actual end time accounting for travel between jobs
                                  let actualEndTime = "";
                                  let lastJobEndTime = "";
                                  let lastJobAddress = "";
                                  
                                  sortedJobs.forEach((job, index) => {
                                    if (job.startTime && job.duration) {
                                      // Calculate this job's end time
                                      const jobEndTime = calculateJobEndTime(job.startTime, Number(job.duration));
                                      
                                      // Track the latest end time (accounting for travel if multiple jobs)
                                      if (index === 0) {
                                        // First job - just use its end time
                                        actualEndTime = jobEndTime;
                                      } else if (lastJobEndTime && lastJobAddress && job.address) {
                                        // Subsequent jobs - account for travel from previous job
                                        const travelMinutes = calculateTravelTime(
                                          extractPostcode(lastJobAddress),
                                          extractPostcode(job.address)
                                        );
                                        // The actual end time is this job's end time (travel already accounted in start time)
                                        actualEndTime = jobEndTime;
                                      }
                                      
                                      lastJobEndTime = jobEndTime;
                                      lastJobAddress = job.address || "";
                                    }
                                  });
                                  
                                  // Use the calculated actual end time, or fallback
                                  const isNight = crew?.shift === 'night';
                                  const defaultStart = isNight ? "20:00" : "08:00";
                                  const latestEndTime = actualEndTime || (sortedJobs.length > 0 && sortedJobs[sortedJobs.length - 1].startTime 
                                    ? calculateJobEndTime(sortedJobs[sortedJobs.length - 1].startTime!, Number(sortedJobs[sortedJobs.length - 1].duration || 0))
                                    : defaultStart);
                                  
                                  // Calculate free time end (8 hours from default start)
                                  const [defaultH, defaultM] = defaultStart.split(':').map(Number);
                                  const defaultEndDate = new Date(2000, 0, 1, defaultH || 8, defaultM || 0);
                                  defaultEndDate.setHours(defaultEndDate.getHours() + 8);
                                  const defaultEndTime = `${defaultEndDate.getHours().toString().padStart(2, '0')}:${defaultEndDate.getMinutes().toString().padStart(2, '0')}`;
                                  
                                  // Calculate remaining hours (accounting for actual end time)
                                  const [endH, endM] = latestEndTime.split(':').map(Number);
                                  const [defaultEndH, defaultEndM] = defaultEndTime.split(':').map(Number);
                                  const endDate = new Date(2000, 0, 1, endH || 8, endM || 0);
                                  const defaultEndDate2 = new Date(2000, 0, 1, defaultEndH || 16, defaultEndM || 0);
                                  const diffMs = defaultEndDate2.getTime() - endDate.getTime();
                                  const remainingHours = Math.max(0, diffMs / (1000 * 60 * 60));
                                  
                                  // Create ghost UI for remaining free time
                                  remainingFreeTimeItem = {
                                    id: `free-remaining-${crew.id}-${dateStr}`,
                                    type: 'job' as const,
                                    date: day,
                                    crewId: crew.id,
                                    depotId: crew.depotId || "",
                                    jobStatus: 'free' as const,
                                    customer: 'Free',
                                    address: `${latestEndTime} - ${defaultEndTime} available`,
                                    duration: Math.round(remainingHours * 10) / 10, // Round to 1 decimal
                                    startTime: latestEndTime,
                                    color: 'gray',
                                  };
                                }
                                
                                // Build visible job items: existing free job (if any), booked jobs, then remaining free time.
                                // IMPORTANT: if a real Free job already exists, don't also render the virtual remaining-free-time ghost
                                // (it looks like an undeletable duplicate Free card).
                                const visibleJobItems = [
                                  ...(isCombinedMode
                                    ? (autoLinkedFreeJobs[0] ? [autoLinkedFreeJobs[0]] : [])
                                    : autoLinkedFreeJobs),
                                  ...unlinkedFreeJobs,
                                  ...bookedJobs,
                                  ...(freeJobs.length === 0 && remainingFreeTimeItem ? [remainingFreeTimeItem] : []),
                                ];

                                const ghostVehicleLabel = getGhostVehicleLabelForCellDisplay(peopleItems, crew.id, day);

                                const isToday = isSameDay(day, new Date());

                                return (
                                    <DroppableCell
                                        key={cellId}
                                        id={cellId}
                                        disabled={isReadOnly || isBefore(startOfDay(day), today)}
                                        onClick={() => setSelectedItemIds(new Set())}
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
                                                {peopleItems.length > 0 && (() => {
                                                  const validPeople = peopleItems.filter((i) => i.id && typeof i.id === "string");
                                                  const operatives = validPeople.filter((p) => p.type === "operative");
                                                  const assistants = validPeople.filter((p) => p.type === "assistant");

                                                  // Pair assistants to operatives by matching vehicleId when possible.
                                                  const unusedAssistants = [...assistants];
                                                  const takeAssistantForOperative = (op: ScheduleItem) => {
                                                    if (op.vehicleId) {
                                                      const idx = unusedAssistants.findIndex((a) => a.vehicleId && a.vehicleId === op.vehicleId);
                                                      if (idx >= 0) return unusedAssistants.splice(idx, 1)[0];
                                                    }
                                                    if (unusedAssistants.length > 0) return unusedAssistants.shift();
                                                    return undefined;
                                                  };

                                                  const rows: Array<{ operative?: ScheduleItem; assistant?: ScheduleItem }> = operatives.map((op) => ({
                                                    operative: op,
                                                    assistant: takeAssistantForOperative(op),
                                                  }));

                                                  // Any remaining assistants become their own row (assistant on the right)
                                                  unusedAssistants.forEach((a) => rows.push({ assistant: a }));

                                                  return (
                                                    <div className="w-full flex flex-col gap-1">
                                                      {rows.map((row, idx) => (
                                                        <div key={`${row.operative?.id || "none"}-${row.assistant?.id || "none"}-${idx}`} className="w-full grid grid-cols-2 gap-1">
                                                          <div className="min-w-0">
                                                            {row.operative ? (
                                                              <OperativeCard
                                                                item={row.operative}
                                                                onEdit={handleEditItem}
                                                                onDelete={(id, mode) => handleDeleteItem(id, mode)}
                                                                onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)}
                                                                employees={employees}
                                                                vehicles={vehicles}
                                                                isReadOnly={isReadOnly || isBefore(startOfDay(new Date(row.operative.date)), startOfDay(new Date()))}
                                                                isSelected={selectedItemIds.has(row.operative.id)}
                                                                onToggleSelection={handleToggleSelection}
                                                                selectedItemIds={selectedItemIds}
                                                                onDuplicateSelected={handleDuplicateSelected}
                                                                onDeleteSelected={handleDeleteSelected}
                                                                onBookTimeOff={handleOpenEmployeeTimeOff}
                                                              />
                                                            ) : (
                                                              <div />
                                                            )}
                                                          </div>
                                                          <div className="min-w-0">
                                                            {row.assistant ? (
                                                              <OperativeCard
                                                                item={row.assistant}
                                                                onEdit={handleEditItem}
                                                                onDelete={(id, mode) => handleDeleteItem(id, mode)}
                                                                onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)}
                                                                employees={employees}
                                                                vehicles={vehicles}
                                                                isReadOnly={isReadOnly || isBefore(startOfDay(new Date(row.assistant.date)), startOfDay(new Date()))}
                                                                isSelected={selectedItemIds.has(row.assistant.id)}
                                                                onToggleSelection={handleToggleSelection}
                                                                selectedItemIds={selectedItemIds}
                                                                onDuplicateSelected={handleDuplicateSelected}
                                                                onDeleteSelected={handleDeleteSelected}
                                                                onBookTimeOff={handleOpenEmployeeTimeOff}
                                                              />
                                                            ) : (
                                                              <div />
                                                            )}
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  );
                                                })()}
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
                                                        colorLabels={colorLabels}
                                                        vehicleTypes={vehicleTypes}
                                                        vehicleCombinations={vehicleCombinations}
                                                        peopleItems={peopleItems}
                                                        pairingDecisionIsSeparate={pairingDecision === "separate"}
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
                                    itemDateToCalendarDay(i.date) === dateStr && 
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
                                  // No manual order: default 2-column layout should place Assistants on the right.
                                  // We do this by interleaving Operatives + Assistants: op0, asst0, op1, asst1, ...
                                  const getEmployeeName = (item: ScheduleItem) => {
                                    const emp = employees.find((e) => e.id === item.employeeId);
                                    return emp?.name || item.employeeId || item.id;
                                  };

                                  const operatives = displayItems
                                    .filter((i) => i.type === "operative")
                                    .slice()
                                    .sort((a, b) => getEmployeeName(a).localeCompare(getEmployeeName(b)));
                                  const assistants = displayItems
                                    .filter((i) => i.type === "assistant")
                                    .slice()
                                    .sort((a, b) => getEmployeeName(a).localeCompare(getEmployeeName(b)));

                                  const interleaved: ScheduleItem[] = [];
                                  const maxLen = Math.max(operatives.length, assistants.length);
                                  for (let idx = 0; idx < maxLen; idx++) {
                                    if (operatives[idx]) interleaved.push(operatives[idx]);
                                    if (assistants[idx]) interleaved.push(assistants[idx]);
                                  }

                                  const personRank = new Map<string, number>();
                                  interleaved.forEach((p, idx) => personRank.set(p.id, idx));

                                  displayItems = [...displayItems].sort((a, b) => {
                                    const pa = getPriority(a.type);
                                    const pb = getPriority(b.type);
                                    if (pa !== pb) return pa - pb;

                                    const aIsPerson = a.type === "operative" || a.type === "assistant";
                                    const bIsPerson = b.type === "operative" || b.type === "assistant";
                                    if (aIsPerson && bIsPerson) {
                                      const ra = personRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
                                      const rb = personRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
                                      if (ra !== rb) return ra - rb;
                                    }
                                    return 0;
                                  });
                                }
                                
                                const peopleItems = displayItems.filter(i => i.type !== 'job' && i.type !== 'note');
                                const noteItems = displayItems.filter(i => i.type === 'note');
                                const jobItems = displayItems.filter(i => i.type === 'job');

                                // Separate free and booked jobs
                                const freeJobs = jobItems.filter(isFreeJobItem);
                                const bookedJobs = jobItems.filter(j => !isFreeJobItem(j));

                                // Auto-linked Free jobs (created/maintained from operative+vehicle assignments)
                                const autoLinkedFreeJobs = freeJobs.filter(isAutoLinkedFreeJob);
                                const unlinkedFreeJobs = freeJobs.filter((j) => !isAutoLinkedFreeJob(j));

                                // If the user chose "Combine Them" for an actionable pairing in this cell,
                                // we should show ONE combined ghost/free card (CCTV/Jet Vac) instead of one per operative.
                                const decisionCellKey = `${dateStr}-${crew.id}`;
                                const signatureForDecision = getVehicleSignatureForPeople(
                                  peopleItems.filter((p) => isPersonItem(p) && p.vehicleId)
                                );
                                const rawGhostLabel = getGhostVehicleLabelForCell(peopleItems, vehicles, vehicleTypes, vehicleCombinations);
                                const pairingColorForDecision = getColorForVehiclePairing(peopleItems, vehicles, vehicleTypes, vehicleCombinations);
                                const isActionablePairing =
                                  isCombinationLabel(rawGhostLabel) && !!pairingColorForDecision;
                                const pairingDecision = getEffectivePairingDecision(decisionCellKey, signatureForDecision);
                                const inferredCombinedMode = isActionablePairing
                                  ? inferCombinedPairingFromPersistedColors(
                                      items,
                                      crew.id,
                                      day,
                                      pairingColorForDecision,
                                      signatureForDecision
                                    )
                                  : false;
                                // When "Vehicle Pairing Detected" prompt is off, default to combined for display when no decision yet
                                const defaultCombinedWhenPromptOff2 = !settings.promptVehiclePairingDetected && pairingDecision !== "separate";
                                const isCombinedMode =
                                  isActionablePairing && (pairingDecision === "combined" || inferredCombinedMode || defaultCombinedWhenPromptOff2);
                                
                                // Calculate remaining free time ONLY if there are booked jobs and total < 8 hours
                                const totalBookedDuration = bookedJobs.reduce((sum, job) => {
                                  return sum + (Number(job.duration) || 0);
                                }, 0);
                                
                                let remainingFreeTimeItem: ScheduleItem | null = null;
                                
                                // Only show remaining free time if there are booked jobs and total < 8 hours
                                if (bookedJobs.length > 0 && totalBookedDuration < 8 && totalBookedDuration > 0) {
                                  // Sort jobs by start time to process them in order
                                  const sortedJobs = [...bookedJobs].sort((a, b) => {
                                    if (!a.startTime || !b.startTime) return 0;
                                    return a.startTime.localeCompare(b.startTime);
                                  });
                                  
                                  // Calculate actual end time accounting for travel between jobs
                                  let actualEndTime = "";
                                  let lastJobEndTime = "";
                                  let lastJobAddress = "";
                                  
                                  sortedJobs.forEach((job, index) => {
                                    if (job.startTime && job.duration) {
                                      // Calculate this job's end time
                                      const jobEndTime = calculateJobEndTime(job.startTime, Number(job.duration));
                                      
                                      // Track the latest end time (accounting for travel if multiple jobs)
                                      if (index === 0) {
                                        // First job - just use its end time
                                        actualEndTime = jobEndTime;
                                      } else if (lastJobEndTime && lastJobAddress && job.address) {
                                        // Subsequent jobs - account for travel from previous job
                                        const travelMinutes = calculateTravelTime(
                                          extractPostcode(lastJobAddress),
                                          extractPostcode(job.address)
                                        );
                                        // The actual end time is this job's end time (travel already accounted in start time)
                                        actualEndTime = jobEndTime;
                                      }
                                      
                                      lastJobEndTime = jobEndTime;
                                      lastJobAddress = job.address || "";
                                    }
                                  });
                                  
                                  // Use the calculated actual end time, or fallback
                                  const isNight = crew?.shift === 'night';
                                  const defaultStart = isNight ? "20:00" : "08:00";
                                  const latestEndTime = actualEndTime || (sortedJobs.length > 0 && sortedJobs[sortedJobs.length - 1].startTime 
                                    ? calculateJobEndTime(sortedJobs[sortedJobs.length - 1].startTime!, Number(sortedJobs[sortedJobs.length - 1].duration || 0))
                                    : defaultStart);
                                  
                                  // Calculate free time end (8 hours from default start)
                                  const [defaultH, defaultM] = defaultStart.split(':').map(Number);
                                  const defaultEndDate = new Date(2000, 0, 1, defaultH || 8, defaultM || 0);
                                  defaultEndDate.setHours(defaultEndDate.getHours() + 8);
                                  const defaultEndTime = `${defaultEndDate.getHours().toString().padStart(2, '0')}:${defaultEndDate.getMinutes().toString().padStart(2, '0')}`;
                                  
                                  // Calculate remaining hours (accounting for actual end time)
                                  const [endH, endM] = latestEndTime.split(':').map(Number);
                                  const [defaultEndH, defaultEndM] = defaultEndTime.split(':').map(Number);
                                  const endDate = new Date(2000, 0, 1, endH || 8, endM || 0);
                                  const defaultEndDate2 = new Date(2000, 0, 1, defaultEndH || 16, defaultEndM || 0);
                                  const diffMs = defaultEndDate2.getTime() - endDate.getTime();
                                  const remainingHours = Math.max(0, diffMs / (1000 * 60 * 60));
                                  
                                  // Create ghost UI for remaining free time
                                  remainingFreeTimeItem = {
                                    id: `free-remaining-${crew.id}-${dateStr}`,
                                    type: 'job' as const,
                                    date: day,
                                    crewId: crew.id,
                                    depotId: crew.depotId || "",
                                    jobStatus: 'free' as const,
                                    customer: 'Free',
                                    address: `${latestEndTime} - ${defaultEndTime} available`,
                                    duration: Math.round(remainingHours * 10) / 10, // Round to 1 decimal
                                    startTime: latestEndTime,
                                    color: 'gray',
                                  };
                                }
                                
                                // Build visible job items: existing free job (if any), booked jobs, then remaining free time.
                                // IMPORTANT: if a real Free job already exists, don't also render the virtual remaining-free-time ghost
                                // (it looks like an undeletable duplicate Free card).
                                const visibleJobItems = [
                                  ...(isCombinedMode
                                    ? (autoLinkedFreeJobs[0] ? [autoLinkedFreeJobs[0]] : [])
                                    : autoLinkedFreeJobs),
                                  ...unlinkedFreeJobs,
                                  ...bookedJobs,
                                  ...(freeJobs.length === 0 && remainingFreeTimeItem ? [remainingFreeTimeItem] : []),
                                ];

                                const ghostVehicleLabel = getGhostVehicleLabelForCellDisplay(peopleItems, crew.id, day);
                                const cellKeyForPairing2 = `${format(day, "yyyy-MM-dd")}-${crew.id}`;
                                const signatureForPairing2 = getVehicleSignatureForPeople(peopleItems);
                                const pairingDecision2 = getEffectivePairingDecision(cellKeyForPairing2, signatureForPairing2);

                                const isToday = isSameDay(day, new Date());

                                // Ensure all displayItems have valid string IDs and deduplicate
                                const validDisplayItems2 = displayItems.filter(i => i.id && typeof i.id === 'string');
                                const seenIds2 = new Set<string>();
                                const deduplicatedDisplayItems2 = validDisplayItems2.filter(i => {
                                  if (seenIds2.has(i.id)) return false;
                                  seenIds2.add(i.id);
                                  return true;
                                });

                                return (
                                    <DroppableCell 
                                        key={cellId}
                                        id={cellId}
                                        disabled={isReadOnly || isBefore(startOfDay(day), today)}
                                        onClick={() => setSelectedItemIds(new Set())}
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
                                            items={deduplicatedDisplayItems2.map(i => i.id)}
                                            strategy={rectSortingStrategy}
                                            disabled={isReadOnly}
                                        >
                                            <div className="h-full min-h-[120px] w-full flex flex-col gap-1 min-w-0">
                                                {/* Notes appear first, above crew names */}
                                                {noteItems.filter(i => i.id && typeof i.id === 'string').map((item) => (
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
                                                {peopleItems.filter(i => i.id && typeof i.id === 'string').length > 0 && (() => {
                                                  const validPeople = peopleItems.filter((i) => i.id && typeof i.id === "string");
                                                  const operatives = validPeople.filter((p) => p.type === "operative");
                                                  const assistants = validPeople.filter((p) => p.type === "assistant");

                                                  // Pair assistants to operatives by matching vehicleId when possible.
                                                  const unusedAssistants = [...assistants];
                                                  const takeAssistantForOperative = (op: ScheduleItem) => {
                                                    if (op.vehicleId) {
                                                      const idx = unusedAssistants.findIndex((a) => a.vehicleId && a.vehicleId === op.vehicleId);
                                                      if (idx >= 0) return unusedAssistants.splice(idx, 1)[0];
                                                    }
                                                    if (unusedAssistants.length > 0) return unusedAssistants.shift();
                                                    return undefined;
                                                  };

                                                  const rows: Array<{ operative?: ScheduleItem; assistant?: ScheduleItem }> = operatives.map((op) => ({
                                                    operative: op,
                                                    assistant: takeAssistantForOperative(op),
                                                  }));

                                                  // Any remaining assistants become their own row (assistant on the right)
                                                  unusedAssistants.forEach((a) => rows.push({ assistant: a }));

                                                  return (
                                                    <div className="w-full flex flex-col gap-1">
                                                      {rows.map((row, idx) => (
                                                        <div key={`${row.operative?.id || "none"}-${row.assistant?.id || "none"}-${idx}`} className="w-full grid grid-cols-2 gap-1">
                                                          <div className="min-w-0">
                                                            {row.operative ? (
                                                              <OperativeCard
                                                                item={row.operative}
                                                                onEdit={handleEditItem}
                                                                onDelete={(id, mode) => handleDeleteItem(id, mode)}
                                                                onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)}
                                                                employees={employees}
                                                                vehicles={vehicles}
                                                                isReadOnly={isReadOnly || isBefore(startOfDay(new Date(row.operative.date)), startOfDay(new Date()))}
                                                                isSelected={selectedItemIds.has(row.operative.id)}
                                                                onToggleSelection={handleToggleSelection}
                                                                selectedItemIds={selectedItemIds}
                                                                onDuplicateSelected={handleDuplicateSelected}
                                                                onDeleteSelected={handleDeleteSelected}
                                                                onBookTimeOff={handleOpenEmployeeTimeOff}
                                                              />
                                                            ) : (
                                                              <div />
                                                            )}
                                                          </div>
                                                          <div className="min-w-0">
                                                            {row.assistant ? (
                                                              <OperativeCard
                                                                item={row.assistant}
                                                                onEdit={handleEditItem}
                                                                onDelete={(id, mode) => handleDeleteItem(id, mode)}
                                                                onDuplicate={(item, mode, days) => handleDuplicateItem(item, mode, days)}
                                                                employees={employees}
                                                                vehicles={vehicles}
                                                                isReadOnly={isReadOnly || isBefore(startOfDay(new Date(row.assistant.date)), startOfDay(new Date()))}
                                                                isSelected={selectedItemIds.has(row.assistant.id)}
                                                                onToggleSelection={handleToggleSelection}
                                                                selectedItemIds={selectedItemIds}
                                                                onDuplicateSelected={handleDuplicateSelected}
                                                                onDeleteSelected={handleDeleteSelected}
                                                                onBookTimeOff={handleOpenEmployeeTimeOff}
                                                              />
                                                            ) : (
                                                              <div />
                                                            )}
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  );
                                                })()}
                                                {/* Jobs appear last */}
                                                {visibleJobItems.filter(i => i.id && typeof i.id === 'string').map((item) => (
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
                                                        colorLabels={colorLabels}
                                                        vehicleTypes={vehicleTypes}
                                                        vehicleCombinations={vehicleCombinations}
                                                        peopleItems={peopleItems}
                                                        pairingDecisionIsSeparate={pairingDecision2 === "separate"}
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
                        colorLabels={colorLabels}
                        vehicleTypes={vehicleTypes}
                        vehicleCombinations={vehicleCombinations}
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
          groupedItems={groupingDialog.groupedItems}
          crews={crews}
          currentItemId={groupingDialog.itemId}
        />
      )}

      {personMoveDialog && (
        <Dialog
          open={personMoveDialog.open}
          onOpenChange={(open) => {
            if (!open) setPersonMoveDialog(null);
          }}
        >
          <DialogContent className="sm:max-w-[420px] bg-white text-slate-900">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Move operative assignment</DialogTitle>
              <DialogDescription className="text-slate-600">
                Apply this move to just this day, or to the remainder of the displayed week?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setPersonMoveDialog(null)}
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => applyPersonMove("day")}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                This Day Only
              </Button>
              <Button onClick={() => applyPersonMove("week")} className="bg-blue-600 text-white hover:bg-blue-700">
                Remainder of Week
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {vehiclePairingDialog && (
        <VehiclePairingDialog
          open={vehiclePairingDialog.open}
          onOpenChange={(open) => {
            // Closing via ESC/backdrop counts as “Keep Separate”
            if (!open) {
              handleVehiclePairingCancel();
            }
          }}
          onConfirm={handleVehiclePairingConfirm}
          onCancel={handleVehiclePairingCancel}
          vehiclePairing={vehiclePairingDialog.vehiclePairing}
          applyPeriod={vehiclePairingDialog.applyPeriod}
          onApplyPeriodChange={(value) => {
            setVehiclePairingDialog((prev) => (prev ? { ...prev, applyPeriod: value } : prev));
          }}
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
                    {crewDeleteDialog.futureItems.map((item) => (
                      <li key={item.id} className="text-sm text-slate-600 flex items-center gap-2">
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

      {/* Schedule item delete confirmation */}
      {scheduleDeleteConfirm && (
        <AlertDialog open={scheduleDeleteConfirm.open} onOpenChange={(open) => { if (!open) setScheduleDeleteConfirm(null); }}>
          <AlertDialogContent className="bg-white text-slate-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900">Delete item(s)?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-700">
                {scheduleDeleteConfirm.message}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-slate-300 text-slate-700">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  scheduleDeleteConfirm.onConfirm();
                }}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
        employeeAbsences={employeeAbsences}
        vehicles={vehicles}
        items={items} // Pass items for conflict detection
        crews={crews} // Pass crews for validating assignments
        depots={depots} // Pass depots for address calculation
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
                id: generateUniqueId(),
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
        onOpenItemModal={handleOpenItemModal}
      />

      {/* Email Preview Modal */}
      {emailModalDate && (
          <EmailPreviewModal
            open={emailModalOpen}
            onOpenChange={setEmailModalOpen}
            date={emailModalDate}
            items={items}
            employees={employees.map(e => ({...e, jobRole: e.jobRole || 'operative'}))} // Normalize role just in case
            onUpdateEmail={(id, email) =>
              onEmployeeUpdate(
                id,
                employees.find(e => e.id === id)?.name || "Unknown",
                undefined,
                undefined,
                email
              )
            }
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

      {employeeTimeOffConfirm && (
        <AlertDialog
          open={employeeTimeOffConfirm.open}
          onOpenChange={(open) => {
            if (!open) setEmployeeTimeOffConfirm(null);
          }}
        >
          <AlertDialogContent className="bg-white text-slate-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900">
                {employeeTimeOffConfirm.payload.absenceType === "sick"
                  ? "Mark employee sick and remove them from schedule?"
                  : employeeTimeOffConfirm.payload.absenceType === "holiday"
                    ? "Book holiday and remove them from schedule?"
                    : "Apply time off and remove them from schedule?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-700">
                {employeeTimeOffConfirm.payload.absenceType === "sick" ? (
                  <div className="space-y-2">
                    <div>
                      This will remove {employeeTimeOffConfirm.employeeName} from any scheduled day(s) below and mark them as <span className="font-semibold">Sick</span> (they stay unavailable until you mark them Active).
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      This will remove {employeeTimeOffConfirm.employeeName} from any scheduled day(s) below.
                    </div>
                  </div>
                )}
                {employeeTimeOffConfirm.impacted.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Impacted assignments
                    </div>
                    <ul className="max-h-48 overflow-auto text-sm list-disc pl-5">
                      {employeeTimeOffConfirm.impacted.map((i) => (
                        <li key={i.itemId}>
                          {i.dateIso} — {i.crewName} ({i.shift === "unknown" ? "shift?" : i.shift})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-2 text-sm">
                    No current assignments found in that date range.
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-slate-300 text-slate-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => applyEmployeeTimeOffConfirmed(employeeTimeOffConfirm)}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
