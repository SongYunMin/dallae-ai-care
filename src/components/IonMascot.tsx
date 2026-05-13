import basic from '@/assets/ion/basic.svg';
import wink from '@/assets/ion/wink.svg';
import sleep from '@/assets/ion/sleep.svg';
import report from '@/assets/ion/report.svg';
import hug from '@/assets/ion/hug.png';

const map = { basic, wink, sleep, report, hug } as const;

export type IonVariant = keyof typeof map;

export function IonMascot({
  variant = 'basic',
  size = 160,
  className = '',
}: {
  variant?: IonVariant;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={map[variant]}
      alt="아이온 마스코트"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}

export function AgentAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-mint shadow-card overflow-hidden flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <img src={basic} alt="아이온" style={{ width: size + 8, height: size + 8 }} />
    </div>
  );
}
