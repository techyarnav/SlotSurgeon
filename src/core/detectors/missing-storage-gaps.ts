import { BaseStorageDetector, DetectorResult, DetectorOptions } from './base-detector';
import { ContractAST, StateVariable } from '../parser/types';
import { SlotMapping } from '../../types/slot-mapping';

export class MissingStorageGapsDetector extends BaseStorageDetector {
  readonly id = 'missing-storage-gaps';
  readonly title = 'Missing Storage Gaps for Upgradeable Contracts';
  readonly category = 'upgrade' as const;
  readonly severity = 'high' as const;

  detect(
    contract: ContractAST,
    slotMapping: SlotMapping,
    options: DetectorOptions = {}
  ): DetectorResult[] {
    const results: DetectorResult[] = [];

    const isUpgradeable = this.isUpgradeableContract(contract);

    if (isUpgradeable) {
      const hasStorageGaps = this.hasStorageGaps(contract);

      if (!hasStorageGaps) {
        results.push(this.createResult(
          'Upgradeable contract missing storage gaps',
          'Without storage gaps, future upgrades may conflict with existing storage layout and corrupt data',
          'Add storage gaps (e.g., uint256[50] private __gap;) to reserve space for future variables',
          `Contract ${contract.name}`,
          ['Storage layout'],
 {
            confidence: 'high',
            codeExample: `// Add at the end of your contract\ncontract MyContract {\n    address public owner;\n    uint256 public value;\n    \n    // Reserve storage slots for future upgrades\n    uint256[48] private __gap;\n}`
          }
        ));
      } else {
        const gapSize = this.calculateGapSize(contract);
        if (gapSize < 50) {
          results.push(this.createResult(
            `Storage gap too small: only ${gapSize} slots reserved`,
            'Small storage gaps may not provide enough space for future contract upgrades',
            `Consider increasing storage gap to at least 50 slots (currently ${gapSize})`,
            `Contract ${contract.name}`,
            ['__gap'],
 {
              confidence: 'medium',
              codeExample: `// Increase gap size\nuint256[${Math.max(50, gapSize + 20)}] private __gap;`
            }
          ));
        }
      }
    }

    if (contract.baseContracts.length > 0) {
      results.push(this.createResult(
        'Contract uses inheritance - verify storage gap strategy',
        'Inherited contracts should coordinate storage gaps to prevent conflicts',
        'Ensure each contract in inheritance chain has appropriate storage gaps and follows upgrade patterns',
        `Contract ${contract.name}`,
        ['Inheritance chain'],
 {
          confidence: 'medium',
          codeExample: `// Each contract in chain should have gaps\ncontract BaseContract {\n    uint256 public baseValue;\n    uint256[49] private __gap;\n}\n\ncontract ChildContract is BaseContract {\n    uint256 public childValue;\n    uint256[49] private __gap;\n}`
        }
      ));
    }

    return results;
  }

  private isUpgradeableContract(contract: ContractAST): boolean {
    const upgradeableIndicators = [
      'initializer', 'upgrade', 'proxy', 'implementation',
      'Initialize', 'Upgrade', 'Proxy', 'Implementation'
    ];

    const nameIndicatesUpgradeable = upgradeableIndicators.some(indicator =>
      contract.name.toLowerCase().includes(indicator.toLowerCase())
    );

    const hasUpgradeablePatterns = contract.stateVariables.some(variable =>
      upgradeableIndicators.some(indicator =>
        variable.name.toLowerCase().includes(indicator.toLowerCase())
      )
    );

    return nameIndicatesUpgradeable || hasUpgradeablePatterns;
  }

  private hasStorageGaps(contract: ContractAST): boolean {
    return contract.stateVariables.some(variable =>
      variable.name.includes('__gap') || variable.name.includes('gap')
    );
  }

  private calculateGapSize(contract: ContractAST): number {
    const gapVariable = contract.stateVariables.find(variable =>
      variable.name.includes('__gap') || variable.name.includes('gap')
    );

    if (!gapVariable) return 0;

    const match = gapVariable.typeName.match(/\[(\d+)\]/);
    return match ? parseInt(match[1], 10) : 1;
  }
}
