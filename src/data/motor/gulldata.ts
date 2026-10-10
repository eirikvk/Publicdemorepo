/* Gull-data: det visningen spør etter, for valgt kommune. Én funksjon per ting en side eller kartet viser. Hver funksjon leser fra
   katalogen med kommunenummeret (les-gjennom: det som mangler, hentes og regnes ut) og lager svaret med gull. Det som er raskt å
   regne ut, regnes ut hver gang noen spør, og lagres ikke. Komponentene og kartet henter tallene herfra og bestemmer bare hvordan de
   vises. Fordi alt leses med nummeret til valgt kommune, kan ingenting fra en annen kommune vises. */
import type { Planopplysninger } from '../bronse/dibk-kommuneplan.ts';
import { byggEgetOmrade, byggEgneRader } from '../gull/egne.ts';
import { arealFraRuter, type Kommunebilde } from '../gull/felles.ts';
import { byggGraa, type Graakryss } from '../gull/graa.ts';
import { byggInon } from '../gull/inon.ts';
import { byggPlanSum, byggPlanlagt } from '../gull/planlagt.ts';
import { byggEndring, byggOppstilling, byggUtbredelse, landOgVann, type SsbTall } from '../gull/regnskap.ts';
import { byggNaturTall, type TemaData } from '../gull/temaer.ts';
import { ferdig, les, se, type Datasett, type Status } from './katalog.ts';
import {
  AREALTALL,
  GRAA,
  GRAAKRYSS,
  GRENSE,
  HISTORIE,
  INON,
  KARTLAGT,
  OVERSIKTSREGISTER,
  PLANINFO,
  PLANRUTENETT,
  TEMAAREAL,
  TEMAINNE,
  TEMAKRYSS,
  TEMAOMRADER,
  type Kommuneruter
} from './datasett.ts';
import { mine, utenPlan } from './egne.ts';
import { lagret, oversikt } from './grunnkart.ts';
import { NATURTEMA, type Naturtema } from './naturtema.ts';
import { graagrunnlag, ingenPlan, temagrunnlag } from './plan.ts';
import { app, type EgetOmrade } from './tilstand.ts';

const valgt = () => (app.valgt ? app.valgt.nr : null);
/* Verdien i datasettet d for valgt kommune når den er ferdig, ellers null */
function naa<V>(d: Datasett<string, V>): V | null {
  const nr = valgt();
  return nr ? ferdig(d, nr) : null;
}
/* Statusen for datasettet d i valgt kommune: henter, feil eller ok. null uten valgt kommune. */
function status<V>(d: Datasett<string, V>): Status | null {
  const nr = valgt(),
    e = nr ? les(d, nr) : null;
  return e ? e.status : null;
}

/* ---------- Kommunen ---------- */

/* Kommunegrensen: { nr, koord, ext, km2 } */
export const grense = () => naa(GRENSE);
export const grenseFeil = () => status(GRENSE) === 'feil';
/* Kommunens flate i km², land og vann. 0 til grensen er hentet. */
export const flate = () => {
  const g = grense();
  return g ? g.km2 : 0;
};
/* Tallene gjelder bare den delen av kommunen nettleseren har hentet kart for (kommuner uten lagret oversiktsbilde) */
export const bareHentetKart = () => {
  const o = oversikt();
  return !!o && !!o.dynamisk;
};
/* Registeret over lagrede oversiktsbilder: årsversjonen, når bildene er laget, og kommunene som har et */
export const oversiktsregister = () => ferdig(OVERSIKTSREGISTER, '');

/* ---------- SSB og utbredelsesregnskapet ---------- */

/* Landarealet i km², summen av de tre klassene fra SSB. 0 til tallene er hentet. */
export const land = () => {
  const T = naa(AREALTALL);
  return T ? T.land : 0;
};
/* Tallene fra SSB så langt de er hentet: tilstanden, og arealet per klasse (bebygd, jordbruk, natur) i km² og året */
export function arealtall(): SsbTall | null {
  const nr = valgt(),
    e = nr ? les(AREALTALL, nr) : null;
  if (!e) return null;
  return e.status === 'ok' ? { tilstand: 'ok', a: e.verdi!.a, aar: e.verdi!.aar } : { tilstand: e.status };
}
/* Innsjø og elv i km², fra SSB */
export const ferskvann = () => {
  const T = naa(AREALTALL);
  return T ? T.ferskvann : null;
};
/* Arealet per klasse i 2017 og i siste år */
export const historie = () => naa(HISTORIE);
export const utbredelse = () => byggUtbredelse(arealtall());
export const endring = () => byggEndring(historie());
export const oppstilling = () => byggOppstilling(historie());
export const landOgVannet = () => landOgVann(flate(), land(), ferskvann());

/* ---------- Kommuneplanen og planlagt utbygging ---------- */

/* Om DiBK har kommuneplanen: sjekker, feil, ok eller ingen, og når den finnes, dekningen og hvilken plan. null til grensen er
   hentet, for sjekken bruker den. */
export function planinfo(): {
  tilstand: 'sjekker' | 'feil' | 'ok' | 'ingen';
  dekning?: number;
  plan?: Planopplysninger | null;
} | null {
  const nr = valgt();
  if (!nr || status(GRENSE) !== 'ok') return null;
  const e = les(PLANINFO, nr)!;
  if (e.status === 'henter') return { tilstand: 'sjekker' };
  if (e.status === 'feil') return { tilstand: 'feil' };
  const P = e.verdi!;
  return { tilstand: P.finnes ? 'ok' : 'ingen', dekning: P.dekning, plan: P.plan };
}
/* Planrutenettet for valgt kommune: det siste som er regnet ut, også mens det regnes på nytt */
export function planrutenett() {
  const nr = valgt(),
    e = nr ? se(PLANRUTENETT, nr) : null;
  return e && e.verdi ? e.verdi : null;
}
/* Hvor langt utregningen av planlagt utbygging er kommet: tom (ingenting å regne på), zoom (zoom inn for å få kart), regner, feil
   eller ok */
export function planTall(): 'tom' | 'zoom' | 'regner' | 'feil' | 'ok' {
  const nr = valgt();
  if (!nr || status(GRENSE) !== 'ok' || utenPlan()) return 'tom';
  const e = se(PLANRUTENETT, nr);
  if (e) return e.status === 'henter' ? 'regner' : e.status;
  if (!oversikt()) return lagret(nr) ? 'tom' : 'zoom';
  return 'regner';
}
/* Natur og jordbruk satt av i km², til oversikten og regnskapet */
export const planSum = () => {
  const R = planrutenett();
  return R ? byggPlanSum(R) : null;
};
/* Det siden om utvikling fremover viser om planlagt utbygging, når det er regnet ut */
export const planlagt = () => {
  const R = planrutenett();
  return R && planTall() === 'ok' ? byggPlanlagt(R, land()) : null;
};

/* ---------- Inngrepsfri natur og grått areal ---------- */

/* Et bilde av hele kommunen fra datasettet d, slik gull vil ha det: tilstanden, og når det er hentet, rutene, arealet samlet (sum) og
   det ekstra skal gi av arealet per klasse i km² */
function kommunebildet<E, X>(
  d: Datasett<string, Kommuneruter<E>>,
  ekstra: (km2: number[]) => X
): Kommunebilde<Kommuneruter<E> & X> | null {
  const nr = valgt(),
    e = nr ? les(d, nr) : null;
  if (!nr || !e) return null;
  if (e.status !== 'ok') return { nr, tilstand: e.status };
  const S = e.verdi!,
    A = arealFraRuter(S.n, S.res, S.skala);
  return { ...S, ...ekstra(A.km2), nr, tilstand: 'ok', sum: A.sum };
}
/* Rutene for valgt kommune, til kartlagene: sonen og trinnet per rute */
export const inonRuter = () => naa(INON);
export const graaRuter = () => naa(GRAA);
/* Inngrepsfri natur: tilstanden, og arealet per sone og samlet */
export const inonbilde = () => kommunebildet(INON, km2 => ({ soner: km2 }));
/* Grått areal: tilstanden, og arealet per trinn og samlet */
export const graabilde = () => kommunebildet(GRAA, km2 => ({ trinn: km2 }));
/* Planlagt utbygging krysset med grått areal, når planrutenettet og grått areal finnes */
export function graaKryss(): Graakryss | null {
  const g = graagrunnlag();
  return g ? ferdig(GRAAKRYSS, g) : null;
}
/* Det temasidene, oversikten og kartet viser */
export const inonTall = () => byggInon(inonbilde(), land());
export const graaTall = () => byggGraa(graabilde(), graaKryss(), land());

/* ---------- Naturtemaene ---------- */

/* Kryssingen før den er regnet ut: ingen ruter med planlagt utbygging i n områder */
const ikkeKrysset = (n: number) => ({
  regnet: false,
  plan: new Int32Array(n),
  smal: new Int32Array(n),
  kryss: null,
  gap: null
});
/* Områdene i et naturtema i valgt kommune, slik de ligger i katalogen. Samme objekt så lenge temaet ikke hentes på nytt. */
export function temaomrader(tema: Naturtema) {
  const nr = valgt();
  return nr ? ferdig(TEMAOMRADER, { tema, nr }) : null;
}
/* Det kartlagte for naturtyper i valgt kommune, for temaer med kartleggingsgrad */
export const kartlagt = (tema: Naturtema) => (tema.dekning ? naa(KARTLAGT) : null);
/* Alt om et naturtema i valgt kommune: områdene, arealet, det kartlagte, og kryssingen med planen når den er regnet ut. null mens
   det hentes. */
export function temadata(tema: Naturtema): TemaData | null {
  const nr = valgt();
  if (!nr) return null;
  const x = { tema, nr },
    O = les(TEMAOMRADER, x)!,
    A = O.status === 'ok' ? les(TEMAAREAL, x)! : null;
  if (O.status === 'feil' || (A && A.status === 'feil'))
    return { nr, feil: true, omrader: [], sum: 0, ...ikkeKrysset(0) };
  if (!A || A.status !== 'ok') return null;
  const { omrader, ufullstendig } = O.verdi!,
    { sum, klasser } = A.verdi!,
    ekstra = tema.dekning ? kartlagt(tema) : undefined,
    inne = tema.dekning && tema.klasser ? ferdig(TEMAINNE, x) || undefined : undefined,
    K = temagrunnlag(tema),
    k = K ? ferdig(TEMAKRYSS, K) : null;
  return {
    nr,
    omrader,
    sum,
    klasser,
    ufullstendig,
    ekstra,
    inne,
    ...(k ? { ...k, regnet: true } : ikkeKrysset(omrader.length))
  };
}
/* Det en temaside og oversikten viser for et naturtema: dataene (D) og tallene fra gull (N). null mens det hentes. */
export function naturtemaet(tema: Naturtema) {
  const D = temadata(tema);
  return D ? { D, N: byggNaturTall(D, tema.klasser, !!tema.dekning, !!tema.samlet, land()) } : null;
}

/* ---------- Egne områder ---------- */

/* Planrutenettet når det er regnet ut med de egne områdene som finnes nå, ellers null */
export function egneRutenett() {
  const R = planrutenett(),
    E = mine();
  return R && R.eget && R.egneIder.join() === E.map(g => g.id).join() ? R : null;
}
/* Hva som ligger i et eget område, i ruter fra planrutenettet. null til området er regnet med. */
export function egetTall(g: EgetOmrade) {
  const R = planrutenett(),
    i = R ? R.egneIder.indexOf(g.id) : -1;
  return i < 0 ? null : R!.egneTall[i];
}
/* Hva som ligger i et eget område i dag, i km² */
export const egetOmrade = (g: EgetOmrade) => {
  const T = egetTall(g);
  return T ? byggEgetOmrade(T) : null;
};
/* Radene i sammenligningen mellom kommuneplanen og egne områder, for hele kommunen (e er null) eller ett område (e er nummeret i
   listen over egne områder): natur og jordbruk som går med, og hvor mye av det som ligger i grått areal, verneområder,
   villreinområder, verdsatt natur per verdi og natur som ikke er kartlagt. */
export function egneRader(e: number | null) {
  const R = planrutenett()!,
    tema = NATURTEMA.flatMap(t => {
      const D = temadata(t);
      return D && D.kryss && D.kryss.P && D.omrader.length
        ? [{ navn: t.navn, id: t.id, klasser: t.klasser, kryss: D.kryss }]
        : [];
    }),
    V = NATURTEMA.find(t => t.dekning),
    DV = V ? temadata(V) : null,
    g = e === null ? null : mine()[e];
  return byggEgneRader(e, g ? egetTall(g) : null, R, !ingenPlan(), graaKryss(), tema, DV ? DV.gap : null);
}
