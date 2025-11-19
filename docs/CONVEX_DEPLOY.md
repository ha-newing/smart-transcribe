# Convex Production Deployment Guide

## Quick Start

```bash
cd frontend

# 1. Login to Convex (opens browser)
npx convex login

# 2. Deploy to production (deploys to prod by default)
npx convex deploy

# 3. The command will:
#    - Build your functions
#    - Push to production
#    - Give you a deployment URL
```

## Step-by-Step Process

### 1. Login to Convex

```bash
npx convex login
```

This will:
- Open your browser
- Ask you to authenticate with GitHub/Google
- Save credentials locally

### 2. Deploy to Production

```bash
npx convex deploy
```

**What happens:**
- Validates your schema
- Compiles TypeScript functions
- Uploads functions to Convex Cloud
- Creates production deployment
- Returns deployment URL

**Expected output:**
```
✔ Deploying...
✔ Deployment complete!

Production deployment URL:
https://your-deployment.convex.cloud

Deploy key (for CI/CD):
deployment:prod:key:****
```

### 3. Save Important Values

Copy these for later:

1. **Deployment URL**: `https://your-deployment.convex.cloud`
   - Used in: GitHub Secret `VITE_CONVEX_URL`
   - Used in: Frontend `.env.local`

2. **Deploy Key**: `deployment:prod:key:****`
   - Used in: GitHub Secret `CONVEX_DEPLOY_KEY`
   - Found in: Dashboard → Settings → CI/CD

## Set Environment Variables

```bash
# Set production environment variables
npx convex env set AUTH_SENDGRID_KEY "SG.****" --prod
npx convex env set AUTH_EMAIL_FROM "Smart Transcribe <noreply@yourdomain.com>" --prod
npx convex env set GEMINI_API_KEY "AIza****" --prod
npx convex env set SONIOX_API_KEY "****" --prod

# Verify
npx convex env list --prod
```

## Get Deploy Key for CI/CD

**Option 1: From CLI**
```bash
# After deploying, check the output or:
npx convex dashboard --prod
# Go to: Settings → CI/CD → Copy Deploy Key
```

**Option 2: From Dashboard**
1. Visit: https://dashboard.convex.dev
2. Select your deployment
3. Settings → CI/CD
4. Copy "Deploy Key"
5. Format: `deployment:prod:key:****`

## Update Frontend to Use Production

### For Local Development

Create `frontend/.env.local`:
```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

### For GitHub Actions (CI/CD)

Set GitHub Secret:
```bash
gh secret set VITE_CONVEX_URL
# Paste: https://your-deployment.convex.cloud

gh secret set CONVEX_DEPLOY_KEY
# Paste: deployment:prod:key:****
```

## Common Commands

```bash
# Deploy to production with build
npx convex deploy --cmd 'npm run build'

# View production logs
npx convex logs --prod

# Watch logs in real-time
npx convex logs --prod --watch

# List environment variables
npx convex env list --prod

# Set environment variable
npx convex env set KEY "value" --prod

# Open dashboard
npx convex dashboard --prod

# Check deployment status
npx convex dev --once --prod
```

## Troubleshooting

### "Not logged in"
```bash
npx convex login
# Opens browser for authentication
```

### "No deployment found"
```bash
# Make sure you're in the frontend directory
cd frontend
npx convex deploy
```

### "Schema validation failed"
```bash
# Check your schema.ts for errors
# Fix any validation issues
# Try again
npx convex deploy
```

### Environment Variables Not Set
```bash
# List all env vars
npx convex env list --prod

# Set missing variables
npx convex env set VARIABLE_NAME "value" --prod
```

## Development vs Production

| Environment | Command | URL |
|------------|---------|-----|
| Development | `npx convex dev` | `https://dev-deployment.convex.cloud` |
| Production | `npx convex deploy` | `https://prod-deployment.convex.cloud` |

**Note**: Development and Production are separate deployments with their own:
- Databases
- Environment variables
- Functions
- URLs

## Next Steps After Deployment

1. ✅ Copy deployment URL
2. ✅ Copy deploy key
3. ✅ Set environment variables
4. ✅ Set GitHub Secrets
5. ✅ Deploy frontend to Fly.io
6. ✅ Test the application

## Monitoring

```bash
# View function calls
npx convex dashboard --prod

# Real-time logs
npx convex logs --prod --watch

# Check for errors
npx convex logs --prod --limit 100 | grep ERROR
```

## Rollback

If you need to rollback:

```bash
# Redeploy from a previous commit
git checkout <previous-commit>
npx convex deploy
git checkout master
```

## Cost

**Convex Free Tier:**
- 1M function calls/month
- 1GB storage
- No credit card required

**Upgrade**: https://www.convex.dev/pricing

---

**Ready?** Run: `npx convex deploy`
