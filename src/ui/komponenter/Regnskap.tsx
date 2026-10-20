/* Utbredelsesregnskapet: hvor mye natur, jordbruk og bebygd areal kommunen har, og om det blir mer eller mindre. Først forklart med
   tekst og stolper, så satt opp som et regnskap: areal ved start, netto endring og areal ved slutt, etter mønster fra FNs standard
   for naturregnskap (SEEA EA). Tallene er SSBs tabeller for naturregnskapet: arealet per økosystemtype i 2024, og endringen mellom
   bebygd og de andre fra 2017. Til SSB publiserer dem 25. november 2026, er de syntetiske, og det står under hvert kort. Til slutt
   land og vann. Tallene kommer ferdig regnet ut fra gull (katalog.gull.utbredelse, okosystemregnskap og landOgVann), de samme som
   tvillingen bruker. Her blir de tekst, stolper og tabell. */
import type { CSSProperties } from 'react';
import { katalog } from '../../data/katalog.ts';
import type { Utbredelse } from '../../data/gull/naturregnskap.ts';
import { utenPlan } from '../../data/motor/egne.ts';
import { valgt, verdi } from '../../data/motor/valgt.ts';
import { Forklaring, Rute, Sidelenke, Stripe, Talltabell } from './deler.tsx';
import { andelTekst, dekar, iTekst, medFortegn, nf, ramse } from '../tekst.ts';
import { Korttittel } from './Tallforklaring.tsx';
import './Regnskap.css';

/* Merket under et kort med syntetiske tall */
const Syntetisk = ({ s }: { s: boolean }) =>
  s ? (
    <p className="hint">
      Syntetiske tall: laget av SSBs arealstatistikk til SSBs tabeller for naturregnskapet kommer 25. november 2026.
    </p>
  ) : null;

/* Hele dekar fra km², og en endring i hele dekar med fortegn */
const hele = (km2: number) => nf(Math.round(km2 * 1000), 0),
  endring = (km2: number) => medFortegn(Math.round(km2 * 1000), v => nf(v, 0));

/* Forskjellen fra 2017 for hver klasse, som stolper ut fra en midtlinje: til venstre er mindre, til høyre er mer. Den lengste
   stolpen fyller halve bredden. */
function Endring({ E }: { E: Utbredelse }) {
  if (E.endret)
    return (
      <div className="utvikling">
        <h3 className="md-typography-heading-xs">Mer eller mindre natur enn i {E.fra}?</h3>
        <p>
          SSBs tall har ikke kommunen i {E.fra}, trolig fordi grensen er flyttet eller kommunen er ny. Endringen kan
          derfor ikke regnes.
        </p>
      </div>
    );
  /* endringen per klasse, som alltid er regnet når årene kan sammenlignes */
  const K = E.klasser.map(k => ({ id: k.id, navn: k.navn, v: k.endring || 0 })),
    tekst = ramse(
      K.map(
        ({ navn, v }) =>
          `${navn.toLowerCase()} ${Math.round(v * 1000) ? `${v < 0 ? 'ned' : 'opp'} ${iTekst(Math.abs(v))}` : 'uendret'}`
      )
    );
  return (
    <div className="utvikling">
      <h3 className="md-typography-heading-xs">Mer eller mindre natur enn i {E.fra}?</h3>
      <p>
        Fra {E.fra} til {E.til}: {tekst}. Det er arealet som er gått fra jordbruk og natur til bebygd.
        {E.flyttet ? ' Grensen er trolig flyttet i perioden, så tallene er mer usikre.' : ''}
      </p>
      <ul className="endring">
        {K.map(({ id, navn, v }) => (
          <li key={id}>
            <span className="navn">
              <Rute id={id} />
              {navn}
            </span>
            <span className="akse" aria-hidden="true">
              <i
                className={v < 0 ? 'ned' : 'opp'}
                style={{ '--c': `var(--${id})`, '--b': (Math.abs(v) / E.maks) * 50 + '%' } as CSSProperties}
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
  const T = valgt(katalog.gull.utbredelse),
    U = T && T.status === 'ok' ? T.verdi! : null,
    natur = U && U.klasser[0];
  return (
    <section className="utbredelse" aria-labelledby="regnskap-tittel">
      <Korttittel kort="utbredelse" id="regnskap-tittel" />
      <p>Hvor mye natur, jordbruk og bebygd areal kommunen har, og om det blir mer eller mindre over tid.</p>
      {!U ? (
        <p>{T && T.status === 'feil' ? 'Tallene kunne ikke hentes fra SSB.' : 'Henter …'}</p>
      ) : (
        <div className="fordeling">
          <p className="total">
            <b>{dekar(natur!.km2)}</b> natur i {U.aar}, {andelTekst(natur!.andel || 0)} av landarealet
          </p>
          <Stripe
            hva={`Landarealet i ${U.aar}`}
            deler={U.klasser.map(k => [
              k.navn,
              '--' + k.id,
              Math.max(k.km2, 0.0001),
              `${k.navn}: ${dekar(k.km2)}, ${andelTekst(k.andel || 0)}`
            ])}
          />
          <Forklaring deler={U.klasser.map(k => [k.navn, '--' + k.id, andelTekst(k.andel || 0)])} />
        </div>
      )}
      {U && <Endring E={U} />}
      <Syntetisk s={!!U && U.syntetisk} />
    </section>
  );
}

/* Regnskapsoppstillingen: én kolonne per klasse og en sum, og radene areal ved start, netto endring og areal ved slutt */
function Oppstilling() {
  const O = verdi(katalog.gull.okosystemregnskap);
  if (!O || O.endret) return null;
  const P = utenPlan() ? null : verdi(katalog.gull.plansum);
  return (
    <section className="regnskap prosa" aria-labelledby="oppstilling-tittel">
      <Korttittel kort="oppstilling" id="oppstilling-tittel" />
      <Talltabell
        kolonner={['daa', ...O.klasser.map(k => k.navn), 'Sum']}
        rader={[
          { navn: `Inngående areal ${O.fra}`, tall: [...O.klasser, O.sum].map(k => [hele(k.inngaende)]) },
          { navn: 'Netto endring', tall: [...O.klasser, O.sum].map(k => [endring(k.endring)]) },
          { navn: `Utgående areal ${O.til}`, klasse: 'sum', tall: [...O.klasser, O.sum].map(k => [hele(k.utgaende)]) }
        ]}
      />
      <Syntetisk s={O.syntetisk} />
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
    </section>
  );
}

/* Land og vann: land, innsjø og elv er SSBs tall for 2024. Hav er regnet ut som kommunens flate minus land og ferskvann. */
function LandOgVann() {
  const V = verdi(katalog.gull.landOgVann);
  return (
    <section className="vann" aria-labelledby="vann-tittel">
      <Korttittel kort="landOgVann" id="vann-tittel" />
      {V && (
        <>
          <Stripe hva="Kommunens flate" deler={V.deler.map(([id, navn, v]) => [navn, '--' + id, v])} />
          <Forklaring
            deler={V.deler.map(([id, navn, v]) => [navn, '--' + id, `${id === 'hav' ? 'ca. ' : ''}${dekar(v)}`])}
          />
          <Syntetisk s={V.syntetisk} />
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
