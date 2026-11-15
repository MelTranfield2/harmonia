import { describe, expect, it, vi } from "vitest";
import { ImageLoadError, loadImageFromFile, loadImageFromUrl } from "./load-image";

const fakeFetch = (status: number, type: string, body = "") =>
  vi.fn(async () => new Response(body, { status, headers: type ? { "content-type": type } : {} })) as unknown as typeof fetch;

describe("[F9] loading images from a URL", () => {
  it("rejects GIBS error messages, which come back as XML", async () => {
    const f = fakeFetch(200, "text/xml", "<ServiceExceptionReport/>");
    await expect(loadImageFromUrl("https://example.test/x", f)).rejects.toBeInstanceOf(ImageLoadError);
  });

  it("rejects HTTP errors", async () => {
    await expect(loadImageFromUrl("https://example.test/x", fakeFetch(404, "image/jpeg"))).rejects.toThrow(/404/);
  });

  it("asks for the given URL", async () => {
    const f = fakeFetch(500, "");
    await loadImageFromUrl("https://example.test/img", f).catch(() => undefined);
    expect(f).toHaveBeenCalledWith("https://example.test/img");
  });
});

describe("[F10] loading the user's file", () => {
  it("ignores files that are not images", async () => {
    const txt = new File(["hello"], "notes.txt", { type: "text/plain" });
    await expect(loadImageFromFile(txt)).resolves.toBeNull();
  });
});
