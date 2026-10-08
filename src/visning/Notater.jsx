/* Nederst på siden: kall-loggen (teknisk visning), hvordan klassene er satt sammen, om siden, og tekniske valg. */
import { app, VERSJON } from '../motor/felles.js';
import { finn, settSmale } from '../motor/handlinger.js';
import { MdCheckbox, MdLink, MdToggle } from './md.js';

const REPO = 'https://github.com/eirikvk/Publicdemorepo/blob/main/';

export default function Notater({ teknisk, settTeknisk }) {
  const medBilde = Object.keys(app.oversikter).filter(nr => finn(nr)),
    reg = app.oversiktInfo;
  return (
    <div className="notater">
      {teknisk && (
        <section className="prosa">
          <h2 className="seksjonstittel">Kall mot åpne kilder</h2>
          <div className="tabellramme">
            <table className="talltabell logg">
              <thead>
                <tr>
                  <th scope="col">Kilde</th>
                  <th scope="col">Hva</th>
                  <th scope="col" className="r">
                    Tid
                  </th>
                  <th scope="col" className="r">
                    Størrelse
                  </th>
                </tr>
              </thead>
              <tbody>
                {app.kall.map((r, i) => (
                  <tr key={i}>
                    <td>{r[0]}</td>
                    <td>{r[1]}</td>
                    <td className={'r' + (r[4] ? ' feil' : '')}>{r[2]}</td>
                    <td className={'r' + (r[4] ? ' feil' : '')}>{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Viser de siste kallene nettleseren din har gjort. Kartfliser nettleseren allerede har, hentes ikke på nytt.
            Grenser, tall, plansjekk, verneområder og villreinområder huskes også så lenge siden er åpen.
            Bakgrunnskartet er ferdige fliser fra Kartverket og er ikke med i listen.
          </p>
        </section>
      )}
      <section className="prosa">
        <h2 className="seksjonstittel">Slik er klassene satt sammen</h2>
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
        <p>
          Planlagt endring hentes fra kommuneplanens arealdel hos Direktoratet for byggkvalitet (DiBK): arealformål i
          1000- og 2000-serien (bebyggelse og anlegg, samferdsel og teknisk infrastruktur) med status framtidig.
          Nettleseren legger dette oppå dagens klasser og viser bare det som i dag er natur eller jordbruk, med koksgrå
          for natur og brun for jordbruk. Finnes det ingen kommuneplan for kommunen hos DiBK, står det under kartet og
          ved planlagt utbygging. Laget kan vises alene, uavhengig av de tre klassene.
        </p>
      </section>
      <section className="prosa">
        <h2 className="seksjonstittel">Om siden</h2>
        <p>
          Alt hentes direkte i nettleseren når du velger kommune: grensen fra Kartverket, arealtallene fra Statistisk
          sentralbyrå (SSB) og kartet fra NIBIO. Bare listen over fylker og kommuner ligger lagret sammen med siden.
        </p>
        {medBilde.length > 0 && reg && (
          <p>
            For {medBilde.length === 1 ? finn(medBilde[0])[1].navn : medBilde.length + ' kommuner'} ligger også et
            ferdig oversiktsbilde lagret ({reg.versjon}, hentet {reg.hentet}). Det vises når kartet er zoomet ut, og
            fliser fra NIBIO tar over når du zoomer inn.
          </p>
        )}
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
        <h2 className="seksjonstittel">Tekniske valg</h2>
        <MdToggle
          label="Vis teknisk informasjon"
          checked={teknisk}
          textLeft={false}
          onChange={e => settTeknisk(e.target.checked)}
        />
        {teknisk && <p className="tek">Utgave: {VERSJON}.</p>}
        {teknisk && (
          <p className="tek" role="status">
            {app.maaling || 'Flytt kartet for å måle hvor jevnt det går.'}
          </p>
        )}
        <MdCheckbox
          label="Vis smale striper i planlagt utbygging"
          checked={app.visSmale}
          onChange={e => settSmale(e.target.checked)}
        />
        <p className="hint">
          Smale striper er felt som ikke er bredere enn rundt 40 meter noe sted, ofte grøntdrag og kanter langs
          eksisterende bebyggelse. Smale deler av et større felt vises alltid.
        </p>
      </section>
    </div>
  );
}
