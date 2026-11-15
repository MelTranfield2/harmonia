import { afterEach, describe, expect, it, vi } from "vitest";
import { initialLang, saveLang, SCENE_TEXT, STRINGS } from "./i18n";

describe("[F11] translations", () => {
  it("has the same page text keys in both languages", () => {
    expect(Object.keys(STRINGS.pt.page).sort()).toEqual(Object.keys(STRINGS.en.page).sort());
  });

  it("has no empty text", () => {
    for (const lang of ["en", "pt"] as const) {
      for (const [k, v] of Object.entries(STRINGS[lang].page)) expect(v, `${lang}.${k}`).not.toBe("");
      for (const s of SCENE_TEXT[lang]) {
        expect(s.title).not.toBe("");
        expect(s.caption).not.toBe("");
      }
    }
  });

  it("translates the words used by the meters", () => {
    expect(STRINGS.pt.quality).toEqual({ major: "maior", minor: "menor" });
    expect(STRINGS.pt.brightnessWords).toHaveLength(4); // low, mid, high, [F14] white
    expect(STRINGS.pt.similarityWords).toHaveLength(3);
  });
});

describe("[F11] choosing the language", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubBrowser = (language: string, saved: string | null) => {
    const store = new Map<string, string>(saved ? [["harmonia-lang", saved]] : []);
    vi.stubGlobal("navigator", { language });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    return store;
  };

  it("follows the browser language the first time", () => {
    stubBrowser("pt-BR", null);
    expect(initialLang()).toBe("pt");
    stubBrowser("en-US", null);
    expect(initialLang()).toBe("en");
    stubBrowser("fr-FR", null);
    expect(initialLang()).toBe("en");
  });

  it("remembers the last choice", () => {
    const store = stubBrowser("en-US", null);
    saveLang("pt");
    expect(store.get("harmonia-lang")).toBe("pt");
    expect(initialLang()).toBe("pt");
  });

  it("still works when storage is blocked", () => {
    vi.stubGlobal("navigator", { language: "pt-PT" });
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    });
    expect(initialLang()).toBe("pt");
    expect(() => saveLang("en")).not.toThrow();
  });
});
