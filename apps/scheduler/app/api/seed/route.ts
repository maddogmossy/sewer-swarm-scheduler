import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "@/lib/storage";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      );
    }

    // Get user's organization
    const memberships = await storage.getMembershipsByUser(userId);
    if (memberships.length === 0) {
      return NextResponse.json(
        { error: "No organization found. Please register first." },
        { status: 400 }
      );
    }

    const organizationId = memberships[0].organizationId;

    // Create a depot
    const depot = await storage.createDepot({
      id: randomUUID(),
      name: "Main Depot",
      address: "123 Industrial Way, City",
      userId,
      organizationId,
    });

    // Create crews
    const crew1 = await storage.createCrew({
      id: randomUUID(),
      name: "Day Shift Crew 1",
      depotId: depot.id,
      shift: "day",
      userId,
      organizationId,
    });

    const crew2 = await storage.createCrew({
      id: randomUUID(),
      name: "Day Shift Crew 2",
      depotId: depot.id,
      shift: "day",
      userId,
      organizationId,
    });

    const crew3 = await storage.createCrew({
      id: randomUUID(),
      name: "Night Shift Crew",
      depotId: depot.id,
      shift: "night",
      userId,
      organizationId,
    });

    // Create employees
    const employees = [];
    const employeeNames = [
      "John Smith",
      "Jane Doe",
      "Mike Johnson",
      "Sarah Williams",
      "Tom Brown",
      "Emma Davis",
      "Chris Wilson",
      "Lisa Anderson",
    ];

    for (const name of employeeNames) {
      const employee = await storage.createEmployee({
        id: randomUUID(),
        name,
        status: "active",
        jobRole: Math.random() > 0.7 ? "assistant" : "operative",
        depotId: depot.id,
        userId,
        organizationId,
      });
      employees.push(employee);
    }

    // Create vehicles
    const vehicles = [];
    const vehicleNames = [
      "Van 001",
      "CCTV Truck 01",
      "Jetting Unit 01",
      "Recycler 01",
      "Van 002",
    ];

    const vehicleTypes = ["Van", "CCTV", "Jetting", "Recycler", "Van"];

    for (let i = 0; i < vehicleNames.length; i++) {
      const vehicle = await storage.createVehicle({
        id: randomUUID(),
        name: vehicleNames[i],
        status: "active",
        vehicleType: vehicleTypes[i],
        depotId: depot.id,
        userId,
        organizationId,
      });
      vehicles.push(vehicle);
    }

    // Create some schedule items for the next week
    const scheduleItems = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const colors = ["blue", "green", "red", "yellow", "purple"];

    for (let day = 0; day < 7; day++) {
      const date = new Date(today);
      date.setDate(today.getDate() + day);
      date.setHours(8, 0, 0, 0);

      // Add a job for crew1
      scheduleItems.push(
        await storage.createScheduleItem({
          id: randomUUID(),
          type: "job",
          date,
          crewId: crew1.id,
          depotId: depot.id,
          userId,
          organizationId,
          customer: `Customer ${day + 1}`,
          jobNumber: `JOB-${String(day + 1).padStart(3, "0")}`,
          address: `${100 + day} Main Street`,
          projectManager: "PM",
          startTime: "08:00",
          onsiteTime: "09:00",
          color: colors[day % colors.length],
          duration: 8,
          status: "approved",
        })
      );

      // Add an operative assignment for crew2
      if (employees[0]) {
        scheduleItems.push(
          await storage.createScheduleItem({
            id: randomUUID(),
            type: "operative",
            date,
            crewId: crew2.id,
            depotId: depot.id,
            userId,
            organizationId,
            employeeId: employees[0].id,
            status: "approved",
          })
        );
      }

      // Add a vehicle assignment
      if (vehicles[0]) {
        scheduleItems.push(
          await storage.createScheduleItem({
            id: randomUUID(),
            type: "note",
            date,
            crewId: crew1.id,
            depotId: depot.id,
            userId,
            organizationId,
            vehicleId: vehicles[0].id,
            noteContent: `Daily briefing for ${date.toLocaleDateString()}`,
            status: "approved",
          })
        );
      }
    }

    return NextResponse.json({
      success: true,
      created: {
        depots: 1,
        crews: 3,
        employees: employees.length,
        vehicles: vehicles.length,
        scheduleItems: scheduleItems.length,
      },
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to seed data" },
      { status: 500 }
    );
  }
}

