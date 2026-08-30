import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jfrlqjgrmhzghdvgmnop.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmxxamdybWh6Z2hkdmdtbm9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0Njk4NzksImV4cCI6MjA5MzA0NTg3OX0.7mefNvdzV0Wzx2ShCNXu8kvQCc-w5ofG7npjSVvUXrU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const sql = `
    ALTER TABLE tenants 
    ADD COLUMN IF NOT EXISTS facebook_pixel_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS google_tag_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS marketing_enabled BOOLEAN DEFAULT false;
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
     console.log("No exec_sql RPC, I need to do it another way or it ran?", error);
  } else {
     console.log("Migration successful", data);
  }
}
run();
