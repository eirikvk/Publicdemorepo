/* Om og metode: kall-loggen og katalogen (teknisk visning), hvordan klassene er satt sammen, om siden, og tekniske valg. */
import { katalog } from '../../data/katalog.ts';
import { finn } from '../../data/motor/kommune.ts';
import { app } from '../../data/motor/tilstand.ts';
import { settSmale } from '../kart/plan.ts';
import { REPO } from '../forklaringer.ts';
import { kb, tid } from '../tekst.ts';
import { ui } from '../tilstand.ts';
import { VERSJON } from '../../utgave.ts';
import Katalog from './Katalog.tsx';
import { MdCheckbox, MdLink, MdToggle } from './md.ts';

/* Teknisk visning: om den er slått på, og hvordan den slås av og på. Valget står i adressen, se App.tsx. */
export interface Tekniskvalg {
  teknisk: boolean;
  settTeknisk: (paa: boolean) => void;
}

export default function Om({ teknisk, settTeknisk }: Tekniskvalg) {
  const reg = katalog.bronse.klasseregister.naa(),
    medKlasser = Object.keys((reg && reg.kommuner) || {}).filter(nr => finn(nr));
  return (
    <>
      {teknisk && (
        <section className="prosa">
          <h2 className="md-typography-heading-s">Kall mot åpne kilder</h2>
          <div className="tabellramme">
            <table className="talltabell">
              <thead>
                <tr>
                  <th scope="col">Kilde</th>
                  <th scope="col">Hva</th>
                  <th scope="col" className="tall">
                    Tid
                  </th>
                  <th scope="col" className="tall">
                    Størrelse
                  </th>
                </tr>
              </thead>
              <tbody>
                {app.kall.map((r, i) => (
                  <tr key={i}>
                    <td>{r.kilde}</td>
                    <td>{r.hva}</td>
                    <td className={'tall' + (r.feilet ? ' feil' : '')}>{r.feilet ? 'feilet' : tid(r.ms)}</td>
                    <td className={'tall' + (r.feilet ? ' feil' : '')}>{r.feilet ? '' : kb(r.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Viser de siste kallene nettleseren din har gjort. Det som er hentet, huskes i cachen så lenge siden er åpen,
            og hentes ikke på nytt, se under. Bakgrunnskartet er ferdige fliser fra Kartverket, som kartet henter og
            husker selv, og er ikke med i listen.
          </p>
        </section>
      )}
      {teknisk && <Katalog />}
      <section className="prosa">
        <h2 className="md-typography-heading-s">Slik er klassene satt sammen</h2>
        <div className="tabellramme">
          <table className="talltabell">
            <thead>
              <tr>
                <th scope="col">Klasse</th>
                <th scope="col">Kart: økosystemtype</th>
                <th scope="col">Tall: arealklasse</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bebygd</td>
                <td>Bebygd og opparbeidet areal</td>
                <td>01–14</td>
              </tr>
              <tr>
                <td>Jordbruk</td>
                <td>Dyrket mark og grasmark</td>
                <td>15–16</td>
              </tr>
              <tr>
                <td>Natur</td>
                <td>Skog, hei, lite vegetert mark, våtmark og strand</td>
                <td>17–21 og 24</td>
              </tr>
              <tr>
                <td>Vann</td>
                <td>Innsjøer, elver og hav</td>
                <td>22.01 og 22.02. Hav er regnet ut.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Inndelingen sendes som en stil i hvert kall, så Norsk institutt for bioøkonomi (NIBIO) tegner seks klasser i
          stedet for elleve: de tre på land, og hav, innsjø og elv. Fargene settes i nettleseren og er hentet fra
          grunnkartets egen tegnforklaring: bebygd og opparbeidet areal, dyrket mark og skog, og grunnkartets tre farger
          for vann.
        </p>
      </section>
      <section className="prosa">
        <h2 className="md-typography-heading-s">Om siden</h2>
        <p>
          Alt hentes direkte i nettleseren når du velger kommune: grensen fra Kartverket, arealtallene fra Statistisk
          sentralbyrå (SSB) og kartet fra NIBIO. Listen over fylker og kommuner ligger lagret sammen med siden.
        </p>
        {medKlasser.length > 0 && reg && (
          <p>
            For {medKlasser.length === 1 ? finn(medKlasser[0])![1].navn : medKlasser.length + ' kommuner'} ligger også
            dagens arealklasser lagret, i ruter på 10,6 meter laget av kartet fra NIBIO ({reg.versjon}, hentet{' '}
            {reg.hentet}). Da regnes tallene for hele kommunen med en gang, og kartet bruker dem når det er zoomet ut.
            Fliser fra NIBIO tar over når du zoomer inn.
          </p>
        )}
        <p>
          For de andre kommunene hentes kartet fra NIBIO for hele kommunen når du velger den, flis for flis. Kartet
          fylles etter hvert, og tallene regnes ut på samme måte når alt er hentet. Det tar fra noen sekunder til rundt
          et minutt, etter hvor stor kommunen er.
        </p>
        <p>
          Hvordan hvert tall er hentet eller regnet ut, står i{' '}
          <MdLink href={REPO + 'METODE.md'}>metodebeskrivelsen</MdLink>. Biblioteker og tjenester siden bruker, står i{' '}
          <MdLink href={REPO + 'AVHENGIGHETER.md'}>oversikten over avhengigheter</MdLink>.
        </p>
        <p>
          Kart: Nasjonalt grunnkart for arealanalyse, årsversjon 2025, NIBIO. Tall: SSB, tabell 09594. Kommuneplan:
          DiBK. Verneområder, villreinområder, naturtyper og inngrepsfri natur: Miljødirektoratet. Grått areal:
          Miljødirektoratet, Kartverket, NIBIO og SSB. Grenser og bakgrunnskart: Kartverket. Utformingen følger
          Miljødirektoratets designsystem.
        </p>
      </section>
      <section>
        <h2 className="md-typography-heading-s">Tekniske valg</h2>
        <MdToggle
          label="Vis teknisk informasjon"
          checked={teknisk}
          textLeft={false}
          onChange={e => settTeknisk(e.target.checked)}
        />
        {teknisk && <p className="hint">Utgave: {VERSJON}.</p>}
        {teknisk && (
          <p className="hint" role="status">
            {ui.maaling || 'Flytt kartet for å måle hvor jevnt det går.'}
          </p>
        )}
        <MdCheckbox
          label="Vis smale striper i planlagt utbygging"
          checked={ui.visSmale}
          onChange={e => settSmale(e.target.checked)}
        />
        <p className="hint">
          Smale striper er smale deler av planlagt utbygging, høyst rundt 20 meter brede (to ruter på 10,6 meter), som
          ligger inntil bebygd areal. De kommer som oftest av at plangrensen og grunnkartet ikke er tegnet helt likt.
          Smale deler ute i naturen, som en ny vei, telles med.
        </p>
      </section>
    </>
  );
}
