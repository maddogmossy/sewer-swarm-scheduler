// API Client for crew scheduling backend

export interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
}

export interface Depot {
  id: string;
  name: string;
  address: string;
  userId: string;
}

export interface Crew {
  id: string;
  name: string;
  depotId: string;
  shift: string;
  userId: string;
  archivedAt?: string | null;
}

export interface Employee {
  id: string;
  name: string;
  status: string;
  jobRole: string;
  email?: string;
  depotId: string;
  userId: string;
}

export interface Vehicle {
  id: string;
  name: string;
  status: string;
  vehicleType: string;
  depotId: string;
  userId: string;
}

export interface ScheduleItem {
  id: string;
  type: string;
  date: Date | string;
  crewId: string;
  depotId: string;
  userId: string;
  customer?: string;
  jobNumber?: string;
  address?: string;
  projectManager?: string;
  startTime?: string;
  onsiteTime?: string;
  color?: string;
  duration?: number;
  employeeId?: string;
  vehicleId?: string;
  noteContent?: string;
}

class API {
  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(username: string, password: string): Promise<User> {
    return this.request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  async register(username: string, password: string, email?: string): Promise<User> {
    return this.request("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, password, email, role: "user" }),
    });
  }

  async logout(): Promise<void> {
    await this.request("/api/logout", { method: "POST" });
  }

  async getMe(): Promise<User> {
    return this.request("/api/me");
  }

  // Depots
  async getDepots(): Promise<Depot[]> {
    return this.request("/api/depots");
  }

  async createDepot(depot: Omit<Depot, "id" | "userId">): Promise<Depot> {
    return this.request("/api/depots", {
      method: "POST",
      body: JSON.stringify(depot),
    });
  }

  async updateDepot(id: string, depot: Partial<Depot>): Promise<Depot> {
    return this.request(`/api/depots/${id}`, {
      method: "PATCH",
      body: JSON.stringify(depot),
    });
  }

  async deleteDepot(id: string): Promise<void> {
    await this.request(`/api/depots/${id}`, { method: "DELETE" });
  }

  // Crews
  async getCrews(includeArchived: boolean = false): Promise<Crew[]> {
    const url = includeArchived ? "/api/crews?includeArchived=true" : "/api/crews";
    return this.request(url);
  }

  async createCrew(crew: Omit<Crew, "id" | "userId">): Promise<Crew> {
    return this.request("/api/crews", {
      method: "POST",
      body: JSON.stringify(crew),
    });
  }

  async updateCrew(id: string, crew: Partial<Crew>): Promise<Crew> {
    return this.request(`/api/crews/${id}`, {
      method: "PATCH",
      body: JSON.stringify(crew),
    });
  }

  async archiveCrew(id: string): Promise<void> {
    await this.request(`/api/crews/${id}`, { method: "DELETE" });
  }

  async restoreCrew(id: string): Promise<Crew> {
    return this.request(`/api/crews/${id}/restore`, { method: "POST" });
  }

  // Employees
  async getEmployees(): Promise<Employee[]> {
    return this.request("/api/employees");
  }

  async createEmployee(employee: Omit<Employee, "id" | "userId">): Promise<Employee> {
    return this.request("/api/employees", {
      method: "POST",
      body: JSON.stringify(employee),
    });
  }

  async updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee> {
    return this.request(`/api/employees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(employee),
    });
  }

  async deleteEmployee(id: string): Promise<void> {
    await this.request(`/api/employees/${id}`, { method: "DELETE" });
  }

  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    return this.request("/api/vehicles");
  }

  async createVehicle(vehicle: Omit<Vehicle, "id" | "userId">): Promise<Vehicle> {
    return this.request("/api/vehicles", {
      method: "POST",
      body: JSON.stringify(vehicle),
    });
  }

  async updateVehicle(id: string, vehicle: Partial<Vehicle>): Promise<Vehicle> {
    return this.request(`/api/vehicles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(vehicle),
    });
  }

  async deleteVehicle(id: string): Promise<void> {
    await this.request(`/api/vehicles/${id}`, { method: "DELETE" });
  }

  // Schedule Items
  async getScheduleItems(): Promise<ScheduleItem[]> {
    return this.request("/api/schedule-items");
  }

  async createScheduleItem(item: Omit<ScheduleItem, "id" | "userId">): Promise<ScheduleItem> {
    return this.request("/api/schedule-items", {
      method: "POST",
      body: JSON.stringify(item),
    });
  }

  async updateScheduleItem(id: string, item: Partial<ScheduleItem>): Promise<ScheduleItem> {
    return this.request(`/api/schedule-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(item),
    });
  }

  async deleteScheduleItem(id: string): Promise<void> {
    await this.request(`/api/schedule-items/${id}`, { method: "DELETE" });
  }

  // Color Labels
  async getColorLabels(): Promise<Record<string, string>> {
    return this.request("/api/color-labels");
  }

  async saveColorLabel(color: string, label: string): Promise<void> {
    await this.request("/api/color-labels", {
      method: "POST",
      body: JSON.stringify({ color, label }),
    });
  }
}

export const api = new API();
