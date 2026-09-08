import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Recursively prefix string leaves for locale stubs. */
export function stubLocaleTree(value: unknown, locale: string): unknown {
  if (typeof value === "string") {
    return `[${locale}] ${value}`;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stubLocaleTree(item, locale));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = stubLocaleTree(child, locale);
    }
    return out;
  }
  return value;
}

export function loadEnCatalogFromTs(enTsPath: string): Record<string, unknown> {
  const source = readFileSync(enTsPath, "utf8");
  const match = source.match(/export const en = (\{[\s\S]*\}) as const;/);
  if (!match?.[1]) {
    throw new Error(`Could not parse en locale catalog at ${enTsPath}`);
  }
  // Object literal from our catalog is plain JS-compatible.
  return new Function(`return (${match[1]})`)() as Record<string, unknown>;
}

function formatLocaleModule(locale: string, tree: unknown): string {
  return `export const ${locale} = ${JSON.stringify(tree, null, 2)} as const;\n`;
}

export function writeLocaleStubs(options: {
  i18nLocalesDir: string;
  defaultLocale: string;
  extraLocales: string[];
}): void {
  const defaultLocale = options.defaultLocale.toLowerCase();
  const enCatalog = loadEnCatalogFromTs(join(options.i18nLocalesDir, "en.ts"));

  const extras = [
    ...new Set(
      options.extraLocales
        .map((l) => l.toLowerCase())
        .filter((l) => l && l !== "en"),
    ),
  ];

  if (defaultLocale !== "en" && !extras.includes(defaultLocale)) {
    extras.unshift(defaultLocale);
  }

  mkdirSync(options.i18nLocalesDir, { recursive: true });

  for (const locale of extras) {
    const tree = stubLocaleTree(enCatalog, locale);
    writeFileSync(join(options.i18nLocalesDir, `${locale}.ts`), formatLocaleModule(locale, tree));
  }

  const allLocales = ["en", ...extras.filter((l) => l !== "en")];
  const imports = allLocales
    .map((locale) => `import { ${locale} } from "./${locale}.js";`)
    .join("\n");
  const resources = allLocales
    .map((locale) => `  ${locale}: { translation: ${locale} },`)
    .join("\n");

  const resolvedDefault = allLocales.includes(defaultLocale) ? defaultLocale : "en";

  const index = `${imports}

export const localeResources = {
${resources}
} as const;

export const DEFAULT_LOCALE = ${JSON.stringify(resolvedDefault)} as const;
export type SupportedLocale = keyof typeof localeResources;
`;

  writeFileSync(join(options.i18nLocalesDir, "index.ts"), index);
}
