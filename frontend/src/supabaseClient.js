// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xannvtaftdznfmloluld.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhbm52dGFmdGR6bmZtbG9sdWxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTIwOTA4MzYsImV4cCI6MjAyNzY2NjgzNn0.9HlHiP9DnTqhi2nOCpW9uSj4CvteWNHxYzIR2lw-ASE';
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
