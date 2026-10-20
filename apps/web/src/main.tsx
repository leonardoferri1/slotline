import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { api, ApiError } from './lib/api';
import type { User } from './lib/types';
import { Login } from './components/Login';
import { Workspace } from './components/Workspace';
import './styles.css';
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } },
});
function App() {
  const client = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me') });
  if (me.isPending)
    return (
      <div className="loading">
        <LoaderCircle className="spin" />
        Abrindo seu espaço…
      </div>
    );
  if (!me.data) {
    if (!(me.error instanceof ApiError) || me.error.status !== 401)
      return (
        <div className="loading">
          Não foi possível conectar à API.
          <button onClick={() => me.refetch()}>Tentar novamente</button>
        </div>
      );
    return <Login onLogin={() => client.invalidateQueries({ queryKey: ['me'] })} />;
  }
  return <Workspace user={me.data} />;
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
