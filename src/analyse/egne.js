/* Egne områder og opplastet plan: hvilke flater som regnes som utbygging, hvordan de legges inn i planrutenettet, og radene som
   sammenligner kommuneplanen alene med kommuneplanen og egne områder. */
import { HALV, ORIGO, overlapper } from './felles.js';
import { sti, tegneflate } from './raster.js';

/* Om en flate i en opplastet plan er utbygging ('bygg') eller ikke ('fri'). Bebyggelse og anlegg og samferdsel (arealformål i
   1000- og 2000-serien) med status framtidig, eller uten status, er utbygging, slik som for kommuneplanen fra DiBK. Andre flater
   med arealformål er ikke utbygging. Har filen ingen arealformål i det hele tatt, er alle flatene utbygging. formal og status er
   sifrene i egenskapene, eller tom tekst. */
export const planType = (formal, status, harFormal) =>
  !harFormal || (/^[12]/.test(formal) && (status === '' || status === '2')) ? 'bygg' : 'fri';

/* Et eget område eller en opplastet plan inn i planrutenettet. g har delene { koord, ext, type }, merke er områdets nummer, d er
   rutenettet for planlagt utbygging, kl dagens klasser og eget hvilket område hver rute hører til. G er rutenettets plassering
   { cx0, cy0, w, h, m } og typen per rute (G.type: 1 utbygging, 2 ikke utbygging).
   En rute hører til området når området dekker minst halve ruta. Som utbygging tar området all natur og alt jordbruk i ruta. Som
   ikke utbygging fjerner det planlagt utbygging der. Der flater overlapper, vinner utbygging. Endrer d, eget og G.type. */
export function leggInnEget(g, merke, d, kl, eget, G) {
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
        bit = [vx, oy - ch * m, vx + cw * m, oy];
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

/* Radene i sammenligningen mellom kommuneplanen og egne områder. e er null for hele kommunen, ellers nummeret til området, og T er
   tallene for det området. R er planrutenettet, GK kryssingen med grått areal, tema temaene som er krysset med planen ({ navn, id,
   klasser, kryss }) og gap utbygging på natur som ikke er kartlagt. Hver rad er [navn, farge, planen alene, med egne områder, hva
   andelen regnes av, gruppe], med tallene i ruter. */
export function byggEgneRader(e, T, R, harPlan, GK, tema, gap) {
  const ut = [];
  ut.push([
    'Natur',
    'pnat',
    harPlan ? (T ? T.fnat : R.basis.rn) : null,
    T ? T.nnat : R.sum.rn,
    e === null ? R.iDag.nat : 0,
    ''
  ]);
  ut.push([
    'Jordbruk',
    'pjor',
    harPlan ? (T ? T.fjor : R.basis.rj) : null,
    T ? T.njor : R.sum.rj,
    e === null ? R.iDag.jor : 0,
    ''
  ]);
  if (GK) {
    const x = X => (e === null ? X : X.eg[e] || { graa: 0, gron: 0, gront: 0 });
    ut.push(['Grått areal', 'graa2', harPlan ? x(GK.P).graa : null, x(GK.S).graa, 0, '']);
    ut.push(['– minst halvt grønt', '', harPlan ? x(GK.P).gron : null, x(GK.S).gron, 0, '']);
    ut.push(['Grønt i bebygd', 'gront', harPlan ? x(GK.P).gront : null, x(GK.S).gront, 0, '']);
  }
  const verdi = [],
    ruter = (X, v) => (e === null ? X.alt[v] : X.eg[e] ? X.eg[e][v] : 0);
  for (const t of tema) {
    const K = t.kryss;
    if (t.klasser)
      t.klasser.forEach(([navn, id], v) =>
        verdi.push([navn, id, harPlan ? ruter(K.P, v) : null, ruter(K.S, v), 0, 'Av dette i verdsatt natur'])
      );
    else ut.push([t.navn, t.id, harPlan ? ruter(K.P, 0) : null, ruter(K.S, 0), 0, 'Av dette i']);
  }
  if (gap && gap.plan)
    ut.push([
      'Ikke kartlagt natur',
      '',
      harPlan ? (e === null ? gap.plan.ukjent : gap.plan.eg[e] ? gap.plan.eg[e].ukjent : 0) : null,
      e === null ? gap.ukjent : gap.eg[e] ? gap.eg[e].ukjent : 0,
      0,
      'Av dette i'
    ]);
  return ut.concat(verdi);
}
