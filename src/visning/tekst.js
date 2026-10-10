/* Hvordan tall og tekst skrives på siden. Alt her er rene funksjoner: samme inn gir samme ut, og ingenting leser tilstanden.
   Reglene følger Miljødirektoratets språkprofil: tall til og med tolv med bokstaver i løpende tekst, desimalkomma, mellomrom
   foran prosent, «dekar» i setninger og «daa» i tabeller og lister.

   Formateringen av tall og areal (nf, dekar, iTekst, andelTekst) ligger i motoren, fordi motoren også skriver noen tekster. Den
   hentes videre herfra, så komponentene finner alt om tekst på ett sted. */
import { RUTE } from '../analyse/felles.js';
import { iTekst, nf } from '../motor/felles.js';
export { andelTekst, dekar, iTekst, nf } from '../motor/felles.js';

/* Tall til og med tolv med bokstaver. en er ordet for 1, som avhenger av kjønnet på det som telles (ett område, én lokalitet). */
const ORD = ['null', 'én', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv'];
export const antallOrd = (n, en = 'én') =>
  n === 1 ? en : Number.isInteger(n) && n >= 0 && n <= 12 ? ORD[n] : nf(n, 0);

/* Stor forbokstav, for et ord først i en setning */
export const stor = t => t.charAt(0).toUpperCase() + t.slice(1);

/* Ramser opp: «a, b og c». Tomme deler hoppes over. */
export const ramse = deler => {
  const d = deler.filter(Boolean);
  return d.length > 1 ? d.slice(0, -1).join(', ') + ' og ' + d[d.length - 1] : d[0] || '';
};

/* Hvor mange prosent del er av helheten, uten prosenttegnet. 0 hvis helheten mangler. */
export const prosent = (del, av, desimaler = 1) => (av > 0 ? nf((del / av) * 100, desimaler) : '0');

/* Areal i en setning, fra et antall ruter på 21 meter. Planlagt utbygging og kryssingene med den regnes i slike ruter. */
export const dekarFraRuter = n => iTekst(n * RUTE);

/* En endring med fortegn: +5, −3 eller 0. vis skriver tallet uten fortegn. */
export const medFortegn = (v, vis) => (!v ? '0' : (v < 0 ? '−' : '+') + vis(Math.abs(v)));

/* Ett årstall, eller et spenn: 2019 eller 2019–2026 */
export const periode = (fra, til) => (fra === til ? String(fra) : fra + '–' + til);
