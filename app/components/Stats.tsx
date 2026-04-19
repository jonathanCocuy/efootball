'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, Shield, Zap, Trophy, Loader2, RefreshCw } from 'lucide-react';
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

  const golesAnotados: Record<string, number> = {};
  const golesRecibidos: Record<string, number> = {};
  completados.forEach(p => {
    const gl = p.golesLocal ?? 0;
    const gv = p.golesVisitante ?? 0;
    golesAnotados[p.equipoLocal] = (golesAnotados[p.equipoLocal] ?? 0) + gl;
    golesAnotados[p.equipoVisitante] = (golesAnotados[p.equipoVisitante] ?? 0) + gv;
    golesRecibidos[p.equipoLocal] = (golesRecibidos[p.equipoLocal] ?? 0) + gv;
    golesRecibidos[p.equipoVisitante] = (golesRecibidos[p.equipoVisitante] ?? 0) + gl;
  });

  const topGoleador = Object.entries(golesAnotados).sort((a, b) => b[1] - a[1])[0];
  const mejorValla = Object.entries(golesRecibidos).sort((a, b) => a[1] - b[1])[0];
  const mayorGoleada = completados.reduce<Partido | null>((best, p) => {
    const diff = Math.abs((p.golesLocal ?? 0) - (p.golesVisitante ?? 0));
    const bestDiff = best ? Math.abs((best.golesLocal ?? 0) - (best.golesVisitante ?? 0)) : -1;
    return diff > bestDiff ? p : best;
  }, null);

  const jugadorPorEquipo = Object.fromEntries(inscripciones.map(i => [i.equipo, i.jugador]));
  const label = (equipo: string) =>
    jugadorPorEquipo[equipo] ? `${jugadorPorEquipo[equipo]} · ${equipo}` : equipo;

  const records: RecordCard[] = [
    {
      title: 'Máximo Goleador',
      icon: Target,
      value: topGoleador ? label(topGoleador[0]) : '—',
      sub: topGoleador ? `${topGoleador[1]} goles anotados` : 'Sin partidos completados',
      colorClass: 'text-orange-500 bg-orange-50',
    },
    {
      title: 'Valla Menos Vencida',
      icon: Shield,
      value: mejorValla ? label(mejorValla[0]) : '—',
      sub: mejorValla ? `Solo ${mejorValla[1]} goles recibidos` : 'Sin partidos completados',
      colorClass: 'text-blue-500 bg-blue-50',
    },
    {
      title: 'Mayor Goleada',
      icon: Zap,
      value: mayorGoleada
        ? `${mayorGoleada.equipoLocal} ${mayorGoleada.golesLocal}–${mayorGoleada.golesVisitante} ${mayorGoleada.equipoVisitante}`
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
              const winnerEquipo = gl >= gv ? final.equipoLocal : final.equipoVisitante;
              const winnerJugador = jugadorPorEquipo[winnerEquipo] ?? winnerEquipo;
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
                      {winnerEquipo} · {final.equipoLocal} {gl}–{gv} {final.equipoVisitante}
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
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Resultados</h2>
          <p className="text-sm text-gray-400 mb-6">{completados.length} partidos completados</p>
          <div className="space-y-2">
            {completados.map((p, i) => {
              const gl = p.golesLocal ?? 0;
              const gv = p.golesVisitante ?? 0;
              return (
                <motion.div
                  key={p.id ?? i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-2xl text-sm gap-2"
                >
                  <span className={`font-medium truncate flex-1 text-right ${gl > gv ? 'text-gray-900' : 'text-gray-400'}`}>
                    {p.equipoLocal}
                  </span>
                  <span className="font-bold tabular-nums text-gray-900 shrink-0">{gl} – {gv}</span>
                  <span className={`font-medium truncate flex-1 ${gv > gl ? 'text-gray-900' : 'text-gray-400'}`}>
                    {p.equipoVisitante}
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
