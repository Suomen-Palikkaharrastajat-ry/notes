import { PDFDocument } from "pdf-lib";

export interface PdfSourceItem {
  id: string;
  name: string;
  bytes: Uint8Array;
}

export interface MergePdfOptions {
  title?: string;
  creator?: string;
}

/**
 * Inspects a PDF byte array and returns the number of pages.
 * Validates that the file is not corrupted or encrypted.
 */
export async function getPdfPageCount(bytes: Uint8Array): Promise<number> {
  if (!bytes || bytes.byteLength === 0) {
    throw new Error("Tiedosto on tyhjä.");
  }

  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    return doc.getPageCount();
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (/encrypt|password/i.test(msg)) {
      throw new Error("PDF-tiedosto on salattu tai käyttöoikeusrajoitettu.");
    }
    throw new Error(`PDF-tiedoston lukeminen epäonnistui: ${msg}`);
  }
}

/**
 * Merges multiple PDF byte arrays in the given sequence into a single unified PDF.
 */
export async function mergePdfBytes(
  sources: PdfSourceItem[],
  options?: MergePdfOptions
): Promise<Uint8Array> {
  if (!sources || sources.length === 0) {
    throw new Error("Yhdistettäviä tiedostoja ei ole valittu.");
  }

  const mergedDoc = await PDFDocument.create();
  mergedDoc.setCreator(options?.creator ?? "SFS 2487 Web Editor");
  if (options?.title) {
    mergedDoc.setTitle(options.title);
  }

  for (const source of sources) {
    if (!source.bytes || source.bytes.byteLength === 0) {
      throw new Error(`Tiedosto "${source.name}" on tyhjä.`);
    }

    try {
      const doc = await PDFDocument.load(source.bytes, { ignoreEncryption: false });
      const pageIndices = doc.getPageIndices();
      const copiedPages = await mergedDoc.copyPages(doc, pageIndices);
      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (/encrypt|password/i.test(msg)) {
        throw new Error(`Tiedosto "${source.name}" on salattu tai käyttöoikeusrajoitettu eikä sitä voida yhdistää.`);
      }
      throw new Error(`Tiedoston "${source.name}" yhdistäminen epäonnistui: ${msg}`);
    }
  }

  return await mergedDoc.save();
}

/**
 * Triggers browser download of a PDF Uint8Array.
 */
export function downloadPdfBlob(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = fileName.trim() || "yhdistetty-asiakirja.pdf";
  a.download = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
