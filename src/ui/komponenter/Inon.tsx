/* Temasiden for inngrepsfri natur. Tallene kommer ferdig regnet ut fra gull (katalog.gull.inon). */
import { katalog } from '../../data/katalog.ts';
import { INONSONER } from '../../data/solv/inon.ts';
import { bildetallet, valgt } from '../../data/motor/valgt.ts';
import { Fargelinje } from './deler.tsx';
import { dekar, iTekst, pst } from '../tekst.ts';
import { Temaside } from './Temaside.tsx';

/* Inngrepsfri natur: sonene etter avstand til inngrep. Krysses ikke med planlagt utbygging. */
export default function Inon() {
  const I = bildetallet(valgt(katalog.gull.inon)),
    har = I.tilstand === 'ok';
  const tekst =
    I.tilstand === 'feil'
      ? 'Inngrepsfri natur kunne ikke hentes fra Miljødirektoratet.'
      : I.tilstand !== 'ok'
        ? 'Kommunen har ingen inngrepsfri natur: alt ligger nærmere enn én kilometer fra tyngre tekniske inngrep, som veier, kraftlinjer og regulerte vassdrag.'
        : `Ca. ${iTekst(I.sum)} av kommunen${I.andelLand !== null ? `, ${pst(I.andelLand)} % av landarealet,` : ''} ligger minst én kilometer fra tyngre tekniske inngrep, som veier, kraftlinjer og regulerte vassdrag.`;
  const kilde = (
    <p className="hint">
      Kilde: Miljødirektoratet, inngrepsfrie naturområder, nyeste status (2023). Sonene hentes som ett bilde av hele
      kommunen når kommunen velges, og både kartlaget og arealet lages av det i nettleseren. Arealet gjelder alt
      innenfor sonene, også innsjøer, så andelen av landarealet er et omtrentlig mål. I kartet er det bare klassen natur
      som får sonefarge.
    </p>
  );
  return (
    <Temaside
      id="inon"
      navn="Inngrepsfri natur"
      tall={I}
      under={har ? 'krysses ikke med planlagt utbygging' : ''}
      kilde={kilde}
    >
      <p>{tekst}</p>
      {har && (
        <>
          <p>I kartet vises naturen i fire grønntoner:</p>
          <ul className="talliste">
            <Fargelinje id="nat" navn="Annen natur" tall="" under="Nærmere enn 1 km fra inngrep" />
            {[2, 1, 0].map(i => (
              <Fargelinje
                key={i}
                id={INONSONER[i][1]}
                navn={INONSONER[i][4]}
                tall={dekar(I.soner[i])}
                under={INONSONER[i][3]}
              />
            ))}
          </ul>
          <p>
            <b>Inngrepsfri natur kan ikke krysses med planlagt utbygging slik de andre temaene kan.</b> Sonene følger
            avstanden til nærmeste tyngre tekniske inngrep. Et nytt inngrep kan derfor flytte sonegrensene flere
            kilometer unna, også når det ikke ligger i en sone selv.
          </p>
        </>
      )}
    </Temaside>
  );
}
