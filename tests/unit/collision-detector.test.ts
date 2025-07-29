import { CollisionDetector } from '../../src/core/slot-mapper/collision-detector';
import { SlotMapping, StorageVariable } from '../../src/types/slot-mapping';

describe('CollisionDetector', () => {
  const createMockMapping = (name: string, variables: Partial<StorageVariable>[]): SlotMapping => ( {
    contractName: name,
    variables: variables.map((v, i) => ( {
      name: v.name || `var${i}`,
      type: v.type || 'uint256',
      slot: v.slot || 0,
      offset: v.offset || 0,
      size: v.size || 32,
      isStateVariable: true,
      ...v
    })),
    totalSlots: Math.max(...variables.map(v => v.slot || 0)) + 1,

    packedSlots: []

  });

  describe('compare()', () => {
    it('should detect safe upgrade (only additions)', () => {
      const v1 = createMockMapping('V1', [
        { name: 'owner', type: 'address', slot: 0, offset: 0, size: 20 },
        { name: 'value', type: 'uint256', slot: 1, offset: 0, size: 32 }
      ]);

      const v2 = createMockMapping('V2', [
        { name: 'owner', type: 'address', slot: 0, offset: 0, size: 20 },
        { name: 'value', type: 'uint256', slot: 1, offset: 0, size: 32 },
        { name: 'newVar', type: 'uint256', slot: 2, offset: 0, size: 32 }
      ]);

      const result = CollisionDetector.compare(v1, v2);

      expect(result.safe).toBe(true);
      expect(result.added).toHaveLength(1);
      expect(result.moved).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.collisions).toHaveLength(0);
    });

    it('should detect unsafe upgrade (moved variables)', () => {
      const v1 = createMockMapping('V1', [
        { name: 'owner', type: 'address', slot: 0, offset: 0, size: 20 },
        { name: 'value', type: 'uint256', slot: 1, offset: 0, size: 32 }
      ]);

      const v2 = createMockMapping('V2', [
        { name: 'value', type: 'uint256', slot: 0, offset: 0, size: 32 },
        { name: 'owner', type: 'address', slot: 1, offset: 0, size: 20 }
      ]);

      const result = CollisionDetector.compare(v1, v2);

      expect(result.safe).toBe(false);
      expect(result.moved).toHaveLength(2);
      expect(result.collisions).toHaveLength(0);
    });

    it('should detect storage collisions', () => {
      const v1 = createMockMapping('V1', [
        { name: 'data1', type: 'bytes32', slot: 0, offset: 0, size: 32 }
      ]);

      const v2 = createMockMapping('V2', [
        { name: 'data2', type: 'uint256', slot: 0, offset: 0, size: 32 }
      ]);

      const result = CollisionDetector.compare(v1, v2);

      expect(result.safe).toBe(false);
      expect(result.collisions.length).toBeGreaterThan(0);
    });
  });

  describe('detectCollisions()', () => {
    it('should detect collisions in single contract', () => {
      const mockContracts = [ {
        name: 'TestContract',
        stateVariables: [
          { name: 'var1', typeName: 'uint256' },
          { name: 'var2', typeName: 'address' }
        ]
      }];

      const detector = new CollisionDetector();
      const result = detector.detectCollisions(mockContracts);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
