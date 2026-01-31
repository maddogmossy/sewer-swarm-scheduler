"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarGrid, type Crew, type ScheduleItem } from "@/components/schedule/CalendarGrid";
import { Sidebar } from "@/components/schedule/Sidebar";
import { useScheduleData } from "@/hooks/useScheduleData";
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
      await mutations.updateScheduleItem.mutateAsync({
        id: item.id,
        data: {
          ...item,
          date: item.date instanceof Date ? item.date.toISOString() : item.date,
        },
      });
    },
    [mutations]
  );

  const handleItemCreate = useCallback(
    async (item: ScheduleItem) => {
      await mutations.createScheduleItem.mutateAsync({
        ...item,
        date: item.date instanceof Date ? item.date.toISOString() : item.date,
      } as any);
    },
    [mutations]
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
      await api.updateCrew(id, { name, shift });
      // Invalidate queries to refetch
      window.location.reload();
    },
    []
  );

  const handleCrewDelete = useCallback(async (id: string) => {
    await api.archiveCrew(id);
    window.location.reload();
  }, []);

  const handleEmployeeCreate = useCallback(
    async (name: string) => {
      if (!selectedDepotId) return;
      await mutations.createEmployee.mutateAsync({
        name,
        status: "active",
        jobRole: "operative",
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
      await api.updateEmployee(id, { name, status, jobRole, email });
      window.location.reload();
    },
    []
  );

  const handleEmployeeDelete = useCallback(async (id: string) => {
    await api.deleteEmployee(id);
    window.location.reload();
  }, []);

  const handleVehicleCreate = useCallback(
    async (name: string) => {
      if (!selectedDepotId) return;
      await mutations.createVehicle.mutateAsync({
        name,
        status: "active",
        vehicleType: "Van",
        depotId: selectedDepotId,
      });
    },
    [selectedDepotId, mutations]
  );

  const handleVehicleUpdate = useCallback(
    async (
      id: string,
      name: string,
      status?: "active" | "off_road" | "maintenance"
    ) => {
      await api.updateVehicle(id, { name, status });
      window.location.reload();
    },
    []
  );

  const handleVehicleDelete = useCallback(async (id: string) => {
    await api.deleteVehicle(id);
    window.location.reload();
  }, []);

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
        onDepotSelect={setSelectedDepotId}
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
      />
      <div className="flex-1 overflow-auto">
        <CalendarGrid
          items={transformedItems}
          crews={transformedCrews}
          employees={transformedEmployees}
          vehicles={transformedVehicles}
          colorLabels={colorLabels}
          isReadOnly={false}
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
    </div>
  );
}

