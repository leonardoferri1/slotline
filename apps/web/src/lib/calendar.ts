export const labels: Record<string, string> = {
  held: 'Aguardando confirmação',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};
export const eventLabels: Record<string, string> = {
  held: 'Pré-reserva criada',
  confirmed: 'Reserva confirmada',
  cancelled: 'Reserva cancelada',
  expired: 'Pré-reserva expirada',
};
export const dateKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
export const clock = (value: string) =>
  new Date(value).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
export const shiftDay = (day: string, amount: number) =>
  dateKey(new Date(new Date(day + 'T12:00:00-03:00').getTime() + amount * 86400000));
export const tomorrow = () => shiftDay(dateKey(new Date()), 1);
