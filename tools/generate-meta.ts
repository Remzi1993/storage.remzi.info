import fs from "node:fs/promises";
import path from "node:path";

type MetaEntry = {
    type: "dir" | "file";
    mtimeMs: number;
    size: number | null;
};

type MetaFile = {
    generatedAt: string;
    entries: Record<string, MetaEntry>;
};

async function walk(rootAbs: string, relPosix = "", out: Record<string, MetaEntry>): Promise<void> {
    const abs = path.join(rootAbs, relPosix.split("/").join(path.sep));
    const stat = await fs.stat(abs);

    if (stat.isDirectory()) {
        out[relPosix] = {type: "dir", mtimeMs: stat.mtimeMs, size: null};

        const entries = await fs.readdir(abs, {withFileTypes: true});
        await Promise.all(
            entries
                .filter((e) => e.name !== ".DS_Store")
                .map(async (e) => {
                    const childRel = relPosix ? `${relPosix}/${e.name}` : e.name;
                    await walk(rootAbs, childRel, out);
                })
        );

        return;
    }

    out[relPosix] = {type: "file", mtimeMs: stat.mtimeMs, size: stat.size};
}

async function main(): Promise<void> {
    const repoRoot = process.cwd();
    const publicDir = path.join(repoRoot, "public");

    const entries: Record<string, MetaEntry> = {};
    await walk(publicDir, "", entries);

    const meta: MetaFile = {
        generatedAt: new Date().toISOString(),
        entries,
    };

    await fs.writeFile(path.join(publicDir, "_meta.json"), JSON.stringify(meta), "utf8");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});