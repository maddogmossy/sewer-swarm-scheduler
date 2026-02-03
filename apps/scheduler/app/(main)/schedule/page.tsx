"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarGrid, type Crew, type ScheduleItem } from "@/components/schedule/CalendarGrid";
import { Sidebar, type Depot } from "@/components/schedule/Sidebar";
import { DepotCrewModal } from "@/components/schedule/DepotCrewModal";
import { TeamManagement } from "@/components/schedule/TeamManagement";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useScheduleData } from "@/hooks/useScheduleData";
import { useOrganization, canManageResources, canManageTeam } from "@/hooks/useOrganization";
import { api } from "@/lib/api";
import { startOfWeek, startOfDay, isBefore, isAfter, isSameDay, addDays } from "date-fns";

const INITIAL_COLOR_LABELS: Record<string, string> = {
  blue: "Standard Job",
  green: "Completed",
  red: "Urgent",
  yellow: "Pending",
  purple: "Specialist",
  orange: "Warning",
  pink: "Other",
  teal: "Maintenance",
  gray: "Cancelled",
};

const INITIAL_VEHICLE_TYPES = ["Van", "CCTV", "Jetting", "Recycler", "Other"];

export default function SchedulePage() {
  const router = useRouter();
  const [selectedDepotId, setSelectedDepotId] = useState<string>("");
  const [isDepotCrewModalOpen, setIsDepotCrewModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [vehicleTypes] = useState<string[]>(INITIAL_VEHICLE_TYPES);
  const [colorLabels, setColorLabels] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("scheduler_color_labels");
      return saved ? JSON.parse(saved) : INITIAL_COLOR_LABELS;
    }
    return INITIAL_COLOR_LABELS;
  });

  const {
    depots,
    crews,
    employees,
    vehicles,
    scheduleItems,
    isLoading,
    mutations,
  } = useScheduleData();

  // Get user's organization and role
  const { data: orgData, isLoading: orgLoading } = useOrganization();
  const userRole = orgData?.membershipRole || "user";
  
  // Debug: Log role information
  useEffect(() => {
    if (!orgLoading && orgData) {
      console.log("🔐 User Role Debug:", {
        role: userRole,
        canManageResources: canManageResources(userRole),
        canManageTeam: canManageTeam(userRole),
        isReadOnly: !canManageResources(userRole),
        organization: orgData.name
      });
    }
  }, [orgData, orgLoading, userRole]);
  
  // Determine if user can edit (admin and operations can edit, users can only view)
  // Default to false (editable) while loading to avoid blocking users
  const isReadOnly = orgLoading ? false : !canManageResources(userRole);
  
  // Check if user can access team management (admin only)
  const canAccessSettings = canManageTeam(userRole);
  
  // Get current user ID from API
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const res = await fetch('/api/user');
        if (res.ok) {
          const data = await res.json();
          setCurrentUserId(data.userId);
        }
      } catch (error) {
        console.error('Failed to fetch user ID:', error);
      }
    };
    fetchUserId();
  }, []);

  // Select first depot if none selected
  useEffect(() => {
    if (!selectedDepotId && depots.length > 0) {
      setSelectedDepotId(depots[0].id);
    }
  }, [depots, selectedDepotId]);

  // Filter data by selected depot
  const filteredCrews = crews.filter(
    (c) => c.depotId === selectedDepotId && !c.archivedAt
  );
  const filteredEmployees = employees.filter((e) => e.depotId === selectedDepotId);
  const filteredVehicles = vehicles.filter((v) => v.depotId === selectedDepotId);
  const filteredItems = scheduleItems.filter((i) => i.depotId === selectedDepotId);
  
  // Debug logging
  useEffect(() => {
    if (scheduleItems.length > 0) {
      console.log('[SchedulePage] Schedule items:', {
        total: scheduleItems.length,
        filtered: filteredItems.length,
        selectedDepotId,
        itemsByDepot: scheduleItems.reduce((acc, item) => {
          acc[item.depotId] = (acc[item.depotId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });
    }
  }, [scheduleItems, filteredItems, selectedDepotId]);

  // Transform data to match CalendarGrid types
  const transformedCrews: Crew[] = filteredCrews.map((c) => ({
    id: c.id,
    name: c.name,
    depotId: c.depotId,
    shift: (c.shift as "day" | "night") || "day",
    archivedAt: c.archivedAt,
  }));

  const transformedEmployees = filteredEmployees.map((e) => ({
    id: e.id,
    name: e.name,
    status: (e.status as "active" | "holiday" | "sick") || "active",
    jobRole: (e.jobRole as "operative" | "assistant") || "operative",
    email: e.email,
    depotId: e.depotId,
  }));

  const transformedVehicles = filteredVehicles.map((v) => ({
    id: v.id,
    name: v.name,
    status: (v.status as "active" | "off_road" | "maintenance") || "active",
    vehicleType: v.vehicleType || "Van",
    depotId: v.depotId,
  }));

  const transformedItems: ScheduleItem[] = filteredItems.map((i) => ({
    id: i.id,
    type: (i.type as "job" | "operative" | "assistant" | "note") || "job",
    date: i.date instanceof Date ? i.date : new Date(i.date),
    crewId: i.crewId,
    depotId: i.depotId,
    customer: i.customer,
    jobNumber: i.jobNumber,
    address: i.address,
    projectManager: i.projectManager,
    startTime: i.startTime,
    onsiteTime: i.onsiteTime,
    color: i.color,
    duration: i.duration,
    employeeId: i.employeeId,
    vehicleId: i.vehicleId,
    noteContent: i.noteContent,
  }));

const transformedDepots: Depot[] = depots.map((d) => ({
  id: d.id,
  name: d.name,
  address: d.address,
  employees: employees.filter(e => e.depotId === d.id).length,
  vehicles: vehicles.filter(v => v.depotId === d.id).length,
}));

  // Handlers
  const handleItemUpdate = useCallback(
    async (item: ScheduleItem) => {
      // Match Replit's approach: send the item data directly, let the server handle date conversion
      const { id, ...itemData } = item;
      
      await mutations.updateScheduleItem.mutateAsync({
        id: item.id,
        data: itemData,
      });
    },
    [mutations]
  );

  const handleItemCreate = useCallback(
    async (item: ScheduleItem) => {
      // Remove id and ensure date is properly formatted
      const { id, date, duration, ...itemData } = item;
      
      // Validate date exists
      if (!date) {
        console.error('[handleItemCreate] Missing date in item:', item);
        throw new Error('Date is required to create a schedule item');
      }
      
      // Use provided depotId if available, otherwise use selectedDepotId (like Replit)
      const itemWithDepot = {
        ...itemData,
        depotId: (itemData.depotId && itemData.depotId !== "") ? itemData.depotId : selectedDepotId
      };
      
      // Ensure date is converted to ISO string
      let dateValue: string;
      if (date instanceof Date) {
        if (isNaN(date.getTime())) {
          throw new Error('Invalid Date object');
        }
        dateValue = date.toISOString();
      } else if (typeof date === 'string') {
        // If it's already a string, validate it's a valid date string
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          throw new Error(`Invalid date: ${date}`);
        }
        dateValue = dateObj.toISOString();
      } else {
        // Fallback: try to create a Date from it
        const dateObj = new Date(date as any);
        if (isNaN(dateObj.getTime())) {
          throw new Error(`Invalid date value: ${date}`);
        }
        dateValue = dateObj.toISOString();
      }
      
      // Convert duration to number if present (only for jobs)
      const durationValue = item.type === 'job' && duration ? Number(duration) : undefined;
      
      // Ensure date is included in the request
      const requestData = {
        ...itemWithDepot,
        date: dateValue,
        duration: durationValue,
      };
      
      console.log('[handleItemCreate] Creating item:', {
        type: item.type,
        hasDate: !!requestData.date,
        dateValue: requestData.date,
        depotId: requestData.depotId,
        employeeId: requestData.employeeId,
      });
      
      try {
        const createdItem = await mutations.createScheduleItem.mutateAsync(requestData as any);
        console.log('[handleItemCreate] Item created successfully:', createdItem?.id);
      } catch (error: any) {
        console.error('[handleItemCreate] Failed to create item:', error);
        // Re-throw so UI can show error if needed
        throw error;
      }
    },
    [mutations, selectedDepotId]
  );

  const handleItemDelete = useCallback(
    async (id: string) => {
      await mutations.deleteScheduleItem.mutateAsync(id);
    },
    [mutations]
  );

  const handleItemReorder = useCallback(
    async (activeId: string, overId: string) => {
      // This would need a specific API endpoint for reordering
      // For now, we'll just update the items
      const activeItem = transformedItems.find((i) => i.id === activeId);
      const overItem = transformedItems.find((i) => i.id === overId);
      if (activeItem && overItem) {
        // Swap crew IDs or update order
        await handleItemUpdate({ ...activeItem, crewId: overItem.crewId });
      }
    },
    [transformedItems, handleItemUpdate]
  );

  const handleCrewCreate = useCallback(
    async (name: string, shift: "day" | "night") => {
      if (!selectedDepotId) return;
      await mutations.createCrew.mutateAsync({
        name,
        depotId: selectedDepotId,
        shift,
      });
    },
    [selectedDepotId, mutations]
  );

  const handleCrewUpdate = useCallback(
    async (id: string, name: string, shift: "day" | "night") => {
      await mutations.updateCrew.mutateAsync({ id, data: { name, shift } });
    },
    [mutations]
  );

  const handleCrewDelete = useCallback(async (id: string) => {
    // Check if crew has any schedule items in the current week or future
    const today = startOfDay(new Date());
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    
    const crewItems = scheduleItems.filter(item => item.crewId === id);
    const hasCurrentOrFutureItems = crewItems.some(item => {
      const itemDate = startOfDay(new Date(item.date));
      // Check if item is in current week or future
      return !isBefore(itemDate, currentWeekStart);
    });
    
    if (hasCurrentOrFutureItems) {
      alert("Cannot delete this crew. It has scheduled work in the current week or future. Only crews with past work only can be deleted.");
      return;
    }
    
    // Only allow deletion if crew has no current/future items
    await mutations.archiveCrew.mutateAsync(id);
  }, [mutations, scheduleItems]);

  const handleEmployeeCreate = useCallback(
    async (name: string, jobRole: "operative" | "assistant" = "operative", email?: string) => {
      if (!selectedDepotId) return;
      await mutations.createEmployee.mutateAsync({
        name,
        status: "active",
        jobRole,
        email,
        depotId: selectedDepotId,
      });
    },
    [selectedDepotId, mutations]
  );

  const handleEmployeeUpdate = useCallback(
    async (
      id: string,
      name: string,
      status?: "active" | "holiday" | "sick",
      jobRole?: "operative" | "assistant",
      email?: string
    ) => {
      await mutations.updateEmployee.mutateAsync({ id, data: { name, status, jobRole, email } });
    },
    [mutations]
  );

  const handleEmployeeDelete = useCallback(async (id: string) => {
    await mutations.deleteEmployee.mutateAsync(id);
  }, [mutations]);

  const handleVehicleCreate = useCallback(
    async (name: string, vehicleType: string = "Van") => {
      if (!selectedDepotId) return;
      await mutations.createVehicle.mutateAsync({
        name,
        status: "active",
        vehicleType,
        depotId: selectedDepotId,
      });
    },
    [selectedDepotId, mutations]
  );

  const handleVehicleUpdate = useCallback(
    async (
      id: string,
      name: string,
      status?: "active" | "off_road" | "maintenance",
      vehicleType?: string
    ) => {
      await mutations.updateVehicle.mutateAsync({ id, data: { name, status, vehicleType } });
    },
    [mutations]
  );

  const handleVehicleDelete = useCallback(async (id: string) => {
    await mutations.deleteVehicle.mutateAsync(id);
  }, [mutations]);

  const handleColorLabelUpdate = useCallback(
    async (color: string, label: string) => {
      setColorLabels((prev) => ({ ...prev, [color]: label }));
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "scheduler_color_labels",
          JSON.stringify({ ...colorLabels, [color]: label })
        );
      }
      await mutations.saveColorLabel.mutateAsync({ color, label });
    },
    [colorLabels, mutations]
  );

  const handleDepotUpdate = useCallback(
    async (id: string, updates: { name?: string; address?: string }) => {
      await mutations.updateDepot.mutateAsync({ id, data: updates });
    },
    [mutations]
  );

  const handleDepotDelete = useCallback(
    async (id: string) => {
      await mutations.deleteDepot.mutateAsync(id);
    },
    [mutations]
  );

  const handleAddDepot = useCallback(async () => {
    // Create a new depot with default values
    const newDepot = await mutations.createDepot.mutateAsync({
      name: "New Depot",
      address: "Enter Address",
    });
    // Select the newly created depot
    setSelectedDepotId(newDepot.id);
  }, [mutations]);

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
      // Still redirect even if logout fails
      router.push("/");
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (depots.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center max-w-md px-6">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Welcome to Sewer Swarm AI!</h2>
            <p className="text-slate-600 mb-6">
              Get started by creating your first depot. A depot represents a location where your crews operate from.
            </p>
          </div>
          <button
            onClick={handleAddDepot}
            disabled={isLoading || mutations.createDepot.isPending}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {mutations.createDepot.isPending ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Your First Depot
              </>
            )}
          </button>
          <p className="text-sm text-slate-500 mt-4">
            You can edit the depot name and address after creating it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        key={`sidebar-${userRole}-${isReadOnly}`}
        depots={transformedDepots}
        selectedDepotId={selectedDepotId}
        onSelectDepot={setSelectedDepotId}
        onUpdateDepot={handleDepotUpdate}
        onDeleteDepot={handleDepotDelete}
        onAddDepot={handleAddDepot}
        onEditDepot={() => {
          setIsDepotCrewModalOpen(true);
        }}
        isReadOnly={isReadOnly}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        canAccessSettings={canAccessSettings}
      />
      <div className="flex-1 overflow-auto">
        <CalendarGrid
          items={transformedItems}
          crews={transformedCrews}
          employees={transformedEmployees}
          vehicles={transformedVehicles}
          colorLabels={colorLabels}
          isReadOnly={isReadOnly}
          depots={transformedDepots}
          allItems={transformedItems}
          onItemUpdate={handleItemUpdate}
          onItemCreate={handleItemCreate}
          onItemDelete={handleItemDelete}
          onItemReorder={handleItemReorder}
          onCrewCreate={handleCrewCreate}
          onCrewUpdate={handleCrewUpdate}
          onCrewDelete={handleCrewDelete}
          onEmployeeCreate={handleEmployeeCreate}
          onEmployeeUpdate={handleEmployeeUpdate}
          onEmployeeDelete={handleEmployeeDelete}
          onVehicleCreate={handleVehicleCreate}
          onVehicleUpdate={handleVehicleUpdate}
          onVehicleDelete={handleVehicleDelete}
          onColorLabelUpdate={handleColorLabelUpdate}
          vehicleTypes={vehicleTypes}
          allCrews={transformedCrews}
          onLogout={handleLogout}
        />
      </div>
      {selectedDepotId && (
        <DepotCrewModal
          open={isDepotCrewModalOpen}
          onOpenChange={setIsDepotCrewModalOpen}
          depotName={transformedDepots.find(d => d.id === selectedDepotId)?.name || "Depot"}
          crews={transformedCrews}
          employees={transformedEmployees}
          vehicles={transformedVehicles}
          onCrewCreate={handleCrewCreate}
          onCrewUpdate={handleCrewUpdate}
          onCrewDelete={handleCrewDelete}
          onEmployeeCreate={handleEmployeeCreate}
          onEmployeeUpdate={handleEmployeeUpdate}
          onEmployeeDelete={handleEmployeeDelete}
          onVehicleCreate={handleVehicleCreate}
          onVehicleUpdate={handleVehicleUpdate}
          onVehicleDelete={handleVehicleDelete}
          vehicleTypes={vehicleTypes}
          isReadOnly={isReadOnly}
        />
      )}
      
      {/* Settings Modal with Team Management */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Team & Settings</DialogTitle>
          </DialogHeader>
          {currentUserId && (
            <TeamManagement
              currentUserRole={userRole}
              currentUserId={currentUserId}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


