'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, Shield, Zap, Trophy, Loader2, RefreshCw, Users } from 'lucide-react';
import { api, type Inscripcion, type Partido } from '@/lib/api';

interface RecordCard {
  title: string;
  icon: React.ElementType;
  value: string;
  sub: string;
  colorClass: string;
}

export default function Stats() {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiDown, setApiDown] = useState(false);

  const load = () => {
    setLoading(true);
    setApiDown(false);
    Promise.all([
      api.getInscripciones().catch(() => [] as Inscripcion[]),
      api.getPartidos().catch(() => [] as Partido[]),
    ]).then(([insc, part]) => {
      setInscripciones(insc);
      setPartidos(part);
      if (insc.length === 0 && part.length === 0) setApiDown(true);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const completados = partidos.filter(p => p.completado);

  // Updated aggregate logic by player (summing across ALL tournaments)
  const statsPorJugador: Record<string, { golesA: number; golesR: number; partidos: number; wins: number; draws: number; losses: number; pts: number }> = {};

  completados.forEach(p => {
    const pLocal = inscripciones.find(i => i.torneo_id === p.torneo_id && i.equipo === p.equipoLocal)?.jugador;
    const pVisitante = inscripciones.find(i => i.torneo_id === p.torneo_id && i.equipo === p.equipoVisitante)?.jugador;
    
    if (!pLocal || !pVisitante) return;

    if (!statsPorJugador[pLocal]) statsPorJugador[pLocal] = { golesA: 0, golesR: 0, partidos: 0, wins: 0, draws: 0, losses: 0, pts: 0 };
    if (!statsPorJugador[pVisitante]) statsPorJugador[pVisitante] = { golesA: 0, golesR: 0, partidos: 0, wins: 0, draws: 0, losses: 0, pts: 0 };

    const gl = p.golesLocal ?? 0;
    const gv = p.golesVisitante ?? 0;

    // Penalty logic for points/result
    let winner: 'local' | 'visitante' | 'draw' = 'draw';
    if (gl > gv) winner = 'local';
    else if (gv > gl) winner = 'visitante';
    else if (p.penalesLocal != null && p.penalesVisitante != null) {
      if (p.penalesLocal > p.penalesVisitante) winner = 'local';
      else if (p.penalesVisitante > p.penalesLocal) winner = 'visitante';
    }

    // Local
    statsPorJugador[pLocal].partidos++;
    statsPorJugador[pLocal].golesA += gl;
    statsPorJugador[pLocal].golesR += gv;
    if (winner === 'local') { statsPorJugador[pLocal].wins++; statsPorJugador[pLocal].pts += 3; }
    else if (winner === 'visitante') { statsPorJugador[pLocal].losses++; }
    else { statsPorJugador[pLocal].draws++; statsPorJugador[pLocal].pts += 1; }

    // Visitante
    statsPorJugador[pVisitante].partidos++;
    statsPorJugador[pVisitante].golesA += gv;
    statsPorJugador[pVisitante].golesR += gl;
    if (winner === 'visitante') { statsPorJugador[pVisitante].wins++; statsPorJugador[pVisitante].pts += 3; }
    else if (winner === 'local') { statsPorJugador[pVisitante].losses++; }
    else { statsPorJugador[pVisitante].draws++; statsPorJugador[pVisitante].pts += 1; }
  });

  const generalTable = Object.entries(statsPorJugador)
    .map(([jugador, s]) => ({ jugador, ...s }))
    .sort((a, b) => b.pts - a.pts || (b.golesA - b.golesR) - (a.golesA - a.golesR) || b.golesA - a.golesA);

  const topGoleador = [...generalTable].sort((a, b) => b.golesA - a.golesA)[0];
  const mejorValla = [...generalTable].sort((a, b) => a.golesR - b.golesR)[0];
  
  const mayorGoleada = completados.reduce<Partido | null>((best, p) => {
    const diff = Math.abs((p.golesLocal ?? 0) - (p.golesVisitante ?? 0));
    const bestDiff = best ? Math.abs((best.golesLocal ?? 0) - (best.golesVisitante ?? 0)) : -1;
    return diff > bestDiff ? p : best;
  }, null);

  const jugadorPorEquipo = Object.fromEntries(inscripciones.map(i => [i.equipo, i.jugador]));
  const label = (equipo: string, torneoId?: string) => {
    if (torneoId) {
      return inscripciones.find(i => i.torneo_id === torneoId && i.equipo === equipo)?.jugador || equipo;
    }
    return jugadorPorEquipo[equipo] || equipo;
  };

  const records: RecordCard[] = [
    {
      title: 'Máximo Goleador',
      icon: Target,
      value: topGoleador ? topGoleador.jugador : '—',
      sub: topGoleador ? `${topGoleador.golesA} goles anotados` : 'Sin partidos completados',
      colorClass: 'text-orange-500 bg-orange-50',
    },
    {
      title: 'Valla Menos Vencida',
      icon: Shield,
      value: mejorValla ? mejorValla.jugador : '—',
      sub: mejorValla ? `Solo ${mejorValla.golesR} goles recibidos` : 'Sin partidos completados',
      colorClass: 'text-blue-500 bg-blue-50',
    },
    {
      title: 'Mayor Goleada',
      icon: Zap,
      value: mayorGoleada
        ? `${label(mayorGoleada.equipoLocal, mayorGoleada.torneo_id)} ${mayorGoleada.golesLocal}–${mayorGoleada.golesVisitante} ${label(mayorGoleada.equipoVisitante, mayorGoleada.torneo_id)}`
        : '—',
      sub: mayorGoleada
        ? `${Math.abs((mayorGoleada.golesLocal ?? 0) - (mayorGoleada.golesVisitante ?? 0))} goles de diferencia`
        : 'Sin partidos completados',
      colorClass: 'text-red-500 bg-red-50',
    },
  ];

  const finales = completados.filter(p => p.fase === 'Final');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-300">
        <Loader2 size={28} className="animate-spin" />
      </div>
    );
  }

  if (apiDown) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <p className="text-gray-400 text-sm">No se pudo conectar con el servidor.</p>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <RefreshCw size={14} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Record Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {records.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100"
          >
            <div className={`inline-flex p-2.5 rounded-2xl mb-4 ${card.colorClass}`}>
              <card.icon size={17} />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{card.title}</p>
            <p className="text-sm font-semibold text-gray-900 leading-snug">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabla General Aggregate Standing */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2.5 mb-7">
          <Users size={18} className="text-indigo-500" />
          <h2 className="text-xl font-semibold text-gray-900">Tabla General Histórica</h2>
          <span className="text-sm text-gray-400 ml-1">Suma de todos los torneos</span>
        </div>

        {generalTable.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">Aún no hay datos para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600">Jugador</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">PJ</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">G</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">E</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">P</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">GF</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">GC</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">DG</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center text-indigo-600">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {generalTable.map((row, i) => (
                  <tr key={row.jugador} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-gray-900 flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-4">#{i + 1}</span>
                      {row.jugador}
                    </td>
                    <td className="px-4 py-3.5 text-center text-gray-600">{row.partidos}</td>
                    <td className="px-4 py-3.5 text-center text-gray-600">{row.wins}</td>
                    <td className="px-4 py-3.5 text-center text-gray-600">{row.draws}</td>
                    <td className="px-4 py-3.5 text-center text-gray-600">{row.losses}</td>
                    <td className="px-4 py-3.5 text-center text-gray-600">{row.golesA}</td>
                    <td className="px-4 py-3.5 text-center text-gray-600">{row.golesR}</td>
                    <td className="px-4 py-3.5 text-center text-gray-600">{row.golesA - row.golesR}</td>
                    <td className="px-4 py-3.5 text-center font-bold text-indigo-600">{row.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Champions */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2.5 mb-7">
          <Trophy size={18} className="text-yellow-500" />
          <h2 className="text-xl font-semibold text-gray-900">Palmarés</h2>
          <span className="text-sm text-gray-400 ml-1">Historial de campeones</span>
        </div>

        {finales.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">Aún no hay finales disputadas.</p>
        ) : (
          <div className="space-y-3">
            {finales.map((final, i) => {
              const gl = final.golesLocal ?? 0;
              const gv = final.golesVisitante ?? 0;
              
              // Correct winner taking penalties into account
              let winnerEquipo = final.equipoLocal;
              if (gv > gl) winnerEquipo = final.equipoVisitante;
              else if (gl === gv) {
                if ((final.penalesVisitante ?? 0) > (final.penalesLocal ?? 0)) winnerEquipo = final.equipoVisitante;
              }
              
              const winnerJugador = label(winnerEquipo, final.torneo_id);
              return (
                <motion.div
                  key={final.id ?? i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100"
                >
                  <span className="text-xl">🏆</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{winnerJugador}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {winnerJugador} ({winnerEquipo}) · {final.equipoLocal} {gl}–{gv} {final.equipoVisitante}
                      {final.penalesLocal !== null && final.penalesVisitante !== null && ` (${final.penalesLocal}–${final.penalesVisitante} P)`}
                    </p>
                  </div>
                  <span className="text-xs text-amber-600 bg-amber-100 px-2.5 py-1 rounded-xl shrink-0">Campeón</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed matches */}
      {completados.length > 0 && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Resultados Recientes</h2>
          <p className="text-sm text-gray-400 mb-6">{completados.length} partidos completados</p>
          <div className="space-y-2">
            {[...completados].reverse().slice(0, 10).map((p, i) => {
              const gl = p.golesLocal ?? 0, gv = p.golesVisitante ?? 0;
              const pLocal = label(p.equipoLocal, p.torneo_id);
              const pVisitante = label(p.equipoVisitante, p.torneo_id);

              let matchWinner: 'local' | 'visitante' | 'draw' = 'draw';
              if (gl > gv) matchWinner = 'local';
              else if (gv > gl) matchWinner = 'visitante';
              else if (p.penalesLocal != null && p.penalesVisitante != null) {
                if (p.penalesLocal > p.penalesVisitante) matchWinner = 'local';
                else if (p.penalesVisitante > p.penalesLocal) matchWinner = 'visitante';
              }

              const colorL = matchWinner === 'local' ? 'text-emerald-600' : matchWinner === 'visitante' ? 'text-red-600' : 'text-amber-600';
              const colorV = matchWinner === 'visitante' ? 'text-emerald-600' : matchWinner === 'local' ? 'text-red-600' : 'text-amber-600';

              return (
                <motion.div
                  key={p.id ?? i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-2xl text-sm gap-2"
                >
                  <span className={`font-bold truncate flex-1 text-right ${colorL}`}>
                    {p.equipoLocal} ({pLocal})
                  </span>
                  <span className="font-bold tabular-nums text-gray-900 shrink-0">
                    {gl} – {gv}
                    {p.penalesLocal != null && p.penalesVisitante != null && <span className="text-[10px] text-gray-400 ml-1">({p.penalesLocal}-{p.penalesVisitante}P)</span>}
                  </span>
                  <span className={`font-bold truncate flex-1 ${colorV}`}>
                    {p.equipoVisitante} ({pVisitante})
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg shrink-0">{p.fase}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
