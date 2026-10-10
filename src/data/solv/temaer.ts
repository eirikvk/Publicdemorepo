/* Sølv for naturtemaene fra Miljødirektoratet: verneområder, villreinområder og verdsatt natur. Flatene gjøres om til felles form:
   klippet mot kommunen og med areal i km², og som masker i et rutenett når de skal krysses med planrutenettet. Også det kartlagte
   området for naturtyper. Flatene kommer som GeoJSON. */
import polygonClipping from 'polygon-clipping';
import {
  areal,
  flerflate,
  omriss,
  snitt,
  tomt,
  type Flerflate,
  type FlateMedUtsnitt,
  type GeoJsonFlate,
  type Utsnitt
} from '../generelt/geometri.ts';
import { RUTENETT_MASKE, m2PerKm2, type Rutebilde } from './felles.ts';
import { sti, tegneflate, dekketM2 } from './raster.ts';

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
/* Et område i et naturtema: flaten, om den er klippet mot kommunen (uklippet hvis klippingen feilet), arealet i kommunen i km², og
   opplysningene */
export interface Omrade extends Opplysninger {
  koord: Flerflate;
  uklippet: boolean;
  km2: number;
}
/* Et område som et lite rutenett med dekningen per rute (a, 0–255), og arealet i kartets kvadratmeter (m2) */
export interface Maske extends Rutebilde {
  a: Uint8Array;
  m2: number;
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
  })
};

/* Et område som et lite rutenett med dekningen per rute (a, 0–255), til oppslag fra planrutenettet. flate er { koord, ext }.
   kommune oppgis bare når flaten ikke alt er klippet mot kommunen. m2 er arealet i kartets kvadratmeter. */
export function naturMaske(flate: FlateMedUtsnitt, kommune: FlateMedUtsnitt | null): Maske | null {
  const e = kommune ? snitt(flate.ext, kommune.ext) : flate.ext;
  if (tomt(e)) return null;
  const [maks, minst] = RUTENETT_MASKE,
    res = Math.max(minst, Math.max(e[2] - e[0], e[3] - e[1]) / maks),
    w = Math.ceil((e[2] - e[0]) / res) + 1,
    h = Math.ceil((e[3] - e[1]) / res) + 1,
    u: Utsnitt = [e[0], e[3] - h * res, e[0] + w * res, e[3]];
  const k = tegneflate(w, h);
  sti(k, flate.koord, u, 1 / res);
  k.fill('evenodd');
  if (kommune) {
    k.globalCompositeOperation = 'destination-in';
    sti(k, kommune.koord, u, 1 / res);
    k.fill('evenodd');
  }
  const d = k.getImageData(0, 0, w, h).data,
    a = new Uint8Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = d[4 * i + 3];
  return { u, res, w, h, a, m2: dekketM2(d, res) };
}

/* Fast rekkefølge for områder som er like etter sorteringen (samme verdi og samme areal): første punkt, så navn, beskrivelse og
   nettadresse, og til slutt hele flaten. Miljødirektoratet sender områdene i tilfeldig rekkefølge, og mange lokaliteter har nøyaktig
   samme areal, fordi koordinatene er hele meter. Rekkefølgen påvirker tegningen av overlappende flater i lerretet litt, og hvilket
   område en planrute regnes til. Uten fast rekkefølge kunne arealet av verdsatt natur skille med opptil én dekar mellom to hentinger. */
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

/* Verneområder og villreinområder: hver flate klippes mot kommunen, og arealet av det som ligger i kommunen regnes ut. Feiler
   klippingen, regnes arealet i stedet av flaten tegnet i et rutenett og klippet mot kommunen der (uklippet). les gir navn og
   opplysninger fra egenskapene. Gir områdene sortert etter areal, størst først. Overlapper to flater, telles overlappet to ganger. */
export function klippNatur(features: Objekt[], kommune: FlateMedUtsnitt, les: Les): Omrade[] {
  const skala = m2PerKm2(kommune.ext);
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
        km2 = areal(koord) / skala;
      } else {
        koord = hele;
        uklippet = true;
        const m = naturMaske({ koord: hele, ext: omriss(hele) }, kommune);
        if (!m || !(m.m2 > 0)) return null;
        km2 = m.m2 / skala;
      }
      return km2 > 0 ? { koord, uklippet, km2, ...les(f.properties || {}) } : null;
    })
    .filter((o): o is Omrade => !!o)
    .sort((a, b) => b.km2 - a.km2 || fastRekkefolge(a, b));
}

/* Verdsatt natur: lokalitetene med areal hver for seg, uten klipping mot kommunen (til listen). Arealet per verdikategori i kommunen
   regnes ut i gull (klasseAreal). Lokalitetene sorteres med høyest verdi først (v = 0 er høyest), så en planrute der lokaliteter
   overlapper, regnes til den høyeste. */
export function lokaliteter(features: Objekt[], kommune: FlateMedUtsnitt, les: Les): Omrade[] {
  const skala = m2PerKm2(kommune.ext);
  const omrader = features
    .filter(f => f.geometry && f.geometry.coordinates)
    .map(f => {
      const koord = flerflate(f.geometry as GeoJsonFlate);
      return { koord, uklippet: false, km2: koord.length ? areal(koord) / skala : 0, ...les(f.properties || {}) };
    })
    .sort((a, b) => (a.v || 0) - (b.v || 0) || b.km2 - a.km2 || fastRekkefolge(a, b));
  return omrader;
}

/* Kartleggingsgrad: dekningsflatene for naturtypekartlegging slått sammen og klippet mot kommunen. Gir det kartlagte arealet, flaten
   og årene kartleggingen er gjort. */
export function byggDekning(features: Objekt[], kommune: FlateMedUtsnitt): Kartlagt {
  const fl = features.filter(f => f.geometry && f.geometry.coordinates);
  if (!fl.length) return { km2: 0 };
  const [forste, ...resten] = fl.map(f => flerflate(f.geometry as GeoJsonFlate) as Mangekant);
  const u = polygonClipping.intersection(polygonClipping.union(forste, ...resten), kommune.koord as Mangekant);
  const aar = fl.map(f => parseInt((f.properties || {})['Årstall'], 10)).filter(v => v > 1900);
  return {
    km2: u.length ? areal(u) / m2PerKm2(kommune.ext) : 0,
    fra: aar.length ? Math.min(...aar) : null,
    til: aar.length ? Math.max(...aar) : null,
    flate: u
  };
}
