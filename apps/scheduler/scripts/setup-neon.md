# Neon Database Setup - Step by Step

## Step 1: Sign Up for Neon (Free)

1. Go to **https://neon.tech**
2. Click **"Sign Up"** (you can use GitHub, Google, or email)
3. Complete the signup process

## Step 2: Create a New Project

1. Once logged in, click **"Create Project"**
2. Give it a name (e.g., "Scheduler Dev")
3. Select a region (choose one close to you)
4. Click **"Create Project"**

## Step 3: Get Your Connection String

1. After the project is created, you'll see a dashboard
2. Look for the **"Connection string"** section
3. You'll see something like:
   ```
   postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Click the **"Copy"** button to copy the connection string

## Step 4: Configure Your Local Environment

1. Navigate to the `apps/scheduler` directory
2. Create a file named `.env.local` (if it doesn't exist)
3. Add your Neon connection string:
   ```
   DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
   (Replace with your actual connection string from Step 3)

## Step 5: Test the Connection

1. Make sure your dev server is running: `npm run dev`
2. Visit: `http://localhost:3000/api/check-db`
3. You should see connection status

## Step 6: Run Migrations

1. Visit: `http://localhost:3000/api/migrate` (POST request)
2. Or use this in your browser console:
   ```javascript
   fetch('/api/migrate', { method: 'POST' })
     .then(r => r.json())
     .then(console.log)
   ```
3. You should see: `{ "message": "Database migration completed successfully", "migrated": true }`

## Step 7: Verify Setup

1. Visit: `http://localhost:3000/api/check-db`
2. You should see all tables exist: `{ "connected": true, "tablesExist": true }`

## Troubleshooting

- **Connection fails?** Make sure you copied the entire connection string including `?sslmode=require`
- **Tables missing?** Run the migration again at `/api/migrate`
- **Still having issues?** Check the terminal/console for error messages

## Next Steps

Once your dev database is working:
- You can develop locally without affecting production
- Production will use `PRODUCTION_DATABASE_URL` when deployed
- Your local changes won't affect real customer data



