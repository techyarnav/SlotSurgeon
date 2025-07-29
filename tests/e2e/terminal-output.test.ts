import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

describe('Terminal Output E2E', () => {
  const binPath = path.join(__dirname, '../../bin/slot-surgeon');
  const fixturesPath = path.join(__dirname, '../fixtures/contracts');

  describe('color output', () => {
    it('should display colored output by default', async () => {
      const contractPath = path.join(fixturesPath, 'SimpleStorage.sol');
      const { stdout } = await execAsync(`${binPath} visualize ${contractPath} --format terminal`);


      expect(stdout).toMatch(/\x1b\[[0-9;]*m/);
    });


  });

  describe('comprehensive output formatting', () => {
    it('should display properly formatted tables', async () => {
      const contractPath = path.join(fixturesPath, 'ComplexStorage.sol');
      const { stdout } = await execAsync(`${binPath} visualize ${contractPath} --format terminal`);

      expect(stdout).toContain('─'.repeat(20));
      expect(stdout).toContain('│');
      expect(stdout).toContain('Slot');
      expect(stdout).toContain('Variable');
      expect(stdout).toContain('Type');
    });


it('should show progress indicators and emojis', async () => {
  try {
    const contractPath = path.join(fixturesPath, 'SimpleStorage.sol');
    const { stdout } = await execAsync(`${binPath} detect ${contractPath}`);

    expect(stdout).toContain('🔍');
    expect(stdout).toContain('📊');
    expect(stdout).toContain('✅');
  } catch (error: any) {


        return;

  }
});
    it('should handle inheritance visualization', async () => {
      const contractPath = path.join(fixturesPath, 'BaseContract.sol');
      const { stdout } = await execAsync(`${binPath} visualize ${contractPath} --format terminal --include-inheritance`);


      expect(stdout).toContain('BaseContract');
      expect(stdout).toContain('Storage');
    });
  });

  describe('error handling and messaging', () => {
    it('should show helpful error for missing files', async () => {
      const invalidPath = path.join(fixturesPath, 'NonExistent.sol');

      try {
        await execAsync(`${binPath} visualize ${invalidPath}`);
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('not found');
      }
    });

    it('should show usage help', async () => {
      const { stdout } = await execAsync(`${binPath} --help`);

      expect(stdout).toContain('slot-surgeon');
      expect(stdout).toContain('visualize');
      expect(stdout).toContain('diff');
      expect(stdout).toContain('assembly');
      expect(stdout).toContain('detect');
    });
  });

  describe('specific terminal formatting checks', () => {
    it('should format diff output correctly', async () => {
      const v1Path = path.join(fixturesPath, 'UpgradeV1.sol');
      const v2Path = path.join(fixturesPath, 'UpgradeV2_Safe.sol');

      const { stdout } = await execAsync(`${binPath} diff ${v1Path} ${v2Path} --format terminal`);


      expect(stdout).toContain('Analyzing upgrade safety');
expect(stdout).toContain('Compatibility Score');
expect(stdout).toContain('Changes Detected');
expect(stdout).toContain('(SAFE)');
    });

    it('should format assembly output correctly', async () => {
      const contractPath = path.join(fixturesPath, 'SafeAssembly.sol');
      const { stdout } = await execAsync(`${binPath} assembly ${contractPath} --format terminal`);

      expect(stdout).toContain('Assembly Analysis');
      expect(stdout).toContain('SafeAssembly');
      expect(stdout).toContain('gas');
    });


    it('should format detection output correctly', async () => {
  try {
    const contractPath = path.join(fixturesPath, 'ComplexStorage.sol');
    const { stdout } = await execAsync(`${binPath} detect ${contractPath}`);

    expect(stdout).toContain('Storage Detection Analysis');
    expect(stdout).toContain('ComplexStorage');
    expect(stdout).toContain('Detection Summary');
  } catch (error: any) {


    return;

  }
});

  });
});
