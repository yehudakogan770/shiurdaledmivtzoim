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
