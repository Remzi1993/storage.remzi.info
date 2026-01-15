import fs from "node:fs/promises";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);

type MetaEntry = {
    type: "dir" | "file";
    mtimeMs: number;
    size: number | null;
};

type MetaFile = {
    generatedAt: string;
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
    publicAbs: string,
    relPosix: string,
    out: Record<string, MetaEntry>
): Promise<void> {
    const abs = path.join(publicAbs, relPosix.split("/").join(path.sep));
    const stat = await fs.stat(abs);

    if (stat.isDirectory()) {
        out[relPosix] = {type: "dir", mtimeMs: Date.now(), size: null};

        const entries = await fs.readdir(abs, {withFileTypes: true});
        for (const e of entries) {
            if (e.name === ".DS_Store") continue;
            const childRel = relPosix ? `${relPosix}/${e.name}` : e.name;
            await walk(repoRoot, publicAbs, childRel, out);
        }
        return;
    }

    const gitMtime = await gitMtimeMs(repoRoot, relPosix);
    const mtimeMs = gitMtime ?? stat.mtimeMs;

    out[relPosix] = {type: "file", mtimeMs, size: stat.size};
}

async function main(): Promise<void> {
    const repoRoot = process.cwd();
    const publicAbs = path.join(repoRoot, "public");

    const entries: Record<string, MetaEntry> = {};
    await walk(repoRoot, publicAbs, "", entries);

    const meta: MetaFile = {
        generatedAt: new Date().toISOString(),
        source: "git",
        entries,
    };

    await fs.writeFile(path.join(publicAbs, "_meta.json"), JSON.stringify(meta), "utf8");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});