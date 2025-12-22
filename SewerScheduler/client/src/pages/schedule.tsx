import { useState, useEffect, useCallback } from "react";
import { isSameDay, startOfWeek, addDays } from "date-fns";
import { CalendarGrid, Crew, ScheduleItem } from "@/components/schedule/CalendarGrid";
import { Sidebar } from "@/components/schedule/Sidebar";
import { DepotCrewModal } from "@/components/schedule/DepotCrewModal";
import { TeamManagement } from "@/components/schedule/TeamManagement";
import { arrayMove } from "@dnd-kit/sortable";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Users, CreditCard, BarChart3, Eye, EyeOff } from "lucide-react";
import type { MemberRole } from "@shared/schema";
import { api } from "@/lib/api";

// Types
interface Employee {
    id: string;
    name: string;
    status: 'active' | 'holiday' | 'sick';
    jobRole: 'operative' | 'assistant';
    email?: string;
    depotId?: string;
}

interface Vehicle {
    id: string;
    name: string;
    status: 'active' | 'off_road' | 'maintenance';
    vehicleType: string;
    depotId?: string;
}

// Mock Data
const MOCK_DEPOTS = [
  { id: "d1", name: "London Central Depot", address: "145 City Road, London", employees: 12, vehicles: 8 },
  { id: "d2", name: "Manchester North", address: "88 Industrial Park, Manchester", employees: 8, vehicles: 5 },
  { id: "d3", name: "Birmingham Hub", address: "22 West Midlands Way, Birmingham", employees: 15, vehicles: 10 },
  { id: "d4", name: "Bristol Operations", address: "45 Avon Street, Bristol", employees: 6, vehicles: 4 },
];

const INITIAL_EMPLOYEES: Employee[] = [];

const INITIAL_VEHICLES: Vehicle[] = [];

const INITIAL_CREWS: (Crew & { depotId?: string, shift?: 'day'|'night' })[] = [];

const INITIAL_COLOR_LABELS: Record<string, string> = {
    blue: "Standard Job",
    green: "Completed",
    red: "Urgent",
    yellow: "Pending",
    purple: "Specialist",
    orange: "Warning",
    pink: "Other",
    teal: "Maintenance",
    gray: "Cancelled"
};

// Updated Mock Data to use "ScheduleItem" structure
const MOCK_ITEMS: ScheduleItem[] = [];

const INITIAL_VEHICLE_TYPES = ['Van', 'CCTV', 'Jetting', 'Recycler', 'Other'];


export default function SchedulePage() {
  // State - Initialize empty, data will be loaded from API
  const [selectedDepotId, setSelectedDepotId] = useState<string>(() => {
      return localStorage.getItem("sewer_swarm_selected_depot") || "";
  });
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(() => {
    const saved = localStorage.getItem("sewer_swarm_vehicle_types");
    return saved ? JSON.parse(saved) : INITIAL_VEHICLE_TYPES;
  });
  const [depots, setDepots] = useState<{ id: string; name: string; address: string; employees: number; vehicles: number }[]>([]);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [crews, setCrews] = useState<(Crew & { depotId?: string, shift?: 'day'|'night' })[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [colorLabels, setColorLabels] = useState<Record<string, string>>(() => {
      const saved = localStorage.getItem("sewer_swarm_color_labels");
      return saved ? JSON.parse(saved) : INITIAL_COLOR_LABELS;
  });
  const [depotCrewModalOpen, setDepotCrewModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [currentUser, setCurrentUser] = useState<{ id: string; membershipRole: MemberRole }>({ id: '', membershipRole: 'admin' });
  const [userLoading, setUserLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [showArchivedCrews, setShowArchivedCrews] = useState(false);

  // Load all data from API - each request handled independently for resilience
  const loadData = useCallback(async () => {
    setDataLoading(true);
    
    // Fetch all data in parallel with individual error handling
    const results = await Promise.allSettled([
      api.getDepots(),
      api.getCrews(true), // Include archived crews
      api.getEmployees(),
      api.getVehicles(),
      api.getScheduleItems()
    ]);
    
    // Extract data from settled promises, defaulting to empty arrays on failure
    const depotsData = results[0].status === 'fulfilled' ? results[0].value : [];
    const crewsData = results[1].status === 'fulfilled' ? results[1].value : [];
    const employeesData = results[2].status === 'fulfilled' ? results[2].value : [];
    const vehiclesData = results[3].status === 'fulfilled' ? results[3].value : [];
    const itemsData = results[4].status === 'fulfilled' ? results[4].value : [];
    
    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const names = ['depots', 'crews', 'employees', 'vehicles', 'schedule-items'];
        console.error(`Failed to load ${names[index]}:`, result.reason);
      }
    });
    
    // Transform API data to match local types
    const transformedDepots = depotsData.map(d => ({
      id: d.id,
      name: d.name,
      address: d.address,
      employees: 0,
      vehicles: 0
    }));
    
    const transformedCrews = crewsData.map(c => ({
      id: c.id,
      name: c.name,
      depotId: c.depotId,
      shift: (c.shift as 'day' | 'night') || 'day',
      archivedAt: c.archivedAt
    }));
    
    const transformedEmployees = employeesData.map(e => ({
      id: e.id,
      name: e.name,
      status: (e.status as 'active' | 'holiday' | 'sick') || 'active',
      jobRole: (e.jobRole as 'operative' | 'assistant') || 'operative',
      email: e.email,
      depotId: e.depotId
    }));
    
    const transformedVehicles = vehiclesData.map(v => ({
      id: v.id,
      name: v.name,
      status: (v.status as 'active' | 'off_road' | 'maintenance') || 'active',
      vehicleType: v.vehicleType || 'Van',
      depotId: v.depotId
    }));
    
    const transformedItems = itemsData.map(i => ({
      ...i,
      type: i.type as 'job' | 'operative' | 'assistant' | 'note',
      date: new Date(i.date)
    }));
    
    setDepots(transformedDepots);
    setCrews(transformedCrews);
    setEmployees(transformedEmployees);
    setVehicles(transformedVehicles);
    setItems(transformedItems);
    
    // Select first depot if none selected
    if (!selectedDepotId && transformedDepots.length > 0) {
      setSelectedDepotId(transformedDepots[0].id);
    }
    
    setDataLoading(false);
  }, [selectedDepotId]);

  // Fetch current user info
  useEffect(() => {
    setUserLoading(true);
    fetch('/api/me', { credentials: 'include' })
      .then(res => {
        if (!res.ok) {
          if (res.status === 401) {
            setLocation('/');
            return null;
          }
          throw new Error('Failed to fetch user');
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          const role = data.membershipRole || 'admin';
          setCurrentUser({ id: data.id, membershipRole: role });
          // Load data after authentication
          loadData();
        }
      })
      .catch(err => {
        console.error('Error fetching user:', err);
        setCurrentUser({ id: 'local', membershipRole: 'admin' });
      })
      .finally(() => setUserLoading(false));
  }, [setLocation, loadData]);

  // History State for Undo/Redo
  const [history, setHistory] = useState<ScheduleItem[][]>([]);
  const [future, setFuture] = useState<ScheduleItem[][]>([]);

  const updateItemsWithHistory = (updateFn: (prev: ScheduleItem[]) => ScheduleItem[]) => {
      setItems(prev => {
          const newItems = updateFn(prev);
          // Only push to history if something actually changed
          if (newItems !== prev) {
              setHistory(h => [...h, prev]);
              setFuture([]); // Clear future on new action
          }
          return newItems;
      });
  };

  const handleUndo = () => {
      if (history.length === 0) return;
      const previous = history[history.length - 1];
      const newHistory = history.slice(0, history.length - 1);
      
      setFuture(f => [items, ...f]);
      setItems(previous);
      setHistory(newHistory);
  };

  const handleRedo = () => {
      if (future.length === 0) return;
      const next = future[0];
      const newFuture = future.slice(1);
      
      setHistory(h => [...h, items]);
      setItems(next);
      setFuture(newFuture);
  };

  const isReadOnly = currentUser.membershipRole === 'user';
  const selectedDepot = depots.find(d => d.id === selectedDepotId);

  // Save selected depot and preferences to localStorage (for quick loading)
  useEffect(() => {
    if (selectedDepotId) {
      localStorage.setItem("sewer_swarm_selected_depot", selectedDepotId);
    }
  }, [selectedDepotId]);

  useEffect(() => {
    localStorage.setItem("sewer_swarm_vehicle_types", JSON.stringify(vehicleTypes));
  }, [vehicleTypes]);

  useEffect(() => {
    localStorage.setItem("sewer_swarm_color_labels", JSON.stringify(colorLabels));
  }, [colorLabels]);

  // Force re-render on window resize (handles layout toggle)
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, []);

  // --- Item Handlers ---
  const handleItemCreate = async (newItem: ScheduleItem) => {
     if (isReadOnly) return;
     
     // Use provided depotId if available (e.g. from Smart Search), otherwise use selected
     const itemWithDepot = { 
         ...newItem, 
         depotId: newItem.depotId && newItem.depotId !== "" ? newItem.depotId : selectedDepotId 
     };
     
     // Ensure duration is a number
     if (itemWithDepot.type === 'job') {
        itemWithDepot.duration = Number(itemWithDepot.duration || 8);
     }
     
     // Skip FREE_SLOT items from being persisted - these are UI-only visual helpers
     const isFreeSlot = itemWithDepot.customer === "FREE_SLOT";
     
     try {
       let createdItem = itemWithDepot;
       
       // Only persist non-FREE_SLOT items to database
       if (!isFreeSlot) {
         const apiItem = await api.createScheduleItem({
           type: itemWithDepot.type,
           date: itemWithDepot.date,
           crewId: itemWithDepot.crewId,
           depotId: itemWithDepot.depotId,
           customer: itemWithDepot.customer,
           jobNumber: itemWithDepot.jobNumber,
           address: itemWithDepot.address,
           projectManager: itemWithDepot.projectManager,
           startTime: itemWithDepot.startTime,
           onsiteTime: itemWithDepot.onsiteTime,
           color: itemWithDepot.color,
           duration: itemWithDepot.duration,
           employeeId: itemWithDepot.employeeId,
           vehicleId: itemWithDepot.vehicleId,
           noteContent: itemWithDepot.noteContent
         });
         createdItem = { ...apiItem, date: new Date(apiItem.date), type: apiItem.type as 'job' | 'operative' | 'assistant' | 'note' };
       }
       
       updateItemsWithHistory(prev => {
           const newItems = [...prev, createdItem];
           
           // Handle free slot logic (UI only)
           if (createdItem.type === 'job' && createdItem.duration && createdItem.duration < 8 && !isFreeSlot) {
               const jobsForDay = [...prev, createdItem].filter(i => 
                   i.type === 'job' && 
                   i.customer !== "FREE_SLOT" &&
                   i.crewId === createdItem.crewId && 
                   isSameDay(new Date(i.date), new Date(createdItem.date))
               );
               
               const totalDuration = jobsForDay.reduce((sum, job) => sum + (Number(job.duration) || 0), 0);
               
               const cleanItems = newItems.filter(i => !(
                   i.customer === "FREE_SLOT" && 
                   i.crewId === createdItem.crewId && 
                   isSameDay(new Date(i.date), new Date(createdItem.date))
               ));
               
               if (totalDuration < 8) {
                   const freeDuration = 8 - totalDuration;
                   const freeSlot: ScheduleItem = {
                       id: `free_${Date.now()}`,
                       type: 'job',
                       customer: "FREE_SLOT",
                       address: "Available for booking",
                       color: "free",
                       duration: freeDuration,
                       date: createdItem.date,
                       crewId: createdItem.crewId,
                       depotId: createdItem.depotId
                   };
                   cleanItems.push(freeSlot);
               }
               
               return cleanItems;
           }
           return newItems;
       });
     } catch (error) {
       console.error('Failed to create schedule item:', error);
     }
  };

  const handleItemUpdate = async (updatedItem: ScheduleItem) => {
    if (isReadOnly) return;
    
    // Skip FREE_SLOT items - they're UI-only
    const isFreeSlot = updatedItem.customer === "FREE_SLOT" || updatedItem.id.startsWith('free_');
    
    try {
      let finalItem = updatedItem;
      
      if (!isFreeSlot) {
        const apiItem = await api.updateScheduleItem(updatedItem.id, {
          type: updatedItem.type,
          date: updatedItem.date,
          crewId: updatedItem.crewId,
          depotId: updatedItem.depotId,
          customer: updatedItem.customer,
          jobNumber: updatedItem.jobNumber,
          address: updatedItem.address,
          projectManager: updatedItem.projectManager,
          startTime: updatedItem.startTime,
          onsiteTime: updatedItem.onsiteTime,
          color: updatedItem.color,
          duration: updatedItem.duration,
          employeeId: updatedItem.employeeId,
          vehicleId: updatedItem.vehicleId,
          noteContent: updatedItem.noteContent
        });
        finalItem = { ...apiItem, date: new Date(apiItem.date), type: apiItem.type as 'job' | 'operative' | 'assistant' | 'note' };
      }

      updateItemsWithHistory(prev => {
          const originalItem = prev.find(i => i.id === updatedItem.id);
          if (!originalItem) return prev;

          const isJob = finalItem.type === 'job';
          const changedLocation = isJob && (
              originalItem.crewId !== finalItem.crewId ||
              !isSameDay(new Date(originalItem.date), new Date(finalItem.date))
          );
          const changedDuration = isJob && (originalItem.duration !== finalItem.duration);

          if (!isJob || (!changedLocation && !changedDuration)) {
               return prev.map(i => i.id === finalItem.id ? finalItem : i);
          }

          const sourceDate = new Date(originalItem.date);
          const targetDate = new Date(finalItem.date);

          let tempItems = prev.map(i => i.id === finalItem.id ? finalItem : i);

          tempItems = tempItems.filter(i => !(
              i.customer === "FREE_SLOT" &&
              i.crewId === originalItem.crewId &&
              isSameDay(new Date(i.date), sourceDate)
          ));

          if (changedLocation) {
               tempItems = tempItems.filter(i => !(
                  i.customer === "FREE_SLOT" &&
                  i.crewId === finalItem.crewId &&
                  isSameDay(new Date(i.date), targetDate)
              ));
          }

          const addFreeSlotIfNeeded = (itemsList: ScheduleItem[], crewId: string, date: Date, depotId: string) => {
               const jobs = itemsList.filter(i =>
                  i.type === 'job' &&
                  i.customer !== "FREE_SLOT" &&
                  i.crewId === crewId &&
                  isSameDay(new Date(i.date), date)
               );

               const totalDuration = jobs.reduce((sum, job) => sum + (Number(job.duration) || 0), 0);

               if (jobs.length > 0 && totalDuration < 8) {
                   const freeDuration = 8 - totalDuration;
                   const freeSlot: ScheduleItem = {
                       id: `free_${Date.now()}`,
                       type: 'job',
                       customer: "FREE_SLOT",
                       address: "Available for booking",
                       color: "free",
                       duration: freeDuration,
                       date: date,
                       crewId: crewId,
                       depotId: depotId
                   };
                   return [...itemsList, freeSlot];
               }
               return itemsList;
          };

          tempItems = addFreeSlotIfNeeded(tempItems, originalItem.crewId, sourceDate, originalItem.depotId);

          if (changedLocation) {
              tempItems = addFreeSlotIfNeeded(tempItems, finalItem.crewId, targetDate, finalItem.depotId);
          }

          return tempItems;
      });
    } catch (error) {
      console.error('Failed to update schedule item:', error);
    }
  };

  const handleItemDelete = async (id: string) => {
    if (isReadOnly) return;
    
    // Skip FREE_SLOT items - they're UI-only
    const isFreeSlot = id.startsWith('free_');
    
    try {
      if (!isFreeSlot) {
        await api.deleteScheduleItem(id);
      }

      updateItemsWithHistory(prev => {
          const itemToDelete = prev.find(i => i.id === id);
          
          if (!itemToDelete || itemToDelete.type !== 'job') {
              return prev.filter(i => i.id !== id);
          }

          const itemsWithoutJobAndFreeSlots = prev.filter(i => {
              if (i.id === id) return false;
              
              if (i.customer === "FREE_SLOT" && 
                  i.crewId === itemToDelete.crewId && 
                  isSameDay(new Date(i.date), new Date(itemToDelete.date))) {
                  return false;
              }
              
              return true;
          });

          const remainingJobs = itemsWithoutJobAndFreeSlots.filter(i => 
              i.type === 'job' && 
              i.customer !== "FREE_SLOT" &&
              i.crewId === itemToDelete.crewId &&
              isSameDay(new Date(i.date), new Date(itemToDelete.date))
          );

          const totalDuration = remainingJobs.reduce((sum, job) => sum + (Number(job.duration) || 0), 0);

          if (remainingJobs.length > 0 && totalDuration < 8) {
              const freeDuration = 8 - totalDuration;
              const freeSlot: ScheduleItem = {
                   id: `free_${Date.now()}`,
                   type: 'job',
                   customer: "FREE_SLOT",
                   address: "Available for booking",
                   color: "free",
                   duration: freeDuration,
                   date: itemToDelete.date,
                   crewId: itemToDelete.crewId,
                   depotId: itemToDelete.depotId
               };
               return [...itemsWithoutJobAndFreeSlots, freeSlot];
          }

          return itemsWithoutJobAndFreeSlots;
      });
    } catch (error) {
      console.error('Failed to delete schedule item:', error);
    }
  };

  const handleItemReorder = (activeId: string, overId: string) => {
    if (isReadOnly) return;
    updateItemsWithHistory((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === activeId);
        const newIndex = prev.findIndex((i) => i.id === overId);
        return arrayMove(prev, oldIndex, newIndex);
    });
  };

  // --- Filter Resources by Depot ---
  const filteredEmployees = employees.filter(e => e.depotId === selectedDepotId);
  const filteredVehicles = vehicles.filter(v => v.depotId === selectedDepotId);
  
  // Filter crews by depot and archived visibility logic
  // Archived crews should only show if they have schedule items in the current view range
  const allDepotCrews = crews.filter(c => c.depotId === selectedDepotId);
  const activeCrews = allDepotCrews.filter(c => !c.archivedAt);
  
  // For archived crew visibility: calculate based on current week view
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentWeekEnd = addDays(currentWeekStart, 6);
  
  const filteredCrews = allDepotCrews.filter(crew => {
    // Active crews always show
    if (!crew.archivedAt) return true;
    
    // User toggle to show all archived crews
    if (showArchivedCrews) return true;
    
    // Archived crews show if they have any schedule items (past or present)
    const hasAnyItems = items.some(item => item.crewId === crew.id);
    return hasAnyItems;
  });

  // --- Crew Handlers ---
  const handleCrewCreate = async (name: string, shift: 'day' | 'night' = 'day') => {
    if (isReadOnly) return;
    
    try {
      const newCrew = await api.createCrew({
        name,
        depotId: selectedDepotId,
        shift
      });
      setCrews(prev => [...prev, {
        id: newCrew.id,
        name: newCrew.name,
        depotId: newCrew.depotId,
        shift: (newCrew.shift as 'day' | 'night') || 'day',
        archivedAt: newCrew.archivedAt
      }]);
    } catch (error) {
      console.error('Failed to create crew:', error);
    }
  };

  const handleCrewUpdate = async (id: string, name: string, shift: 'day' | 'night' = 'day') => {
    if (isReadOnly) return;
    
    // Optimistic update
    setCrews(prev => prev.map(c => c.id === id ? { ...c, name, shift } : c));
    
    try {
      await api.updateCrew(id, { name, shift });
    } catch (error) {
      console.error('Failed to update crew:', error);
      // Reload data on error
      loadData();
    }
  };

  const handleCrewDelete = async (id: string) => {
    if (isReadOnly) return;
    
    // Optimistic update - archive the crew
    setCrews(prev => prev.map(c => c.id === id ? { ...c, archivedAt: new Date().toISOString() } : c));
    
    // Delete FUTURE items locally
    setItems(prev => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return prev.filter(item => {
          if (item.crewId !== id) return true;
          const itemDate = new Date(item.date);
          itemDate.setHours(0, 0, 0, 0);
          return itemDate < today;
      });
    });
    
    try {
      await api.archiveCrew(id);
    } catch (error) {
      console.error('Failed to archive crew in database:', error);
      // Reload data on error to resync
      loadData();
    }
  };

  // --- Resource Handlers ---
  const handleEmployeeCreate = async (name: string, jobRole: 'operative' | 'assistant' = 'operative', email?: string) => {
    if (isReadOnly) return;
    
    try {
      const newEmployee = await api.createEmployee({
        name,
        status: 'active',
        jobRole,
        email,
        depotId: selectedDepotId
      });
      setEmployees(prev => [...prev, {
        id: newEmployee.id,
        name: newEmployee.name,
        status: (newEmployee.status as 'active' | 'holiday' | 'sick') || 'active',
        jobRole: (newEmployee.jobRole as 'operative' | 'assistant') || 'operative',
        email: newEmployee.email,
        depotId: newEmployee.depotId
      }]);
    } catch (error) {
      console.error('Failed to create employee:', error);
    }
  };

  const handleEmployeeUpdate = async (id: string, name: string, status?: 'active' | 'holiday' | 'sick', jobRole?: 'operative' | 'assistant', email?: string) => {
    if (isReadOnly) return;
    
    // Optimistic update
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, name, ...(status ? { status } : {}), ...(jobRole ? { jobRole } : {}), ...(email !== undefined ? { email } : {}) } : e));
    
    try {
      await api.updateEmployee(id, { name, ...(status ? { status } : {}), ...(jobRole ? { jobRole } : {}), ...(email !== undefined ? { email } : {}) });
    } catch (error) {
      console.error('Failed to update employee:', error);
      loadData();
    }
  };

  const handleEmployeeDelete = async (id: string) => {
    if (isReadOnly) return;
    
    // Optimistic update
    setEmployees(prev => prev.filter(e => e.id !== id));
    
    try {
      await api.deleteEmployee(id);
    } catch (error) {
      console.error('Failed to delete employee:', error);
      loadData();
    }
  };

  const handleVehicleCreate = async (name: string, vehicleType: string = 'Van') => {
    if (isReadOnly) return;
    
    try {
      const newVehicle = await api.createVehicle({
        name,
        status: 'active',
        vehicleType,
        depotId: selectedDepotId
      });
      setVehicles(prev => [...prev, {
        id: newVehicle.id,
        name: newVehicle.name,
        status: (newVehicle.status as 'active' | 'off_road' | 'maintenance') || 'active',
        vehicleType: newVehicle.vehicleType || 'Van',
        depotId: newVehicle.depotId
      }]);
    } catch (error) {
      console.error('Failed to create vehicle:', error);
    }
  };

  const handleVehicleUpdate = async (id: string, name: string, status?: 'active' | 'off_road' | 'maintenance', vehicleType?: string) => {
    if (isReadOnly) return;
    
    // Optimistic update
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, name, ...(status ? { status } : {}), ...(vehicleType ? { vehicleType } : {}) } : v));
    
    try {
      await api.updateVehicle(id, { name, ...(status ? { status } : {}), ...(vehicleType ? { vehicleType } : {}) });
    } catch (error) {
      console.error('Failed to update vehicle:', error);
      loadData();
    }
  };

  const handleVehicleDelete = async (id: string) => {
    if (isReadOnly) return;
    
    // Optimistic update
    setVehicles(prev => prev.filter(v => v.id !== id));
    
    try {
      await api.deleteVehicle(id);
    } catch (error) {
      console.error('Failed to delete vehicle:', error);
      loadData();
    }
  };

  const handleColorLabelUpdate = (color: string, label: string) => {
    if (isReadOnly) return;
    setColorLabels(prev => ({ ...prev, [color]: label }));
  };

  // --- Depot Handlers ---
  const handleDepotDelete = async (id: string) => {
    if (isReadOnly) return;
    
    // Optimistic update
    setDepots(prev => prev.filter(d => d.id !== id));
    
    // If deleting the selected depot, select another one
    if (selectedDepotId === id) {
      const remaining = depots.filter(d => d.id !== id);
      if (remaining.length > 0) {
        setSelectedDepotId(remaining[0].id);
      }
    }
    
    try {
      await api.deleteDepot(id);
    } catch (error) {
      console.error('Failed to delete depot:', error);
      loadData();
    }
  };

  const handleDepotCreate = async () => {
    if (isReadOnly) return;
    
    try {
      const newDepot = await api.createDepot({
        name: "New Depot",
        address: "Enter Address"
      });
      setDepots(prev => [...prev, {
        id: newDepot.id,
        name: newDepot.name,
        address: newDepot.address,
        employees: 0,
        vehicles: 0
      }]);
      setSelectedDepotId(newDepot.id);
    } catch (error) {
      console.error('Failed to create depot:', error);
    }
  };

  const handleDepotUpdate = async (id: string, updates: { name?: string; address?: string }) => {
    if (isReadOnly) return;
    
    // Optimistic update
    setDepots(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    
    try {
      await api.updateDepot(id, updates);
    } catch (error) {
      console.error('Failed to update depot:', error);
      loadData();
    }
  };

  // --- Vehicle Type Handlers ---
  const handleVehicleTypeCreate = (type: string) => {
    if (isReadOnly || !type.trim() || vehicleTypes.includes(type)) return;
    setVehicleTypes(prev => [...prev, type]);
  };

  const handleVehicleTypeDelete = (type: string) => {
    if (isReadOnly) return;
    setVehicleTypes(prev => prev.filter(t => t !== type));
  };

  const filteredItems = items.filter(i => i.depotId === selectedDepotId);
  
  // Calculate actual employee/vehicle counts
  // Note: Currently employees/vehicles are not strictly bound to depots in the model, 
  // but we can simulate this or just count total available for now as per requirement to "show correct number".
  // If we want strict per-depot counts, we'd need to add depotId to Employee/Vehicle types.
  // For now, let's assume all resources belong to the selected depot or distribute them.
  // Actually, the user asked for "correct number in the depot".
  // Let's update the depots state with these counts dynamically if possible, or just pass them down.
  // The Sidebar takes `depots` which has `employees` and `vehicles` counts. 
  // Let's update the `depots` state to reflect the mock counts or real counts if we had them.
  // Since we don't have depotId on employees yet, I will assume they are global for this prototype 
  // OR I will update the mock data to include depotId.
  
  // Let's just update the counts to match the total list length for the selected depot for now, 
  // or keep the mock numbers if they are just placeholders.
  // User said: "show the correct number of staff and vehicles in the depot".
  // This implies they expect the numbers to change when they add/remove people.
  // I will map the depots to update their counts based on the resources.
  // Since resources don't have depotId, I'll assume they belong to the currently selected depot for the sake of the UI update.
  // Or better, I'll just update the selected depot's count in the `depots` array whenever employees/vehicles change.
  
  useEffect(() => {
      setDepots(prev => prev.map(d => {
          // Update counts for all depots, not just selected
          const empCount = employees.filter(e => (e.depotId || 'd1') === d.id).length;
          const vehCount = vehicles.filter(v => (v.depotId || 'd1') === d.id).length;
          
          return {
              ...d,
              employees: empCount,
              vehicles: vehCount
          };
      }));
  }, [employees, vehicles]); // Recalculate when full lists change

  // Count archived crews that have items (for toggle button visibility)
  const archivedCrewsWithItems = allDepotCrews.filter(c => c.archivedAt && items.some(i => i.crewId === c.id)).length;
  const hasArchivedCrews = archivedCrewsWithItems > 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 min-w-0 relative">
      {/* Top Bar Sign Out */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
        {hasArchivedCrews && (
          <Button 
            variant="outline" 
            size="sm" 
            className={`h-8 text-xs ${showArchivedCrews ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white'}`}
            onClick={() => setShowArchivedCrews(!showArchivedCrews)}
            title={showArchivedCrews ? "Hide archived crews" : "Show archived crews with historical data"}
          >
            {showArchivedCrews ? <EyeOff className="w-3 h-3 mr-2" /> : <Eye className="w-3 h-3 mr-2" />}
            {showArchivedCrews ? 'Hide Archived' : `Show Archived (${archivedCrewsWithItems})`}
          </Button>
        )}
        <Button variant="outline" size="sm" className="bg-white h-8 text-xs" onClick={() => setLocation("/")}>
            <LogOut className="w-3 h-3 mr-2" /> Sign Out
        </Button>
      </div>

      <Sidebar 
        depots={depots} 
        selectedDepotId={selectedDepotId} 
        onSelectDepot={setSelectedDepotId}
        onEditDepot={() => setDepotCrewModalOpen(true)}
        onDeleteDepot={handleDepotDelete}
        onUpdateDepot={handleDepotUpdate}
        onAddDepot={handleDepotCreate}
        isReadOnly={isReadOnly}
        onOpenSettings={() => setSettingsModalOpen(true)}
        canAccessSettings={currentUser.membershipRole === 'admin' || currentUser.membershipRole === 'operations'}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <CalendarGrid 
          items={filteredItems} 
          crews={filteredCrews}
          allItems={items}
          allCrews={crews}
          employees={filteredEmployees} 
          vehicles={filteredVehicles}
          colorLabels={colorLabels}
          isReadOnly={isReadOnly}
          onItemCreate={handleItemCreate}
          onItemUpdate={handleItemUpdate}
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
          depots={depots}
          vehicleTypes={vehicleTypes}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
        />
      </div>

      {/* Depot Management Modal - Crews, Employees, Vehicles */}
      <DepotCrewModal
        open={depotCrewModalOpen}
        onOpenChange={setDepotCrewModalOpen}
        depotName={selectedDepot?.name || ""}
        crews={activeCrews}
        employees={filteredEmployees}
        vehicles={filteredVehicles}
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
        onVehicleTypeCreate={handleVehicleTypeCreate}
        onVehicleTypeDelete={handleVehicleTypeDelete}
        isReadOnly={isReadOnly}
      />

      {/* Settings Modal - Team Management */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team & Settings
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="team" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Team
              </TabsTrigger>
              <TabsTrigger value="usage" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Usage
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Billing
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="team" className="mt-4">
              <TeamManagement 
                currentUserRole={currentUser.membershipRole} 
                currentUserId={currentUser.id} 
              />
            </TabsContent>
            
            <TabsContent value="usage" className="mt-4">
              <div className="space-y-4">
                <h3 className="font-medium text-slate-700">Resource Usage</h3>
                <p className="text-sm text-slate-500">
                  View your current plan limits and usage here. Upgrade to Pro for more resources.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-slate-500">Depots</div>
                    <div className="text-2xl font-bold">{depots.length}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-slate-500">Crews</div>
                    <div className="text-2xl font-bold">{crews.length}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-slate-500">Employees</div>
                    <div className="text-2xl font-bold">{employees.length}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-slate-500">Vehicles</div>
                    <div className="text-2xl font-bold">{vehicles.length}</div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="billing" className="mt-4">
              <div className="space-y-4">
                <h3 className="font-medium text-slate-700">Subscription & Billing</h3>
                <p className="text-sm text-slate-500">
                  Manage your subscription, view invoices, and update payment methods.
                </p>
                <Button 
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/stripe/portal', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' }
                      });
                      if (res.ok) {
                        const data = await res.json();
                        if (data.url) {
                          window.location.href = data.url;
                        }
                      } else {
                        console.error('Failed to get billing portal URL');
                      }
                    } catch (err) {
                      console.error('Error opening billing portal:', err);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Open Billing Portal
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
