/* Hovedsidene i tvillingen: Oversikt, Naturtapet, Utforsk naturen, Utforsk i kart, Hjelp og veileder, og siden for en adresse som
   ikke finnes. Oversikten følger Figma. Naturtapet, Utforsk naturen og Utforsk i kart er tomme i skissene, så de er satt sammen av
   de samme delene. */
import { useState, type ReactNode } from 'react';
import { KILDE } from '../../src/data/katalog.ts';
import { GRAATRINN } from '../../src/data/solv/graa.ts';
import { INONSONER } from '../../src/data/solv/inon.ts';
import { NATURTEMA } from '../../src/data/solv/temaer.ts';
import { app } from '../../src/data/motor/tilstand.ts';
import type { Plassering } from '../../src/data/gull/syntetisk.ts';
import { andelTekst, dekar, iTekst, nf, pst } from '../../src/ui/tekst.ts';
import { MdRadioGroup } from '../md.ts';
import Kart, { KLASSER, PLAN, type Kartlag } from '../komponenter/Kart.tsx';
import { KLASSELAG } from '../kartlag.ts';
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
  graaIPlan,
  naturtema,
  nedbygging,
  okosystemregnskap,
  oversiktKort,
  planPerOkosystem,
  planlagt,
  plansum,
  sammenligning
} from '../tall.ts';
import { TEMAER } from '../temaer.ts';

const kommunen = () => (app.valgt ? app.valgt.navn : 'kommunen');
const prosent = (a: number | null) => (a === null ? '–' : pst(a) + ' %');
const Merket = ({ children }: { children: ReactNode }) => <span className="tallmerke">{children}</span>;
/* En endring som tekst med pil: ned eller opp, med endringen i prosent (pst) */
const Endringsmerke = ({ d, pst }: { d: number; pst: number | null }) => (
  <span className={'endringsmerke ' + (d < 0 ? 'ned' : 'opp')}>
    <span aria-hidden="true">{d < 0 ? '↘' : '↗'}</span> {pst !== null ? andelTekst(Math.abs(pst)) : '– %'}
  </span>
);

const NATUR_JORDBRUK_BEBYGD = (
  <p>
    Natur er skog, hei og buskmark, lite vegetert mark, våtmark og kyststrender, slik grunnkartet deler inn
    økosystemene. Jordbruk er dyrket mark og grasmark. Bebygd er alt som er bygd eller opparbeidet, som boliger, hytter,
    næring, veier og parker. Vann er ikke med.
  </p>
);
/* Hvor de syntetiske tallene kommer fra */
const SYNTETISK_TEKST =
  'Tallene er syntetiske, til SSBs tabeller for naturregnskapet kommer 25. november 2026. De er laget av SSBs arealstatistikk for 2017 og 2024, som ikke måler endring direkte, og hvor mye som er bygget ned, er anslått med en fast regel. De skal bare ha riktig størrelsesorden.';
/* Merket som sier at tallene er syntetiske */
const Syntetisk = () => <p className="syntetisk-merke">Syntetiske tall</p>;
/* En andel med to desimaler, for de små andelene i sammenligningen med Norge */
const pst2 = (a: number | null) => (a === null ? '–' : nf(a, 2) + ' %');
/* Et tall i et tallkort med en linje under */
const MedUnder = ({ tall, under }: { tall: string; under: string }) => (
  <>
    {tall}
    <span className="tall-under">{under}</span>
  </>
);
/* Plassen blant kommunene, der 1 bygget ned mest, med arealet under */
const plassTekst = (p: Plassering) =>
  p.plass === null ? 'Kan ikke sammenlignes' : <MedUnder tall={`Nr. ${p.plass} av ${p.av}`} under={iTekst(p.km2)} />;

/* Kortet som er valgt på oversikten, og laget og merkelappen det gir i kartet */
type Klassevalg = keyof typeof KLASSELAG;
const KLASSEKART: Record<Klassevalg, [lag: Kartlag, merke: (kommune: string) => string]> = {
  nat: [
    { id: 'kl-nat', navn: 'Natur', kilde: 'Grunnkart for arealanalyse, NIBIO', ol: KLASSELAG.nat },
    k => `Naturen i ${k} i dag`
  ],
  jor: [
    { id: 'kl-jor', navn: 'Jordbruk', kilde: 'Grunnkart for arealanalyse, NIBIO', ol: KLASSELAG.jor },
    k => `Jordbruket i ${k} i dag`
  ],
  beb: [
    { id: 'kl-beb', navn: 'Bebygd', kilde: 'Grunnkart for arealanalyse, NIBIO', ol: KLASSELAG.beb },
    k => `Bebygd areal i ${k} i dag`
  ]
};

export function Oversikt() {
  const [vist, settVist] = useState<Klassevalg>('nat');
  const U = oversiktKort(),
    N = nedbygging(),
    S = sammenligning(),
    P = plansum(),
    PD = planPerOkosystem();
  return (
    <>
      <div className="innhold">
        <section className="oversikt-topp">
          <div>
            <h1 className="md-typography-heading-l">Naturregnskap for {kommunen()} kommune</h1>
            {N.s === 'ok' && N.v.endret && (
              <p className="ingress">
                Kommunegrensen er flyttet siden {N.v.fra}, så hvor mye natur som er bygget ned, kan ikke regnes ut.
              </p>
            )}
            {N.s === 'ok' && !N.v.endret && (
              <p className="ingress">
                {iTekst(N.v.natur.nedbygd)} natur
                {N.v.natur.andel !== null && <> ({pst2(N.v.natur.andel)})</>} ble bygget ned mellom {N.v.fra} og{' '}
                {N.v.til}.{S.s === 'ok' && !S.v.endret && <> I Norge var andelen {pst2(S.v.natur.norge)}.</>}
              </p>
            )}
            {svar(U, u => (
              <ul className="klassekort">
                {u.klasser.map(k => (
                  <li key={k.id} className={'klassekort-' + k.id + (k.id === vist ? ' valgt' : '')}>
                    <button type="button" aria-pressed={k.id === vist} onClick={() => settVist(k.id as Klassevalg)}>
                      <div className="klassekort-topp">
                        <b>{k.navn}</b>
                        {k.endring !== null && k.endring !== 0 && <Endringsmerke d={k.endring} pst={k.pst} />}
                      </div>
                      <span>
                        {prosent(k.andel)} av landarealet, {iTekst(k.km2)}
                      </span>
                      {k.endring !== null && (
                        <span>
                          {k.endring === 0
                            ? 'Uendret'
                            : `${k.endring < 0 ? 'Ned' : 'Opp'} ${iTekst(Math.abs(k.endring))}`}{' '}
                          ({u.fra}–{u.til})
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
            {U.s === 'ok' && U.v.syntetisk && <Syntetisk />}
            {N.s === 'ok' && N.v.flyttet && (
              <p className="hint">
                Kommunegrensen er flyttet siden {N.v.fra}. Endringen er regnet likevel, med forskjellen i samlet areal
                regnet som natur og vann, så den er mer usikker.
              </p>
            )}
            <div className="trekkspill-liste">
              <Trekkspill tittel="Hva legger vi i natur, jordbruk og bebygd?">{NATUR_JORDBRUK_BEBYGD}</Trekkspill>
              <Trekkspill tittel="Hva er et naturregnskap?">
                <p>
                  Et naturregnskap viser hvor mye natur kommunen har, og hvordan den endrer seg. Her bygger det på åpne
                  data fra SSB, NIBIO, Miljødirektoratet og kommuneplanene hos DiBK.
                </p>
              </Trekkspill>
              <Trekkspill tittel="Hvor kommer tallene fra?">
                <p>{SYNTETISK_TEKST}</p>
              </Trekkspill>
            </div>
          </div>
          <Kart
            lag={[{ ...KLASSER, av: true }, KLASSEKART[vist][0], PLAN]}
            enkel={KLASSEKART[vist][1](kommunen())}
            enkelFarge={vist}
          />
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
          {S.s === 'ok' && !S.v.endret && S.v.naturtap.andelAvNorge !== null ? (
            <p className="baand-tekst">
              {kommunen()} står for <Merket>{pst2(S.v.naturtap.andelAvNorge)}</Merket> av naturen som ble bygget ned i
              Norge fra {S.v.fra} til {S.v.til}. Snittet for en kommune er {pst2(S.v.naturtap.snitt)}.
            </p>
          ) : (
            <p className="hint">
              {S.s === 'henter'
                ? 'Regner ut hvor stor del av Norges naturtap det er …'
                : 'Hvor stor del av Norges naturtap det er, kan ikke regnes ut for kommunen.'}
            </p>
          )}
          {S.s === 'ok' && S.v.syntetisk && <p className="hint">Syntetiske tall, til SSBs tabeller kommer.</p>}
          <Lenke til={{ side: 'naturtapet' }} className="pil-lenke">
            Mer om naturtapet →
          </Lenke>
        </div>
      </section>
      <div className="innhold">
        <Figur
          tittel="Hva slags natur ble bygget ned?"
          tekst={
            <>
              <p>
                Arealet per økosystemtype i 2024, og hvor mye av det som ble bygget ned fra 2017 til 2024, med andelen
                av arealet typen hadde i 2017.
              </p>
              <p className="hint">{SYNTETISK_TEKST}</p>
            </>
          }
          kilder={['ssb']}
        >
          {svar(N, n =>
            n.endret ? (
              <p>Kommunegrensen er flyttet siden {n.fra}, så årene kan ikke sammenlignes.</p>
            ) : (
              <>
                <Tabell
                  hva="Bygget ned per økosystemtype"
                  kolonner={[
                    { navn: 'Økosystemtype' },
                    { navn: n.til, tall: true },
                    { navn: `Bygget ned ${n.fra}–${n.til}`, tall: true },
                    { navn: 'Andel', tall: true, ikkeMobil: true }
                  ]}
                  rader={n.rader.map(r => [
                    r.navn,
                    r.km2 > 0 ? dekar(r.km2) : '0 daa',
                    r.nedbygd > 0 ? dekar(r.nedbygd) : '0 daa',
                    r.andel !== null ? andelTekst(r.andel) : '–'
                  ])}
                />
                {n.syntetisk && <Syntetisk />}
              </>
            )
          )}
        </Figur>
        <Figur
          tittel="Hva slags natur kommuneplanen setter av til utbygging"
          tekst={
            <>
              <p>
                Natur og jordbruk som kommuneplanen setter av til utbygging, per økosystemtype i grunnkartet, og hvor
                stor del av typen i kommunen det er, med de samme økosystemtypene som tabellen over. Myr og beite med
                trær er med i skogen. Smale striper er ikke med.
              </p>
              <p className="hint">Summen er den samme som i båndet over.</p>
            </>
          }
          kilder={['grunnkart', 'dibk']}
        >
          {svar(
            PD,
            p =>
              p.rader.some(r => r.km2 > 0) ? (
                <Tabell
                  hva="Satt av til utbygging per økosystemtype"
                  kolonner={[
                    { navn: 'Økosystemtype' },
                    { navn: 'Satt av', tall: true },
                    { navn: 'Andel av typen', tall: true }
                  ]}
                  rader={p.rader.map(r => [
                    r.navn,
                    r.km2 > 0 ? dekar(r.km2) : '0 daa',
                    r.andel !== null ? andelTekst(r.andel) : '–'
                  ])}
                />
              ) : (
                <p>Kommuneplanen setter ikke av natur eller jordbruk til utbygging.</p>
              ),
            'Kommunen har ingen kommuneplan med utbygging hos DiBK.'
          )}
        </Figur>
      </div>
      <div className="innhold">
        <section className="sammenligning">
          <h2 className="md-typography-heading-m">{kommunen()} sammenlignet med resten av Norge</h2>
          {svar(
            S,
            s => (
              <>
                <Tallkort
                  kort={[
                    [`Jordbruk bygget ned ${s.fra}–${s.til}`, plassTekst(s.jordbruk)],
                    [`Våtmark bygget ned ${s.fra}–${s.til}`, plassTekst(s.vatmark)],
                    [
                      'Skog av landarealet',
                      <MedUnder tall={prosent(s.skog.kommune)} under={'Norge: ' + prosent(s.skog.norge)} />
                    ],
                    [
                      'Våtmark av landarealet',
                      <MedUnder
                        tall={prosent(s.vatmarkAreal.kommune)}
                        under={'Norge: ' + prosent(s.vatmarkAreal.norge)}
                      />
                    ]
                  ]}
                />
                <p className="hint">
                  Plassen er blant de {s.jordbruk.av} kommunene som kan sammenlignes med {s.fra}, og nr. 1 bygget ned
                  mest. Skog og våtmark er her SSBs arealklasser, ikke grunnkartet som på temasidene.
                </p>
                {s.syntetisk && <Syntetisk />}
              </>
            ),
            'Kommunen er ikke med i SSBs tall for alle kommuner.'
          )}
          <Mangler
            merke="Krever dataplattform"
            tittel="Høydepunkter fra kartdata"
            trenger="kartdata regnet ut på forhånd for alle kommuner: villreinområder, naturskog, kartleggingsgrad og inngrepsfri natur, og gjennomsnittet for temaene. Datamotoren regner kartdata for én kommune om gangen."
          />
        </section>
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
    R = okosystemregnskap(),
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
              <p>
                Arealet per hovedøkosystem på land i 2017 (inngående), endringen mot bebygd, og arealet i 2024
                (utgående).
              </p>
              <p className="hint">{SYNTETISK_TEKST}</p>
            </>
          }
          kilder={['ssb']}
        >
          {svar(R, r =>
            r.endret ? (
              <p>Kommunegrensen er flyttet, så årene kan ikke sammenlignes.</p>
            ) : (
              <>
                <Tabell
                  hva="Regnskapet per hovedøkosystem"
                  kolonner={[
                    { navn: 'Økosystemtype' },
                    { navn: r.fra, tall: true, ikkeMobil: true },
                    { navn: 'Endring', tall: true },
                    { navn: r.til, tall: true }
                  ]}
                  rader={r.rader
                    .filter(x => x.utgaende > 0 || x.endring !== 0)
                    .map(x => [
                      x.navn,
                      dekar(x.inngaende),
                      (x.endring < 0 ? '−' : x.endring > 0 ? '+' : '') + dekar(Math.abs(x.endring)),
                      dekar(x.utgaende)
                    ])}
                />
                {r.syntetisk && <Syntetisk />}
              </>
            )
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
