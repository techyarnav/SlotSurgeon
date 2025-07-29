import { SolidityParser } from '../../src/core/parser/solidity-parser';
import { SlotCalculator } from '../../src/core/slot-mapper/slot-calculator';
import { CollisionDetector } from '../../src/core/slot-mapper/collision-detector';
import * as path from 'path';

describe('Full Analysis Integration', () => {
  const fixturesPath = path.join(__dirname, '../fixtures/contracts');

  describe('complete workflow', () => {
    it('should parse, calculate slots, and detect collisions', async () => {
      const contractPath = path.join(fixturesPath, 'ComplexStorage.sol');


      const parser = new SolidityParser(contractPath);
      const contracts = await parser.parse();

      expect(contracts).toHaveLength(1);
      const contract = contracts[0];


      const slotMapping = SlotCalculator.calculateSlots(contract);

      expect(slotMapping.contractName).toBe('ComplexStorage');
      expect(slotMapping.variables.length).toBeGreaterThan(0);
      expect(slotMapping.totalSlots).toBeGreaterThan(0);


      const detector = new CollisionDetector();
      const collisions = detector.detectCollisions([contract]);

      expect(Array.isArray(collisions)).toBe(true);
    });

    it('should handle inheritance chain analysis', async () => {
      const contractPath = path.join(fixturesPath, 'BaseContract.sol');

      const parser = new SolidityParser(contractPath);
      const contracts = await parser.parse();

      const grandChildContract = contracts.find(c => c.name === 'GrandChildContract');
      expect(grandChildContract).toBeDefined();

      if (grandChildContract) {
        const slotMapping = SlotCalculator.calculateSlots(grandChildContract);


        expect(slotMapping.variables.length).toBeGreaterThanOrEqual(1);


        if (slotMapping.variables.length > 0) {

  expect(slotMapping.variables[0]).toBeDefined();
  expect(slotMapping.variables[0].name).toBeDefined();
} else {

  expect(slotMapping.variables.length).toBe(0);
}
      }
    });

    it('should process simple contracts correctly', async () => {
      const contractPath = path.join(fixturesPath, 'SimpleStorage.sol');

      const parser = new SolidityParser(contractPath);
      const contracts = await parser.parse();

      expect(contracts).toHaveLength(1);
      const contract = contracts[0];
      expect(contract.name).toBe('SimpleStorage');

      const slotMapping = SlotCalculator.calculateSlots(contract);

      expect(slotMapping.variables.length).toBeGreaterThan(0);
      expect(slotMapping.totalSlots).toBeGreaterThan(0);

      expect(Array.isArray(slotMapping.packedSlots)).toBe(true);

    });
  });

  describe('upgrade safety analysis', () => {
    it('should detect safe upgrades', async () => {
      const v1Path = path.join(fixturesPath, 'UpgradeV1.sol');
      const v2Path = path.join(fixturesPath, 'UpgradeV2_Safe.sol');

      const parser1 = new SolidityParser(v1Path);
      const parser2 = new SolidityParser(v2Path);

      const contracts1 = await parser1.parse();
      const contracts2 = await parser2.parse();

      const mapping1 = SlotCalculator.calculateSlots(contracts1[0]);
      const mapping2 = SlotCalculator.calculateSlots(contracts2[0]);

      const report = CollisionDetector.compare(mapping1, mapping2);

      expect(report.safe).toBe(true);
      expect(report.added.length).toBeGreaterThan(0);
      expect(report.moved.length).toBe(0);
      expect(report.collisions.length).toBe(0);
    });

    it('should detect unsafe upgrades', async () => {
      const v1Path = path.join(fixturesPath, 'UpgradeV1.sol');
      const v2Path = path.join(fixturesPath, 'UpgradeV2_Unsafe.sol');

      const parser1 = new SolidityParser(v1Path);
      const parser2 = new SolidityParser(v2Path);

      const contracts1 = await parser1.parse();
      const contracts2 = await parser2.parse();

      const mapping1 = SlotCalculator.calculateSlots(contracts1[0]);
      const mapping2 = SlotCalculator.calculateSlots(contracts2[0]);

      const report = CollisionDetector.compare(mapping1, mapping2);

      expect(report.safe).toBe(false);
      expect(report.moved.length).toBeGreaterThan(0);
    });

    it('should handle identical contracts', async () => {
      const contractPath = path.join(fixturesPath, 'SimpleStorage.sol');

      const parser1 = new SolidityParser(contractPath);
      const parser2 = new SolidityParser(contractPath);

      const contracts1 = await parser1.parse();
      const contracts2 = await parser2.parse();

      const mapping1 = SlotCalculator.calculateSlots(contracts1[0]);
      const mapping2 = SlotCalculator.calculateSlots(contracts2[0]);

      const report = CollisionDetector.compare(mapping1, mapping2);

      expect(report.safe).toBe(true);
      expect(report.added.length).toBe(0);
      expect(report.removed.length).toBe(0);
      expect(report.moved.length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle parsing errors gracefully', async () => {
      const invalidPath = path.join(fixturesPath, 'NonExistent.sol');
      const parser = new SolidityParser(invalidPath);

      await expect(parser.parse()).rejects.toThrow();
    });

    it('should handle empty contracts', async () => {

      const mockContract = {
        name: 'EmptyContract',
        baseContracts: [],
        stateVariables: [],
        functions: [],
        events: [],
        modifiers: [],
        isAbstract: false,
        isInterface: false,
        isLibrary: false
      };

      const slotMapping = SlotCalculator.calculateSlots(mockContract);

      expect(slotMapping.contractName).toBe('EmptyContract');
      expect(slotMapping.variables.length).toBe(0);
      expect(slotMapping.totalSlots).toBe(0);

      expect(slotMapping.packedSlots).toEqual([]);

    });
  });
});
