import { BaseStorageDetector, DetectorResult, DetectorOptions } from './base-detector';
import { ContractAST } from '../parser/types';
import { SlotMapping, StorageVariable } from '../../types/slot-mapping';

export { DetectorResult } from './base-detector';

export interface StorageDetectionReport {
  contractName: string;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  results: DetectorResult[];
  gasImpact: number;
  securityScore: number;
  upgradeabilityScore: number;
  summary: string[];
}

class StoragePackingDetector extends BaseStorageDetector {
  readonly id = 'storage-packing';
  readonly title = 'Storage Variable Packing Optimization';
  readonly category = 'gas' as const;
  readonly severity = 'medium' as const;

  detect(contract: ContractAST, slotMapping: SlotMapping): DetectorResult[] {
    const issues: DetectorResult[] = [];

    const slotGroups = new Map<number, StorageVariable[]>();
    slotMapping.variables.forEach(variable => {
      if (!slotGroups.has(variable.slot)) {
        slotGroups.set(variable.slot, []);
      }
      slotGroups.get(variable.slot)!.push(variable);
    });

    slotGroups.forEach((variables, slot) => {
      const totalUsed = variables.reduce((sum, v) => sum + v.size, 0);
      const wastedSpace = 32 - totalUsed;

      if (wastedSpace > 0 && variables.length === 1 && totalUsed < 20) {
        issues.push(this.createResult(
          `Inefficient Storage Packing in Slot ${slot}`,
          `Slot ${slot} uses only ${totalUsed} bytes, wasting ${wastedSpace} bytes. Consider packing with smaller variables.`,
          `Pack variable '${variables[0].name}' with smaller variables (bool, uint8, uint16) to optimize storage.`,
          `Slot ${slot}: ${variables[0].name}`,
          [variables[0].name],
 {
            confidence: wastedSpace > 10 ? 'high' : 'medium',
            gasImpact: wastedSpace * 100,
            codeExample: this.generatePackingExample(variables[0])
          }
        ));
      }
    });

    return issues;
  }

  private generatePackingExample(variable: StorageVariable): string {
    return `// Instead of:
${variable.type} public ${variable.name};


struct PackedData {
    ${variable.type} ${variable.name};
    bool flag;
    uint8 status;
    uint16 version;

}`;
  }
}

class GasOptimizationDetector extends BaseStorageDetector {
  readonly id = 'gas-optimization';
  readonly title = 'Gas Optimization Opportunities';
  readonly category = 'gas' as const;
  readonly severity = 'low' as const;

  detect(contract: ContractAST, slotMapping: SlotMapping): DetectorResult[] {
    const issues: DetectorResult[] = [];

    const reorderSavings = this.calculateReorderSavings(slotMapping);
    if (reorderSavings > 0) {
      issues.push(this.createResult(
        'Variable Reordering Opportunity',
        `Reordering variables could save ${reorderSavings} bytes of storage`,
        'Reorder variables by size (largest first) for better packing',
        'Contract variables',
        slotMapping.variables.map(v => v.name),
 {
          confidence: 'medium',
          gasImpact: reorderSavings * 200,
          codeExample: this.generateReorderExample(slotMapping.variables)
        }
      ));
    }

    if (slotMapping.variables.length > 8) {
      const relatedVars = this.findRelatedVariables(slotMapping.variables);
      if (relatedVars.length > 0) {
        issues.push(this.createResult(
          'Struct Organization Opportunity',
          `${relatedVars.length} variables could be organized into structs for better gas efficiency`,
          'Group related variables into structs to reduce storage reads/writes',
          'Contract structure',
          relatedVars,
 {
            confidence: 'medium',
            gasImpact: relatedVars.length * 150
          }
        ));
      }
    }

    return issues;
  }

  private calculateReorderSavings(slotMapping: SlotMapping): number {
    const currentSlots = slotMapping.totalSlots;
    const totalBytes = slotMapping.variables.reduce((sum, v) => sum + v.size, 0);
    const theoreticalOptimal = Math.ceil(totalBytes / 32);
    return Math.max(0, (currentSlots - theoreticalOptimal) * 32);
  }

  private findRelatedVariables(variables: StorageVariable[]): string[] {
    const related = variables.filter(v =>
      v.name.includes('user') ||
      v.name.includes('token') ||
      v.name.includes('balance') ||
      v.type.includes('mapping')
    );
    return related.map(v => v.name);
  }

  private generateReorderExample(variables: StorageVariable[]): string {
    const sorted = [...variables].sort((a, b) => b.size - a.size);
    return `// Optimized order (largest first):
${sorted.slice(0, 5).map(v => `${v.type} ${v.name};`).join('\n')}`;
  }
}

class UpgradeSafetyDetector extends BaseStorageDetector {
  readonly id = 'upgrade-safety';
  readonly title = 'Upgrade Safety Analysis';
  readonly category = 'upgrade' as const;
  readonly severity = 'medium' as const;

  detect(contract: ContractAST, slotMapping: SlotMapping): DetectorResult[] {
    const issues: DetectorResult[] = [];

    if (contract.baseContracts.length === 0 && slotMapping.variables.length > 5) {
      const hasStorageGap = slotMapping.variables.some(v =>
        v.name.includes('gap') || v.name.includes('__gap')
      );

      if (!hasStorageGap) {
        issues.push(this.createResult(
          'Missing Storage Gaps for Upgrades',
          'Contract lacks storage gaps, making future upgrades risky',
          'Add storage gaps to reserve space for future variables',
          'Contract structure',
          ['contract'],
 {
            confidence: 'high',
            gasImpact: 0,
            codeExample: 'uint256[50] private __gap; // Reserve storage for upgrades'
          }
        ));
      }
    }

    const dangerousVars = slotMapping.variables.filter(v =>
      v.type.includes('mapping') || v.type.includes('[]')
    );

    if (dangerousVars.length > 3) {
      issues.push(this.createResult(
        'High Dynamic Storage Usage',
        `Contract has ${dangerousVars.length} dynamic storage variables (mappings/arrays)`,
        'Be careful when upgrading contracts with many dynamic storage variables',
        'Dynamic storage variables',
        dangerousVars.map(v => v.name),
        { confidence: 'medium' }
      ));
    }

    return issues;
  }
}

class SecurityDetector extends BaseStorageDetector {
  readonly id = 'security-analysis';
  readonly title = 'Storage Security Analysis';
  readonly category = 'security' as const;
  readonly severity = 'high' as const;

  detect(contract: ContractAST, slotMapping: SlotMapping): DetectorResult[] {
    const issues: DetectorResult[] = [];

    if (contract.baseContracts.length > 0) {
      issues.push(this.createResult(
        'Inheritance Storage Layout Risk',
        'Contract inherits from other contracts, increasing storage collision risk',
        'Carefully review storage layout when inheriting from other contracts',
        'Contract inheritance',
        contract.baseContracts,
        { confidence: 'medium' }
      ));
    }

    const uninitializedVars = contract.stateVariables.filter(v =>
      !v.initialValue && !v.isConstant && !v.isImmutable
    );

    if (uninitializedVars.length > slotMapping.variables.length * 0.5) {
      issues.push(this.createResult(
        'Many Uninitialized Storage Variables',
        `${uninitializedVars.length} storage variables lack initialization`,
        'Initialize storage variables to prevent unexpected behavior',
        'Uninitialized variables',
        uninitializedVars.map(v => v.name),
 {
          confidence: 'medium',
        }
      ));
    }

    return issues;
  }
}

class TestStorageDetector extends BaseStorageDetector {
  readonly id = 'test-storage';
  readonly title = 'Storage Complexity Analysis';
  readonly category = 'storage' as const;
  readonly severity = 'medium' as const;

  detect(contract: ContractAST, slotMapping: SlotMapping): DetectorResult[] {
    const issues: DetectorResult[] = [];

    if (slotMapping.variables.length > 10) {
      issues.push(this.createResult(
        'High Storage Complexity',
        `Contract has ${slotMapping.variables.length} storage variables, consider using structs`,
        'Group related variables into structs for better organization and gas efficiency',
        'Contract storage',
        slotMapping.variables.slice(0, 5).map(v => v.name),
 {
          confidence: 'high',
          gasImpact: slotMapping.variables.length * 50
        }
      ));
    }

    const efficiency = this.calculateStorageEfficiency(slotMapping);
    if (efficiency < 60) {
      issues.push(this.createResult(
        'Low Storage Efficiency',
        `Storage efficiency is ${efficiency.toFixed(1)}%, indicating potential waste`,
        'Optimize variable packing to improve storage efficiency',
        'Storage layout',
        ['efficiency'],
 {
          confidence: 'high',
          gasImpact: (100 - efficiency) * 100
        }
      ));
    }

    return issues;
  }

  private calculateStorageEfficiency(slotMapping: SlotMapping): number {
    if (slotMapping.totalSlots === 0) return 100;

    const totalBytesUsed = slotMapping.variables.reduce((sum, v) => sum + v.size, 0);
    const totalBytesAvailable = slotMapping.totalSlots * 32;

    return (totalBytesUsed / totalBytesAvailable) * 100;
  }
}

export class StorageDetectorManager {
  private detectors: BaseStorageDetector[];

  constructor() {
    this.detectors = [
      new StoragePackingDetector(),
      new GasOptimizationDetector(),
      new UpgradeSafetyDetector(),
      new SecurityDetector(),
      new TestStorageDetector()
    ];
  }

  async runAllDetectors(
    contract: ContractAST,
    slotMapping: SlotMapping,
    options: DetectorOptions = {}
  ): Promise<StorageDetectionReport> {
    const allResults: DetectorResult[] = [];

    for (const detector of this.detectors) {
      try {
        const results = detector.detect(contract, slotMapping, options);
        allResults.push(...results);
      } catch (error) {
        console.warn(`Detector ${detector.id} failed: ${error}`);
      }
    }

    return this.generateReport(contract.name, allResults);
  }

  async runSpecificDetectors(
    detectorIds: string[],
    contract: ContractAST,
    slotMapping: SlotMapping,
    options: DetectorOptions = {}
  ): Promise<StorageDetectionReport> {
    const selectedDetectors = this.detectors.filter(d => detectorIds.includes(d.id));
    const allResults: DetectorResult[] = [];

    for (const detector of selectedDetectors) {
      try {
        const results = detector.detect(contract, slotMapping, options);
        allResults.push(...results);
      } catch (error) {
        console.warn(`Detector ${detector.id} failed: ${error}`);
      }
    }

    return this.generateReport(contract.name, allResults);
  }

  getAvailableDetectors(): { id: string; title: string; category: string; severity: string }[] {
    return this.detectors.map(detector => ( {
      id: detector.id,
      title: detector.title,
      category: detector.category,
      severity: detector.severity
    }));
  }

  private generateReport(contractName: string, results: DetectorResult[]): StorageDetectionReport {
    const criticalIssues = results.filter(r => r.severity === 'critical').length;
    const highIssues = results.filter(r => r.severity === 'high').length;
    const mediumIssues = results.filter(r => r.severity === 'medium').length;
    const lowIssues = results.filter(r => r.severity === 'low').length;

    const gasImpact = results.reduce((sum, r) => sum + (r.gasImpact || 0), 0);
    const securityScore = Math.max(0, 100 - (criticalIssues * 40 + highIssues * 20 + mediumIssues * 10));
    const upgradeabilityScore = Math.max(0, 100 - (results.filter(r => r.category === 'upgrade').length * 15));

    const summary: string[] = [];
    if (results.length === 0) {
      summary.push('No storage issues detected - contract is well optimized');
    } else {
      if (criticalIssues > 0) summary.push(`${criticalIssues} critical security issues found`);
      if (highIssues > 0) summary.push(`${highIssues} high-priority optimizations available`);
      if (mediumIssues > 0) summary.push(`${mediumIssues} medium-priority improvements identified`);
      if (gasImpact > 0) summary.push(`Potential gas savings: ${gasImpact.toLocaleString()} gas`);
    }

    return {
      contractName,
      totalIssues: results.length,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      results,
      gasImpact,
      securityScore,
      upgradeabilityScore,
      summary
    };
  }
}
