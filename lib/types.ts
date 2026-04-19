export interface Inscripcion {
  id?: string;
  torneo_id?: string;
  jugador: string;
  equipo: string;
  liga: string;
}

export interface Partido {
  id?: string;
  torneo_id?: string;
  tipo: 'eliminacion' | 'grupos';
  fase: string;
  ronda?: 'ida' | 'vuelta' | 'unico';
  equipoLocal: string;
  equipoVisitante: string;
  golesLocal?: number | null;
  golesVisitante?: number | null;
  penalesLocal?: number | null;
  penalesVisitante?: number | null;
  completado: boolean;
}

export interface Torneo {
  id: string;
  nombre: string;
  tipo: 'eliminacion' | 'grupos';
  created_at: string;
}

export interface Catalogo {
  ligas?: string[];
  equipos?: Record<string, string[]>;
}
