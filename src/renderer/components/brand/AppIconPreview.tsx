import { useId } from 'react';

type Variant = 'gradient' | 'light' | 'dark' | 'mono';

interface Props {
  size?: number;
  variant?: Variant;
  className?: string;
}

/**
 * Rounded-square app icon preview. Inner mark mirrors OliIcon but tuned for
 * the app icon canvas with 28% radius and a vibrant background.
 */
export function AppIconPreview({ size = 128, variant = 'gradient', className = '' }: Props) {
  const uid = useId().replace(/:/g, '');
  const bgId = `app-bg-${uid}-${variant}`;
  const ringId = `app-ring-${uid}-${variant}`;
  const sparkId = `app-spark-${uid}`;
  const radius = size * 0.28;

  const isLight = variant === 'light';
  const isDark = variant === 'dark';
  const isMono = variant === 'mono';

  const ringStroke = isMono ? '#0F172A' : `url(#${ringId})`;
  const waveColor = isMono ? '#0F172A' : '#FFFFFF';
  const sparkColor = isMono ? '#0F172A' : '#F59E0B';

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        boxShadow: '0 18px 45px rgba(37, 99, 235, 0.28)',
        overflow: 'hidden',
        background: isLight ? '#FFFFFF' : isDark ? '#020617' : isMono ? '#F8FAFC' : undefined
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 128 128"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={bgId} x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
            {variant === 'gradient' && (
              <>
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="35%" stopColor="#38BDF8" />
                <stop offset="75%" stopColor="#7C3AED" />
                <stop offset="100%" stopColor="#F59E0B" />
              </>
            )}
            {isLight && (
              <>
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#EFF6FF" />
              </>
            )}
            {isDark && (
              <>
                <stop offset="0%" stopColor="#020617" />
                <stop offset="100%" stopColor="#1E1B4B" />
              </>
            )}
            {isMono && (
              <>
                <stop offset="0%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#E2E8F0" />
              </>
            )}
          </linearGradient>
          <linearGradient id={ringId} x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
            {variant === 'gradient' || isDark ? (
              <>
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.55" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="55%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#14B8A6" />
              </>
            )}
          </linearGradient>
          <radialGradient id={sparkId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F59E0B" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="128" height="128" fill={`url(#${bgId})`} />

        <circle
          cx="64"
          cy="64"
          r="40"
          fill="none"
          stroke={ringStroke}
          strokeWidth="11"
        />

        <g fill={waveColor}>
          <rect x="44" y="56" width="5" height="16" rx="2.5" />
          <rect x="55" y="48" width="5" height="32" rx="2.5" />
          <rect x="66" y="52" width="5" height="24" rx="2.5" />
          <rect x="77" y="58" width="5" height="12" rx="2.5" />
        </g>

        {!isMono && (
          <circle cx="98" cy="32" r="9" fill={`url(#${sparkId})`} />
        )}
        {isMono && (
          <circle cx="98" cy="32" r="7" fill={sparkColor} />
        )}
      </svg>
    </div>
  );
}
