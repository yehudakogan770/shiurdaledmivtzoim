import { cx } from "./ui";

/** The brand mark: the letter daled (ד), for Shiur Daled, drawn as shapes so it renders without fonts. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cx("shrink-0", className)}>
      <rect width="32" height="32" rx="11" fill="#106a7a" />
      <path d="M7.5 9.5h17.5a1.5 1.5 0 0 1 0 3h-2.4V23a1.9 1.9 0 0 1-3.8 0V12.5H7.5a1.5 1.5 0 0 1 0-3z" fill="#ffffff" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-3">
      <LogoMark className="h-10 w-10" />
      <span className="leading-tight">
        <span className="block text-lg font-medium text-ink">Shiur Daled</span>
        <span className="block text-sm text-muted">Mivtzoim</span>
      </span>
    </span>
  );
}
