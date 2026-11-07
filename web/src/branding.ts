// Branding and white-labeling configuration for the SFS 2487 web editor.
// Supports custom colors, header title/subtitle, favicon, meta theme-color,
// and association SVG logo.

export interface BrandColors {
  headerBg?: string;
  headerText?: string;
  statusbarBg?: string;
  statusbarBorder?: string;
  controlBorder?: string;
  accent?: string;
  focusOutline?: string;
  focusOutlineOnDark?: string;
  controlActiveBg?: string;
  previewBackdrop?: string;
  panelBg?: string;
}

export interface BundledLogo {
  path: string;
  name: string;
  svgText: string;
}

export interface BrandingConfig {
  title?: string;
  subtitle?: string;
  shortName?: string;
  themeColor?: string;
  colors?: BrandColors;
  defaultLogo?: BundledLogo;
  faviconDataUrl?: string;
}

export interface OrganizationConfig {
  meta: {
    title: string;
    subtitle: string;
    shortName: string;
    description: string;
    lang: string;
  };
  branding: BrandingConfig & { colors?: BrandColors };
  templates: unknown[];
}

// Default vector SVG logo for standard documents (Organisaatio Oy).
export const DEFAULT_ASSOCIATION_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 50" width="240" height="50">
  <g transform="translate(9 7)">
    <rect width="36" height="36" rx="9" fill="#FAC80A" />
    <path d="M12 10h13l6 6v11a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z" fill="#05131D" />
    <path d="M24 10v7h7M14 22h11M14 26h8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    <text x="48" y="27" font-family="Outfit, system-ui, sans-serif" font-size="18" font-weight="700" fill="#05131D">Asiakirjat</text>
  </g>
</svg>`;

export const DEFAULT_BRANDING: BrandingConfig = {
  title: "Asiakirjat",
  subtitle: " – SFS 2487:2024",
  shortName: "Asiakirjat",
  themeColor: "#05131D",
  colors: {
    headerBg: "#05131D",
    headerText: "#FFFFFF",
    statusbarBg: "#05131D",
    statusbarBorder: "#334155",
    controlBorder: "#6B7280",
    accent: "#FAC80A",
    focusOutline: "#05131D",
    focusOutlineOnDark: "#FAC80A",
    controlActiveBg: "#334155",
    previewBackdrop: "#F3F4F6",
    panelBg: "#05131D",
  },
  defaultLogo: {
    path: "/association-logo.svg",
    name: "Asiakirjat (logo.svg)",
    svgText: DEFAULT_ASSOCIATION_LOGO_SVG,
  },
};

function getOrganizationConfig(): OrganizationConfig | undefined {
  if (typeof window !== "undefined" && (window as any).__ASSOCIATION_CONFIG__?.meta) {
    return (window as any).__ASSOCIATION_CONFIG__ as OrganizationConfig;
  }
  if (typeof __ORGANIZATION_CONFIG__ !== "undefined") {
    return __ORGANIZATION_CONFIG__ as OrganizationConfig;
  }
  return undefined;
}

/**
 * Returns the active branding configuration, allowing overrides from
 * the build-time config derived from association.config.ts. Tests and embeds may
 * override it with window.__ASSOCIATION_CONFIG__.
 */
export function getActiveBranding(): BrandingConfig {
  if (typeof window !== "undefined" && (window as any).__ASSOCIATION_CONFIG__) {
    const custom = (window as any).__ASSOCIATION_CONFIG__ as Partial<BrandingConfig> & { branding?: BrandingConfig; meta?: OrganizationConfig["meta"] };
    if (custom.branding) {
      const nested = custom as unknown as OrganizationConfig;
      return {
        ...DEFAULT_BRANDING,
        ...nested.branding,
        title: nested.meta?.title ?? DEFAULT_BRANDING.title,
        subtitle: nested.meta?.subtitle ?? DEFAULT_BRANDING.subtitle,
        shortName: nested.meta?.shortName ?? DEFAULT_BRANDING.shortName,
        colors: { ...DEFAULT_BRANDING.colors, ...nested.branding.colors },
      };
    }
    return {
      title: custom.title ?? DEFAULT_BRANDING.title,
      subtitle: custom.subtitle ?? DEFAULT_BRANDING.subtitle,
      shortName: custom.shortName ?? DEFAULT_BRANDING.shortName,
      themeColor: custom.themeColor ?? DEFAULT_BRANDING.themeColor,
      colors: {
        ...DEFAULT_BRANDING.colors,
        ...custom.colors,
      },
      defaultLogo: custom.defaultLogo ?? DEFAULT_BRANDING.defaultLogo,
    };
  }
  const organization = getOrganizationConfig();
  if (organization) {
    return {
      ...DEFAULT_BRANDING,
      ...organization.branding,
      title: organization.meta.title,
      subtitle: organization.meta.subtitle,
      shortName: organization.meta.shortName,
      colors: { ...DEFAULT_BRANDING.colors, ...organization.branding.colors },
    };
  }
  return DEFAULT_BRANDING;
}

/**
 * Applies branding colors to CSS custom properties and updates DOM title/meta tags.
 */
export function applyBranding(branding: BrandingConfig = getActiveBranding()): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const colors = branding.colors || {};

  if (colors.headerBg) root.style.setProperty("--brand-header-bg", colors.headerBg);
  if (colors.headerText) root.style.setProperty("--brand-header-text", colors.headerText);
  if (colors.statusbarBg) root.style.setProperty("--brand-statusbar-bg", colors.statusbarBg);
  if (colors.statusbarBorder) root.style.setProperty("--brand-statusbar-border", colors.statusbarBorder);
  if (colors.controlBorder) root.style.setProperty("--brand-control-border", colors.controlBorder);
  if (colors.accent) root.style.setProperty("--brand-accent", colors.accent);
  if (colors.focusOutline) root.style.setProperty("--brand-focus-outline", colors.focusOutline);
  if (colors.focusOutlineOnDark) root.style.setProperty("--brand-focus-dark", colors.focusOutlineOnDark);
  if (colors.controlActiveBg) root.style.setProperty("--brand-control-active-bg", colors.controlActiveBg);
  if (colors.previewBackdrop) root.style.setProperty("--brand-preview-bg", colors.previewBackdrop);
  if (colors.panelBg) root.style.setProperty("--brand-panel-bg", colors.panelBg);

  if (branding.themeColor) {
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement("meta");
      metaTheme.setAttribute("name", "theme-color");
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute("content", branding.themeColor);
  }

  // Update header DOM elements
  const brandTitleEl = document.getElementById("brand-title");
  if (brandTitleEl && branding.title) {
    brandTitleEl.textContent = branding.title;
  }
  const brandSubtitleEl = document.getElementById("brand-subtitle");
  if (brandSubtitleEl && branding.subtitle !== undefined) {
    brandSubtitleEl.textContent = branding.subtitle;
  }

  if (branding.title) {
    document.title = `${branding.title}${branding.subtitle ? ` – ${branding.subtitle.replace(/^[–\- ]+/, "")}` : ""}`;
  }

  const organization = getOrganizationConfig();
  if (organization) {
    document.documentElement.lang = organization.meta.lang;
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", organization.meta.description);
    const mobileTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    mobileTitle?.setAttribute("content", organization.meta.shortName);
  }
  if (branding.faviconDataUrl) {
    document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute("href", branding.faviconDataUrl);
  }
}
