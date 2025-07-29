import { SlotMapping, StorageVariable } from '../../types/slot-mapping';
import { CollisionReport } from '../slot-mapper/collision-detector';

export interface StorageDiffAnalysis {
  summary: DiffSummary;
  changes: VariableChange[];
  gasImpact: GasImpactAnalysis;
  safetyAssessment: SafetyAssessment;
  recommendations: string[];
}

export interface DiffSummary {
  unchanged: number;
  added: number;
  removed: number;
  moved: number;
  modified: number;
  totalOld: number;
  totalNew: number;
}

export interface VariableChange {
  type: 'added' | 'removed' | 'moved' | 'modified' | 'unchanged';
  variable: StorageVariable;
  oldSlot?: number;
  newSlot?: number;
  details?: string;
  risk: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface GasImpactAnalysis {
  deploymentCost: number;
  runtimeCost: number;
  storageSlotChanges: number;
  breakdown: {
    addedVariables: number;
    removedVariables: number;
    movedVariables: number;
  };
}

export interface SafetyAssessment {
  isSafe: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  issues: SafetyIssue[];
  overallScore: number;
}

export interface SafetyIssue {
  type: 'storage_collision' | 'variable_moved' | 'data_loss' | 'layout_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  mitigation: string;
}

export class StorageDiffAnalyzer {
  static analyze(
    oldMapping: SlotMapping,
    newMapping: SlotMapping,
    collisionReport: CollisionReport
  ): StorageDiffAnalysis {
    const summary = this.generateSummary(oldMapping, newMapping, collisionReport);
    const changes = this.analyzeChanges(oldMapping, newMapping, collisionReport);
    const gasImpact = this.calculateGasImpact(collisionReport);
    const safetyAssessment = this.assessSafety(collisionReport, changes);
    const recommendations = this.generateRecommendations(safetyAssessment, changes);

    return {
      summary,
      changes,
      gasImpact,
      safetyAssessment,
      recommendations
    };
  }

  private static generateSummary(
    oldMapping: SlotMapping,
    newMapping: SlotMapping,
    collisionReport: CollisionReport
  ): DiffSummary {
    const unchanged = this.countUnchangedVariables(oldMapping, newMapping, collisionReport);

    return {
      unchanged,
      added: collisionReport.added.length,
      removed: collisionReport.removed.length,
      moved: collisionReport.moved.length,
      modified: 0,
      totalOld: oldMapping.variables.length,
      totalNew: newMapping.variables.length
    };
  }

  private static analyzeChanges(
    oldMapping: SlotMapping,
    newMapping: SlotMapping,
    collisionReport: CollisionReport
  ): VariableChange[] {
    const changes: VariableChange[] = [];

    collisionReport.added.forEach(variable => {
      changes.push( {
        type: 'added',
        variable,
        risk: 'low',
        details: `New variable added at slot ${variable.slot}`
      });
    });

    collisionReport.removed.forEach(variable => {
      changes.push( {
        type: 'removed',
        variable,
        risk: 'high',
        details: `Variable removed from slot ${variable.slot} - data will be lost`
      });
    });

    collisionReport.moved.forEach(variable => {
      const oldVar = oldMapping.variables.find(v =>
        v.name === variable.name && v.type === variable.type
      );

      changes.push( {
        type: 'moved',
        variable,
        oldSlot: oldVar?.slot,
        newSlot: variable.slot,
        risk: 'critical',
        details: `Variable moved from slot ${oldVar?.slot} to slot ${variable.slot}`
      });
    });

    return changes;
  }

  private static calculateGasImpact(collisionReport: CollisionReport): GasImpactAnalysis {
    const addedCost = collisionReport.added.length * 20000;
    const removedCost = collisionReport.removed.length * 5000;
    const movedCost = collisionReport.moved.length * 25000;

    return {
      deploymentCost: addedCost + removedCost + movedCost,
      runtimeCost: (collisionReport.added.length + collisionReport.moved.length) * 2100,
      storageSlotChanges: collisionReport.added.length + collisionReport.removed.length + collisionReport.moved.length,
      breakdown: {
        addedVariables: addedCost,
        removedVariables: removedCost,
        movedVariables: movedCost
      }
    };
  }

  private static assessSafety(
    collisionReport: CollisionReport,
    changes: VariableChange[]
  ): SafetyAssessment {
    const issues: SafetyIssue[] = [];
    let overallScore = 100;

    if (collisionReport.collisions.length > 0) {
      issues.push( {
        type: 'storage_collision',
        severity: 'critical',
        description: `${collisionReport.collisions.length} storage collisions detected`,
        impact: 'Data corruption and unpredictable behavior',
        mitigation: 'Reorganize storage layout to eliminate overlaps'
      });
      overallScore -= 50;
    }

    if (collisionReport.moved.length > 0) {
      issues.push( {
        type: 'variable_moved',
        severity: 'high',
        description: `${collisionReport.moved.length} variables moved to different slots`,
        impact: 'Variable values will be lost during upgrade',
        mitigation: 'Implement data migration strategy or use storage gaps'
      });
      overallScore -= 30;
    }

    if (collisionReport.removed.length > 0) {
      issues.push( {
        type: 'data_loss',
        severity: 'medium',
        description: `${collisionReport.removed.length} variables removed`,
        impact: 'Storage slots will become unused but data remains',
        mitigation: 'Consider cleanup strategy for abandoned storage'
      });
      overallScore -= 15;
    }

    const riskLevel = overallScore >= 90 ? 'none' :
                     overallScore >= 70 ? 'low' :
                     overallScore >= 50 ? 'medium' :
                     overallScore >= 30 ? 'high' : 'critical';

    return {
      isSafe: collisionReport.safe,
      riskLevel,
      issues,
      overallScore: Math.max(0, overallScore)
    };
  }

  private static generateRecommendations(
    safetyAssessment: SafetyAssessment,
    changes: VariableChange[]
  ): string[] {
    const recommendations: string[] = [];

    if (safetyAssessment.isSafe) {
      recommendations.push('✅ Storage layout appears safe for upgrade');
      recommendations.push('🧪 Test upgrade in development environment before production');
    } else {
      recommendations.push('🚨 UNSAFE: Storage layout changes detected');

      if (safetyAssessment.issues.some(i => i.type === 'variable_moved')) {
        recommendations.push('📦 Use storage gaps: uint256[50] private __gap;');
        recommendations.push('🔄 Implement data migration contract');
      }

      if (safetyAssessment.issues.some(i => i.type === 'storage_collision')) {
        recommendations.push('⚠️ Resolve storage collisions before upgrade');
        recommendations.push('🔧 Reorganize variable declarations');
      }

      recommendations.push('🛡️ Consider using proxy upgrade patterns');
      recommendations.push('🔍 Use forge inspect to verify storage layout');
    }

    recommendations.push('📚 Review OpenZeppelin upgrade safety guidelines');

    return recommendations;
  }

  private static countUnchangedVariables(
    oldMapping: SlotMapping,
    newMapping: SlotMapping,
    collisionReport: CollisionReport
  ): number {
    const totalOld = oldMapping.variables.length;
    const { added, removed, moved } = collisionReport;

    return totalOld - removed.length - moved.length;
  }
}
