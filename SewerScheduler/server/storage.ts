import { 
  type User, 
  type InsertUser,
  type Depot,
  type InsertDepot,
  type Crew,
  type InsertCrew,
  type Employee,
  type InsertEmployee,
  type Vehicle,
  type InsertVehicle,
  type ScheduleItem,
  type InsertScheduleItem,
  type ColorLabel,
  type InsertColorLabel,
  type Organization,
  type InsertOrganization,
  type OrganizationMembership,
  type InsertMembership,
  type TeamInvite,
  type InsertTeamInvite,
  type MemberRole,
  type PlanType,
  users,
  depots,
  crews,
  employees,
  vehicles,
  scheduleItems,
  colorLabels,
  organizations,
  organizationMemberships,
  teamInvites,
  PLAN_LIMITS,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, isNull, gte } from "drizzle-orm";

// Helper to ensure db is available
function getDb() {
  if (!db) {
    throw new Error("Database not configured. Please ensure DATABASE_URL is set.");
  }
  return db;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    trialEndsAt?: Date;
  }): Promise<User | undefined>;
  
  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationByOwner(ownerId: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  
  // Organization Memberships
  getMembership(userId: string, organizationId: string): Promise<OrganizationMembership | undefined>;
  getMembershipsByOrg(organizationId: string): Promise<OrganizationMembership[]>;
  getMembershipsByUser(userId: string): Promise<OrganizationMembership[]>;
  createMembership(membership: InsertMembership): Promise<OrganizationMembership>;
  updateMembershipRole(id: string, role: MemberRole): Promise<OrganizationMembership | undefined>;
  deleteMembership(id: string): Promise<void>;
  
  // Team Invites
  getInviteById(id: string): Promise<TeamInvite | undefined>;
  getInviteByToken(token: string): Promise<TeamInvite | undefined>;
  getInvitesByOrg(organizationId: string): Promise<TeamInvite[]>;
  createInvite(invite: InsertTeamInvite): Promise<TeamInvite>;
  updateInvite(id: string, data: { token: string; expiresAt: Date }): Promise<TeamInvite | undefined>;
  deleteInvite(id: string): Promise<void>;
  
  // Quota checking
  getOrganizationCounts(organizationId: string): Promise<{
    depots: number;
    crews: number;
    employees: number;
    vehicles: number;
    members: number;
  }>;
  
  // Depots (by organization)
  getDepotsByOrg(organizationId: string): Promise<Depot[]>;
  getDepots(userId: string): Promise<Depot[]>;
  getDepot(id: string): Promise<Depot | undefined>;
  createDepot(depot: InsertDepot): Promise<Depot>;
  updateDepot(id: string, depot: Partial<InsertDepot>): Promise<Depot | undefined>;
  deleteDepot(id: string): Promise<void>;
  
  // Crews (by organization) - active only by default
  getCrewsByOrg(organizationId: string): Promise<Crew[]>;
  getAllCrewsByOrg(organizationId: string): Promise<Crew[]>;
  getCrews(userId: string): Promise<Crew[]>;
  getCrew(id: string): Promise<Crew | undefined>;
  createCrew(crew: InsertCrew): Promise<Crew>;
  updateCrew(id: string, crew: Partial<InsertCrew>): Promise<Crew | undefined>;
  archiveCrew(id: string): Promise<Crew | undefined>;
  restoreCrew(id: string): Promise<Crew | undefined>;
  
  // Employees (by organization)
  getEmployeesByOrg(organizationId: string): Promise<Employee[]>;
  getEmployees(userId: string): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<void>;
  
  // Vehicles (by organization)
  getVehiclesByOrg(organizationId: string): Promise<Vehicle[]>;
  getVehicles(userId: string): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<void>;
  
  // Schedule Items (by organization)
  getScheduleItemsByOrg(organizationId: string, startDate?: Date, endDate?: Date): Promise<ScheduleItem[]>;
  getPendingScheduleItems(organizationId: string): Promise<ScheduleItem[]>;
  approveScheduleItem(id: string, approverId: string): Promise<ScheduleItem | undefined>;
  rejectScheduleItem(id: string, approverId: string, reason: string): Promise<ScheduleItem | undefined>;
  getScheduleItems(userId: string, startDate?: Date, endDate?: Date): Promise<ScheduleItem[]>;
  getScheduleItem(id: string): Promise<ScheduleItem | undefined>;
  createScheduleItem(item: InsertScheduleItem): Promise<ScheduleItem>;
  updateScheduleItem(id: string, item: Partial<InsertScheduleItem>): Promise<ScheduleItem | undefined>;
  deleteScheduleItem(id: string): Promise<void>;
  
  // Color Labels (by organization)
  getColorLabelsByOrg(organizationId: string): Promise<ColorLabel[]>;
  getColorLabels(userId: string): Promise<ColorLabel[]>;
  getColorLabel(id: string): Promise<ColorLabel | undefined>;
  upsertColorLabel(userId: string, color: string, label: string, organizationId?: string): Promise<ColorLabel>;
  deleteColorLabel(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ============= USERS =============
  async getUser(id: string): Promise<User | undefined> {
    const result = await getDb().select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await getDb().select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await getDb().select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await getDb().insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    trialEndsAt?: Date;
  }): Promise<User | undefined> {
    const result = await getDb().update(users).set(stripeInfo).where(eq(users.id, userId)).returning();
    return result[0];
  }

  // ============= ORGANIZATIONS =============
  async getOrganization(id: string): Promise<Organization | undefined> {
    const result = await getDb().select().from(organizations).where(eq(organizations.id, id));
    return result[0];
  }

  async getOrganizationByOwner(ownerId: string): Promise<Organization | undefined> {
    const result = await getDb().select().from(organizations).where(eq(organizations.ownerId, ownerId));
    return result[0];
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const result = await getDb().insert(organizations).values(org).returning();
    return result[0];
  }

  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const result = await getDb().update(organizations).set(org).where(eq(organizations.id, id)).returning();
    return result[0];
  }

  // ============= ORGANIZATION MEMBERSHIPS =============
  async getMembership(userId: string, organizationId: string): Promise<OrganizationMembership | undefined> {
    const result = await getDb().select().from(organizationMemberships).where(
      and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId))
    );
    return result[0];
  }

  async getMembershipsByOrg(organizationId: string): Promise<OrganizationMembership[]> {
    return await getDb().select().from(organizationMemberships).where(eq(organizationMemberships.organizationId, organizationId));
  }

  async getMembershipsByUser(userId: string): Promise<OrganizationMembership[]> {
    return await getDb()
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.userId, userId))
      .orderBy(desc(organizationMemberships.acceptedAt));
  }

  async getPrimaryMembership(userId: string): Promise<(OrganizationMembership & { organization: Organization }) | undefined> {
    const memberships = await this.getMembershipsByUser(userId);
    if (memberships.length === 0) return undefined;
    
    for (const membership of memberships) {
      const org = await this.getOrganization(membership.organizationId);
      if (org && org.ownerId === userId) {
        return { ...membership, organization: org };
      }
    }
    
    const firstMembership = memberships[0];
    const org = await this.getOrganization(firstMembership.organizationId);
    if (!org) return undefined;
    return { ...firstMembership, organization: org };
  }

  async createMembership(membership: InsertMembership): Promise<OrganizationMembership> {
    const result = await getDb().insert(organizationMemberships).values(membership).returning();
    return result[0];
  }

  async updateMembershipRole(id: string, role: MemberRole): Promise<OrganizationMembership | undefined> {
    const result = await getDb().update(organizationMemberships).set({ role }).where(eq(organizationMemberships.id, id)).returning();
    return result[0];
  }

  async deleteMembership(id: string): Promise<void> {
    await getDb().delete(organizationMemberships).where(eq(organizationMemberships.id, id));
  }

  // ============= TEAM INVITES =============
  async getInviteById(id: string): Promise<TeamInvite | undefined> {
    const result = await getDb().select().from(teamInvites).where(eq(teamInvites.id, id));
    return result[0];
  }

  async getInviteByToken(token: string): Promise<TeamInvite | undefined> {
    const result = await getDb().select().from(teamInvites).where(eq(teamInvites.token, token));
    return result[0];
  }

  async getInvitesByOrg(organizationId: string): Promise<TeamInvite[]> {
    return await getDb().select().from(teamInvites).where(eq(teamInvites.organizationId, organizationId));
  }

  async createInvite(invite: InsertTeamInvite): Promise<TeamInvite> {
    const result = await getDb().insert(teamInvites).values(invite).returning();
    return result[0];
  }

  async updateInvite(id: string, data: { token: string; expiresAt: Date }): Promise<TeamInvite | undefined> {
    const result = await getDb().update(teamInvites).set(data).where(eq(teamInvites.id, id)).returning();
    return result[0];
  }

  async deleteInvite(id: string): Promise<void> {
    await getDb().delete(teamInvites).where(eq(teamInvites.id, id));
  }

  // ============= QUOTA CHECKING =============
  async getOrganizationCounts(organizationId: string): Promise<{
    depots: number;
    crews: number;
    employees: number;
    vehicles: number;
    members: number;
  }> {
    const database = getDb();
    
    const [depotCount, crewCount, employeeCount, vehicleCount, memberCount] = await Promise.all([
      database.select({ count: sql<number>`count(*)` }).from(depots).where(eq(depots.organizationId, organizationId)),
      database.select({ count: sql<number>`count(*)` }).from(crews).where(eq(crews.organizationId, organizationId)),
      database.select({ count: sql<number>`count(*)` }).from(employees).where(eq(employees.organizationId, organizationId)),
      database.select({ count: sql<number>`count(*)` }).from(vehicles).where(eq(vehicles.organizationId, organizationId)),
      database.select({ count: sql<number>`count(*)` }).from(organizationMemberships).where(eq(organizationMemberships.organizationId, organizationId)),
    ]);

    return {
      depots: Number(depotCount[0]?.count || 0),
      crews: Number(crewCount[0]?.count || 0),
      employees: Number(employeeCount[0]?.count || 0),
      vehicles: Number(vehicleCount[0]?.count || 0),
      members: Number(memberCount[0]?.count || 0),
    };
  }

  // ============= DEPOTS =============
  async getDepotsByOrg(organizationId: string): Promise<Depot[]> {
    return await getDb().select().from(depots).where(eq(depots.organizationId, organizationId));
  }
  async getDepots(userId: string): Promise<Depot[]> {
    return await getDb().select().from(depots).where(eq(depots.userId, userId));
  }

  async getDepot(id: string): Promise<Depot | undefined> {
    const result = await getDb().select().from(depots).where(eq(depots.id, id));
    return result[0];
  }

  async createDepot(depot: InsertDepot): Promise<Depot> {
    const result = await getDb().insert(depots).values(depot).returning();
    return result[0];
  }

  async updateDepot(id: string, depot: Partial<InsertDepot>): Promise<Depot | undefined> {
    const result = await getDb().update(depots).set(depot).where(eq(depots.id, id)).returning();
    return result[0];
  }

  async deleteDepot(id: string): Promise<void> {
    await getDb().delete(depots).where(eq(depots.id, id));
  }

  // ============= CREWS =============
  async getCrewsByOrg(organizationId: string): Promise<Crew[]> {
    return await getDb().select().from(crews).where(
      and(eq(crews.organizationId, organizationId), isNull(crews.archivedAt))
    );
  }

  async getAllCrewsByOrg(organizationId: string): Promise<Crew[]> {
    return await getDb().select().from(crews).where(eq(crews.organizationId, organizationId));
  }

  async getCrews(userId: string): Promise<Crew[]> {
    return await getDb().select().from(crews).where(
      and(eq(crews.userId, userId), isNull(crews.archivedAt))
    );
  }

  async getCrew(id: string): Promise<Crew | undefined> {
    const result = await getDb().select().from(crews).where(eq(crews.id, id));
    return result[0];
  }

  async createCrew(crew: InsertCrew): Promise<Crew> {
    const result = await getDb().insert(crews).values(crew).returning();
    return result[0];
  }

  async updateCrew(id: string, crew: Partial<InsertCrew>): Promise<Crew | undefined> {
    const result = await getDb().update(crews).set(crew).where(eq(crews.id, id)).returning();
    return result[0];
  }

  async archiveCrew(id: string): Promise<Crew | undefined> {
    const database = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use transaction to ensure atomicity
    return await database.transaction(async (tx) => {
      // Delete future schedule items for this crew (preserve historical data)
      await tx.delete(scheduleItems).where(
        and(eq(scheduleItems.crewId, id), gte(scheduleItems.date, today))
      );
      
      // Archive the crew
      const result = await tx.update(crews).set({ archivedAt: new Date() }).where(eq(crews.id, id)).returning();
      return result[0];
    });
  }

  async restoreCrew(id: string): Promise<Crew | undefined> {
    const result = await getDb().update(crews).set({ archivedAt: null }).where(eq(crews.id, id)).returning();
    return result[0];
  }

  // ============= EMPLOYEES =============
  async getEmployeesByOrg(organizationId: string): Promise<Employee[]> {
    return await getDb().select().from(employees).where(eq(employees.organizationId, organizationId));
  }

  async getEmployees(userId: string): Promise<Employee[]> {
    return await getDb().select().from(employees).where(eq(employees.userId, userId));
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const result = await getDb().select().from(employees).where(eq(employees.id, id));
    return result[0];
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const result = await getDb().insert(employees).values(employee).returning();
    return result[0];
  }

  async updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const result = await getDb().update(employees).set(employee).where(eq(employees.id, id)).returning();
    return result[0];
  }

  async deleteEmployee(id: string): Promise<void> {
    await getDb().delete(employees).where(eq(employees.id, id));
  }

  // ============= VEHICLES =============
  async getVehiclesByOrg(organizationId: string): Promise<Vehicle[]> {
    return await getDb().select().from(vehicles).where(eq(vehicles.organizationId, organizationId));
  }

  async getVehicles(userId: string): Promise<Vehicle[]> {
    return await getDb().select().from(vehicles).where(eq(vehicles.userId, userId));
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const result = await getDb().select().from(vehicles).where(eq(vehicles.id, id));
    return result[0];
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const result = await getDb().insert(vehicles).values(vehicle).returning();
    return result[0];
  }

  async updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const result = await getDb().update(vehicles).set(vehicle).where(eq(vehicles.id, id)).returning();
    return result[0];
  }

  async deleteVehicle(id: string): Promise<void> {
    await getDb().delete(vehicles).where(eq(vehicles.id, id));
  }

  // ============= SCHEDULE ITEMS =============
  async getScheduleItemsByOrg(organizationId: string, startDate?: Date, endDate?: Date): Promise<ScheduleItem[]> {
    return await getDb().select().from(scheduleItems).where(eq(scheduleItems.organizationId, organizationId));
  }

  async getPendingScheduleItems(organizationId: string): Promise<ScheduleItem[]> {
    return await getDb().select().from(scheduleItems).where(
      and(eq(scheduleItems.organizationId, organizationId), eq(scheduleItems.status, "pending"))
    );
  }

  async approveScheduleItem(id: string, approverId: string): Promise<ScheduleItem | undefined> {
    const result = await getDb().update(scheduleItems).set({
      status: "approved",
      approvedBy: approverId,
      approvedAt: new Date(),
    }).where(eq(scheduleItems.id, id)).returning();
    return result[0];
  }

  async rejectScheduleItem(id: string, approverId: string, reason: string): Promise<ScheduleItem | undefined> {
    const result = await getDb().update(scheduleItems).set({
      status: "rejected",
      approvedBy: approverId,
      rejectionReason: reason,
    }).where(eq(scheduleItems.id, id)).returning();
    return result[0];
  }

  async getScheduleItems(userId: string, startDate?: Date, endDate?: Date): Promise<ScheduleItem[]> {
    const database = getDb();
    let query = database.select().from(scheduleItems).where(eq(scheduleItems.userId, userId));
    
    if (startDate && endDate) {
      query = database.select().from(scheduleItems).where(
        and(
          eq(scheduleItems.userId, userId),
        )
      );
    }
    
    return await query;
  }

  async getScheduleItem(id: string): Promise<ScheduleItem | undefined> {
    const result = await getDb().select().from(scheduleItems).where(eq(scheduleItems.id, id));
    return result[0];
  }

  async createScheduleItem(item: InsertScheduleItem): Promise<ScheduleItem> {
    const result = await getDb().insert(scheduleItems).values(item).returning();
    return result[0];
  }

  async updateScheduleItem(id: string, item: Partial<InsertScheduleItem>): Promise<ScheduleItem | undefined> {
    const result = await getDb().update(scheduleItems).set(item).where(eq(scheduleItems.id, id)).returning();
    return result[0];
  }

  async deleteScheduleItem(id: string): Promise<void> {
    await getDb().delete(scheduleItems).where(eq(scheduleItems.id, id));
  }

  // ============= COLOR LABELS =============
  async getColorLabelsByOrg(organizationId: string): Promise<ColorLabel[]> {
    return await getDb().select().from(colorLabels).where(eq(colorLabels.organizationId, organizationId));
  }

  async getColorLabels(userId: string): Promise<ColorLabel[]> {
    return await getDb().select().from(colorLabels).where(eq(colorLabels.userId, userId));
  }

  async getColorLabel(id: string): Promise<ColorLabel | undefined> {
    const result = await getDb().select().from(colorLabels).where(eq(colorLabels.id, id));
    return result[0];
  }

  async upsertColorLabel(userId: string, color: string, label: string, organizationId?: string): Promise<ColorLabel> {
    const database = getDb();
    // Check if exists
    const existing = await database.select().from(colorLabels).where(
      and(eq(colorLabels.userId, userId), eq(colorLabels.color, color))
    );
    
    if (existing.length > 0) {
      const result = await database.update(colorLabels)
        .set({ label })
        .where(eq(colorLabels.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      const result = await database.insert(colorLabels)
        .values({ userId, color, label, organizationId })
        .returning();
      return result[0];
    }
  }

  async deleteColorLabel(id: string): Promise<void> {
    await getDb().delete(colorLabels).where(eq(colorLabels.id, id));
  }
}

export const storage = new DatabaseStorage();
