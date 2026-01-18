import { describe, expect, test } from '@jest/globals';
import {
  generateGroupId,
  generateCommandId,
  isLegacyId,
  hasLegacyIds
} from '../../src/utils/id-generator';

describe('generateGroupId', () => {
  test('generates a non-empty string', () => {
    const id = generateGroupId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('generates unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateGroupId());
    }
    expect(ids.size).toBe(100);
  });

  test('generates ID with expected length', () => {
    const id = generateGroupId();
    expect(id.length).toBe(12);
  });

  test('generates ID with alphanumeric characters only', () => {
    const id = generateGroupId();
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
  });

  test('does not generate legacy format IDs', () => {
    for (let i = 0; i < 100; i++) {
      const id = generateGroupId();
      expect(isLegacyId(id)).toBe(false);
    }
  });
});

describe('generateCommandId', () => {
  test('generates a non-empty string', () => {
    const id = generateCommandId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  test('generates ID with "cmd_" prefix', () => {
    const id = generateCommandId();
    expect(id).toMatch(/^cmd_/);
  });

  test('generates unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateCommandId());
    }
    expect(ids.size).toBe(100);
  });

  test('generates ID with expected format', () => {
    const id = generateCommandId();
    expect(id.length).toBe(16); // "cmd_" (4) + 12 chars
    expect(id.startsWith('cmd_')).toBe(true);
  });

  test('generates ID with alphanumeric characters after prefix', () => {
    const id = generateCommandId();
    const hashPart = id.substring(4); // Remove "cmd_" prefix
    expect(hashPart).toMatch(/^[A-Za-z0-9]+$/);
  });

  test('does not generate legacy format IDs', () => {
    for (let i = 0; i < 100; i++) {
      const id = generateCommandId();
      expect(isLegacyId(id)).toBe(false);
    }
  });
});

describe('isLegacyId', () => {
  describe('returns true for legacy IDs', () => {
    test('recognizes legacy group IDs', () => {
      expect(isLegacyId('group1')).toBe(true);
      expect(isLegacyId('group2')).toBe(true);
      expect(isLegacyId('group123')).toBe(true);
    });

    test('recognizes legacy command IDs', () => {
      expect(isLegacyId('command1')).toBe(true);
      expect(isLegacyId('command2')).toBe(true);
      expect(isLegacyId('command999')).toBe(true);
    });
  });

  describe('returns false for non-legacy IDs', () => {
    test('rejects hash-based group IDs', () => {
      expect(isLegacyId('abc123def456')).toBe(false);
      expect(isLegacyId('XyZ789AbC012')).toBe(false);
    });

    test('rejects hash-based command IDs', () => {
      expect(isLegacyId('cmd_abc123def456')).toBe(false);
      expect(isLegacyId('cmd_XyZ789AbC012')).toBe(false);
    });

    test('rejects invalid formats', () => {
      expect(isLegacyId('group')).toBe(false); // No number
      expect(isLegacyId('command')).toBe(false); // No number
      expect(isLegacyId('grp1')).toBe(false); // Wrong prefix
      expect(isLegacyId('cmd1')).toBe(false); // Wrong prefix
      expect(isLegacyId('group_1')).toBe(false); // Underscore
      expect(isLegacyId('1group')).toBe(false); // Number first
    });
  });
});

describe('hasLegacyIds', () => {
  test('returns false for empty settings', () => {
    const settings = { commandGroups: [] };
    expect(hasLegacyIds(settings)).toBe(false);
  });

  test('returns false when all IDs are hash-based', () => {
    const settings = {
      commandGroups: [
        {
          id: 'abc123def456',
          commands: [
            { id: 'cmd_xyz789abc123' },
            { id: 'cmd_mno456pqr789' }
          ]
        },
        {
          id: 'ghi789jkl012',
          commands: []
        }
      ]
    };
    expect(hasLegacyIds(settings)).toBe(false);
  });

  test('returns true when group has legacy ID', () => {
    const settings = {
      commandGroups: [
        {
          id: 'group1',
          commands: [
            { id: 'cmd_xyz789abc123' }
          ]
        }
      ]
    };
    expect(hasLegacyIds(settings)).toBe(true);
  });

  test('returns true when command has legacy ID', () => {
    const settings = {
      commandGroups: [
        {
          id: 'abc123def456',
          commands: [
            { id: 'command1' }
          ]
        }
      ]
    };
    expect(hasLegacyIds(settings)).toBe(true);
  });

  test('returns true when multiple legacy IDs exist', () => {
    const settings = {
      commandGroups: [
        {
          id: 'group1',
          commands: [
            { id: 'command1' },
            { id: 'command2' }
          ]
        },
        {
          id: 'group2',
          commands: [
            { id: 'cmd_xyz789abc123' }
          ]
        }
      ]
    };
    expect(hasLegacyIds(settings)).toBe(true);
  });

  test('returns true on first legacy ID found', () => {
    const settings = {
      commandGroups: [
        {
          id: 'group1', // Should return true here
          commands: []
        },
        {
          id: 'abc123def456',
          commands: [
            { id: 'cmd_xyz789abc123' }
          ]
        }
      ]
    };
    expect(hasLegacyIds(settings)).toBe(true);
  });
});
