import { App, Modal } from 'obsidian';
import { parseVimKey, formatKeyForDisplay } from '../utils/vim-key-parser';

export interface SelectionItem {
	id: string;
	name: string;
	commandId: string;
	sequenceKey?: string;
}

const AUTO_KEY_PRIORITY = [
	'a','s','d','f','g','h','j','k','l',
	'q','w','e','r','t','y','u','i','o','p',
	'z','x','c','v','b','n','m',
	'1','2','3','4','5','6','7','8','9','0'
];

export class ArrowKeySelectionModal extends Modal {
	private items: SelectionItem[];
	private onSelect: (item: SelectionItem) => void;
	private selectedIndex: number = 0;
	private itemElements: HTMLElement[] = [];
	private listContainer: HTMLElement;
	private groupName: string;
	private sequenceKeyHandler: (event: KeyboardEvent) => void;
	private autoKeyMap: Map<string, string> = new Map();

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

		contentEl.createEl('h3', {
			text: this.groupName,
			cls: 'arrow-key-modal-title'
		});

		this.listContainer = contentEl.createDiv({
			cls: 'arrow-key-modal-list'
		});

		const win = contentEl.win || window;
		const windowHeight = win.innerHeight;
		const maxHeight = Math.max(Math.floor(windowHeight * 0.7), 200);

		this.listContainer.style.maxHeight = `${maxHeight}px`;
		this.listContainer.style.overflowY = 'auto';
		this.listContainer.style.marginTop = '12px';

		// Compute auto-assigned keys for items without sequenceKey
		const usedKeys = new Set(
			this.items.filter(i => i.sequenceKey).map(i => i.sequenceKey!)
		);
		let autoKeyIdx = 0;
		for (const item of this.items) {
			if (!item.sequenceKey) {
				while (autoKeyIdx < AUTO_KEY_PRIORITY.length && usedKeys.has(AUTO_KEY_PRIORITY[autoKeyIdx])) {
					autoKeyIdx++;
				}
				if (autoKeyIdx < AUTO_KEY_PRIORITY.length) {
					this.autoKeyMap.set(item.id, AUTO_KEY_PRIORITY[autoKeyIdx]);
					usedKeys.add(AUTO_KEY_PRIORITY[autoKeyIdx]);
					autoKeyIdx++;
				}
			}
		}

		this.items.forEach((item, index) => {
			const itemEl = this.createItemElement(item, index);
			this.listContainer.appendChild(itemEl);
			this.itemElements.push(itemEl);
		});

		if (this.items.length > 0) {
			this.setSelectedIndex(0);
		}

		this.registerKeyboardHandlers();
	}

	private createItemElement(item: SelectionItem, index: number): HTMLElement {
		const itemEl = this.listContainer.createDiv({
			cls: 'arrow-key-modal-item'
		});

		const contentContainer = itemEl.createDiv({
			cls: 'arrow-key-modal-item-content'
		});

		contentContainer.createDiv({
			text: item.name,
			cls: 'arrow-key-modal-item-name'
		});

		if (item.sequenceKey) {
			contentContainer.createDiv({
				cls: 'arrow-key-modal-key-badge',
				text: formatKeyForDisplay(item.sequenceKey)
			});
		} else {
			const autoKey = this.autoKeyMap.get(item.id);
			if (autoKey) {
				contentContainer.createDiv({
					cls: 'arrow-key-modal-key-badge',
					text: autoKey
				});
			}
		}

		itemEl.addEventListener('mouseenter', () => {
			this.setSelectedIndex(index);
		});

		itemEl.addEventListener('click', () => {
			this.selectItem(item);
		});

		return itemEl;
	}

	private setSelectedIndex(index: number) {
		this.itemElements.forEach(el => el.removeClass('is-selected'));

		this.selectedIndex = index;
		const selectedEl = this.itemElements[this.selectedIndex];
		if (selectedEl) {
			selectedEl.addClass('is-selected');
			selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}
	}

	private registerKeyboardHandlers() {
		this.scope.register([], 'ArrowUp', (evt) => {
			evt.preventDefault();
			const lastIndex = this.items.length - 1;
			this.setSelectedIndex(this.selectedIndex > 0 ? this.selectedIndex - 1 : lastIndex);
			return false;
		});

		this.scope.register([], 'ArrowDown', (evt) => {
			evt.preventDefault();
			const lastIndex = this.items.length - 1;
			this.setSelectedIndex(this.selectedIndex < lastIndex ? this.selectedIndex + 1 : 0);
			return false;
		});

		this.scope.register([], 'Enter', (evt) => {
			evt.preventDefault();
			const selectedItem = this.items[this.selectedIndex];
			if (selectedItem) this.selectItem(selectedItem);
			return false;
		});

		this.scope.register([], 'Escape', () => {
			this.close();
			return false;
		});

		this.sequenceKeyHandler = this.handleSequenceKeyEvent.bind(this);
		const doc = this.contentEl.doc || document;
		doc.addEventListener('keydown', this.sequenceKeyHandler, true);
	}

	private handleSequenceKeyEvent(event: KeyboardEvent) {
		const reservedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'];
		if (reservedKeys.includes(event.key)) return;

		const isAlphabetic = event.key.length === 1 && /[a-zA-Z]/.test(event.key);
		const eventKey = isAlphabetic && /[A-Z]/.test(event.key)
			? event.key.toLowerCase()
			: event.key;

		const eventModifiers: string[] = [];
		if (event.ctrlKey) eventModifiers.push('Ctrl');
		if (event.altKey) eventModifiers.push('Alt');
		if (event.metaKey) eventModifiers.push('Meta');
		if (event.shiftKey && (isAlphabetic || event.key.length > 1)) {
			eventModifiers.push('Shift');
		}

		// Check user-defined sequence keys
		for (const item of this.items) {
			if (!item.sequenceKey) continue;

			try {
				const parsed = parseVimKey(item.sequenceKey);
				const parsedModifiers = [...parsed.modifiers].sort();
				const sortedEventModifiers = [...eventModifiers].sort();

				if (
					JSON.stringify(parsedModifiers) === JSON.stringify(sortedEventModifiers) &&
					parsed.key === eventKey
				) {
					event.preventDefault();
					event.stopPropagation();
					this.selectItem(item);
					return;
				}
			} catch {
				continue;
			}
		}

		// Check auto-assigned keys (only plain key, no modifiers)
		if (eventModifiers.length === 0 && eventKey.length === 1) {
			for (const item of this.items) {
				const autoKey = this.autoKeyMap.get(item.id);
				if (autoKey && autoKey === eventKey) {
					event.preventDefault();
					event.stopPropagation();
					this.selectItem(item);
					return;
				}
			}
		}
	}

	private selectItem(item: SelectionItem) {
		this.onSelect(item);
		this.close();
	}

	onClose() {
		if (this.sequenceKeyHandler) {
			const doc = this.contentEl.doc || document;
			doc.removeEventListener('keydown', this.sequenceKeyHandler, true);
		}
		this.contentEl.empty();
	}
}
