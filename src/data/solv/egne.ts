/* Sølv for egne områder og opplastet plan: hvilke flater som regnes som utbygging (solv.egne), og de samme områdene som planen per
   rute (solv.egneruter), i samme datamodell som kommuneplanen. Kilden er bronse.egne, det brukeren har tegnet eller lastet opp, som
   datamotoren fyller. Gull avgjør at et eget område erstatter kommuneplanen der det ligger (gull/utbygging.ts). */
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
   plan med arealformål og status per flate (harFormal sier om filen har arealformål i det hele tatt) */
export type Egetinn = { id: number; ext: Utsnitt } & (
  { kilde: 'tegnet'; deler: Del[] } | { kilde: 'fil'; deler: Planflate[]; harFormal: boolean }
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

/* Tabellen solv.egne: de egne områdene i kommunen nr fra bronse.egne, med typen for hver flate. Tegnede områder har typen brukeren
   har valgt, og flatene i en opplastet plan får typen etter planType. */
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

/* Tabellen solv.egneruter: de egne områdene i kommunen nr som planen per rute (Planruter i felles.ts), i rutenettet for planen på
   nivå 10 (PLANNIVA) og over utsnittet rundt alle områdene. plan er 1 utbygging og 2 ikke utbygging, og omrade hvilket område ruta hører til (1 er det
   første i ider). null uten egne områder. */
export type Egneruter = Planruter & { omrade: Uint8Array; ider: number[] };
export async function egneruter(nr: string): Promise<Egneruter | null> {
  const E = await katalog.solv.egne(nr);
  if (!E.flater.length) return null;
  const Z = PLANNIVA,
    m = ruteM(Z),
    x0 = Math.min(...E.flater.map(g => g.ext[0])),
    y0 = Math.min(...E.flater.map(g => g.ext[1])),
    x1 = Math.max(...E.flater.map(g => g.ext[2])),
    y1 = Math.max(...E.flater.map(g => g.ext[3]));
  const cx0 = Math.floor((x0 - ORIGO[0]) / m),
    cy0 = Math.floor((ORIGO[1] - y1) / m),
    w = Math.floor((x1 - ORIGO[0]) / m) - cx0 + 1,
    h = Math.floor((ORIGO[1] - y0) / m) - cy0 + 1;
  const R: Egneruter = {
    z: Z,
    cx0,
    cy0,
    w,
    h,
    plan: new Uint8Array(w * h),
    omrade: new Uint8Array(w * h),
    ider: E.ider
  };
  E.flater.forEach((g, i) => tegnEget(g, i + 1, R));
  return R;
}

/* Et eget område g med nummeret merke inn i rutenettet R. En rute hører til området når området dekker minst halve ruta. Der
   flater i samme område overlapper, vinner utbygging. Der områder overlapper, gjelder det siste. */
function tegnEget(g: Flater, merke: number, R: Egneruter) {
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
          const i = (y0 + y) * R.w + x0 + x;
          R.omrade[i] = merke;
          R.plan[i] = a[q] > a[q + 1] ? 1 : 2;
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
