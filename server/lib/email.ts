import { logInfo, logError, logWarn } from "./logger";
import { isFeatureEnabled } from "./env-validation";
import { resendBreaker } from "../db";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Escape user-provided strings before interpolating them into HTML email
 * bodies. Contact-form submissions flow unfiltered to admin mailboxes; an
 * untrusted `name` of `<script>…</script>` or `<img onerror=…>` would
 * execute in a webmail preview pane. Escape everything that could break
 * out of text context.
 */
export function escapeHtml(input: string): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!isFeatureEnabled("email")) {
    logWarn("email", "Email feature is disabled - RESEND_API_KEY not configured");
    return false;
  }

  try {
    // 15s timeout on the Resend call — if their API is hanging, we'd rather
    // surface the failure fast than pile up stalled requests behind it. The
    // circuit breaker fast-fails subsequent calls after 5 failures in a row.
    const response = await resendBreaker.execute(() => fetch("https://api.resend.com/emails", {
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
      signal: AbortSignal.timeout(15_000),
    }));

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
  const adminEmail = process.env.ADMIN_EMAIL || "andrew.scarpitta@gmail.com";

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  // Escape first, then convert newlines — otherwise a `<br />` injected by
  // the user would survive escaping.
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

  return sendEmail({
    to: adminEmail,
    // Subject is plain text, not HTML — but still strip control chars by
    // letting escapeHtml normalize it, then we can leave it as-is.
    subject: `[Home Buddy] New Contact Form Message from ${safeName}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>From:</strong> ${safeName} (${safeEmail})</p>
      <hr />
      <p><strong>Message:</strong></p>
      <p>${safeMessage}</p>
      <hr />
      <p><small>This message was sent via the Home Buddy contact form.</small></p>
    `,
  });
}
