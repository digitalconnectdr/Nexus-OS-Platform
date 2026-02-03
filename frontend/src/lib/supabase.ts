import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hjjhqguwhcqtaxdhbdsx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqamhxZ3V3aGNxdGF4ZGhiZHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMjE1MzgsImV4cCI6MjA4MTg5NzUzOH0.687C8rKQRI2v6es9Wez5aw48CI_Vd3nq1lrRo7H8ywU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
