# GitHub Actions CI/CD Setup for Fly.io

This document explains how to configure automatic deployment to Fly.io using GitHub Actions.

## Overview

Every push to the `main` branch automatically triggers a deployment to Fly.io using the GitHub Actions workflow defined in [.github/workflows/fly-deploy.yml](../.github/workflows/fly-deploy.yml).

## Setup Instructions

### 1. Generate Fly.io Deploy Token

Run this command to create a deploy token with a long expiration (999999 hours ≈ 114 years):

```bash
fly tokens create deploy -x 999999h
```

**IMPORTANT**: Copy the entire output, including the `FlyV1` prefix and the space after it.

Example output:
```
FlyV1 fm2_xxx...your-token-here...xxx
```

### 2. Add Token to GitHub Secrets

1. Go to your GitHub repository: https://github.com/ha-newing/newing-insights
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FLY_API_TOKEN`
5. Value: Paste the entire token (including `FlyV1 ` prefix)
6. Click **Add secret**

### 3. Configure Fly.io Secrets

Set environment variables for the deployed app:

```bash
fly secrets set VITE_USE_MOCK_API=true VITE_API_BASE_URL=https://newing-insights.fly.dev/api VITE_SHOW_DEMO=true -a newing-insights
```

**Environment Variables:**
- `VITE_USE_MOCK_API=true` - Use mock API (set to `false` when backend is ready)
- `VITE_API_BASE_URL` - API endpoint URL
- `VITE_SHOW_DEMO=true` - Show Demo login button (for testing/demo environments)

### 4. Verify Workflow Configuration

The workflow file is located at [.github/workflows/fly-deploy.yml](../.github/workflows/fly-deploy.yml) and contains:

```yaml
name: Deploy to Fly.io

on:
  push:
    branches:
      - main

jobs:
  deploy:
    name: Deploy app
    runs-on: ubuntu-latest
    concurrency: deploy-group

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Flyctl
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io
        run: flyctl deploy -a newing-insights --dockerfile Dockerfile.fullstack --wait-timeout 15m --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## How It Works

### Trigger

The workflow triggers automatically on every push to the `main` branch:

```yaml
on:
  push:
    branches:
      - main
```

### Deployment Process

1. **Checkout code**: Clones the repository
2. **Setup Flyctl**: Installs the Fly.io CLI tool
3. **Deploy**: Runs the deployment command with:
   - App name: `newing-insights`
   - Dockerfile: `Dockerfile.fullstack`
   - Build: Remote-only (builds on Fly.io servers, not GitHub Actions)
   - Timeout: 15 minutes

### Concurrency Control

```yaml
concurrency: deploy-group
```

This ensures only one deployment runs at a time, preventing race conditions if multiple commits are pushed quickly.

## Monitoring Deployments

### GitHub Actions Tab

View deployment progress:
1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Click on the latest workflow run
4. Expand the "Deploy to Fly.io" step to see live logs

### Fly.io Dashboard

Monitor the deployed app:
```bash
fly status -a newing-insights
fly logs -a newing-insights
```

Or visit: https://fly.io/apps/newing-insights

## Deployment Details

### Build Configuration

- **Dockerfile**: `Dockerfile.fullstack` (builds both backend and frontend)
- **Build location**: Remote (on Fly.io builders, saves GitHub Actions minutes)
- **Timeout**: 15 minutes (fullstack build can take time)

### Environment Variables

The workflow uses the `FLY_API_TOKEN` secret to authenticate with Fly.io. This token has deploy permissions only and cannot modify other Fly.io settings.

## Troubleshooting

### Deployment Fails

1. Check the workflow logs in GitHub Actions tab
2. Verify `FLY_API_TOKEN` secret is set correctly
3. Ensure the app `newing-insights` exists on Fly.io
4. Check Fly.io status: https://status.fly.io

### Token Expired

If the deploy token expires (unlikely with 999999h expiration), regenerate:

```bash
fly tokens create deploy -x 999999h
```

Then update the `FLY_API_TOKEN` secret in GitHub.

### Build Timeout

If builds take longer than 15 minutes, increase the timeout in the workflow:

```yaml
run: flyctl deploy -a newing-insights --dockerfile Dockerfile.fullstack --wait-timeout 30m --remote-only
```

## Manual Deployment

To deploy manually from your local machine:

```bash
fly deploy -a newing-insights --dockerfile Dockerfile.fullstack --wait-timeout 15m --remote-only
```

## Security Notes

- ✅ Deploy token has limited permissions (deploy only)
- ✅ Token stored as GitHub secret (encrypted at rest)
- ✅ Token not visible in workflow logs
- ✅ Concurrency control prevents deployment conflicts
- ⚠️ Token has long expiration - rotate if compromised

## Next Steps

After setting up the `FLY_API_TOKEN` secret:

1. Push commits to `main` branch
2. Check GitHub Actions tab for deployment progress
3. Verify deployment succeeded on Fly.io
4. Test the deployed app

## Related Files

- [.github/workflows/fly-deploy.yml](../.github/workflows/fly-deploy.yml) - GitHub Actions workflow
- [Dockerfile.fullstack](../Dockerfile.fullstack) - Multi-stage Docker build
- [CLAUDE.md](../CLAUDE.md) - Project development guidelines

## References

- [Fly.io GitHub Actions Docs](https://fly.io/docs/launch/continuous-deployment-with-github-actions/)
- [superfly/flyctl-actions](https://github.com/superfly/flyctl-actions)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
