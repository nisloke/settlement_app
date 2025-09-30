import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wddhklvlkmgsspfqdqfx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZGhrbHZsa21nc3NwZnFkcWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMzUwMzcsImV4cCI6MjA3NDgxMTAzN30.EYHFfh6AUw0PEpf2n4nl_S9S141QK1QjObDrko4Cw60';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
