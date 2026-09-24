"use client";

import type { ButtonHTMLAttributes, ComponentType, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useNav } from "@/lib/nav";

/* Material You (Material 3) building blocks, styled after Google Pixel. */

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "tonal" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium tracking-[0.01em] transition-[background-color,box-shadow,filter] disabled:cursor-not-allowed disabled:opacity-40";
const buttonVariants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:shadow-card hover:brightness-110",
  tonal: "bg-secondary-soft text-secondary-on-soft hover:shadow-card hover:brightness-[0.97]",
  secondary: "border border-outline text-accent hover:bg-accent/8",
  ghost: "px-4 text-accent hover:bg-accent/8",
  danger: "border border-outline text-danger hover:bg-danger/8",
};

export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...props} className={cx(buttonBase, buttonVariants[variant], className)} />;
}

export function ButtonLink({ href, variant = "primary", className, children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  const { Link } = useNav();
  return (
    <Link href={href} className={cx(buttonBase, buttonVariants[variant], className)}>
      {children}
    </Link>
  );
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-ink/8 hover:text-ink disabled:opacity-40", className)}
    />
  );
}

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  action,
  back,
}: {
  title: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  const { Link } = useNav();
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-1 pt-2">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="-ml-3 mb-3 inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-muted hover:bg-ink/8 hover:text-ink">
            ← {back.label}
          </Link>
        )}
        {eyebrow && <p className="mb-2 text-sm font-medium text-accent">{eyebrow}</p>}
        <h1 className="text-[2.25rem] font-normal leading-[1.12] tracking-[-0.01em] sm:text-[2.75rem]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-base text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </header>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-[28px]", !className?.includes("bg-") && "bg-card", className)}>{children}</section>;
}

export function CardTitle({ children, sub, action }: { children: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3">
      <div className="min-w-0">
        <h2 className="text-lg font-medium">{children}</h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** Divided rows inside a card, Pixel-settings style. */
export const listClass = "divide-y divide-line/60";

export function Empty({ title, icon: Icon, children, action }: { title: string; icon?: ComponentType<{ size?: number; className?: string }>; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      {Icon && (
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-[20px] bg-accent-soft text-accent-on-soft">
          <Icon size={28} />
        </span>
      )}
      <p className="text-lg font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-6 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="px-1 text-sm font-medium text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="px-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border-2 border-transparent bg-sunken px-4 py-3 text-base text-ink placeholder:text-muted/60 transition-colors focus:border-accent focus:bg-surface focus:outline-none";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputClass, "appearance-none bg-[length:1.1rem] bg-[right_1rem_center] bg-no-repeat pr-10", props.className)} style={{ backgroundImage: CHEVRON }} />;
}

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2375777d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

type Tone = "accent" | "candle" | "sage" | "ink";
const toneSoft: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent-on-soft",
  candle: "bg-candle-soft text-candle-on-soft",
  sage: "bg-sage-soft text-sage-on-soft",
  ink: "bg-secondary-soft text-secondary-on-soft",
};

export function Stat({
  label,
  value,
  note,
  delta,
  tone = "accent",
  icon: Icon,
}: {
  label: string;
  value: number | string;
  note?: string;
  delta?: number | null;
  tone?: Tone;
  icon?: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] bg-card p-5">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className={cx("grid h-10 w-10 place-items-center rounded-full", toneSoft[tone])}>
            <Icon size={20} />
          </span>
        )}
        <p className="text-sm font-medium text-muted">{label}</p>
      </div>
      <p className="tabular text-[2.75rem] font-normal leading-none tracking-tight">{value}</p>
      <div className="flex min-h-6 flex-wrap items-center gap-2 text-xs">
        {delta != null && delta !== 0 && (
          <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", delta > 0 ? "bg-sage-soft text-sage-on-soft" : "bg-sunken text-muted")}>
            {delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        )}
        {note && <span className="text-muted">{note}</span>}
      </div>
    </div>
  );
}

export function CategoryDot({ type }: { type: "tefillin" | "shabbos_candles" | "personal" }) {
  const color = { tefillin: "bg-accent", shabbos_candles: "bg-candle", personal: "bg-sage" }[type];
  return <span aria-hidden className={cx("inline-block h-2.5 w-2.5 shrink-0 rounded-full", color)} />;
}

export function CategoryIcon({ type, icon: Icon }: { type: "tefillin" | "shabbos_candles" | "personal"; icon: ComponentType<{ size?: number }> }) {
  const tone: Tone = type === "tefillin" ? "accent" : type === "shabbos_candles" ? "candle" : "sage";
  return (
    <span aria-hidden className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full", toneSoft[tone])}>
      <Icon size={18} />
    </span>
  );
}

export function Badge({ children, tone = "ink" }: { children: ReactNode; tone?: Tone }) {
  return <span className={cx("inline-flex h-6 items-center rounded-lg px-2 text-xs font-medium", toneSoft[tone])}>{children}</span>;
}

const AVATAR_TONES = [
  "bg-accent-soft text-accent-on-soft",
  "bg-candle-soft text-candle-on-soft",
  "bg-sage-soft text-sage-on-soft",
  "bg-secondary-soft text-secondary-on-soft",
];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, id, size = 32 }: { name: string; id?: string; size?: number }) {
  const key = id || name;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (
    <span
      aria-hidden
      className={cx("inline-grid shrink-0 place-items-center rounded-full font-medium", AVATAR_TONES[h % AVATAR_TONES.length])}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

/** Material 3 segmented button. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange(v: T): void; label: string }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-outline text-sm" role="group" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex h-9 items-center gap-1.5 px-4 font-medium transition-colors",
            i > 0 && "border-l border-outline",
            value === o.value ? "bg-secondary-soft text-secondary-on-soft" : "text-ink hover:bg-ink/8",
          )}
        >
          {value === o.value && <span aria-hidden>✓</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Material 3 filter chip. */
export function Chip({ selected, onClick, children, disabled }: { selected?: boolean; onClick(): void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-40",
        selected ? "border-transparent bg-secondary-soft text-secondary-on-soft" : "border-outline text-muted hover:bg-ink/8",
      )}
    >
      {children}
    </button>
  );
}
