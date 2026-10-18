/* Temasiden for inngrepsfri natur. Tallene kommer ferdig regnet ut fra gull (katalog.gull.inon), og utviklingen siden 1988 fra
   gull.inonUtvikling, som bare leses når siden vises. */
import { katalog } from '../../data/katalog.ts';
import { INONSONER } from '../../data/solv/inon.ts';
import { bildetallet, valgt } from '../../data/motor/valgt.ts';
import { ui } from '../tilstand.ts';
import { Fargelinje, Talltabell } from './deler.tsx';
import { andelTekst, dekar, iTekst, pst } from '../tekst.ts';
import { Temaside } from './Temaside.tsx';

/* Inngrepsfri natur i kommunen for hvert år Miljødirektoratet har status for. Tabellen henter fire ganger så mange bilder som resten
   av siden, så den leses bare når siden vises. */
function Utvikling() {
  const R = ui.side === 'inon' ? valgt(katalog.gull.inonUtvikling) : null;
  if (!R) return null;
  if (R.status === 'henter') return <p className="hint">Henter kartene for tidligere år …</p>;
  if (R.status === 'feil' || !R.verdi)
    return <p className="hint">Kartene for tidligere år kunne ikke hentes fra Miljødirektoratet.</p>;
  const U = R.verdi,
    fra = U.sum[0],
    d = U.sum[U.sum.length - 1] - fra,
    tall = (km2: number) => (km2 ? dekar(km2).replace(' daa', '') : '0');
  return (
    <>
      <p>
        Fra {U.aar[0]} til {U.aar[U.aar.length - 1]} har inngrepsfri natur i kommunen{' '}
        {d < 0 ? `gått ned med ${iTekst(-d)}` : d > 0 ? `økt med ${iTekst(d)}` : 'vært uendret'}
        {d && fra > 0 ? ` (${andelTekst((Math.abs(d) / fra) * 100)})` : ''}.
      </p>
      <Talltabell
        tittel="Inngrepsfri natur per år, daa"
        kolonner={['Sone', ...U.aar.map(String)]}
        rader={[
          ...[2, 1, 0].map(i => ({
            navn: INONSONER[i][4],
            farge: INONSONER[i][1],
            tall: U.soner.map(s => [tall(s[i])] as [string])
          })),
          { navn: 'Til sammen', klasse: 'sum', tall: U.sum.map(s => [tall(s)] as [string]) }
        ]}
      />
      <p className="hint">
        Alle årene er fra Miljødirektoratets utgave fra april 2024, talt i de samme rutene. Den første perioden er 20
        år, de andre fem.
      </p>
    </>
  );
}

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
  return (
    <Temaside id="inon" navn="Inngrepsfri natur" tall={I} under={har ? 'krysses ikke med planlagt utbygging' : ''}>
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
          <Utvikling />
        </>
      )}
    </Temaside>
  );
}
