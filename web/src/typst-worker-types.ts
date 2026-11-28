export interface WorkerLogo {
  path: string;
  bytes: Uint8Array;
}

export function mergeLogoPath(id: number | string, path?: string): string | undefined {
  if (!path) return undefined;
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1] ?? "png";
  return `/__merge_${id}_logo.${ext}`;
}

export type WorkerRequest =
  | { id: number; type: "init"; fontUrls?: string[] }
  | { id: number; type: "render"; md: string; logo?: WorkerLogo; fontUrls?: string[] }
  | { id: number; type: "pdf" }
  | { id: number; type: "compile_pdf"; md: string; logo?: WorkerLogo; fontUrls?: string[] };

export type WorkerResponse =
  | { id: number; type: "render_success"; svg: string }
  | { id: number; type: "render_error"; error: string; isConversionError?: boolean }
  | { id: number; type: "pdf_success"; pdf?: Uint8Array }
  | { id: number; type: "pdf_error"; error: string };
