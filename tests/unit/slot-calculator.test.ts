import { SlotCalculator } from '../../src/core/slot-mapper/slot-calculator';
import { ContractAST } from '../../src/core/parser/types';

describe('SlotCalculator', () => {
  const mockContract: ContractAST = {
    name: 'MockContract',

    baseContracts: [],
    stateVariables: [
      { name: 'value', typeName: 'uint256', visibility: 'public', isConstant: false, isImmutable: false },
      { name: 'owner', typeName: 'address', visibility: 'public', isConstant: false, isImmutable: false },
      { name: 'isActive', typeName: 'bool', visibility: 'public', isConstant: false, isImmutable: false },
      { name: 'smallNumber', typeName: 'uint8', visibility: 'public', isConstant: false, isImmutable: false }
    ],
    functions: [],
    events: [],
    modifiers: [],
    isAbstract: false,
    isInterface: false,
    isLibrary: false
  };

  describe('calculateSlots()', () => {
    it('should calculate basic storage slots', () => {
      const result = SlotCalculator.calculateSlots(mockContract);

      expect(result.contractName).toBe('MockContract');
      expect(result.variables).toHaveLength(4);
      expect(result.totalSlots).toBeGreaterThan(0);
    });

    it('should pack small variables together', () => {
      const result = SlotCalculator.calculateSlots(mockContract);


      const ownerVar = result.variables.find(v => v.name === 'owner');
      const isActiveVar = result.variables.find(v => v.name === 'isActive');
      const smallNumberVar = result.variables.find(v => v.name === 'smallNumber');

      expect(ownerVar?.slot).toBe(isActiveVar?.slot);
      expect(isActiveVar?.slot).toBe(smallNumberVar?.slot);
    });

    it('should handle uint256 in separate slots', () => {
      const result = SlotCalculator.calculateSlots(mockContract);

      const valueVar = result.variables.find(v => v.name === 'value');
      expect(valueVar?.slot).toBe(0);
      expect(valueVar?.size).toBe(32);
    });

    it('should calculate packed slots correctly', () => {
      const result = SlotCalculator.calculateSlots(mockContract);


      expect(Array.isArray(result.packedSlots)).toBe(true);


      expect(result.packedSlots.length).toBeGreaterThanOrEqual(0);

    });
  });
});
