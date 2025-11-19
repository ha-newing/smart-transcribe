import { convexAuth } from "@convex-dev/auth/server";
import { SendgridOTP } from "./SendgridOTP";

/**
 * OTP (Verification Code) authentication using SendGrid
 *
 * Users receive a 6-digit code via email and enter it to sign in.
 * No magic links - just enter the code directly.
 *
 * Environment variables required:
 * - AUTH_SENDGRID_KEY: SendGrid API key
 * - AUTH_EMAIL_FROM: From email address
 * - SITE_URL: Frontend URL for redirects
 *
 * Set via: npx convex env set KEY value
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [SendgridOTP],
});
