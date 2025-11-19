# Deployment Guide - Smart Transcribe

## Overview

Smart Transcribe uses a modern serverless architecture with automated CI/CD:

- **Frontend**: Deployed to Fly.io (static assets served via Nginx)
- **Backend**: Convex serverless functions
- **CI/CD**: GitHub Actions for automated testing and deployment

## Architecture

```
┌─────────────────┐
│  GitHub Repo    │
└────────┬────────┘
         │
    Push to main
         │
         ▼
┌─────────────────┐
│ GitHub Actions  │
│   CI/CD         │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌─────────┐ ┌──────────┐
│ Convex  │ │  Fly.io  │
│ Backend │ │ Frontend │
└─────────┘ └──────────┘
```

## Prerequisites

1. **GitHub CLI** (`gh`)
2. **Fly.io CLI** (`flyctl`)
3. **Convex Account** (https://convex.dev)
4. **API Keys**:
   - Soniox API Key (transcription)
   - Gemini API Key (AI processing)
   - SendGrid API Key (authentication emails)

## Initial Setup

### 1. GitHub Repository

```bash
# Create GitHub repository
gh repo create smart-transcribe --public --source=. --remote=origin

# Push code
git push -u origin master
```

### 2. Convex Setup

```bash
cd frontend

# Login to Convex
npx convex login

# Initialize production deployment
npx convex deploy --prod

# Get your Convex deployment URL
# It will be in the format: https://your-deployment.convex.cloud
```

### 3. Fly.io Setup

```bash
cd frontend

# Login to Fly.io
flyctl auth login

# Create Fly.io app
flyctl apps create smart-transcribe --org personal

# Get Fly.io API token
flyctl auth token
```

## Required Secrets

### GitHub Secrets

Set these secrets in your GitHub repository (Settings → Secrets and variables → Actions):

```bash
# Convex
gh secret set CONVEX_DEPLOY_KEY
# Get from: https://dashboard.convex.dev/deployment/settings
# Value: deployment:prod:key:****

gh secret set VITE_CONVEX_URL
# Get from: npx convex deploy --prod
# Value: https://your-deployment.convex.cloud

# Fly.io
gh secret set FLY_API_TOKEN
# Get from: flyctl auth token
# Value: FlyV1 ****

# SendGrid (Email Authentication)
gh secret set SENDGRID_API_KEY
# Value: SG.****

gh secret set SENDGRID_FROM_EMAIL
# Value: noreply@yourdomain.com

gh secret set SENDGRID_FROM_NAME
# Value: Smart Transcribe

# Soniox (Transcription)
gh secret set SONIOX_API_KEY
# Get from: https://soniox.com/dashboard
# Value: ****

# Gemini (AI Processing & RAG)
gh secret set GEMINI_API_KEY
# Get from: https://makersuite.google.com/app/apikey
# Value: AIza****
```

### Convex Environment Variables (Production)

```bash
cd frontend

# Set production environment variables
npx convex env set AUTH_SENDGRID_KEY "YOUR_SENDGRID_KEY" --prod
npx convex env set AUTH_EMAIL_FROM "Smart Transcribe <noreply@yourdomain.com>" --prod
npx convex env set GEMINI_API_KEY "YOUR_GEMINI_KEY" --prod
npx convex env set SONIOX_API_KEY "YOUR_SONIOX_KEY" --prod

# Verify
npx convex env list --prod
```

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) runs on every push to `main`/`master`:

### 1. Test Job
- ✅ Checkout code
- ✅ Install dependencies
- ✅ Run linter (`npm run lint`)
- ✅ Run tests (`npm test`)
- ✅ Build frontend (`npm run build`)

### 2. Deploy Job (only on main/master)
- ✅ Set Convex environment variables
- ✅ Deploy Convex backend with build command
- ✅ Deploy frontend to Fly.io with Convex URL

## Manual Deployment

### Deploy Convex Backend

```bash
cd frontend

# Deploy to production
npx convex deploy --cmd 'npm run build' --prod

# Monitor functions
npx convex dashboard
```

### Deploy Frontend to Fly.io

```bash
cd frontend

# Build with Convex URL
export VITE_CONVEX_URL="https://your-deployment.convex.cloud"

# Deploy
flyctl deploy --config fly.toml \
  --build-arg VITE_CONVEX_URL=$VITE_CONVEX_URL \
  --wait-timeout 15m
```

## Environment Variables

### Development (.env.local)

```bash
# Convex
VITE_CONVEX_URL=https://your-dev-deployment.convex.cloud

# Set in Convex dashboard for dev:
# AUTH_SENDGRID_KEY=SG.****
# AUTH_EMAIL_FROM=Smart Transcribe <dev@yourdomain.com>
# GEMINI_API_KEY=AIza****
# SONIOX_API_KEY=****
```

### Production

All production secrets are set via:
1. **GitHub Secrets** → Used by CI/CD
2. **Convex Environment Variables** → Set via `npx convex env set --prod`

## Monitoring & Debugging

### Convex Logs

```bash
# View function logs
npx convex logs --prod

# Watch logs in real-time
npx convex logs --prod --watch
```

### Fly.io Logs

```bash
# View application logs
flyctl logs -a smart-transcribe

# Follow logs
flyctl logs -a smart-transcribe --follow
```

### Health Checks

```bash
# Check Fly.io app status
flyctl status -a smart-transcribe

# Check Convex deployment
npx convex dashboard --prod
```

## Rollback

### Rollback Frontend (Fly.io)

```bash
# List recent releases
flyctl releases -a smart-transcribe

# Rollback to previous version
flyctl releases rollback -a smart-transcribe
```

### Rollback Backend (Convex)

```bash
# Redeploy from a previous git commit
git checkout <previous-commit-hash>
npx convex deploy --prod
git checkout master
```

## Custom Domain Setup

### 1. Add Domain to Fly.io

```bash
flyctl certs create yourdomain.com -a smart-transcribe
flyctl certs show yourdomain.com -a smart-transcribe
```

### 2. Configure DNS

Add these records to your DNS provider:

```
A     @    <fly-ip-address>
AAAA  @    <fly-ipv6-address>
```

### 3. Update SendGrid Email Domain

Update the `AUTH_EMAIL_FROM` to use your custom domain:

```bash
npx convex env set AUTH_EMAIL_FROM "Smart Transcribe <noreply@yourdomain.com>" --prod
```

## Troubleshooting

### Build Failures

```bash
# Check GitHub Actions logs
gh run list
gh run view <run-id> --log

# Test build locally
cd frontend
npm ci
npm run build
```

### Convex Deployment Issues

```bash
# Check deployment status
npx convex dashboard --prod

# View detailed logs
npx convex logs --prod --limit 100

# Verify environment variables
npx convex env list --prod
```

### Fly.io Deployment Issues

```bash
# Check deployment status
flyctl status -a smart-transcribe

# View recent logs
flyctl logs -a smart-transcribe --limit 100

# SSH into running instance
flyctl ssh console -a smart-transcribe
```

## Cost Optimization

### Convex
- Free tier: 1M function calls/month
- Pricing: https://www.convex.dev/pricing

### Fly.io
- Free tier: 3 shared-cpu-1x VMs with 256MB RAM
- Auto-stop/start enabled to minimize costs
- Pricing: https://fly.io/docs/about/pricing/

## Security Best Practices

1. ✅ **Never commit secrets** - Use GitHub Secrets and Convex env vars
2. ✅ **Rotate API keys** regularly
3. ✅ **Use least privilege** - Limit API key permissions
4. ✅ **Enable 2FA** on GitHub, Convex, and Fly.io accounts
5. ✅ **Monitor logs** for suspicious activity
6. ✅ **Review dependencies** regularly (`npm audit`)

## Next Steps

1. Set up custom domain
2. Configure CDN (Cloudflare) for static assets
3. Add monitoring (PostHog, Sentry)
4. Set up staging environment
5. Implement database backups

## Support

- Convex: https://docs.convex.dev
- Fly.io: https://fly.io/docs
- GitHub Actions: https://docs.github.com/actions
