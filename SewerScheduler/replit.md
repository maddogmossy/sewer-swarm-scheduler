# Sewer Swarm - Crew Scheduling Application

## Overview

Sewer Swarm is a drag-and-drop crew scheduling platform designed for drainage, civils, CCTV surveying, jetting, and utility contractors. The application provides intelligent workforce optimization with AI-driven logic, conflict detection, and real-time crew visibility across multiple depots.

**Core Purpose:** Enable contractors to efficiently schedule jobs, operatives, assistants, and vehicles across multiple crews and depots with visual calendar management and automated conflict detection.

**Key Features:**
- Drag-and-drop calendar interface for scheduling
- Multi-depot crew management
- Employee and vehicle resource tracking
- Smart search for crew availability
- Email notifications for scheduled staff
- Color-coded job categorization
- Batch operations (duplicate to week, month, year)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework:** React with TypeScript using Vite as the build tool

**UI Component Library:** 
- shadcn/ui components (Radix UI primitives)
- Tailwind CSS for styling with custom "Sewer Swarm" theme (clean blue-gray palette)
- Custom CSS variables for theming in `index.css`

**State Management:**
- TanStack Query (React Query) for server state management
- Local React state for UI interactions
- Session-based authentication state

**Drag-and-Drop:** 
- @dnd-kit/core for drag-and-drop functionality
- @dnd-kit/sortable for sortable lists
- Used extensively in CalendarGrid component for scheduling items

**Routing:** 
- Wouter for client-side routing
- Two main routes: home (landing/auth) and schedule (main app)

**Form Handling:**
- react-hook-form for form state
- zod for schema validation via @hookform/resolvers

**Key UI Patterns:**
- Modal-based workflows for creating/editing resources
- Context menus and dropdown menus for quick actions
- Responsive sidebar with collapse functionality
- Calendar grid with crew rows and date columns

### Backend Architecture

**Server Framework:** Express.js with TypeScript

**API Design:** RESTful API with session-based authentication

**Authentication:**
- express-session for session management
- bcrypt for password hashing
- Session cookies with httpOnly and sameSite flags

**Middleware:**
- JSON body parsing with raw body capture for webhook support
- Request logging with duration tracking
- Authentication middleware (`requireAuth`)

**Development Server:**
- Vite middleware integration for HMR in development
- Static file serving in production
- Custom error handling

### Data Storage

**Database:** PostgreSQL via Neon serverless driver (`@neondatabase/serverless`)

**ORM:** Drizzle ORM with node-postgres driver

**Schema Design:**
- Organizations table for multi-tenant data isolation
- Organization memberships with role-based access control (admin, operations, user)
- Team invites for email-based member onboarding with token authentication
- Users table with authentication credentials
- Depots (locations) with address information
- Crews associated with depots and shifts
- Employees with status tracking (active/holiday/sick) and job roles
- Vehicles with status and type categorization
- Schedule items linking crews, employees, vehicles, and jobs with approval workflow
- Color labels for job categorization

**Role-Based Access Control (RBAC):**
- Admin: Full access to all features including team management and billing
- Operations Manager: Manage schedules, approve/reject bookings, manage resources
- Booker/User: Create booking requests (auto-approved on Starter, requires approval on Pro)

**Plan Limits:**
- Starter (£29/mo): 1 depot, 3 crews, 25 employees, 10 vehicles, auto-approval
- Pro (£49/mo): Unlimited depots, 30 crews, 250 employees, 100 vehicles, approval workflow

**Database Features:**
- Cascade deletion for maintaining referential integrity
- UUID primary keys via `gen_random_uuid()`
- Timestamps for audit trails
- Organization-scoped data isolation (all entities linked to organizationId)
- Deterministic organization selection (owned org first, then most recent membership)

**Migration Strategy:** Drizzle Kit for schema migrations stored in `/migrations` directory

### External Dependencies

**Third-Party UI Components:**
- Radix UI primitives for accessible components (dialogs, dropdowns, menus, tooltips, etc.)
- Lucide React for icons
- date-fns for date manipulation
- react-day-picker for calendar components
- vaul for drawer components

**Development Tools:**
- Replit-specific plugins for dev banner and cartographer (development only)
- Vite plugin for runtime error overlay

**Styling:**
- Tailwind CSS v4 (using @import syntax in CSS)
- class-variance-authority for component variants
- clsx and tailwind-merge via cn() utility

**Build Process:**
- Vite for frontend bundling
- esbuild for server-side bundling (ESM format)
- TypeScript compilation checking without emit

**Session Storage:** In-memory session store (suitable for development; would need Redis/database store for production scaling)

**Environment Variables:**
- DATABASE_URL for PostgreSQL connection
- SESSION_SECRET for session encryption
- NODE_ENV for environment detection

**Notable Constraints:**
- Monorepo structure with shared schema between client and server
- Client root is in `/client` directory
- Build output goes to `/dist` (server) and `/dist/public` (client)
- Path aliases: `@/` maps to client/src, `@shared/` maps to shared directory