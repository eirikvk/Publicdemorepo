/* Delene av OpenLayers som siden bruker, samlet i ett navnerom med samme navn som i OpenLayers' egen samlede utgave
   (ol.layer.Tile, ol.extent.intersects og så videre). Bare det som er nevnt her, kommer med i det ferdige bygget. */
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Feature from 'ol/Feature.js';
import Overlay from 'ol/Overlay.js';
import ImageWrapper from 'ol/Image.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import ImageLayer from 'ol/layer/Image.js';
import XYZ from 'ol/source/XYZ.js';
import VectorSource from 'ol/source/Vector.js';
import ImageStatic from 'ol/source/ImageStatic.js';
import ImageSource from 'ol/source/Image.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import Circle from 'ol/style/Circle.js';
import Text from 'ol/style/Text.js';
import Draw from 'ol/interaction/Draw.js';
import Zoom from 'ol/control/Zoom.js';
import ScaleLine from 'ol/control/ScaleLine.js';
import Attribution from 'ol/control/Attribution.js';
import * as extent from 'ol/extent.js';
import * as proj from 'ol/proj.js';
import { register } from 'ol/proj/proj4.js';
import { getRenderPixel, getVectorContext } from 'ol/render.js';

export const ol = {
  Map,
  View,
  Feature,
  Overlay,
  Image: ImageWrapper,
  layer: { Tile: TileLayer, Vector: VectorLayer, Image: ImageLayer },
  source: { XYZ, Vector: VectorSource, ImageStatic, Image: ImageSource },
  tilegrid: { TileGrid },
  geom: { MultiPolygon, Point, Polygon },
  format: { GeoJSON },
  style: { Style, Stroke, Fill, Circle, Text },
  interaction: { Draw },
  control: { Zoom, ScaleLine, Attribution },
  extent,
  proj: { ...proj, proj4: { register } },
  render: { getRenderPixel, getVectorContext }
};
