# Scheduler Migration Plan
## Migrating from Vite/Express to Next.js App Router

**Version:** 2.0  
**Date:** 2025-01-27  
**Based on:** ARCHITECTURE_PROPOSAL.md v1.1  
**Status:** Planning Only - NO CODE MODIFICATIONS

---

## Overview

This document provides a step-by-step plan to migrate the Scheduler application from its current Vite/Express architecture to a Next.js App Router application at `/apps/scheduler` in the Sewer Swarm monorepo.

**Critical Constraints:**
- Target framework: **Next.js App Router** (v16+)
- **Vite must NOT be migrated** - all Vite configs and build processes are discarded
- **Express must NOT be migrated** - all Express server code is replaced with Next.js API routes
- **NO `client/` or `server/` folders** in final app - Next.js App Router structure only
- Existing files are **source material for logic extraction only** - not copied as-is

**Architecture Transformation:**
- Current: Vite frontend + Express backend (separate `client/` and `server/` folders)
- Target: Next.js App Router (unified `app/` directory structure)

---

## Current Structure Analysis

### Source Location
```
SewerScheduler/
├── client/                    # Vite React app (TO BE EXTRACTED)
│   ├── index.html             # DELETE - Next.js handles this
│   ├── public/                # EXTRACT - move to app/public
│   └── src/
│       ├── components/        # REUSE - adapt for Next.js
│       ├── hooks/             # REUSE - mostly as-is
│       ├── lib/               # EXTRACT - adapt API client
│       └── pages/             # REWRITE - convert to app router pages
├── server/                    # Express backend (TO BE EXTRACTED)
│   ├── index.ts               # DELETE - Next.js handles server
│   ├── routes.ts              # REWRITE - convert to API routes
│   ├── db.ts                  # EXTRACT - adapt for Next.js
│   ├── storage.ts             # EXTRACT - business logic
│   ├── rbacMiddleware.ts      # EXTRACT - adapt for Next.js middleware
│   ├── quotaService.ts        # EXTRACT - business logic
│   ├── stripeClient.ts        # EXTRACT - adapt for Next.js
│   ├── stripeService.ts       # EXTRACT - adapt for Next.js
│   ├── webhookHandlers.ts     # EXTRACT - adapt for API route
│   └── vite.ts                # DELETE - Vite-specific
├── shared/                    # REUSE - schema/types
├── migrations/                # REUSE - Drizzle migrations
├── scripts/                   # REUSE - utility scripts
├── attached_assets/           # EXTRACT - move to public/assets
├── package.json               # REWRITE - Next.js dependencies
├── vite.config.ts             # DELETE - not needed
├── drizzle.config.ts          # REUSE - may need path updates
├── postcss.config.js          # REUSE - Tailwind config
├── components.json            # REUSE - shadcn/ui config
└── tsconfig.json              # REWRITE - Next.js TypeScript config
```

### Target Location
```
apps/scheduler/
├── app/                       # Next.js App Router
│   ├── (auth)/                # Auth route group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (main)/                # Main route group
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Home/landing page
│   │   ├── schedule/
│   │   │   └── page.tsx
│   │   └── invite/
│   │       └── [token]/
│   │           └── page.tsx
│   ├── api/                   # API routes
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── route.ts
│   │   │   ├── register/
│   │   │   │   └── route.ts
│   │   │   └── logout/
│   │   │       └── route.ts
│   │   ├── depots/
│   │   │   └── route.ts
│   │   ├── crews/
│   │   │   └── route.ts
│   │   ├── employees/
│   │   │   └── route.ts
│   │   ├── vehicles/
│   │   │   └── route.ts
│   │   ├── schedule/
│   │   │   └── route.ts
│   │   ├── stripe/
│   │   │   ├── webhook/
│   │   │   │   └── [uuid]/
│   │   │   │       └── route.ts
│   │   │   └── route.ts
│   │   └── health/
│   │       └── route.ts
│   ├── actions/               # Server Actions
│   │   ├── auth.ts
│   │   ├── depots.ts
│   │   ├── crews.ts
│   │   ├── employees.ts
│   │   ├── vehicles.ts
│   │   └── schedule.ts
│   ├── layout.tsx             # Root layout
│   ├── loading.tsx
│   ├── error.tsx
│   └── not-found.tsx
├── components/                # React components
│   ├── schedule/              # Schedule-specific components
│   └── ui/                    # shadcn/ui components
├── lib/                       # Utilities and helpers
│   ├── api.ts                 # API client (adapted)
│   ├── db.ts                  # Database connection
│   ├── storage.ts             # Data access layer
│   ├── auth.ts                # Auth utilities
│   ├── rbac.ts                # RBAC utilities
│   ├── quota.ts               # Quota service
│   ├── stripe.ts              # Stripe client
│   └── utils.ts
├── hooks/                     # React hooks
├── middleware.ts              # Next.js middleware (auth, RBAC)
├── shared/                    # Shared schema/types
├── migrations/                # Drizzle migrations
├── scripts/                   # Utility scripts
├── public/                    # Static assets
│   ├── assets/                # From attached_assets
│   ├── favicon.png
│   └── opengraph.jpg
├── package.json
├── next.config.js             # Next.js configuration
├── tsconfig.json
├── drizzle.config.ts
├── postcss.config.js
├── tailwind.config.ts
└── components.json
```

---

## Phase 1: Pre-Migration Preparation
**Risk Level:** Low  
**Type:** Verification & Setup  
**Stopping Point:** ✅ Monorepo structure verified, Next.js requirements confirmed

### Step 1.1: Verify Monorepo Structure
**Action:** Verify target monorepo exists and has expected structure

**Checklist:**
- [ ] Confirm `/apps/` directory exists at monorepo root
- [ ] Confirm root `package.json` exists with workspace configuration
- [ ] Verify root `tsconfig.json` exists (or note if it needs creation)
- [ ] Check if root-level build tools exist
- [ ] Verify no existing `/apps/scheduler` directory exists
- [ ] Confirm Next.js 16+ is available in monorepo (or will be installed)

**Manual Verification Required:** Yes  
**Notes:** If monorepo doesn't exist, this plan assumes it will be created first.

### Step 1.2: Analyze Current Dependencies
**Action:** Review current dependencies to identify what's needed for Next.js

**Dependencies to Keep:**
- React 19.2.0 (Next.js compatible)
- React DOM 19.2.0
- All Radix UI components (@radix-ui/*)
- Tailwind CSS and related
- Drizzle ORM and related
- Stripe SDK
- Zod validation
- React Query (@tanstack/react-query)
- All UI component dependencies

**Dependencies to Remove:**
- `vite` and all Vite plugins
- `express` and Express-related packages
- `wouter` (Next.js has built-in routing)
- `@replit/vite-plugin-*` (Replit-specific)
- `esbuild` (Next.js handles bundling)
- `tsx` (Next.js handles TypeScript)

**Dependencies to Add:**
- `next` (16.0.6+)
- `next-auth` or `@auth/core` (for authentication replacement)
- `@next/third-parties` (if needed for Stripe)

**Manual Verification Required:** Yes - create dependency mapping document

---

## Phase 2: Scaffold Fresh Next.js App
**Risk Level:** Low  
**Type:** Mechanical  
**Stopping Point:** ✅ Fresh Next.js app created and runs

### Step 2.1: Create Next.js App
**Action:** Scaffold a fresh Next.js App Router application

**Command:**
```bash
cd apps
npx create-next-app@latest scheduler --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

**Configuration Choices:**
- TypeScript: Yes
- ESLint: Yes (or per monorepo standards)
- Tailwind CSS: Yes
- `src/` directory: No (use `app/` at root)
- App Router: Yes
- Import alias: `@/*` (points to root of app)

**Manual Verification Required:** Yes - verify app starts with `npm run dev`

### Step 2.2: Create Directory Structure
**Action:** Create all required subdirectories

**Directories to Create:**
```
apps/scheduler/
├── app/
│   ├── (auth)/
│   ├── (main)/
│   ├── api/
│   └── actions/
├── components/
│   ├── schedule/
│   └── ui/
├── lib/
├── hooks/
├── shared/
├── migrations/
├── scripts/
└── public/
    └── assets/
```

**Command:**
```bash
cd apps/scheduler
mkdir -p app/{api/{auth/{login,register,logout},depots,crews,employees,vehicles,schedule,stripe/webhook,health},actions} components/{schedule,ui} lib hooks shared migrations scripts public/assets
```

**Manual Verification Required:** Yes - verify all directories created

### Step 2.3: Configure Next.js
**Action:** Set up Next.js configuration files

**Files to Create/Update:**

1. **next.config.js** (create)
   - Configure image domains if needed
   - Set up environment variable handling
   - Configure API routes
   - No Vite-specific configs

2. **tsconfig.json** (update from Next.js default)
   - Update paths: `"@/*": ["./*"]`
   - Add `"@shared/*": ["./shared/*"]` if needed
   - Ensure Next.js types are included

3. **tailwind.config.ts** (update)
   - Configure content paths: `["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"]`
   - Keep existing Tailwind plugins

4. **components.json** (copy and update)
   - Update paths for Next.js structure
   - `components`: `"./components"`
   - `utils`: `"./lib/utils"`

**Manual Verification Required:** Yes - verify TypeScript compiles

---

## Phase 3: UI Component Migration
**Risk Level:** Low  
**Type:** Copy & Adapt  
**Stopping Point:** ✅ All UI components migrated and working

### Step 3.1: Migrate UI Components (shadcn/ui)
**Action:** Copy all UI components from `client/src/components/ui/`

**Files:** All 55 UI component files

**Migration Strategy:** **REUSE AS-IS**
- Copy all `*.tsx` files from `SewerScheduler/client/src/components/ui/` to `apps/scheduler/components/ui/`
- Update imports from `@/components/ui/*` to `@/components/ui/*` (should work as-is)
- Verify no Vite-specific code exists

**Files to Copy:**
```
SewerScheduler/client/src/components/ui/*.tsx
  → apps/scheduler/components/ui/*.tsx
```

**Manual Verification Required:** Yes - verify all components compile

### Step 3.2: Migrate Schedule Components
**Action:** Copy and adapt schedule-specific components

**Files:** All schedule components

**Migration Strategy:** **COPY AND ADAPT**
- Copy from `SewerScheduler/client/src/components/schedule/` to `apps/scheduler/components/schedule/`
- Update imports:
  - `@/components/ui/*` → `@/components/ui/*` (should work)
  - `@/lib/*` → `@/lib/*` (will be updated in Phase 4)
  - `@/hooks/*` → `@/hooks/*` (will be updated in Phase 4)
- Remove any Vite-specific code
- Convert client components that need interactivity to `"use client"` directive

**Files to Copy:**
```
SewerScheduler/client/src/components/schedule/CalendarGrid.tsx
  → apps/scheduler/components/schedule/CalendarGrid.tsx

SewerScheduler/client/src/components/schedule/DepotCrewModal.tsx
  → apps/scheduler/components/schedule/DepotCrewModal.tsx

[... all other schedule components ...]
```

**Manual Verification Required:** Yes - verify components compile (may have import errors until Phase 4)

### Step 3.3: Migrate Hooks
**Action:** Copy React hooks

**Files:** All hook files

**Migration Strategy:** **REUSE AS-IS**
- Copy from `SewerScheduler/client/src/hooks/` to `apps/scheduler/hooks/`
- Most hooks should work as-is
- Update imports to use new paths

**Files to Copy:**
```
SewerScheduler/client/src/hooks/use-mobile.tsx
  → apps/scheduler/hooks/use-mobile.tsx

SewerScheduler/client/src/hooks/use-toast.ts
  → apps/scheduler/hooks/use-toast.ts

SewerScheduler/client/src/hooks/useOrganization.ts
  → apps/scheduler/hooks/useOrganization.ts

SewerScheduler/client/src/hooks/useScheduleData.ts
  → apps/scheduler/hooks/useScheduleData.ts
```

**Manual Verification Required:** Yes

### Step 3.4: Migrate Utilities
**Action:** Copy utility files

**Files:** `utils.ts`, `queryClient.ts`

**Migration Strategy:** **COPY AND ADAPT**
- Copy `SewerScheduler/client/src/lib/utils.ts` to `apps/scheduler/lib/utils.ts` (REUSE AS-IS)
- Copy `SewerScheduler/client/src/lib/queryClient.ts` to `apps/scheduler/lib/queryClient.ts` (REUSE AS-IS)

**Manual Verification Required:** Yes

---

## Phase 4: Business Logic Extraction
**Risk Level:** Medium  
**Type:** Code Extraction & Adaptation  
**Stopping Point:** ✅ All business logic extracted and adapted

### Step 4.1: Extract Database Layer
**Action:** Extract database connection and utilities

**Source:** `SewerScheduler/server/db.ts`

**Migration Strategy:** **COPY AND ADAPT**
- Copy database connection logic
- Remove Express-specific code
- Adapt for Next.js environment
- Keep Drizzle ORM setup
- Handle connection pooling for Next.js

**Target:** `apps/scheduler/lib/db.ts`

**Key Changes:**
- Remove Express session store setup
- Keep Drizzle setup
- Adapt for Next.js server components and API routes
- Handle connection reuse in Next.js context

**Manual Verification Required:** Yes - verify database connection works

### Step 4.2: Extract Storage Layer
**Action:** Extract data access layer

**Source:** `SewerScheduler/server/storage.ts`

**Migration Strategy:** **REUSE AS-IS**
- Copy storage functions
- Update imports to use new `lib/db.ts`
- Should work mostly as-is (database queries don't change)

**Target:** `apps/scheduler/lib/storage.ts`

**Manual Verification Required:** Yes

### Step 4.3: Extract RBAC Logic
**Action:** Extract role-based access control

**Source:** `SewerScheduler/server/rbacMiddleware.ts`

**Migration Strategy:** **REWRITE**
- Extract RBAC logic functions
- Remove Express middleware patterns
- Create Next.js middleware in `middleware.ts`
- Create utility functions in `lib/rbac.ts` for use in API routes and Server Actions

**Targets:**
- `apps/scheduler/middleware.ts` (Next.js middleware for route protection)
- `apps/scheduler/lib/rbac.ts` (RBAC utility functions)

**Key Changes:**
- Convert Express middleware to Next.js middleware
- Adapt session handling for Next.js auth
- Create helper functions for API routes

**Manual Verification Required:** Yes

### Step 4.4: Extract Quota Service
**Action:** Extract quota/plan management logic

**Source:** `SewerScheduler/server/quotaService.ts`

**Migration Strategy:** **REUSE AS-IS**
- Copy quota service functions
- Update imports
- Should work as-is (business logic doesn't change)

**Target:** `apps/scheduler/lib/quota.ts`

**Manual Verification Required:** Yes

### Step 4.5: Extract Stripe Integration
**Action:** Extract Stripe client and service logic

**Sources:**
- `SewerScheduler/server/stripeClient.ts`
- `SewerScheduler/server/stripeService.ts`
- `SewerScheduler/server/webhookHandlers.ts`

**Migration Strategy:** **COPY AND ADAPT**
- Extract Stripe client initialization
- Extract Stripe service functions
- Extract webhook handler logic
- Remove Express-specific code
- Adapt for Next.js API routes

**Targets:**
- `apps/scheduler/lib/stripe.ts` (Stripe client and service)
- `apps/scheduler/app/api/stripe/webhook/[uuid]/route.ts` (webhook handler)

**Key Changes:**
- Remove Express route handlers
- Adapt webhook handling for Next.js API route
- Update Stripe webhook URL configuration

**Manual Verification Required:** Yes

### Step 4.6: Extract Shared Schema
**Action:** Copy shared schema/types

**Source:** `SewerScheduler/shared/schema.ts`

**Migration Strategy:** **REUSE AS-IS**
- Copy schema file
- Should work as-is

**Target:** `apps/scheduler/shared/schema.ts`

**Manual Verification Required:** Yes

### Step 4.7: Extract Migrations
**Action:** Copy database migrations

**Source:** `SewerScheduler/migrations/`

**Migration Strategy:** **REUSE AS-IS**
- Copy all migration files
- Update `drizzle.config.ts` paths if needed

**Target:** `apps/scheduler/migrations/`

**Manual Verification Required:** Yes - verify migrations can run

---

## Phase 5: API Route Creation
**Risk Level:** High  
**Type:** Rewrite  
**Stopping Point:** ✅ All API routes created and tested

### Step 5.1: Analyze Express Routes
**Action:** Map Express routes to Next.js API routes

**Source:** `SewerScheduler/server/routes.ts`

**Route Mapping:**
```
Express Route                    → Next.js API Route
─────────────────────────────────────────────────────
GET  /api/health                 → app/api/health/route.ts
POST /api/register               → app/api/auth/register/route.ts
POST /api/login                  → app/api/auth/login/route.ts
POST /api/logout                 → app/api/auth/logout/route.ts
GET  /api/user                   → app/api/user/route.ts
GET  /api/organization           → app/api/organization/route.ts
GET  /api/depots                 → app/api/depots/route.ts
POST /api/depots                 → app/api/depots/route.ts
[... all other routes ...]
POST /api/stripe/webhook/:uuid   → app/api/stripe/webhook/[uuid]/route.ts
```

### Step 5.2: Create Auth API Routes
**Action:** Convert auth routes from Express to Next.js

**Files to Create:**
- `app/api/auth/register/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`

**Migration Strategy:** **REWRITE**
- Extract logic from `server/routes.ts` auth sections
- Convert Express `req/res` to Next.js `Request/Response`
- Replace Express session with Next.js auth solution
- Use extracted storage functions from `lib/storage.ts`
- Use extracted RBAC functions from `lib/rbac.ts`

**Key Changes:**
- Replace `req.session.userId` with Next.js session/auth
- Replace `req.body` with `await request.json()`
- Replace `res.json()` with `NextResponse.json()`
- Replace `requireAuth` middleware with Next.js auth checks

**Manual Verification Required:** Yes - test all auth endpoints

### Step 5.3: Create Resource API Routes
**Action:** Convert CRUD routes for depots, crews, employees, vehicles

**Files to Create:**
- `app/api/depots/route.ts` (GET, POST)
- `app/api/depots/[id]/route.ts` (GET, PUT, DELETE)
- `app/api/crews/route.ts` (GET, POST)
- `app/api/crews/[id]/route.ts` (GET, PUT, DELETE)
- `app/api/employees/route.ts` (GET, POST)
- `app/api/employees/[id]/route.ts` (GET, PUT, DELETE)
- `app/api/vehicles/route.ts` (GET, POST)
- `app/api/vehicles/[id]/route.ts` (GET, PUT, DELETE)

**Migration Strategy:** **REWRITE**
- Extract logic from `server/routes.ts` for each resource
- Convert Express patterns to Next.js API route handlers
- Use extracted storage and RBAC functions
- Handle query parameters and route params

**Key Changes:**
- Convert route params: `req.params.id` → `params.id` from route handler
- Convert query strings: `req.query` → `searchParams` from `request.nextUrl`
- Replace Express middleware with inline auth checks

**Manual Verification Required:** Yes - test all CRUD operations

### Step 5.4: Create Schedule API Routes
**Action:** Convert schedule-related routes

**Files to Create:**
- `app/api/schedule/route.ts` (GET, POST)
- `app/api/schedule/[id]/route.ts` (GET, PUT, DELETE)
- `app/api/schedule/approve/route.ts` (POST)

**Migration Strategy:** **REWRITE**
- Extract schedule logic from `server/routes.ts`
- Convert to Next.js API routes
- Handle approval workflow

**Manual Verification Required:** Yes

### Step 5.5: Create Stripe Webhook Route
**Action:** Convert Stripe webhook handler

**File to Create:**
- `app/api/stripe/webhook/[uuid]/route.ts`

**Migration Strategy:** **REWRITE**
- Extract webhook logic from `server/index.ts` and `server/webhookHandlers.ts`
- Convert Express raw body handling to Next.js
- Use Next.js route params for UUID

**Key Changes:**
- Handle raw request body for Stripe signature verification
- Use Next.js route params: `params.uuid`
- Adapt webhook handler functions

**Manual Verification Required:** Yes - test webhook endpoint

### Step 5.6: Create Health Check Route
**Action:** Create health check endpoint

**File to Create:**
- `app/api/health/route.ts`

**Migration Strategy:** **REWRITE**
- Simple health check endpoint
- Check database connection status

**Manual Verification Required:** Yes

---

## Phase 6: Server Actions Creation
**Risk Level:** Medium  
**Type:** Rewrite  
**Stopping Point:** ✅ Server Actions created for mutations

### Step 6.1: Create Auth Server Actions
**Action:** Create Server Actions for auth operations

**File to Create:**
- `app/actions/auth.ts`

**Functions to Create:**
- `registerUser()`
- `loginUser()`
- `logoutUser()`

**Migration Strategy:** **REWRITE**
- Extract auth logic from API routes
- Convert to Server Actions
- Use Next.js auth for session management
- Return appropriate responses for form actions

**Manual Verification Required:** Yes

### Step 6.2: Create Resource Server Actions
**Action:** Create Server Actions for CRUD operations

**Files to Create:**
- `app/actions/depots.ts`
- `app/actions/crews.ts`
- `app/actions/employees.ts`
- `app/actions/vehicles.ts`
- `app/actions/schedule.ts`

**Migration Strategy:** **REWRITE**
- Extract mutation logic from API routes
- Convert to Server Actions with `"use server"` directive
- Use extracted storage functions
- Use extracted RBAC functions
- Handle validation and errors

**Key Benefits:**
- Better form integration
- Progressive enhancement
- Reduced client-side code

**Manual Verification Required:** Yes - test all Server Actions

---

## Phase 7: Page Migration
**Risk Level:** High  
**Type:** Rewrite  
**Stopping Point:** ✅ All pages converted to App Router

### Step 7.1: Create Root Layout
**Action:** Create root layout with providers

**File to Create:**
- `app/layout.tsx`

**Migration Strategy:** **REWRITE**
- Extract provider setup from `client/src/App.tsx`
- Set up QueryClientProvider
- Set up TooltipProvider
- Set up Toaster
- Add metadata
- Add global styles

**Source Reference:** `SewerScheduler/client/src/App.tsx`

**Manual Verification Required:** Yes

### Step 7.2: Migrate Home Page
**Action:** Convert home/landing page

**File to Create:**
- `app/(main)/page.tsx`

**Migration Strategy:** **COPY AND ADAPT**
- Copy from `SewerScheduler/client/src/pages/home.tsx`
- Remove Wouter routing
- Update imports
- Convert to Server Component if possible, or add `"use client"` if needed

**Manual Verification Required:** Yes

### Step 7.3: Migrate Schedule Page
**Action:** Convert schedule page

**File to Create:**
- `app/(main)/schedule/page.tsx`

**Migration Strategy:** **COPY AND ADAPT**
- Copy from `SewerScheduler/client/src/pages/schedule.tsx`
- Remove Wouter routing
- Update imports
- Likely needs `"use client"` due to interactivity
- Update data fetching to use React Query or Server Components

**Manual Verification Required:** Yes

### Step 7.4: Migrate Auth Pages
**Action:** Convert login and register pages

**Files to Create:**
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`

**Migration Strategy:** **COPY AND ADAPT**
- Extract from `SewerScheduler/client/src/pages/auth.tsx` (if combined)
- Or copy separate login/register components
- Update to use Server Actions for form submission
- Remove Wouter routing

**Manual Verification Required:** Yes

### Step 7.5: Migrate Accept Invite Page
**Action:** Convert invite acceptance page

**File to Create:**
- `app/(main)/invite/[token]/page.tsx`

**Migration Strategy:** **COPY AND ADAPT**
- Copy from `SewerScheduler/client/src/pages/accept-invite.tsx`
- Use Next.js dynamic route params: `params.token`
- Update imports
- Remove Wouter routing

**Manual Verification Required:** Yes

### Step 7.6: Create Error and Loading States
**Action:** Create Next.js error and loading boundaries

**Files to Create:**
- `app/error.tsx`
- `app/loading.tsx`
- `app/not-found.tsx`

**Migration Strategy:** **REWRITE**
- Create Next.js error boundary
- Create loading UI
- Copy 404 page from `SewerScheduler/client/src/pages/not-found.tsx`

**Manual Verification Required:** Yes

---

## Phase 8: API Client Adaptation
**Risk Level:** Medium  
**Type:** Adapt  
**Stopping Point:** ✅ API client works with Next.js API routes

### Step 8.1: Adapt API Client
**Action:** Update API client for Next.js

**Source:** `SewerScheduler/client/src/lib/api.ts`

**Target:** `apps/scheduler/lib/api.ts`

**Migration Strategy:** **COPY AND ADAPT**
- Copy API client functions
- Update base URL handling (Next.js can use relative URLs)
- Update fetch calls to work with Next.js API routes
- Keep React Query integration
- Update type definitions if needed

**Key Changes:**
- Remove absolute URL construction (use relative paths)
- Ensure cookies are sent with requests
- Handle Next.js API route responses

**Manual Verification Required:** Yes - test all API calls

---

## Phase 9: Auth Replacement
**Risk Level:** High  
**Type:** Rewrite  
**Stopping Point:** ✅ Auth system replaced and working

### Step 9.1: Choose Auth Solution
**Action:** Select Next.js-compatible auth solution

**Options:**
- NextAuth.js (Auth.js) v5
- Custom session management with cookies
- Other Next.js auth libraries

**Recommendation:** NextAuth.js v5 (Auth.js) for comprehensive auth solution

### Step 9.2: Install and Configure Auth
**Action:** Set up chosen auth solution

**Steps:**
- Install auth package
- Create auth configuration
- Set up providers (if using NextAuth.js)
- Configure session strategy
- Set up database adapter (if needed)

**Files to Create:**
- `lib/auth.ts` or `lib/auth.config.ts`
- Update `middleware.ts` for auth protection

### Step 9.3: Replace Passport Logic
**Action:** Replace Passport.js authentication

**Migration Strategy:** **REWRITE**
- Remove Passport.js dependencies
- Replace Passport strategies with chosen auth solution
- Update login/register logic
- Update session handling
- Update protected route checks

**Manual Verification Required:** Yes - test all auth flows

---

## Phase 10: Stripe Integration Replacement
**Risk Level:** Medium  
**Type:** Adapt  
**Stopping Point:** ✅ Stripe integration working with Next.js

### Step 10.1: Update Stripe Client
**Action:** Ensure Stripe client works with Next.js

**Source:** Extracted in Phase 4.5

**Target:** `apps/scheduler/lib/stripe.ts`

**Migration Strategy:** **ADAPT**
- Verify Stripe SDK works in Next.js
- Update webhook URL configuration
- Remove Replit-specific Stripe sync if needed
- Ensure webhook handler works with Next.js API route

**Key Changes:**
- Update webhook URL to Next.js app URL
- Verify raw body handling in webhook route
- Test Stripe webhook delivery

**Manual Verification Required:** Yes - test Stripe checkout and webhooks

---

## Phase 11: Static Assets Migration
**Risk Level:** Low  
**Type:** Mechanical  
**Stopping Point:** ✅ All assets migrated

### Step 11.1: Migrate Public Assets
**Action:** Copy public assets

**Files to Copy:**
```
SewerScheduler/client/public/favicon.png
  → apps/scheduler/public/favicon.png

SewerScheduler/client/public/opengraph.jpg
  → apps/scheduler/public/opengraph.jpg
```

**Migration Strategy:** **REUSE AS-IS**

### Step 11.2: Migrate Attached Assets
**Action:** Copy attached assets

**Directory to Copy:**
```
SewerScheduler/attached_assets/*
  → apps/scheduler/public/assets/*
```

**Migration Strategy:** **REUSE AS-IS**
- Copy all image and text files
- Update any references in code to use `/assets/` path

**Manual Verification Required:** Yes - verify asset paths work

---

## Phase 12: Configuration Files
**Risk Level:** Medium  
**Type:** Update  
**Stopping Point:** ✅ All configs updated

### Step 12.1: Update package.json
**Action:** Update dependencies for Next.js

**Migration Strategy:** **REWRITE**
- Remove Vite, Express, Wouter dependencies
- Add Next.js and Next.js-compatible packages
- Update scripts:
  - `dev`: `next dev`
  - `build`: `next build`
  - `start`: `next start`
  - `db:push`: `drizzle-kit push` (keep)
- Keep all UI and business logic dependencies

**Manual Verification Required:** Yes

### Step 12.2: Update TypeScript Config
**Action:** Configure TypeScript for Next.js

**Migration Strategy:** **REWRITE**
- Use Next.js TypeScript config as base
- Update paths:
  - `"@/*": ["./*"]`
  - `"@shared/*": ["./shared/*"]`
- Ensure Next.js types are included

**Manual Verification Required:** Yes - verify TypeScript compiles

### Step 12.3: Update Drizzle Config
**Action:** Update Drizzle configuration paths

**Source:** `SewerScheduler/drizzle.config.ts`

**Target:** `apps/scheduler/drizzle.config.ts`

**Migration Strategy:** **COPY AND ADAPT**
- Copy config
- Verify paths:
  - `out`: `"./migrations"` (should work)
  - `schema`: `"./shared/schema.ts"` (should work)

**Manual Verification Required:** Yes - test `db:push`

### Step 12.4: Update Tailwind Config
**Action:** Update Tailwind for Next.js structure

**Migration Strategy:** **COPY AND ADAPT**
- Update content paths:
  - `"./app/**/*.{ts,tsx}"`
  - `"./components/**/*.{ts,tsx}"`
- Keep all Tailwind plugins

**Manual Verification Required:** Yes

### Step 12.5: Update Components Config
**Action:** Update shadcn/ui configuration

**Source:** `SewerScheduler/components.json`

**Target:** `apps/scheduler/components.json`

**Migration Strategy:** **COPY AND ADAPT**
- Update paths:
  - `components`: `"./components"`
  - `utils`: `"./lib/utils"`
  - `css`: `"./app/globals.css"` (or wherever global CSS is)

**Manual Verification Required:** Yes

---

## Phase 13: Cleanup & File Removal
**Risk Level:** Low  
**Type:** Mechanical  
**Stopping Point:** ✅ Unnecessary files removed

### Step 13.1: Delete Vite-Specific Files
**Action:** Remove all Vite configuration and build files

**Files to Delete:**
- `vite.config.ts` (if copied)
- Any Vite-related configs
- `client/index.html` (Next.js handles this)

**Manual Verification Required:** Yes

### Step 13.2: Delete Express-Specific Files
**Action:** Remove Express server files

**Files to Delete:**
- `server/index.ts` (if copied)
- `server/vite.ts` (Vite-specific)
- Any Express middleware files that weren't extracted

**Manual Verification Required:** Yes

### Step 13.3: Delete Replit-Specific Files
**Action:** Remove Replit configuration

**Files to Delete:**
- `replit.md` (if copied)
- Any Replit-specific configs

**Manual Verification Required:** Yes

### Step 13.4: Remove Source Files (Optional)
**Action:** After successful migration, remove source files

**⚠️ WARNING:** Only do this after:
1. All phases complete
2. Application tested and working
3. Backup created
4. Team approval

**Files/Directories to Remove:**
```
SewerScheduler/  (entire directory)
```

**Manual Verification Required:** Yes - confirm migration success before deletion

---

## Phase 14: Testing & Verification
**Risk Level:** Critical  
**Type:** Manual Testing  
**Stopping Point:** ✅ All tests pass

### Step 14.1: TypeScript Compilation
**Action:** Verify TypeScript compiles without errors

**Commands:**
```bash
cd apps/scheduler
npm run build
# or
npx tsc --noEmit
```

**Expected:** No TypeScript errors

**Manual Verification Required:** Yes

### Step 14.2: Dependency Installation
**Action:** Install dependencies and verify

**Commands:**
```bash
# From monorepo root
npm install

# Or from scheduler directory
cd apps/scheduler
npm install
```

**Expected:** All dependencies install successfully

**Manual Verification Required:** Yes

### Step 14.3: Development Server
**Action:** Start development server

**Commands:**
```bash
cd apps/scheduler
npm run dev
```

**Expected:**
- Server starts on port 3000 (Next.js default)
- No runtime errors
- Application accessible in browser
- Hot module reload works

**Manual Verification Required:** Yes - test full application flow

### Step 14.4: Production Build
**Action:** Test production build

**Commands:**
```bash
cd apps/scheduler
npm run build
npm run start
```

**Expected:**
- Build completes successfully
- `.next/` directory created
- No build errors or warnings
- Production server starts

**Manual Verification Required:** Yes

### Step 14.5: Database Migrations
**Action:** Verify database migrations work

**Commands:**
```bash
cd apps/scheduler
npm run db:push
```

**Expected:**
- Migrations run successfully
- Database schema matches expected state

**Manual Verification Required:** Yes - verify database state

### Step 14.6: Application Functionality
**Action:** Test core application features

**Test Cases:**
- [ ] User authentication (login/logout/register)
- [ ] Schedule view loads
- [ ] Drag-and-drop scheduling works
- [ ] Modal dialogs open/close
- [ ] API endpoints respond correctly
- [ ] Database queries execute
- [ ] Stripe integration (checkout, webhooks)
- [ ] Email functionality (if applicable)
- [ ] RBAC permissions work
- [ ] Quota limits enforced

**Manual Verification Required:** Yes - comprehensive testing

---

## File Classification Summary

### Files to REUSE AS-IS
- All UI components (`components/ui/*.tsx`) - 55 files
- Most hooks (`hooks/*.tsx`, `hooks/*.ts`)
- Utility functions (`lib/utils.ts`)
- React Query client (`lib/queryClient.ts`)
- Shared schema (`shared/schema.ts`)
- Database migrations (`migrations/*`)
- Storage layer (`lib/storage.ts` - after extraction)
- Quota service (`lib/quota.ts` - after extraction)
- Static assets (`public/*`)

### Files to COPY AND ADAPT
- Schedule components (`components/schedule/*.tsx`) - 16 files
- API client (`lib/api.ts`)
- Database connection (`lib/db.ts` - after extraction)
- Stripe integration (`lib/stripe.ts` - after extraction)
- Pages (convert to App Router pages)
- Configuration files (update paths)

### Files to FULLY REWRITE
- All API routes (`app/api/**/route.ts`)
- All Server Actions (`app/actions/*.ts`)
- Root layout (`app/layout.tsx`)
- All pages (`app/**/page.tsx`)
- Middleware (`middleware.ts`)
- Auth system (replace Passport)
- `package.json` (dependencies)
- `tsconfig.json` (Next.js config)
- `next.config.js` (new file)

### Files to DELETE
- `client/index.html`
- `server/index.ts`
- `server/vite.ts`
- `vite.config.ts`
- `replit.md`
- All Replit-specific Vite plugins
- Express-specific middleware files (after extraction)

---

## Execution Order Summary

1. **Phase 1:** Pre-Migration Preparation ✅
2. **Phase 2:** Scaffold Fresh Next.js App ✅
3. **Phase 3:** UI Component Migration ✅
4. **Phase 4:** Business Logic Extraction ⚠️ **STOPPING POINT**
5. **Phase 5:** API Route Creation ⚠️ **STOPPING POINT**
6. **Phase 6:** Server Actions Creation ⚠️ **STOPPING POINT**
7. **Phase 7:** Page Migration ⚠️ **STOPPING POINT**
8. **Phase 8:** API Client Adaptation ⚠️ **STOPPING POINT**
9. **Phase 9:** Auth Replacement 🔴 **CRITICAL STOPPING POINT**
10. **Phase 10:** Stripe Integration Replacement ⚠️ **STOPPING POINT**
11. **Phase 11:** Static Assets Migration ✅
12. **Phase 12:** Configuration Files ⚠️ **STOPPING POINT**
13. **Phase 13:** Cleanup ✅
14. **Phase 14:** Full Testing 🚨 **CRITICAL STOPPING POINT**

---

## Risk Assessment Summary

### Low Risk (Mechanical)
- ✅ Phase 1: Pre-Migration Preparation
- ✅ Phase 2: Scaffold Fresh Next.js App
- ✅ Phase 3: UI Component Migration
- ✅ Phase 11: Static Assets Migration
- ✅ Phase 13: Cleanup & File Removal

### Medium Risk (Code Adaptation Required)
- ⚠️ Phase 4: Business Logic Extraction
  - Requires careful extraction and adaptation
  - Database connection patterns change
- ⚠️ Phase 5: API Route Creation
  - Express to Next.js conversion
  - Session handling changes
- ⚠️ Phase 6: Server Actions Creation
  - New pattern to learn
  - Form integration changes
- ⚠️ Phase 7: Page Migration
  - Routing system completely different
  - Component patterns may change
- ⚠️ Phase 8: API Client Adaptation
  - URL handling changes
  - Cookie/session handling
- ⚠️ Phase 10: Stripe Integration Replacement
  - Webhook handling changes
- ⚠️ Phase 12: Configuration Files
  - Multiple configs need updates

### High Risk (Major Rewrite Required)
- 🔴 Phase 9: Auth Replacement
  - Complete auth system rewrite
  - Session management changes
  - Protected routes handling

### Critical Risk (Requires Full Testing)
- 🚨 Phase 14: Testing & Verification
  - Application must work end-to-end
  - All features must be tested
  - Performance verification

---

## Rollback Plan

If migration fails at any point:

1. **Before Phase 13:** Source files still exist, simply delete target directory
2. **After Phase 13:** Restore from backup or git history
3. **Critical Issues:** Revert to original `SewerScheduler/` location

**Backup Recommendation:** 
- Create a backup or git commit before starting migration
- Consider creating a feature branch for the migration
- Keep source files until migration is fully verified

**Rollback Strategy by Phase:**
- **Phases 1-3:** Low risk, easy rollback (delete new app)
- **Phases 4-8:** Medium risk, can rollback if source preserved
- **Phase 9:** High risk, may need to restore auth system
- **Phases 10-12:** Medium risk, configs can be reverted
- **Phase 13:** Point of no return if source deleted
- **Phase 14:** Final verification before source deletion

---

## Notes & Considerations

1. **No Vite Migration:** All Vite configs, build processes, and plugins are discarded. Next.js handles all bundling.

2. **No Express Migration:** All Express server code is replaced with Next.js API routes. Express patterns must be converted.

3. **No Client/Server Folders:** Next.js App Router uses `app/` directory structure. No separate client/server folders.

4. **Routing Changes:** Wouter client-side routing is replaced with Next.js file-based routing. All route definitions move to file system.

5. **Auth System:** Passport.js is replaced with Next.js-compatible auth solution (likely NextAuth.js). Session handling changes significantly.

6. **Server Components:** Consider using React Server Components where possible for better performance. Client components need `"use client"` directive.

7. **API Routes vs Server Actions:** 
   - Use API routes for external integrations (webhooks, third-party APIs)
   - Use Server Actions for form submissions and mutations
   - Both can use extracted business logic

8. **Environment Variables:** Next.js handles env vars differently. Update `.env` files and access patterns.

9. **Database Connection:** Next.js may require different connection pooling strategies. Verify database connections work in server components and API routes.

10. **Stripe Webhooks:** Webhook URL changes to Next.js app URL. Verify Stripe webhook configuration.

11. **Replit-Specific Code:** All Replit-specific code (Vite plugins, Replit domains) should be removed.

12. **TypeScript Paths:** Update all import paths to work with Next.js structure. Verify `@/*` and `@shared/*` aliases work.

13. **Build Output:** Next.js creates `.next/` directory instead of `dist/`. Update any deployment configs.

14. **Static Assets:** Move from `client/public/` to `public/`. Update asset references in code.

---

## Estimated Time

- **Phase 1:** 30 minutes (setup and analysis)
- **Phase 2:** 45 minutes (scaffold and configure)
- **Phase 3:** 60 minutes (component migration)
- **Phase 4:** 120 minutes (business logic extraction)
- **Phase 5:** 180 minutes (API route creation)
- **Phase 6:** 90 minutes (Server Actions)
- **Phase 7:** 120 minutes (page migration)
- **Phase 8:** 60 minutes (API client)
- **Phase 9:** 180 minutes (auth replacement)
- **Phase 10:** 90 minutes (Stripe integration)
- **Phase 11:** 30 minutes (assets)
- **Phase 12:** 60 minutes (configs)
- **Phase 13:** 30 minutes (cleanup)
- **Phase 14:** 240 minutes (testing)

**Total Estimated Time:** ~20-25 hours (including testing and verification)

**Note:** This is a significant migration. Consider breaking into smaller phases with testing between each.

---

## End of Plan

This migration plan is designed to be followed step-by-step with clear stopping points and verification steps. Do not proceed to the next phase until the current phase is verified complete.

**Remember:** This is a planning document only. No code modifications should be made until this plan is approved and execution begins.

**Key Principles:**
- Extract logic, don't copy infrastructure
- Next.js App Router structure only
- No Vite, Express, or Replit-specific code
- Test thoroughly at each stopping point
- Keep source files until migration verified
