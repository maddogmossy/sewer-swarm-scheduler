import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST() {
  const userId = "dev-user-1";

  // 1. Ensure user exists
  let user = await storage.getUser(userId);
  if (!user) {
    user = await storage.createUser({
      id: userId,
      email: "dev@example.com",
      username: "dev",
      password: "__DEV_ONLY__",
    });
  }

  // 2. Ensure organization exists
  let org = await storage.getOrganizationByOwner(userId);
  if (!org) {
    org = await storage.createOrganization({
      id: randomUUID(),
      name: "Dev Organization",
      ownerId: userId,
      plan: "starter",
    });
  }

  // 3. Ensure membership exists
  const membership = await storage.getMembership(userId, org.id);
  if (!membership) {
    await storage.createMembership({
      id: randomUUID(),
      userId,
      organizationId: org.id,
      role: "admin",
      acceptedAt: new Date(),
    });
  }

  return NextResponse.json({ ok: true });
}
