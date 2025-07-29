import { BaseStorageDetector, DetectorResult, DetectorOptions } from './base-detector';
import { ContractAST, StateVariable } from '../parser/types';
import { SlotMapping, StorageVariable } from '../../types/slot-mapping';

export class StoragePackingDetector extends BaseStorageDetector {
  readonly id = 'storage-packing';
  readonly title = 'Storage Variable Packing Opportunities';
  readonly category = 'gas' as const;
  readonly severity = 'medium' as const;

  detect(
    contract: ContractAST,
    slotMapping: SlotMapping,
    options: DetectorOptions = {}
  ): DetectorResult[] {
    const results: DetectorResult[] = [];

    const packingOpportunities = this.findPackingOpportunities(slotMapping);

    if (packingOpportunities.length > 0) {
      const totalGasSavings = packingOpportunities.reduce(
        (sum, opp) => sum + opp.gasSavings, 0
      );

      results.push(this.createResult(
        `Found ${packingOpportunities.length} storage packing opportunities`,
        `Inefficient storage layout wastes ${packingOpportunities.reduce((sum, opp) => sum + opp.wastedBytes, 0)} bytes across ${packingOpportunities.length} slots`,
        'Reorder variable declarations to pack smaller types together in single storage slots',
        `Contract ${contract.name}`,
        packingOpportunities.flatMap(opp => opp.variables),
 {
          gasImpact: totalGasSavings,
          confidence: 'high',
          codeExample: this.generatePackingExample(packingOpportunities[0])
        }
      ));
    }

    const consecutivePackingOpps = this.findConsecutivePackingOpportunities(contract);

    if (consecutivePackingOpps.length > 0) {
      results.push(this.createResult(
        `Found ${consecutivePackingOpps.length} consecutive variables that can be packed together`,
        'Variables of small types declared separately waste storage space',
        'Declare related small-type variables consecutively to enable automatic packing',
        `Contract ${contract.name}`,
        consecutivePackingOpps.flatMap(opp => opp.variables),
 {
          gasImpact: consecutivePackingOpps.length * 15000,
          confidence: 'high',
          codeExample: `// Bad - Variables scattered\naddress owner;\nuint256 totalSupply;\nbool paused;\nuint8 decimals;\n\n// Good - Small types grouped\naddress owner;  // 20 bytes\nbool paused;    // 1 byte  \nuint8 decimals; // 1 byte\n// Total: 22 bytes in one 32-byte slot\nuint256 totalSupply; // Separate slot`
        }
      ));
    }

    return results;
  }

  private findPackingOpportunities(slotMapping: SlotMapping): PackingOpportunity[] {
    const opportunities: PackingOpportunity[] = [];

    const slotGroups = new Map<number, StorageVariable[]>();
    slotMapping.variables.forEach(variable => {
      if (!slotGroups.has(variable.slot)) {
        slotGroups.set(variable.slot, []);
      }
      slotGroups.get(variable.slot)!.push(variable);
    });

    slotGroups.forEach((variables, slot) => {
      const totalUsed = variables.reduce((sum, v) => sum + v.size, 0);
      const wastedBytes = 32 - totalUsed;

      if (wastedBytes >= 4 && variables.length < 4) {
        const candidateVariables = this.findSmallVariablesInOtherSlots(
          slotMapping, slot, wastedBytes
        );

        if (candidateVariables.length > 0) {
          opportunities.push( {
            slot,
            currentVariables: variables.map(v => v.name),
            variables: variables.map(v => v.name),
            wastedBytes,
            gasSavings: candidateVariables.length * 15000,
            suggestion: `Move ${candidateVariables.slice(0, 2).join(', ')} to slot ${slot}`
          });
        }
      }
    });

    return opportunities;
  }

  private findConsecutivePackingOpportunities(contract: ContractAST): ConsecutivePackingOpportunity[] {
    const opportunities: ConsecutivePackingOpportunity[] = [];
    const variables = contract.stateVariables;

    for (let i = 0; i < variables.length - 1; i++) {
      const current = variables[i];
      const next = variables[i + 1];

      if (this.isSmallType(current.typeName) && !this.isSmallType(next.typeName)) {
        const smallTypes = [current];
        for (let j = i + 2; j < variables.length; j++) {
          if (this.isSmallType(variables[j].typeName)) {
            smallTypes.push(variables[j]);
            if (this.getTotalSize(smallTypes) <= 32) {
              if (smallTypes.length >= 2) {
                opportunities.push( {
                  variables: smallTypes.map(v => v.name),
                  totalSize: this.getTotalSize(smallTypes),
                  suggestion: `Group these ${smallTypes.length} small variables together`
                });
              }
            } else {
              break;
            }
          }
        }
      }
    }

    return opportunities;
  }

  private findSmallVariablesInOtherSlots(
    slotMapping: SlotMapping,
    excludeSlot: number,
    availableSpace: number
  ): string[] {
    const candidates: string[] = [];

    slotMapping.variables.forEach(variable => {
      if (variable.slot !== excludeSlot && variable.size <= availableSpace && variable.size <= 8) {
        candidates.push(variable.name);
      }
    });

    return candidates.slice(0, 3);
  }

  private isSmallType(typeName: string): boolean {
    const smallTypes = [
      'bool', 'uint8', 'uint16', 'uint32', 'uint64',
      'int8', 'int16', 'int32', 'int64', 'address',
      'bytes1', 'bytes2', 'bytes4', 'bytes8'
    ];
    return smallTypes.includes(typeName);
  }

  private getTotalSize(variables: StateVariable[]): number {
    return variables.reduce((sum, v) => sum + this.getTypeSize(v.typeName), 0);
  }

  private getTypeSize(typeName: string): number {
    const sizeMap: Record<string, number> = {
      'bool': 1, 'uint8': 1, 'int8': 1,
      'uint16': 2, 'int16': 2,
      'uint32': 4, 'int32': 4,
      'uint64': 8, 'int64': 8,
      'address': 20,
      'bytes1': 1, 'bytes2': 2, 'bytes4': 4, 'bytes8': 8,
      'uint256': 32, 'int256': 32, 'bytes32': 32
    };
    return sizeMap[typeName] || 32;
  }

  private generatePackingExample(opportunity: PackingOpportunity): string {
    return `// Current layout wastes ${opportunity.wastedBytes} bytes in slot ${opportunity.slot}\n// Consider moving small variables to fill the gap\n\n// Before\n${opportunity.currentVariables.join(';\n')};\n\n// After (suggested)\n// Group small variables together to pack efficiently`;
  }
}

interface PackingOpportunity {
  slot: number;
  currentVariables: string[];
  variables: string[];
  wastedBytes: number;
  gasSavings: number;
  suggestion: string;
}

interface ConsecutivePackingOpportunity {
  variables: string[];
  totalSize: number;
  suggestion: string;
}
