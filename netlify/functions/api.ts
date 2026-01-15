import express, {Router} from "express";
import serverless from "serverless-http";
import path from "node:path";
import fs from "node:fs/promises";
import {IGNORE_ROOT_NAMES} from "../../src/shared/ignore.js";

type ListedItem = {
    name: string;
    path: string;
    type: "dir" | "file";
    size: number | null;
    mtimeMs: number;
};

type MetaEntry = {
    type: "dir" | "file";
    mtimeMs: number;
    size: number | null;
};

type MetaFile = {
    generatedAt: string;
    entries: Record<string, MetaEntry>;
};

const api = express();
const router = Router();

let META: Record<string, MetaEntry> | null = null;

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

async function resolvePublishDir(): Promise<string> {
    const candidates = [
        path.join(process.cwd(), "public"),
        path.join("/var/task", "public"),
        path.join("/var/task", "public", "public"),
    ];

    for (const candidate of candidates) {
        if (await isDir(candidate)) return candidate;
    }

    throw new Error(`Publish dir not found. Tried: ${candidates.join(" | ")}`);
}

async function loadMeta(publishDir: string): Promise<Record<string, MetaEntry> | null> {
    if (META) return META;

    try {
        const raw = await fs.readFile(path.join(publishDir, "_meta.json"), "utf8");
        const parsed = JSON.parse(raw) as MetaFile;
        META = parsed.entries ?? null;
        return META;
    } catch {
        META = null;
        return null;
    }
}

async function listDir(publishDir: string, relative = ""): Promise<ListedItem[]> {
    const abs = safeJoin(publishDir, relative);
    const entries = await fs.readdir(abs, {withFileTypes: true});
    const meta = await loadMeta(publishDir);

    const items = await Promise.all(
        entries
            .filter((e) => e.name !== ".DS_Store")
            .filter((e) => (relative === "" ? !IGNORE_ROOT_NAMES.has(e.name) : true))
            .map(async (e) => {
                const rel = path.posix.join(relative.split(path.sep).join("/"), e.name);
                const absItem = safeJoin(publishDir, rel);
                const stat = await fs.stat(absItem);

                const type = (e.isDirectory() ? "dir" : "file") satisfies ListedItem["type"];

                const metaEntry = meta ? meta[rel] : null;
                const effectiveMtimeMs = metaEntry?.mtimeMs ?? stat.mtimeMs;
                const effectiveSize = e.isDirectory() ? null : (metaEntry?.size ?? stat.size);

                return {
                    name: e.name,
                    path: rel,
                    type,
                    size: effectiveSize,
                    mtimeMs: effectiveMtimeMs,
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
        res.json({baseUrl: "/", path: rel, items});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({error: msg});
    }
});

router.get("/_debug", async (_req, res) => {
    try {
        const publishDir = await resolvePublishDir();
        const entries = await fs.readdir(publishDir, {withFileTypes: true});
        const meta = await loadMeta(publishDir);

        res.json({
            cwd: process.cwd(),
            publishDir,
            metaLoaded: meta != null,
            metaEntriesCount: meta ? Object.keys(meta).length : 0,
            publishEntries: entries.map((e) => ({name: e.name, isDir: e.isDirectory()})),
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({error: msg, cwd: process.cwd()});
    }
});

// Mount for both possible prefixes (rewrite vs internal)
api.use("/_api", router);
api.use("/.netlify/functions/api", router);
api.use("/", router);

export const handler = serverless(api);