import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fzqyihywfepmjzlhjase.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6cXlpaHl3ZmVwbWp6bGhqYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjIwODYsImV4cCI6MjA5MjE5ODA4Nn0.vx96Ve1tb1Vj8Sc8IIbE5HEAyQ_Bo_M0zsDWTXxqu-Q'
);

async function test() {
  const p = await supabase.from('partidos').select('*').limit(1);
  console.log('Partidos Error:', p.error);

  const i = await supabase.from('inscripciones').select('*').limit(1);
  console.log('Inscripciones Error:', i.error);
}

test();
