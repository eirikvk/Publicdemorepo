/* Tilstanden som bare gjelder visningen: hvilken side som er valgt, hva som er slått på i kartet, og hva kartet sier om seg selv.
   Datamotoren bruker den ikke. Sidene og kartet leser herfra. Den som endrer noe her, kaller endret() fra datamotoren, så alt som
   vises, tegnes på nytt samlet. */
/* Området som er valgt fra en liste og markert i kartet: temaet, navnet og elementet i listen */
export interface Vist {
  id: string;
  navn: string;
  liId: string;
}
/* Svaret på et trykk i kartet: en melding (tekst) eller hva som er i punktet (punkt) */
export interface Probe {
  tekst?: string;
  punkt?: string;
}
/* Én gruppe i detaljene for punktet: et kartlag eller et område, med radene [navn, verdi], kilden, en lenke, og området i et
   naturtema (tema og plassen i listen over områder) når det kan vises i kartet */
export interface Punktlag {
  tittel: string;
  rader: [navn: string, verdi: string][];
  kilde?: string;
  lenke?: { tekst: string; url: string };
  omrade?: { tema: string; nr: number };
}
/* Detaljene for punktet man trykket på: koordinaten i UTM33 og gruppene */
export interface Punktinfo {
  koord: number[];
  lag: Punktlag[];
}
export interface Visning {
  side: string;
  visSmale: boolean;
  slorPaa: boolean;
  vist: Vist | null;
  ute: boolean;
  sidezoom: boolean;
  probe: Probe | null;
  punkt: Punktinfo | null;
  detaljer: boolean;
  bytt: { nr: string; navn: string } | null;
  siste: string;
  maaling: string;
}
export const ui: Visning = {
  side: 'oversikt' /* siden som er valgt i sidevelgeren. Den bestemmer innholdet og hvilket tema kartet viser. */,
  visSmale: false /* om smale striper vises i kartet */,
  slorPaa: true /* om det som ikke er kartlagt, får et slør når verdsatt natur vises */,
  vist: null /* området som er valgt fra en liste og markert i kartet: { id, navn, liId } */,
  /* Det som vises over og under kartet */
  ute: false /* kartet er zoomet ut forbi det NIBIO tegner, uten dagens klasser zoomet ut */,
  sidezoom: false /* selve siden er forstørret, så kartet slipper bevegelsene igjennom */,
  probe: null /* svaret på et trykk i kartet: { tekst } eller { punkt } */,
  punkt: null /* detaljene for punktet man trykket på i kommunen, se Punktinfo */,
  detaljer: false /* om detaljene for punktet vises. Slås på og av under kartet, og gjelder så lenge siden er åpen. */,
  bytt: null /* kommunen i punktet man trykket på utenfor valgt kommune: { nr, navn } */,
  siste: '' /* hva kartet sist hentet eller viser, til teknisk visning */,
  maaling: '' /* måling av hvor jevnt kartet går, til teknisk visning */
};
