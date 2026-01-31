import { OrganizationContext } from "./request-context";

export function requireAdminOrOperations(ctx: { role: string }) {
  if (!["admin", "operations"].includes(ctx.role)) {
    throw new Error(
      "Access denied. This action requires one of these roles: admin, operations"
    );
  }
}
