import { OliIcon } from './OliIcon';
import { OliWordmark } from './OliWordmark';

interface Props {
  iconSize?: number;
  wordmarkSize?: number;
  tone?: 'navy' | 'white';
  className?: string;
}

export function OliLogoStacked({
  iconSize = 96,
  wordmarkSize = 38,
  tone = 'navy',
  className = ''
}: Props) {
  return (
    <div className={`inline-flex flex-col items-center gap-3 ${className}`}>
      <OliIcon size={iconSize} title="Oli logo" />
      <OliWordmark size={wordmarkSize} tone={tone} />
    </div>
  );
}
