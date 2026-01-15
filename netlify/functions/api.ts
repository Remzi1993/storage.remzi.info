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
    size: number | null;
    mtimeMs: number;
};

type MetaFile = {
    generatedAt: string;
    timezone: "UTC";
    entries: Record<string, MetaEntry>;
};

const api = express();
const router = Router();

let META: Record<string, MetaEntry> | null = null;
let PUBLISH_DIR: string | null = null;

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
    if (PUBLISH_DIR) return PUBLISH_DIR;

    const candidates = [
        path.join(process.cwd(), "public"),
        path.join("/var/task", "public"),
        path.join("/var/task", "public", "public"),
    ];

    for (const candidate of candidates) {
        if (await isDir(candidate)) {
            PUBLISH_DIR = candidate;
            return candidate;
        }
    }

    throw new Error(`Publish dir not found. Tried: ${candidates.join(" | ")}`);
}

async function loadMeta(publishDir: string): Promise<Record<string, MetaEntry>> {
    if (META) return META;

    const raw = await fs.readFile(path.join(publishDir, "_meta.json"), "utf8");
    const parsed = JSON.parse(raw) as MetaFile;

    META = parsed.entries ?? {};
    return META;
}

function toPosixPath(p: string): string {
    return p.split(path.sep).join("/");
}

async function listDir(publishDir: string, relative = ""): Promise<ListedItem[]> {
    const meta = await loadMeta(publishDir);

    const abs = safeJoin(publishDir, relative);
    const entries = await fs.readdir(abs, {withFileTypes: true});

    const relPrefix = toPosixPath(relative);

    const items: ListedItem[] = entries
        .filter((e) => e.name !== ".DS_Store")
        .filter((e) => (relative === "" ? !IGNORE_ROOT_NAMES.has(e.name) : true))
        .map((e) => {
            const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name;

            const metaEntry = meta[rel];
            const type = (e.isDirectory() ? "dir" : "file") satisfies ListedItem["type"];

            if (!metaEntry) {
                throw new Error(`Missing _meta.json entry for: ${rel}`);
            }

            const size = type === "dir" ? null : metaEntry.size;

            return {
                name: e.name,
                path: rel,
                type,
                size,
                mtimeMs: metaEntry.mtimeMs,
            } satisfies ListedItem;
        });

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

api.use("/_api", router);
api.use("/.netlify/functions/api", router);
api.use("/", router);

export const handler = serverless(api);