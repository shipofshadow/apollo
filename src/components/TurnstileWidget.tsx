import { Turnstile } from 'react-turnstile';

export const TURNSTILE_SITE_KEY = '0x4AAAAAACzyvJRuyHF28naJ';

interface Props {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  resetKey?: number;
}

export default function TurnstileWidget({ onVerify, onExpire, resetKey }: Props) {
  return (
    <div className="flex justify-center w-full">
      <Turnstile
        sitekey={TURNSTILE_SITE_KEY}
        onVerify={onVerify}
        onExpire={() => {
          onExpire?.();
        }}
        onError={() => {/* re-mount via key */}}
        key={resetKey}
        theme="dark"
      />
    </div>
  );
}
