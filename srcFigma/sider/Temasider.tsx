/* Temasidene under «Utforsk naturen», etter skissene fra 17. oktober: brødsmuler, toppen med ikon, ingress, trekkspill og bilde,
   tallkort, kartet med lagvelgeren og trekkspill under den, figurer med tekst og kilde, ofte stilte spørsmål, ressurser og flisene
   til alle temaene. Tallene kommer fra datamotoren (se tall.ts). Det skissene viser som datamotoren ikke har ennå, står tomt, med et
   merke som sier hva som trengs. Ekstra kartlag, lenker og bokser som ikke er i skissene, er tatt ut (avklart 18. oktober), og figurene
   har fast rekkefølge, som skissene, også for det som er tomt. Listene over områdene er beholdt. Bynaturen er ikke tegnet, så den har
   fortsatt dagens arealklasser og planlagt utbygging. */
import { useState, type ReactNode } from 'react';
import { app } from '../../src/data/motor/tilstand.ts';
import { INONSONER } from '../../src/data/solv/inon.ts';
import { GRAATRINN } from '../../src/data/solv/graa.ts';
import { NATURTEMA, VERNEFORMGRUPPER } from '../../src/data/solv/temaer.ts';
import { andelTekst, antallOrd, dekar, iTekst, nf, pst } from '../tekst.ts';
import { MdCheckbox } from '../md.ts';
import Kart, { KLASSER, PLAN, type Kartlag } from '../komponenter/Kart.tsx';
import Tabell from '../komponenter/Tabell.tsx';
import {
  Brodsmuler,
  Endringsstolper,
  Figur,
  Fremhevet,
  Helt,
  Kake,
  Liggende,
  Linje,
  NestePerspektiv,
  Ressurser,
  Sporsmal,
  Stolper,
  Tallkort,
  Trekkspill,
  svar
} from '../komponenter/deler.tsx';
import {
  graaIVillrein,
  gronneArealer,
  inonIVillrein,
  verdsattVurderes,
  planPerOkosystem,
  skog as skogen,
  vatmark as vatmarken,
  verdsattPerNaturtype,
  vernLandSjo,
  vernetNatur,
  villreinPerOmrade,
  graa,
  graaIPlan,
  inon,
  inonIVillreinUtvikling,
  inonUtvikling,
  kartleggingen,
  naturtema
} from '../tall.ts';
import { temaet, type Tema } from '../temaer.ts';
import {
  GRAALAG,
  SKOGLAG,
  VATMARKLAG,
  VERDILAG,
  VERNEFORMFARGE,
  VERNLAG,
  velgNatur,
  velgVerneformer
} from '../kartlag.ts';
import { naturkart } from '../kart2.ts';
import { KILDE } from '../../src/data/katalog.ts';

const kommunen = () => (app.valgt ? app.valgt.navn : 'kommunen');
const iDagens = (side: string) => `../#${app.valgt ? app.valgt.nr : ''}${side ? '/' + side : ''}`;
const prosent = (a: number | null) => (a === null ? '–' : pst(a) + ' %');
/* Merket på trekkspill og figurer som mangler kilde */
const MANGLER_KILDE = 'Mangler kilde';

interface Temasideinnhold {
  tema: Tema;
  trekkspill?: ReactNode;
  kort: [string, ReactNode][];
  kilde?: ReactNode;
  fremhevet?: ReactNode;
  lag: Kartlag[];
  lagEtter?: ReactNode;
  children?: ReactNode;
  sporsmal: [string, ReactNode][];
  ressurser: [string, string][];
  /* Et kart nummer to etter figurene, i et eget bånd, som på siden om verneområder */
  andreKart?: ReactNode;
}
/* Malen for en temaside */
function Temaside(p: Temasideinnhold) {
  return (
    <>
      <div className="innhold">
        <Brodsmuler tema={p.tema} />
        <Helt tema={p.tema}>{p.trekkspill}</Helt>
        <Tallkort kort={p.kort} />
        {p.kilde && (
          <div className="trekkspill-liste etter-tallkort">
            <Trekkspill tittel="Hvor er tallene hentet fra?">{p.kilde}</Trekkspill>
          </div>
        )}
        {p.fremhevet}
      </div>
      <Kart key={p.tema.id} lag={p.lag} etter={p.lagEtter} hint={false} />
      {p.andreKart ? (
        <>
          <div className="innhold">{p.children}</div>
          {p.andreKart}
          <div className="innhold">
            <Sporsmal liste={p.sporsmal} />
            <Ressurser lenker={p.ressurser} />
            <NestePerspektiv />
          </div>
        </>
      ) : (
        <div className="innhold">
          {p.children}
          <Sporsmal liste={p.sporsmal} />
          <Ressurser lenker={p.ressurser} />
          <NestePerspektiv />
        </div>
      )}
    </>
  );
}

/* Verditabellen i Miljødirektoratets veileder M-1941 (Konsekvensutredning av klima og miljø), kapittelet om å sette verdi */
const M1941 =
  'https://www.miljodirektoratet.no/ansvarsomrader/overvaking-arealplanlegging/arealplanlegging/konsekvensutredninger/metode-for-utredning/naturmangfold/1.4-sett-verdi';
/* Kilden til lagene fra grunnkartet, i lagvelgeren */
const GK = 'Grunnkart for arealanalyse';
/* Kilden for tallene fra grunnkartet med detaljklassene */
const GRUNNKART_KILDE = (
  <p>
    {KILDE.grunnkart.navn}, {KILDE.grunnkart.datasett}. Tallene er regnet ut fra grunnkartet på 10 meter, klippet til
    kommunen. Andelen er av landarealet i grunnkartet, det vil si alt unntatt hav, innsjøer og elver. For noen kommuner
    er grunnkartet lagret sammen med siden. For de andre hentes det fra NIBIO når siden vises, og da tar det litt tid.
  </p>
);
/* Trekkspillene under figurene om skog og våtmark */
const OVERLAPP = (
  <>
    <Trekkspill tittel="Hvorfor overlapper verdiene?">
      <p>
        Tresatt myr og tresatt innmarksbeite er skog i grunnkartet, men myr og jordbruk i arealdekket. Derfor står
        tresatt myr både i tallene for skog og for våtmark.
      </p>
    </Trekkspill>
    <Trekkspill tittel="Hvordan brukes dataene i grafen?">
      <p>
        Hver bit er arealet i grunnkartet for kommunen, i dekar, og andelen av det samlede arealet i figuren. Arealet er
        regnet ut fra grunnkartet på 10 meter, klippet til kommunen.
      </p>
    </Trekkspill>
  </>
);
const TRESATT_MED = (tittel: string) => (
  <div className="trekkspill-liste">
    <Trekkspill tittel={tittel}>
      <p>
        I grunnkartet er myr og innmarksbeite med trær skog. De er likevel myr og jordbruk i arealdekket, og har mye av
        naturen og karbonet til myra og beitet. Derfor vises de som egne lag.
      </p>
    </Trekkspill>
  </div>
);

function Skog({ tema }: { tema: Tema }) {
  const S = skogen(),
    V = vernetNatur();
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Mer om skog">
            <p>
              Tallene er skog i grunnkartet fra NIBIO: økosystemtypen skog, også skog på myr og på innmarksbeite, delt
              etter treslaget som dominerer. Kartet viser skogen og skogtypene fra grunnkartet.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Dette får vi fra skogen (økosystemtjenester)" merke="–">
            <p>Hvilke økosystemtjenester skogen gir, og hvor mange, mangler kilde ennå.</p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Skog i kommunen', svar(S, s => iTekst(s.km2))],
        ['Andel av kommunens landareal som er skog', svar(S, s => prosent(s.andel))],
        ['Skog som er vernet', svar(V, v => iTekst(v.skog))]
      ]}
      kilde={GRUNNKART_KILDE}
      lag={[
        { id: 'skog', navn: 'Økosystemtype skog', kilde: GK, farger: [['Skog', 'skog']], ol: SKOGLAG.skog },
        {
          id: 'skogtyper',
          navn: 'Skogtyper',
          kilde: GK,
          farger: [
            ['Blandingsskog', 'skog-bland'],
            ['Barskog', 'skog-bar'],
            ['Lauvskog', 'skog-lauv']
          ],
          ol: SKOGLAG.skogtyper
        },
        { id: 'myr', navn: 'Tresatt myr', kilde: GK, farger: [['Tresatt myr', 'myr-tresatt']], ol: SKOGLAG.myr },
        {
          id: 'beite',
          navn: 'Tresatt innmarksbeite',
          kilde: GK,
          farger: [['Tresatt innmarksbeite', 'beite-tresatt']],
          ol: SKOGLAG.beite
        }
      ]}
      lagEtter={
        <>
          {S.s === 'mangler' && <p className="hint">Lagene fra grunnkartet kunne ikke lages for kommunen.</p>}
          {TRESATT_MED('Hvorfor er tresatt myr og tresatt innmarksbeite med?')}
        </>
      }
      sporsmal={[
        [
          'Hvorfor er ikke tallene for skog de samme som hos SSB?',
          <p>
            SSB har egne arealklasser, mens tallene her er NIBIOs grunnkart for arealanalyse, med økosystemtyper. De to
            deler arealet inn på ulike måter, så de gir ikke helt samme areal for skog.
          </p>
        ]
      ]}
      ressurser={[['SSB, tabell 09594', KILDE.ssb.adresse]]}
    >
      <Figur
        tittel={`Typer skog i ${kommunen()}`}
        tekst={
          <p>
            Skogen i kommunen deles inn etter hvilke typer treslag som dominerer. Det er vanlig å skille mellom barskog
            og lauvskog. I barskogen er gran og furu de viktigste treslagene, mens i lauvskogen vokser ulike typer
            lauvtrær. Enkelte steder finner du både bartrær og lauvtrær i samme skog. Mange arter av sopp, lav og andre
            artsgrupper er avhengige av skogen og er tilpasset spesifikke treslag. Derfor gir kunnskap om hvilke treslag
            og skogtyper vi har i kommunen viktig informasjon om naturmangfoldet.
          </p>
        }
        kilder={['grunnkart']}
      >
        {svar(S, s => (
          <Stolper
            hva="Skog etter treslag"
            data={['lauv', 'bar', 'bland']
              .map(id => s.treslag.find(t => t.id === id)!)
              .map(t => ({ navn: t.navn, km2: t.km2, farge: 'skog-' + t.id }))}
          />
        ))}
      </Figur>
      <Figur
        tittel={`Dette dekker skogen i ${kommunen()}`}
        tekst={
          <p>
            Figuren viser hva skogarealet i {kommunen()} står på: fastmark, myr eller innmarksbeite. Jo større en sektor
            er, desto større del av skogarealet dekker den.
          </p>
        }
        kilder={['grunnkart']}
        etter={OVERLAPP}
      >
        {svar(S, s => (
          <Kake
            hva="Skog i grunnkartet etter underlag"
            fast
            data={['myr', 'beite', 'vanlig']
              .map(id => s.underlag.find(u => u.id === id))
              .filter(u => !!u)
              .map(u =>
                u.id === 'vanlig'
                  ? { navn: 'Skog på fastmark', km2: u.km2, farge: 'kake-graa' }
                  : { navn: u.navn, km2: u.km2, farge: u.id === 'myr' ? 'myr-tresatt' : 'beite-tresatt', prikker: true }
              )}
          />
        ))}
      </Figur>
    </Temaside>
  );
}

function Vatmark({ tema }: { tema: Tema }) {
  const W = vatmarken();
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Hva betyr verdiene?">
            <p>
              Tallene er våtmark i grunnkartet fra NIBIO: økosystemtypen våtmark, som er åpen myr og annen åpen våtmark,
              og tresatt myr.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Potensielle økosystemtjenester fra våtmark" merke="–">
            <p>Hvilke økosystemtjenester våtmarken gir, mangler kilde ennå.</p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Våtmark i kommunen', svar(W, w => iTekst(w.km2))],
        ['Andel av kommunens landareal som er våtmark', svar(W, w => prosent(w.andel))]
      ]}
      kilde={GRUNNKART_KILDE}
      lag={[
        {
          id: 'vatmark',
          navn: 'Økosystemtype våtmark (myr)',
          kilde: GK,
          farger: [['Åpen myr og annen åpen våtmark', 'myr-apen']],
          ol: VATMARKLAG.apen
        },
        {
          id: 'tresatt',
          navn: 'Tresatt myr',
          kilde: GK,
          farger: [['Tresatt myr', 'myr-tresatt']],
          ol: VATMARKLAG.tresatt
        }
      ]}
      lagEtter={
        <>
          {W.s === 'mangler' && <p className="hint">Lagene fra grunnkartet kunne ikke lages for kommunen.</p>}
          {TRESATT_MED('Hvorfor er tresatt myr med?')}
        </>
      }
      sporsmal={[
        [
          'Hvorfor er våtmark viktig?',
          <p>
            Myr lagrer mye karbon, og nedbygging av myr slipper ut klimagasser. Våtmark holder tilbake vann og kan dempe
            flom, til den er mettet. Den kan også bedre vannkvaliteten og redusere avrenning fra arealene rundt. Mange
            arter lever i våtmark, og over 600 rødlistede arter er knyttet til myr.
          </p>
        ],
        [
          'Er det utbyggingsforbud i myr?',
          <>
            <p>
              Nei, ikke per oktober 2026. Et forbud mot nedbygging av myr i plan- og bygningsloven var på høring i 2025,
              og venter på politisk behandling.
            </p>
            <p>
              Nydyrking av myr er forbudt siden 2020, og nye uttak av torv er forbudt fra 1. januar 2026. Statlige
              planretningslinjer og nasjonale forventninger sier at nedbygging av myr skal unngås så langt som mulig,
              men det er ikke et forbud.
            </p>
          </>
        ],
        [
          'Hvor kan jeg se restaurert eller restaurerbar myr?',
          <p>
            Vi har ikke funnet et offentlig kart over restaurerte eller restaurerbare myrer for hele landet.
            Miljødirektoratet har kartet «Drensgrøfter i myr», som viser grøfter i myr, men ikke hva som er restaurert.
            Et nytt landsdekkende kart over myr og våtmark er under arbeid fram til 2027.
          </p>
        ],
        [
          'Hvorfor er tresatt myr med i våtmarken?',
          <p>
            Grunnkartet regner myr med trær som skog. Skissene har den med i våtmarken, så her telles den både i
            våtmarken og i skogen.
          </p>
        ],
        [
          'Hvorfor mangler naturtyper i våtmark i kartet?',
          <p>
            Laget for naturtyper i våtmark venter på Naturkart, et heldekkende kart over naturtyper som ikke er klart
            ennå.
          </p>
        ]
      ]}
      ressurser={[]}
    >
      <Figur
        tittel={`Dette dekker våtmarken i ${kommunen()}`}
        tekst={
          <p>
            Figuren viser hva som dekker våtmarksarealet i kommunen. Mye av våtmarka har trær, enten som skog eller som
            myr med spredte trær. Jo større en sektor er, desto større del av våtmarksarealet dekker den.
          </p>
        }
        kilder={['grunnkart']}
        etter={OVERLAPP}
      >
        {svar(W, w => (
          <Kake
            hva="Våtmark i grunnkartet"
            fast
            data={[
              { navn: 'Tresatt myr', km2: w.tresatt, farge: 'kake-myr', prikker: true },
              { navn: 'Våtmark i grunnkartet', km2: w.apen, farge: 'kake-vatmark' }
            ]}
          />
        ))}
      </Figur>
    </Temaside>
  );
}

/* Verneformen slik Miljødirektoratet skriver den (MarintVerneomraade), som vanlig tekst (Marint verneområde) */
const verneform = (v: unknown) =>
  String(v || 'Uten verneform')
    .replace(/([a-zæøå])([A-ZÆØÅ])/g, '$1 $2')
    .toLowerCase()
    .replace(/omraade/g, 'område')
    .replace(/^./, c => c.toUpperCase());
/* Lokalitetene som vurderes per lokalitet eller per naturtype (ikke de som ikke er gitt verdi), som en setning: hvor mange, arealet og
   hvordan de fordeler seg, eller at kommunen ikke har noen */
function vurderesTekst(v: { omrader: { v?: number }[]; klasser: number[] }) {
  const n = v.omrader.filter(o => (o.v || 0) < 2).length,
    [lok, typ] = v.klasser;
  if (!n) return ` ${kommunen()} har ingen slike lokaliteter.`;
  const fordeling =
    lok > 0 && typ > 0
      ? `: ${iTekst(lok)} vurderes per lokalitet og ${iTekst(typ)} per naturtype`
      : lok > 0
        ? ', som alle vurderes per lokalitet'
        : ', som alle vurderes per naturtype';
  return ` I ${kommunen()} gjelder det ${antallOrd(n)} ${n === 1 ? 'lokalitet' : 'lokaliteter'} med til sammen ${iTekst(lok + typ)}${fordeling}. De vises i kartet i egne farger.`;
}
/* Hovedøkosystemene i figuren og kartlaget om naturen som er vernet, i rekkefølgen og med navnene i skissene: navnet i dataene,
   navnet i figuren, navnet i tegnforklaringen og fargen. Restklassene fra grunnkartet er ikke i skissene, og står til slutt når de har
   areal. */
const VERNET_NATUR: [data: string, figur: string, kart: string, farge: string][] = [
  ['Skog', 'Skog', 'Skog', 'oko-skog'],
  ['Våtmark', 'Våtmark (myr)', 'Våtmark', 'oko-vatmark'],
  ['Innsjøer og vannmagasiner', 'Innsjø og tjern', 'Innsjø og tjern', 'oko-innsjo'],
  ['Hei og buskmark', 'Hei og buskmark', 'Hei og buskmark', 'oko-hei'],
  ['Grasmark', 'Grasmark', 'Grasmark', 'oko-gras'],
  ['Elver, bekker og kanaler', 'Elver, bekker og kanaler', 'Elver, bekker og kanaler', 'oko-elv'],
  ['Lite vegetert mark', 'Lite vegetert mark', 'Lite vegetert mark', 'oko-lite'],
  ['Kyststrender, svaberg og dyner', 'Kyststrender, svaberg og dyner', 'Kyststrender, svaberg og dyner', 'oko-kyst'],
  ['Dyrket mark', 'Dyrket mark', 'Dyrket mark', 'oko-dyrket'],
  ['Bebygd og opparbeidet areal', 'Bebygd og opparbeidet areal', 'Bebygd og opparbeidet areal', 'oko-bebygd'],
  ['Hav', 'Hav (sjøareal)', 'Hav (sjøareal)', 'oko-hav']
];
const RESTKLASSER = ['Natur, uspesifisert', 'Jordbruk, uspesifisert'];
/* Gruppene av verneformer i figuren «Slik er naturen vernet», i rekkefølgen i skissene */
const VERNEFORMER_I_FIGUREN = ['nasjonalpark', 'naturreservat', 'landskap', 'arts', 'marint', 'annen'];

function Vern({ tema }: { tema: Tema }) {
  const { T } = naturtema('vern'),
    v = T.s === 'ok' ? T.v : null,
    L = vernLandSjo(),
    V = vernetNatur(),
    [hav, settHav] = useState(true),
    [land, settLand] = useState(true),
    [sjo, settSjo] = useState(true);
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Mer om verneområder">
            <p>
              Områdene er vernet etter naturmangfoldloven eller eldre lover. Verneformen sier hvor strenge reglene er:
              naturreservat er strengest, landskapsvernområde minst strengt.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Datagrunnlaget bak verneområder">
            <p>
              {KILDE.vern.datasett}, {KILDE.vern.navn}, med alle områdene som er vernet etter naturmangfoldloven og
              eldre lover.
            </p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Vernet natur i kommunen', svar(T, x => (x.antall ? iTekst(x.sum) : 'Ingen'))],
        ['Andel av kommunens landareal som er vernet', svar(V, x => prosent(x.andelLand))]
      ]}
      kilde={
        <p>
          {KILDE.vern.datasett}, {KILDE.vern.navn}. Arealet er den delen av hvert område som ligger i kommunen, også i
          sjø. Andelen er bare det vernede på land, av landarealet i grunnkartet. Der områder overlapper, telles arealet
          én gang.
        </p>
      }
      lag={[
        {
          id: 'verneformer',
          navn: 'Verneområder per verneform',
          kilde: 'Naturvernområder',
          farger: VERNEFORMGRUPPER.map(([id, navn]) => [navn, VERNEFORMFARGE[id]] as [string, string]),
          ol: VERNLAG.verneformer,
          velg: velgVerneformer
        },
        { id: 'tema', navn: 'Verneområder', kilde: 'Naturvernområder', skjul: true }
      ]}
      lagEtter={
        <div className="trekkspill-liste">
          <Trekkspill tittel="Hvordan deles verneområder inn?">
            <p>
              Verneområdene deles inn etter verneform, som nasjonalpark, naturreservat, landskapsvernområde og marint
              verneområde. Hvert område har sin egen verneforskrift.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hva er forskjellen på verneformene?">
            <p>
              Naturreservat har det strengeste vernet. Nasjonalparker verner store naturområder, og landskapsvernområder
              verner landskapet, der vanlig bruk ofte kan fortsette. Marine verneområder verner natur i sjø.
            </p>
          </Trekkspill>
        </div>
      }
      andreKart={
        <Kart
          eget={naturkart}
          hint={false}
          lag={[
            {
              id: 'natur',
              navn: 'Naturen i verneområder',
              kilde: GK,
              farger: [
                ...VERNET_NATUR.map(([, , navn, farge]) => [navn, farge] as [string, string]),
                ['Natur eller jordbruk, uspesifisert', 'oko-annen']
              ],
              ol: VERNLAG.natur,
              velg: velgNatur
            }
          ]}
          etter={
            <div className="trekkspill-liste">
              <Trekkspill tittel="Hva viser kartet over naturen i verneområder?">
                <p>
                  Kartet viser grunnkartets økosystemtyper inne i verneområdene, med én farge per type, som i figuren
                  over naturen som er vernet. Hver type kan slås av og på.
                </p>
              </Trekkspill>
            </div>
          }
        />
      }
      sporsmal={[
        [
          'Kan det bygges i et verneområde?',
          <p>
            Det avhenger av verneforskriften for hvert område. Planlagt utbygging i et verneområde betyr at
            kommuneplanen og vernet bør sees sammen.
          </p>
        ]
      ]}
      ressurser={[
        [
          'Les om Norges verneområder',
          'https://www.miljodirektoratet.no/ansvarsomrader/vernet-natur/norges-verneomrader/'
        ],
        [
          'Faktaark for verneområdene – Naturbase søk',
          'https://www.miljodirektoratet.no/tjenester/naturbase/enkelt-sok/'
        ]
      ]}
    >
      {v && v.antall > 0 && (
        <Figur
          tittel={`Slik er naturen vernet i ${kommunen()}`}
          tekst={
            <p>
              Figuren viser hvor mye areal som er vernet i {kommunen()}, fordelt på verneform. Det kan være nyttig å se
              fordelingen av verneformer, fordi forskjellige verneformer har ulike formål med vernet og ulikt
              restriksjonsnivå. For eksempel har naturreservater den strengeste formen for områdevern etter
              naturmangfoldloven.
            </p>
          }
          kilder={['grunnkart', 'vern']}
        >
          {svar(L, l => (
            <>
              <div className="figur-valg">
                <MdCheckbox label="Landareal" checked={land} onChange={e => settLand(e.target.checked)} />
                <MdCheckbox label="Sjøareal" checked={sjo} onChange={e => settSjo(e.target.checked)} />
              </div>
              <Stolper
                hva="Vernet areal per verneform"
                data={VERNEFORMER_I_FIGUREN.map(id => {
                  const x = l.find(g => g.gruppe === id)!;
                  return { navn: x.navn, km2: (land ? x.land : 0) + (sjo ? x.sjo : 0), farge: VERNEFORMFARGE[id] };
                })}
              />
            </>
          ))}
        </Figur>
      )}
      <Figur
        tittel={`Naturen som er vernet i ${kommunen()}`}
        tekst={
          <p>
            Figuren viser hva slags natur som er vernet i {kommunen()}, og hvor mye det er av hver type. Prosenten viser
            hvor stor del av det vernede arealet hver type utgjør. Verneområder kan også ha dyrket mark og bebyggelse,
            derfor er disse med i oversikten.
          </p>
        }
        kilder={['grunnkart', 'vern']}
      >
        {svar(V, d => {
          if (d.sum <= 0) return <p>Kommunen har ingen verneområder.</p>;
          const km2 = (navn: string) => (d.perOkosystem.find(x => x.navn === navn) || { km2: 0 }).km2,
            rader = [
              ...VERNET_NATUR.filter(([data]) => hav || data !== 'Hav').map(([data, navn, , farge]) => ({
                navn,
                km2: km2(data),
                farge
              })),
              ...RESTKLASSER.filter(navn => km2(navn) > 0).map(navn => ({ navn, km2: km2(navn), farge: 'oko-annen' }))
            ],
            sum = rader.reduce((a, x) => a + x.km2, 0) || 1;
          return (
            <>
              <div className="figur-valg">
                <MdCheckbox label="Vis «hav» i oversikten" checked={hav} onChange={e => settHav(e.target.checked)} />
              </div>
              <Liggende
                hva="Vernet areal per økosystemtype"
                data={rader}
                tekst={x => `${iTekst(x.km2)} (${andelTekst((x.km2 / sum) * 100)})`}
              />
            </>
          );
        })}
      </Figur>
      {v && v.antall > 0 && (
        <Figur
          tittel={`Verneområdene i ${kommunen()}`}
          tekst={<p>Alle verneområdene som ligger helt eller delvis i kommunen, med det største først.</p>}
          kilder={['vern']}
        >
          <Tabell
            hva="Verneområdene"
            kolonner={[
              { navn: 'Område' },
              { navn: 'Verneform' },
              { navn: 'I kommunen', tall: true },
              { navn: 'Faktaark' }
            ]}
            rader={[...v.omrader]
              .sort((a, b) => b.km2 - a.km2)
              .map(o => [
                o.navn,
                verneform(o.egenskaper.verneform),
                dekar(o.km2),
                o.url ? (
                  <a href={o.url} target="_blank" rel="noopener">
                    Åpne
                  </a>
                ) : (
                  ''
                )
              ])}
          />
        </Figur>
      )}
    </Temaside>
  );
}

function Verdi({ tema }: { tema: Tema }) {
  const { T } = naturtema('verdi'),
    K = kartleggingen(),
    v = T.s === 'ok' ? T.v : null,
    kartlagt = K.s === 'ok' && K.v ? K.v.kartlagt : null,
    klasser = NATURTEMA.find(t => t.id === 'verdi')!.klasser!,
    VV = verdsattVurderes(),
    vv = VV.s === 'ok' && VV.v.omrader.length ? VV.v : null;
  const [bareHoy, settBareHoy] = useState(false),
    N = verdsattPerNaturtype(),
    typer = N.s === 'ok' ? (bareHoy ? N.v.hoy : N.v.alle) : [];
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Hvilke naturtyper er verdsatte?">
            <p>
              Alle naturtyper som er kartlagt etter Miljødirektoratets instruks, får en verdi. Her er alle lokalitetene
              med verdi med, fra noe verdi til svært stor verdi.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hvordan kartlegges det etter Miljødirektoratets instruks?">
            <p>
              Naturtypene kartlegges i felt etter Miljødirektoratets instruks, og hver lokalitet får en verdi fra noe
              verdi til svært stor verdi. Bare deler av landet er kartlagt.
            </p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Andel av kommunen kartlagt', svar(K, x => (x && x.kartlagt ? prosent(x.kartlagt.andelLand) : '–'))],
        ['Kartlagte verdsatte naturtyper', svar(T, x => (x.antall ? iTekst(x.sum) : 'Ingen'))]
      ]}
      kilde={
        <p>
          {KILDE.verdsatt.datasett} og {KILDE.nin.datasett}, {KILDE.verdsatt.navn}. Bare lokaliteter med verdi er med.
        </p>
      }
      fremhevet={
        <>
          {kartlagt && kartlagt.andelLand !== null && kartlagt.andelLand < 99.5 && (
            <Fremhevet varsel>
              <b>Datasettet er ikke heldekkende, bare {prosent(kartlagt.andelLand)} er kartlagt</b>
              <span>
                Det vil si at kartleggingen kan være mangelfull i din kommune. Tomme områder i kartet betyr ikke
                nødvendigvis at det ikke finnes verdifull natur der, det er bare at ingen har sjekket der enda.
              </span>
              <span>
                Risikoen med mangelfull kartlegging i kommunen kan være at de tomme områdene blir oversett eller
                undervurdert.
              </span>
            </Fremhevet>
          )}
        </>
      }
      lag={[
        {
          id: 'tema',
          navn: 'Verdsatte naturtyper',
          kilde: 'Naturtyper – verdsatte',
          farger: [
            ...klasser.map(([navn, farge]) => [navn, farge] as [string, string]),
            ['Vurderes per lokalitet', 'vurderes1'],
            ['Vurderes per naturtype', 'vurderes2'],
            ['Annet (ikke gitt verdi)', 'vurderes3']
          ],
          med: [VERDILAG.vurderes]
        },
        {
          id: 'dekning',
          navn: 'Dekningskart for kartlegging',
          kilde: 'Naturtyper på land (NiN)',
          farger: [['Kartlagt', 'dekning']]
        }
      ]}
      lagEtter={
        <div className="trekkspill-liste">
          <Trekkspill tittel="Hva betyr verdiene?">
            <p>
              Verdien sier hvor viktig lokaliteten er: svært stor og stor verdi er av nasjonal eller vesentlig regional
              betydning, middels og noe verdi er av mer lokal betydning.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hva er verdsatt natur som vurderes?">
            <p>
              Noen lokaliteter har ikke fått en verdi fra noe verdi til svært stor verdi, men skal vurderes per
              lokalitet eller per naturtype. De er ikke med i tallene for verdsatt natur, men vises i kartet i egne
              farger. Noen få lokaliteter i landet er ikke gitt verdi. De står som «Annet».
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hva er dekningskart?">
            <p>
              Dekningskartet viser hvor det er kartlagt naturtyper etter Miljødirektoratets instruks. Det som er
              kartlagt, har lilla prikker i kartet.
            </p>
          </Trekkspill>
        </div>
      }
      sporsmal={[
        [
          'Hva er en naturtype?',
          <p>
            Her betyr naturtype en type natur som Miljødirektoratet har valgt ut for kartlegging. Naturtypene er
            definert med Natur i Norge (NiN), et system for å beskrive variasjonen i naturen. Typene er valgt fordi de
            er truet, viktige for mange arter, har sentrale økosystemfunksjoner eller er dårlig kartlagt.
          </p>
        ],
        [
          'Hvorfor bør man passe på verdsatte naturtyper?',
          <p>
            Lokaliteter med stor og svært stor verdi er av nasjonal eller vesentlig regional betydning, og er særlig
            viktige i arealplanleggingen.
          </p>
        ]
      ]}
      ressurser={[
        [
          'Naturtyper som kartlegges etter Miljødirektoratets instruks',
          'https://www.miljodirektoratet.no/ansvarsomrader/overvaking-arealplanlegging/naturkartlegging/myndigheter/kartlegging-av-naturtyper-etter-miljodirektoratets-instruks/hvilke-naturtyper-kartlegges/'
        ],
        ['Verdisetting i konsekvensutredning', M1941],
        ['Truede naturtyper, rødlista – Artsdatabanken', 'https://lister.artsdatabanken.no/naturtyper/2025'],
        [
          'Kartlegging etter NiN – Artsdatabanken',
          'https://artsdatabanken.no/naturtyper/natur-i-norge/kartlegging-etter-nin'
        ]
      ]}
    >
      {v && v.perKlasse && (
        <Figur
          tittel="Fordeling av verdiene"
          tekst={
            <p>
              Verdien settes etter{' '}
              <a href={M1941} target="_blank" rel="noopener">
                verditabellen i M-1941
              </a>
              . Det er flere faktorer som bestemmer hvilken verdi en naturtype får, det avhenger blant annet av:
              naturtypelokalitetens kvalitet, om naturtypen er en utvalgt naturtype etter naturmangfoldloven, om
              naturtypen har en sentral økosystemfunksjon, om den er truet, nær truet eller har status som spesielt
              dårlig kartlagt på rødlista for naturtyper.
            </p>
          }
          kilder={['verdsatt']}
          etter={
            <Trekkspill tittel="Hva betyr verdiene?">
              <p>
                Svært stor og stor verdi er av nasjonal eller vesentlig regional betydning. Middels og noe verdi er av
                mer lokal betydning. «Annet» er lokaliteter som ikke er gitt verdi. Lokaliteter som vurderes per
                lokalitet eller per naturtype, er ikke med i figuren.
                {vv ? vurderesTekst(vv) : VV.s === 'ok' ? ` ${kommunen()} har ingen slike lokaliteter.` : ''}
              </p>
            </Trekkspill>
          }
        >
          <Stolper
            smale
            hva="Areal per verdikategori"
            data={[
              ...klasser.map(([navn, farge], i) => ({ navn, km2: v.perKlasse![i].km2, farge })),
              {
                navn: 'Annet',
                under: '(ikke gitt verdi)',
                km2: VV.s === 'ok' ? VV.v.klasser[2] || 0 : 0,
                farge: 'vurderes3'
              }
            ]}
          />
        </Figur>
      )}
      {v && v.antall > 0 && (
        <Figur
          tittel={`Verdsatte naturtyper funnet i ${kommunen()}`}
          tekst={
            <>
              <p>
                Miljødirektoratet regner over 120 naturtyper som verdsatte. Listen viser hvilke av dem som er funnet i
                kommunen og hvor mye det er av hver.
              </p>
              <p>
                Tallene gjelder bare det som er kartlagt. Verken kommunen eller resten av landet er ferdig kartlagt, så
                det kan finnes mer enn det listen viser. Andelen av det som er kartlagt i Norge krever en dataplattform,
                og står tom.
              </p>
            </>
          }
          kilder={['verdsatt']}
          etter={
            <>
              <Trekkspill tittel="Hva betyr det å ha mye av en naturtype?">
                <p>
                  Har kommunen mye av en naturtype, har den et særlig ansvar for den. Det gjelder særlig naturtyper som
                  er sjeldne eller truet.
                </p>
              </Trekkspill>
              <Trekkspill tittel="Hvordan er dataene brukt i tabellen?">
                <p>
                  Arealet er summen av lokalitetene med naturtypen i kommunen, klippet mot kommunen. Arealet i Norge
                  krever kartdata for alle kommuner.
                </p>
              </Trekkspill>
            </>
          }
        >
          <MdCheckbox
            label="Vis kun stor og svært stor verdi"
            checked={bareHoy}
            onChange={e => settBareHoy(e.target.checked)}
          />
          <Tabell
            hva="Naturtypene"
            kolonner={[
              { navn: 'Nr', tall: true },
              { navn: 'Naturtype' },
              { navn: `Dekar ${kommunen()}`, tall: true },
              { navn: 'Andel av kartlagt i Norge', tall: true, ikkeMobil: true }
            ]}
            rader={typer.map((t, i) => [
              String(i + 1),
              t.navn,
              dekar(t.km2, 'dekar'),
              <span className="tom-celle" title="Krever dataplattform">
                –
              </span>
            ])}
          />
        </Figur>
      )}
    </Temaside>
  );
}

/* Sonene i figuren om endringer per sone, i rekkefølgen i skissene: inngrepsnær natur, som får det sonene mister, sone 2, sone 1 og
   villmarkspreget natur */
const ENDRINGSSERIER = [
  { navn: 'Inngrepsnær natur', farge: 'inon-naer' },
  ...[2, 1, 0].map(i => ({ navn: INONSONER[i][4], farge: INONSONER[i][1] }))
];
/* Endringen i inngrepsfri natur fra første til siste år, som setning */
const endringTekst = (sum: number[], aar: number[]) => {
  const d = sum[sum.length - 1] - sum[0];
  return `Fra ${aar[0]} til ${aar[aar.length - 1]} har inngrepsfri natur ${d < 0 ? `gått ned med ${iTekst(-d)}` : d > 0 ? `økt med ${iTekst(d)}` : 'vært uendret'}${d && sum[0] > 0 ? ` (${andelTekst((Math.abs(d) / sum[0]) * 100)})` : ''}.`;
};
/* Merket for kartene for tidligere år mens de hentes, og når de ikke kunne hentes */
const henterAar = (S: { s: string }) => (
  <p className="henter">
    {S.s === 'feil'
      ? 'Kartene for tidligere år kunne ikke hentes fra Miljødirektoratet.'
      : 'Henter kartene for tidligere år …'}
  </p>
);

function Inon({ tema }: { tema: Tema }) {
  const I = inon(),
    U = inonUtvikling();
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Mer om inngrepsfri natur">
            <p>
              Inngrepsfri natur er områder som ligger minst én kilometer fra tyngre tekniske inngrep. Miljødirektoratet
              har status for 1988, 2008, 2013, 2018 og 2023.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hvordan inngrepsfri natur deles inn">
            <p>
              Inngrepsfri natur deles i tre soner etter avstanden til nærmeste tyngre tekniske inngrep: sone 2 (1–3 km),
              sone 1 (3–5 km) og villmarkspreget natur (5 km eller mer).
            </p>
          </Trekkspill>
          <Trekkspill tittel="Datagrunnlaget bak inngrepsfri natur">
            <p>
              {KILDE.inon.datasett}, {KILDE.inon.navn}. Arealet er regnet ut fra kartbilder av kommunen i ruter på 10
              meter. Andelen er av landarealet.
            </p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Inngrepsfri natur i kommunen', svar(I, x => iTekst(x.sum), 'Ingen')],
        ['Andel av kommunens landareal som er inngrepsfri natur', svar(I, x => prosent(x.andelLand), '0 %')]
      ]}
      lag={[
        {
          id: 'tema',
          navn: 'Inngrepsfri natur',
          kilde: 'Inngrepsfri natur i Norge',
          farger: [2, 1, 0].map(i => [INONSONER[i][4], INONSONER[i][1]] as [string, string])
        }
      ]}
      sporsmal={[
        [
          'Kan inngrepsfri natur krysses med planlagt utbygging?',
          <p>
            Ikke slik de andre temaene kan. Sonene følger avstanden til inngrep, så et nytt inngrep kan flytte grensene
            flere kilometer, også utenfor der det bygges.
          </p>
        ]
      ]}
      ressurser={[]}
    >
      {I.s === 'ok' && (
        <Figur
          tittel={`Den inngrepsfrie naturen i ${kommunen()} fordelt i soner`}
          tekst={
            <p>
              Figuren viser hvor mye inngrepsfri natur det er i {kommunen()}, delt inn etter avstand til nærmeste
              inngrep. Det er sjelden mulig å reversere slike inngrep, så når inngrepsfri natur først er tapt, er den
              som regel borte for godt.
            </p>
          }
          kilder={['inon']}
        >
          <Stolper
            brede
            hva="Inngrepsfri natur per sone"
            data={[2, 1, 0].map(i => ({
              navn: INONSONER[i][4],
              under: `(${INONSONER[i][3]})`,
              km2: I.v.soner[i],
              farge: INONSONER[i][1]
            }))}
          />
        </Figur>
      )}
      <Figur
        tittel={`Slik har den inngrepsfrie naturen endret seg i ${kommunen()}`}
        tekst={
          <>
            <p>
              Figuren viser hvordan arealet med inngrepsfri natur i {kommunen()} har endret seg siden 1988.
              Miljødirektoratet har status for 1988, og deretter hvert femte år siden 2008. Når arealet blir mindre,
              skyldes det nye inngrep som veier, kraftlinjer eller vannkraftutbygging.
            </p>
            {U.s === 'ok' && <p>{endringTekst(U.v.sum, U.v.aar)}</p>}
            <p>
              Alle årene er fra Miljødirektoratets utgave fra april 2024, og telles i de samme rutene som i dag. Neste
              status gjelder 2028.
            </p>
          </>
        }
        kilder={['inon']}
      >
        {U.s === 'ok' ? (
          <Linje hva="Inngrepsfri natur per år" punkter={U.v.aar.map((aar, i) => ({ aar, km2: U.v.sum[i] }))} />
        ) : (
          henterAar(U)
        )}
      </Figur>
      <Figur
        tittel="Endringer per sone"
        tekst={
          <>
            <p>
              Figuren viser hvordan arealet i hver sone har endret seg i hver periode. Den første perioden er 20 år, fra
              1988 til 2008, de andre fem. Søyler over null betyr at sonen har blitt større, og søyler under null betyr
              at den har blitt mindre.
            </p>
            <p>
              Når det kommer et nytt inngrep, flytter naturen rundt seg ned en sone: villmark blir til sone 1, sone 1
              blir til sone 2, og sone 2 blir til inngrepsnær natur, som ligger mindre enn én kilometer fra et inngrep.
              Derfor øker inngrepsnær natur når de andre sonene minker.
            </p>
          </>
        }
        kilder={['inon']}
      >
        {U.s === 'ok' ? (
          <Endringsstolper
            hva="Endringen per sone i hver periode"
            serier={ENDRINGSSERIER}
            perioder={U.v.perioder.map(p => ({
              navn: `${p.fra}–${p.til}`,
              km2: [p.naer, p.soner[2], p.soner[1], p.soner[0]]
            }))}
          />
        ) : (
          henterAar(U)
        )}
      </Figur>
    </Temaside>
  );
}

/* Første avsnitt om inngrepsfri natur i villreinområdene, som i skissene, også når kommunen ikke har villreinområder */
const VILLREIN_SKY =
  'Villrein er sky og holder seg unna veier, hytter, kraftlinjer og andre inngrep. Derfor trenger villreinen store områder uten slike inngrep. Inngrepsfri natur er områder som ligger mer enn én kilometer fra tyngre tekniske inngrep.';

function Rein({ tema }: { tema: Tema }) {
  const VU = inonIVillreinUtvikling(),
    { T } = naturtema('rein'),
    v = T.s === 'ok' ? T.v : null,
    R = villreinPerOmrade(),
    IV = inonIVillrein(),
    GV = graaIVillrein(),
    ingen = !!v && !v.antall;
  const kommunenavn = (s: unknown) =>
    String(s || '')
      .split(',')
      .map(x => x.replace(/\s*\(\d+\)\s*/, '').trim())
      .filter(Boolean)
      .join(', ');
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Mer om villreinområder">
            <p>
              Villreinområdene er fjellområdene der villreinen lever og trekker. Et område strekker seg ofte over flere
              kommuner.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Datagrunnlaget bak villreinområder">
            <p>
              {KILDE.villrein.datasett}, {KILDE.villrein.navn}. Arealet er den delen av hvert område som ligger i
              kommunen. Grått areal i villreinområdene er fra {KILDE.graa.datasett}, {KILDE.graa.navn}, i ruter på 10
              meter: hver rute teller med den delen av den som ligger i villreinområdene.
            </p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Villreinområder i kommunen', svar(T, x => (x.antall ? iTekst(x.sum) : 'Ingen'))],
        ['Andel av kommunens landareal som er villreinområde', svar(T, x => (x.antall ? prosent(x.andelLand) : '0 %'))],
        [
          'Andel villreinområde som er inngrepsfri natur',
          /* Uten villreinområder er andelen av dem verken et tall eller null: én strek, som for andre tall som ikke finnes */
          ingen ? (
            '–'
          ) : (
            <span className="tallkort-to">
              <b>{svar(IV, x => prosent(x!.andel), '–')}</b>
              <span className="tallkort-etikett">Andel villreinområde som er grå arealer</span>
              <b>{svar(GV, x => (x!.andel === null ? '–' : andelTekst(x!.andel)), '–')}</b>
            </span>
          )
        ]
      ]}
      lag={[
        { id: 'tema', navn: 'Villreinområder', kilde: 'Villreinområder', farger: [['Villreinområde', 'rein']] },
        {
          id: 'graa',
          navn: 'Grått areal',
          kilde: KILDE.graa.datasett,
          farger: [['Grått areal', 'graa-rein']],
          ol: GRAALAG.graa
        }
      ]}
      sporsmal={[
        [
          'Hvorfor har Norge et særlig ansvar for villreinen?',
          <p>
            De siste gjenværende bestandene av vill fjellrein i Europa lever i Norge. Derfor har Norge et særlig ansvar
            for å ta vare på dem og områdene de lever i.
          </p>
        ],
        [
          'Hva betyr villreinområder for kommunens arealplanlegging?',
          <p>
            Villreinen er sky og trenger store områder uten inngrep. Utbygging i og nær villreinområdene kan stenge
            trekkveier og gjøre beiter mindre brukt.
          </p>
        ],
        [
          'Hva truer villreinen?',
          <p>
            Den største trusselen er inngrep som hytter, veier og kraftanlegg, som krymper og deler opp leveområdene.
            Mye ferdsel forstyrrer reinen, så den får mindre ro til å beite. Skrantesjuke er påvist på Hardangervidda og
            i Nordfjella, og klimaendringer er også en trussel. Den første klassifiseringen etter kvalitetsnormen for
            villrein ga dårlig tilstand i 12 av 24 villreinområder.
          </p>
        ]
      ]}
      ressurser={[
        ['Villrein i Norge', 'https://www.miljodirektoratet.no/ansvarsomrader/arter-naturtyper/vilt/villrein/'],
        ['Villrein.no', 'https://villrein.no/']
      ]}
    >
      <div className="trekkspill-liste under-kart">
        <Trekkspill tittel="Hva er sammenhengen mellom villreinområder og grå areal?">
          <p>
            Grått areal er areal som er tatt i bruk, som veier, hytter og anlegg. Villreinen holder seg unna slike
            inngrep, så grått areal i villreinområdene gjør området mindre brukbart for villreinen. Laget «Grått areal»
            viser det grå arealet i hele kommunen, sammen med villreinområdene.
          </p>
        </Trekkspill>
      </div>
      {v && v.antall > 0 && (
        <Figur
          tittel={`${kommunen()}s villreinområder`}
          tekst={
            <p>
              Tabellen viser villreinområdene som ligger helt eller delvis i {kommunen()}. Et villreinområde strekker
              seg ofte over flere kommuner. Dekar og andel viser hvor mye av området som ligger i kommunen. Tilstanden
              etter kvalitetsnormen for villrein mangler kilde, og står tom.
            </p>
          }
          kilder={['villrein']}
        >
          <Tabell
            hva="Villreinområdene"
            kolonner={[
              { navn: 'Område' },
              { navn: 'Dekar', tall: true },
              { navn: 'Andel (%)', tall: true, ikkeMobil: true },
              { navn: 'Kommuner', ikkeMobil: true },
              { navn: 'Tilstand', tall: true },
              { navn: 'Faktaark', tall: true }
            ]}
            rader={(R.s === 'ok' ? R.v : []).map(o => [
              o.navn,
              nf(o.km2 * 1000, 0),
              prosent(o.andel),
              kommunenavn(o.kommuner),
              <span className="tom-celle" title={MANGLER_KILDE}>
                –
              </span>,
              o.url ? (
                <a href={o.url} target="_blank" rel="noopener">
                  Åpne
                </a>
              ) : (
                ''
              )
            ])}
          />
        </Figur>
      )}
      {IV.s === 'ok' && IV.v ? (
        <Figur
          tittel="Inngrepsfri natur i villreinområdene"
          tekst={
            <>
              <p>{VILLREIN_SKY}</p>
              <p>
                Figuren viser hvor mye inngrepsfri natur det er i villreinområdene i {kommunen()} i dag, per sone, og
                linjen under hvordan den har endret seg siden 1988, innenfor dagens villreinområder.
              </p>
              {VU.s === 'ok' && VU.v && <p>{endringTekst(VU.v.sum, VU.v.aar)}</p>}
            </>
          }
          kilder={['inon', 'villrein']}
        >
          <Liggende
            hva="Inngrepsfri natur i villreinområdene per sone"
            data={INONSONER.map(([, farge, , , navn], i) => ({ navn, km2: IV.v!.soner[i], farge }))}
          />
          <p>
            {iTekst(IV.v.sum)} av {iTekst(IV.v.villrein)} villreinområde i kommunen er inngrepsfri natur.
          </p>
          {VU.s === 'ok' && VU.v ? (
            <Linje
              hva="Inngrepsfri natur i villreinområdene per år"
              punkter={VU.v.aar.map((aar, i) => ({ aar, km2: VU.v!.sum[i] }))}
            />
          ) : VU.s === 'ingen' ? null : (
            henterAar(VU)
          )}
        </Figur>
      ) : (
        <Figur
          tittel="Inngrepsfri natur i villreinområdene"
          tekst={
            <>
              <p>{VILLREIN_SKY}</p>
              <p>Figuren viser hvor mye av villreinområdene i kommunen som er inngrepsfri natur, per sone.</p>
            </>
          }
          kilder={['inon', 'villrein']}
        >
          <p>{svar(IV, () => '', 'Kommunen har ingen villreinområder.')}</p>
        </Figur>
      )}
    </Temaside>
  );
}

function Bynatur({ tema }: { tema: Tema }) {
  const G = graa(),
    GA = gronneArealer(),
    P = graaIPlan(),
    p = P ? P.plan : null;
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <Trekkspill tittel="Mer om bynaturen">
          <p>
            Kartet over grå arealer viser areal som er tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet,
            og hvor stor del av hver flate som er vegetasjon. Mye av det grå er likevel grønt.
          </p>
        </Trekkspill>
      }
      kort={[
        ['Grått areal i kommunen', svar(G, x => iTekst(x.sum))],
        ['Andel av kommunens landareal som er grått areal', svar(G, x => prosent(x.andelLand))],
        ['Planlagt utbygging på grått areal', p ? prosent(p.andelGraa) : <span className="henter">Regnes ut …</span>]
      ]}
      kilde={
        <p>
          {KILDE.graa.datasett}, {KILDE.graa.navn}.
        </p>
      }
      lag={[
        {
          id: 'tema',
          navn: 'Grått areal',
          kilde: KILDE.graa.datasett,
          farger: [
            ...GRAATRINN.map(([farge, navn]) => [navn, farge] as [string, string]),
            ['Grønt i bebygd område', 'gront']
          ]
        },
        {
          id: 'gronne',
          navn: 'Grønne arealer i bebyggelse',
          kilde: KILDE.graa.datasett,
          farger: [['50–100 % vegetasjon', 'gronne-arealer']],
          ol: GRAALAG.gronne,
          av: true
        },
        KLASSER,
        PLAN
      ]}
      sporsmal={[
        [
          'Er utbygging på grått areal bra?',
          <p>
            Det er gjenbruk av areal som alt er tatt i bruk, og sparer annen natur. Men også grått areal kan ha mye
            vegetasjon, så gjenbruk kan ta grønt.
          </p>
        ]
      ]}
      ressurser={[
        ['Kart over grå arealer, datasettet', KILDE.graa.adresse],
        ['Grått areal i dagens løsning', iDagens('graa')]
      ]}
    >
      {G.s === 'ok' && (
        <Figur
          tittel="Grått areal etter andel vegetasjon"
          tekst={<p>Figuren viser det grå arealet i kommunen etter hvor stor del av hver flate som er vegetasjon.</p>}
          kilder={['graa']}
        >
          <Stolper
            hva="Grått areal per trinn"
            data={GRAATRINN.map(([farge, navn], i) => ({
              navn: navn.replace(' vegetasjon', ''),
              km2: G.v.trinn[i + 1],
              farge
            }))}
          />
        </Figur>
      )}
      {p && (
        <Fremhevet>
          <b>
            Av ca. {iTekst(p.km2)} planlagt utbygging på land ligger ca. {iTekst(p.graa)} ({prosent(p.andelGraa)}) på
            grått areal.
          </b>
          <span>Her er all planlagt utbygging med, også på bebygd areal og i smale striper.</span>
        </Fremhevet>
      )}
      <Figur
        tittel="Grønne arealer i bebyggelse"
        tekst={
          <p>
            Grønne arealer i bebyggelse er den delen av det grå arealet der minst halvparten av flaten er vegetasjon,
            som hager, parker og grøntområder mellom husene. De kan vises som eget lag i kartet.
          </p>
        }
        kilder={['graa']}
      >
        {svar(GA, x => (
          <p>
            {kommunen()} har ca. {iTekst(x.km2)} grønne arealer i bebyggelse. Det er {prosent(x.andelAvGraa)} av det grå
            arealet og {prosent(x.andelLand)} av landarealet.
          </p>
        ))}
      </Figur>
    </Temaside>
  );
}

const SIDER: Record<string, (p: { tema: Tema }) => ReactNode> = {
  skog: Skog,
  vatmark: Vatmark,
  verneomrader: Vern,
  'verdsatte-naturtyper': Verdi,
  'inngrepsfri-natur': Inon,
  villrein: Rein,
  bynatur: Bynatur
};
export default function Temasider({ id }: { id: string }) {
  const t = temaet(id)!,
    Side = SIDER[t.id];
  return <Side tema={t} />;
}
