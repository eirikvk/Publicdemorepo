/* Hovedsidene i tvillingen: Oversikt, Naturtapet, Utforsk naturen, Utforsk i kart, Hjelp og veileder, og siden for en adresse som
   ikke finnes. Oversikten følger Figma. Naturtapet, Utforsk naturen og Utforsk i kart er tomme i skissene, så de er satt sammen av
   de samme delene. */
import type { ReactNode } from 'react';
import { KILDE } from '../../src/data/katalog.ts';
import { GRAATRINN } from '../../src/data/solv/graa.ts';
import { INONSONER } from '../../src/data/solv/inon.ts';
import { NATURTEMA } from '../../src/data/solv/temaer.ts';
import { app } from '../../src/data/motor/tilstand.ts';
import { dekar, iTekst, nf, pst } from '../../src/ui/tekst.ts';
import { MdRadioGroup } from '../md.ts';
import Kart, { KLASSER, PLAN, type Kartlag } from '../komponenter/Kart.tsx';
import Tabell from '../komponenter/Tabell.tsx';
import {
  Figur,
  Fremhevet,
  Lenke,
  Liggende,
  Mangler,
  Ressurser,
  Tallkort,
  Temagrupper,
  Trekkspill,
  svar
} from '../komponenter/deler.tsx';
import { figma, velgKartTema } from '../navigasjon.ts';
import {
  SKOG,
  arealklasser,
  endring,
  graaIPlan,
  naturtema,
  oppstilling,
  planlagt,
  plansum,
  summer,
  utbredelse
} from '../tall.ts';
import { TEMAER } from '../temaer.ts';

const kommunen = () => (app.valgt ? app.valgt.navn : 'kommunen');
const prosent = (a: number | null) => (a === null ? '–' : pst(a) + ' %');
const Merket = ({ children }: { children: ReactNode }) => <span className="tallmerke">{children}</span>;
/* En endring som tekst med pil: ned eller opp */
const Endringsmerke = ({ d, av }: { d: number; av: number }) => (
  <span className={'endringsmerke ' + (d < 0 ? 'ned' : 'opp')}>
    <span aria-hidden="true">{d < 0 ? '↘' : '↗'}</span> {av > 0 ? nf(Math.abs((d / av) * 100), 1) : '–'} %
  </span>
);

const NATUR_JORDBRUK_BEBYGD = (
  <p>
    Natur er skog, åpen fastmark, myr, bart fjell og snø og is. Jordbruk er fulldyrka og ikke fulldyrka jord. Bebygd er
    alt som er bygd eller opparbeidet, som boliger, hytter, næring, veier og parker. Vann er ikke med.
  </p>
);
const SSB_ENDRING = (
  <p>
    Tallene er fra {KILDE.ssb.navn}, {KILDE.ssb.datasett}. SSB skriver at tabellen ikke kan brukes til å regne ut
    endring mellom år, fordi grunnlaget blir bedre over tid. Forskjellen fra 2017 er derfor ikke målt endring.
  </p>
);

export function Oversikt() {
  const U = utbredelse(),
    E = endring(),
    P = plansum(),
    A = arealklasser();
  /* Bebygde klasser som økte mest, fra SSBs arealklasser hver for seg */
  const okning =
    A.s === 'ok'
      ? A.v.klasser
          .filter(k => k.klasse === 'beb' && k.kode !== '14')
          .map(k => ({ navn: k.navn, d: k.km2[k.km2.length - 1] - k.km2[0] }))
          .filter(k => k.d > 0.0005)
          .sort((a, b) => b.d - a.d)
          .slice(0, 3)
      : [];
  return (
    <>
      <div className="innhold">
        <section className="oversikt-topp">
          <div>
            <h1 className="md-typography-heading-l">Naturregnskap for {kommunen()} kommune</h1>
            {svar(U, u => (
              <ul className="klassekort">
                {u.klasser.map(k => {
                  const e = E && !E.endret ? E.klasser.find(x => x.id === k.id) : null;
                  return (
                    <li key={k.id} className={'klassekort-' + k.id}>
                      <div className="klassekort-topp">
                        <b>{k.navn}</b>
                        {e && <Endringsmerke d={e.km2} av={k.km2 - e.km2} />}
                      </div>
                      <span>
                        {prosent(k.andel)} av landarealet, {iTekst(k.km2)}
                      </span>
                      {e && (
                        <span>
                          {e.km2 < 0 ? 'Ned' : 'Opp'} {iTekst(Math.abs(e.km2))} ({E!.fra}–{E!.til})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
            <div className="trekkspill-liste">
              <Trekkspill tittel="Hva legger vi i natur, jordbruk og bebygd?">{NATUR_JORDBRUK_BEBYGD}</Trekkspill>
              <Trekkspill tittel="Hva er et naturregnskap?">
                <p>
                  Et naturregnskap viser hvor mye natur kommunen har, og hvordan den endrer seg. Her bygger det på åpne
                  data fra SSB, NIBIO, Miljødirektoratet og kommuneplanene hos DiBK.
                </p>
              </Trekkspill>
              <Trekkspill tittel="Hvor kommer tallene fra?">{SSB_ENDRING}</Trekkspill>
            </div>
          </div>
          <Kart lag={[KLASSER, PLAN]} enkel={`Naturen i ${kommunen()} i dag`} />
        </section>
      </div>
      <section className="baand">
        <div className="innhold baand-innhold">
          <p className="baand-tekst">
            {P ? (
              <>
                Kommuneplanen setter av <Merket>{iTekst(P.nat)}</Merket> natur og <Merket>{iTekst(P.jor)}</Merket>{' '}
                jordbruk til utbygging{P.delvis ? ', i den delen av kommunen som er hentet' : ''}.
              </>
            ) : (
              'Hvor mye natur kommuneplanen setter av til utbygging, regnes ut når kartet for kommunen er hentet.'
            )}
          </p>
          <p className="hint">
            Hvor stor del av Norges naturtap det er, krever de samme tallene for alle kommuner, og er ikke laget ennå.
          </p>
          <Lenke til={{ side: 'naturtapet' }} className="pil-lenke">
            Mer om naturtapet →
          </Lenke>
        </div>
      </section>
      <div className="innhold">
        <Figur
          tittel="Arealet i kommunen, og forskjellen fra 2017"
          tekst={
            <>
              <p>
                Arealet på land per arealklasse hos SSB, i nyeste år, og forskjellen fra 2017. Forskjellen er ikke målt
                endring: noe av den kan skyldes bedre kartlegging.
              </p>
              <p className="hint">
                «Hva slags natur ble bygget ned?» i skissene krever målt endring, og er ikke laget ennå.
              </p>
            </>
          }
          kilder={['ssb']}
        >
          {svar(A, D => {
            const rader: [string, (k: (typeof D.klasser)[number]) => boolean][] = [
              ['Bebygd og opparbeidet areal', k => k.klasse === 'beb'],
              ...D.klasser
                .filter(k => k.klasse !== 'beb' && k.klasse !== 'vann' && !SKOG(k))
                .map(k => [k.navn, (x: (typeof D.klasser)[number]) => x.kode === k.kode] as [string, typeof SKOG]),
              ['Skog', SKOG]
            ];
            const til = D.aar[D.aar.length - 1];
            return (
              <Tabell
                hva="Arealet per arealklasse"
                perSide={30}
                kolonner={[
                  { navn: 'Arealklasse' },
                  { navn: til, tall: true },
                  { navn: 'Forskjell fra ' + D.aar[0], tall: true },
                  { navn: '', tall: true, ikkeMobil: true }
                ]}
                rader={rader
                  .map(([navn, f]) => ({ navn, na: summer(D, f), fra: summer(D, f, 0) }))
                  .filter(r => r.na > 0 || r.fra > 0)
                  .sort((a, b) => b.na - a.na)
                  .map(r => [
                    r.navn,
                    dekar(r.na),
                    (r.na - r.fra < 0 ? '−' : r.na - r.fra > 0 ? '+' : '') + dekar(Math.abs(r.na - r.fra)),
                    Math.abs(r.na - r.fra) >= 0.0005 ? <Endringsmerke d={r.na - r.fra} av={r.fra} /> : ''
                  ])}
              />
            );
          })}
        </Figur>
      </div>
      {okning.length > 0 && A.s === 'ok' && (
        <section className="baand">
          <div className="innhold baand-innhold">
            <p className="baand-tekst">
              Av det bebygde arealet økte <Merket>{okning[0].navn.toLowerCase()}</Merket> mest fra {A.v.aar[0]} til{' '}
              {A.v.aar[A.v.aar.length - 1]}
              {okning.length > 1 && (
                <>
                  . Deretter kommer{' '}
                  {okning.slice(1).map((o, i) => (
                    <span key={o.navn}>
                      {i > 0 && ' og '}
                      <Merket>{o.navn.toLowerCase()}</Merket>
                    </span>
                  ))}
                </>
              )}
              .
            </p>
            <p className="hint">Fra SSBs arealklasser. Forskjellen mellom årene er ikke målt endring.</p>
          </div>
        </section>
      )}
      <div className="innhold">
        <Mangler
          tittel={`${kommunen()} sammenlignet med resten av Norge`}
          trenger="de samme tallene regnet ut for alle kommuner, så kommunen kan rangeres. Datamotoren regner for én kommune om gangen."
        />
        <section className="utforsk-del">
          <div className="seksjonstopp">
            <h2 className="md-typography-heading-m">Utforsk naturen i {kommunen()}</h2>
            <Lenke til={{ side: 'utforsk' }} className="pil-lenke">
              Mer →
            </Lenke>
          </div>
          <Temagrupper />
        </section>
      </div>
    </>
  );
}

export function Naturtapet() {
  const P = planlagt(),
    O = oppstilling(),
    G = graaIPlan(),
    temaer = (
      [
        ['Verneområder', 'vern'],
        ['Villreinområder', 'rein'],
        ['Verdsatt natur', 'verdi']
      ] as const
    ).map(([navn, id]) => ({ navn, id, plan: naturtema(id).plan }));
  return (
    <>
      <div className="innhold">
        <section className="sidetopp">
          <h1 className="md-typography-heading-l">Naturtapet i {kommunen()}</h1>
          <p className="ingress">
            Her ser du hvor mye natur og jordbruk kommuneplanen setter av til utbygging, hvor mye av det som ligger i
            verdifull natur, og hva SSB-tallene sier om arealet siden 2017.
          </p>
        </section>
        <Tallkort
          kort={[
            ['Natur satt av til utbygging', P ? iTekst(P.natur.km2) : <span className="henter">Regnes ut …</span>],
            ['Andel av naturen i kommunen', P ? prosent(P.natur.andel) : <span className="henter">Regnes ut …</span>],
            ['Jordbruk satt av til utbygging', P ? iTekst(P.jordbruk.km2) : <span className="henter">Regnes ut …</span>]
          ]}
        />
        <div className="trekkspill-liste">
          <Trekkspill tittel="Hvor er tallene hentet fra?">
            <p>
              Planlagt utbygging er arealformål for utbygging i kommuneplanen hos DiBK, som ennå ikke er bygd, krysset
              med dagens arealklasser fra NIBIO. Smale striper er ikke med i tallene.
            </p>
          </Trekkspill>
        </div>
      </div>
      <Kart lag={[PLAN, KLASSER]} />
      <div className="innhold">
        <Figur
          tittel="Planlagt utbygging i verdifull natur"
          tekst={
            <p>Hvor mye av den planlagte utbyggingen som ligger i verneområder, villreinområder og verdsatt natur.</p>
          }
          kilder={['dibk', 'vern', 'villrein', 'verdsatt']}
        >
          {temaer.every(t => t.plan) ? (
            <Liggende
              hva="Planlagt utbygging per tema"
              data={temaer.map(t => ({
                navn: t.navn,
                km2: t.plan!.planKm2,
                farge: t.id === 'verdi' ? 'verdi2' : t.id
              }))}
            />
          ) : (
            <p className="henter">Regnes ut når kartet for kommunen er hentet …</p>
          )}
          {G && G.plan && (
            <p>
              Ca. {iTekst(G.plan.graa)} ({prosent(G.plan.andelGraa)}) av all planlagt utbygging ligger på grått areal,
              som alt er tatt i bruk.
            </p>
          )}
        </Figur>
        <Figur
          tittel="Regnskapet fra SSB"
          tekst={
            <>
              <p>Arealet i 2017 (inngående), forskjellen, og arealet i nyeste år (utgående), per klasse.</p>
              <p className="hint">Forskjellen mellom årgangene er ikke målt endring.</p>
            </>
          }
          kilder={['ssb']}
        >
          {svar(
            O,
            o =>
              o && (
                <Tabell
                  hva="Regnskapet"
                  kolonner={[{ navn: '' }, ...o.kolonner.map(k => ({ navn: k, tall: true }))]}
                  rader={[
                    ['Inngående ' + o.fra, ...o.inngaende.map(v => dekar(v))],
                    ['Forskjell', ...o.netto.map(v => (v < 0 ? '−' : v > 0 ? '+' : '') + dekar(Math.abs(v)))],
                    ['Utgående ' + o.til, ...o.utgaende.map(v => dekar(v))]
                  ]}
                />
              ),
            'Kan ikke sammenlignes'
          )}
        </Figur>
        <Mangler
          tittel="Målt naturtap over tid"
          trenger="kart over arealklassene for flere år, så endringen kan måles i stedet for å trekke årgangene fra hverandre."
        />
        <Ressurser
          lenker={[
            ['Kommuneplaner hos DiBK', KILDE.dibk.adresse],
            ['SSB, tabell 09594', KILDE.ssb.adresse],
            ['Utvikling fremover i dagens løsning', `../#${app.valgt ? app.valgt.nr : ''}/framtid`]
          ]}
        />
      </div>
    </>
  );
}

export function Utforsk() {
  return (
    <div className="innhold">
      <section className="sidetopp">
        <h1 className="md-typography-heading-l">Utforsk naturen i {kommunen()}</h1>
        <p className="ingress">
          Velg et perspektiv for å se hvor mye det er av det i kommunen, hvor det ligger, og hvor mye som er satt av til
          utbygging.
        </p>
      </section>
      <Temagrupper />
    </div>
  );
}

/* Temaene som kan vises i kartet på kartsiden: siden i hovedsiden som viser temaet, og navnet */
const KARTTEMA: [side: string, navn: string, kilde: string, farger?: [string, string][]][] = [
  ['oversikt', 'Ingen tema', ''],
  ['vern', 'Verneområder', KILDE.vern.datasett, [['Verneområde', 'vern']]],
  ['rein', 'Villreinområder', KILDE.villrein.datasett, [['Villreinområde', 'rein']]],
  [
    'verdi',
    'Verdsatte naturtyper',
    KILDE.verdsatt.datasett,
    NATURTEMA.find(t => t.id === 'verdi')!.klasser!.map(([navn, farge]) => [navn, farge] as [string, string])
  ],
  ['inon', 'Inngrepsfri natur', KILDE.inon.datasett, [2, 1, 0].map(i => [INONSONER[i][4], INONSONER[i][1]])],
  ['graa', 'Grått areal', KILDE.graa.datasett, GRAATRINN.map(([farge, navn]) => [navn, farge])]
];
export function Utforskkart() {
  const valgt = KARTTEMA.find(t => t[0] === figma.kartTema) || KARTTEMA[0];
  const lag: Kartlag[] = [
    ...(valgt[0] !== 'oversikt' ? [{ id: 'tema' as const, navn: valgt[1], kilde: valgt[2], farger: valgt[3] }] : []),
    KLASSER,
    PLAN
  ];
  return (
    <>
      <div className="innhold">
        <section className="sidetopp">
          <h1 className="md-typography-heading-l">Utforsk {kommunen()} i kart</h1>
          <p className="ingress">
            Velg et tema, og trykk i kartet for å se hva som er der. Trykker du utenfor kommunen, kan du bytte til
            kommunen der.
          </p>
        </section>
      </div>
      <Kart
        stor
        lag={lag}
        etter={
          <MdRadioGroup
            label="Tema i kartet"
            options={KARTTEMA.map(([v, text]) => ({ value: v, text }))}
            value={valgt[0]}
            onChange={e => velgKartTema(e.target.value)}
          />
        }
      />
    </>
  );
}

export function Hjelp() {
  return (
    <div className="innhold smal">
      <section className="sidetopp">
        <h1 className="md-typography-heading-l">Hjelp og veileder</h1>
        <p className="ingress">
          Dette er en prototyp. Utseendet og navigeringen er fra Figma-skissene for naturregnskapet. Tallene og kartet
          kommer fra den samme datamotoren som dagens løsning, som henter alt direkte fra åpne kilder.
        </p>
      </section>
      <h2 className="md-typography-heading-s">Hva som er ekte, og hva som mangler</h2>
      <p>
        Alle tall på sidene er ekte og gjelder kommunen du har valgt. Der skissene viser noe datamotoren ikke har ennå,
        står det en ramme merket «Ikke laget ennå», med det som trengs. Bildene fra skissene er ikke med, fordi
        rettighetene ikke er avklart.
      </p>
      <h2 className="md-typography-heading-s">Kildene</h2>
      <ul className="kildeliste">
        {Object.values(KILDE).map(k => (
          <li key={k.adresse}>
            <a href={k.adresse} target="_blank" rel="noopener">
              {k.datasett}
            </a>
            , {k.navn}. Lisens: {k.lisens}.
          </li>
        ))}
      </ul>
      <h2 className="md-typography-heading-s">Mer</h2>
      <p>
        <a href={`../#${app.valgt ? app.valgt.nr : ''}/om`}>Om og metode i dagens løsning</a> forklarer hvordan tallene
        er regnet ut. Temaene her er {TEMAER.length}, i tre grupper.
      </p>
    </div>
  );
}

export function Ukjent() {
  return (
    <div className="innhold smal">
      <section className="sidetopp">
        <h1 className="md-typography-heading-l">Fant ikke siden</h1>
        <p className="ingress">Adressen finnes ikke. Kanskje lenken er gammel, eller det er en skrivefeil.</p>
      </section>
      <Fremhevet>
        <Lenke til={{ side: 'oversikt' }}>Gå til oversikten for {kommunen()}</Lenke>
      </Fremhevet>
    </div>
  );
}
