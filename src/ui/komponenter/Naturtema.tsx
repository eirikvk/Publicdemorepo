/* Temasidene for naturtemaene fra Miljødirektoratet: verneområder, villrein og verdsatt natur. Toppen svarer på hvor mye som finnes i
   kommunen, hvor stor del av landarealet det er, og hvor mye planlagt utbygging som ligger innenfor. Under står områdene som liste,
   og for verdsatt natur helhetsbildet med kartleggingen. Tallene kommer ferdig regnet ut fra gull, i tre deler: temaet
   (katalog.gull.verneomrader), planlagt utbygging i det (katalog.gull.verneomraderIPlan), og for verdsatt natur kartleggingen
   (katalog.gull.verdsattNaturKartlagt). Temaet vises med en gang, og planen og kartleggingen legges til når de er klare. Siden
   setter bare tallene sammen: planlagt utbygging per område står på samme plass som området i listen. */
import { TEMATABELLER } from '../../data/katalog.ts';
import type { Kartleggingen, TemaIPlan, Temaet } from '../../data/gull/temaer.ts';
import type { Rad } from '../../data/cache.ts';
import type { Naturtema as Tema } from '../../data/solv/temaer.ts';
import { utenPlan } from '../../data/motor/egne.ts';
import { bareHentetKart } from '../../data/motor/grunnkart.ts';
import { valgt } from '../../data/motor/valgt.ts';
import { settSlor, visIKartet } from '../kart/naturtema.ts';
import { ui } from '../tilstand.ts';
import { Fargelinje, Forklaring, Stripe, type Stripedel } from './deler.tsx';
import { MdButton, MdCheckbox, MdIconLocation, MdIconOpenInNew } from './md.ts';
import { antallOrd, dekar, iTekst, nf, periode, pst, stor } from '../tekst.ts';
import { Temaside } from './Temaside.tsx';

export const ETT: Record<string, string> = {
  vern: 'ett',
  rein: 'ett',
  verdi: 'én'
}; /* ett verneområde, én lokalitet */
/* Ordene sidene bruker om hvert naturtema: entall, flertall og bestemt form, og kilden. vann: temaet kan ligge i vann. */
interface Temaord {
  en: string;
  fl: string;
  best: string;
  vann?: boolean;
  kildetekst: string;
}
export const TEMAORD: Record<string, Temaord> = {
  vern: {
    en: 'verneområde',
    fl: 'verneområder',
    best: 'verneområdene',
    vann: true,
    kildetekst: 'Miljødirektoratet, naturvernområder'
  },
  rein: {
    en: 'villreinområde',
    fl: 'villreinområder',
    best: 'villreinområdene',
    kildetekst: 'Miljødirektoratet, leveområder for villrein'
  },
  verdi: {
    en: 'verdsatt lokalitet',
    fl: 'verdsatte lokaliteter',
    best: 'lokalitetene',
    kildetekst: 'Miljødirektoratet, naturtyper med KU-verdi og dekningskart for naturtypekartlegging'
  }
};

/* Tallene for planlagt utbygging i temaet T, når de er regnet ut for de samme områdene som listen viser. Ellers null: da er planen
   ikke regnet ut ennå. */
export const planenFor = (T: Temaet, I: Rad<TemaIPlan | null> | null) =>
  I && I.status === 'ok' && I.verdi && I.verdi.omrader === T.omrader ? I.verdi.N : null;

/* Helhetsbildet for verdsatt natur: landarealet delt i kartlagt og ikke kartlagt, og så hver del for seg med verdsatt natur etter
   verdi. Det vi ikke vet noe om, tegnes som en tom ramme. Slik skilles «ingenting funnet» fra «ikke lett». H er helhetsbildet og E
   kartleggingen, fra gull.verdsattNaturKartlagt. */
function Helhet({
  t,
  H,
  E
}: {
  t: Tema;
  H: NonNullable<Kartleggingen['helhet']>;
  E: NonNullable<Kartleggingen['kartlagt']>;
}) {
  const { K, U, inne, ute, si, su } = H;
  const verdier = (a: number[]) => t.klasser!.map(([navn, id], v): Stripedel => [navn, '--' + id, a[v]]);
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
          ['Kartlagt', 'kjent', `${dekar(K)} (${pst(H.andelKartlagt)} %)`],
          ['Ikke kartlagt', 'tom', `${dekar(U)} (${pst(H.andelIkkeKartlagt)} %)`]
        ]}
      />
      <h4 className="md-typography-label-s">Der det er kartlagt</h4>
      <Stripe
        hva="Det kartlagte"
        deler={[...verdier(inne), ['Ingen verdsatt natur registrert', 'kjent', Math.max(0, K - si)]]}
      />
      <p>
        {pst(H.andelInne)} % har verdsatt natur ({dekar(si)}).
      </p>
      <h4 className="md-typography-label-s">Der det ikke er kartlagt</h4>
      <Stripe hva="Det som ikke er kartlagt" deler={[...verdier(ute), ['Ukjent', 'tom', Math.max(0, U - su)]]} />
      <p>
        {su > 0
          ? `${pst(H.andelUte)} % har registrert verdsatt natur (${dekar(su)}), fra eldre kartlegging og utvalgte naturtyper. For resten finnes det ikke noe kart over hvor det er lett.`
          : 'Ingen verdsatt natur er registrert her, og det finnes ikke noe kart over hvor det er lett.'}
      </p>
      <p className="hint">
        Fargene er de samme som i listen over. Lave tall der det ikke er kartlagt, kan bety at det ikke er lett, ikke at
        naturen mangler verdi. Det kartlagte er ikke et tilfeldig utvalg av kommunen, så andelen derfra kan ikke
        overføres direkte til resten.
        {E.fra ? ` Kartlagt etter Miljødirektoratets instruks ${periode(E.fra, E.til!)}.` : ''}
      </p>
    </>
  );
}

/* Et naturtema fra Miljødirektoratet, med områdene som liste. */
export function Naturtema({ t: tema }: { t: Tema }) {
  const t = { ...tema, ...TEMAORD[tema.id] },
    tab = TEMATABELLER[tema.id],
    T = valgt(tab.tall),
    I = valgt(tab.iPlan),
    B = tab.kartlagt ? valgt(tab.kartlagt) : null;
  const kilde = (
    <p className="hint">
      Kilde: {t.kildetekst}. Arealet gjelder den delen av hvert område som ligger i kommunen, og er regnet ut i
      nettleseren.
      {t.vann ? ' Verneområder kan også ligge i sjø og innsjøer, så andelen av landarealet er et omtrentlig mål.' : ''}
    </p>
  );
  if (!T || T.status === 'henter')
    return <Temaside id={t.id} navn={t.navn} tall={{ tilstand: 'henter' }} kilde={kilde} />;
  if (T.status === 'feil')
    return (
      <Temaside id={t.id} navn={t.navn} tall={{ tilstand: 'feil' }} kilde={kilde}>
        <p>{t.navn} kunne ikke hentes fra Miljødirektoratet.</p>
      </Temaside>
    );
  const N = T.verdi!,
    C = planenFor(N, I),
    K = B && B.status === 'ok' ? B.verdi! : null,
    E = K ? K.kartlagt : null,
    hentet = bareHentetKart(),
    der = hentet ? ' i den delen av kommunen det er hentet kart for' : '',
    helhet = !!t.dekning && !!K && !!K.helhet,
    kartlagt = !!E && E.km2 > 0;
  const under = !N.antall
    ? ''
    : (t.dekning && E && E.andelLand !== null
        ? (E.km2 > 0 ? `${pst(E.andelLand, 0)} % av landarealet er kartlagt` : 'ikke kartlagt etter dagens instruks') +
          '\n'
        : '') +
      (utenPlan()
        ? 'ingen kommuneplan å krysse med'
        : !C
          ? 'planlagt utbygging ikke regnet ut ennå'
          : (C.plan ? `ca. ${dekar(C.planKm2)} planlagt utbygging innenfor` : 'ingen planlagt utbygging innenfor') +
            (hentet ? ', i hentet kart' : ''));
  const sumTekst = !N.antall
    ? `Miljødirektoratet har ingen ${t.fl} registrert i kommunen.`
    : `${stor(antallOrd(N.antall, ETT[t.id]))} ${N.antall === 1 ? t.en : t.fl} dekker ca. ${iTekst(N.sum)} av kommunen${N.andelLand !== null ? `, ${pst(N.andelLand)} % av landarealet` : ''}.${N.ufullstendig ? ' Tjenesten ga ikke alle lokalitetene i ett svar, så tallet er for lavt.' : ''}${N.hoyVerdi !== null ? ` Ca. ${iTekst(N.hoyVerdi)} har stor eller svært stor verdi.` : ''}`;
  const merk =
    !E || helhet
      ? ''
      : !(E.km2 > 0)
        ? 'Kommunen er ikke kartlagt etter Miljødirektoratets instruks. Laget viser da bare eldre registreringer og utvalgte naturtyper.'
        : `Ca. ${E.andelLand !== null ? pst(E.andelLand) + ' % av landarealet' : iTekst(E.km2)} er kartlagt etter Miljødirektoratets instruks${E.fra ? ` (${periode(E.fra, E.til!)})` : ''}. Utenfor det kartlagte kan det finnes verdifull natur som ikke er registrert.`;
  let paavirkning = null;
  if (N.antall) {
    if (utenPlan())
      paavirkning = 'Kommunen har ingen kommuneplan hos DiBK, så påvirkning fra planlagt utbygging kan ikke vurderes.';
    else if (!C) paavirkning = 'Påvirkning fra planlagt utbygging regnes ut når kartet er hentet.';
    else {
      const ant = C.berort;
      paavirkning = (
        <>
          <b>
            {C.plan
              ? `Ca. ${iTekst(C.planKm2)} planlagt utbygging ligger innenfor ${antallOrd(ant, ETT[t.id])} ${ant === 1 ? t.en : t.fl}${der}.`
              : `Ingen planlagt utbygging innenfor ${t.best}${der}.`}
          </b>
          {C.smal
            ? ` I tillegg kommer ca. ${iTekst(C.smalKm2)} i smale striper, som oftest der grensene ikke er tegnet helt likt.`
            : ''}
        </>
      );
    }
  }
  const G = t.dekning && C && C.gap && C.gap.nat && !utenPlan() ? C.gap : null;
  /* Områdene i listen: for verdsatt natur bare de som berøres av planlagt utbygging, med mest først, ellers alle */
  const maks = t.samlet ? 15 : 40,
    vises = (t.samlet ? (C ? C.berorte : []) : N.omrader.map((_, i) => i)).map(i => ({
      omr: N.omrader[i],
      nr: i,
      planKm2: C ? C.perOmrade[i] : 0
    }));
  return (
    <Temaside
      id={t.id}
      navn={t.navn}
      tall={N.antall ? { tilstand: 'ok', sum: N.sum, andelLand: N.andelLand } : { tilstand: 'ingen' }}
      under={under}
      kilde={kilde}
    >
      <p>{sumTekst}</p>
      {N.perKlasse && (
        <ul className="talliste">
          {t.klasser!.map(([navn, id], v) => {
            const { antall, km2 } = N.perKlasse![v],
              { plan: pl, planKm2 } = (C && C.klasser && C.klasser[v]) || { plan: 0, planKm2: 0 };
            return (
              <Fargelinje
                key={id}
                id={id}
                navn={navn}
                tall={dekar(km2)}
                under={`${nf(antall, 0)} ${antall === 1 ? 'lokalitet' : 'lokaliteter'}`}
              >
                {pl && !utenPlan() ? <b> · ca. {iTekst(planKm2)} planlagt utbygging</b> : null}
              </Fargelinje>
            );
          })}
        </ul>
      )}
      {helhet && <Helhet t={t} H={K!.helhet!} E={E!} />}
      {merk && <p>{merk}</p>}
      {t.dekning && kartlagt && (
        <MdCheckbox
          label="Slør over det som ikke er kartlagt"
          checked={ui.slorPaa}
          onChange={e => settSlor(e.target.checked)}
        />
      )}
      {paavirkning && <p role="status">{paavirkning}</p>}
      {G && (
        <p role="status">
          <b>
            Av ca. {iTekst(G.natKm2)} planlagt utbygging på natur{der} ligger ca. {iTekst(G.ukjentKm2)} (
            {pst(G.andel, 0)} %) i områder som ikke er kartlagt.
          </b>{' '}
          Der vet vi ikke om det finnes verdifull natur. Smale striper er ikke med.
        </p>
      )}
      {vises.length > 0 && (
        <ul className="talliste">
          {vises.slice(0, maks).map(({ omr: x, nr, planKm2 }) => {
            const liId = `${t.id}-omr-${nr}`;
            return (
              <li key={liId} id={liId}>
                <b className="navn">{x.navn}</b>
                <span className="tall">{dekar(x.km2)}</span>
                <small>
                  {x.under || ''}
                  {planKm2 ? <b> · ca. {iTekst(planKm2)} planlagt utbygging</b> : null}
                </small>
                <div className="knapper">
                  <MdButton
                    theme="tertiary"
                    mode="small"
                    leftIcon={<MdIconLocation />}
                    aria-label={`Vis ${x.navn} i kartet`}
                    onClick={() => visIKartet(t.id, nr, liId)}
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
