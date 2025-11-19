# Fly.io Setup and Deployment Guide

## Prerequisites

1. Fly.io account (sign up at https://fly.io)
2. Flyctl CLI installed
3. Convex deployed to production

## Step 1: Install Flyctl (if not already installed)

### macOS
```bash
brew install flyctl
```

### Linux
```bash
curl -L https://fly.io/install.sh | sh
```

### Windows
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

## Step 2: Login to Fly.io

```bash
flyctl auth login
```

This will open your browser for authentication.

## Step 3: Create Fly.io App

The app name is already configured in `frontend/fly.toml` as `smart-transcribe`.

```bash
# From project root
cd frontend

# Create the app
flyctl apps create smart-transcribe

# Or if the name is taken, use a different name
flyctl apps create smart-transcribe-prod

# If you changed the name, update fly.toml:
# app = "smart-transcribe-prod"
```

## Step 4: Get Fly.io API Token

You need this token for GitHub Actions CI/CD.

```bash
# Create a deploy token
flyctl auth token
```

Copy the token output. You'll use this as the `FLY_API_TOKEN` GitHub secret.

## Step 5: Set GitHub Secret for Fly.io

```bash
# From project root
gh secret set FLY_API_TOKEN
# Paste the token from Step 4
```

## Step 6: Deploy to Fly.io

### Manual Deployment

```bash
cd frontend

# Deploy with Convex URL
flyctl deploy \
  --build-arg VITE_CONVEX_URL=https://nautical-guanaco-500.convex.cloud \
  --wait-timeout 15m \
  --remote-only
```

### Using Make (Recommended)

Add this to your Makefile:

```make
fly-deploy:
	@echo "🚀 Deploying frontend to Fly.io..."
	cd frontend && flyctl deploy \
		--build-arg VITE_CONVEX_URL=https://nautical-guanaco-500.convex.cloud \
		--wait-timeout 15m \
		--remote-only
```

Then run:
```bash
make fly-deploy
```

## Step 7: Configure Custom Domain (Optional)

```bash
# Add your custom domain
flyctl certs create yourdomain.com

# Add DNS records (shown in output)
# Add CNAME record: yourdomain.com -> smart-transcribe.fly.dev

# Verify SSL certificate
flyctl certs show yourdomain.com
```

## Step 8: View Deployed App

```bash
# Open the app in browser
flyctl open

# View logs
flyctl logs

# Check app status
flyctl status
```

## Configuration Details

### Fly.io Configuration (`frontend/fly.toml`)

```toml
app = "smart-transcribe"
primary_region = "sjc"  # San Jose, California

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true    # Saves money
  auto_start_machines = true   # Scales to zero when not in use
  min_machines_running = 0     # Cost optimization

[[vm]]
  memory = '256mb'
  cpu_kind = 'shared'
  cpus = 1
```

### Dockerfile (`frontend/Dockerfile`)

- Multi-stage build (Node → Nginx)
- Uses `VITE_CONVEX_URL` build argument
- Serves static files with Nginx
- Exposes port 8080

## Environment Variables

The frontend needs the Convex URL at **build time** (not runtime) because Vite bundles it into the app.

- `VITE_CONVEX_URL`: Set via `--build-arg` during deployment
- Value: `https://nautical-guanaco-500.convex.cloud`

## Cost Optimization

Current configuration is optimized for the free tier:
- **Auto-stop machines**: Stops when idle
- **Auto-start machines**: Starts on request
- **Min machines: 0**: Scales to zero (no cost when not in use)
- **256MB RAM**: Minimal resource usage
- **Shared CPU**: Lower cost tier

**Estimated cost**: Free tier covers ~3 apps with this config

## Scaling

To handle more traffic, update `fly.toml`:

```toml
[http_service]
  min_machines_running = 1  # Keep 1 machine always running

[[vm]]
  memory = '512mb'  # Increase memory
  cpus = 2          # Increase CPU
```

Then redeploy:
```bash
flyctl deploy
```

## Monitoring

```bash
# Real-time logs
flyctl logs --follow

# App metrics
flyctl dashboard metrics

# SSH into the machine (if needed)
flyctl ssh console

# List running machines
flyctl machines list
```

## Troubleshooting

### Build fails with "VITE_CONVEX_URL not set"

Make sure you're passing the build arg:
```bash
flyctl deploy --build-arg VITE_CONVEX_URL=https://nautical-guanaco-500.convex.cloud
```

### App won't start - "Connection refused"

Check nginx configuration:
```bash
flyctl ssh console
cat /etc/nginx/conf.d/default.conf
```

### 502 Bad Gateway

Usually means the app crashed or port mismatch:
```bash
flyctl logs
flyctl status
```

Verify `PORT=8080` in fly.toml matches Dockerfile `EXPOSE 8080`

### Deployment times out

Increase timeout:
```bash
flyctl deploy --wait-timeout 20m
```

### App name already taken

Use a different name:
```bash
flyctl apps create smart-transcribe-v2
# Update fly.toml: app = "smart-transcribe-v2"
```

## Rollback

```bash
# List releases
flyctl releases

# Rollback to previous release
flyctl releases rollback
```

## Cleanup

```bash
# Delete the app (if needed)
flyctl apps destroy smart-transcribe
```

## Security Considerations

- ✅ HTTPS enforced (`force_https = true`)
- ✅ Security headers configured (X-Frame-Options, X-Content-Type-Options)
- ✅ Static files only (no server-side secrets)
- ✅ Convex URL is public (safe to bundle in frontend)
- ⚠️ Rotate `FLY_API_TOKEN` if compromised

## GitHub Actions Integration

The workflow in `.github/workflows/ci-cd.yml` automatically:
1. Deploys Convex backend
2. Sets environment variables
3. Deploys frontend to Fly.io

Triggered on push to `main` or `master` branch.

## Quick Reference

```bash
# Deploy
make fly-deploy

# View logs
flyctl logs

# Check status
flyctl status

# Open app
flyctl open

# Scale up
flyctl scale count 2

# Scale down
flyctl scale count 1

# Update secrets (not needed for this app)
flyctl secrets set KEY=value
```

## Next Steps

1. ✅ Create Fly.io app
2. ✅ Get FLY_API_TOKEN
3. ✅ Set GitHub secret
4. ✅ Test manual deployment
5. ✅ Test CI/CD pipeline
6. ⚙️ Configure custom domain (optional)
7. ⚙️ Set up monitoring/alerts

---

**Ready to deploy?** Run: `make fly-deploy`
