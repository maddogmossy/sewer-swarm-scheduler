import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, Plus, User, Truck, AlertCircle, Mail, Calendar as CalendarIcon, Settings, Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { mergeAndSortVehicleTypes } from "@/lib/vehicleTypes";

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
    onVehicleCreate: (name: string, vehicleType?: string, category?: string, color?: string) => void;
    onVehicleUpdate: (
        id: string,
        name: string,
        status?: 'active' | 'off_road' | 'maintenance',
        vehicleType?: string,
        category?: string,
        color?: string
    ) => void;
    onVehicleDelete: (id: string) => void;
    vehicleTypes?: string[] | Array<{ type: string; defaultColor?: string }>;
    onVehicleTypeCreate?: (type: string, defaultColor?: string) => void;
    onVehicleTypeUpdate?: (oldType: string, newType: string, defaultColor?: string) => void;
    onVehicleTypeDelete?: (type: string) => void;
}


export function ResourcesModal({ 
    open, onOpenChange, 
    employees, vehicles,
    onEmployeeCreate, onEmployeeUpdate, onEmployeeDelete,
    onVehicleCreate, onVehicleUpdate, onVehicleDelete,
    vehicleTypes = [],
    onVehicleTypeCreate = () => {},
    onVehicleTypeUpdate = () => {},
    onVehicleTypeDelete = () => {},
}: ResourcesModalProps) {
    const [newItemName, setNewItemName] = useState("");
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

    // Helper to get vehicle type names (handles both string[] and object[] formats)
    const getVehicleTypeNames = () => {
        if (!vehicleTypes || vehicleTypes.length === 0) return ['Van'];
        const merged = mergeAndSortVehicleTypes(vehicleTypes);
        return merged.map(t => t.type);
    };

    // Helper to get default color for a vehicle type (tolerant matching handled by mergeAndSortVehicleTypes)
    const getDefaultColorForType = (type: string): string => {
        if (!vehicleTypes || vehicleTypes.length === 0) return 'blue';
        const merged = mergeAndSortVehicleTypes(vehicleTypes);
        const typeObj = merged.find(t => t.type === type);
        return typeObj?.defaultColor || 'blue';
    };

    const getColorHex = (color: string): string => {
        return AVAILABLE_COLORS.find(c => c.value === color)?.hex || "#3B82F6";
    };

    const typeNames = getVehicleTypeNames();
    const [newVehicleType, setNewVehicleType] = useState(typeNames[0] || "Van");
    const [newVehicleColor, setNewVehicleColor] = useState<string>(() => getDefaultColorForType(typeNames[0] || "Van"));
    const [isVehicleTypeOpen, setIsVehicleTypeOpen] = useState(false);
    const [colorPickerOpenForType, setColorPickerOpenForType] = useState<string | null>(null);
    const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
    const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
    const [isEditTypeOpen, setIsEditTypeOpen] = useState(false);
    const [newTypeName, setNewTypeName] = useState("");
    const [newTypeColor, setNewTypeColor] = useState("blue");
    const [editingType, setEditingType] = useState<{ type: string; defaultColor: string } | null>(null);
    const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ open: boolean; type: string | null }>({ open: false, type: null });
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

    const handleAddVehicleType = () => {
        if (!newTypeName.trim()) return;
        onVehicleTypeCreate(newTypeName.trim(), newTypeColor);
        setNewTypeName("");
        setNewTypeColor("blue");
    };

    const handleEditVehicleType = (type: string) => {
        const defaultColor = getDefaultColorForType(type);
        setEditingType({ type, defaultColor });
        setNewTypeName(type);
        setNewTypeColor(defaultColor);
        setIsEditTypeOpen(true);
    };

    const handleSaveVehicleType = () => {
        if (!editingType || !newTypeName.trim()) return;
        if (newTypeName.trim() !== editingType.type || newTypeColor !== editingType.defaultColor) {
            onVehicleTypeUpdate(editingType.type, newTypeName.trim(), newTypeColor);
            if (newVehicleType === editingType.type && newTypeName.trim() !== editingType.type) {
                setNewVehicleType(newTypeName.trim());
            }
        }
        setEditingType(null);
        setNewTypeName("");
        setNewTypeColor("blue");
        setIsEditTypeOpen(false);
        setIsVehicleTypeOpen(false);
    };

    const handleDeleteVehicleType = (type: string) => {
        setDeleteConfirmModal({ open: true, type });
    };

    const confirmDeleteVehicleType = () => {
        if (deleteConfirmModal.type) {
            onVehicleTypeDelete(deleteConfirmModal.type);
            setDeleteConfirmModal({ open: false, type: null });
        }
    };

    const handleAdd = (type: 'employee' | 'vehicle') => {
        if (!newItemName.trim()) return;
        if (type === 'employee') {
            onEmployeeCreate(newItemName);
            setNewItemName("");
        } else {
            // For vehicles, create with the selected vehicle type
            onVehicleCreate(newItemName, newVehicleType, undefined, newVehicleColor);
            setNewItemName("");
            setNewVehicleType(typeNames[0] || "Van");
            setNewVehicleColor(getDefaultColorForType(typeNames[0] || "Van"));
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
        onVehicleUpdate(editingVehicle.id, editingVehicle.name, editingVehicle.status, editingVehicle.vehicleType, editingVehicle.category, editingVehicle.color);
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
                        <div className="flex gap-2 items-center justify-between">
                            <Label className="text-sm font-semibold">Add New Vehicle</Label>
                            <Popover open={isManageTypesOpen} onOpenChange={setIsManageTypesOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 p-0 hover:bg-transparent">
                                        <Settings className="w-3 h-3 mr-1" /> Manage Types
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3" align="end">
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-sm">Manage Vehicle Types</h4>
                                        <div className="flex gap-2">
                                            <Input 
                                                placeholder="New Type..." 
                                                className="h-8 text-sm"
                                                value={newTypeName}
                                                onChange={(e) => setNewTypeName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddVehicleType()}
                                            />
                                            <Button size="sm" className="h-8 w-8 p-0" onClick={handleAddVehicleType}>
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto space-y-1">
                                            {typeNames.map(type => {
                                                const typeDefaultColor = getDefaultColorForType(type);
                                                const colorHex = AVAILABLE_COLORS.find(c => c.value === typeDefaultColor)?.hex || "#3B82F6";
                                                return (
                                                    <div key={type} className="flex items-center justify-between p-2 rounded hover:bg-slate-50 group">
                                                        <div className="flex items-center gap-2">
                                                            <div 
                                                                className="w-3 h-3 rounded border shrink-0" 
                                                                style={{ 
                                                                    backgroundColor: `${colorHex}40`,
                                                                    borderColor: colorHex
                                                                }}
                                                            />
                                                            <span className="text-sm">{type}</span>
                                                        </div>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-6 w-6"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    handleEditVehicleType(type);
                                                                }}
                                                            >
                                                                <Edit className="w-3 h-3" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-6 w-6"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    handleDeleteVehicleType(type);
                                                                }}
                                                            >
                                                                <Trash2 className="w-3 h-3 text-red-500" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="pt-2 border-t border-slate-200">
                                            <Popover open={isAddTypeOpen || isEditTypeOpen} onOpenChange={(open) => {
                                                setIsAddTypeOpen(open);
                                                if (!open) {
                                                    setIsEditTypeOpen(false);
                                                    setEditingType(null);
                                                    setNewTypeName("");
                                                    setNewTypeColor("blue");
                                                }
                                            }}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full h-8 justify-center gap-2 border-slate-300"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                    >
                                                        {editingType ? <Edit className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                                        <span className="text-xs">{editingType ? "Edit Type" : "Add New Type"}</span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80 p-3 bg-white" align="start">
                                                    <div className="space-y-3">
                                                        <h4 className="font-semibold text-sm text-slate-900">
                                                            {editingType ? "Edit Vehicle Type" : "Add Vehicle Type"}
                                                        </h4>
                                                        <div className="space-y-2">
                                                            <Input 
                                                                placeholder="Type name..." 
                                                                className="h-8 text-sm text-slate-900 placeholder:text-slate-400"
                                                                value={newTypeName}
                                                                onChange={(e) => setNewTypeName(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && newTypeName.trim()) {
                                                                        e.preventDefault();
                                                                        if (editingType) {
                                                                            handleSaveVehicleType();
                                                                        } else {
                                                                            handleAddVehicleType();
                                                                            setNewVehicleType(newTypeName.trim());
                                                                            setIsAddTypeOpen(false);
                                                                        }
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
                                                            <div className="flex gap-2">
                                                                {editingType && (
                                                                    <Button 
                                                                        size="sm" 
                                                                        variant="outline"
                                                                        className="flex-1 h-8 border-slate-300 text-slate-700 hover:bg-slate-50" 
                                                                        onClick={() => {
                                                                            setEditingType(null);
                                                                            setNewTypeName("");
                                                                            setNewTypeColor("blue");
                                                                            setIsEditTypeOpen(false);
                                                                            setIsVehicleTypeOpen(false);
                                                                        }}
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                )}
                                                                <Button 
                                                                    size="sm" 
                                                                    className={cn(
                                                                        "h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm",
                                                                        editingType ? "flex-1" : "w-full"
                                                                    )} 
                                                                    onClick={() => {
                                                                        if (editingType) {
                                                                            handleSaveVehicleType();
                                                                        } else if (newTypeName.trim()) {
                                                                            handleAddVehicleType();
                                                                            setNewVehicleType(newTypeName.trim());
                                                                            setIsAddTypeOpen(false);
                                                                        }
                                                                    }}
                                                                >
                                                                    {editingType ? (
                                                                        <>
                                                                            <Check className="w-4 h-4 mr-2" /> Save
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Plus className="w-4 h-4 mr-2" /> Add Type
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="flex gap-2 items-end">
                            <Input 
                                placeholder="Vehicle name" 
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd('vehicle')}
                                className="flex-1 h-9"
                            />
                            <div className="flex flex-col gap-1">
                                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Vehicle Type</Label>
                                <Popover open={isVehicleTypeOpen} onOpenChange={setIsVehicleTypeOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-40 h-9 justify-between bg-white border-slate-300"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    className="w-3 h-3 rounded border shrink-0" 
                                                    style={{ 
                                                        backgroundColor: `${getColorHex(newVehicleColor)}40`,
                                                        borderColor: getColorHex(newVehicleColor)
                                                    }}
                                                />
                                                <span>{newVehicleType}</span>
                                            </div>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-2 bg-white border border-slate-200 shadow-lg rounded-lg" align="start">
                                        <div className="space-y-1">
                                            {typeNames.map(type => {
                                                const typeDefaultColor = getDefaultColorForType(type);
                                                const colorHex = AVAILABLE_COLORS.find(c => c.value === typeDefaultColor)?.hex || "#3B82F6";
                                                const isSelected = newVehicleType === type;
                                                const isColorPickerOpen = colorPickerOpenForType === type;
                                                const currentColor = isSelected ? newVehicleColor : typeDefaultColor;
                                                const currentColorHex = AVAILABLE_COLORS.find(c => c.value === currentColor)?.hex || colorHex;
                                                
                                                return (
                                                    <div
                                                        key={type}
                                                        className={cn(
                                                            "flex items-center justify-between p-2 rounded-md border border-transparent hover:bg-slate-50 group/item",
                                                            isSelected && "bg-slate-900 text-white border-slate-900"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewVehicleType(type);
                                                                    setNewVehicleColor(getDefaultColorForType(type));
                                                                    setColorPickerOpenForType(null);
                                                                }}
                                                                className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                                            >
                                                                <div 
                                                                    className={cn(
                                                                      "w-4 h-4 rounded border shrink-0",
                                                                      isSelected ? "border-white/70" : "border-slate-300"
                                                                    )}
                                                                    style={{ 
                                                                        backgroundColor: `${currentColorHex}40`,
                                                                        borderColor: isSelected ? "rgba(255,255,255,0.7)" : currentColorHex
                                                                    }}
                                                                />
                                                                <span className={cn("truncate font-semibold", isSelected ? "text-white" : "text-slate-900")}>{type}</span>
                                                            </button>
                                                            {isSelected && (
                                                                <Popover open={isColorPickerOpen} onOpenChange={(open) => {
                                                                    setColorPickerOpenForType(open ? type : null);
                                                                }}>
                                                                    <PopoverTrigger asChild>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className={cn(
                                                                              "h-7 w-7 p-0.5 border shrink-0",
                                                                              isSelected ? "border-white/40 hover:bg-white/10" : "border-slate-200 hover:bg-slate-50"
                                                                            )}
                                                                            style={{
                                                                                backgroundColor: `${currentColorHex}20`,
                                                                                borderColor: currentColorHex
                                                                            }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                setColorPickerOpenForType(isColorPickerOpen ? null : type);
                                                                            }}
                                                                        >
                                                                            <div 
                                                                                className="w-full h-full rounded"
                                                                                style={{ backgroundColor: currentColorHex }}
                                                                            />
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-56 p-2 bg-white" align="end" side="right">
                                                                        <div className="text-xs font-semibold mb-2 text-slate-500 uppercase tracking-wider">Select Color</div>
                                                                        <div className="grid grid-cols-4 gap-2">
                                                                            {AVAILABLE_COLORS.map(c => {
                                                                                const isColorSelected = newVehicleColor === c.value;
                                                                                return (
                                                                                    <button
                                                                                        key={c.value}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setNewVehicleColor(c.value);
                                                                                            setColorPickerOpenForType(null);
                                                                                        }}
                                                                                        className={cn(
                                                                                            "w-8 h-8 rounded-md border-2 hover:scale-110 transition-transform relative",
                                                                                            c.class,
                                                                                            isColorSelected && "ring-2 ring-offset-2 ring-slate-400"
                                                                                        )}
                                                                                        title={c.value}
                                                                                    >
                                                                                        {isColorSelected && <Check className="w-4 h-4 text-slate-800 absolute inset-0 m-auto" />}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Button
                                onClick={() => handleAdd('vehicle')}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-9"
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
                                                value={editingVehicle.vehicleType || typeNames[0] || "Van"} 
                                                onValueChange={(val: string) => {
                                                    const defaultColor = getDefaultColorForType(val);
                                                    setEditingVehicle({ ...editingVehicle, vehicleType: val, color: defaultColor });
                                                }}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue placeholder="Type" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white">
                                                    {typeNames.map(type => (
                                                        <SelectItem key={type} value={type}>{type}</SelectItem>
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
            {/* Delete Vehicle Type Confirmation Modal */}
            <DeleteConfirmModal
              open={deleteConfirmModal.open}
              onOpenChange={(open) =>
                setDeleteConfirmModal((prev) => ({ ...prev, open }))
              }
              type={deleteConfirmModal.type || ""}
              onConfirm={confirmDeleteVehicleType}
            />
        </Dialog>
    );
}

// Delete Vehicle Type Confirmation Modal
interface DeleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: string;
  onConfirm: () => void;
}

function DeleteConfirmModal({ open, onOpenChange, type, onConfirm }: DeleteConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Delete Vehicle Type
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <p className="text-sm text-slate-700">
            Are you sure you want to delete the vehicle type <span className="font-semibold">"{type}"</span>? This cannot be undone.
          </p>
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
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={handleConfirm}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
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
