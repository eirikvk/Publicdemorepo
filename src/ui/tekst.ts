/* Hvordan tall og tekst skrives på siden og i kartet. Alt her er rene funksjoner: samme inn gir samme ut, og ingenting leser
   tilstanden. Reglene følger Miljødirektoratets språkprofil: tall til og med tolv med bokstaver i løpende tekst, desimalkomma,
   mellomrom foran prosent, «dekar» i setninger og «daa» i tabeller og lister. */

/* Et tall med d desimaler, norsk skrivemåte */
export const nf = (v: number, d = 1) =>
  v.toLocaleString('nb-NO', { minimumFractionDigits: d, maximumFractionDigits: d });
/* Alle arealer vises i dekar. Internt regnes det i kvadratkilometer, som er enheten SSB oppgir. 1 km² er 1000 dekar.
   I kolonner og lister står forkortelsen «daa», i setninger står «dekar» skrevet ut. */
export const dekar = (km2: number, enhet = 'daa') => {
  const v = km2 * 1000;
  return (v > 0 && v < 0.05 ? 'under 0,1' : nf(v, v < 100 ? 1 : 0)) + ' ' + enhet;
};
export const iTekst = (km2: number) => dekar(km2, 'dekar');
export const andelTekst = (p: number) => (p > 0 && p < 0.1 ? '< 0,1 %' : nf(p) + ' %');
/* Størrelsen på et svar */
export const kb = (b: number) => (b >= 1048576 ? nf(b / 1048576) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' kB');
/* Tiden et kall tok */
export const tid = (ms: number) => (ms >= 1000 ? nf(ms / 1000) + ' s' : Math.round(ms) + ' ms');

/* Tall til og med tolv med bokstaver. en er ordet for 1, som avhenger av kjønnet på det som telles (ett område, én lokalitet). */
const ORD = ['null', 'én', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv'];
export const antallOrd = (n: number, en = 'én') =>
  n === 1 ? en : Number.isInteger(n) && n >= 0 && n <= 12 ? ORD[n] : nf(n, 0);

/* Stor forbokstav, for et ord først i en setning */
export const stor = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/* Ramser opp: «a, b og c». Tomme deler hoppes over. */
export const ramse = (deler: (string | false | null | undefined)[]) => {
  const d = deler.filter(Boolean);
  return d.length > 1 ? d.slice(0, -1).join(', ') + ' og ' + d[d.length - 1] : d[0] || '';
};

/* En andel fra gull, i prosent som tekst uten prosenttegnet. 0 når andelen ikke kan regnes ut (null). */
export const pst = (a: number | null | undefined, desimaler = 1) =>
  a === null || a === undefined ? '0' : nf(a, desimaler);

/* Hvor mange prosent del er av helheten, uten prosenttegnet. 0 hvis helheten mangler. Brukes av stripene, som regner ut andelene av
   det de tegner. */
export const prosent = (del: number, av: number, desimaler = 1) => (av > 0 ? nf((del / av) * 100, desimaler) : '0');

/* En endring med fortegn: +5, −3 eller 0. vis skriver tallet uten fortegn. */
export const medFortegn = (v: number, vis: (v: number) => string) =>
  !v ? '0' : (v < 0 ? '−' : '+') + vis(Math.abs(v));

/* Ett årstall, eller et spenn: 2019 eller 2019–2026 */
export const periode = (fra: number, til: number) => (fra === til ? String(fra) : fra + '–' + til);
