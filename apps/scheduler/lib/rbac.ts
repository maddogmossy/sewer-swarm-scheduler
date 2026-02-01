import { OrganizationContext } from "./request-context";

export function requireAdminOrOperations(ctx: { role: string }) {
  if (!["admin", "operations"].includes(ctx.role)) {
    throw new Error(
      "Access denied. This action requires one of these roles: admin, operations"
    );
  }
}

export function requireAdmin(ctx: { role: string }) {
  if (ctx.role !== "admin") {
    throw new Error(
      "Access denied. This action requires admin role"
    );
  }
}

export function canCreateBookings(ctx: { role: string }): boolean {
  // All authenticated users can create bookings
  return ["admin", "operations", "user"].includes(ctx.role);
}

export function canManageResources(ctx: { role: string }): boolean {
  // Only admin and operations can manage resources (depots, crews, employees, vehicles)
  return ["admin", "operations"].includes(ctx.role);
}

export function canApproveBookings(ctx: { role: string }): boolean {
  // Only admin and operations can approve bookings
  return ["admin", "operations"].includes(ctx.role);
}
