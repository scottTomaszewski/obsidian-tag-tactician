import { AbstractInputSuggest, App, parseFrontMatterTags, renderResults, TFile } from "obsidian";

// Base class for tag suggestions
export abstract class TagSuggestBase extends AbstractInputSuggest<string> {
    protected inputEl: HTMLInputElement;
    protected onTagSelected: ((value: string) => void) | null = null;

    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.inputEl = inputEl;
        
        // Add input event listener to trigger updates on manual input as well
        this.inputEl.addEventListener('input', () => {
            if (this.onTagSelected) {
                this.onTagSelected(this.inputEl.value);
            }
        });
    }

    /**
     * Set a callback to be triggered when a tag is selected or input value changes
     */
    setTagSelectedCallback(callback: (value: string) => void): void {
        this.onTagSelected = callback;
    }

    renderSuggestion(tag: string, el: HTMLElement): void {
        // el.setText(tag);
        console.log(tag);
        const div = el.createEl("div", { cls: "tag-autocomplete-item", text: tag });
    }

    selectSuggestion(tag: string): void {
        const inputEl = this.inputEl;
        const currentValue = inputEl.value ?? "";
        const currentTags = currentValue.split(/[, ]+/).filter(t => t);
        
        // Replace the last tag with the selected suggestion
        if (currentTags.length > 0) {
            currentTags[currentTags.length - 1] = tag;
        } else {
            currentTags.push(tag);
        }
        
        // Add a comma and space at the end to prevent immediate re-triggering
        inputEl.value = currentTags.join(", ") + ", ";
        
        // Place cursor at the end
        const newCursorPosition = inputEl.value.length;
        inputEl.setSelectionRange(newCursorPosition, newCursorPosition);
        
        // Trigger input event after setting the cursor position
        inputEl.trigger("input");
        
        // Call the callback if it's set
        if (this.onTagSelected) {
            this.onTagSelected(inputEl.value);
        }
        
        this.close();
    }
}

// Suggests tags that already exist in the vault
export class ExistingTagSuggest extends TagSuggestBase {
    async getSuggestions(inputStr: string): Promise<string[]> {
        const allTags = this.getVaultTags();
        return this.filterTags(allTags, inputStr);
    }
    
    private getVaultTags(): string[] {
        const allTags: Set<string> = new Set();

        const mdFiles = this.app.vault.getMarkdownFiles();
        for (const file of mdFiles) {
            const frontmatter = this.app.metadataCache.getFileCache(file).frontmatter;
            let currentTags = parseFrontMatterTags(frontmatter);
            currentTags = currentTags === null ? currentTags = [] : currentTags;

            // remove leading #
            currentTags
                .map((t) => t.startsWith("#") ? t.slice(1) : t)
                .forEach(t => allTags.add(t));
        }
        return Array.from(allTags).sort();
    }

    private filterTags(tags: string[], inputStr: string): string[] {
        const currentTags = inputStr.split(/[, ]+/);
        const lastTag = currentTags[currentTags.length - 1].toLowerCase();
        
        console.log("lastTag:", lastTag);
        console.log("tags:", tags); // Don't use string concatenation for logging arrays
        
        // Make the filtering more strict to avoid empty tag matches
        // Only show suggestions if the user has typed at least one character
        if (lastTag.length === 0) {
            return [];
        }
        
        const filteredTags = tags
            .filter(tag => tag.toLowerCase().includes(lastTag))
            .slice(0, 10); // Limit to 10 suggestions
        
        console.log("filtered tags:", filteredTags);
        return filteredTags;
    }
}

// Suggests tags that are on the files being modified
export class FileTagSuggest extends TagSuggestBase {
    private files: TFile[];
    
    constructor(app: App, inputEl: HTMLInputElement, files: TFile[]) {
        super(app, inputEl);
        this.files = files;
    }
    
    async getSuggestions(inputStr: string): Promise<string[]> {
        const fileTags = this.getTagsFromFiles();
        return this.filterTags(fileTags, inputStr);
    }
    
    private getTagsFromFiles(): string[] {
        const allTags: Set<string> = new Set();
        const metadataCache = this.app.metadataCache;
        
        this.files.forEach(file => {
            const frontmatter = this.app.metadataCache.getFileCache(file).frontmatter;
            let currentTags = parseFrontMatterTags(frontmatter);
            currentTags = currentTags === null ? currentTags = [] : currentTags;

            // remove leading #
            currentTags
                .map((t) => t.startsWith("#") ? t.slice(1) : t)
                .forEach(t => allTags.add(t));
        });
        
        return Array.from(allTags).sort();
    }
    
    private filterTags(tags: string[], inputStr: string): string[] {
        const currentTags = inputStr.split(/[, ]+/);
        const lastTag = currentTags[currentTags.length - 1].toLowerCase();
        
        console.log("lastTag:", lastTag);
        console.log("tags:", tags); // Don't use string concatenation for logging arrays
        
        // Make the filtering more strict to avoid empty tag matches
        // Only show suggestions if the user has typed at least one character
        if (lastTag.length === 0) {
            return [];
        }
        
        const filteredTags = tags
            .filter(tag => tag.toLowerCase().includes(lastTag))
            .slice(0, 10); // Limit to 10 suggestions
        
        console.log("filtered tags:", filteredTags);
        return filteredTags;
    }
} 