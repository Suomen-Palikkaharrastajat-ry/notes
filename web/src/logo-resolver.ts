export interface ResolvedLogo {
  path: string;
  name?: string;
  bytes: Uint8Array;
}

export interface ResolveEffectiveLogoParams {
  fileId: string;
  activeFileId: string;
  isLogoCleared: boolean;
  uploadedLogo?: ResolvedLogo;
  activeTemplateLogo?: ResolvedLogo;
  getStoredTemplateLogo?: (fileId: string) => ResolvedLogo | undefined;
  defaultLogo?: ResolvedLogo;
}

/**
 * Resolves the effective logo for any document (active or background).
 * Precedence:
 * 1. Explicitly cleared by user -> undefined
 * 2. User-uploaded logo (global across all documents)
 * 3. Per-document template logo (active in-memory or stored in localStorage)
 * 4. Association default branding logo
 */
export function resolveEffectiveLogo(params: ResolveEffectiveLogoParams): ResolvedLogo | undefined {
  if (params.isLogoCleared) {
    return undefined;
  }
  if (params.uploadedLogo) {
    return params.uploadedLogo;
  }
  if (params.fileId === params.activeFileId) {
    if (params.activeTemplateLogo) {
      return params.activeTemplateLogo;
    }
  } else if (params.getStoredTemplateLogo) {
    const stored = params.getStoredTemplateLogo(params.fileId);
    if (stored) {
      return stored;
    }
  }
  if (params.defaultLogo) {
    return params.defaultLogo;
  }
  return undefined;
}
