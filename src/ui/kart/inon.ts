/* Kartlaget for inngrepsfri natur. Kartflisene lages i nettleseren av sonene per rute i bitene i katalogen (katalog.solv.inonbit),
   så laget gir ingen flere kall når kartet flyttes eller zoomes, så lenge bitene er hentet. Nettleseren legger sonene oppå dagens klasser og fargelegger bare det som er
   natur, i tre mørkere grønntoner. Natur utenfor sonene beholder den vanlige grønnfargen. Laget deler lerret med klassene, så det får
   samme gjennomsiktighet og ser ut som en del av naturfargen. Det som er felles med grått areal, står i kommunebilde.ts. */
import { HALV } from '../../data/solv/felles.ts';
import { UTENFOR } from '../../data/solv/inon.ts';
import { NAT, klasserIFlis } from '../../data/solv/klasser.ts';
import { dagensKlasser } from '../../data/motor/grunnkart.ts';
import { katalog } from '../../data/katalog.ts';
import { bildetallet, valgt, verdi } from '../../data/motor/valgt.ts';
import { tidSlutt } from '../../data/motor/tilstand.ts';
import { rgb } from '../farger.ts';
import { KILDER, fargPiksel } from './felles.ts';
import { bitlag } from './kommunebilde.ts';

/* Sonene som tre masker i hver sin fargekanal: rød er minst 1 km, grønn minst 3 km og blå minst 5 km fra inngrep. Når en flis
   forstørres fra masken, jevner nettleseren ut hver maske for seg, og grensen settes der masken er halvveis. Maskene jevnes også ut
   to ganger på forhånd. Sonegrensene blir dermed glatte kurver også når kartet er zoomet langt inn, selv om rutene er på 10,6
   meter. */
export const inonLag = bitlag({
  side: 'inon',
  tittel: 'Inngrepsfri natur',
  kilder: [KILDER.mdir],
  data: () => verdi(katalog.solv.inon),
  bit: tc => katalog.solv.inonbit(tc).then(D => D.sone),
  tom: s => s === UTENFOR,
  noe: () => bildetallet(valgt(katalog.gull.inon)).tilstand === 'ok',
  jevninger: 2,
  fyll: s => [s === UTENFOR ? 0 : 255, s <= 1 ? 255 : 0, s === 0 ? 255 : 0],
  tegn: async (g, maske, tc) => {
    const t0 = performance.now(),
      P = (await maske()).P;
    let noe = false;
    for (let i = 0; i < P.length; i += 4)
      if (P[i] >= HALV && P[i + 3] >= HALV) {
        noe = true;
        break;
      }
    if (!noe) return false; /* ingen inngrepsfri natur her: dagens klasser trengs ikke */
    const K = await dagensKlasser(tc);
    if (!K) return false; /* klassene er ikke hentet ennå. Laget friskes opp når de er det. */
    const ut = g.createImageData(512, 512),
      o = ut.data,
      F = [rgb('inon2'), rgb('inon1'), rgb('inonv')],
      kl = klasserIFlis(K); /* dagens klasser med samme regel som tallene */
    let tegnet = false;
    for (let i = 0, q = 0; i < P.length; i += 4, q++) {
      if (P[i] < HALV || P[i + 3] < HALV || kl[q] !== NAT + 1) continue;
      fargPiksel(o, i, F[P[i + 2] >= HALV ? 2 : P[i + 1] >= HALV ? 1 : 0]);
      tegnet = true;
    }
    if (!tegnet) return false;
    g.putImageData(ut, 0, 0);
    tidSlutt('inngrepsfri natur, fliser', t0);
    return true;
  }
});
