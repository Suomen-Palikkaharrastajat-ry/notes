/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Base URL of the signaling Worker (see signaling/). Empty disables sharing.
  readonly VITE_SIGNALING_URL?: string;
  // Base URL of the collaborative editing service (see signaling/). Falls back to VITE_SIGNALING_URL.
  readonly VITE_COLLAB_URL?: string;
}

declare const __ORGANIZATION_CONFIG__: {
  meta: {
    title: string;
    subtitle: string;
    shortName: string;
    description: string;
    lang: string;
  };
  branding: {
    themeColor?: string;
    colors?: import("./branding.ts").BrandColors;
    defaultLogo?: import("./branding.ts").BundledLogo;
    faviconDataUrl?: string;
  };
  templates: import("./templates.ts").DocumentTemplate[];
};

declare module "markdown-it-deflist" {
  import type MarkdownIt from "markdown-it";
  const plugin: (md: MarkdownIt) => void;
  export default plugin;
}

declare module "markdown-it-footnote" {
  import type MarkdownIt from "markdown-it";
  const plugin: (md: MarkdownIt) => void;
  export default plugin;
}
