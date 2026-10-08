/* Sjekker navnene i kildekoden: at hvert navn en fil bruker, er definert i filen, importert, eller finnes i nettleseren. Byggeverktøyet
   fanger import av navn som ikke finnes, men ikke et navn som verken er definert eller importert. Det oppdages ellers først når
   koden kjører, for eksempel etter en skrivefeil eller når en funksjon er flyttet til en annen fil uten å bli importert.
   Kjør: node verktoy/sjekk-navn.js */
import * as acorn from 'acorn';
import jsx from 'acorn-jsx';
import { analyze } from 'eslint-scope';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  SRC = path.join(ROT, 'src');
const leser = acorn.Parser.extend(jsx());
/* Det nettleseren gir. Språkets egne navn (Math, Map, Promise og så videre) hentes fra Node. */
const NETTLESER = new Set([
  'window',
  'document',
  'location',
  'history',
  'performance',
  'fetch',
  'URL',
  'URLSearchParams',
  'Blob',
  'Image',
  'createImageBitmap',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'matchMedia',
  'ResizeObserver'
]);
const filer = [];
const finn = m => {
  for (const f of fs.readdirSync(m, { withFileTypes: true })) {
    const p = path.join(m, f.name);
    if (f.isDirectory()) finn(p);
    else if (/\.jsx?$/.test(f.name)) filer.push(p);
  }
};
finn(SRC);
let feil = 0;
for (const fil of filer) {
  const kode = fs.readFileSync(fil, 'utf8'),
    tre = leser.parse(kode, { ecmaVersion: 'latest', sourceType: 'module', ranges: true, locations: true });
  const sm = analyze(tre, { ecmaVersion: 2022, sourceType: 'module', fallback: 'iteration' });
  const meldt = new Set();
  for (const r of sm.globalScope.through) {
    const n = r.identifier.name;
    if (NETTLESER.has(n) || n in globalThis || meldt.has(n)) continue;
    meldt.add(n);
    feil++;
    console.log(
      `${path.relative(ROT, fil)}:${r.identifier.loc.start.line} bruker ${n}, som verken er definert eller importert`
    );
  }
  /* Komponenter i JSX (<Navn />) er ikke vanlige referanser for analysen, så de sjekkes for seg. */
  const kjente = new Set(sm.scopes.flatMap(s => s.variables.map(v => v.name))),
    komponenter = [];
  const gaa = n => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'JSXOpeningElement' && n.name.type === 'JSXIdentifier' && /^[A-Z]/.test(n.name.name))
      komponenter.push(n.name);
    for (const k in n) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(gaa);
      else if (v && typeof v === 'object' && k !== 'loc') gaa(v);
    }
  };
  gaa(tre);
  for (const k of komponenter)
    if (!kjente.has(k.name) && !meldt.has(k.name)) {
      meldt.add(k.name);
      feil++;
      console.log(
        `${path.relative(ROT, fil)}:${k.loc.start.line} bruker komponenten ${k.name}, som verken er definert eller importert`
      );
    }
}
console.log(feil ? `\n${feil} feil.` : `${filer.length} filer sjekket, ingen feil.`);
process.exit(feil ? 1 : 0);
