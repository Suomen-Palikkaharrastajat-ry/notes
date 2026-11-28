import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { mergePdfBytes, getPdfPageCount, downloadPdfBlob } from "../src/pdf-merger.ts";
import { mergeLogoPath } from "../src/typst-worker-types.ts";

async function createTestPdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([400, 600]);
  }
  return await doc.save();
}

test("pdf-merger: getPdfPageCount returns correct page counts", async () => {
  const pdf1 = await createTestPdf(1);
  const pdf3 = await createTestPdf(3);

  assert.equal(await getPdfPageCount(pdf1), 1);
  assert.equal(await getPdfPageCount(pdf3), 3);
});

test("pdf-merger: getPdfPageCount rejects encrypted or restricted PDF with Finnish error", async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.context.trailerInfo.Encrypt = doc.context.obj({ Filter: "Standard", V: 1, R: 2 });
  const encryptedBytes = await doc.save({ useObjectStreams: false });

  await assert.rejects(
    async () => {
      await getPdfPageCount(encryptedBytes);
    },
    {
      message: /salattu tai käyttöoikeusrajoitettu/,
    }
  );
});

test("pdf-merger: mergeLogoPath generates isolated path and preserves extension", () => {
  assert.equal(mergeLogoPath(1, "/logo.png"), "/__merge_1_logo.png");
  assert.equal(mergeLogoPath("req_42", "custom/avatar.svg"), "/__merge_req_42_logo.svg");
  assert.equal(mergeLogoPath("x", "no-extension"), "/__merge_x_logo.png");
  assert.equal(mergeLogoPath(2, undefined), undefined);

  // Must never equal the default preview root paths
  const forbidden = ["/logo.png", "/logo.jpg", "/logo.svg"];
  for (const f of forbidden) {
    assert.notEqual(mergeLogoPath(1, f), f);
  }
});

test("pdf-merger: mergePdfBytes merges multiple documents preserving total page count", async () => {
  const docA = await createTestPdf(2);
  const docB = await createTestPdf(4);

  const merged = await mergePdfBytes([
    { id: "a", name: "DocA.pdf", bytes: docA },
    { id: "b", name: "DocB.pdf", bytes: docB },
  ]);

  assert.ok(merged instanceof Uint8Array);
  assert.ok(merged.byteLength > 0);

  const count = await getPdfPageCount(merged);
  assert.equal(count, 6);
});

test("pdf-merger: mergePdfBytes rejects empty source list", async () => {
  await assert.rejects(
    async () => {
      await mergePdfBytes([]);
    },
    {
      message: /Yhdistettäviä tiedostoja ei ole valittu/,
    }
  );
});

test("pdf-merger: mergePdfBytes rejects empty or invalid bytes with clear error", async () => {
  await assert.rejects(
    async () => {
      await mergePdfBytes([
        { id: "empty", name: "empty.pdf", bytes: new Uint8Array(0) },
      ]);
    },
    {
      message: /on tyhjä/,
    }
  );

  await assert.rejects(
    async () => {
      await mergePdfBytes([
        { id: "corrupt", name: "corrupt.pdf", bytes: new Uint8Array([1, 2, 3, 4]) },
      ]);
    },
    {
      message: /yhdistäminen epäonnistui/,
    }
  );
});

test("pdf-merger: downloadPdfBlob triggers URL creation and anchor click without crash", async () => {
  // Simple browser mock for download
  let clicked = false;
  let clickedDownload = "";
  const originalBlob = (globalThis as any).Blob;
  const originalUrl = (globalThis as any).URL;
  const originalDoc = (globalThis as any).document;

  (globalThis as any).Blob = class MockBlob {
    parts: any[];
    opts: any;
    constructor(parts: any[], opts: any) {
      this.parts = parts;
      this.opts = opts;
    }
  };
  (globalThis as any).URL = {
    createObjectURL: () => "blob:mock-url",
    revokeObjectURL: () => {},
  };
  (globalThis as any).document = {
    createElement: (tag: string) => ({
      tagName: tag.toUpperCase(),
      href: "",
      download: "",
      click() {
        clicked = true;
        clickedDownload = this.download;
      },
    }),
  };

  try {
    const bytes = new Uint8Array([10, 20, 30]);
    downloadPdfBlob(bytes, "raportti");
    assert.equal(clicked, true);
    assert.equal(clickedDownload, "raportti.pdf");
  } finally {
    (globalThis as any).Blob = originalBlob;
    (globalThis as any).URL = originalUrl;
    (globalThis as any).document = originalDoc;
  }
});
