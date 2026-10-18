/* Kartlaget for grått areal, tegnet av datamotoren (graaIFlis) med den felles tegnemotoren (verdilag.ts): trinnet i hver piksel fra
   sølv på nivået kartet viser, og grønt i bebygd område der dagens klasse på det samme nivået er bebygd, men ikke grått. På nivå 10 er
   det rutene tallene regnes av. I kartet er lysere grått mer vegetasjon, og blågrønt er grønt i bebygd område. */
import { GRAATRINN } from '../../data/solv/graa.ts';
import { katalog } from '../../data/katalog.ts';
import { graaIFlis } from '../../data/motor/kartverdier.ts';
import { bildetallet, valgt, verdi } from '../../data/motor/valgt.ts';
import { abonner } from '../../data/motor/tilstand.ts';
import { rgb } from '../farger.ts';
import { ui } from '../tilstand.ts';
import { KILDER, nyttSiden } from './felles.ts';
import { verdilag } from './verdilag.ts';

/* Fargene per verdi: trinn 1–5 etter andel vegetasjon, 6 grått uten oppgitt andel, og 7 grønt i bebygd område (GRONT) */
export const graaLag = verdilag({
  tittel: 'Grått areal',
  kilder: [KILDER.mdir, KILDER.kartverket, KILDER.nibio, KILDER.ssb] /* kart over grå arealer */,
  verdier: graaIFlis,
  farger: () => [null, ...GRAATRINN.map(x => rgb(x[0])), rgb('graa0'), rgb('gront')],
  klipp: 'alltid'
});
graaLag.setVisible(false);

/* Laget vises på siden for grått areal, når kommunen har noe grått areal (fra gull) */
const ny = nyttSiden();
abonner(() => {
  const synlig =
    ui.side === 'graa' && !!verdi(katalog.solv.grense) && bildetallet(valgt(katalog.gull.graa)).tilstand === 'ok';
  if (ny('synlig', synlig)) graaLag.setVisible(synlig);
});
