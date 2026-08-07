export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://pufzodrhbagyyohzgbxq.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZnpvZHJoYmFneXlvaHpnYnhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMjg0MzEsImV4cCI6MjEwMTcwNDQzMX0.DrUmPr8_jWiEINJ_hQq4FXWES5RGj1xBV_lKc32RGMc';

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 720;
export const PLAYER_SPEED = 320;
export const PLAYER_RADIUS = 14;
export const PROJECTILE_SPEED = 520;
export const PROJECTILE_RADIUS = 4;
export const ENEMY_BASE_SPEED = 80;
export const INITIAL_LIVES = 3;
export const FIRE_COOLDOWN_MS = 180;
export const MAX_NAME_LENGTH = 16;
export const MIN_NAME_LENGTH = 1;
export const NAME_PATTERN = /^[A-Za-z0-9 _.-]+$/;
