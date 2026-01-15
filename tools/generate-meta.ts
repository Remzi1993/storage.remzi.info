import fs from "node:fs/promises";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);

type MetaEntry = {
    type: "dir" | "file";
    size: number | null;
    mtimeMs: number;
};

type MetaFile = {
    generatedAt: string;
    timezone: "UTC";
    source: "git";
    entries: Record<string, MetaEntry>;
};

async function gitMtimeMs(repoRoot: string, relPosix: string): Promise<number | null> {
    try {
        const rel = relPosix === "" ? "." : relPosix;
        const {stdout} = await execFileAsync("git", ["log", "-1", "--format=%ct", "--", rel], {
            cwd: repoRoot,
        });

        const trimmed = stdout.trim();
        if (!trimmed) return null;

        const seconds = Number(trimmed);
        if (!Number.isFinite(seconds) || seconds <= 0) return null;

        return seconds * 1000;
    } catch {
        return null;
    }
}

async function walk(
    repoRoot: string,
    publicDirAbs: string,
    relPosix: string,
    out: Record<string, MetaEntry>
): Promise<number> {
    const abs = path.join(publicDirAbs, relPosix.split("/").join(path.sep));
    const stat = await fs.stat(abs);

    if (stat.isDirectory()) {
        const dirents = await fs.readdir(abs, {withFileTypes: true});

        let newest = 0;

        for (const d of dirents) {
            if (d.name === ".DS_Store") continue;
            if (relPosix === "" && d.name === "_meta.json") continue;

            const childRel = relPosix ? `${relPosix}/${d.name}` : d.name;
            const childNewest = await walk(repoRoot, publicDirAbs, childRel, out);
            if (childNewest > newest) newest = childNewest;
        }

        out[relPosix] = {
            type: "dir",
            size: null,
            mtimeMs: newest || Date.now(),
        };

        return out[relPosix].mtimeMs;
    }

    const gitTime = await gitMtimeMs(repoRoot, relPosix);

    const fallbackUtcMs = Date.parse(stat.mtime.toISOString());
    const mtimeMs = gitTime ?? fallbackUtcMs;

    out[relPosix] = {
        type: "file",
        size: stat.size,
        mtimeMs,
    };

    return mtimeMs;
}

async function main(): Promise<void> {
    const repoRoot = process.cwd();
    const publicDirAbs = path.resolve("public");

    const entries: Record<string, MetaEntry> = {};
    await walk(repoRoot, publicDirAbs, "", entries);

    const meta: MetaFile = {
        generatedAt: new Date().toISOString(),
        timezone: "UTC",
        source: "git",
        entries,
    };

    await fs.writeFile(path.join(publicDirAbs, "_meta.json"), JSON.stringify(meta, null, 2), "utf8");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});