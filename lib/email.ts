/**
 * Emails from the Owner: the email itself (the same look as the account emails: the letterhead
 * with the logo, the Owner's message and pictures, the Cash App / Zelle box, the footer and an
 * Unsubscribe link) and the small Google script that sends it from the Owner's Gmail.
 *
 * The script checks every request with Supabase: only the signed-in Owner can send.
 */
import { donationInfo } from "./donation";
import type { SiteSettings } from "./types";

export const OWNER_EMAIL = "sdmivtzoim87@gmail.com";
export const SENDER_NAME = "Shiur Daled Mivtzoim";
/** Stands for each person's own Unsubscribe link; the script puts it in. */
export const UNSUB = "{{UNSUBSCRIBE}}";

/** The script the Owner pastes into script.google.com. */
export function emailScript() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return `// Shiur Daled Mivtzoim: sends the Owner's emails from this Gmail.
// Only the Owner, signed in on sdmivtzoim.com, can send (each request is checked).
const SUPABASE_URL = ${JSON.stringify(url)};
const SUPABASE_KEY = ${JSON.stringify(key)};
const OWNER = ${JSON.stringify(OWNER_EMAIL)};
const NAME = ${JSON.stringify(SENDER_NAME)};

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    checkOwner_(d.token);
    if (d.test) return reply_({ ok: true, left: MailApp.getRemainingDailyQuota() });
    const images = {};
    (d.images || []).forEach(function (im) {
      images[im.cid] = Utilities.newBlob(Utilities.base64Decode(im.data), im.type, im.name);
    });
    const sent = [];
    const failed = [];
    (d.to || []).forEach(function (r) {
      if (MailApp.getRemainingDailyQuota() < 1) return;
      try {
        MailApp.sendEmail({
          to: r.email,
          subject: String(d.subject).slice(0, 200),
          body: String(d.text).split(${JSON.stringify(UNSUB)}).join(r.unsubscribe),
          htmlBody: String(d.html).split(${JSON.stringify(UNSUB)}).join(r.unsubscribe),
          inlineImages: images,
          name: NAME,
        });
        sent.push(r.email);
      } catch (err) {
        failed.push({ email: r.email, error: String(err) });
      }
    });
    return reply_({ ok: true, sent: sent, failed: failed, left: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reply_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// Open the Web app link in a browser to check it: it should say "Connected".
function doGet() {
  return ContentService.createTextOutput("Connected. Emails can be sent today: " + MailApp.getRemainingDailyQuota());
}

function checkOwner_(token) {
  const res = UrlFetchApp.fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token },
    muteHttpExceptions: true,
  });
  const user = JSON.parse(res.getContentText() || "{}");
  if (res.getResponseCode() !== 200 || String(user.email || "").toLowerCase() !== OWNER) {
    throw new Error("Only the Owner, signed in on the website, can send emails.");
  }
}

function reply_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`;
}

export const isScriptUrl = (u: string) => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?$/.test(u.trim());

export interface EmailPicture {
  /** For the email: "cid:…" names the picture sent along with it. */
  cid: string;
  name: string;
  type: string;
  /** base64, without the "data:" start. */
  data: string;
  width: number;
  height: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const TEAL = "#006878";

/** The Owner's words: paragraphs on blank lines, line breaks kept, links clickable. */
function paragraphs(message: string) {
  return message
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => {
      const html = esc(p.trim())
        .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, `<a href="$1" target="_blank" style="color:${TEAL};">$1</a>`)
        .replace(/\n/g, "<br>");
      return `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#42474e;">${html}</p>`;
    })
    .join("");
}

/**
 * The email, as HTML. `src` gives each picture's address: "cid:…" in the real email, a data URL
 * in the preview on the site.
 */
export function emailHtml(o: { subject: string; message: string; pictures: EmailPicture[]; settings: Partial<SiteSettings>; src?: (p: EmailPicture) => string; unsubscribe?: string }) {
  const { cashtag, zelle } = donationInfo(o.settings as SiteSettings);
  const tag = cashtag.startsWith("$") ? cashtag : `$${cashtag}`;
  const src = o.src ?? ((p) => `cid:${p.cid}`);
  const unsub = o.unsubscribe ?? UNSUB;
  const year = new Date().getFullYear();
  const preview = o.message.trim().replace(/\s+/g, " ").slice(0, 120);
  const pics = o.pictures
    .map(
      (p) =>
        `<tr><td style="background-color:#ffffff;padding:8px 36px 16px;"><img src="${src(p)}" alt="" width="488" style="display:block;width:100%;max-width:488px;height:auto;border:0;border-radius:12px;"></td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(o.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f3;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preview)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f3;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="background-color:${TEAL};border-radius:16px 16px 0 0;padding:28px 36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:14px;">
                  <img src="https://sdmivtzoim.com/icon-192.png" width="44" height="44" alt="" style="display:block;border:0;border-radius:10px;box-shadow:0 0 0 2px rgba(255,255,255,0.35);">
                </td>
                <td style="vertical-align:middle;font-family:${FONT};color:#ffffff;">
                  <div style="font-size:19px;font-weight:700;letter-spacing:0.2px;line-height:1.2;">Shiur Daled Mivtzoim</div>
                  <div style="font-size:12px;letter-spacing:1.6px;text-transform:uppercase;opacity:0.8;line-height:1.6;">sdmivtzoim.com</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 36px 12px;font-family:${FONT};color:#1a1c1e;">
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#1a1c1e;">${esc(o.subject)}</h1>
            ${paragraphs(o.message)}
          </td>
        </tr>
        ${pics}
        <tr>
          <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:16px 36px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:#f4f7f8;border:1px solid #e1e6e8;border-radius:12px;padding:16px 18px;font-family:${FONT};font-size:14px;line-height:1.6;color:#42474e;">
                  <strong style="color:#1a1c1e;">Partner in the Mivtzoim</strong><br>
                  Your participation helps make the Mivtzoim possible.<br>
                  Cash App: <a href="https://cash.app/${esc(tag)}" target="_blank" style="color:${TEAL};text-decoration:none;">${esc(tag)}</a>
                  &nbsp;&middot;&nbsp; Zelle: <span style="color:#1a1c1e;">${esc(zelle)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:26px 24px 8px;font-family:${FONT};font-size:12px;line-height:1.7;color:#80868b;">
            <strong style="color:#5c6166;">Shiur Daled Mivtzoim</strong><br>
            Track your Mivtzoim, your routes and the people you visit, all in one place.<br>
            <a href="https://sdmivtzoim.com" target="_blank" style="color:${TEAL};text-decoration:none;">sdmivtzoim.com</a>
            &nbsp;&middot;&nbsp;
            <a href="mailto:${OWNER_EMAIL}" style="color:${TEAL};text-decoration:none;">Contact us</a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:6px 24px 0;font-family:${FONT};font-size:11px;line-height:1.6;color:#9aa0a6;">
            &copy; ${year} Shiur Daled Mivtzoim<br>
            You're getting this because you have an account on sdmivtzoim.com.
            <a href="${unsub}" target="_blank" style="color:#80868b;">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** The same email as plain text, for email apps that don't show pictures and colors. */
export function emailText(o: { subject: string; message: string; settings: Partial<SiteSettings> }) {
  const { cashtag, zelle } = donationInfo(o.settings as SiteSettings);
  return `${o.subject}\n\n${o.message.trim()}\n\n---\nPartner in the Mivtzoim: Cash App ${cashtag} · Zelle ${zelle}\nShiur Daled Mivtzoim · https://sdmivtzoim.com\n\nUnsubscribe: ${UNSUB}\n`;
}

/** A picture made small enough for email (at most 1200 pixels wide), as JPEG. */
export async function emailPicture(file: File, n: number): Promise<EmailPicture & { url: string }> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.86);
  return { cid: `pic${n}`, name: `picture-${n}.jpg`, type: "image/jpeg", data: url.split(",")[1], width: c.width, height: c.height, url };
}

/** Sends to the Owner's Google script. Plain text, so the browser sends it without asking first. */
export async function callEmailScript<R>(url: string, body: object): Promise<R> {
  const res = await fetch(url.trim(), { method: "POST", body: JSON.stringify(body), redirect: "follow" });
  const out = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & R) | null;
  if (!out?.ok) throw new Error(out?.error || `HTTP ${res.status}`);
  return out;
}
