/* Gull for egne områder: sammenligningen mellom den gamle planen (kommuneplanen alene) og den nye (med egne områder eller en opplastet
   plan), for hele kommunen og for hvert eget område. Analysene er de samme som for kommuneplanen, regnet med de samme funksjonene for
   hvert utvalg av utbyggingen (Utvalg i gull/utbygging.ts): planlagt utbygging på natur og jordbruk (gull.planlagt), på grått areal
   (gull.graakryss), i verneområder, villreinområder og verdsatt natur (gull.verneomraderIPlan og de andre), utenfor det kartlagte
   (gull.utbyggingUtenforKartlagt) og per økosystemtype i grunnkartet (gull.planPerOkosystem). Her settes bare radene sammen, med
   forskjellen mellom planene. Arealer er i km², andeler i prosent. */
import { katalog } from '../katalog.ts';
import { ruteKm2 } from '../solv/felles.ts';
import { NATURTEMA } from '../solv/temaer.ts';
import type { Graakryss } from './graa.ts';
import type { PlanPerOkosystem } from './okosystemer.ts';
import type { Planlagt } from './planlagt.ts';
import type { TemaIPlan, UtenforKartlagt } from './temaer.ts';
import { utvalgsnokkel, type EgetTall, type Planvalg } from './utbygging.ts';

/* En rad i sammenligningen: navnet, fargen og gruppen den står i, enheten (km² eller antall), verdien i den gamle planen (null uten
   kommuneplan) og den nye, forskjellen, og andelen der analysen gir en */
export interface EgenRad {
  navn: string;
  farge: string;
  gruppe: string;
  enhet: 'km2' | 'antall';
  plan: number | null;
  ny: number;
  endring: number;
  andelPlan: number | null;
  andelNy: number | null;
}

/* Hva som ligger i et eget område i dag, i km², fra tellingen T i utbyggingen, med r km² per rute. ukjent er ruter der kartet ikke er
   hentet eller som ligger utenfor kommunen. smal sier at området tar natur eller jordbruk i den nye planen, men at alt faller for
   regelen om smale striper (fra gull.planlagt for området, P). */
export const byggEgetOmrade = (T: EgetTall, r: number, P: Planlagt | null) => ({
  kjent: !!(T.nat + T.jor + T.beb + T.vann),
  natur: T.nat * r,
  jordbruk: T.jor * r,
  bebygd: T.beb * r,
  vann: T.vann * r,
  ukjent: T.ukjent * r,
  smal: !!P && P.natur.medStriper + P.jordbruk.medStriper > 0 && !(P.natur.km2 + P.jordbruk.km2)
});

/* Analysene for ett utvalg: planlagt utbygging (P), grått areal (G), temaene (T: verneområder, villrein og verdsatt natur) og det
   som ikke er kartlagt (K). En analyse som ikke kan regnes ut (kilden kan ikke hentes), er null. */
interface Analysene {
  P: Planlagt | null;
  G: Graakryss | null;
  T: (TemaIPlan | null)[];
  K: UtenforKartlagt | null;
}
const ikke = () => null;
async function analysene(nr: string, plan: Planvalg, omrade: number | null): Promise<Analysene> {
  const n = utvalgsnokkel(nr, plan, omrade),
    [P, G, K, ...T] = await Promise.all([
      katalog.gull.planlagt(n),
      katalog.gull.graakryss(n).catch(ikke),
      katalog.gull.utbyggingUtenforKartlagt(n).catch(ikke),
      katalog.gull.verneomraderIPlan(n).catch(ikke),
      katalog.gull.villreinIPlan(n).catch(ikke),
      katalog.gull.verdsattNaturIPlan(n).catch(ikke)
    ]);
  return { P, G, K, T };
}

/* En rad slik den leses av analysene for ett utvalg: verdien og andelen, eller null når analysen mangler */
type Les<A> = (A: A) => { v: number; andel?: number | null } | null;
interface Raddef<A> {
  navn: string;
  farge: string;
  gruppe: string;
  enhet?: 'antall';
  les: Les<A>;
}
/* Radene fra radene i defs, med den gamle planen (gammel, null uten kommuneplan) og den nye (ny). En rad står med når den nye planen
   har analysen. */
function rader<A>(defs: Raddef<A>[], gammel: A | null, ny: A): EgenRad[] {
  return defs.flatMap(d => {
    const n = d.les(ny);
    if (!n) return [];
    const g = gammel ? d.les(gammel) : null,
      plan = gammel ? (g ? g.v : 0) : null;
    return [
      {
        navn: d.navn,
        farge: d.farge,
        gruppe: d.gruppe,
        enhet: d.enhet || 'km2',
        plan,
        ny: n.v,
        endring: n.v - (plan || 0),
        andelPlan: g && g.andel !== undefined ? g.andel : null,
        andelNy: n.andel !== undefined ? n.andel : null
      }
    ];
  });
}

/* Radene fra analysene, i rekkefølgen de vises: natur og jordbruk, grått areal, temaene, det som ikke er kartlagt, verdsatt natur per
   verdikategori, og hvor mange områder som berøres. RADNAVN er navnet på temaet i tabellen, der områdene står, ikke temaet. */
const RADNAVN: Record<string, string> = { rein: 'Villreinområder' };
const graa = (A: Analysene, f: (G: Graakryss) => number) => (A.G ? { v: f(A.G) * A.G.ruteKm2 } : null);
const tema = (t: number, f: (T: TemaIPlan) => number) => (A: Analysene) => {
  const T = A.T[t];
  return T && T.omrader.length ? { v: f(T) } : null;
};
const DEFS: Raddef<Analysene>[] = [
  { navn: 'Natur', farge: 'pnat', gruppe: '', les: A => A.P && { v: A.P.natur.km2, andel: A.P.natur.andel } },
  { navn: 'Jordbruk', farge: 'pjor', gruppe: '', les: A => A.P && { v: A.P.jordbruk.km2, andel: A.P.jordbruk.andel } },
  { navn: 'Grått areal', farge: 'graa2', gruppe: '', les: A => graa(A, G => G.tall.graa) },
  { navn: '– minst halvt grønt', farge: '', gruppe: '', les: A => graa(A, G => G.tall.gron) },
  { navn: 'Grønt i bebygd', farge: 'gront', gruppe: '', les: A => graa(A, G => G.tall.gront) },
  ...NATURTEMA.flatMap((t, i): Raddef<Analysene>[] =>
    t.klasser
      ? []
      : [{ navn: RADNAVN[t.id] || t.navn, farge: t.id, gruppe: 'Av dette i', les: tema(i, T => T.N.planKm2) }]
  ),
  { navn: 'Ikke kartlagt natur', farge: '', gruppe: 'Av dette i', les: A => A.K && { v: A.K.ukjentKm2 } },
  ...NATURTEMA.flatMap((t, i) =>
    (t.klasser || []).map(([navn, farge], v): Raddef<Analysene> => ({
      navn,
      farge,
      gruppe: 'Av dette i verdsatt natur',
      les: tema(i, T => (T.N.klasser ? T.N.klasser[v].planKm2 : 0))
    }))
  ),
  ...NATURTEMA.map((t, i): Raddef<Analysene> => ({
    navn: t.klasser ? 'Lokaliteter med verdsatt natur' : RADNAVN[t.id] || t.navn,
    farge: '',
    gruppe: 'Områder som berøres',
    enhet: 'antall',
    les: tema(i, T => T.N.berort)
  }))
];

/* Om kommunen har en kommuneplan hos DiBK å sammenligne med */
async function harPlan(nr: string) {
  const info = await katalog.solv.planinfo(nr).catch(ikke);
  return !info || info.finnes;
}

/* Tabellen gull.egneRader: sammenligningen mellom den gamle og den nye planen i kommunen nr, når utbyggingen er regnet ut med egne
   områder. kommune er radene for hele kommunen, og omrader per eget område (id) hva som ligger der i dag og radene for området. Det
   som ikke kan hentes (grått areal, temaene, det kartlagte), står ikke med. Planlagt utbygging per økosystemtype står i
   gull.egneOkosystemer, fordi grunnkartet med detaljklassene kan ta tid å hente. */
export interface EgneRader {
  kommune: EgenRad[];
  omrader: { id: number; omrade: ReturnType<typeof byggEgetOmrade>; rader: EgenRad[] }[];
}
export async function egneRader(nr: string): Promise<EgneRader | null> {
  const R = await katalog.gull.utbygging(nr);
  if (!R || !R.eget) return null;
  const plan = await harPlan(nr),
    sammenlign = async (o: number | null) => {
      const [g, n] = await Promise.all([plan ? analysene(nr, 'gammel', o) : null, analysene(nr, 'ny', o)]);
      return { rader: rader(DEFS, g, n), ny: n };
    },
    [kommune, ...omrader] = await Promise.all([null, ...R.egneIder.map((_, i) => i + 1)].map(sammenlign));
  return {
    kommune: kommune.rader,
    omrader: R.egneIder.map((id, i) => ({
      id,
      omrade: byggEgetOmrade(R.egneTall[i], ruteKm2(R.z), omrader[i].ny.P),
      rader: omrader[i].rader
    }))
  };
}

/* Tabellen gull.egneOkosystemer: planlagt utbygging per økosystemtype i grunnkartet i den gamle og den nye planen, for hele kommunen
   (kommune) og hvert eget område (omrader, i samme rekkefølge som i utbyggingen), fra gull.planPerOkosystem for hvert utvalg. Andelen
   er av typen i hele kommunen. null uten egne områder, eller når grunnkartet med detaljklassene ikke finnes for kommunen. */
export interface EgneOkosystemer {
  kommune: EgenRad[];
  omrader: EgenRad[][];
}
export async function egneOkosystemer(nr: string): Promise<EgneOkosystemer | null> {
  const R = await katalog.gull.utbygging(nr);
  if (!R || !R.eget) return null;
  const plan = await harPlan(nr),
    hent = (p: Planvalg, o: number | null) => katalog.gull.planPerOkosystem(utvalgsnokkel(nr, p, o)).catch(ikke),
    sammenlign = async (o: number | null) => {
      const [g, n] = await Promise.all([plan ? hent('gammel', o) : null, hent('ny', o)]);
      if (!n || n.ingenPlan) return null;
      const defs = n.rader.map(({ navn }): Raddef<PlanPerOkosystem> => ({
        navn,
        farge: '',
        gruppe: 'Per økosystemtype',
        les: P => {
          const x = P.rader.find(y => y.navn === navn);
          return x ? { v: x.km2, andel: x.andel } : { v: 0, andel: null };
        }
      }));
      return rader(defs, g && !g.ingenPlan ? g : plan ? { ...n, rader: [] } : null, n);
    },
    [kommune, ...omrader] = await Promise.all([null, ...R.egneIder.map((_, i) => i + 1)].map(sammenlign));
  if (!kommune) return null;
  return { kommune, omrader: omrader.map(o => o || []) };
}
