import { ContractAST } from '../parser/types';
import { SlotMapping, StorageVariable } from '../../types/slot-mapping';

export class SlotCalculator {
  static calculateSlots(contract: ContractAST): SlotMapping {
    const variables: StorageVariable[] = [];
    let currentSlot = 0;
    let currentOffset = 0;


    contract.stateVariables.forEach(variable => {
      const size = this.getTypeSize(variable.typeName);


      if (currentOffset + size > 32) {
        currentSlot++;
        currentOffset = 0;
      }

      variables.push( {
        name: variable.name,
        type: variable.typeName,
        slot: currentSlot,
        offset: currentOffset,
        size: size,
        isStateVariable: true,
        packed: currentOffset > 0 || (currentOffset + size < 32)
      });

      currentOffset += size;
      if (currentOffset >= 32) {
        currentSlot++;
        currentOffset = 0;
      }
    });

    const totalSlots = variables.length > 0 ? Math.max(...variables.map(v => v.slot)) + 1 : 0;


    const slotGroups = new Map<number, number>();
    variables.forEach(variable => {
      slotGroups.set(variable.slot, (slotGroups.get(variable.slot) || 0) + 1);
    });

    const packedSlots: number[] = Array.from(slotGroups.entries())
      .filter(([slot, count]) => count > 1)
      .map(([slot]) => slot);

    return {
      contractName: contract.name,
      variables,
      totalSlots,
      packedSlots
    };
  }

  private static getTypeSize(typeName: string): number {

    const sizeMap: Record<string, number> = {
      'bool': 1,
      'uint8': 1, 'int8': 1,
      'uint16': 2, 'int16': 2,
      'uint32': 4, 'int32': 4,
      'uint64': 8, 'int64': 8,
      'uint128': 16, 'int128': 16,
      'uint256': 32, 'int256': 32,
      'uint': 32, 'int': 32,
      'address': 20,
      'bytes1': 1, 'bytes2': 2, 'bytes4': 4, 'bytes8': 8,
      'bytes16': 16, 'bytes32': 32,
      'string': 32,
      'bytes': 32
    };


    if (typeName.includes('[]')) {
      return 32;
    }


    if (typeName.includes('mapping')) {
      return 32;
    }

    return sizeMap[typeName] || 32;
  }


  static calculatePackingEfficiency(mapping: SlotMapping): number {
    if (mapping.totalSlots === 0) return 100;

    const totalBytesUsed = mapping.variables.reduce((sum, variable) => sum + variable.size, 0);
    const totalBytesAvailable = mapping.totalSlots * 32;

    return (totalBytesUsed / totalBytesAvailable) * 100;
  }

  static findPackingOpportunities(mapping: SlotMapping): Array<{slot: number, wastedBytes: number, suggestions: string[]}> {
    const opportunities: Array<{slot: number, wastedBytes: number, suggestions: string[]}> = [];


    const slotGroups = new Map<number, StorageVariable[]>();
    mapping.variables.forEach(variable => {
      if (!slotGroups.has(variable.slot)) {
        slotGroups.set(variable.slot, []);
      }
      slotGroups.get(variable.slot)!.push(variable);
    });


    slotGroups.forEach((variables, slot) => {
      const totalUsed = variables.reduce((sum, v) => sum + v.size, 0);
      const wastedBytes = 32 - totalUsed;

      if (wastedBytes > 0 && variables.length === 1 && variables[0].size < 32) {
        const suggestions = this.generatePackingSuggestions(variables[0], wastedBytes);
        if (suggestions.length > 0) {
          opportunities.push( {
            slot,
            wastedBytes,
            suggestions
          });
        }
      }
    });

    return opportunities.sort((a, b) => b.wastedBytes - a.wastedBytes);
  }

  private static generatePackingSuggestions(variable: StorageVariable, availableSpace: number): string[] {
    const suggestions: string[] = [];

    if (availableSpace >= 20 && variable.size <= 12) {
      suggestions.push('Consider packing with an address variable (20 bytes)');
    }

    if (availableSpace >= 4 && variable.size <= 28) {
      suggestions.push('Consider packing with uint32 or smaller integer types');
    }

    if (availableSpace >= 1 && variable.size <= 31) {
      suggestions.push('Consider packing with bool variables (1 byte each)');
    }

    return suggestions;
  }


  static canPackTogether(var1: StorageVariable, var2: StorageVariable): boolean {
    return (var1.size + var2.size) <= 32;
  }


  static optimizeSlotArrangement(variables: StorageVariable[]): StorageVariable[] {

    const sortedVars = [...variables].sort((a, b) => b.size - a.size);
    const optimizedVars: StorageVariable[] = [];

    let currentSlot = 0;
    let currentOffset = 0;

    sortedVars.forEach(variable => {

      if (currentOffset + variable.size > 32) {
        currentSlot++;
        currentOffset = 0;
      }

      optimizedVars.push( {
        ...variable,
        slot: currentSlot,
        offset: currentOffset,
        packed: currentOffset > 0 || (currentOffset + variable.size < 32)
      });

      currentOffset += variable.size;
      if (currentOffset >= 32) {
        currentSlot++;
        currentOffset = 0;
      }
    });

    return optimizedVars;
  }
}
