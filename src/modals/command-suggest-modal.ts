import { App, Command, SuggestModal } from 'obsidian';

/**
 * Modal for selecting an Obsidian command from all available commands
 * Used when adding commands to a group or changing a command
 */
export class CommandSuggestModal extends SuggestModal<Command> {
	private onSelect: (command: Command) => void;

	constructor(app: App, onSelect: (command: Command) => void) {
		super(app);
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
