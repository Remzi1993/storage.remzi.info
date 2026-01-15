type ApiItem = {
    name: string;
    path: string;
    type: "dir" | "file";
    size: number | null;
    mtimeMs: number;
};

type ApiResponse = {
    baseUrl: string;
    path: string;
    items: ApiItem[];
};

const els = {
    path: document.getElementById("path") as HTMLDivElement,
    rows: document.getElementById("rows") as HTMLTableSectionElement,
    search: document.getElementById("search") as HTMLInputElement,
    btnUp: document.getElementById("btnUp") as HTMLButtonElement,
    btnRoot: document.getElementById("btnRoot") as HTMLButtonElement,
};

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => {
        switch (c) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            case "'":
                return "&#39;";
            default:
                return c;
        }
    });
}

function formatBytes(bytes: number | null): string {
    if (bytes == null) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(ms: number): string {
    return new Date(ms).toLocaleString();
}

function getRelFromHash(): string {
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    return raw.replace(/^\/+/, "").replace(/\/+$/, "");
}

function setRelToHash(rel: string): void {
    location.hash = rel ? `#/${rel}` : "#/";
}

function parentRel(rel: string): string {
    if (!rel) return "";
    const parts = rel.split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
}

let last: ApiResponse | null = null;

async function load(rel: string): Promise<void> {
    const url = new URL("/_api/list", location.origin);
    if (rel) url.searchParams.set("path", rel);

    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`);
    }

    last = (await res.json()) as ApiResponse;
    render(last, els.search.value.trim().toLowerCase());
}

function render(data: ApiResponse, filter: string): void {
    els.path.textContent = data.path ? `/${data.path}` : "/";

    const items = data.items.filter((it) => (filter ? it.name.toLowerCase().includes(filter) : true));

    els.rows.innerHTML = items
        .map((it) => {
            const isDir = it.type === "dir";
            const icon = isDir ? "📁" : "📄";

            const safeName = escapeHtml(it.name);
            const safePath = escapeHtml(it.path);

            const nameHtml = isDir
                ? `<a class="link-primary text-decoration-none fw-semibold" href="javascript:void(0)" data-dir="${safePath}">${icon} ${safeName}</a>`
                : `<a class="link-body-emphasis text-decoration-none" href="/${safePath}" target="_blank" rel="noopener">${icon} ${safeName}</a>`;

            return `
        <tr>
          <td class="text-truncate" style="max-width: 520px">${nameHtml}</td>
          <td class="text-end text-secondary">${isDir ? "" : formatBytes(it.size)}</td>
          <td class="text-end text-secondary">${formatDate(it.mtimeMs)}</td>
        </tr>
      `;
        })
        .join("");

    els.rows.querySelectorAll<HTMLElement>("[data-dir]").forEach((a) => {
        a.addEventListener("click", () => {
            const next = a.getAttribute("data-dir");
            if (next != null) setRelToHash(next);
        });
    });
}

function refresh(): void {
    load(getRelFromHash()).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Error";
        els.rows.innerHTML = `<tr><td colspan="3" class="p-4 text-danger">${escapeHtml(msg)}</td></tr>`;
    });
}

window.addEventListener("hashchange", refresh);

els.search.addEventListener("input", () => {
    if (last) render(last, els.search.value.trim().toLowerCase());
});

els.btnRoot.addEventListener("click", () => setRelToHash(""));
els.btnUp.addEventListener("click", () => setRelToHash(parentRel(getRelFromHash())));

refresh();