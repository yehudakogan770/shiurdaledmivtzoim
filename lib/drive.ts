/**
 * Print copies in Google Drive. The website keeps its small, fast photos; each photo is also sent,
 * large (about 3000 pixels), to a folder in the Owner's Google Drive, one folder per week, so the
 * week's photos can be printed well. A small Google Apps Script, running in the Owner's own Google
 * account, receives them; its address is saved on the Admin page.
 */

/** The script the Owner pastes into script.google.com (see the Admin page for the steps). */
export const DRIVE_SCRIPT = `// Shiur Daled Mivtzoim: saves print copies of shared photos in this Google Drive,
// in "Mivtzoim Photos", one folder per week.
const ROOT = "Mivtzoim Photos";

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.test) return reply({ ok: true, folder: root_().getUrl() });
    if (!/^image\\/(jpeg|png|webp)$/.test(d.type)) throw new Error("Only photos");
    const bytes = Utilities.base64Decode(d.data);
    if (bytes.length > 20 * 1024 * 1024) throw new Error("Too big");
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    let week;
    try {
      week = folder_(root_(), String(d.week || "Photos").slice(0, 100));
    } finally {
      lock.releaseLock();
    }
    week.createFile(Utilities.newBlob(bytes, d.type, String(d.name || "photo.jpg").slice(0, 150)));
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

// Open the Web app link in a browser to check it: it should say "Connected".
function doGet() {
  return ContentService.createTextOutput("Connected. Photos will be saved in: " + root_().getUrl());
}

function root_() {
  return folder_(DriveApp.getRootFolder(), ROOT);
}

function folder_(parent, name) {
  const found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`;

/** A Google Apps Script web app address, as copied from "Deploy". */
export function isDriveUrl(url: string) {
  return /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url.trim());
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Sends one photo to the Drive script. Plain text, so the browser sends it without asking first. */
export async function sendToDrive(url: string, payload: { week: string; name: string; photo?: Blob; test?: boolean }) {
  const body = payload.test
    ? { test: true }
    : { week: payload.week, name: payload.name, type: payload.photo!.type || "image/jpeg", data: await toBase64(payload.photo!) };
  const res = await fetch(url.trim(), { method: "POST", body: JSON.stringify(body), redirect: "follow" });
  const out = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; folder?: string } | null;
  if (!out?.ok) throw new Error(out?.error || `HTTP ${res.status}`);
  return out;
}
