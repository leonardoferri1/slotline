import type { ReactNode } from 'react';
export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div className="stat">
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{hint}</span>
      </div>
      <span className="stat-icon">{icon}</span>
    </div>
  );
}
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="empty-day" role="alert">
      <p>Não foi possível carregar os dados.</p>
      <button className="secondary" onClick={retry}>
        Tentar novamente
      </button>
    </div>
  );
}
