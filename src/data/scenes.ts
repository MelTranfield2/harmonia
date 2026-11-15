// =============================================================================
// [F9] NASA SATELLITE IMAGES  /  IMAGENS DE SATÉLITE DA NASA
// NASA true-colour images from GIBS (free, no key, CORS enabled). Each one was checked by eye
// for clouds and satellite gaps before being added. Titles and captions live in i18n.ts.
// Imagens de cor verdadeira do GIBS (grátis, sem chave). Cada uma foi conferida no olho.
// Títulos e legendas ficam em i18n.ts.
//
// To add an image: add an entry here AND a title/caption in both languages in i18n.ts
// (SCENE_TEXT). The tests check that both lists have the same length.
// Para adicionar uma imagem: uma entrada aqui E título/legenda nos dois idiomas em i18n.ts.
// Os testes conferem que as duas listas têm o mesmo tamanho.
// =============================================================================
import { SCENE_TEXT, STRINGS, type Lang } from "../i18n";

export type Satellite = "MODIS_Terra" | "VIIRS_SNPP" | "VIIRS_NOAA20";

export interface Scene {
  satellite: Satellite;
  /** south, west, north, east in degrees / sul, oeste, norte, leste em graus */
  bbox: [south: number, west: number, north: number, east: number];
  width: number;
  height: number;
  /** YYYY-MM-DD */
  date: string;
}

export const SATELLITE_NAMES: Record<Satellite, string> = {
  MODIS_Terra: "MODIS Terra",
  VIIRS_SNPP: "VIIRS Suomi NPP",
  VIIRS_NOAA20: "VIIRS NOAA-20",
};

export const SCENES: readonly Scene[] = [
  { satellite: "MODIS_Terra", bbox: [-28, 8, -20, 18], width: 600, height: 480, date: "2024-05-10" }, // Namib coast
  { satellite: "MODIS_Terra", bbox: [20, 0, 30, 20], width: 640, height: 320, date: "2024-06-15" }, // Sahara
  { satellite: "VIIRS_NOAA20", bbox: [-30, 125, -20, 140], width: 600, height: 400, date: "2024-06-01" }, // Australia
  { satellite: "VIIRS_SNPP", bbox: [-6, -66, 0, -54], width: 640, height: 320, date: "2024-08-20" }, // Amazon
  { satellite: "VIIRS_SNPP", bbox: [22, -80, 27, -75], width: 480, height: 480, date: "2024-03-10" }, // Bahamas
  { satellite: "VIIRS_SNPP", bbox: [18, -95, 30, -80], width: 600, height: 480, date: "2024-10-08" }, // Milton
  { satellite: "MODIS_Terra", bbox: [60, -60, 80, -20], width: 480, height: 480, date: "2024-07-20" }, // Greenland
];

const GIBS_WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";

/**
 * GIBS WMS 1.3.0 GetMap URL. For EPSG:4326, WMS 1.3.0 expects the box as lat,lon
 * (south, west, north, east), which is exactly how `bbox` is stored.
 * Para EPSG:4326 o WMS 1.3.0 espera lat,lon (sul, oeste, norte, leste), igual ao `bbox`.
 */
export function sceneUrl(s: Scene): string {
  const p = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.3.0",
    LAYERS: `${s.satellite}_CorrectedReflectance_TrueColor`,
    STYLES: "",
    CRS: "EPSG:4326",
    BBOX: s.bbox.join(","),
    WIDTH: String(s.width),
    HEIGHT: String(s.height),
    FORMAT: "image/jpeg",
    TIME: s.date,
  });
  return `${GIBS_WMS}?${p}`;
}

/** e.g. "10 May 2024" / "10 de maio de 2024" */
export function formatDate(isoDate: string, lang: Lang): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(STRINGS[lang].dateLocale, {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

/** "Title: caption. NASA <satellite>, <date>." in the chosen language. */
export function sceneCaption(index: number, lang: Lang): string {
  const s = SCENES[index], text = SCENE_TEXT[lang][index];
  return `${text.title}: ${text.caption} NASA ${SATELLITE_NAMES[s.satellite]}, ${formatDate(s.date, lang)}.`;
}
