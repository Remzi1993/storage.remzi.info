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
const STORAGE_DIR = path.join(REPO_ROOT, "storage");

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
    const abs = safeJoin(STORAGE_DIR, relative);
    const entries = await fs.readdir(abs, { withFileTypes: true });

    const items = await Promise.all(
        entries
            .filter((e) => e.name !== ".DS_Store")
            .map(async (e) => {
                const rel = path.posix.join(
                    relative.split(path.sep).join("/"),
                    e.name
                );

                const absItem = safeJoin(STORAGE_DIR, rel);
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

if (!existsSync(STORAGE_DIR)) {
    console.error(`Missing storage folder: ${STORAGE_DIR}`);
    process.exit(1);
}

app.use("/_ui", express.static(PUBLIC_DIR));

app.get("/", (_req, res) => res.redirect("/_ui/"));

app.use(
    "/_ui/vendor/bootstrap",
    express.static(path.join(REPO_ROOT, "node_modules/bootstrap/dist"))
);

app.use(
    "/",
    express.static(STORAGE_DIR, {
        fallthrough: true,
        setHeaders(res) {
            res.setHeader("Cache-Control", "public, max-age=3600");
        },
    })
);

app.get("/_api/list", async (req, res) => {
    try {
        const rel = typeof req.query.path === "string" ? req.query.path : "";
        const items = await listDir(rel);
        res.json({ baseUrl: "/", path: rel, items });
    } catch {
        res.status(400).json({ error: "Bad path" });
    }
});

app.listen(PORT, () => {
    console.log(`UI:  http://localhost:${PORT}/_ui/`);
    console.log(`CDN: http://localhost:${PORT}/images/logo.svg (example)`);
});