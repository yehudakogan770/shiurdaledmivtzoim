"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Check, Copy, ImagePlus, Mail, Send, X } from "lucide-react";
import { useData } from "@/lib/data";
import type { EmailPerson } from "@/lib/backend";
import { callEmailScript, emailHtml, emailPicture, emailScript, emailText, isScriptUrl, type EmailPicture } from "@/lib/email";
import { Button, Card, CardTitle, Empty, Field, Input, Modal, PageHeader, Segmented, Textarea, cx } from "../ui";

/**
 * The Owner writes an email and sends it from the Owner's Gmail to everyone with an account (or
 * to people the Owner picks). Owner only, so it stays in English.
 */
type Pic = EmailPicture & { url: string };
const DRAFT = "sdm-email-draft";
/** Sent a few at a time, so the page can show how far it got. */
const BATCH = 20;

export function EmailView() {
  const { isOwner, backend } = useData();
  if (!isOwner || !backend?.emailList) return <Empty title="Only the Owner can send emails" icon={Mail} />;
  return <Composer />;
}

function Composer() {
  const { backend, settings, notify } = useData();
  const [people, setPeople] = useState<EmailPerson[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [scriptUrl, setScriptUrl] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pics, setPics] = useState<Pic[]>([]);
  const [who, setWho] = useState<"all" | "some">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  /** People this email still has to go to (after Gmail's daily limit stopped it). */
  const [left, setLeft] = useState<string[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState<{ done: number; of: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    backend!.emailList!().then(setPeople, (e: Error) => setProblem(e.message));
    backend!.emailSenderUrl?.().then(setScriptUrl);
    // A draft (and who still needs it) is kept on this device until it's all sent.
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || "null");
      if (d) {
        setSubject(d.subject ?? "");
        setMessage(d.message ?? "");
        setPics(d.pics ?? []);
        setWho(d.who ?? "all");
        setPicked(new Set(d.picked ?? []));
        setLeft(d.left ?? null);
      }
    } catch {
      // No draft.
    }
    loaded.current = true;
  }, [backend]);

  useEffect(() => {
    if (!loaded.current) return;
    const d = { subject, message, pics, who, picked: [...picked], left };
    try {
      localStorage.setItem(DRAFT, JSON.stringify(d));
    } catch {
      // Pictures can be too big to keep; keep the words at least.
      try {
        localStorage.setItem(DRAFT, JSON.stringify({ ...d, pics: [] }));
      } catch {
        // Not kept.
      }
    }
  }, [subject, message, pics, who, picked, left]);

  const open = useMemo(() => (people ?? []).filter((p) => !p.off), [people]);
  const offCount = (people?.length ?? 0) - open.length;
  const recipients = useMemo(() => {
    if (left) return open.filter((p) => left.includes(p.id));
    return who === "all" ? open : open.filter((p) => picked.has(p.id));
  }, [open, who, picked, left]);

  async function addPictures(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const made: Pic[] = [];
    for (const [i, f] of files.entries()) {
      try {
        made.push(await emailPicture(f, Date.now() + i));
      } catch {
        notify("That picture couldn't be opened.");
      }
    }
    setPics((p) => [...p, ...made].slice(0, 6));
  }

  async function send() {
    if (!scriptUrl) return notify("Connect your Gmail first (below).");
    if (!subject.trim() || !message.trim()) return notify("Write a subject and a message first.");
    if (!recipients.length) return notify("Nobody is chosen to get this email.");
    if (!confirm(`Send "${subject.trim()}" to ${recipients.length === 1 ? "1 person" : `${recipients.length} people`}?`)) return;
    const token = await backend!.accessToken?.();
    if (!token) return notify("Please sign in again.");
    const base = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/unsubscribe/?t=`;
    const html = emailHtml({ subject: subject.trim(), message, pictures: pics, settings });
    const text = emailText({ subject: subject.trim(), message, settings });
    const images = pics.map(({ cid, name, type, data }) => ({ cid, name, type, data }));
    const todo = [...recipients];
    const notSent: string[] = [];
    let sent = 0;
    let limit = false;
    setResult(null);
    setSending({ done: 0, of: todo.length });
    try {
      for (let i = 0; i < todo.length; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        if (limit) {
          notSent.push(...batch.map((p) => p.id));
          continue;
        }
        const r = await callEmailScript<{ sent: string[]; failed: { email: string }[]; left: number }>(scriptUrl, {
          token,
          subject: subject.trim(),
          html,
          text,
          images,
          to: batch.map((p) => ({ email: p.email, unsubscribe: base + p.token })),
        });
        sent += r.sent.length;
        const got = new Set(r.sent.map((e) => e.toLowerCase()));
        notSent.push(...batch.filter((p) => !got.has(p.email.toLowerCase())).map((p) => p.id));
        if (r.left < 1) limit = true;
        setSending({ done: Math.min(i + BATCH, todo.length), of: todo.length });
      }
    } catch (e) {
      const reason = (e as Error).message;
      notSent.push(...todo.slice(sent + notSent.length).map((p) => p.id));
      setResult(
        /failed to fetch|load failed|networkerror/i.test(reason)
          ? `Google turned the request away after ${sent} emails. Check that the script's deployment is open to "Anyone".`
          : `Stopped after ${sent} emails: ${reason}`,
      );
    }
    setSending(null);
    if (notSent.length) {
      setLeft(notSent);
      setResult((r) => r ?? `Sent to ${sent}. Gmail's limit for today was reached: ${notSent.length} more still need it. Come back tomorrow and press Send to the Rest.`);
    } else {
      setLeft(null);
      setSubject("");
      setMessage("");
      setPics([]);
      setResult(`Sent to ${sent === 1 ? "1 person" : `${sent} people`}.`);
    }
  }

  if (problem) return <Empty title="Emails aren't set up yet" icon={Mail}>{problem}</Empty>;

  return (
    <div className="grid grid-cols-1 gap-3">
      <PageHeader title="Send an Email" subtitle={`From Shiur Daled Mivtzoim (your Gmail), with the logo, the Cash App / Zelle box and an Unsubscribe link, like the account emails.`} />

      <Card>
        <CardTitle>Write</CardTitle>
        <div className="grid gap-4 px-6 pb-6">
          <Field label="Subject" htmlFor="email-subject">
            <Input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Chanukah Mivtzoim This Sunday" maxLength={150} />
          </Field>
          <Field label="Message" htmlFor="email-message" hint="Leave an empty line between paragraphs. Links can be clicked.">
            <Textarea id="email-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={9} placeholder="Write your message here." />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">Pictures or a poster</p>
            <div className="flex flex-wrap gap-2">
              {pics.map((p) => (
                <span key={p.cid} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-24 w-24 rounded-2xl object-cover" />
                  <button type="button" aria-label="Remove picture" onClick={() => setPics((l) => l.filter((x) => x.cid !== p.cid))} className="absolute -top-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-ink text-paper">
                    <X size={15} />
                  </button>
                </span>
              ))}
              {pics.length < 6 && (
                <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-2xl border border-dashed border-outline text-muted hover:bg-ink/5">
                  <ImagePlus size={24} aria-hidden />
                  <span className="sr-only">Add pictures</span>
                  <input type="file" accept="image/*" multiple onChange={addPictures} className="hidden" />
                </label>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted">They show under the message, full width.</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle sub={people ? `${open.length} can get emails${offCount ? ` · ${offCount} unsubscribed` : ""}` : "Loading…"}>Who Gets It</CardTitle>
        <div className="grid gap-3 px-6 pb-6">
          {left ? (
            <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent-on-soft">
              This email still has to go to {left.length === 1 ? "1 person" : `${left.length} people`} (Gmail&apos;s daily limit stopped it).{" "}
              <button type="button" className="font-medium underline" onClick={() => setLeft(null)}>
                Start a new email instead
              </button>
            </p>
          ) : (
            <>
              <Segmented<"all" | "some"> label="Who gets it" value={who} onChange={setWho} options={[{ value: "all", label: "Everyone" }, { value: "some", label: "Choose people" }]} />
              {who === "some" && <Picker people={people ?? []} picked={picked} onChange={setPicked} />}
            </>
          )}
        </div>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="ghost" className="h-12" onClick={() => setPreviewing(true)} disabled={!subject.trim() && !message.trim()}>
          Preview
        </Button>
        <Button className="h-12" onClick={send} disabled={!!sending}>
          <Send size={18} aria-hidden />
          {sending ? `Sending… ${sending.done} of ${sending.of}` : left ? "Send to the Rest" : `Send to ${recipients.length === 1 ? "1 person" : `${recipients.length} people`}`}
        </Button>
      </div>
      {result && <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent-on-soft" role="status">{result}</p>}

      <Connect url={scriptUrl} onChange={setScriptUrl} />

      {previewing && (
        <Modal onClose={() => setPreviewing(false)} blur>
          <div onClick={(e) => e.stopPropagation()} className="grid w-full max-w-[640px] gap-3 rounded-[28px] bg-card p-3 shadow-pop">
            <div className="flex items-center justify-between px-2 pt-1">
              <span className="text-sm font-medium">Preview</span>
              <button type="button" onClick={() => setPreviewing(false)} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5">
                <X size={20} />
              </button>
            </div>
            <iframe
              title="Email preview"
              className="h-[70vh] w-full rounded-2xl bg-white"
              srcDoc={emailHtml({ subject: subject.trim() || "(No subject)", message, pictures: pics, settings, src: (p) => (p as Pic).url, unsubscribe: "#" })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Picker({ people, picked, onChange }: { people: EmailPerson[]; picked: Set<string>; onChange(s: Set<string>): void }) {
  const [q, setQ] = useState("");
  const shown = people.filter((p) => !q.trim() || `${p.name} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  return (
    <div className="grid gap-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a name or email" aria-label="Find a name or email" />
      <ul className="max-h-80 overflow-y-auto">
        {shown.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={p.off}
              onClick={() => toggle(p.id)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-start hover:bg-ink/5 disabled:opacity-50"
            >
              <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-lg border", picked.has(p.id) && !p.off ? "border-accent bg-accent text-accent-ink" : "border-outline")}>
                {picked.has(p.id) && !p.off && <Check size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-xs text-muted">{p.off ? "Unsubscribed" : p.email}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{picked.size === 1 ? "1 person chosen" : `${picked.size} people chosen`}</p>
    </div>
  );
}

/** Connecting the Owner's Gmail: the Google script that sends the emails. */
function Connect({ url, onChange }: { url: string | null; onChange(u: string | null): void }) {
  const { backend, notify } = useData();
  const [text, setText] = useState(url ?? "");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [steps, setSteps] = useState(!url);
  useEffect(() => {
    setText(url ?? "");
    setSteps(!url);
  }, [url]);

  async function connect() {
    const next = text.trim();
    if (next && !isScriptUrl(next)) return notify("That isn't the script's Web app address. It starts with https://script.google.com/macros/s/ and ends with /exec");
    setBusy(true);
    try {
      if (next) {
        const token = await backend!.accessToken?.();
        const r = await callEmailScript<{ left: number }>(next, { token, test: true });
        setLeft(r.left);
      }
      await backend!.setEmailSenderUrl!(next || null);
      onChange(next || null);
      notify(next ? "Connected. Emails will go out from your Gmail." : "Disconnected.");
    } catch (e) {
      const reason = (e as Error).message;
      notify(/failed to fetch|load failed|networkerror/i.test(reason) ? 'Google turned the request away. In the script, Deploy → Manage deployments: Who has access must be "Anyone".' : reason);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(emailScript());
      notify("Script copied.");
    } catch {
      notify("Couldn't copy. Try again.");
    }
  }

  return (
    <Card>
      <CardTitle sub={url ? `Connected${left != null ? ` · ${left} emails can still go out today` : ""}` : "Not connected yet: emails go out from your Gmail through a small Google script."}>Your Gmail</CardTitle>
      <div className="grid gap-3 px-6 pb-6">
        {steps ? (
          <ol className="grid list-decimal gap-1.5 ps-5 text-sm">
            <li>On a computer, sign in to Google as sdmivtzoim87@gmail.com and open script.google.com.</li>
            <li>Click New project. Delete what&apos;s there and paste the script (Copy Script, below).</li>
            <li>Click Save, then Deploy → New deployment → the gear → Web app.</li>
            <li>Set Execute as: Me, and Who has access: Anyone. Click Deploy, then Authorize and allow it.</li>
            <li>Copy the Web app URL, paste it below and click Connect.</li>
          </ol>
        ) : (
          <button type="button" className="justify-self-start text-sm font-medium text-accent" onClick={() => setSteps(true)}>
            Show the steps again
          </button>
        )}
        <Button variant="ghost" className="h-11 justify-self-start" onClick={copy}>
          <Copy size={17} aria-hidden /> Copy Script
        </Button>
        <Field label="Web app URL" htmlFor="email-script">
          <Input id="email-script" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </Field>
        <Button className="h-11 justify-self-start" onClick={connect} disabled={busy}>
          {busy ? "Checking…" : "Connect"}
        </Button>
        <p className="text-xs text-muted">Gmail lets a free account send to about 100 people a day.</p>
      </div>
    </Card>
  );
}
