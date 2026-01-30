import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseWikiMarkup, searchWiki } from "./search.js";

describe("parseWikiMarkup", () => {
  it("parses entries with state headings", () => {
    const markup = `
### Alabama

* **2025-01-20:** [[https://example.com/article1|Article One]] — Birmingham, AL — ICE raid reported downtown

### Connecticut

* **2025-01-21:** [[https://example.com/article2|Article Two]] — Hartford, CT — Workplace enforcement action
`;
    const articles = parseWikiMarkup(markup);
    expect(articles).toHaveLength(2);
    expect(articles[0]).toMatchObject({
      date: "2025-01-20",
      url: "https://example.com/article1",
      state: "Alabama",
    });
    expect(articles[1]).toMatchObject({
      date: "2025-01-21",
      url: "https://example.com/article2",
      state: "Connecticut",
    });
  });

  it("deduplicates entries with the same URL", () => {
    const markup = `
### Alabama

* **2025-01-20:** [[https://example.com/dup|Article]] — City, AL — First mention
* **2025-01-21:** [[https://example.com/dup|Article]] — City, AL — Second mention
`;
    const articles = parseWikiMarkup(markup);
    expect(articles).toHaveLength(1);
    expect(articles[0].date).toBe("2025-01-20");
  });

  it("generates stable IDs from date and URL", () => {
    const markup = `
### Texas

* **2025-01-20:** [[https://example.com/stable|Title]] — Dallas, TX — Description
`;
    const articles = parseWikiMarkup(markup);
    expect(articles[0].id).toMatch(/^wiki-2025-01-20-[a-f0-9]{12}$/);

    // Same input → same ID
    const articles2 = parseWikiMarkup(markup);
    expect(articles2[0].id).toBe(articles[0].id);
  });

  it("skips malformed entries", () => {
    const markup = `
### Texas

* This is not a valid entry
* **baddate:** [[https://example.com/a|Title]] — Desc
* just some random text
`;
    const articles = parseWikiMarkup(markup);
    expect(articles).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(parseWikiMarkup("")).toHaveLength(0);
    expect(parseWikiMarkup("\n\n\n")).toHaveLength(0);
  });

  it("uses Unknown state when no heading precedes entry", () => {
    const markup = `* **2025-01-20:** [[https://example.com/a|Title]] — City — Desc`;
    const articles = parseWikiMarkup(markup);
    expect(articles[0].state).toBe("Unknown");
  });
});

describe("searchWiki", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and filters to recent entries", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const oldDate = "2020-01-01";

    const mockMarkup = `
### California

* **${today}:** [[https://example.com/recent|Recent]] — LA, CA — Recent event
* **${oldDate}:** [[https://example.com/old|Old]] — SF, CA — Old event
`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockMarkup),
      })
    );

    const articles = await searchWiki();
    expect(articles).toHaveLength(1);
    expect(articles[0].url).toBe("https://example.com/recent");
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve(""),
      })
    );

    await expect(searchWiki()).rejects.toThrow("Wiki fetch failed: HTTP 500");
  });
});
