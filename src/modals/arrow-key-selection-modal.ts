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
	private sequenceKeyHandler: (event: KeyboardEvent) => void;

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
		// Calculate dynamic max-height (70% of window height)
		const win = contentEl.win || window;
		const windowHeight = win.innerHeight;
		const maxHeight = Math.floor(windowHeight * 0.7);

		// Set minimum max-height to ensure usability even on small screens
		const MIN_HEIGHT = 200;
		const finalMaxHeight = Math.max(maxHeight, MIN_HEIGHT);

		this.listContainer.style.maxHeight = `${finalMaxHeight}px`;
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
			const lastIndex = this.items.length - 1;
			const newIndex = this.selectedIndex > 0 ? this.selectedIndex - 1 : lastIndex;
			this.setSelectedIndex(newIndex);
			return false;
		});

		// Arrow Down
		this.scope.register([], 'ArrowDown', (evt) => {
			evt.preventDefault();
			const lastIndex = this.items.length - 1;
			const newIndex = this.selectedIndex < lastIndex ? this.selectedIndex + 1 : 0;
			this.setSelectedIndex(newIndex);
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

		// Sequence key handlers - use direct keydown event for better compatibility
		// This allows special characters and different keyboard layouts to work correctly
		// Listen at document level to ensure we capture all keydown events when modal is open
		this.sequenceKeyHandler = this.handleSequenceKeyEvent.bind(this);
		const doc = this.contentEl.doc || document;
		doc.addEventListener('keydown', this.sequenceKeyHandler, true);
	}

	private handleSequenceKeyEvent(event: KeyboardEvent) {
		// Skip if it's a reserved navigation key
		const reservedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'];
		if (reservedKeys.includes(event.key)) {
			return; // Let the scope handlers handle these
		}

		// Normalize event key and determine if it's an alphabetic character
		const isAlphabetic = event.key.length === 1 && /[a-zA-Z]/.test(event.key);
		const eventKey = isAlphabetic && /[A-Z]/.test(event.key)
			? event.key.toLowerCase()
			: event.key;

		// Get modifiers from the event
		// For non-alphabetic single characters (like *, @, #), the Shift state is
		// already encoded in event.key, so we should not include Shift in modifiers
		const eventModifiers: string[] = [];
		if (event.ctrlKey) eventModifiers.push('Ctrl');
		if (event.altKey) eventModifiers.push('Alt');
		if (event.metaKey) eventModifiers.push('Meta');

		// Only include Shift for alphabetic characters, special keys, or when explicitly used with modifiers
		if (event.shiftKey && (isAlphabetic || event.key.length > 1)) {
			eventModifiers.push('Shift');
		}

		// Try to match against registered sequence keys
		for (const item of this.items) {
			if (!item.sequenceKey) continue;

			try {
				const parsed = parseVimKey(item.sequenceKey);

				// Normalize parsed modifiers (sort for comparison)
				const parsedModifiers = [...parsed.modifiers].sort();
				const sortedEventModifiers = [...eventModifiers].sort();

				// Compare modifiers and key
				const modifiersMatch = JSON.stringify(parsedModifiers) === JSON.stringify(sortedEventModifiers);
				const keyMatch = parsed.key === eventKey;

				if (modifiersMatch && keyMatch) {
					event.preventDefault();
					event.stopPropagation();
					this.selectItem(item);
					return;
				}
			} catch (error) {
				// Skip invalid sequence keys
				continue;
			}
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
		// Clean up event listener
		if (this.sequenceKeyHandler) {
			const doc = contentEl.doc || document;
			doc.removeEventListener('keydown', this.sequenceKeyHandler, true);
		}
		contentEl.empty();
	}
}
