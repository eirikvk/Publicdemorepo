/* Temasidene: verneområder, villrein og verdsatt natur fra Miljødirektoratet, inngrepsfri natur og grått areal. Hvert tema er en
   egen side. Toppen svarer på det samme for alle temaene: hvor mye som finnes i kommunen, hvor stor del av landarealet det er,
   og hvor mye planlagt utbygging som ligger innenfor. Under står detaljene. */
import { RUTE } from '../solv/felles.js';
import { byggNaturTall } from '../gull/temaer.js';
import { GRAATRINN } from '../solv/graa.js';
import { INONSONER } from '../solv/inon.js';
import { app, gjeldende } from '../motor/felles.js';
import { utenPlan } from '../motor/egne.js';
import { visIKartet } from '../motor/naturtema.js';
import { settSlor } from '../motor/handlinger.js';
import { Fargelinje, Forklaring, Rute, Stripe } from './deler.jsx';
import { MdButton, MdCheckbox, MdIconLocation, MdIconOpenInNew } from './md.js';
import { andelTekst, antallOrd, dekar, dekarFraRuter, iTekst, nf, periode, prosent, stor } from './tekst.js';
import './Temaer.css';

export const ETT = { vern: 'ett', rein: 'ett', verdi: 'én' }; /* ett verneområde, én lokalitet */

/* Toppen av en temaside: navnet, arealet i kommunen og andelen av landarealet, og en linje om planlagt utbygging. status er henter,
   feil, ingen eller ok. Detaljene står under, med kilden nederst. Mens temaet hentes, står det bare det. */
function Temaside({ id, navn, status, sum, under, kilde, children }) {
  return (
    <div className="temaside prosa" id={'tema-' + id}>
      <h2 className="md-typography-heading-s">
        <Rute id={id} />
        {navn}
      </h2>
      {status === 'ok' && (
        <div>
          <p>
            <b>{dekar(sum)}</b> i kommunen{app.ssbSum ? `, ${andelTekst((sum / app.ssbSum) * 100)} av landarealet` : ''}
          </p>
          {under && <p className="hint temaunder">{under}</p>}
        </div>
      )}
      {status === 'henter' ? <p>{app.valgt ? 'Henter …' : ''}</p> : children}
      {kilde}
    </div>
  );
}

/* Status for et tema som hentes som ett bilde av kommunen: inngrepsfri natur og grått areal */
export const bildeStatus = D =>
  !D || D.tilstand === 'henter' ? 'henter' : D.tilstand !== 'ok' ? 'feil' : D.sum > 0 ? 'ok' : 'ingen';

/* Helhetsbildet for verdsatt natur: landarealet delt i kartlagt og ikke kartlagt, og så hver del for seg med verdsatt natur etter
   verdi. Det vi ikke vet noe om, tegnes som en tom ramme. Slik skilles «ingenting funnet» fra «ikke lett». */
function Helhet({ t, H, E }) {
  const { L, K, U, inne, ute, si, su } = H;
  const verdier = a => t.klasser.map(([navn, id], v) => [navn, '--' + id, a[v]]);
  return (
    <>
      <h3 className="md-typography-heading-xs">Helhetsbildet: verdsatt natur og kartlegging</h3>
      <Stripe
        hva="Landarealet"
        deler={[
          ['Kartlagt', 'kjent', K],
          ['Ikke kartlagt', 'tom', U]
        ]}
      />
      <Forklaring
        deler={[
          ['Kartlagt', 'kjent', `${dekar(K)} (${prosent(K, L)} %)`],
          ['Ikke kartlagt', 'tom', `${dekar(U)} (${prosent(U, L)} %)`]
        ]}
      />
      <h4 className="md-typography-label-s">Der det er kartlagt</h4>
      <Stripe
        hva="Det kartlagte"
        deler={[...verdier(inne), ['Ingen verdsatt natur registrert', 'kjent', Math.max(0, K - si)]]}
      />
      <p>
        {prosent(si, K)} % har verdsatt natur ({dekar(si)}).
      </p>
      <h4 className="md-typography-label-s">Der det ikke er kartlagt</h4>
      <Stripe hva="Det som ikke er kartlagt" deler={[...verdier(ute), ['Ukjent', 'tom', Math.max(0, U - su)]]} />
      <p>
        {su > 0
          ? `${prosent(su, U)} % har registrert verdsatt natur (${dekar(su)}), fra eldre kartlegging og utvalgte naturtyper. For resten finnes det ikke noe kart over hvor det er lett.`
          : 'Ingen verdsatt natur er registrert her, og det finnes ikke noe kart over hvor det er lett.'}
      </p>
      <p className="hint">
        Fargene er de samme som i listen over. Lave tall der det ikke er kartlagt, kan bety at det ikke er lett, ikke at
        naturen mangler verdi. Det kartlagte er ikke et tilfeldig utvalg av kommunen, så andelen derfra kan ikke
        overføres direkte til resten.
        {E.fra ? ` Kartlagt etter Miljødirektoratets instruks ${periode(E.fra, E.til)}.` : ''}
      </p>
    </>
  );
}

/* Et naturtema fra Miljødirektoratet, med områdene som liste. */
export function Naturtema({ t }) {
  const D = t.data,
    ok = !!D && !!app.valgt && D.nr === app.valgt.nr,
    o = ok ? D.omrader : [],
    sum = ok ? D.sum || 0 : 0;
  const kilde = (
    <p className="hint">
      Kilde: {t.kildetekst}. Arealet gjelder den delen av hvert område som ligger i kommunen, og er regnet ut i
      nettleseren.
      {t.vann ? ' Verneområder kan også ligge i sjø og innsjøer, så andelen av landarealet er et omtrentlig mål.' : ''}
    </p>
  );
  if (!ok) return <Temaside id={t.id} navn={t.navn} status="henter" kilde={kilde} />;
  const N = byggNaturTall(D, t.klasser, !!t.dekning, !!t.samlet, app.ssbSum),
    E = D.ekstra,
    { plan, smal } = N,
    der = app.ov && app.ov.dynamisk ? ' i den delen av kommunen det er hentet kart for' : '',
    helhet = !!t.dekning && !!N.helhet,
    kartlagt = !!E && E.km2 > 0;
  const under = !o.length
    ? ''
    : (t.dekning && E && app.ssbSum
        ? (E.km2 > 0
            ? `${prosent(Math.min(E.km2, app.ssbSum), app.ssbSum, 0)} % av landarealet er kartlagt`
            : 'ikke kartlagt etter dagens instruks') + '\n'
        : '') +
      (utenPlan()
        ? 'ingen kommuneplan å krysse med'
        : !D.regnet
          ? 'planlagt utbygging ikke regnet ut ennå'
          : (plan ? `ca. ${dekar(plan * RUTE)} planlagt utbygging innenfor` : 'ingen planlagt utbygging innenfor') +
            (app.ov && app.ov.dynamisk ? ', i hentet kart' : ''));
  const sumTekst = D.feil
    ? `${t.navn} kunne ikke hentes fra Miljødirektoratet.`
    : !o.length
      ? `Miljødirektoratet har ingen ${t.fl} registrert i kommunen.`
      : `${stor(antallOrd(o.length, ETT[t.id]))} ${o.length === 1 ? t.en : t.fl} dekker ca. ${iTekst(sum)} av kommunen${app.ssbSum ? `, ${prosent(sum, app.ssbSum)} % av landarealet` : ''}.${D.ufullstendig ? ' Tjenesten ga ikke alle lokalitetene i ett svar, så tallet er for lavt.' : ''}${t.klasser && D.klasser && o.length ? ` Ca. ${iTekst(D.klasser[0] + D.klasser[1])} har stor eller svært stor verdi.` : ''}`;
  const merk =
    !E || helhet
      ? ''
      : !(E.km2 > 0)
        ? 'Kommunen er ikke kartlagt etter Miljødirektoratets instruks. Laget viser da bare eldre registreringer og utvalgte naturtyper.'
        : `Ca. ${app.ssbSum ? prosent(Math.min(E.km2, app.ssbSum), app.ssbSum) + ' % av landarealet' : iTekst(E.km2)} er kartlagt etter Miljødirektoratets instruks${E.fra ? ` (${periode(E.fra, E.til)})` : ''}. Utenfor det kartlagte kan det finnes verdifull natur som ikke er registrert.`;
  let paavirkning = null;
  if (o.length) {
    if (utenPlan())
      paavirkning = 'Kommunen har ingen kommuneplan hos DiBK, så påvirkning fra planlagt utbygging kan ikke vurderes.';
    else if (!D.regnet) paavirkning = 'Påvirkning fra planlagt utbygging regnes ut når kartet er hentet.';
    else {
      const ant = N.berort;
      paavirkning = (
        <>
          <b>
            {plan
              ? `Ca. ${dekarFraRuter(plan)} planlagt utbygging ligger innenfor ${antallOrd(ant, ETT[t.id])} ${ant === 1 ? t.en : t.fl}${der}.`
              : `Ingen planlagt utbygging innenfor ${t.best}${der}.`}
          </b>
          {smal
            ? ` I tillegg kommer ca. ${dekarFraRuter(smal)} i smale striper, som oftest der grensene ikke er tegnet helt likt.`
            : ''}
        </>
      );
    }
  }
  const G = t.dekning && D.gap && D.gap.nat && D.regnet && !utenPlan() ? D.gap : null;
  const maks = t.samlet ? 15 : 40,
    vises = N.vises;
  return (
    <Temaside
      id={t.id}
      navn={t.navn}
      status={D.feil ? 'feil' : o.length ? 'ok' : 'ingen'}
      sum={sum}
      under={under}
      kilde={kilde}
    >
      <p>{sumTekst}</p>
      {N.klasser && (
        <ul className="talliste">
          {t.klasser.map(([navn, id], v) => {
            const { antall, plan: pl } = N.klasser[v];
            return (
              <Fargelinje
                key={id}
                id={id}
                navn={navn}
                tall={dekar(D.klasser[v])}
                under={`${nf(antall, 0)} ${antall === 1 ? 'lokalitet' : 'lokaliteter'}`}
              >
                {pl && D.regnet && !utenPlan() ? <b> · ca. {dekarFraRuter(pl)} planlagt utbygging</b> : null}
              </Fargelinje>
            );
          })}
        </ul>
      )}
      {helhet && <Helhet t={t} H={N.helhet} E={E} />}
      {merk && <p>{merk}</p>}
      {t.dekning && kartlagt && (
        <MdCheckbox
          label="Slør over det som ikke er kartlagt"
          checked={app.slorPaa}
          onChange={e => settSlor(e.target.checked)}
        />
      )}
      {paavirkning && <p role="status">{paavirkning}</p>}
      {G && (
        <p role="status">
          <b>
            Av ca. {dekarFraRuter(G.nat)} planlagt utbygging på natur{der} ligger ca. {dekarFraRuter(G.ukjent)} (
            {prosent(G.ukjent, G.nat, 0)} %) i områder som ikke er kartlagt.
          </b>{' '}
          Der vet vi ikke om det finnes verdifull natur. Smale striper er ikke med.
        </p>
      )}
      {vises.length > 0 && (
        <ul className="talliste">
          {vises.slice(0, maks).map(x => {
            const liId = `${t.id}-omr-${o.indexOf(x)}`;
            return (
              <li key={liId} id={liId}>
                <b className="navn">{x.navn}</b>
                <span className="tall">{dekar(x.km2)}</span>
                <small>
                  {x.under || ''}
                  {x.plan ? <b> · ca. {dekarFraRuter(x.plan)} planlagt utbygging</b> : null}
                </small>
                <div className="knapper">
                  <MdButton
                    theme="tertiary"
                    mode="small"
                    leftIcon={<MdIconLocation />}
                    aria-label={`Vis ${x.navn} i kartet`}
                    onClick={() => visIKartet(t, x, liId)}
                  >
                    Vis i kartet
                  </MdButton>
                  {x.url && (
                    <MdButton
                      asChild
                      asChildContent={<a href={x.url} target="_blank" rel="noopener" />}
                      theme="tertiary"
                      mode="small"
                      rightIcon={<MdIconOpenInNew />}
                      aria-label={`Åpne faktaark for ${x.navn} hos Miljødirektoratet, i ny fane`}
                      title="Åpnes i ny fane"
                    >
                      Faktaark
                    </MdButton>
                  )}
                </div>
              </li>
            );
          })}
          {vises.length > maks && <li>… og {vises.length - maks} til</li>}
        </ul>
      )}
    </Temaside>
  );
}

/* Inngrepsfri natur: sonene etter avstand til inngrep. Krysses ikke med planlagt utbygging. */
export function Inon() {
  const D = gjeldende(app.inon),
    status = bildeStatus(D),
    har = status === 'ok';
  const tekst =
    status === 'feil'
      ? 'Inngrepsfri natur kunne ikke hentes fra Miljødirektoratet.'
      : !har
        ? 'Kommunen har ingen inngrepsfri natur: alt ligger nærmere enn én kilometer fra tyngre tekniske inngrep, som veier, kraftlinjer og regulerte vassdrag.'
        : `Ca. ${iTekst(D.sum)} av kommunen${app.ssbSum ? `, ${prosent(D.sum, app.ssbSum)} % av landarealet,` : ''} ligger minst én kilometer fra tyngre tekniske inngrep, som veier, kraftlinjer og regulerte vassdrag.`;
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
      status={status}
      sum={D && D.sum}
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
                tall={dekar(D.soner[i])}
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

/* Grått areal: areal som alt er tatt i bruk eller sterkt påvirket, etter andel vegetasjon, og hvor mye av planlagt utbygging som
   ligger der. */
export function Graa() {
  const D = gjeldende(app.graa),
    status = bildeStatus(D),
    har = status === 'ok',
    K = gjeldende(app.graaKryss);
  const tekst =
    status === 'feil'
      ? 'Grått areal kunne ikke hentes fra NIBIO.'
      : !har
        ? 'Kartet over grå arealer har ingen flater i kommunen.'
        : `Ca. ${iTekst(D.sum)} av kommunen${app.ssbSum ? `, ${prosent(D.sum, app.ssbSum)} % av landarealet,` : ''} er grått areal: tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet. Mye av det grå er likevel grønt. Listen under viser arealet etter hvor stor del av hver flate som er vegetasjon.`;
  let plan = null;
  if (har) {
    if (K && K.S.tot) {
      const S = K.S;
      plan = (
        <>
          <b>
            Av ca. {dekarFraRuter(S.tot)} planlagt utbygging på land{K.delvis ? ' i hentet kart' : ''} ligger ca.{' '}
            {dekarFraRuter(S.graa)} ({prosent(S.graa, S.tot, 0)} %) på grått areal.
          </b>
          {` Det er gjenbruk av areal som alt er tatt i bruk. Ca. ${dekarFraRuter(S.gron)} av dette er flater med minst halvparten vegetasjon, så også gjenbruk kan ta grønt.${S.gront ? ` I tillegg ligger ca. ${dekarFraRuter(S.gront)} på grønt i bebygd område.` : ''}${K.antallEgne ? ' Tallene inkluderer egne områder.' : ''} Her er all planlagt utbygging med, også på bebygd areal og i smale striper.`}
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
      status={status}
      sum={D && D.sum}
      kilde={kilde}
      under={
        har && K && K.S.tot
          ? `${prosent(K.S.graa, K.S.tot, 0)} % av planlagt utbygging ligger på grått areal${K.delvis ? ', i hentet kart' : ''}`
          : ''
      }
    >
      <p>{tekst}</p>
      {har && (
        <ul className="talliste">
          {GRAATRINN.map(([id, navn], i) => (
            <Fargelinje key={id} id={id} navn={navn} tall={dekar(D.trinn[i + 1])} />
          ))}
          {D.trinn[6] > 0 && <Fargelinje id="graa0" navn="Uten oppgitt andel, som veier" tall={dekar(D.trinn[6])} />}
          <Fargelinje
            id="gront"
            navn="Grønt i bebygd område"
            tall={K ? (K.delvis ? 'minst ' : '') + dekar(K.gront * RUTE) : ''}
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
