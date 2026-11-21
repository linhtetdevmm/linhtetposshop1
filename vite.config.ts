import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

function cleanEnvValue(value: string | undefined): string {
  const trimmed = (value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isValidHttpUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafePublicSupabaseKey(key: string): boolean {
  const trimmed = cleanEnvValue(key);
  if (!trimmed) return false;
  if (trimmed.startsWith('sb_secret_')) return false;
  // Reject JWT keys whose payload role is service_role
  const parts = trimmed.split('.');
  if (parts.length === 3) {
    try {
      const json = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
        role?: string;
      };
      if (json.role && json.role !== 'anon') return false;
    } catch {
      // Non-JWT publishable key formats (e.g. sb_publishable_*) are allowed
    }
  }
  return true;
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const urlCandidates = [
    env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
    env.SUPABASE_URL,
    process.env.SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ].map(cleanEnvValue);

  const publicSupabaseUrl = urlCandidates.find(isValidHttpUrl) || '';

  const keyCandidates = [
    env.VITE_SUPABASE_ANON_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_ANON_KEY,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ].map(cleanEnvValue);

  const publicSupabaseAnonKey = keyCandidates.find(isSafePublicSupabaseKey) || '';

  return {
    define: {
      __SHWEPOS_SUPABASE_URL__: JSON.stringify(publicSupabaseUrl),
      __SHWEPOS_SUPABASE_ANON_KEY__: JSON.stringify(publicSupabaseAnonKey),
    },
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
