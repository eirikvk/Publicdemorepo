/* Endepunktene for kildene i bronse, samlet: adressene som kalles, uten parametre. Filene i bronse bygger kallene på dem, og katalogen
   viser dem ved hver kilde (endepunkt), i infoknappene og i METODE.md. Filen bruker ingen andre filer, så katalogen kan lese den før
   de andre filene i bronse er ferdig lastet. */
export const SSB = 'https://data.ssb.no/api/pxwebapi/v2/tables/09594/data',
  SSB_ELDRE = 'https://data.ssb.no/api/v0/no/table/09594',
  KOMMUNEINFO = 'https://api.kartverket.no/kommuneinfo/v1',
  BAKGRUNN = 'https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/utm33n',
  GRUNNKART = 'https://wms.nibio.no/cgi-bin/grunnkart_arealanalyse',
  GRAA = 'https://wms.nibio.no/cgi-bin/graastruktur',
  KOMMUNEPLAN = 'https://nap.ft.dibk.no/services/wms/kommuneplaner/',
  INON = 'https://kart.miljodirektoratet.no/geoserver/inngrepsfrinatur/wms',
  MILJO = 'https://kart.miljodirektoratet.no/arcgis/rest/services/',
  VERN = MILJO + 'vern/MapServer/0/query',
  VILLREIN = MILJO + 'villrein/MapServer/1/query',
  VERDSATT = MILJO + 'naturtyper_kuverdi/MapServer/0/query',
  KARTLAGT = MILJO + 'naturtyper_nin/MapServer/1/query',
  /* Landstabellen: tallene for alle kommunene, regnet ut på forhånd (verktoy/landstall.ts) og lagt i bøtta eirikvk/naturdata på
     Hugging Face */
  NATURDATA = 'https://huggingface.co/buckets/eirikvk/naturdata/resolve/',
  LANDSTALL = NATURDATA + 'landstall/kommunetall.parquet',
  LANDSNATURTYPER = NATURDATA + 'landstall/naturtyper.parquet';
