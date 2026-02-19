import { logInfo, logError, logWarn } from "./logger";
import { isFeatureEnabled } from "./env-validation";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!isFeatureEnabled("email")) {
    logWarn("email", "Email feature is disabled - RESEND_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: options.from || "Home Buddy <onboarding@resend.dev>",
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logError("email", new Error(`Failed to send email: ${error}`));
      return false;
    }

    logInfo("email", "Email sent successfully", { to: options.to, subject: options.subject });
    return true;
  } catch (error) {
    logError("email", error);
    return false;
  }
}

export async function sendContactFormNotification(
  name: string,
  email: string,
  message: string
): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || "drew@homebuddy.space";
  
  return sendEmail({
    to: adminEmail,
    subject: `[Home Buddy] New Contact Form Message from ${name}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>From:</strong> ${name} (${email})</p>
      <hr />
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, "<br />")}</p>
      <hr />
      <p><small>This message was sent via the Home Buddy contact form.</small></p>
    `,
  });
}
