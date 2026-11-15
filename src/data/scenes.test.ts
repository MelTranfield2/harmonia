import { describe, expect, it } from "vitest";
import { SCENE_TEXT } from "../i18n";
import { formatDate, SCENES, sceneCaption, sceneUrl } from "./scenes";

describe("[F9] NASA scenes", () => {
  it("has a title and caption for every scene in both languages", () => {
    expect(SCENE_TEXT.en).toHaveLength(SCENES.length);
    expect(SCENE_TEXT.pt).toHaveLength(SCENES.length);
  });

  it("uses valid boxes, sizes and dates", () => {
    for (const s of SCENES) {
      const [south, west, north, east] = s.bbox;
      expect(south).toBeLessThan(north);
      expect(west).toBeLessThan(east);
      expect(south).toBeGreaterThanOrEqual(-90);
      expect(north).toBeLessThanOrEqual(90);
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(s.date))).toBe(false);
    }
  });

  it("builds a GIBS WMS request with lat,lon box order", () => {
    const url = new URL(sceneUrl(SCENES[0]));
    expect(url.origin).toBe("https://gibs.earthdata.nasa.gov");
    const p = url.searchParams;
    expect(p.get("LAYERS")).toBe("MODIS_Terra_CorrectedReflectance_TrueColor");
    expect(p.get("CRS")).toBe("EPSG:4326");
    expect(p.get("BBOX")).toBe("-28,8,-20,18");
    expect(p.get("TIME")).toBe("2024-05-10");
    expect(p.get("FORMAT")).toBe("image/jpeg");
  });

  it("writes dates in each language", () => {
    expect(formatDate("2024-05-10", "en")).toBe("10 May 2024");
    expect(formatDate("2024-05-10", "pt")).toBe("10 de maio de 2024");
  });

  it("builds captions in each language", () => {
    expect(sceneCaption(0, "en")).toBe(
      "Namib coast: The Atlantic Ocean and clouds (left) meet the Namib Desert (right). NASA MODIS Terra, 10 May 2024.",
    );
    expect(sceneCaption(0, "pt")).toContain("Costa da Namíbia");
    expect(sceneCaption(0, "pt")).toContain("10 de maio de 2024");
  });
});
