import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, Plus, User, Truck, AlertCircle, Mail } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ResourcesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employees: { id: string; name: string; status: 'active' | 'holiday' | 'sick'; email?: string; jobRole?: 'operative' | 'assistant' }[];
    vehicles: { id: string; name: string; status: 'active' | 'off_road' | 'maintenance' }[];
    onEmployeeCreate: (name: string) => void;
    onEmployeeUpdate: (id: string, name: string, status?: 'active' | 'holiday' | 'sick', jobRole?: 'operative' | 'assistant', email?: string) => void;
    onEmployeeDelete: (id: string) => void;
    onVehicleCreate: (name: string) => void;
    onVehicleUpdate: (id: string, name: string, status?: 'active' | 'off_road' | 'maintenance') => void;
    onVehicleDelete: (id: string) => void;
}

export function ResourcesModal({ 
    open, onOpenChange, 
    employees, vehicles,
    onEmployeeCreate, onEmployeeUpdate, onEmployeeDelete,
    onVehicleCreate, onVehicleUpdate, onVehicleDelete
}: ResourcesModalProps) {
    const [newItemName, setNewItemName] = useState("");
    const [editingEmployee, setEditingEmployee] = useState<{ id: string, name: string, status: 'active' | 'holiday' | 'sick', email?: string } | null>(null);
    const [editingVehicle, setEditingVehicle] = useState<{ id: string, name: string, status: 'active' | 'off_road' | 'maintenance' } | null>(null);

    const handleAdd = (type: 'employee' | 'vehicle') => {
        if (!newItemName.trim()) return;
        if (type === 'employee') onEmployeeCreate(newItemName);
        else onVehicleCreate(newItemName);
        setNewItemName("");
    };

    const handleEmployeeSave = () => {
        if (!editingEmployee || !editingEmployee.name.trim()) return;
        onEmployeeUpdate(editingEmployee.id, editingEmployee.name, editingEmployee.status, undefined, editingEmployee.email);
        setEditingEmployee(null);
    };

    const handleVehicleSave = () => {
        if (!editingVehicle || !editingVehicle.name.trim()) return;
        onVehicleUpdate(editingVehicle.id, editingVehicle.name, editingVehicle.status);
        setEditingVehicle(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-white text-slate-900 h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Resources</DialogTitle>
                </DialogHeader>
                
                <Tabs defaultValue="employees" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="employees">Employees</TabsTrigger>
                        <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="employees" className="flex-1 flex flex-col min-h-0 mt-4 space-y-4">
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Add new employee name..." 
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd('employee')}
                            />
                            <Button onClick={() => handleAdd('employee')}><Plus className="w-4 h-4 mr-2" /> Add</Button>
                        </div>
                        <div className="flex-1 overflow-y-auto border rounded-md divide-y">
                            {employees.map(emp => (
                                <div key={emp.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                                    {editingEmployee?.id === emp.id ? (
                                        <div className="flex items-center gap-2 flex-1 mr-4">
                                            <div className="flex flex-col gap-1 flex-1">
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
                                                    placeholder="Email Address"
                                                    type="email"
                                                />
                                            </div>
                                            <Select 
                                                value={editingEmployee.status} 
                                                onValueChange={(val: any) => setEditingEmployee({ ...editingEmployee, status: val })}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white">
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="holiday">Holiday</SelectItem>
                                                    <SelectItem value="sick">Sick</SelectItem>
                                                </SelectContent>
                                            </Select>
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
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {editingEmployee?.id !== emp.id && (
                                        <div className="flex gap-1">
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

                    <TabsContent value="vehicles" className="flex-1 flex flex-col min-h-0 mt-4 space-y-4">
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Add new vehicle name..." 
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd('vehicle')}
                            />
                            <Button onClick={() => handleAdd('vehicle')}><Plus className="w-4 h-4 mr-2" /> Add</Button>
                        </div>
                        <div className="flex-1 overflow-y-auto border rounded-md divide-y">
                            {vehicles.map(veh => (
                                <div key={veh.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                                    {editingVehicle?.id === veh.id ? (
                                        <div className="flex items-center gap-2 flex-1 mr-4">
                                            <Input 
                                                value={editingVehicle.name} 
                                                onChange={(e) => setEditingVehicle({ ...editingVehicle, name: e.target.value })}
                                                autoFocus
                                                className="w-40"
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
                                            <Button size="sm" onClick={handleVehicleSave}>Save</Button>
                                            <Button size="sm" variant="ghost" onClick={() => setEditingVehicle(null)}>Cancel</Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                                                <Truck className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{veh.name}</span>
                                                {veh.status !== 'active' && (
                                                    <span className="text-xs text-red-600 font-medium uppercase tracking-wider flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> {veh.status === 'off_road' ? 'VOR' : veh.status}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {editingVehicle?.id !== veh.id && (
                                        <div className="flex gap-1">
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
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
