/* Sølv for oppslag i ett punkt, til detaljene ved trykk i kartet: svarene fra kildene gjort om til felles form. Hver flate i punktet
   er egenskapene som [felt, verdi] i kildens rekkefølge og med kildens feltnavn, og flaten når kilden gir den. Tomme felt er tatt
   bort. Datoer skrives som dd.mm.åååå, og kodene for arealformål, arealbruksstatus og eierform får navnet fra kodelisten (kodelister.ts).
   Ingenting her inngår i tallene. */
import { flerflate, type Flerflate, type GeoJsonFlate } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { AREALBRUKSSTATUS, EIERFORM, KP_AREALFORMAL, medNavn } from './kodelister.ts';

/* En flate i punktet: egenskapene og, når kilden gir den, flaten i UTM33 */
export interface Punktflate {
  felt: [navn: string, verdi: string][];
  flate?: Flerflate;
}

/* En dato som dd.mm.åååå: fra millisekunder (ArcGIS) eller tekst som begynner med åååå-mm-dd */
const dato = (v: unknown) => {
  if (typeof v === 'number')
    return new Date(v).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC'
    });
  const d = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(v));
  return d ? `${d[3]}.${d[2]}.${d[1]}` : String(v);
};
/* En verdi som tekst: heltall som de er (de er ofte id-er), andre tall med desimalkomma og høyst to desimaler, resten som det er.
   null for tomme verdier. */
const tekst = (v: unknown): string | null =>
  v === null || v === undefined || v === ''
    ? null
    : typeof v === 'number'
      ? Number.isInteger(v)
        ? String(v)
        : v.toLocaleString('nb-NO', { maximumFractionDigits: 2, useGrouping: false })
      : String(v);
/* Feltene i egenskapene p, med verdien gjort om av gjor når den er gitt for feltet */
const felt = (p: Record<string, unknown>, gjor: Record<string, (v: unknown) => string> = {}) =>
  Object.entries(p).flatMap(([navn, v]): [string, string][] => {
    const s = tekst(v);
    return s === null ? [] : [[navn, gjor[navn] ? gjor[navn](v) : s]];
  });
type Geojson = { features?: { properties?: Record<string, unknown>; geometry?: GeoJsonFlate | null }[] };

/* Tabellen solv.planIPunkt: flatene i kommuneplanene i punktet p, med arealformål og status med navn, datoene som datoer, og flaten */
export async function planIPunkt(p: number[]): Promise<Punktflate[]> {
  const j = (await katalog.bronse.planIPunkt(p)) as Geojson;
  return (j.features || []).map(f => ({
    felt: felt(f.properties || {}, {
      arealformål: v => medNavn(String(v), KP_AREALFORMAL),
      arealbruksstatus: v => medNavn(String(v), AREALBRUKSSTATUS),
      eierform: v => medNavn(String(v), EIERFORM),
      førsteDigitaliseringsdato: dato,
      oppdateringsdato: dato,
      'kopidata.kopidato': dato
    }),
    flate: f.geometry && /Polygon$/.test(f.geometry.type) ? flerflate(f.geometry as GeoJsonFlate) : undefined
  }));
}

/* Tabellen solv.grunnkartIPunkt: grunnkartet i punktet p, feltene i GML-svaret fra NIBIO. Svaret er enkelt nok til å leses uten
   en XML-leser: hver flate er et element som slutter på _feature, med ett element per felt. */
export async function grunnkartIPunkt(p: number[]): Promise<Punktflate[]> {
  const gml = await katalog.bronse.grunnkartIPunkt(p);
  return [...gml.matchAll(/<(\w+)_feature>([\s\S]*?)<\/\1_feature>/g)].map(([, , inni]) => ({
    felt: [...inni.matchAll(/<([\p{L}\d_.]+)>([^<]*)<\/\1>/gu)].flatMap(([, navn, v]): [string, string][] =>
      v.trim() ? [[navn, v.trim()]] : []
    )
  }));
}

/* Tabellen solv.inonIPunkt: sonen for inngrepsfri natur i punktet p, med feltene fra Miljødirektoratet (id, sone og arealet av
   sonen i km²). Flaten tas ikke med: en sone kan være flere hundre km². */
export async function inonIPunkt(p: number[]): Promise<Punktflate[]> {
  const j = (await katalog.bronse.inonIPunkt(p)) as Geojson;
  return (j.features || []).map(f => ({ felt: felt(f.properties || {}) }));
}

/* Tabellen solv.temaegenskaper: alle feltene for området med OBJECTID id i temaet, kalt med [tema, id]. Datofeltene (etter
   feltbeskrivelsen fra tjenesten) skrives som datoer. */
export async function temaegenskaper([tema, id]: [string, number]): Promise<Punktflate[]> {
  const j = (await katalog.bronse.temaegenskaper([tema, id])) as {
    fields?: { name: string; type: string }[];
    features?: { attributes?: Record<string, unknown> }[];
  };
  const datoer = Object.fromEntries(
    (j.fields || []).filter(f => f.type === 'esriFieldTypeDate').map(f => [f.name, dato] as const)
  );
  return (j.features || []).map(f => ({ felt: felt(f.attributes || {}, datoer) }));
}
