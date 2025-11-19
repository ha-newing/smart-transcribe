# GitHub Secrets Setup Guide

## Prerequisites

You need these values before proceeding:
1. Convex Production URL: `https://nautical-guanaco-500.convex.cloud`
2. Convex Deploy Key (get from dashboard - see below)

## Step 1: Get Convex Deploy Key

### Option A: From Dashboard (Recommended)

```bash
# Open the production dashboard
npx convex dashboard --prod
```

Then:
1. Click on **Settings** in the left sidebar
2. Go to **CI/CD** tab
3. Find **Deploy Key** section
4. Click **Copy** next to the deploy key
5. Format will be: `deployment:prod:nautical-guanaco-500|key:****`

### Option B: From CLI (If available)

```bash
# Get dashboard URL
npx convex dashboard --no-open --prod
# Visit: https://dashboard.convex.dev/d/nautical-guanaco-500
```

## Step 2: Set GitHub Secrets

You need to set these secrets in your GitHub repository:

### Required Secrets:

1. **VITE_CONVEX_URL** - Convex production URL
2. **CONVEX_DEPLOY_KEY** - Deploy key from dashboard (for CI/CD)
3. **SENDGRID_API_KEY** - SendGrid API key
4. **GEMINI_API_KEY** - Google Gemini API key
5. **SONIOX_API_KEY** - Soniox transcription API key

### Using GitHub CLI:

```bash
# Navigate to project root
cd /Users/ha/projects/smart-transcribe

# Set Convex URL
gh secret set VITE_CONVEX_URL --body "https://nautical-guanaco-500.convex.cloud"

# Set Convex Deploy Key (paste the key you copied from dashboard)
gh secret set CONVEX_DEPLOY_KEY
# Paste: deployment:prod:nautical-guanaco-500|key:****

# Set API Keys (values from .env.prod - replace with your actual keys)
gh secret set AUTH_SENDGRID_KEY --body "SG.************************************"
gh secret set AUTH_EMAIL_FROM --body "Your App Name <noreply@yourdomain.com>"
gh secret set GEMINI_API_KEY --body "AIza************************************"
gh secret set SONIOX_API_KEY --body "************************************"

# Optional: Set other keys if needed
gh secret set CLAUDE_API_KEY --body "sk-ant-************************************"
gh secret set ELEVEN_LABS_KEY --body "sk_************************************"
```

### Using GitHub Web UI:

1. Go to your repository on GitHub
2. Click **Settings** tab
3. In left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret:
   - Name: `VITE_CONVEX_URL`
   - Value: `https://nautical-guanaco-500.convex.cloud`
6. Repeat for all secrets listed above

## Step 3: Verify GitHub Actions Workflow

Check that `.github/workflows/ci-cd.yml` uses these secrets correctly:

```yaml
env:
  VITE_CONVEX_URL: ${{ secrets.VITE_CONVEX_URL }}
  CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

## Step 4: Test the CI/CD Pipeline

```bash
# Make a small change and commit
git commit --allow-empty -m "Test CI/CD pipeline"
git push origin main

# Watch the workflow
gh run watch
```

## Troubleshooting

### "Secret not found" error in GitHub Actions

Make sure you've set all required secrets. Check with:
```bash
gh secret list
```

### Convex deployment fails in CI/CD

1. Verify `CONVEX_DEPLOY_KEY` is correct
2. Check the format: `deployment:prod:deployment-name|key:****`
3. Ensure the key has proper permissions

### Frontend can't connect to Convex

1. Verify `VITE_CONVEX_URL` matches your production deployment
2. Check the URL doesn't have trailing slashes
3. Ensure the URL starts with `https://`

## Quick Reference

```bash
# List all secrets
gh secret list

# Delete a secret
gh secret delete SECRET_NAME

# Update a secret
gh secret set SECRET_NAME --body "new-value"
```

## Security Notes

- ⚠️ **NEVER commit** `.env.prod` to Git - it contains sensitive keys
- ✅ Add `.env.prod` to `.gitignore`
- ✅ Use GitHub Secrets for all sensitive values in CI/CD
- ✅ Rotate keys periodically
- ✅ Use different keys for dev/staging/production

## Next Steps

After setting up GitHub Secrets:
1. Configure Fly.io deployment
2. Test the full deployment pipeline
3. Set up monitoring and alerts
