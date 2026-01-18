import { App, Modal, Notice } from 'obsidian';
import { parseVimKey, formatKeyForDisplay } from '../utils/vim-key-parser';

/**
 * Item to be displayed in the selection modal
 */
export interface SelectionItem {
	id: string;
	name: string;
	commandId: string;
	sequenceKey?: string;
}

/**
 * Arrow key and mouse-based selection modal
 * No search functionality - just simple list navigation
 */
export class ArrowKeySelectionModal extends Modal {
	private items: SelectionItem[];
	private onSelect: (item: SelectionItem) => void;
	private selectedIndex: number = 0;
	private itemElements: HTMLElement[] = [];
	private listContainer: HTMLElement;
	private groupName: string;

	constructor(
		app: App,
		groupName: string,
		items: SelectionItem[],
		onSelect: (item: SelectionItem) => void
	) {
		super(app);
		this.groupName = groupName;
		this.items = items;
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;

		// Set title
		contentEl.createEl('h3', {
			text: this.groupName,
			cls: 'arrow-key-modal-title'
		});

		// Create list container
		this.listContainer = contentEl.createDiv({
			cls: 'arrow-key-modal-list'
		});

		// Style the list container
		this.listContainer.style.maxHeight = '400px';
		this.listContainer.style.overflowY = 'auto';
		this.listContainer.style.marginTop = '12px';

		// Create items
		this.items.forEach((item, index) => {
			const itemEl = this.createItemElement(item, index);
			this.listContainer.appendChild(itemEl);
			this.itemElements.push(itemEl);
		});

		// Select first item by default
		if (this.items.length > 0) {
			this.setSelectedIndex(0);
		}

		// Register keyboard handlers
		this.registerKeyboardHandlers();

		// Add styles
		this.addStyles();
	}

	private createItemElement(item: SelectionItem, index: number): HTMLElement {
		const itemEl = this.listContainer.createDiv({
			cls: 'arrow-key-modal-item'
		});

		// Create a container for the item name and sequence key badge
		const contentContainer = itemEl.createDiv({
			cls: 'arrow-key-modal-item-content'
		});
		contentContainer.style.display = 'flex';
		contentContainer.style.alignItems = 'center';
		contentContainer.style.gap = '8px';

		// Add item name first
		const nameEl = contentContainer.createDiv({
			text: item.name,
			cls: 'arrow-key-modal-item-name'
		});
		nameEl.style.flexGrow = '1';

		// Add sequence key badge if present (after name for right alignment)
		if (item.sequenceKey) {
			const keyBadge = contentContainer.createDiv({
				cls: 'arrow-key-modal-key-badge',
				text: formatKeyForDisplay(item.sequenceKey)
			});
			keyBadge.style.width = 'auto';
			keyBadge.style.minWidth = '24px';
			keyBadge.style.height = '24px';
			keyBadge.style.display = 'flex';
			keyBadge.style.alignItems = 'center';
			keyBadge.style.justifyContent = 'center';
			keyBadge.style.borderRadius = '4px';
			keyBadge.style.padding = '0 6px';
			keyBadge.style.backgroundColor = 'var(--background-modifier-border)';
			keyBadge.style.color = 'var(--text-muted)';
			keyBadge.style.fontWeight = '500';
			keyBadge.style.fontSize = '12px';
			keyBadge.style.flexShrink = '0';
			keyBadge.style.border = '1px solid var(--background-modifier-border)';
		}

		// Mouse hover handler
		itemEl.addEventListener('mouseenter', () => {
			this.setSelectedIndex(index);
		});

		// Mouse click handler
		itemEl.addEventListener('click', () => {
			this.selectItem(item);
		});

		return itemEl;
	}

	private setSelectedIndex(index: number) {
		// Remove previous selection
		this.itemElements.forEach(el => el.removeClass('is-selected'));

		// Set new selection
		this.selectedIndex = index;
		const selectedEl = this.itemElements[this.selectedIndex];
		if (selectedEl) {
			selectedEl.addClass('is-selected');

			// Scroll into view if needed
			selectedEl.scrollIntoView({
				block: 'nearest',
				behavior: 'smooth'
			});
		}
	}

	private registerKeyboardHandlers() {
		// Arrow Up
		this.scope.register([], 'ArrowUp', (evt) => {
			evt.preventDefault();
			if (this.selectedIndex > 0) {
				this.setSelectedIndex(this.selectedIndex - 1);
			}
			return false;
		});

		// Arrow Down
		this.scope.register([], 'ArrowDown', (evt) => {
			evt.preventDefault();
			if (this.selectedIndex < this.items.length - 1) {
				this.setSelectedIndex(this.selectedIndex + 1);
			}
			return false;
		});

		// Enter key
		this.scope.register([], 'Enter', (evt) => {
			evt.preventDefault();
			const selectedItem = this.items[this.selectedIndex];
			if (selectedItem) {
				this.selectItem(selectedItem);
			}
			return false;
		});

		// Escape key
		this.scope.register([], 'Escape', () => {
			this.close();
			return false;
		});

		// Sequence key handlers - dynamically register only keys that are used
		this.items.forEach(item => {
			if (item.sequenceKey) {
				const sequenceKey = item.sequenceKey; // Store for use in closure
				try {
					const parsed = parseVimKey(sequenceKey);
					this.scope.register(parsed.modifiers, parsed.key, (evt) => {
						evt.preventDefault();
						this.handleSequenceKey(sequenceKey);
						return false;
					});
				} catch (error) {
					console.error(`Failed to register sequence key "${sequenceKey}":`, error);
				}
			}
		});
	}

	private handleSequenceKey(key: string) {
		// Find item with matching sequence key
		const matchingItem = this.items.find(item =>
			item.sequenceKey?.toLowerCase() === key.toLowerCase()
		);

		if (matchingItem) {
			this.selectItem(matchingItem);
		}
	}

	private selectItem(item: SelectionItem) {
		this.onSelect(item);
		this.close();
	}

	private addStyles() {
		const styleEl = this.contentEl.createEl('style');
		styleEl.textContent = `
			.arrow-key-modal-title {
				margin: 0 0 12px 0;
				font-size: 16px;
				font-weight: 600;
			}

			.arrow-key-modal-list {
				border: 1px solid var(--background-modifier-border);
				border-radius: 6px;
				padding: 4px;
			}

			.arrow-key-modal-item {
				padding: 8px 12px;
				border-radius: 4px;
				cursor: pointer;
				transition: background-color 0.1s ease;
			}

			.arrow-key-modal-item:hover {
				background-color: var(--background-modifier-hover);
			}

			.arrow-key-modal-item.is-selected {
				background-color: var(--interactive-accent);
				color: var(--text-on-accent);
			}

			.arrow-key-modal-item.is-selected .arrow-key-modal-key-badge {
				background-color: var(--background-modifier-hover);
				color: var(--text-normal);
				border-color: var(--background-modifier-hover);
			}

			.arrow-key-modal-item-content {
				display: flex;
				align-items: center;
			}

			.arrow-key-modal-item-name {
				flex-grow: 1;
			}
		`;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
