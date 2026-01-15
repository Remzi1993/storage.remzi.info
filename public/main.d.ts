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
declare const els: {
    path: HTMLDivElement;
    rows: HTMLTableSectionElement;
    search: HTMLInputElement;
    btnUp: HTMLButtonElement;
    btnRoot: HTMLButtonElement;
};
declare function formatBytes(bytes: number | null): string;
declare function formatDate(ms: number): string;
declare function getRelFromHash(): string;
declare function setRelToHash(rel: string): void;
declare function parentRel(rel: string): string;
declare let last: ApiResponse | null;
declare function load(rel: string): Promise<void>;
declare function render(data: ApiResponse, filter: string): void;
declare function refresh(): void;
