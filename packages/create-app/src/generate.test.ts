import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateApp } from "./generate.js";
import { stubLocaleTree } from "./locales.js";
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
    expect(index).toContain('import { de } from "./de.js"');
    expect(index).toContain('DEFAULT_LOCALE = "en"');
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
  });
});
