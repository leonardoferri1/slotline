import { useEffect, useState } from 'react';
export function Countdown({ expires }: { expires: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, Math.floor((+new Date(expires) - now) / 1000));
  return (
    <span>
      {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} para confirmar
    </span>
  );
}
