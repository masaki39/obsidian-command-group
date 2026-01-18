import { App, Modal, Setting } from 'obsidian';

/**
 * A simple input modal for getting text input from the user
 * Used for creating new groups or renaming items
 */
export class SimpleInputModal extends Modal {
	private title: string;
	private placeholder: string;
	private defaultValue: string;
	private onSubmit: (value: string) => void;

	constructor(
		app: App,
		title: string,
		placeholder: string,
		defaultValue: string,
		onSubmit: (value: string) => void
	) {
		super(app);
		this.title = title;
		this.placeholder = placeholder;
		this.defaultValue = defaultValue;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h3', { text: this.title });

		const inputContainer = contentEl.createDiv();

		// 入力フィールド
		const inputSetting = new Setting(inputContainer)
			.setName(this.title)
			.addText(text => {
				text.setValue(this.defaultValue)
					.setPlaceholder(this.placeholder);

				// 自動フォーカスと全選択
				const inputEl = text.inputEl;
				setTimeout(() => {
					inputEl.focus();
					inputEl.select();
				}, 50);

				// Enterキーの処理
				inputEl.addEventListener('keydown', (e) => {
					if (e.key === 'Enter' && !e.isComposing) {
						e.preventDefault();
						this.onSubmit(inputEl.value || this.defaultValue);
						this.close();
					}
				});
			});

		// ボタンコンテナ
		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.marginTop = '1rem';

		// キャンセルボタン
		const cancelButton = buttonContainer.createEl('button', {text: 'Cancel'});
		cancelButton.addEventListener('click', () => this.close());

		// 作成ボタン
		const submitButton = buttonContainer.createEl('button', {text: 'Create'});
		submitButton.style.marginLeft = '0.5rem';
		submitButton.classList.add('mod-cta');
		submitButton.addEventListener('click', () => {
			const inputEl = inputSetting.controlEl.querySelector('input');
			this.onSubmit(inputEl ? inputEl.value : this.defaultValue);
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
