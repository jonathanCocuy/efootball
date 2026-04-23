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

type TipoTorneo = 'eliminacion' | 'grupos' | 'liga_playoffs_4' | 'liga_playoffs_2';

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

const FASE_ORDER = ['Liga', 'Grupo A', 'Grupo B', 'Repechaje', 'Ronda 1', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', '5to Puesto', '3er Puesto', 'Final'];

function sortFases(fases: string[]): string[] {
  return [...fases].sort((a, b) => {
    // Special handling for "Fecha X"
    if (a.includes(' - Fecha ') && b.includes(' - Fecha ')) {
      const [baseA, fechaA] = a.split(' - Fecha ');
      const [baseB, fechaB] = b.split(' - Fecha ');
      if (baseA === baseB) return parseInt(fechaA) - parseInt(fechaB);
    }
    
    const ia = FASE_ORDER.indexOf(a.split(' - ')[0]);
    const ib = FASE_ORDER.indexOf(b.split(' - ')[0]);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
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
  const grA = equipos.slice(0, half);
  const grB = equipos.slice(half);
  
  return [
    ...buildLigaMatches(grA, torneo_id, 'grupos', 'Grupo A'),
    ...buildLigaMatches(grB, torneo_id, 'grupos', 'Grupo B')
  ];
}

function buildLigaMatches(equipos: string[], torneo_id: string, tipo: TipoTorneo, baseFase: string = 'Liga'): Omit<Partido, 'id'>[] {
  const n = equipos.length;
  if (n < 2) return [];

  const teams = [...equipos];
  const isOdd = n % 2 !== 0;
  if (isOdd) teams.push('BYE'); // Placeholder for odd number of teams

  const pool = [...teams];
  const numRounds = pool.length - 1;
  const matchesPerRound = pool.length / 2;
  const matches: Omit<Partido, 'id'>[] = [];

  for (let r = 0; r < numRounds; r++) {
    const fecha = r + 1;
    const fase = `${baseFase} - Fecha ${fecha}`;
    
    for (let m = 0; m < matchesPerRound; m++) {
      const home = pool[m];
      const away = pool[pool.length - 1 - m];
      
      if (home !== 'BYE' && away !== 'BYE') {
        // Randomize home/away for variety
        const [l, v] = Math.random() > 0.5 ? [home, away] : [away, home];
        matches.push({ torneo_id, tipo, fase, ronda: 'unico', equipoLocal: l, equipoVisitante: v, completado: false });
      }
    }
    // Rotate pool: keep first team, rotate others
    pool.splice(1, 0, pool.pop()!);
  }
  
  return matches;
}

function buildMatches(equipos: string[], tipo: TipoTorneo, torneo_id: string): Omit<Partido, 'id'>[] {
  let matches: Omit<Partido, 'id'>[] = [];
  if (tipo === 'eliminacion') matches = buildEliminacionMatches(equipos, torneo_id);
  else if (tipo === 'grupos') matches = buildGruposMatches(equipos, torneo_id);
  else matches = buildLigaMatches(equipos, torneo_id, tipo);
  
  return shuffle(matches);
}

function computeStandings(partidos: Partido[], faseOrPrefix: string) {
  const fp = partidos.filter(p => p.fase === faseOrPrefix || p.fase.startsWith(faseOrPrefix + ' - '));
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

function MatchCard({ partido, jugadores, todosLosPartidos, onUpdate }: {
  partido: Partido;
  jugadores: Record<string, string>;
  todosLosPartidos: Partido[];
  onUpdate: (id: string, gl: number, gv: number, pl?: number | null, pv?: number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(!partido.completado);
  const [showPenalties, setShowPenalties] = useState(partido.penalesLocal != null);
  const [gl, setGl] = useState(partido.golesLocal?.toString() ?? '');
  const [gv, setGv] = useState(partido.golesVisitante?.toString() ?? '');
  const [pl, setPl] = useState(partido.penalesLocal?.toString() ?? '');
  const [pv, setPv] = useState(partido.penalesVisitante?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGl(partido.golesLocal?.toString() ?? '');
    setGv(partido.golesVisitante?.toString() ?? '');
    setPl(partido.penalesLocal?.toString() ?? '');
    setPv(partido.penalesVisitante?.toString() ?? '');
    setShowPenalties(partido.penalesLocal != null);
    if (partido.completado) setEditing(false);
    setError(null);
  }, [partido]);

  // Find companion match for global score
  const companion = (partido.ronda === 'vuelta' || partido.ronda === 'ida')
    ? todosLosPartidos.find(p => 
        p.id !== partido.id &&
        p.fase === partido.fase &&
        ((p.equipoLocal === partido.equipoLocal && p.equipoVisitante === partido.equipoVisitante) ||
         (p.equipoLocal === partido.equipoVisitante && p.equipoVisitante === partido.equipoLocal))
      )
    : null;

  const globalLocal = (partido.golesLocal ?? 0) + (companion ? (companion.equipoLocal === partido.equipoLocal ? (companion.golesLocal ?? 0) : (companion.golesVisitante ?? 0)) : 0);
  const globalVisitante = (partido.golesVisitante ?? 0) + (companion ? (companion.equipoVisitante === partido.equipoVisitante ? (companion.golesVisitante ?? 0) : (companion.golesLocal ?? 0)) : 0);

  const w = partido.completado
    ? (partido.golesLocal ?? 0) > (partido.golesVisitante ?? 0) ? 'local'
      : (partido.golesVisitante ?? 0) > (partido.golesLocal ?? 0) ? 'visitante'
        : (partido.penalesLocal != null && partido.penalesVisitante != null)
          ? (partido.penalesLocal > (partido.penalesVisitante ?? 0) ? 'local' : 'visitante')
          : 'draw'
    : null;

  const handleSave = async () => {
    if (gl === '' || gv === '' || !partido.id) return;

    const numL = parseInt(gl);
    const numV = parseInt(gv);
    let finalPenL = pl !== '' ? parseInt(pl) : null;
    let finalPenV = pv !== '' ? parseInt(pv) : null;

    // Validation for knockout matches
    const isKnockout = ['Semifinal', '3er Puesto', '5to Puesto', 'Final'].includes(partido.fase) || partido.tipo === 'eliminacion';
    const isSecondLegOrUnique = partido.ronda === 'vuelta' || partido.ronda === 'unico';

    if (isKnockout && isSecondLegOrUnique) {
      let isDraw = false;
      if (partido.ronda === 'unico') {
        isDraw = numL === numV;
      } else if (partido.ronda === 'vuelta' && companion) {
        const cLocalGoals = companion.equipoLocal === partido.equipoLocal ? (companion.golesLocal ?? 0) : (companion.golesVisitante ?? 0);
        const cVisitGoals = companion.equipoVisitante === partido.equipoVisitante ? (companion.golesVisitante ?? 0) : (companion.golesLocal ?? 0);
        isDraw = (numL + cLocalGoals) === (numV + cVisitGoals);
      }

      if (isDraw) {
        if (!showPenalties) {
          setShowPenalties(true);
          setError('Empate detectado. Ingresa el resultado de los penales.');
          return;
        }
        if (finalPenL === null || finalPenV === null) {
          setError('Se requiere definición por penales');
          return;
        }
        if (finalPenL === finalPenV) {
          setError('La tanda de penales debe tener un ganador');
          return;
        }
      } else {
        finalPenL = null;
        finalPenV = null;
      }
    } else {
      finalPenL = null;
      finalPenV = null;
    }

    setSaving(true);
    await onUpdate(partido.id, numL, numV, finalPenL, finalPenV);
    setSaving(false);
  };

  return (
    <div className={`flex flex-col gap-2 px-4 py-3 rounded-2xl text-sm transition-colors ${
      partido.completado ? 'bg-gray-50' : 'bg-white border border-gray-100 shadow-sm'
    }`}>
      <div className="flex justify-center gap-2">
        {partido.ronda && partido.ronda !== 'unico' && (
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white border border-gray-100 px-2 py-0.5 rounded-lg shadow-sm capitalize">
            {partido.ronda}
          </span>
        )}
        {partido.ronda === 'vuelta' && partido.completado && companion?.completado && (
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg shadow-sm">
            Global: {globalLocal} – {globalVisitante}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className={`flex-1 text-right truncate font-bold ${
          w === 'local' ? 'text-emerald-600' : w === 'visitante' ? 'text-red-600' : w === 'draw' ? 'text-amber-600' : 'text-gray-500'
        }`}>
          {partido.equipoLocal} {jugadores[partido.equipoLocal] ? `(${jugadores[partido.equipoLocal]})` : ''}
        </span>

        {partido.completado && !editing ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold tabular-nums text-gray-900 text-base bg-white px-3 py-1 rounded-xl border border-gray-100">
              {partido.golesLocal} – {partido.golesVisitante}
            </span>
            <button onClick={() => setEditing(true)}
              className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all" title="Modificar resultado">
              <Pencil size={11} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <input type="number" min="0" value={gl} onChange={e => { setGl(e.target.value); setError(null); }}
              className="w-11 text-center py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
            <span className="text-gray-300 text-xs">–</span>
            <input type="number" min="0" value={gv} onChange={e => { setGv(e.target.value); setError(null); }}
              className="w-11 text-center py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
            
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

        <span className={`flex-1 truncate font-bold ${
          w === 'visitante' ? 'text-emerald-600' : w === 'local' ? 'text-red-600' : w === 'draw' ? 'text-amber-600' : 'text-gray-500'
        }`}>
          {partido.equipoVisitante} {jugadores[partido.equipoVisitante] ? `(${jugadores[partido.equipoVisitante]})` : ''}
        </span>
      </div>

      {editing && showPenalties && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex justify-center overflow-hidden mt-1 mb-1">
          <div className="flex flex-col items-center gap-1.5 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 shadow-inner w-full max-w-[180px]">
             <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Penales</span>
             <div className="flex items-center gap-2">
               <input type="number" min="0" value={pl} onChange={e => { setPl(e.target.value); setError(null); }}
                 className="w-12 text-center py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
               <span className="text-gray-300 text-sm font-bold">–</span>
               <input type="number" min="0" value={pv} onChange={e => { setPv(e.target.value); setError(null); }}
                 className="w-12 text-center py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
             </div>
          </div>
        </motion.div>
      )}

      {!editing && partido.penalesLocal != null && partido.penalesVisitante != null && (
        <div className="flex justify-center mt-0.5 mb-1">
          <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-xl border border-gray-100 shadow-sm">
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Penales:</span>
             <span className="text-xs font-bold text-gray-900">
               {partido.penalesLocal} – {partido.penalesVisitante}
             </span>
          </div>
        </div>
      )}

      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="text-[11px] font-medium text-red-500 text-center bg-red-50 py-1 rounded-lg border border-red-100">
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ─── Sub-component: StandingsTable ───────────────────────────────────────────

function StandingsTable({ fase, partidos, jugadores, tipo }: { fase: string; partidos: Partido[]; jugadores: Record<string, string>; tipo?: string }) {
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
            {rows.map((r, i) => {
              const isTop2 = i < 2;
              const isTop4 = i < 4;
              const isQualified = tipo === 'liga_playoffs_4' ? isTop4 : isTop2;
              const colorClass = isQualified ? 'text-gray-900' : 'text-gray-400';
              const dotColor = (tipo === 'liga_playoffs_4' && i < 4) ? 'bg-indigo-400' : 
                               (tipo !== 'liga_playoffs_4' && i < 2) ? 'bg-indigo-400' : 
                               (i === 2 && tipo === 'grupos') ? 'bg-orange-300' : '';

              return (
                <tr key={r.equipo} className={colorClass}>
                  <td className="py-2 px-3 font-medium flex items-center gap-1.5">
                    {dotColor && <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />}
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
            );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sub-component: TorneoCard ────────────────────────────────────────────────

function TorneoCard({ torneo, onUpdate, onDelete, onSorteo, onGenerateKnockout, onGenerateFinal, onNextRound }: {
  torneo: TorneoFull;
  onUpdate: (torneoId: string, partidoId: string, gl: number, gv: number, pl?: number | null, pv?: number | null) => Promise<void>;
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
  const allGruposPartidos = partidos.filter(p => p.fase.startsWith('Grupo A') || p.fase.startsWith('Grupo B'));
  const gruposCompleted = allGruposPartidos.length > 0 && allGruposPartidos.every(p => p.completado);
  const hasKnockout = partidos.some(p => p.fase === 'Semifinal' || p.fase === 'Repechaje' || p.fase === '5to Puesto');
  const canGenerateKnockout = gruposCompleted && !hasKnockout;

  // Semi → Final
  const semifinalPartidos = partidos.filter(p => p.fase === 'Semifinal');
  const semisCompleted = semifinalPartidos.length > 0 && semifinalPartidos.every(p => p.completado);
  const hasFinal = partidos.some(p => p.fase === 'Final');
  const semiWinners = semisCompleted ? getAggregateWinners(semifinalPartidos) : null;
  const canGenerateFinal = semisCompleted && !hasFinal && !!semiWinners && semiWinners.length >= 2;

  // Elimination next round
  const elimFasePartidos = (torneo.tipo === 'eliminacion' || torneo.tipo === 'liga_playoffs_4' || torneo.tipo === 'liga_playoffs_2') ? partidos.filter(p => p.fase === faseActual) : [];
  const allElimDone = elimFasePartidos.length > 0 && elimFasePartidos.every(p => p.completado);
  const isLastFase = faseActual === 'Final';
  const nextWinners = ((torneo.tipo === 'eliminacion' || (torneo.tipo.startsWith('liga_playoffs') && !faseActual.startsWith('Liga'))) && allElimDone && !isLastFase)
    ? getAggregateWinners(elimFasePartidos) : null;

  // Liga → Playoffs
  const ligaPartidos = partidos.filter(p => p.fase.startsWith('Liga'));
  const ligaCompleted = ligaPartidos.length > 0 && ligaPartidos.every(p => p.completado);
  
  const canGenerateSemisFromLiga = torneo.tipo === 'liga_playoffs_4' && ligaCompleted && !partidos.some(p => p.fase === 'Semifinal');
  const canGenerateFinalFromLiga = torneo.tipo === 'liga_playoffs_2' && ligaCompleted && !partidos.some(p => p.fase === 'Final');

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
                torneo.tipo === 'eliminacion' ? 'bg-indigo-50 text-indigo-600' : 
                torneo.tipo === 'grupos' ? 'bg-amber-50 text-amber-600' :
                'bg-emerald-50 text-emerald-600'
              }`}>
                {torneo.tipo === 'eliminacion' ? 'Eliminación Directa' : 
                 torneo.tipo === 'grupos' ? 'Fase de Grupos' :
                 torneo.tipo === 'liga_playoffs_4' ? 'Liga + Semis (Top 4)' : 'Liga + Final (Top 2)'}
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
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Vista previa del sorteo</p>
                        </div>

                        {torneo.tipo === 'grupos' && (
                          <div className="grid grid-cols-2 gap-4">
                            {(() => {
                              const half = Math.ceil(drawEquipos.length / 2);
                              const grA = drawEquipos.slice(0, half);
                              const grB = drawEquipos.slice(half);
                              return (
                                <>
                                  <div className="bg-gray-50/50 rounded-3xl p-4 border border-gray-100">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 text-center">Grupo A</p>
                                    <div className="space-y-1.5">
                                      {grA.map(eq => (
                                        <div key={eq} className="bg-white px-3 py-2 rounded-xl text-sm font-semibold text-gray-900 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-center text-center sm:gap-1">
                                          {eq} <span className="text-gray-400 font-medium text-xs">{jugadores[eq] ? `(${jugadores[eq]})` : ''}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="bg-gray-50/50 rounded-3xl p-4 border border-gray-100">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 text-center">Grupo B</p>
                                    <div className="space-y-1.5">
                                      {grB.map(eq => (
                                        <div key={eq} className="bg-white px-3 py-2 rounded-xl text-sm font-semibold text-gray-900 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-center text-center sm:gap-1">
                                          {eq} <span className="text-gray-400 font-medium text-xs">{jugadores[eq] ? `(${jugadores[eq]})` : ''}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {torneo.tipo === 'grupos' ? (() => {
                           const allPhases = Object.keys(drawPreviewByFase);
                           const fechasSet = new Set(allPhases.map(f => f.split(' - ')[1]).filter(Boolean));
                           const fechas = Array.from(fechasSet).sort((a, b) => parseInt(a.replace('Fecha ', '')) - parseInt(b.replace('Fecha ', '')));
                           return (
                             <div className="space-y-5">
                               {fechas.map(f => (
                                 <div key={f} className="space-y-3">
                                    <div className="flex items-center gap-3">
                                      <div className="h-px bg-gray-50 flex-1" />
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-1 rounded-xl text-center">
                                        {f}
                                      </span>
                                      <div className="h-px bg-gray-50 flex-1" />
                                    </div>
                                    <div className="grid gap-3">
                                      {['Grupo A', 'Grupo B'].map(base => {
                                        const phaseName = `${base} - ${f}`;
                                        const matches = drawPreviewByFase[phaseName];
                                        if (!matches) return null;
                                        return (
                                          <div key={base} className="space-y-1.5">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{base}</p>
                                            {matches.map((m, i) => (
                                              <div key={i} className="flex items-center bg-gray-50 rounded-2xl px-4 py-2.5 text-sm gap-2 border border-gray-100">
                                                <span className="font-semibold text-gray-900 truncate flex-1 text-right">{m.equipoLocal} <span className="text-gray-400 font-medium ml-0.5">{jugadores[m.equipoLocal] ? `(${jugadores[m.equipoLocal]})` : ''}</span></span>
                                                <span className="text-[10px] font-bold text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-lg shrink-0 capitalize">
                                                  {m.ronda === 'unico' ? 'único' : m.ronda}
                                                </span>
                                                <span className="font-semibold text-gray-900 truncate flex-1">{m.equipoVisitante} <span className="text-gray-400 font-medium ml-0.5">{jugadores[m.equipoVisitante] ? `(${jugadores[m.equipoVisitante]})` : ''}</span></span>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })}
                                    </div>
                                 </div>
                               ))}
                             </div>
                           );
                        })() : (
                          <div className="space-y-4">
                            {sortFases(Object.keys(drawPreviewByFase)).map(f => (
                              <div key={f}>
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="h-px bg-gray-50 flex-1" />
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-1 rounded-xl text-center">
                                    {f.includes(' - ') ? f.split(' - ')[1] : f}
                                  </span>
                                  <div className="h-px bg-gray-50 flex-1" />
                                </div>
                                <div className="space-y-1.5">
                                  {drawPreviewByFase[f].map((m, i) => (
                                    <div key={i} className="flex items-center bg-gray-50 rounded-2xl px-4 py-2.5 text-sm gap-2 border border-gray-100">
                                      <span className="font-semibold text-gray-900 truncate flex-1 text-right">{m.equipoLocal} <span className="text-gray-400 font-medium ml-0.5">{jugadores[m.equipoLocal] ? `(${jugadores[m.equipoLocal]})` : ''}</span></span>
                                      <span className="text-[10px] font-bold text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-lg shrink-0 capitalize">
                                        {m.ronda === 'unico' ? 'único' : m.ronda}
                                      </span>
                                      <span className="font-semibold text-gray-900 truncate flex-1">{m.equipoVisitante} <span className="text-gray-400 font-medium ml-0.5">{jugadores[m.equipoVisitante] ? `(${jugadores[m.equipoVisitante]})` : ''}</span></span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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
              {(torneo.tipo === 'grupos' || torneo.tipo.startsWith('liga')) ? (
                <>
                  {/* Standings */}
                  <div className={`grid gap-4 ${torneo.tipo === 'grupos' ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                    {['Liga', 'Grupo A', 'Grupo B'].map(base => {
                      const hasFase = fases.some(f => f === base || f.startsWith(base + ' - '));
                      if (!hasFase) return null;
                      return <StandingsTable key={base} fase={base} partidos={partidos} jugadores={jugadores} tipo={torneo.tipo} />;
                    })}
                  </div>

                  {/* Grouped Matches by Fase (Fechas) */}
                  {torneo.tipo === 'grupos' ? (() => {
                    const groupPartidos = partidos.filter(p => p.fase.startsWith('Grupo A') || p.fase.startsWith('Grupo B'));
                    if (groupPartidos.length === 0) return null;
                    
                    const fechasSet = new Set(groupPartidos.map(p => p.fase.split(' - ')[1]).filter(Boolean));
                    const fechas = Array.from(fechasSet).sort((a, b) => parseInt(a.replace('Fecha ', '')) - parseInt(b.replace('Fecha ', '')));
                    
                    return (
                      <div className="space-y-6 mt-6">
                        <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fase de Grupos — Partidos</p>
                        </div>
                        <div className="space-y-6">
                          {fechas.map(f => (
                            <div key={f} className="space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="h-px bg-gray-50 flex-1" />
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-1 rounded-xl text-center">
                                  {f}
                                </span>
                                <div className="h-px bg-gray-50 flex-1" />
                              </div>
                              <div className="grid gap-2">
                                {['Grupo A', 'Grupo B'].map(base => {
                                  const matches = groupPartidos.filter(p => p.fase === `${base} - ${f}`);
                                  if (matches.length === 0) return null;
                                  return (
                                    <div key={base} className="space-y-2">
                                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{base}</p>
                                      {matches.map(p => (
                                        <MatchCard key={p.id} partido={p} jugadores={jugadores} todosLosPartidos={partidos} onUpdate={(id, gl, gv, pl, pv) => onUpdate(torneo.id, id, gl, gv, pl, pv)} />
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })() : (
                    ['Liga'].map(base => {
                      const baseFases = fases.filter(f => f === base || f.startsWith(base + ' - '));
                      if (baseFases.length === 0) return null;
                      return (
                        <div key={base} className="space-y-6 mt-6">
                          <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{base} — Partidos</p>
                          </div>
                          <div className="space-y-6">
                            {baseFases.map(f => (
                              <div key={f} className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <div className="h-px bg-gray-50 flex-1" />
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-1 rounded-xl text-center">
                                    {f.includes(' - ') ? f.split(' - ')[1] : f}
                                  </span>
                                  <div className="h-px bg-gray-50 flex-1" />
                                </div>
                                <div className="grid gap-2">
                                  {partidos.filter(p => p.fase === f).map(p => (
                                    <MatchCard key={p.id} partido={p} jugadores={jugadores} todosLosPartidos={partidos} onUpdate={(id, gl, gv, pl, pv) => onUpdate(torneo.id, id, gl, gv, pl, pv)} />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Generate playoffs from Liga */}
                  <div className="flex flex-wrap gap-3 mt-6">
                    {canGenerateSemisFromLiga && (
                      <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        onClick={handleGenerateKnockout} disabled={generatingKnockout}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-2xl hover:bg-indigo-500 active:scale-[0.97] transition-all disabled:opacity-40">
                        {generatingKnockout ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                        Generar Semifinales
                      </motion.button>
                    )}

                    {canGenerateFinalFromLiga && (
                      <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        onClick={handleGenerateFinal} disabled={generatingFinal}
                        className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-2xl hover:bg-amber-400 active:scale-[0.97] transition-all disabled:opacity-40">
                        {generatingFinal ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                        Generar Final
                      </motion.button>
                    )}
                    
                    {canGenerateKnockout && (
                      <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        onClick={handleGenerateKnockout} disabled={generatingKnockout}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-2xl hover:bg-indigo-500 active:scale-[0.97] transition-all disabled:opacity-40">
                        {generatingKnockout ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                        {torneo.tipo === 'grupos' ? 'Generar Semifinales' : 'Generar Eliminatoria'}
                      </motion.button>
                    )}
                  </div>

                  {/* 5to Puesto / Repechaje */}
                  {(fases.includes('5to Puesto') || fases.includes('Repechaje')) && (
                    <div className="mt-8">
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">5to Puesto</p>
                      </div>
                      <div className="space-y-2 ml-4">
                        {partidos.filter(p => p.fase === '5to Puesto' || p.fase === 'Repechaje').map(p => (
                          <MatchCard key={p.id} partido={p} jugadores={jugadores} todosLosPartidos={partidos} onUpdate={(id, gl, gv, pl, pv) => onUpdate(torneo.id, id, gl, gv, pl, pv)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Semifinal */}
                  {fases.includes('Semifinal') && (
                    <div className="mt-8">
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
                            return (
                              <div key={idx} className="p-3 bg-gray-50 rounded-2xl space-y-2 border border-gray-100">
                                <MatchCard partido={ida} jugadores={jugadores} todosLosPartidos={partidos} onUpdate={(id, gl, gv, pl, pv) => onUpdate(torneo.id, id, gl, gv, pl, pv)} />
                                {vuelta && <MatchCard partido={vuelta} jugadores={jugadores} todosLosPartidos={partidos} onUpdate={(id, gl, gv, pl, pv) => onUpdate(torneo.id, id, gl, gv, pl, pv)} />}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {semisCompleted && !hasFinal && !semiWinners && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-4 py-2.5 rounded-2xl mt-4">
                      Hay empates en el global — define el ganador editando el marcador.
                    </p>
                  )}

                  {/* Generate final */}
                  {canGenerateFinal && (
                    <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      onClick={handleGenerateFinal} disabled={generatingFinal}
                      className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-2xl hover:bg-amber-400 active:scale-[0.97] transition-all disabled:opacity-40">
                      {generatingFinal ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                      Generar Fase Final
                    </motion.button>
                  )}

                  {/* 3er Puesto */}
                  {fases.includes('3er Puesto') && (
                    <div className="mt-8">
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">3er Puesto</p>
                      </div>
                      <div className="space-y-2 ml-4">
                        {partidos.filter(p => p.fase === '3er Puesto').map(p => (
                          <MatchCard key={p.id} partido={p} jugadores={jugadores} todosLosPartidos={partidos} onUpdate={(id, gl, gv, pl, pv) => onUpdate(torneo.id, id, gl, gv, pl, pv)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Final */}
                  {fases.includes('Final') && (
                    <div className="mt-8">
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
                          <MatchCard key={p.id} partido={p} jugadores={jugadores} todosLosPartidos={partidos} onUpdate={(id, gl, gv, pl, pv) => onUpdate(torneo.id, id, gl, gv, pl, pv)} />
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
                            <MatchCard key={p.id} partido={p} jugadores={jugadores} todosLosPartidos={partidos} onUpdate={(id, gl, gv, pl, pv) => onUpdate(torneo.id, id, gl, gv, pl, pv)} />
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
                          <MatchCard key={p.id} partido={p} jugadores={jugadores} todosLosPartidos={partidos} onUpdate={(id, gl, gv, pl, pv) => onUpdate(torneo.id, id, gl, gv, pl, pv)} />
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

  const handleUpdate = async (torneoId: string, partidoId: string, gl: number, gv: number, pl?: number | null, pv?: number | null) => {
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
    let newMatches: Omit<Partido, 'id'>[] = [];

    if (torneo.tipo === 'grupos') {
      const standingsA = computeStandings(torneo.partidos, 'Grupo A');
      const standingsB = computeStandings(torneo.partidos, 'Grupo B');
      if (standingsA.length < 2 || standingsB.length < 2) return;

      const [a1, a2, a3] = standingsA;
      const [b1, b2, b3] = standingsB;

      newMatches = [
        { torneo_id: torneo.id, tipo: 'grupos', fase: 'Semifinal', ronda: 'ida', equipoLocal: a1.equipo, equipoVisitante: b2.equipo, completado: false },
        { torneo_id: torneo.id, tipo: 'grupos', fase: 'Semifinal', ronda: 'vuelta', equipoLocal: b2.equipo, equipoVisitante: a1.equipo, completado: false },
        { torneo_id: torneo.id, tipo: 'grupos', fase: 'Semifinal', ronda: 'ida', equipoLocal: b1.equipo, equipoVisitante: a2.equipo, completado: false },
        { torneo_id: torneo.id, tipo: 'grupos', fase: 'Semifinal', ronda: 'vuelta', equipoLocal: a2.equipo, equipoVisitante: b1.equipo, completado: false },
      ];
    } else if (torneo.tipo === 'liga_playoffs_4') {
      const standings = computeStandings(torneo.partidos, 'Liga');
      if (standings.length < 4) return;
      const [t1, t2, t3, t4] = standings;
      newMatches = [
        { torneo_id: torneo.id, tipo: 'liga_playoffs_4', fase: 'Semifinal', ronda: 'ida', equipoLocal: t1.equipo, equipoVisitante: t4.equipo, completado: false },
        { torneo_id: torneo.id, tipo: 'liga_playoffs_4', fase: 'Semifinal', ronda: 'vuelta', equipoLocal: t4.equipo, equipoVisitante: t1.equipo, completado: false },
        { torneo_id: torneo.id, tipo: 'liga_playoffs_4', fase: 'Semifinal', ronda: 'ida', equipoLocal: t2.equipo, equipoVisitante: t3.equipo, completado: false },
        { torneo_id: torneo.id, tipo: 'liga_playoffs_4', fase: 'Semifinal', ronda: 'vuelta', equipoLocal: t3.equipo, equipoVisitante: t2.equipo, completado: false },
      ];
    }

    if (newMatches.length === 0) return;
    const saved = await Promise.all(newMatches.map(m => api.postPartido(m)));
    setTorneos(prev => prev.map(t =>
      t.id === torneo.id ? { ...t, partidos: [...t.partidos, ...saved] } : t
    ));
  };

  const handleGenerateFinal = async (torneo: TorneoFull, winners: string[]) => {
    const isLiga2 = torneo.tipo === 'liga_playoffs_2';
    let finalTeams = winners;
    let losers: string[] = [];

    if (isLiga2) {
      const standings = computeStandings(torneo.partidos, 'Liga');
      if (standings.length < 2) return;
      finalTeams = [standings[0].equipo, standings[1].equipo];
      if (standings.length >= 4) losers = [standings[2].equipo, standings[3].equipo];
    } else {
      losers = getAggregateLosers(torneo.partidos.filter(p => p.fase === 'Semifinal'), winners);
    }

    const newMatches: Omit<Partido, 'id'>[] = [
      { torneo_id: torneo.id, tipo: torneo.tipo as TipoTorneo, fase: 'Final', ronda: 'unico', equipoLocal: finalTeams[0], equipoVisitante: finalTeams[1], completado: false },
    ];
    if (losers.length >= 2) {
      newMatches.push({ torneo_id: torneo.id, tipo: torneo.tipo as TipoTorneo, fase: '3er Puesto', ronda: 'unico', equipoLocal: losers[0], equipoVisitante: losers[1], completado: false });
    }

    if (torneo.tipo === 'grupos') {
      const standingsA = computeStandings(torneo.partidos, 'Grupo A');
      const standingsB = computeStandings(torneo.partidos, 'Grupo B');
      if (standingsA.length >= 3 && standingsB.length >= 3) {
        const lastA = standingsA[standingsA.length - 1].equipo;
        const lastB = standingsB[standingsB.length - 1].equipo;
        newMatches.push({ torneo_id: torneo.id, tipo: 'grupos', fase: '5to Puesto', ronda: 'unico', equipoLocal: lastA, equipoVisitante: lastB, completado: false });
      }
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
                <div className="flex flex-wrap bg-gray-100 p-1 rounded-2xl gap-1">
                  {(['eliminacion', 'grupos', 'liga_playoffs_4', 'liga_playoffs_2'] as TipoTorneo[]).map(t => (
                    <button key={t} onClick={() => setNewTipo(t)}
                      className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        newTipo === t ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      {newTipo === t && (
                        <motion.div layoutId="tipo-pill-new" className="absolute inset-0 bg-white rounded-xl shadow-sm"
                          transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }} />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        {t === 'eliminacion' && <Trophy size={13} />}
                        {t === 'grupos' && <Users size={13} />}
                        {t.startsWith('liga') && <Layers size={13} />}
                        {t === 'eliminacion' ? 'Eliminación Directa' : 
                         t === 'grupos' ? 'Fase de Grupos' :
                         t === 'liga_playoffs_4' ? 'Liga + Semis' : 'Liga + Final'}
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
