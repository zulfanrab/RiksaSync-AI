import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const convertApiSecret = 
    process.env.VITE_CONVERTAPI_SECRET || 
    process.env.CONVERTAPI_SECRET || 
    env.VITE_CONVERTAPI_SECRET || 
    env.CONVERTAPI_SECRET || 
    'qEjYBMPnr5Heup6mpL6Q4wjLa43J6BZb';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_CONVERTAPI_SECRET': JSON.stringify(convertApiSecret),
      'import.meta.env.CONVERTAPI_SECRET': JSON.stringify(convertApiSecret),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
