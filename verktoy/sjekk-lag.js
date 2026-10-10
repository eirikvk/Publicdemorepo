/* Sjekker at lagene i koden holdes fra hverandre, slik README beskriver. Hvert lag kan bare importere fra lagene under seg:

   src/data/            alt om dataene, uten React og OpenLayers
     bronse/            henting fra hver kilde. Importerer bare fra bronse og sølv, og bruker ikke tilstanden (app).
     solv/              felles standard. Importerer bare fra sølv.
     gull/              svarene sidene viser. Importerer bare fra gull og sølv.
     motor/             datamotoren: tilstanden, og hva som hentes og regnes når. Importerer fra data, men aldri fra ui/.
   src/ui/              brukergrensesnittet. Importerer fra data, men data importerer aldri herfra.
     komponenter/       React. Henter ikke selv og regner ikke selv: importerer ikke fra bronse, og fra sølv bare navn og faste
                        verdier (navn med store bokstaver, som GRAATRINN). Tallene kommer fra gull.
     kart/              OpenLayers. Bruker ikke React-komponentene.

   For sølv og gull gjelder i tillegg, så beregningene kan leses, testes og flyttes til en annen løsning uten å ta med seg siden:
   - De bruker ikke nettleseren (document, window, fetch og lignende) eller tilstanden (app). Unntaket er solv/raster.js, som tegner
     flater i et lerret.
   - De har ingen variabler på toppnivå som kan endres (let). Det som gis inn, kommer som argumenter.
   Og datamotoren har ingen regnefunksjoner: funksjoner som heter tolk, kryss, bygg eller tell noe, hører hjemme i sølv eller gull.

   Kjør: node verktoy/sjekk-lag.js */
import * as acorn from 'acorn';
import jsx from 'acorn-jsx';
import * as walk from 'acorn-walk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

/* Hvert lag: fra = mappene det kan importere fra (relativt, ett nivå), pakker = pakker det kan bruke, ikkeFra = det det ikke kan
   importere fra, ren = sølv og gull (ingen nettleser, ingen tilstand, ingen let), utenTilstand = bruker ikke app. */
const LAG = {
  'data/bronse': { fra: ['./', '../solv/'], pakker: [], utenTilstand: true },
  'data/solv': { fra: ['./'], pakker: ['polygon-clipping', 'proj4'], ren: true },
  'data/gull': { fra: ['./', '../solv/'], pakker: ['polygon-clipping'], ren: true },
  'data/motor': { fra: ['./', '../bronse/', '../solv/', '../gull/'], pakker: [] },
  ui: { ikkeFra: ['./komponenter/', './kart/'] },
  'ui/komponenter': { ikkeFra: ['../../data/bronse/'], solvBareFasteVerdier: true },
  'ui/kart': { ikkeFra: ['../komponenter/'] }
};
const NETTLESER = ['document', 'window', 'fetch', 'navigator', 'location', 'history', 'createImageBitmap'];
const UNNTAK = { 'data/solv/raster.js': ['document'] };
const REGNENAVN = /^(tolk|kryss|bygg|tell)[A-ZÆØÅ]/;
const FAST_VERDI = /^[A-ZÆØÅ][A-ZÆØÅ0-9_]*$/;

const JSX = acorn.Parser.extend(jsx());
const les = fil =>
  (fil.endsWith('.jsx') ? JSX : acorn).parse(fs.readFileSync(fil, 'utf8'), {
    ecmaVersion: 2022,
    sourceType: 'module',
    locations: true
  });
const feil = [];
let antall = 0;

for (const [lag, regel] of Object.entries(LAG)) {
  for (const f of fs.readdirSync(path.join(SRC, lag)).filter(f => /\.jsx?$/.test(f))) {
    const navn = `${lag}/${f}`,
      tre = les(path.join(SRC, lag, f)),
      lov = UNNTAK[navn] || [];
    antall++;
    for (const n of tre.body) {
      if (n.type === 'ImportDeclaration') {
        const fra = n.source.value,
          sted = `${navn}:${n.loc.start.line}`;
        if (regel.fra) {
          const ok =
            regel.fra.some(p => fra.startsWith(p) && !fra.slice(p.length).includes('/')) || regel.pakker.includes(fra);
          if (!ok) feil.push(`${sted} importerer fra ${fra}`);
        }
        if (regel.ikkeFra && regel.ikkeFra.some(p => fra.startsWith(p))) feil.push(`${sted} importerer fra ${fra}`);
        if (regel.solvBareFasteVerdier && fra.startsWith('../../data/solv/'))
          for (const x of n.specifiers)
            if (x.type !== 'ImportSpecifier' || !FAST_VERDI.test(x.imported.name))
              feil.push(`${sted} importerer ${x.local.name} fra sølv: komponentene skal få tallene fra gull`);
      }
      const d = n.type === 'ExportNamedDeclaration' && n.declaration ? n.declaration : n;
      if (regel.ren && d.type === 'VariableDeclaration' && d.kind === 'let')
        feil.push(`${navn}:${d.loc.start.line} har en variabel på toppnivå som kan endres (let)`);
      if (lag === 'data/motor') {
        const navnene =
          d.type === 'FunctionDeclaration'
            ? [d.id.name]
            : d.type === 'VariableDeclaration'
              ? d.declarations.filter(x => x.id.type === 'Identifier').map(x => x.id.name)
              : [];
        for (const x of navnene)
          if (REGNENAVN.test(x))
            feil.push(`${navn}:${d.loc.start.line} ${x} ser ut som en regnefunksjon og hører hjemme i sølv eller gull`);
      }
    }
    if (regel.ren || regel.utenTilstand)
      walk.ancestor(tre, {
        Identifier(n, forfedre) {
          const over = forfedre[forfedre.length - 2];
          if (over && over.type === 'MemberExpression' && over.property === n && !over.computed) return; /* x.navn */
          if (over && over.type === 'Property' && over.key === n && !over.computed && over.value !== n)
            return; /* nøkkel */
          if (n.name === 'app') feil.push(`${navn}:${n.loc.start.line} bruker tilstanden (app)`);
          else if (regel.ren && NETTLESER.includes(n.name) && !lov.includes(n.name))
            feil.push(`${navn}:${n.loc.start.line} bruker ${n.name}, som hører til nettleseren`);
        }
      });
  }
}

feil.forEach(x => console.log(x));
console.log(
  feil.length ? `\n${feil.length} brudd.` : `${antall} filer i ${Object.keys(LAG).length} lag sjekket. Ingen brudd.`
);
process.exit(feil.length ? 1 : 0);
