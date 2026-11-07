import { defineConfig } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as associationConfig } from "../association.config.ts";

const webDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(webDir, "..");

function readRepoFile(path: string): string {
  const absolutePath = resolve(repoDir, path);
  const rel = relative(repoDir, absolutePath);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error(`Organization asset must be inside the repository: ${path}`);
  }
  return readFileSync(absolutePath, "utf8");
}

function organizationConfig() {
  const association = associationConfig.associationDetails;
  const logoSvg = readRepoFile(associationConfig.branding.logoSvgPath);
  const faviconSvg = readRepoFile(associationConfig.branding.faviconPath);
  const templateData = associationConfig.templates.map((template) => ({
    id: template.id,
    title: template.title,
    description: template.description,
    doctype: template.doctype,
    defaultFileName: template.defaultFileName,
    content: readRepoFile(template.filePath).replace(/\{\{association\.([a-zA-Z]+)\}\}/g, (_match, key: string) => {
      const value = association[key as keyof typeof association];
      return Array.isArray(value) ? value.join(", ") : String(value ?? "");
    }),
    logoSvg: "logoSvgPath" in template && template.logoSvgPath
      ? readRepoFile(template.logoSvgPath)
      : undefined,
  }));

  return {
    meta: associationConfig.meta,
    branding: {
      ...associationConfig.branding,
      defaultLogo: {
        path: "/association-logo.svg",
        name: `${association.name} (logo.svg)`,
        svgText: logoSvg,
      },
      faviconDataUrl: `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`,
    },
    templates: templateData,
  };
}

function brandedManifestPlugin(organization: ReturnType<typeof organizationConfig>) {
  let manifestPath: string | undefined;
  return {
    name: "organization-web-manifest",
    configResolved(config: { command: string; build: { outDir: string } }) {
      if (config.command === "build") {
        manifestPath = resolve(config.build.outDir, "manifest.webmanifest");
      }
    },
    closeBundle() {
      if (!manifestPath) return;
      const manifest = JSON.parse(readFileSync(resolve(webDir, "public/manifest.webmanifest"), "utf8"));
      manifest.name = `${organization.meta.title}${organization.meta.subtitle ?? ""}`;
      manifest.short_name = organization.meta.shortName;
      manifest.description = organization.meta.description;
      manifest.lang = organization.meta.lang;
      manifest.theme_color = organization.branding.themeColor;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    },
  };
}

// Served under a subpath on GitHub Pages (next to the mkdocs site); BASE_URL
// drives the font URLs in src/main.ts. Override with `vite build --base=/…/`.
const bundledOrganization = organizationConfig();

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [brandedManifestPlugin(bundledOrganization)],
  define: {
    __ORGANIZATION_CONFIG__: JSON.stringify(bundledOrganization),
  },
  build: {
    target: "es2022",
    // The Typst compiler WASM is large; this is expected for the prototype.
    chunkSizeWarningLimit: 30000,
  },
  worker: {
    format: "es",
  },
});
