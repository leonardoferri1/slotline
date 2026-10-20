import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FlaskConical,
  Layers3,
  LogOut,
  Plus,
  ShieldCheck,
  Users,
  X,
  CheckCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import type { User, Resource, Reservation, Activity, Notification } from '../lib/types';
import { labels, eventLabels, dateKey, clock, shiftDay, tomorrow } from '../lib/calendar';
import { Brand } from './Brand';
import { Countdown } from './Countdown';
import { Stat, ErrorState } from './Feedback';
import { ReservationModal } from './ReservationModal';
import { Lab } from './Lab';
export function Workspace({ user }: { user: User }) {
  const client = useQueryClient();
  const [page, setPage] = useState<'agenda' | 'activity' | 'lab'>('agenda');
  const [day, setDay] = useState(tomorrow);
  const [selected, setSelected] = useState('');
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [pending, setPending] = useState('');
  const resources = useQuery({
    queryKey: ['resources'],
    queryFn: () => api<Resource[]>('/resources'),
  });
  const reservations = useQuery({
    queryKey: ['reservations', day],
    queryFn: () => api<Reservation[]>('/reservations?day=' + day),
    refetchInterval: 5000,
  });
  const activity = useQuery({
    queryKey: ['activity'],
    queryFn: () => api<Activity[]>('/activity'),
    refetchInterval: 5000,
  });
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<Notification[]>('/notifications'),
    refetchInterval: 5000,
  });
  const spaces = (resources.data ?? []).filter((r) => r.kind !== 'Laboratório');
  const chosen = spaces.find((r) => r.id === selected) ?? spaces[0];
  const active = (reservations.data ?? []).filter((r) => ['held', 'confirmed'].includes(r.status));
  const visible = active.filter((r) => r.resource_id === chosen?.id);
  const firstHour = Math.min(
    8,
    ...visible.map((r) =>
      dateKey(new Date(r.starts_at)) < day ? 0 : Number(clock(r.starts_at).slice(0, 2)),
    ),
  );
  const lastHour = Math.max(
    18,
    ...visible.map((r) =>
      dateKey(new Date(r.ends_at)) > day ? 23 : Math.min(23, Number(clock(r.ends_at).slice(0, 2))),
    ),
  );
  const mine = active.filter((r) => r.is_owner);
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['reservations'] });
    client.invalidateQueries({ queryKey: ['activity'] });
    client.invalidateQueries({ queryKey: ['notifications'] });
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  async function change(id: string, action: string) {
    setPending(id);
    try {
      await api('/reservations/' + id + '/' + action, { method: 'POST' });
      setToast(
        action === 'confirm'
          ? 'Reserva confirmada. Seu espaço está garantido.'
          : 'Reserva cancelada. Horário liberado.',
      );
      refresh();
    } catch (e) {
      setToast((e as Error).message);
      refresh();
    } finally {
      setPending('');
    }
  }
  const dateTitle = new Date(day + 'T12:00:00-03:00').toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
  });
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-tag">
          <span className="workspace-icon">a.</span>
          <div>
            <strong>Ateliê Collective</strong>
            <span>Seu workspace</span>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {[
            { id: 'agenda', label: 'Agenda dos espaços', icon: CalendarDays },
            { id: 'activity', label: 'Atividade', icon: Clock3 },
            { id: 'lab', label: 'Laboratório', icon: FlaskConical },
          ].map((item) => (
            <button
              key={item.id}
              className={page === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => setPage(item.id as typeof page)}
            >
              <item.icon size={19} />
              {item.label}
              {page === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-card">
            <ShieldCheck size={23} />
            <strong>
              Um horário.
              <br />
              Uma reserva.
            </strong>
            <p>Disponibilidade compartilhada, sem sobreposições.</p>
          </div>
          <a
            className="source-link"
            href="https://github.com/leonardoferri1/slotline"
            target="_blank"
            rel="noreferrer"
          >
            Explore o projeto <ArrowUpRight size={16} />
          </a>
          <div className="profile">
            <span className="avatar">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.role === 'admin' ? 'Administrador' : 'Membro'}</span>
            </div>
            <button
              aria-label="Sair"
              className="icon-button"
              onClick={async () => {
                try {
                  await api('/auth/logout', { method: 'POST' });
                  client.clear();
                } catch (e) {
                  setToast((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{' '}
            <strong>
              {page === 'agenda' ? 'Agenda' : page === 'lab' ? 'Laboratório' : 'Atividade'}
            </strong>
          </span>
          <div className="top-actions">
            <button
              className="icon-button mobile-logout"
              aria-label="Sair da conta"
              onClick={async () => {
                try {
                  await api('/auth/logout', { method: 'POST' });
                  client.clear();
                } catch (e) {
                  setToast((e as Error).message);
                }
              }}
            >
              <LogOut size={18} />
            </button>
            <span className="local-badge">
              <i /> DEMO LOCAL
            </span>
            <button
              className="icon-button"
              aria-label="Notificações"
              aria-expanded={showNotifications}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={20} />
            </button>
          </div>
          {showNotifications && (
            <div className="notification-panel">
              <strong>Suas notificações</strong>
              {notifications.isError ? (
                <p>Não foi possível carregar as notificações.</p>
              ) : notifications.data?.length ? (
                notifications.data.slice(0, 8).map((n) => (
                  <div key={n.event_id}>
                    <small>{eventLabels[n.type]}</small>
                    <p>{n.title}</p>
                  </div>
                ))
              ) : (
                <p>Nenhuma notificação por enquanto.</p>
              )}
            </div>
          )}
        </header>
        <main className="main-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">ESPAÇO PARA ACONTECER</p>
              <h1>
                {page === 'agenda'
                  ? 'Encontre seu próximo espaço.'
                  : page === 'lab'
                    ? 'Concorrência, na prática.'
                    : 'Cada mudança, uma história.'}
              </h1>
              <p className="muted">
                {page === 'agenda'
                  ? 'Para alinhar ideias, criar algo novo ou simplesmente se concentrar.'
                  : page === 'lab'
                    ? 'Envie solicitações simultâneas e acompanhe quem garante o horário.'
                    : 'Acompanhe o ciclo de vida das reservas do seu workspace.'}
              </p>
            </div>
            {page === 'agenda' && (
              <button className="primary" disabled={!chosen} onClick={() => setModal(true)}>
                <Plus size={18} />
                Nova reserva
              </button>
            )}
          </section>
          {page === 'agenda' && (
            <>
              <div className="stats-grid">
                <Stat
                  label="ESPAÇOS DO WORKSPACE"
                  value={String(spaces.length).padStart(2, '0')}
                  hint="Um lugar para cada momento"
                  icon={<Layers3 />}
                />
                <Stat
                  label="RESERVAS NESTE DIA"
                  value={String(
                    active.filter((r) => spaces.some((s) => s.id === r.resource_id)).length,
                  ).padStart(2, '0')}
                  hint="Confirmadas e pré-reservadas"
                  icon={<CalendarDays />}
                />
                <Stat
                  label="SUAS RESERVAS NO DIA"
                  value={String(mine.length).padStart(2, '0')}
                  hint="Tudo pronto para acontecer"
                  icon={<CheckCheck />}
                />
              </div>
              <div className="section-line">
                <h2>
                  Escolha seu ambiente <span>{spaces.length}</span>
                </h2>
                <span className="muted small">Detalhes que fazem a diferença</span>
              </div>
              {resources.isError ? (
                <ErrorState retry={() => resources.refetch()} />
              ) : (
                <div className="resource-grid">
                  {spaces.map((r, i) => (
                    <button
                      key={r.id}
                      className={'resource-card ' + (chosen?.id === r.id ? 'selected' : '')}
                      onClick={() => setSelected(r.id)}
                    >
                      <div
                        className={
                          'room-art art-' +
                          (r.kind === 'Reunião' ? 0 : r.kind === 'Criação' ? 1 : 2)
                        }
                        aria-hidden="true"
                      >
                        <div className="room-window" />
                        <div className="room-table" />
                        <div className="room-plant" />
                        <span className="art-label">ATELIÊ / 0{i + 1}</span>
                        <span className="resource-check">
                          {chosen?.id === r.id ? <Check size={15} /> : <ArrowUpRight size={15} />}
                        </span>
                      </div>
                      <div className="resource-info">
                        <div className="resource-meta">
                          <span>{r.kind}</span>
                          <span>
                            <Users size={13} />
                            {r.capacity} {r.capacity === 1 ? 'pessoa' : 'pessoas'}
                          </span>
                        </div>
                        <h3>{r.name}</h3>
                        <p>{r.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="schedule-layout">
                <section className="schedule-panel">
                  <div className="schedule-heading">
                    <div>
                      <p className="eyebrow">AGENDA DO ESPAÇO</p>
                      <h2>{chosen?.name ?? 'Carregando…'}</h2>
                    </div>
                    <div className="day-controls">
                      <button
                        className="icon-button"
                        aria-label="Dia anterior"
                        onClick={() => setDay(shiftDay(day, -1))}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <label className="date-control">
                        <CalendarDays size={15} />
                        <input
                          aria-label="Data da agenda"
                          type="date"
                          value={day}
                          onChange={(e) => e.target.value && setDay(e.target.value)}
                        />
                      </label>
                      <button
                        className="icon-button"
                        aria-label="Próximo dia"
                        onClick={() => setDay(shiftDay(day, 1))}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="schedule-caption">
                    <span>{dateTitle} · Horário de Brasília</span>
                    <span>
                      <i className="legend-dot" />
                      Confirmada <i className="legend-dot amber" />
                      Pré-reserva
                    </span>
                  </div>
                  {reservations.isError ? (
                    <ErrorState retry={() => reservations.refetch()} />
                  ) : (
                    <div className="timeline">
                      {Array.from(
                        { length: lastHour - firstHour + 1 },
                        (_, i) => i + firstHour,
                      ).map((hour) => {
                        const at = new Date(
                          `${day}T${String(hour).padStart(2, '0')}:00:00-03:00`,
                        ).getTime();
                        const matching = visible.filter(
                          (r) => +new Date(r.starts_at) < at + 3600000 && +new Date(r.ends_at) > at,
                        );
                        return (
                          <div className="time-row" key={hour}>
                            <span className="time-label">{String(hour).padStart(2, '0')}:00</span>
                            <div className="time-slot">
                              {matching.length ? (
                                matching.map((r) => (
                                  <div key={r.id} className={'booking ' + r.status}>
                                    <span className="booking-mark" />
                                    <strong>{r.title}</strong>
                                    <span>
                                      {clock(r.starts_at)} — {clock(r.ends_at)}
                                    </span>
                                    <small>
                                      {r.status === 'held' ? 'Pré-reserva' : 'Confirmada'}
                                    </small>
                                  </div>
                                ))
                              ) : (
                                <button
                                  className="available-slot"
                                  disabled={at <= Date.now()}
                                  onClick={() => {
                                    setModal(true);
                                    sessionStorage.setItem(
                                      'slotline-hour',
                                      String(hour).padStart(2, '0') + ':00',
                                    );
                                  }}
                                >
                                  <span>Disponível</span>
                                  <Plus size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="panel-foot">
                    <ShieldCheck size={15} /> A disponibilidade é validada novamente ao reservar.
                  </div>
                </section>
                <aside className="your-day">
                  <div className="section-line">
                    <h2>Seu dia</h2>
                    <span className="small muted">{mine.length} reservas</span>
                  </div>
                  {mine.length === 0 ? (
                    <div className="empty-day">
                      <span>
                        <CalendarDays size={27} />
                      </span>
                      <h3>
                        Uma agenda em branco.
                        <br />
                        Muitas possibilidades.
                      </h3>
                      <p>Escolha um ambiente e reserve um momento para sua próxima ideia.</p>
                      <button className="text-button" onClick={() => setModal(true)}>
                        Encontrar meu espaço <ArrowRight size={15} />
                      </button>
                    </div>
                  ) : (
                    mine.map((r) => (
                      <div className="my-reservation" key={r.id}>
                        <span className={'status ' + r.status}>{labels[r.status]}</span>
                        <h3>{r.title}</h3>
                        <p>{resources.data?.find((s) => s.id === r.resource_id)?.name}</p>
                        <p>
                          <Clock3 size={14} />
                          {clock(r.starts_at)} — {clock(r.ends_at)}
                        </p>
                        {r.status === 'held' && (
                          <div className="countdown">
                            <Countdown expires={r.expires_at} />
                          </div>
                        )}
                        <div className="reservation-actions">
                          {r.status === 'held' && (
                            <button
                              className="primary small-button"
                              disabled={pending === r.id}
                              onClick={() => change(r.id, 'confirm')}
                            >
                              Confirmar
                            </button>
                          )}
                          <button
                            className="text-button"
                            disabled={pending === r.id}
                            onClick={() => change(r.id, 'cancel')}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="tip-card">
                    <span className="eyebrow">COMO FUNCIONA</span>
                    <h3>Seu espaço, em três passos.</h3>
                    <ol>
                      <li>Escolha o ambiente e horário.</li>
                      <li>Garanta uma pré-reserva de 5 minutos.</li>
                      <li>Confirme e prepare-se para chegar.</li>
                    </ol>
                  </div>
                </aside>
              </div>
            </>
          )}
          {page === 'activity' && (
            <section className="activity-panel">
              <div className="section-line">
                <h2>Histórico de reservas</h2>
                <span className="muted small">Últimos 30 eventos · Brasília</span>
              </div>
              {activity.isError ? (
                <ErrorState retry={() => activity.refetch()} />
              ) : activity.data?.length ? (
                activity.data.map((a) => (
                  <div className="activity-row" key={a.id}>
                    <span className={'activity-icon ' + a.type}>
                      {a.type === 'confirmed' ? (
                        <Check size={18} />
                      ) : a.type === 'cancelled' ? (
                        <X size={18} />
                      ) : (
                        <Clock3 size={18} />
                      )}
                    </span>
                    <div>
                      <strong>{eventLabels[a.type]}</strong>
                      <p>
                        {a.title} · {a.resource_name}
                      </p>
                    </div>
                    <div className="activity-time">
                      <span>{a.actor_name ?? 'Sistema'}</span>
                      <small>
                        {new Date(a.created_at).toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                        })}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-day">
                  <Clock3 />
                  <h3>A história começa na primeira reserva.</h3>
                  <p>Crie uma reserva para acompanhar as mudanças aqui.</p>
                </div>
              )}
            </section>
          )}
          {page === 'lab' && (
            <Lab
              resource={resources.data?.find((r) => r.kind === 'Laboratório')}
              refresh={refresh}
            />
          )}
          <footer className="footer">
            <span>
              slotline <span className="muted">/ Feito para compartilhar espaços.</span>
            </span>
            <span>LOCAL MVP · v0.1</span>
          </footer>
        </main>
      </div>
      {modal && chosen && (
        <ReservationModal
          resource={chosen}
          day={day}
          onClose={() => setModal(false)}
          onSuccess={() => {
            setModal(false);
            refresh();
            setToast('Pré-reserva criada. Confirme em até 5 minutos.');
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <ShieldCheck size={20} />
          <span>{toast}</span>
          <button className="icon-button" aria-label="Fechar aviso" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
