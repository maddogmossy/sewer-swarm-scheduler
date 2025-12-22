import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { canCreateDepot, canCreateCrew, canCreateEmployee, canCreateVehicle, type PlanType } from "./quotaService";

export type MemberRole = "admin" | "operations" | "user";

interface OrganizationContext {
  organizationId: string;
  membershipId: string;
  role: MemberRole;
  plan: PlanType;
  subscriptionStatus: string;
}

declare global {
  namespace Express {
    interface Request {
      orgContext?: OrganizationContext;
    }
  }
}

export async function loadOrganizationContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const primaryMembership = await storage.getPrimaryMembership(req.session.userId);
    if (!primaryMembership) {
      return res.status(403).json({ error: "No organization membership found" });
    }

    req.orgContext = {
      organizationId: primaryMembership.organization.id,
      membershipId: primaryMembership.id,
      role: primaryMembership.role as MemberRole,
      plan: primaryMembership.organization.plan as PlanType,
      subscriptionStatus: primaryMembership.organization.subscriptionStatus || "trialing",
    };

    next();
  } catch (error) {
    console.error("Error loading organization context:", error);
    res.status(500).json({ error: "Failed to load organization context" });
  }
}

export function requireRole(...allowedRoles: MemberRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.orgContext) {
      return res.status(500).json({ error: "Organization context not loaded" });
    }

    if (!allowedRoles.includes(req.orgContext.role)) {
      return res.status(403).json({
        error: `Access denied. This action requires one of these roles: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole("admin")(req, res, next);
}

export function requireOperationsOrAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole("admin", "operations")(req, res, next);
}

export function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  if (!req.orgContext) {
    return res.status(500).json({ error: "Organization context not loaded" });
  }

  const validStatuses = ["active", "trialing"];
  if (!validStatuses.includes(req.orgContext.subscriptionStatus)) {
    return res.status(402).json({
      error: "Your subscription is not active. Please update your payment method.",
      subscriptionStatus: req.orgContext.subscriptionStatus,
    });
  }

  next();
}

export async function checkDepotQuota(req: Request, res: Response, next: NextFunction) {
  if (!req.orgContext) {
    return res.status(500).json({ error: "Organization context not loaded" });
  }

  const result = await canCreateDepot(req.orgContext.organizationId, req.orgContext.plan);
  if (!result.allowed) {
    return res.status(403).json({
      error: result.reason,
      quotaExceeded: true,
      currentUsage: result.currentUsage,
      limit: result.limit,
    });
  }

  next();
}

export async function checkCrewQuota(req: Request, res: Response, next: NextFunction) {
  if (!req.orgContext) {
    return res.status(500).json({ error: "Organization context not loaded" });
  }

  const result = await canCreateCrew(req.orgContext.organizationId, req.orgContext.plan);
  if (!result.allowed) {
    return res.status(403).json({
      error: result.reason,
      quotaExceeded: true,
      currentUsage: result.currentUsage,
      limit: result.limit,
    });
  }

  next();
}

export async function checkEmployeeQuota(req: Request, res: Response, next: NextFunction) {
  if (!req.orgContext) {
    return res.status(500).json({ error: "Organization context not loaded" });
  }

  const result = await canCreateEmployee(req.orgContext.organizationId, req.orgContext.plan);
  if (!result.allowed) {
    return res.status(403).json({
      error: result.reason,
      quotaExceeded: true,
      currentUsage: result.currentUsage,
      limit: result.limit,
    });
  }

  next();
}

export async function checkVehicleQuota(req: Request, res: Response, next: NextFunction) {
  if (!req.orgContext) {
    return res.status(500).json({ error: "Organization context not loaded" });
  }

  const result = await canCreateVehicle(req.orgContext.organizationId, req.orgContext.plan);
  if (!result.allowed) {
    return res.status(403).json({
      error: result.reason,
      quotaExceeded: true,
      currentUsage: result.currentUsage,
      limit: result.limit,
    });
  }

  next();
}

export function canManageResources(role: MemberRole): boolean {
  return role === "admin" || role === "operations";
}

export function canApproveBookings(role: MemberRole): boolean {
  return role === "admin" || role === "operations";
}

export function canManageTeam(role: MemberRole): boolean {
  return role === "admin";
}

export function canModifySchedule(role: MemberRole, plan: PlanType): boolean {
  if (plan === "starter") {
    return role === "admin" || role === "operations";
  }
  return true;
}

export function bookingRequiresApproval(role: MemberRole, plan: PlanType): boolean {
  if (plan === "starter") {
    return false;
  }
  return role === "user";
}
