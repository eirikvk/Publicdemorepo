/* Temasiden for grått areal. Tallene kommer ferdig regnet ut fra gull (byggGraa). */
import { byggGraa } from '../../data/gull/graa.ts';
import { GRAATRINN } from '../../data/solv/graa.ts';
import { utenPlan } from '../../data/motor/egne.ts';
import { app, gjeldende } from '../../data/motor/tilstand.ts';
import { Fargelinje } from './deler.tsx';
import { dekar, iTekst, pst } from '../tekst.ts';
import { Temaside } from './Temaside.tsx';

/* Grått areal: areal som alt er tatt i bruk eller sterkt påvirket, etter andel vegetasjon, og hvor mye av planlagt utbygging som
   ligger der. */
export default function Graa() {
  const G = byggGraa(gjeldende(app.graa), gjeldende(app.graaKryss), app.ssbSum),
    har = G.tilstand === 'ok',
    P = G.tilstand === 'ok' ? G.plan : null;
  const tekst =
    G.tilstand === 'feil'
      ? 'Grått areal kunne ikke hentes fra NIBIO.'
      : G.tilstand !== 'ok'
        ? 'Kartet over grå arealer har ingen flater i kommunen.'
        : `Ca. ${iTekst(G.sum)} av kommunen${G.andelLand !== null ? `, ${pst(G.andelLand)} % av landarealet,` : ''} er grått areal: tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet. Mye av det grå er likevel grønt. Listen under viser arealet etter hvor stor del av hver flate som er vegetasjon.`;
  let plan = null;
  if (har) {
    if (P) {
      plan = (
        <>
          <b>
            Av ca. {iTekst(P.km2)} planlagt utbygging på land{P.delvis ? ' i hentet kart' : ''} ligger ca.{' '}
            {iTekst(P.graa)} ({pst(P.andelGraa, 0)} %) på grått areal.
          </b>
          {` Det er gjenbruk av areal som alt er tatt i bruk. Ca. ${iTekst(P.gron)} av dette er flater med minst halvparten vegetasjon, så også gjenbruk kan ta grønt.${P.gront ? ` I tillegg ligger ca. ${iTekst(P.gront)} på grønt i bebygd område.` : ''}${P.antallEgne ? ' Tallene inkluderer egne områder.' : ''} Her er all planlagt utbygging med, også på bebygd areal og i smale striper.`}
        </>
      );
    } else
      plan = utenPlan()
        ? 'Kommunen har ingen kommuneplan hos DiBK å krysse med.'
        : 'Planlagt utbygging på grått areal regnes ut når kartet er hentet.';
  }
  const kilde = (
    <p className="hint">
      Kilde: Kart over grå arealer, Miljødirektoratet, Kartverket, NIBIO og SSB (testversjon 1, 2025), hentet fra NIBIO
      som to bilder av hele kommunen, og som fliser når kartet er zoomet inn. Arealene er regnet ut i nettleseren. Andel
      bygninger er ikke med, fordi tjenesten foreløpig oppgir 0 for alle flater vi har slått opp. I kartet er lysere
      grått mer vegetasjon, og blågrønt er grønt i bebygd område. Det blågrønne er regnet ut som bebygd areal i
      grunnkartet som ikke er grått. I en stikkprøve på 140 punkter i Trondheim var 133 det grunnkartet kaller grønne
      arealer.
    </p>
  );
  return (
    <Temaside
      id="graa"
      navn="Grått areal"
      tall={G}
      kilde={kilde}
      under={
        har && P
          ? `${pst(P.andelGraa, 0)} % av planlagt utbygging ligger på grått areal${P.delvis ? ', i hentet kart' : ''}`
          : ''
      }
    >
      <p>{tekst}</p>
      {har && (
        <ul className="talliste">
          {GRAATRINN.map(([id, navn], i) => (
            <Fargelinje key={id} id={id} navn={navn} tall={dekar(G.trinn[i + 1])} />
          ))}
          {G.trinn[6] > 0 && <Fargelinje id="graa0" navn="Uten oppgitt andel, som veier" tall={dekar(G.trinn[6])} />}
          <Fargelinje
            id="gront"
            navn="Grønt i bebygd område"
            tall={G.gront ? (G.gront.delvis ? 'minst ' : '') + dekar(G.gront.km2) : ''}
            under="Ikke grått areal. Parker, idrettsanlegg, golfbaner og lignende, som grunnkartet regner som bebygd og opparbeidet. Det er grønt, men telles ikke som natur."
          />
        </ul>
      )}
      {plan && <p role="status">{plan}</p>}
      {har && (
        <p>
          <b>Grått betyr ikke ledig.</b> Kartet skiller ikke mellom et boligområde i bruk og en nedlagt industritomt, og
          sier ikke noe om hva som kan bygges om. Det må leses sammen med lokal kunnskap.
        </p>
      )}
    </Temaside>
  );
}
