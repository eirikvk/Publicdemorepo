/* Kartlaget for inngrepsfri natur. Kartflisene lages i nettleseren av sonene per rute i katalogen (solv.inon), så laget
   gir ingen flere kall når kartet flyttes eller zoomes. Nettleseren legger sonene oppå dagens klasser og fargelegger bare det som er
   natur, i tre mørkere grønntoner. Natur utenfor sonene beholder den vanlige grønnfargen. Laget deler lerret med klassene, så det får
   samme gjennomsiktighet og ser ut som en del av naturfargen. Det som er felles med grått areal, står i kommunebilde.ts. */
import { HALV, SYNLIG } from '../../data/solv/felles.ts';
import { UTENFOR } from '../../data/solv/inon.ts';
import { NAT, klasseAv } from '../../data/solv/klasser.ts';
import { dagensKlasser } from '../../data/motor/grunnkart.ts';
import { inonRuter, inonTall } from '../../data/motor/gulldata.ts';
import { tidSlutt } from '../../data/motor/tilstand.ts';
import { rgb } from '../farger.ts';
import { fargPiksel } from './felles.ts';
import { bildelag } from './kommunebilde.ts';

/* Sonene som tre masker i hver sin fargekanal: rød er minst 1 km, grønn minst 3 km og blå minst 5 km fra inngrep. Når en flis
   forstørres fra masken, jevner nettleseren ut hver maske for seg, og grensen settes der masken er halvveis. Maskene jevnes også ut
   to ganger på forhånd. Sonegrensene blir dermed glatte kurver også når kartet er zoomet langt inn, selv om rutene er på 20 meter
   eller mer. */
export const inonLag = bildelag({
  side: 'inon',
  data: inonRuter,
  noe: () => inonTall().tilstand === 'ok',
  jevninger: 2,
  fyll: (P, D) => {
    for (let q = 0, i = 0; q < D.sone.length; q++, i += 4) {
      const s = D.sone[q];
      P[i] = s === UTENFOR ? 0 : 255;
      P[i + 1] = s <= 1 ? 255 : 0;
      P[i + 2] = s === 0 ? 255 : 0;
      P[i + 3] = 255;
    }
  },
  tegn: async (g, _, tegnMaske, tc) => {
    const t0 = performance.now();
    g.imageSmoothingQuality = 'high';
    tegnMaske();
    const P = g.getImageData(0, 0, 512, 512).data;
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
      F = [rgb('inon2'), rgb('inon1'), rgb('inonv')];
    let tegnet = false;
    for (let i = 0; i < P.length; i += 4) {
      if (P[i] < HALV || P[i + 3] < HALV || K[i + 3] < SYNLIG || klasseAv(K[i], K[i + 1], K[i + 2]) !== NAT) continue;
      fargPiksel(o, i, F[P[i + 2] >= HALV ? 2 : P[i + 1] >= HALV ? 1 : 0]);
      tegnet = true;
    }
    if (!tegnet) return false;
    g.putImageData(ut, 0, 0);
    tidSlutt('inngrepsfri natur, fliser', t0);
    return true;
  }
});
