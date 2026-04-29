import { useId } from 'react';

interface Props {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * OliIcon — circular memory loop with overlapping gradient rings, an inner
 * sound-wave, and a small amber insight spark near the top-right.
 */
export function OliIcon({ size = 64, className, title = 'Oli' }: Props) {
  const uid = useId().replace(/:/g, '');
  const ringId = `oli-ring-${uid}`;
  const overlapId = `oli-overlap-${uid}`;
  const waveId = `oli-wave-${uid}`;
  const sparkId = `oli-spark-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={ringId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="55%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#14B8A6" />
        </linearGradient>
        <linearGradient id={overlapId} x1="0" y1="64" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={waveId} x1="0" y1="32" x2="64" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#14B8A6" />
        </linearGradient>
        <radialGradient id={sparkId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </radialGradient>
      </defs>

      {/* primary memory ring */}
      <circle cx="32" cy="32" r="22" fill="none" stroke={`url(#${ringId})`} strokeWidth="6" />

      {/* secondary overlap arc — gives the loop motion */}
      <path
        d="M 32 8 A 22 22 0 0 1 54 32"
        fill="none"
        stroke={`url(#${overlapId})`}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* inner sound wave: 4 rounded vertical bars */}
      <g fill={`url(#${waveId})`}>
        <rect x="22" y="28" width="3" height="8" rx="1.5" />
        <rect x="28" y="24" width="3" height="16" rx="1.5" />
        <rect x="34" y="26" width="3" height="12" rx="1.5" />
        <rect x="40" y="29" width="3" height="6" rx="1.5" />
      </g>

      {/* insight spark */}
      <circle cx="50" cy="14" r="4.5" fill={`url(#${sparkId})`} />
      <circle cx="50" cy="14" r="6.5" fill="#F59E0B" fillOpacity="0.18" />
    </svg>
  );
}
