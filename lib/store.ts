import { supabase } from './supabase';
import type { Inscripcion, Partido, Torneo } from './types';

interface InscripcionRow { id: string; torneo_id: string | null; jugador: string; equipo: string; liga: string; }

function toInscripcion(r: InscripcionRow): Inscripcion {
  return {
    id: r.id,
    torneo_id: r.torneo_id ?? undefined,
    jugador: r.jugador,
    equipo: r.equipo,
    liga: r.liga,
  };
}

function inscripcionToDB(i: Omit<Inscripcion, 'id'>) {
  return {
    torneo_id: i.torneo_id ?? null,
    jugador: i.jugador,
    equipo: i.equipo,
    liga: i.liga,
  };
}

interface PartidoRow {
  id: string;
  torneo_id: string | null;
  tipo: string;
  fase: string;
  ronda: string | null;
  equipo_local: string;
  equipo_visitante: string;
  goles_local: number | null;
  goles_visitante: number | null;
  penales_local: number | null;
  penales_visitante: number | null;
  completado: boolean;
}

function toPartido(r: PartidoRow): Partido {
  return {
    id: r.id,
    torneo_id: r.torneo_id ?? undefined,
    tipo: r.tipo as Partido['tipo'],
    fase: r.fase,
    ronda: r.ronda as Partido['ronda'],
    equipoLocal: r.equipo_local,
    equipoVisitante: r.equipo_visitante,
    golesLocal: r.goles_local,
    golesVisitante: r.goles_visitante,
    penalesLocal: r.penales_local,
    penalesVisitante: r.penales_visitante,
    completado: r.completado,
  };
}

function partidoToDB(p: Omit<Partido, 'id'>) {
  return {
    torneo_id: p.torneo_id ?? null,
    tipo: p.tipo,
    fase: p.fase,
    ronda: p.ronda ?? null,
    equipo_local: p.equipoLocal,
    equipo_visitante: p.equipoVisitante,
    goles_local: p.golesLocal ?? null,
    goles_visitante: p.golesVisitante ?? null,
    penales_local: p.penalesLocal ?? null,
    penales_visitante: p.penalesVisitante ?? null,
    completado: p.completado,
  };
}

// --- Inscripciones ---

export async function getAll(col: 'inscripciones'): Promise<Inscripcion[]>;
export async function getAll(col: 'partidos'): Promise<Partido[]>;
export async function getAll(col: 'inscripciones' | 'partidos'): Promise<Inscripcion[] | Partido[]> {
  if (col === 'inscripciones') {
    const { data, error } = await supabase.from('inscripciones').select('*').order('created_at');
    if (error) throw error;
    return (data as InscripcionRow[]).map(toInscripcion);
  }
  const { data, error } = await supabase.from('partidos').select('*').order('created_at');
  if (error) throw error;
  return (data as PartidoRow[]).map(toPartido);
}

export async function insert(col: 'inscripciones', item: Omit<Inscripcion, 'id'>): Promise<Inscripcion>;
export async function insert(col: 'partidos', item: Omit<Partido, 'id'>): Promise<Partido>;
export async function insert(
  col: 'inscripciones' | 'partidos',
  item: Omit<Inscripcion, 'id'> | Omit<Partido, 'id'>
): Promise<Inscripcion | Partido> {
  if (col === 'inscripciones') {
    const row = inscripcionToDB(item as Omit<Inscripcion, 'id'>);
    const { data, error } = await supabase.from('inscripciones').insert(row).select().single();
    if (error) throw error;
    return toInscripcion(data as InscripcionRow);
  }
  const row = partidoToDB(item as Omit<Partido, 'id'>);
  const { data, error } = await supabase.from('partidos').insert(row).select().single();
  if (error) throw error;
  return toPartido(data as PartidoRow);
}

export async function updateInscripcion(id: string, update: Omit<Inscripcion, 'id'>): Promise<Inscripcion | null> {
  const row = inscripcionToDB(update);
  const { data, error } = await supabase.from('inscripciones').update(row).eq('id', id).select().single();
  if (error) return null;
  return toInscripcion(data as InscripcionRow);
}

export async function deleteInscripcion(id: string): Promise<boolean> {
  const { error } = await supabase.from('inscripciones').delete().eq('id', id);
  return !error;
}

// --- Partidos ---

export async function patch(col: 'partidos', id: string, update: Partial<Partido>): Promise<Partido | null> {
  const row: Partial<PartidoRow> = {};
  if (update.golesLocal !== undefined) row.goles_local = update.golesLocal ?? null;
  if (update.golesVisitante !== undefined) row.goles_visitante = update.golesVisitante ?? null;
  if (update.completado !== undefined) row.completado = update.completado;
  if (update.fase !== undefined) row.fase = update.fase;
  if (update.ronda !== undefined) row.ronda = update.ronda ?? null;
  if (update.penalesLocal !== undefined) row.penales_local = update.penalesLocal ?? null;
  if (update.penalesVisitante !== undefined) row.penales_visitante = update.penalesVisitante ?? null;

  const { data, error } = await supabase.from(col).update(row).eq('id', id).select().single();
  if (error) return null;
  return toPartido(data as PartidoRow);
}

// --- Torneos ---

export async function getTorneos(): Promise<Torneo[]> {
  const { data, error } = await supabase.from('torneos').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as Torneo[];
}

export async function createTorneo(nombre: string, tipo: string): Promise<Torneo> {
  const { data, error } = await supabase.from('torneos').insert({ nombre, tipo }).select().single();
  if (error) throw error;
  return data as Torneo;
}

export async function deleteTorneo(id: string): Promise<boolean> {
  const { error } = await supabase.from('torneos').delete().eq('id', id);
  return !error;
}
