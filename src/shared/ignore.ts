export const IGNORE_ROOT_NAMES = new Set<string>([
    "vendor",
    "404.html",
    "index.html",
    "main.ts",
    "main.js",
    "main.d.ts",
    "netlify.toml",
    "_headers",
    "_redirects",
    "_meta.json",
] as const);