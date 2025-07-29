import { SlotMapping, StorageVariable } from '../../types/slot-mapping';
import { CollisionDetector, CollisionReport } from '../slot-mapper/collision-detector';
import { OutputFormatter } from '../../utils/formatters';

export interface TerminalDiffOptions {
  useColors?: boolean;
  detailed?: boolean;
  safetyOnly?: boolean;
  migrationTips?: boolean;
}

export interface DiffEntry {
  slot: number;
  oldVariable?: StorageVariable;
  newVariable?: StorageVariable;
  status: 'unchanged' | 'added' | 'removed' | 'moved' | 'modified';
  details?: string;
}

export class TerminalDiffVisualizer {
  private collisionReport: CollisionReport;

  constructor(
    private readonly oldMapping: SlotMapping,
    private readonly newMapping: SlotMapping,
    private readonly oldContract: any,
    private readonly newContract: any,
    private readonly oldFile: string,
    private readonly newFile: string
  ) {
    this.collisionReport = CollisionDetector.compare(oldMapping, newMapping);
  }

  async generate(options: TerminalDiffOptions = {}): Promise<string> {
    const {
      useColors = true,
      detailed = false,
      safetyOnly = false,
      migrationTips = false
    } = options;

    let output = '';


    if (useColors) {
      output += OutputFormatter.formatSuccess(`\n🔄 Storage Layout Comparison\n`);
      output += OutputFormatter.formatDim(`OLD: ${this.oldFile} (${this.oldContract.name})\n`);
      output += OutputFormatter.formatDim(`NEW: ${this.newFile} (${this.newContract.name})\n`);
    } else {
      output += `# Storage Layout Comparison\n`;
      output += `OLD: ${this.oldFile} (${this.oldContract.name})\n`;
      output += `NEW: ${this.newFile} (${this.newContract.name})\n`;
      output += `Generated: ${new Date().toISOString()}\n`;
    }

    if (!safetyOnly) {

      output += this.generateSideBySideComparison(useColors);


      output += this.generateChangeSummary(useColors);

      if (detailed) {

        output += this.generateDetailedAnalysis(useColors);
      }
    }


    output += this.generateSafetyAnalysis(useColors);


    if (migrationTips || !this.collisionReport.safe) {
      output += this.generateMigrationRecommendations(useColors);
    }

    return output;
  }

  private generateSideBySideComparison(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatSuccess = useColors ? OutputFormatter.formatSuccess : (text: string) => text;
    const formatError = useColors ? OutputFormatter.formatError : (text: string) => text;
    const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

    const header = formatBold('\n📊 Side-by-Side Layout:');
    const separator = '─'.repeat(120);

    let output = `${header}\n${separator}\n`;


    output += `${formatBold('Slot')} │ ${formatBold('OLD VERSION'.padEnd(35))} │ ${formatBold('NEW VERSION'.padEnd(35))} │ ${formatBold('Status')}\n`;
    output += separator + '\n';


    const diffEntries = this.generateDiffEntries();

    if (diffEntries.length === 0) {
      output += `${formatInfo('No storage variables found in either version')}\n`;
      return output + separator + '\n';
    }


    diffEntries.forEach(entry => {
      const slotNum = entry.slot.toString().padEnd(4);


      const oldDesc = entry.oldVariable
        ? `${entry.oldVariable.name} (${entry.oldVariable.type}, ${entry.oldVariable.size}b)`
        : '-';
      const oldColumn = oldDesc.padEnd(35);


      const newDesc = entry.newVariable
        ? `${entry.newVariable.name} (${entry.newVariable.type}, ${entry.newVariable.size}b)`
        : '-';
      const newColumn = newDesc.padEnd(35);


      let statusText = '';
      switch (entry.status) {
        case 'unchanged':
          statusText = formatSuccess('✅ UNCHANGED');
          break;
        case 'added':
          statusText = formatSuccess('➕ ADDED');
          break;
        case 'removed':
          statusText = formatError('❌ REMOVED');
          break;
        case 'moved':
          statusText = formatWarning('🔄 MOVED');
          break;
        case 'modified':
          statusText = formatWarning('⚠️ MODIFIED');
          break;
      }

      output += `${slotNum} │ ${oldColumn} │ ${newColumn} │ ${statusText}\n`;


      if (entry.details) {
        output += `     │ ${' '.repeat(35)} │ ${' '.repeat(35)} │ ${formatInfo(entry.details)}\n`;
      }
    });

    output += separator + '\n';
    return output;
  }

  private generateDiffEntries(): DiffEntry[] {
    const entries: DiffEntry[] = [];
    const processedSlots = new Set<number>();


    const findVariable = (variables: StorageVariable[], name: string, type: string) => {
      return variables.find(v => v.name === name && v.type === type);
    };


    const allSlots = new Set([
      ...this.oldMapping.variables.map(v => v.slot),
      ...this.newMapping.variables.map(v => v.slot)
    ]);


    const oldSlotGroups = this.groupVariablesBySlot(this.oldMapping.variables);
    const newSlotGroups = this.groupVariablesBySlot(this.newMapping.variables);


    for (const slot of Array.from(allSlots).sort((a, b) => a - b)) {
      const oldVars = oldSlotGroups.get(slot) || [];
      const newVars = newSlotGroups.get(slot) || [];


      const processedVarKeys = new Set<string>();


      for (const oldVar of oldVars) {
        const varKey = `${oldVar.name}|${oldVar.type}`;
        const newVar = findVariable(newVars, oldVar.name, oldVar.type);

        if (newVar) {

          if (oldVar.slot === newVar.slot && oldVar.offset === newVar.offset && oldVar.size === newVar.size) {

            entries.push( {
              slot,
              oldVariable: oldVar,
              newVariable: newVar,
              status: 'unchanged'
            });
          } else if (oldVar.slot !== newVar.slot) {

            entries.push( {
              slot,
              oldVariable: oldVar,
              newVariable: undefined,
              status: 'moved',
              details: `Moved from slot ${oldVar.slot} to slot ${newVar.slot}`
            });
          } else {

            entries.push( {
              slot,
              oldVariable: oldVar,
              newVariable: newVar,
              status: 'modified',
              details: `Offset: ${oldVar.offset}→${newVar.offset}, Size: ${oldVar.size}→${newVar.size}`
            });
          }
          processedVarKeys.add(varKey);
        } else {

          entries.push( {
            slot,
            oldVariable: oldVar,
            newVariable: undefined,
            status: 'removed'
          });
        }
      }


      for (const newVar of newVars) {
        const varKey = `${newVar.name}|${newVar.type}`;
        if (!processedVarKeys.has(varKey)) {

          entries.push( {
            slot,
            oldVariable: undefined,
            newVariable: newVar,
            status: 'added'
          });
        }
      }
    }

    return entries;
  }

  private generateChangeSummary(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatSuccess = useColors ? OutputFormatter.formatSuccess : (text: string) => text;
    const formatError = useColors ? OutputFormatter.formatError : (text: string) => text;
    const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;

    const header = formatBold('\n📈 Change Summary:');
    let output = `${header}\n`;

    const { added, removed, moved } = this.collisionReport;
    const unchanged = this.countUnchangedVariables();

    output += `   ${formatSuccess('✅ Unchanged')}: ${unchanged} variables\n`;
    output += `   ${formatSuccess('➕ Added')}: ${added.length} variables\n`;
    output += `   ${formatError('❌ Removed')}: ${removed.length} variables\n`;
    output += `   ${formatWarning('🔄 Moved')}: ${moved.length} variables\n`;


    const oldEfficiency = this.calculateStorageEfficiency(this.oldMapping);
    const newEfficiency = this.calculateStorageEfficiency(this.newMapping);
    const efficiencyDelta = newEfficiency - oldEfficiency;

    output += `   ${formatBold('Storage Efficiency')}: ${oldEfficiency.toFixed(1)}% → ${newEfficiency.toFixed(1)}%`;

    if (efficiencyDelta > 0) {
      output += ` (${formatSuccess('+' + efficiencyDelta.toFixed(1) + '%')})\n`;
    } else if (efficiencyDelta < 0) {
      output += ` (${formatError(efficiencyDelta.toFixed(1) + '%')})\n`;
    } else {
      output += ` (no change)\n`;
    }

    return output + '\n';
  }

  private generateDetailedAnalysis(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;
    const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;

    const header = formatBold('\n🔍 Detailed Analysis:');
    let output = `${header}\n`;


    const gasImpact = this.calculateGasImpact();
    output += `   ${formatBold('Estimated Gas Impact')}:\n`;
    output += `     • Deployment: ${formatInfo(gasImpact.deployment.toLocaleString() + ' gas')}\n`;
    output += `     • Runtime: ${formatInfo(gasImpact.runtime.toLocaleString() + ' gas per operation')}\n`;


    const oldSlots = this.getSlotCount(this.oldMapping);
    const newSlots = this.getSlotCount(this.newMapping);
    const slotDelta = newSlots - oldSlots;

    output += `   ${formatBold('Slot Utilization')}:\n`;
    output += `     • Before: ${formatInfo(oldSlots + ' slots')}\n`;
    output += `     • After: ${formatInfo(newSlots + ' slots')}\n`;

    if (slotDelta > 0) {
      output += `     • Change: ${formatWarning('+' + slotDelta + ' slots (increased storage)')}\n`;
    } else if (slotDelta < 0) {
      output += `     • Change: ${formatInfo(slotDelta + ' slots (reduced storage)')}\n`;
    } else {
      output += `     • Change: ${formatInfo('No change in slot count')}\n`;
    }

    return output + '\n';
  }

  private generateSafetyAnalysis(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatSuccess = useColors ? OutputFormatter.formatSuccess : (text: string) => text;
    const formatError = useColors ? OutputFormatter.formatError : (text: string) => text;
    const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;

    const header = formatBold('\n⚠️  Upgrade Safety Analysis:');
    let output = `${header}\n`;

    if (this.collisionReport.safe) {
      output += `${formatSuccess('✅ SAFE UPGRADE')}\n`;
      output += `   No storage layout conflicts detected.\n`;
      output += `   Upgrade should proceed without storage corruption.\n`;
    } else {
      output += `${formatError('❌ UNSAFE UPGRADE DETECTED')}\n`;

      if (this.collisionReport.moved.length > 0) {
        output += `   • ${formatWarning(this.collisionReport.moved.length + ' variables moved')}\n`;
        this.collisionReport.moved.slice(0, 3).forEach(variable => {
          output += `     - ${variable.name} (${variable.type})\n`;
        });
        if (this.collisionReport.moved.length > 3) {
          output += `     - ... and ${this.collisionReport.moved.length - 3} more\n`;
        }
      }

      if (this.collisionReport.removed.length > 0) {
        output += `   • ${formatError(this.collisionReport.removed.length + ' variables removed')}\n`;
        this.collisionReport.removed.slice(0, 3).forEach(variable => {
          output += `     - ${variable.name} (${variable.type})\n`;
        });
        if (this.collisionReport.removed.length > 3) {
          output += `     - ... and ${this.collisionReport.removed.length - 3} more\n`;
        }
      }

      if (this.collisionReport.collisions.length > 0) {
        output += `   • ${formatError(this.collisionReport.collisions.length + ' storage collisions')}\n`;
        this.collisionReport.collisions.slice(0, 3).forEach(collision => {
          output += `     - Slot ${collision.slot}: ${collision.reason}\n`;
        });
        if (this.collisionReport.collisions.length > 3) {
          output += `     - ... and ${this.collisionReport.collisions.length - 3} more\n`;
        }
      }

      if (this.collisionReport.added.length > 0) {
        output += `   • ${formatWarning(this.collisionReport.added.length + ' variables added')}\n`;
      }
    }

    return output + '\n';
  }

  private generateMigrationRecommendations(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;
    const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;

    const header = formatBold('\n💡 Migration Recommendations:');
    let output = `${header}\n`;

    if (this.collisionReport.safe) {
      output += `   ${formatInfo('✓')} Storage layout is compatible\n`;
      output += `   ${formatInfo('✓')} Upgrade can proceed safely\n`;
      output += `   ${formatInfo('✓')} Consider testing in a development environment first\n`;
    } else {
      output += `   ${formatWarning('⚠')} Use storage gaps to prevent future conflicts:\n`;
      output += `       uint256[50] private __gap;\n`;
      output += `   ${formatWarning('⚠')} Consider using proxy upgrade patterns:\n`;
      output += `       - OpenZeppelin's upgradeable contracts\n`;
      output += `       - Diamond standard (EIP-2535)\n`;
      output += `   ${formatWarning('⚠')} Implement data migration strategy:\n`;
      output += `       - Create migration contract to move data\n`;
      output += `       - Use temporary storage for transition\n`;
      output += `   ${formatWarning('⚠')} Test thoroughly before deployment:\n`;
      output += `       - Fork mainnet for testing\n`;
      output += `       - Verify storage layout with forge inspect\n`;

      if (this.collisionReport.moved.length > 0) {
        output += `   ${formatWarning('⚠')} Handle moved variables carefully:\n`;
        output += `       - Variables may lose their values\n`;
        output += `       - Consider data preservation strategies\n`;
      }
    }

    return output;
  }


  private groupVariablesBySlot(variables: StorageVariable[]): Map<number, StorageVariable[]> {
    const groups = new Map<number, StorageVariable[]>();

    for (const variable of variables) {
      if (!groups.has(variable.slot)) {
        groups.set(variable.slot, []);
      }
      groups.get(variable.slot)!.push(variable);
    }

    return groups;
  }

  private countUnchangedVariables(): number {
    const byKey = (v: StorageVariable) => `${v.name}|${v.type}`;
    const oldKeys = new Map(this.oldMapping.variables.map(v => [byKey(v), v]));
    const newKeys = new Map(this.newMapping.variables.map(v => [byKey(v), v]));

    let unchanged = 0;
    for (const [key, oldVar] of oldKeys) {
      const newVar = newKeys.get(key);
      if (newVar && oldVar.slot === newVar.slot && oldVar.offset === newVar.offset) {
        unchanged++;
      }
    }

    return unchanged;
  }

  private calculateStorageEfficiency(mapping: SlotMapping): number {
    if (mapping.variables.length === 0) return 0;

    const totalSlots = Math.max(...mapping.variables.map(v => v.slot)) + 1;
    const totalUsedBytes = mapping.variables.reduce((sum, v) => sum + v.size, 0);
    const totalAvailableBytes = totalSlots * 32;

    return (totalUsedBytes / totalAvailableBytes) * 100;
  }

  private calculateGasImpact(): { deployment: number; runtime: number } {
    const { added, removed, moved } = this.collisionReport;


    const deploymentGas = (added.length * 20000) + (removed.length * 5000) + (moved.length * 25000);
    const runtimeGas = (added.length * 2100) + (moved.length * 2100);

    return {
      deployment: deploymentGas,
      runtime: runtimeGas
    };
  }

  private getSlotCount(mapping: SlotMapping): number {
    if (mapping.variables.length === 0) return 0;
    return Math.max(...mapping.variables.map(v => v.slot)) + 1;
  }
}
