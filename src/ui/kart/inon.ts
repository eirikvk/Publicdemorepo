/* Kartlaget for inngrepsfri natur, tegnet av datamotoren (inonIFlis) med den felles tegnemotoren (verdilag.ts): sonen i hver piksel
   fra sølv på nivået kartet viser, der dagens klasse på det samme nivået er natur, i tre mørkere grønntoner. Natur utenfor sonene
   beholder den vanlige grønnfargen. Sonene er rutene på 10,6 meter tallene regnes av, så laget henter ingenting nytt når kartet
   flyttes eller zoomes, så lenge bitene er hentet. Laget deler lerret med klassene, så det får samme gjennomsiktighet og ser ut som en
   del av naturfargen. */
import { katalog } from '../../data/katalog.ts';
import { inonIFlis } from '../../data/motor/kartverdier.ts';
import { bildetallet, valgt, verdi } from '../../data/motor/valgt.ts';
import { abonner } from '../../data/motor/tilstand.ts';
import { rgb } from '../farger.ts';
import { ui } from '../tilstand.ts';
import { KILDER, nyttSiden } from './felles.ts';
import { verdilag } from './verdilag.ts';

/* Fargene per verdi: 1 villmarkspreget, 2 sone 1, 3 sone 2 */
export const inonLag = verdilag({
  tittel: 'Inngrepsfri natur',
  kilder: [KILDER.mdir],
  verdier: inonIFlis,
  farger: () => [null, rgb('inonv'), rgb('inon1'), rgb('inon2')],
  klipp: 'alltid'
});
inonLag.setVisible(false);

/* Laget vises på siden for inngrepsfri natur, når kommunen har inngrepsfri natur (fra gull) */
const ny = nyttSiden();
abonner(() => {
  const synlig =
    ui.side === 'inon' && !!verdi(katalog.solv.grense) && bildetallet(valgt(katalog.gull.inon)).tilstand === 'ok';
  if (ny('synlig', synlig)) inonLag.setVisible(synlig);
});
