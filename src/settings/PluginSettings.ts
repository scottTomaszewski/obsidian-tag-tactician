import {Plugin} from "obsidian";

export type TagListStyle = "hyphens" | "brackets";

export type TagNavSortMode =
    | "alphabetically-descending"
    | "file-count-descending"
    | "created-time-descending"
    | "created-time-ascending"
    | "modified-time-descending"
    | "modified-time-ascending";

export interface TagTacticianSettings {
    // ==================
    // Batch
    // ==================
    showNonMarkdownWarning: boolean;
    tagListStyle: TagListStyle;

    // ==================
    // Related Notes
    // ==================
    // Whether to show tags by default in Related Notes
    defaultShowTags: boolean;
    // Whether to show scores by default in Related Notes
    defaultShowScore: boolean;
    // Minimum score to show in Related Notes
    minimumRelatedNotesScore: number;
    weightTagSimilarity: number;
    weightTitleSimilarity: number;
    weightPathSimilarity: number;
    weightLinkInterconnections: number;

    // ==================
    // Nav by Tags
    // ==================
    nbtDefaultSort: TagNavSortMode;
}

export const DEFAULT_SETTINGS: TagTacticianSettings = {
    showNonMarkdownWarning: true,
    tagListStyle: "hyphens",
    defaultShowTags: true,
    defaultShowScore: true,
    minimumRelatedNotesScore: 1,
    weightTagSimilarity: 1.0,
    weightTitleSimilarity: 1.0,
    weightPathSimilarity: 1.0,
    weightLinkInterconnections: 1.0,
    nbtDefaultSort: "alphabetically-descending",
};

type Listener = (s: TagTacticianSettings) => void;

// Emitter to help propagate updates to settings across the app
export class SettingsService {
    private settings: TagTacticianSettings;
    private listeners: Listener[] = [];

    constructor(private plugin: Plugin) {
        // load existing or fall back to defaults
        this.settings = Object.assign(DEFAULT_SETTINGS, this.plugin.loadData());
    }

    get(): TagTacticianSettings {
        return this.settings;
    }

    async save(patch: Partial<TagTacticianSettings>) {
        this.settings = {...this.settings, ...patch};
        await this.plugin.saveData(this.settings);
        this.emitChange();
    }

    registerOnChange(fn: Listener): () => void {
        this.listeners.push(fn);
        // return unsubscribe
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }

    private emitChange() {
        for (const l of this.listeners) l(this.settings);
    }
}
