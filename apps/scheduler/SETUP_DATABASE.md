# Database Setup Guide

## Overview

The application supports **both development and production databases** simultaneously:
- **Development**: Uses `DATABASE_URL` (for local development)
- **Production**: Uses `PRODUCTION_DATABASE_URL` (for AWS RDS with real customers)

The app automatically selects the correct database based on `NODE_ENV`:
- `NODE_ENV=development` → Uses `DATABASE_URL`
- `NODE_ENV=production` → Uses `PRODUCTION_DATABASE_URL` (falls back to `DATABASE_URL` if not set)

## Development Database Setup

### Option 1: Neon (Recommended - Cloud-based, Free Tier)

1. **Sign up at Neon**: https://neon.tech (free tier available)
2. **Create a new project**
3. **Copy the connection string** from the Neon dashboard
   - It will look like: `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb`
4. **Create `.env.local`** in `apps/scheduler/`:
   ```
   DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb
   ```
5. **Restart your dev server**
6. **Run the migration**: Visit `http://localhost:3000/api/migrate` (POST request) or use:
   ```javascript
   fetch('/api/migrate', { method: 'POST' })
     .then(r => r.json())
     .then(console.log)
   ```

### Option 2: Local PostgreSQL

1. **Download PostgreSQL**: https://www.postgresql.org/download/windows/
2. **Install** with default settings
3. **Remember the password** you set for the `postgres` user
4. **Create a database**:
   ```sql
   CREATE DATABASE scheduler;
   ```
5. **Create `.env.local`** in `apps/scheduler/`:
   ```
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/scheduler
   ```
6. **Restart your dev server**
7. **Run the migration** (same as above)

## Production Database Setup

For production deployments, set `PRODUCTION_DATABASE_URL` in your production environment:

```
NODE_ENV=production
PRODUCTION_DATABASE_URL=postgresql://progess:MiMo2101%21@sewer-swam-scheduler.cx00ge2s2t7u.eu-north-1.rds.amazonaws.com:5432/postgres
```

**Important Notes:**
- Production uses AWS RDS which requires SSL (automatically enabled)
- Make sure your production server's IP is whitelisted in the AWS RDS security group
- Never commit production credentials to version control
- Use environment variables or secrets management in your deployment platform

## Environment Variables Summary

### Development (`.env.local`)
```bash
# Development database (local or Neon)
DATABASE_URL=postgresql://user:password@localhost:5432/scheduler
# or
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb
```

### Production (Environment Variables)
```bash
NODE_ENV=production
# Production database (AWS RDS)
PRODUCTION_DATABASE_URL=postgresql://user:password@your-rds-instance.rds.amazonaws.com:5432/postgres
# Optional: Keep DATABASE_URL as fallback
DATABASE_URL=postgresql://user:password@localhost:5432/scheduler
```

## Benefits of This Setup

✅ **Safe Development**: Develop locally without affecting production data  
✅ **Automatic Selection**: App chooses the right database based on environment  
✅ **Easy Testing**: Test with real data structure without risk  
✅ **Production Safety**: Production always uses the dedicated production database

