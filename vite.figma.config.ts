/* Bygget for tvillingen fra Figma: en egen side med utseendet fra Figma-skissene, som bruker den samme datamotoren som hovedsiden.
   Kildekoden ligger i srcFigma/, og bygget havner i dist/figma/, så siden ligger på …/figma/ ved siden av hovedsiden. Hovedsiden
   bygges først (vite.config.ts), og dette bygget tømmer bare dist/figma/. Sidens egne filer (kommuner.json og klasser/) ligger én
   mappe opp, se <meta name="egne-filer"> i srcFigma/index.html. */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL('./srcFigma', import.meta.url)),
  base: './',
  /* Under utvikling (npm run dev-figma) serveres sidens egne filer fra public/. I bygget ligger de alt i dist/. */
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
    outDir: fileURLToPath(new URL('./dist/figma', import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1200
  }
}));
