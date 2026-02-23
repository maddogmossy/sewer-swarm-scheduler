import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ScheduleItem, Depot, Crew, Employee, Vehicle } from "@/lib/api";

// Helper to check if we're in production
function getPollingInterval(): number | false {
  if (typeof window === 'undefined') return false;
  
  const isProduction = 
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname.includes('sewer-swarm') ||
    process.env.NODE_ENV === 'production';
  
  // Poll every 5 seconds in production, disabled in development
  return isProduction ? 5000 : false;
}

export function useScheduleData() {
  const queryClient = useQueryClient();
  const pollingInterval = getPollingInterval();

  const depots = useQuery({
    queryKey: ["depots"],
    queryFn: () => api.getDepots(),
    refetchInterval: pollingInterval,
  });

  const crews = useQuery({
    queryKey: ["crews"],
    queryFn: () => api.getCrews(true),
    refetchInterval: pollingInterval,
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.getEmployees(),
    refetchInterval: pollingInterval,
  });

  const employeeAbsences = useQuery({
    queryKey: ["employeeAbsences"],
    queryFn: async () => {
      try {
        const data = await api.getEmployeeAbsences();
        return data;
      } catch (err: any) {
        throw err;
      }
    },
    refetchInterval: pollingInterval,
  });

  const vehicles = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.getVehicles(),
    refetchInterval: pollingInterval,
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
    refetchInterval: pollingInterval,
  });

  const colorLabels = useQuery({
    queryKey: ["colorLabels"],
    queryFn: () => api.getColorLabels(),
    refetchInterval: pollingInterval,
  });

  // Mutations
  const createScheduleItem = useMutation({
    mutationFn: (item: Omit<ScheduleItem, "id" | "userId">) => api.createScheduleItem(item),
    // Optimistic update - add item immediately to cache
    onMutate: async (newItem) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["scheduleItems"] });

      // Snapshot the previous value
      const previousItems = queryClient.getQueryData<ScheduleItem[]>(["scheduleItems"]);

      // Optimistically add the new item to cache
      if (previousItems) {
        // Create a temporary item with a placeholder ID
        const tempItem: ScheduleItem = {
          ...newItem,
          id: `temp-${Date.now()}`,
          userId: "", // Will be set by server
          date: newItem.date instanceof Date ? newItem.date : new Date(newItem.date),
        } as ScheduleItem;

        queryClient.setQueryData<ScheduleItem[]>(["scheduleItems"], (old) => {
          if (!old) return [tempItem];
          return [...old, tempItem];
        });
      }

      // Return context with snapshot value
      return { previousItems };
    },
    // If mutation fails, roll back to previous value
    onError: (err, variables, context) => {
      console.error('[createScheduleItem] Mutation failed:', err);
      if (context?.previousItems) {
        queryClient.setQueryData(["scheduleItems"], context.previousItems);
      }
    },
    // On success, replace optimistic item with real item from server
    onSuccess: (data) => {
      console.log('[createScheduleItem] Success, received item:', data?.id, data?.type, data?.depotId);
      
      // Convert date string to Date object once
      const itemWithDate: ScheduleItem = {
        ...data,
        date: data.date instanceof Date ? data.date : new Date(data.date),
      } as ScheduleItem;
      
      // The server returns the created item, so we can update the cache
      queryClient.setQueryData<ScheduleItem[]>(["scheduleItems"], (old) => {
        if (!old) {
          console.log('[createScheduleItem] No existing cache, adding item');
          return [itemWithDate];
        }
        
        // Remove any temp items
        const withoutTemp = old.filter(item => !item.id.startsWith('temp-'));
        
        // Check if item already exists (shouldn't happen, but be defensive)
        const existingIndex = withoutTemp.findIndex(item => item.id === data.id);
        if (existingIndex >= 0) {
          // Item already exists, update it
          console.log('[createScheduleItem] Item already exists, updating');
          const updated = [...withoutTemp];
          updated[existingIndex] = itemWithDate;
          return updated;
        }
        
        // Add the new item
        const updated = [...withoutTemp, itemWithDate];
        console.log('[createScheduleItem] Updated cache, total items:', updated.length, 'new item:', itemWithDate.id);
        return updated;
      });
      
      // Verify the item was added to cache and log details
      const verifyCache = () => {
        const currentCache = queryClient.getQueryData<ScheduleItem[]>(["scheduleItems"]);
        const hasItem = currentCache?.some(item => item.id === data.id);
        console.log('[createScheduleItem] Cache verification:', {
          hasItem,
          cacheLength: currentCache?.length || 0,
          itemId: data.id,
          itemDepotId: data.depotId,
          selectedDepotId: 'check page component',
        });
        if (!hasItem && currentCache) {
          console.warn('[createScheduleItem] Item missing from cache after update, re-adding');
          queryClient.setQueryData<ScheduleItem[]>(["scheduleItems"], [...currentCache, itemWithDate]);
        } else if (hasItem) {
          console.log('[createScheduleItem] Item confirmed in cache:', data.id);
        }
      };
      
      // Check immediately and after a short delay to catch any race conditions
      verifyCache();
      setTimeout(verifyCache, 50);
      setTimeout(verifyCache, 200); // Check again after a longer delay
      
      // Don't invalidate - we've already updated the cache with the real item from the server
      // Invalidating would trigger a refetch that might race with the database commit
    },
    // Only invalidate on error to refetch - on success we've already updated the cache
    onSettled: (data, error) => {
      // Only invalidate if there was an error - on success, cache is already correct
      if (error) {
        queryClient.invalidateQueries({ queryKey: ["scheduleItems"] });
      }
      // Don't invalidate on success - we've already updated the cache with the real item
    },
  });

  const updateScheduleItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScheduleItem> }) =>
      api.updateScheduleItem(id, data),
    // Optimistic update - update cache immediately before server responds
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["scheduleItems"] });

      // Snapshot the previous value
      const previousItems = queryClient.getQueryData<ScheduleItem[]>(["scheduleItems"]);

      // Optimistically update to the new value
      if (previousItems) {
        queryClient.setQueryData<ScheduleItem[]>(["scheduleItems"], (old) => {
          if (!old) return old;
          return old.map((item) => {
            if (item.id === id) {
              const updated = { ...item, ...data };
              // Ensure date is a Date object if it was updated
              if (data.date) {
                updated.date = data.date instanceof Date ? data.date : new Date(data.date);
              }
              return updated;
            }
            return item;
          });
        });
      }

      // Return context with snapshot value
      return { previousItems };
    },
    // If mutation fails, roll back to previous value
    onError: (err, variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["scheduleItems"], context.previousItems);
      }
    },
    // Important: group operations (like applying a color across many job-days) can fire a burst of PATCHes.
    // Invalidating after *every* PATCH can create a burst of GET /api/schedule-items refetches, which
    // increases load and can contribute to intermittent "Failed to fetch" in dev. We already do an
    // optimistic update, so only refetch on error.
    onSettled: (_data, error) => {
      if (error) {
        queryClient.invalidateQueries({ queryKey: ["scheduleItems"] });
      }
    },
  });

  const deleteScheduleItem = useMutation({
    mutationFn: (id: string) => api.deleteScheduleItem(id),
    // Optimistic delete - remove from cache immediately so UI doesn't "snap back" / linger
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["scheduleItems"] });
      const previousItems = queryClient.getQueryData<ScheduleItem[]>(["scheduleItems"]);

      if (previousItems) {
        queryClient.setQueryData<ScheduleItem[]>(["scheduleItems"], (old) => {
          if (!old) return old;
          return old.filter((item) => item.id !== id);
        });
      }

      return { previousItems };
    },
    onError: (_err, _id, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["scheduleItems"], context.previousItems);
      }
    },
    // Only invalidate on error; on success the cache is already correct.
    onSettled: (_data, error) => {
      if (error) {
        queryClient.invalidateQueries({ queryKey: ["scheduleItems"] });
      }
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
    mutationFn: (vehicle: { name: string; status: string; vehicleType: string; category?: string; color?: string; depotId: string }) =>
      api.createVehicle(vehicle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });

  const updateDepot = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Depot> }) =>
      api.updateDepot(id, data),
    // Optimistic update - update cache immediately
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["depots"] });
      const previousDepots = queryClient.getQueryData<Depot[]>(["depots"]);
      
      if (previousDepots) {
        queryClient.setQueryData<Depot[]>(["depots"], (old) => {
          if (!old) return old;
          return old.map((depot) => 
            depot.id === id ? { ...depot, ...data } : depot
          );
        });
      }
      
      return { previousDepots };
    },
    onError: (err, variables, context) => {
      if (context?.previousDepots) {
        queryClient.setQueryData(["depots"], context.previousDepots);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["depots"] });
    },
  });

  const deleteDepot = useMutation({
    mutationFn: (id: string) => api.archiveDepot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depots"] });
      queryClient.invalidateQueries({ queryKey: ["archivedDepots"] });
    },
  });

  const archivedDepots = useQuery({
    queryKey: ["archivedDepots"],
    queryFn: () => api.getArchivedDepots(),
  });

  const restoreDepot = useMutation({
    mutationFn: (id: string) => api.restoreDepot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depots"] });
      queryClient.invalidateQueries({ queryKey: ["archivedDepots"] });
    },
  });

  const updateCrew = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Crew> }) =>
      api.updateCrew(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crews"] });
    },
  });

  const archiveCrew = useMutation({
    mutationFn: (id: string) => api.archiveCrew(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crews"] });
    },
  });

  const updateEmployee = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Employee> }) =>
      api.updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: (id: string) => api.deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  const updateVehicle = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Vehicle> }) =>
      api.updateVehicle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });

  const deleteVehicle = useMutation({
    mutationFn: (id: string) => api.deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });

  return {
    depots: depots.data || [],
    archivedDepots: archivedDepots.data || [],
    crews: crews.data || [],
    employees: employees.data || [],
    employeeAbsences: employeeAbsences.data || [],
    vehicles: vehicles.data || [],
    scheduleItems: scheduleItems.data || [],
    colorLabels: colorLabels.data || {},
    isLoading:
      depots.isLoading ||
      crews.isLoading ||
      employees.isLoading ||
      employeeAbsences.isLoading ||
      vehicles.isLoading ||
      scheduleItems.isLoading ||
      colorLabels.isLoading,
    mutations: {
      createScheduleItem,
      updateScheduleItem,
      deleteScheduleItem,
      saveColorLabel,
      createDepot,
      updateDepot,
      deleteDepot,
      restoreDepot,
      createCrew,
      updateCrew,
      archiveCrew,
      createEmployee,
      updateEmployee,
      deleteEmployee,
      createVehicle,
      updateVehicle,
      deleteVehicle,
    },
  };
}
