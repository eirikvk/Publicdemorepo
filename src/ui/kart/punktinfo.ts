/* Detaljene for punktet man trykket på i kommunen: alt kartet og katalogen alt vet om punktet, gruppert per kartlag, som i et
   oppslag i et vanlig GIS. Ingenting hentes for dette. Gruppene er dagens arealklasse og planlagt utbygging (lest av kartlagene, se
   trykk.ts), egne områder, områdene i naturtemaene med egenskapene slik Miljødirektoratet ga dem, det kartlagte, inngrepsfri natur,
   grått areal, og punktet selv: kommunen og koordinatene. Naturtemaene er med også når laget ikke vises, så lenge de er hentet. Detaljene vises under
   kartet når brukeren har slått dem på (Punktdetaljer.tsx). */
import type { Coordinate } from 'ol/coordinate.js';
import { se, type Tabelldef } from '../../data/cache.ts';
import { iFlate, type Utsnitt } from '../../data/generelt/geometri.ts';
import { TEMATABELLER, katalog } from '../../data/katalog.ts';
import { mine } from '../../data/motor/egne.ts';
import { app } from '../../data/motor/tilstand.ts';
import { planType, type Del, type Planflate } from '../../data/solv/egne.ts';
import { UTM, type Rutebilde } from '../../data/solv/felles.ts';
import { GRAATRINN, graaVed } from '../../data/solv/graa.ts';
import { INONSONER, UTENFOR } from '../../data/solv/inon.ts';
import { NATURTEMA } from '../../data/solv/temaer.ts';
import { dekar, nf, periode } from '../tekst.ts';
import type { Punktinfo, Punktlag } from '../tilstand.ts';
import { ol } from './ol.ts';

const innenfor = (c: Coordinate, e: Utsnitt) => c[0] >= e[0] && c[0] <= e[2] && c[1] >= e[1] && c[1] <= e[3];
/* Plassen til punktet c i rutenettet R, eller -1 utenfor */
function rute(R: Rutebilde, c: Coordinate) {
  const x = Math.floor((c[0] - R.u[0]) / R.res),
    y = Math.floor((R.u[3] - c[1]) / R.res);
  return x < 0 || y < 0 || x >= R.w || y >= R.h ? -1 : y * R.w + x;
}
/* Verdien i tabellen t for valgt kommune når den er hentet, uten å hente noe */
const hentet = <V>(t: Tabelldef<string, V>) => {
  const r = app.valgt ? se(t, app.valgt.nr) : null;
  return r && r.status === 'ok' ? (r.verdi as V) : null;
};
/* En egenskap fra kilden som tekst: datoer (tall i felt som heter noe med dato) som dato, tomme felt som null */
function tekstAv(navn: string, v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && /dato/i.test(navn) && v > 1e11) return new Date(v).toLocaleDateString('nb-NO');
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : nf(v, 2);
  return String(v);
}

/* Detaljene for punktet c. klasse er dagens arealklasse i punktet og plan om det er planlagt utbygging på natur eller jordbruk der,
   begge lest av kartlagene, eller null. */
export function punktinfo(c: Coordinate, klasse: string | null, plan: string | null): Punktinfo {
  const lag: Punktlag[] = [];
  if (klasse)
    lag.push({ tittel: 'Dagens arealklasse', rader: [['Klasse', klasse]], kilde: 'NIBIO, grunnkart for arealanalyse' });
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
  /* Egne områder: hver flate som dekker punktet */
  for (const g of mine())
    for (const d of g.deler as (Del | Planflate)[]) {
      if (!innenfor(c, d.ext) || !iFlate(c, d.koord)) continue;
      const fil = g.kilde === 'fil' ? (d as Planflate) : null,
        type = fil ? planType(fil.formal, fil.status, g.kilde === 'fil' && g.harFormal) : (d as Del).type,
        rader: [string, string][] = fil
          ? [
              ['Arealformål', fil.formal || '–'],
              ['Arealbruksstatus', fil.status || '–']
            ]
          : [];
      rader.push(['Regnes som', type === 'bygg' ? 'utbygging' : 'ikke utbygging']);
      lag.push({ tittel: g.navn, rader, kilde: fil ? 'Opplastet plan' : 'Eget område, tegnet' });
    }
  /* Naturtemaene: hvert område som dekker punktet, med egenskapene fra kilden */
  for (const t of NATURTEMA) {
    const O = hentet(TEMATABELLER[t.id].omrader);
    if (!O) continue;
    O.omrader.forEach((o, nr) => {
      if (!innenfor(c, o.ext) || !iFlate(c, o.koord)) return;
      const rader: [string, string][] = [[o.uklippet || t.samlet ? 'Areal' : 'Areal i kommunen', dekar(o.km2)]];
      for (const [navn, v] of Object.entries(o.egenskaper)) {
        const s = tekstAv(navn, v);
        if (s !== null) rader.push([navn, s]);
      }
      lag.push({
        tittel: o.navn,
        rader,
        kilde: `${t.navn}, Miljødirektoratet`,
        lenke: o.url ? { tekst: 'Faktaark', url: o.url } : undefined,
        omrade: { tema: t.id, nr }
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
  /* Inngrepsfri natur og grått areal: ruta i bildet av kommunen */
  const I = hentet(katalog.solv.inon);
  if (I) {
    const q = rute(I, c),
      s = q < 0 ? UTENFOR : I.sone[q];
    lag.push({
      tittel: 'Inngrepsfri natur',
      rader: [
        [
          'Sone',
          s === UTENFOR ? 'ingen, under 1 km fra tyngre tekniske inngrep' : `${INONSONER[s][4]}, ${INONSONER[s][3]}`
        ]
      ],
      kilde: 'Miljødirektoratet'
    });
  }
  const G = hentet(katalog.solv.graa);
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
