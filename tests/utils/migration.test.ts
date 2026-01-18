import { describe, expect, test, beforeEach } from '@jest/globals';
import { migrateSettingsToHashIds } from '../../src/utils/migration';

describe('migrateSettingsToHashIds', () => {
  describe('when no migration is needed', () => {
    test('returns not migrated for empty settings', () => {
      const settings = { commandGroups: [] };
      const result = migrateSettingsToHashIds(settings);

      expect(result.migrated).toBe(false);
      expect(result.groupsUpdated).toBe(0);
      expect(result.commandsUpdated).toBe(0);
    });

    test('returns not migrated when all IDs are already hash-based', () => {
      const settings = {
        commandGroups: [
          {
            id: 'abc123def456',
            name: 'Group 1',
            commands: [
              { id: 'cmd_xyz789abc123', obsidianCommand: 'test-command' }
            ]
          }
        ]
      };
      const result = migrateSettingsToHashIds(settings);

      expect(result.migrated).toBe(false);
      expect(result.groupsUpdated).toBe(0);
      expect(result.commandsUpdated).toBe(0);
    });

    test('removes legacy fields even when IDs are hash-based', () => {
      const settings = {
        commandGroups: [
          {
            id: 'abc123def456',
            name: 'Group 1',
            commands: []
          }
        ],
        nextGroupId: 5,
        nextCommandId: 10
      };

      const result = migrateSettingsToHashIds(settings);

      expect(result.migrated).toBe(true);
      expect(result.groupsUpdated).toBe(0);
      expect(result.commandsUpdated).toBe(0);
      expect(settings).not.toHaveProperty('nextGroupId');
      expect(settings).not.toHaveProperty('nextCommandId');
    });
  });

  describe('when migration is needed', () => {
    test('migrates legacy group IDs', () => {
      const settings = {
        commandGroups: [
          {
            id: 'group1',
            name: 'Group 1',
            commands: []
          },
          {
            id: 'group2',
            name: 'Group 2',
            commands: []
          }
        ]
      };

      const result = migrateSettingsToHashIds(settings);

      expect(result.migrated).toBe(true);
      expect(result.groupsUpdated).toBe(2);
      expect(result.commandsUpdated).toBe(0);

      // Verify IDs are now hash-based
      expect(settings.commandGroups[0].id).not.toBe('group1');
      expect(settings.commandGroups[1].id).not.toBe('group2');
      expect(settings.commandGroups[0].id).toMatch(/^[A-Za-z0-9]{12}$/);
      expect(settings.commandGroups[1].id).toMatch(/^[A-Za-z0-9]{12}$/);
    });

    test('migrates legacy command IDs', () => {
      const settings = {
        commandGroups: [
          {
            id: 'abc123def456',
            name: 'Group 1',
            commands: [
              { id: 'command1', obsidianCommand: 'test-command-1' },
              { id: 'command2', obsidianCommand: 'test-command-2' }
            ]
          }
        ]
      };

      const result = migrateSettingsToHashIds(settings);

      expect(result.migrated).toBe(true);
      expect(result.groupsUpdated).toBe(0);
      expect(result.commandsUpdated).toBe(2);

      // Verify command IDs are now hash-based
      expect(settings.commandGroups[0].commands[0].id).not.toBe('command1');
      expect(settings.commandGroups[0].commands[1].id).not.toBe('command2');
      expect(settings.commandGroups[0].commands[0].id).toMatch(/^cmd_[A-Za-z0-9]{12}$/);
      expect(settings.commandGroups[0].commands[1].id).toMatch(/^cmd_[A-Za-z0-9]{12}$/);
    });

    test('migrates both group and command IDs', () => {
      const settings = {
        commandGroups: [
          {
            id: 'group1',
            name: 'Group 1',
            commands: [
              { id: 'command1', obsidianCommand: 'test-command-1' },
              { id: 'command2', obsidianCommand: 'test-command-2' }
            ]
          },
          {
            id: 'group2',
            name: 'Group 2',
            commands: [
              { id: 'command3', obsidianCommand: 'test-command-3' }
            ]
          }
        ]
      };

      const result = migrateSettingsToHashIds(settings);

      expect(result.migrated).toBe(true);
      expect(result.groupsUpdated).toBe(2);
      expect(result.commandsUpdated).toBe(3);

      // Verify all IDs are now hash-based
      settings.commandGroups.forEach(group => {
        expect(group.id).toMatch(/^[A-Za-z0-9]{12}$/);
        group.commands.forEach(command => {
          expect(command.id).toMatch(/^cmd_[A-Za-z0-9]{12}$/);
        });
      });
    });

    test('removes legacy nextGroupId and nextCommandId fields', () => {
      const settings = {
        commandGroups: [
          {
            id: 'group1',
            name: 'Group 1',
            commands: [
              { id: 'command1', obsidianCommand: 'test-command' }
            ]
          }
        ],
        nextGroupId: 2,
        nextCommandId: 2
      };

      migrateSettingsToHashIds(settings);

      expect(settings).not.toHaveProperty('nextGroupId');
      expect(settings).not.toHaveProperty('nextCommandId');
    });

    test('preserves other group properties', () => {
      const settings = {
        commandGroups: [
          {
            id: 'group1',
            name: 'My Group',
            commands: []
          }
        ]
      };

      migrateSettingsToHashIds(settings);

      expect(settings.commandGroups[0].name).toBe('My Group');
    });

    test('preserves other command properties', () => {
      const settings = {
        commandGroups: [
          {
            id: 'abc123def456',
            name: 'Group 1',
            commands: [
              {
                id: 'command1',
                obsidianCommand: 'my-command',
                sequenceKey: 'j'
              }
            ]
          }
        ]
      };

      migrateSettingsToHashIds(settings);

      const command = settings.commandGroups[0].commands[0];
      expect(command.obsidianCommand).toBe('my-command');
      expect(command.sequenceKey).toBe('j');
    });

    test('handles mixed legacy and hash-based IDs', () => {
      const settings = {
        commandGroups: [
          {
            id: 'group1', // Legacy
            name: 'Group 1',
            commands: [
              { id: 'cmd_xyz789abc123', obsidianCommand: 'test-1' }, // Hash-based
              { id: 'command1', obsidianCommand: 'test-2' } // Legacy
            ]
          },
          {
            id: 'abc123def456', // Hash-based
            name: 'Group 2',
            commands: [
              { id: 'command2', obsidianCommand: 'test-3' } // Legacy
            ]
          }
        ]
      };

      const result = migrateSettingsToHashIds(settings);

      expect(result.migrated).toBe(true);
      expect(result.groupsUpdated).toBe(1); // Only group1
      expect(result.commandsUpdated).toBe(2); // command1 and command2

      // Verify only legacy IDs were updated
      expect(settings.commandGroups[0].id).toMatch(/^[A-Za-z0-9]{12}$/);
      expect(settings.commandGroups[1].id).toBe('abc123def456'); // Unchanged

      expect(settings.commandGroups[0].commands[0].id).toBe('cmd_xyz789abc123'); // Unchanged
      expect(settings.commandGroups[0].commands[1].id).toMatch(/^cmd_[A-Za-z0-9]{12}$/);
      expect(settings.commandGroups[1].commands[0].id).toMatch(/^cmd_[A-Za-z0-9]{12}$/);
    });
  });

  describe('idempotency', () => {
    test('running migration twice produces same result', () => {
      const settings = {
        commandGroups: [
          {
            id: 'group1',
            name: 'Group 1',
            commands: [
              { id: 'command1', obsidianCommand: 'test-command' }
            ]
          }
        ]
      };

      // First migration
      const result1 = migrateSettingsToHashIds(settings);
      const groupIdAfterFirstMigration = settings.commandGroups[0].id;
      const commandIdAfterFirstMigration = settings.commandGroups[0].commands[0].id;

      // Second migration (should do nothing)
      const result2 = migrateSettingsToHashIds(settings);

      expect(result1.migrated).toBe(true);
      expect(result1.groupsUpdated).toBe(1);
      expect(result1.commandsUpdated).toBe(1);

      expect(result2.migrated).toBe(false);
      expect(result2.groupsUpdated).toBe(0);
      expect(result2.commandsUpdated).toBe(0);

      // IDs should remain the same after second migration
      expect(settings.commandGroups[0].id).toBe(groupIdAfterFirstMigration);
      expect(settings.commandGroups[0].commands[0].id).toBe(commandIdAfterFirstMigration);
    });
  });
});
