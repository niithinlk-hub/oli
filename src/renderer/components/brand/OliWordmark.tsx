interface Props {
  size?: number;
  className?: string;
  tone?: 'navy' | 'white';
}

/**
 * OliWordmark — text-only "Oli" rendered as inline-block span using the
 * display font. Kept as DOM (not SVG) so font hinting stays crisp at any size.
 */
export function OliWordmark({ size = 28, className = '', tone = 'navy' }: Props) {
  const color = tone === 'white' ? '#F8FAFC' : '#071A33';
  return (
    <span
      className={`font-display tracking-tight ${className}`}
      style={{
        fontSize: size,
        lineHeight: 1,
        fontWeight: 750,
        letterSpacing: '-0.04em',
        color
      }}
      aria-label="Oli"
    >
      Oli
    </span>
  );
}
