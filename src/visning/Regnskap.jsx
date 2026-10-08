/* Utbredelsesregnskapet: hvor mye natur, jordbruk og bebygd areal kommunen har, og om det blir mer eller mindre. Først forklart med
   tekst og stolper, så satt opp som et regnskap: areal ved start, netto endring og areal ved slutt, etter mønster fra FNs standard
   for naturregnskap (SEEA EA). Tallene er SSBs arealstatistikk (tabell 09594), til SSBs egne tabeller over arealendringer kommer.
   Til slutt land og vann. Tallene hentes i motoren, her blir de tekst, stolper og tabell. */
import { app, gjeldende, KL } from '../motor/felles.js';
import { utenPlan } from '../motor/egne.js';
import { tolkVann } from '../motor/tall.js';
import { Forklaring, Rute, Sidelenke, Stripe, Talltabell } from './deler.jsx';
import { andelTekst, dekar, iTekst, medFortegn, nf, ramse } from './tekst.js';
import './Regnskap.css';

/* Klassene med natur først, med plassen i SSB-tallene (bebygd, jordbruk, natur) */
const KLASSER = KL.map(([id, navn], i) => [id, navn, i]).reverse();

/* Hele dekar fra km², og en endring i hele dekar med fortegn */
const hele = km2 => nf(Math.round(km2 * 1000), 0),
  endring = km2 => medFortegn(Math.round(km2 * 1000), v => nf(v, 0));
const sum = a => a[0] + a[1] + a[2];

/* Forskjellen fra 2017 for hver klasse, som stolper ut fra en midtlinje: til venstre er mindre, til høyre er mer. Den lengste
   stolpen fyller halve bredden. */
function Endring({ H }) {
  if (H.endret)
    return (
      <div className="utvikling">
        <h3 className="md-typography-heading-xs">Mer eller mindre natur enn i {H.fra}?</h3>
        <p>
          Kommunens flate er ikke den samme i SSBs tall for {H.fra} og {H.til}, trolig fordi grensen er flyttet. Tallene
          kan derfor ikke sammenlignes.
        </p>
      </div>
    );
  const d = KLASSER.map(([id, navn, i]) => [id, navn, H.a1[i] - H.a0[i]]),
    maks = Math.max(...d.map(x => Math.abs(x[2]))) || 1;
  const tekst = ramse(
    d.map(
      ([, navn, v]) =>
        `${navn.toLowerCase()} ${Math.round(v * 1000) ? `${v < 0 ? 'ned' : 'opp'} ${iTekst(Math.abs(v))}` : 'uendret'}`
    )
  );
  return (
    <div className="utvikling">
      <h3 className="md-typography-heading-xs">Mer eller mindre natur enn i {H.fra}?</h3>
      <p>
        Fra {H.fra} til {H.til}: {tekst}. Det er forskjellen mellom to årganger av SSBs statistikk, ikke målt endring.
        Noe av forskjellen kan skyldes bedre kartlegging.
      </p>
      <ul className="endring">
        {d.map(([id, navn, v]) => (
          <li key={id}>
            <span className="navn">
              <Rute id={id} />
              {navn}
            </span>
            <span className="akse" aria-hidden="true">
              <i
                className={v < 0 ? 'ned' : 'opp'}
                style={{ '--c': `var(--${id})`, '--b': (Math.abs(v) / maks) * 50 + '%' }}
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
    ok = !!T && T.tilstand === 'ok',
    a = ok ? T.a : null,
    land = ok ? sum(a) : 0,
    H = gjeldende(app.historie);
  return (
    <section className="utbredelse" aria-labelledby="regnskap-tittel">
      <h2 className="md-typography-heading-s" id="regnskap-tittel">
        Utbredelsesregnskap
      </h2>
      <p>Hvor mye natur, jordbruk og bebygd areal kommunen har, og om det blir mer eller mindre over tid.</p>
      {!ok ? (
        <p>{T && T.tilstand === 'feil' ? 'Tallene kunne ikke hentes fra SSB.' : 'Henter …'}</p>
      ) : (
        <div className="fordeling">
          <p className="total">
            <b>{dekar(a[2])}</b> natur i {T.aar}, {andelTekst((a[2] / land) * 100)} av landarealet
          </p>
          <Stripe
            hva={`Landarealet i ${T.aar}`}
            deler={KLASSER.map(([id, navn, i]) => [
              navn,
              '--' + id,
              Math.max(a[i], 0.0001),
              `${navn}: ${dekar(a[i])}, ${andelTekst((a[i] / land) * 100)}`
            ])}
          />
          <Forklaring deler={KLASSER.map(([id, navn, i]) => [navn, '--' + id, andelTekst((a[i] / land) * 100)])} />
        </div>
      )}
      {H && <Endring H={H} />}
    </section>
  );
}

/* Regnskapsoppstillingen: én kolonne per klasse og en sum, og radene areal ved start, netto endring og areal ved slutt */
function Oppstilling() {
  const H = gjeldende(app.historie);
  if (!H || H.endret) return null;
  const kol = a => [...KLASSER.map(([, , i]) => a[i]), sum(a)],
    a0 = kol(H.a0),
    a1 = kol(H.a1),
    avvik = Math.round((sum(H.a1) - sum(H.a0)) * 1000);
  const P = app.planSum && app.valgt && app.planSum.nr === app.valgt.nr && !utenPlan() ? app.planSum : null;
  return (
    <section className="regnskap prosa" aria-labelledby="oppstilling-tittel">
      <h2 className="md-typography-heading-s" id="oppstilling-tittel">
        Regnskapsoppstilling
      </h2>
      <Talltabell
        kolonner={['daa', ...KLASSER.map(k => k[1]), 'Sum']}
        rader={[
          { navn: `Inngående areal ${H.fra}`, tall: a0.map(v => [hele(v)]) },
          { navn: 'Netto endring', tall: a1.map((v, j) => [endring(v - a0[j])]) },
          { navn: `Utgående areal ${H.til}`, klasse: 'sum', tall: a1.map(v => [hele(v)]) }
        ]}
      />
      {avvik !== 0 && (
        <p>
          Summen av landarealet er ikke den samme i de to årgangene, så netto endring går ikke i null. Forskjellen er{' '}
          {nf(Math.abs(avvik), 0)} dekar.
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
  const V = tolkVann(app.flate, app.ssbSum, app.ferskvann);
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
