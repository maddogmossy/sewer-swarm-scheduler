# How to Update User Roles in the Database

## Method 1: Using SQL (Direct Database Access)

### Connect to your Neon database:
```bash
psql 'postgresql://neondb_owner:npg_ZkFQ9TX1Cinq@ep-long-sun-ahe2vb71-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
```

### Find your user ID:
```sql
SELECT id, username, email FROM users WHERE username = 'mike.moss';
```

### Check current membership role:
```sql
SELECT 
  u.username,
  u.email,
  om.role as membership_role,
  o.name as organization_name
FROM users u
JOIN organization_memberships om ON u.id = om.user_id
JOIN organizations o ON om.organization_id = o.id
WHERE u.username = 'mike.moss';
```

### Update role to admin:
```sql
UPDATE organization_memberships
SET role = 'admin'
WHERE user_id = (SELECT id FROM users WHERE username = 'mike.moss');
```

### Update role to operations:
```sql
UPDATE organization_memberships
SET role = 'operations'
WHERE user_id = (SELECT id FROM users WHERE username = 'mike.moss');
```

### Update role to user:
```sql
UPDATE organization_memberships
SET role = 'user'
WHERE user_id = (SELECT id FROM users WHERE username = 'mike.moss');
```

## Method 2: Using the API (If you have admin access)

If you're logged in as an admin, you can use the Team Management UI:
1. Go to Settings/Team Management
2. Find the user
3. Change their role from the dropdown

## Method 3: Create a Script

See `update-user-role.js` for a Node.js script to update roles programmatically.

