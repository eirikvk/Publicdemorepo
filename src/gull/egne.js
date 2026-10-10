/* Gull for egne områder: hva som ligger i hvert område, og radene som sammenligner kommuneplanen alene med kommuneplanen og egne
   områder. Arealer er i km², andeler i prosent. */
import { RUTE } from '../solv/felles.js';
import { andel } from './felles.js';

/* Hva som ligger i et eget område i dag, i km², fra tellingen T i planrutenettet. ukjent er ruter der kartet ikke er hentet eller
   som ligger utenfor kommunen. smal sier at området tar natur eller jordbruk i planrutenettet, men at alt faller for regelen om
   smale striper. */
export const byggEgetOmrade = T => ({
  kjent: !!(T.nat + T.jor + T.beb + T.vann),
  natur: T.nat * RUTE,
  jordbruk: T.jor * RUTE,
  bebygd: T.beb * RUTE,
  vann: T.vann * RUTE,
  ukjent: T.ukjent * RUTE,
  smal: !!(T.nat + T.jor) && !(T.nnat + T.njor)
});

/* Radene i sammenligningen mellom kommuneplanen og egne områder. e er null for hele kommunen, ellers nummeret til området, og T er
   tallene for det området. R er planrutenettet, GK kryssingen med grått areal, tema temaene som er krysset med planen ({ navn, id,
   klasser, kryss }) og gap utbygging på natur som ikke er kartlagt. Hver rad er { navn, farge, gruppe, plan, ny, endring, andelPlan,
   andelNy }: planen alene (null uten kommuneplan), med egne områder og forskjellen i km², og andelen av det som finnes i dag i
   prosent der det er regnet ut. */
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
  return ut.concat(verdi).map(([navn, farge, plan, ny, av, gruppe]) => ({
    navn,
    farge,
    gruppe,
    plan: plan === null ? null : plan * RUTE,
    ny: ny * RUTE,
    endring: (ny - (plan || 0)) * RUTE,
    andelPlan: av && plan !== null ? andel(plan, av) : null,
    andelNy: av ? andel(ny, av) : null
  }));
}
