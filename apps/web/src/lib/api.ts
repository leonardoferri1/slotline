export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw new ApiError(
      Array.isArray(data.message)
        ? data.message.join(' · ')
        : (data.message ?? 'Não foi possível completar a operação.'),
      response.status,
    );
  return data;
}
