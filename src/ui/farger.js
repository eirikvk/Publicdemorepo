/* Fargene til kartet og sidene. */
/* Fargene i kartet og i tegnforklaringene. Klassefargene er hentet fra grunnkartets egen tegnforklaring: bebygd og opparbeidet
   areal, dyrket mark og skog, og for vann hav, innsjøer og elver. Planlagt utbygging har to mørke farger som ikke finnes i
   grunnkartet: koksgrå for natur og brun for jordbruk. De er kontrollert mot alle kartfargene, også vannfargene, for vanlig
   fargesyn og de tre vanligste formene for fargeblindhet. Fargene er data, ikke utforming, men der Miljødirektoratets profil har
   en farge med samme rolle, brukes den: Oransje mørk for villrein, Sjøgrønn lys for grønt i bebygd område og Blå mørk for egne
   områder. Verneområder og verdsatt natur har egne farger, fordi profilens lilla er så mørk at den kan forveksles med planlagt
   utbygging, og profilens rosa ligger for nær bebygd. Siden legger fargene også ut som CSS-variabler (--beb og så videre), så
   tegnforklaringene bruker de samme (main.jsx). */
export const FARGER = {
  ink: '#17201c',
  beb: '#e86474',
  jor: '#ffd16e',
  nat: '#9ecc73',
  pnat: '#171c1a',
  pjor: '#92400e',
  hav: '#bdd7e7',
  inn: '#6baed6',
  elv: '#08519c',
  land: '#b9b3a4',
  slor: '#f7f8f5',
  vern: '#6a1b9a',
  rein: '#d86018' /* Oransje mørk i Miljødirektoratets profil */,
  verdi: '#c026d3',
  verdi1: '#7a1070',
  verdi2: '#c026d3',
  verdi3: '#e478e8',
  verdi4: '#efaef5',
  gront: '#40c1ac' /* Sjøgrønn lys */,
  graa0: '#3e4348',
  graa1: '#4f555b',
  graa2: '#6d7379',
  graa3: '#8c9197',
  graa4: '#aaafb4',
  graa5: '#c8ccd0',
  inon2: '#6daf55',
  inon1: '#3e8e41',
  inonv: '#1f6130',
  egne: '#0072ce' /* Blå mørk, omrisset av egne områder */
};
export const farge = id => FARGER[id];
const rgbMinne = {};
export const rgb = id => rgbMinne[id] || (rgbMinne[id] = [1, 3, 5].map(i => parseInt(FARGER[id].substr(i, 2), 16)));
