import { storage } from "./storage";

export type PlanType = "starter" | "pro";

export interface PlanLimits {
  maxDepots: number;
  maxCrews: number;
  maxEmployees: number;
  maxVehicles: number;
  requiresApproval: boolean;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  starter: {
    maxDepots: 1,
    maxCrews: 3,
    maxEmployees: 25,
    maxVehicles: 10,
    requiresApproval: false,
  },
  pro: {
    maxDepots: 999,
    maxCrews: 30,
    maxEmployees: 250,
    maxVehicles: 100,
    requiresApproval: true,
  },
};

export interface QuotaUsage {
  depots: { used: number; limit: number; remaining: number };
  crews: { used: number; limit: number; remaining: number };
  employees: { used: number; limit: number; remaining: number };
  vehicles: { used: number; limit: number; remaining: number };
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
}

export async function getOrganizationQuotaUsage(organizationId: string, plan: PlanType): Promise<QuotaUsage> {
  const limits = PLAN_LIMITS[plan];
  
  const [depots, crews, employees, vehicles] = await Promise.all([
    storage.getDepotsByOrg(organizationId),
    storage.getCrewsByOrg(organizationId),
    storage.getEmployeesByOrg(organizationId),
    storage.getVehiclesByOrg(organizationId),
  ]);
  
  return {
    depots: {
      used: depots.length,
      limit: limits.maxDepots,
      remaining: Math.max(0, limits.maxDepots - depots.length),
    },
    crews: {
      used: crews.length,
      limit: limits.maxCrews,
      remaining: Math.max(0, limits.maxCrews - crews.length),
    },
    employees: {
      used: employees.length,
      limit: limits.maxEmployees,
      remaining: Math.max(0, limits.maxEmployees - employees.length),
    },
    vehicles: {
      used: vehicles.length,
      limit: limits.maxVehicles,
      remaining: Math.max(0, limits.maxVehicles - vehicles.length),
    },
  };
}

export async function canCreateDepot(organizationId: string, plan: PlanType): Promise<QuotaCheckResult> {
  const limits = PLAN_LIMITS[plan];
  const depots = await storage.getDepotsByOrg(organizationId);
  
  if (depots.length >= limits.maxDepots) {
    return {
      allowed: false,
      reason: `You have reached the maximum number of depots (${limits.maxDepots}) for your ${plan === "starter" ? "Starter" : "Pro"} plan.${plan === "starter" ? " Upgrade to Pro for more depots." : ""}`,
      currentUsage: depots.length,
      limit: limits.maxDepots,
    };
  }
  
  return { allowed: true };
}

export async function canCreateCrew(organizationId: string, plan: PlanType): Promise<QuotaCheckResult> {
  const limits = PLAN_LIMITS[plan];
  const crews = await storage.getCrewsByOrg(organizationId);
  
  if (crews.length >= limits.maxCrews) {
    return {
      allowed: false,
      reason: `You have reached the maximum number of crews (${limits.maxCrews}) for your ${plan === "starter" ? "Starter" : "Pro"} plan.${plan === "starter" ? " Upgrade to Pro for more crews." : ""}`,
      currentUsage: crews.length,
      limit: limits.maxCrews,
    };
  }
  
  return { allowed: true };
}

export async function canCreateEmployee(organizationId: string, plan: PlanType): Promise<QuotaCheckResult> {
  const limits = PLAN_LIMITS[plan];
  const employees = await storage.getEmployeesByOrg(organizationId);
  
  if (employees.length >= limits.maxEmployees) {
    return {
      allowed: false,
      reason: `You have reached the maximum number of employees (${limits.maxEmployees}) for your ${plan === "starter" ? "Starter" : "Pro"} plan.${plan === "starter" ? " Upgrade to Pro for more employees." : ""}`,
      currentUsage: employees.length,
      limit: limits.maxEmployees,
    };
  }
  
  return { allowed: true };
}

export async function canCreateVehicle(organizationId: string, plan: PlanType): Promise<QuotaCheckResult> {
  const limits = PLAN_LIMITS[plan];
  const vehicles = await storage.getVehiclesByOrg(organizationId);
  
  if (vehicles.length >= limits.maxVehicles) {
    return {
      allowed: false,
      reason: `You have reached the maximum number of vehicles (${limits.maxVehicles}) for your ${plan === "starter" ? "Starter" : "Pro"} plan.${plan === "starter" ? " Upgrade to Pro for more vehicles." : ""}`,
      currentUsage: vehicles.length,
      limit: limits.maxVehicles,
    };
  }
  
  return { allowed: true };
}

export function planRequiresApproval(plan: PlanType): boolean {
  return PLAN_LIMITS[plan].requiresApproval;
}
