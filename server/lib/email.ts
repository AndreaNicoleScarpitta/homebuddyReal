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

// ─── Shared email wrapper ─────────────────────────────────────────────────────

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr>
          <td style="background:#f97316;padding:24px 32px;">
            <span style="font-size:20px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">🏠 Home Buddy</span>
          </td>
        </tr>
        <tr><td style="padding:32px;">${content}</td></tr>
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 Home Buddy. You're receiving this because you have an account with us.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Welcome email ─────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, firstName: string | null): Promise<boolean> {
  const name = escapeHtml(firstName || "there");
  return sendEmail({
    to: email,
    subject: "Welcome to Home Buddy 🏠",
    html: emailShell(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">Welcome, ${name}!</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">You're all set. Home Buddy will help you stay on top of your home's maintenance so nothing sneaks up on you.</p>
      <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#374151;">Here's how to get started:</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
        <tr><td style="padding:8px 0;font-size:14px;color:#374151;">✅ &nbsp;Add your home's details and systems</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#374151;">📄 &nbsp;Upload an inspection report or warranty doc</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#374151;">🔧 &nbsp;Review the maintenance tasks AI generates for you</td></tr>
      </table>
      <a href="https://homebuddy.app/onboarding" style="display:inline-block;background:#f97316;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">Set up my home →</a>
    `),
  });
}

// ─── Password reset email ──────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  email: string,
  firstName: string | null,
  resetUrl: string,
): Promise<boolean> {
  const name = escapeHtml(firstName || "there");
  const safeUrl = escapeHtml(resetUrl);
  return sendEmail({
    to: email,
    subject: "Reset your Home Buddy password",
    html: emailShell(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">Hi ${name}, we received a request to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.</p>
      <a href="${safeUrl}" style="display:inline-block;background:#f97316;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">Reset my password →</a>
      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
      <p style="margin:8px 0 0;font-size:12px;color:#d1d5db;word-break:break-all;">Or copy this link: ${safeUrl}</p>
    `),
  });
}

// ─── Contact form ─────────────────────────────────────────────────────────────

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
