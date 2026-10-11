/* Lager forklaringene bak tallene fra koden, så de ikke skrives to steder:
   - src/data/avhengigheter.ts: hvilke tabeller i katalogen hver tabell bygger på. Lest ut av ETL-funksjonene: hvert kall til
     katalog.<lag>.<tabell> i funksjonen, og i funksjonene den bruker i bronse, sølv, gull og generelt.
   - Kapitlene i METODE.md mellom merkene <!-- forklaringer:gruppe --> og <!-- /forklaringer:gruppe -->: ett avsnitt per kort i
     src/ui/forklaringer.ts, med spørsmålet, kort fortalt, stegene fra kilde til tall (forklaringen og kilden på tabellene i
     katalogen), usikkerheten og koden.
   Resten av METODE.md skrives for hånd.

   Kjør fra roten av repoet:
       node verktoy/forklaringer.ts           skriver filene
       node verktoy/forklaringer.ts --sjekk   sier fra hvis de ikke er oppdatert (en del av npm run sjekk) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import * as prettier from 'prettier';
import type { Tabelldef } from '../src/data/cache.ts';
import { katalog } from '../src/data/katalog.ts';

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  DATA = path.join(ROT, 'src', 'data'),
  AVH_FIL = path.join(DATA, 'avhengigheter.ts'),
  METODE_FIL = path.join(ROT, 'METODE.md'),
  SJEKK = process.argv.includes('--sjekk');
const LAG = ['bronse', 'solv', 'gull'] as const;
const MAPPER = ['bronse', 'solv', 'gull', 'generelt'];

/* En node i syntakstreet, slik oxc-parser gir den */
type Node = { type: string; [felt: string]: any };
const erNode = (x: unknown): x is Node => !!x && typeof x === 'object' && typeof (x as Node).type === 'string';
function gaaGjennom(n: Node, f: (n: Node, over: Node | null) => void, over: Node | null = null) {
  f(n, over);
  for (const [felt, v] of Object.entries(n)) {
    if (felt === 'parent') continue;
    if (Array.isArray(v)) v.forEach(x => erNode(x) && gaaGjennom(x, f, n));
    else if (erNode(v)) gaaGjennom(v, f, n);
  }
}

/* 1. Funksjonene i hver fil, og hva som er importert fra de andre filene i data. Nøkkelen er «mappe/fil.ts#navn». */
const funksjoner = new Map<string, Node>(),
  navnIFil = new Map<string, Map<string, string>>(); /* per fil: navnet i filen -> nøkkelen til funksjonen */
for (const mappe of MAPPER)
  for (const f of fs.readdirSync(path.join(DATA, mappe)).filter(f => f.endsWith('.ts'))) {
    const fil = `${mappe}/${f}`,
      { program } = parseSync(f, fs.readFileSync(path.join(DATA, fil), 'utf8')),
      navn = new Map<string, string>();
    navnIFil.set(fil, navn);
    for (const n of program.body as Node[]) {
      if (n.type === 'ImportDeclaration' && String(n.source.value).startsWith('.')) {
        const fra = path.posix.normalize(path.posix.join(mappe, n.source.value));
        for (const s of n.specifiers as Node[])
          if (s.type === 'ImportSpecifier') navn.set(s.local.name, `${fra}#${s.imported.name}`);
        continue;
      }
      const d: Node = n.type === 'ExportNamedDeclaration' && n.declaration ? n.declaration : n;
      if (d.type === 'FunctionDeclaration' && d.id) {
        funksjoner.set(`${fil}#${d.id.name}`, d);
        navn.set(d.id.name, `${fil}#${d.id.name}`);
      } else if (d.type === 'VariableDeclaration')
        for (const x of d.declarations as Node[])
          if (x.id.type === 'Identifier' && x.init && /FunctionExpression$/.test(x.init.type)) {
            funksjoner.set(`${fil}#${x.id.name}`, x.init);
            navn.set(x.id.name, `${fil}#${x.id.name}`);
          }
    }
  }

/* 2. For hver funksjon: tabellene den kaller direkte, og funksjonene den bruker */
const direkte = new Map<string, { tabeller: Set<string>; bruker: Set<string> }>();
for (const [nokkel, node] of funksjoner) {
  const fil = nokkel.split('#')[0],
    navn = navnIFil.get(fil)!,
    D = { tabeller: new Set<string>(), bruker: new Set<string>() };
  gaaGjennom(node, (n, over) => {
    if (
      n.type === 'MemberExpression' &&
      !n.computed &&
      n.object.type === 'MemberExpression' &&
      n.object.object.type === 'Identifier' &&
      n.object.object.name === 'katalog' &&
      (LAG as readonly string[]).includes(n.object.property.name)
    )
      D.tabeller.add(`${n.object.property.name}.${n.property.name}`);
    if (n.type !== 'Identifier' || !navn.has(n.name)) return;
    if (over && over.type === 'MemberExpression' && over.property === n && !over.computed) return;
    if (over && over.type === 'Property' && over.key === n && !over.shorthand && !over.computed) return;
    D.bruker.add(navn.get(n.name)!);
  });
  direkte.set(nokkel, D);
}
/* Alle tabellene en funksjon kaller, også gjennom funksjonene den bruker */
function tabellerFra(nokkel: string, sett = new Set<string>(), ut = new Set<string>()) {
  if (sett.has(nokkel)) return ut;
  sett.add(nokkel);
  const D = direkte.get(nokkel);
  if (!D) return ut;
  D.tabeller.forEach(t => ut.add(t));
  D.bruker.forEach(b => tabellerFra(b, sett, ut));
  return ut;
}

/* 3. Avhengighetene per tabell i katalogen: fra ETL-funksjonen, og fra det lagrede svaret når tabellen har et */
const AVH: Record<string, string[]> = {};
for (const lag of LAG)
  for (const [navn, t] of Object.entries(katalog[lag]) as [string, Tabelldef<unknown, unknown>][]) {
    if (!t.etl || !t.fil) continue;
    const fulltNavn = `${lag}.${navn}`,
      ut = tabellerFra(`${t.fil}#${t.etl.name}`);
    if (t.lagret) tabellerFra(`${t.fil}#${t.lagret.name}`, new Set(), ut);
    ut.delete(fulltNavn);
    AVH[fulltNavn] = [...ut].sort();
  }
const avhKode = await prettier.format(
  `/* Hvilke tabeller i katalogen hver tabell bygger på, lest ut av koden av verktoy/forklaringer.ts. Ikke rediger for hånd: kjør
   npm run forklaringer. Brukes til stegene fra kilde til tall i infoknappene og i METODE.md. */
export const AVHENGIGHETER: Record<string, string[]> = ${JSON.stringify(AVH, null, 2)};
`,
  { ...(await prettier.resolveConfig(AVH_FIL)), filepath: AVH_FIL }
);

/* 4. Kapitlene i METODE.md. Kortene leses etter at avhengighetene er skrevet. */
const feil: string[] = [];
const gammelAvh = fs.existsSync(AVH_FIL) ? fs.readFileSync(AVH_FIL, 'utf8') : '';
if (SJEKK && gammelAvh !== avhKode) feil.push('src/data/avhengigheter.ts er ikke oppdatert');
if (!SJEKK) fs.writeFileSync(AVH_FIL, avhKode);
const { GRUPPER, KORT, ankerFor, stegFor, tabellen, tekniskeFor, usikkerhetFor } =
  await import('../src/ui/forklaringer.ts');
type Steg = ReturnType<typeof stegFor>[number];

/* Bryter teksten t i linjer på høyst 130 tegn. Første linje starter med forran, de neste med like mange mellomrom. */
function bryt(t: string, forran = '', bredde = 130) {
  const ut: string[] = [];
  let linje = '';
  for (const ord of t.split(/\s+/).filter(Boolean)) {
    if (!linje) linje = (ut.length ? ' '.repeat(forran.length) : forran) + ord;
    else if (linje.length + 1 + ord.length > bredde) {
      ut.push(linje);
      linje = ' '.repeat(forran.length) + ord;
    } else linje += ' ' + ord;
  }
  ut.push(linje);
  return ut.join('\n');
}
/* «a, b og c» */
const ramse = (d: string[]) => (d.length > 1 ? d.slice(0, -1).join(', ') + ' og ' + d[d.length - 1] : d[0] || '');
/* Kapitlet for en gruppe kort: hvert kort med spørsmålet, kort fortalt og tabellene det viser (med egen overskrift når kapitlet har
   flere kort), så stegene fra kilde til tall for alle kortene, hjelpetabellene, forbeholdene og koden. Stegene og forbeholdene står
   én gang, selv om flere kort bygger på dem, og steg med samme forklaring står sammen. Et steg et kort i et annet kapittel forklarer,
   står som en henvisning dit. */
function kapittel(gruppe: string) {
  const kort = KORT.filter(x => x.gruppe === gruppe),
    flere = kort.length > 1,
    deler: string[] = [
      '<!-- Laget av verktoy/forklaringer.ts fra kortene i src/ui/forklaringer.ts og tabellene i katalogen. Endre teksten der. -->'
    ];
  for (const k of kort) {
    if (flere) deler.push(`### ${k.tittel}`);
    deler.push(bryt(`**Spørsmål.** ${k.sporsmal}`));
    deler.push(bryt(`**Kort fortalt.** ${k.kortFortalt}`));
    const kode = (t: string[]) => ramse(t.map(x => `\`${x}\``));
    deler.push(
      bryt(
        `**Tabeller.** Kortet viser ${kode(k.tabeller)}${k.forklarer ? `, og forklarer også ${kode(k.forklarer)}` : ''}. Det står i \`${k.komponent}\`.`
      )
    );
  }
  /* Stegene for alle kortene, hvert én gang. Er et steg en henvisning for ett kort og forklart av et annet i kapitlet, forklares det. */
  const steg = new Map<string, Steg>();
  for (const s of kort.flatMap(stegFor)) {
    const f = steg.get(s.navn);
    if (!f || (f.se && !s.se)) steg.set(s.navn, s.se && s.se.gruppe === gruppe ? { ...s, se: undefined } : s);
  }
  const lagrekke = (n: string) => LAG.indexOf(n.split('.')[0] as (typeof LAG)[number]),
    rekke = [...steg.values()].sort((a, b) => lagrekke(a.navn) - lagrekke(b.navn));
  /* Steg med samme tekst og kilde slås sammen */
  const punkter = new Map<string, Steg[]>();
  for (const s of rekke) {
    if (!s.se && !s.tabell.forklaring) feil.push(`${s.navn} mangler forklaring (kapitlet ${gruppe})`);
    const nokkel = s.se ? 'se:' + s.navn : `${s.tabell.forklaring}|${s.tabell.kilde ? s.tabell.kilde.adresse : ''}`;
    punkter.set(nokkel, [...(punkter.get(nokkel) || []), s]);
  }
  deler.push('### Fra kilde til tall');
  deler.push(
    [...punkter.values()]
      .map((S, i) => {
        const navn = ramse(S.map(s => `**${s.tabell.tittel}** (\`${s.navn}\`)`)),
          t = S[0].tabell,
          se = S[0].se;
        if (se) return bryt(`${navn}. Forklart under [${se.tittel}](#${ankerFor(se)}).`, `${i + 1}. `);
        const kilde = t.kilde
          ? ` Kilde: [${t.kilde.navn}, ${t.kilde.datasett}](${t.kilde.adresse}), ${t.kilde.lisens}.`
          : '';
        return bryt(`${navn}. ${t.forklaring || ''}${kilde}`, `${i + 1}. `);
      })
      .join('\n')
  );
  const tekniske = [...new Set(kort.flatMap(tekniskeFor))].sort((a, b) => lagrekke(a) - lagrekke(b));
  if (tekniske.length) {
    deler.push('Underveis brukes også hjelpetabeller som ikke endrer tallene:');
    deler.push(
      tekniske
        .map(n => {
          const t = tabellen(n);
          if (!t.forklaring) feil.push(`${n} mangler forklaring (kapitlet ${gruppe})`);
          return bryt(`**${t.tittel}** (\`${n}\`). ${t.forklaring || ''}`, '- ');
        })
        .join('\n')
    );
  }
  const U = [...new Set(kort.flatMap(usikkerhetFor))];
  if (U.length) {
    deler.push('### Usikkerhet');
    deler.push(U.map(u => bryt(u, '- ')).join('\n'));
  }
  const filer = [
    ...new Set(
      [...rekke.filter(s => !s.se).map(s => s.navn), ...tekniske]
        .filter(n => tabellen(n).fil)
        .map(n => `\`src/data/${tabellen(n).fil}\``)
    )
  ];
  deler.push('### Kode');
  deler.push(
    bryt(
      `${filer.join(', ')}. ${flere ? 'Kortene' : 'Kortet'}: ${[...new Set(kort.map(k => `\`${k.komponent}\``))].join(', ')}.`
    )
  );
  return deler.join('\n\n');
}
let metode = fs.readFileSync(METODE_FIL, 'utf8');
for (const gruppe of [...new Set(KORT.map(k => k.gruppe))]) {
  const start = `<!-- forklaringer:${gruppe} -->`,
    slutt = `<!-- /forklaringer:${gruppe} -->`,
    a = metode.indexOf(start),
    b = metode.indexOf(slutt);
  if (a < 0 || b < a) {
    feil.push(`METODE.md mangler merkene ${start} og ${slutt}`);
    continue;
  }
  const ny = `${start}\n\n${kapittel(gruppe)}\n\n${slutt}`,
    gammel = metode.slice(a, b + slutt.length);
  if (SJEKK && gammel !== ny) feil.push(`kapitlet ${gruppe} i METODE.md er ikke oppdatert`);
  metode = metode.slice(0, a) + ny + metode.slice(b + slutt.length);
}
if (!SJEKK) fs.writeFileSync(METODE_FIL, metode);
for (const k of KORT) {
  for (const t of [...k.tabeller, ...(k.forklarer || [])])
    if (!AVH[t]) feil.push(`kortet ${k.id} viser ${t}, som ikke finnes i katalogen`);
  if (!GRUPPER[k.gruppe]) feil.push(`kortet ${k.id} har gruppen ${k.gruppe}, som mangler i GRUPPER`);
}

if (feil.length) {
  console.log(feil.join('\n') + (SJEKK ? '\nKjør npm run forklaringer.' : ''));
  process.exit(1);
}
console.log(
  SJEKK
    ? `Forklaringene er oppdatert: ${Object.keys(AVH).length} tabeller, ${KORT.length} kort.`
    : `Skrev avhengighetene for ${Object.keys(AVH).length} tabeller og ${KORT.length} kort i METODE.md.`
);
