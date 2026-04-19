import { supabase } from './supabase';
import type { Inscripcion, Partido, Torneo } from './types';

interface InscripcionRow { id: string; torneo_id: string | null; jugador: string; equipo: string; liga: string; }

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
    return data as InscripcionRow[];
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
    const { data, error } = await supabase.from('inscripciones').insert(item).select().single();
    if (error) throw error;
    return data as Inscripcion;
  }
  const row = partidoToDB(item as Omit<Partido, 'id'>);
  const { data, error } = await supabase.from('partidos').insert(row).select().single();
  if (error) throw error;
  return toPartido(data as PartidoRow);
}

export async function updateInscripcion(id: string, update: Omit<Inscripcion, 'id'>): Promise<Inscripcion | null> {
  const { data, error } = await supabase.from('inscripciones').update(update).eq('id', id).select().single();
  if (error) return null;
  return data as Inscripcion;
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
