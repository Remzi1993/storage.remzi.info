import fs from "node:fs/promises";
import path from "node:path";

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

function toPosix(rel: string): string {
    return rel.split(path.sep).join("/");
}

async function walk(
    publicDirAbs: string,
    relPosix: string,
    entries: Record<string, MetaEntry>
): Promise<number> {
    const abs = path.join(publicDirAbs, relPosix.split("/").join(path.sep));
    const stat = await fs.stat(abs);

    if (stat.isDirectory()) {
        const dirEntries = await fs.readdir(abs, {withFileTypes: true});

        let newestChild = 0;

        for (const e of dirEntries) {
            if (e.name === ".DS_Store") continue;
            if (relPosix === "" && e.name === "_meta.json") continue;

            const childRelPosix = relPosix ? `${relPosix}/${e.name}` : e.name;
            const childNewest = await walk(publicDirAbs, childRelPosix, entries);
            if (childNewest > newestChild) newestChild = childNewest;
        }

        const dirMtimeMs = newestChild || Date.parse(stat.mtime.toISOString());
        entries[relPosix] = {type: "dir", size: null, mtimeMs: dirMtimeMs};
        return dirMtimeMs;
    }

    const mtimeMs = Date.parse(stat.mtime.toISOString());
    entries[relPosix] = {type: "file", size: stat.size, mtimeMs};
    return mtimeMs;
}

async function main(): Promise<void> {
    const publicDirAbs = path.resolve("public");

    const entries: Record<string, MetaEntry> = {};
    await walk(publicDirAbs, "", entries);

    const meta: MetaFile = {
        generatedAt: new Date().toISOString(),
        timezone: "UTC",
        entries,
    };

    await fs.writeFile(
        path.join(publicDirAbs, "_meta.json"),
        JSON.stringify(meta, null, 2),
        "utf8"
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});