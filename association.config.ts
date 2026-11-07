/**
 * Standalone organization configuration.
 *
 * Downstream deployments should replace the values and paths below. Paths are
 * relative to this file; templates are Markdown files and logos are SVG.
 */
export const config = {
  meta: {
    title: "Asiakirjat",
    subtitle: " – SFS 2487:2024",
    shortName: "Asiakirjat",
    description: "Selaimessa toimiva SFS 2487:2024 -asiakirjaeditori.",
    lang: "fi",
  },
  branding: {
    logoSvgPath: "assets/logo.svg",
    faviconPath: "assets/favicon.svg",
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
  },
  associationDetails: {
    name: "Suomen Palikkaharrastajat ry",
    businessId: "",
    addressLines: [],
    email: "palikkaharrastajatry@outlook.com",
    website: "https://palikkaharrastajat.fi",
  },
  templates: [
    {
      id: "hallitus-poytakirja",
      title: "Hallituksen pöytäkirja",
      description: "Yhdistyksen hallituksen kokouspöytäkirja.",
      doctype: "PÖYTÄKIRJA",
      filePath: "templates/hallitus-poytakirja.md",
      defaultFileName: "hallituksen-poytakirja.md",
      logoSvgPath: "assets/logo.svg",
    },
    {
      id: "syyskokous-kutsu",
      title: "Kokouskutsu ja esityslista",
      description: "Yhdistyksen kokouskutsu ja esityslista.",
      doctype: "KOKOUSKUTSU",
      filePath: "templates/syyskokous-kutsu.md",
      defaultFileName: "syyskokous-kutsu.md",
    },
    {
      id: "toimintakertomus",
      title: "Toimintakertomus",
      description: "Yhdistyksen vuoden toimintaa kuvaava raportti.",
      doctype: "TOIMINTAKERTOMUS",
      filePath: "templates/toimintakertomus.md",
      defaultFileName: "toimintakertomus.md",
    },
    {
      id: "muistio",
      title: "Muistio",
      description: "Ytimekäs muistio tai sisäinen tiedote.",
      doctype: "MUISTIO",
      filePath: "templates/muistio.md",
      defaultFileName: "muistio.md",
    },
  ],
} as const;
