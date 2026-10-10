/* Sølv for egne områder og opplastet plan: hvilke flater som regnes som utbygging, og hvordan de legges inn i planrutenettet, så de
   kan brukes sammen med kommuneplanen. */
import { overlapper, type Flerflate, type Utsnitt } from '../generelt/geometri.ts';
import { HALV, ORIGO, arealKm2 } from './felles.ts';
import { sti, tegneflate } from './raster.ts';

/* Utbygging ('bygg') eller ikke utbygging ('fri') */
export type Type = 'bygg' | 'fri';
/* Én flate i et eget område: flaten, utsnittet og typen */
export interface Del {
  koord: Flerflate;
  ext: Utsnitt;
  type: Type;
}
/* Et eget område slik planrutenettet trenger det: flatene og utsnittet rundt dem */
export interface Flater {
  deler: Del[];
  ext: Utsnitt;
}
/* En flate i en opplastet plan, slik den leses i bronse/planfil.ts: arealformål og arealbruksstatus som sifre, eller tom tekst */
export interface Planflate {
  koord: Flerflate;
  ext: Utsnitt;
  formal: string;
  status: string;
}

/* Om en flate i en opplastet plan er utbygging ('bygg') eller ikke ('fri'). Bebyggelse og anlegg og samferdsel (arealformål i
   1000- og 2000-serien) med status framtidig, eller uten status, er utbygging, slik som for kommuneplanen fra DiBK. Andre flater
   med arealformål er ikke utbygging. Har filen ingen arealformål i det hele tatt, er alle flatene utbygging. formal og status er
   sifrene i egenskapene, eller tom tekst. */
export const planType = (formal: string, status: string, harFormal: boolean): Type =>
  !harFormal || (/^[12]/.test(formal) && (status === '' || status === '2')) ? 'bygg' : 'fri';

/* Flatene i en opplastet plan, som de leses i bronse/planfil.ts, gjort om til egne områder: hver flate får type etter planType.
   Gir flatene, det samlede arealet i km², og hvor mange som er utbygging og ikke. */
export function planflater(deler: Planflate[], harFormal: boolean) {
  let km2 = 0;
  const ut = deler.map(({ koord, ext, formal, status }): Del => {
    km2 += arealKm2(koord, ext);
    return { koord, type: planType(formal, status, harFormal), ext };
  });
  const bygg = ut.filter(d => d.type === 'bygg').length;
  return { deler: ut, km2, bygg, annet: ut.length - bygg };
}

/* Et eget område eller en opplastet plan inn i planrutenettet. g har delene { koord, ext, type }, merke er områdets nummer, d er
   rutenettet for planlagt utbygging, kl dagens klasser og eget hvilket område hver rute hører til. G er rutenettets plassering
   { cx0, cy0, w, h, m } og typen per rute (G.type: 1 utbygging, 2 ikke utbygging).
   En rute hører til området når området dekker minst halve ruta. Som utbygging tar området all natur og alt jordbruk i ruta. Som
   ikke utbygging fjerner det planlagt utbygging der. Der flater overlapper, vinner utbygging. Endrer d, eget og G.type. */
export function leggInnEget(
  g: Flater,
  merke: number,
  d: Uint8Array,
  kl: Uint8Array,
  eget: Uint8Array,
  G: { cx0: number; cy0: number; w: number; h: number; m: number; type: Uint8Array }
) {
  const u = g.ext,
    m = G.m,
    X0 = Math.max(0, Math.floor((u[0] - ORIGO[0]) / m) - G.cx0),
    X1 = Math.min(G.w - 1, Math.floor((u[2] - ORIGO[0]) / m) - G.cx0),
    Y0 = Math.max(0, Math.floor((ORIGO[1] - u[3]) / m) - G.cy0),
    Y1 = Math.min(G.h - 1, Math.floor((ORIGO[1] - u[1]) / m) - G.cy0);
  if (X1 < X0 || Y1 < Y0) return;
  const B = 1024; /* området tegnes i biter på høyst 1024 x 1024 ruter */
  for (let y0 = Y0; y0 <= Y1; y0 += B)
    for (let x0 = X0; x0 <= X1; x0 += B) {
      const cw = Math.min(B, X1 - x0 + 1),
        ch = Math.min(B, Y1 - y0 + 1),
        vx = ORIGO[0] + (G.cx0 + x0) * m,
        oy = ORIGO[1] - (G.cy0 + y0) * m,
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
          const i = (y0 + y) * G.w + x0 + x,
            kls = kl[i];
          eget[i] = merke;
          G.type[i] = a[q] > a[q + 1] ? 1 : 2;
          if (a[q] > a[q + 1]) {
            if (kls === 3) d[i] = 1;
            else if (kls === 2) d[i] = 2;
          } else if (d[i] === 1 || d[i] === 2) d[i] = 0;
        }
    }
}
