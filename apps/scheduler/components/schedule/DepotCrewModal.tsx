import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, Plus, Users, Truck, Mail, Settings, X, Check, Calendar as CalendarIcon, ArrowRightLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DepotCrewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depotName: string;
  currentDepotId: string;
  depots: { id: string; name: string }[];
  crews: { id: string; name: string; shift?: 'day' | 'night' }[];
  employees: {
    id: string
    name: string
    status: 'active' | 'holiday' | 'sick'
    jobRole: 'operative' | 'assistant'
    email?: string
    homePostcode?: string
    startsFromHome?: boolean
  }[];
  vehicles: {
    id: string
    name: string
    status: 'active' | 'off_road' | 'maintenance'
    vehicleType: string
    category?: string
    color?: string
  }[];
  onCrewCreate: (name: string, shift: 'day' | 'night') => void;
  onCrewUpdate: (id: string, name: string, shift: 'day' | 'night') => void;
  onCrewDelete: (id: string) => void;
  onEmployeeCreate: (name: string, jobRole: 'operative' | 'assistant', email?: string) => void;
  onEmployeeUpdate: (
    id: string,
    name: string,
    status?: 'active' | 'holiday' | 'sick',
    jobRole?: 'operative' | 'assistant',
    email?: string,
    homePostcode?: string,
    startsFromHome?: boolean
  ) => void;
  onEmployeeDelete?: (id: string) => void;
  onEmployeeMoveDepot: (id: string, depotId: string) => void;
  onVehicleCreate: (name: string, vehicleType: string, category?: string, color?: string) => void;
  onVehicleUpdate: (id: string, name: string, status?: 'active' | 'off_road' | 'maintenance', vehicleType?: string, category?: string, color?: string) => void;
  onVehicleDelete?: (id: string) => void;
  onVehicleMoveDepot: (id: string, depotId: string) => void;
  vehicleTypes?: string[] | Array<{ type: string; defaultColor?: string }>;
  onVehicleTypeCreate?: (type: string, defaultColor?: string) => void;
  onVehicleTypeUpdate?: (oldType: string, newType: string, defaultColor?: string) => void;
  onVehicleTypeDelete?: (type: string) => void;
  isReadOnly?: boolean;
}

export function DepotCrewModal({
  open,
  onOpenChange,
  depotName,
  currentDepotId,
  depots,
  crews = [],
  employees = [],
  vehicles = [],
  onCrewCreate,
  onCrewUpdate,
  onCrewDelete,
  onEmployeeCreate,
  onEmployeeUpdate,
  onEmployeeDelete = () => {},
  onVehicleCreate,
  onVehicleUpdate,
  onVehicleDelete = () => {},
  onEmployeeMoveDepot,
  onVehicleMoveDepot,
  vehicleTypes = ['Van', 'CCTV', 'Jetting', 'Recycler', 'Other'],
  onVehicleTypeCreate = () => {},
  onVehicleTypeUpdate = () => {},
  onVehicleTypeDelete = () => {},
  isReadOnly = false,
}: DepotCrewModalProps) {
  // Available colors matching Job Status style
  const AVAILABLE_COLORS = [
    { value: "blue", class: "bg-[#BFDBFE] border-[#3B82F6]", hex: "#3B82F6" },
    { value: "green", class: "bg-[#BBF7D0] border-[#22C55E]", hex: "#22C55E" },
    { value: "yellow", class: "bg-[#FEF08A] border-[#EAB308]", hex: "#EAB308" },
    { value: "orange", class: "bg-[#FED7AA] border-[#F97316]", hex: "#F97316" },
    { value: "red", class: "bg-[#FECACA] border-[#EF4444]", hex: "#EF4444" },
    { value: "purple", class: "bg-[#E9D5FF] border-[#A855F7]", hex: "#A855F7" },
    { value: "pink", class: "bg-[#FBCFE8] border-[#EC4899]", hex: "#EC4899" },
    { value: "teal", class: "bg-[#99F6E4] border-[#14B8A6]", hex: "#14B8A6" },
    { value: "gray", class: "bg-[#E2E8F0] border-[#64748B]", hex: "#64748B" },
    { value: "indigo", class: "bg-[#C7D2FE] border-[#6366F1]", hex: "#6366F1" },
    { value: "cyan", class: "bg-[#A5F3FC] border-[#06B6D4]", hex: "#06B6D4" },
    { value: "lime", class: "bg-[#D9F99D] border-[#84CC16]", hex: "#84CC16" },
  ];

  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeRole, setNewEmployeeRole] = useState<'operative' | 'assistant'>('operative');
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [newVehicleName, setNewVehicleName] = useState("");
  // Helper to get vehicle type names (handles both string[] and object[] formats)
  const getVehicleTypeNames = () => {
    if (!vehicleTypes || vehicleTypes.length === 0) return ['Van'];
    return vehicleTypes.map(t => typeof t === 'string' ? t : t.type);
  };

  // Helper to get default color for a vehicle type
  const getDefaultColorForType = (type: string): string => {
    if (!vehicleTypes || vehicleTypes.length === 0) return 'blue';
    const typeObj = vehicleTypes.find(t => (typeof t === 'string' ? t : t.type) === type);
    return (typeof typeObj === 'object' && typeObj?.defaultColor) ? typeObj.defaultColor : 'blue';
  };

  const typeNames = getVehicleTypeNames();
  const [newVehicleType, setNewVehicleType] = useState(typeNames[0] || "Van");
  const [newVehicleCategory, setNewVehicleCategory] = useState<string>("VAN");
  const [newVehicleColor, setNewVehicleColor] = useState<string>(() => getDefaultColorForType(typeNames[0] || "Van"));
  const [editingEmployee, setEditingEmployee] = useState<{
    id: string
    name: string
    jobRole: 'operative' | 'assistant'
    email?: string
    status?: 'active' | 'holiday' | 'sick'
    homePostcode?: string
    startsFromHome?: boolean
  } | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<{ id: string; name: string; vehicleType: string; status?: 'active' | 'off_road' | 'maintenance'; category?: string; color?: string } | null>(null);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState<string>("blue");
  const [employeeTimeOffModal, setEmployeeTimeOffModal] = useState<{
    open: boolean;
    employeeId: string | null;
    employeeName: string;
  }>({ open: false, employeeId: null, employeeName: "" });

  const [vehicleOffModal, setVehicleOffModal] = useState<{
    open: boolean;
    vehicleId: string | null;
    vehicleName: string;
  }>({ open: false, vehicleId: null, vehicleName: "" });

  const [editingTypeName, setEditingTypeName] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState<string>("");
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);

  // Refresh when modal opens or data changes
  useEffect(() => {
    if (open) {
      setEditingEmployee(null);
      setEditingVehicle(null);
      const firstType = typeNames[0] || "Van";
      setNewVehicleType(firstType);
      setNewVehicleColor(getDefaultColorForType(firstType));
    }
  }, [open, crews, employees, vehicles, vehicleTypes]);

  // Update color when vehicle type changes
  useEffect(() => {
    setNewVehicleColor(getDefaultColorForType(newVehicleType));
  }, [newVehicleType]);

  const handleAddEmployee = () => {
    if (!newEmployeeName.trim()) return;
    onEmployeeCreate(newEmployeeName, newEmployeeRole, newEmployeeEmail);
    setNewEmployeeName("");
    setNewEmployeeRole('operative');
    setNewEmployeeEmail("");
    // Force scroll to see the new item
    setTimeout(() => {
      const employeesList = document.querySelector('[data-employees-list]');
      if (employeesList) {
        employeesList.scrollTop = 0;
      }
    }, 0);
  };

  const handleAddVehicle = () => {
    if (!newVehicleName.trim()) return;
    const selectedColor = AVAILABLE_COLORS.find(c => c.value === newVehicleColor);
    // Use the color's hex value, and derive category from color name or use default
    onVehicleCreate(newVehicleName, newVehicleType, undefined, selectedColor?.hex);
    setNewVehicleName("");
    // Don't reset type/color, keep last used
    // Force scroll to see the new item
    setTimeout(() => {
      const vehiclesList = document.querySelector('[data-vehicles-list]');
      if (vehiclesList) {
        vehiclesList.scrollTop = 0;
      }
    }, 0);
  };

  // Helper to get color hex from color value
  const getColorHex = (colorValue?: string): string => {
    if (!colorValue) return "#3B82F6"; // Default blue
    if (colorValue.startsWith('#')) return colorValue; // Already hex
    const color = AVAILABLE_COLORS.find(c => c.value === colorValue);
    return color?.hex || "#3B82F6";
  };

  // Helper to get color value from hex
  const getColorValue = (hex?: string): string => {
    if (!hex) return "blue";
    if (!hex.startsWith('#')) return hex; // Already a color name
    const color = AVAILABLE_COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
    return color?.value || hex; // Return hex if not found in list
  };

  const handleAddVehicleType = () => {
    if (!newTypeName.trim()) return;
    onVehicleTypeCreate(newTypeName.trim(), newTypeColor);
    setNewTypeName("");
    setNewTypeColor("blue"); // Reset to default
  };

  const handleDeleteEmployee = (empId: string) => {
    onEmployeeDelete(empId);
  };

  const handleDeleteVehicle = (vehId: string) => {
    onVehicleDelete(vehId);
  };

  const handleSaveEmployee = () => {
    if (!editingEmployee || !editingEmployee.name.trim()) return;
    onEmployeeUpdate(
      editingEmployee.id,
      editingEmployee.name,
      editingEmployee.status,
      editingEmployee.jobRole,
      editingEmployee.email,
      editingEmployee.homePostcode,
      editingEmployee.startsFromHome
    );
    setEditingEmployee(null);
  };

  const handleSaveVehicle = () => {
    if (!editingVehicle || !editingVehicle.name.trim()) return;
    onVehicleUpdate(editingVehicle.id, editingVehicle.name, editingVehicle.status, editingVehicle.vehicleType, editingVehicle.category, editingVehicle.color);
    setEditingVehicle(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white text-slate-900 max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Depot - {depotName}</DialogTitle>
        </DialogHeader>

        {/* Style 2 (Replit-style) segmented tabs */}
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

          {/* EMPLOYEES TAB */}
          <TabsContent value="employees" className="flex-1 flex flex-col min-h-0 mt-4 space-y-4 overflow-hidden bg-white">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Add New Employee</Label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <Input
                    placeholder="Employee name"
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddEmployee()}
                    className="flex-1"
                    />
                    <Select value={newEmployeeRole} onValueChange={(val) => setNewEmployeeRole(val as 'operative' | 'assistant')}>
                    <SelectTrigger className="w-32">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                        <SelectItem value="operative">👷 Operative</SelectItem>
                        <SelectItem value="assistant">🤝 Assistant</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                    <Input
                        placeholder="Email address (optional)"
                        value={newEmployeeEmail}
                        onChange={(e) => setNewEmployeeEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddEmployee()}
                        className="flex-1 text-sm"
                        type="email"
                    />
                    <Button
                      onClick={handleAddEmployee}
                      className="gap-2 w-32 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <Label className="text-sm font-semibold">Employees at {depotName}</Label>
              <div className="border border-slate-200 rounded-md flex-1 overflow-y-auto bg-slate-50 divide-y divide-slate-100" data-employees-list>
                {employees.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">No employees</div>
                ) : (
                  employees
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((emp) => (
                    <div key={emp.id} className="p-3 flex items-center justify-between hover:bg-slate-50 bg-white">
                      {editingEmployee?.id === emp.id ? (
                        <div className="flex flex-col gap-2 flex-1">
                            <div className="flex items-center gap-2 flex-1">
                                <Input
                                    value={editingEmployee.name}
                                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                                    autoFocus
                                    className="flex-1"
                                    placeholder="Name"
                                />
                                <Select value={editingEmployee.jobRole} onValueChange={(val) => setEditingEmployee({ ...editingEmployee, jobRole: val as 'operative' | 'assistant' })}>
                                    <SelectTrigger className="w-32">
                                    <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                    <SelectItem value="operative">Operative</SelectItem>
                                    <SelectItem value="assistant">Assistant</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <Input
                                      value={editingEmployee.email || ""}
                                      onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                                      className="flex-1 text-sm"
                                      placeholder="Email address"
                                      type="email"
                                  />
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
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      id={`depot-emp-home-${editingEmployee.id}`}
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
                                      htmlFor={`depot-emp-home-${editingEmployee.id}`}
                                      className="text-[11px] text-slate-700 cursor-pointer"
                                    >
                                      Starts from home (else depot)
                                    </Label>
                                  </div>
                                  <div className="flex gap-2">
                                      <Button size="sm" onClick={handleSaveEmployee}>
                                          Save
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setEditingEmployee(null)}>
                                          Cancel
                                      </Button>
                                  </div>
                                </div>
                            </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-700">{emp.name}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-2">
                                <span>{emp.status} • {emp.jobRole === 'operative' ? '👷 Operative' : '🤝 Assistant'}</span>
                                {emp.email && (
                                    <span className="flex items-center gap-1 text-slate-400 border-l border-slate-300 pl-2">
                                        <Mail className="w-3 h-3" /> {emp.email}
                                    </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {/* Time off calendar (same as Manage Resources) */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              title="Book time off / sickness"
                              onClick={() =>
                                setEmployeeTimeOffModal({
                                  open: true,
                                  employeeId: emp.id,
                                  employeeName: emp.name,
                                })
                              }
                            >
                              <CalendarIcon className="w-4 h-4" />
                            </Button>
                            {/* Move to another depot (permanent) */}
                            {depots.length > 1 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    title="Move to another depot"
                                  >
                                    <ArrowRightLeft className="w-4 h-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-3 bg-white" align="end">
                                  <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-slate-700">
                                      Move employee to depot
                                    </Label>
                                    <Select
                                      onValueChange={(depotId) => {
                                        if (depotId && depotId !== currentDepotId) {
                                          onEmployeeMoveDepot(emp.id, depotId);
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                                        <SelectValue placeholder="Select depot" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white">
                                        {depots
                                          .filter((d) => d.id !== currentDepotId)
                                          .map((d) => (
                                            <SelectItem key={d.id} value={d.id}>
                                              {d.name}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-slate-500">
                                      This is a <span className="font-semibold">permanent</span> move. For
                                      temporary moves we’ll use scheduling rules.
                                    </p>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setEditingEmployee({
                                  id: emp.id,
                                  name: emp.name,
                                  jobRole: emp.jobRole,
                                  email: emp.email,
                                  status: emp.status,
                                })
                              }
                              className="h-8 w-8"
                            >
                              <Edit className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeleteEmployee(emp.id);
                              }}
                              className="h-8 w-8"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* VEHICLES TAB */}
          <TabsContent value="vehicles" className="flex-1 flex flex-col min-h-0 mt-4 space-y-4 overflow-hidden bg-white">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold">Add New Vehicle</Label>
                <Popover open={isManageTypesOpen} onOpenChange={setIsManageTypesOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 p-0 hover:bg-transparent">
                            <Settings className="w-3 h-3 mr-1" /> Manage Types
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 bg-white" align="end">
                        <div className="space-y-3">
                            <h4 className="font-semibold text-sm text-slate-900">Manage Vehicle Types</h4>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="New Type..." 
                                    className="h-8 text-sm text-slate-900 placeholder:text-slate-400"
                                    value={newTypeName}
                                    onChange={(e) => setNewTypeName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddVehicleType()}
                                />
                                <Button size="sm" className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddVehicleType}>
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {typeNames.map(type => {
                                    const currentColorValue = getColorValue(getDefaultColorForType(type));
                                    const currentHex = getColorHex(currentColorValue);

                                    return (
                                      <div key={type} className="flex items-center justify-between text-sm group p-1 rounded hover:bg-slate-50">
                                        {editingTypeName === type ? (
                                          <div className="flex items-center gap-1 flex-1">
                                              <Input
                                                  value={editingTypeValue}
                                                  onChange={(e) => setEditingTypeValue(e.target.value)}
                                                  onKeyDown={(e) => {
                                                      if (e.key === 'Enter' && editingTypeValue.trim()) {
                                                          onVehicleTypeUpdate(type, editingTypeValue.trim());
                                                          setEditingTypeName(null);
                                                          setEditingTypeValue("");
                                                      } else if (e.key === 'Escape') {
                                                          setEditingTypeName(null);
                                                          setEditingTypeValue("");
                                                      }
                                                  }}
                                                  autoFocus
                                                  className="h-6 text-xs py-0 flex-1 text-slate-900"
                                              />
                                          </div>
                                        ) : (
                                          <>
                                            <span className="flex-1 text-slate-900 font-medium">{type}</span>
                                            <div className="flex items-center gap-2">
                                              {/* Default color picker for this type */}
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <button
                                                    type="button"
                                                    className="w-7 h-7 rounded-md border-2 flex items-center justify-center"
                                                    style={{
                                                      backgroundColor: `${currentHex}20`,
                                                      borderColor: currentHex,
                                                    }}
                                                    title="Set default color"
                                                  >
                                                    <div
                                                      className="w-4 h-4 rounded"
                                                      style={{ backgroundColor: currentHex }}
                                                    />
                                                  </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-56 p-2 bg-white" align="end">
                                                  <div className="text-xs font-semibold text-slate-900 mb-2">
                                                    Default color for "{type}"
                                                  </div>
                                                  <div className="grid grid-cols-6 gap-1.5">
                                                    {AVAILABLE_COLORS.map(c => {
                                                      const isSelected = currentColorValue === c.value || currentHex === c.hex;
                                                      return (
                                                        <button
                                                          key={c.value}
                                                          type="button"
                                                          onClick={() => onVehicleTypeUpdate(type, type, c.value)}
                                                          className={cn(
                                                            "w-7 h-7 rounded-md border-2 flex items-center justify-center",
                                                            c.class,
                                                            isSelected && "scale-110 shadow-md ring-2 ring-offset-1 ring-slate-400"
                                                          )}
                                                          title={c.value}
                                                        >
                                                          {isSelected && <Check className="w-3 h-3 text-slate-800" />}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                </PopoverContent>
                                              </Popover>

                                              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                                  <Button 
                                                      variant="ghost" 
                                                      size="sm" 
                                                      className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                      onClick={() => {
                                                          setEditingTypeName(type);
                                                          setEditingTypeValue(type);
                                                      }}
                                                  >
                                                      <Edit className="w-3 h-3" />
                                                  </Button>
                                                  <Button 
                                                      variant="ghost" 
                                                      size="sm" 
                                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                      onClick={() => onVehicleTypeDelete(type)}
                                                  >
                                                      <X className="w-3 h-3" />
                                                  </Button>
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                })}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Vehicle name"
                  value={newVehicleName}
                  onChange={(e) => setNewVehicleName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddVehicle()}
                  className="flex-1"
                />
                <div className="flex gap-1">
                  <Select 
                    value={newVehicleType} 
                    onValueChange={(val) => {
                      setNewVehicleType(val);
                      setNewVehicleColor(getDefaultColorForType(val));
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {typeNames.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Popover open={isAddTypeOpen} onOpenChange={setIsAddTypeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      className="h-9 w-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      title="Add new vehicle type"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                    <PopoverContent className="w-80 p-3 bg-white" align="start">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-slate-900">Add Vehicle Type</h4>
                        <div className="space-y-2">
                          <Input 
                            placeholder="New type name..." 
                            className="h-8 text-sm text-slate-900 placeholder:text-slate-400"
                            value={newTypeName}
                            onChange={(e) => setNewTypeName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newTypeName.trim()) {
                                e.preventDefault();
                                handleAddVehicleType();
                                setNewVehicleType(newTypeName.trim());
                                setIsAddTypeOpen(false);
                              }
                            }}
                            autoFocus
                          />
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-slate-700">Default Color</Label>
                            <div className="grid grid-cols-6 gap-1.5">
                              {AVAILABLE_COLORS.map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() => setNewTypeColor(c.value)}
                                  className={cn(
                                    "w-8 h-8 rounded-md border-2 transition-all flex items-center justify-center",
                                    c.class,
                                    newTypeColor === c.value ? "scale-110 shadow-md ring-2 ring-offset-1 ring-slate-400" : "opacity-70 hover:opacity-100"
                                  )}
                                  title={c.value}
                                >
                                  {newTypeColor === c.value && <Check className="w-3 h-3 text-slate-800" />}
                                </button>
                              ))}
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm" 
                            onClick={() => {
                              if (newTypeName.trim()) {
                                handleAddVehicleType();
                                setNewVehicleType(newTypeName.trim());
                                setIsAddTypeOpen(false);
                              }
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" /> Add Type
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  onClick={handleAddVehicle}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
            </div>

            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <Label className="text-sm font-semibold">Vehicles at {depotName}</Label>
              <div className="border border-slate-200 rounded-md flex-1 overflow-y-auto bg-slate-50" data-vehicles-list>
                {vehicles.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">No vehicles</div>
                ) : (
                  (() => {
                    // Group vehicles by category (preferred) or type (fallback)
                    const groupedVehicles = vehicles.reduce((acc, vehicle) => {
                      const groupKey = vehicle.category || vehicle.vehicleType || 'OTHER';
                      if (!acc[groupKey]) {
                        acc[groupKey] = [];
                      }
                      acc[groupKey].push(vehicle);
                      return acc;
                    }, {} as Record<string, typeof vehicles>);

                    // Sort types alphabetically
                    const sortedTypes = Object.keys(groupedVehicles).sort();

                    // Sort vehicles within each type alphabetically
                    sortedTypes.forEach(type => {
                      groupedVehicles[type].sort((a, b) => a.name.localeCompare(b.name));
                    });

                    return sortedTypes.map(type => (
                      <div key={type}>
                        <div className="bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider sticky top-0 z-10 border-y border-slate-100">
                          {type}
                        </div>
                        <div className="divide-y divide-slate-100 border-b border-slate-100 last:border-b-0 bg-white">
                          {groupedVehicles[type].map((veh) => (
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
                                    value={editingVehicle.vehicleType} 
                                    onValueChange={(val) => setEditingVehicle({ ...editingVehicle, vehicleType: val })}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                      {typeNames.map(type => (
                                          <SelectItem key={type} value={type}>{type}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select 
                                    value={editingVehicle.status || 'active'} 
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
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="w-20 h-9 p-1 border-2"
                                        style={{
                                          backgroundColor: `${getColorHex(editingVehicle?.color)}20`,
                                          borderColor: getColorHex(editingVehicle?.color)
                                        }}
                                      >
                                        <div 
                                          className="w-full h-full rounded"
                                          style={{ backgroundColor: getColorHex(editingVehicle?.color) }}
                                        />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-2 bg-white" align="start">
                                      <div className="text-xs font-semibold mb-2 text-slate-500 uppercase tracking-wider">Select Color</div>
                                      <div className="grid grid-cols-4 gap-2">
                                        {AVAILABLE_COLORS.map(c => {
                                          const isSelected = getColorValue(editingVehicle?.color) === c.value;
                                          return (
                                            <button
                                              key={c.value}
                                              type="button"
                                              onClick={() => {
                                                setEditingVehicle({ ...editingVehicle!, color: c.hex });
                                              }}
                                              className={cn(
                                                "w-8 h-8 rounded-md border-2 hover:scale-110 transition-transform relative",
                                                c.class,
                                                isSelected && "ring-2 ring-offset-2 ring-slate-400"
                                              )}
                                              title={c.value}
                                            >
                                              {isSelected && <Check className="w-4 h-4 text-slate-800 absolute inset-0 m-auto" />}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                  <Button size="sm" onClick={handleSaveVehicle}>Save</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingVehicle(null)}>Cancel</Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 flex-1">
                                  <div 
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 border-2 shrink-0"
                                    style={{ 
                                      backgroundColor: veh.color ? `${getColorHex(veh.color)}20` : '#f1f5f9',
                                      borderColor: getColorHex(veh.color)
                                    }}
                                  >
                                    <Truck className="w-4 h-4" style={{ color: getColorHex(veh.color) }} />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{veh.name}</span>
                                    <div className="flex items-center gap-2">
                                      {veh.category && (
                                        <span className="text-xs text-slate-500 font-medium">{veh.category}</span>
                                      )}
                                      {veh.status !== 'active' && (
                                        <span className="text-xs text-red-600 font-medium uppercase tracking-wider flex items-center gap-1">
                                          <Settings className="w-3 h-3" /> {veh.status === 'off_road' ? 'VOR' : veh.status}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {editingVehicle?.id !== veh.id && (
                                <div className="flex gap-1">
                                  {/* Vehicle off-road / maintenance calendar */}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
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
                                  {/* Move vehicle permanently to another depot */}
                                  {depots.length > 1 && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                          title="Move vehicle to another depot"
                                        >
                                          <ArrowRightLeft className="w-4 h-4" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-56 p-3 bg-white" align="end">
                                        <div className="space-y-2">
                                          <Label className="text-xs font-semibold text-slate-700">
                                            Move vehicle to depot
                                          </Label>
                                          <Select
                                            onValueChange={(depotId) => {
                                              if (depotId && depotId !== currentDepotId) {
                                                onVehicleMoveDepot(veh.id, depotId);
                                              }
                                            }}
                                          >
                                            <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                                              <SelectValue placeholder="Select depot" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white">
                                              {depots
                                                .filter((d) => d.id !== currentDepotId)
                                                .map((d) => (
                                                  <SelectItem key={d.id} value={d.id}>
                                                    {d.name}
                                                  </SelectItem>
                                                ))}
                                            </SelectContent>
                                          </Select>
                                          <p className="text-[10px] text-slate-500">
                                            This is a <span className="font-semibold">permanent</span> move. For
                                            temporary moves we’ll use scheduling rules.
                                          </p>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setEditingVehicle({ ...veh, category: veh.category, color: veh.color })}
                                  >
                                    <Edit className="w-4 h-4 text-slate-500" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => handleDeleteVehicle(veh.id)}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
      {/* Inline modals so they share the same Dialog root */}
      <EmployeeTimeOffModal
        open={employeeTimeOffModal.open}
        onOpenChange={(open) =>
          setEmployeeTimeOffModal((prev) => ({ ...prev, open }))
        }
        employeeName={employeeTimeOffModal.employeeName}
      />
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
    console.log("[TimeOff] Requested (Depot):", {
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
                  id="depot-timeoff-single"
                  type="radio"
                  checked={mode === "single"}
                  onChange={() => setMode("single")}
                  className="h-4 w-4"
                />
                <Label htmlFor="depot-timeoff-single" className="text-sm">
                  Single day
                </Label>
              </div>
              <div className="flex items-center gap-1">
                <input
                  id="depot-timeoff-range"
                  type="radio"
                  checked={mode === "range"}
                  onChange={() => setMode("range")}
                  className="h-4 w-4"
                />
                <Label htmlFor="depot-timeoff-range" className="text-sm">
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
    console.log("[VehicleOff] Requested (Depot):", {
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
                  id="depot-vehicle-single"
                  type="radio"
                  checked={mode === "single"}
                  onChange={() => setMode("single")}
                  className="h-4 w-4"
                />
                <Label htmlFor="depot-vehicle-single" className="text-sm">
                  Single day
                </Label>
              </div>
              <div className="flex items-center gap-1">
                <input
                  id="depot-vehicle-range"
                  type="radio"
                  checked={mode === "range"}
                  onChange={() => setMode("range")}
                  className="h-4 w-4"
                />
                <Label htmlFor="depot-vehicle-range" className="text-sm">
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
