# Neon Production Database Setup

This guide walks you through setting up a Neon PostgreSQL database specifically for production.

## Why Neon for Production?

✅ **Same provider as dev** - Consistent setup, no learning curve  
✅ **No AWS security groups** - Easier connection setup  
✅ **Automatic backups** - Built-in data protection  
✅ **Serverless scaling** - Handles traffic spikes automatically  
✅ **Connection pooling** - Optimized for serverless (Vercel)  
✅ **Point-in-time recovery** - Restore to any point in time  

## Step 1: Create Production Project in Neon

1. **Go to Neon Dashboard:**
   - Visit https://console.neon.tech
   - Sign in with your account

2. **Create New Project:**
   - Click "New Project" or "+" button
   - **Project Name:** `sewer-swarm-scheduler-prod` (or similar)
   - **PostgreSQL Version:** 15 or 16 (recommended: 16)
   - **Region:** Choose closest to your users:
     - `us-east-1` (N. Virginia) - Good for US East
     - `us-west-2` (Oregon) - Good for US West
     - `eu-west-1` (Ireland) - Good for Europe
     - `ap-southeast-1` (Singapore) - Good for Asia

3. **Click "Create Project"**

## Step 2: Get Connection String

1. **In Neon Dashboard:**
   - Select your production project
   - Go to "Connection Details" or click "Connection String"

2. **Copy Connection String:**
   - **Recommended:** Use "Pooled connection" (better for serverless/Vercel)
   - Format: `postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require`
   - **Important:** Keep this secure! Don't commit to Git.

3. **Save Connection String:**
   - Copy it to a secure location
   - You'll add it to Vercel environment variables

## Step 3: Configure Neon Settings

### Enable Connection Pooling (Recommended)

1. In Neon dashboard, go to your project
2. Look for "Connection Pooling" settings
3. Enable it if available (some plans include it)
4. Use the pooled connection string for better performance

### Set Up Automatic Backups

1. Neon automatically backs up your database
2. Free tier: 7-day retention
3. Paid plans: Longer retention periods
4. No additional configuration needed!

## Step 4: Test Connection Locally (Optional)

Before deploying, you can test the connection:

1. **Create test file:** `test-prod-db.js`
   ```javascript
   const { Pool } = require('pg');
   
   const pool = new Pool({
     connectionString: 'YOUR_PRODUCTION_CONNECTION_STRING',
     ssl: { rejectUnauthorized: false }
   });
   
   pool.query('SELECT NOW()', (err, res) => {
     if (err) {
       console.error('Connection failed:', err);
     } else {
       console.log('Connection successful!', res.rows[0]);
     }
     pool.end();
   });
   ```

2. **Run test:**
   ```bash
   node test-prod-db.js
   ```

## Step 5: Add to Vercel

1. **Go to Vercel Dashboard:**
   - Select your project
   - Go to Settings → Environment Variables

2. **Add Production Database:**
   - **Key:** `PRODUCTION_DATABASE_URL`
   - **Value:** Your Neon production connection string
   - **Environment:** Select "Production" (and optionally Preview/Development)

3. **Add Other Variables:**
   - `NODE_ENV=production`
   - Your Stripe keys (if using)

## Step 6: Run Migrations

After deploying to Vercel:

1. **Visit migration endpoint:**
   ```
   https://your-app.vercel.app/api/migrate
   ```
   Or use curl:
   ```bash
   curl -X POST https://your-app.vercel.app/api/migrate
   ```

2. **Verify tables created:**
   ```
   https://your-app.vercel.app/api/check-db
   ```

## Step 7: Monitor Your Database

### Neon Dashboard Monitoring

1. **Go to Neon Dashboard:**
   - View connection metrics
   - Check query performance
   - Monitor storage usage

2. **Set Up Alerts (if needed):**
   - Configure alerts for high usage
   - Monitor connection limits

### Vercel Monitoring

1. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → Logs
   - Look for database connection errors

2. **Health Check:**
   - Monitor: `https://your-app.vercel.app/api/health`
   - Should return: `{"status": "ok", "database": "connected"}`

## Best Practices

### 1. Separate Dev and Prod Databases

✅ **Do:**
- Use different Neon projects for dev and prod
- Keep production connection string secure
- Never commit production credentials to Git

❌ **Don't:**
- Use the same database for dev and prod
- Share production credentials
- Hardcode connection strings in code

### 2. Connection String Security

✅ **Do:**
- Store in Vercel environment variables
- Use different passwords for dev/prod
- Rotate passwords periodically

❌ **Don't:**
- Commit to Git
- Share in chat/email
- Use weak passwords

### 3. Database Backups

✅ **Do:**
- Rely on Neon's automatic backups
- Test restore process occasionally
- Consider exporting data periodically

### 4. Performance

✅ **Do:**
- Use pooled connection string for Vercel
- Monitor query performance
- Optimize slow queries

## Troubleshooting

### Connection Timeout

**Issue:** Database connection times out

**Solutions:**
- Check connection string is correct
- Verify `?sslmode=require` is included
- Check Neon dashboard for service status
- Try using pooled connection string

### SSL Error

**Issue:** SSL connection error

**Solutions:**
- Ensure `?sslmode=require` is in connection string
- Verify SSL is enabled in Neon (should be by default)
- Check Vercel environment variable has correct format

### Too Many Connections

**Issue:** Connection limit reached

**Solutions:**
- Use pooled connection string (reduces connection count)
- Check Neon plan limits
- Optimize connection pooling settings
- Consider upgrading Neon plan if needed

## Neon Pricing

- **Free Tier:** Great for development and small production apps
- **Paid Plans:** Better performance, more storage, longer backups
- **Pay-as-you-go:** Scale as you grow

Check current pricing at: https://neon.tech/pricing

## Support

- **Neon Docs:** https://neon.tech/docs
- **Neon Discord:** https://discord.gg/neondatabase
- **Neon Support:** Available in dashboard

---

**Next Steps:**
1. Create production project in Neon
2. Copy connection string
3. Add to Vercel environment variables
4. Deploy and run migrations
5. Monitor and optimize

Good luck! 🚀

