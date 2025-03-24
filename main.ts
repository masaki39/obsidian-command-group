import { App, Command, Modal, Notice, Plugin, PluginSettingTab, Setting, SuggestModal } from 'obsidian';

// Extend Obsidian type definitions
declare module 'obsidian' {
	interface App {
		commands: {
			executeCommandById(id: string): boolean;
			findCommand(id: string): Command | null;
			commands: Record<string, Command>;
		};
	}
}

interface CommandGroupSettings {
	commandGroups: { 
		id: string;
		name: string; // Group name
		commands: { 
			id: string; 
			obsidianCommand: string; // Obsidian command ID
		}[];
	}[];
	nextGroupId: number; // Next group ID to use
	nextCommandId: number; // Next command ID to use
}

const DEFAULT_SETTINGS: CommandGroupSettings = {
	commandGroups: [
		{
			id: 'group1',
			name: 'Group 1',
			commands: [
				{ id: 'command1', obsidianCommand: 'app:go-back' },
				{ id: 'command2', obsidianCommand: 'app:go-forward' },
				{ id: 'command3', obsidianCommand: 'app:open-settings' }
			]
		}
	],
	nextGroupId: 2,
	nextCommandId: 4
}

export default class CommandGroupPlugin extends Plugin {
	settings: CommandGroupSettings;

	// Helper function to generate a simple group ID
	generateGroupId(): string {
		// Simple sequential format
		const id = `group${this.settings.nextGroupId}`;
		this.settings.nextGroupId++;
		return id;
	}
	
	// Helper function to generate a simple command ID
	generateCommandId(): string {
		// Simple sequential format
		const id = `command${this.settings.nextCommandId}`;
		this.settings.nextCommandId++;
		return id;
	}

	// Helper function to optimize ID counters
	optimizeIdCounters() {
		// Get the set of group IDs currently in use
		const usedGroupIds = new Set<number>();
		const groupIdMap = new Map<string, boolean>();
		
		// Get the set of command IDs currently in use
		const usedCommandIds = new Set<number>();
		const commandIdMap = new Map<string, boolean>();
		
		// 重複IDを検出して修正するためのマップ
		const duplicateGroupIds = new Map<string, number>();
		const duplicateCommandIds = new Map<string, number>();
		
		// 一度のループで両方のIDを収集
		this.settings.commandGroups.forEach(group => {
			// Check for duplicate group IDs
			if (groupIdMap.has(group.id)) {
				console.warn(`Duplicate group ID found: ${group.id}. This will be fixed automatically.`);
				duplicateGroupIds.set(group.id, (duplicateGroupIds.get(group.id) || 0) + 1);
			} else {
				groupIdMap.set(group.id, true);
			}
			
			const groupIdNumber = parseInt(group.id.replace('group', ''));
			if (!isNaN(groupIdNumber)) {
				usedGroupIds.add(groupIdNumber);
			}
			
			// コマンドIDも同時に処理
			group.commands.forEach(cmd => {
				// Check for duplicate command IDs
				if (commandIdMap.has(cmd.id)) {
					console.warn(`Duplicate command ID found: ${cmd.id}. This will be fixed automatically.`);
					duplicateCommandIds.set(cmd.id, (duplicateCommandIds.get(cmd.id) || 0) + 1);
				} else {
					commandIdMap.set(cmd.id, true);
				}
				
				const cmdIdNumber = parseInt(cmd.id.replace('command', ''));
				if (!isNaN(cmdIdNumber)) {
					usedCommandIds.add(cmdIdNumber);
				}
			});
		});
		
		// 重複IDを修正
		if (duplicateGroupIds.size > 0 || duplicateCommandIds.size > 0) {
			// 次に使用可能なIDを見つける
			let nextAvailableGroupId = 1;
			while (usedGroupIds.has(nextAvailableGroupId)) {
				nextAvailableGroupId++;
			}
			
			let nextAvailableCommandId = 1;
			while (usedCommandIds.has(nextAvailableCommandId)) {
				nextAvailableCommandId++;
			}
			
			// 重複グループIDを修正
			this.settings.commandGroups.forEach(group => {
				if (duplicateGroupIds.has(group.id)) {
					const count = duplicateGroupIds.get(group.id) || 0;
					if (count > 0) {
						// 新しいIDを割り当て
						const newId = `group${nextAvailableGroupId}`;
						console.log(`Fixing duplicate group ID: ${group.id} -> ${newId}`);
						group.id = newId;
						usedGroupIds.add(nextAvailableGroupId);
						nextAvailableGroupId++;
						duplicateGroupIds.set(group.id, count - 1);
					}
				}
				
				// 重複コマンドIDを修正
				group.commands.forEach(cmd => {
					if (duplicateCommandIds.has(cmd.id)) {
						const count = duplicateCommandIds.get(cmd.id) || 0;
						if (count > 0) {
							// 新しいIDを割り当て
							const newId = `command${nextAvailableCommandId}`;
							console.log(`Fixing duplicate command ID: ${cmd.id} -> ${newId}`);
							cmd.id = newId;
							usedCommandIds.add(nextAvailableCommandId);
							nextAvailableCommandId++;
							duplicateCommandIds.set(cmd.id, count - 1);
						}
					}
				});
			});
		}
		
		// Find the smallest natural number not in use (group ID)
		let nextGroupId = 1;
		while (usedGroupIds.has(nextGroupId)) {
			nextGroupId++;
		}
		
		// Find the smallest natural number not in use (command ID)
		let nextCommandId = 1;
		while (usedCommandIds.has(nextCommandId)) {
			nextCommandId++;
		}
		
		// Set the next IDs
		this.settings.nextGroupId = nextGroupId;
		this.settings.nextCommandId = nextCommandId;
	}

	async onload() {
		try {
			await this.loadSettings();

			// Optimize ID counters
			this.optimizeIdCounters();

			// Register commands for each command group
			this.app.workspace.onLayoutReady(() => { this.registerGroupCommands();});

			// Add settings tab
			this.addSettingTab(new CommandSettingTab(this.app, this));
		} catch (error) {
			console.error('Error loading plugin:', error);
			new Notice('Error loading Command Group plugin. Check console for details.');
		}
	}

	onunload() {
		// Cleanup when plugin is disabled
		try {
			// Clean up registered commands
			const commands = (this.app as any).commands;
			if (commands && typeof commands.removeCommand === 'function') {
				// Find commands registered by this plugin
				const pluginCommands = Object.values(this.app.commands.commands)
					.filter(cmd => cmd.id.startsWith(`${this.manifest.id}:`));
				
				// Remove each command
				pluginCommands.forEach(cmd => {
					try {
						commands.removeCommand(cmd.id);
					} catch (error) {
						console.error(`Error removing command ${cmd.id}:`, error);
					}
				});
				
				console.log(`Command Group: Cleaned up ${pluginCommands.length} commands`);
			}
			
			// Clean up any settings tab event listeners
			try {
				const settingTabs = (this.app as any).setting?.settingTabs;
				if (settingTabs && Array.isArray(settingTabs)) {
					const commandSettingTab = settingTabs.find(
						(tab: any) => tab instanceof CommandSettingTab
					) as CommandSettingTab | undefined;
					
					if (commandSettingTab) {
						commandSettingTab.removeAllListeners();
						console.log('Command Group: Cleaned up settings tab event listeners');
					}
				}
			} catch (error) {
				console.error('Error cleaning up settings tab:', error);
			}
		} catch (error) {
			console.error('Error during plugin cleanup:', error);
		}
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		
		// 古いデータ形式からの移行処理
		// data.jsonに古いcommandsプロパティが存在する場合は削除
		if (data && 'commands' in data) {
			// 古いcommandsプロパティを削除
			delete (this.settings as any).commands;
			
			// 設定を保存して古いデータを削除
			await this.saveSettings();
			console.log('Migrated from old data format (removed commands property)');
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Save settings and re-register commands
	async saveSettingsAndRegisterCommands() {
		try {
			// 設定を保存する前にIDカウンターを最適化
			this.optimizeIdCounters();
			
			await this.saveSettings();
			this.registerGroupCommands(); // Re-register commands
		} catch (error) {
			console.error('Error saving settings and registering commands:', error);
			new Notice('Failed to save settings. Check console for details.');
			throw error; // 呼び出し元でもエラーハンドリングできるように再スロー
		}
	}

	// Register Obsidian commands for each command group
	registerGroupCommands() {
		try {
			// Get currently registered plugin commands
			const existingCommands = Object.values(this.app.commands.commands)
				.filter(cmd => cmd.id.startsWith(`${this.manifest.id}:`));
			
			// List of command IDs that no longer exist in current settings
			const commandIdsToRemove = new Set(
				existingCommands.map(cmd => cmd.id.replace(`${this.manifest.id}:`, ''))
			);
			
			// Register commands for each group
			this.settings.commandGroups.forEach(group => {
				const commandId = `${group.id}`;
				
				// Remove this command from the removal list (still in use)
				commandIdsToRemove.delete(commandId);
				
				// Register command (existing commands will be overwritten)
				this.addCommand({
					id: commandId,
					name: `${group.name}`,
					callback: () => {
						// コマンドがない場合の処理
						if (group.commands.length === 0) {
							new Notice('No commands in this group');
							return;
						}
						
						// コマンドが1つの場合は直接実行
						if (group.commands.length === 1) {
							const command = group.commands[0];
							try {
								// コマンドが存在するか確認
								const obsidianCommand = this.app.commands.findCommand(command.obsidianCommand);
								if (!obsidianCommand) {
									new Notice(`Command not found: ${command.obsidianCommand}`);
									console.error(`Command not found: ${command.obsidianCommand}`);
									return;
								}
								
								const success = this.app.commands.executeCommandById(command.obsidianCommand);
								if (!success) {
									new Notice(`Failed to execute command: ${obsidianCommand.name}`);
									console.error(`Failed to execute command: ${command.obsidianCommand}`);
								}
							} catch (error) {
								console.error(`Error executing command ${command.obsidianCommand}:`, error);
								new Notice(`Error executing command: ${error instanceof Error ? error.message : String(error)}`);
							}
							return;
						}
						
						// 複数のコマンドがある場合は選択モーダルを表示
						new GroupCommandSuggestModal(this.app, this, group).open();
					}
				});
			});
			
			// Remove unused commands
			if (commandIdsToRemove.size > 0) {
				console.log(`Command Group: ${commandIdsToRemove.size} unused commands will be removed`);
				
				// Actually remove the commands
				// Use Obsidian's internal API to remove commands
				// Note: This is an internal API and may change in the future
				const commands = (this.app as any).commands;
				if (commands && typeof commands.removeCommand === 'function') {
					try {
						commandIdsToRemove.forEach(commandId => {
							const fullCommandId = `${this.manifest.id}:${commandId}`;
							commands.removeCommand(fullCommandId);
						});
					} catch (error) {
						console.error('Error removing commands:', error);
					}
				}
			}
		} catch (error) {
			console.error('Error registering group commands:', error);
			new Notice('Error registering commands. Check console for details.');
		}
	}
}

// Modal for selecting a command from a group
class GroupCommandSuggestModal extends SuggestModal<{id: string, name: string, command: string}> {
	plugin: CommandGroupPlugin;
	group: {
		id: string;
		name: string;
		commands: {
			id: string;
			obsidianCommand: string;
		}[];
	};

	constructor(app: App, plugin: CommandGroupPlugin, group: {
		id: string;
		name: string;
		commands: {
			id: string;
			obsidianCommand: string;
		}[];
	}) {
		super(app);
		this.plugin = plugin;
		this.group = group;
		this.setPlaceholder(`Select a command from ${group.name}...`);
	}

	getSuggestions(query: string): {id: string, name: string, command: string}[] {
		// Get commands in the group with Obsidian command information
		return this.group.commands
			.map(cmd => {
				const obsidianCommand = this.app.commands.findCommand(cmd.obsidianCommand);
				return {
					id: cmd.id,
					name: obsidianCommand ? obsidianCommand.name : 'Invalid command',
					command: cmd.obsidianCommand
				};
			})
			.filter(item => 
				!query || 
				item.name.toLowerCase().includes(query.toLowerCase())
			);
	}

	renderSuggestion(item: {id: string, name: string, command: string}, el: HTMLElement): void {
		el.createEl('div', { text: item.name });
	}

	onChooseSuggestion(item: {id: string, name: string, command: string}, evt: MouseEvent | KeyboardEvent): void {
		// Execute the selected command
		try {
			// コマンドが存在するか確認
			const command = this.app.commands.findCommand(item.command);
			if (!command) {
				new Notice(`Command not found: ${item.name} (${item.command})`);
				console.error(`Command not found: ${item.command}`);
				return;
			}
			
			const success = this.app.commands.executeCommandById(item.command);
			if (!success) {
				new Notice(`Failed to execute command: ${item.name}`);
				console.error(`Failed to execute command: ${item.command}`);
			}
		} catch (error) {
			console.error(`Error executing command ${item.command}:`, error);
			new Notice(`Error executing command: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}

class CommandSuggestModal extends SuggestModal<Command> {
	plugin: CommandGroupPlugin;
	onSelect: (command: Command) => void;

	constructor(app: App, plugin: CommandGroupPlugin, onSelect: (command: Command) => void) {
		super(app);
		this.plugin = plugin;
		this.onSelect = onSelect;
		this.setPlaceholder('Search commands...');
	}

	getSuggestions(query: string): Command[] {
		const commandsObj = this.app.commands.commands;
		const commands = Object.values(commandsObj) as Command[];
		
		if (!query) {
			return commands;
		}
		
		const lowerQuery = query.toLowerCase();
		return commands.filter((command: Command) => 
			command.name.toLowerCase().includes(lowerQuery) || 
			command.id.toLowerCase().includes(lowerQuery)
		);
	}

	renderSuggestion(command: Command, el: HTMLElement): void {
		// Display command name
		el.createEl('div', { text: command.name, cls: 'command-name' });
		
		// Display command ID in small text (keep for search)
		el.createEl('small', { 
			text: command.id, 
			cls: 'command-id',
			attr: {
				style: 'color: var(--text-muted); font-size: 10px;'
			}
		});
	}

	onChooseSuggestion(command: Command, evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(command);
	}
}

class CommandSettingTab extends PluginSettingTab {
	plugin: CommandGroupPlugin;
	// イベントリスナーの参照を保持するための配列
	private eventListeners: Array<{element: HTMLElement, type: string, listener: EventListener}> = [];

	constructor(app: App, plugin: CommandGroupPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// イベントリスナーを追加し、参照を保持するヘルパーメソッド
	addListener(element: HTMLElement, type: string, listener: EventListener) {
		element.addEventListener(type, listener);
		this.eventListeners.push({element, type, listener});
	}

	// すべてのイベントリスナーを削除するメソッド
	removeAllListeners() {
		this.eventListeners.forEach(({element, type, listener}) => {
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
				id: this.plugin.generateGroupId(),
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
	
	// 特定のグループにコマンドを追加するためのモーダルを開く
	openCommandSuggestForGroup(group: {
		id: string;
		name: string;
		commands: {
			id: string;
			obsidianCommand: string;
		}[];
	}) {
		new CommandSuggestModal(this.app, this.plugin, (selectedCommand) => {
			// Add command to the specified group
			group.commands.push({
				id: this.plugin.generateCommandId(),
				obsidianCommand: selectedCommand.id
			});
			
			this.plugin.saveSettingsAndRegisterCommands().then(() => {
				this.display();
			}).catch(error => {
				console.error('Error saving settings:', error);
				new Notice('Failed to save settings. Check console for details.');
			});
		}).open();
	}

	// シンプルなモーダルを表示する共通関数
	showSimpleModal(title: string, placeholder: string, defaultValue: string, onSubmit: (value: string) => void) {
		const modal = new Modal(this.app);
		modal.titleEl.setText(title);
		
		const contentEl = modal.contentEl;
		const inputContainer = contentEl.createDiv();
		
		// 入力フィールド
		const inputSetting = new Setting(inputContainer)
			.setName(title)
			.addText(text => {
				text.setValue(defaultValue)
					.setPlaceholder(placeholder);
				
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
						onSubmit(inputEl.value || defaultValue);
						modal.close();
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
		cancelButton.addEventListener('click', () => modal.close());
		
		// 作成ボタン
		const submitButton = buttonContainer.createEl('button', {text: 'Create'});
		submitButton.style.marginLeft = '0.5rem';
		submitButton.classList.add('mod-cta');
		submitButton.addEventListener('click', () => {
			const inputEl = inputSetting.controlEl.querySelector('input');
			onSubmit(inputEl ? inputEl.value : defaultValue);
			modal.close();
		});
		
		modal.open();
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
		
		// set group id
		groupSetting.setName(group.id);
		
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
		
		// Delete group button
		groupSetting.addButton(button => {
			button.setIcon('trash')
				.setTooltip('Delete Group')
				.onClick(async () => {
					// Delete group
					this.plugin.settings.commandGroups.splice(groupIndex, 1);
					// Optimize ID counters
					this.plugin.optimizeIdCounters();
					await this.plugin.saveSettingsAndRegisterCommands();
					this.display();
				});
			return button;
		});
		
		// Add command button
		groupSetting.addButton(button => {
			button.setIcon('plus-circle')
				.setTooltip('Add Command')
				.onClick(() => {
					// Open suggest modal
					new CommandSuggestModal(this.app, this.plugin, (selectedCommand) => {
						// Add selected command to group
						group.commands.push({
							id: this.plugin.generateCommandId(),
							obsidianCommand: selectedCommand.id
						});
						this.plugin.saveSettingsAndRegisterCommands().then(() => {
							this.display();
						});
					}).open();
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
				text: 'No commands in this group. Use the + button to add commands.'
			});
			emptyMessage.style.color = 'var(--text-muted)';
			emptyMessage.style.padding = '8px';
			emptyMessage.style.fontStyle = 'italic';
		}
		
		return commandsContainerEl;
	}
	
	// コマンド要素を作成するヘルパーメソッド
	createCommandElement(
		containerEl: HTMLElement, 
		command: {
			id: string;
			obsidianCommand: string;
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
			new CommandSuggestModal(this.app, this.plugin, (selectedCommand) => {
				// Set selected command
				command.obsidianCommand = selectedCommand.id;
				this.plugin.saveSettingsAndRegisterCommands().then(() => {
					this.display();
				});
			}).open();
		});
		
		// Delete command button
		commandSetting.addButton(button => {
			button.setIcon('trash')
				.setTooltip('Delete Command')
				.onClick(async () => {
					// Delete command
					const group = this.plugin.settings.commandGroups[groupIndex];
					group.commands.splice(commandIndex, 1);
					// Optimize ID counters
					this.plugin.optimizeIdCounters();
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
		
		const {containerEl} = this;

		containerEl.empty();
		
		containerEl.createEl('h2', {text: 'Command Group Settings'});
		
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
			`
		});
		
		// Add new command group button
		new Setting(containerEl)
			.addButton(button => button
				.setButtonText('+ Add New Command Group')
				.onClick(() => {
					try {
						// 次のグループIDを取得
						const nextGroupId = this.plugin.settings.nextGroupId;
						
						// 共通モーダル関数を使用
						this.showSimpleModal(
							'New Command Group',
							'Enter group name',
							`Group ${nextGroupId}`,
							async (groupName) => {
								await this.addNewGroup(groupName);
							}
						);
					} catch (error) {
						console.error('Error showing modal:', error);
						new Notice('Failed to show group creation modal. Check console for details.');
					}
				}));
	}
}
