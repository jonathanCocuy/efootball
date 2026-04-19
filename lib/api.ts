import type { Inscripcion, Partido, Torneo, Catalogo } from './types';

export type { Inscripcion, Partido, Torneo, Catalogo };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  // Inscripciones
  getInscripciones: () => apiFetch<Inscripcion[]>('/inscripciones'),
  postInscripcion: (data: Omit<Inscripcion, 'id'>) =>
    apiFetch<Inscripcion>('/inscripciones', { method: 'POST', body: JSON.stringify(data) }),
  putInscripcion: (id: string, data: Omit<Inscripcion, 'id'>) =>
    apiFetch<Inscripcion>(`/inscripciones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteInscripcion: (id: string) =>
    fetch(`${API_URL}/inscripciones/${id}`, { method: 'DELETE' }),

  // Partidos
  getPartidos: () => apiFetch<Partido[]>('/partidos'),
  postPartido: (data: Omit<Partido, 'id'>) =>
    apiFetch<Partido>('/partidos', { method: 'POST', body: JSON.stringify(data) }),
  putPartido: (id: string, data: Partial<Partido>) =>
    apiFetch<Partido>(`/partidos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Torneos
  getTorneos: () => apiFetch<Torneo[]>('/torneos'),
  postTorneo: (data: { nombre: string; tipo: string }) =>
    apiFetch<Torneo>('/torneos', { method: 'POST', body: JSON.stringify(data) }),
  deleteTorneo: (id: string) =>
    fetch(`${API_URL}/torneos/${id}`, { method: 'DELETE' }),

  // Catálogos
  getCatalogos: () => apiFetch<Catalogo>('/catalogos'),
};
