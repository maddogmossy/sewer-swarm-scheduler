import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ================= ORGANIZATIONS =================
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ownerId: varchar("owner_id").notNull(),
  plan: text("plan").notNull().default("starter"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("trialing"),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// ================= ORGANIZATION MEMBERSHIPS =================
export type MemberRole = "admin" | "operations" | "user";

export const organizationMemberships = pgTable("organization_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("user"),
  invitedBy: varchar("invited_by"),
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

export const insertMembershipSchema = createInsertSchema(organizationMemberships).omit({
  id: true,
  invitedAt: true,
});

export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;

// ================= TEAM INVITES =================
export const teamInvites = pgTable("team_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("user"),
  invitedBy: varchar("invited_by").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamInviteSchema = createInsertSchema(teamInvites).omit({
  id: true,
  createdAt: true,
});

export type InsertTeamInvite = z.infer<typeof insertTeamInviteSchema>;
export type TeamInvite = typeof teamInvites.$inferSelect;

// ================= USERS =================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  trialEndsAt: timestamp("trial_ends_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  subscriptionStatus: true,
  trialEndsAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ================= DEPOTS =================
export const depots = pgTable("depots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
});

export const insertDepotSchema = createInsertSchema(depots).omit({
  id: true,
});

export type InsertDepot = z.infer<typeof insertDepotSchema>;
export type Depot = typeof depots.$inferSelect;

// ================= CREWS =================
export const crews = pgTable("crews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  depotId: varchar("depot_id").notNull().references(() => depots.id, { onDelete: "cascade" }),
  shift: text("shift").notNull().default("day"),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  archivedAt: timestamp("archived_at"),
});

export const insertCrewSchema = createInsertSchema(crews).omit({
  id: true,
});

export type InsertCrew = z.infer<typeof insertCrewSchema>;
export type Crew = typeof crews.$inferSelect;

// ================= EMPLOYEES =================
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  jobRole: text("job_role").notNull().default("operative"),
  email: text("email"),
  depotId: varchar("depot_id").notNull().references(() => depots.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// ================= VEHICLES =================
export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  vehicleType: text("vehicle_type").notNull(),
  category: text("category"),
  color: text("color"),
  depotId: varchar("depot_id").notNull().references(() => depots.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
});

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// ================= SCHEDULE ITEMS =================
export type ScheduleStatus = "approved" | "pending" | "rejected";

export const scheduleItems = pgTable("schedule_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  date: timestamp("date").notNull(),
  crewId: varchar("crew_id").notNull().references(() => crews.id, { onDelete: "cascade" }),
  depotId: varchar("depot_id").notNull().references(() => depots.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  
  // Approval workflow fields
  status: text("status").notNull().default("approved"),
  requestedBy: varchar("requested_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  // Job status (free/booked/cancelled) - separate from approval status
  jobStatus: text("job_status").notNull().default("booked"),
  
  // Job fields
  customer: text("customer"),
  jobNumber: text("job_number"),
  address: text("address"),
  projectManager: text("project_manager"),
  startTime: text("start_time"),
  onsiteTime: text("onsite_time"),
  color: text("color"),
  duration: integer("duration"),
  
  // Person fields
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  vehicleId: varchar("vehicle_id").references(() => vehicles.id, { onDelete: "cascade" }),
  
  // Note fields
  noteContent: text("note_content"),
});

export const insertScheduleItemSchema = createInsertSchema(scheduleItems).omit({
  id: true,
  approvedAt: true,
});

export type InsertScheduleItem = z.infer<typeof insertScheduleItemSchema>;
export type ScheduleItem = typeof scheduleItems.$inferSelect;

// ================= COLOR LABELS =================
export const colorLabels = pgTable("color_labels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  color: text("color").notNull(),
  label: text("label").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
});

export const insertColorLabelSchema = createInsertSchema(colorLabels).omit({
  id: true,
});

export type InsertColorLabel = z.infer<typeof insertColorLabelSchema>;
export type ColorLabel = typeof colorLabels.$inferSelect;

// ================= PLAN LIMITS =================
export const PLAN_LIMITS = {
  starter: {
    depots: 1,
    crews: 3,
    employees: 25,
    vehicles: 10,
    teamMembers: 5,
    approvalWorkflow: false,
  },
  pro: {
    depots: -1,
    crews: 30,
    employees: 250,
    vehicles: 60,
    teamMembers: -1,
    approvalWorkflow: true,
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;