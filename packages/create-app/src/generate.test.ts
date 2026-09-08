import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateApp } from "./generate.js";
import {
  localeToIdentifier,
  normalizeLocaleTag,
  stubLocaleTree,
  validateLocales,
} from "./locales.js";
import { assertValidName, parseLocalesList } from "./options.js";
import { resolveTemplatesRoot } from "./paths.js";

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("options", () => {
  it("normalizes names and locales", () => {
    expect(assertValidName("My App")).toBe("my-app");
    expect(parseLocalesList("de, fr")).toEqual(["de", "fr"]);
    expect(() => assertValidName("123")).toThrow();
  });
});

describe("locales", () => {
  it("prefixes string leaves", () => {
    expect(stubLocaleTree({ a: "Hi", nested: { b: "Bye" } }, "de")).toEqual({
      a: "[de] Hi",
      nested: { b: "[de] Bye" },
    });
  });

  it("maps BCP-47 tags to safe TS identifiers", () => {
    expect(localeToIdentifier("pt-BR")).toBe("locale_pt_BR");
    expect(localeToIdentifier("de")).toBe("locale_de");
    expect(localeToIdentifier("zh-Hant-TW")).toBe("locale_zh_Hant_TW");
    expect(() => localeToIdentifier("123")).toThrow();
  });

  it("normalizes and validates BCP-47-like tags", () => {
    expect(normalizeLocaleTag("pt-br")).toBe("pt-BR");
    expect(normalizeLocaleTag("zh-hant-tw")).toBe("zh-Hant-TW");
    expect(normalizeLocaleTag("en")).toBe("en");
    expect(validateLocales(["de", "de", "DE", "fr"])).toEqual(["de", "fr"]);
  });

  it("rejects unsafe or malformed locale tags", () => {
    for (const bad of ["../evil", "foo/bar", `'"`, "", " ", "en us", "123", "toolongtag", "a"]) {
      expect(() => normalizeLocaleTag(bad), bad).toThrow(/Invalid locale/);
    }
  });
});

describe("generateApp", () => {
  it("scaffolds a node app from templates", () => {
    const templatesRoot = resolveTemplatesRoot();
    const parent = mkdtempSync(join(tmpdir(), "create-app-"));
    temps.push(parent);
    const targetDir = join(parent, "demo-app");

    const result = generateApp(
      {
        name: "demo-app",
        targetDir,
        backend: "node",
        defaultLocale: "en",
        extraLocales: ["de"],
        deploy: "paas",
      },
      templatesRoot,
    );

    expect(result.targetDir).toBe(targetDir);
    expect(existsSync(join(targetDir, "apps", "web", "package.json"))).toBe(true);
    expect(existsSync(join(targetDir, "apps", "api", "package.json"))).toBe(true);
    expect(existsSync(join(targetDir, "apps", "api-python"))).toBe(false);
    expect(existsSync(join(targetDir, "packages", "i18n", "src", "locales", "de.ts"))).toBe(true);
    expect(existsSync(join(targetDir, ".env.example"))).toBe(true);
    expect(existsSync(join(targetDir, ".asa-scaffold.json"))).toBe(true);

    const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf8")) as {
      name: string;
      scripts: Record<string, string>;
    };
    expect(pkg.name).toBe("demo-app");
    expect(pkg.scripts["templates:sync"]).toBeUndefined();
    expect(pkg.scripts["create-app"]).toBeUndefined();
    expect(pkg.scripts["check:contracts"]).not.toContain("api-python");

    const ci = readFileSync(join(targetDir, ".github", "workflows", "ci.yml"), "utf8");
    expect(ci).not.toContain("generator:");
    expect(ci).not.toContain("templates:check");
    expect(ci).not.toContain("python-api:");

    const index = readFileSync(
      join(targetDir, "packages", "i18n", "src", "locales", "index.ts"),
      "utf8",
    );
    expect(index).toContain('import { locale_de } from "./de.js"');
    expect(index).toContain('DEFAULT_LOCALE = "en"');

    const agents = readFileSync(join(targetDir, "AGENTS.md"), "utf8");
    expect(agents).not.toContain("templates:sync");
    expect(agents).toContain("generated app");
    expect(agents).toContain("single track");
    expect(agents).toContain("apps/api");
    expect(agents).not.toContain("dual-backend");
    expect(agents).not.toContain("both `apps/api`");

    const backendRule = readFileSync(join(targetDir, ".cursor", "rules", "backend.mdc"), "utf8");
    expect(backendRule).toContain("apps/api");
    expect(backendRule).toContain("one** API track");
    expect(backendRule).not.toContain("apps/api-python");
    expect(backendRule).not.toContain("Dual backends");
    expect(backendRule).toMatch(/globs: apps\/api\/\*\*\/\*\.\{ts,js\}/);
  });

  it("scaffolds pt-BR locale with a valid identifier", () => {
    const templatesRoot = resolveTemplatesRoot();
    const parent = mkdtempSync(join(tmpdir(), "create-app-"));
    temps.push(parent);
    const targetDir = join(parent, "pt-app");

    generateApp(
      {
        name: "pt-app",
        targetDir,
        backend: "node",
        defaultLocale: "en",
        extraLocales: ["pt-BR"],
        deploy: "paas",
      },
      templatesRoot,
    );

    const index = readFileSync(
      join(targetDir, "packages", "i18n", "src", "locales", "index.ts"),
      "utf8",
    );
    expect(index).toContain('import { locale_pt_BR } from "./pt-BR.js"');
    expect(index).toContain('"pt-BR": { translation: locale_pt_BR }');
    expect(existsSync(join(targetDir, "packages", "i18n", "src", "locales", "pt-BR.ts"))).toBe(
      true,
    );
    const module = readFileSync(
      join(targetDir, "packages", "i18n", "src", "locales", "pt-BR.ts"),
      "utf8",
    );
    expect(module).toContain("export const locale_pt_BR =");
  });

  it("scaffolds zh-Hant-TW locale", () => {
    const templatesRoot = resolveTemplatesRoot();
    const parent = mkdtempSync(join(tmpdir(), "create-app-"));
    temps.push(parent);
    const targetDir = join(parent, "zh-app");

    generateApp(
      {
        name: "zh-app",
        targetDir,
        backend: "node",
        defaultLocale: "en",
        extraLocales: ["zh-Hant-TW"],
        deploy: "paas",
      },
      templatesRoot,
    );

    const index = readFileSync(
      join(targetDir, "packages", "i18n", "src", "locales", "index.ts"),
      "utf8",
    );
    expect(index).toContain('import { locale_zh_Hant_TW } from "./zh-Hant-TW.js"');
    expect(index).toContain('"zh-Hant-TW": { translation: locale_zh_Hant_TW }');
    expect(existsSync(join(targetDir, "packages", "i18n", "src", "locales", "zh-Hant-TW.ts"))).toBe(
      true,
    );
  });

  it("collapses duplicate locales", () => {
    const templatesRoot = resolveTemplatesRoot();
    const parent = mkdtempSync(join(tmpdir(), "create-app-"));
    temps.push(parent);
    const targetDir = join(parent, "dup-app");

    generateApp(
      {
        name: "dup-app",
        targetDir,
        backend: "node",
        defaultLocale: "en",
        extraLocales: ["de", "DE", "de"],
        deploy: "paas",
      },
      templatesRoot,
    );

    const localesDir = join(targetDir, "packages", "i18n", "src", "locales");
    const localeFiles = readdirSync(localesDir).filter(
      (f) => f.endsWith(".ts") && f !== "index.ts",
    );
    expect(localeFiles.filter((f) => f.toLowerCase() === "de.ts")).toHaveLength(1);

    const index = readFileSync(join(localesDir, "index.ts"), "utf8");
    const deImports = index.match(/locale_de/g) ?? [];
    // one import + one resource reference
    expect(deImports.length).toBe(2);
  });

  it("rejects traversal and junk locales before writing anything", () => {
    const templatesRoot = resolveTemplatesRoot();
    const parent = mkdtempSync(join(tmpdir(), "create-app-"));
    temps.push(parent);
    const before = new Set(readdirSync(parent));

    for (const bad of ["../evil", "foo/bar", `'"`, "", "en/../x"]) {
      const targetDir = join(parent, `bad-${bad.replace(/[^a-z0-9]/gi, "_") || "empty"}`);
      expect(() =>
        generateApp(
          {
            name: "bad-app",
            targetDir,
            backend: "node",
            defaultLocale: "en",
            extraLocales: [bad],
            deploy: "paas",
          },
          templatesRoot,
        ),
      ).toThrow(/Invalid locale/);
      expect(existsSync(targetDir)).toBe(false);
    }

    const after = readdirSync(parent);
    expect(after).toEqual([...before]);
  });

  it("scaffolds a fastapi app", () => {
    const templatesRoot = resolveTemplatesRoot();
    const parent = mkdtempSync(join(tmpdir(), "create-app-"));
    temps.push(parent);
    const targetDir = join(parent, "py-app");

    generateApp(
      {
        name: "py-app",
        targetDir,
        backend: "fastapi",
        defaultLocale: "en",
        extraLocales: [],
        deploy: "ci-only",
      },
      templatesRoot,
    );

    expect(existsSync(join(targetDir, "apps", "api-python", "pyproject.toml"))).toBe(true);
    expect(existsSync(join(targetDir, "apps", "api"))).toBe(false);
    const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["check:contracts"]).toContain("api-python");

    const ci = readFileSync(join(targetDir, ".github", "workflows", "ci.yml"), "utf8");
    expect(ci).not.toContain("generator:");
    expect(ci).toContain("python-api:");

    const agents = readFileSync(join(targetDir, "AGENTS.md"), "utf8");
    expect(agents).toContain("single track");
    expect(agents).toContain("apps/api-python");
    expect(agents).not.toContain("dual-backend");

    const backendRule = readFileSync(join(targetDir, ".cursor", "rules", "backend.mdc"), "utf8");
    expect(backendRule).toContain("apps/api-python");
    expect(backendRule).toContain("one** API track");
    expect(backendRule).not.toContain("apps/api/**");
    expect(backendRule).not.toContain("Dual backends");
    expect(backendRule).toMatch(/globs: apps\/api-python\/\*\*\/\*\.py/);
  });
});
