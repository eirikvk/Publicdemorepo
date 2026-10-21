/* Tallene for alle kommunene. Tvillingen sammenligner kommunen med Norge: villreinområdene, kartleggingsgraden, inngrepsfri natur,
   gjennomsnittet for temaene og arealet av hver naturtype. Det krever de samme tallene for alle kommunene, regnet ut på forhånd.

   gull.kommunetall er tallene for én kommune, regnet med de samme tabellene som siden bruker når kommunen er valgt. Verktøyet
   verktoy/landstall.ts kjører den for alle kommunene og legger svarene ut som filer (landstabellen). Siden leser filene i bronse,
   og gull.landssammenligning regner ut plassen blant kommunene og andelen av Norge. Slik regnes summen for Norge på samme måte som
   tallet for kommunen: den er summen av kommunene. */
import { summen } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { erLand } from '../solv/klasser.ts';
import type { Landstall, Landsnaturtype } from '../solv/landstall.ts';
import { andel, landareal } from './felles.ts';
import { arealAv } from './okosystemer.ts';

/* Tallene for én kommune, i km². land er landarealet fra SSB, som andelene av landarealet regnes av. grunnkartLand er landet i
   grunnkartet, som andelen vernet land regnes av, og vernLand landet i grunnkartet innenfor verneområdene. vern er alt som er vernet,
   også sjø. kartlagt er det som er kartlagt for naturtyper etter Miljødirektoratets instruks, og kartlagtAndel andelen av
   landarealet. naturtyper er arealet av hver naturtype i verdsatt natur, der overlapp telles flere ganger, som i tabellen på siden.
   null der tallet ikke finnes for kommunen. */
export interface Kommunetall {
  nr: string;
  land: number;
  grunnkartLand: number | null;
  vern: number;
  vernLand: number | null;
  villrein: number;
  verdsatt: number;
  kartlagt: number | null;
  kartlagtAndel: number | null;
  inon: number;
  graa: number;
  naturtyper: { navn: string; km2: number; antall: number }[];
}

/* Tabellen gull.kommunetall: tallene for kommunen nr til landstabellen, fra de samme tabellene som temakortene og tabellene på
   sidene bruker */
export async function kommunetall(nr: string): Promise<Kommunetall> {
  const [land, D, V, vern, villrein, verdsatt, typer, K, inon, graa] = await Promise.all([
    landareal(nr),
    katalog.gull.detaljareal(nr),
    katalog.gull.vernetNatur(nr),
    katalog.gull.verneomrader(nr),
    katalog.gull.villrein(nr),
    katalog.gull.verdsattNatur(nr),
    katalog.gull.verdsattPerNaturtype(nr),
    katalog.gull.verdsattNaturKartlagt(nr),
    katalog.gull.inon(nr),
    katalog.gull.graa(nr)
  ]);
  return {
    nr,
    land,
    grunnkartLand: D ? arealAv(D.km2, erLand) : null,
    vern: vern.sum,
    vernLand: V ? V.land : null,
    villrein: villrein.sum,
    verdsatt: verdsatt.sum,
    kartlagt: K.kartlagt ? K.kartlagt.km2 : null,
    kartlagtAndel: K.kartlagt ? K.kartlagt.andelLand : null,
    inon: inon.sum,
    graa: graa.sum,
    naturtyper: typer.alle.map(t => ({ navn: t.navn, km2: t.km2, antall: t.antall }))
  };
}

/* Plassen blant kommunene: plass (1 er den som har mest), av hvor mange som er med, og hvor stor andel av dem som har mindre */
export interface Plass {
  plass: number;
  av: number;
}
/* Plassen til kommunen nr når kommunene ordnes etter verdi, størst først. Kommuner uten verdi er ikke med. null når kommunen ikke
   har verdi. Like verdier får samme plass. */
export function plassFor<T>(R: T[], nr: string, nrAv: (r: T) => string, verdi: (r: T) => number | null): Plass | null {
  const V = R.map(r => [nrAv(r), verdi(r)] as const).filter((x): x is readonly [string, number] => x[1] !== null),
    egen = V.find(x => x[0] === nr);
  if (!egen) return null;
  return { plass: V.filter(x => x[1] > egen[1]).length + 1, av: V.length };
}

/* Andelen av Norge for et tema: summen av tellerne delt på summen av nevnerne, i prosent. null når nevneren er 0. Kommuner der
   tallene mangler, er ikke med i noen av summene. */
export function andelAvNorge<T>(R: T[], teller: (r: T) => number | null, nevner: (r: T) => number | null) {
  const M = R.map(r => [teller(r), nevner(r)] as const).filter(
    (x): x is readonly [number, number] => x[0] !== null && x[1] !== null
  );
  return andel(summen(M.map(x => x[0])), summen(M.map(x => x[1])));
}

/* Kommunen mot Norge, fra landstabellen: når tallene for alle kommunene ble regnet ut (beregnet), hvor mange kommuner som er med,
   kommunens del av villreinområdene i Norge, plassen på kartleggingsgrad og på arealet av inngrepsfri natur, andelen av
   landarealet i Norge for hvert tema (snitt, i prosent, til «Gjennomsnitt» på temakortene) og arealet av hver naturtype i Norge
   (naturtyper, km² etter navnet). null for kommunen når den ikke er med i landstabellen. */
export interface Landssammenligning {
  beregnet: string;
  kommuner: number;
  kommune: {
    villreinAndel: number | null;
    villrein: Plass | null;
    kartlegging: Plass | null;
    inon: Plass | null;
  } | null;
  snitt: {
    vern: number | null;
    villrein: number | null;
    verdsatt: number | null;
    inon: number | null;
    graa: number | null;
  };
  naturtyper: Record<string, number>;
}
/* Det gull.landssammenligning regner ut, av landstabellen (L) og naturtypene i den (N), for kommunen nr */
export function byggLandssammenligning(L: Landstall, N: Landsnaturtype[], nr: string): Landssammenligning {
  const R = L.rader,
    egen = R.find(r => r.nr === nr) || null,
    villreinNorge = summen(R.map(r => r.villrein)),
    naturtyper: Record<string, number> = {};
  for (const t of N) naturtyper[t.navn] = (naturtyper[t.navn] || 0) + t.km2;
  return {
    beregnet: L.beregnet,
    kommuner: R.length,
    kommune: egen && {
      villreinAndel: egen.villrein > 0 ? andel(egen.villrein, villreinNorge) : null,
      villrein:
        egen.villrein > 0
          ? plassFor(
              R.filter(r => r.villrein > 0),
              nr,
              r => r.nr,
              r => r.villrein
            )
          : null,
      kartlegging: plassFor(
        R,
        nr,
        r => r.nr,
        r => r.kartlagtAndel
      ),
      inon: plassFor(
        R,
        nr,
        r => r.nr,
        r => r.inon
      )
    },
    snitt: {
      vern: andelAvNorge(
        R,
        r => r.vernLand,
        r => r.grunnkartLand
      ),
      villrein: andelAvNorge(
        R,
        r => r.villrein,
        r => r.land || null
      ),
      verdsatt: andelAvNorge(
        R,
        r => r.verdsatt,
        r => r.land || null
      ),
      inon: andelAvNorge(
        R,
        r => r.inon,
        r => r.land || null
      ),
      graa: andelAvNorge(
        R,
        r => r.graa,
        r => r.land || null
      )
    },
    naturtyper
  };
}
/* Tabellen gull.landssammenligning: kommunen nr mot Norge, fra landstabellen i sølv */
export async function landssammenligning(nr: string): Promise<Landssammenligning> {
  const [L, N] = await Promise.all([katalog.solv.landstall(), katalog.solv.landsnaturtyper()]);
  return byggLandssammenligning(L, N, nr);
}
