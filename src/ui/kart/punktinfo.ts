/* Detaljene for punktet man trykket på i kommunen, som i et oppslag i et vanlig GIS, gruppert per kartlag. punktinfo lager gruppene
   med det kartet og katalogen alt vet om punktet når man trykker, uten å hente noe: dagens arealklasse og planlagt utbygging (lest
   av kartlagene, se trykk.ts), kommuneplanen, egne områder, områdene i naturtemaene med egenskapene slik Miljødirektoratet ga dem,
   det kartlagte, inngrepsfri natur, grått areal, og punktet selv: kommunen og koordinatene. Naturtemaene er med også når laget ikke
   vises, så lenge de er hentet. medKildene legger til det som slås opp hos kildene når detaljene vises: grunnkartet fra NIBIO,
   flatene i kommuneplanen fra DiBK, sonen for inngrepsfri natur og alle feltene for områdene i naturtemaene. Grått areal har ingen
   egenskaper å slå opp. Detaljene vises under kartet når brukeren har slått dem på (Punktdetaljer.tsx). */
import type { Coordinate } from 'ol/coordinate.js';
import { les, se, type Rad, type Tabelldef } from '../../data/cache.ts';
import { iFlate, type Utsnitt } from '../../data/generelt/geometri.ts';
import { TEMATABELLER, katalog } from '../../data/katalog.ts';
import { mine } from '../../data/motor/egne.ts';
import { app } from '../../data/motor/tilstand.ts';
import { planType, type Del, type Planflate } from '../../data/solv/egne.ts';
import { AREALBRUKSSTATUS, KP_AREALFORMAL, medNavn } from '../../data/solv/kodelister.ts';
import type { Punktflate } from '../../data/solv/punkt.ts';
import { UTM, bitVed, type Flis } from '../../data/solv/felles.ts';
import { GRAATRINN, graaVed } from '../../data/solv/graa.ts';
import { INONSONER, UTENFOR, soneVed } from '../../data/solv/inon.ts';
import { NATURTEMA } from '../../data/solv/temaer.ts';
import { dekar, nf, periode } from '../tekst.ts';
import type { Oppslag, Punktinfo, Punktlag } from '../tilstand.ts';
import { ol } from './ol.ts';

const innenfor = (c: Coordinate, e: Utsnitt) => c[0] >= e[0] && c[0] <= e[2] && c[1] >= e[1] && c[1] <= e[3];
/* Verdien i tabellen t for valgt kommune når den er hentet, uten å hente noe */
const hentet = <V>(t: Tabelldef<string, V>) => {
  const r = app.valgt ? se(t, app.valgt.nr) : null;
  return r && r.status === 'ok' ? (r.verdi as V) : null;
};
/* En egenskap fra kilden som tekst: datoer (tall i felt som heter noe med dato) som dato, tomme felt som null */
function tekstAv(navn: string, v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && /dato/i.test(navn) && v > 1e11)
    return new Date(v).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC'
    });
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : nf(v, 2);
  return String(v);
}

/* Detaljene for punktet c. klasse er dagens arealklasse i punktet og plan om det er planlagt utbygging på natur eller jordbruk der,
   begge lest av kartlagene, eller null. */
export function punktinfo(c: Coordinate, klasse: string | null, plan: string | null): Punktinfo {
  const lag: Punktlag[] = [];
  lag.push({
    tittel: 'Dagens arealklasse',
    rader: klasse ? [['Klasse', klasse]] : [],
    kilde: 'NIBIO, grunnkart for arealanalyse',
    oppslag: { hva: 'grunnkart' }
  });
  if (plan) {
    const info = hentet(katalog.solv.planinfo),
      p = info && info.plan;
    lag.push({
      tittel: 'Planlagt utbygging',
      rader: [
        ['På', plan],
        ...(p ? ([['Kommuneplan', `${p.id}${p.vert ? ', ' + p.vert : ''}`]] as [string, string][]) : [])
      ],
      kilde: 'Kommuneplanen fra DiBK, eller et eget område'
    });
  }
  lag.push({ tittel: 'Kommuneplanen', rader: [], kilde: 'DiBK, arealdelen', oppslag: { hva: 'plan' } });
  /* Egne områder: hver flate som dekker punktet */
  for (const g of mine())
    for (const d of g.deler as (Del | Planflate)[]) {
      if (!innenfor(c, d.ext) || !iFlate(c, d.koord)) continue;
      const fil = g.kilde === 'fil' ? (d as Planflate) : null,
        type = fil ? planType(fil.formal, fil.status, g.kilde === 'fil' && g.harFormal) : (d as Del).type,
        rader: [string, string][] = fil
          ? [
              ['Arealformål', fil.formal ? medNavn(fil.formal, KP_AREALFORMAL) : '–'],
              ['Arealbruksstatus', fil.status ? medNavn(fil.status, AREALBRUKSSTATUS) : '–']
            ]
          : [];
      rader.push(['Regnes som', type === 'bygg' ? 'utbygging' : 'ikke utbygging']);
      lag.push({ tittel: g.navn, rader, kilde: fil ? 'Opplastet plan' : 'Eget område, tegnet', flate: d.koord });
    }
  /* Naturtemaene: hvert område som dekker punktet, med egenskapene fra kilden */
  for (const t of NATURTEMA) {
    const O = hentet(TEMATABELLER[t.id].omrader);
    if (!O) continue;
    O.omrader.forEach((o, nr) => {
      if (!innenfor(c, o.ext) || !iFlate(c, o.koord)) return;
      const felt = Object.entries(o.egenskaper).flatMap(([navn, v]): [string, string][] => {
          const s = tekstAv(navn, v);
          return s === null ? [] : [[navn, s]];
        }),
        id = o.egenskaper.OBJECTID;
      lag.push({
        tittel: o.navn,
        rader: [[o.uklippet || t.samlet ? 'Areal' : 'Areal i kommunen', dekar(o.km2)]],
        felt,
        kilde: `${t.navn}, Miljødirektoratet`,
        lenke: o.url ? { tekst: 'Faktaark', url: o.url } : undefined,
        omrade: { tema: t.id, nr },
        flate: o.koord,
        oppslag: typeof id === 'number' ? { hva: 'tema', tema: t.id, id } : undefined
      });
    });
  }
  /* Det kartlagte for naturtyper */
  const K = hentet(katalog.solv.kartlagt);
  if (K && K.flate)
    lag.push({
      tittel: 'Kartlagt for naturtyper',
      rader: [
        ['Etter Miljødirektoratets instruks', iFlate(c, K.flate) ? 'ja' : 'nei'],
        ...(K.fra ? ([['Kartlagt i kommunen', periode(K.fra, K.til!)]] as [string, string][]) : [])
      ],
      kilde: 'Miljødirektoratet'
    });
  /* Inngrepsfri natur og grått areal: ruta i biten punktet ligger i, når temaet er talt for kommunen og biten er hentet */
  const hentetBit = <V>(t: Tabelldef<Flis, V>) => {
    const r = se(t, bitVed(c));
    return r && r.status === 'ok' ? (r.verdi as V) : null;
  };
  const I = hentet(katalog.solv.inon) ? hentetBit(katalog.solv.inonbit) : null;
  if (I) {
    const s = soneVed(I, c[0], c[1]);
    lag.push({
      tittel: 'Inngrepsfri natur',
      rader: [
        [
          'Sone',
          s === UTENFOR ? 'ingen, under 1 km fra tyngre tekniske inngrep' : `${INONSONER[s][4]}, ${INONSONER[s][3]}`
        ]
      ],
      kilde: 'Miljødirektoratet',
      oppslag: s === UTENFOR ? undefined : { hva: 'inon' }
    });
  }
  const G = hentet(katalog.solv.graa) ? hentetBit(katalog.solv.graabit) : null;
  if (G) {
    const trinn = graaVed(G, c[0], c[1]);
    lag.push({
      tittel: 'Grått areal',
      rader: [
        [
          'Trinn',
          !trinn
            ? 'ikke grått areal'
            : trinn === 6
              ? 'grått, uten oppgitt andel vegetasjon'
              : GRAATRINN[trinn - 1][1].toLowerCase()
        ]
      ],
      kilde: 'Kart over grå arealer, NIBIO m.fl.'
    });
  }
  /* Punktet: kommunen og koordinatene */
  const [lon, lat] = ol.proj.transform(c, UTM, 'EPSG:4326');
  lag.push({
    tittel: 'Punktet',
    rader: [
      ...(app.valgt ? ([['Kommune', `${app.valgt.navn} (${app.valgt.nr})`]] as [string, string][]) : []),
      ['UTM sone 33 (EPSG:25833)', `Ø ${Math.round(c[0])}, N ${Math.round(c[1])}`],
      ['Grader (WGS 84)', `${lat.toFixed(5)}, ${lon.toFixed(5)}`]
    ]
  });
  return { koord: [c[0], c[1]], lag };
}

/* Raden for oppslaget o i punktet p. Starter hentingen når den ikke er gjort. */
const oppslagRad = (o: Oppslag, p: number[]): Rad<Punktflate[]> | null =>
  o.hva === 'tema'
    ? les(katalog.solv.temaegenskaper, [o.tema, o.id])
    : les(
        o.hva === 'plan'
          ? katalog.solv.planIPunkt
          : o.hva === 'grunnkart'
            ? katalog.solv.grunnkartIPunkt
            : katalog.solv.inonIPunkt,
        p
      );
/* Gruppene i detaljene P med det kildene har svart: kommuneplanen blir én gruppe per flate i punktet, områdene i naturtemaene får
   alle feltene, og grunnkartet og inngrepsfri natur får feltene lagt til. Det som ikke har svart, sier henter eller feil. Henter det
   som mangler, så det skal bare kalles når detaljene vises. */
export function medKildene(P: Punktinfo): Punktlag[] {
  return P.lag.flatMap((L): Punktlag[] => {
    if (!L.oppslag) return [L];
    const r = oppslagRad(L.oppslag, P.koord);
    if (!r || r.status === 'henter') return [{ ...L, henter: true }];
    if (r.status === 'feil') return [{ ...L, feil: true }];
    const F = r.verdi || [];
    if (L.oppslag.hva === 'plan')
      return F.length
        ? F.map(f => ({ ...L, felt: f.felt, flate: f.flate }))
        : [{ ...L, rader: [['Arealformål', 'ingen flate i kommuneplanen her']] }];
    if (L.oppslag.hva === 'tema') return [F.length ? { ...L, felt: F[0].felt } : L];
    return [{ ...L, felt: [...(L.felt || []), ...F.flatMap(f => f.felt)] }];
  });
}
/* Flatene i punktet som er kjent nå, til omrisset i kartet: egne områder, områdene i naturtemaene og flatene i kommuneplanen når
   DiBK har svart. Henter ingenting. */
export function kjenteFlater(P: Punktinfo) {
  const plan = se(katalog.solv.planIPunkt, P.koord),
    D = plan && plan.status === 'ok' ? plan.verdi || [] : [];
  return [...P.lag.flatMap(L => (L.flate ? [L.flate] : [])), ...D.flatMap(f => (f.flate ? [f.flate] : []))];
}
