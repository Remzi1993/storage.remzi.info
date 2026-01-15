import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const REPO_ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");

if (!existsSync(PUBLIC_DIR)) {
    console.error(`Missing public folder: ${PUBLIC_DIR}`);
    process.exit(1);
}

app.use("/", express.static(PUBLIC_DIR));

app.use((_req, res) => {
    res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
});

app.listen(PORT, () => {
    console.log(`UI: http://localhost:${PORT}/`);
    console.log(`Asset:  http://localhost:${PORT}/images/logo.png`);
});