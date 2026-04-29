import { OliIcon } from './OliIcon';
import { OliWordmark } from './OliWordmark';

interface Props {
  iconSize?: number;
  wordmarkSize?: number;
  tone?: 'navy' | 'white';
  className?: string;
}

export function OliLogoHorizontal({
  iconSize = 32,
  wordmarkSize = 26,
  tone = 'navy',
  className = ''
}: Props) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <OliIcon size={iconSize} title="Oli logo" />
      <OliWordmark size={wordmarkSize} tone={tone} />
    </div>
  );
}
