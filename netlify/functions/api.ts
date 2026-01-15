import express, { Router } from "express";
import serverless from "serverless-http";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

type ListedItem = {
    name: string;
    path: string;
    type: "dir" | "file";
    size: number | null;
    mtimeMs: number;
};

const api = express();
const router = Router();

const IGNORE_ROOT_NAMES = new Set([
    "index.html",
    "404.html",
    "main.ts",
    "main.js",
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

async function isDir(p: string): Promise<boolean> {
    try {
        return (await fs.stat(p)).isDirectory();
    } catch {
        return false;
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resolvePublishDir(): Promise<string> {
    const candidates = [
        path.join(process.cwd(), "public"),
        path.join(__dirname, "..", "..", "..", "public"),
        path.join(__dirname, "..", "..", "public"),
        path.join(__dirname, "..", "public"),
    ];

    for (const candidate of candidates) {
        if (await isDir(candidate)) return candidate;
    }

    throw new Error(`Publish dir not found. Tried: ${candidates.join(" | ")}`);
}

async function listDir(publishDir: string, relative = ""): Promise<ListedItem[]> {
    const abs = safeJoin(publishDir, relative);
    const entries = await fs.readdir(abs, { withFileTypes: true });

    const items = await Promise.all(
        entries
            .filter((e) => e.name !== ".DS_Store")
            .filter((e) => (relative === "" ? !IGNORE_ROOT_NAMES.has(e.name) : true))
            .map(async (e) => {
                const rel = path.posix.join(relative.split(path.sep).join("/"), e.name);
                const absItem = safeJoin(publishDir, rel);
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

router.get("/list", async (req, res) => {
    try {
        const publishDir = await resolvePublishDir();
        const rel = typeof req.query.path === "string" ? req.query.path : "";
        const items = await listDir(publishDir, rel);
        res.json({ baseUrl: "/", path: rel, items });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
});

router.get("/_debug", async (_req, res) => {
    try {
        const publishDir = await resolvePublishDir();
        const entries = await fs.readdir(publishDir, { withFileTypes: true });

        res.json({
            cwd: process.cwd(),
            functionDir: __dirname,
            publishDir,
            publishEntries: entries.map((e) => ({ name: e.name, isDir: e.isDirectory() })),
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({
            error: msg,
            cwd: process.cwd(),
            functionDir: __dirname,
        });
    }
});

// Mount router on ALL prefixes we might see in Netlify + rewrites
api.use("/_api", router);
api.use("/.netlify/functions/api", router);

// Extra safety: allow direct /list for internal oddities
api.use("/", router);

// Last-resort error handler so Netlify always gets a response
api.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
});

export const handler = serverless(api);