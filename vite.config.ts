/* Bygget: React med Vite. Adressene i det ferdige bygget er relative, så siden virker fra hvilken som helst mappe på en vanlig
   webserver, for eksempel GitHub Pages under /Publicdemorepo/. Alt som trengs, havner i dist/. */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    /* Designsystemets komponenter er CommonJS og henter Ariakit med require. Da brukes Ariakits CommonJS-utgave, og den har en
       hjelper for require som byggeverktøyet gjør om til en uendelig løkke («Maximum call stack size exceeded»). Ariakits
       ES-utgave har ikke hjelperen, så den brukes i stedet. */
    alias: [
      {
        find: /^@ariakit\/react$/,
        replacement: fileURLToPath(new URL('./node_modules/@ariakit/react/esm/index.js', import.meta.url))
      }
    ]
  },
  /* Kartbiblioteket, React og designsystemet gir ett skript på rundt 330 kB pakket. Det er omtrent som før, da de ble hentet hver for seg. */
  build: { outDir: 'dist', sourcemap: true, chunkSizeWarningLimit: 1200 }
});
