# Quick Start: Neon Database Setup

## Option 1: Use the Setup Script (Easiest)

1. **Run the setup script:**
   ```bash
   cd apps/scheduler
   npm run setup:neon
   ```

2. **Follow the prompts:**
   - The script will guide you through the process
   - You'll need your Neon connection string (get it from https://neon.tech)

3. **Restart your dev server:**
   ```bash
   npm run dev
   ```

4. **Test and migrate:**
   - Test connection: http://localhost:3000/api/check-db
   - Run migrations: http://localhost:3000/api/migrate (POST request)

## Option 2: Manual Setup

1. **Sign up at Neon:** https://neon.tech

2. **Create a project** and copy your connection string

3. **Create `.env.local`** in `apps/scheduler/`:
   ```bash
   DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

4. **Restart dev server** and test as above

## Need Help?

See the detailed guide: `scripts/setup-neon.md`


