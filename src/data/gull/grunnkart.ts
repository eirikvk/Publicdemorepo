/* Gull for grunnkartet: dagens klasser for hele kommunen, i blokkene på nivå 10 (solv.blokker og solv.klasser). For kommunene med
   lagrede klasser ligger blokkene ferdig sammen med siden. For de andre lager sølv dem av kartbildene fra NIBIO når kommunen velges,
   med den samme funksjonen som laget de lagrede. Utbyggingen (gull/utbygging.ts) regnes av blokkene, og kartet tegner dem zoomet ut.
   Nederst arealet per detaljklasse, i hele kommunen (gull.detaljareal) og i verneområdene (gull.detaljerIVerneomrader), som
   foreløpig bare tvillingen fra Figma bruker. */
import { katalog } from '../katalog.ts';
import { FLISNIVA, bitAv, ruteM } from '../solv/felles.ts';
import { tellIKommunen } from '../solv/grunnkart.ts';
import { kommuneIBlokk, type Andelsbit } from '../solv/kommune.ts';
import { DETALJKLASSER } from '../solv/klasser.ts';
import { arealFraRuter, tiDekar } from './felles.ts';

/* Dagens klasser for hele kommunen: om kommunen har lagrede klasser (lagret), og hvor mange blokker den har (blokker) */
export interface DagensKlasser {
  lagret: boolean;
  blokker: number;
}

/* Tabellen gull.dagensKlasser: alle blokkene for kommunen nr lest (solv.klasser), seks om gangen. Den bes om når kommunen velges, så
   blokkene er klare for tallene og kartet, og datamotoren viser hvor langt hentingen fra NIBIO er kommet mens den holder på. */
export async function dagensKlasser(nr: string): Promise<DagensKlasser> {
  const [reg, B] = await Promise.all([katalog.bronse.klasseregister(), katalog.solv.blokker([nr, FLISNIVA])]),
    ko = [...B];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let tc = ko.shift(); tc; tc = ko.shift()) await katalog.solv.klasser(tc);
    })
  );
  return { lagret: !!(reg && reg.kommuner && reg.kommuner[nr]), blokker: B.length };
}

/* Arealet per detaljklasse i kommunen: km² per klasse i DETALJKLASSER (km2), arealet innenfor kommunen uten klasse (ukjent), summen
   av klassene, og når de lagrede detaljklassene er laget (hentet) og fra hvilken årsversjon av grunnkartet (versjon) */
export interface Detaljareal {
  km2: number[];
  ukjent: number;
  sum: number;
  hentet: string;
  versjon: string;
}
/* Tabellen gull.detaljareal: arealet per detaljklasse i kommunen nr, av blokkene på 10,6 meter (solv.detaljklasser) med kommunens
   andel i hver rute (solv.kommunebiter). For kommunene med lagrede detaljklasser (bronse.detaljregister) leses blokkene fra filene. For de
   andre hentes de fra NIBIO, ett kall per blokk, så det tar lenger tid. */
export async function detaljareal(nr: string): Promise<Detaljareal | null> {
  return tellDetaljer(nr, null);
}
/* Tabellen gull.detaljerIVerneomrader: det samme, men bare innenfor verneområdene, med andelen av hver rute som ligger i
   verneområdene og i kommunen (solv.vernAndel). Der områder overlapper, telles arealet én gang. */
export async function detaljerIVerneomrader(nr: string): Promise<Detaljareal | null> {
  return tellDetaljer(nr, (await katalog.solv.vernAndel(nr)).biter[0]);
}
/* Arealet per detaljklasse i kommunen nr, eller bare innenfor et tema i kommunen (bitene med andelen, som solv.vernAndel). Blokkene
   utenfor temaet hoppes over, og blokkene leses seks om gangen. hentet og versjon er fra registeret når kommunen har lagrede
   detaljklasser, ellers tomme. null når kommunen ikke har noen blokker. */
async function tellDetaljer(nr: string, tema: Andelsbit[] | null): Promise<Detaljareal | null> {
  const [reg, L] = await Promise.all([katalog.bronse.detaljregister(), katalog.solv.detaljblokker(nr)]),
    lagret = !!(reg && reg.kommuner && reg.kommuner[nr]);
  if (!L.length) return null;
  const KB = tema || (await katalog.solv.kommunebiter(nr)),
    n = new Array<number>(DETALJKLASSER.length + 1).fill(0),
    ko = L.filter(tc => {
      const b = bitAv(tc);
      return KB.some(K => K.tc[1] === b[1] && K.tc[2] === b[2]);
    });
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let b = ko.shift(); b; b = ko.shift()) {
        const A = kommuneIBlokk(KB, b);
        if (A.andel && !A.andel.a.length) continue;
        const K = await katalog.solv.detaljklasser(b);
        tellIKommunen(K, A, n.length).forEach((v, k) => (n[k] += v));
      }
    })
  );
  /* rutene er alt rettet for målestokken (tellIKommunen) */
  const res = ruteM(FLISNIVA),
    { km2, sum } = arealFraRuter(n.slice(1), res, 1e6);
  return {
    km2,
    sum,
    ukjent: tiDekar((n[0] * res * res) / 1e6),
    hentet: (lagret && reg && reg.hentet) || '',
    versjon: (lagret && reg && reg.versjon) || ''
  };
}
