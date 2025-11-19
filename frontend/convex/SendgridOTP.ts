import { Email } from "@convex-dev/auth/providers/Email";
import { alphabet, generateRandomString } from "oslo/crypto";

/**
 * SendGrid OTP Provider for Convex Auth
 * Sends a 6-digit verification code via email instead of magic links
 * Uses SendGrid REST API via fetch (no Node.js dependencies)
 */
export const SendgridOTP = Email({
  id: "sendgrid-otp",
  maxAge: 60 * 15, // 15 minutes expiration

  async generateVerificationToken() {
    // Generate a 6-digit numeric code
    return generateRandomString(6, alphabet("0-9"));
  },

  async sendVerificationRequest({ identifier: email, token }) {
    // @ts-ignore - Convex injects env vars at runtime
    const apiKey = process.env.AUTH_SENDGRID_KEY;
    // @ts-ignore - Convex injects env vars at runtime
    const fromEmail = process.env.AUTH_EMAIL_FROM || "Smart Transcribe <noreply@smarttranscribe.com>";

    if (!apiKey) {
      throw new Error("AUTH_SENDGRID_KEY environment variable is not set");
    }

    // SendGrid REST API v3 - send email using fetch
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email }],
          },
        ],
        from: { email: fromEmail },
        subject: "Your verification code",
        content: [
          {
            type: "text/plain",
            value: `Your verification code is: ${token}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this code, please ignore this email.`,
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
                <p style="font-size: 14px; color: #999;">If you didn't request this code, please ignore this email.</p>
              </div>
            `,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SendGrid API error:", errorText);
      throw new Error(`Failed to send verification email: ${response.status} ${errorText}`);
    }
  },
});
