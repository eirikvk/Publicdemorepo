/* Lenkene mellom hovedsiden og tvillingen fra Figma (srcFigma/), i den smale linjen øverst på begge: hvilken side i den ene som
   svarer til en side i den andre, så lenken åpner samme kommune og samme tema. Sider uten noe tilsvarende går til oversikten.
   Tvillingen ligger i figma/ ved siden av hovedsiden. */
const PAR: [hovedside: string, tvilling: string][] = [
  ['framtid', 'naturtapet'],
  ['vern', 'utforsk/verneomrader'],
  ['rein', 'utforsk/villrein'],
  ['verdi', 'utforsk/verdsatte-naturtyper'],
  ['inon', 'utforsk/inngrepsfri-natur'],
  ['graa', 'utforsk/bynatur'],
  ['om', 'hjelp']
];

/* Fra hovedsiden: adressen til tvillingen for kommunen nr og siden side (som vern) */
export function tilTvillingen(nr: string, side: string) {
  const p = PAR.find(x => x[0] === side);
  return 'figma/#' + nr + (p ? '/' + p[1] : '');
}
/* Fra tvillingen: adressen til hovedsiden for kommunen nr og ruten i tvillingen (som utforsk/villrein eller kart/villrein) */
export function tilHovedsiden(nr: string, rute: string) {
  const r = rute.replace(/^kart\//, 'utforsk/'),
    p = PAR.find(x => x[1] === r);
  return '../#' + nr + (p ? '/' + p[0] : '');
}
