import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, MapPin, Users, Truck, Check, ChevronLeft, ChevronRight, Trash2, Edit, MoreVertical, Plus, Settings, UserCog, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface Depot {
  id: string;
  name: string;
  address: string;
  employees: number;
  vehicles: number;
}

interface SidebarProps {
  depots: Depot[];
  selectedDepotId: string | null;
  onSelectDepot: (id: string) => void;
  onEditDepot: () => void;
  onDeleteDepot?: (id: string) => void;
  onUpdateDepot?: (id: string, updates: { name?: string, address?: string }) => void;
  onAddDepot?: () => void;
  isReadOnly?: boolean;
  onOpenSettings?: () => void;
  canAccessSettings?: boolean;
}

export function Sidebar({ depots, selectedDepotId, onSelectDepot, onEditDepot = () => {}, onDeleteDepot = () => {}, onUpdateDepot = () => {}, onAddDepot = () => {}, isReadOnly = false, onOpenSettings, canAccessSettings = false }: SidebarProps) {
  const [search, setSearch] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingDepotId, setEditingDepotId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string, address: string }>({ name: "", address: "" });

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
      className={cn(
        "bg-white border-r border-slate-200 flex flex-col h-full shadow-sm z-20 relative",
        isCollapsed ? "w-14" : "w-72"
      )}
      style={{ transition: "width 300ms ease" }} // Use standard CSS transition instead of Tailwind class for clarity/override
    >
      {/* Collapse Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute -right-3 top-6 w-6 h-6 rounded-full border-slate-200 shadow-sm z-30 bg-white hover:bg-slate-50 p-0"
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
        <div className={cn("space-y-1", isCollapsed ? "p-2" : "p-3")}>
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2 py-1.5">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                      ? "bg-blue-50 border-blue-200 shadow-sm" 
                      : "bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-100"
                  )}
                  title={isCollapsed ? depot.name : undefined}
                >
                  {isCollapsed ? (
                    // Collapsed View Item
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn("font-bold text-xs", isSelected ? "text-blue-700" : "text-slate-700")}>
                        {depot.name.substring(0, 2).toUpperCase()}
                      </span>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                    </div>
                  ) : (
                    // Expanded View Item
                    <>
                      <div className="flex items-center justify-between">
                        <span className={cn("font-semibold text-sm truncate", isSelected ? "text-blue-700" : "text-slate-700")}>
                          {depot.name}
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-blue-600" />}
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{depot.address}</span>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3">
                              <div className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border", isSelected ? "bg-white border-blue-100 text-blue-600" : "bg-slate-100 border-slate-200 text-slate-500")}>
                                  <Users className="w-3 h-3" /> {depot.employees}
                              </div>
                              <div className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border", isSelected ? "bg-white border-blue-100 text-blue-600" : "bg-slate-100 border-slate-200 text-slate-500")}>
                                  <Truck className="w-3 h-3" /> {depot.vehicles}
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
                                <DropdownMenuContent align="end" className="w-48">
                                  {!isReadOnly && (
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditDepot();
                                        }}
                                        className="cursor-pointer flex items-center gap-2"
                                    >
                                        <Settings className="w-4 h-4" />
                                        <span>Manage Crews & Vehicles</span>
                                    </DropdownMenuItem>
                                  )}
                                  {!isReadOnly && <DropdownMenuSeparator />}
                                  {!isReadOnly && (
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingDepotId(depot.id);
                                            setEditForm({ name: depot.name, address: depot.address });
                                        }}
                                        className="cursor-pointer flex items-center gap-2"
                                    >
                                        <Edit className="w-4 h-4" />
                                        <span>Edit Depot Details</span>
                                    </DropdownMenuItem>
                                  )}
                                  {!isReadOnly && (
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteDepot(depot.id);
                                        }}
                                        className="cursor-pointer flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Delete Depot</span>
                                    </DropdownMenuItem>
                                  )}
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
                    <div className="flex flex-col gap-2 px-3 pb-3 bg-slate-50 rounded-b-lg -mt-1 border-x border-b border-blue-200">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Depot Name</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onUpdateDepot(depot.id, editForm);
                              setEditingDepotId(null);
                            } else if (e.key === "Escape") {
                              setEditingDepotId(null);
                            }
                          }}
                          autoFocus
                          className="w-full text-xs px-2 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          placeholder="Depot Name"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Address / Postcode</label>
                        <input
                          type="text"
                          value={editForm.address}
                          onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onUpdateDepot(depot.id, editForm);
                              setEditingDepotId(null);
                            } else if (e.key === "Escape") {
                              setEditingDepotId(null);
                            }
                          }}
                          className="w-full text-xs px-2 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          placeholder="Full Address"
                        />
                      </div>

                      <div className="flex justify-end gap-2 mt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 px-2"
                            onClick={() => setEditingDepotId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                              onUpdateDepot(depot.id, editForm);
                              setEditingDepotId(null);
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
    </div>
  );
}
