export type Backend = "node" | "fastapi";
export type DeployPreference = "paas" | "docker-compose" | "ci-only";

export type GenerateOptions = {
  name: string;
  targetDir: string;
  backend: Backend;
  defaultLocale: string;
  extraLocales: string[];
  deploy: DeployPreference;
};

export function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function assertValidName(name: string): string {
  const kebab = toKebabCase(name);
  if (!kebab || !/^[a-z][a-z0-9-]*$/.test(kebab)) {
    throw new Error(
      `Invalid project name "${name}". Use a kebab-case name starting with a letter.`,
    );
  }
  return kebab;
}

export function parseLocalesList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}
