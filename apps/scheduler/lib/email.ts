/**
 * Email service for sending invitations and notifications
 * Currently uses a simple approach - can be enhanced with Resend, SendGrid, etc.
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  // Check if email service is configured
  const emailApiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;
  
  if (!emailApiKey) {
    // In development or if email service not configured, just log
    console.log("📧 Email would be sent:", {
      to: options.to,
      subject: options.subject,
      // Don't log full HTML for privacy
    });
    return true; // Return true so invites still work, but email won't be sent
  }

  // If Resend API key is available, use Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Sewer Swarm AI <noreply@sewerswarm.ai>",
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        console.error("Failed to send email via Resend:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error sending email via Resend:", error);
      return false;
    }
  }

  // Fallback: log email (for development)
  console.log("📧 Email would be sent:", {
    to: options.to,
    subject: options.subject,
  });
  return true;
}

export function generateInviteEmailHtml(
  inviteUrl: string,
  organizationName: string,
  role: string,
  inviterName?: string
): string {
  const roleLabel = role === "admin" ? "Administrator" : role === "operations" ? "Operations Manager" : "Booker";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You've been invited!</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${inviterName ? `Hi! ${inviterName} has invited you` : "You've been invited"} to join <strong>${organizationName}</strong> on Sewer Swarm AI.
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      You'll be joining as a <strong>${roleLabel}</strong>.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Accept Invitation
      </a>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Or copy and paste this link into your browser:<br>
      <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
    </p>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      This invitation will expire in 7 days.
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #9ca3af;">
      This is an automated email from Sewer Swarm AI. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
  `.trim();
}
