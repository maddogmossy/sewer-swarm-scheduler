"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarGrid, type Crew, type ScheduleItem } from "@/components/schedule/CalendarGrid";
import { Sidebar } from "@/components/schedule/Sidebar";
import { DepotCrewModal } from "@/components/schedule/DepotCrewModal";
import { useScheduleData } from "@/hooks/useScheduleData";
import { useOrganization, canManageResources } from "@/hooks/useOrganization";
import { api } from "@/lib/api";

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
  const [selectedDepotId, setSelectedDepotId] = useState<string>("");
  const [isDepotCrewModalOpen, setIsDepotCrewModalOpen] = useState(false);
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
  
  // Determine if user can edit (admin and operations can edit, users can only view)
  // Default to false (editable) while loading to avoid blocking users
  const isReadOnly = orgLoading ? false : !canManageResources(userRole);

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

  const transformedDepots = depots.map((d) => ({
    id: d.id,
    name: d.name,
    address: d.address,
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
    await mutations.archiveCrew.mutateAsync(id);
  }, [mutations]);

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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (depots.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Depots Found</h2>
          <p className="text-gray-600">
            Please create a depot first or run the seed script.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
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
    </div>
  );
}


