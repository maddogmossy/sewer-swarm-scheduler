import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, Plus, User, Truck, AlertCircle, Mail, Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ResourcesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employees: {
        id: string
        name: string
        status: 'active' | 'holiday' | 'sick'
        email?: string
        jobRole?: 'operative' | 'assistant'
        homePostcode?: string
        startsFromHome?: boolean
    }[];
    vehicles: {
        id: string
        name: string
        status: 'active' | 'off_road' | 'maintenance'
        category?: string
        color?: string
        vehicleType?: string
    }[];
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
    onVehicleCreate: (name: string, category?: string) => void;
    onVehicleUpdate: (
        id: string,
        name: string,
        status?: 'active' | 'off_road' | 'maintenance',
        category?: string,
        color?: string
    ) => void;
    onVehicleDelete: (id: string) => void;
    vehicleTypes?: string[];
}

// Common vehicle categories
const VEHICLE_CATEGORIES = ["CCTV", "JETTING", "CCTV/Jet Vac", "RECYCLER", "VAN", "OTHER"];

export function ResourcesModal({ 
    open, onOpenChange, 
    employees, vehicles,
    onEmployeeCreate, onEmployeeUpdate, onEmployeeDelete,
    onVehicleCreate, onVehicleUpdate, onVehicleDelete,
    vehicleTypes = []
}: ResourcesModalProps) {
    const [newItemName, setNewItemName] = useState("");
    const [newVehicleCategory, setNewVehicleCategory] = useState<string>("VAN");
    const [editingEmployee, setEditingEmployee] = useState<{
        id: string
        name: string
        status: 'active' | 'holiday' | 'sick'
        email?: string
        homePostcode?: string
        startsFromHome?: boolean
    } | null>(null);
    const [editingVehicle, setEditingVehicle] = useState<{ id: string, name: string, status: 'active' | 'off_road' | 'maintenance', category?: string, color?: string } | null>(null);
    const [timeOffModal, setTimeOffModal] = useState<{
        open: boolean;
        employeeId: string | null;
        employeeName: string;
    }>({ open: false, employeeId: null, employeeName: "" });
    const [vehicleOffModal, setVehicleOffModal] = useState<{
        open: boolean;
        vehicleId: string | null;
        vehicleName: string;
    }>({ open: false, vehicleId: null, vehicleName: "" });

    const handleAdd = (type: 'employee' | 'vehicle') => {
        if (!newItemName.trim()) return;
        if (type === 'employee') {
            onEmployeeCreate(newItemName);
            setNewItemName("");
        } else {
            // For vehicles, create with the selected category
            onVehicleCreate(newItemName, newVehicleCategory);
            setNewItemName("");
            setNewVehicleCategory("VAN");
        }
    };

    // Group vehicles by category (preferred) or type (fallback) - matching DepotCrewModal
    const vehiclesByCategory = vehicles.reduce((acc, veh) => {
        const groupKey = veh.category || veh.vehicleType || "OTHER";
        if (!acc[groupKey]) {
            acc[groupKey] = [];
        }
        acc[groupKey].push(veh);
        return acc;
    }, {} as Record<string, typeof vehicles>);
    
    // Sort categories alphabetically
    const sortedCategories = Object.keys(vehiclesByCategory).sort();
    
    // Sort vehicles within each category alphabetically
    sortedCategories.forEach(cat => {
        vehiclesByCategory[cat].sort((a, b) => a.name.localeCompare(b.name));
    });

    const handleEmployeeSave = () => {
        if (!editingEmployee || !editingEmployee.name.trim()) return;
        onEmployeeUpdate(
            editingEmployee.id,
            editingEmployee.name,
            editingEmployee.status,
            undefined,
            editingEmployee.email,
            editingEmployee.homePostcode,
            editingEmployee.startsFromHome
        );
        setEditingEmployee(null);
    };

    const handleVehicleSave = () => {
        if (!editingVehicle || !editingVehicle.name.trim()) return;
        onVehicleUpdate(editingVehicle.id, editingVehicle.name, editingVehicle.status, editingVehicle.category, editingVehicle.color);
        setEditingVehicle(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-white text-slate-900 h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Resources</DialogTitle>
                </DialogHeader>
                
                {/* Style 2 segmented tabs */}
                <Tabs defaultValue="employees" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="grid w-full grid-cols-2 bg-slate-100 rounded-lg p-1 mb-4">
                        <TabsTrigger
                            value="employees"
                            className="text-sm font-semibold data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=inactive]:text-slate-600"
                        >
                            Employees
                        </TabsTrigger>
                        <TabsTrigger
                            value="vehicles"
                            className="text-sm font-semibold data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=inactive]:text-slate-600"
                        >
                            Vehicles
                        </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="employees" className="flex-1 flex flex-col min-h-0 space-y-4">
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Add new employee name..." 
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd('employee')}
                            />
                            <Button
                                onClick={() => handleAdd('employee')}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Add
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md bg-slate-50 divide-y divide-slate-100">
                            {employees
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(emp => (
                                <div key={emp.id} className="p-3 flex items-center justify-between hover:bg-slate-50 bg-white">
                                    {editingEmployee?.id === emp.id ? (
                                        <div className="flex items-center gap-2 flex-1 mr-4">
                                            <div className="flex flex-col gap-2 flex-1">
                                                <Input 
                                                    value={editingEmployee.name} 
                                                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                                                    autoFocus
                                                    className="w-full"
                                                    placeholder="Name"
                                                />
                                                <Input 
                                                    value={editingEmployee.email || ""} 
                                                    onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                                                    className="w-full text-xs"
                                                    placeholder="Email address (optional)"
                                                    type="email"
                                                />
                                                <div className="flex items-center gap-3">
                                                    <Input
                                                        value={editingEmployee.homePostcode || ""}
                                                        onChange={(e) =>
                                                          setEditingEmployee({
                                                            ...editingEmployee,
                                                            homePostcode: e.target.value,
                                                          })
                                                        }
                                                        className="w-32 text-xs"
                                                        placeholder="Home postcode"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                          id={`starts-from-home-${editingEmployee.id}`}
                                                          checked={!!editingEmployee.startsFromHome}
                                                          onCheckedChange={(checked) =>
                                                            setEditingEmployee({
                                                              ...editingEmployee,
                                                              startsFromHome: checked,
                                                            })
                                                          }
                                                          className="data-[state=checked]:bg-blue-600"
                                                        />
                                                        <Label
                                                          htmlFor={`starts-from-home-${editingEmployee.id}`}
                                                          className="text-[11px] text-slate-700 cursor-pointer"
                                                        >
                                                          Starts from home (else depot)
                                                        </Label>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button size="sm" onClick={handleEmployeeSave}>Save</Button>
                                            <Button size="sm" variant="ghost" onClick={() => setEditingEmployee(null)}>Cancel</Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{emp.name}</span>
                                                <div className="flex items-center gap-2">
                                                    {emp.status !== 'active' && (
                                                        <span className="text-xs text-amber-600 font-medium uppercase tracking-wider flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" /> {emp.status}
                                                        </span>
                                                    )}
                                                    {emp.email ? (
                                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                                            <Mail className="w-3 h-3" /> {emp.email}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-red-400 flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" /> No Email
                                                        </span>
                                                    )}
                                                    {emp.homePostcode && (
                                                      <span className="text-[11px] text-slate-500">
                                                        Home: {emp.homePostcode}{" "}
                                                        {emp.startsFromHome ? "(starts from home)" : "(starts from depot)"}
                                                      </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {editingEmployee?.id !== emp.id && (
                                        <div className="flex gap-1">
                                            {/* Book time off / status button */}
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                title="Book time off / sickness"
                                                onClick={() =>
                                                    setTimeOffModal({
                                                        open: true,
                                                        employeeId: emp.id,
                                                        employeeName: emp.name,
                                                    })
                                                }
                                            >
                                                <CalendarIcon className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => setEditingEmployee(emp)}>
                                                <Edit className="w-4 h-4 text-slate-500" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => onEmployeeDelete(emp.id)}>
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="vehicles" className="flex-1 flex flex-col min-h-0 space-y-4">
                        <div className="flex gap-2 items-center">
                            <Input 
                                placeholder="Vehicle name" 
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd('vehicle')}
                                className="flex-1"
                            />
                            <Select value={newVehicleCategory} onValueChange={setNewVehicleCategory}>
                                <SelectTrigger className="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {VEHICLE_CATEGORIES.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={() => handleAdd('vehicle')}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Add
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md bg-slate-50">
                            {sortedCategories.map((category) => {
                                const categoryVehicles = vehiclesByCategory[category];
                                return (
                                <div key={category}>
                                    <div className="bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider sticky top-0 z-10 border-y border-slate-100">
                                        {category}
                                    </div>
                                    <div className="divide-y divide-slate-100 border-b border-slate-100 last:border-b-0 bg-white">
                                        {categoryVehicles.map(veh => (
                                <div key={veh.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                                    {editingVehicle?.id === veh.id ? (
                                        <div className="flex items-center gap-2 flex-1 mr-4 flex-wrap">
                                            <Input 
                                                value={editingVehicle.name} 
                                                onChange={(e) => setEditingVehicle({ ...editingVehicle, name: e.target.value })}
                                                autoFocus
                                                className="w-40"
                                                placeholder="Vehicle name"
                                            />
                                            <Select 
                                                value={editingVehicle.status} 
                                                onValueChange={(val: any) => setEditingVehicle({ ...editingVehicle, status: val })}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white">
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="off_road">VOR</SelectItem>
                                                    <SelectItem value="maintenance">Maintenance</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Select 
                                                value={editingVehicle.category || "OTHER"} 
                                                onValueChange={(val: string) => setEditingVehicle({ ...editingVehicle, category: val })}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue placeholder="Category" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white">
                                                    {VEHICLE_CATEGORIES.map(cat => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <div className="flex items-center gap-2">
                                                <Input 
                                                    type="color"
                                                    value={editingVehicle.color || "#3b82f6"} 
                                                    onChange={(e) => setEditingVehicle({ ...editingVehicle, color: e.target.value })}
                                                    className="w-16 h-9 p-1 cursor-pointer"
                                                    title="Vehicle color"
                                                />
                                                <Input 
                                                    value={editingVehicle.color || ""} 
                                                    onChange={(e) => setEditingVehicle({ ...editingVehicle, color: e.target.value })}
                                                    className="w-24"
                                                    placeholder="#hex or name"
                                                />
                                            </div>
                                            <Button size="sm" onClick={handleVehicleSave}>Save</Button>
                                            <Button size="sm" variant="ghost" onClick={() => setEditingVehicle(null)}>Cancel</Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 flex-1">
                                            <div 
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 border-2"
                                                style={{ 
                                                    backgroundColor: veh.color ? `${veh.color}20` : '#f1f5f9',
                                                    borderColor: veh.color || '#cbd5e1'
                                                }}
                                            >
                                                <Truck className="w-4 h-4" style={{ color: veh.color || '#64748b' }} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{veh.name}</span>
                                                <div className="flex items-center gap-2">
                                                    {veh.category && (
                                                        <Badge variant="outline" className="text-xs">{veh.category}</Badge>
                                                    )}
                                                    {veh.status !== 'active' && (
                                                        <span className="text-xs text-red-600 font-medium uppercase tracking-wider flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" /> {veh.status === 'off_road' ? 'VOR' : veh.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {editingVehicle?.id !== veh.id && (
                                        <div className="flex gap-1">
                                            {/* Book vehicle off road / maintenance */}
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                title="Book vehicle off road / maintenance"
                                                onClick={() =>
                                                    setVehicleOffModal({
                                                        open: true,
                                                        vehicleId: veh.id,
                                                        vehicleName: veh.name,
                                                    })
                                                }
                                            >
                                                <CalendarIcon className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => setEditingVehicle(veh)}>
                                                <Edit className="w-4 h-4 text-slate-500" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => onVehicleDelete(veh.id)}>
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                        ))}
                                    </div>
                                </div>
                            );
                            })}
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button
                        variant="outline"
                        className="border-slate-300 text-slate-700 hover:bg-slate-50"
                        onClick={() => onOpenChange(false)}
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
            {/* Employee Time Off Modal (currently UI-only, wiring to scheduling engine to come) */}
            <EmployeeTimeOffModal
              open={timeOffModal.open}
              onOpenChange={(open) =>
                setTimeOffModal((prev) => ({ ...prev, open }))
              }
              employeeName={timeOffModal.employeeName}
            />
            {/* Vehicle Off Road / Maintenance Modal (UI-only for now) */}
            <VehicleOffRoadModal
              open={vehicleOffModal.open}
              onOpenChange={(open) =>
                setVehicleOffModal((prev) => ({ ...prev, open }))
              }
              vehicleName={vehicleOffModal.vehicleName}
            />
        </Dialog>
    );
}

// ---- Employee Time Off Modal (UI only / Style 2) ----

interface TimeOffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
}

function EmployeeTimeOffModal({ open, onOpenChange, employeeName }: TimeOffModalProps) {
  const [absenceType, setAbsenceType] = useState<"holiday" | "sick" | "other">("holiday");
  const [mode, setMode] = useState<"single" | "range">("single");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "biweekly">("none");

  const handleSave = () => {
    // NOTE: This currently only logs the selection.
    // Wiring this into the scheduling engine will require backend support
    // for per-day unavailability and recurrence rules.
    console.log("[TimeOff] Requested:", {
      employeeName,
      absenceType,
      mode,
      startDate,
      endDate: mode === "single" ? startDate : endDate,
      recurrence,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            Book Time Off – {employeeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Reason</Label>
            <Select value={absenceType} onValueChange={(v: any) => setAbsenceType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="sick">Sickness</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Dates</Label>
            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-1">
                <input
                  id="timeoff-single"
                  type="radio"
                  checked={mode === "single"}
                  onChange={() => setMode("single")}
                  className="h-4 w-4"
                />
                <Label htmlFor="timeoff-single" className="text-sm">
                  Single day
                </Label>
              </div>
              <div className="flex items-center gap-1">
                <input
                  id="timeoff-range"
                  type="radio"
                  checked={mode === "range"}
                  onChange={() => setMode("range")}
                  className="h-4 w-4"
                />
                <Label htmlFor="timeoff-range" className="text-sm">
                  Date range
                </Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                className="text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {mode === "range" && (
                <Input
                  type="date"
                  className="text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Recurrence</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${
                  recurrence === "none"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setRecurrence("none")}
              >
                None
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${
                  recurrence === "weekly"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setRecurrence("weekly")}
              >
                Weekly
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${
                  recurrence === "biweekly"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setRecurrence("biweekly")}
              >
                Every other week
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            onClick={handleSave}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Vehicle Off Road / Maintenance Modal (UI only / Style 2) ----

interface VehicleOffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleName: string;
}

function VehicleOffRoadModal({ open, onOpenChange, vehicleName }: VehicleOffModalProps) {
  const [reason, setReason] = useState<"off_road" | "maintenance" | "other">("off_road");
  const [mode, setMode] = useState<"single" | "range">("single");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "biweekly">("none");

  const handleSave = () => {
    console.log("[VehicleOff] Requested:", {
      vehicleName,
      reason,
      mode,
      startDate,
      endDate: mode === "single" ? startDate : endDate,
      recurrence,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            Book Vehicle Off Road – {vehicleName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Reason</Label>
            <Select value={reason} onValueChange={(v: any) => setReason(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="off_road">VOR / Off Road</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Dates</Label>
            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-1">
                <input
                  id="vehicle-single"
                  type="radio"
                  checked={mode === "single"}
                  onChange={() => setMode("single")}
                  className="h-4 w-4"
                />
                <Label htmlFor="vehicle-single" className="text-sm">
                  Single day
                </Label>
              </div>
              <div className="flex items-center gap-1">
                <input
                  id="vehicle-range"
                  type="radio"
                  checked={mode === "range"}
                  onChange={() => setMode("range")}
                  className="h-4 w-4"
                />
                <Label htmlFor="vehicle-range" className="text-sm">
                  Date range
                </Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                className="text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {mode === "range" && (
                <Input
                  type="date"
                  className="text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Recurrence</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${
                  recurrence === "none"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setRecurrence("none")}
              >
                None
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${
                  recurrence === "weekly"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setRecurrence("weekly")}
              >
                Weekly
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${
                  recurrence === "biweekly"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setRecurrence("biweekly")}
              >
                Every other week
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            onClick={handleSave}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
