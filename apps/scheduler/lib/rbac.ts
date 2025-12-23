import type { MemberRole, PlanType } from "@shared/schema";
import { PLAN_LIMITS } from "@shared/schema";
import type { IStorage } from "./storage";

export type { MemberRole };

export interface OrganizationContext {
  organizationId: string;
  membershipId: string;
  role: MemberRole;
  plan: PlanType;
  subscriptionStatus: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
}

/**
 * Loads organization context for a user.
 * Returns the primary membership (owner's org first, then first membership).
 */
export async function loadOrganizationContext(
  userId: string,
  storage: IStorage
): Promise<OrganizationContext> {
  const primaryMembership = await storage.getPrimaryMembership(userId);
  if (!primaryMembership) {
    throw new Error("No organization membership found");
  }

  return {
    organizationId: primaryMembership.organization.id,
    membershipId: primaryMembership.id,
    role: primaryMembership.role as MemberRole,
    plan: primaryMembership.organization.plan as PlanType,
    subscriptionStatus: primaryMembership.organization.subscriptionStatus || "trialing",
  };
}

/**
 * Checks if the user's role is in the allowed roles list.
 */
export function requireRole(
  role: MemberRole,
  ...allowedRoles: MemberRole[]
): void {
  if (!allowedRoles.includes(role)) {
    throw new Error(
      `Access denied. This action requires one of these roles: ${allowedRoles.join(", ")}`
    );
  }
}

/**
 * Checks if the user has admin role.
 */
export function requireAdmin(role: MemberRole): void {
  requireRole(role, "admin");
}

/**
 * Checks if the user has operations or admin role.
 */
export function requireOperationsOrAdmin(role: MemberRole): void {
  requireRole(role, "admin", "operations");
}

/**
 * Checks if the organization has an active subscription.
 */
export function requireActiveSubscription(subscriptionStatus: string): void {
  const validStatuses = ["active", "trialing"];
  if (!validStatuses.includes(subscriptionStatus)) {
    throw new Error("Your subscription is not active. Please update your payment method.");
  }
}

/**
 * Checks if the organization can create a new depot based on quota limits.
 */
export async function checkDepotQuota(
  organizationId: string,
  plan: PlanType,
  storage: IStorage
): Promise<QuotaCheckResult> {
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

/**
 * Checks if the organization can create a new crew based on quota limits.
 */
export async function checkCrewQuota(
  organizationId: string,
  plan: PlanType,
  storage: IStorage
): Promise<QuotaCheckResult> {
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

/**
 * Checks if the organization can create a new employee based on quota limits.
 */
export async function checkEmployeeQuota(
  organizationId: string,
  plan: PlanType,
  storage: IStorage
): Promise<QuotaCheckResult> {
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

/**
 * Checks if the organization can create a new vehicle based on quota limits.
 */
export async function checkVehicleQuota(
  organizationId: string,
  plan: PlanType,
  storage: IStorage
): Promise<QuotaCheckResult> {
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

/**
 * Checks if a role can manage resources (depots, crews, employees, vehicles).
 */
export function canManageResources(role: MemberRole): boolean {
  return role === "admin" || role === "operations";
}

/**
 * Checks if a role can approve bookings.
 */
export function canApproveBookings(role: MemberRole): boolean {
  return role === "admin" || role === "operations";
}

/**
 * Checks if a role can manage team (members, invites).
 */
export function canManageTeam(role: MemberRole): boolean {
  return role === "admin";
}

/**
 * Checks if a role can modify schedule based on plan.
 */
export function canModifySchedule(role: MemberRole, plan: PlanType): boolean {
  if (plan === "starter") {
    return role === "admin" || role === "operations";
  }
  return true;
}

/**
 * Checks if a booking requires approval based on role and plan.
 */
export function bookingRequiresApproval(role: MemberRole, plan: PlanType): boolean {
  if (plan === "starter") {
    return false;
  }
  return role === "user";
}

