import { SlotMapping, StorageVariable } from '../../types/slot-mapping';
import { CollisionDetector, CollisionReport } from './collision-detector';

export interface UpgradeChange {
  type: 'added' | 'removed' | 'moved' | 'typeChanged' | 'collision';
  variable: StorageVariable;
  oldVariable?: StorageVariable;
  severity: 'safe' | 'warning' | 'critical';
  description: string;
  recommendation?: string;
}

export interface UpgradeCompatibility {
  score: number;
  level: 'safe' | 'caution' | 'unsafe' | 'critical';
  description: string;
}

export interface UpgradeAnalysis {
  contractName: string;
  v1Summary: {
    totalSlots: number;
    variables: number;
    packedSlots: number;
  };
  v2Summary: {
    totalSlots: number;
    variables: number;
    packedSlots: number;
  };
  changes: UpgradeChange[];
  compatibility: UpgradeCompatibility;
  recommendations: string[];
  collisionReport: CollisionReport;
  storageGrowth: {
    slotsAdded: number;
    bytesWasted: number;
    efficiencyChange: number;
  };
}

export class UpgradeAnalyzer {
  static analyze(v1: SlotMapping, v2: SlotMapping): UpgradeAnalysis {
    const collisionReport = CollisionDetector.compare(v1, v2);
    const changes = this.identifyChanges(v1, v2, collisionReport);
    const compatibility = this.assessCompatibility(changes, collisionReport);
    const recommendations = this.generateRecommendations(changes, v1, v2);
    const storageGrowth = this.calculateStorageGrowth(v1, v2);

    return {
      contractName: v1.contractName,
      v1Summary: {
        totalSlots: v1.totalSlots,
        variables: v1.variables.length,
        packedSlots: v1.packedSlots.length
      },
      v2Summary: {
        totalSlots: v2.totalSlots,
        variables: v2.variables.length,
        packedSlots: v2.packedSlots.length
      },
      changes,
      compatibility,
      recommendations,
      collisionReport,
      storageGrowth
    };
  }

  private static identifyChanges(
    v1: SlotMapping,
    v2: SlotMapping,
    collisionReport: CollisionReport
  ): UpgradeChange[] {
    const changes: UpgradeChange[] = [];


    const v1VarMap = new Map(v1.variables.map(v => [`${v.name}|${v.type}`, v]));
    const v2VarMap = new Map(v2.variables.map(v => [`${v.name}|${v.type}`, v]));
    const v1NameMap = new Map(v1.variables.map(v => [v.name, v]));
    const v2NameMap = new Map(v2.variables.map(v => [v.name, v]));


    collisionReport.collisions.forEach(collision => {
      changes.push( {
        type: 'collision',
        variable: collision.v2,
        oldVariable: collision.v1,
        severity: 'critical',
        description: `Storage collision: ${collision.reason}`,
        recommendation: 'This collision will corrupt storage. Consider adding new variables at the end instead.'
      });
    });

    collisionReport.moved.forEach(variable => {
      const oldVar = v1VarMap.get(`${variable.name}|${variable.type}`);
      changes.push( {
        type: 'moved',
        variable,
        oldVariable: oldVar,
        severity: 'critical',
        description: `Variable "${variable.name}" moved from slot ${oldVar?.slot} to slot ${variable.slot}`,
        recommendation: 'Moving variables breaks storage layout. Add new variables at the end instead.'
      });
    });

    collisionReport.removed.forEach(variable => {
      changes.push( {
        type: 'removed',
        variable,
        severity: 'warning',
        description: `Variable "${variable.name}" removed from storage`,
        recommendation: 'Removing variables can break dependent contracts. Consider deprecation instead.'
      });
    });

    collisionReport.added.forEach(variable => {
      changes.push( {
        type: 'added',
        variable,
        severity: 'safe',
        description: `New variable "${variable.name}" added at slot ${variable.slot}`,
        recommendation: 'Adding variables at the end is safe for upgrades.'
      });
    });


    for (const [name, v2Var] of v2NameMap) {
      const v1Var = v1NameMap.get(name);
      if (v1Var && v1Var.type !== v2Var.type) {
        changes.push( {
          type: 'typeChanged',
          variable: v2Var,
          oldVariable: v1Var,
          severity: 'critical',
          description: `Variable "${name}" type changed from ${v1Var.type} to ${v2Var.type}`,
          recommendation: 'Type changes can corrupt data. Use a new variable name instead.'
        });
      }
    }

    return changes;
  }

  private static assessCompatibility(
    changes: UpgradeChange[],
    collisionReport: CollisionReport
  ): UpgradeCompatibility {
    const criticalCount = changes.filter(c => c.severity === 'critical').length;
    const warningCount = changes.filter(c => c.severity === 'warning').length;
    const safeCount = changes.filter(c => c.severity === 'safe').length;

    let score = 100;
    let level: 'safe' | 'caution' | 'unsafe' | 'critical';
    let description: string;


    score -= criticalCount * 40;
    score -= warningCount * 15;
    score = Math.max(0, score);

    if (criticalCount > 0) {
      level = 'critical';
      description = `Critical storage layout conflicts detected. Upgrade will likely fail or corrupt data.`;
    } else if (warningCount > 2) {
      level = 'unsafe';
      description = `Multiple warnings detected. Upgrade may cause issues.`;
    } else if (warningCount > 0) {
      level = 'caution';
      description = `Some warnings detected. Review carefully before upgrading.`;
    } else {
      level = 'safe';
      description = `Storage layout is upgrade-safe. Only new variables added.`;
    }

    return { score, level, description };
  }

  private static generateRecommendations(
    changes: UpgradeChange[],
    v1: SlotMapping,
    v2: SlotMapping
  ): string[] {
    const recommendations: string[] = [];

    const criticalChanges = changes.filter(c => c.severity === 'critical');
    const warningChanges = changes.filter(c => c.severity === 'warning');

    if (criticalChanges.length > 0) {
      recommendations.push(
        `🚨 CRITICAL: Do not deploy this upgrade. ${criticalChanges.length} critical issues found.`
      );
      recommendations.push(
        `• Consider creating a new contract with proper storage layout instead of upgrading.`
      );
    }

    if (warningChanges.length > 0) {
      recommendations.push(
        `⚠️  ${warningChanges.length} warnings detected. Test thoroughly before deployment.`
      );
    }


    const v1Efficiency = this.calculateEfficiency(v1);
    const v2Efficiency = this.calculateEfficiency(v2);

    if (v2Efficiency < v1Efficiency - 10) {
      recommendations.push(
        `📉 Storage efficiency decreased by ${Math.round(v1Efficiency - v2Efficiency)}%. Consider variable reordering.`
      );
    }


    const slotGrowth = v2.totalSlots - v1.totalSlots;
    if (slotGrowth > 5) {
      recommendations.push(
        `📈 Storage grew by ${slotGrowth} slots. Consider gas cost implications for users.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(`✅ Upgrade appears safe. All new variables added at the end.`);
    }

    return recommendations;
  }

  private static calculateStorageGrowth(v1: SlotMapping, v2: SlotMapping) {
    const slotsAdded = v2.totalSlots - v1.totalSlots;

    const v1UsedBytes = v1.variables.reduce((sum, v) => sum + v.size, 0);
    const v2UsedBytes = v2.variables.reduce((sum, v) => sum + v.size, 0);

    const v1WastedBytes = (v1.totalSlots * 32) - v1UsedBytes;
    const v2WastedBytes = (v2.totalSlots * 32) - v2UsedBytes;
    const bytesWasted = v2WastedBytes - v1WastedBytes;

    const v1Efficiency = (v1UsedBytes / (v1.totalSlots * 32)) * 100;
    const v2Efficiency = (v2UsedBytes / (v2.totalSlots * 32)) * 100;
    const efficiencyChange = v2Efficiency - v1Efficiency;

    return {
      slotsAdded,
      bytesWasted,
      efficiencyChange: Math.round(efficiencyChange * 100) / 100
    };
  }

  private static calculateEfficiency(mapping: SlotMapping): number {
    const usedBytes = mapping.variables.reduce((sum, v) => sum + v.size, 0);
    const totalBytes = mapping.totalSlots * 32;
    return (usedBytes / totalBytes) * 100;
  }
}
