import { useState, useEffect } from 'react';
import { ArrowRight, Clock3, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Resource } from '../lib/types';
export function ReservationModal({
  resource,
  day,
  onClose,
  onSuccess,
}: {
  resource: Resource;
  day: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState(''),
    [start, setStart] = useState(() => sessionStorage.getItem('slotline-hour') ?? '10:00'),
    [end, setEnd] = useState(() => {
      const hour = Number((sessionStorage.getItem('slotline-hour') ?? '10:00').slice(0, 2));
      return hour === 23 ? '23:59' : String(hour + 1).padStart(2, '0') + ':00';
    }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    sessionStorage.removeItem('slotline-hour');
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector<HTMLDialogElement>('#reservation-dialog');
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      id="reservation-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-header">
        <span className="eyebrow">UM ESPAÇO PARA SUA PRÓXIMA IDEIA</span>
        <button className="icon-button" disabled={busy} aria-label="Fechar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <h2 id="modal-title">Reserve {resource.name}.</h2>
      <p className="muted">
        {new Date(day + 'T12:00:00-03:00').toLocaleDateString('pt-BR')} · Horário de Brasília
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api('/reservations', {
              method: 'POST',
              headers: { 'Idempotency-Key': key },
              body: JSON.stringify({
                resourceId: resource.id,
                title,
                startsAt: `${day}T${start}:00-03:00`,
                endsAt: `${day}T${end}:00-03:00`,
              }),
            });
            onSuccess();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nome do encontro
          <input
            autoFocus
            required
            minLength={3}
            maxLength={100}
            placeholder="Ex.: Planejamento da próxima entrega"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setKey(crypto.randomUUID());
            }}
            disabled={busy}
          />
        </label>
        <div className="form-row">
          <label>
            Começa às
            <input
              required
              type="time"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setKey(crypto.randomUUID());
              }}
              disabled={busy}
            />
          </label>
          <label>
            Termina às
            <input
              required
              type="time"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setKey(crypto.randomUUID());
              }}
              disabled={busy}
            />
          </label>
        </div>
        <div className="hold-note">
          <Clock3 size={20} />
          <span>
            Você terá <strong>5 minutos</strong> para confirmar. Após esse prazo, o espaço será
            liberado.
          </span>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Verificando disponibilidade…' : 'Criar pré-reserva'}
          <ArrowRight size={17} />
        </button>
      </form>
    </dialog>
  );
}
