import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, MapPin, Users, Truck, Check, ChevronLeft, ChevronRight, Trash2, Edit, MoreVertical, Plus, Settings, UserCog, CreditCard, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export interface Depot {
  id: string;
  name: string;
  address: string;
  employees: number;
  vehicles: number;
}

type UtilMetric = { pct: number; used: number; total: number; avail: number; modeLabel: string };
type DepotUtilMetrics = { staff: UtilMetric; vehicles: UtilMetric };

interface SidebarProps {
  depots: Depot[];
  archivedDepots?: Depot[];
  selectedDepotId: string | null;
  onSelectDepot: (id: string) => void;
  depotMetricsById?: Record<string, DepotUtilMetrics>;
  onEditDepot: () => void;
  onDeleteDepot?: (id: string) => void;
  onRestoreDepot?: (id: string) => void;
  onUpdateDepot?: (id: string, updates: { name?: string, address?: string }) => void;
  onAddDepot?: () => void;
  isReadOnly?: boolean;
  onOpenSettings?: () => void;
  canAccessSettings?: boolean;
}

function MiniDonut({ pct, className }: { pct: number; className?: string }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dashOffset = c * (1 - clamped / 100);
  return (
    <div className={cn("relative w-5 h-5 shrink-0", className)}>
      <svg viewBox="0 0 20 20" className="w-5 h-5 -rotate-90">
        <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="opacity-20" />
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
    </div>
  );
}

function UtilPill({
  label,
  metric,
  isSelected,
  kind,
}: {
  label: string;
  metric: UtilMetric | undefined;
  isSelected: boolean;
  kind: "staff" | "vehicles";
}) {
  const pct = metric?.pct ?? 0;
  const used = metric?.used ?? 0;
  const total = metric?.total ?? 0;
  const avail = metric?.avail ?? Math.max(0, total - used);
  const modeLabel = metric?.modeLabel ?? "Wk";

  const tone =
    pct >= 90
      ? "text-amber-600"
      : kind === "vehicles"
        ? "text-teal-600"
        : isSelected
          ? "text-green-700"
          : "text-blue-700";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full border bg-white/70 backdrop-blur-sm shadow-sm min-w-0",
        isSelected ? "border-green-200" : "border-slate-200"
      )}
      title={`${label} utilisation (${modeLabel}): ${Math.round(pct)}% • used ${used}/${total} • avail ${avail}`}
    >
      <MiniDonut pct={pct} className={tone} />
      <div className="min-w-0 leading-none">
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">{label}</span>
          <span className="text-[9px] text-slate-400">{modeLabel}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] font-semibold text-slate-800 tabular-nums">
            {used}/{total}
          </span>
          <span className="text-[9px] text-slate-500 tabular-nums">Avail {avail}</span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ depots, archivedDepots = [], selectedDepotId, onSelectDepot, depotMetricsById = {}, onEditDepot = () => {}, onDeleteDepot = () => {}, onRestoreDepot = () => {}, onUpdateDepot = () => {}, onAddDepot = () => {}, isReadOnly = false, onOpenSettings, canAccessSettings = false }: SidebarProps) {
  const [search, setSearch] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollContentRef = useRef<HTMLDivElement | null>(null);
  const [editingDepotId, setEditingDepotId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string, address: string }>({ name: "", address: "" });
  const [depotToDelete, setDepotToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showUnsavedBlockMessage, setShowUnsavedBlockMessage] = useState(false);

  const handleToggle = () => {
    setIsCollapsed(!isCollapsed);
    // Dispatch resize event after transition to force layout update
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 305); // slightly longer than the 300ms transition
  };

  const filteredDepots = depots.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div 
      ref={rootRef}
      className={cn(
        "bg-white border-r border-slate-200 flex flex-col h-full shadow-sm z-20 relative shrink-0",
        isCollapsed ? "w-14" : "w-72"
      )}
      style={{ transition: "width 300ms ease" }} // Use standard CSS transition instead of Tailwind class for clarity/override
    >
      {/* Collapse Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute right-2 top-6 w-6 h-6 rounded-full border-slate-200 shadow-sm z-30 bg-white hover:bg-slate-50 p-0"
        onClick={handleToggle}
      >
        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>

      <div className={cn("border-b border-slate-200 bg-slate-50/50 transition-all", isCollapsed ? "p-2" : "p-4")}>
        <div className={cn("flex items-center gap-2 mb-5", isCollapsed && "justify-center mb-2")}>
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                <span className="text-white font-bold text-lg">≈</span>
             </div>
             {!isCollapsed && (
               <h2 className="text-lg font-bold text-slate-800 tracking-tight whitespace-nowrap overflow-hidden">
                Sewer Swarm
               </h2>
             )}
        </div>
        
        {!isCollapsed && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search depots..."
              className="pl-9 bg-white border-slate-200 text-slate-800 focus:ring-blue-600 placeholder:text-slate-400 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 bg-white">
        <div
          ref={scrollContentRef}
          className={cn("space-y-1 w-full min-w-0", isCollapsed ? "p-2" : "p-3")}
        >
          {!isCollapsed && showUnsavedBlockMessage && (
            <p className="text-xs text-amber-600 px-2 py-1 bg-amber-50 border border-amber-200 rounded mb-1">
              Save or cancel your edits before archiving.
            </p>
          )}
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2 py-1.5">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Your Depots
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5 text-slate-400 hover:text-blue-600 disabled:opacity-50"
                    onClick={onAddDepot}
                    title="Add New Depot"
                    disabled={isReadOnly}
                >
                    <Plus className="w-3 h-3" />
                </Button>
            </div>
          )}
          {filteredDepots.map((depot) => {
             const isSelected = selectedDepotId === depot.id;
             return (
              <div key={depot.id} className="space-y-1">
                <div
                  onClick={() => onSelectDepot(depot.id)}
                  className={cn(
                    "group flex flex-col gap-1 rounded-lg cursor-pointer transition-all border",
                    isCollapsed ? "p-2 items-center justify-center" : "p-3",
                    isSelected 
                      ? "bg-green-50 border-green-200 shadow-sm" 
                      : "bg-blue-50 border-blue-100 hover:bg-blue-100 hover:border-blue-200"
                  )}
                  title={isCollapsed ? depot.name : undefined}
                >
                  {isCollapsed ? (
                    // Collapsed View Item
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn("font-bold text-xs", isSelected ? "text-green-700" : "text-blue-700")}>
                        {depot.name.substring(0, 2).toUpperCase()}
                      </span>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-green-600" />}
                    </div>
                  ) : (
                    // Expanded View Item
                    <>
                      <div className="flex items-center justify-between">
                        <span className={cn("font-semibold text-sm truncate", isSelected ? "text-green-700" : "text-blue-700")}>
                          {depot.name}
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-green-600" />}
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-xs text-slate-700">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{depot.address}</span>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <UtilPill
                                  label="Staff"
                                  kind="staff"
                                  isSelected={isSelected}
                                  metric={depotMetricsById[depot.id]?.staff}
                                />
                                <UtilPill
                                  label="Vehicles"
                                  kind="vehicles"
                                  isSelected={isSelected}
                                  metric={depotMetricsById[depot.id]?.vehicles}
                                />
                              </div>
                          </div>

                          {isSelected && (
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 hover:bg-slate-100 rounded-full"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="w-4 h-4 text-slate-600" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-white">
                                  {!isReadOnly ? (
                                    <>
                                      <DropdownMenuItem
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              onEditDepot();
                                          }}
                                          className="cursor-pointer flex items-center gap-2 hover:bg-slate-50 text-black"
                                      >
                                          <Settings className="w-4 h-4" />
                                          <span>Manage Crews & Vehicles</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingDepotId(depot.id);
                                              setEditForm({ name: depot.name, address: depot.address });
                                          }}
                                          className="cursor-pointer flex items-center gap-2 hover:bg-slate-50 text-black"
                                      >
                                          <Edit className="w-4 h-4" />
                                          <span>Edit Depot Details</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              const hasUnsavedEdits = editingDepotId === depot.id && (editForm.name !== depot.name || editForm.address !== depot.address);
                                              if (hasUnsavedEdits) {
                                                setShowUnsavedBlockMessage(true);
                                                setTimeout(() => setShowUnsavedBlockMessage(false), 5000);
                                                return;
                                              }
                                              setDepotToDelete({ id: depot.id, name: depot.name });
                                          }}
                                          className="cursor-pointer flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 hover:bg-red-50"
                                      >
                                          <Trash2 className="w-4 h-4" />
                                          <span>Archive depot</span>
                                      </DropdownMenuItem>
                                    </>
                                  ) : null}
                                  {isReadOnly && (
                                    <DropdownMenuItem disabled className="text-xs text-slate-400">
                                        Read Only Mode
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                          )}
                      </div>
                    </>
                  )}
                </div>
                {isSelected && !isCollapsed && editingDepotId === depot.id && (
                    <div className="flex flex-col gap-2 px-3 pb-3 bg-green-50 rounded-b-lg -mt-1 border-x border-b border-green-200">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide">
                          Depot Name
                        </label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onUpdateDepot(depot.id, editForm);
                              setEditingDepotId(null);
                              setShowUnsavedBlockMessage(false);
                            } else if (e.key === "Escape") {
                              setEditingDepotId(null);
                              setShowUnsavedBlockMessage(false);
                            }
                          }}
                          autoFocus
                          className="w-full text-xs px-2 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-600"
                          placeholder="Depot name"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide">
                          Address / Postcode
                        </label>
                        <input
                          type="text"
                          value={editForm.address}
                          onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onUpdateDepot(depot.id, editForm);
                              setEditingDepotId(null);
                              setShowUnsavedBlockMessage(false);
                            } else if (e.key === "Escape") {
                              setEditingDepotId(null);
                              setShowUnsavedBlockMessage(false);
                            }
                          }}
                          className="w-full text-xs px-2 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-600"
                          placeholder="Unit, street, town, postcode"
                        />
                      </div>

                      <div className="flex justify-end gap-2 mt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 px-2 text-slate-700 hover:bg-slate-100"
                            onClick={() => { setEditingDepotId(null); setShowUnsavedBlockMessage(false); }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                              onUpdateDepot(depot.id, editForm);
                              setEditingDepotId(null);
                              setShowUnsavedBlockMessage(false);
                            }}
                          >
                            Save Changes
                          </Button>
                      </div>
                    </div>
                )}
              </div>
            );
          })}

          {!isCollapsed && archivedDepots.length > 0 && (
            <div className="pt-3 mt-3 border-t border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1.5">
                Archived depots
              </div>
              <div className="space-y-1">
                {archivedDepots.map((d) => (
                  <div
                    key={d.id}
                    className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-700 truncate">{d.name}</div>
                      <div className="text-xs text-slate-500 truncate">{d.address}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-7 w-7 p-0 border-slate-300 text-slate-700 hover:bg-slate-100"
                      onClick={() => onRestoreDepot(d.id)}
                      disabled={isReadOnly}
                      title="Restore"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="sr-only">Restore</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
           {canAccessSettings && onOpenSettings && (
             <Button
               variant="outline"
               className="w-full justify-start gap-2 text-slate-600 hover:text-blue-600 hover:border-blue-200"
               onClick={onOpenSettings}
               data-testid="button-settings"
             >
               <UserCog className="w-4 h-4" />
               <span>Team & Settings</span>
             </Button>
           )}
           <div className="text-xs text-slate-400 text-center">
              Sewer Swarm AI © 2025
              <br/>
              <span className="opacity-70">v2.1.0 (Production)</span>
           </div>
        </div>
      )}
      {isCollapsed && canAccessSettings && onOpenSettings && (
        <div className="p-2 border-t border-slate-200 bg-slate-50 flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-slate-500 hover:text-blue-600"
            onClick={onOpenSettings}
            title="Team & Settings"
            data-testid="button-settings-collapsed"
          >
            <UserCog className="w-4 h-4" />
          </Button>
        </div>
      )}

      <AlertDialog open={!!depotToDelete} onOpenChange={(open) => { if (!open) setDepotToDelete(null); }}>
        <AlertDialogContent className="bg-white text-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">Archive depot?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-700">
              Archive {depotToDelete?.name}? It will be hidden from the list. You can restore it later from the Archived section below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-300 text-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (depotToDelete) {
                  onDeleteDepot(depotToDelete.id);
                  setDepotToDelete(null);
                }
              }}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
