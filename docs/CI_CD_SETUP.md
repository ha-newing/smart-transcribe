# CI/CD Setup - GitHub Actions

## Overview

**Architecture:**
- **Local Dev:** `.env` → `make convex-env-sync` → Convex DEV
- **Production:** GitHub Secrets → CI/CD → Convex PROD + Fly.io

## Required GitHub Secrets

Go to: **Settings → Secrets → Actions → New repository secret**

### Deployment Keys (2)

| Secret Name | Purpose | How to Get |
|------------|---------|------------|
| `CONVEX_DEPLOY_KEY` | Deploy Convex backend | `npx convex deploy --prod` |
| `FLY_API_TOKEN` | Deploy to Fly.io | `fly auth token` |

### Production API Keys (10)

**⚠️ Use PRODUCTION keys, not development keys!**

| Secret Name | Example Value | From .env |
|------------|---------------|-----------|
| `SENDGRID_API_KEY` | `SG.prod_key` | SENDGRID_API_KEY |
| `SENDGRID_FROM_NAME` | `Newing Talent Solutions` | SENDGRID_FROM_NAME |
| `SENDGRID_FROM_EMAIL` | `growth@mail.newing.vn` | SENDGRID_FROM_EMAIL |
| `CLAUDE_API_KEY` | `sk-ant-prod-...` | CLAUDE_API_KEY |
| `GEMINI_API_KEY` | `AIza...` | GEMINI_API_KEY |
| `SONIOX_API_KEY` | `prod_key` | SONIOX_API_KEY |
| `ELEVEN_LABS_KEY` | `sk_prod...` | ELEVEN_LABS_KEY |
| `AZURE_STORAGE_CONNECTION_STRING` | `DefaultEndpoints...` | AZURE_STORAGE_CONNECTION_STRING |
| `POSTHOG_API_KEY` | `phc_prod...` | POSTHOG_API_KEY |
| `POSTHOG_HOST` | `https://us.i.posthog.com` | POSTHOG_HOST |

## CI/CD Flow

```
git push main
    ↓
GitHub Actions
    ↓
1. Install dependencies
2. Set Convex PROD environment variables (from GitHub Secrets)
3. Deploy Convex backend (functions, schema, auth)
4. Build frontend (uses Convex PROD URL)
5. Deploy frontend to Fly.io
    ↓
Done! ✅
```

## Environment Separation

| Environment | Secrets Location | Set Via | Target |
|------------|------------------|---------|--------|
| **Development** | `.env` (root) | `make convex-env-sync` | Convex DEV |
| **Production** | GitHub Secrets | CI/CD workflow | Convex PROD |

## Setup Steps

### 1. Get Deploy Keys

```bash
# Convex Deploy Key
cd frontend
npx convex deploy --prod
# Save the deploy key: prod:...

# Fly.io API Token
fly auth token
# Save the token: FlyV1 fm1_...
```

### 2. Add to GitHub Secrets

1. Go to your repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add all 12 secrets listed above

### 3. Test Deployment

```bash
git push origin main
# Watch: Actions tab → Deploy to Fly.io + Convex
```

## What CI/CD Does

### Step 1: Set Convex Production Env Vars
```yaml
npx convex env set AUTH_SENDGRID_KEY "${{ secrets.SENDGRID_API_KEY }}" --prod
npx convex env set CLAUDE_API_KEY "${{ secrets.CLAUDE_API_KEY }}" --prod
# ... all other secrets
```

### Step 2: Deploy Convex
```yaml
npx convex deploy --cmd 'npm run build' --prod
```

### Step 3: Deploy Fly.io
```yaml
flyctl deploy -a newing-insights
```

## Local vs Production

```
┌────────────────────────────────────────────────────────────┐
│  Development (Local)                                       │
├────────────────────────────────────────────────────────────┤
│  .env (root)                                               │
│    ↓ make convex-env-sync                                 │
│  Convex DEV (quaint-impala-439)                           │
│    - Development API keys                                  │
│    - Test data                                             │
│    - npx convex dev                                        │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Production (CI/CD)                                        │
├────────────────────────────────────────────────────────────┤
│  GitHub Secrets                                            │
│    ↓ CI/CD workflow                                        │
│  Convex PROD                                               │
│    - Production API keys                                   │
│    - Real data                                             │
│    - Deployed via CI/CD                                    │
│                                                            │
│  Fly.io (newing-insights.fly.dev)                         │
│    - Static frontend                                       │
│    - No secrets (uses Convex PROD URL)                    │
└────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### "CONVEX_DEPLOY_KEY not set"
- Add secret in GitHub Settings → Secrets
- Get key: `npx convex deploy --prod`

### "Environment variable not found in production"
- Check GitHub Secrets has all 12 secrets
- Re-run workflow to sync to Convex PROD

### "Frontend can't connect to backend"
- Check `frontend/.env.local` has correct VITE_CONVEX_URL
- Ensure Convex PROD is deployed
- Check Convex dashboard for errors

### "SendGrid auth fails in production"
- Verify production SendGrid key is correct
- Check sender email is verified in SendGrid
- Ensure `AUTH_SENDGRID_KEY` secret is set

## Security Best Practices

✅ **DO:**
- Use different keys for dev/prod
- Store production keys in GitHub Secrets only
- Keep `.env` in `.gitignore`
- Rotate API keys regularly

❌ **DON'T:**
- Commit `.env` to git
- Use development keys in production
- Share deploy keys publicly
- Hardcode secrets in code

## Files

- `.github/workflows/fly-deploy.yml` - CI/CD pipeline
- `.env` - Development secrets (gitignored)
- `Makefile` - `convex-env-sync` for local dev
- `CI_CD_SETUP.md` - This file

## Next Steps

- [ ] Add all 12 GitHub Secrets
- [ ] Test deployment: `git push origin main`
- [ ] Verify Convex PROD environment variables
- [ ] Check production site works
