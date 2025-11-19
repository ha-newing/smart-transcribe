# Setup Guide - Smart Transcribe

## Quick Start Checklist

- [ ] GitHub repository created ✅
- [ ] Code pushed to GitHub ✅
- [ ] Convex project created and deployed
- [ ] Fly.io app created
- [ ] GitHub Secrets configured
- [ ] Convex production environment variables set
- [ ] First deployment triggered

## Step 1: GitHub Setup (COMPLETED ✅)

```bash
# Repository created at:
https://github.com/ha-newing/smart-transcribe

# Code has been pushed to master branch
```

## Step 2: Get API Keys

### Required API Keys

1. **SendGrid** (Email Authentication)
   - Sign up: https://signup.sendgrid.com/
   - Create API Key: Settings → API Keys → Create API Key
   - Copy: `SG.****`

2. **Soniox** (Audio Transcription)
   - Sign up: https://soniox.com/
   - Dashboard: https://soniox.com/dashboard
   - Copy API Key: `****`

3. **Google Gemini** (AI Processing & Embeddings)
   - Go to: https://makersuite.google.com/app/apikey
   - Create API Key
   - Copy: `AIza****`

## Step 3: Convex Setup

```bash
cd frontend

# 1. Login to Convex
npx convex login

# 2. Create production deployment
npx convex deploy --prod

# 3. Note the deployment URL (you'll need this for GitHub Secrets)
# Example: https://gentle-rabbit-123.convex.cloud

# 4. Get Convex Deploy Key
# Go to: https://dashboard.convex.dev/deployment/settings
# Copy the "Deploy Key" under "CI/CD"
# Format: deployment:prod:key:****
```

### Set Convex Production Environment Variables

```bash
# Still in frontend/ directory

npx convex env set AUTH_SENDGRID_KEY "SG.****" --prod
npx convex env set AUTH_EMAIL_FROM "Smart Transcribe <noreply@yourdomain.com>" --prod
npx convex env set GEMINI_API_KEY "AIza****" --prod
npx convex env set SONIOX_API_KEY "****" --prod

# Verify
npx convex env list --prod
```

## Step 4: Fly.io Setup

```bash
cd frontend

# 1. Install Fly.io CLI if not installed
# macOS: brew install flyctl
# Linux: curl -L https://fly.io/install.sh | sh

# 2. Login
flyctl auth login

# 3. Create app (use any unique name)
flyctl apps create smart-transcribe

# If the name is taken, try:
# flyctl apps create smart-transcribe-prod
# or smart-transcribe-<yourname>

# 4. Get Fly.io API token
flyctl auth token
# Copy the token starting with "FlyV1 ****"
```

## Step 5: Configure GitHub Secrets

```bash
# Set all required secrets
gh secret set CONVEX_DEPLOY_KEY
# Paste: deployment:prod:key:**** (from Step 3)

gh secret set VITE_CONVEX_URL
# Paste: https://gentle-rabbit-123.convex.cloud (from Step 3)

gh secret set FLY_API_TOKEN
# Paste: FlyV1 **** (from Step 4)

gh secret set SENDGRID_API_KEY
# Paste: SG.**** (from Step 2)

gh secret set SENDGRID_FROM_EMAIL
# Type: noreply@yourdomain.com

gh secret set SENDGRID_FROM_NAME
# Type: Smart Transcribe

gh secret set SONIOX_API_KEY
# Paste: **** (from Step 2)

gh secret set GEMINI_API_KEY
# Paste: AIza**** (from Step 2)

# Verify all secrets are set
gh secret list
```

## Step 6: Update Fly.io App Name in CI/CD

If you used a different app name than "smart-transcribe" in Step 4, update the workflow:

1. Edit `.github/workflows/ci-cd.yml`
2. Find line with `flyctl deploy`
3. Update `-a smart-transcribe` to `-a your-app-name`

```yaml
# Example: If your app is "smart-transcribe-prod"
flyctl deploy --config fly.toml \
  --build-arg VITE_CONVEX_URL=${{ secrets.VITE_CONVEX_URL }} \
  --wait-timeout 15m --remote-only
# Note: App name is set in fly.toml
```

## Step 7: First Deployment

### Option A: Trigger via Push (Recommended)

```bash
# Make a small change (or use --allow-empty)
git commit --allow-empty -m "chore: Trigger first deployment"
git push origin master

# Watch the deployment
gh run watch
```

### Option B: Manual Deployment

```bash
# Deploy Convex
cd frontend
npx convex deploy --cmd 'npm run build' --prod

# Deploy Fly.io
flyctl deploy --config fly.toml \
  --build-arg VITE_CONVEX_URL=https://your-deployment.convex.cloud \
  --wait-timeout 15m
```

## Step 8: Verify Deployment

```bash
# Check GitHub Actions
gh run list
gh run view <latest-run-id>

# Check Convex
npx convex dashboard --prod

# Check Fly.io
flyctl status -a smart-transcribe
flyctl logs -a smart-transcribe

# Get your app URL
flyctl apps list
# Visit: https://smart-transcribe.fly.dev
```

## Troubleshooting

### GitHub Actions Failing

```bash
# View logs
gh run list
gh run view <failed-run-id> --log

# Common issues:
# - Missing secrets → Check `gh secret list`
# - Wrong Convex URL → Check `gh secret set VITE_CONVEX_URL`
# - Fly.io app name mismatch → Update fly.toml
```

### Convex Deployment Issues

```bash
# Check deployment logs
npx convex logs --prod --limit 100

# Verify environment variables
npx convex env list --prod

# Redeploy
npx convex deploy --prod
```

### Fly.io Deployment Issues

```bash
# Check app status
flyctl status -a smart-transcribe

# View logs
flyctl logs -a smart-transcribe --limit 100

# SSH into instance (if running)
flyctl ssh console -a smart-transcribe
```

## Next Steps

### 1. Test the Application

```bash
# Visit your app
open https://smart-transcribe.fly.dev

# Create an account using your email
# Check SendGrid dashboard for email delivery
```

### 2. Set Up Custom Domain (Optional)

```bash
# Add domain to Fly.io
flyctl certs create yourdomain.com -a smart-transcribe

# Get IP addresses
flyctl certs show yourdomain.com -a smart-transcribe

# Add DNS records (A and AAAA)
# Update AUTH_EMAIL_FROM to use your domain
npx convex env set AUTH_EMAIL_FROM "Smart Transcribe <noreply@yourdomain.com>" --prod
```

### 3. Monitor Your Application

```bash
# Set up monitoring (optional)
# - PostHog: https://posthog.com/ (analytics)
# - Sentry: https://sentry.io/ (error tracking)
# - Uptime Robot: https://uptimerobot.com/ (uptime monitoring)
```

## Security Checklist

- [x] All secrets stored in GitHub Secrets (not in code)
- [x] Convex environment variables set for production
- [x] API keys have minimum required permissions
- [ ] Enable 2FA on GitHub account
- [ ] Enable 2FA on Convex account
- [ ] Enable 2FA on Fly.io account
- [ ] Rotate API keys every 90 days
- [ ] Set up monitoring alerts

## Cost Estimation

### Free Tier Usage

- **Convex**: 1M function calls/month (free)
- **Fly.io**: 3 shared VMs with 256MB RAM (free)
- **Soniox**: Check pricing at https://soniox.com/pricing
- **Gemini**: 15 requests/minute (free), embeddings free
- **SendGrid**: 100 emails/day (free)

**Estimated Monthly Cost**: $0 (within free tiers) + Soniox usage

## Support & Resources

- **Convex Docs**: https://docs.convex.dev
- **Fly.io Docs**: https://fly.io/docs
- **GitHub Actions**: https://docs.github.com/actions
- **Soniox Docs**: https://soniox.com/docs
- **Gemini API**: https://ai.google.dev/docs

## Quick Reference Commands

```bash
# Convex
npx convex dev                    # Local development
npx convex deploy --prod          # Deploy to production
npx convex logs --prod --watch    # Watch production logs
npx convex dashboard --prod       # Open dashboard

# Fly.io
flyctl status -a smart-transcribe         # Check status
flyctl logs -a smart-transcribe --follow  # Follow logs
flyctl ssh console -a smart-transcribe    # SSH into instance
flyctl releases rollback -a smart-transcribe  # Rollback

# GitHub
gh run list                       # List workflow runs
gh run watch                      # Watch latest run
gh secret list                    # List secrets
gh repo view --web                # Open repo in browser
```

## Completion

Once all steps are complete, you should have:

✅ Working CI/CD pipeline
✅ Automated deployments on push to master
✅ Production app running on Fly.io
✅ Convex backend with all functions deployed
✅ All secrets properly configured
✅ Tests running in CI (note: 1 test passing, module loading issue documented)

**Your app is live at**: https://smart-transcribe.fly.dev

**Repository**: https://github.com/ha-newing/smart-transcribe
