# Role Management Guide

## ✅ Automatic Admin Assignment on Registration

**Yes, it's already working!** When a user registers:

1. **User Account Created** - A new user account is created
2. **Organization Created** - A new organization is automatically created for them
3. **Admin Role Assigned** - The user is automatically assigned the **"admin"** role in their organization (see `app/api/register/route.ts` line 73)

This means:
- ✅ The person who signs up (pays) automatically becomes an admin
- ✅ They can immediately manage depots, crews, employees, vehicles
- ✅ They can invite team members and assign roles
- ✅ They have full access to all features

## Role Permissions

### Admin
- ✅ Full access to all features
- ✅ Create/edit/delete depots, crews, employees, vehicles
- ✅ Create/edit/delete schedule items (bookings)
- ✅ Approve/reject bookings
- ✅ Manage team members (invite, assign roles, remove)
- ✅ Access team management UI

### Operations (formerly "office")
- ✅ Create/edit/delete depots, crews, employees, vehicles
- ✅ Create/edit/delete schedule items (bookings)
- ✅ Approve/reject bookings
- ❌ Cannot manage team members

### User (formerly "worker")
- ✅ View schedule items
- ✅ Create bookings (auto-approved on Starter plan, pending on Pro plan)
- ❌ Cannot manage depots, crews, employees, vehicles
- ❌ Cannot edit/delete existing bookings
- ❌ Cannot approve bookings

## How to Update User Roles

### Method 1: Using the Script (Easiest)

```bash
cd apps/scheduler
npm run update-role <username> <role>
```

Example:
```bash
npm run update-role mike.moss admin
npm run update-role john.doe operations
npm run update-role jane.smith user
```

### Method 2: Direct SQL (Neon Database)

1. **Connect to your Neon database:**
```bash
psql 'postgresql://neondb_owner:npg_ZkFQ9TX1Cinq@ep-long-sun-ahe2vb71-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
```

2. **Check current role:**
```sql
SELECT 
  u.username,
  om.role as membership_role,
  o.name as organization_name
FROM users u
JOIN organization_memberships om ON u.id = om.user_id
JOIN organizations o ON om.organization_id = o.id
WHERE u.username = 'mike.moss';
```

3. **Update role:**
```sql
UPDATE organization_memberships
SET role = 'admin'
WHERE user_id = (SELECT id FROM users WHERE username = 'mike.moss');
```

### Method 3: Using Team Management UI

If you're logged in as an admin:
1. Go to Settings → Team Management
2. Find the user in the list
3. Click the role dropdown next to their name
4. Select the new role
5. Changes take effect immediately

## Team Invites

Admins can invite team members through the Team Management UI:
1. Click "Invite Team Member"
2. Enter email address
3. Select role (admin, operations, or user)
4. Copy the invite link and send it to the user
5. User clicks the link and completes registration

## Troubleshooting

### "Access denied" when trying to create depots

**Problem:** User doesn't have admin or operations role

**Solution:**
1. Check their role: `npm run update-role <username>`
2. Update to admin: `npm run update-role <username> admin`
3. User needs to log out and log back in

### User can't see Team Management

**Problem:** User doesn't have admin role

**Solution:** Update their role to admin using one of the methods above

### New user registered but can't access features

**Check:**
1. Verify they have a membership: `SELECT * FROM organization_memberships WHERE user_id = '<user_id>';`
2. Verify the role is set: Should be "admin" for new registrations
3. If missing, create membership:
```sql
INSERT INTO organization_memberships (id, user_id, organization_id, role, accepted_at)
VALUES (gen_random_uuid(), '<user_id>', '<org_id>', 'admin', NOW());
```


