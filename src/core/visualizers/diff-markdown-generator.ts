import { SlotMapping } from '../../types/slot-mapping';
import { ContractAST } from '../parser/types';
import { CollisionDetector } from '../slot-mapper/collision-detector';
import { BaseMarkdownGenerator } from './base-markdown-generator';

export interface DiffMarkdownOptions {
  detailed?: boolean;
  migrationTips?: boolean;
  includeGasAnalysis?: boolean;
}

export class DiffMarkdownGenerator extends BaseMarkdownGenerator {
  constructor(
    private readonly mappingV1: SlotMapping,
    private readonly mappingV2: SlotMapping,
    private readonly contractV1: ContractAST,
    private readonly contractV2: ContractAST,
    private readonly fileV1: string,
    private readonly fileV2: string
  ) {
    super();
  }

  async generate(options: DiffMarkdownOptions = {}): Promise<string> {
    const { detailed = true, migrationTips = true, includeGasAnalysis = false } = options;

    let markdown = this.generateMetadata();


    markdown += this.formatHeader(1, `Storage Layout Comparison: ${this.mappingV1.contractName}`);
    markdown += `${this.formatBold('Old Version:')} ${this.fileV1}  \n`;
    markdown += `${this.formatBold('New Version:')} ${this.fileV2}  \n`;
    markdown += `${this.formatBold('Generated:')} ${new Date().toISOString()}  \n\n`;


    const comparisonReport = CollisionDetector.compare(this.mappingV1, this.mappingV2);
    markdown += this.generateUpgradeSafetyAnalysis(comparisonReport);


    markdown += this.generateSideBySideComparison();


    if (detailed) {
      markdown += this.generateChangesAnalysis(comparisonReport);
    }


    if (includeGasAnalysis) {
      markdown += this.generateGasImpactAnalysis(comparisonReport);
    }


    if (migrationTips) {
      markdown += this.generateMigrationRecommendations(comparisonReport);
    }

    return markdown;
  }

  private generateUpgradeSafetyAnalysis(report: any): string {
    let section = this.formatHeader(2, '🛡️ Upgrade Safety Analysis');

    const safetyStatus = report.safe ?
      this.formatEmoji('✅', this.formatBold('SAFE UPGRADE')) :
      this.formatEmoji('⚠️', this.formatBold('UNSAFE UPGRADE'));

    section += `${safetyStatus}\n\n`;

    const summary = [
      `${this.formatBold('Added Variables:')} ${report.added.length}`,
      `${this.formatBold('Removed Variables:')} ${report.removed.length}`,
      `${this.formatBold('Moved Variables:')} ${report.moved.length}`,
      `${this.formatBold('Storage Collisions:')} ${report.collisions.length}`
    ];

    section += this.formatList(summary);

    if (!report.safe) {
      section += `${this.formatEmoji('⚠️', this.formatBold('WARNING:'))} This upgrade contains breaking changes that could corrupt existing storage data!\n\n`;
    }

    return section;
  }

  private generateSideBySideComparison(): string {
    let section = this.formatHeader(2, '📋 Side-by-Side Layout Comparison');

    const headers = ['Slot', 'Old Version', 'New Version', 'Change'];
    const rows: string[][] = [];

    const maxSlots = Math.max(this.mappingV1.totalSlots, this.mappingV2.totalSlots);

    for (let slot = 0; slot < maxSlots; slot++) {
      const oldVars = this.mappingV1.variables.filter(v => v.slot === slot);
      const newVars = this.mappingV2.variables.filter(v => v.slot === slot);

      const oldDesc = oldVars.length > 0 ?
        oldVars.map(v => `${v.name} (${v.type})`).join(', ') :
        this.formatItalic('empty');

      const newDesc = newVars.length > 0 ?
        newVars.map(v => `${v.name} (${v.type})`).join(', ') :
        this.formatItalic('empty');

      let change = 'unchanged';
      if (oldVars.length === 0 && newVars.length > 0) {
        change = '🆕 added';
      } else if (oldVars.length > 0 && newVars.length === 0) {
        change = '🗑️ removed';
      } else if (oldDesc !== newDesc) {
        change = '🔄 modified';
      }

      rows.push([
        slot.toString(),
        oldDesc,
        newDesc,
        change
      ]);
    }

    section += this.formatTable(headers, rows);
    return section;
  }

  private generateChangesAnalysis(report: any): string {
    let section = this.formatHeader(2, '🔍 Detailed Changes Analysis');


    if (report.added.length > 0) {
      section += this.formatHeader(3, '🆕 Added Variables');
      const addedList = report.added.map((variable: any) =>
        `${this.formatCode(variable.name)} (${variable.type}) - Slot ${variable.slot}`
      );
      section += this.formatList(addedList);
    }


    if (report.removed.length > 0) {
      section += this.formatHeader(3, '🗑️ Removed Variables');
      const removedList = report.removed.map((variable: any) =>
        `${this.formatCode(variable.name)} (${variable.type}) - Was in Slot ${variable.slot}`
      );
      section += this.formatList(removedList);
    }


    if (report.moved.length > 0) {
      section += this.formatHeader(3, '🔄 Moved Variables');
      const movedList = report.moved.map((change: any) =>
        `${this.formatCode(change.variable)} moved from Slot ${change.oldSlot} to Slot ${change.newSlot}`
      );
      section += this.formatList(movedList);
    }


    if (report.collisions.length > 0) {
      section += this.formatHeader(3, '💥 Storage Collisions');
      const collisionList = report.collisions.map((collision: any) =>
        `Slot ${collision.slot}: ${this.formatCode(collision.variable)} conflicts with ${this.formatCode(collision.conflictsWith)} (${collision.severity} severity)`
      );
      section += this.formatList(collisionList);
    }

    return section;
  }

  private generateGasImpactAnalysis(report: any): string {
    let section = this.formatHeader(2, '⛽ Gas Impact Analysis');


    const addedSlotsGas = report.added.length * 20000;
    const collisionGas = report.collisions.length * 5000;
    const totalEstimatedGas = addedSlotsGas + collisionGas;

    const gasAnalysis = [
      `${this.formatBold('New Storage Slots:')} ${report.added.length} (≈${addedSlotsGas.toLocaleString()} gas)`,
      `${this.formatBold('Collision Overhead:')} ${report.collisions.length} issues (≈${collisionGas.toLocaleString()} gas)`,
      `${this.formatBold('Estimated Total Impact:')} ≈${totalEstimatedGas.toLocaleString()} gas per deployment`
    ];

    section += this.formatList(gasAnalysis);

    if (totalEstimatedGas > 100000) {
      section += `${this.formatEmoji('⚠️', this.formatBold('High Gas Impact:'))} Consider optimizing storage layout to reduce deployment costs.\n\n`;
    }

    return section;
  }

  private generateMigrationRecommendations(report: any): string {
    let section = this.formatHeader(2, '🎯 Migration Recommendations');

    const recommendations: string[] = [];

    if (!report.safe) {
      recommendations.push('🚨 **CRITICAL:** This upgrade is not safe. Storage layout conflicts detected.');
      recommendations.push('Consider using a proxy pattern with storage gaps for safer upgrades.');
    }

    if (report.moved.length > 0) {
      recommendations.push('Review moved variables - they may cause data corruption in upgradeable contracts.');
    }

    if (report.collisions.length > 0) {
      recommendations.push('Resolve storage collisions before deploying the upgrade.');
    }

    if (report.added.length > 5) {
      recommendations.push('Consider using structs to group related new variables.');
    }


    if (report.safe && report.added.length > 0) {
      recommendations.push('✅ Safe to upgrade - new variables are appended without conflicts.');
      recommendations.push('Test thoroughly on a testnet before mainnet deployment.');
    }


    if (this.contractV1.baseContracts.length > 0 || this.contractV2.baseContracts.length > 0) {
      recommendations.push('Add storage gaps (e.g., `uint256[50] private __gap;`) for future upgrade safety.');
    }

    if (recommendations.length > 0) {
      section += this.formatList(recommendations);
    } else {
      section += `${this.formatEmoji('✅', 'No specific migration recommendations needed.')}\n\n`;
    }

    return section;
  }
}
