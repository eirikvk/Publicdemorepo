/* Gull for egne områder: hva som ligger i hvert område, og radene som sammenligner kommuneplanen alene med kommuneplanen og egne
   områder. Arealer er i km², andeler i prosent. */
import { katalog } from '../katalog.ts';
import { RUTE } from '../solv/felles.ts';
import type { EgetTall, Planrutenett } from '../solv/planrutenett.ts';
import { NATURTEMA } from '../solv/temaer.ts';
import { andel } from './felles.ts';
import type { Graakryss, Graatall } from './graa.ts';
import type { Gap, Kryss, Naturtemaet } from './temaer.ts';

/* Et tema krysset med planen, slik radene trenger det */
export interface TemaKryss {
  navn: string;
  id: string;
  klasser?: [navn: string, farge: string][];
  kryss: { S: Kryss; P: Kryss | null };
}
/* En rad i sammenligningen, se byggEgneRader */
export interface EgenRad {
  navn: string;
  farge: string;
  gruppe: string;
  plan: number | null;
  ny: number;
  endring: number;
  andelPlan: number | null;
  andelNy: number | null;
}
/* En rad før den regnes om: [navn, farge, planen i ruter, med egne i ruter, hva andelen regnes av, gruppe] */
type Rad = [navn: string, farge: string, plan: number | null, ny: number, av: number, gruppe: string];

/* Hva som ligger i et eget område i dag, i km², fra tellingen T i planrutenettet. ukjent er ruter der kartet ikke er hentet eller
   som ligger utenfor kommunen. smal sier at området tar natur eller jordbruk i planrutenettet, men at alt faller for regelen om
   smale striper. */
export const byggEgetOmrade = (T: EgetTall) => ({
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
const RADNAVN: Record<string, string> = { rein: 'Villreinområder' }; /* i tabellen står områdene, ikke temaet */
export function byggEgneRader(
  e: number | null,
  T: EgetTall | null,
  R: Planrutenett,
  harPlan: boolean,
  GK: Graakryss | null,
  tema: TemaKryss[],
  gap: Gap | null | undefined
): EgenRad[] {
  const ut: Rad[] = [];
  ut.push([
    'Natur',
    'pnat',
    harPlan ? (T ? T.fnat : R.basis!.rn) : null,
    T ? T.nnat : R.sum.rn,
    e === null ? R.iDag.nat : 0,
    ''
  ]);
  ut.push([
    'Jordbruk',
    'pjor',
    harPlan ? (T ? T.fjor : R.basis!.rj) : null,
    T ? T.njor : R.sum.rj,
    e === null ? R.iDag.jor : 0,
    ''
  ]);
  if (GK) {
    const x = (X: Graatall & { eg: Graatall[] }): Omit<Graatall, 'tot'> =>
      e === null ? X : X.eg[e] || { graa: 0, gron: 0, gront: 0 };
    ut.push(['Grått areal', 'graa2', harPlan ? x(GK.P).graa : null, x(GK.S).graa, 0, '']);
    ut.push(['– minst halvt grønt', '', harPlan ? x(GK.P).gron : null, x(GK.S).gron, 0, '']);
    ut.push(['Grønt i bebygd', 'gront', harPlan ? x(GK.P).gront : null, x(GK.S).gront, 0, '']);
  }
  const verdi: Rad[] = [],
    ruter = (X: Kryss, v: number) => (e === null ? X.alt[v] : X.eg[e] ? X.eg[e][v] : 0);
  for (const t of tema) {
    const K = t.kryss;
    if (t.klasser)
      t.klasser.forEach(([navn, id], v) =>
        verdi.push([navn, id, harPlan ? ruter(K.P!, v) : null, ruter(K.S, v), 0, 'Av dette i verdsatt natur'])
      );
    else ut.push([RADNAVN[t.id] || t.navn, t.id, harPlan ? ruter(K.P!, 0) : null, ruter(K.S, 0), 0, 'Av dette i']);
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

/* Tabellen gull.egneRader: sammenligningen mellom kommuneplanen og egne områder i kommunen nr, når planrutenettet er regnet ut med
   egne områder. kommune er radene for hele kommunen, og omrader per eget område (id) hva som ligger der i dag og radene for området.
   Grått areal og temaene som ikke kan hentes, står ikke med. */
export interface EgneRader {
  kommune: EgenRad[];
  omrader: { id: number; omrade: ReturnType<typeof byggEgetOmrade>; rader: EgenRad[] }[];
}
export async function egneRader(nr: string): Promise<EgneRader | null> {
  const R = katalog.solv.planrutenett.naa(nr);
  if (!R || !R.eget) return null;
  const ikke = () => null,
    [GK, ...temaene] = await Promise.all([
      katalog.gull.graakryss(nr).catch(ikke),
      katalog.gull.verneomrader(nr).catch(ikke),
      katalog.gull.villrein(nr).catch(ikke),
      katalog.gull.verdsattNatur(nr).catch(ikke)
    ]),
    info = katalog.solv.planinfo.naa(nr),
    harPlan = !info || info.finnes;
  const tema = NATURTEMA.flatMap((t, i) => {
      const D = (temaene[i] as Naturtemaet | null)?.D;
      return D && D.kryss && D.kryss.P && D.omrader.length
        ? [{ navn: t.navn, id: t.id, klasser: t.klasser, kryss: D.kryss }]
        : [];
    }),
    V = NATURTEMA.findIndex(t => t.dekning),
    gap = V < 0 ? null : (temaene[V] as Naturtemaet | null)?.D.gap;
  return {
    kommune: byggEgneRader(null, null, R, harPlan, GK as Graakryss | null, tema, gap),
    omrader: R.egneIder.map((id, i) => ({
      id,
      omrade: byggEgetOmrade(R.egneTall[i]),
      rader: byggEgneRader(i, R.egneTall[i], R, harPlan, GK as Graakryss | null, tema, gap)
    }))
  };
}
