/* Sølv for datasettet «Areal satt av til framtidig utbygging i egne planer»: planene brukeren har tegnet eller lastet opp, etter
   mønsteret fra kommuneplanen. Dataene er hver plan per rute (solv.egneruter), i samme datamodell som kommuneplanen, men med
   «ikke utbygging» i tillegg, og én rad per plan. Støttedataene er flatene tolket til utbygging eller ikke (solv.egne), til kartet,
   og opplysningene om hver plan (solv.egneinfo). Kilden er bronse.egne, det brukeren har tegnet eller lastet opp, som datamotoren
   fyller. Gull slår planene sammen med kommuneplanen: en egen plan erstatter kommuneplanen der den ligger, og der planer overlapper,
   gjelder den siste (gull/utbygging.ts). */
import { overlapper, type Flerflate, type Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { HALV, ORIGO, PLANNIVA, arealKm2, ruteM, type Planruter } from './felles.ts';
import { hentFlate, sti, tegneflate } from './raster.ts';

/* Utbygging ('bygg') eller ikke utbygging ('fri') */
export type Type = 'bygg' | 'fri';
/* Én flate i et eget område: flaten, utsnittet og typen */
export interface Del {
  koord: Flerflate;
  ext: Utsnitt;
  type: Type;
}
/* Et eget område slik utbyggingen trenger det: flatene og utsnittet rundt dem */
export interface Flater {
  deler: Del[];
  ext: Utsnitt;
}
/* Tabellen solv.egne: de egne områdene i en kommune, i rekkefølge, med id (ider) og flatene med typen sin */
export interface Egne {
  ider: number[];
  flater: Flater[];
}
/* En flate i en opplastet plan, slik den leses i bronse/planfil.ts: arealformål og arealbruksstatus som sifre, eller tom tekst */
export interface Planflate {
  koord: Flerflate;
  ext: Utsnitt;
  formal: string;
  status: string;
}
/* Et eget område slik brukeren laget det, i tabellen bronse.egne: et tegnet område med typen brukeren har valgt, eller en opplastet
   plan med arealformål og status per flate (harFormal sier om filen har arealformål i det hele tatt), plan-id og projeksjonen filen
   var i */
export type Egetinn = { id: number; ext: Utsnitt } & (
  | { kilde: 'tegnet'; deler: Del[] }
  | { kilde: 'fil'; deler: Planflate[]; harFormal: boolean; planid?: string; proj?: string }
);

/* Om en flate i en opplastet plan er utbygging ('bygg') eller ikke ('fri'). Bebyggelse og anlegg og samferdsel (arealformål i
   1000- og 2000-serien) med status framtidig, eller uten status, er utbygging, slik som for kommuneplanen fra DiBK. Andre flater
   med arealformål er ikke utbygging. Har filen ingen arealformål i det hele tatt, er alle flatene utbygging. formal og status er
   sifrene i egenskapene, eller tom tekst. */
export const planType = (formal: string, status: string, harFormal: boolean): Type =>
  !harFormal || (/^[12]/.test(formal) && (status === '' || status === '2')) ? 'bygg' : 'fri';

/* Det samlede arealet av flatene, i km² */
export const samletKm2 = (deler: { koord: Flerflate; ext: Utsnitt }[]) =>
  deler.reduce((s, d) => s + arealKm2(d.koord, d.ext), 0);

/* Tabellen solv.egne: flatene i de egne planene i kommunen nr fra bronse.egne, med typen for hver flate. Tegnede områder har typen
   brukeren har valgt, og flatene i en opplastet plan får typen etter planType. Støttedata: tallene regnes av planene per rute
   (solv.egneruter), og flatene tegner planene i kartet med skarpe kanter (egneIFlis). */
export async function egne(nr: string): Promise<Egne> {
  const B = (await katalog.bronse.egne(nr)) || [];
  return {
    ider: B.map(g => g.id),
    flater: B.map(g => ({
      ext: g.ext,
      deler:
        g.kilde === 'tegnet'
          ? g.deler
          : g.deler.map(({ koord, ext, formal, status }) => ({
              koord,
              ext,
              type: planType(formal, status, g.harFormal)
            }))
    }))
  };
}

/* Én egen plan per rute (Planruter i felles.ts), i rutenettet for planen på nivå 10 (PLANNIVA) og over utsnittet rundt planen: plan er
   1 utbygging, 2 ikke utbygging og 0 utenfor planen. id er planens id i bronse.egne. */
export type Egenplan = Planruter & { id: number };
/* Tabellen solv.egneruter: de egne planene i kommunen nr per rute, én rad per plan i rekkefølgen brukeren laget dem. Tom uten egne
   planer. */
export async function egneruter(nr: string): Promise<Egenplan[]> {
  const E = await katalog.solv.egne(nr);
  return E.flater.map((g, k) => {
    const m = ruteM(PLANNIVA),
      cx0 = Math.floor((g.ext[0] - ORIGO[0]) / m),
      cy0 = Math.floor((ORIGO[1] - g.ext[3]) / m),
      w = Math.floor((g.ext[2] - ORIGO[0]) / m) - cx0 + 1,
      h = Math.floor((ORIGO[1] - g.ext[1]) / m) - cy0 + 1,
      R: Egenplan = { z: PLANNIVA, cx0, cy0, w, h, plan: new Uint8Array(w * h), id: E.ider[k] };
    tegnEget(g, R);
    return R;
  });
}

/* Opplysninger om en egen plan: id, om den er tegnet eller lastet opp, plan-id og projeksjonen for en opplastet plan, om filen har
   arealformål, antall flater, og arealet i km² av flatene som er utbygging og som ikke er det */
export interface Planinfo {
  id: number;
  kilde: 'tegnet' | 'fil';
  planid: string | null;
  proj: string | null;
  harFormal: boolean | null;
  flater: number;
  km2: { bygg: number; fri: number };
}
/* Tabellen solv.egneinfo: opplysningene om de egne planene i kommunen nr, i samme rekkefølge som solv.egneruter */
export async function egneinfo(nr: string): Promise<Planinfo[]> {
  const [B, E] = await Promise.all([katalog.bronse.egne(nr), katalog.solv.egne(nr)]);
  return (B || []).map((g, k) => {
    const D = E.flater[k].deler;
    return {
      id: g.id,
      kilde: g.kilde,
      planid: g.kilde === 'fil' ? g.planid || null : null,
      proj: g.kilde === 'fil' ? g.proj || null : null,
      harFormal: g.kilde === 'fil' ? g.harFormal : null,
      flater: D.length,
      km2: { bygg: samletKm2(D.filter(d => d.type === 'bygg')), fri: samletKm2(D.filter(d => d.type === 'fri')) }
    };
  });
}

/* En egen plan g inn i rutenettet R. En rute hører til planen når planen dekker minst halve ruta. Der flater i planen overlapper,
   vinner utbygging. */
function tegnEget(g: Flater, R: Planruter) {
  const u = g.ext,
    m = ruteM(R.z),
    X0 = Math.max(0, Math.floor((u[0] - ORIGO[0]) / m) - R.cx0),
    X1 = Math.min(R.w - 1, Math.floor((u[2] - ORIGO[0]) / m) - R.cx0),
    Y0 = Math.max(0, Math.floor((ORIGO[1] - u[3]) / m) - R.cy0),
    Y1 = Math.min(R.h - 1, Math.floor((ORIGO[1] - u[1]) / m) - R.cy0);
  if (X1 < X0 || Y1 < Y0) return;
  const B = 1024; /* området tegnes i biter på høyst 1024 x 1024 ruter */
  for (let y0 = Y0; y0 <= Y1; y0 += B)
    for (let x0 = X0; x0 <= X1; x0 += B) {
      const cw = Math.min(B, X1 - x0 + 1),
        ch = Math.min(B, Y1 - y0 + 1),
        vx = ORIGO[0] + (R.cx0 + x0) * m,
        oy = ORIGO[1] - (R.cy0 + y0) * m,
        bit: Utsnitt = [vx, oy - ch * m, vx + cw * m, oy];
      const deler = g.deler.filter(del => overlapper(del.ext, bit));
      if (!deler.length) continue;
      const k = tegneflate(cw, ch);
      for (const type of ['fri', 'bygg']) {
        k.fillStyle = type === 'bygg' ? '#f00' : '#0f0';
        for (const del of deler)
          if (del.type === type) {
            sti(k, del.koord, bit, 1 / m);
            k.fill('evenodd');
          }
      } /* utbygging tegnes sist og vinner der flater overlapper */
      const a = k.getImageData(0, 0, cw, ch).data;
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++) {
          const q = 4 * (y * cw + x);
          if (a[q + 3] < HALV) continue;
          R.plan[(y0 + y) * R.w + x0 + x] = a[q] > a[q + 1] ? 1 : 2;
        }
    }
}

/* De egne områdene E i en kartflis med utsnittet u, 512 x 512 piksler: 1 utbygging, 2 ikke utbygging, 0 utenfor. En piksel hører
   til en flate når flaten dekker minst halve pikselen, som for rutene (tegnEget), og utbygging vinner der flater overlapper. null når
   ingen flater ligger i flisen. Til kartet zoomet inn, der pikslene er mindre enn rutene. */
export function egneIFlis(E: Egne, u: Utsnitt): Uint8Array | null {
  const deler: Del[] = [];
  for (const g of E.flater)
    if (overlapper(g.ext, u)) for (const del of g.deler) if (overlapper(del.ext, u)) deler.push(del);
  if (!deler.length) return null;
  const k = hentFlate(512, 512),
    s = 512 / (u[2] - u[0]);
  for (const type of ['fri', 'bygg']) {
    k.fillStyle = type === 'bygg' ? '#f00' : '#0f0';
    for (const del of deler)
      if (del.type === type) {
        sti(k, del.koord, u, s);
        k.fill('evenodd');
      }
  }
  const a = k.getImageData(0, 0, 512, 512).data,
    ut = new Uint8Array(512 * 512);
  for (let i = 0, q = 0; i < a.length; i += 4, q++) if (a[i + 3] >= HALV) ut[q] = a[i] > a[i + 1] ? 1 : 2;
  return ut;
}
