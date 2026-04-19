'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shuffle, Trophy, Users, Save, Check, Loader2, AlertCircle,
  ChevronDown, ChevronUp, Trash2, Plus, ArrowRight, X, Pencil,
  Calendar, Layers,
} from 'lucide-react';
import { api, type Inscripcion, type Partido, type Torneo } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type TipoTorneo = 'eliminacion' | 'grupos';

interface TorneoFull extends Torneo {
  partidos: Partido[];
  inscripciones: Inscripcion[];
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getFaseName(n: number): string {
  if (n <= 2) return 'Final';
  if (n <= 4) return 'Semifinal';
  if (n <= 8) return 'Cuartos de Final';
  if (n <= 16) return 'Octavos de Final';
  return 'Ronda 1';
}

const FASE_ORDER = ['Grupo A', 'Grupo B', 'Repechaje', 'Ronda 1', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', '3er Puesto', 'Final'];

function sortFases(fases: string[]): string[] {
  return [...fases].sort((a, b) => {
    const ia = FASE_ORDER.indexOf(a);
    const ib = FASE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function buildEliminacionMatches(equipos: string[], torneo_id: string): Omit<Partido, 'id'>[] {
  const matches: Omit<Partido, 'id'>[] = [];
  const fase = getFaseName(equipos.length);
  for (let i = 0; i + 1 < equipos.length; i += 2) {
    const [l, v] = [equipos[i], equipos[i + 1]];
    if (equipos.length === 2) {
      matches.push({ torneo_id, tipo: 'eliminacion', fase: 'Final', ronda: 'unico', equipoLocal: l, equipoVisitante: v, completado: false });
    } else {
      matches.push({ torneo_id, tipo: 'eliminacion', fase, ronda: 'ida', equipoLocal: l, equipoVisitante: v, completado: false });
      matches.push({ torneo_id, tipo: 'eliminacion', fase, ronda: 'vuelta', equipoLocal: v, equipoVisitante: l, completado: false });
    }
  }
  return matches;
}

function buildGruposMatches(equipos: string[], torneo_id: string): Omit<Partido, 'id'>[] {
  const half = Math.ceil(equipos.length / 2);
  const grupos: [string[], string][] = [
    [equipos.slice(0, half), 'A'],
    [equipos.slice(half), 'B'],
  ];
  const matches: Omit<Partido, 'id'>[] = [];
  for (const [grupo, letra] of grupos) {
    const fase = `Grupo ${letra}`;
    for (let a = 0; a < grupo.length; a++)
      for (let b = a + 1; b < grupo.length; b++)
        matches.push({ torneo_id, tipo: 'grupos', fase, ronda: 'unico', equipoLocal: grupo[a], equipoVisitante: grupo[b], completado: false });
  }
  return matches;
}

function buildMatches(equipos: string[], tipo: TipoTorneo, torneo_id: string): Omit<Partido, 'id'>[] {
  return tipo === 'eliminacion'
    ? buildEliminacionMatches(equipos, torneo_id)
    : buildGruposMatches(equipos, torneo_id);
}

function computeStandings(partidos: Partido[], fase: string) {
  const fp = partidos.filter(p => p.fase === fase);
  const equipos = [...new Set([...fp.map(p => p.equipoLocal), ...fp.map(p => p.equipoVisitante)])];
  return equipos.map(eq => {
    const jugados = fp.filter(p => p.completado && (p.equipoLocal === eq || p.equipoVisitante === eq));
    let G = 0, E = 0, P = 0, GF = 0, GC = 0;
    for (const p of jugados) {
      const esL = p.equipoLocal === eq;
      const gF = esL ? (p.golesLocal ?? 0) : (p.golesVisitante ?? 0);
      const gC = esL ? (p.golesVisitante ?? 0) : (p.golesLocal ?? 0);
      GF += gF; GC += gC;
      if (gF > gC) G++; else if (gF < gC) P++; else E++;
    }
    return { equipo: eq, PJ: jugados.length, G, E, P, GF, GC, Pts: G * 3 + E };
  }).sort((a, b) => b.Pts - a.Pts || (b.GF - b.GC) - (a.GF - a.GC) || b.GF - a.GF);
}

function getAggregateWinners(fasePartidos: Partido[]): string[] | null {
  const unicos = fasePartidos.filter(p => p.ronda === 'unico');
  if (unicos.length > 0) {
    const winners: string[] = [];
    for (const m of unicos) {
      if (!m.completado) return null;
      const gl = m.golesLocal ?? 0, gv = m.golesVisitante ?? 0;
      if (gl === gv) {
        const pl = m.penalesLocal ?? 0, pv = m.penalesVisitante ?? 0;
        if (pl === pv) return null;
        winners.push(pl > pv ? m.equipoLocal : m.equipoVisitante);
      } else {
        winners.push(gl > gv ? m.equipoLocal : m.equipoVisitante);
      }
    }
    return winners;
  }
  const idas = fasePartidos.filter(p => p.ronda === 'ida');
  const winners: string[] = [];
  for (const ida of idas) {
    const vuelta = fasePartidos.find(p =>
      p.ronda === 'vuelta' && p.equipoLocal === ida.equipoVisitante && p.equipoVisitante === ida.equipoLocal
    );
    if (!vuelta || !ida.completado || !vuelta.completado) return null;
    const golesA = (ida.golesLocal ?? 0) + (vuelta.golesVisitante ?? 0);
    const golesB = (ida.golesVisitante ?? 0) + (vuelta.golesLocal ?? 0);
    if (golesA === golesB) {
      const pl = vuelta.penalesLocal ?? 0, pv = vuelta.penalesVisitante ?? 0;
      if (pl === pv) return null;
      winners.push(pl > pv ? vuelta.equipoLocal : vuelta.equipoVisitante);
    } else {
      winners.push(golesA > golesB ? ida.equipoLocal : ida.equipoVisitante);
    }
  }
  return winners.length > 0 ? winners : null;
}

function getAggregateLosers(fasePartidos: Partido[], winners: string[]): string[] {
  const equipos = [...new Set([...fasePartidos.map(p => p.equipoLocal), ...fasePartidos.map(p => p.equipoVisitante)])];
  return equipos.filter(e => !winners.includes(e));
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function getTorneoStatus(partidos: Partido[]): { label: string; color: string } {
  if (partidos.length === 0) return { label: 'Sin sorteo', color: 'text-gray-400 bg-gray-50' };
  const done = partidos.filter(p => p.completado).length;
  if (done === 0) return { label: 'Por comenzar', color: 'text-gray-500 bg-gray-100' };
  if (done === partidos.length) return { label: 'Completado', color: 'text-emerald-600 bg-emerald-50' };
  return { label: 'En curso', color: 'text-blue-600 bg-blue-50' };
}

function getFaseActual(partidos: Partido[]): string {
  if (partidos.length === 0) return '—';
  const fases = sortFases([...new Set(partidos.map(p => p.fase))]);
  const faseIncompleta = fases.find(f => partidos.some(p => p.fase === f && !p.completado));
  return faseIncompleta ?? fases[fases.length - 1] ?? '—';
}

// ─── Sub-component: MatchCard ─────────────────────────────────────────────────

function MatchCard({ partido, jugadores, onUpdate }: {
  partido: Partido;
  jugadores: Record<string, string>;
  onUpdate: (id: string, gl: number, gv: number, pl?: number, pv?: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(!partido.completado);
  const [gl, setGl] = useState(partido.golesLocal?.toString() ?? '');
  const [gv, setGv] = useState(partido.golesVisitante?.toString() ?? '');
  const [pl, setPl] = useState(partido.penalesLocal?.toString() ?? '');
  const [pv, setPv] = useState(partido.penalesVisitante?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGl(partido.golesLocal?.toString() ?? '');
    setGv(partido.golesVisitante?.toString() ?? '');
    setPl(partido.penalesLocal?.toString() ?? '');
    setPv(partido.penalesVisitante?.toString() ?? '');
    if (partido.completado) setEditing(false);
  }, [partido]);

  const w = partido.completado
    ? (partido.golesLocal ?? 0) > (partido.golesVisitante ?? 0) ? 'local'
      : (partido.golesVisitante ?? 0) > (partido.golesLocal ?? 0) ? 'visitante'
        : (partido.penalesLocal ?? 0) > (partido.penalesVisitante ?? 0) ? 'local'
          : (partido.penalesVisitante ?? 0) > (partido.penalesLocal ?? 0) ? 'visitante' : 'draw'
    : null;

  const handleSave = async () => {
    if (gl === '' || gv === '' || !partido.id) return;
    setSaving(true);
    const penaltiesL = pl !== '' ? parseInt(pl) : undefined;
    const penaltiesV = pv !== '' ? parseInt(pv) : undefined;
    await onUpdate(partido.id, parseInt(gl), parseInt(gv), penaltiesL, penaltiesV);
    setSaving(false);
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors ${
      partido.completado ? 'bg-gray-50' : 'bg-white border border-gray-100 shadow-sm'
    }`}>
      <span className={`flex-1 text-right truncate ${w === 'local' ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
        {partido.equipoLocal} {jugadores[partido.equipoLocal] ? `(${jugadores[partido.equipoLocal]})` : ''}
      </span>

      {partido.completado && !editing ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold tabular-nums text-gray-900 text-base">
            {partido.golesLocal} – {partido.golesVisitante}
            {partido.penalesLocal !== null && partido.penalesVisitante !== null && (
              <span className="text-xs text-gray-400 ml-2 font-medium">({partido.penalesLocal} – {partido.penalesVisitante} P)</span>
            )}
          </span>
          <button onClick={() => setEditing(true)}
            className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all" title="Modificar resultado">
            <Pencil size={11} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <input type="number" min="0" value={gl} onChange={e => setGl(e.target.value)}
            className="w-11 text-center py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
          <span className="text-gray-300 text-xs">–</span>
          <input type="number" min="0" value={gv} onChange={e => setGv(e.target.value)}
            className="w-11 text-center py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
          
          {((['Semifinal', '3er Puesto', '5to puesto', 'Final'].includes(partido.fase) || partido.tipo === 'eliminacion') && partido.ronda !== 'ida') && (
            <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-xl border border-gray-100 shrink-0">
              <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Penales:</span>
              <input type="number" min="0" value={pl} onChange={e => setPl(e.target.value)}
                className="w-9 text-center py-1 rounded-lg border border-gray-200 bg-white text-xs font-bold focus:outline-none" />
              <span className="text-gray-300 text-[10px]">–</span>
              <input type="number" min="0" value={pv} onChange={e => setPv(e.target.value)}
                className="w-9 text-center py-1 rounded-lg border border-gray-200 bg-white text-xs font-bold focus:outline-none" />
            </div>
          )}
          <button onClick={handleSave} disabled={saving || gl === '' || gv === ''}
            className="p-1.5 bg-gray-900 text-white rounded-xl hover:bg-gray-700 disabled:opacity-30 transition-all">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
          {partido.completado && (
            <button onClick={() => { setEditing(false); setGl(partido.golesLocal?.toString() ?? ''); setGv(partido.golesVisitante?.toString() ?? ''); }}
              className="p-1.5 text-gray-300 rounded-xl hover:text-gray-600 hover:bg-gray-100 transition-all">
              <X size={12} />
            </button>
          )}
        </div>
      )}

      <span className={`flex-1 truncate ${w === 'visitante' ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
        {partido.equipoVisitante} {jugadores[partido.equipoVisitante] ? `(${jugadores[partido.equipoVisitante]})` : ''}
      </span>

      {partido.ronda && partido.ronda !== 'unico' && (
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg shrink-0 capitalize">{partido.ronda}</span>
      )}
    </div>
  );
}

// ─── Sub-component: StandingsTable ───────────────────────────────────────────

function StandingsTable({ fase, partidos, jugadores }: { fase: string; partidos: Partido[]; jugadores: Record<string, string> }) {
  const rows = computeStandings(partidos, fase);
  return (
    <div className="mb-2">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{fase}</p>
      <div className="rounded-2xl overflow-hidden border border-gray-100">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr className="text-gray-400">
              <th className="text-left py-2 px-3 font-medium">Equipo</th>
              {['PJ','G','E','P','GF','GC','Pts'].map(h => (
                <th key={h} className={`text-center py-2 px-1.5 font-medium w-8 ${h === 'Pts' ? 'text-gray-700' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {rows.map((r, i) => (
              <tr key={r.equipo} className={i < 2 ? 'text-gray-900' : 'text-gray-400'}>
                <td className="py-2 px-3 font-medium flex items-center gap-1.5">
                  {i < 2 && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                  {i === 2 && <span className="w-1.5 h-1.5 rounded-full bg-orange-300 shrink-0" />}
                  {r.equipo} {jugadores[r.equipo] ? `(${jugadores[r.equipo]})` : ''}
                </td>
                <td className="text-center py-2">{r.PJ}</td>
                <td className="text-center py-2">{r.G}</td>
                <td className="text-center py-2">{r.E}</td>
                <td className="text-center py-2">{r.P}</td>
                <td className="text-center py-2">{r.GF}</td>
                <td className="text-center py-2">{r.GC}</td>
                <td className="text-center py-2 font-bold text-gray-900">{r.Pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sub-component: TorneoCard ────────────────────────────────────────────────

function TorneoCard({ torneo, onUpdate, onDelete, onSorteo, onGenerateKnockout, onGenerateFinal, onNextRound }: {
  torneo: TorneoFull;
  onUpdate: (torneoId: string, partidoId: string, gl: number, gv: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSorteo: (torneo: TorneoFull, shuffledEquipos: string[]) => Promise<void>;
  onGenerateKnockout: (torneo: TorneoFull) => Promise<void>;
  onGenerateFinal: (torneo: TorneoFull, winners: string[]) => Promise<void>;
  onNextRound: (torneo: TorneoFull, winners: string[]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [drawEquipos, setDrawEquipos] = useState<string[] | null>(null);
  const [drawSaving, setDrawSaving] = useState(false);
  const [generatingKnockout, setGeneratingKnockout] = useState(false);
  const [generatingFinal, setGeneratingFinal] = useState(false);
  const [generatingRound, setGeneratingRound] = useState(false);

  const { partidos, inscripciones } = torneo;
  const total = partidos.length;
  const done = partidos.filter(p => p.completado).length;
  const progress = total > 0 ? (done / total) * 100 : 0;
  const status = getTorneoStatus(partidos);
  const faseActual = getFaseActual(partidos);
  const fases = sortFases([...new Set(partidos.map(p => p.fase))]);

  // Sorteo
  const hasSorteo = partidos.length > 0;
  const canSortear = !hasSorteo && inscripciones.length >= 2;
  const drawPreview = drawEquipos ? buildMatches(drawEquipos, torneo.tipo as TipoTorneo, torneo.id) : null;
  const drawPreviewByFase: Record<string, Omit<Partido, 'id'>[]> = {};
  drawPreview?.forEach(m => { (drawPreviewByFase[m.fase] ??= []).push(m); });

  // Grupos phase tracking
  const allGruposPartidos = partidos.filter(p => p.fase === 'Grupo A' || p.fase === 'Grupo B');
  const gruposCompleted = allGruposPartidos.length > 0 && allGruposPartidos.every(p => p.completado);
  const hasKnockout = partidos.some(p => p.fase === 'Semifinal' || p.fase === 'Repechaje');
  const canGenerateKnockout = gruposCompleted && !hasKnockout;

  // Semi → Final
  const semifinalPartidos = partidos.filter(p => p.fase === 'Semifinal');
  const semisCompleted = semifinalPartidos.length > 0 && semifinalPartidos.every(p => p.completado);
  const hasFinal = partidos.some(p => p.fase === 'Final');
  const semiWinners = semisCompleted ? getAggregateWinners(semifinalPartidos) : null;
  const canGenerateFinal = semisCompleted && !hasFinal && !!semiWinners && semiWinners.length >= 2;

  // Elimination next round
  const elimFasePartidos = torneo.tipo === 'eliminacion' ? partidos.filter(p => p.fase === faseActual) : [];
  const allElimDone = elimFasePartidos.length > 0 && elimFasePartidos.every(p => p.completado);
  const isLastFase = faseActual === 'Final';
  const nextWinners = (torneo.tipo === 'eliminacion' && allElimDone && !isLastFase)
    ? getAggregateWinners(elimFasePartidos) : null;

  const jugadores = Object.fromEntries(inscripciones.map(i => [i.equipo, i.jugador]));

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    await onDelete(torneo.id);
  };

  const handleDraw = () => setDrawEquipos(shuffle(inscripciones.map(i => i.equipo)));

  const handleConfirmDraw = async () => {
    if (!drawEquipos) return;
    setDrawSaving(true);
    await onSorteo(torneo, drawEquipos);
    setDrawEquipos(null);
    setDrawSaving(false);
  };

  const handleGenerateKnockout = async () => {
    setGeneratingKnockout(true);
    await onGenerateKnockout(torneo);
    setGeneratingKnockout(false);
  };

  const handleGenerateFinal = async () => {
    if (!semiWinners) return;
    setGeneratingFinal(true);
    await onGenerateFinal(torneo, semiWinners);
    setGeneratingFinal(false);
  };

  const handleNextRound = async () => {
    if (!nextWinners) return;
    setGeneratingRound(true);
    await onNextRound(torneo, nextWinners);
    setGeneratingRound(false);
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

      {/* Header */}
      <div className="px-7 py-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{torneo.nombre}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-xl ${
                torneo.tipo === 'eliminacion' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {torneo.tipo === 'eliminacion' ? 'Eliminación Directa' : 'Fase de Grupos'}
              </span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-xl ${status.color}`}>
                {status.label}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar size={11} />
                {formatDate(torneo.created_at)} · {formatTime(torneo.created_at)}
              </span>
              {total > 0 && (
                <span className="flex items-center gap-1.5">
                  <Layers size={11} />
                  Fase actual: <span className="font-medium text-gray-600 ml-0.5">{faseActual}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users size={11} />
                {inscripciones.length} participante{inscripciones.length !== 1 ? 's' : ''}
              </span>
              {total > 0 && <span>{done} / {total} partidos</span>}
            </div>

            {total > 0 && (
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div className="h-full bg-gray-900 rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleDelete} disabled={deleting} onMouseLeave={() => setConfirmDelete(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                confirmDelete ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
              }`}>
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {confirmDelete ? '¿Confirmar?' : 'Eliminar'}
            </button>
            <button onClick={() => setExpanded(e => !e)}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="border-t border-gray-50 px-7 py-6 space-y-6">

              {/* Sorteo section */}
              {!hasSorteo && (
                canSortear ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <button onClick={handleDraw}
                        className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-2xl hover:bg-gray-50 active:scale-[0.97] transition-all">
                        <Shuffle size={14} />
                        {drawEquipos ? 'Re-sortear' : 'Realizar Sorteo'}
                      </button>
                      {drawEquipos && (
                        <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                          onClick={handleConfirmDraw} disabled={drawSaving}
                          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-2xl hover:bg-indigo-500 active:scale-[0.97] transition-all disabled:opacity-40">
                          {drawSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          {drawSaving ? 'Guardando...' : 'Confirmar Sorteo'}
                        </motion.button>
                      )}
                    </div>

                    {drawEquipos && Object.keys(drawPreviewByFase).length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Vista previa del sorteo</p>
                        {sortFases(Object.keys(drawPreviewByFase)).map(f => (
                          <div key={f}>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{f}</p>
                            <div className="space-y-1.5">
                              {drawPreviewByFase[f].map((m, i) => (
                                <div key={i} className="flex items-center bg-gray-50 rounded-2xl px-4 py-2.5 text-sm gap-2">
                                  <span className="font-medium text-gray-900 truncate flex-1 text-right">{m.equipoLocal} {jugadores[m.equipoLocal] ? `(${jugadores[m.equipoLocal]})` : ''}</span>
                                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg shrink-0 capitalize">
                                    {m.ronda === 'unico' ? 'único' : m.ronda}
                                  </span>
                                  <span className="font-medium text-gray-900 truncate flex-1">{m.equipoVisitante} {jugadores[m.equipoVisitante] ? `(${jugadores[m.equipoVisitante]})` : ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Registra al menos 2 participantes en este torneo para realizar el sorteo.
                  </p>
                )
              )}

              {/* Matches content */}
              {torneo.tipo === 'grupos' ? (
                <>
                  {/* Standings */}
                  {allGruposPartidos.length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {(['Grupo A', 'Grupo B'] as const).filter(f => fases.includes(f)).map(f => (
                        <StandingsTable key={f} fase={f} partidos={partidos} jugadores={jugadores} />
                      ))}
                    </div>
                  )}

                  {/* Group matches */}
                  {(['Grupo A', 'Grupo B'] as const).filter(f => fases.includes(f)).map(f => (
                    <div key={f}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{f} — Partidos</p>
                      <div className="space-y-2">
                        {partidos.filter(p => p.fase === f).map(p => (
                          <MatchCard key={p.id} partido={p} jugadores={jugadores} onUpdate={(id, gl, gv) => onUpdate(torneo.id, id, gl, gv)} />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Generate knockout */}
                  {canGenerateKnockout && (
                    <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      onClick={handleGenerateKnockout} disabled={generatingKnockout}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-2xl hover:bg-indigo-500 active:scale-[0.97] transition-all disabled:opacity-40">
                      {generatingKnockout ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                      Generar Eliminatoria
                    </motion.button>
                  )}

                  {/* Repechaje */}
                  {fases.includes('Repechaje') && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Repechaje</p>
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-orange-50 text-orange-600">5to puesto</span>
                      </div>
                      <div className="space-y-2 ml-4">
                        {partidos.filter(p => p.fase === 'Repechaje').map(p => (
                          <MatchCard key={p.id} partido={p} jugadores={jugadores} onUpdate={(id, gl, gv) => onUpdate(torneo.id, id, gl, gv)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Semifinal */}
                  {fases.includes('Semifinal') && (
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Semifinal</p>
                        {(() => {
                          const sf = partidos.filter(p => p.fase === 'Semifinal');
                          const d = sf.filter(p => p.completado).length;
                          return (
                            <span className={`text-xs px-2 py-0.5 rounded-lg ${
                              d === sf.length ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                            }`}>{d}/{sf.length}</span>
                          );
                        })()}
                      </div>
                      <div className="space-y-3 ml-4">
                        {(() => {
                          const sfPartidos = partidos.filter(p => p.fase === 'Semifinal');
                          const idas = sfPartidos.filter(p => p.ronda === 'ida');
                          return idas.map((ida, idx) => {
                            const vuelta = sfPartidos.find(p =>
                              p.ronda === 'vuelta' && p.equipoLocal === ida.equipoVisitante && p.equipoVisitante === ida.equipoLocal
                            );
                            const agGl = (ida.golesLocal ?? 0) + (vuelta?.golesVisitante ?? 0);
                            const agGv = (ida.golesVisitante ?? 0) + (vuelta?.golesLocal ?? 0);
                            const bothDone = ida.completado && !!vuelta?.completado;
                            return (
                              <div key={idx} className="p-3 bg-gray-50 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                                  <span>{ida.equipoLocal} {jugadores[ida.equipoLocal] ? `(${jugadores[ida.equipoLocal]})` : ''} vs {ida.equipoVisitante} {jugadores[ida.equipoVisitante] ? `(${jugadores[ida.equipoVisitante]})` : ''}</span>
                                  {bothDone && (
                                    <span className="font-bold text-gray-700">Global: {agGl} – {agGv}</span>
                                  )}
                                </div>
                                <MatchCard partido={ida} jugadores={jugadores} onUpdate={(id, gl, gv) => onUpdate(torneo.id, id, gl, gv)} />
                                {vuelta && <MatchCard partido={vuelta} jugadores={jugadores} onUpdate={(id, gl, gv) => onUpdate(torneo.id, id, gl, gv)} />}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {semisCompleted && !hasFinal && !semiWinners && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-4 py-2.5 rounded-2xl">
                      Hay empates en el global — define el ganador editando el marcador.
                    </p>
                  )}

                  {/* Generate final */}
                  {canGenerateFinal && (
                    <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      onClick={handleGenerateFinal} disabled={generatingFinal}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-2xl hover:bg-amber-400 active:scale-[0.97] transition-all disabled:opacity-40">
                      {generatingFinal ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                      Generar Final
                    </motion.button>
                  )}

                  {/* 3er Puesto */}
                  {fases.includes('3er Puesto') && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">3er Puesto</p>
                      </div>
                      <div className="space-y-2 ml-4">
                        {partidos.filter(p => p.fase === '3er Puesto').map(p => (
                          <MatchCard key={p.id} partido={p} jugadores={jugadores} onUpdate={(id, gl, gv) => onUpdate(torneo.id, id, gl, gv)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Final */}
                  {fases.includes('Final') && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Trophy size={14} className="text-amber-500" />
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Final</p>
                        {(() => {
                          const fp = partidos.filter(p => p.fase === 'Final');
                          if (fp[0]?.completado) {
                            const gl = fp[0].golesLocal ?? 0, gv = fp[0].golesVisitante ?? 0;
                            const winner = gl > gv ? fp[0].equipoLocal : gv > gl ? fp[0].equipoVisitante : null;
                             const winnerDisplay = winner ? (jugadores[winner] ? `${jugadores[winner]} (${winner})` : winner) : null;
                            return winnerDisplay ? (
                              <span className="text-xs px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-semibold">
                                🏆 {winnerDisplay}
                              </span>
                            ) : null;
                          }
                          return null;
                        })()}
                      </div>
                      <div className="space-y-2 ml-4">
                        {partidos.filter(p => p.fase === 'Final').map(p => (
                          <MatchCard key={p.id} partido={p} jugadores={jugadores} onUpdate={(id, gl, gv) => onUpdate(torneo.id, id, gl, gv)} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Elimination bracket */
                <>
                  {fases.map((f, fi) => {
                    const fp = partidos.filter(p => p.fase === f);
                    const doneInFase = fp.filter(p => p.completado).length;
                    const isCurrent = f === faseActual;
                    return (
                      <div key={f}>
                        <div className="flex items-center gap-3 mb-3">
                          {fi > 0 && <ArrowRight size={14} className="text-gray-300 shrink-0" />}
                          <div className="flex items-center gap-2">
                            {f === 'Final' && <Trophy size={12} className="text-amber-500" />}
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">{f}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-lg ${
                              doneInFase === fp.length ? 'bg-emerald-50 text-emerald-600' :
                              isCurrent ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'
                            }`}>{doneInFase}/{fp.length}</span>
                          </div>
                        </div>
                        <div className="space-y-2 ml-4">
                          {fp.map(p => (
                            <MatchCard key={p.id} partido={p} jugadores={jugadores} onUpdate={(id, gl, gv) => onUpdate(torneo.id, id, gl, gv)} />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {nextWinners && nextWinners.length >= 2 && (
                    <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      onClick={handleNextRound} disabled={generatingRound}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-2xl hover:bg-indigo-500 active:scale-[0.97] transition-all disabled:opacity-40">
                      {generatingRound ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                      Generar {getFaseName(nextWinners.length)}
                    </motion.button>
                  )}

                  {/* 3er Puesto */}
                  {fases.includes('3er Puesto') && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">3er Puesto</p>
                      </div>
                      <div className="space-y-2 ml-4">
                        {partidos.filter(p => p.fase === '3er Puesto').map(p => (
                          <MatchCard key={p.id} partido={p} jugadores={jugadores} onUpdate={(id, gl, gv) => onUpdate(torneo.id, id, gl, gv)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {allElimDone && !isLastFase && !nextWinners && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-4 py-2.5 rounded-2xl">
                      Hay empates en el global — define el ganador editando el marcador.
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Fixture() {
  const [torneos, setTorneos] = useState<TorneoFull[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newTipo, setNewTipo] = useState<TipoTorneo>('eliminacion');
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [t, p, i] = await Promise.all([
      api.getTorneos().catch(() => [] as Torneo[]),
      api.getPartidos().catch(() => [] as Partido[]),
      api.getInscripciones().catch(() => [] as Inscripcion[]),
    ]);
    setTorneos(t.map(torneo => ({
      ...torneo,
      partidos: p.filter(pa => pa.torneo_id === torneo.id),
      inscripciones: i.filter(ins => ins.torneo_id === torneo.id),
    })));
  }, []);

  useEffect(() => { loadAll().finally(() => setFetching(false)); }, [loadAll]);

  const handleCreate = async () => {
    if (!newNombre.trim()) { setError('Ingresa un nombre para el torneo.'); return; }
    setCreating(true);
    setError(null);
    try {
      const torneo = await api.postTorneo({ nombre: newNombre.trim(), tipo: newTipo });
      setTorneos(prev => [{ ...torneo, partidos: [], inscripciones: [] }, ...prev]);
      setNewNombre('');
      setShowNew(false);
    } catch {
      setError('Error al crear el torneo. Verifica la conexión.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (torneoId: string, partidoId: string, gl: number, gv: number, pl?: number, pv?: number) => {
    const updated = await api.putPartido(partidoId, {
      golesLocal: gl,
      golesVisitante: gv,
      penalesLocal: pl,
      penalesVisitante: pv,
      completado: true
    });
    setTorneos(prev => prev.map(t =>
      t.id === torneoId ? { ...t, partidos: t.partidos.map(p => p.id === partidoId ? updated : p) } : t
    ));
  };

  const handleDelete = async (id: string) => {
    await api.deleteTorneo(id);
    setTorneos(prev => prev.filter(t => t.id !== id));
  };

  const handleSorteo = async (torneo: TorneoFull, shuffledEquipos: string[]) => {
    const matchData = buildMatches(shuffledEquipos, torneo.tipo as TipoTorneo, torneo.id);
    const saved = await Promise.all(matchData.map(m => api.postPartido(m)));
    setTorneos(prev => prev.map(t =>
      t.id === torneo.id ? { ...t, partidos: saved } : t
    ));
  };

  const handleGenerateKnockout = async (torneo: TorneoFull) => {
    const standingsA = computeStandings(torneo.partidos, 'Grupo A');
    const standingsB = computeStandings(torneo.partidos, 'Grupo B');
    if (standingsA.length < 2 || standingsB.length < 2) return;

    const [a1, a2, a3] = standingsA;
    const [b1, b2, b3] = standingsB;

    const newMatches: Omit<Partido, 'id'>[] = [
      { torneo_id: torneo.id, tipo: 'grupos', fase: 'Semifinal', ronda: 'ida', equipoLocal: a1.equipo, equipoVisitante: b2.equipo, completado: false },
      { torneo_id: torneo.id, tipo: 'grupos', fase: 'Semifinal', ronda: 'vuelta', equipoLocal: b2.equipo, equipoVisitante: a1.equipo, completado: false },
      { torneo_id: torneo.id, tipo: 'grupos', fase: 'Semifinal', ronda: 'ida', equipoLocal: b1.equipo, equipoVisitante: a2.equipo, completado: false },
      { torneo_id: torneo.id, tipo: 'grupos', fase: 'Semifinal', ronda: 'vuelta', equipoLocal: a2.equipo, equipoVisitante: b1.equipo, completado: false },
    ];

    if (a3 && b3) {
      newMatches.push({
        torneo_id: torneo.id, tipo: 'grupos', fase: 'Repechaje', ronda: 'unico',
        equipoLocal: a3.equipo, equipoVisitante: b3.equipo, completado: false,
      });
    }

    const saved = await Promise.all(newMatches.map(m => api.postPartido(m)));
    setTorneos(prev => prev.map(t =>
      t.id === torneo.id ? { ...t, partidos: [...t.partidos, ...saved] } : t
    ));
  };

  const handleGenerateFinal = async (torneo: TorneoFull, winners: string[]) => {
    const losers = getAggregateLosers(torneo.partidos.filter(p => p.fase === 'Semifinal'), winners);
    const newMatches: Omit<Partido, 'id'>[] = [
      { torneo_id: torneo.id, tipo: 'grupos', fase: 'Final', ronda: 'unico', equipoLocal: winners[0], equipoVisitante: winners[1], completado: false },
    ];
    if (losers.length >= 2) {
      newMatches.push({ torneo_id: torneo.id, tipo: 'grupos', fase: '3er Puesto', ronda: 'unico', equipoLocal: losers[0], equipoVisitante: losers[1], completado: false });
    }
    const saved = await Promise.all(newMatches.map(m => api.postPartido(m)));
    setTorneos(prev => prev.map(t =>
      t.id === torneo.id ? { ...t, partidos: [...t.partidos, ...saved] } : t
    ));
  };

  const handleNextRound = async (torneo: TorneoFull, winners: string[]) => {
    const nextFase = getFaseName(winners.length);
    const isFinal = winners.length === 2;
    const newMatches: Omit<Partido, 'id'>[] = [];
    for (let i = 0; i + 1 < winners.length; i += 2) {
      if (isFinal) {
        newMatches.push({ torneo_id: torneo.id, tipo: 'eliminacion', fase: 'Final', ronda: 'unico', equipoLocal: winners[i], equipoVisitante: winners[i + 1], completado: false });
      } else {
        newMatches.push({ torneo_id: torneo.id, tipo: 'eliminacion', fase: nextFase, ronda: 'ida', equipoLocal: winners[i], equipoVisitante: winners[i + 1], completado: false });
        newMatches.push({ torneo_id: torneo.id, tipo: 'eliminacion', fase: nextFase, ronda: 'vuelta', equipoLocal: winners[i + 1], equipoVisitante: winners[i], completado: false });
      }
    }
    const saved = await Promise.all(newMatches.map(m => api.postPartido(m)));

    // Also generate 3rd place if we are moving to Final
    if (isFinal) {
      const losers = getAggregateLosers(torneo.partidos.filter(p => p.fase === 'Semifinal'), winners);
      if (losers.length >= 2) {
        const thirdPlaceMatch = await api.postPartido({
          torneo_id: torneo.id, tipo: 'eliminacion', fase: '3er Puesto', ronda: 'unico',
          equipoLocal: losers[0], equipoVisitante: losers[1], completado: false
        });
        saved.push(thirdPlaceMatch);
      }
    }

    setTorneos(prev => prev.map(t =>
      t.id === torneo.id ? { ...t, partidos: [...t.partidos, ...saved] } : t
    ));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Torneos</h2>
          <p className="text-sm text-gray-400 mt-0.5">{torneos.length} {torneos.length === 1 ? 'torneo creado' : 'torneos creados'}</p>
        </div>
        <button onClick={() => { setShowNew(s => !s); setError(null); setNewNombre(''); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-2xl hover:bg-gray-700 active:scale-[0.97] transition-all">
          {showNew ? <X size={14} /> : <Plus size={14} />}
          {showNew ? 'Cancelar' : 'Nuevo torneo'}
        </button>
      </div>

      {/* New tournament panel */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-white rounded-3xl p-7 shadow-sm border border-gray-100 space-y-5">
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-2">Nombre del torneo</label>
                <input type="text" value={newNombre} onChange={e => setNewNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Ej. Torneo Clausura 2026"
                  className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Tipo de torneo</p>
                <div className="inline-flex bg-gray-100 p-1 rounded-2xl gap-1">
                  {(['eliminacion', 'grupos'] as TipoTorneo[]).map(t => (
                    <button key={t} onClick={() => setNewTipo(t)}
                      className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        newTipo === t ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      {newTipo === t && (
                        <motion.div layoutId="tipo-pill-new" className="absolute inset-0 bg-white rounded-xl shadow-sm"
                          transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }} />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        {t === 'eliminacion' ? <Trophy size={13} /> : <Users size={13} />}
                        {t === 'eliminacion' ? 'Eliminación Directa' : 'Fase de Grupos'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm p-3.5 rounded-2xl bg-red-50 text-red-700">
                  <AlertCircle size={15} />{error}
                </div>
              )}

              <button onClick={handleCreate} disabled={creating || !newNombre.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-2xl hover:bg-indigo-500 active:scale-[0.97] transition-all disabled:opacity-40">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {creating ? 'Creando...' : 'Crear torneo'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tournaments list */}
      {fetching ? (
        <div className="flex justify-center py-16 text-gray-300"><Loader2 size={24} className="animate-spin" /></div>
      ) : torneos.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No hay torneos aún. Crea el primero con el botón de arriba.
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {torneos.map(t => (
            <TorneoCard key={t.id} torneo={t}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onSorteo={handleSorteo}
              onGenerateKnockout={handleGenerateKnockout}
              onGenerateFinal={handleGenerateFinal}
              onNextRound={handleNextRound}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
