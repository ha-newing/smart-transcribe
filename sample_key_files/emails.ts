import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Email service using SendGrid
 * Uses Convex actions to call external SendGrid API
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email via SendGrid
 * This is an action (not mutation) because it calls external APIs
 */
export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
  },
  handler: async (_ctx, args: SendEmailParams) => {
    // Reuse the same SendGrid key as auth (AUTH_SENDGRID_KEY)
    // @ts-ignore - Convex injects env vars at runtime
    const apiKey = process.env.AUTH_SENDGRID_KEY;
    // @ts-ignore - Convex injects env vars at runtime
    const fromEmail = process.env.AUTH_EMAIL_FROM || "Newing Insights <insights@mail.newing.vn>";

    // Parse email from "Name <email>" format
    const fromMatch = fromEmail.match(/(.*?)\s*<(.+?)>/) || ["", "Newing Insights", fromEmail];
    const fromName = fromMatch[1].trim() || "Newing Insights";
    const fromAddress = fromMatch[2] || fromEmail;

    if (!apiKey) {
      throw new Error("AUTH_SENDGRID_KEY not configured. Run: make convex-env-sync");
    }

    const payload = {
      personalizations: [
        {
          to: [{ email: args.to }],
          subject: args.subject,
        },
      ],
      from: {
        email: fromAddress,
        name: fromName,
      },
      content: [
        ...(args.text
          ? [
              {
                type: "text/plain",
                value: args.text,
              },
            ]
          : []),
        {
          type: "text/html",
          value: args.html,
        },
      ],
    };

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SendGrid API error:", errorText);
        throw new Error(`SendGrid API error: ${response.status} ${errorText}`);
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  },
});

/**
 * Send invitation email to new user
 */
export const sendInvitationEmail = action({
  args: {
    to: v.string(),
    name: v.string(),
    role: v.string(),
    invitedBy: v.string(),
  },
  handler: async (_ctx, args): Promise<{ success: boolean }> => {
    // @ts-ignore - Convex injects env vars at runtime
    const appUrl = process.env.APP_URL || "https://insights.newing.vn";
    const loginUrl = `${appUrl}/login`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to Newing Insights</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Newing Insights</h1>
    <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0;">Talent Assessment Platform</p>
  </div>

  <div style="background: white; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #1f2937; margin-top: 0;">Hello ${args.name},</h2>

    <p style="color: #4b5563; font-size: 16px;">
      You've been invited by <strong>${args.invitedBy}</strong> to join Newing Insights as a <strong>${args.role}</strong>.
    </p>

    <p style="color: #4b5563; font-size: 16px;">
      Newing Insights is our comprehensive talent assessment platform that helps organizations evaluate and develop their talent effectively.
    </p>

    <div style="text-align: center; margin: 35px 0;">
      <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Get Started
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Or copy and paste this URL into your browser:<br>
      <a href="${loginUrl}" style="color: #667eea; word-break: break-all;">${loginUrl}</a>
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 13px; margin: 0;">
      If you didn't expect this invitation, you can safely ignore this email.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 5px 0;">© ${new Date().getFullYear()} Newing Talent Solutions. All rights reserved.</p>
    <p style="margin: 5px 0;">
      <a href="https://newing.vn" style="color: #667eea; text-decoration: none;">Visit our website</a>
    </p>
  </div>
</body>
</html>
    `.trim();

    const text = `
Hello ${args.name},

You've been invited by ${args.invitedBy} to join Newing Insights as a ${args.role}.

Newing Insights is our comprehensive talent assessment platform that helps organizations evaluate and develop their talent effectively.

To get started, please visit:
${loginUrl}

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} Newing Talent Solutions. All rights reserved.
Visit our website: https://newing.vn
    `.trim();

    // Send email directly using SendGrid API
    // Reuse the same SendGrid key as auth (AUTH_SENDGRID_KEY)
    // @ts-ignore - Convex injects env vars at runtime
    const apiKey = process.env.AUTH_SENDGRID_KEY;
    // @ts-ignore - Convex injects env vars at runtime
    const fromEmail = process.env.AUTH_EMAIL_FROM || "Newing Insights <insights@mail.newing.vn>";

    // Parse email from "Name <email>" format
    const fromMatch = fromEmail.match(/(.*?)\s*<(.+?)>/) || ["", "Newing Insights", fromEmail];
    const fromName = fromMatch[1].trim() || "Newing Insights";
    const fromAddress = fromMatch[2] || fromEmail;

    if (!apiKey) {
      throw new Error("AUTH_SENDGRID_KEY not configured. Run: make convex-env-sync");
    }

    const payload = {
      personalizations: [
        {
          to: [{ email: args.to }],
          subject: "You've been invited to Newing Insights",
        },
      ],
      from: {
        email: fromAddress,
        name: fromName,
      },
      content: [
        {
          type: "text/plain",
          value: text,
        },
        {
          type: "text/html",
          value: html,
        },
      ],
    };

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SendGrid API error:", errorText);
        throw new Error(`SendGrid API error: ${response.status} ${errorText}`);
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send invitation email:", error);
      throw error;
    }
  },
});
