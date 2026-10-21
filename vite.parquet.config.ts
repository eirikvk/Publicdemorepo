/* Bygget for testsiden som spør i en GeoParquet-fil på nettet uten å laste den ned (verneområdene). Kildekoden ligger i
   srcParquet/, og bygget havner i dist/parquet/, så siden ligger på …/parquet/ ved siden av hovedsiden. Hovedsiden bygges først
   (vite.config.ts), og dette bygget tømmer bare dist/parquet/. Kommunelisten (kommuner.json) ligger én mappe opp. */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL('./srcParquet', import.meta.url)),
  base: './',
  /* Under utvikling (npm run dev-parquet) serveres kommunelisten fra public/. I bygget ligger den alt i dist/. */
  publicDir: command === 'serve' ? fileURLToPath(new URL('./public', import.meta.url)) : false,
  plugins: [react()],
  resolve: {
    /* Det samme som i vite.config.ts: Ariakits ES-utgave, så designsystemets komponenter kan bygges */
    alias: [
      {
        find: /^@ariakit\/react$/,
        replacement: fileURLToPath(new URL('./node_modules/@ariakit/react/esm/index.js', import.meta.url))
      }
    ]
  },
  build: {
    outDir: fileURLToPath(new URL('./dist/parquet', import.meta.url)),
    emptyOutDir: true,
    sourcemap: true
  }
}));
