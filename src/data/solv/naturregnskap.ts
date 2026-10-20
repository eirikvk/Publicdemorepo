/* Sølv, datasettet «Syntetisk naturregnskap fra SSB»: SSBs to tabeller for naturregnskapet, per kommune, i den formen SSB gir dem, med
   økosystemtypene i SSBs klassifisering av økosystemer (OKOSYSTEMTYPER i klasser.ts):
   1. Arealet per økosystemtype i 2024 (solv.okosystemareal).
   2. Endringen i areal mellom bebygd og hver av de andre økosystemtypene fra 2017 til 2024 (solv.okosystemendring).

   Dette er den eneste kilden til SSB-tall på sidene. SSB publiserer tabellene 25. november 2026. Til da er tallene syntetiske, og de
   lages her, av SSBs arealstatistikk (tabell 09594, bronse.arealAlle, tolket i ssb.ts) og flaten til kommunene (solv.kommuneareal),
   med faste tommelfingerregler. Arealstatistikken brukes ikke til noe annet. Tallene skal bare ha riktig
   størrelsesorden. Det er et bevisst avvik fra regelen om at sølv bare tolker kildene: bronse og sølv er det som byttes ut når de ekte
   tallene kommer, mens gull og sidene skal bestå. Da hentes SSBs tabeller i bronse, og tabellene her tolker dem i stedet for å lage
   dem, i den samme formen. Feltet syntetisk sier hvilke tall som er syntetiske, så sidene kan si det.

   1. Arealet per økosystemtype (lagFordeling). SSBs arealklasser oversettes med den faste nøkkelen (ssbTilHovedokosystem i
      klasser.ts) til hovedøkosystemene i grunnkartet, og derfra til økosystemtypene hos SSB. Havet er resten av kommunens flate når
      land og ferskvann er trukket fra, og står i sin helhet som «Hav» (12), fordi arealstatistikken ikke skiller ut «Bukter, kiler
      og tidevannsonen» (10 er 0). «Uklassifisert ubebygd område» hos SSB er ikke med i noen økosystemtype. Kyststrender, svaberg og dyner er en fast andel av havet (KYST_AV_HAV), tatt fra hei og buskmark og lite
      vegetert mark.
   2. Arealet mellom bebygd og hver av de andre økosystemtypene på land (lagEndring), med en grådig tommelfingerregel: økningen i hver
      bebygd klasse hos SSB tas først fra jordbruket, så langt det gikk ned, og resten fra naturen etter arealet. Vann og hav er ikke
      med. Arealet er tall for to år, ikke målte overganger, og SSB skriver at forskjellen mellom årgangene også kommer av bedre
      kartlegging. Det er et grovt anslag. */
import { summen, tiDekar } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { HAV_MIN_ANDEL, HAV_MIN_KM2 } from './felles.ts';
import { HOVEDOKOSYSTEMER, OKOSYSTEMTYPER, ssbTilHovedokosystem } from './klasser.ts';
import { perKommune, type Arealdetaljer } from './ssb.ts';

/* Kilden til de syntetiske tallene, slik sidene skal oppgi den */
export const SYNTETISK =
  'Syntetiske tall laget av SSBs arealstatistikk, til SSBs tabeller for naturregnskapet kommer 25. november 2026.';
/* Andelen av havet som regnes som kyststrender, svaberg og dyner. I grunnkartet for Trondheim er de 0,08 km² mot 187 km² hav
   (0,04 %). Med 0,1 % blir de rett størrelsesorden også der kysten er mer åpen. */
export const KYST_AV_HAV = 0.001;

/* Tabellen med arealet per økosystemtype: året, om tallene er syntetiske, kilden, og per kommune arealet i km² per kode i
   OKOSYSTEMTYPER */
export interface Okosystemareal {
  aar: string;
  syntetisk: boolean;
  kilde: string;
  kommuner: Record<string, Record<string, number>>;
}
/* Endringen mellom bebygd og de andre økosystemtypene i én kommune: arealet fra hver type til bebygd, og fra bebygd til typen, i km²
   per kode. endret, flyttet og uforklart er merknader fra den syntetiske utregningen, som SSBs tabell ikke har (der er de false og
   0): endret sier at årene ikke kan sammenlignes fordi grensen er flyttet, flyttet at grensen er flyttet, men at endringen er regnet
   likevel, og uforklart det som ikke kunne fordeles. */
export interface Kommuneendring {
  tilBebygd: Record<string, number>;
  fraBebygd: Record<string, number>;
  endret: boolean;
  flyttet: boolean;
  uforklart: number;
}
/* Tabellen med endringen: periodens første og siste år, om tallene er syntetiske, kilden, og endringen per kommune */
export interface Okosystemendring {
  fra: string;
  til: string;
  syntetisk: boolean;
  kilde: string;
  kommuner: Record<string, Kommuneendring>;
}

/* Plassen til året aar i SSB-tallene, eller det siste året før, eller det siste året */
function aaret(D: Arealdetaljer, aar: string) {
  const i = D.aar.indexOf(aar);
  if (i >= 0) return i;
  const for_ = D.aar.filter(a => a < aar);
  return for_.length ? D.aar.indexOf(for_[for_.length - 1]) : D.aar.length - 1;
}
/* SSB-arealet per hovedøkosystem i grunnkartet i året nummer i. Uklassifisert ubebygd område er ikke med. */
function perHovedokosystem(D: Arealdetaljer, i: number) {
  const m = new Map<string, number>();
  D.klasser.forEach(k => {
    const h = ssbTilHovedokosystem(k);
    if (h) m.set(h, (m.get(h) || 0) + k.km2[i]);
  });
  return m;
}
/* Arealet per hovedøkosystem i grunnkartet (m) som arealet per økosystemtype hos SSB, avrundet til 10 dekar. Havet står som «Hav»
   (12), og «Bukter, kiler og tidevannsonen» (10) er 0. */
const tilSsb = (m: Map<string, number>, koder = OKOSYSTEMTYPER) =>
  Object.fromEntries(koder.map(o => [o.kode, o.kode === '10' ? 0 : tiDekar(m.get(o.grunnkart) || 0)]));

/* Fordelingen på økosystemtypene i året aar av SSBs arealklasser D og kommunens flate i km² (land, ferskvann og hav). Havet er resten
   når land og ferskvann er trukket fra, og 0 når resten er så liten at den bare er avvik mellom grense og statistikk (som
   gull.landOgVann). Kyststrender, svaberg og dyner er KYST_AV_HAV av havet, tatt fra hei og buskmark og lite vegetert mark etter
   arealet. */
export function lagFordeling(D: Arealdetaljer, aar: string, flate: number): Record<string, number> {
  const i = aaret(D, aar),
    a = perHovedokosystem(D, i),
    alt = summen(D.klasser.map(k => k.km2[i])),
    rest = flate - alt,
    hav = rest < Math.max(HAV_MIN_KM2, flate * HAV_MIN_ANDEL) ? 0 : rest,
    hei = a.get('heiBuskmark') || 0,
    lite = a.get('liteVegetertMark') || 0,
    kyst = Math.min(KYST_AV_HAV * hav, hei + lite),
    tatt = hei + lite > 0 ? kyst / (hei + lite) : 0;
  a.set('hav', hav);
  a.set('kyststrenderSvabergDyner', kyst);
  a.set('heiBuskmark', hei * (1 - tatt));
  a.set('liteVegetertMark', lite * (1 - tatt));
  return tilSsb(a);
}

/* Økosystemtypene på land utenom bebygd, som endringen gjelder: jordbruk og natur */
const LAND_UTEN_BEBYGD = HOVEDOKOSYSTEMER.filter(h => h.gruppe === 'jor' || h.gruppe === 'nat');
/* Endringen mellom bebygd og de andre økosystemtypene på land fra året fra til året til, av SSBs arealklasser D, med en grådig
   tommelfingerregel:
   1. Økningen i bebygd er summen av økningene i SSBs bebygde klasser (01–14) hver for seg. En nedgang i en bebygd klasse regnes som
      bedre kartlegging, ikke som at arealet blir natur igjen: på Røros gikk transport og fritidsboliger ned fra 2017 til 2024, så
      bebygd samlet gikk ned, selv om boliger og næring økte. Det bebygde arealet går derfor aldri tilbake (fraBebygd er 0).
   2. Økningen tas først fra jordbruket (dyrket mark og grasmark), så langt hver av dem gikk ned. Jordbruksarealet er godt kartlagt,
      og når det går ned, er det for det meste fordi det bygges ned.
   3. Resten tas fra naturen, fordelt etter arealet hver naturklasse hadde ved start. Endringene i naturklassene hos SSB kommer mest
      av bedre kartlegging (i Trondheim gikk åpen myr ned og skog opp), så de brukes ikke.
   Er kommunegrensen flyttet i perioden (D.endret), regnes endringen likevel (flyttet), og forskjellen i samlet areal regnes som natur
   og vann. Regelen bruker bare endringen i bebygd og jordbruk, og naturens andeler, så det gir riktig størrelsesorden når det som er
   lagt til eller tatt fra kommunen, mest er natur. (Å skalere arealet i 2017 til samme samlede areal ga for Stavanger, der skogen
   og innsjøene økte, nesten ingen økning i bebygd.) Det går ikke når kommunen ikke har noe areal ved start (endret). Gir også
   årene som er brukt. */
export function lagEndring(D: Arealdetaljer, fra: string, til: string): Kommuneendring & { fra: string; til: string } {
  const i0 = aaret(D, fra),
    i1 = aaret(D, til),
    flyttet = D.endret && summen(D.klasser.map(k => k.km2[i0])) > 0,
    a0 = perHovedokosystem(D, i0),
    a1 = perHovedokosystem(D, i1),
    endring = (kode: string) => (a1.get(kode) || 0) - (a0.get(kode) || 0),
    okning = summen(D.klasser.filter(k => k.klasse === 'beb').map(k => Math.max(0, k.km2[i1] - k.km2[i0]))),
    tilB = new Map<string, number>();
  let rest = okning;
  for (const h of LAND_UTEN_BEBYGD.filter(x => x.gruppe === 'jor')) {
    const v = Math.min(rest, Math.max(0, -endring(h.kode)));
    tilB.set(h.kode, v);
    rest -= v;
  }
  const natur = LAND_UTEN_BEBYGD.filter(h => h.gruppe === 'nat'),
    naturAreal = summen(natur.map(h => a0.get(h.kode) || 0));
  if (rest > 0 && naturAreal > 0) {
    natur.forEach(h => tilB.set(h.kode, (rest * (a0.get(h.kode) || 0)) / naturAreal));
    rest = 0;
  }
  const koder = OKOSYSTEMTYPER.filter(o => LAND_UTEN_BEBYGD.some(h => h.kode === o.grunnkart));
  return {
    fra: D.aar[i0],
    til: D.aar[i1],
    tilBebygd: tilSsb(tilB, koder),
    fraBebygd: tilSsb(new Map(), koder),
    endret: D.endret && !flyttet,
    flyttet,
    uforklart: tiDekar(rest)
  };
}

/* Tabellene for alle kommunene, av SSBs arealklasser for hver kommune (alle) og flaten til hver kommune (flater) */
export function lagOkosystemareal(alle: Record<string, Arealdetaljer>, flater: Record<string, number>): Okosystemareal {
  return {
    aar: '2024',
    syntetisk: true,
    kilde: SYNTETISK,
    kommuner: Object.fromEntries(Object.values(alle).map(D => [D.nr, lagFordeling(D, '2024', flater[D.nr] || 0)]))
  };
}
export function lagOkosystemendring(alle: Record<string, Arealdetaljer>): Okosystemendring {
  const E = Object.values(alle).map(D => [D.nr, lagEndring(D, '2017', '2024')] as const),
    forste = E.length ? E[0][1] : { fra: '2017', til: '2024' };
  return {
    fra: forste.fra,
    til: forste.til,
    syntetisk: true,
    kilde: SYNTETISK,
    kommuner: Object.fromEntries(
      E.map(([nr, e]): [string, Kommuneendring] => [
        nr,
        { tilBebygd: e.tilBebygd, fraBebygd: e.fraBebygd, endret: e.endret, flyttet: e.flyttet, uforklart: e.uforklart }
      ])
    )
  };
}

/* Tabellen solv.okosystemareal: arealet per økosystemtype i 2024 for alle kommunene, syntetisk til SSBs tabell kommer */
export async function okosystemareal(): Promise<Okosystemareal> {
  const [j, F] = await Promise.all([katalog.bronse.arealAlle(), katalog.solv.kommuneareal()]);
  return lagOkosystemareal(perKommune(j), F);
}
/* Tabellen solv.okosystemendring: endringen mellom bebygd og de andre økosystemtypene fra 2017 til 2024 for alle kommunene,
   syntetisk til SSBs tabell kommer */
export async function okosystemendring(): Promise<Okosystemendring> {
  return lagOkosystemendring(perKommune(await katalog.bronse.arealAlle()));
}
