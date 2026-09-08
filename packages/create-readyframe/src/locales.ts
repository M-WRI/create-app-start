import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

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

const LANGUAGE_RE = /^[A-Za-z]{2,3}$/;
const SCRIPT_RE = /^[A-Za-z]{4}$/;
const REGION_RE = /^([A-Za-z]{2}|[0-9]{3})$/;

function assertNoUnsafeLocaleChars(locale: string): void {
  if (!locale || !locale.trim()) {
    throw new Error(`Invalid locale: ${locale}`);
  }
  if (/[/\\]/.test(locale) || locale.includes("..") || /["'\s]/.test(locale)) {
    throw new Error(`Invalid locale: ${locale}`);
  }
}

function titleCaseScript(script: string): string {
  return script.charAt(0).toUpperCase() + script.slice(1).toLowerCase();
}

/**
 * Normalize well-formed BCP-47-like tags:
 * language (2–3 alpha), optional script (4 alpha), optional region (2 alpha | 3 digit).
 * Examples: `en`, `pt-BR`, `zh-Hant-TW`.
 */
export function normalizeLocaleTag(locale: string): string {
  assertNoUnsafeLocaleChars(locale);

  const parts = locale.trim().split(/[-_]/).filter(Boolean);
  if (parts.length === 0 || parts.length > 3) {
    throw new Error(`Invalid locale: ${locale}`);
  }

  const language = parts[0];
  if (!language || !LANGUAGE_RE.test(language)) {
    throw new Error(`Invalid locale: ${locale}`);
  }

  const normalized: string[] = [language.toLowerCase()];

  if (parts.length === 2) {
    const second = parts[1];
    if (!second) {
      throw new Error(`Invalid locale: ${locale}`);
    }
    if (SCRIPT_RE.test(second)) {
      normalized.push(titleCaseScript(second));
    } else if (REGION_RE.test(second)) {
      normalized.push(/^[0-9]{3}$/.test(second) ? second : second.toUpperCase());
    } else {
      throw new Error(`Invalid locale: ${locale}`);
    }
  } else if (parts.length === 3) {
    const script = parts[1];
    const region = parts[2];
    if (!script || !SCRIPT_RE.test(script) || !region || !REGION_RE.test(region)) {
      throw new Error(`Invalid locale: ${locale}`);
    }
    normalized.push(titleCaseScript(script));
    normalized.push(/^[0-9]{3}$/.test(region) ? region : region.toUpperCase());
  }

  return normalized.join("-");
}

/** Map BCP-47-like tags to safe TS identifiers (`pt-BR` → `locale_pt_BR`). */
export function localeToIdentifier(locale: string): string {
  const normalized = normalizeLocaleTag(locale);
  const sanitized = normalized.replace(/-/g, "_").replace(/[^A-Za-z0-9_]/g, "_");
  return `locale_${sanitized}`;
}

/** Validate and normalize a list of locale tags (deduped, order preserved). */
export function validateLocales(locales: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const locale of locales) {
    const normalized = normalizeLocaleTag(locale);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/** Ensure a resolved path stays under `rootDir` (no traversal). */
export function assertPathInsideDir(rootDir: string, candidatePath: string): string {
  const root = resolve(rootDir);
  const resolved = resolve(candidatePath);
  const rel = relative(root, resolved);
  if (rel.startsWith(`..${sep}`) || rel === ".." || rel.split(sep).includes("..")) {
    throw new Error(`Path escapes locale directory: ${candidatePath}`);
  }
  if (!resolved.startsWith(root + sep) && resolved !== root) {
    throw new Error(`Path escapes locale directory: ${candidatePath}`);
  }
  return resolved;
}

function formatLocaleModule(locale: string, tree: unknown): string {
  const ident = localeToIdentifier(locale);
  return `export const ${ident} = ${JSON.stringify(tree, null, 2)} as const;\n`;
}

export function writeLocaleStubs(options: {
  i18nLocalesDir: string;
  defaultLocale: string;
  extraLocales: string[];
}): void {
  // Validate ALL locales before any mkdir/write
  const defaultLocale = normalizeLocaleTag(options.defaultLocale);
  const extras = validateLocales(options.extraLocales).filter((l) => l !== "en");

  if (defaultLocale !== "en" && !extras.includes(defaultLocale)) {
    extras.unshift(defaultLocale);
  }

  // Re-check the final set (includes default when non-en)
  validateLocales([defaultLocale, ...extras]);

  const i18nLocalesDir = resolve(options.i18nLocalesDir);
  const localeFiles = extras.map((locale) =>
    assertPathInsideDir(i18nLocalesDir, join(i18nLocalesDir, `${locale}.ts`)),
  );
  const indexPath = assertPathInsideDir(i18nLocalesDir, join(i18nLocalesDir, "index.ts"));

  const enCatalog = loadEnCatalogFromTs(join(i18nLocalesDir, "en.ts"));

  mkdirSync(i18nLocalesDir, { recursive: true });

  for (let i = 0; i < extras.length; i += 1) {
    const locale = extras[i];
    const localeFile = localeFiles[i];
    if (!locale || !localeFile) {
      throw new Error("Locale stub generation failed: mismatched locale/file lists");
    }
    const tree = stubLocaleTree(enCatalog, locale);
    writeFileSync(localeFile, formatLocaleModule(locale, tree));
  }

  const allLocales = ["en", ...extras.filter((l) => l !== "en")];
  const imports = allLocales
    .map((locale) => {
      const ident = localeToIdentifier(locale);
      // Template ships `export const en`; alias so identifiers stay uniformly prefixed.
      if (locale === "en") {
        return `import { en as ${ident} } from "./en.js";`;
      }
      return `import { ${ident} } from "./${locale}.js";`;
    })
    .join("\n");
  const resources = allLocales
    .map((locale) => {
      const ident = localeToIdentifier(locale);
      return `  ${JSON.stringify(locale)}: { translation: ${ident} },`;
    })
    .join("\n");

  const resolvedDefault = allLocales.includes(defaultLocale) ? defaultLocale : "en";

  const index = `${imports}

export const localeResources = {
${resources}
} as const;

export const DEFAULT_LOCALE = ${JSON.stringify(resolvedDefault)} as const;
export type SupportedLocale = keyof typeof localeResources;
`;

  writeFileSync(indexPath, index);
}
