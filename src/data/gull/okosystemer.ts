/* Gull for grunnkartets økosystemtyper: de ferdige svarene om skog, våtmark, naturen i verneområdene og planlagt utbygging per
   økosystemtype, regnet ut av arealet per detaljklasse (gull/grunnkart.ts og gull/planlagt.ts). Hva som regnes som skog, våtmark og
   land, står i solv/klasser.ts. Alle arealer er i km², andeler i prosent. Økosystemtypene er hovedøkosystemene (HOVEDOKOSYSTEMER),
   med de samme navnene og i samme rekkefølge som i de syntetiske tabellene fra SSB (gull/syntetisk.ts), så tabellene kan
   sammenlignes. Foreløpig bruker bare tvillingen fra Figma dem. */
import { summen } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import {
  DETALJKLASSER,
  TRESLAGNAVN,
  UNDERLAGNAVN,
  erLand,
  erSkog,
  erVatmark,
  HOVEDOKOSYSTEMER,
  type Detaljklasse,
  type KlasseId,
  type Treslag,
  type Underlag
} from '../solv/klasser.ts';
import { andel } from './felles.ts';

/* Arealet av detaljklassene som passer, fra km² per detaljklasse */
export const arealAv = (km2: number[], passer: (k: Detaljklasse) => boolean) =>
  summen(DETALJKLASSER.map((k, i) => (passer(k) ? km2[i] : 0)));
/* Arealet per hovedøkosystem (økosystemtypene på nivå 1), med skogen samlet, i rekkefølgen i HOVEDOKOSYSTEMER, uten de som er 0 */
export interface Okosystemrad {
  kode: string;
  navn: string;
  gruppe: KlasseId;
  km2: number;
}
export function perOkosystem(km2: number[]): Okosystemrad[] {
  const m = new Map<string, number>();
  DETALJKLASSER.forEach((k, i) => m.set(k.okosystem, (m.get(k.okosystem) || 0) + km2[i]));
  return HOVEDOKOSYSTEMER.map(h => ({ ...h, km2: m.get(h.kode) || 0 })).filter(r => r.km2 > 0);
}

/* Skogen i kommunen: arealet, andelen av landarealet i grunnkartet, og arealet per treslag og per underlag */
export interface Skog {
  km2: number;
  andel: number | null;
  treslag: { id: Treslag; navn: string; km2: number }[];
  underlag: { id: Underlag; navn: string; km2: number }[];
}
/* Tabellen gull.skog: skogen i kommunen nr, av gull.detaljareal */
export async function skog(nr: string): Promise<Skog | null> {
  const D = await katalog.gull.detaljareal(nr);
  if (!D) return null;
  const km2 = arealAv(D.km2, erSkog);
  return {
    km2,
    andel: andel(km2, arealAv(D.km2, erLand)),
    treslag: TRESLAGNAVN.map(([id, navn]) => ({ id, navn, km2: arealAv(D.km2, k => k.treslag === id) })),
    underlag: UNDERLAGNAVN.map(([id, navn]) => ({ id, navn, km2: arealAv(D.km2, k => k.underlag === id) }))
  };
}

/* Våtmarken i kommunen: arealet (åpen våtmark og tresatt myr), andelen av landarealet i grunnkartet, og de to delene */
export interface Vatmark {
  km2: number;
  andel: number | null;
  apen: number;
  tresatt: number;
}
const vatmarkAv = (km2: number[]) => ({
  apen: arealAv(km2, k => k.id === 'vat'),
  tresatt: arealAv(km2, k => k.underlag === 'myr'),
  km2: arealAv(km2, erVatmark)
});
/* Tabellen gull.vatmark: våtmarken i kommunen nr, av gull.detaljareal */
export async function vatmark(nr: string): Promise<Vatmark | null> {
  const D = await katalog.gull.detaljareal(nr);
  if (!D) return null;
  const V = vatmarkAv(D.km2);
  return { ...V, andel: andel(V.km2, arealAv(D.km2, erLand)) };
}

/* Naturen i verneområdene: det vernede arealet samlet (sum), per økosystemtype, på land, i sjø og i ferskvann (innsjøer og elver),
   andelen vernet land av landarealet i grunnkartet, og skogen som er vernet */
export interface VernetNatur {
  sum: number;
  perOkosystem: { navn: string; km2: number }[];
  land: number;
  hav: number;
  ferskvann: number;
  andelLand: number | null;
  skog: number;
}
/* Tabellen gull.vernetNatur: naturen i verneområdene i kommunen nr, av gull.detaljerIVerneomrader og gull.detaljareal */
export async function vernetNatur(nr: string): Promise<VernetNatur | null> {
  const [V, D] = await Promise.all([katalog.gull.detaljerIVerneomrader(nr), katalog.gull.detaljareal(nr)]);
  if (!V || !D) return null;
  const land = arealAv(V.km2, erLand);
  return {
    sum: V.sum,
    perOkosystem: perOkosystem(V.km2),
    land,
    hav: arealAv(V.km2, k => k.id === 'hav'),
    ferskvann: arealAv(V.km2, k => k.id === 'inn' || k.id === 'elv'),
    andelLand: andel(land, arealAv(D.km2, erLand)),
    skog: arealAv(V.km2, erSkog)
  };
}

/* Planlagt utbygging per økosystemtype: radene (arealet satt av, og andelen av typen i kommunen), våtmarken som er satt av (åpen
   våtmark og tresatt myr), og om kommunen har planlagt utbygging i det hele tatt (ingenPlan) */
export interface PlanPerOkosystem {
  rader: { navn: string; km2: number; andel: number | null }[];
  vatmark: { km2: number; apen: number; tresatt: number };
  ingenPlan: boolean;
  delvis: boolean;
}
/* Tabellen gull.planPerOkosystem: planlagt utbygging i kommunen nr per økosystemtype, av gull.planlagtPerDetaljklasse og
   gull.detaljareal. Radene er alle typene natur og jordbruk, også de uten planlagt utbygging, i samme rekkefølge som tabellen over
   hva som er bygget ned. Planlagt utbygging der ingen detaljklasse passer, står som en egen rad. */
export async function planPerOkosystem(nr: string): Promise<PlanPerOkosystem | null> {
  const D = await katalog.gull.detaljareal(nr);
  if (!D) return null;
  const P = await katalog.gull.planlagtPerDetaljklasse(nr);
  if (!P) return { rader: [], vatmark: { km2: 0, apen: 0, tresatt: 0 }, ingenPlan: true, delvis: false };
  const plan = perOkosystem(P.km2),
    iDag = perOkosystem(D.km2),
    km2 = (R: Okosystemrad[], kode: string) => (R.find(x => x.kode === kode) || { km2: 0 }).km2,
    rader = HOVEDOKOSYSTEMER.filter(h => h.gruppe === 'jor' || h.gruppe === 'nat').map(h => ({
      navn: h.navn,
      km2: km2(plan, h.kode),
      andel: andel(km2(plan, h.kode), km2(iDag, h.kode))
    }));
  if (P.ukjent > 0) rader.push({ navn: 'Uten type i grunnkartet', km2: P.ukjent, andel: null });
  return { rader, vatmark: vatmarkAv(P.km2), ingenPlan: false, delvis: P.delvis };
}
