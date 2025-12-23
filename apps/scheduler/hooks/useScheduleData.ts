import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ScheduleItem } from "@/lib/api";

export function useScheduleData() {
  const queryClient = useQueryClient();

  const depots = useQuery({
    queryKey: ["depots"],
    queryFn: () => api.getDepots(),
  });

  const crews = useQuery({
    queryKey: ["crews"],
    queryFn: () => api.getCrews(true),
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.getEmployees(),
  });

  const vehicles = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.getVehicles(),
  });

  const scheduleItems = useQuery({
    queryKey: ["scheduleItems"],
    queryFn: async () => {
      const items = await api.getScheduleItems();
      // Convert date strings to Date objects
      return items.map(item => ({
        ...item,
        date: new Date(item.date),
      }));
    },
  });

  const colorLabels = useQuery({
    queryKey: ["colorLabels"],
    queryFn: () => api.getColorLabels(),
  });

  // Mutations
  const createScheduleItem = useMutation({
    mutationFn: (item: Omit<ScheduleItem, "id" | "userId">) => api.createScheduleItem(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduleItems"] });
    },
  });

  const updateScheduleItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScheduleItem> }) =>
      api.updateScheduleItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduleItems"] });
    },
  });

  const deleteScheduleItem = useMutation({
    mutationFn: (id: string) => api.deleteScheduleItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduleItems"] });
    },
  });

  const saveColorLabel = useMutation({
    mutationFn: ({ color, label }: { color: string; label: string }) =>
      api.saveColorLabel(color, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colorLabels"] });
    },
  });

  const createDepot = useMutation({
    mutationFn: (depot: { name: string; address: string }) => api.createDepot(depot),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depots"] });
    },
  });

  const createCrew = useMutation({
    mutationFn: (crew: { name: string; depotId: string; shift: string }) => api.createCrew(crew),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crews"] });
    },
  });

  const createEmployee = useMutation({
    mutationFn: (employee: { name: string; status: string; jobRole: string; email?: string; depotId: string }) =>
      api.createEmployee(employee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  const createVehicle = useMutation({
    mutationFn: (vehicle: { name: string; status: string; vehicleType: string; depotId: string }) =>
      api.createVehicle(vehicle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });

  return {
    depots: depots.data || [],
    crews: crews.data || [],
    employees: employees.data || [],
    vehicles: vehicles.data || [],
    scheduleItems: scheduleItems.data || [],
    colorLabels: colorLabels.data || {},
    isLoading:
      depots.isLoading ||
      crews.isLoading ||
      employees.isLoading ||
      vehicles.isLoading ||
      scheduleItems.isLoading ||
      colorLabels.isLoading,
    mutations: {
      createScheduleItem,
      updateScheduleItem,
      deleteScheduleItem,
      saveColorLabel,
      createDepot,
      createCrew,
      createEmployee,
      createVehicle,
    },
  };
}
