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
      <path d="M2 12.5c0-3.3 2.6-5.6 5.6-6 2.9-.4 5.9-.4 8.8 0 3 .4 5.6 2.7 5.6 6 0 2.4-1.6 4.4-3.9 4.7-4 .5-8.2.5-12.2 0C3.6 16.9 2 14.9 2 12.5z" />
      <ellipse cx="6.5" cy="11.8" rx="2" ry="3.4" transform="rotate(-35 6.5 11.8)" />
      <ellipse cx="10.2" cy="11.8" rx="2" ry="3.4" transform="rotate(35 10.2 11.8)" />
      <ellipse cx="13.8" cy="11.8" rx="2" ry="3.4" transform="rotate(-35 13.8 11.8)" />
      <ellipse cx="17.5" cy="11.8" rx="2" ry="3.4" transform="rotate(35 17.5 11.8)" />
    </svg>
  );
}
