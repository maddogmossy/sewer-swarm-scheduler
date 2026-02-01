import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type MemberRole = "admin" | "operations" | "user";
export type PlanType = "starter" | "pro";

export interface Organization {
  id: string;
  name: string;
  plan: PlanType;
  subscriptionStatus: string;
}

export interface QuotaUsage {
  depots: { used: number; limit: number; remaining: number };
  crews: { used: number; limit: number; remaining: number };
  employees: { used: number; limit: number; remaining: number };
  vehicles: { used: number; limit: number; remaining: number };
}

export interface QuotaInfo {
  plan: PlanType;
  limits: {
    maxDepots: number;
    maxCrews: number;
    maxEmployees: number;
    maxVehicles: number;
    requiresApproval: boolean;
  };
  usage: QuotaUsage;
  requiresApproval: boolean;
}

export interface Member {
  id: string;
  userId: string;
  username: string;
  email: string;
  role: MemberRole;
  acceptedAt: Date | null;
}

export interface TeamInvite {
  id: string;
  organizationId: string;
  email: string;
  role: MemberRole;
  invitedBy: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface PendingScheduleItem {
  id: string;
  type: string;
  date: Date;
  crewId: string;
  depotId: string;
  status: string;
  requestedBy: string;
  requestedByUser: { id: string; username: string } | null;
  customer: string | null;
  location: string | null;
  notes: string | null;
}

export function useOrganization() {
  return useQuery<{ id: string; name: string; plan: PlanType; subscriptionStatus: string; membershipRole: MemberRole }>({
    queryKey: ["/api/organization"],
    queryFn: async () => {
      const response = await fetch("/api/organization");
      if (!response.ok) {
        throw new Error("Failed to fetch organization");
      }
      return response.json();
    },
  });
}

export function useQuota() {
  return useQuery<QuotaInfo>({
    queryKey: ["/api/organization/quota"],
  });
}

export function useMembers() {
  return useQuery<Member[]>({
    queryKey: ["/api/organization/members"],
    queryFn: async () => {
      const response = await fetch("/api/organization/members");
      if (!response.ok) {
        throw new Error("Failed to fetch members");
      }
      return response.json();
    },
  });
}

export function useInvites() {
  return useQuery<TeamInvite[]>({
    queryKey: ["/api/organization/invites"],
    queryFn: async () => {
      const response = await fetch("/api/organization/invites");
      if (!response.ok) {
        throw new Error("Failed to fetch invites");
      }
      return response.json();
    },
  });
}

export function usePendingScheduleItems() {
  return useQuery<PendingScheduleItem[]>({
    queryKey: ["/api/schedule-items/pending"],
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; role: MemberRole }) => {
      const res = await fetch("/api/organization/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create invite");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/invites"] });
    },
  });
}

export function useDeleteInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/organization/invites/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete invite");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/invites"] });
    },
  });
}

export function useResendInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/organization/invites/${id}/resend`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to resend invite");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/invites"] });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: MemberRole }) => {
      const res = await fetch(`/api/organization/members/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update member role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/members"] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/organization/members/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/members"] });
    },
  });
}

export function useApproveScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/schedule-items/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-items/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-items"] });
    },
  });
}

export function useRejectScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/schedule-items/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reject item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-items/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-items"] });
    },
  });
}

export function canManageTeam(role: MemberRole): boolean {
  return role === "admin";
}

export function canManageResources(role: MemberRole): boolean {
  return role === "admin" || role === "operations";
}

export function canApproveBookings(role: MemberRole): boolean {
  return role === "admin" || role === "operations";
}

export function getRoleDisplayName(role: MemberRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "operations":
      return "Operations Manager";
    case "user":
      return "Booker";
    default:
      return role;
  }
}

export function getPlanDisplayName(plan: PlanType): string {
  switch (plan) {
    case "starter":
      return "Starter";
    case "pro":
      return "Pro";
    default:
      return plan;
  }
}
