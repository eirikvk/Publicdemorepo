/* Sølv for naturtemaene fra Miljødirektoratet: verneområder, villreinområder og verdsatt natur. Flatene gjøres om til felles form:
   klippet mot kommunen og med areal i km² per område, i rutene, og som oppslag for punkter når de skal krysses med utbyggingen. Også
   det kartlagte området for naturtyper. Flatene kommer som GeoJSON. Hvert tema er et datasett der flatene er dataene og rutene
   støttedata; arealet av temaet regnes i gull. */
import polygonClipping from 'polygon-clipping';
import {
  areal,
  flatesok,
  flerflate,
  omriss,
  snitt,
  tomt,
  utsnitt,
  type Flatesok,
  type Flerflate,
  type FlateMedUtsnitt,
  type GeoJsonFlate,
  type Utsnitt,
  iSok,
  iUtsnitt,
  kantIUtsnitt,
  kantsok
} from '../generelt/geometri.ts';
import { andelSum, dekningI, ringer, type Ringer } from '../generelt/dekning.ts';
import { katalog } from '../katalog.ts';
import { biterI, m2PerKm2, rutenett } from './felles.ts';
import { andelsbiter, BITRES, type Andelsbit } from './kommune.ts';

/* Naturtemaene. samlet: mange små lokaliteter, der arealet per verdikategori regnes samlet og bare de som berøres av planlagt
   utbygging, listes. dekning: temaet har et kart over hvor det er kartlagt. klasser: verdikategoriene, [navn, farge], høyest verdi
   først. Et nytt tema av samme slag legges til i bronse, i EGENSKAPER under, som en ny linje her, med tabeller i katalogen
   (katalog.ts) og med ord og kartlag i ui/. */
export interface Naturtema {
  id: string;
  navn: string;
  samlet?: boolean;
  dekning?: boolean;
  klasser?: [navn: string, farge: string][];
}
export const NATURTEMA: Naturtema[] = [
  { id: 'vern', navn: 'Verneområder' },
  { id: 'rein', navn: 'Villrein' },
  {
    id: 'verdi',
    navn: 'Verdsatt natur',
    samlet: true,
    dekning: true,
    klasser: [
      ['Svært stor verdi', 'verdi1'],
      ['Stor verdi', 'verdi2'],
      ['Middels verdi', 'verdi3'],
      ['Noe verdi', 'verdi4']
    ]
  }
];
const [VERN, REIN, VERDI] = NATURTEMA;
/* Lokalitetene i verdsatt natur som ikke har en fast verdi: de som skal vurderes per lokalitet (v = 0) eller per naturtype (v = 1),
   og de som ikke er gitt verdi (v = 2). De er ikke et eget tema i hovedsidens kart, så de står ikke i NATURTEMA. */
export const VURDERES: Naturtema = {
  id: 'vurderes',
  navn: 'Verdsatt natur uten fast verdi',
  samlet: true,
  klasser: [
    ['Vurderes per lokalitet', 'vurderes1'],
    ['Vurderes per naturtype', 'vurderes2'],
    ['Ikke gitt verdi', 'vurderes3']
  ]
};

/* Verneformene i grupper, som i skissene: nasjonalpark, naturreservat, landskapsvernområde, marint verneområde, artsfredning
   (dyre- og plantefredning) og annen fredning (resten, som naturminne og biotopvern) */
export const VERNEFORMGRUPPER: [id: string, navn: string][] = [
  ['nasjonalpark', 'Nasjonalpark'],
  ['naturreservat', 'Naturreservat'],
  ['landskap', 'Landskapsvernområde'],
  ['marint', 'Marint verneområde'],
  ['arts', 'Artsfredning'],
  ['annen', 'Annen fredning']
];
/* Gruppen i gull.vernLandSjo for arealet som er telt i mer enn én gruppe av verneformer */
export const FLERE_VERNEFORMER = 'flere';
/* Gruppen for verneformen slik Miljødirektoratet skriver den (som MarintVerneomraade eller Dyrefredningsomraade) */
export function verneformgruppe(verneform: unknown): string {
  const v = String(verneform || '').toLowerCase();
  if (v.includes('nasjonalpark')) return 'nasjonalpark';
  if (v.includes('naturreservat')) return 'naturreservat';
  if (v.includes('landskapsvern')) return 'landskap';
  if (v.includes('marin')) return 'marint';
  if (/(dyre|plante|arts)fredning/.test(v)) return 'arts';
  return 'annen';
}

/* Flatene slik polygon-clipping vil ha dem */
type Mangekant = polygonClipping.MultiPolygon;

/* En flate fra tjenesten, som i GeoJSON: geometrien og egenskapene */
export interface Objekt {
  geometry: GeoJsonFlate | null;
  properties: Record<string, any> | null;
}
/* Opplysningene om et område, lest av egenskapene: navn, lenke til faktaark, en kort beskrivelse (under) og, for verdsatt natur,
   verdikategorien v (0 svært stor, 1 stor, 2 middels, 3 noe verdi) */
export interface Opplysninger {
  navn: string;
  url: string;
  under: string;
  v?: number;
}
/* Et område i et naturtema: flaten, om den er klippet mot kommunen (uklippet hvis klippingen feilet), arealet i kommunen i km²,
   opplysningene, og egenskapene slik kilden ga dem (til detaljene ved trykk i kartet) */
export interface Omrade extends Opplysninger {
  koord: Flerflate;
  uklippet: boolean;
  km2: number;
  egenskaper: Record<string, unknown>;
}
/* Et område med utsnittet, slik tabellene har det */
export interface TemaOmrade extends Omrade {
  ext: Utsnitt;
}
/* Et område som oppslag for punkter fra utbyggingen: i flaten, og i kommunen når flaten ikke er klippet mot den */
export interface Omradesok {
  flate: Flatesok;
  kommune: Flatesok | null;
}
/* Det kartlagte for naturtyper rundt kommunen: dekningsflatene slik de kom (flater, til det kartlagte i rutene), årene
   kartleggingen er gjort, og flatene slått sammen og klippet mot kommunen (flate, til kartet). Arealet regnes i gull
   (gull.kartlagtAreal). */
export interface Kartlagt {
  flater: Flerflate[];
  fra?: number | null;
  til?: number | null;
  flate?: Flerflate;
}
export type Les = (p: Record<string, any>) => Opplysninger;

/* Egenskapene til flatene i hvert tema gjort om til felles form: navn, lenke til faktaark, en kort beskrivelse (under) og, for
   verdsatt natur, verdikategorien v (0 svært stor, 1 stor, 2 middels, 3 noe verdi). */
export const EGENSKAPER: Record<string, Les> = {
  vern: p => ({
    navn: p.offisieltNavn || 'Uten navn',
    url: p.faktaark || '',
    under: [
      String(p.verneform || '')
        .replace(/([a-zæøå])([A-ZÆØÅ])/g, '$1 $2')
        .toLowerCase()
        .replace(/omraade/g, 'område')
        .replace(/^./, (c: string) => c.toUpperCase()),
      p.vernedato ? 'vernet ' + new Date(p.vernedato).getUTCFullYear() : ''
    ]
      .filter(Boolean)
      .join(', ')
  }),
  rein: p => ({
    navn: String(p['villreinområdeNavn'] || 'Uten navn').replace(/\s*-\s*leveområde\s*$/i, ''),
    url: p.faktaark || '',
    under: [
      p['villreinområdeNasjonalt'] === 'Ja' ? 'Nasjonalt villreinområde' : 'Villreinområde',
      p.funksjon ? String(p.funksjon).toLowerCase() : '',
      p.funksjonsperiode ? String(p.funksjonsperiode).toLowerCase() : ''
    ]
      .filter(Boolean)
      .join(', ')
  }),
  verdi: p => ({
    navn: p['Områdenavn'] || p.Naturtype || 'Uten navn',
    url: p.FaktaarkLokalitet || p.Faktaark || '',
    v: Math.max(0, ['Svært stor verdi', 'Stor verdi', 'Middels verdi', 'Noe verdi'].indexOf(p.Verdikategori)),
    under: [p.Naturtype, String(p.Verdikategori || '').toLowerCase()].filter(Boolean).join(', ')
  }),
  vurderes: p => ({
    navn: p['Områdenavn'] || p.Naturtype || 'Uten navn',
    url: p.FaktaarkLokalitet || p.Faktaark || '',
    v: Math.max(0, ['Vurderes per lokalitet', 'Vurderes per naturtype', 'Ikke gitt verdi'].indexOf(p.Verdikategori)),
    under: [p.Naturtype, String(p.Verdikategori || '').toLowerCase()].filter(Boolean).join(', ')
  })
};

/* Et område med utsnittet, slik tabellene har det */
export interface TemaOmrade extends Omrade {
  ext: Utsnitt;
}
/* Et område som oppslag for punkter fra utbyggingen. flate er { koord, ext }. kommune er oppslaget i kommunen, og oppgis bare når
   flaten ikke alt er klippet mot kommunen. Et punkt er i området når det ligger i flaten (og i kommunen), uten rutenett, så svaret
   er det samme hvor stor flaten er. null når flaten ligger utenfor kommunen. */
export function naturSok(flate: FlateMedUtsnitt, kommune: Flatesok | null): Omradesok | null {
  if (kommune && tomt(snitt(flate.ext, kommune.ext))) return null;
  return { flate: flatesok(flate.koord, flate.ext), kommune };
}
/* Arealet av flaten koord innenfor kommunen, i kartets kvadratmeter, med dekningsandelen (generelt/dekning.ts) i et rutenett over
   snittet av utsnittene: ruter på 10,6 meter, eller større når snittet er mer enn 2048 ruter på det lengste. Brukes når klippingen av
   flatene feiler. */
export function dekketIKommune(koord: Flerflate, kommune: FlateMedUtsnitt) {
  const e = snitt(omriss(koord), kommune.ext);
  if (tomt(e)) return 0;
  const R = rutenett(e, 2048, BITRES),
    A = dekningI([ringer([kommune.koord]), ringer([koord])], R, [0, 1], []);
  return A ? andelSum(A[0]) * R.res * R.res : 0;
}

/* Fast rekkefølge for områder som er like etter sorteringen (samme verdi og samme areal): første punkt, så navn, beskrivelse og
   nettadresse, og til slutt hele flaten. Miljødirektoratet sender områdene i tilfeldig rekkefølge, og mange lokaliteter har nøyaktig
   samme areal, fordi koordinatene er hele meter. Arealene avhenger ikke av rekkefølgen (dekningsandelen slår sammen flatene), men
   listene og plassene til områdene gjør det. */
const tekst = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const fastRekkefolge = (a: Omrade, b: Omrade) => {
  const pa = (a.koord[0] && a.koord[0][0] && a.koord[0][0][0]) || [0, 0],
    pb = (b.koord[0] && b.koord[0][0] && b.koord[0][0][0]) || [0, 0];
  return (
    pa[0] - pb[0] ||
    pa[1] - pb[1] ||
    tekst(a.navn, b.navn) ||
    tekst(a.under, b.under) ||
    tekst(a.url, b.url) ||
    tekst(JSON.stringify(a.koord), JSON.stringify(b.koord))
  );
};

/* Kommunen som oppslag for mange flater: kantene (kantsok) og punktene (flatesok). En flate der ingen kant av kommunen går gjennom
   utsnittet, ligger helt inne i kommunen eller helt utenfor, og trenger ikke klippes. */
export interface Kommunesok {
  kanter: Flatesok;
  sok: Flatesok;
}
export const kommunesok = (kommune: FlateMedUtsnitt): Kommunesok => ({
  kanter: kantsok(kommune.koord, kommune.ext),
  sok: flatesok(kommune.koord, kommune.ext)
});
/* Naturtemaene: hver flate klippes mot kommunen, og arealet av det som ligger i kommunen regnes ut, rettet for målestokken midt i
   området. Feiler klippingen, regnes arealet i stedet med dekningsandelen (dekketIKommune), og flaten er uklippet. Med K (kommunesok)
   klippes bare flatene kanten av kommunen går gjennom: de andre er med som de er, eller ikke med når de ligger utenfor. Det gjør
   klippingen av mange små lokaliteter rask, og gir den samme flaten.
   les gir navn og opplysninger fra egenskapene. Gir områdene sortert etter areal, størst først. Arealet er per område: der to områder
   overlapper, har begge overlappet. Arealet av temaet i kommunen, der overlapp telles én gang, regnes i gull av temaet i rutene
   (temabiter). */
export function klippNatur(features: Objekt[], kommune: FlateMedUtsnitt, les: Les, K?: Kommunesok): Omrade[] {
  return features
    .map(f => {
      const g = f.geometry;
      if (!g || !g.coordinates) return null;
      const hele = flerflate(g);
      let koord: Flerflate | null = null,
        uklippet = false,
        km2: number;
      const e = K && hele.length ? utsnitt(hele) : null;
      if (K && e && !kantIUtsnitt(K.kanter, e)) {
        /* kanten av kommunen går ikke gjennom flaten: den ligger helt inne, eller helt utenfor */
        const [x, y] = hele[0][0][0];
        if (!iSok(K.sok, x, y)) return null;
        koord = hele;
      } else {
        /* med K klippes flaten mot den delen av kommunen som ligger rundt den (10 meter utenfor utsnittet), som gir den samme
           flaten mye raskere; feiler det, mot hele kommunen */
        const rundt = e ? iUtsnitt(kommune.koord, [e[0] - 10, e[1] - 10, e[2] + 10, e[3] + 10]) : null;
        for (const mot of rundt ? [rundt, kommune.koord] : [kommune.koord])
          try {
            koord = polygonClipping.intersection(hele as Mangekant, mot as Mangekant);
            break;
          } catch (e) {
            koord = null;
          }
      }
      if (koord) {
        if (!koord.length) return null;
        km2 = areal(koord) / m2PerKm2(omriss(koord));
      } else {
        koord = hele;
        uklippet = true;
        const m2 = dekketIKommune(hele, kommune);
        if (!(m2 > 0)) return null;
        km2 = m2 / m2PerKm2(snitt(omriss(hele), kommune.ext));
      }
      return km2 > 0 ? { koord, uklippet, km2, ...les(f.properties || {}), egenskaper: f.properties || {} } : null;
    })
    .filter((o): o is Omrade => !!o)
    .sort((a, b) => b.km2 - a.km2 || fastRekkefolge(a, b));
}

/* Kartleggingsgrad: dekningsflatene for naturtypekartlegging, årene kartleggingen er gjort, og flatene slått sammen og klippet mot
   kommunen. Feiler sammenslåingen, er den sammenslåtte flaten ikke med. */
export function byggDekning(features: Objekt[], kommune: FlateMedUtsnitt): Kartlagt {
  const fl = features.filter(f => f.geometry && f.geometry.coordinates);
  if (!fl.length) return { flater: [] };
  const flater = fl.map(f => flerflate(f.geometry as GeoJsonFlate)),
    [forste, ...resten] = flater as Mangekant[];
  let u: Flerflate | undefined;
  try {
    u = polygonClipping.intersection(polygonClipping.union(forste, ...resten), kommune.koord as Mangekant);
  } catch (e) {
    u = undefined;
  }
  const aar = fl.map(f => parseInt((f.properties || {})['Årstall'], 10)).filter(v => v > 1900);
  return {
    flater,
    fra: aar.length ? Math.min(...aar) : null,
    til: aar.length ? Math.max(...aar) : null,
    flate: u
  };
}

/* Områdene i et tema fra flatene F, klippet mot kommunen nr, med utsnittet. Lokalitetene i verdsatt natur (samlet) sorteres med
   høyest verdi først og så etter areal, og klippes med kommunen som oppslag (kommunesok), for de er mange. */
async function temaomrader(tema: Naturtema, nr: string, F: Objekt[]): Promise<TemaOmrade[]> {
  const g = await katalog.solv.grense(nr),
    alle = klippNatur(F, g, EGENSKAPER[tema.id], tema.samlet ? kommunesok(g) : undefined);
  if (tema.samlet) alle.sort((a, b) => (a.v || 0) - (b.v || 0) || b.km2 - a.km2 || fastRekkefolge(a, b));
  return alle.map(o => ({ ...o, ext: utsnitt(o.koord) }));
}
const flaterI = (j: { features?: Objekt[] }) => {
  if (!j || !Array.isArray(j.features)) throw new Error('uventet svar');
  return j.features;
};
/* Tabellene solv.verneomrader, solv.villrein og solv.verdsattNatur: områdene i temaet, klippet mot kommunen, med areal og
   opplysninger. I verdsatt natur er omrader lokalitetene med fast verdi, og utenFastVerdi de uten. ufullstendig sier at tjenesten
   ikke ga alle lokalitetene. */
export type Temaomrader = { omrader: TemaOmrade[]; utenFastVerdi?: TemaOmrade[]; ufullstendig?: boolean };
export async function verneomrader(nr: string): Promise<Temaomrader> {
  return { omrader: await temaomrader(VERN, nr, flaterI(await katalog.bronse.verneomrader(nr))) };
}
export async function villrein(nr: string): Promise<Temaomrader> {
  return { omrader: await temaomrader(REIN, nr, flaterI(await katalog.bronse.villrein(nr))) };
}
/* Verdsatt natur: alle lokalitetene i kommunen, klippet mot den, med verdikategorien. De med fast verdi (svært stor, stor, middels
   og noe verdi) står i omrader, med v fra 0 (svært stor) til 3, og de uten fast verdi (vurderes per lokalitet, vurderes per
   naturtype og ikke gitt verdi) i utenFastVerdi, med v fra 0 til 2. */
/* Verdikategoriene med fast verdi, slik Miljødirektoratet skriver dem */
export const FASTE_VERDIER = ['Svært stor verdi', 'Stor verdi', 'Middels verdi', 'Noe verdi'];
/* Tabellen solv.verdsattNatur: lokalitetene i verdsatt natur, delt på om verdikategorien er fast */
export async function verdsattNatur(nr: string): Promise<Temaomrader> {
  const j = await katalog.bronse.verdsattNatur(nr),
    F = flaterI(j),
    fast = (f: Objekt) => FASTE_VERDIER.includes((f.properties || {}).Verdikategori),
    [omrader, utenFastVerdi] = await Promise.all([
      temaomrader(VERDI, nr, F.filter(fast)),
      temaomrader(
        VURDERES,
        nr,
        F.filter(f => !fast(f))
      )
    ]);
  return { omrader, utenFastVerdi, ufullstendig: !!j.exceededTransferLimit };
}
/* Naturtemaene i rutene (solv.vernAndel og de andre): verneområdene, også per verneform, villreinområdene, verdsatt natur med og
   uten fast verdi per kategori, det kartlagte, og verdsatt natur innenfor det kartlagte (regnet i gull) */
export type Temaid = 'vern' | 'verneform' | 'rein' | 'verdi' | 'vurderes' | 'kartlagt' | 'verdiKartlagt';
/* Et tema i kommunen i rutene: bitene per kategori med andelen per rute (biter, se andelsbiter i kommune.ts). Der flater
   overlapper, telles ruta én gang, i den første kategorien (høyest verdi først), unntatt i verneformene, der hver kategori regnes
   for seg (solv.verneformAndel). Arealet regnes av bitene i gull (arealAvBiter i kommune.ts). */
export interface Temabiter {
  nr: string;
  tema: Temaid;
  biter: Andelsbit[][];
}
/* Flatene i områdene O per kategori v, i flat form */
export const perKategori = (O: Omrade[], antall: number) =>
  Array.from({ length: antall }, (_, v) => ringer(O.filter(o => (o.v || 0) === v).map(o => o.koord)));
/* Utsnittet ringene dekker til sammen, eller null uten ringer */
function ringOmriss(lagene: Ringer[]): Utsnitt | null {
  const e = [Infinity, Infinity, -Infinity, -Infinity];
  for (const F of lagene)
    for (let i = 0; i + 1 < F.start.length; i++) {
      e[0] = Math.min(e[0], F.boks[4 * i]);
      e[1] = Math.min(e[1], F.boks[4 * i + 1]);
      e[2] = Math.max(e[2], F.boks[4 * i + 2]);
      e[3] = Math.max(e[3], F.boks[4 * i + 3]);
    }
  return e[0] < e[2] ? (e as Utsnitt) : null;
}
/* Temaet i kommunen nr som dekningsandel per rute. Lagene er kommunen (maske), eventuelt flere masker (som det kartlagte), og
   flatene per kategori i kat, med høyest verdi først. Regnes bare i bitene flatene har noe i. Brukes også av gull, når to datasett
   krysses (gull.verdsattNaturIKartlagt). */
export async function temabiter(nr: string, tema: Temaid, kat: Ringer[], maske: Ringer[] = []): Promise<Temabiter> {
  const g = await katalog.solv.grense(nr),
    lagene = [ringer([g.koord]), ...maske, ...kat],
    m = 1 + maske.length,
    e = ringOmriss(kat),
    B = e && !tomt(snitt(e, g.ext)) ? biterI(snitt(e, g.ext)) : [],
    biter = await andelsbiter(
      B,
      lagene,
      Array.from({ length: m }, (_, i) => i),
      kat.map((_, i) => m + i)
    );
  return { nr, tema, biter };
}
/* Tabellen solv.vernAndel: verneområdene i kommunen nr i rutene, slått sammen, så der områder overlapper, telles ruta én gang.
   Støttedata til verneområdene (solv.verneomrader). Tabellene for de andre temaene under er bygd på samme måte. */
export async function vernAndel(nr: string): Promise<Temabiter> {
  return temabiter(nr, 'vern', perKategori((await katalog.solv.verneomrader(nr)).omrader, 1));
}
/* Tabellen solv.verneformAndel: verneområdene i rutene med én kategori per gruppe av verneformer, i rekkefølgen i
   VERNEFORMGRUPPER. Hver gruppe regnes for seg, så et sted med flere verneformer er med i hver av dem. */
export async function verneformAndel(nr: string): Promise<Temabiter> {
  const O = (await katalog.solv.verneomrader(nr)).omrader,
    G = await Promise.all(
      VERNEFORMGRUPPER.map(([id]) =>
        temabiter(nr, 'verneform', [
          ringer(O.filter(o => verneformgruppe(o.egenskaper.verneform) === id).map(o => o.koord))
        ])
      )
    );
  return { nr, tema: 'verneform', biter: G.map(A => A.biter[0]) };
}
/* Tabellen solv.villreinAndel: villreinområdene i rutene, slått sammen */
export async function villreinAndel(nr: string): Promise<Temabiter> {
  return temabiter(nr, 'rein', perKategori((await katalog.solv.villrein(nr)).omrader, 1));
}
/* Tabellene solv.verdsattAndel og solv.vurderesAndel: verdsatt natur med og uten fast verdi i rutene, med én kategori per
   verdikategori. Der lokaliteter overlapper, telles ruta i den høyeste verdien. */
export async function verdsattAndel(nr: string): Promise<Temabiter> {
  return temabiter(nr, 'verdi', perKategori((await katalog.solv.verdsattNatur(nr)).omrader, VERDI.klasser!.length));
}
export async function vurderesAndel(nr: string): Promise<Temabiter> {
  return temabiter(
    nr,
    'vurderes',
    perKategori((await katalog.solv.verdsattNatur(nr)).utenFastVerdi || [], VURDERES.klasser!.length)
  );
}
/* Tabellen solv.kartlagtAndel: det kartlagte i rutene, av dekningsflatene slik de kom (solv.kartlagt), slått sammen */
export async function kartlagtAndel(nr: string): Promise<Temabiter> {
  return temabiter(nr, 'kartlagt', [ringer((await katalog.solv.kartlagt(nr)).flater)]);
}
/* Tabellen solv.kartlagt: det som er kartlagt for naturtyper etter Miljødirektoratets instruks rundt kommunen (byggDekning). */
export async function kartlagt(nr: string): Promise<Kartlagt> {
  const [j, g] = await Promise.all([katalog.bronse.kartlagt(nr), katalog.solv.grense(nr)]);
  return byggDekning(flaterI(j), g);
}
