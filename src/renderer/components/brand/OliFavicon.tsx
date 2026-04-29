import { useId } from 'react';

interface Props {
  size?: number;
  className?: string;
}

/**
 * Simplified Oli mark for favicon and 16/32 px contexts. Drops the wave bars
 * and overlap arc so the silhouette stays legible at tiny sizes.
 */
export function OliFavicon({ size = 32, className }: Props) {
  const uid = useId().replace(/:/g, '');
  const gid = `oli-fav-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Oli"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="55%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="9" fill="#071A33" />
      <circle cx="16" cy="17" r="9" fill="none" stroke={`url(#${gid})`} strokeWidth="3.5" />
      <circle cx="25" cy="7.5" r="2.6" fill="#F59E0B" />
    </svg>
  );
}
