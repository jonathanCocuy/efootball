import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fzqyihywfepmjzlhjase.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6cXlpaHl3ZmVwbWp6bGhqYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjIwODYsImV4cCI6MjA5MjE5ODA4Nn0.vx96Ve1tb1Vj8Sc8IIbE5HEAyQ_Bo_M0zsDWTXxqu-Q'
);

async function test() {
  const { data, error } = await supabase.from('inscripciones').insert({
    jugador: 'Test',
    equipo: 'Test',
    liga: 'Test',
    torneo_id: null
  }).select().single();
  
  console.log('Inscripcion Error:', error);

  if (!error && data) {
    await supabase.from('inscripciones').delete().eq('id', data.id);
  }
}

test();
