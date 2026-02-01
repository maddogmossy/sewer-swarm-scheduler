import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Clock, ArrowRight, CheckCircle2, Truck } from "lucide-react";
import { format, addDays, startOfToday, isSameDay, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { ScheduleItem, Crew } from "./CalendarGrid";

interface SmartSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ScheduleItem[];
  crews: Crew[];
  depots: { id: string; name: string; address: string }[];
  vehicles: { id: string; name: string; vehicleType: string }[];
  vehicleTypes?: string[];
  colorLabels: Record<string, string>;
  onBookSlot: (date: Date, crewId: string, depotId: string, duration: number, color: string) => void;
}

export function SmartSearchModal({ 
  open, onOpenChange, items, crews, depots, vehicles, vehicleTypes, colorLabels, onBookSlot 
}: SmartSearchModalProps) {
  const [vehicleType, setVehicleType] = useState("any");
  const [shiftType, setShiftType] = useState<'any' | 'day' | 'night'>("any");
  const [duration, setDuration] = useState("8");
  const [location, setLocation] = useState("all");
  const [jobPostcode, setJobPostcode] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Extract unique vehicle types or use provided types
  const availableVehicleTypes = useMemo(() => {
      if (vehicleTypes && vehicleTypes.length > 0) return vehicleTypes;
      const types = new Set(vehicles.map(v => v.vehicleType).filter(Boolean));
      return Array.from(types).sort();
  }, [vehicles, vehicleTypes]);

  const handleSearch = () => {
    setIsSearching(true);
    setResults(null);

    // Simulate API delay
    setTimeout(() => {
      const reqDuration = parseInt(duration) || 8;
      const today = startOfToday();
      const searchResults: any[] = [];

      // Iterate through next 60 days (increased from 30 to catch next month)
      // Start from start of week if user expects to see current week's past days? 
      // No, "Availability Search" usually implies future booking. 
      // But we'll ensure we check 'today' properly.
      for (let i = 0; i < 60; i++) {
        const date = addDays(today, i);
        
        // Iterate through all depots
        depots.forEach(depot => {
          // Location Filter Check
          // IMPORTANT: If location is empty string or "all", we search ALL depots.
          if (location !== "all" && depot.id !== location) {
              return;
          }
          
          // Mock Distance Calculation (if postcode provided)
          // In a real app, this would use a mapping service
          let distance = 0;
          if (jobPostcode.trim()) {
             // Generate a deterministic "mock" distance based on depot ID and postcode length
             // so it doesn't change on every search for the same inputs
             const hash = (depot.id.charCodeAt(0) + jobPostcode.length) % 50;
             distance = hash + 5; // 5 to 55 miles
          }

          crews.forEach(crew => {
             // STRICT CHECK: Crew must belong to this depot
             // If crew has no depotId, we assume it belongs to 'd1' (legacy default)
             const crewDepotId = crew.depotId || 'd1';
             if (crewDepotId !== depot.id) return;

             // Check Shift
             if (shiftType !== 'any' && crew.shift !== shiftType) return;

             // 1. Check what vehicle this crew has on this specific day
             // Find operative items for this crew/date to see assigned vehicle
             const operativeItem = items.find(item => 
                item.type === 'operative' && 
                item.crewId === crew.id && 
                isSameDay(new Date(item.date), date) &&
                item.vehicleId // Must have a vehicle
             );

             let hasCorrectVehicle = false;
             let isPotential = false;
             
             // STRICTER SEARCH:
             // If the crew has NO operative assigned for this day, we treat it as "Unavailable/Not Working".
             // This prevents "Ghost/Empty Crews" from showing up as available slots, which confuses users
             // who have deleted their staff but kept the crew names.
             if (!operativeItem) {
                 return;
             }
             
             if (vehicleType === 'any') {
                 hasCorrectVehicle = true;
             } else if (operativeItem && operativeItem.vehicleId) {
                 // Crew has an operative with a vehicle. Does it match?
                 const vehicle = vehicles.find(v => v.id === operativeItem.vehicleId);
                 if (vehicle && vehicle.vehicleType === vehicleType) {
                     hasCorrectVehicle = true;
                 }
             }

             // If we are searching for a specific vehicle type, and the crew does NOT have it assigned today,
             // then we filter it out.
             if (vehicleType !== 'any' && !hasCorrectVehicle) {
                 return; 
             }

             // 2. Check availability / free time
             // Normalize query date to start of day for robust comparison
             const queryDateStart = startOfDay(date);
             
             const dayItems = items.filter(item => 
                item.type === 'job' && 
                item.crewId === crew.id && 
                isSameDay(startOfDay(new Date(item.date)), queryDateStart)
             );
             
             // Check if working at this depot (if they have jobs)
             const workingDepotId = dayItems.length > 0 ? dayItems[0].depotId : null;
             // If they have jobs at a different depot, they are not available at this depot
             // UNLESS the job is at the requested depot?
             // The logic here says: if they are working at Depot B, they can't take a job at Depot A.
             if (workingDepotId && workingDepotId !== depot.id) {
                 return; // Working elsewhere
             }

             // Calculate used time (excluding free slots)
             const realWorkItems = dayItems.filter(i => i.customer !== 'FREE_SLOT');
             const realUsedDuration = realWorkItems.reduce((acc, item) => acc + (Number(item.duration) || 0), 0);
             
             const freeSpace = 8 - realUsedDuration;

             if (freeSpace >= reqDuration) {
               // Match!
               
               // Determine displayed vehicle type
               let displayVehicle = vehicleType === 'any' ? "Unassigned" : vehicleType;
               
               if (operativeItem && operativeItem.vehicleId) {
                   const v = vehicles.find(x => x.id === operativeItem.vehicleId);
                   if (v) displayVehicle = v.vehicleType;
               } else if (isPotential) {
                   displayVehicle = `${vehicleType} (Unassigned)`;
               }

               searchResults.push({
                 date,
                 depot,
                 crew,
                 freeSpace,
                 vehicleType: displayVehicle,
                 isPotential,
                 distance // Add distance to result
               });
             }
          });
        });
      }

      // Deduplicate results
      const uniqueKeys = new Set();
      const uniqueResults = searchResults.filter(res => {
          const key = `${res.date.toISOString()}-${res.crew.id}-${res.depot.id}`;
          if (uniqueKeys.has(key)) return false;
          uniqueKeys.add(key);
          return true;
      });

      // Sort results
      uniqueResults.sort((a, b) => {
          // 1. Sort by Distance (if provided) - Nearest first
          if (jobPostcode.trim()) {
              if (a.distance !== b.distance) return a.distance - b.distance;
          }
          
          // 2. Sort by Date
          if (a.date.getTime() !== b.date.getTime()) return a.date.getTime() - b.date.getTime();
          
          // 3. Sort by Free Space (Most available first)
          return b.freeSpace - a.freeSpace;
      });

      setResults(uniqueResults.slice(0, 100));
      setIsSearching(false);
    }, 800);
  };

  const handleBook = (res: any) => {
      onBookSlot(res.date, res.crew.id, res.depot.id, parseInt(duration), "blue");
      onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-white text-slate-900 max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Search className="w-6 h-6 text-blue-600" />
            Availability Search
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
            {/* Search Form */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 shrink-0">
                <div className="space-y-2">
                    <Label>Vehicle / Resource Type</Label>
                    <Select value={vehicleType} onValueChange={setVehicleType}>
                        <SelectTrigger className="bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                           <SelectItem value="any">Any Vehicle</SelectItem>
                           {availableVehicleTypes.map((type) => (
                               <SelectItem key={type} value={type}>
                                   <div className="flex items-center gap-2">
                                       <Truck className="w-4 h-4 text-slate-500" />
                                       {type}
                                   </div>
                               </SelectItem>
                           ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Shift</Label>
                    <Select value={shiftType} onValueChange={(v) => setShiftType(v as any)}>
                        <SelectTrigger className="bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                           <SelectItem value="any">Any Shift</SelectItem>
                           <SelectItem value="day">Day Shift</SelectItem>
                           <SelectItem value="night">Night Shift</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Job Postcode / Address</Label>
                    <div className="relative">
                        <Input 
                            value={jobPostcode} 
                            onChange={(e) => setJobPostcode(e.target.value)}
                            className="pl-9 bg-white"
                            placeholder="e.g. SW1A 1AA"
                        />
                        <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Duration Required</Label>
                    <div className="relative">
                        <Input 
                            type="number" 
                            value={duration} 
                            onChange={(e) => setDuration(e.target.value)}
                            className="pl-9 bg-white"
                            min="1" max="8"
                        />
                        <Clock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-500">hrs</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Location</Label>
                    <Select value={location} onValueChange={setLocation}>
                        <SelectTrigger className="bg-white">
                            <SelectValue placeholder="All Depots" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                           <SelectItem value="all">All Depots</SelectItem>
                           {depots.map((depot) => (
                               <SelectItem key={depot.id} value={depot.id}>
                                   <div className="flex items-center gap-2">
                                       <MapPin className="w-4 h-4 text-slate-500" />
                                       {depot.name}
                                   </div>
                               </SelectItem>
                           ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="col-span-1 sm:col-span-3">
                    <Button 
                        onClick={handleSearch} 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10"
                        disabled={isSearching}
                    >
                        {isSearching ? "Searching Network..." : "Find Earliest Availability"}
                    </Button>
                </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto min-h-[300px] rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                {!results && !isSearching && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                        <Search className="w-12 h-12 mb-3 opacity-20" />
                        <p>Search for earliest availability by vehicle type</p>
                    </div>
                )}

                {isSearching && (
                    <div className="h-full flex flex-col items-center justify-center text-blue-600 p-8">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-3"></div>
                        <p className="font-medium">Checking schedule across {depots.length} depots...</p>
                    </div>
                )}

                {results && results.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8">
                        <p>No slots found matching your criteria.</p>
                        <Button variant="link" onClick={() => setDuration("4")}>Try shorter duration?</Button>
                    </div>
                )}


                {results && results.length > 0 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2 pb-2">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Earliest Available Slots</h3>
                            <span className="text-xs text-slate-400">{results.length} options found</span>
                        </div>
                        
                        {/* Group by Date */}
                        {Array.from(new Set(results.map(r => r.date.toISOString()))).map((dateStr) => {
                            const dateResults = results.filter(r => r.date.toISOString() === dateStr);
                            const date = new Date(dateStr);
                            
                            return (
                                <div key={dateStr} className="space-y-2">
                                    <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur px-2 py-2 border-b border-slate-200 flex items-center gap-2">
                                        <span className="font-bold text-slate-900">{format(date, 'EEEE, d MMMM')}</span>
                                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{dateResults.length} slots</span>
                                    </div>

                                    <div className="grid gap-2">
                                        {dateResults.map((res, idx) => (
                                            <div key={`${dateStr}-${idx}`} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 transition-all group">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-blue-50 rounded-lg flex flex-col items-center justify-center border border-blue-100 text-blue-700 shrink-0">
                                                            <Clock className="w-5 h-5 mb-1" />
                                                            <span className="text-[10px] font-bold leading-none">{res.freeSpace}h</span>
                                                        </div>
                                                        
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-semibold text-slate-900">{res.depot.name}</h4>
                                                                {res.distance > 0 && (
                                                                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100 font-medium">
                                                                        {res.distance} miles away
                                                                    </span>
                                                                )}
                                                                <span className={cn(
                                                                    "text-xs px-2 py-0.5 rounded-full font-medium flex items-center border",
                                                                    res.isPotential 
                                                                        ? "bg-amber-50 text-amber-700 border-amber-200 border-dashed" 
                                                                        : "bg-slate-100 text-slate-600 border-slate-200"
                                                                )}>
                                                                    <Truck className="w-3 h-3 mr-1" /> {res.vehicleType}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                                                                <span className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> {res.crew.name}</span>
                                                                {res.isPotential && <span className="text-amber-600 font-medium">Needs Vehicle Assignment</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <Button 
                                                        onClick={() => handleBook(res)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 hover:bg-blue-700 text-white"
                                                        size="sm"
                                                    >
                                                        Book <ArrowRight className="w-4 h-4 ml-2" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
