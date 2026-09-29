/**
 * Tefillin: the square bayis with a shin on its face, sitting on its base
 * (titura), with the retzuos (straps) running out to each side.
 * Drawn to match the lucide icon set (24×24, 2px round strokes, currentColor).
 */
export function TefillinIcon({ size = 24, className, strokeWidth = 2 }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {/* bayis */}
      <rect x="6.5" y="3.5" width="11" height="10.5" rx="1.2" />
      {/* shin */}
      <path d="M9.5 6.5v3.2a1.3 1.3 0 0 0 1.3 1.3h2.4a1.3 1.3 0 0 0 1.3-1.3V6.5M12 6.5V11" />
      {/* titura (base) */}
      <rect x="4.5" y="14" width="15" height="3.5" rx="1" />
      {/* retzuos */}
      <path d="M4.5 15.75C2.5 15.75 2 18.5 3 20.5M19.5 15.75c2 0 2.5 2.75 1.5 4.75" />
    </svg>
  );
}

/** A three-strand braided challah: the loaf with its braided knots across the top. */
export function ChallahIcon({ size = 24, className, strokeWidth = 2 }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {/* A plain challah roll: a round loaf with three soft sections. */}
      <path d="M4.5 18c-2 0-2.2-4-.5-5.4.6-3 4-3.6 5.5-1.8 1-2.8 4-2.8 5 0 1.5-1.8 4.9-1.2 5.5 1.8 1.7 1.4 1.5 5.4-.5 5.4z" />
      <path d="M9.5 10.8c.7 2.2.8 4.6.5 7.2" />
      <path d="M14.5 10.8c-.7 2.2-.8 4.6-.5 7.2" />
    </svg>
  );
}

/** Lulav (with hadassim and aravos) and esrog. */
export function LulavIcon({ size = 24, className, strokeWidth = 2 }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M8 22V7.5" />
      <path d="M8 2.5c-1.6 2.4-1.9 5-1.1 8" />
      <path d="M8 2.5c1.6 2.4 1.9 5 1.1 8" />
      <path d="M8 17.5c-2.3-.3-4-1.9-4.6-4.3" />
      <path d="M8 14c-1.9-.4-3.2-1.8-3.6-3.8" />
      <ellipse cx="16" cy="16.4" rx="4" ry="4.9" transform="rotate(-12 16 16.4)" />
      <path d="M15 11.6c-.1-.9.1-1.6.6-2.1" />
    </svg>
  );
}
