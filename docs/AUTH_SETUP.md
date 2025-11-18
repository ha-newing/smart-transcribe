# Auth Setup - Convex + SendGrid

## Quick Start

```bash
# 1. Sync your .env credentials to Convex
make convex-env-sync

# 2. Start development
make convex-dev    # Terminal 1
npm run dev        # Terminal 2 (from frontend/)
```

That's it! Your SendGrid credentials from `.env` are now in Convex.

---

## Architecture

```
.env (root) → make convex-env-sync → Convex Backend (all secrets)
                                            ↓
                                      Auth, LLMs, Storage

frontend/.env.local → VITE_CONVEX_URL → Baked into build → Fly.io (no secrets!)
```

**All secrets live in Convex backend, not in frontend!**

---

## What Gets Synced

`make convex-env-sync` automatically syncs from `.env`:

- **Auth**: `SENDGRID_API_KEY` → `AUTH_SENDGRID_KEY`
- **Auth**: `SENDGRID_FROM_NAME` + `SENDGRID_FROM_EMAIL` → `AUTH_EMAIL_FROM`
- **LLMs**: `CLAUDE_API_KEY`, `GEMINI_API_KEY`
- **Speech**: `SONIOX_API_KEY`, `ELEVEN_LABS_KEY`
- **Storage**: `AZURE_STORAGE_CONNECTION_STRING`
- **Analytics**: `POSTHOG_API_KEY`, `POSTHOG_HOST`

---

## Auth Flow

1. User enters email on login page
2. Convex backend sends magic link via SendGrid
3. User clicks link → signed in
4. Default role: `PARTICIPANT`
5. Admins can update roles via Convex functions

---

## User Roles

- **ADMIN** - Full system access, manage users
- **FACILITATOR** - Run assessment sessions
- **ASSESSOR** - Evaluate participants
- **PARTICIPANT** - Take assessments

---

## Development

```bash
# One-time setup
make convex-setup    # Syncs .env → Convex

# Daily development
make convex-dev      # Terminal 1: Convex backend
cd frontend && npm run dev  # Terminal 2: React app
```

Visit: http://localhost:5173/login

---

## Production Deployment

### Frontend (Fly.io)
```bash
fly deploy
```

Deploys static React app. No secrets needed - uses `VITE_CONVEX_URL` from build.

### Backend (Convex)
```bash
cd frontend
npx convex deploy --prod
```

Or set production environment variables:
```bash
npx convex deploy --prod
npx convex env set AUTH_SENDGRID_KEY "SG.prod_key" --prod
```

---

## Troubleshooting

### "Failed to send email"
- Run `make convex-env-sync` to ensure credentials are set
- Check SendGrid API key is valid
- Verify sender email in SendGrid dashboard

### "Environment variable not found"
- Ensure `.env` exists in project root
- Run `make convex-env-sync` again
- Check Convex dashboard: Settings → Environment Variables

### "Auth provider not found"
- Frontend uses `signIn("sendgrid", { email })`
- Backend has `Sendgrid` provider configured
- Check `convex/auth.ts`

---

## Files

- `.env` - Root credentials (gitignored)
- `Makefile` - `convex-env-sync` command
- `frontend/.env.local` - Frontend config (VITE_CONVEX_URL)
- `frontend/convex/auth.ts` - Auth configuration
- `frontend/convex/schema.ts` - User schema with roles
- `frontend/src/pages/auth/LoginPage.tsx` - Login UI

---

## Next Steps

- [x] Auth with SendGrid magic links
- [x] Role-based access control
- [ ] Protected routes
- [ ] Admin user management page
- [ ] Password auth (optional)
