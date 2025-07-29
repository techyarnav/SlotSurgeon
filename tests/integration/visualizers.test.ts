import { SolidityParser } from '../../src/core/parser/solidity-parser';
import { SlotCalculator } from '../../src/core/slot-mapper/slot-calculator';
import { AsciiRenderer } from '../../src/core/visualizers/ascii-renderer';
import { TerminalVisualizer } from '../../src/core/visualizers/terminal-visualizer';
import { TerminalDiffVisualizer } from '../../src/core/visualizers/terminal-diff-visualizer';
import * as path from 'path';

describe('Visualizer Integration', () => {
  const fixturesPath = path.join(__dirname, '../fixtures/contracts');

  describe('ASCII Renderer', () => {
    it('should render storage layout as ASCII', async () => {
      const contractPath = path.join(fixturesPath, 'SimpleStorage.sol');
      const parser = new SolidityParser(contractPath);
      const contracts = await parser.parse();
      const slotMapping = SlotCalculator.calculateSlots(contracts[0]);

      const renderer = new AsciiRenderer(slotMapping, {
        color: false,
        legend: true,
        showTable: true,
        showSideDetails: true
      });

      const output = renderer.render();

      expect(output).toContain('SimpleStorage');
      expect(output).toContain('Slot');
      expect(output).toContain('value');
      expect(output).toContain('owner');
    });

    it('should handle empty contracts', async () => {
      const emptySlotMapping = {
        contractName: 'Empty',
        variables: [],
        totalSlots: 0,

        packedSlots: []

      };

      const renderer = new AsciiRenderer(emptySlotMapping, { color: false });
      const output = renderer.render();

      expect(output).toContain('Empty');

    });
  });

  describe('Terminal Visualizer', () => {
    it('should generate terminal visualization', async () => {
      const contractPath = path.join(fixturesPath, 'ComplexStorage.sol');
      const parser = new SolidityParser(contractPath);
      const contracts = await parser.parse();
      const slotMapping = SlotCalculator.calculateSlots(contracts[0]);

      const visualizer = new TerminalVisualizer(slotMapping, contracts[0], contractPath);
      const output = await visualizer.generate( {
        includeInheritance: false,
        showCollisions: false,
        useColors: false
      });

      expect(output).toContain('ComplexStorage');
      expect(output).toContain('Storage Layout');
      expect(output).toContain('Storage Summary');
    });
  });

  describe('Terminal Diff Visualizer', () => {
    it('should generate diff visualization', async () => {
      const v1Path = path.join(fixturesPath, 'UpgradeV1.sol');
      const v2Path = path.join(fixturesPath, 'UpgradeV2_Safe.sol');

      const parser1 = new SolidityParser(v1Path);
      const parser2 = new SolidityParser(v2Path);

      const contracts1 = await parser1.parse();
      const contracts2 = await parser2.parse();

      const mapping1 = SlotCalculator.calculateSlots(contracts1[0]);
      const mapping2 = SlotCalculator.calculateSlots(contracts2[0]);

      const visualizer = new TerminalDiffVisualizer(
        mapping1, mapping2, contracts1[0], contracts2[0], v1Path, v2Path
      );

      const output = await visualizer.generate( {
        useColors: false,
        detailed: true,
        safetyOnly: false,
        migrationTips: true
      });

      expect(output).toContain('Storage Layout Comparison');
      expect(output).toContain('Side-by-Side Layout');
      expect(output).toContain('Upgrade Safety Analysis');
      expect(output).toContain('Migration Recommendations');
    });
  });
});
