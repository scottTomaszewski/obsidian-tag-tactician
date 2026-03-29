import { App, getFrontMatterInfo, parseFrontMatterTags, parseYaml, TFile } from "obsidian";

/**
 * Returns the tags for a file, stripping leading '#'.
 * Tries the metadata cache first; if unavailable, reads the file content directly.
 */
export async function readFileTags(app: App, file: TFile): Promise<string[]> {
    const cache = app.metadataCache.getFileCache(file);
    let tags: string[];

    if (cache) {
        tags = parseFrontMatterTags(cache.frontmatter) ?? [];
    } else {
        tags = await readTagsFromContent(app, file);
    }

    return tags.map((t) => t.startsWith("#") ? t.slice(1) : t);
}

async function readTagsFromContent(app: App, file: TFile): Promise<string[]> {
    const content = await app.vault.cachedRead(file);
    const fmInfo = getFrontMatterInfo(content);
    if (!fmInfo.exists) return [];

    try {
        const fmData = parseYaml(fmInfo.frontmatter);
        return normalizeTags(fmData?.tags);
    } catch {
        return [];
    }
}

function normalizeTags(tagsValue: unknown): string[] {
    if (!tagsValue) return [];

    if (Array.isArray(tagsValue)) {
        return tagsValue.flatMap((item) =>
            typeof item === "string" ? [item] : []
        );
    }

    if (typeof tagsValue === "string") {
        return tagsValue
            .split(/[, ]+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
    }

    return [];
}
