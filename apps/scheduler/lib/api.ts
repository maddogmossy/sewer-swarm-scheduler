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
  homePostcode?: string;
  startsFromHome?: boolean;
  depotId: string;
  userId: string;
}

export interface Vehicle {
  id: string;
  name: string;
  status: string;
  vehicleType: string;
  category?: string;
  color?: string;
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
  status?: 'approved' | 'pending' | 'rejected';
  jobStatus?: 'free' | 'booked' | 'cancelled';
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
    // Log request details in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔵 API Request:', {
        method: options?.method || 'GET',
        url,
        hasBody: !!options?.body,
        bodyPreview: options?.body ? (typeof options.body === 'string' ? options.body.substring(0, 200) : 'Non-string body') : undefined,
      });
    }
    
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        credentials: "include", // Required for cookies to work
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
    } catch (err: any) {
      throw err;
    }

    if (!response.ok) {
      let errorText = '';
      let errorJson: any = {};
      
      try {
        errorText = await response.text();
        if (errorText) {
          try {
            errorJson = JSON.parse(errorText);
          } catch (parseError) {
            // If JSON parsing fails, use the text as error
            errorJson = { error: errorText };
          }
        } else {
          errorJson = { error: "Request failed" };
        }
      } catch (e) {
        // If reading response fails, use generic error
        errorJson = { error: "Request failed" };
      }
      
      // Safely extract error message - ONLY extract primitive string values, avoid any object methods
      let errorMessage: string = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        // Only extract if errorJson has simple string properties - avoid any complex objects
        if (errorJson && typeof errorJson === 'object' && errorJson !== null) {
          // Only look for simple string properties, don't call any methods
          if (typeof errorJson.error === 'string') {
            errorMessage = errorJson.error;
          } else if (typeof errorJson.details === 'string') {
            errorMessage = errorJson.details;
          } else if (typeof errorJson.message === 'string') {
            errorMessage = errorJson.message;
          }
          // If none of the above are strings, keep the default errorMessage
        } else if (typeof errorJson === 'string') {
          errorMessage = errorJson;
        }
      } catch (e) {
        // If anything fails, use default - never try to serialize objects
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      // Create final error message - use template literal to avoid calling any methods
      let finalErrorMessage: string = `HTTP ${response.status}: ${response.statusText}`;
      
      // Only use errorMessage if it's definitely a string primitive
      if (typeof errorMessage === 'string' && errorMessage !== '') {
        finalErrorMessage = errorMessage;
      }
      
      // Log error info with better formatting
      const logUrl = typeof url === 'string' ? url : `${url}`;
      const logStatus = typeof response.status === 'number' ? response.status : Number(response.status);
      const logStatusText = typeof response.statusText === 'string' ? response.statusText : `${response.statusText}`;
      
      // Log error in a structured way that's easy to read
      console.group('❌ API Request Failed');
      console.error('URL:', logUrl);
      console.error('Method:', options?.method || 'GET');
      console.error('Status:', logStatus, logStatusText);
      console.error('Error Message:', finalErrorMessage);
      
      if (errorText && typeof errorText === 'string' && errorText.length > 0) {
        console.error('Response Text:', errorText.substring(0, 1000));
      }
      
      if (errorJson && typeof errorJson === 'object') {
        try {
          console.error('Response JSON:', JSON.stringify(errorJson, null, 2));
        } catch (e) {
          console.error('Response JSON (parse failed):', errorJson);
        }
      }
      
      // Log request body if available (for debugging)
      if (options?.body && process.env.NODE_ENV === 'development') {
        try {
          const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
          console.error('Request Body:', bodyStr.substring(0, 500));
        } catch (e) {
          console.error('Request Body: (could not serialize)');
        }
      }
      
      console.groupEnd();
      
      // Throw error with guaranteed string message - use template literal to ensure it's a string
      throw new Error(finalErrorMessage);
    }

    // Log successful requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ API Request Success:', {
        method: options?.method || 'GET',
        url,
        status: response.status,
      });
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

  async register(username: string, password: string, email?: string, company?: string, plan?: string): Promise<User> {
    return this.request("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, password, email, role: "user", company, plan }),
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
    // Helper to convert Date objects to ISO strings - ONLY call toISOString on actual Date instances
    const sanitizeDates = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      
      // ONLY call toISOString on actual Date instances - never on other objects
      if (obj instanceof Date) {
        if (isNaN(obj.getTime())) {
          console.error('Invalid Date object:', obj);
          return null;
        }
        return obj.toISOString();
      }
      
      // DO NOT call toISOString on non-Date objects - this causes "toISOString is not a function" errors
      // If an object has toISOString but isn't a Date, treat it as a regular object
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeDates);
      }
      
      if (typeof obj === 'object' && obj !== null) {
        const sanitized: any = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            try {
              sanitized[key] = sanitizeDates(obj[key]);
            } catch (error) {
              console.error(`Error sanitizing key ${key}:`, error, obj[key]);
              // Skip invalid values or convert to string
              try {
                sanitized[key] = JSON.stringify(obj[key]);
              } catch {
                sanitized[key] = String(obj[key]);
              }
            }
          }
        }
        return sanitized;
      }
      
      return obj;
    };

    try {
      const sanitized = sanitizeDates(item);
      return this.request("/api/schedule-items", {
        method: "POST",
        body: JSON.stringify(sanitized),
      });
    } catch (error) {
      console.error('Error in createScheduleItem:', error, item);
      throw error;
    }
  }

  async updateScheduleItem(id: string, item: Partial<ScheduleItem>): Promise<ScheduleItem> {
    // Helper to convert Date objects to ISO strings - ONLY call toISOString on actual Date instances
    const sanitizeDates = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      
      // ONLY call toISOString on actual Date instances - never on other objects
      if (obj instanceof Date) {
        if (isNaN(obj.getTime())) {
          console.error('Invalid Date object:', obj);
          return null;
        }
        return obj.toISOString();
      }
      
      // DO NOT call toISOString on non-Date objects - this causes "toISOString is not a function" errors
      // If an object has toISOString but isn't a Date, treat it as a regular object
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeDates);
      }
      
      if (typeof obj === 'object' && obj !== null) {
        const sanitized: any = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            try {
              sanitized[key] = sanitizeDates(obj[key]);
            } catch (error) {
              console.error(`Error sanitizing key ${key}:`, error, obj[key]);
              // Skip invalid values or convert to string
              try {
                sanitized[key] = JSON.stringify(obj[key]);
              } catch {
                sanitized[key] = String(obj[key]);
              }
            }
          }
        }
        return sanitized;
      }
      
      return obj;
    };

    try {
      const sanitized = sanitizeDates(item);
      return this.request(`/api/schedule-items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(sanitized),
      });
    } catch (error) {
      console.error('Error in updateScheduleItem:', error, item);
      throw error;
    }
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
