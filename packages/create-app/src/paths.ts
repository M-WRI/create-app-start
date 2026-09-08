import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const createAppTemplatesKey = "CREATE_APP_TEMPLATES";

/** Walk upward until `templates/base` exists. */
export function resolveTemplatesRoot(startDir = here): string {
  const fromEnv = process.env[createAppTemplatesKey];
  if (fromEnv) {
    const resolved = resolve(fromEnv);
    if (existsSync(join(resolved, "base"))) {
      return resolved;
    }
    throw new Error(`CREATE_APP_TEMPLATES does not contain base/: ${resolved}`);
  }

  let current = resolve(startDir);
  for (let i = 0; i < 10; i += 1) {
    const candidate = join(current, "templates");
    if (existsSync(join(candidate, "base", "package.json"))) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Published / packed layout: package/dist → package/templates
  const bundled = join(here, "..", "templates");
  if (existsSync(join(bundled, "base", "package.json"))) {
    return bundled;
  }

  throw new Error("Could not find templates/. Run from the monorepo or set CREATE_APP_TEMPLATES.");
}
