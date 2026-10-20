import { useState } from 'react';
import { ArrowDownLeft, ArrowRight, FlaskConical, LoaderCircle, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Resource } from '../lib/types';
export function Lab({ resource, refresh }: { resource?: Resource; refresh: () => void }) {
  const [busy, setBusy] = useState(false),
    [results, setResults] = useState<{ status: number; message: string; ms: number }[]>([]),
    [error, setError] = useState('');
  async function run() {
    if (!resource) return;
    setBusy(true);
    setError('');
    setResults([]);
    const start = new Date();
    start.setDate(start.getDate() + 2);
    start.setHours(12, 0, 0, 0);
    const end = new Date(+start + 3600000);
    let winner: string | undefined;
    try {
      const outcomes = await Promise.all(
        Array.from({ length: 8 }, async (_, i) => {
          const time = performance.now();
          try {
            const r = await api<{ id: string }>('/reservations', {
              method: 'POST',
              headers: { 'Idempotency-Key': crypto.randomUUID() },
              body: JSON.stringify({
                resourceId: resource.id,
                title: `Disputa experimental ${i + 1}`,
                startsAt: start.toISOString(),
                endsAt: end.toISOString(),
              }),
            });
            winner = r.id;
            return {
              status: 201,
              message: 'Pré-reserva conquistada',
              ms: Math.round(performance.now() - time),
            };
          } catch (e) {
            return {
              status: e instanceof ApiError ? e.status : 0,
              message: (e as Error).message,
              ms: Math.round(performance.now() - time),
            };
          }
        }),
      );
      setResults(outcomes);
      if (winner) await api('/reservations/' + winner + '/cancel', { method: 'POST' });
      else
        setError(
          'Nenhum vencedor: o horário pode estar ocupado por outra execução. Tente novamente após a liberação.',
        );
    } catch (e) {
      setError('Limpeza automática não concluída: ' + (e as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  }
  return (
    <div className="lab-layout">
      <section className="lab-hero">
        <span className="lab-symbol">
          <FlaskConical size={40} />
        </span>
        <p className="eyebrow">8 REQUISIÇÕES / 1 HORÁRIO</p>
        <h2>
          Quem chega junto
          <br />
          não reserva junto.
        </h2>
        <p>
          Oito solicitações reais disputam o mesmo recurso e intervalo na API. A reserva vencedora é
          cancelada ao final para liberar o próximo experimento.
        </p>
        <button className="primary" onClick={run} disabled={busy || !resource}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}{' '}
          {busy ? 'Executando disputa…' : 'Executar disputa real'}
        </button>
        <small>Usa sua sessão e um recurso exclusivo do laboratório.</small>
      </section>
      <section className="lab-results">
        <div className="section-line">
          <h2>Resultado da disputa</h2>
          <span className="local-badge">POST /reservations</span>
        </div>
        {results.length ? (
          <>
            <div className="race-summary">
              <strong>{results.filter((r) => r.status === 201).length}</strong> vencedora{' '}
              <span>/ {results.filter((r) => r.status === 409).length} conflitos</span>
            </div>
            {results.map((r, i) => (
              <div key={i} className="race-row">
                <span>Solicitação 0{i + 1}</span>
                <span
                  className={
                    'status ' +
                    (r.status === 201 ? 'confirmed' : r.status === 409 ? 'held' : 'cancelled')
                  }
                >
                  {r.status} ·{' '}
                  {r.status === 201 ? 'Reservado' : r.status === 409 ? 'Conflito' : 'Erro'}
                </span>
                <small>{r.ms} ms</small>
              </div>
            ))}
          </>
        ) : (
          <div className="empty-day">
            <ArrowDownLeft size={30} />
            <h3>A teoria encontra a prática.</h3>
            <p>Execute o experimento para ver as respostas reais da API.</p>
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="lab-explanation">
          <ShieldCheck size={19} />
          <p>
            <strong>Integridade no banco de dados.</strong> Uma exclusion constraint no PostgreSQL
            impede intervalos sobrepostos. O backend coordena as transições com locks por recurso. A
            API responde 409 para as tentativas conflitantes.
          </p>
        </div>
      </section>
    </div>
  );
}
