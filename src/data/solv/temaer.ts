/* Sølv for naturtemaene fra Miljødirektoratet: verneområder, villreinområder og verdsatt natur. Flatene gjøres om til felles form:
   klippet mot kommunen og med areal i km², og som oppslag for punkter når de skal krysses med utbyggingen. Også det kartlagte
   området for naturtyper. Flatene kommer som GeoJSON. */
import polygonClipping from 'polygon-clipping';
import {
  areal,
  flatesok,
  flerflate,
  iSok,
  omriss,
  snitt,
  tomt,
  utsnitt,
  type Flatesok,
  type Flerflate,
  type FlateMedUtsnitt,
  type GeoJsonFlate,
  type Utsnitt
} from '../generelt/geometri.ts';
import { summen } from '../generelt/tall.ts';
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
/* Lokalitetene i verdsatt natur som ikke har en fast verdi, men skal vurderes per lokalitet (v = 0) eller per naturtype (v = 1). De er
   ikke et eget tema i hovedsidens kart, så de står ikke i NATURTEMA. */
export const VURDERES: Naturtema = {
  id: 'vurderes',
  navn: 'Verdsatt natur som vurderes',
  samlet: true,
  klasser: [
    ['Vurderes per lokalitet', 'vurderes1'],
    ['Vurderes per naturtype', 'vurderes2']
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
/* Det kartlagte området for naturtyper i kommunen: arealet i km², årene kartleggingen er gjort, og flaten */
export interface Kartlagt {
  km2: number;
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
    v: Math.max(0, ['Vurderes per lokalitet', 'Vurderes per naturtype'].indexOf(p.Verdikategori)),
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
/* Om punktet (x, y) ligger i området S */
export const iOmradet = (S: Omradesok, x: number, y: number) =>
  iSok(S.flate, x, y) && (!S.kommune || iSok(S.kommune, x, y));
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

/* Verneområder og villreinområder: hver flate klippes mot kommunen, og arealet av det som ligger i kommunen regnes ut, rettet for
   målestokken midt i området. Feiler klippingen, regnes arealet i stedet med dekningsandelen (dekketIKommune), og flaten er uklippet.
   les gir navn og opplysninger fra egenskapene. Gir områdene sortert etter areal, størst først. Arealet er per område: der to områder
   overlapper, har begge overlappet. Arealet av temaet i kommunen, der overlapp telles én gang, regnes av dekningsandelen
   (temaandel). */
export function klippNatur(features: Objekt[], kommune: FlateMedUtsnitt, les: Les): Omrade[] {
  return features
    .map(f => {
      const g = f.geometry;
      if (!g || !g.coordinates) return null;
      const hele = flerflate(g);
      let koord: Flerflate | null = null,
        uklippet = false,
        km2: number;
      try {
        koord = polygonClipping.intersection(hele as Mangekant, kommune.koord as Mangekant);
      } catch (e) {
        koord = null;
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

/* Verdsatt natur: lokalitetene med areal hver for seg, uten klipping mot kommunen (til listen), rettet for målestokken midt i
   lokaliteten. Arealet per verdikategori i kommunen regnes av dekningsandelen (temaandel). Lokalitetene sorteres med høyest verdi
   først (v = 0 er høyest), og så etter areal. */
export function lokaliteter(features: Objekt[], les: Les): Omrade[] {
  const omrader = features
    .filter(f => f.geometry && f.geometry.coordinates)
    .map(f => {
      const koord = flerflate(f.geometry as GeoJsonFlate);
      return {
        koord,
        uklippet: false,
        km2: koord.length ? areal(koord) / m2PerKm2(omriss(koord)) : 0,
        ...les(f.properties || {}),
        egenskaper: f.properties || {}
      };
    })
    .sort((a, b) => (a.v || 0) - (b.v || 0) || b.km2 - a.km2 || fastRekkefolge(a, b));
  return omrader;
}

/* Kartleggingsgrad: dekningsflatene for naturtypekartlegging slått sammen og klippet mot kommunen. Gir det kartlagte arealet, flaten
   og årene kartleggingen er gjort. Feiler sammenslåingen, er flaten ikke med og arealet 0. */
export function byggDekning(features: Objekt[], kommune: FlateMedUtsnitt): Kartlagt {
  const fl = features.filter(f => f.geometry && f.geometry.coordinates);
  if (!fl.length) return { km2: 0 };
  const [forste, ...resten] = fl.map(f => flerflate(f.geometry as GeoJsonFlate) as Mangekant);
  let u: Flerflate | undefined;
  try {
    u = polygonClipping.intersection(polygonClipping.union(forste, ...resten), kommune.koord as Mangekant);
  } catch (e) {
    u = undefined;
  }
  const aar = fl.map(f => parseInt((f.properties || {})['Årstall'], 10)).filter(v => v > 1900);
  return {
    km2: u && u.length ? areal(u) / m2PerKm2(kommune.ext) : 0,
    fra: aar.length ? Math.min(...aar) : null,
    til: aar.length ? Math.max(...aar) : null,
    flate: u
  };
}

/* Områdene i et tema fra svaret j: klippet mot kommunen (verdsatt natur uklippet), med utsnittet. ufullstendig sier at tjenesten ikke
   ga alle lokalitetene i ett svar. */
async function temaomrader(tema: Naturtema, nr: string, j: { features?: Objekt[]; exceededTransferLimit?: boolean }) {
  if (!j || !Array.isArray(j.features)) throw new Error('uventet svar');
  const g = await katalog.solv.grense(nr),
    les = EGENSKAPER[tema.id],
    alle = tema.samlet ? lokaliteter(j.features, les) : klippNatur(j.features, g, les),
    omrader = alle.map(o => ({ ...o, ext: utsnitt(o.koord) }));
  return tema.samlet ? { omrader, ufullstendig: !!j.exceededTransferLimit } : { omrader };
}
/* Tabellene solv.verneomrader, solv.villrein og solv.verdsattNatur: områdene i hvert tema med areal og opplysninger */
export type Temaomrader = { omrader: TemaOmrade[]; ufullstendig?: boolean };
export async function verneomrader(nr: string): Promise<Temaomrader> {
  return temaomrader(VERN, nr, await katalog.bronse.verneomrader(nr));
}
export async function villrein(nr: string): Promise<Temaomrader> {
  return temaomrader(REIN, nr, await katalog.bronse.villrein(nr));
}
export async function verdsattNatur(nr: string): Promise<Temaomrader> {
  return temaomrader(VERDI, nr, await katalog.bronse.verdsattNatur(nr));
}
/* Tabellen solv.verdsattVurderes: lokalitetene som skal vurderes per lokalitet eller per naturtype, uklippet, som verdsatt natur */
export async function verdsattVurderes(nr: string): Promise<Temaomrader> {
  return temaomrader(VURDERES, nr, await katalog.bronse.verdsattVurderes(nr));
}
/* Naturtemaene som dekningsandel i kommunen (solv.vernAndel og de andre): verneområdene, villreinområdene, verdsatt natur og verdsatt natur
   som vurderes per kategori, det kartlagte, og verdsatt natur innenfor det kartlagte */
export type Temaid = 'vern' | 'rein' | 'verdi' | 'vurderes' | 'kartlagt' | 'verdiKartlagt';
/* Et tema i kommunen som dekningsandel: bitene per kategori med andelen per rute (biter, se andelsbiter i kommune.ts), arealet per
   kategori i km² og samlet (sum). Der flater overlapper, telles arealet én gang, i den første kategorien (høyest verdi først). */
export interface Temaandel {
  nr: string;
  tema: Temaid;
  biter: Andelsbit[][];
  km2: number[];
  sum: number;
}
/* Flatene i områdene O per kategori v, i flat form */
const perKategori = (O: Omrade[], antall: number) =>
  Array.from({ length: antall }, (_, v) => ringer(O.filter(o => (o.v || 0) === v).map(o => o.koord)));
/* Flatene fra svaret j */
const flatene = (j: { features?: Objekt[] }) =>
  (j.features || []).filter(f => f.geometry && f.geometry.coordinates).map(f => flerflate(f.geometry as GeoJsonFlate));
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
/* Temaet i kommunen nr som dekningsandel per rute og arealet per kategori. Lagene er kommunen (maske), eventuelt flere masker (som
   det kartlagte), og flatene per kategori i kat, med høyest verdi først. Regnes bare i bitene flatene har noe i. */
async function temaandel(nr: string, tema: Temaid, kat: Ringer[], maske: Ringer[] = []): Promise<Temaandel> {
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
    ),
    km2 = biter.map(L => (summen(L.map(K => K.antall * K.faktor)) * BITRES * BITRES) / 1e6);
  return { nr, tema, biter, km2, sum: summen(km2) };
}
/* Tabellene solv.vernAndel, solv.villreinAndel, solv.verdsattAndel, solv.vurderesAndel, solv.kartlagtAndel og
   solv.verdsattIKartlagtAndel: temaet i kommunen nr som dekningsandel (temaandel). Verdsatt natur og verdsatt natur som vurderes har
   én kategori per verdi, og verdsatt natur i det kartlagte har det kartlagte som maske i tillegg til kommunen. */
export async function vernAndel(nr: string): Promise<Temaandel> {
  return temaandel(nr, 'vern', perKategori((await katalog.solv.verneomrader(nr)).omrader, 1));
}
export async function villreinAndel(nr: string): Promise<Temaandel> {
  return temaandel(nr, 'rein', perKategori((await katalog.solv.villrein(nr)).omrader, 1));
}
export async function verdsattAndel(nr: string): Promise<Temaandel> {
  return temaandel(nr, 'verdi', perKategori((await katalog.solv.verdsattNatur(nr)).omrader, VERDI.klasser!.length));
}
export async function vurderesAndel(nr: string): Promise<Temaandel> {
  return temaandel(
    nr,
    'vurderes',
    perKategori((await katalog.solv.verdsattVurderes(nr)).omrader, VURDERES.klasser!.length)
  );
}
export async function kartlagtAndel(nr: string): Promise<Temaandel> {
  return temaandel(nr, 'kartlagt', [ringer(flatene(await katalog.bronse.kartlagt(nr)))]);
}
export async function verdsattIKartlagtAndel(nr: string): Promise<Temaandel> {
  const [O, j] = await Promise.all([katalog.solv.verdsattNatur(nr), katalog.bronse.kartlagt(nr)]);
  return temaandel(nr, 'verdiKartlagt', perKategori(O.omrader, VERDI.klasser!.length), [ringer(flatene(j))]);
}
/* Tabellen solv.kartlagt: det som er kartlagt for naturtyper etter Miljødirektoratets instruks i kommunen: arealet fra
   dekningsandelen (solv.kartlagtAndel), årene, og flaten slått sammen og klippet mot kommunen til kartet. Feiler sammenslåingen, er
   flaten ikke med, men arealet er det. */
export async function kartlagt(nr: string): Promise<Kartlagt> {
  const [j, g, A] = await Promise.all([
      katalog.bronse.kartlagt(nr),
      katalog.solv.grense(nr),
      katalog.solv.kartlagtAndel(nr)
    ]),
    E = byggDekning(j.features || [], g);
  return { ...E, km2: A.sum };
}
