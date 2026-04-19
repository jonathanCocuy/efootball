import { createClient } from '@supabase/supabase-js';

async function fetchSchema() {
  const url = 'https://fzqyihywfepmjzlhjase.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6cXlpaHl3ZmVwbWp6bGhqYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjIwODYsImV4cCI6MjA5MjE5ODA4Nn0.vx96Ve1tb1Vj8Sc8IIbE5HEAyQ_Bo_M0zsDWTXxqu-Q';
  const res = await fetch(url, { headers: { 'Accept': 'application/openapi+json' } });
  const data = await res.json();
  console.log(JSON.stringify(data.definitions, null, 2));
}

fetchSchema();
