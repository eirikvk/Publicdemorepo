/* Om og metode: kall-loggen og katalogen (teknisk visning), hvordan klassene er satt sammen, om siden, og tekniske valg. */
import { useState } from 'react';
import { innhold } from '../../data/cache.ts';
import { katalog } from '../../data/katalog.ts';
import { finn } from '../../data/motor/kommune.ts';
import { app } from '../../data/motor/tilstand.ts';
import { settSmale } from '../kart/plan.ts';
import { kb, nf, tid } from '../tekst.ts';
import { ui } from '../tilstand.ts';
import { VERSJON } from '../../utgave.ts';
import { MdButton, MdCheckbox, MdLink, MdToggle } from './md.ts';

const REPO = 'https://github.com/eirikvk/Publicdemorepo/blob/main/';

/* Teknisk visning: om den er slått på, og hvordan den slås av og på. Valget står i adressen, se App.tsx. */
export interface Tekniskvalg {
  teknisk: boolean;
  settTeknisk: (paa: boolean) => void;
}

/* Katalogen og cachen: tabellene i bronse, sølv og gull, og det som er lagret i hver akkurat nå. Innholdet leses når man ber om det,
   så det ikke regnes ut på nytt hver gang siden tegnes. */
const LAGNAVN: Record<string, string> = {
  bronse: 'Bronse: svar fra kildene',
  solv: 'Sølv: tolket til felles standard',
  gull: 'Gull: det sidene viser'
};
function Katalog() {
  const [K, settK] = useState<ReturnType<typeof innhold> | null>(null);
  return (
    <section className="prosa">
      <h2 className="md-typography-heading-s">Katalogen</h2>
      <p>
        Tabellene i datapipelinen, i tre lag, og hva som er lagret i hver akkurat nå. Hver tabell er en funksjon i koden
        med samme navn: katalog.gull.inon er inon() i src/data/gull/inon.ts. Nøkkelen er som regel kommunenummeret. Gull
        regnes ut på nytt når planrutenettet eller det kartlagte for kommunen er nytt. Ingenting lagres i nettleseren
        etter at siden er lukket.
      </p>
      <MdButton theme="secondary" mode="small" onClick={() => settK(innhold())}>
        {K ? 'Oppdater' : 'Vis innholdet nå'}
      </MdButton>
      {K &&
        (['bronse', 'solv', 'gull'] as const).map(lag => (
          <div key={lag}>
            <h3 className="md-typography-heading-xs">{LAGNAVN[lag]}</h3>
            <ul className="talliste">
              {K.filter(d => d.lag === lag).map(d => {
                const r = d.rader,
                  uferdige = r.filter(x => x.status !== 'ok' || x.utdatert),
                  noekler =
                    r.length && r.length <= 8 && r.every(x => x.nokkel.length <= 24)
                      ? ': ' + r.map(x => (x.nokkel || 'tom nøkkel') + (x.delvis ? ' (delvis)' : '')).join(', ')
                      : '';
                return (
                  <li key={d.navn}>
                    <b className="navn">{d.navn}</b>
                    <span className="tall">{r.length ? kb(r.reduce((sum, x) => sum + x.byte, 0)) : ''}</span>
                    <small>
                      <b>
                        {nf(r.length, 0)} av {d.husk === Infinity ? 'alle' : nf(d.husk, 0)}
                        {noekler}
                      </b>
                      {uferdige.length
                        ? ` (${uferdige.map(x => `${x.nokkel || 'tom nøkkel'} ${x.utdatert ? 'utdatert' : x.status}`).join(', ')})`
                        : ''}
                      {'. ' + d.om[0].toUpperCase() + d.om.slice(1) + (d.om.endsWith('.') ? '' : '.')}
                    </small>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </section>
  );
}

export default function Om({ teknisk, settTeknisk }: Tekniskvalg) {
  const reg = katalog.bronse.oversiktsregister.naa(),
    medBilde = Object.keys((reg && reg.kommuner) || {}).filter(nr => finn(nr));
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
            Viser de siste kallene nettleseren din har gjort. Det som er hentet, huskes i katalogen så lenge siden er
            åpen, og hentes ikke på nytt, se under. Bakgrunnskartet er ferdige fliser fra Kartverket, som kartet henter
            og husker selv, og er ikke med i listen.
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
        <p>
          Planlagt endring hentes fra kommuneplanens arealdel hos Direktoratet for byggkvalitet (DiBK): arealformål i
          1000- og 2000-serien (bebyggelse og anlegg, samferdsel og teknisk infrastruktur) med status framtidig.
          Nettleseren legger dette oppå dagens klasser og viser bare det som i dag er natur eller jordbruk, med koksgrå
          for natur og brun for jordbruk. Finnes det ingen kommuneplan for kommunen hos DiBK, står det på siden
          Utvikling fremover.
        </p>
      </section>
      <section className="prosa">
        <h2 className="md-typography-heading-s">Om siden</h2>
        <p>
          Alt hentes direkte i nettleseren når du velger kommune: grensen fra Kartverket, arealtallene fra Statistisk
          sentralbyrå (SSB) og kartet fra NIBIO. Bare listen over fylker og kommuner ligger lagret sammen med siden.
        </p>
        {medBilde.length > 0 && reg && (
          <p>
            For {medBilde.length === 1 ? finn(medBilde[0])![1].navn : medBilde.length + ' kommuner'} ligger også et
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
          Smale striper er felt som ikke er bredere enn rundt 40 meter noe sted, ofte grøntdrag og kanter langs
          eksisterende bebyggelse. Smale deler av et større felt vises alltid.
        </p>
      </section>
    </>
  );
}
