/* Temaene: verneområder, villrein og verdsatt natur fra Miljødirektoratet, inngrepsfri natur og grått areal. Hvert tema er en
   rad som kan åpnes. Raden svarer på det samme for alle temaene: hvor mye som finnes i kommunen, hvor stor del av landarealet det er,
   og hvor mye planlagt utbygging som ligger innenfor. Under står detaljene. */
import { andelTekst, app, dekar, gjeldende, iTekst, nf, RUTE } from '../motor/felles.js';
import { utenPlan } from '../motor/egne.js';
import { GRAATRINN } from '../motor/graa.js';
import { INONSONER } from '../motor/inon.js';
import { byggNaturTall, NATURLAG, visIKartet } from '../motor/naturtema.js';
import { settSlor } from '../motor/handlinger.js';
import { antallOrd, Fargelinje, Forklaring, Rute, Stripe, stor } from './deler.jsx';
import { MdAccordionItem, MdButton, MdCheckbox, MdIconLocation, MdIconOpenInNew } from './md.js';

const daa = n => iTekst(n * RUTE); /* fra antall ruter på 21 meter, brukes i setninger */
const ETT = { vern: 'ett', rein: 'ett', verdi: 'én' }; /* ett verneområde, én lokalitet */

/* Raden for et tema: navn, areal, andel og en linje under. Detaljene ligger inni. */
function Temarad({ id, navn, areal, andel, under, children }) {
  return (
    <MdAccordionItem
      id={'tema-' + id}
      className="temarad"
      label={
        <span className="temanavn">
          <Rute id={id} />
          <span>
            <span className="tittel">{navn}</span>
            {under && <small>{under}</small>}
          </span>
        </span>
      }
      headerContent={
        <span className="tematall">
          <span className="areal">{areal}</span>
          <span className="andel">{andel}</span>
        </span>
      }
    >
      <div className="temablokk prosa" role="region" aria-label={navn}>
        {children}
      </div>
    </MdAccordionItem>
  );
}

/* Tallene i raden for et tema som hentes som ett bilde av kommunen: areal og andel av landarealet, eller hvorfor de mangler. */
const radTall = (D, har) => ({
  areal: !D || D.tilstand === 'henter' ? '' : D.tilstand === 'feil' ? 'ikke hentet' : har ? dekar(D.sum) : 'ingen',
  andel: har && app.ssbSum ? andelTekst((D.sum / app.ssbSum) * 100) : ''
});

/* Helhetsbildet for verdsatt natur: landarealet delt i kartlagt og ikke kartlagt, og så hver del for seg med verdsatt natur etter
   verdi. Det vi ikke vet noe om, tegnes som en tom ramme. Slik skilles «ingenting funnet» fra «ikke lett». */
function Helhet({ t, H, E }) {
  const { L, K, U, inne, ute, si, su } = H;
  const pst = (a, b) => (b > 0 ? nf((a / b) * 100) : '0'),
    verdier = a => t.klasser.map(([navn, id], v) => [navn, '--' + id, a[v]]);
  return (
    <div className="kort">
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
          ['Kartlagt', 'kjent', `${dekar(K)} (${pst(K, L)} %)`],
          ['Ikke kartlagt', 'tom', `${dekar(U)} (${pst(U, L)} %)`]
        ]}
      />
      <h4 className="md-typography-label-s">Der det er kartlagt</h4>
      <Stripe
        hva="Det kartlagte"
        deler={[...verdier(inne), ['Ingen verdsatt natur registrert', 'kjent', Math.max(0, K - si)]]}
      />
      <p>
        {pst(si, K)} % har verdsatt natur ({dekar(si)}).
      </p>
      <h4 className="md-typography-label-s">Der det ikke er kartlagt</h4>
      <Stripe hva="Det som ikke er kartlagt" deler={[...verdier(ute), ['Ukjent', 'tom', Math.max(0, U - su)]]} />
      <p>
        {su > 0
          ? `${pst(su, U)} % har registrert verdsatt natur (${dekar(su)}), fra eldre kartlegging og utvalgte naturtyper. For resten finnes det ikke noe kart over hvor det er lett.`
          : 'Ingen verdsatt natur er registrert her, og det finnes ikke noe kart over hvor det er lett.'}
      </p>
      <p className="hint">
        Fargene er de samme som i listen over. Lave tall der det ikke er kartlagt, kan bety at det ikke er lett, ikke at
        naturen mangler verdi. Det kartlagte er ikke et tilfeldig utvalg av kommunen, så andelen derfra kan ikke
        overføres direkte til resten.
        {E.fra ? ` Kartlagt etter Miljødirektoratets instruks ${E.fra === E.til ? E.fra : E.fra + '–' + E.til}.` : ''}
      </p>
    </div>
  );
}

/* Et naturtema fra Miljødirektoratet, med områdene som liste. */
function Naturtema({ t }) {
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
  if (!ok)
    return (
      <Temarad id={t.id} navn={t.navn} areal="" andel="">
        <p>{app.valgt ? 'Henter …' : ''}</p>
        {kilde}
      </Temarad>
    );
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
            ? `${nf(Math.min(100, (E.km2 / app.ssbSum) * 100), 0)} % av landarealet er kartlagt`
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
      : `${stor(antallOrd(o.length, ETT[t.id]))} ${o.length === 1 ? t.en : t.fl} dekker ca. ${iTekst(sum)} av kommunen${app.ssbSum ? `, ${nf((sum / app.ssbSum) * 100)} % av landarealet` : ''}.${D.ufullstendig ? ' Tjenesten ga ikke alle lokalitetene i ett svar, så tallet er for lavt.' : ''}${t.klasser && D.klasser && o.length ? ` Ca. ${iTekst(D.klasser[0] + D.klasser[1])} har stor eller svært stor verdi.` : ''}`;
  const merk =
    !E || helhet
      ? ''
      : !(E.km2 > 0)
        ? 'Kommunen er ikke kartlagt etter Miljødirektoratets instruks. Laget viser da bare eldre registreringer og utvalgte naturtyper.'
        : `Ca. ${app.ssbSum ? nf(Math.min(100, (E.km2 / app.ssbSum) * 100)) + ' % av landarealet' : iTekst(E.km2)} er kartlagt etter Miljødirektoratets instruks${E.fra ? ` (${E.fra === E.til ? E.fra : E.fra + '–' + E.til})` : ''}. Utenfor det kartlagte kan det finnes verdifull natur som ikke er registrert.`;
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
              ? `Ca. ${daa(plan)} planlagt utbygging ligger innenfor ${antallOrd(ant, ETT[t.id])} ${ant === 1 ? t.en : t.fl}${der}.`
              : `Ingen planlagt utbygging innenfor ${t.best}${der}.`}
          </b>
          {smal
            ? ` I tillegg kommer ca. ${daa(smal)} i smale striper, som oftest der grensene ikke er tegnet helt likt.`
            : ''}
        </>
      );
    }
  }
  const G = t.dekning && D.gap && D.gap.nat && D.regnet && !utenPlan() ? D.gap : null;
  const maks = t.samlet ? 15 : 40,
    vises = N.vises;
  return (
    <Temarad
      id={t.id}
      navn={t.navn}
      areal={D.feil ? 'ikke hentet' : o.length ? dekar(sum) : 'ingen'}
      andel={!D.feil && o.length && app.ssbSum ? andelTekst((sum / app.ssbSum) * 100) : ''}
      under={under}
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
                {pl && D.regnet && !utenPlan() ? <b> · ca. {daa(pl)} planlagt utbygging</b> : null}
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
            Av ca. {daa(G.nat)} planlagt utbygging på natur{der} ligger ca. {daa(G.ukjent)} (
            {nf((G.ukjent / G.nat) * 100, 0)} %) i områder som ikke er kartlagt.
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
                  {x.plan ? <b> · ca. {daa(x.plan)} planlagt utbygging</b> : null}
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
      {kilde}
    </Temarad>
  );
}

/* Inngrepsfri natur: sonene etter avstand til inngrep. Krysses ikke med planlagt utbygging. */
function Inon() {
  const D = gjeldende(app.inon),
    ok = !!D && D.tilstand === 'ok',
    har = ok && D.sum > 0,
    { areal, andel } = radTall(D, har);
  let tekst;
  if (!D || D.tilstand === 'henter') tekst = app.valgt ? 'Henter …' : '';
  else if (!ok) tekst = 'Inngrepsfri natur kunne ikke hentes fra Miljødirektoratet.';
  else if (!har)
    tekst =
      'Kommunen har ingen inngrepsfri natur: alt ligger nærmere enn én kilometer fra tyngre tekniske inngrep, som veier, kraftlinjer og regulerte vassdrag.';
  else
    tekst = `Ca. ${iTekst(D.sum)} av kommunen${app.ssbSum ? `, ${nf((D.sum / app.ssbSum) * 100)} % av landarealet,` : ''} ligger minst én kilometer fra tyngre tekniske inngrep, som veier, kraftlinjer og regulerte vassdrag.`;
  return (
    <Temarad
      id="inon"
      navn="Inngrepsfri natur"
      areal={areal}
      andel={andel}
      under={har ? 'krysses ikke med planlagt utbygging' : ''}
    >
      <p>{tekst}</p>
      {har && (
        <>
          <p>
            {!app.vis.nat
              ? 'Laget følger klassen natur, som er slått av i kartet nå.'
              : app.inonPaa
                ? 'I kartet vises naturen nå i fire grønntoner:'
                : 'Når laget er på, vises naturen i kartet i fire grønntoner:'}
          </p>
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
      <p className="hint">
        Kilde: Miljødirektoratet, inngrepsfrie naturområder, nyeste status (2023). Sonene hentes som ett bilde av hele
        kommunen når kommunen velges, og både kartlaget og arealet lages av det i nettleseren. Arealet gjelder alt
        innenfor sonene, også innsjøer, så andelen av landarealet er et omtrentlig mål. I kartet er det bare klassen
        natur som får sonefarge.
      </p>
    </Temarad>
  );
}

/* Grått areal: areal som alt er tatt i bruk eller sterkt påvirket, etter andel vegetasjon, og hvor mye av planlagt utbygging som
   ligger der. */
function Graa() {
  const D = gjeldende(app.graa),
    ok = !!D && D.tilstand === 'ok',
    har = ok && D.sum > 0,
    K = gjeldende(app.graaKryss),
    { areal, andel } = radTall(D, har),
    dk = n => iTekst(n * RUTE);
  let tekst;
  if (!D || D.tilstand === 'henter') tekst = app.valgt ? 'Henter …' : '';
  else if (!ok) tekst = 'Grått areal kunne ikke hentes fra NIBIO.';
  else if (!har) tekst = 'Kartet over grå arealer har ingen flater i kommunen.';
  else
    tekst = `Ca. ${iTekst(D.sum)} av kommunen${app.ssbSum ? `, ${nf((D.sum / app.ssbSum) * 100)} % av landarealet,` : ''} er grått areal: tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet. Mye av det grå er likevel grønt. Listen under viser arealet etter hvor stor del av hver flate som er vegetasjon.`;
  let plan = null;
  if (har) {
    if (K && K.S.tot) {
      const S = K.S;
      plan = (
        <>
          <b>
            Av ca. {dk(S.tot)} planlagt utbygging på land{K.delvis ? ' i hentet kart' : ''} ligger ca. {dk(S.graa)} (
            {nf((S.graa / S.tot) * 100, 0)} %) på grått areal.
          </b>
          {` Det er gjenbruk av areal som alt er tatt i bruk. Ca. ${dk(S.gron)} av dette er flater med minst halvparten vegetasjon, så også gjenbruk kan ta grønt.${S.gront ? ` I tillegg ligger ca. ${dk(S.gront)} på grønt i bebygd område.` : ''}${K.antallEgne ? ' Tallene inkluderer egne områder.' : ''} Her er all planlagt utbygging med, også på bebygd areal og i smale striper.`}
        </>
      );
    } else
      plan = utenPlan()
        ? 'Kommunen har ingen kommuneplan hos DiBK å krysse med.'
        : 'Planlagt utbygging på grått areal regnes ut når kartet er hentet.';
  }
  return (
    <Temarad
      id="graa"
      navn="Grått areal"
      areal={areal}
      andel={andel}
      under={
        har && K && K.S.tot
          ? `${nf((K.S.graa / K.S.tot) * 100, 0)} % av planlagt utbygging ligger på grått areal${K.delvis ? ', i hentet kart' : ''}`
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
      <p className="hint">
        Kilde: Kart over grå arealer, Miljødirektoratet, Kartverket, NIBIO og SSB (testversjon 1, 2025), hentet fra
        NIBIO som to bilder av hele kommunen, og som fliser når kartet er zoomet inn. Arealene er regnet ut i
        nettleseren. Andel bygninger er ikke med, fordi tjenesten foreløpig oppgir 0 for alle flater vi har slått opp. I
        kartet er lysere grått mer vegetasjon, og blågrønt er grønt i bebygd område. Det blågrønne er regnet ut som
        bebygd areal i grunnkartet som ikke er grått. I en stikkprøve på 140 punkter i Trondheim var 133 det grunnkartet
        kaller grønne arealer.
      </p>
    </Temarad>
  );
}

export default function Temaer() {
  return (
    <section className="temaer" aria-labelledby="tema-tittel">
      <h2 className="md-typography-heading-s" id="tema-tittel">
        Tema i kommunen
      </h2>
      <p className="hint">
        Areal i kommunen, andel av landarealet og planlagt utbygging innenfor. Åpne et tema for detaljer. Temaene vises
        i kartet med knappene under kartet.
      </p>
      <div className="temaliste">
        {NATURLAG.map(t => (
          <Naturtema key={t.id} t={t} />
        ))}
        <Inon />
        <Graa />
      </div>
    </section>
  );
}
