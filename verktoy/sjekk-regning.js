/* Sjekker at beregningene holdes for seg selv i src/analyse. Analysene skal kunne leses, testes og flyttes til en annen løsning uten
   å ta med seg siden. Derfor gjelder dette for filene i src/analyse:

   - De importerer bare fra hverandre og fra pakken polygon-clipping. Ikke fra motoren, visningen, OpenLayers eller React.
   - De bruker ikke nettleseren (document, window, fetch og lignende) eller sidens tilstand (app). Unntaket er raster.js, som
     tegner flater i et lerret.
   - De har ingen variabler på toppnivå som kan endres (let). Det som gis inn, kommer som argumenter.

   I tillegg sjekkes det at motoren ikke har fått nye regnefunksjoner: funksjoner som heter tolk, kryss, bygg eller tell noe, hører
   hjemme i src/analyse.

   Kjør: node verktoy/sjekk-regning.js */
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src'),
  ANALYSE = path.join(SRC, 'analyse'),
  MOTOR = path.join(SRC, 'motor');
const PAKKER = ['polygon-clipping'];
const NETTLESER = ['document', 'window', 'fetch', 'navigator', 'location', 'history', 'createImageBitmap', 'app'];
const UNNTAK = { 'raster.js': ['document'] };
const REGNENAVN = /^(tolk|kryss|bygg|tell)[A-ZÆØÅ]/;

const les = fil =>
  acorn.parse(fs.readFileSync(fil, 'utf8'), { ecmaVersion: 2022, sourceType: 'module', locations: true });
const feil = [];

/* Filene i src/analyse */
const analyser = fs.readdirSync(ANALYSE).filter(f => f.endsWith('.js'));
for (const f of analyser) {
  const tre = les(path.join(ANALYSE, f)),
    lov = UNNTAK[f] || [];
  for (const n of tre.body) {
    if (n.type === 'ImportDeclaration') {
      const fra = n.source.value;
      if (!(fra.startsWith('./') && !fra.includes('/', 2)) && !PAKKER.includes(fra))
        feil.push(`${f}:${n.loc.start.line} importerer fra ${fra}`);
    }
    const d = n.type === 'ExportNamedDeclaration' && n.declaration ? n.declaration : n;
    if (d.type === 'VariableDeclaration' && d.kind === 'let')
      feil.push(`${f}:${d.loc.start.line} har en variabel på toppnivå som kan endres (let)`);
  }
  walk.ancestor(tre, {
    Identifier(n, forfedre) {
      const over = forfedre[forfedre.length - 2];
      if (over && over.type === 'MemberExpression' && over.property === n && !over.computed) return; /* x.navn */
      if (over && over.type === 'Property' && over.key === n && !over.computed && over.value !== n) return; /* nøkkel */
      if (NETTLESER.includes(n.name) && !lov.includes(n.name))
        feil.push(`${f}:${n.loc.start.line} bruker ${n.name}, som hører til nettleseren eller siden`);
    }
  });
}

/* Regnefunksjoner som er havnet i motoren */
for (const f of fs.readdirSync(MOTOR).filter(f => f.endsWith('.js'))) {
  const tre = les(path.join(MOTOR, f));
  for (const m of tre.body) {
    const n = m.type === 'ExportNamedDeclaration' && m.declaration ? m.declaration : m;
    const navn =
      n.type === 'FunctionDeclaration'
        ? [n.id.name]
        : n.type === 'VariableDeclaration'
          ? n.declarations.filter(d => d.id.type === 'Identifier').map(d => d.id.name)
          : [];
    for (const x of navn)
      if (REGNENAVN.test(x)) {
        feil.push(`motor/${f}:${n.loc.start.line} ${x} ser ut som en regnefunksjon og hører hjemme i src/analyse`);
      }
  }
}

feil.forEach(x => console.log(x));
console.log(
  feil.length
    ? `\n${feil.length} brudd.`
    : `${analyser.length} filer i src/analyse sjekket, og ingen regnefunksjoner i motoren. Ingen brudd.`
);
process.exit(feil.length ? 1 : 0);
