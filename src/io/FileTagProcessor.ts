import { App, TFile } from "obsidian";
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

        const content = await app.vault.read(file);
        let newContent: string | undefined;

        // Check if frontmatter already exists
        const fmMatch = content.match(FRONTMATTER_REGEX);
        if (!fmMatch) {
            // No frontmatter => create one only if finalTags is non-empty
            if (finalTags.length === 0) {
                // Nothing to do
                continue;
            }
            // Create minimal frontmatter
            const fmData = { tags: finalTags.length > 0 ? finalTags : undefined };
            const newYaml = dumpYaml(fmData, settings.tagListStyle);
            newContent = `---\n${newYaml}\n---\n${content}`;
        } else {
            // Frontmatter exists => parse & update
            const yamlBody = fmMatch[1];
            let fmData: any;
            try {
                fmData = yaml.load(yamlBody) || {};
            } catch (err) {
                console.error(`Failed to parse YAML in ${file.path}`, err);
                continue;
            }
            // Update `tags` field based on finalTags
            fmData.tags = finalTags.length > 0 ? finalTags : undefined;

            // Re-stringify
            const newYaml = dumpYaml(fmData, settings.tagListStyle);
            newContent = content.replace(
                FRONTMATTER_REGEX,
                `---\n${newYaml}\n---`
            );
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
