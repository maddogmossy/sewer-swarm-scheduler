# Quick Deployment Checklist

## Pre-Deployment

- [ ] Production database created in Neon (recommended)
- [ ] Production Neon connection string ready (pooled connection)
- [ ] Stripe keys ready (if using payments)
- [ ] Domain `sewerswarmscheduler.com` registered

## Vercel Setup

- [ ] Sign in to Vercel with GitHub account
- [ ] Import repository: `sewer-swarm-scheduler`
- [ ] Set Root Directory: `apps/scheduler`
- [ ] Add environment variables:
  - [ ] `PRODUCTION_DATABASE_URL`
  - [ ] `NODE_ENV=production`
  - [ ] `STRIPE_SECRET_KEY` (if using)
  - [ ] `STRIPE_PUBLISHABLE_KEY` (if using)
  - [ ] `STRIPE_WEBHOOK_SECRET` (if using)
- [ ] Deploy project

## Database Setup

- [ ] Run migrations: Visit `/api/migrate` after deployment
- [ ] Verify tables created: Visit `/api/check-db`
- [ ] (Optional) Seed initial data: Visit `/api/seed`

## Domain Setup

- [ ] Add domain in Vercel: `sewerswarmscheduler.com`
- [ ] Add DNS records at domain registrar:
  - [ ] A record or CNAME for root domain
  - [ ] CNAME for www subdomain (optional)
- [ ] Wait for DNS propagation (1-48 hours)
- [ ] Verify SSL certificate is active

## Post-Deployment

- [ ] Test health endpoint: `/api/health`
- [ ] Test registration/login
- [ ] Test creating depots
- [ ] Test schedule functionality
- [ ] Verify Stripe integration (if using)

## Monitoring

- [ ] Set up error tracking (optional)
- [ ] Configure database backups
- [ ] Monitor Vercel analytics

---

**Quick Links:**
- Vercel Dashboard: https://vercel.com/dashboard
- Health Check: https://sewerswarmscheduler.com/api/health
- Database Check: https://sewerswarmscheduler.com/api/check-db

