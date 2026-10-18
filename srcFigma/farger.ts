/* Fargene i tvillingen der skissene har egne farger: verdsatte naturtyper (rød, oransje, gul), inngrepsfri natur (tre grønne),
   villrein (blå kant med prikker) og dekningskartet (lilla prikker over det som er kartlagt). Fargene er bare utseende, så de byttes i tvillingens kopi av fargetabellen før noe tegnes, og
   både kartet og figurene bruker dem. Hovedsiden har sine egne. Filen må importeres før resten av tvillingen (main.tsx). Der
   skissene er ulike med seg selv, som middels og noe verdi i figuren, følger fargene tegnforklaringen i kartet. */
import { DEKNING, FARGER, PRIKKET } from '../src/ui/farger.ts';

Object.assign(FARGER, {
  verdi1: '#c00000',
  verdi2: '#ff640a',
  verdi3: '#ffbc00',
  verdi4: '#fffe00',
  inonv: '#00ae00',
  inon1: '#89d100',
  inon2: '#c4eb6e',
  rein: '#0055ef' /* kanten */,
  'rein-prikk': '#00a5eb',
  'rein-flate': '#b0d9ec' /* bunnen i tegnforklaringen */,
  dekning: '#7d6cc4' /* prikkene */,
  'dekning-flate': '#c9b0ec' /* bunnen i tegnforklaringen */
});
/* Villreinområdene tegnes med prikker og kant i kartet, som i skissene, i stedet for skravur */
PRIKKET.rein = true;
/* Dekningskartet viser det som er kartlagt med prikker, som i skissene, i stedet for slør over det som ikke er kartlagt */
DEKNING.prikker = true;
