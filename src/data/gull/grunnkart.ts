/* Gull for grunnkartet: dagens klasser for kommunen, på tvers av de to kildene i sølv. Først blokkene (solv.blokker, solv.klasser og
   solv.klassekart), og da er hele kommunen med. For kommunene med lagrede klasser ligger blokkene ferdig sammen med siden. For de
   andre, og for blokker som ikke kan leses, lager sølv dem av kartbildene fra NIBIO når kommunen velges, med den samme funksjonen
   som laget de lagrede. Kan ikke blokkene lages, brukes det sammensatte kartet av flisene som er hentet (solv.sammensatt), og da
   gjelder alt som bygger på det, bare den delen av kommunen som er hentet.
   Utbyggingen (gull/utbygging.ts), kartet og sidene leser dagens klasser herfra.
   Nederst arealet per detaljklasse, i hele kommunen (gull.detaljareal) og i verneområdene (gull.detaljerIVerneomrader), som
   foreløpig bare tvillingen fra Figma bruker. */
import { overlapper, type Flerflate, type Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { FLISNIVA, flisAvNavn, flisUtsnitt, m2PerKm2, ruteM, type Flis } from '../solv/felles.ts';
import { tellIFlate, type Oversikt } from '../solv/grunnkart.ts';
import { DETALJKLASSER } from '../solv/klasser.ts';
import { arealFraRuter, tiDekar } from './felles.ts';

/* Dagens klasser for kommunen: bildet zoomet ut (ov), og kommunens flate det klippes mot (koord). lagret sier at kommunen har
   lagrede klasser. Er delvis usann, er hele kommunen med, i blokkene fra solv.blokker og solv.klasser. Er den sann, er bare det som er
   hentet, med, og fliser er flisene som er hentet. */
export interface DagensKlasser {
  ov: Oversikt;
  koord: Flerflate;
  lagret: boolean;
  fliser: Flis[] | null;
  delvis: boolean;
}

/* Tabellen gull.dagensKlasser: dagens klasser for kommunen nr. Blokkene når de kan lages, ellers det sammensatte kartet. null når
   ingen av delene finnes: blokkene feilet, og det er ikke hentet noe kart. */
export async function dagensKlasser(nr: string): Promise<DagensKlasser | null> {
  const [reg, g, ov] = await Promise.all([
      katalog.bronse.klasseregister(),
      katalog.solv.grense(nr),
      katalog.solv.klassekart(nr).catch(() => null) /* startes med en gang, så framdriften vises fra starten */
    ]),
    lagret = !!(reg && reg.kommuner && reg.kommuner[nr]);
  if (ov) return { ov, koord: g.koord, lagret, fliser: null, delvis: false };
  const s = await katalog.solv.sammensatt(nr);
  if (!s.har.size) return null;
  return { ov: s.ov, koord: g.koord, lagret, fliser: [...s.har].map(flisAvNavn), delvis: true };
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
/* Tabellen gull.detaljareal: arealet per detaljklasse i kommunen nr, av blokkene på 10,6 meter (solv.detaljklasser) klippet til
   kommunen etter halvregelen. For kommunene med lagrede detaljklasser (bronse.detaljregister) leses blokkene fra filene. For de
   andre hentes de fra NIBIO, ett kall per blokk, så det tar lenger tid. */
export async function detaljareal(nr: string): Promise<Detaljareal | null> {
  return tellDetaljer(nr, null);
}
/* Tabellen gull.detaljerIVerneomrader: det samme, men bare innenfor verneområdene (solv.verneomrader). Der områder overlapper,
   telles arealet én gang. Ruter teller når verneområdene dekker minst halve ruta. */
export async function detaljerIVerneomrader(nr: string): Promise<Detaljareal | null> {
  return tellDetaljer(nr, (await katalog.solv.verneomrader(nr)).omrader);
}
/* Arealet per detaljklasse i kommunen nr, eller bare innenfor flatene. Blokkene utenfor flatene hoppes over, og blokkene leses seks
   om gangen. hentet og versjon er fra registeret når kommunen har lagrede detaljklasser, ellers tomme. null når kommunen ikke har
   noen blokker. */
async function tellDetaljer(
  nr: string,
  flater: { koord: Flerflate; ext: Utsnitt }[] | null
): Promise<Detaljareal | null> {
  const [reg, L] = await Promise.all([katalog.bronse.detaljregister(), katalog.solv.detaljblokker(nr)]),
    lagret = !!(reg && reg.kommuner && reg.kommuner[nr]);
  if (!L.length) return null;
  const g = await katalog.solv.grense(nr),
    n = new Array<number>(DETALJKLASSER.length + 1).fill(0),
    ko = L.filter(tc => !flater || flater.some(f => overlapper(f.ext, flisUtsnitt(tc)))),
    koord = flater && flater.map(f => f.koord);
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let b = ko.shift(); b; b = ko.shift()) {
        const K = await katalog.solv.detaljklasser(b);
        tellIFlate(K, g.koord, n.length, koord || undefined).forEach((v, k) => (n[k] += v));
      }
    })
  );
  const res = ruteM(FLISNIVA),
    skala = m2PerKm2(g.ext),
    { km2, sum } = arealFraRuter(n.slice(1), res, skala);
  return {
    km2,
    sum,
    ukjent: tiDekar((n[0] * res * res) / skala),
    hentet: (lagret && reg && reg.hentet) || '',
    versjon: (lagret && reg && reg.versjon) || ''
  };
}
