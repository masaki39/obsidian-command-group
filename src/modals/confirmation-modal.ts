import { App, Modal } from 'obsidian';

/**
 * A generic confirmation dialog modal
 * Used to confirm destructive actions like deleting groups
 */
export class ConfirmationModal extends Modal {
	private message: string;
	private confirmText: string;
	private cancelText: string;
	private onConfirm: () => void;
	private onCancel?: () => void;

	constructor(
		app: App,
		message: string,
		onConfirm: () => void,
		options?: {
			confirmText?: string;
			cancelText?: string;
			onCancel?: () => void;
		}
	) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
		this.confirmText = options?.confirmText || 'Delete';
		this.cancelText = options?.cancelText || 'Cancel';
		this.onCancel = options?.onCancel;
	}

	onOpen() {
		const { contentEl } = this;

		// Message
		contentEl.createEl('p', {
			text: this.message,
			cls: 'confirmation-message'
		});

		// Button container
		const buttonContainer = contentEl.createDiv({
			cls: 'modal-button-container'
		});

		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '8px';
		buttonContainer.style.marginTop = '20px';

		// Cancel button
		const cancelButton = buttonContainer.createEl('button', {
			text: this.cancelText
		});
		cancelButton.addEventListener('click', () => {
			if (this.onCancel) {
				this.onCancel();
			}
			this.close();
		});

		// Confirm button (destructive action - red)
		const confirmButton = buttonContainer.createEl('button', {
			text: this.confirmText,
			cls: 'mod-warning'
		});
		confirmButton.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});

		// Handle Escape key
		this.scope.register([], 'Escape', () => {
			if (this.onCancel) {
				this.onCancel();
			}
			this.close();
			return false;
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
