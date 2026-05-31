import {App, getIconIds, Modal, setIcon} from "obsidian";

export class IconSelectionModal extends Modal {
    currentIcon: string;
    onSelect: (icon: string) => void | Promise<void>;

    constructor(app: App, currentIcon: string, onSelect: (icon: string) => void | Promise<void>) {
        super(app);
        this.currentIcon = currentIcon;
        this.onSelect = onSelect;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.addClass('tt-icon-modal');
        contentEl.createEl('h2', {text: 'Select an icon'});

        // TODO - add search

        contentEl.createEl('button', {text: "No icon"})
            .addEventListener('click', () => {
                void this.onSelect("");
                this.close();
            });

        const iconList = this.getAvailableIcons();

        const iconGrid = contentEl.createDiv({cls: 'icon-grid'});

        iconList.forEach((iconName) => {
            const iconButton = iconGrid.createEl('button', {cls: 'icon-button'});
            iconButton.setAttr('aria-label', iconName);

            const iconEl = iconButton.createDiv({cls: 'icon'});
            setIcon(iconEl, iconName);

            iconButton.addEventListener('click', () => {
                void this.onSelect(iconName);
                this.close();
            });
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }

    getAvailableIcons(): string[] {
        return getIconIds()
            .filter(id => id.startsWith("lucide-"))
            .map(id => id.slice(7));
    }
}