/* Kartlaget med dagens arealklasser i kartfargene, tegnet av datamotoren (klasserIFlis) med den felles tegnemotoren (verdilag.ts):
   den felles sannheten i sølv på nivået kartet viser, så hver piksel er én klasse, den samme i alle kartlagene. Fra nivå 10 og finere
   solv.klasser (nivå 10 er blokkene tallene regnes av), og zoomet ut solv.klasserUt, utledet av blokkene. Zoomet inn vises også det
   som er utenfor kommunen. Mens nye fliser lages, viser kartet flisene det alt har fra nabonivåene. */
import { klasserIFlis } from '../../data/motor/kartverdier.ts';
import { ALLE } from '../../data/solv/klasser.ts';
import { rgb } from '../farger.ts';
import { KILDER } from './felles.ts';
import { verdilag } from './verdilag.ts';

/* Kartfargene per klasse, i rekkefølgen i ALLE */
const klassefarger = () => ALLE.map(([id]) => rgb(id));

export const tema = verdilag({
  tittel: 'Dagens arealklasser',
  kilder: [KILDER.nibio],
  verdier: klasserIFlis,
  farger: () => [null, ...klassefarger()],
  klipp: 'zoomet ut'
});
