/* Gull for inngrepsfri natur: arealet per sone i kommunen, og i villreinområdene, nå og i årene Miljødirektoratet har status for.
   Arealet i kommunen per år regnes én gang og lagres (gull.inonAreal), og det temasiden og utviklingen viser, leses derfra. */
import { katalog } from '../katalog.ts';
import { INONAAR, INON_NYESTE, UTENFOR } from '../solv/inon.ts';
import { BITRES, tellIBitene, tellIKommune, type Andelsbit } from '../solv/kommune.ts';
import { andel, arealFraRuter, bildetall, landareal, tiDekar, type Bildetall, type Kommunebilde } from './felles.ts';

/* Inngrepsfri natur for kommunen: når den er hentet, areal per sone (villmarkspreget, sone 1, sone 2) i km² */
export type Inon = Kommunebilde<{ soner: number[] }>;

/* Det temasiden og oversikten viser: tilstanden, og når kommunen har inngrepsfri natur, arealet samlet og per sone og andelen av
   landarealet. D er inngrepsfri natur for kommunen, og land landarealet i km². */
export const byggInon = (D: Inon | null, land: number) =>
  bildetall(D, H => ({ sum: H.sum, soner: H.soner, andelLand: andel(H.sum, land) }));

/* Tabellen gull.inon: det temasiden, oversikten og kartet viser for kommunen nr: ok med tallene, eller ingen når kommunen ikke har
   inngrepsfri natur. Arealet samlet (sum) og per sone (soner) står med uansett. */
export type Inontall = Bildetall<{ sum: number; soner: number[]; andelLand: number | null }> & {
  sum: number;
  soner: number[];
};
export async function inon(nr: string): Promise<Inontall> {
  const [A, land] = await Promise.all([katalog.gull.inonAreal(nr), landareal(nr)]);
  return { ...byggInon({ nr, tilstand: 'ok', soner: A.km2, sum: A.sum }, land), sum: A.sum, soner: A.km2 };
}

/* Arealet av inngrepsfri natur i kommunen for et år: km² per sone (villmarkspreget, sone 1, sone 2) og samlet, rundet til 10 dekar */
export interface InonAreal {
  aar: number;
  km2: number[];
  sum: number;
}
/* Kommunen og året i en nøkkel som 5001/2008. Uten år er det nyeste året. */
export const lesInonNokkel = (n: string): [nr: string, aar: number] => {
  const [nr, a] = n.split('/');
  return [nr, a ? Number(a) : INON_NYESTE];
};
/* Tabellen gull.inonAreal: arealet av inngrepsfri natur per sone i kommunen for et år, kalt med kommunen og året (5001/2008), eller
   bare kommunen for nyeste år. Rutene på 10,6 meter for året (solv.inonbit) telles per sone i kommunen, og en rute langs grensen
   telles med den delen av den som ligger i kommunen (solv.kommunebiter), rettet for målestokken. Antall ruter ganger arealet av en
   rute er arealet. */
export async function inonAreal(n: string): Promise<InonAreal> {
  const [nr, aar] = lesInonNokkel(n),
    S = await tellIKommune(
      nr,
      3,
      tc => katalog.solv.inonbit([aar, tc]).then(D => D.sone),
      s => (s === UTENFOR ? null : s),
      UTENFOR
    );
  return { aar, ...arealFraRuter(S.n, S.res, S.skala) };
}

/* Inngrepsfri natur i villreinområdene: arealet av villreinområdene i kommunen (villrein), inngrepsfri natur i dem samlet (sum) og per
   sone (soner), og andelen av villreinområdene som er inngrepsfri, i prosent */
export interface InonIVillrein {
  villrein: number;
  sum: number;
  soner: number[];
  andel: number | null;
}
/* Inngrepsfri natur for året aar talt i bitene KB med andelen av hver rute som er med (som villreinområdene), i km² per sone og
   samlet */
async function iBitene(KB: Andelsbit[], aar: number) {
  const n = await tellIBitene(
    KB,
    3,
    tc => katalog.solv.inonbit([aar, tc]).then(D => D.sone),
    v => (v !== UTENFOR ? v : null),
    UTENFOR
  );
  return arealFraRuter(n, BITRES, 1e6);
}
/* Tabellen gull.inonIVillrein: inngrepsfri natur (solv.inonbit) i villreinområdene i kommunen, talt med andelen av hver rute som
   ligger i villreinområdene og i kommunen (solv.villreinAndel). Der områder overlapper, telles ruta én gang. Arealet av villreinområdene
   er det samme som i gull.villrein. null når kommunen ikke har villreinområder. */
export async function inonIVillrein(nr: string): Promise<InonIVillrein | null> {
  const V = await katalog.solv.villreinAndel(nr);
  if (!(V.sum > 0)) return null;
  const A = await iBitene(V.biter[0], INON_NYESTE),
    villrein = tiDekar(V.sum);
  return { villrein, sum: A.sum, soner: A.km2, andel: andel(A.sum, villrein) };
}

/* Inngrepsfri natur over tid: for hvert år Miljødirektoratet har status for (aar), arealet per sone (villmarkspreget, sone 1, sone 2)
   og samlet i km², og andelen av det arealet det er regnet av (landarealet, eller villreinområdene). perioder er endringen mellom to
   år etter hverandre: per sone, og for inngrepsnær natur, som er det inngrepsfri natur mister. Den første perioden er 20 år (1988 til
   2008), de andre fem. byggUtvikling lager det av arealet per år (A, i rekkefølgen i INONAAR) og arealet andelen regnes av (av). */
export interface InonUtvikling {
  aar: number[];
  soner: number[][];
  sum: number[];
  andel: (number | null)[];
  perioder: { fra: number; til: number; soner: number[]; naer: number }[];
}
export function byggUtvikling(A: { km2: number[]; sum: number }[], av: number): InonUtvikling {
  return {
    aar: [...INONAAR],
    soner: A.map(a => a.km2),
    sum: A.map(a => a.sum),
    andel: A.map(a => andel(a.sum, av)),
    perioder: A.slice(1).map((a, i) => ({
      fra: INONAAR[i],
      til: INONAAR[i + 1],
      soner: a.km2.map((v, s) => tiDekar(v - A[i].km2[s])),
      naer: tiDekar(A[i].sum - a.sum)
    }))
  };
}
/* Arealet per år (f gir arealet for året), to år om gangen, så tjenesten ikke får alle kallene samtidig */
async function perAar(f: (aar: number) => Promise<{ km2: number[]; sum: number }>) {
  const A: { km2: number[]; sum: number }[] = [];
  for (let i = 0; i < INONAAR.length; i += 2) A.push(...(await Promise.all(INONAAR.slice(i, i + 2).map(f))));
  return A;
}
/* Tabellen gull.inonUtvikling: inngrepsfri natur i kommunen nr for hvert år Miljødirektoratet har status for, talt på samme måte og
   i de samme rutene som nyeste år (gull.inonAreal), og andelen av landarealet. Regnes først når en side ber om den, fordi
   den henter fire ganger så mange bilder. */
export async function inonUtvikling(nr: string): Promise<InonUtvikling> {
  const [land, A] = await Promise.all([
    landareal(nr),
    perAar(async aar => {
      const A = await katalog.gull.inonAreal(aar === INON_NYESTE ? nr : `${nr}/${aar}`);
      return { km2: A.km2, sum: A.sum };
    })
  ]);
  return byggUtvikling(A, land);
}
/* Tabellen gull.inonIVillreinUtvikling: det samme i villreinområdene i kommunen (som gull.inonIVillrein), og andelen av
   villreinområdene. null når kommunen ikke har villreinområder. */
export async function inonIVillreinUtvikling(nr: string): Promise<(InonUtvikling & { villrein: number }) | null> {
  const V = await katalog.solv.villreinAndel(nr);
  if (!(V.sum > 0)) return null;
  const villrein = tiDekar(V.sum),
    A = await perAar(aar => iBitene(V.biter[0], aar));
  return { ...byggUtvikling(A, villrein), villrein };
}
