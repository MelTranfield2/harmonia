// NASA GIBS (Global Imagery Browse Services) helpers.
// GIBS is free, needs no API key and sends CORS headers, so the browser can
// read image pixels directly. Docs: https://nasa-gibs.github.io/gibs-api-docs/

export type Projection = "4326" | "3413";

/** Bounding box in the projection's own units (degrees for 4326, metres for 3413). */
export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

const BASE = "https://gibs.earthdata.nasa.gov";

export const PROJECTIONS: Record<Projection, { crs: string; endpoint: string; coastLayer: string }> = {
  // Global lat/lon grid ("plate carrée")
  "4326": { crs: "EPSG:4326", endpoint: `${BASE}/wms/epsg4326/best/wms.cgi`, coastLayer: "Coastlines_15m" },
  // Arctic polar stereographic (North Pole in the centre)
  "3413": { crs: "EPSG:3413", endpoint: `${BASE}/wms/epsg3413/best/wms.cgi`, coastLayer: "Coastlines" },
};

export interface WmsRequest {
  projection: Projection;
  layer: string;
  bbox: BBox;
  width: number;
  height: number;
  time?: string;
}

/** Builds a WMS 1.3.0 GetMap URL. Note EPSG:4326 uses lat,lon axis order in WMS 1.3.0. */
export function wmsUrl(req: WmsRequest): string {
  const p = PROJECTIONS[req.projection];
  const { west, south, east, north } = req.bbox;
  const bbox = req.projection === "4326" ? [south, west, north, east] : [west, south, east, north];
  const params = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.3.0",
    LAYERS: req.layer,
    STYLES: "",
    CRS: p.crs,
    BBOX: bbox.join(","),
    WIDTH: String(req.width),
    HEIGHT: String(req.height),
    FORMAT: "image/png",
    TRANSPARENT: "TRUE",
  });
  if (req.time) params.set("TIME", req.time);
  return `${p.endpoint}?${params}`;
}

export function colormapUrl(name: string): string {
  return `${BASE}/colormaps/v1.3/${name}.xml`;
}

/** Fetches an image and returns its pixels. Throws on a WMS error (which comes back as XML). */
export async function fetchImage(url: string, signal?: AbortSignal): Promise<{ bitmap: ImageBitmap; pixels: ImageData }> {
  const res = await fetch(url, { signal });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) {
    const text = await res.text().catch(() => "");
    throw new Error(`GIBS request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  return { bitmap, pixels: ctx.getImageData(0, 0, bitmap.width, bitmap.height) };
}
