import { App, Command } from 'obsidian';

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

export interface CommandGroupSettings {
	commandGroups: {
		id: string;
		name: string; // Group name
		commands: {
			id: string;
			obsidianCommand: string; // Obsidian command ID
			sequenceKey?: string; // Optional sequence key (Vim-style notation or single character)
		}[];
	}[];
	// Note: nextGroupId and nextCommandId have been removed in favor of hash-based IDs
}

export const DEFAULT_SETTINGS: CommandGroupSettings = {
	commandGroups: [
		{
			id: 'grp_example_001',
			name: 'Example Group',
			commands: [
				{ id: 'cmd_example_001', obsidianCommand: 'app:go-back' },
				{ id: 'cmd_example_002', obsidianCommand: 'app:go-forward' },
				{ id: 'cmd_example_003', obsidianCommand: 'app:open-settings' }
			]
		}
	]
};
