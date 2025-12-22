import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertDepotSchema, insertCrewSchema, insertEmployeeSchema, insertVehicleSchema, insertScheduleItemSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import bcrypt from "bcrypt";
import { db, dbState } from "./db";
import { sql } from "drizzle-orm";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { getOrganizationQuotaUsage, canCreateDepot, canCreateCrew, canCreateEmployee, canCreateVehicle, PLAN_LIMITS, planRequiresApproval, type PlanType } from "./quotaService";
import { loadOrganizationContext, requireRole, checkDepotQuota, checkCrewQuota, checkEmployeeQuota, checkVehicleQuota, requireActiveSubscription, bookingRequiresApproval } from "./rbacMiddleware";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// Middleware to check authentication
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

// Middleware to check database readiness
function requireDb(req: Request, res: Response, next: Function) {
  if (!dbState.ready) {
    return res.status(503).json({ 
      error: "Database not available. Please try again later.",
      retryAfter: 30
    });
  }
  next();
}

// Middleware to handle database errors and return 503 when DB is unavailable
function handleDbError(error: any, req: Request, res: Response, next: NextFunction) {
  if (error.message?.includes("Database not configured") || 
      error.message?.includes("DATABASE_URL") ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'EAI_AGAIN' ||
      error.code === '42P01') {
    return res.status(503).json({ 
      error: "Service temporarily unavailable - database connection failed",
      retryAfter: 30
    });
  }
  next(error);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== HEALTH CHECK ====================
  app.get("/api/health", async (req, res) => {
    const health = {
      status: dbState.ready ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      database: dbState.ready ? "connected" : (db ? "disconnected" : "not configured")
    };
    
    res.json(health);
  });

  // ==================== AUTH ROUTES ====================
  
  app.post("/api/register", requireDb, async (req, res) => {
    try {
      console.log("Register request body:", req.body);
      const validated = insertUserSchema.parse(req.body);
      console.log("Validated:", validated);
      
      // Check if user already exists
      const existing = await storage.getUserByUsername(validated.username);
      console.log("Existing user check:", existing);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(validated.password, 10);
      console.log("Password hashed");
      
      // Create user
      const user = await storage.createUser({
        ...validated,
        password: hashedPassword,
      });
      console.log("User created:", user);
      
      // Get company name from request (optional)
      const companyName = req.body.company || `${validated.username}'s Organization`;
      const selectedPlan = (req.body.plan === "pro" ? "pro" : "starter") as "starter" | "pro";
      
      // Create organization for this user (they become the admin)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);
      
      const organization = await storage.createOrganization({
        name: companyName,
        ownerId: user.id,
        plan: selectedPlan,
        subscriptionStatus: "trialing",
        trialEndsAt,
      });
      console.log("Organization created:", organization);
      
      // Create membership making this user an admin
      await storage.createMembership({
        organizationId: organization.id,
        userId: user.id,
        role: "admin",
        acceptedAt: new Date(),
      });
      console.log("Membership created for admin");
      
      // Set session
      req.session.userId = user.id;
      
      res.json({ 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: user.role,
        organization: {
          id: organization.id,
          name: organization.name,
          plan: organization.plan,
        }
      });
    } catch (error: any) {
      console.error("Registration error:", error.message || error);
      console.error("Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      if (error.code === '42P01') {
        return res.status(503).json({ error: "Database tables not initialized. Please try again in a moment." });
      }
      res.status(500).json({ error: error.message || "Failed to create user" });
    }
  });

  app.post("/api/login", requireDb, async (req, res) => {
    try {
      const { username, password } = req.body;
      console.log("Login attempt for:", username);
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      
      // Get user (try username first, then email)
      let user = await storage.getUserByUsername(username);
      if (!user) {
        // Try looking up by email (for invite flow where email is used as login)
        user = await storage.getUserByEmail(username);
      }
      console.log("User found:", !!user);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Check password
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Set session
      req.session.userId = user.id;
      
      // Get user's primary organization membership (owned org first, then most recent)
      const primaryMembership = await storage.getPrimaryMembership(user.id);
      
      res.json({ 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: primaryMembership?.role || user.role,
        organization: primaryMembership ? {
          id: primaryMembership.organization.id,
          name: primaryMembership.organization.name,
          plan: primaryMembership.organization.plan,
        } : null,
        membershipRole: primaryMembership?.role || null
      });
    } catch (error: any) {
      console.error("Login error:", error.message || error);
      console.error("Full login error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      if (error.code === '42P01') {
        return res.status(503).json({ error: "Database tables not initialized. Please try again in a moment." });
      }
      res.status(500).json({ error: error.message || "Login failed" });
    }
  });

  app.post("/api/logout", requireDb, (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/me", requireDb, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Get user's primary organization membership (owned org first, then most recent)
    const primaryMembership = await storage.getPrimaryMembership(user.id);
    
    res.json({ 
      id: user.id, 
      username: user.username, 
      email: user.email,
      role: primaryMembership?.role || user.role,
      organization: primaryMembership ? {
        id: primaryMembership.organization.id,
        name: primaryMembership.organization.name,
        plan: primaryMembership.organization.plan,
        subscriptionStatus: primaryMembership.organization.subscriptionStatus,
      } : null,
      membershipRole: primaryMembership?.role || null
    });
  });

  // ==================== ORGANIZATION & QUOTA ROUTES ====================
  
  app.get("/api/organization", requireAuth, requireDb, async (req, res) => {
    try {
      const memberships = await storage.getMembershipsByUser(req.session.userId!);
      if (memberships.length === 0) {
        return res.status(404).json({ error: "No organization found" });
      }
      
      const membership = memberships[0];
      const org = await storage.getOrganization(membership.organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json({
        id: org.id,
        name: org.name,
        plan: org.plan,
        subscriptionStatus: org.subscriptionStatus,
        membershipRole: membership.role,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.get("/api/organization/quota", requireAuth, requireDb, async (req, res) => {
    try {
      const memberships = await storage.getMembershipsByUser(req.session.userId!);
      if (memberships.length === 0) {
        return res.status(404).json({ error: "No organization found" });
      }
      
      const membership = memberships[0];
      const org = await storage.getOrganization(membership.organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      const quotaUsage = await getOrganizationQuotaUsage(org.id, org.plan as PlanType);
      
      res.json({
        plan: org.plan,
        limits: PLAN_LIMITS[org.plan as PlanType],
        usage: quotaUsage,
        requiresApproval: planRequiresApproval(org.plan as PlanType),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quota" });
    }
  });

  app.get("/api/organization/members", requireAuth, requireDb, async (req, res) => {
    try {
      const memberships = await storage.getMembershipsByUser(req.session.userId!);
      if (memberships.length === 0) {
        return res.status(404).json({ error: "No organization found" });
      }
      
      const membership = memberships[0];
      const members = await storage.getMembershipsByOrg(membership.organizationId);
      
      const membersWithUsers = await Promise.all(
        members.map(async (m) => {
          const user = await storage.getUser(m.userId);
          return {
            id: m.id,
            userId: m.userId,
            username: user?.username || "Unknown",
            email: user?.email || "",
            role: m.role,
            acceptedAt: m.acceptedAt,
          };
        })
      );
      
      res.json(membersWithUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  // ==================== TEAM INVITE ROUTES ====================

  app.get("/api/organization/invites", requireAuth, requireDb, loadOrganizationContext, requireRole("admin"), async (req, res) => {
    try {
      const invites = await storage.getInvitesByOrg(req.orgContext!.organizationId);
      res.json(invites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invites" });
    }
  });

  app.post("/api/organization/invites", requireAuth, requireDb, loadOrganizationContext, requireRole("admin"), async (req, res) => {
    try {
      const { email, role } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }
      const validRoles = ["admin", "operations", "user"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: `Role must be one of: ${validRoles.join(", ")}` });
      }
      
      // Check if user is already a member (check by email, not username)
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        const existingMembership = await storage.getMembership(existingUser.id, req.orgContext!.organizationId);
        if (existingMembership) {
          return res.status(400).json({ error: "User is already a member of this organization" });
        }
      }
      
      // Check if invite already exists for this email
      const existingInvites = await storage.getInvitesByOrg(req.orgContext!.organizationId);
      const existingInvite = existingInvites.find(i => i.email.toLowerCase() === email.toLowerCase());
      if (existingInvite) {
        return res.status(400).json({ error: "An invite already exists for this email" });
      }
      
      // Generate invite token
      const token = `${req.orgContext!.organizationId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry
      
      const invite = await storage.createInvite({
        organizationId: req.orgContext!.organizationId,
        email,
        role,
        invitedBy: req.session.userId!,
        token,
        expiresAt,
      });
      
      res.json(invite);
    } catch (error) {
      console.error("Error creating invite:", error);
      res.status(500).json({ error: "Failed to create invite" });
    }
  });

  app.delete("/api/organization/invites/:id", requireAuth, requireDb, loadOrganizationContext, requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteInvite(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete invite" });
    }
  });

  // Resend invite (regenerate token and extend expiry)
  app.post("/api/organization/invites/:id/resend", requireAuth, requireDb, loadOrganizationContext, requireRole("admin"), async (req, res) => {
    try {
      // Verify invite belongs to current organization
      const existingInvite = await storage.getInviteById(req.params.id);
      if (!existingInvite) {
        return res.status(404).json({ error: "Invite not found" });
      }
      if (existingInvite.organizationId !== req.orgContext!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const newToken = `${req.orgContext!.organizationId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);
      
      const updatedInvite = await storage.updateInvite(req.params.id, {
        token: newToken,
        expiresAt: newExpiresAt,
      });
      
      res.json(updatedInvite);
    } catch (error) {
      console.error("Error resending invite:", error);
      res.status(500).json({ error: "Failed to resend invite" });
    }
  });

  // Accept invite (public route - uses token for authentication)
  app.post("/api/invites/accept", requireDb, async (req, res) => {
    try {
      const { token, username, password } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Invite token is required" });
      }
      
      const invite = await storage.getInviteByToken(token);
      if (!invite) {
        return res.status(404).json({ error: "Invalid or expired invite" });
      }
      
      if (new Date() > invite.expiresAt) {
        await storage.deleteInvite(invite.id);
        return res.status(400).json({ error: "This invite has expired" });
      }
      
      // Check if user already exists with this email
      let user = await storage.getUserByEmail(invite.email);
      
      if (!user) {
        // Need username and password for new users
        if (!username || !password) {
          return res.status(400).json({ error: "Username and password required for new users", needsRegistration: true });
        }
        
        // Check if username is taken
        const existingUsername = await storage.getUserByUsername(username);
        if (existingUsername) {
          return res.status(400).json({ error: "Username is already taken" });
        }
        
        // Create new user (without creating a personal org - they're joining an existing one)
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await storage.createUser({
          username,
          password: hashedPassword,
          email: invite.email,
        });
      } else {
        // Existing user - verify they are logged in (session check) or verify password
        if (req.session.userId) {
          // They're logged in - verify it's the same user
          if (req.session.userId !== user.id) {
            return res.status(403).json({ error: "You must be logged in as the invited user to accept this invite" });
          }
        } else if (password) {
          // Not logged in but password provided - verify password and log them in
          const valid = await bcrypt.compare(password, user.password);
          if (!valid) {
            return res.status(401).json({ error: "Invalid password" });
          }
          req.session.userId = user.id;
        } else {
          return res.status(400).json({ error: "Please log in to accept this invite", needsLogin: true });
        }
      }
      
      // Check if already a member
      const existingMembership = await storage.getMembership(user.id, invite.organizationId);
      if (existingMembership) {
        await storage.deleteInvite(invite.id);
        return res.status(400).json({ error: "You are already a member of this organization" });
      }
      
      // Create membership
      await storage.createMembership({
        organizationId: invite.organizationId,
        userId: user.id,
        role: invite.role as "admin" | "operations" | "user",
        acceptedAt: new Date(),
      });
      
      // Delete invite
      await storage.deleteInvite(invite.id);
      
      // Log the user in
      req.session.userId = user.id;
      
      const org = await storage.getOrganization(invite.organizationId);
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        organization: org ? {
          id: org.id,
          name: org.name,
          plan: org.plan,
        } : null,
      });
    } catch (error) {
      console.error("Error accepting invite:", error);
      res.status(500).json({ error: "Failed to accept invite" });
    }
  });

  // Get invite info (for displaying invite landing page)
  app.get("/api/invites/:token", requireDb, async (req, res) => {
    try {
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ error: "Invalid or expired invite" });
      }
      
      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ error: "This invite has expired" });
      }
      
      const org = await storage.getOrganization(invite.organizationId);
      const inviter = await storage.getUser(invite.invitedBy);
      
      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(invite.email);
      
      res.json({
        email: invite.email,
        role: invite.role,
        organizationName: org?.name || "Unknown Organization",
        invitedBy: inviter?.username || "Unknown",
        expiresAt: invite.expiresAt,
        userExists: !!existingUser,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invite info" });
    }
  });

  // Update member role (Admin only)
  app.patch("/api/organization/members/:id/role", requireAuth, requireDb, loadOrganizationContext, requireRole("admin"), async (req, res) => {
    try {
      const { role } = req.body;
      const validRoles = ["admin", "operations", "user"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: `Role must be one of: ${validRoles.join(", ")}` });
      }
      
      const updated = await storage.updateMembershipRole(req.params.id, role as "admin" | "operations" | "user");
      if (!updated) {
        return res.status(404).json({ error: "Member not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update member role" });
    }
  });

  // Remove member (Admin only)
  app.delete("/api/organization/members/:id", requireAuth, requireDb, loadOrganizationContext, requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteMembership(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  // ==================== DEPOT ROUTES ====================
  
  app.get("/api/depots", requireAuth, requireDb, async (req, res) => {
    try {
      const depots = await storage.getDepots(req.session.userId!);
      res.json(depots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch depots" });
    }
  });

  app.post("/api/depots", requireAuth, requireDb, loadOrganizationContext, requireActiveSubscription, checkDepotQuota, async (req, res) => {
    try {
      const validated = insertDepotSchema.parse({
        ...req.body,
        userId: req.session.userId,
        organizationId: req.orgContext!.organizationId,
      });
      const depot = await storage.createDepot(validated);
      res.json(depot);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create depot" });
    }
  });

  app.patch("/api/depots/:id", requireAuth, requireDb, async (req, res) => {
    try {
      const depot = await storage.updateDepot(req.params.id, req.body);
      if (!depot) {
        return res.status(404).json({ error: "Depot not found" });
      }
      res.json(depot);
    } catch (error) {
      res.status(500).json({ error: "Failed to update depot" });
    }
  });

  app.delete("/api/depots/:id", requireAuth, requireDb, async (req, res) => {
    try {
      await storage.deleteDepot(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete depot" });
    }
  });

  // ==================== CREW ROUTES ====================
  
  app.get("/api/crews", requireAuth, requireDb, loadOrganizationContext, async (req, res) => {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const orgId = req.orgContext?.organizationId;
      
      let crewList;
      if (orgId && includeArchived) {
        crewList = await storage.getAllCrewsByOrg(orgId);
      } else if (orgId) {
        crewList = await storage.getCrewsByOrg(orgId);
      } else {
        crewList = await storage.getCrews(req.session.userId!);
      }
      res.json(crewList);
    } catch (error: any) {
      console.error("Error fetching crews:", error);
      res.status(500).json({ error: "Failed to fetch crews", details: error?.message });
    }
  });

  app.post("/api/crews", requireAuth, requireDb, loadOrganizationContext, requireActiveSubscription, checkCrewQuota, async (req, res) => {
    try {
      const validated = insertCrewSchema.parse({
        ...req.body,
        userId: req.session.userId,
        organizationId: req.orgContext!.organizationId,
      });
      const crew = await storage.createCrew(validated);
      res.json(crew);
    } catch (error: any) {
      console.error("Error creating crew:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create crew", details: error?.message });
    }
  });

  app.patch("/api/crews/:id", requireAuth, requireDb, async (req, res) => {
    try {
      const crew = await storage.updateCrew(req.params.id, req.body);
      if (!crew) {
        return res.status(404).json({ error: "Crew not found" });
      }
      res.json(crew);
    } catch (error) {
      res.status(500).json({ error: "Failed to update crew" });
    }
  });

  app.delete("/api/crews/:id", requireAuth, requireDb, async (req, res) => {
    try {
      const crew = await storage.archiveCrew(req.params.id);
      if (!crew) {
        return res.status(404).json({ error: "Crew not found" });
      }
      res.json({ success: true, archived: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to archive crew" });
    }
  });

  app.post("/api/crews/:id/restore", requireAuth, requireDb, async (req, res) => {
    try {
      const crew = await storage.restoreCrew(req.params.id);
      if (!crew) {
        return res.status(404).json({ error: "Crew not found" });
      }
      res.json(crew);
    } catch (error) {
      res.status(500).json({ error: "Failed to restore crew" });
    }
  });

  // ==================== EMPLOYEE ROUTES ====================
  
  app.get("/api/employees", requireAuth, requireDb, async (req, res) => {
    try {
      const employees = await storage.getEmployees(req.session.userId!);
      res.json(employees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", requireAuth, requireDb, loadOrganizationContext, requireActiveSubscription, checkEmployeeQuota, async (req, res) => {
    try {
      const validated = insertEmployeeSchema.parse({
        ...req.body,
        userId: req.session.userId,
        organizationId: req.orgContext!.organizationId,
      });
      const employee = await storage.createEmployee(validated);
      res.json(employee);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  app.patch("/api/employees/:id", requireAuth, requireDb, async (req, res) => {
    try {
      const employee = await storage.updateEmployee(req.params.id, req.body);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", requireAuth, requireDb, async (req, res) => {
    try {
      await storage.deleteEmployee(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete employee" });
    }
  });

  // ==================== VEHICLE ROUTES ====================
  
  app.get("/api/vehicles", requireAuth, requireDb, async (req, res) => {
    try {
      const vehicles = await storage.getVehicles(req.session.userId!);
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  app.post("/api/vehicles", requireAuth, requireDb, loadOrganizationContext, requireActiveSubscription, checkVehicleQuota, async (req, res) => {
    try {
      const validated = insertVehicleSchema.parse({
        ...req.body,
        userId: req.session.userId,
        organizationId: req.orgContext!.organizationId,
      });
      const vehicle = await storage.createVehicle(validated);
      res.json(vehicle);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  app.patch("/api/vehicles/:id", requireAuth, requireDb, async (req, res) => {
    try {
      const vehicle = await storage.updateVehicle(req.params.id, req.body);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  app.delete("/api/vehicles/:id", requireAuth, requireDb, async (req, res) => {
    try {
      await storage.deleteVehicle(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // ==================== SCHEDULE ITEM ROUTES ====================
  
  app.get("/api/schedule-items", requireAuth, requireDb, async (req, res) => {
    try {
      const items = await storage.getScheduleItems(req.session.userId!);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schedule items" });
    }
  });

  app.post("/api/schedule-items", requireAuth, requireDb, loadOrganizationContext, requireActiveSubscription, async (req, res) => {
    try {
      const requiresApproval = bookingRequiresApproval(req.orgContext!.role, req.orgContext!.plan);
      const status = requiresApproval ? "pending" : "approved";
      
      const validated = insertScheduleItemSchema.parse({
        ...req.body,
        userId: req.session.userId,
        organizationId: req.orgContext!.organizationId,
        date: new Date(req.body.date),
        status,
        requestedBy: req.session.userId,
        approvedBy: requiresApproval ? null : req.session.userId,
        approvedAt: requiresApproval ? null : new Date(),
      });
      const item = await storage.createScheduleItem(validated);
      res.json(item);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create schedule item" });
    }
  });

  app.patch("/api/schedule-items/:id", requireAuth, requireDb, async (req, res) => {
    try {
      const updates = { ...req.body };
      if (updates.date) {
        updates.date = new Date(updates.date);
      }
      const item = await storage.updateScheduleItem(req.params.id, updates);
      if (!item) {
        return res.status(404).json({ error: "Schedule item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update schedule item" });
    }
  });

  app.delete("/api/schedule-items/:id", requireAuth, requireDb, async (req, res) => {
    try {
      await storage.deleteScheduleItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete schedule item" });
    }
  });

  // Pending schedule items (for approval queue)
  app.get("/api/schedule-items/pending", requireAuth, requireDb, loadOrganizationContext, requireRole("admin", "operations"), async (req, res) => {
    try {
      const items = await storage.getPendingScheduleItems(req.orgContext!.organizationId);
      const itemsWithRequester = await Promise.all(
        items.map(async (item) => {
          let requestedByUser = null;
          if (item.requestedBy) {
            const user = await storage.getUser(item.requestedBy);
            if (user) {
              requestedByUser = { id: user.id, username: user.username };
            }
          }
          return { ...item, requestedByUser };
        })
      );
      res.json(itemsWithRequester);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending items" });
    }
  });

  // Approve schedule item
  app.post("/api/schedule-items/:id/approve", requireAuth, requireDb, loadOrganizationContext, requireRole("admin", "operations"), async (req, res) => {
    try {
      const item = await storage.getScheduleItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Schedule item not found" });
      }
      if (item.status !== "pending") {
        return res.status(400).json({ error: "Only pending items can be approved" });
      }
      const approvedItem = await storage.approveScheduleItem(req.params.id, req.session.userId!);
      res.json(approvedItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve schedule item" });
    }
  });

  // Reject schedule item
  app.post("/api/schedule-items/:id/reject", requireAuth, requireDb, loadOrganizationContext, requireRole("admin", "operations"), async (req, res) => {
    try {
      const item = await storage.getScheduleItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Schedule item not found" });
      }
      if (item.status !== "pending") {
        return res.status(400).json({ error: "Only pending items can be rejected" });
      }
      const { reason } = req.body;
      if (!reason || typeof reason !== "string") {
        return res.status(400).json({ error: "Rejection reason is required" });
      }
      const rejectedItem = await storage.rejectScheduleItem(req.params.id, req.session.userId!, reason);
      res.json(rejectedItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to reject schedule item" });
    }
  });

  // ==================== COLOR LABEL ROUTES ====================
  
  app.get("/api/color-labels", requireAuth, requireDb, async (req, res) => {
    try {
      const labels = await storage.getColorLabels(req.session.userId!);
      const labelMap = labels.reduce((acc, label) => {
        acc[label.color] = label.label;
        return acc;
      }, {} as Record<string, string>);
      res.json(labelMap);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch color labels" });
    }
  });

  app.post("/api/color-labels", requireAuth, requireDb, async (req, res) => {
    try {
      const { color, label } = req.body;
      if (!color || !label) {
        return res.status(400).json({ error: "Color and label required" });
      }
      const colorLabel = await storage.upsertColorLabel(req.session.userId!, color, label);
      res.json(colorLabel);
    } catch (error) {
      res.status(500).json({ error: "Failed to save color label" });
    }
  });

  // ==================== STRIPE ROUTES ====================
  
  // Get Stripe publishable key
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      console.error("Failed to get Stripe publishable key:", error.message);
      res.status(500).json({ error: "Stripe not configured" });
    }
  });

  // Get available products and prices
  app.get("/api/stripe/products", async (req, res) => {
    try {
      const rows = await stripeService.listProductsWithPrices();
      
      // Group prices by product
      const productsMap = new Map();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: stripeService.parseMetadata(row.product_metadata),
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: typeof row.recurring === 'string' ? JSON.parse(row.recurring) : row.recurring,
            active: row.price_active,
            metadata: stripeService.parseMetadata(row.price_metadata),
          });
        }
      }
      
      res.json({ data: Array.from(productsMap.values()) });
    } catch (error: any) {
      console.error("Failed to get products:", error.message);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get prices for a product
  app.get("/api/stripe/products/:productId/prices", async (req, res) => {
    try {
      const { productId } = req.params;
      const product = await stripeService.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const prices = await stripeService.getPricesForProduct(productId);
      res.json({ data: prices });
    } catch (error: any) {
      console.error("Failed to get prices:", error.message);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

  // Get user's subscription status
  app.get("/api/subscription", requireAuth, requireDb, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.stripeSubscriptionId) {
        return res.json({ 
          subscription: null,
          status: user?.subscriptionStatus || 'none',
          trialEndsAt: user?.trialEndsAt
        });
      }
      
      const subscription = await stripeService.getSubscription(user.stripeSubscriptionId);
      res.json({ 
        subscription,
        status: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt
      });
    } catch (error: any) {
      console.error("Failed to get subscription:", error.message);
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Create checkout session
  app.post("/api/stripe/checkout", requireAuth, requireDb, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { priceId, trialDays } = req.body;
      if (!priceId) {
        return res.status(400).json({ error: "Price ID required" });
      }
      
      // Create or get customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          user.email || `${user.username}@sewerswarm.app`,
          user.id,
          user.username
        );
        await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }
      
      // Create checkout session
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/schedule?checkout=success`,
        `${baseUrl}/?checkout=cancelled`,
        trialDays
      );
      
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Failed to create checkout:", error.message);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Create customer portal session
  app.post("/api/stripe/portal", requireAuth, requireDb, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No subscription found" });
      }
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${baseUrl}/schedule`
      );
      
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Failed to create portal session:", error.message);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  // Cancel subscription
  app.post("/api/stripe/cancel-subscription", requireAuth, requireDb, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.stripeSubscriptionId) {
        return res.status(400).json({ error: "No subscription found" });
      }
      
      await stripeService.cancelSubscription(user.stripeSubscriptionId);
      await storage.updateUserStripeInfo(user.id, { 
        subscriptionStatus: 'cancelled',
        stripeSubscriptionId: undefined
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to cancel subscription:", error.message);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Global error handler for database errors - must be registered AFTER routes
  app.use("/api", (err: any, req: Request, res: Response, next: NextFunction) => {
    handleDbError(err, req, res, next);
  });

  const httpServer = createServer(app);

  return httpServer;
}
