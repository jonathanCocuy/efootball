'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Trophy, BarChart3 } from 'lucide-react';
import Formulario from './components/Formulario';
import Fixture from './components/Fixture';
import Stats from './components/Stats';

const TABS = [
  { id: 'torneo', label: 'Torneo', Icon: Trophy },
  { id: 'inscripcion', label: 'Regístrate', Icon: Users },
  { id: 'estadisticas', label: 'Estadísticas', Icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('torneo');

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-5 py-14">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">eFootball 2026</h1>
          <p className="text-gray-400 mt-2 text-base">Plataforma de gestión de torneos</p>
        </div>

        {/* Tab Bar */}
        <div className="flex justify-center mb-10">
          <nav className="inline-flex bg-white border border-gray-100 shadow-sm p-1 rounded-2xl gap-1">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === id ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {activeTab === id && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-0 bg-gray-100 rounded-xl"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <Icon size={15} className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'inscripcion' && <Formulario />}
            {activeTab === 'torneo' && <Fixture />}
            {activeTab === 'estadisticas' && <Stats />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
