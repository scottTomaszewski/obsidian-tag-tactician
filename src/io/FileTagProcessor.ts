import {App, getFrontMatterInfo, parseYaml, TFile} from "obsidian";
import * as yaml from "js-yaml";

// Regex that only matches the first frontmatter block at the top of the file.
const FRONTMATTER_REGEX = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---/;

/** Possible array styles for tags. */
export type TagListStyle = "hyphens" | "brackets";

/** Configuration for how to dump the frontmatter. */
export interface TagProcessorSettings {
    tagListStyle: TagListStyle; // e.g., "hyphens" => block style, "brackets" => inline style
}

/**
 * Applies final tag arrays to each file’s frontmatter.
 * If a file has no frontmatter, it creates one.
 * If the array is empty, it removes the `tags` field.
 *
 * @param app      - Obsidian App reference
 * @param updates  - Array of `{ file, finalTags }`
 * @param settings - Controls how arrays are dumped (block vs inline)
 * @returns The number of files actually modified
 */
export async function applyTagUpdates(
    app: App,
    updates: { file: TFile; finalTags: string[] }[],
    settings: TagProcessorSettings
): Promise<number> {
    let modifiedCount = 0;

    for (const { file, finalTags } of updates) {
        // Only modify .md files
        if (file.extension !== "md") continue;

        // NOTES FROM CODE REVIEW:
        // Prefer Vault.process instead of Vault.modify to modify a file in the background.
        // Normally I'd recommend using FileManager.processFrontMatter since you are only updating frontmatter,
        // but that doesn't support bracket syntax for lists in YAML.
        // Just keep in mind that Obsidian may override the format if the user interacts with the frontmatter using
        // the properties UI or if another plugin is using FileManager.processFrontMatter
        //
        // I plan on keeping it this way for now to support the bracket syntax for lists in YAML (which is what I
        // personally prefer).  I will keep an eye out if this becomes an issue.
        const content = await app.vault.read(file);
        let newContent: string | undefined;

        const frontMatterInfo = getFrontMatterInfo(content);
        if (frontMatterInfo.exists) {
            // Frontmatter exists => update the tags field
            const fmData = parseYaml(frontMatterInfo.frontmatter);
            fmData.tags = finalTags.length > 0 ? finalTags : undefined;
            const newYaml = dumpYaml(fmData, settings.tagListStyle);
            newContent = content.slice(0, frontMatterInfo.from) + `${newYaml}\n` + content.slice(frontMatterInfo.to);
        } else {
            // No frontmatter => create one only if finalTags is non-empty
            if (finalTags.length === 0) {
                // Nothing to do
                continue;
            }
            const fmData = { tags: finalTags.length > 0 ? finalTags : undefined };
            const newYaml = dumpYaml(fmData, settings.tagListStyle);
            newContent = `---\n${newYaml}\n---\n${content}`;
        }

        // If content actually changed, write it
        if (newContent && newContent !== content) {
            await app.vault.modify(file, newContent);
            modifiedCount++;
        }
    }

    return modifiedCount;
}

/**
 * Dumps frontmatter data to YAML using the chosen style.
 *
 * "hyphens" => block style arrays (flowLevel: -1)
 * "brackets" => inline style arrays (flowLevel: 1 at the array level)
 */
function dumpYaml(fmData: any, style: TagListStyle): string {
    if (style === "brackets") {
        // Keep the top-level in block style, but arrays inline
        return yaml.dump(fmData, { flowLevel: 1 }).trim();
    } else {
        // hyphens => all block style
        return yaml.dump(fmData, { flowLevel: -1 }).trim();
    }
}
