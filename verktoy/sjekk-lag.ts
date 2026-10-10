/* Sjekker at lagene i koden holdes fra hverandre, slik README beskriver. Hvert lag kan bare importere fra lagene under seg:

   src/data/            alt om dataene, uten React og OpenLayers
     generelt/          det som ikke handler om noe bestemt: geometri, minne, tall og farger. Importerer ingenting, og alle lagene
                        i data kan bruke det.
     bronse/            henting fra hver kilde. Importerer bare fra bronse, sølv og generelt, og bruker ikke tilstanden (app).
     solv/              felles standard. Importerer bare fra sølv og generelt.
     gull/              svarene sidene viser. Importerer bare fra gull, sølv og generelt.
     motor/             datamotoren: tilstanden, og hva som hentes og regnes når. Importerer fra data, men aldri fra ui/.
   src/ui/              brukergrensesnittet. Importerer fra data, men data importerer aldri herfra.
     komponenter/       React. Henter ikke selv og regner ikke selv: importerer ikke fra bronse, og fra sølv bare navn, faste
                        verdier (navn med store bokstaver, som GRAATRINN) og typer. Tallene kommer fra gull.
     kart/              OpenLayers. Bruker ikke React-komponentene.

   For generelt, sølv og gull gjelder i tillegg, så beregningene kan leses, testes og flyttes til en annen løsning uten å ta med seg siden:
   - De bruker ikke nettleseren (document, window, fetch og lignende) eller tilstanden (app). Unntaket er solv/raster.ts, som tegner
     flater og leser bilder i et lerret.
   - De har ingen variabler på toppnivå som kan endres (let). Det som gis inn, kommer som argumenter.
   Og datamotoren har ingen regnefunksjoner: funksjoner som heter tolk, kryss, bygg eller tell noe, hører hjemme i sølv eller gull.
   Alt datapipelinen husker, ligger i katalogen (data/motor/katalog.ts). Ingen andre filer i data har minne på toppnivå (new Map,
   WeakMap, Set eller WeakSet). Unntaket er listen over hvem som abonnerer, i data/motor/tilstand.ts. Kartet kan ha sitt eget minne
   for det som tegnes.

   Typene sjekkes av TypeScript (tsc). Denne sjekken ser bare på hvem som importerer fra hvem, og på reglene over. Koden leses med
   oxc-parser, som kan lese TypeScript og JSX.

   Kjør: node verktoy/sjekk-lag.ts */
import { parseSync } from 'oxc-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

/* Reglene for et lag. fra: mappene det kan importere fra (relativt, ett nivå), med pakkene det kan bruke. ikkeFra: det det ikke kan
   importere fra. ren: sølv og gull (ingen nettleser, ingen tilstand, ingen let). utenTilstand: bruker ikke app. */
interface Regel {
  fra?: string[];
  pakker?: string[];
  ikkeFra?: string[];
  ren?: boolean;
  utenTilstand?: boolean;
  solvBareFasteVerdier?: boolean;
}
const LAG: Record<string, Regel> = {
  'data/generelt': { fra: ['./'], pakker: [], ren: true },
  'data/bronse': { fra: ['./', '../generelt/', '../solv/'], pakker: [], utenTilstand: true },
  'data/solv': { fra: ['./', '../generelt/'], pakker: ['polygon-clipping', 'proj4'], ren: true },
  'data/gull': { fra: ['./', '../generelt/', '../solv/'], pakker: ['polygon-clipping'], ren: true },
  'data/motor': { fra: ['./', '../generelt/', '../bronse/', '../solv/', '../gull/'], pakker: [] },
  ui: { ikkeFra: ['./komponenter/', './kart/'] },
  'ui/komponenter': { ikkeFra: ['../../data/bronse/'], solvBareFasteVerdier: true },
  'ui/kart': { ikkeFra: ['../komponenter/'] }
};
const NETTLESER = ['document', 'window', 'fetch', 'navigator', 'location', 'history', 'createImageBitmap'];
const UNNTAK: Record<string, string[]> = {
  'data/solv/raster': ['document', 'createImageBitmap']
}; /* fil uten endelse */
const REGNENAVN = /^(tolk|kryss|bygg|tell)[A-ZÆØÅ]/;
const MINNE = ['Map', 'WeakMap', 'Set', 'WeakSet'],
  MINNE_LOV = ['data/motor/katalog', 'data/motor/tilstand']; /* fil uten endelse */
const FAST_VERDI = /^[A-ZÆØÅ][A-ZÆØÅ0-9_]*$/;

/* En node i syntakstreet, slik oxc-parser gir den (ESTree, med TypeScript i tillegg) */
type Node = { type: string; start: number; [felt: string]: any };
const erNode = (x: unknown): x is Node => !!x && typeof x === 'object' && typeof (x as Node).type === 'string';
/* Går gjennom alle nodene, og gir hver node med noden over */
function gaaGjennom(n: Node, f: (n: Node, over: Node | null) => void, over: Node | null = null) {
  f(n, over);
  for (const [felt, v] of Object.entries(n)) {
    if (felt === 'parent') continue;
    if (Array.isArray(v)) v.forEach(x => erNode(x) && gaaGjennom(x, f, n));
    else if (erNode(v)) gaaGjennom(v, f, n);
  }
}

const feil: string[] = [];
let antall = 0;

for (const [lag, regel] of Object.entries(LAG)) {
  for (const f of fs.readdirSync(path.join(SRC, lag)).filter(f => /\.[jt]sx?$/.test(f))) {
    const navn = `${lag}/${f}`,
      kode = fs.readFileSync(path.join(SRC, lag, f), 'utf8'),
      { program, errors } = parseSync(f, kode),
      lov = UNNTAK[navn.replace(/\.[jt]sx?$/, '')] || [];
    const linje = (n: Node) => kode.slice(0, n.start).split('\n').length;
    antall++;
    if (errors.length) feil.push(`${navn} kunne ikke leses: ${errors[0].message}`);
    for (const n of program.body as Node[]) {
      if (n.type === 'ImportDeclaration') {
        const fra: string = n.source.value,
          sted = `${navn}:${linje(n)}`,
          bareTyper = n.importKind === 'type';
        if (regel.fra) {
          const ok =
            regel.fra.some(p => fra.startsWith(p) && !fra.slice(p.length).includes('/')) ||
            (regel.pakker || []).includes(fra);
          if (!ok) feil.push(`${sted} importerer fra ${fra}`);
        }
        if (regel.ikkeFra && regel.ikkeFra.some(p => fra.startsWith(p))) feil.push(`${sted} importerer fra ${fra}`);
        if (regel.solvBareFasteVerdier && fra.startsWith('../../data/solv/') && !bareTyper)
          for (const x of n.specifiers as Node[])
            if (x.importKind !== 'type' && (x.type !== 'ImportSpecifier' || !FAST_VERDI.test(x.imported.name)))
              feil.push(`${sted} importerer ${x.local.name} fra sølv: komponentene skal få tallene fra gull`);
      }
      const d: Node = n.type === 'ExportNamedDeclaration' && n.declaration ? n.declaration : n;
      if (regel.ren && d.type === 'VariableDeclaration' && d.kind === 'let')
        feil.push(`${navn}:${linje(d)} har en variabel på toppnivå som kan endres (let)`);
      if (
        lag.startsWith('data/') &&
        !MINNE_LOV.includes(navn.replace(/\.[jt]sx?$/, '')) &&
        d.type === 'VariableDeclaration'
      )
        for (const x of d.declarations as Node[])
          if (x.init && x.init.type === 'NewExpression' && MINNE.includes(x.init.callee.name))
            feil.push(
              `${navn}:${linje(d)} har minne på toppnivå (new ${x.init.callee.name}): det hører hjemme i katalogen (data/motor/katalog.ts)`
            );
      if (lag === 'data/motor') {
        const navnene: string[] =
          d.type === 'FunctionDeclaration'
            ? [d.id.name]
            : d.type === 'VariableDeclaration'
              ? (d.declarations as Node[]).filter(x => x.id.type === 'Identifier').map(x => x.id.name)
              : [];
        for (const x of navnene)
          if (REGNENAVN.test(x))
            feil.push(`${navn}:${linje(d)} ${x} ser ut som en regnefunksjon og hører hjemme i sølv eller gull`);
      }
    }
    if (regel.ren || regel.utenTilstand)
      gaaGjennom(program as unknown as Node, (n, over) => {
        if (n.type !== 'Identifier') return;
        if (over && over.type === 'MemberExpression' && over.property === n && !over.computed) return; /* x.navn */
        if (over && over.type === 'Property' && over.key === n && !over.computed && over.value !== n)
          return; /* nøkkel */
        if (over && over.type.startsWith('TS')) return; /* navn i en type */
        if (n.name === 'app') feil.push(`${navn}:${linje(n)} bruker tilstanden (app)`);
        else if (regel.ren && NETTLESER.includes(n.name) && !lov.includes(n.name))
          feil.push(`${navn}:${linje(n)} bruker ${n.name}, som hører til nettleseren`);
      });
  }
}

feil.forEach(x => console.log(x));
console.log(
  feil.length ? `\n${feil.length} brudd.` : `${antall} filer i ${Object.keys(LAG).length} lag sjekket. Ingen brudd.`
);
process.exit(feil.length ? 1 : 0);
