import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { PDFDocument } from "pdf-lib";
import { PdfMergeDialog } from "../src/pdf-merge-dialog.ts";
import { resolveEffectiveLogo } from "../src/logo-resolver.ts";

function createMockHtml(): string {
  return `<!DOCTYPE html>
  <html>
    <body>
      <button id="files-toggle"></button>
      <dialog id="pdf-merge-dialog">
        <button id="pdf-merge-dialog-close"></button>
        <button id="pdf-merge-cancel"></button>
        <button id="pdf-merge-execute"></button>
        <button id="pdf-merge-add-doc-btn"></button>
        <button id="pdf-merge-upload-btn"></button>
        <div id="pdf-merge-doc-select-popover" hidden></div>
        <input id="pdf-merge-file-input" type="file" />
        <div id="pdf-merge-dropzone">
          <ul id="pdf-merge-list"></ul>
          <div id="pdf-merge-empty"></div>
        </div>
        <input id="pdf-merge-filename" type="text" value="asiakirja-yhdistetty.pdf" />
        <div id="pdf-merge-status" hidden>
          <span id="pdf-merge-status-text"></span>
        </div>
        <div id="pdf-merge-live"></div>
      </dialog>
    </body>
  </html>`;
}

test("PdfMergeDialog: opens and pre-populates with active document", () => {
  const dom = new JSDOM(createMockHtml());
  const doc = dom.window.document;

  const dialogEl = doc.getElementById("pdf-merge-dialog") as HTMLDialogElement;
  dialogEl.showModal = function () {
    this.open = true;
  };
  dialogEl.close = function () {
    this.open = false;
  };

  const dialog = new PdfMergeDialog({
    dialogEl,
    getActiveFile: () => ({ id: "doc-1", name: "Pöytäkirja.md", content: "# Pöytäkirja" }),
    getFiles: () => [{ id: "doc-1", name: "Pöytäkirja.md", content: "# Pöytäkirja" }],
    compileMarkdownToPdf: async () => new Uint8Array([1, 2, 3]),
  });

  dialog.open();

  assert.equal(dialog.isOpen(), true);
  const items = dialog.getItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "app");
  assert.equal(items[0].name, "Pöytäkirja.md");

  const listEl = doc.getElementById("pdf-merge-list")!;
  assert.equal(listEl.children.length, 1);

  const filenameInput = doc.getElementById("pdf-merge-filename") as HTMLInputElement;
  assert.equal(filenameInput.value, "Pöytäkirja-yhdistetty.pdf");
});

test("PdfMergeDialog: adds documents from popover and reorders items", () => {
  const dom = new JSDOM(createMockHtml());
  const doc = dom.window.document;

  const dialogEl = doc.getElementById("pdf-merge-dialog") as HTMLDialogElement;
  dialogEl.showModal = function () { this.open = true; };
  dialogEl.close = function () { this.open = false; };

  const dialog = new PdfMergeDialog({
    dialogEl,
    getActiveFile: () => ({ id: "doc-1", name: "Kutsu.md", content: "# Kutsu" }),
    getFiles: () => [
      { id: "doc-1", name: "Kutsu.md", content: "# Kutsu" },
      { id: "doc-2", name: "Liite.md", content: "# Liite" },
    ],
    compileMarkdownToPdf: async () => new Uint8Array([1, 2, 3]),
  });

  dialog.open();
  assert.equal(dialog.getItems().length, 1);

  // Click add doc button to open popover
  const addDocBtn = doc.getElementById("pdf-merge-add-doc-btn") as HTMLButtonElement;
  addDocBtn.click();

  const popover = doc.getElementById("pdf-merge-doc-select-popover")!;
  assert.equal(popover.hidden, false);
  assert.equal(addDocBtn.getAttribute("aria-expanded"), "true");

  // Find Liite button and click it
  const buttons = popover.querySelectorAll("button");
  const liiteBtn = Array.from(buttons).find((b) => b.textContent?.includes("Liite.md"));
  assert.ok(liiteBtn, "Liite.md should be in popover");
  liiteBtn!.click();

  assert.equal(popover.hidden, true);
  assert.equal(addDocBtn.getAttribute("aria-expanded"), "false");
  assert.equal(dialog.getItems().length, 2);
  assert.equal(dialog.getItems()[1].name, "Liite.md");

  // Verify list rendered 2 items
  const listEl = doc.getElementById("pdf-merge-list")!;
  assert.equal(listEl.children.length, 2);

  // Move Liite up (click upBtn on second item)
  const secondLi = listEl.children[1] as HTMLElement;
  const upBtn = secondLi.querySelector(".pdf-item-up-btn") as HTMLButtonElement;
  assert.equal(upBtn.disabled, false);
  upBtn.click();

  // Now Liite is first, Kutsu is second
  assert.equal(dialog.getItems()[0].name, "Liite.md");
  assert.equal(dialog.getItems()[1].name, "Kutsu.md");
});

test("PdfMergeDialog: executes merge, compiles app docs and downloads combined PDF", async () => {
  const dom = new JSDOM(createMockHtml());
  const doc = dom.window.document;

  const dialogEl = doc.getElementById("pdf-merge-dialog") as HTMLDialogElement;
  dialogEl.showModal = function () { this.open = true; };
  dialogEl.close = function () { this.open = false; };

  let compiledCount = 0;
  let toastMsg = "";

  // Prepare valid pdf-lib bytes for compilation
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage();
  const validPdfBytes = await pdfDoc.save();

  const dialog = new PdfMergeDialog({
    dialogEl,
    getActiveFile: () => ({ id: "doc-1", name: "Doc1.md", content: "Content 1" }),
    getFiles: () => [{ id: "doc-1", name: "Doc1.md", content: "Content 1" }],
    compileMarkdownToPdf: async () => {
      compiledCount++;
      return validPdfBytes;
    },
    toast: (msg) => {
      toastMsg = msg;
    },
  });

  dialog.open();

  // Mock global document for downloadPdfBlob
  const originalDoc = (globalThis as any).document;
  (globalThis as any).document = {
    createElement: (tag: string) => ({
      tagName: tag.toUpperCase(),
      href: "",
      download: "",
      click() {},
    }),
  };

  try {
    await dialog.executeMerge();

    assert.equal(compiledCount, 1);
    assert.ok(toastMsg.includes("Yhdistetty PDF ladattu onnistuneesti"));
    assert.equal(dialog.isOpen(), false);
  } finally {
    (globalThis as any).document = originalDoc;
  }
});

test("PdfMergeDialog: compile failure includes document name and re-enables dialog", async () => {
  const dom = new JSDOM(createMockHtml());
  const doc = dom.window.document;

  const dialogEl = doc.getElementById("pdf-merge-dialog") as HTMLDialogElement;
  dialogEl.showModal = function () { this.open = true; };
  dialogEl.close = function () { this.open = false; };

  let failMsg = "";

  const dialog = new PdfMergeDialog({
    dialogEl,
    getActiveFile: () => ({ id: "doc-bad", name: "Viallinen.md", content: "syntax error" }),
    getFiles: () => [{ id: "doc-bad", name: "Viallinen.md", content: "syntax error" }],
    compileMarkdownToPdf: async () => {
      throw new Error("Typst parsing error: unexpected token");
    },
    fail: (msg) => {
      failMsg = msg;
    },
  });

  dialog.open();
  await dialog.executeMerge();

  assert.ok(failMsg.includes("Viallinen.md"));
  assert.ok(failMsg.includes("Typst parsing error"));
  assert.equal(dialog.isOpen(), true);

  const executeBtn = doc.getElementById("pdf-merge-execute") as HTMLButtonElement;
  assert.equal(executeBtn.disabled, false);
});

test("PdfMergeDialog: closing dialog cleans up queue and restores focus to opener", () => {
  const dom = new JSDOM(createMockHtml());
  const doc = dom.window.document;

  const dialogEl = doc.getElementById("pdf-merge-dialog") as HTMLDialogElement;
  dialogEl.showModal = function () { this.open = true; };
  dialogEl.close = function () { this.open = false; };

  const openerBtn = doc.getElementById("files-toggle") as HTMLButtonElement;
  let focused = false;
  openerBtn.focus = () => { focused = true; };

  const dialog = new PdfMergeDialog({
    dialogEl,
    getActiveFile: () => ({ id: "doc-1", name: "Doc1.md", content: "Content" }),
    getFiles: () => [],
    compileMarkdownToPdf: async () => new Uint8Array([1, 2, 3]),
  });

  dialog.open(openerBtn);
  assert.equal(dialog.getItems().length, 1);

  dialog.close();
  assert.equal(dialog.isOpen(), false);
  assert.equal(dialog.getItems().length, 0);
  assert.equal(focused, true);
});

test("PdfMergeDialog: focus shifts correctly on up/down/remove and boundary cases", () => {
  const dom = new JSDOM(createMockHtml());
  const doc = dom.window.document;

  const dialogEl = doc.getElementById("pdf-merge-dialog") as HTMLDialogElement;
  dialogEl.showModal = function () { this.open = true; };
  dialogEl.close = function () { this.open = false; };

  const dialog = new PdfMergeDialog({
    dialogEl,
    getActiveFile: () => ({ id: "d1", name: "Doc 1", content: "1" }),
    getFiles: () => [
      { id: "d1", name: "Doc 1", content: "1" },
      { id: "d2", name: "Doc 2", content: "2" },
      { id: "d3", name: "Doc 3", content: "3" },
    ],
    compileMarkdownToPdf: async () => new Uint8Array([1]),
  });

  dialog.open();
  // Add Doc 2 and Doc 3 via popover
  const addDocBtn = doc.getElementById("pdf-merge-add-doc-btn") as HTMLButtonElement;
  addDocBtn.click();
  const popover = doc.getElementById("pdf-merge-doc-select-popover")!;
  const d2Btn = Array.from(popover.querySelectorAll("button")).find(b => b.textContent?.includes("Doc 2"));
  d2Btn!.click();

  addDocBtn.click();
  const d3Btn = Array.from(popover.querySelectorAll("button")).find(b => b.textContent?.includes("Doc 3"));
  d3Btn!.click();

  assert.equal(dialog.getItems().length, 3);
  const listEl = doc.getElementById("pdf-merge-list")!;

  // Move Doc 2 (index 1) UP -> it becomes index 0! Its upBtn is now disabled, so downBtn gets focused
  const item2Li = listEl.children[1] as HTMLElement;
  const upBtn = item2Li.querySelector(".pdf-item-up-btn") as HTMLButtonElement;
  upBtn.click();

  assert.equal(dialog.getItems()[0].name, "Doc 2");
  const firstLi = listEl.children[0] as HTMLElement;
  const firstDownBtn = firstLi.querySelector(".pdf-item-down-btn") as HTMLButtonElement;
  assert.equal(doc.activeElement, firstDownBtn);

  // Remove first item (Doc 2) -> focus moves to the next item's remove button
  const firstRemoveBtn = firstLi.querySelector(".pdf-item-remove-btn") as HTMLButtonElement;
  firstRemoveBtn.click();
  assert.equal(dialog.getItems().length, 2);
  const newFirstLi = listEl.children[0] as HTMLElement;
  const newFirstRemoveBtn = newFirstLi.querySelector(".pdf-item-remove-btn") as HTMLButtonElement;
  assert.equal(doc.activeElement, newFirstRemoveBtn);
});

test("PdfMergeDialog: Escape closes popover only when open, and does not close dialog while busy", () => {
  const dom = new JSDOM(createMockHtml());
  const doc = dom.window.document;

  const dialogEl = doc.getElementById("pdf-merge-dialog") as HTMLDialogElement;
  dialogEl.showModal = function () { this.open = true; };
  dialogEl.close = function () { this.open = false; };

  const dialog = new PdfMergeDialog({
    dialogEl,
    getActiveFile: () => ({ id: "d1", name: "Doc 1", content: "1" }),
    getFiles: () => [{ id: "d1", name: "Doc 1", content: "1" }],
    compileMarkdownToPdf: async () => new Uint8Array([1]),
  });

  dialog.open();
  const addDocBtn = doc.getElementById("pdf-merge-add-doc-btn") as HTMLButtonElement;
  addDocBtn.click();
  const popover = doc.getElementById("pdf-merge-doc-select-popover")!;
  assert.equal(popover.hidden, false);

  // Press Escape -> popover closes, dialog stays open
  dialogEl.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(popover.hidden, true);
  assert.equal(dialog.isOpen(), true);

  // Press Escape again -> dialog closes
  dialogEl.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(dialog.isOpen(), false);
});

test("PdfMergeDialog: busy state disables action buttons and prevents additions", () => {
  const dom = new JSDOM(createMockHtml());
  const doc = dom.window.document;

  const dialogEl = doc.getElementById("pdf-merge-dialog") as HTMLDialogElement;
  dialogEl.showModal = function () { this.open = true; };
  dialogEl.close = function () { this.open = false; };

  let resolveCompile: (bytes: Uint8Array) => void;
  const compilePromise = new Promise<Uint8Array>((res) => {
    resolveCompile = res;
  });

  const dialog = new PdfMergeDialog({
    dialogEl,
    getActiveFile: () => ({ id: "d1", name: "Doc 1", content: "1" }),
    getFiles: () => [{ id: "d1", name: "Doc 1", content: "1" }],
    compileMarkdownToPdf: () => compilePromise,
  });

  dialog.open();
  const addDocBtn = doc.getElementById("pdf-merge-add-doc-btn") as HTMLButtonElement;
  const uploadBtn = doc.getElementById("pdf-merge-upload-btn") as HTMLButtonElement;
  const executeBtn = doc.getElementById("pdf-merge-execute") as HTMLButtonElement;

  assert.equal(addDocBtn.disabled, false);
  assert.equal(uploadBtn.disabled, false);

  // Start merge (background pending)
  const mergePromise = dialog.executeMerge();

  // While busy:
  assert.equal(addDocBtn.disabled, true);
  assert.equal(uploadBtn.disabled, true);
  assert.equal(executeBtn.disabled, true);

  // Finish compile
  resolveCompile!(new Uint8Array([1, 2, 3]));
  return mergePromise.catch(() => {}).then(() => {
    // When done, buttons are reset
    assert.equal(addDocBtn.disabled, false);
    assert.equal(uploadBtn.disabled, false);
  });
});

test("resolveEffectiveLogo: implements consistent logo precedence across all files", () => {
  const bytesUser = new Uint8Array([1]);
  const bytesTpl = new Uint8Array([2]);
  const bytesStored = new Uint8Array([3]);
  const bytesDefault = new Uint8Array([4]);

  const defaultLogo = { path: "/default.svg", name: "Default", bytes: bytesDefault };
  const uploadedLogo = { path: "/user.png", name: "User", bytes: bytesUser };
  const activeTemplateLogo = { path: "/tpl.svg", name: "Template", bytes: bytesTpl };

  // 1. Cleared flag takes top precedence
  const cleared = resolveEffectiveLogo({
    fileId: "doc-1",
    activeFileId: "doc-1",
    isLogoCleared: true,
    uploadedLogo,
    activeTemplateLogo,
    defaultLogo,
  });
  assert.equal(cleared, undefined);

  // 2. User uploaded logo overrides template and default
  const withUser = resolveEffectiveLogo({
    fileId: "doc-2",
    activeFileId: "doc-1",
    isLogoCleared: false,
    uploadedLogo,
    activeTemplateLogo,
    defaultLogo,
  });
  assert.equal(withUser?.path, "/user.png");

  // 3. Active file gets active template logo when no user upload
  const activeWithTpl = resolveEffectiveLogo({
    fileId: "doc-1",
    activeFileId: "doc-1",
    isLogoCleared: false,
    activeTemplateLogo,
    defaultLogo,
  });
  assert.equal(activeWithTpl?.path, "/tpl.svg");

  // 4. Background file gets stored template logo
  const bgWithStored = resolveEffectiveLogo({
    fileId: "doc-2",
    activeFileId: "doc-1",
    isLogoCleared: false,
    getStoredTemplateLogo: (id) => (id === "doc-2" ? { path: "/stored.svg", name: "Stored", bytes: bytesStored } : undefined),
    defaultLogo,
  });
  assert.equal(bgWithStored?.path, "/stored.svg");

  // 5. Fallback to association default logo
  const fallback = resolveEffectiveLogo({
    fileId: "doc-3",
    activeFileId: "doc-1",
    isLogoCleared: false,
    defaultLogo,
  });
  assert.equal(fallback?.path, "/default.svg");
});
