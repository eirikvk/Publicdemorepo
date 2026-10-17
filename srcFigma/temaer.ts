/* Temasidene under «Utforsk naturen», i gruppene fra Figma. id står i adressen (#5001/utforsk/skog). kartside er siden i
   hovedsiden som bestemmer hva kartet viser (ui.side): temaets lag for verneområder, villrein, verdsatt natur, inngrepsfri natur og
   grått areal, og ellers bare dagens arealklasser og planlagt utbygging. farge er en av kartets farger (src/ui/farger.ts), til
   flaten bak bildet. Ingressen er fra skissene; en tom linje (\n\n) skiller avsnitt. */
export interface Tema {
  id: string;
  navn: string;
  gruppe: string;
  kartside: string;
  farge: string;
  ingress: string;
}
export const TEMAER: Tema[] = [
  {
    id: 'skog',
    navn: 'Skog',
    gruppe: 'Økosystem',
    kartside: 'oversikt',
    farge: 'nat',
    ingress:
      'Skog er et naturområde dominert av trær, som gir levested for et rikt mangfold av planter og dyr, og spiller en viktig rolle i klimaregulering og karbonlagring.'
  },
  {
    id: 'vatmark',
    navn: 'Våtmark (myr)',
    gruppe: 'Økosystem',
    kartside: 'oversikt',
    farge: 'inn',
    ingress:
      'Våtmark er et område der jorda er vannmettet eller oversvømt store deler av året, som myr, sump eller strandeng. Slike områder er viktige levesteder for planter og dyr, og bidrar til flomdemping, vannrensing og lagring av karbon.'
  },
  {
    id: 'verneomrader',
    navn: 'Verneområder',
    gruppe: 'Naturverdier og vern',
    kartside: 'vern',
    farge: 'vern',
    ingress:
      'Verneområder er områder i naturen der myndighetene har bestemt at det gjelder spesielle regler, for å beskytte naturmangfold og landskap mot skadelige inngrep, for eksempel nasjonalparker, naturreservater og landskapsvernområder.'
  },
  {
    id: 'verdsatte-naturtyper',
    navn: 'Verdsatte naturtyper',
    gruppe: 'Naturverdier og vern',
    kartside: 'verdi',
    farge: 'verdi2',
    ingress:
      'Verdsatte naturtyper sier noe om hvor du finner den særlig viktige naturen. Når du kartlegger natur, gir du naturen verdi etter fastsatte kriterier.\n\nOmråder med naturtyper som har stor og svært stor verdi, er av nasjonal eller vesentlig regional betydning, og er verdifulle områder for biologisk mangfold. Disse områdene er svært viktige i arealplanlegging og ved vurdering av sektortiltak.'
  },
  {
    id: 'inngrepsfri-natur',
    navn: 'Inngrepsfri natur',
    gruppe: 'Naturverdier og vern',
    kartside: 'inon',
    farge: 'inonv',
    ingress:
      'Inngrepsfri natur er områder som ligger minst én kilometer i luftlinje fra større naturinngrep, som veg, jernbane, steinbrudd og energianlegg. Slike områder er viktige fordi naturen der får utvikle seg uten menneskelig påvirkning, med plass til artsmangfold og et landskap som ikke er forstyrret.'
  },
  {
    id: 'villrein',
    navn: 'Villreinområder',
    gruppe: 'Naturverdier og vern',
    kartside: 'rein',
    farge: 'rein',
    ingress:
      'Villreinområder er fjellområdene i Norge der de siste gjenværende bestandene av vill fjellrein i Europa fortsatt lever og trekker mellom beiteområder.'
  },
  {
    id: 'bynatur',
    navn: 'Bynaturen',
    gruppe: 'Nærnaturen',
    kartside: 'graa',
    farge: 'graa3',
    ingress:
      'Bynaturen er de grønne og blå områdene i byer og tettsteder, som parker, trær, bekker og hager, der planter og dyr får leve tett på der folk bor. Her vises den gjennom kartet over grå arealer: arealet som er tatt i bruk, og hvor mye av det som likevel er grønt.'
  }
];
/* Gruppene i rekkefølgen de vises */
export const GRUPPER = [...new Set(TEMAER.map(t => t.gruppe))];
export const temaet = (id: string | undefined) => TEMAER.find(t => t.id === id) || null;
