import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { canCreateBookings, canApproveBookings } from "@/lib/rbac";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await getRequestContext();
    // All authenticated users can view schedule items

    const items = await storage.getScheduleItemsByOrg(ctx.organizationId);
    return NextResponse.json(items);
  } catch (err: any) {
    console.error("[GET /api/schedule-items] Error:", {
      message: err.message,
      errorType: err.constructor?.name,
      stack: err.stack?.substring(0, 500),
    });
    const isUnauthorized = err.message?.includes("Unauthorized");
    const isDatabaseError = err.message?.includes("Database") || err.message?.includes("Failed query") || err.constructor?.name === "DrizzleQueryError";
    
    // Return 500 for database errors, 401 for auth errors, 403 for other errors
    const status = isUnauthorized ? 401 : (isDatabaseError ? 500 : 403);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch schedule items" },
      { status }
    );
  }
}

export async function POST(req: Request) {
  let body: any = null;
  
  try {
    const ctx = await getRequestContext();
    
    // Check if user can create bookings
    if (!canCreateBookings(ctx)) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to create bookings." },
        { status: 403 }
      );
    }

    body = await req.json();

    // Determine status based on role and plan
    // - Admin and operations: auto-approved
    // - User on Starter plan: auto-approved
    // - User on Pro plan: pending (requires approval)
    // If status is explicitly provided (e.g., 'pending' from provisional bookings), use it
    let status = body.status;
    if (!status || (typeof status === 'string' && status.trim() === '')) {
      if (canApproveBookings(ctx)) {
        status = "approved"; // Admin/operations auto-approve
      } else {
        // User role - check plan
        // For now, auto-approve on starter plan, pending on pro
        // This can be enhanced later with plan checking
        status = ctx.plan === "starter" ? "approved" : "pending";
      }
    }
    
    // Validate status value
    if (status && !['approved', 'pending', 'rejected'].includes(status)) {
      console.warn(`[POST /api/schedule-items] Invalid status value: ${status}, defaulting to 'approved'`);
      status = "approved";
    }

    // Ensure date is a string (ISO format) before passing to storage
    let dateValue: string;
    
    // Check if date exists and handle it safely
    if (body.date !== undefined && body.date !== null) {
      try {
        if (typeof body.date === 'string') {
          // Validate it's a valid date string
          const dateObj = new Date(body.date);
          if (isNaN(dateObj.getTime())) {
            throw new Error(`Invalid date string: ${body.date}`);
          }
          dateValue = dateObj.toISOString();
        } else if (body.date && typeof body.date === 'object' && 'toISOString' in body.date && typeof body.date.toISOString === 'function') {
          // It's a Date-like object - only call toISOString if it's actually a Date instance
          if (body.date instanceof Date) {
            if (isNaN(body.date.getTime())) {
              throw new Error('Invalid Date object');
            }
            dateValue = body.date.toISOString();
          } else {
            // It's not a Date but has toISOString - don't call it, convert it
            const dateObj = new Date(body.date as any);
            if (isNaN(dateObj.getTime())) {
              throw new Error(`Invalid date value: ${JSON.stringify(body.date)}`);
            }
            dateValue = dateObj.toISOString();
          }
        } else {
          // Try to convert to Date
          const dateObj = new Date(body.date as any);
          if (isNaN(dateObj.getTime())) {
            throw new Error(`Invalid date value: ${JSON.stringify(body.date)}`);
          }
          dateValue = dateObj.toISOString();
        }
      } catch (dateError: any) {
        console.error('[POST /api/schedule-items] Date conversion error:', {
          dateValue: body.date,
          dateType: typeof body.date,
          error: dateError?.message || String(dateError),
        });
        throw new Error(`Invalid date: ${dateError?.message || String(dateError)}`);
      }
    } else {
      // Default to today if no date provided
      console.warn('[POST /api/schedule-items] No date provided, using today');
      dateValue = new Date().toISOString();
    }

    // Prepare item data - ensure all fields are properly typed
    // Drizzle timestamp() expects a Date object, not a string
    const itemData: any = {
      type: body.type,
      crewId: body.crewId,
      depotId: body.depotId,
      date: new Date(dateValue), // Convert ISO string to Date object for Drizzle
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      requestedBy: ctx.userId,
      status,
      jobStatus: body.jobStatus || 'booked', // Default to 'booked' if not provided
    };

    // Add optional fields only if they exist
    if (body.customer) itemData.customer = body.customer;
    if (body.jobNumber) itemData.jobNumber = body.jobNumber;
    if (body.address) itemData.address = body.address;
    if (body.projectManager) itemData.projectManager = body.projectManager;
    if (body.startTime) itemData.startTime = body.startTime;
    if (body.onsiteTime) itemData.onsiteTime = body.onsiteTime;
    if (body.color) itemData.color = body.color;
    if (body.duration !== undefined) itemData.duration = Number(body.duration) || null;
    if (body.employeeId) itemData.employeeId = body.employeeId;
    if (body.vehicleId) itemData.vehicleId = body.vehicleId;
    if (body.noteContent) itemData.noteContent = body.noteContent;

    console.log('[POST /api/schedule-items] Creating item with data:', {
      type: itemData.type,
      date: itemData.date,
      dateType: typeof itemData.date,
      dateLength: itemData.date ? String(itemData.date).length : 0,
      crewId: itemData.crewId,
      depotId: itemData.depotId,
      employeeId: itemData.employeeId,
      vehicleId: itemData.vehicleId,
    });

    try {
      console.log('[POST /api/schedule-items] Calling storage.createScheduleItem...');
      const item = await storage.createScheduleItem(itemData);
      console.log('[POST /api/schedule-items] Item created successfully:', item.id);
      console.log('[POST /api/schedule-items] Item date type:', typeof item.date, item.date instanceof Date ? 'Date' : 'not Date');
      
      // Safely convert response - ensure all Date objects are converted to strings
      // Drizzle returns Date objects for timestamp fields, we need to convert them
      const responseItem: any = {};
      for (const key in item) {
        const value = (item as any)[key];
        
        // Handle Date objects - only call toISOString on actual Date instances
        if (value instanceof Date) {
          try {
            if (!isNaN(value.getTime())) {
              responseItem[key] = value.toISOString();
            } else {
              responseItem[key] = null;
            }
          } catch (e) {
            console.error(`[POST /api/schedule-items] Error converting date field ${key}:`, e);
            responseItem[key] = null;
          }
        } else if (value === null || value === undefined) {
          responseItem[key] = value;
        } else if (typeof value === 'object' && value !== null) {
          // For objects, check if they have toISOString but aren't Dates - don't call it
          if ('toISOString' in value && typeof (value as any).toISOString === 'function' && !(value instanceof Date)) {
            // It has toISOString but isn't a Date - convert to string safely without calling toISOString
            try {
              responseItem[key] = JSON.stringify(value);
            } catch {
              responseItem[key] = String(value);
            }
          } else {
            // Regular object - copy as-is (NextResponse.json will handle it)
            responseItem[key] = value;
          }
        } else {
          // Primitives - copy as-is
          responseItem[key] = value;
        }
      }

      console.log('[POST /api/schedule-items] Response item date:', responseItem.date, typeof responseItem.date);
      
      // Use JSON.stringify with a replacer to safely serialize, then parse back
      // This ensures all Date objects are converted to strings
      const safeJsonString = JSON.stringify(responseItem, (key, value) => {
        // Only call toISOString on actual Date instances
        if (value instanceof Date) {
          try {
            if (!isNaN(value.getTime())) {
              return value.toISOString();
            }
            return null;
          } catch {
            return null;
          }
        }
        // For any other value, return as-is
        return value;
      });
      
      return NextResponse.json(JSON.parse(safeJsonString), { status: 201 });
    } catch (storageError: any) {
      console.error('[POST /api/schedule-items] Storage error:', {
        message: storageError?.message,
        errorType: storageError?.constructor?.name,
        stack: storageError?.stack?.substring(0, 500),
      });
      throw storageError;
    }
  } catch (err: any) {
    // Ensure error message is always a string
    let errorMsg = "Failed to create schedule item";
    if (err && typeof err.message === 'string') {
      errorMsg = err.message;
    } else if (err && typeof err === 'string') {
      errorMsg = err;
    } else if (err) {
      errorMsg = String(err);
    }
    
    console.error('[POST /api/schedule-items] Error:', {
      message: errorMsg,
      errorType: err?.constructor?.name,
      body: body ? JSON.stringify(body).substring(0, 200) : 'null',
    });
    
    return NextResponse.json(
      { error: errorMsg },
      { status: 400 }
    );
  }
}


