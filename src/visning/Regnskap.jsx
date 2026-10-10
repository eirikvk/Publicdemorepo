/* Utbredelsesregnskapet: hvor mye natur, jordbruk og bebygd areal kommunen har, og om det blir mer eller mindre. Først forklart med
   tekst og stolper, så satt opp som et regnskap: areal ved start, netto endring og areal ved slutt, etter mønster fra FNs standard
   for naturregnskap (SEEA EA). Tallene er SSBs arealstatistikk (tabell 09594), til SSBs egne tabeller over arealendringer kommer.
   Til slutt land og vann. Tallene kommer ferdig regnet ut fra gull/regnskap.js. Her blir de tekst, stolper og tabell. */
import { byggEndring, byggOppstilling, byggUtbredelse, landOgVann } from '../gull/regnskap.js';
import { app, gjeldende } from '../motor/felles.js';
import { utenPlan } from '../motor/egne.js';
import { Forklaring, Rute, Sidelenke, Stripe, Talltabell } from './deler.jsx';
import { andelTekst, dekar, iTekst, medFortegn, nf, ramse } from './tekst.js';
import './Regnskap.css';

/* Hele dekar fra km², og en endring i hele dekar med fortegn */
const hele = km2 => nf(Math.round(km2 * 1000), 0),
  endring = km2 => medFortegn(Math.round(km2 * 1000), v => nf(v, 0));

/* Forskjellen fra 2017 for hver klasse, som stolper ut fra en midtlinje: til venstre er mindre, til høyre er mer. Den lengste
   stolpen fyller halve bredden. */
function Endring({ E }) {
  if (E.endret)
    return (
      <div className="utvikling">
        <h3 className="md-typography-heading-xs">Mer eller mindre natur enn i {E.fra}?</h3>
        <p>
          Kommunens flate er ikke den samme i SSBs tall for {E.fra} og {E.til}, trolig fordi grensen er flyttet. Tallene
          kan derfor ikke sammenlignes.
        </p>
      </div>
    );
  const tekst = ramse(
    E.klasser.map(
      ({ navn, km2: v }) =>
        `${navn.toLowerCase()} ${Math.round(v * 1000) ? `${v < 0 ? 'ned' : 'opp'} ${iTekst(Math.abs(v))}` : 'uendret'}`
    )
  );
  return (
    <div className="utvikling">
      <h3 className="md-typography-heading-xs">Mer eller mindre natur enn i {E.fra}?</h3>
      <p>
        Fra {E.fra} til {E.til}: {tekst}. Det er forskjellen mellom to årganger av SSBs statistikk, ikke målt endring.
        Noe av forskjellen kan skyldes bedre kartlegging.
      </p>
      <ul className="endring">
        {E.klasser.map(({ id, navn, km2: v }) => (
          <li key={id}>
            <span className="navn">
              <Rute id={id} />
              {navn}
            </span>
            <span className="akse" aria-hidden="true">
              <i
                className={v < 0 ? 'ned' : 'opp'}
                style={{ '--c': `var(--${id})`, '--b': (Math.abs(v) / E.maks) * 50 + '%' }}
              />
            </span>
            <span className="tall">{endring(v)} daa</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Det pedagogiske: hvor mye natur det er nå, fordelingen på de tre klassene, og forskjellen fra 2017 */
function Utbredelse() {
  const T = app.arealtall,
    U = byggUtbredelse(T),
    natur = U && U.klasser[0],
    E = byggEndring(gjeldende(app.historie));
  return (
    <section className="utbredelse" aria-labelledby="regnskap-tittel">
      <h2 className="md-typography-heading-s" id="regnskap-tittel">
        Utbredelsesregnskap
      </h2>
      <p>Hvor mye natur, jordbruk og bebygd areal kommunen har, og om det blir mer eller mindre over tid.</p>
      {!U ? (
        <p>{T && T.tilstand === 'feil' ? 'Tallene kunne ikke hentes fra SSB.' : 'Henter …'}</p>
      ) : (
        <div className="fordeling">
          <p className="total">
            <b>{dekar(natur.km2)}</b> natur i {U.aar}, {andelTekst(natur.andel)} av landarealet
          </p>
          <Stripe
            hva={`Landarealet i ${U.aar}`}
            deler={U.klasser.map(k => [
              k.navn,
              '--' + k.id,
              Math.max(k.km2, 0.0001),
              `${k.navn}: ${dekar(k.km2)}, ${andelTekst(k.andel)}`
            ])}
          />
          <Forklaring deler={U.klasser.map(k => [k.navn, '--' + k.id, andelTekst(k.andel)])} />
        </div>
      )}
      {E && <Endring E={E} />}
    </section>
  );
}

/* Regnskapsoppstillingen: én kolonne per klasse og en sum, og radene areal ved start, netto endring og areal ved slutt */
function Oppstilling() {
  const O = byggOppstilling(gjeldende(app.historie));
  if (!O) return null;
  const P = app.planSum && app.valgt && app.planSum.nr === app.valgt.nr && !utenPlan() ? app.planSum : null;
  return (
    <section className="regnskap prosa" aria-labelledby="oppstilling-tittel">
      <h2 className="md-typography-heading-s" id="oppstilling-tittel">
        Regnskapsoppstilling
      </h2>
      <Talltabell
        kolonner={['daa', ...O.kolonner]}
        rader={[
          { navn: `Inngående areal ${O.fra}`, tall: O.inngaende.map(v => [hele(v)]) },
          { navn: 'Netto endring', tall: O.netto.map(v => [endring(v)]) },
          { navn: `Utgående areal ${O.til}`, klasse: 'sum', tall: O.utgaende.map(v => [hele(v)]) }
        ]}
      />
      {O.avvik !== 0 && (
        <p>
          Summen av landarealet er ikke den samme i de to årgangene, så netto endring går ikke i null. Forskjellen er{' '}
          {nf(Math.abs(O.avvik), 0)} dekar.
        </p>
      )}
      <p>
        Planlagt utbygging er ikke med i regnskapet, som viser arealet fram til i dag.
        {P
          ? ` Kommuneplanen setter av ca. ${iTekst(P.nat)} natur og ca. ${iTekst(P.jor)} jordbruk til framtidig utbygging.`
          : ''}{' '}
        Se <Sidelenke id="framtid">Utvikling fremover</Sidelenke>.
      </p>
      <p className="hint">
        Kilde: Statistisk sentralbyrå (SSB), tabell 09594. Oppstillingen følger mønsteret fra FNs standard for
        naturregnskap (SEEA EA): areal ved start, netto endring og areal ved slutt. SSB skriver at tabellen ikke kan
        brukes til å beregne arealendringer mellom årganger, fordi datagrunnlaget blir mer fullstendig over tid. SSB har
        varslet egne tabeller for arealendringer. Vann er ikke med.
      </p>
    </section>
  );
}

/* Land og vann: land, innsjø og elv er SSBs tall. Hav er regnet ut som kommunens flate minus land og ferskvann. */
function LandOgVann() {
  const V = landOgVann(app.flate, app.ssbSum, app.ferskvann);
  return (
    <section className="vann" aria-labelledby="vann-tittel">
      <h2 className="md-typography-heading-s" id="vann-tittel">
        Land og vann
      </h2>
      {V && (
        <>
          <Stripe hva="Kommunens flate" deler={V.deler.map(([id, navn, v]) => [navn, '--' + id, v])} />
          <Forklaring
            deler={V.deler.map(([id, navn, v]) => [navn, '--' + id, `${id === 'hav' ? 'ca. ' : ''}${dekar(v)}`])}
          />
          <p className="hint">
            {V.hav
              ? 'Land, innsjø og elv er SSBs tall. Hav er regnet ut som kommunens flate (grensen fra Kartverket) minus land og ferskvann.'
              : 'Land, innsjø og elv er SSBs tall. Kommunen har ikke hav.'}
          </p>
        </>
      )}
    </section>
  );
}

export default function Regnskap() {
  return (
    <>
      <Utbredelse />
      <Oppstilling />
      <LandOgVann />
    </>
  );
}
