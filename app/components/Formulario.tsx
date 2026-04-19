'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle, AlertCircle, Loader2, Pencil, Trash2, X, Trophy } from 'lucide-react';
import { api, type Inscripcion, type Torneo } from '@/lib/api';

const JUGADORES = ['Jonathan', 'Monje', 'Cristian', 'Diego', 'Maicol', 'David', 'Luis', 'Nicolás', 'Juan Pablo'];

const FALLBACK_EQUIPOS: Record<string, string[]> = {
  'Selecciones': ['Brasil', 'Argentina', 'Francia', 'Inglaterra', 'España', 'Portugal', 'Alemania', 'Países Bajos', 'Bélgica', 'Italia', 'Uruguay', 'Colombia', 'Croacia', 'Marruecos', 'Japón', 'Estados Unidos'],
  'Premier League': ['Manchester City', 'Arsenal', 'Liverpool', 'Chelsea', 'Tottenham', 'Man United', 'Newcastle', 'Aston Villa'],
  'LaLiga': ['Real Madrid', 'Barcelona', 'Atlético Madrid', 'Sevilla', 'Valencia', 'Athletic Club', 'Real Betis', 'Villarreal'],
  'Serie A': ['Juventus', 'Inter Milan', 'AC Milan', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 'Fiorentina'],
  'Bundesliga': ['Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen', 'Wolfsburg', 'Gladbach', 'Union Berlin', 'Stuttgart'],
  'Ligue 1': ['PSG', 'Marseille', 'Lyon', 'Monaco', 'Rennes', 'Lille', 'Nice', 'Lens'],
  'Liga Portugal': ['Porto', 'Benfica', 'Sporting CP', 'Braga', 'Vitória SC', 'Famalicão'],
};

type Status = { type: 'success' | 'error'; msg: string };
interface ModalState { inscripcion: Inscripcion; jugador: string; liga: string; equipo: string }

function Sel({ label, value, onChange, disabled, children }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-2">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
          className="w-full appearance-none pl-4 pr-10 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:bg-white transition-all disabled:opacity-40"
          required>
          {children}
        </select>
        <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

export default function Formulario() {
  const [torneoId, setTorneoId] = useState('');
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [jugador, setJugador] = useState('');
  const [liga, setLiga] = useState('');
  const [equipo, setEquipo] = useState('');
  const [catalogo, setCatalogo] = useState<Record<string, string[]>>(FALLBACK_EQUIPOS);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalLoading, setModalLoading] = useState<'save' | 'delete' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getTorneos().catch(() => [] as Torneo[]),
      api.getCatalogos().catch(() => null),
      api.getInscripciones().catch(() => [] as Inscripcion[]),
    ]).then(([ts, cat, insc]) => {
      setTorneos(ts);
      if (cat?.equipos && Object.keys(cat.equipos).length > 0) setCatalogo(cat.equipos);
      setInscripciones(insc);
    }).finally(() => setFetching(false));
  }, []);

  const ligas = Object.keys(catalogo);
  const equiposDeLiga = liga ? (catalogo[liga] ?? []) : [];

  const registradosEnTorneo = new Set(
    inscripciones.filter(i => i.torneo_id === torneoId).map(i => i.equipo)
  );

  const jugadoresRegistradosEnTorneo = new Set(
    inscripciones.filter(i => i.torneo_id === torneoId).map(i => i.jugador)
  );

  const participantesDelTorneo = torneoId
    ? inscripciones.filter(i => i.torneo_id === torneoId)
    : [];

  const torneoActual = torneos.find(t => t.id === torneoId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!torneoId || !jugador || !liga || !equipo) return;
    if (registradosEnTorneo.has(equipo)) {
      setStatus({ type: 'error', msg: `${equipo} ya está registrado en este torneo.` });
      return;
    }
    if (jugadoresRegistradosEnTorneo.has(jugador)) {
      setStatus({ type: 'error', msg: `${jugador} ya está registrado en este torneo.` });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const nueva = await api.postInscripcion({ jugador, equipo, liga, torneo_id: torneoId });
      setInscripciones(prev => [...prev, nueva]);
      setStatus({ type: 'success', msg: `${jugador} registrado con ${equipo}.` });
      setJugador(''); setLiga(''); setEquipo('');
    } catch {
      setStatus({ type: 'error', msg: 'No se pudo conectar con el servidor.' });
    } finally {
      setLoading(false);
    }
  };

  const openModal = (ins: Inscripcion) => {
    setModal({ inscripcion: ins, jugador: ins.jugador, liga: ins.liga, equipo: ins.equipo });
    setConfirmDelete(false);
  };

  const closeModal = () => { setModal(null); setConfirmDelete(false); };

  const handleSave = async () => {
    if (!modal?.inscripcion.id) return;
    setModalLoading('save');
    try {
      const updated = await api.putInscripcion(modal.inscripcion.id, {
        jugador: modal.jugador, liga: modal.liga, equipo: modal.equipo, torneo_id: torneoId,
      });
      setInscripciones(prev => prev.map(i => i.id === updated.id ? updated : i));
      closeModal();
    } finally { setModalLoading(null); }
  };

  const handleDelete = async () => {
    if (!modal?.inscripcion.id) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setModalLoading('delete');
    try {
      await api.deleteInscripcion(modal.inscripcion.id);
      setInscripciones(prev => prev.filter(i => i.id !== modal.inscripcion.id));
      closeModal();
    } finally { setModalLoading(null); }
  };

  const modalEquiposDeLiga = modal ? (catalogo[modal.liga] ?? []) : [];
  const registradosSinModal = new Set(
    inscripciones.filter(i => i.id !== modal?.inscripcion.id && i.torneo_id === torneoId).map(i => i.equipo)
  );
  const jugadoresRegistradosSinModal = new Set(
    inscripciones.filter(i => i.id !== modal?.inscripcion.id && i.torneo_id === torneoId).map(i => i.jugador)
  );

  return (
    <>
      <div className="space-y-5">
        {/* Torneo selector — full width, prominent */}
        <div className="bg-white rounded-3xl p-7 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-900">Selecciona el torneo</h2>
          </div>

          {fetching ? (
            <div className="flex items-center justify-center h-12 text-gray-300"><Loader2 size={20} className="animate-spin" /></div>
          ) : torneos.length === 0 ? (
            <p className="text-sm text-gray-400 bg-gray-50 px-4 py-3 rounded-2xl">
              No hay torneos creados. Ve a la pestaña <span className="font-medium text-gray-600">Torneo</span> y crea uno primero.
            </p>
          ) : (
            <div className="relative">
              <select
                value={torneoId}
                onChange={e => { setTorneoId(e.target.value); setJugador(''); setLiga(''); setEquipo(''); setStatus(null); }}
                className="w-full appearance-none pl-4 pr-10 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:bg-white transition-all"
              >
                <option value="">— Selecciona un torneo —</option>
                {torneos.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} · {t.tipo === 'eliminacion' ? 'Eliminación' : 'Grupos'}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}

          {torneoActual && (
            <p className="text-xs text-gray-400 mt-2 ml-1">
              {participantesDelTorneo.length} participante{participantesDelTorneo.length !== 1 ? 's' : ''} registrado{participantesDelTorneo.length !== 1 ? 's' : ''} en este torneo
            </p>
          )}
        </div>

        {/* Registration form — only shown when torneo is selected */}
        <AnimatePresence>
          {torneoId && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="grid md:grid-cols-2 gap-5"
            >
              {/* Form */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 mb-7">Registro de Jugador</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <Sel label="Jugador" value={jugador} onChange={v => { setJugador(v); setStatus(null); }}>
                    <option value="">Selecciona un jugador</option>
                    {JUGADORES.map(n => (
                      <option key={n} value={n} disabled={jugadoresRegistradosEnTorneo.has(n)}>
                        {n}{jugadoresRegistradosEnTorneo.has(n) ? ' — ya registrado' : ''}
                      </option>
                    ))}
                  </Sel>

                  <Sel label="Liga" value={liga} onChange={v => { setLiga(v); setEquipo(''); setStatus(null); }}>
                    <option value="">Selecciona una liga</option>
                    {ligas.map(l => <option key={l} value={l}>{l}</option>)}
                  </Sel>

                  <Sel label="Equipo" value={equipo} onChange={v => { setEquipo(v); setStatus(null); }} disabled={!liga}>
                    <option value="">Selecciona un equipo</option>
                    {equiposDeLiga.map(eq => (
                      <option key={eq} value={eq} disabled={registradosEnTorneo.has(eq)}>
                        {eq}{registradosEnTorneo.has(eq) ? ' — ya registrado' : ''}
                      </option>
                    ))}
                  </Sel>

                  {status && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center gap-2 text-sm p-3.5 rounded-2xl ${
                        status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                      {status.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                      {status.msg}
                    </motion.div>
                  )}

                  <button type="submit" disabled={loading}
                    className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-2xl hover:bg-gray-700 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    {loading ? 'Registrando...' : 'Registrar jugador'}
                  </button>
                </form>
              </div>

              {/* Participant list for selected torneo */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Participantes</h2>
                <p className="text-sm text-gray-400 mb-6">{participantesDelTorneo.length} registrados en este torneo</p>

                {participantesDelTorneo.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-16">Aún no hay participantes en este torneo.</p>
                ) : (
                  <ul className="space-y-2">
                    {participantesDelTorneo.map((ins, i) => (
                      <motion.li key={ins.id ?? i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center justify-between px-4 py-3 rounded-2xl bg-gray-50 group">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{ins.jugador}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{ins.equipo} · {ins.liga}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400 bg-white border border-gray-100 px-2 py-1 rounded-xl">#{i + 1}</span>
                          <button onClick={() => openModal(ins)}
                            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-all opacity-0 group-hover:opacity-100">
                            <Pencil size={13} />
                          </button>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {modal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeModal} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
              <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8">
                <div className="flex items-center justify-between mb-7">
                  <h3 className="text-lg font-semibold text-gray-900">Editar registro</h3>
                  <button onClick={closeModal} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-5">
                  <Sel label="Jugador" value={modal.jugador} onChange={v => setModal(m => m && ({ ...m, jugador: v }))}>
                    <option value="">Selecciona un jugador</option>
                    {JUGADORES.map(n => (
                      <option key={n} value={n} disabled={jugadoresRegistradosSinModal.has(n)}>
                        {n}{jugadoresRegistradosSinModal.has(n) ? ' — ya registrado' : ''}
                      </option>
                    ))}
                  </Sel>
                  <Sel label="Liga" value={modal.liga} onChange={v => setModal(m => m && ({ ...m, liga: v, equipo: '' }))}>
                    <option value="">Selecciona una liga</option>
                    {ligas.map(l => <option key={l} value={l}>{l}</option>)}
                  </Sel>
                  <Sel label="Equipo" value={modal.equipo} onChange={v => setModal(m => m && ({ ...m, equipo: v }))} disabled={!modal.liga}>
                    <option value="">Selecciona un equipo</option>
                    {modalEquiposDeLiga.map(eq => (
                      <option key={eq} value={eq} disabled={registradosSinModal.has(eq)}>
                        {eq}{registradosSinModal.has(eq) ? ' — ya registrado' : ''}
                      </option>
                    ))}
                  </Sel>
                </div>
                <div className="flex gap-3 mt-8">
                  <button onClick={handleDelete} disabled={modalLoading !== null}
                    onMouseLeave={() => setConfirmDelete(false)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all disabled:opacity-40 ${
                      confirmDelete ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}>
                    {modalLoading === 'delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {confirmDelete ? '¿Confirmar?' : 'Eliminar'}
                  </button>
                  <button onClick={handleSave} disabled={modalLoading !== null || !modal.jugador || !modal.liga || !modal.equipo}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-2xl hover:bg-gray-700 active:scale-[0.98] transition-all disabled:opacity-40">
                    {modalLoading === 'save' && <Loader2 size={14} className="animate-spin" />}
                    Guardar cambios
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
