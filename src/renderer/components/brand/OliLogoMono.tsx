import { OliWordmark } from './OliWordmark';

interface Props {
  size?: number;
  color?: 'black' | 'white' | 'navy';
  className?: string;
  withWordmark?: boolean;
}

/**
 * Single-color variant. Strips gradients so it renders cleanly on print,
 * one-color contexts, and ultra-small sizes.
 */
export function OliLogoMono({
  size = 64,
  color = 'navy',
  className = '',
  withWordmark = true
}: Props) {
  const fill = color === 'black' ? '#000000' : color === 'white' ? '#FFFFFF' : '#071A33';
  const tone = color === 'white' ? 'white' : 'navy';
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label="Oli mono logo"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Oli</title>
        <circle cx="32" cy="32" r="22" fill="none" stroke={fill} strokeWidth="6" />
        <g fill={fill}>
          <rect x="22" y="28" width="3" height="8" rx="1.5" />
          <rect x="28" y="24" width="3" height="16" rx="1.5" />
          <rect x="34" y="26" width="3" height="12" rx="1.5" />
          <rect x="40" y="29" width="3" height="6" rx="1.5" />
        </g>
        <circle cx="50" cy="14" r="4" fill={fill} />
      </svg>
      {withWordmark && <OliWordmark size={Math.round(size * 0.42)} tone={tone === 'white' ? 'white' : 'navy'} />}
    </div>
  );
}
