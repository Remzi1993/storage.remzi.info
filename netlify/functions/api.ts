import express from "express";
import serverless from "serverless-http";
import path from "node:path";
import fs from "node:fs/promises";

type ListedItem = {
    name: string;
    path: string;
    type: "dir" | "file";
    size: number | null;
    mtimeMs: number;
};

const api = express();

const PUBLISH_DIR = path.join(process.cwd(), "public");

const IGNORE_ROOT_NAMES = new Set([
    "index.html",
    "404.html",
    "main.ts",
    "main.js",
    "styles.css",
    "netlify.toml",
    "_headers",
    "_redirects",
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
    const abs = safeJoin(PUBLISH_DIR, relative);
    const entries = await fs.readdir(abs, { withFileTypes: true });

    const items = await Promise.all(
        entries
            .filter((e) => e.name !== ".DS_Store")
            .filter((e) => (relative === "" ? !IGNORE_ROOT_NAMES.has(e.name) : true))
            .map(async (e) => {
                const rel = path.posix.join(relative.split(path.sep).join("/"), e.name);
                const absItem = safeJoin(PUBLISH_DIR, rel);
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

/**
 * GET /_api/list?path=docs
 * Rewrite sends this to /.netlify/functions/api/list?path=docs
 * So the Express route is just "/list".
 */
api.get("/list", async (req, res) => {
    try {
        const rel = typeof req.query.path === "string" ? req.query.path : "";
        const items = await listDir(rel);
        res.json({ baseUrl: "/", path: rel, items });
    } catch {
        res.status(400).json({ error: "Bad path" });
    }
});

export const handler = serverless(api);