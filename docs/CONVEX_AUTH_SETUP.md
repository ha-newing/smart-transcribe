# Convex Auth Setup Guide - OTP Email Authentication

Complete guide for setting up email OTP (One-Time Password) authentication with Convex Auth.

## Overview

This project uses:
- **Convex Auth** for authentication
- **SendGrid** for sending verification codes via email
- **OTP (6-digit codes)** instead of magic links
- **JWT tokens** with RS256 signing

---

## 1. Schema Requirements

### Users Table

The `users` table **must** override the default `authTables` schema with specific indexes that Convex Auth expects:

```typescript
// convex/schema.ts
import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  users: defineTable({
    // Standard Convex Auth fields (all optional per auth requirements)
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // Custom fields for your app
    role: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
  })
    .index("email", ["email"])  // ⚠️ MUST be named "email" (not "by_email")
    .index("phone", ["phone"])  // ⚠️ MUST be named "phone" (not "by_phone")
    .index("by_company", ["companyId"]),
});
```

### Critical Points:
- ✅ Index names MUST be `"email"` and `"phone"` (Convex Auth requirement)
- ✅ Email, role, and companyId should be **optional** to allow auth sign-up
- ✅ Include all standard auth fields from `authTables`
- ❌ Don't use `by_email` - the auth library specifically looks for `"email"`

---

## 2. Environment Variables

All environment variables must be set in the Convex dashboard (CLI has issues with multi-line values).

### Required Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `SITE_URL` | Frontend URL for redirects | `http://localhost:5173` (dev)<br>`https://yourdomain.com` (prod) |
| `JWT_PRIVATE_KEY` | Private key for signing JWTs (PKCS#8 format) | See generation below |
| `JWKS` | Public key for verifying JWTs (JSON) | See generation below |
| `AUTH_SENDGRID_KEY` | SendGrid API key | `SG.xxxxxx...` |
| `AUTH_EMAIL_FROM` | From email address | `Your App <noreply@yourdomain.com>` |

### Optional (for transcription features):
- `GEMINI_API_KEY`
- `SONIOX_API_KEY`

---

## 3. Generating JWT Keys

### ⚠️ CRITICAL: Use jose Library, Not OpenSSL

The jose library (used by Convex Auth) requires keys in a specific format. Using OpenSSL may create incompatible keys.

### Key Generation Script:

```javascript
// generate-jwt-key.mjs
import { exportPKCS8, exportJWK, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);

// Format for Convex: replace newlines with spaces
const formattedPrivateKey = privateKey.trimEnd().replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

console.log("JWT_PRIVATE_KEY:");
console.log(formattedPrivateKey);
console.log("\nJWKS:");
console.log(jwks);
```

### Run:
```bash
node generate-jwt-key.mjs
```

### Important Notes:
- ✅ Generate **separate keys** for dev and production
- ✅ Both `JWT_PRIVATE_KEY` and `JWKS` must be from the **same** key pair
- ✅ Keys must have newlines replaced with spaces for Convex
- ❌ Never commit keys to git
- ❌ Never reuse dev keys in production

---

## 4. Custom OTP Provider Setup

### SendGrid OTP Provider

Create a custom email provider that sends verification codes instead of magic links:

```typescript
// convex/SendgridOTP.ts
import { Email } from "@convex-dev/auth/providers/Email";
import { alphabet, generateRandomString } from "oslo/crypto";

export const SendgridOTP = Email({
  id: "sendgrid-otp",
  maxAge: 60 * 15, // 15 minutes expiration

  async generateVerificationToken() {
    // Generate a 6-digit numeric code
    return generateRandomString(6, alphabet("0-9"));
  },

  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.AUTH_SENDGRID_KEY;
    const fromEmail = process.env.AUTH_EMAIL_FROM;

    // Use SendGrid REST API via fetch (no Node.js dependencies)
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: fromEmail },
        subject: "Your verification code",
        content: [
          {
            type: "text/plain",
            value: `Your verification code is: ${token}\n\nThis code will expire in 15 minutes.`,
          },
          {
            type: "text/html",
            value: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Your Verification Code</h2>
                <p style="font-size: 16px; color: #666;">Enter this code to sign in:</p>
                <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${token}</span>
                </div>
                <p style="font-size: 14px; color: #999;">This code will expire in 15 minutes.</p>
              </div>
            `,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SendGrid API error:", errorText);
      throw new Error(`Failed to send verification email: ${response.status}`);
    }
  },
});
```

### Auth Configuration

```typescript
// convex/auth.ts
import { convexAuth } from "@convex-dev/auth/server";
import { SendgridOTP } from "./SendgridOTP";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [SendgridOTP],
});
```

### Dependencies Required:

```bash
npm install oslo
```

**Note:** Do NOT install `@sendgrid/mail` - it uses Node.js APIs (fs, path) which aren't available in Convex runtime. Use fetch API instead.

---

## 5. Frontend Implementation

### Login Page (Two-Step Flow)

```typescript
// LoginPage.tsx
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Step 1: Request verification code
      await signIn("sendgrid-otp", { email });
      setStep("code");
    } catch (error) {
      console.error("Error sending code:", error);
      alert("Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Step 2: Verify code and sign in
      await signIn("sendgrid-otp", { email, code });
      // Success! User will be redirected
    } catch (error) {
      console.error("Error verifying code:", error);
      alert("Invalid or expired code. Please try again.");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  // ... render forms based on step
}
```

---

## 6. Setting Environment Variables

### Via Convex Dashboard (Recommended)

1. Go to https://dashboard.convex.dev
2. Select your project
3. Navigate to **Settings → Environment Variables**
4. Switch between **Development** and **Production** tabs
5. Add/edit each variable:
   - JWT_PRIVATE_KEY = [paste private key with spaces]
   - JWKS = [paste JWKS JSON]
   - SITE_URL = http://localhost:5173
   - AUTH_SENDGRID_KEY = [your key]
   - AUTH_EMAIL_FROM = [your email]
6. Click **Save**

### Via CLI (For Simple Values Only)

```bash
# These work fine via CLI
npx convex env set SITE_URL "http://localhost:5173"
npx convex env set AUTH_SENDGRID_KEY "SG.xxxxx"
npx convex env set AUTH_EMAIL_FROM "Your App <noreply@domain.com>"

# For JWT_PRIVATE_KEY and JWKS, use the dashboard
# CLI has issues with multi-line/complex values
```

---

## 7. Common Issues & Troubleshooting

### ❌ "Index users.email not found"

**Cause:** Index named incorrectly (e.g., `by_email` instead of `email`)

**Fix:** In schema, use `.index("email", ["email"])` exactly

---

### ❌ "Missing environment variable SITE_URL"

**Cause:** SITE_URL not set in Convex environment

**Fix:** Set in dashboard for the correct deployment (dev/prod)

---

### ❌ "Missing environment variable JWT_PRIVATE_KEY"

**Cause:** JWT_PRIVATE_KEY not set

**Fix:** Generate using jose library and set in dashboard

---

### ❌ '"pkcs8" must be PKCS#8 formatted string'

**Cause:** Wrong key format (generated with OpenSSL instead of jose)

**Fix:** Regenerate key using jose library script above

---

### ❌ "Missing environment variable JWKS"

**Cause:** JWKS not set (required alongside JWT_PRIVATE_KEY)

**Fix:** Generate JWKS from the same key pair and set in dashboard

---

### ❌ "Could not resolve 'fs'" or "Could not resolve 'path'"

**Cause:** Using @sendgrid/mail package which requires Node.js APIs

**Fix:** Use SendGrid REST API via fetch instead (see provider code above)

---

### ❌ Wrong Convex Deployment

**Cause:** Multiple Convex deployments, variables set on wrong one

**Fix:**
1. Check which deployment your app uses (check convex.json or console)
2. Verify in dashboard dropdown (top right)
3. Set variables on correct deployment

---

## 8. Verification Checklist

After setup, verify:

- [ ] Schema has users table with `email` and `phone` indexes (not `by_email`)
- [ ] All fields in users table are optional
- [ ] JWT_PRIVATE_KEY set in correct deployment
- [ ] JWKS set in correct deployment (matches private key)
- [ ] SITE_URL set correctly (http://localhost:5173 for dev)
- [ ] AUTH_SENDGRID_KEY set
- [ ] AUTH_EMAIL_FROM set
- [ ] SendgridOTP provider uses fetch API (not @sendgrid/mail)
- [ ] Frontend uses "sendgrid-otp" provider ID
- [ ] Convex functions reload without errors

---

## 9. Testing the Flow

1. **Send Code:**
   - Enter email
   - Click "Send Code"
   - Check Convex logs for success
   - Check email inbox for 6-digit code

2. **Verify Code:**
   - Enter the 6-digit code
   - Click "Verify Code"
   - Should redirect to authenticated app
   - Check Convex dashboard → Data → users for new user entry

3. **Check Session:**
   - Refresh page - should stay logged in
   - Check browser localStorage for Convex auth token
   - Try accessing protected routes

---

## 10. Production Deployment

### Generate Production Keys

```bash
# Run generator script for production
node generate-jwt-key.mjs > production-keys.txt
```

### Set Production Environment Variables

In Convex Dashboard:
1. Switch to **Production** tab
2. Set all variables with production values:
   - SITE_URL = https://yourdomain.com
   - JWT_PRIVATE_KEY = [production private key]
   - JWKS = [production JWKS]
   - AUTH_SENDGRID_KEY = [production SendGrid key]
   - AUTH_EMAIL_FROM = [production email]

### Security Notes:
- ✅ Use different keys for dev and prod
- ✅ Store keys securely (password manager, secrets vault)
- ✅ Never commit keys to git
- ✅ Rotate keys periodically
- ✅ Monitor SendGrid usage for abuse

---

## 11. Useful Commands

```bash
# Check environment variables
npx convex env list

# Get specific variable
npx convex env get JWT_PRIVATE_KEY

# Generate new keys
node generate-jwt-key.mjs

# Check Convex logs (in separate terminal)
npx convex dev

# Deploy to production
npx convex deploy --prod
```

---

## 12. File Structure

```
project/
├── convex/
│   ├── schema.ts              # Users table with correct indexes
│   ├── auth.ts                # Auth configuration
│   ├── SendgridOTP.ts         # Custom OTP provider
│   └── users.ts               # User-related queries/mutations
├── src/
│   └── pages/
│       └── auth/
│           └── LoginPage.tsx  # Two-step OTP login
├── generate-jwt-key.mjs       # Key generator script
└── docs/
    └── CONVEX_AUTH_SETUP.md   # This file
```

---

## Resources

- [Convex Auth Documentation](https://labs.convex.dev/auth)
- [Convex Auth Manual Setup](https://labs.convex.dev/auth/setup/manual)
- [SendGrid API Documentation](https://docs.sendgrid.com/api-reference/mail-send/mail-send)
- [jose Library](https://github.com/panva/jose)
- [Known Issues: Multi-line Env Vars](https://github.com/get-convex/convex-backend/issues/128)

---

*Last updated: November 2025*
