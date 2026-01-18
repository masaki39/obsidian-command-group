import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { CommandGroupPlugin } from '../plugin';
import { generateGroupId, generateCommandId } from '../utils/id-generator';
import { CommandSuggestModal } from '../modals/command-suggest-modal';
import { ConfirmationModal } from '../modals/confirmation-modal';
import { SimpleInputModal } from '../modals/simple-input-modal';
import { parseVimKey } from '../utils/vim-key-parser';

/**
 * Settings tab for Command Group plugin
 * Manages the UI for creating, editing, and organizing command groups
 */
export class CommandSettingTab extends PluginSettingTab {
	plugin: CommandGroupPlugin;
	// イベントリスナーの参照を保持するための配列
	private eventListeners: Array<{ element: HTMLElement, type: string, listener: EventListener }> = [];

	constructor(app: App, plugin: CommandGroupPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// イベントリスナーを追加し、参照を保持するヘルパーメソッド
	addListener(element: HTMLElement, type: string, listener: EventListener) {
		element.addEventListener(type, listener);
		this.eventListeners.push({ element, type, listener });
	}

	// すべてのイベントリスナーを削除するメソッド
	removeAllListeners() {
		this.eventListeners.forEach(({ element, type, listener }) => {
			try {
				element.removeEventListener(type, listener);
			} catch (error) {
				console.error(`Error removing event listener: ${error}`);
			}
		});
		this.eventListeners = [];
	}

	// ドラッグ＆ドロップのヘルパー関数
	setupDragAndDrop(
		element: HTMLElement,
		type: 'group' | 'command',
		index: number,
		groupIndex?: number,
		onDrop?: (sourceType: string, sourceIndex: number, sourceGroupIndex: number, targetIndex: number, targetGroupIndex: number) => Promise<void>
	) {
		// データ形式の定義
		const dataType = type === 'group' ? 'application/group-data' : 'application/command-data';

		// ドラッグ開始
		this.addListener(element, 'dragstart', (e: Event) => {
			const dragEvent = e as DragEvent;
			if (type === 'command') {
				e.stopPropagation();
			}

			if (dragEvent.dataTransfer) {
				// グループインデックスを要素から取得
				const currentGroupIndex = type === 'command'
					? parseInt(element.getAttribute('data-group-index') || '-1')
					: index;

				const data = type === 'group'
					? JSON.stringify({ type, groupIndex: index })
					: JSON.stringify({
						type,
						commandIndex: index,
						groupIndex: currentGroupIndex
					});
				dragEvent.dataTransfer.setData(dataType, data);
			}

			setTimeout(() => {
				element.classList.add('dragging');
			}, 0);
		});

		// ドラッグ終了
		this.addListener(element, 'dragend', () => {
			element.classList.remove('dragging');
		});

		// ドラッグオーバー
		this.addListener(element, 'dragover', (e: Event) => {
			e.preventDefault();
			if (type === 'command') {
				e.stopPropagation();
			}
			element.classList.add('drag-over');
		});

		// ドラッグリーブ
		this.addListener(element, 'dragleave', () => {
			element.classList.remove('drag-over');
		});

		// ドロップ
		this.addListener(element, 'drop', async (e: Event) => {
			e.preventDefault();
			if (type === 'command') {
				e.stopPropagation();
			}
			element.classList.remove('drag-over');

			const dragEvent = e as DragEvent;

			// 現在のグループインデックスを取得
			const currentGroupIndex = type === 'command'
				? parseInt(element.getAttribute('data-group-index') || '-1')
				: -1;

			// グループデータの取得を試みる
			try {
				const groupDataStr = dragEvent.dataTransfer?.getData('application/group-data');
				if (groupDataStr) {
					const data = JSON.parse(groupDataStr);
					if (data.type === 'group' && type === 'group' && onDrop) {
						await onDrop('group', data.groupIndex, -1, index, -1);
					}
					return;
				}
			} catch (error) {
				console.error('Error parsing group drag data:', error);
			}

			// コマンドデータの取得を試みる
			try {
				const commandDataStr = dragEvent.dataTransfer?.getData('application/command-data');
				if (commandDataStr && onDrop) {
					const data = JSON.parse(commandDataStr);
					if (data.type === 'command') {
						await onDrop('command', data.commandIndex, data.groupIndex, index, currentGroupIndex);
					}
				}
			} catch (error) {
				console.error('Error parsing command drag data:', error);
			}
		});
	}

	// 新しいグループを追加する共通ロジック
	async addNewGroup(groupName: string) {
		try {
			// Add new group
			const newGroup = {
				id: generateGroupId(),
				name: groupName,
				commands: []
			};

			this.plugin.settings.commandGroups.push(newGroup);
			await this.plugin.saveSettingsAndRegisterCommands();
			this.display();

		} catch (error) {
			console.error('Error adding new group:', error);
			new Notice('Failed to add new group. Check console for details.');
		}
	}

	// グループ要素を作成するヘルパーメソッド
	createGroupElement(
		containerEl: HTMLElement,
		group: {
			id: string;
			name: string;
			commands: {
				id: string;
				obsidianCommand: string;
				sequenceKey?: string;
			}[];
		},
		groupIndex: number,
		handleDrop: (sourceType: string, sourceIndex: number, sourceGroupIndex: number, targetIndex: number, targetGroupIndex: number) => Promise<void>
	): HTMLElement {
		const groupEl = containerEl.createEl('div', {
			cls: 'command-group-container',
			attr: {
				'data-index': groupIndex.toString(),
				'draggable': 'true'
			}
		});

		// グループのドラッグ＆ドロップを設定
		this.setupDragAndDrop(groupEl, 'group', groupIndex, undefined, handleDrop);

		// コマンドのドロップイベントを追加
		this.addListener(groupEl, 'dragover', (e: Event) => {
			e.preventDefault();
			const dragEvent = e as DragEvent;
			// コマンドデータの場合のみドロップを許可
			if (dragEvent.dataTransfer?.types.includes('application/command-data')) {
				e.stopPropagation(); // グループのドラッグイベントを停止
				groupEl.classList.add('drag-over');
			}
		});

		this.addListener(groupEl, 'dragleave', (e: Event) => {
			const dragEvent = e as DragEvent;
			if (dragEvent.dataTransfer?.types.includes('application/command-data')) {
				groupEl.classList.remove('drag-over');
			}
		});

		this.addListener(groupEl, 'drop', async (e: Event) => {
			const dragEvent = e as DragEvent;
			if (dragEvent.dataTransfer?.types.includes('application/command-data')) {
				e.preventDefault();
				e.stopPropagation();
				groupEl.classList.remove('drag-over');

				try {
					const commandDataStr = dragEvent.dataTransfer?.getData('application/command-data');
					if (commandDataStr) {
						const data = JSON.parse(commandDataStr);
						if (data.type === 'command') {
							// グループへのドロップは、そのグループの最後に追加する
							await handleDrop('command', data.commandIndex, data.groupIndex, group.commands.length, groupIndex);
						}
					}
				} catch (error) {
					console.error('Error parsing command drag data:', error);
				}
			}
		});

		// Group setting
		const groupSetting = new Setting(groupEl);

		// Add drag handle
		const dragHandleEl = groupEl.createEl('div', {
			cls: 'drag-handle',
			text: '⋮⋮'
		});
		groupSetting.nameEl.prepend(dragHandleEl);
		groupSetting.nameEl.style.display = 'flex';

		// Group name input field
		groupSetting.addText(text => {
			text.setValue(group.name)
				.setPlaceholder('Group name')
				.onChange(async (value) => {
					group.name = value;
					await this.plugin.saveSettingsAndRegisterCommands();
				});
			// スタイルの調整
			text.inputEl.style.width = '100%';
			return text;
		});

		// Configure hotkey button
		groupSetting.addButton(button => {
			button.setIcon('any-key')
				.setTooltip('Configure Hotkey')
				.onClick(() => {
					// Use internal Obsidian API with type assertion
					const setting = (this.app as any).setting;
					if (setting && typeof setting.openTabById === 'function') {
						setting.openTabById('hotkeys');

						// Pre-populate search with group name after tab loads
						setTimeout(() => {
							const tab = setting.activeTab;
							if (tab?.searchComponent?.inputEl) {
								tab.searchComponent.inputEl.value = group.name;
								if (typeof tab.updateHotkeyVisibility === 'function') {
									tab.updateHotkeyVisibility();
								}
							}
						}, 100);
					} else {
						// Fallback if API doesn't exist
						new Notice('Please open Settings → Hotkeys and search for: ' + group.name);
					}
				});
			return button;
		});

		// Delete group button
		groupSetting.addButton(button => {
			button.setIcon('trash')
				.setTooltip('Delete Group')
				.onClick(() => {
					// Show confirmation modal
					new ConfirmationModal(
						this.app,
						`Are you sure you want to delete "${group.name}"? This action cannot be undone.`,
						async () => {
							// Delete group
							this.plugin.settings.commandGroups.splice(groupIndex, 1);
							await this.plugin.saveSettingsAndRegisterCommands();
							this.display();
						}
					).open();
				});
			return button;
		});

		return groupEl;
	}

	// コマンドコンテナを作成するヘルパーメソッド
	createCommandsContainer(
		groupEl: HTMLElement,
		group: {
			id: string;
			name: string;
			commands: {
				id: string;
				obsidianCommand: string;
				sequenceKey?: string;
			}[];
		},
		groupIndex: number,
		handleDrop: (sourceType: string, sourceIndex: number, sourceGroupIndex: number, targetIndex: number, targetGroupIndex: number) => Promise<void>
	): HTMLElement {
		// Command list container
		const commandsContainerEl = groupEl.createEl('div', {
			cls: 'commands-container'
		});

		// 空のグループの場合のメッセージ表示
		if (group.commands.length === 0) {
			const emptyMessage = commandsContainerEl.createEl('div', {
				cls: 'empty-commands-message',
				text: 'No commands in this group. Use the button below to add commands.'
			});
			emptyMessage.style.color = 'var(--text-muted)';
			emptyMessage.style.padding = '8px';
			emptyMessage.style.fontStyle = 'italic';
		}

		// Add "Add Command" button at bottom of group
		const addCommandContainer = commandsContainerEl.createEl('div', {
			cls: 'add-command-button-container'
		});

		new Setting(addCommandContainer)
			.addButton(button => button
				.setButtonText('+ Add Command')
				.onClick(() => {
					new CommandSuggestModal(this.app, (selectedCommand) => {
						group.commands.push({
							id: generateCommandId(),
							obsidianCommand: selectedCommand.id
						});
						this.plugin.saveSettingsAndRegisterCommands().then(() => {
							this.display();
						});
					}).open();
				}));

		return commandsContainerEl;
	}

	// コマンド要素を作成するヘルパーメソッド
	createCommandElement(
		containerEl: HTMLElement,
		command: {
			id: string;
			obsidianCommand: string;
			sequenceKey?: string;
		},
		commandIndex: number,
		groupIndex: number,
		handleDrop: (sourceType: string, sourceIndex: number, sourceGroupIndex: number, targetIndex: number, targetGroupIndex: number) => Promise<void>
	): HTMLElement {
		// Get Obsidian command
		const obsidianCommand = this.app.commands.findCommand(command.obsidianCommand);

		const commandItemEl = containerEl.createEl('div', {
			cls: 'command-item-container',
			attr: {
				'data-group-index': groupIndex.toString(),
				'data-command-index': commandIndex.toString(),
				'draggable': 'true'
			}
		});

		// コマンドのドラッグ＆ドロップ設定
		this.setupDragAndDrop(commandItemEl, 'command', commandIndex, groupIndex, handleDrop);

		// Add drag handle
		const commandDragHandleEl = commandItemEl.createEl('div', {
			cls: 'drag-handle',
			text: '⋮'
		});

		// Command setting
		const commandSetting = new Setting(commandItemEl);

		// Command name display
		commandSetting.setName(obsidianCommand ? obsidianCommand.name : 'Invalid command');
		commandSetting.nameEl.style.cursor = 'pointer';
		commandSetting.nameEl.addEventListener('click', () => {
			// Open suggest modal
			new CommandSuggestModal(this.app, (selectedCommand) => {
				// Set selected command
				command.obsidianCommand = selectedCommand.id;
				this.plugin.saveSettingsAndRegisterCommands().then(() => {
					this.display();
				});
			}).open();
		});

		// Sequence key input
		commandSetting.addText(text => {
			text.setValue(command.sequenceKey || '')
				.setPlaceholder('Key')
				.onChange(async (value) => {
					const trimmedValue = value.trim();

					if (trimmedValue === '') {
						// Allow clearing the sequence key
						command.sequenceKey = undefined;
						await this.plugin.saveSettingsAndRegisterCommands();
						return;
					}

					// Validate using Vim key parser
					try {
						parseVimKey(trimmedValue);
					} catch (error) {
						new Notice('Invalid key sequence. Use Vim notation like <C-a>, <Space>, or single characters.');
						text.setValue(command.sequenceKey || '');
						return;
					}

					// Normalize for comparison (case-sensitive)
					const normalizedValue = trimmedValue;

					// Check for duplicates within the same group
					const group = this.plugin.settings.commandGroups[groupIndex];
					const duplicate = group.commands.some((cmd, idx) =>
						idx !== commandIndex &&
						cmd.sequenceKey === normalizedValue
					);

					if (duplicate) {
						new Notice(`Sequence key "${trimmedValue}" is already used in this group`);
						text.setValue(command.sequenceKey || '');
						return;
					}

					// Set the sequence key (preserve original case for display)
					command.sequenceKey = trimmedValue;
					await this.plugin.saveSettingsAndRegisterCommands();
				});

			// Style the input (wider to accommodate longer Vim notation)
			text.inputEl.style.width = '100px';
			text.inputEl.style.textAlign = 'center';
			text.inputEl.style.fontWeight = 'bold';

			return text;
		});

		// Delete command button
		commandSetting.addButton(button => {
			button.setIcon('trash')
				.setTooltip('Delete Command')
				.onClick(async () => {
					// Delete command
					const group = this.plugin.settings.commandGroups[groupIndex];
					group.commands.splice(commandIndex, 1);
					await this.plugin.saveSettingsAndRegisterCommands();
					this.display();
				});
			return button;
		});

		return commandItemEl;
	}

	display(): void {
		// 既存のリスナーをクリーンアップ
		this.removeAllListeners();

		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Command Group Settings' });

		// Create draggable list
		const commandListEl = containerEl.createEl('div', {
			cls: 'command-list-container'
		});

		// ドロップ処理の共通関数
		const handleDrop = async (
			sourceType: string,
			sourceIndex: number,
			sourceGroupIndex: number,
			targetIndex: number,
			targetGroupIndex: number
		) => {
			if (sourceType === 'group' && targetGroupIndex === -1) {
				// グループの移動
				if (sourceIndex === targetIndex) return;

				const draggedGroup = this.plugin.settings.commandGroups[sourceIndex];
				this.plugin.settings.commandGroups.splice(sourceIndex, 1);
				this.plugin.settings.commandGroups.splice(targetIndex, 0, draggedGroup);
			} else if (sourceType === 'command') {
				// コマンドの移動
				const sourceGroup = this.plugin.settings.commandGroups[sourceGroupIndex];

				if (targetGroupIndex === -1) {
					// コマンドコンテナへのドロップ（グループの最後に追加）
					targetGroupIndex = sourceGroupIndex;
				}

				const targetGroup = this.plugin.settings.commandGroups[targetGroupIndex];

				if (!sourceGroup || !targetGroup) return;

				// 同じグループ内での移動
				if (sourceGroupIndex === targetGroupIndex) {
					const draggedCommand = sourceGroup.commands[sourceIndex];
					sourceGroup.commands.splice(sourceIndex, 1);

					if (targetIndex < sourceGroup.commands.length) {
						// 特定の位置に挿入
						sourceGroup.commands.splice(targetIndex, 0, draggedCommand);
					} else {
						// 最後に追加
						sourceGroup.commands.push(draggedCommand);
					}
				} else {
					// 異なるグループ間での移動
					const draggedCommand = sourceGroup.commands[sourceIndex];
					sourceGroup.commands.splice(sourceIndex, 1);

					if (targetIndex < targetGroup.commands.length) {
						// 特定の位置に挿入
						targetGroup.commands.splice(targetIndex, 0, draggedCommand);
					} else {
						// 最後に追加
						targetGroup.commands.push(draggedCommand);
					}
				}
			}

			await this.plugin.saveSettingsAndRegisterCommands();
			this.display();
		};

		// Display existing command groups
		this.plugin.settings.commandGroups.forEach((group, groupIndex) => {
			// グループ要素を作成
			const groupEl = this.createGroupElement(commandListEl, group, groupIndex, handleDrop);

			// コマンドコンテナを作成
			const commandsContainerEl = this.createCommandsContainer(groupEl, group, groupIndex, handleDrop);

			// コマンドを表示
			group.commands.forEach((command, commandIndex) => {
				this.createCommandElement(commandsContainerEl, command, commandIndex, groupIndex, handleDrop);
			});
		});

		// Add styles
		containerEl.createEl('style', {
			text: `
				.command-list-container {
					margin-bottom: 20px;
				}
				.command-group-container {
					margin-bottom: 16px;
					padding: 12px;
					border-radius: 6px;
					border: 1px solid var(--background-modifier-border);
					background-color: var(--background-secondary);
				}
				.command-group-container.dragging {
					opacity: 0.5;
				}
				.command-group-container.drag-over {
					border-color: var(--interactive-accent);
					box-shadow: 0 0 5px var(--interactive-accent);
				}
				.commands-container {
					margin-top: 12px;
					margin-left: 24px;
					min-height: 30px;
					padding: 4px;
					border-radius: 4px;
				}
				.commands-container-drag-over {
					background-color: var(--background-modifier-hover);
					border: 1px dashed var(--interactive-accent);
				}
				.command-item-container {
					display: flex;
					align-items: center;
					margin-bottom: 8px;
					padding: 6px;
					border-radius: 4px;
					background-color: var(--background-primary);
					border: 1px solid transparent;
				}
				.command-item-container.dragging {
					opacity: 0.5;
				}
				.command-item-container.drag-over {
					border-color: var(--interactive-accent);
					box-shadow: 0 0 3px var(--interactive-accent);
				}
				.setting-item {
					border: none;
					padding: 0;
					flex-grow: 1;
					display: flex;
					align-items: center;
				}
				.drag-handle {
					cursor: grab;
					margin-right: 8px;
					color: var(--text-muted);
				}
				.empty-commands-message {
					text-align: center;
					margin: 10px 0;
				}
				.add-command-button-container {
					margin-top: 8px;
					text-align: right;
				}
				.add-command-button-container .setting-item {
					border: none;
					padding: 0;
				}
			`
		});

		// Add new command group button
		new Setting(containerEl)
			.addButton(button => button
				.setButtonText('+ Add New Command Group')
				.onClick(() => {
					try {
						// Use SimpleInputModal
						new SimpleInputModal(
							this.app,
							'New Command Group',
							'Enter group name',
							'New Group',
							async (groupName) => {
								await this.addNewGroup(groupName);
							}
						).open();
					} catch (error) {
						console.error('Error showing modal:', error);
						new Notice('Failed to show group creation modal. Check console for details.');
					}
				}));
	}
}
