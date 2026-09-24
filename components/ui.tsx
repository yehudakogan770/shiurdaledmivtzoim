"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useNav } from "@/lib/nav";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const buttonVariants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:bg-sunken",
  ghost: "text-muted hover:bg-sunken hover:text-ink",
  danger: "border border-line bg-surface text-danger hover:bg-sunken",
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

export function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: ReactNode; action?: ReactNode; back?: { href: string; label: string } }) {
  const { Link } = useNav();
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-block text-sm text-muted hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </header>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-lg border border-line bg-surface", className)}>{children}</section>;
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="font-display text-xl font-bold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputClass, props.className)} />;
}

export function Stat({ label, value, note, tone = "accent" }: { label: string; value: number | string; note?: string; tone?: "accent" | "candle" | "sage" | "ink" }) {
  const color = { accent: "text-accent", candle: "text-candle", sage: "text-sage", ink: "text-ink" }[tone];
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={cx("tabular mt-1 font-display text-4xl font-bold leading-none", color)}>{value}</p>
      {note && <p className="mt-1.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

export function CategoryDot({ type }: { type: "tefillin" | "shabbos_candles" | "personal" }) {
  const color = { tefillin: "bg-accent", shabbos_candles: "bg-candle", personal: "bg-sage" }[type];
  return <span aria-hidden className={cx("inline-block h-2.5 w-2.5 shrink-0 rounded-full", color)} />;
}
