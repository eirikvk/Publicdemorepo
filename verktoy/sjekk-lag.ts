/* Sjekker at lagene i koden holdes fra hverandre, slik README beskriver. Hvert lag kan bare importere fra lagene under seg:

   src/data/            alt om dataene, uten React og OpenLayers
     katalog.ts         katalogen: listen over ETL-funksjonene i bronse, sølv og gull, som tabeller
     cache.ts           cachen: svarene fra ETL-funksjonene. Importerer ingenting.
     generelt/          det som ikke handler om noe bestemt: geometri, tall, farger og PNG. Importerer ingenting, og alle lagene i
                        data kan bruke det.
     bronse/            henting fra hver kilde. Importerer bare fra bronse, sølv, generelt og katalogen, og bruker ikke tilstanden
                        (app).
     solv/              felles standard. Importerer bare fra sølv, generelt og katalogen.
     gull/              svarene sidene viser. Importerer bare fra gull, sølv, generelt og katalogen.
     motor/             datamotoren: tilstanden, og hva som hentes og regnes når. Importerer fra data, men aldri fra ui/.
   src/ui/              brukergrensesnittet. Importerer fra data, men data importerer aldri herfra.
     komponenter/       React. Henter ikke selv og regner ikke selv: importerer ikke fra bronse, og fra sølv bare navn, faste
                        verdier (navn med store bokstaver, som GRAATRINN) og typer. Tallene kommer fra gull.
     kart/              OpenLayers. Bruker ikke React-komponentene.

   For generelt, sølv og gull gjelder i tillegg, så beregningene kan leses, testes og flyttes til en annen løsning uten å ta med seg siden:
   - De bruker ikke nettleseren (document, window, fetch og lignende) eller tilstanden (app). Unntakene er solv/raster.ts, som tegner
     flater og leser bilder i et lerret, og bakgrunnstråden (solv/arbeid.ts og solv/arbeider.ts).
   - De har ingen variabler på toppnivå som kan endres (let). Det som gis inn, kommer som argumenter.
   Og datamotoren har ingen regnefunksjoner: funksjoner som heter tolk, kryss, bygg eller tell noe, hører hjemme i sølv eller gull.
   Alt datapipelinen husker, ligger i cachen (data/cache.ts). Ingen andre filer i data har minne på toppnivå (new Map, WeakMap, Set
   eller WeakSet). Unntakene er listen over hvem som abonnerer, i data/motor/tilstand.ts, og tegneflatene som brukes om igjen, i
   data/solv/raster.ts: lerreter, ikke data. Kartet kan ha sitt eget minne
   for det som tegnes.

   Tvillingen fra Figma, i srcFigma/ (se vite.figma.config.ts), er en egen side som bruker den samme datamotoren. Den kan importere
   fra src/, men src/ importerer aldri fra srcFigma/. Fra src/ kan den bruke datamotoren (src/data, men ikke bronse: den henter ikke
   selv), kartet (src/ui/kart) og noen små fellesfiler (FIGMA_LOV). Hovedsidens sider og adresse (src/ui/sider.ts) bruker den ikke.

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
  filer?: string[] /* enkeltfiler laget også kan importere fra */;
  pakker?: string[];
  ikkeFra?: string[];
  ren?: boolean;
  utenTilstand?: boolean;
  solvBareFasteVerdier?: boolean;
}
const KATALOGEN = ['../katalog.ts'];
const LAG: Record<string, Regel> = {
  data: { fra: ['./', './generelt/', './bronse/', './solv/', './gull/'], pakker: [], utenTilstand: true },
  'data/generelt': { fra: ['./'], pakker: [], ren: true },
  'data/bronse': { fra: ['./', '../generelt/', '../solv/'], filer: KATALOGEN, pakker: [], utenTilstand: true },
  'data/solv': { fra: ['./', '../generelt/'], filer: KATALOGEN, pakker: ['polygon-clipping', 'proj4'], ren: true },
  'data/gull': { fra: ['./', '../generelt/', '../solv/'], filer: KATALOGEN, pakker: ['polygon-clipping'], ren: true },
  'data/motor': {
    fra: ['./', '../generelt/', '../bronse/', '../solv/', '../gull/'],
    filer: ['../katalog.ts', '../cache.ts'],
    pakker: []
  },
  ui: { ikkeFra: ['./komponenter/', './kart/'] },
  'ui/komponenter': { ikkeFra: ['../../data/bronse/'], solvBareFasteVerdier: true },
  'ui/kart': { ikkeFra: ['../komponenter/'] }
};
const NETTLESER = ['document', 'window', 'fetch', 'navigator', 'location', 'history', 'createImageBitmap'];
const UNNTAK: Record<string, string[]> = {
  'data/solv/raster': ['document', 'createImageBitmap'],
  'data/solv/arbeid': ['navigator'] /* hvor mange bakgrunnstråder nettleseren har plass til */
}; /* fil uten endelse */
const REGNENAVN = /^(tolk|kryss|bygg|tell)[A-ZÆØÅ]/;
const MINNE = ['Map', 'WeakMap', 'Set', 'WeakSet'],
  MINNE_LOV = ['data/cache', 'data/motor/tilstand', 'data/solv/raster']; /* fil uten endelse */
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
            (regel.filer || []).includes(fra) ||
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
        lag.startsWith('data') &&
        !MINNE_LOV.includes(navn.replace(/\.[jt]sx?$/, '')) &&
        d.type === 'VariableDeclaration'
      )
        for (const x of d.declarations as Node[])
          if (x.init && x.init.type === 'NewExpression' && MINNE.includes(x.init.callee.name))
            feil.push(
              `${navn}:${linje(d)} har minne på toppnivå (new ${x.init.callee.name}): det hører hjemme i cachen (data/cache.ts)`
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

/* Tvillingen fra Figma: srcFigma/ kan bruke det i FIGMA_LOV fra src/, men src/ bruker aldri srcFigma/. Tvillingen er bare
   brukergrensesnitt: tallene leses ferdige fra gull. Den kan derfor bare bruke typer fra gull og ikke regnehjelperne i
   data/generelt/, og fra bronse i katalogen bare kartbildene (tabeller som slutter på «flis»), slik kartet i hovedsiden gjør. */
const ROT = path.resolve(SRC, '..'),
  FIGMA = path.join(ROT, 'srcFigma');
const FIGMA_LOV = [
    'data/',
    'ui/kart/',
    'ui/tilstand.ts',
    'ui/tekst.ts',
    'ui/farger.ts',
    'ui/komponenter/md.ts',
    'ui/komponenter/lager.ts'
  ],
  FIGMA_IKKE = ['data/bronse/', 'data/generelt/'],
  FIGMA_BARE_TYPER = ['data/gull/'];
const filerI = (mappe: string): string[] =>
  fs.existsSync(mappe)
    ? fs
        .readdirSync(mappe, { withFileTypes: true })
        .flatMap(d =>
          d.isDirectory()
            ? filerI(path.join(mappe, d.name))
            : /\.[jt]sx?$/.test(d.name)
              ? [path.join(mappe, d.name)]
              : []
        )
    : [];
const importer = (fil: string) => {
  const kode = fs.readFileSync(fil, 'utf8'),
    { program } = parseSync(path.basename(fil), kode);
  return (program.body as Node[])
    .filter(n => n.type === 'ImportDeclaration')
    .map(n => ({
      fra: n.source.value as string,
      linje: kode.slice(0, n.start).split('\n').length,
      typer:
        n.importKind === 'type' ||
        (n.specifiers.length > 0 &&
          (n.specifiers as Node[]).every(x => x.type === 'ImportSpecifier' && x.importKind === 'type'))
    }));
};
for (const fil of filerI(SRC))
  for (const { fra, linje } of importer(fil))
    if (fra.includes('srcFigma'))
      feil.push(`${path.relative(ROT, fil)}:${linje} importerer fra tvillingen (${fra}): src/ bruker aldri srcFigma/`);
for (const fil of filerI(FIGMA)) {
  antall++;
  const kode = fs.readFileSync(fil, 'utf8');
  for (const m of kode.matchAll(/katalog\.bronse\.([A-Za-z]+)/g))
    if (!m[1].endsWith('flis'))
      feil.push(
        `${path.relative(ROT, fil)}:${kode.slice(0, m.index).split('\n').length} bruker katalog.bronse.${m[1]}: tvillingen bruker bare kartbildene fra bronse`
      );
  for (const { fra, linje, typer } of importer(fil)) {
    if (!fra.startsWith('.')) continue; /* pakker */
    const hvor = path.resolve(path.dirname(fil), fra);
    if (hvor.startsWith(FIGMA + path.sep)) continue;
    const rel = path.relative(SRC, hvor).split(path.sep).join('/');
    const sted = `${path.relative(ROT, fil)}:${linje} importerer fra ${fra}`;
    if (!hvor.startsWith(SRC + path.sep) || !FIGMA_LOV.some(p => rel.startsWith(p)))
      feil.push(`${sted}: tvillingen kan bare bruke ${FIGMA_LOV.join(', ')}`);
    else if (FIGMA_IKKE.some(p => rel.startsWith(p)))
      feil.push(`${sted}: tvillingen bruker ikke ${FIGMA_IKKE.join(' eller ')}`);
    else if (!typer && FIGMA_BARE_TYPER.some(p => rel.startsWith(p)))
      feil.push(`${sted}: tvillingen bruker bare typer fra gull`);
  }
}

feil.forEach(x => console.log(x));
console.log(
  feil.length
    ? `\n${feil.length} brudd.`
    : `${antall} filer i ${Object.keys(LAG).length} lag og tvillingen sjekket. Ingen brudd.`
);
process.exit(feil.length ? 1 : 0);
