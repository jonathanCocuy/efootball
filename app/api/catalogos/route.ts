import { NextResponse } from 'next/server';

const EQUIPOS: Record<string, string[]> = {
  'Selecciones': [
    'Brasil', 'Argentina', 'Francia', 'Inglaterra', 'España', 'Portugal',
    'Alemania', 'Países Bajos', 'Bélgica', 'Italia', 'Uruguay', 'Colombia',
    'Croacia', 'Marruecos', 'Japón', 'Estados Unidos',
  ],
  'Premier League': ['Manchester City', 'Arsenal', 'Liverpool', 'Chelsea', 'Tottenham', 'Man United', 'Newcastle', 'Aston Villa'],
  'LaLiga': ['Real Madrid', 'Barcelona', 'Atlético Madrid', 'Sevilla', 'Valencia', 'Athletic Club', 'Real Betis', 'Villarreal'],
  'Serie A': ['Juventus', 'Inter Milan', 'AC Milan', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 'Fiorentina'],
  'Bundesliga': ['Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen', 'Wolfsburg', 'Gladbach', 'Union Berlin', 'Stuttgart'],
  'Ligue 1': ['PSG', 'Marseille', 'Lyon', 'Monaco', 'Rennes', 'Lille', 'Nice', 'Lens'],
  'Liga Portugal': ['Porto', 'Benfica', 'Sporting CP', 'Braga', 'Vitória SC', 'Famalicão'],
};

export async function GET() {
  return NextResponse.json({
    ligas: Object.keys(EQUIPOS),
    equipos: EQUIPOS,
  });
}
