import { convexAuth } from "@convex-dev/auth/server";
import Sendgrid from "@auth/core/providers/sendgrid";

// Magic link authentication using SendGrid
// Environment variables are set via: npx convex env set KEY value --prod
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Sendgrid({
      id: "sendgrid",
      // @ts-ignore - Convex injects env vars at runtime
      apiKey: process.env.AUTH_SENDGRID_KEY!,
      // @ts-ignore - Convex injects env vars at runtime
      from: process.env.AUTH_EMAIL_FROM || "Smart Transcribe <noreply@smarttranscribe.com>",
    }),
  ],
});
