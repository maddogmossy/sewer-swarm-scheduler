# DB migrate script & post-merge hook

## What this does

- **`run-migrations.js`** – Standalone script that applies the same schema updates as the `/api/run-migrations` endpoint (creates tables if missing, adds new columns). Uses `DATABASE_URL` from `apps/scheduler/.env.local`.
- **Post-merge hook** – After every successful `git pull`, runs the migration so your dev DB stays in sync with the code on both machines.

## Run migrations manually

From the repo root:

```bash
node apps/scheduler/scripts/run-migrations.js
```

Or from `apps/scheduler`:

```bash
npm run db:migrate
```

## Install the post-merge hook (once per machine)

From the **repo root**:

**Git Bash / Linux / macOS:**

```bash
cp apps/scheduler/scripts/git-hooks/post-merge .git/hooks/post-merge
chmod +x .git/hooks/post-merge
```

**Windows (PowerShell, run from repo root):**

```powershell
Copy-Item apps/scheduler/scripts/git-hooks/post-merge .git/hooks/post-merge
```

After this, every `git pull` that performs a merge will run the migration automatically. If `DATABASE_URL` is not set or the DB is unreachable, the hook logs the error and continues (it does not block the pull).

## Second machine

On your other machine, pull as usual, then run the same install commands above once. From then on, pull will update both code and dev DB there too.
