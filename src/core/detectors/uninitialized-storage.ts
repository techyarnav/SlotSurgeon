import { BaseStorageDetector, DetectorResult, DetectorOptions } from './base-detector';
import { ContractAST, StateVariable } from '../parser/types';
import { SlotMapping } from '../../types/slot-mapping';

export class UninitializedStorageDetector extends BaseStorageDetector {
  readonly id = 'uninitialized-storage';
  readonly title = 'Uninitialized Storage Variables';
  readonly category = 'storage' as const;
  readonly severity = 'medium' as const;

  detect(
    contract: ContractAST,
    slotMapping: SlotMapping,
    options: DetectorOptions = {}
  ): DetectorResult[] {
    const results: DetectorResult[] = [];

    const uninitializedVars = this.findUninitializedVariables(contract);

    if (uninitializedVars.length > 0) {
      const gasImpact = options.includeGasEstimates
        ? this.estimateInitializationGas(uninitializedVars)
        : undefined;

      results.push(this.createResult(
        `Found ${uninitializedVars.length} state variables that may not be initialized in constructor`,
        'Uninitialized storage variables contain zero values which may lead to unexpected behavior',
        'Initialize all state variables in constructor or use default values in declarations',
        `Contract ${contract.name}`,
        uninitializedVars.map(v => v.name),
 {
          gasImpact,
          confidence: 'medium',
          codeExample: `// Bad\nuint256 public balance;\naddress public owner;\n\n// Good\nuint256 public balance = 0;\naddress public owner = msg.sender;\n\n// Or in constructor\nconstructor() {\n    balance = 0;\n    owner = msg.sender;\n}`
        }
      ));
    }

    const complexUninitializedVars = this.findComplexUninitializedTypes(contract);

    if (complexUninitializedVars.length > 0) {
      results.push(this.createResult(
        `Found ${complexUninitializedVars.length} complex types that may need explicit initialization`,
        'Complex types (structs, arrays) may have unexpected default values',
        'Explicitly initialize complex types in constructor or provide default initialization functions',
        `Contract ${contract.name}`,
        complexUninitializedVars.map(v => v.name),
 {
          confidence: 'high',
          codeExample: `// Bad\nstruct UserInfo {\n    uint256 balance;\n    bool active;\n}\nUserInfo[] public users;\n\n// Good\nconstructor() {\n    // Initialize first user\n    users.push(UserInfo({\n        balance: 0,\n        active: false\n    }));\n}`
        }
      ));
    }

    return results;
  }

  private findUninitializedVariables(contract: ContractAST): StateVariable[] {
    return contract.stateVariables.filter(variable => {
      if (variable.isConstant || variable.isImmutable) {
        return false;
      }

      const needsInitialization = [
        'uint256', 'uint', 'int256', 'int', 'address', 'bool'
      ].includes(variable.typeName);

      return needsInitialization && !this.hasObviousInitialization(variable);
    });
  }

  private findComplexUninitializedTypes(contract: ContractAST): StateVariable[] {
    return contract.stateVariables.filter(variable => {
      const isComplexType = variable.typeName.includes('[]') ||
                           variable.typeName.includes('mapping') ||
                           variable.typeName.includes('struct') ||
                           this.isCustomType(variable.typeName);

      return isComplexType && !variable.isConstant && !variable.isImmutable;
    });
  }

  private hasObviousInitialization(variable: StateVariable): boolean {
    const likelyInitialized = ['initialized', 'setup', 'configured'];
    return likelyInitialized.some(pattern =>
      variable.name.toLowerCase().includes(pattern)
    );
  }

  private isCustomType(typeName: string): boolean {
    return /^[A-Z]/.test(typeName) && !['String'].includes(typeName);
  }

  private estimateInitializationGas(variables: StateVariable[]): number {
    return variables.length * 20000;
  }
}
