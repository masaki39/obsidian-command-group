import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, SuggestModal } from 'obsidian';

// Extend Obsidian type definitions
declare module 'obsidian' {
	interface App {
		commands: {
			executeCommandById(id: string): boolean;
			findCommand(id: string): Command | null;
			listCommands(): Command[];
		};
	}

	interface Command {
		id: string;
		name: string;
	}
}

// Obsidian command type
type ObsidianCommand = {
	id: string;
	name: string;
};

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
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

const DEFAULT_SETTINGS: MyPluginSettings = {
	commandGroups: [
		{
			id: 'group1',
			name: 'Command Group 1',
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

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

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
		this.settings.commandGroups.forEach(group => {
			const groupIdNumber = parseInt(group.id.replace('group', ''));
			if (!isNaN(groupIdNumber)) {
				usedGroupIds.add(groupIdNumber);
			}
		});
		
		// Get the set of command IDs currently in use
		const usedCommandIds = new Set<number>();
		this.settings.commandGroups.forEach(group => {
			group.commands.forEach(cmd => {
				const cmdIdNumber = parseInt(cmd.id.replace('command', ''));
				if (!isNaN(cmdIdNumber)) {
					usedCommandIds.add(cmdIdNumber);
				}
			});
		});
		
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
		await this.loadSettings();

		// Optimize ID counters
		this.optimizeIdCounters();

		// Register commands for each command group
		this.registerGroupCommands();

		// Add settings tab
		this.addSettingTab(new CommandSettingTab(this.app, this));
	}

	onunload() {
		// Cleanup when plugin is disabled
		// Clean up registered commands when the plugin is disabled
		const commands = (this.app as any).commands;
		if (commands && typeof commands.removeCommand === 'function') {
			// Find commands registered by this plugin
			const pluginCommands = this.app.commands.listCommands()
				.filter(cmd => cmd.id.startsWith(`${this.manifest.id}:`));
			
			// Remove each command
			pluginCommands.forEach(cmd => {
				commands.removeCommand(cmd.id);
			});
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Save settings and re-register commands
	async saveSettingsAndRegisterCommands() {
		await this.saveSettings();
		this.registerGroupCommands(); // Re-register commands
	}

	// Register Obsidian commands for each command group
	registerGroupCommands() {
		// Get currently registered plugin commands
		const existingCommands = this.app.commands.listCommands()
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
					// If there are no commands in the group, show a notification
					if (group.commands.length === 0) {
						new Notice('No commands in this group');
						return;
					}
					
					// 常に選択モーダルを表示する（コマンドが1つでも）
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
	}
}

// Modal for selecting a command from a group
class GroupCommandSuggestModal extends SuggestModal<{id: string, name: string, command: string}> {
	plugin: MyPlugin;
	group: {
		id: string;
		name: string;
		commands: {
			id: string;
			obsidianCommand: string;
		}[];
	};

	constructor(app: App, plugin: MyPlugin, group: {
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
			const success = this.app.commands.executeCommandById(item.command);
			if (!success) {
				new Notice(`Failed to execute command: ${item.name}`);
			}
		} catch (error) {
			console.error(`Error executing command ${item.command}:`, error);
			new Notice(`Error executing command: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}

class CommandSuggestModal extends SuggestModal<ObsidianCommand> {
	plugin: MyPlugin;
	onSelect: (command: ObsidianCommand) => void;

	constructor(app: App, plugin: MyPlugin, onSelect: (command: ObsidianCommand) => void) {
		super(app);
		this.plugin = plugin;
		this.onSelect = onSelect;
		this.setPlaceholder('Search commands...');
	}

	getSuggestions(query: string): ObsidianCommand[] {
		const commands = this.app.commands.listCommands();
		if (!query) {
			return commands;
		}
		
		const lowerQuery = query.toLowerCase();
		return commands.filter(command => 
			command.name.toLowerCase().includes(lowerQuery) || 
			command.id.toLowerCase().includes(lowerQuery)
		);
	}

	renderSuggestion(command: ObsidianCommand, el: HTMLElement): void {
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

	onChooseSuggestion(command: ObsidianCommand, evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(command);
	}
}

class CommandSettingTab extends PluginSettingTab {
	plugin: MyPlugin;
	// イベントリスナーの参照を保持するための配列
	private eventListeners: Array<{element: HTMLElement, type: string, listener: EventListener}> = [];

	constructor(app: App, plugin: MyPlugin) {
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
			element.removeEventListener(type, listener);
		});
		this.eventListeners = [];
	}

	// 新しいグループを追加する共通ロジック
	async addNewGroup(groupName: string) {
		// Add new group
		this.plugin.settings.commandGroups.push({
			id: this.plugin.generateGroupId(),
			name: groupName,
			commands: []
		});
		
		await this.plugin.saveSettingsAndRegisterCommands();
		this.display();
		
		// Open suggest modal to add command
		new CommandSuggestModal(this.app, this.plugin, (selectedCommand) => {
			// Add command to the last added group
			const lastGroup = this.plugin.settings.commandGroups[this.plugin.settings.commandGroups.length - 1];
			lastGroup.commands.push({
				id: this.plugin.generateCommandId(),
				obsidianCommand: selectedCommand.id
			});
			
			this.plugin.saveSettingsAndRegisterCommands().then(() => {
				this.display();
			});
		}).open();
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
		
		// Variables to track dragged items - グループとコマンドで別々の変数を使用
		let draggedGroupItem: HTMLElement | null = null;
		let draggedGroupIndex: number = -1;
		let draggedCommandItem: HTMLElement | null = null;
		let draggedCommandIndex: number = -1;
		
		// Display existing command groups
		this.plugin.settings.commandGroups.forEach((group, groupIndex) => {
			const groupEl = commandListEl.createEl('div', {
				cls: 'command-group-container',
				attr: {
					'data-index': groupIndex.toString(),
					'draggable': 'true'
				}
			});
			
			// Add drag handle
			const dragHandleEl = groupEl.createEl('div', {
				cls: 'drag-handle',
				text: '⋮⋮'
			});
			
			// Group setting
			const groupSetting = new Setting(groupEl);
			
			// Group name input field (no label)
			groupSetting.addText(text => {
				text.setValue(group.name)
					.setPlaceholder('Group name')
					.onChange(async (value) => {
						// Update only the group name, not the ID
						group.name = value;
						await this.plugin.saveSettingsAndRegisterCommands();
					});
				return text;
			});
			
			// Copy ID button
			groupSetting.addButton(button => {
				button.setIcon('copy')
					.setTooltip('Copy Group Command ID')
					.onClick(() => {
						// Copy command ID to clipboard with error handling
						const commandId = `${this.plugin.manifest.id}:${group.id}`;
						navigator.clipboard.writeText(commandId)
							.then(() => {
								new Notice(`Group Command ID copied to clipboard`);
							})
							.catch(err => {
								new Notice(`Failed to copy: ${err.message}`);
							});
					});
				return button;
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
			
			// Group drag & drop events - イベントリスナー管理を改善
			this.addListener(groupEl, 'dragstart', (e: Event) => {
				const dragEvent = e as DragEvent;
				draggedGroupItem = groupEl;
				draggedGroupIndex = groupIndex;
				draggedCommandItem = null;
				draggedCommandIndex = -1;
				
				if (dragEvent.dataTransfer) {
					dragEvent.dataTransfer.setData('application/group-data', JSON.stringify({
						groupIndex
					}));
				}
				
				setTimeout(() => {
					groupEl.classList.add('dragging');
				}, 0);
			});
			
			this.addListener(groupEl, 'dragend', () => {
				groupEl.classList.remove('dragging');
				draggedGroupItem = null;
				draggedGroupIndex = -1;
			});
			
			this.addListener(groupEl, 'dragover', (e: Event) => {
				e.preventDefault();
				groupEl.classList.add('drag-over');
			});
			
			this.addListener(groupEl, 'dragleave', () => {
				groupEl.classList.remove('drag-over');
			});
			
			this.addListener(groupEl, 'drop', async (e: Event) => {
				e.preventDefault();
				e.stopPropagation();
				groupEl.classList.remove('drag-over');
				
				const dragEvent = e as DragEvent;
				
				// 新しいデータ形式を使用
				let sourceData = { groupIndex: -1 };
				try {
					const dataStr = dragEvent.dataTransfer?.getData('application/group-data');
					if (dataStr) {
						sourceData = JSON.parse(dataStr);
					}
				} catch (error) {
					console.error('Error parsing drag data:', error);
					return;
				}
				
				const sourceGroupIndex = sourceData.groupIndex;
				
				if (sourceGroupIndex === -1 || sourceGroupIndex === groupIndex) return;
				
				// Swap groups
				const draggedGroup = this.plugin.settings.commandGroups[sourceGroupIndex];
				this.plugin.settings.commandGroups.splice(sourceGroupIndex, 1);
				this.plugin.settings.commandGroups.splice(groupIndex, 0, draggedGroup);
				
				await this.plugin.saveSettingsAndRegisterCommands();
				this.display();
			});
			
			// Command list container
			const commandsContainerEl = groupEl.createEl('div', {
				cls: 'commands-container'
			});
			
			// Add drop events to command container
			this.addListener(commandsContainerEl, 'dragover', (e: Event) => {
				e.preventDefault();
				e.stopPropagation();
				commandsContainerEl.classList.add('commands-container-drag-over');
			});
			
			this.addListener(commandsContainerEl, 'dragleave', () => {
				commandsContainerEl.classList.remove('commands-container-drag-over');
			});
			
			this.addListener(commandsContainerEl, 'drop', async (e: Event) => {
				e.preventDefault();
				e.stopPropagation();
				commandsContainerEl.classList.remove('commands-container-drag-over');
				
				const dragEvent = e as DragEvent;
				
				// 新しいデータ形式を使用
				let sourceData = { groupIndex: -1, commandIndex: -1 };
				try {
					const dataStr = dragEvent.dataTransfer?.getData('application/command-data');
					if (dataStr) {
						sourceData = JSON.parse(dataStr);
					}
				} catch (error) {
					console.error('Error parsing drag data:', error);
					return;
				}
				
				const sourceGroupIndex = sourceData.groupIndex;
				const sourceCommandIndex = sourceData.commandIndex;
				
				if (sourceGroupIndex === -1 || sourceCommandIndex === -1) return;
				
				// Moving within the same group
				if (sourceGroupIndex === groupIndex) {
					if (sourceCommandIndex === -1) return;
					
					// Move command to the end of the same group
					const draggedCommand = this.plugin.settings.commandGroups[groupIndex].commands[sourceCommandIndex];
					this.plugin.settings.commandGroups[groupIndex].commands.splice(sourceCommandIndex, 1);
					this.plugin.settings.commandGroups[groupIndex].commands.push(draggedCommand);
				} else {
					// Moving between different groups
					const sourceGroup = this.plugin.settings.commandGroups[sourceGroupIndex];
					const targetGroup = this.plugin.settings.commandGroups[groupIndex];
					
					if (!sourceGroup || !targetGroup) return;
					
					// Move command
					const draggedCommand = sourceGroup.commands[sourceCommandIndex];
					sourceGroup.commands.splice(sourceCommandIndex, 1);
					targetGroup.commands.push(draggedCommand);
				}
				
				await this.plugin.saveSettingsAndRegisterCommands();
				this.display();
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
			
			// Display commands
			group.commands.forEach((command, commandIndex) => {
				// Get Obsidian command
				const obsidianCommand = this.app.commands.findCommand(command.obsidianCommand);
				
				const commandItemEl = commandsContainerEl.createEl('div', {
					cls: 'command-item-container',
					attr: {
						'data-group-index': groupIndex.toString(),
						'data-command-index': commandIndex.toString(),
						'draggable': 'true'
					}
				});
				
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
							group.commands.splice(commandIndex, 1);
							// Optimize ID counters
							this.plugin.optimizeIdCounters();
							await this.plugin.saveSettingsAndRegisterCommands();
							this.display();
						});
					return button;
				});
				
				// Command drag & drop events - コマンド用の変数を使用
				this.addListener(commandItemEl, 'dragstart', (e: Event) => {
					e.stopPropagation(); // Prevent triggering parent drag event
					const dragEvent = e as DragEvent;
					draggedCommandItem = commandItemEl;
					draggedCommandIndex = commandIndex;
					draggedGroupItem = null;
					draggedGroupIndex = -1;
					
					// Ensure dataTransfer is available
					if (dragEvent.dataTransfer) {
						// より明確なデータ形式を使用
						dragEvent.dataTransfer.setData('application/command-data', JSON.stringify({
							groupIndex,
							commandIndex
						}));
					}
					
					setTimeout(() => {
						commandItemEl.classList.add('dragging');
					}, 0);
				});
				
				this.addListener(commandItemEl, 'dragend', () => {
					commandItemEl.classList.remove('dragging');
					draggedCommandItem = null;
					draggedCommandIndex = -1;
				});
				
				this.addListener(commandItemEl, 'dragover', (e: Event) => {
					e.preventDefault();
					e.stopPropagation(); // Prevent triggering parent drag event
					commandItemEl.classList.add('drag-over');
				});
				
				this.addListener(commandItemEl, 'dragleave', () => {
					commandItemEl.classList.remove('drag-over');
				});
				
				this.addListener(commandItemEl, 'drop', async (e: Event) => {
					e.preventDefault();
					e.stopPropagation(); // Prevent triggering parent drop event
					commandItemEl.classList.remove('drag-over');
					
					const dragEvent = e as DragEvent;
					
					// 新しいデータ形式を使用
					let sourceData = { groupIndex: -1, commandIndex: -1 };
					try {
						const dataStr = dragEvent.dataTransfer?.getData('application/command-data');
						if (dataStr) {
							sourceData = JSON.parse(dataStr);
						}
					} catch (error) {
						console.error('Error parsing drag data:', error);
						return;
					}
					
					const sourceGroupIndex = sourceData.groupIndex;
					const sourceCommandIndex = sourceData.commandIndex;
					
					if (sourceGroupIndex === -1 || sourceCommandIndex === -1) return;
					
					// Moving within the same group
					if (sourceGroupIndex === groupIndex) {
						if (sourceCommandIndex === -1) return;
						
						// Move command to the end of the same group
						const draggedCommand = this.plugin.settings.commandGroups[groupIndex].commands[sourceCommandIndex];
						this.plugin.settings.commandGroups[groupIndex].commands.splice(sourceCommandIndex, 1);
						this.plugin.settings.commandGroups[groupIndex].commands.push(draggedCommand);
					} else {
						// Moving between different groups
						const sourceGroup = this.plugin.settings.commandGroups[sourceGroupIndex];
						const targetGroup = this.plugin.settings.commandGroups[groupIndex];
						
						if (!sourceGroup || !targetGroup) return;
						
						// Move command
						const draggedCommand = sourceGroup.commands[sourceCommandIndex];
						sourceGroup.commands.splice(sourceCommandIndex, 1);
						targetGroup.commands.push(draggedCommand);
					}
					
					await this.plugin.saveSettingsAndRegisterCommands();
					this.display();
				});
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
			.setName('Add New Command Group')
			.addButton(button => button
				.setButtonText('Add')
				.onClick(() => {
					// Show text input dialog
					const modal = new Modal(this.app);
					modal.titleEl.setText('New Command Group');
					
					const contentEl = modal.contentEl;
					const inputContainer = contentEl.createDiv();
					
					// Get next group ID
					const nextGroupId = this.plugin.settings.nextGroupId;
					
					// Group name input field
					const groupNameSetting = new Setting(inputContainer)
						.setName('Group Name')
						.addText(text => {
							// Include ID in default name (remove "New")
							text.setValue(`Group ${nextGroupId}`)
								.setPlaceholder('Enter group name');
							
							// Select all text when input field is focused
							const inputEl = text.inputEl;
							inputEl.addEventListener('focus', () => {
								inputEl.select();
							});
							
							// Automatically focus and select all text when modal opens
							setTimeout(() => {
								inputEl.focus();
								inputEl.select();
							}, 50);
							
							// Add Enter key functionality to complete input
							// Flag to track IME composition state
							let isComposing = false;
							
							// IME composition start
							inputEl.addEventListener('compositionstart', () => {
								isComposing = true;
							});
							
							// IME composition end
							inputEl.addEventListener('compositionend', () => {
								isComposing = false;
							});
							
							inputEl.addEventListener('keydown', async (e) => {
								// Ignore Enter key during IME composition
								if (isComposing) return;
								
								if (e.key === 'Enter') {
									e.preventDefault();
									
									const groupName = inputEl.value || `Group ${nextGroupId}`;
									
									// 共通ロジックを使用
									await this.addNewGroup(groupName);
									modal.close();
								}
							});
						});
					
					// Button container
					const buttonContainer = contentEl.createDiv();
					buttonContainer.style.display = 'flex';
					buttonContainer.style.justifyContent = 'flex-end';
					buttonContainer.style.marginTop = '1rem';
					
					// Cancel button
					const cancelButton = buttonContainer.createEl('button', {text: 'Cancel'});
					cancelButton.addEventListener('click', () => {
						modal.close();
					});
					
					// Create button
					const createButton = buttonContainer.createEl('button', {text: 'Create'});
					createButton.style.marginLeft = '0.5rem';
					createButton.classList.add('mod-cta');
					createButton.addEventListener('click', async () => {
						const inputEl = groupNameSetting.controlEl.querySelector('input');
						const groupName = inputEl ? inputEl.value : `Group ${nextGroupId}`;
						
						// 共通ロジックを使用
						await this.addNewGroup(groupName);
						modal.close();
					});
					
					modal.open();
				}));
	}
}
