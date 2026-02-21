import { format, isBefore, startOfDay } from "date-fns";
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
import { useUISettings } from "@/hooks/useUISettings";
import { getVehicleTypeDisplayName, normalizeVehicleTypeName, type VehicleCombinationConfig } from "@/lib/vehicleTypes";

interface SiteCardProps {
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string, mode: 'single' | 'week' | 'remainder_month' | 'remainder_year' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months') => void;
  onDuplicate: (item: ScheduleItem, mode: 'single' | 'week' | 'following_week' | 'custom' | 'remainder_month' | 'remainder_year' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months', days?: number) => void;
  isReadOnly?: boolean;
  /** If true, this card cannot be dragged/reordered (used for linked ghost/free cards under an operative). */
  disableDrag?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string, multi: boolean) => void;
  selectedItemIds?: Set<string>;
  onDuplicateSelected?: (mode: 'single' | 'week' | 'following_week' | 'custom' | 'remainder_month' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months' | 'remainder_year', days?: number) => void;
  onDeleteSelected?: (mode: 'single' | 'week' | 'remainder_month' | 'remainder_year' | 'next_2_months' | 'next_3_months' | 'next_4_months' | 'next_5_months' | 'next_6_months') => void;
  vehicles?: { id: string; name: string; vehicleType?: string; category?: string; color?: string }[];
  /** Optional override for the label shown in the ghost (free) address bar. */
  ghostVehicleLabel?: string;
  /** Color label mapping (used to keep Free-card labels stable even when people/vehicles change). */
  colorLabels?: Record<string, string>;
  /** Vehicle types configuration to look up colors for categories like "CCTV/Jet Vac" */
  vehicleTypes?: string[] | Array<{ type: string; defaultColor?: string }>;
  /** Combination config from Scheduling settings; when ghostVehicleLabel matches a combination, use its color */
  vehicleCombinations?: VehicleCombinationConfig[];
  /** People items from the same cell (to find actual vehicles for color lookup) */
  peopleItems?: ScheduleItem[];
  /** When true, user chose "Keep Separate" for this cell; do not use combination color */
  pairingDecisionIsSeparate?: boolean;
}

export function SiteCard({ item, onEdit, onDelete, onDuplicate, isReadOnly = false, disableDrag = false, isSelected = false, onToggleSelection, selectedItemIds, onDuplicateSelected, onDeleteSelected, vehicles = [], ghostVehicleLabel, colorLabels, vehicleTypes, vehicleCombinations, peopleItems = [], pairingDecisionIsSeparate = false }: SiteCardProps) {
  // (debug logs removed)
  const hasMultipleSelected = selectedItemIds && selectedItemIds.size > 1 && selectedItemIds.has(item.id);
  const { settings } = useUISettings();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: item, disabled: isReadOnly || disableDrag });

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
  // Delete options: solid white background (Style 1), only subtle neutral hover
  const softDangerItemClass =
    "cursor-pointer flex items-center gap-2 text-red-500 hover:bg-slate-50 focus:bg-slate-50 focus:text-red-600";
  const softDangerSubTriggerClass =
    "cursor-pointer flex items-center gap-2 text-red-500 data-[state=open]:bg-slate-50 data-[state=open]:text-red-600";

  // Get vehicle color if vehicle is assigned - ALWAYS pull from vehicleTypes configuration, not vehicle.color
  const vehicle = item.vehicleId ? vehicles.find(v => v.id === item.vehicleId) : null;
  
  // Helper to get default color for a vehicle type from vehicleTypes config
  const getDefaultColorForType = (type: string): string | undefined => {
    if (!vehicleTypes || vehicleTypes.length === 0) return undefined;
    const typeObj = vehicleTypes.find(t => {
      const typeName = typeof t === 'string' ? t : t.type;
      // Exact match (case-sensitive)
      if (typeName === type) return true;
      // Also try case-insensitive match
      return typeName?.toLowerCase() === type?.toLowerCase();
    });
    return (typeof typeObj === 'object' && typeObj?.defaultColor) ? typeObj.defaultColor : undefined;
  };

  // Get color from vehicleTypes based on vehicle's vehicleType (this is where colors are set in the UI)
  let vehicleColor: string | undefined = undefined;
  if (vehicle?.vehicleType) {
    vehicleColor = getDefaultColorForType(vehicle.vehicleType);
  }
  // Fallback to vehicle.color only if vehicleTypes doesn't have a color for this type
  if (!vehicleColor && vehicle?.color) {
    vehicleColor = vehicle.color;
  }

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

  // Check if this is a free/ghost job
  const isFreeJob = item.jobStatus === 'free' || item.customer === 'Free';
  // Check if this is a virtual remaining free time ghost item (not in database)
  const isRemainingFreeTimeGhost = item.id?.startsWith('free-remaining-');
  // Free/ghost text should come from Vehicle Types dropdown names (never from job color labels like "Urgent").
  // - If this cell is paired (CCTV + Jet Vac/Recycler), show CCTV/Jet Vac (as named in Vehicle Types config)
  // - Otherwise show the vehicle's own type (as named in Vehicle Types config), falling back to ghostVehicleLabel
  const isPairedLabel =
    !!ghostVehicleLabel &&
    (vehicleCombinations?.some(
      (c) => normalizeVehicleTypeName(c.label) === normalizeVehicleTypeName(ghostVehicleLabel)
    ) ?? normalizeVehicleTypeName(ghostVehicleLabel) === normalizeVehicleTypeName("CCTV/Jet Vac"));

  const deriveVehicleTypeLabel = (): string | undefined => {
    if (!vehicle) return undefined;
    const name = normalizeVehicleTypeName(vehicle.name);
    const cat = normalizeVehicleTypeName(vehicle.category);
    const type = normalizeVehicleTypeName(vehicle.vehicleType);

    // Treat BJJ and CCTV/Van Pack as CCTV/Van Pack regardless of what vehicleType string currently says.
    if (name.includes("bjj") || cat.includes("cctvvan") || type.includes("cctvvan")) return "CCTV/Van Pack";
    if (cat.includes("cctv") || type.includes("cctv") || name.includes("cctv")) return "CCTV";
    if (cat.includes("recycl") || type.includes("recycl") || name.includes("recycl")) return "Recycler";
    if (cat.includes("jet") || type.includes("jet") || name.includes("jet")) return "Jet Vac";
    return vehicle.vehicleType || vehicle.category;
  };

  const freeJobVehicleLabel =
    (isFreeJob && !isRemainingFreeTimeGhost && isPairedLabel && ghostVehicleLabel
      ? (getVehicleTypeDisplayName(ghostVehicleLabel, vehicleTypes) || ghostVehicleLabel)
      : undefined) ||
    (isFreeJob && !isRemainingFreeTimeGhost && vehicle
      ? getVehicleTypeDisplayName(deriveVehicleTypeLabel(), vehicleTypes)
      : undefined) ||
    getVehicleTypeDisplayName(ghostVehicleLabel, vehicleTypes) ||
    vehicle?.vehicleType ||
    vehicle?.category ||
    "No Vehicle Type";

  const handleDuplicateClick = (
    mode:
      | "single"
      | "week"
      | "following_week"
      | "custom"
      | "remainder_month"
      | "remainder_year"
      | "next_2_months"
      | "next_3_months"
      | "next_4_months"
      | "next_5_months"
      | "next_6_months",
    days?: number
  ) => {
    onDuplicate(item, mode, days);
  };

  // (debug logs removed)

  // Look up color from vehicleTypes config based on ghostVehicleLabel (for both free and booked jobs)
  let effectiveVehicleColor = vehicleColor;

  if (ghostVehicleLabel) {
    // If label matches a combination from Scheduling settings, use that combination's color
    const comboMatch = vehicleCombinations?.find(
      (c) => normalizeVehicleTypeName(c.label) === normalizeVehicleTypeName(ghostVehicleLabel)
    );
    if (comboMatch) {
      effectiveVehicleColor = comboMatch.defaultColor;
    } else if (ghostVehicleLabel === "CCTV/Jet Vac") {
      // PRIORITY: For "CCTV/Jet Vac", always check vehicleTypes for "CCTV/Jet Vac" type first (fallback when no combination config)
      // 1. First check for "CCTV/Jet Vac" type in vehicleTypes (this is where the pink color is set)
      const cctvJetVacTypeColor = getDefaultColorForType("CCTV/Jet Vac");
      if (cctvJetVacTypeColor) {
        effectiveVehicleColor = cctvJetVacTypeColor;
      } else {
        // 2. Check for "Recycler" type (since Recycler triggers "CCTV/Jet Vac")
        const recyclerTypeColor = getDefaultColorForType("Recycler");
        if (recyclerTypeColor) {
          effectiveVehicleColor = recyclerTypeColor;
        } else {
          // 3. Check for "Jet Vac" type
          const jetVacTypeColor = getDefaultColorForType("Jet Vac");
          if (jetVacTypeColor) {
            effectiveVehicleColor = jetVacTypeColor;
          } else {
            // 4. Only if vehicleTypes don't have colors, fall back to vehicle colors
            // Fallback for "CCTV/Jet Vac": look for vehicles from the actual cell (peopleItems) first
            const normalize = (value?: string) => (value || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "").replace(/\//g, "");
            
            // Get vehicle IDs from peopleItems in this cell
            const cellVehicleIds = peopleItems
              .map(p => p.vehicleId)
              .filter((id): id is string => Boolean(id));
            
            // Get the actual vehicles from this cell
            const cellVehicles = vehicles.filter(v => cellVehicleIds.includes(v.id));
            
            // First, try to find Jet Vac or Recycler vehicle from the cell (these trigger "CCTV/Jet Vac")
            let cctvJetVacVehicle = cellVehicles.find(v => {
              const cat = normalize(v.category);
              const type = normalize(v.vehicleType);
              const name = normalize(v.name);
              return cat.includes("jet") || type.includes("jet") || name.includes("jet") ||
                     cat.includes("recycl") || type.includes("recycl") || name.includes("recycl");
            });
            
            // If not found in cell vehicles, try exact category match in all vehicles
            if (!cctvJetVacVehicle) {
              cctvJetVacVehicle = vehicles.find(v => 
                v.category === "CCTV/Jet Vac" || v.category === "CCTV/JET VAC"
              );
            }
            
            // If still not found, look for Jet Vac or Recycler in all vehicles
            if (!cctvJetVacVehicle) {
              cctvJetVacVehicle = vehicles.find(v => {
                const cat = normalize(v.category);
                const type = normalize(v.vehicleType);
                const name = normalize(v.name);
                return cat.includes("jet") || type.includes("jet") || name.includes("jet") ||
                       cat.includes("recycl") || type.includes("recycl") || name.includes("recycl");
              });
            }
            
            // If still not found, look for CCTV vehicle from the cell as fallback
            if (!cctvJetVacVehicle) {
              cctvJetVacVehicle = cellVehicles.find(v => {
                const cat = normalize(v.category);
                const type = normalize(v.vehicleType);
                const name = normalize(v.name);
                return cat.includes("cctv") || type.includes("cctv") || name.includes("cctv");
              });
            }
            
            // Last resort: look for any CCTV vehicle
            if (!cctvJetVacVehicle) {
              cctvJetVacVehicle = vehicles.find(v => {
                const cat = normalize(v.category);
                const type = normalize(v.vehicleType);
                const name = normalize(v.name);
                return cat.includes("cctv") || type.includes("cctv") || name.includes("cctv");
              });
            }
            
            // Get color from vehicleTypes based on the Recycler/Jet Vac vehicle's vehicleType
            if (cctvJetVacVehicle?.vehicleType) {
              const vehicleTypeColor = getDefaultColorForType(cctvJetVacVehicle.vehicleType);
              if (vehicleTypeColor) {
                effectiveVehicleColor = vehicleTypeColor;
              } else {
                // If vehicleTypes doesn't have a color for this type, try to find ANY Recycler or Jet Vac type in vehicleTypes
                const recyclerTypeColor = getDefaultColorForType("Recycler");
                const jetVacTypeColor = getDefaultColorForType("Jet Vac");
                if (recyclerTypeColor) {
                  effectiveVehicleColor = recyclerTypeColor;
                } else if (jetVacTypeColor) {
                  effectiveVehicleColor = jetVacTypeColor;
                }
              }
            } else {
              // Fallback: try to find ANY Recycler or Jet Vac vehicle and get its color from vehicleTypes
              const anyRecyclerOrJetVac = vehicles.find(v => {
                const cat = normalize(v.category);
                const type = normalize(v.vehicleType);
                const name = normalize(v.name);
                return (cat.includes("jet") || type.includes("jet") || name.includes("jet") ||
                        cat.includes("recycl") || type.includes("recycl") || name.includes("recycl")) &&
                       v.vehicleType; // Must have a vehicleType
              });
              
              if (anyRecyclerOrJetVac?.vehicleType) {
                const vehicleTypeColor = getDefaultColorForType(anyRecyclerOrJetVac.vehicleType);
                if (vehicleTypeColor) {
                  effectiveVehicleColor = vehicleTypeColor;
                }
              }
            }
          }
        }
      }
    } else if (ghostVehicleLabel === "CCTV/Van Pack") {
      // First try to get color from vehicleTypes for "CCTV/Van Pack"
      const cctvVanPackTypeColor = getDefaultColorForType("CCTV/Van Pack");
      if (cctvVanPackTypeColor) {
        effectiveVehicleColor = cctvVanPackTypeColor;
      } else {
        // Look for a vehicle with that category or BJJ and get color from vehicleTypes
        const cctvVanPackVehicle = vehicles.find(v => 
          v.category === "CCTV/Van Pack" || 
          v.category === "CCTV/VAN PACK" ||
          v.name.toLowerCase().includes("bjj") ||
          (v.vehicleType && v.vehicleType.toLowerCase().includes("bjj"))
        );
        if (cctvVanPackVehicle?.vehicleType) {
          const vehicleTypeColor = getDefaultColorForType(cctvVanPackVehicle.vehicleType);
          if (vehicleTypeColor) {
            effectiveVehicleColor = vehicleTypeColor;
          }
        }
      }
    } else {
      // For individual types like "CCTV" or "Jet Vac", get color from vehicleTypes
      const typeColor = getDefaultColorForType(ghostVehicleLabel);
      if (typeColor) {
        effectiveVehicleColor = typeColor;
      } else {
        // Fallback: try to find a vehicle with matching category/type and get color from vehicleTypes
        const matchingVehicle = vehicles.find(v => {
          const normalizedLabel = ghostVehicleLabel.toLowerCase().replace(/\s+/g, "").replace(/-/g, "").replace(/\//g, "");
          const normalizedCategory = (v.category || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "").replace(/\//g, "");
          const normalizedType = (v.vehicleType || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "").replace(/\//g, "");
          return (normalizedCategory.includes(normalizedLabel) || normalizedType.includes(normalizedLabel)) && v.vehicleType;
        });
        if (matchingVehicle?.vehicleType) {
          const vehicleTypeColor = getDefaultColorForType(matchingVehicle.vehicleType);
          if (vehicleTypeColor) {
            effectiveVehicleColor = vehicleTypeColor;
          }
        }
      }
    }
  }

  // Always prefer combination color from Scheduling settings when this cell's label matches a combination—
  // unless the user chose "Keep Separate" for this cell.
  const finalComboMatch =
    !pairingDecisionIsSeparate &&
    ghostVehicleLabel
      ? vehicleCombinations?.find(
          (c) => normalizeVehicleTypeName(c.label) === normalizeVehicleTypeName(ghostVehicleLabel)
        )
      : undefined;
  if (finalComboMatch) {
    effectiveVehicleColor = finalComboMatch.defaultColor;
  }

  // Use vehicle color as base color if available, otherwise use item color, otherwise default to blue
  const baseColorKey = effectiveVehicleColor || item.color || 'blue';
  const baseColor = colorClasses[baseColorKey] || colorClasses.blue;
  
  // (debug logs removed)
  
  // Check if this is a past job (allow editing job status even in read-only mode)
  const isPastJob = item.date ? isBefore(startOfDay(new Date(item.date)), startOfDay(new Date())) : false;
  const canEditPastJobStatus = isReadOnly && isPastJob && item.type === 'job';

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
            style={{
                ...style,
                ...(effectiveVehicleColor?.startsWith('#') ? { borderLeftColor: effectiveVehicleColor } :
                    item.color?.startsWith('#') ? { borderLeftColor: item.color } : {})
            }}
            {...attributes}
            {...listeners}
            onDoubleClick={(e) => {
                e.stopPropagation();
                // For remaining free time ghost items, create a new job instead of editing
                // The handleEditItem in CalendarGrid will handle creating a new job
                if (!isReadOnly || canEditPastJobStatus) {
                    onEdit(item);
                }
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
                // Ghost styling for free jobs
                isFreeJob && "opacity-60 border-dashed",
                // Use named color classes if not hex
                !effectiveVehicleColor?.startsWith('#') && !item.color?.startsWith('#') && 
                (effectiveVehicleColor || item.color || 'blue') && colorClasses[effectiveVehicleColor || item.color || 'blue'] 
                  ? colorClasses[effectiveVehicleColor || item.color || 'blue'].replace('bg-', 'border-l-').split(' ')[1] 
                  : 'border-l-blue-500'
            )}
            >
            {/* Top Row: Customer | Site | Onsite Time */}
            <div 
                className={cn("px-1.5 py-1 text-[10px] font-bold flex justify-between items-center bg-opacity-30", 
                    // Use baseColor background class if it's a named color (not hex)
                    !effectiveVehicleColor?.startsWith('#') && !item.color?.startsWith('#') && baseColor
                        ? baseColor.split(' ')[0] 
                        : "bg-blue-100"
                )}
                style={{
                    // Use hex color directly if available (effectiveVehicleColor takes priority)
                    backgroundColor: effectiveVehicleColor?.startsWith('#') 
                        ? `${effectiveVehicleColor}30` 
                        : item.color?.startsWith('#')
                        ? `${item.color}30`
                        : undefined
                }}
            >
                {isFreeJob ? (
                    // Display for free jobs - show time range if it's a remaining free time slot
                    <div className="flex items-center gap-1 truncate max-w-[90%] min-w-0">
                        {item.address && item.address.includes('available') ? (
                            // Remaining free time slot - show time range
                            <span className="truncate shrink-1 text-slate-600 font-medium">{item.address}</span>
                        ) : (
                            // Regular free job - just "Free"
                            <span className="truncate shrink-1">Free</span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-1 truncate max-w-[90%] min-w-0">
                        <span className="truncate shrink-1">{item.customer}</span>
                        {(settings.showStartTime || settings.showOnsiteTime) && <span className="opacity-50">|</span>}
                        {(settings.showStartTime || settings.showOnsiteTime) && (
                            <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-2.5 h-2.5" />
                                {settings.showStartTime && item.startTime && <span className="opacity-75">{item.startTime} -</span>}
                                {settings.showOnsiteTime && (item.onsiteTime || "TBC")}
                                {item.projectManager && <span className="ml-1 text-slate-500 opacity-75 font-sans font-semibold">({item.projectManager})</span>}
                            </span>
                        )}
                    </div>
                )}
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-black/10 text-current">
                        <MoreHorizontal className="h-3 w-3" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-white">
                    {(!isReadOnly || canEditPastJobStatus) && (
                        <>
                        <DropdownMenuItem
                            onClick={() => onEdit(item)}
                            disabled={hasMultipleSelected}
                            className={hasMultipleSelected ? "opacity-50 cursor-not-allowed" : softMenuItemClass}
                        >
                            <Edit className="w-3 h-3 mr-2" /> {canEditPastJobStatus ? "Update Job Status" : isRemainingFreeTimeGhost ? "Click to book" : "Edit"}
                        </DropdownMenuItem>
                        
                        {hasMultipleSelected && onDuplicateSelected && !isRemainingFreeTimeGhost ? (
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
                                {!canEditPastJobStatus && (
                                    <>
                                        {!isRemainingFreeTimeGhost && (
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className={softSubTriggerClass}>
                                                <Copy className="w-3 h-3 mr-2" /> Duplicate
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="w-48 bg-white">
                                                <DropdownMenuItem onClick={() => handleDuplicateClick('single')} className={softMenuItemClass}>
                                                    Duplicate Single
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicateClick('custom', 5)} className={softMenuItemClass}>
                                                    <CalendarDays className="w-3 h-3 mr-2" /> Next 5 Days
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicateClick('week')} className={softMenuItemClass}>
                                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Week
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicateClick('following_week')} className={softMenuItemClass}>
                                                    <CalendarRange className="w-3 h-3 mr-2" /> Following Week
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleDuplicateClick('remainder_month')} className={softMenuItemClass}>
                                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Month
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicateClick('remainder_year')} className={softMenuItemClass}>
                                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Year
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicateClick('next_2_months')} className={softMenuItemClass}>
                                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 2 Months
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicateClick('next_3_months')} className={softMenuItemClass}>
                                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 3 Months
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicateClick('next_4_months')} className={softMenuItemClass}>
                                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 4 Months
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicateClick('next_5_months')} className={softMenuItemClass}>
                                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 5 Months
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicateClick('next_6_months')} className={softMenuItemClass}>
                                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 6 Months
                                                </DropdownMenuItem>
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                        )}
                                        <DropdownMenuSeparator />
                                        {!isRemainingFreeTimeGhost && (
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
                                        )}
                                    </>
                                )}
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

            {/* Bottom Row: Job Number | Address */}
            <div className="p-2 space-y-1 bg-white flex items-center gap-2">
                {isFreeJob ? (
                    // For free jobs, show derived vehicle / category label in the address field.
                    // For the virtual remaining-free-time ghost, show its availability text instead (it's not tied to a vehicle).
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span className="break-words whitespace-normal leading-tight text-[10px] text-slate-600 line-clamp-2">
                            {isRemainingFreeTimeGhost ? (item.address || "Available") : freeJobVehicleLabel}
                        </span>
                    </div>
                ) : (
                    <>
                        {/* Compact Job Number */}
                        <div className="flex items-center gap-1 shrink-0">
                             <span className="text-[9px] font-bold bg-slate-100 px-1 py-0.5 rounded text-slate-600 border border-slate-200">
                                {item.jobNumber || "NO REF"}
                             </span>
                             {/* Explicit Duration Badge */}
                             {settings.showDurationBadge && (
                                 <span className="text-[9px] font-semibold bg-blue-50 px-1 py-0.5 rounded text-blue-600 border border-blue-100">
                                    {item.duration}h
                                 </span>
                             )}
                        </div>

                        <div className="flex items-center gap-1 min-w-0 flex-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span className="break-words whitespace-normal leading-tight text-[10px] text-slate-600 line-clamp-2">{item.address}</span>
                        </div>
                    </>
                )}
            </div>
            </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48 bg-white">
            {(!isReadOnly || canEditPastJobStatus) && (
                <>
                <ContextMenuItem onClick={() => onEdit(item)} className={softMenuItemClass}>
                    <Edit className="w-3 h-3 mr-2" /> {canEditPastJobStatus ? "Update Job Status" : isRemainingFreeTimeGhost ? "Click to book" : "Edit"}
                </ContextMenuItem>
                
                {!canEditPastJobStatus && !isRemainingFreeTimeGhost && (
                    <>
                <ContextMenuSub>
                    <ContextMenuSubTrigger className={softSubTriggerClass}>
                                <Copy className="w-3 h-3 mr-2" /> Duplicate
                            </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48 bg-white">
                        <ContextMenuItem onClick={() => handleDuplicateClick('single')} className={softMenuItemClass}>
                                    Duplicate Single
                                </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDuplicateClick('custom', 5)} className={softMenuItemClass}>
                                    <CalendarDays className="w-3 h-3 mr-2" /> Next 5 Days
                                </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDuplicateClick('week')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Week
                                </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDuplicateClick('following_week')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Following Week
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => handleDuplicateClick('remainder_month')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Month
                                </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDuplicateClick('remainder_year')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Remainder of Year
                                </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDuplicateClick('next_2_months')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 2 Months
                                </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDuplicateClick('next_3_months')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 3 Months
                                </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDuplicateClick('next_4_months')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 4 Months
                                </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDuplicateClick('next_5_months')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 5 Months
                                </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDuplicateClick('next_6_months')} className={softMenuItemClass}>
                                    <CalendarRange className="w-3 h-3 mr-2" /> Next 6 Months
                                </ContextMenuItem>
                            </ContextMenuSubContent>
                        </ContextMenuSub>

                        <ContextMenuSeparator />

                {!isRemainingFreeTimeGhost && (
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
                )}
                    </>
                )}
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
