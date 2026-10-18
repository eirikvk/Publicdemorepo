/* Kartlaget for planlagt utbygging: natur og jordbruk som kommuneplanen (og egne områder) setter av, tegnet av datamotoren
   (planIFlis) med den felles tegnemotoren (verdilag.ts). Sannheten er rutenettet tallene regnes av (gull.utbygging): på nivå 10
   rutene i det, finere kommuneplanen, dagens klasser og egne områder på nivået i eller inntil feltene i det, og zoomet ut med dagens
   klasse i pikselen og styrken etter hvor stor del av pikselen som er satt av (gull/planflis.ts). */
import { katalog } from '../../data/katalog.ts';
import { STYRKER } from '../../data/gull/planflis.ts';
import { utenPlan } from '../../data/motor/egne.ts';
import { planIFlis } from '../../data/motor/kartverdier.ts';
import { utbyggingen } from '../../data/motor/plan.ts';
import { verdi } from '../../data/motor/valgt.ts';
import { abonner, endret } from '../../data/motor/tilstand.ts';
import { rgb } from '../farger.ts';
import { ui } from '../tilstand.ts';
import { KILDER, nyttSiden } from './felles.ts';
import { verdilag } from './verdilag.ts';

const SVAKEST = 0.35; /* svakeste farge for en piksel med bare litt planlagt utbygging i seg, så den ikke forsvinner helt */
/* Fargene per verdi: natur satt av med styrke 1–STYRKER, og jordbruk satt av med styrke 1–STYRKER etter det */
function planfarger() {
  const N = rgb('pnat'),
    J = rgb('pjor'),
    F: (number[] | null)[] = [null];
  for (const f of [N, J])
    for (let s = 1; s <= STYRKER; s++)
      F.push([f[0], f[1], f[2], Math.round(255 * Math.max(SVAKEST, Math.sqrt(s / STYRKER)))]);
  return F;
}
export const planLag = verdilag({
  tittel: 'Planlagt utbygging',
  kilder: [KILDER.dibk],
  verdier: tc => planIFlis(tc, ui.visSmale),
  farger: planfarger,
  klipp: 'alltid',
  klasse: 'planlagt',
  folg: () => [utbyggingen(), verdi(katalog.solv.egne), ui.visSmale]
});
planLag.setVisible(false);

/* Smale striper i kartet, under Tekniske valg */
export function settSmale(paa: boolean) {
  ui.visSmale = paa;
  endret();
}

/* Laget vises når grensen er hentet og kommunen har noe å planlegge: kommuneplan eller egne områder */
const ny = nyttSiden();
abonner(() => {
  const synlig = !!verdi(katalog.solv.grense) && !utenPlan();
  if (ny('synlig', synlig)) planLag.setVisible(synlig);
});
