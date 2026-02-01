# Deployment Guide: Sewer Swarm Scheduler to Vercel

This guide walks you through deploying your scheduler application to Vercel and connecting it to your production database and custom domain.

## Overview

✅ **Yes, Vercel auto-deploys from GitHub!** When you push to your main branch, Vercel will automatically:
- Detect the changes
- Build your Next.js application
- Deploy to production
- Update your live site

---

## Step 1: Set Up Production Database

### Recommended: Neon PostgreSQL (Same as Dev)

Since you're already using Neon for development and it's working well, **we recommend using Neon for production too**. This gives you:
- ✅ Consistent setup (same provider for dev and prod)
- ✅ Easy connection (no AWS security group issues)
- ✅ Automatic backups and point-in-time recovery
- ✅ Serverless scaling
- ✅ Simple connection strings

### Option A: Neon PostgreSQL (Recommended)

1. **Create Production Project in Neon:**
   - Go to https://neon.tech
   - Sign in to your existing account (or create one)
   - Click "Create Project"
   - Name it: `sewer-swarm-scheduler-prod` (or similar)
   - Choose PostgreSQL version 15 or 16
   - Select a region close to your users (e.g., `us-east-1` for US, `eu-west-1` for Europe)

2. **Get Production Connection String:**
   - In Neon dashboard, go to your production project
   - Click "Connection Details" or "Connection String"
   - Copy the connection string
   - Format: `postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require`
   - **Important:** Use the "Pooled connection" string for better performance with Vercel

3. **Neon Features You Get:**
   - Automatic backups (7-day retention on free tier, longer on paid)
   - Point-in-time recovery
   - Branching (create database branches for testing)
   - Connection pooling (better for serverless)
   - No security group configuration needed!

### Option B: AWS RDS PostgreSQL (Alternative)

If you prefer AWS RDS or need specific AWS features:

1. **Create RDS Instance:**
   - Go to AWS Console → RDS → Create Database
   - Choose PostgreSQL (version 15 or 16)
   - Select appropriate instance size
   - Set database name: `sewerswarmscheduler`
   - Set master username and password (save these!)
   - **Important:** Enable "Publicly accessible" if you want Vercel to connect
   - Or use VPC with proper security groups

2. **Get Connection String:**
   ```
   postgresql://username:password@your-db-instance.region.rds.amazonaws.com:5432/sewerswarmscheduler?sslmode=require
   ```

3. **Security Group Configuration:**
   - Allow inbound connections on port 5432
   - Source: Vercel IP ranges (or 0.0.0.0/0 for testing, then restrict)

---

## Step 2: Deploy to Vercel

### 2.1 Connect GitHub Repository

1. **Go to Vercel:**
   - Visit https://vercel.com
   - Sign in with your GitHub account

2. **Import Project:**
   - Click "Add New..." → "Project"
   - Select your `sewer-swarm-scheduler` repository
   - Vercel will auto-detect it's a Next.js app

3. **Configure Project:**
   - **Root Directory:** Set to `apps/scheduler` (important!)
   - **Framework Preset:** Next.js (auto-detected)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)

### 2.2 Configure Environment Variables

**Before deploying, add these environment variables in Vercel:**

Go to: Project Settings → Environment Variables

#### Required Variables:

```
# Database (Production) - Use Neon connection string
PRODUCTION_DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require

# Note: Your app will use PRODUCTION_DATABASE_URL in production (NODE_ENV=production)
# For development, keep using DATABASE_URL in your local .env.local file

# Environment
NODE_ENV=production

# Stripe (if using payments)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Stripe Test Keys (for testing)
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
```

**Important Notes:**
- Add these to **Production**, **Preview**, and **Development** environments
- For Production, use your live Stripe keys
- For Preview/Development, you can use test keys

### 2.3 Deploy

1. Click "Deploy"
2. Vercel will:
   - Install dependencies
   - Build your Next.js app
   - Deploy to a `.vercel.app` domain
3. First deployment takes 2-5 minutes

---

## Step 3: Run Database Migrations

After deployment, you need to create the database tables:

### Option A: Using Vercel CLI (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Link Project:**
   ```bash
   cd apps/scheduler
   vercel link
   ```

4. **Run Migration via API:**
   - Visit: `https://your-app.vercel.app/api/migrate`
   - Or use curl:
     ```bash
     curl -X POST https://your-app.vercel.app/api/migrate
     ```

### Option B: Direct Database Connection

1. Connect to your production database using a PostgreSQL client
2. Run the migration SQL manually (check `drizzle` migration files)

---

## Step 4: Configure Custom Domain (sewerswarmscheduler.com)

### 4.1 In Vercel Dashboard

1. **Go to Project Settings → Domains**
2. **Add Domain:**
   - Enter: `sewerswarmscheduler.com`
   - Also add: `www.sewerswarmscheduler.com` (optional)

3. **Vercel will show DNS records to add:**
   - Type: `A` or `CNAME`
   - Name: `@` or `sewerswarmscheduler.com`
   - Value: Vercel's IP or CNAME target

### 4.2 Configure DNS at Your Domain Registrar

**If using sewerswarmscheduler.com:**

1. **Go to your domain registrar** (GoDaddy, Namecheap, etc.)
2. **Find DNS Management / DNS Settings**
3. **Add DNS Records:**

   **Option A: A Record (if Vercel provides IP):**
   ```
   Type: A
   Name: @
   Value: [Vercel IP address]
   TTL: 3600
   ```

   **Option B: CNAME (Recommended):**
   ```
   Type: CNAME
   Name: @
   Value: cname.vercel-dns.com
   TTL: 3600
   ```

   **For www subdomain:**
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   TTL: 3600
   ```

4. **Wait for DNS Propagation:**
   - Can take 5 minutes to 48 hours
   - Usually works within 1-2 hours
   - Check with: `nslookup sewerswarmscheduler.com`

### 4.3 SSL Certificate

- Vercel automatically provisions SSL certificates via Let's Encrypt
- HTTPS will be enabled automatically once DNS propagates
- No additional configuration needed!

---

## Step 5: Verify Deployment

### 5.1 Check Health Endpoint

Visit: `https://sewerswarmscheduler.com/api/health`

Should return:
```json
{
  "status": "ok",
  "database": "connected"
}
```

### 5.2 Test Database Connection

1. Visit: `https://sewerswarmscheduler.com/api/check-db`
2. Should show tables exist and connection is working

### 5.3 Seed Initial Data (Optional)

If you need sample data:
```bash
curl -X POST https://sewerswarmscheduler.com/api/seed
```

---

## Step 6: Continuous Deployment Setup

### Automatic Deployments

✅ **Already configured!** When you:
1. Push to `main` branch → Production deployment
2. Push to other branches → Preview deployment
3. Create Pull Request → Preview deployment

### Manual Deployment

You can also trigger deployments from:
- Vercel Dashboard → Deployments → "Redeploy"
- GitHub Actions (if configured)
- Vercel CLI: `vercel --prod`

---

## Troubleshooting

### Database Connection Issues

**Error: "Database connection failed"**

1. **If Using Neon (Recommended):**
   - Verify connection string is correct (copy from Neon dashboard)
   - Use "Pooled connection" string for better performance
   - Ensure `?sslmode=require` is in the connection string
   - Check Neon dashboard for any connection limits or issues

2. **If Using AWS RDS:**
   - Check Security Groups: Ensure port 5432 is open
   - Allow Vercel IP ranges or 0.0.0.0/0 (for testing, then restrict)
   - Verify RDS instance is publicly accessible (if needed)

3. **Check Connection String:**
   - Verify `PRODUCTION_DATABASE_URL` is correct
   - Ensure SSL mode is set: `?sslmode=require`
   - Test connection string locally first

4. **Check Environment Variables:**
   - Verify they're set in Vercel dashboard
   - Ensure they're for "Production" environment
   - Check for any typos or extra spaces

### Build Failures

1. **Check Build Logs:**
   - Vercel Dashboard → Deployments → Click on failed deployment
   - Review error messages

2. **Common Issues:**
   - Missing environment variables
   - TypeScript errors
   - Missing dependencies

### Domain Not Working

1. **Check DNS Propagation:**
   ```bash
   nslookup sewerswarmscheduler.com
   dig sewerswarmscheduler.com
   ```

2. **Verify DNS Records:**
   - Ensure A/CNAME records are correct
   - Wait for DNS propagation (up to 48 hours)

3. **Check Vercel Domain Status:**
   - Dashboard → Domains → Check status
   - Should show "Valid Configuration"

---

## Environment Variables Summary

### Production Environment Variables (Vercel)

```
# Neon Production Database (from Neon dashboard)
PRODUCTION_DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require

NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Development Environment Variables (Local)

Keep your `.env.local` file for local development:
```
# Neon Development Database (your existing dev database)
DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require

NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Note:** You'll have two separate Neon projects:
- One for development (in `.env.local`)
- One for production (in Vercel environment variables)

---

## Next Steps After Deployment

1. ✅ **Test the application:**
   - Create an account
   - Test login/registration
   - Create a depot
   - Add schedule items

2. ✅ **Set up monitoring:**
   - Vercel Analytics (optional)
   - Error tracking (Sentry, etc.)

3. ✅ **Backup strategy:**
   - Set up automated database backups
   - AWS RDS: Enable automated backups
   - Neon: Built-in point-in-time recovery

4. ✅ **Performance:**
   - Enable Vercel Edge Functions if needed
   - Optimize images and assets
   - Monitor database performance

---

## Quick Reference

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Project Settings:** Vercel Dashboard → Your Project → Settings
- **Environment Variables:** Settings → Environment Variables
- **Domains:** Settings → Domains
- **Deployments:** Deployments tab
- **Build Logs:** Click on any deployment → View logs

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify environment variables are set correctly
4. Test database connection separately

Good luck with your deployment! 🚀

