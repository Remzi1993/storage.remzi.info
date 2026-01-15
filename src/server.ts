import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

type ListedItem = {
    name: string;
    path: string;
    type: "dir" | "file";
    size: number | null;
    mtimeMs: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const REPO_ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");

const IGNORE_ROOT_NAMES = new Set([
    "index.html",
    "404.html",
    "main.ts",
    "main.js",
    "main.d.ts",
    "netlify.toml",
    "_headers",
    "_redirects",
    "vendor",
]);

function safeJoin(base: string, target: string): string {
    const normalized = path
        .normalize(target)
        .replace(/^(\.\.(\/|\\|$))+/, "")
        .replace(/^[/\\]+/, "");

    const resolved = path.join(base, normalized);

    if (!resolved.startsWith(base)) {
        throw new Error("Invalid path");
    }

    return resolved;
}

async function listDir(relative = ""): Promise<ListedItem[]> {
    const abs = safeJoin(PUBLIC_DIR, relative);
    const entries = await fs.readdir(abs, { withFileTypes: true });

    const items = await Promise.all(
        entries
            .filter((e) => e.name !== ".DS_Store")
            .filter((e) => (relative === "" ? !IGNORE_ROOT_NAMES.has(e.name) : true))
            .map(async (e) => {
                const rel = path.posix.join(relative.split(path.sep).join("/"), e.name);
                const absItem = safeJoin(PUBLIC_DIR, rel);
                const stat = await fs.stat(absItem);

                const type = (e.isDirectory() ? "dir" : "file") satisfies ListedItem["type"];

                return {
                    name: e.name,
                    path: rel,
                    type,
                    size: e.isDirectory() ? null : stat.size,
                    mtimeMs: stat.mtimeMs,
                } satisfies ListedItem;
            })
    );

    items.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return items;
}

if (!existsSync(PUBLIC_DIR)) {
    console.error(`Missing public folder: ${PUBLIC_DIR}`);
    process.exit(1);
}

// API (local)
app.get("/_api/list", async (req, res) => {
    try {
        const rel = typeof req.query.path === "string" ? req.query.path : "";
        const items = await listDir(rel);
        res.json({ baseUrl: "/", path: rel, items });
    } catch {
        res.status(400).json({ error: "Bad path" });
    }
});

// Static site
app.use("/", express.static(PUBLIC_DIR));

// 404 (last)
app.use((_req, res) => {
    res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
});

app.listen(PORT, () => {
    console.log(`UI:    http://localhost:${PORT}/`);
    console.log(`API:   http://localhost:${PORT}/_api/list`);
    console.log(`Asset: http://localhost:${PORT}/images/logo.png`);
});