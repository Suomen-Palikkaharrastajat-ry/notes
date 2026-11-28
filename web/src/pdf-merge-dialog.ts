import type { Logo } from "./preview.ts";
import type { ToastType } from "./ui.ts";
import { iconSvg } from "./ui.ts";

export interface AppDocumentSource {
  queueId: string;
  type: "app";
  id: string;
  name: string;
  content: string;
  logo?: Logo;
}

export interface ExternalPdfSource {
  queueId: string;
  type: "external";
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

export type MergeQueueItem = AppDocumentSource | ExternalPdfSource;

export interface PdfMergeDialogOptions {
  dialogEl?: HTMLDialogElement | null;
  getFiles: () => Array<{ id: string; name: string; content: string }>;
  getActiveFile: () => { id: string; name: string; content: string };
  getActiveLogo?: () => Logo | undefined;
  getFileLogo?: (fileId: string) => Logo | undefined;
  compileMarkdownToPdf: (md: string, logo?: Logo) => Promise<Uint8Array | undefined>;
  toast?: (message: string, type?: ToastType) => void;
  fail?: (message: string) => void;
}

export class PdfMergeDialog {
  private dialog: HTMLDialogElement | null;
  private closeBtn: HTMLButtonElement | null;
  private cancelBtn: HTMLButtonElement | null;
  private executeBtn: HTMLButtonElement | null;
  private addDocBtn: HTMLButtonElement | null;
  private uploadBtn: HTMLButtonElement | null;
  private docPopover: HTMLElement | null;
  private fileInput: HTMLInputElement | null;
  private dropzone: HTMLElement | null;
  private listEl: HTMLElement | null;
  private emptyEl: HTMLElement | null;
  private filenameInput: HTMLInputElement | null;
  private statusEl: HTMLElement | null;
  private statusTextEl: HTMLElement | null;
  private liveRegionEl: HTMLElement | null;

  private options: PdfMergeDialogOptions;
  private items: MergeQueueItem[] = [];
  private isProcessing = false;
  private openerEl: HTMLElement | null = null;
  private dragCounter = 0;
  private sessionCounter = 0;

  constructor(options: PdfMergeDialogOptions) {
    this.options = options;
    const doc =
      options.dialogEl?.ownerDocument ??
      (typeof document !== "undefined" ? document : null);

    this.dialog =
      options.dialogEl ??
      (doc?.getElementById("pdf-merge-dialog") as HTMLDialogElement | null);

    this.closeBtn =
      (this.dialog?.querySelector("#pdf-merge-dialog-close") as HTMLButtonElement | null) ??
      (doc?.getElementById("pdf-merge-dialog-close") as HTMLButtonElement | null);
    this.cancelBtn =
      (this.dialog?.querySelector("#pdf-merge-cancel") as HTMLButtonElement | null) ??
      (doc?.getElementById("pdf-merge-cancel") as HTMLButtonElement | null);
    this.executeBtn =
      (this.dialog?.querySelector("#pdf-merge-execute") as HTMLButtonElement | null) ??
      (doc?.getElementById("pdf-merge-execute") as HTMLButtonElement | null);
    this.addDocBtn =
      (this.dialog?.querySelector("#pdf-merge-add-doc-btn") as HTMLButtonElement | null) ??
      (doc?.getElementById("pdf-merge-add-doc-btn") as HTMLButtonElement | null);
    this.uploadBtn =
      (this.dialog?.querySelector("#pdf-merge-upload-btn") as HTMLButtonElement | null) ??
      (doc?.getElementById("pdf-merge-upload-btn") as HTMLButtonElement | null);
    this.docPopover =
      (this.dialog?.querySelector("#pdf-merge-doc-select-popover") as HTMLElement | null) ??
      (doc?.getElementById("pdf-merge-doc-select-popover") as HTMLElement | null);
    this.fileInput =
      (this.dialog?.querySelector("#pdf-merge-file-input") as HTMLInputElement | null) ??
      (doc?.getElementById("pdf-merge-file-input") as HTMLInputElement | null);
    this.dropzone =
      (this.dialog?.querySelector("#pdf-merge-dropzone") as HTMLElement | null) ??
      (doc?.getElementById("pdf-merge-dropzone") as HTMLElement | null);
    this.listEl =
      (this.dialog?.querySelector("#pdf-merge-list") as HTMLElement | null) ??
      (doc?.getElementById("pdf-merge-list") as HTMLElement | null);
    this.emptyEl =
      (this.dialog?.querySelector("#pdf-merge-empty") as HTMLElement | null) ??
      (doc?.getElementById("pdf-merge-empty") as HTMLElement | null);
    this.filenameInput =
      (this.dialog?.querySelector("#pdf-merge-filename") as HTMLInputElement | null) ??
      (doc?.getElementById("pdf-merge-filename") as HTMLInputElement | null);
    this.statusEl =
      (this.dialog?.querySelector("#pdf-merge-status") as HTMLElement | null) ??
      (doc?.getElementById("pdf-merge-status") as HTMLElement | null);
    this.statusTextEl =
      (this.dialog?.querySelector("#pdf-merge-status-text") as HTMLElement | null) ??
      (doc?.getElementById("pdf-merge-status-text") as HTMLElement | null);
    this.liveRegionEl =
      (this.dialog?.querySelector("#pdf-merge-live") as HTMLElement | null) ??
      (doc?.getElementById("pdf-merge-live") as HTMLElement | null);

    this.bindEvents();
  }

  private bindEvents(): void {
    this.closeBtn?.addEventListener("click", () => this.close());
    this.cancelBtn?.addEventListener("click", () => this.close());

    this.dialog?.addEventListener("click", (e) => {
      if (e.target === this.dialog && !this.isProcessing) {
        this.close();
      }
    });

    this.dialog?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!this.isProcessing) {
          if (this.docPopover && !this.docPopover.hidden) {
            this.closeDocPopover();
          } else {
            this.close();
          }
        }
      }
    });

    this.dialog?.addEventListener("cancel", (e) => {
      e.preventDefault();
      if (!this.isProcessing) {
        this.close();
      }
    });

    // Prevent dropping files outside the dropzone from triggering browser navigation
    this.dialog?.addEventListener("dragover", (e) => {
      const hasFiles = e.dataTransfer?.types ? Array.from(e.dataTransfer.types).includes("Files") : false;
      if (hasFiles) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    this.dialog?.addEventListener("drop", (e) => {
      const hasFiles = e.dataTransfer?.types ? Array.from(e.dataTransfer.types).includes("Files") : false;
      if (hasFiles) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Toggle popover for adding app documents
    this.addDocBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleDocPopover();
    });

    // Keyboard-accessible external PDF upload button
    this.uploadBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.isProcessing) {
        this.fileInput?.click();
      }
    });

    const doc = this.dialog?.ownerDocument ?? (typeof document !== "undefined" ? document : null);
    doc?.addEventListener("pointerdown", (e: any) => {
      if (
        this.docPopover &&
        !this.docPopover.hidden &&
        !this.docPopover.contains(e.target as Node) &&
        !this.addDocBtn?.contains(e.target as Node)
      ) {
        this.closeDocPopover();
      }
    });

    // Close popover when focus moves completely outside of it and addDocBtn
    this.docPopover?.addEventListener("focusout", (e: FocusEvent) => {
      const related = e.relatedTarget as Node | null;
      if (related && (this.docPopover?.contains(related) || this.addDocBtn?.contains(related))) {
        return;
      }
      this.closeDocPopover();
    });

    // File input for uploading external PDFs
    this.fileInput?.addEventListener("change", async () => {
      if (this.isProcessing) return;
      const files = this.fileInput?.files;
      if (files && files.length > 0) {
        await this.handleExternalFiles(Array.from(files), this.sessionCounter);
        if (this.fileInput) {
          this.fileInput.value = "";
        }
      }
    });

    // Drag and drop onto dropzone with anti-flicker counter
    if (this.dropzone) {
      this.dropzone.addEventListener("dragenter", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dragCounter++;
        this.dropzone?.classList.add("drag-over");
      });

      this.dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      this.dropzone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dragCounter--;
        if (this.dragCounter <= 0) {
          this.dragCounter = 0;
          this.dropzone?.classList.remove("drag-over");
        }
      });

      this.dropzone.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dragCounter = 0;
        this.dropzone?.classList.remove("drag-over");
        if (this.isProcessing) return;
        const dt = e.dataTransfer;
        if (dt?.files && dt.files.length > 0) {
          await this.handleExternalFiles(Array.from(dt.files), this.sessionCounter);
        }
      });
    }

    // Execute merge
    this.executeBtn?.addEventListener("click", () => {
      void this.executeMerge();
    });
  }

  private toggleDocPopover(): void {
    if (!this.docPopover) return;
    if (this.docPopover.hidden) {
      this.renderDocPopover();
      this.docPopover.hidden = false;
      this.addDocBtn?.setAttribute("aria-expanded", "true");
      // Focus first item in popover
      const firstBtn = this.docPopover.querySelector("button");
      firstBtn?.focus();
    } else {
      this.closeDocPopover();
    }
  }

  private closeDocPopover(): void {
    if (this.docPopover && !this.docPopover.hidden) {
      this.docPopover.hidden = true;
      this.addDocBtn?.setAttribute("aria-expanded", "false");
      this.addDocBtn?.focus();
    }
  }

  private renderDocPopover(): void {
    if (!this.docPopover) return;
    const doc = this.dialog?.ownerDocument ?? (typeof document !== "undefined" ? document : (globalThis as any).document);
    const files = this.options.getFiles();
    this.docPopover.innerHTML = "";

    const titleEl = doc.createElement("div");
    titleEl.className = "pdf-merge-popover-title";
    titleEl.textContent = "Valitse lisättävä asiakirja:";
    this.docPopover.appendChild(titleEl);

    if (files.length === 0) {
      const emptyNote = doc.createElement("div");
      emptyNote.className = "pdf-merge-popover-empty";
      emptyNote.textContent = "Ei tallennettuja asiakirjoja.";
      this.docPopover.appendChild(emptyNote);
      return;
    }

    const list = doc.createElement("ul");
    list.className = "pdf-merge-popover-list";

    for (const f of files) {
      const li = doc.createElement("li");
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "pdf-merge-popover-item-btn";

      const nameSpan = doc.createElement("span");
      nameSpan.className = "pdf-merge-popover-item-name";
      nameSpan.textContent = f.name;

      btn.appendChild(iconSvg("i-folder", doc));
      btn.appendChild(nameSpan);

      btn.addEventListener("click", () => {
        const logo = this.options.getFileLogo?.(f.id);
        const queueId = `app-${f.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        this.items.push({
          queueId,
          type: "app",
          id: f.id,
          name: f.name,
          content: f.content,
          logo,
        });
        this.closeDocPopover();
        this.renderQueue({ focusTargetId: queueId, focusTargetAction: "down" });
        this.announce(`Lisätty asiakirja "${f.name}". Listassa on nyt ${this.items.length} tiedostoa.`);
      });

      li.appendChild(btn);
      list.appendChild(li);
    }

    this.docPopover.appendChild(list);
  }

  private async handleExternalFiles(files: File[], session: number): Promise<void> {
    if (this.isProcessing) return;

    const pdfFiles = files.filter(
      (f) => f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf"
    );

    const nonPdfCount = files.length - pdfFiles.length;
    if (nonPdfCount > 0) {
      this.options.toast?.(
        `${nonPdfCount} tiedostoa ohitettiin, koska ne eivät olleet PDF-muotoisia.`,
        "warning"
      );
    }

    if (pdfFiles.length === 0) {
      if (nonPdfCount === 0) {
        this.options.toast?.("Valituista tiedostoista mikään ei ollut PDF-muotoinen.", "warning");
      }
      return;
    }

    const { getPdfPageCount } = await import("./pdf-merger.ts");

    const addedItems: MergeQueueItem[] = [];
    const addedSummary: Array<{ name: string; pageCount: number }> = [];

    for (const f of pdfFiles) {
      try {
        const buffer = await f.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const pageCount = await getPdfPageCount(bytes);

        const queueId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        addedItems.push({
          queueId,
          type: "external",
          id: queueId,
          name: f.name,
          bytes,
          pageCount,
        });
        addedSummary.push({ name: f.name, pageCount });
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        this.options.fail?.(`Tiedostoa "${f.name}" ei voitu lisätä: ${msg}`);
      }
    }

    // Guard against stale file additions if dialog was closed/reopened while reading
    if (session !== this.sessionCounter || !this.isOpen()) {
      return;
    }

    if (addedItems.length > 0) {
      this.items.push(...addedItems);
      if (addedSummary.length === 1) {
        this.announce(`Lisätty PDF "${addedSummary[0].name}" (${addedSummary[0].pageCount} sivua). Listassa on nyt ${this.items.length} tiedostoa.`);
      } else {
        this.announce(`Lisätty ${addedSummary.length} PDF-tiedostoa. Listassa on nyt ${this.items.length} tiedostoa.`);
      }
      this.renderQueue();
    }
  }

  private announce(text: string): void {
    if (this.liveRegionEl) {
      this.liveRegionEl.textContent = text;
    }
  }

  renderQueue(focusTarget?: { focusTargetId: string; focusTargetAction: "up" | "down" | "remove" }): void {
    if (!this.listEl || !this.emptyEl) return;

    this.listEl.innerHTML = "";
    const hasItems = this.items.length > 0;
    this.emptyEl.hidden = hasItems;

    if (this.executeBtn) {
      this.executeBtn.disabled = !hasItems || this.isProcessing;
    }

    const doc = this.dialog?.ownerDocument ?? (typeof document !== "undefined" ? document : (globalThis as any).document);
    let targetButtonToFocus: HTMLButtonElement | null = null;

    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      const li = doc.createElement("li");
      li.className = "pdf-merge-item";
      li.dataset.queueId = item.queueId;

      // Reorder buttons (up / down)
      const orderControls = doc.createElement("div");
      orderControls.className = "pdf-merge-item-reorder";

      const upBtn = doc.createElement("button");
      upBtn.type = "button";
      upBtn.className = "iconbtn pdf-item-up-btn";
      upBtn.title = "Siirrä ylemmäs";
      upBtn.setAttribute("aria-label", `Siirrä "${item.name}" ylemmäs`);
      upBtn.disabled = index === 0 || this.isProcessing;
      upBtn.appendChild(iconSvg("i-arrow-up", doc));
      upBtn.addEventListener("click", () => {
        if (index > 0) {
          const [moved] = this.items.splice(index, 1);
          this.items.splice(index - 1, 0, moved);
          this.announce(`"${item.name}" siirretty kohtaan ${index}/${this.items.length}.`);
          this.renderQueue({ focusTargetId: item.queueId, focusTargetAction: "up" });
        }
      });

      const downBtn = doc.createElement("button");
      downBtn.type = "button";
      downBtn.className = "iconbtn pdf-item-down-btn";
      downBtn.title = "Siirrä alemmas";
      downBtn.setAttribute("aria-label", `Siirrä "${item.name}" alemmas`);
      downBtn.disabled = index === this.items.length - 1 || this.isProcessing;
      downBtn.appendChild(iconSvg("i-arrow-down", doc));
      downBtn.addEventListener("click", () => {
        if (index < this.items.length - 1) {
          const [moved] = this.items.splice(index, 1);
          this.items.splice(index + 1, 0, moved);
          this.announce(`"${item.name}" siirretty kohtaan ${index + 2}/${this.items.length}.`);
          this.renderQueue({ focusTargetId: item.queueId, focusTargetAction: "down" });
        }
      });

      orderControls.appendChild(upBtn);
      orderControls.appendChild(downBtn);

      // Info: badge + title
      const infoWrap = doc.createElement("div");
      infoWrap.className = "pdf-merge-item-info";

      const badge = doc.createElement("span");
      if (item.type === "app") {
        badge.className = "pdf-item-badge badge-app";
        badge.textContent = "Asiakirja";
      } else {
        badge.className = "pdf-item-badge badge-ext";
        badge.textContent = `PDF (${item.pageCount} ${item.pageCount === 1 ? "sivu" : "sivua"})`;
      }

      const nameEl = doc.createElement("span");
      nameEl.className = "pdf-merge-item-name";
      nameEl.textContent = item.name;
      nameEl.title = item.name;

      infoWrap.appendChild(badge);
      infoWrap.appendChild(nameEl);

      // Remove button
      const removeBtn = doc.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "iconbtn pdf-item-remove-btn";
      removeBtn.title = `Poista ${item.name}`;
      removeBtn.setAttribute("aria-label", `Poista "${item.name}" listalta`);
      removeBtn.disabled = this.isProcessing;
      removeBtn.appendChild(iconSvg("i-close", doc));
      removeBtn.addEventListener("click", () => {
        this.items.splice(index, 1);
        this.announce(`"${item.name}" poistettu. Listassa on nyt ${this.items.length} tiedostoa.`);
        const nextTargetId = this.items[index]?.queueId ?? this.items[index - 1]?.queueId;
        this.renderQueue(nextTargetId ? { focusTargetId: nextTargetId, focusTargetAction: "remove" } : undefined);
      });

      li.appendChild(orderControls);
      li.appendChild(infoWrap);
      li.appendChild(removeBtn);

      if (focusTarget && focusTarget.focusTargetId === item.queueId) {
        if (focusTarget.focusTargetAction === "up") {
          targetButtonToFocus = upBtn.disabled ? downBtn : upBtn;
        } else if (focusTarget.focusTargetAction === "down") {
          targetButtonToFocus = downBtn.disabled ? upBtn : downBtn;
        } else {
          targetButtonToFocus = removeBtn;
        }
      }

      this.listEl!.appendChild(li);
    }

    if (focusTarget && targetButtonToFocus) {
      targetButtonToFocus.focus();
    }
  }

  private setBusy(busy: boolean, statusText = ""): void {
    this.isProcessing = busy;
    if (this.executeBtn) {
      this.executeBtn.disabled = busy || this.items.length === 0;
    }
    if (this.cancelBtn) {
      this.cancelBtn.disabled = busy;
    }
    if (this.closeBtn) {
      this.closeBtn.disabled = busy;
    }
    if (this.addDocBtn) {
      this.addDocBtn.disabled = busy;
    }
    if (this.uploadBtn) {
      this.uploadBtn.disabled = busy;
    }
    if (busy) {
      this.closeDocPopover();
    }
    if (this.statusEl) {
      this.statusEl.hidden = !busy;
    }
    if (this.statusTextEl) {
      this.statusTextEl.textContent = statusText;
    }
    if (statusText) {
      this.announce(statusText);
    }
    this.renderQueue();
  }

  async executeMerge(): Promise<void> {
    if (this.items.length === 0 || this.isProcessing) return;

    this.setBusy(true, "Valmistellaan yhdistämistä…");

    const sources: Array<{ id: string; name: string; bytes: Uint8Array }> = [];

    try {
      const total = this.items.length;

      for (let i = 0; i < total; i++) {
        const item = this.items[i];
        if (item.type === "app") {
          this.setBusy(true, `Käännetään asiakirjaa (${i + 1}/${total}): ${item.name}…`);
          let pdfBytes: Uint8Array | undefined;
          try {
            pdfBytes = await this.options.compileMarkdownToPdf(item.content, item.logo);
          } catch (err: any) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Asiakirjan "${item.name}" kääntäminen epäonnistui: ${msg}`);
          }
          if (!pdfBytes) {
            throw new Error(`Asiakirjan "${item.name}" kääntäminen PDF:ksi epäonnistui.`);
          }
          sources.push({
            id: item.queueId,
            name: item.name,
            bytes: pdfBytes,
          });
        } else {
          sources.push({
            id: item.queueId,
            name: item.name,
            bytes: item.bytes,
          });
        }
      }

      this.setBusy(true, "Yhdistetään PDF-tiedostoja…");
      const { mergePdfBytes, downloadPdfBlob } = await import("./pdf-merger.ts");

      let filename = this.filenameInput?.value.trim() || "yhdistetty-asiakirja.pdf";
      if (!filename.toLowerCase().endsWith(".pdf")) {
        filename += ".pdf";
      }

      const baseName = filename.replace(/\.pdf$/i, "");
      const mergedBytes = await mergePdfBytes(sources, {
        title: baseName,
        creator: "SFS 2487 Web Editor",
      });

      downloadPdfBlob(mergedBytes, filename);
      this.options.toast?.(`Yhdistetty PDF ladattu onnistuneesti (${filename}).`, "success");
      this.close();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      this.options.fail?.(msg);
    } finally {
      this.setBusy(false);
      const doc = this.dialog?.ownerDocument ?? (typeof document !== "undefined" ? document : null);
      if (
        this.isOpen() &&
        doc &&
        (!doc.activeElement || doc.activeElement === doc.body || !this.dialog?.contains(doc.activeElement))
      ) {
        this.executeBtn?.focus();
      }
    }
  }

  open(openerEl?: HTMLElement): void {
    if (!this.dialog) return;
    this.sessionCounter++;
    const doc = this.dialog?.ownerDocument ?? (typeof document !== "undefined" ? document : null);
    this.openerEl = openerEl ?? (doc?.getElementById("files-toggle") as HTMLElement | null) ?? null;

    // Reset items and pre-populate with active document
    const active = this.options.getActiveFile();
    const activeLogo = this.options.getActiveLogo?.();
    const queueId = `app-${active.id}-${Date.now()}`;

    this.items = [
      {
        queueId,
        type: "app",
        id: active.id,
        name: active.name,
        content: active.content,
        logo: activeLogo,
      },
    ];

    if (this.filenameInput) {
      const baseName = active.name.replace(/\.[^.]+$/, "") || "asiakirja";
      this.filenameInput.value = `${baseName}-yhdistetty.pdf`;
    }

    this.setBusy(false);
    this.closeDocPopover();
    this.renderQueue();

    if (typeof this.dialog.showModal === "function") {
      if (!this.dialog.open) {
        this.dialog.showModal();
      }
    } else {
      this.dialog.setAttribute("open", "");
    }

    this.executeBtn?.focus();
  }

  close(): void {
    if (!this.dialog) return;
    this.closeDocPopover();

    // Clean up memory
    this.items = [];
    this.renderQueue();

    if (typeof this.dialog.close === "function") {
      if (this.dialog.open) {
        this.dialog.close();
      }
    } else {
      this.dialog.removeAttribute("open");
    }

    // Restore focus to opener element
    if (this.openerEl && typeof this.openerEl.focus === "function") {
      this.openerEl.focus();
    }
  }

  isOpen(): boolean {
    return Boolean(this.dialog?.open);
  }

  getItems(): MergeQueueItem[] {
    return this.items;
  }
}
