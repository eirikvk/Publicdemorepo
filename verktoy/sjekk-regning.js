/* Sjekker at sølv og gull holdes for seg selv. Beregningene skal kunne leses, testes og flyttes til en annen løsning uten å ta
   med seg siden. Derfor gjelder dette for filene i src/solv og src/gull:

   - Sølv importerer bare fra sølv. Gull importerer fra gull og sølv. Begge kan bruke pakken polygon-clipping, men ikke motoren,
     visningen, OpenLayers eller React.
   - De bruker ikke nettleseren (document, window, fetch og lignende) eller sidens tilstand (app). Unntaket er solv/raster.js,
     som tegner flater i et lerret.
   - De har ingen variabler på toppnivå som kan endres (let). Det som gis inn, kommer som argumenter.

   I tillegg sjekkes det at motoren ikke har fått nye regnefunksjoner: funksjoner som heter tolk, kryss, bygg eller tell noe, hører
   hjemme i sølv eller gull.

   Og retningen mellom lagene ellers:
   - Bronse (src/bronse) henter, og bruker ikke gull eller visningen.
   - Visningen (src/visning) henter ikke selv og regner ikke selv: den importerer ikke fra bronse, og fra sølv bare navn og faste
     verdier (navn med store bokstaver, som GRAATRINN), ikke funksjoner. Tallene får den fra gull.

   Kjør: node verktoy/sjekk-regning.js */
import * as acorn from 'acorn';
import jsx from 'acorn-jsx';
import * as walk from 'acorn-walk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src'),
  DATA = path.join(SRC, 'data'),
  MOTOR = path.join(DATA, 'motor');
const PAKKER = ['polygon-clipping'];
/* Lagene som sjekkes, og hvor hvert av dem kan importere fra */
const LAG = {
  solv: ['./'],
  gull: ['./', '../solv/']
};
const NETTLESER = ['document', 'window', 'fetch', 'navigator', 'location', 'history', 'createImageBitmap', 'app'];
const UNNTAK = { 'solv/raster.js': ['document'] };
const REGNENAVN = /^(tolk|kryss|bygg|tell)[A-ZÆØÅ]/;
/* Retningen mellom lagene: hva hvert lag ikke kan importere fra */
const IKKE_FRA = {
  'data/bronse': ['../gull/', '../../ui/'],
  'ui/komponenter': ['../../data/bronse/']
};
const KONSTANT = /^[A-ZÆØÅ][A-ZÆØÅ0-9_]*$/;

const JSX = acorn.Parser.extend(jsx());
const les = fil =>
  (fil.endsWith('.jsx') ? JSX : acorn).parse(fs.readFileSync(fil, 'utf8'), {
    ecmaVersion: 2022,
    sourceType: 'module',
    locations: true
  });
const feil = [];
let antall = 0;

for (const [lag, lovligFra] of Object.entries(LAG)) {
  for (const f of fs.readdirSync(path.join(DATA, lag)).filter(f => f.endsWith('.js'))) {
    const navn = `${lag}/${f}`,
      tre = les(path.join(DATA, lag, f)),
      lov = UNNTAK[navn] || [];
    antall++;
    for (const n of tre.body) {
      if (n.type === 'ImportDeclaration') {
        const fra = n.source.value,
          ok = lovligFra.some(p => fra.startsWith(p) && !fra.slice(p.length).includes('/')) || PAKKER.includes(fra);
        if (!ok) feil.push(`${navn}:${n.loc.start.line} importerer fra ${fra}`);
      }
      const d = n.type === 'ExportNamedDeclaration' && n.declaration ? n.declaration : n;
      if (d.type === 'VariableDeclaration' && d.kind === 'let')
        feil.push(`${navn}:${d.loc.start.line} har en variabel på toppnivå som kan endres (let)`);
    }
    walk.ancestor(tre, {
      Identifier(n, forfedre) {
        const over = forfedre[forfedre.length - 2];
        if (over && over.type === 'MemberExpression' && over.property === n && !over.computed) return; /* x.navn */
        if (over && over.type === 'Property' && over.key === n && !over.computed && over.value !== n)
          return; /* nøkkel */
        if (NETTLESER.includes(n.name) && !lov.includes(n.name))
          feil.push(`${navn}:${n.loc.start.line} bruker ${n.name}, som hører til nettleseren eller siden`);
      }
    });
  }
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
        feil.push(`motor/${f}:${n.loc.start.line} ${x} ser ut som en regnefunksjon og hører hjemme i sølv eller gull`);
      }
  }
}

/* Retningen mellom lagene */
let andre = 0;
for (const [lag, forbudt] of Object.entries(IKKE_FRA)) {
  for (const f of fs.readdirSync(path.join(SRC, lag)).filter(f => /\.jsx?$/.test(f))) {
    const tre = les(path.join(SRC, lag, f));
    andre++;
    for (const n of tre.body) {
      if (n.type !== 'ImportDeclaration') continue;
      const fra = n.source.value,
        sted = `${lag}/${f}:${n.loc.start.line}`;
      if (forbudt.some(p => fra.startsWith(p))) feil.push(`${sted} importerer fra ${fra}`);
      if (lag === 'ui/komponenter' && fra.startsWith('../../data/solv/'))
        for (const x of n.specifiers)
          if (x.type !== 'ImportSpecifier' || !KONSTANT.test(x.imported.name))
            feil.push(`${sted} importerer ${x.local.name} fra sølv: visningen skal få tallene fra gull`);
    }
  }
}

feil.forEach(x => console.log(x));
console.log(
  feil.length
    ? `\n${feil.length} brudd.`
    : `${antall} filer i src/solv og src/gull og ${andre} i src/bronse og src/visning sjekket, og ingen regnefunksjoner i motoren. Ingen brudd.`
);
process.exit(feil.length ? 1 : 0);
