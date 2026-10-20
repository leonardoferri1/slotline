import { useState } from 'react';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { api } from '../lib/api';
import { Brand } from './Brand';
export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('alex@slotline.local'),
    [password, setPassword] = useState('Slotline-demo-2026!'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div>
          <p className="eyebrow">MENOS CONFLITOS. MAIS ENCONTROS.</p>
          <h1>
            Boas ideias
            <br />
            precisam
            <br />
            de espaço<span>.</span>
          </h1>
          <p>
            Uma agenda compartilhada para o trabalho acontecer. Reserve seu lugar e deixe o resto
            com a gente.
          </p>
        </div>
        <span className="login-foot">SLOTLINE / WORKSPACE RESERVATIONS</span>
      </section>
      <section className="login-form">
        <p className="eyebrow">SEU PRÓXIMO ENCONTRO COMEÇA AQUI</p>
        <h2>Entre no seu espaço.</h2>
        <p className="muted">Acesse a agenda do Ateliê Collective.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await api('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
              });
              onLogin();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar no workspace'}
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="demo-note">
          <FlaskConical size={20} />
          <div>
            <strong>Conheça a demonstração local</strong>
            <p>
              As credenciais já estão preenchidas. Para experimentar como membro, use{' '}
              <b>sam@slotline.local</b> com a mesma senha.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
