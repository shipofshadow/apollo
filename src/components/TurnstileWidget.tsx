import { useEffect } from 'react';
import { Turnstile } from 'react-turnstile';

const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_FALLBACK_SITE_KEY = '0x4AAAAAACzyvJRuyHF28naJ';

export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)
  ?? (import.meta.env.DEV ? TURNSTILE_TEST_SITE_KEY : TURNSTILE_FALLBACK_SITE_KEY);

const TURNSTILE_DEV_BYPASS =
  String(import.meta.env.VITE_TURNSTILE_DEV_BYPASS ?? 'false').toLowerCase() === 'true';

interface Props {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  resetKey?: number;
}

export default function TurnstileWidget({ onVerify, onExpire, resetKey }: Props) {
  useEffect(() => {
    if (TURNSTILE_DEV_BYPASS) {
      onVerify('dev-bypass-token');
    }
  }, [onVerify, resetKey]);

  if (TURNSTILE_DEV_BYPASS) {
    return (
      <div className="text-xs text-amber-300 border border-amber-500/40 bg-amber-500/10 px-3 py-2 rounded-sm">
        Turnstile bypass enabled (development)
      </div>
    );
  }

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
