import { SolidityParser } from '../../src/core/parser/solidity-parser';
import { FileSystemUtils } from '../../src/utils/file-system';
import * as path from 'path';

describe('SolidityParser', () => {
  const fixturesPath = path.join(__dirname, '../fixtures/contracts');

  describe('parse()', () => {
    it('should parse simple storage contract', async () => {
      const contractPath = path.join(fixturesPath, 'SimpleStorage.sol');
      const parser = new SolidityParser(contractPath);

      const contracts = await parser.parse();

      expect(contracts).toHaveLength(1);
      expect(contracts[0].name).toBe('SimpleStorage');
      expect(contracts[0].stateVariables).toBeDefined();
      expect(contracts[0].stateVariables.length).toBeGreaterThan(0);
    });

    it('should parse complex storage contract', async () => {
      const contractPath = path.join(fixturesPath, 'ComplexStorage.sol');
      const parser = new SolidityParser(contractPath);

      const contracts = await parser.parse();

      expect(contracts).toHaveLength(1);
      expect(contracts[0].name).toBe('ComplexStorage');

      expect(contracts[0].stateVariables.length).toBeGreaterThanOrEqual(3);

    });

    it('should parse inheritance hierarchy', async () => {
      const contractPath = path.join(fixturesPath, 'BaseContract.sol');
      const parser = new SolidityParser(contractPath);

      const contracts = await parser.parse();

      expect(contracts.length).toBeGreaterThanOrEqual(3);

      const childContract = contracts.find(c => c.name === 'ChildContract');
      expect(childContract).toBeDefined();
      expect(childContract?.baseContracts).toContain('BaseContract');
    });

    it('should handle file not found', async () => {
      const contractPath = path.join(fixturesPath, 'NonExistent.sol');
      const parser = new SolidityParser(contractPath);

      await expect(parser.parse()).rejects.toThrow();
    });
  });
});
