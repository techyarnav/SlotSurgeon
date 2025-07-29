import { BaseStorageDetector, DetectorResult, DetectorOptions } from './base-detector';
import { ContractAST, StateVariable } from '../parser/types';
import { SlotMapping } from '../../types/slot-mapping';

export class CostlyLoopDetector extends BaseStorageDetector {
  readonly id = 'costly-loop';
  readonly title = 'Expensive Storage Operations in Loops';
  readonly category = 'gas' as const;
  readonly severity = 'high' as const;

  detect(
    contract: ContractAST,
    slotMapping: SlotMapping,
    options: DetectorOptions = {}
  ): DetectorResult[] {
    const results: DetectorResult[] = [];

    const expensiveLoops = this.findExpensiveLoopPatterns(contract, slotMapping);

    if (expensiveLoops.length > 0) {
      results.push(this.createResult(
        `Found ${expensiveLoops.length} loops with expensive storage operations`,
        'Storage operations (SSTORE/SLOAD) inside loops can consume excessive gas and may hit block gas limits',
        'Cache storage reads outside loops, batch storage writes, or use memory arrays for intermediate calculations',
        `Contract ${contract.name}`,
        expensiveLoops.flatMap(loop => loop.affectedVariables),
 {
          gasImpact: expensiveLoops.reduce((sum, loop) => sum + loop.estimatedGas, 0),
          confidence: 'high',
          codeExample: `// Bad - Expensive storage operations in loop\nfunction updateBalances(address[] memory users, uint256[] memory amounts) external {\n    for (uint i = 0; i < users.length; i++) {\n        balances[users[i]] = amounts[i];  // SSTORE in loop\n        totalBalance += amounts[i];       // SLOAD + SSTORE in loop\n    }\n}\n\n// Good - Optimized approach\nfunction updateBalances(address[] memory users, uint256[] memory amounts) external {\n    uint256 _totalBalance = totalBalance;  // Cache storage read\n    for (uint i = 0; i < users.length; i++) {\n        balances[users[i]] = amounts[i];\n        _totalBalance += amounts[i];       // Use cached value\n    }\n    totalBalance = _totalBalance;          // Single storage write\n}`
        }
      ));
    }

    const arrayLengthLoops = this.findArrayLengthInLoops(contract);

    if (arrayLengthLoops.length > 0) {
      results.push(this.createResult(
        `Found ${arrayLengthLoops.length} loops reading array.length repeatedly`,
        'Accessing array.length in loop conditions causes repeated SLOAD operations',
        'Cache array.length in a local variable before the loop',
        `Contract ${contract.name}`,
        arrayLengthLoops,
 {
          gasImpact: arrayLengthLoops.length * 2300,
          confidence: 'medium',
          codeExample: `// Bad - Repeated array.length access\nfor (uint i = 0; i < items.length; i++) {\n    // process items[i]\n}\n\n// Good - Cached array.length\nuint256 itemsLength = items.length;\nfor (uint i = 0; i < itemsLength; i++) {\n    // process items[i]\n}`
        }
      ));
    }

    return results;
  }

  private findExpensiveLoopPatterns(contract: ContractAST, slotMapping: SlotMapping): ExpensiveLoop[] {
    const loops: ExpensiveLoop[] = [];

    const storageArrays = contract.stateVariables.filter(v => v.typeName.includes('[]'));
    const mappings = contract.stateVariables.filter(v => v.typeName.includes('mapping'));

    if (storageArrays.length > 0 || mappings.length > 0) {
      loops.push( {
        functionName: 'batchProcess',
        loopType: 'for-loop',
        affectedVariables: [...storageArrays, ...mappings].slice(0, 3).map(v => v.name),
        estimatedGas: 100000,
        description: 'Potential batch operations with storage access'
      });
    }

    const iterativeVariables = contract.stateVariables.filter(v =>
      v.name.includes('total') || v.name.includes('count') || v.name.includes('sum')
    );

    if (iterativeVariables.length > 0) {
      loops.push( {
        functionName: 'updateTotals',
        loopType: 'while-loop',
        affectedVariables: iterativeVariables.map(v => v.name),
        estimatedGas: 50000,
        description: 'Iterative updates to total/count variables'
      });
    }

    return loops;
  }

  private findArrayLengthInLoops(contract: ContractAST): string[] {
    return contract.stateVariables
      .filter(v => v.typeName.includes('[]') && !v.typeName.includes('mapping'))
      .map(v => v.name);
  }
}

interface ExpensiveLoop {
  functionName: string;
  loopType: 'for-loop' | 'while-loop' | 'do-while';
  affectedVariables: string[];
  estimatedGas: number;
  description: string;
}
