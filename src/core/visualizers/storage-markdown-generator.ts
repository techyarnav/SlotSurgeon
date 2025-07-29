import { SlotMapping, StorageVariable } from '../../types/slot-mapping';
import { ContractAST } from '../parser/types';
import { BaseMarkdownGenerator } from './base-markdown-generator';

export interface StorageMarkdownOptions {
  includeDetails?: boolean;
  theme?: 'light' | 'dark';
  includeSourceCode?: boolean;
  includeOptimizations?: boolean;
}

export class StorageMarkdownGenerator extends BaseMarkdownGenerator {
  constructor(
    private readonly mapping: SlotMapping,
    private readonly contract: ContractAST,
    private readonly sourceFile: string
  ) {
    super();
  }

  async generate(options: StorageMarkdownOptions = {}): Promise<string> {
    const { includeDetails = true, includeOptimizations = true } = options;

    let markdown = this.generateMetadata();


    markdown += this.formatHeader(1, `Storage Layout Analysis: ${this.mapping.contractName}`);
    markdown += `${this.formatBold('Source:')} ${this.sourceFile}  \n`;
    markdown += `${this.formatBold('Generated:')} ${new Date().toISOString()}  \n`;
    markdown += `${this.formatBold('Total Slots:')} ${this.mapping.totalSlots}  \n`;
    markdown += `${this.formatBold('Packed Slots:')} ${Array.isArray(this.mapping.packedSlots) ? this.mapping.packedSlots.length : this.mapping.packedSlots}  \n\n`;


    markdown += this.generateStorageLayoutTable();


    markdown += this.generateStorageMapVisualization();


    if (includeDetails) {
      markdown += this.generateContractDetails();
      markdown += this.generateStorageEfficiencyAnalysis();
      markdown += this.generatePackingAnalysis();
    }


    if (includeOptimizations) {
      markdown += this.generateOptimizationRecommendations();
    }

    return markdown;
  }

  private generateStorageLayoutTable(): string {
    let section = this.formatHeader(2, '📋 Storage Layout');

    const headers = ['Slot', 'Variable', 'Type', 'Size', 'Offset', 'Packed'];
    const rows = this.mapping.variables.map(variable => [
      variable.slot.toString(),
      this.formatCode(variable.name),
      this.formatCode(variable.type),
      `${variable.size}b`,
      `${variable.offset}b`,
      variable.packed ? '✅' : '❌'
    ]);

    section += this.formatTable(headers, rows);
    return section;
  }

  private generateStorageMapVisualization(): string {
    let section = this.formatHeader(2, '🗺️ Storage Slot Map');

    const slotGroups = this.groupVariablesBySlot();

    slotGroups.forEach((variables, slot) => {
      const totalUsed = variables.reduce((sum, v) => sum + v.size, 0);
      const efficiency = Math.round((totalUsed / 32) * 100);

      section += this.formatHeader(3, `Slot ${slot} (${efficiency}% used)`);

      const slotVisualization = `[Slot ${slot.toString().padStart(2, '0')}] ${efficiency}% used → ${variables.map(v => v.name).join(', ')}`;
      section += this.formatCodeBlock(slotVisualization);
    });

    return section;
  }

  private generateContractDetails(): string {
    let section = this.formatHeader(2, '📊 Contract Details');

    const details = [
      `${this.formatBold('Name:')} ${this.contract.name}`,
      `${this.formatBold('State Variables:')} ${this.contract.stateVariables.length}`,
      `${this.formatBold('Functions:')} ${this.contract.functions.length}`,
      `${this.formatBold('Events:')} ${this.contract.events.length}`,
      `${this.formatBold('Modifiers:')} ${this.contract.modifiers.length}`
    ];

    if (this.contract.baseContracts.length > 0) {
      details.push(`${this.formatBold('Base Contracts:')} ${this.contract.baseContracts.join(', ')}`);
    }

    section += this.formatList(details);
    return section;
  }

  private generateStorageEfficiencyAnalysis(): string {
    let section = this.formatHeader(2, '📈 Storage Efficiency');

    const totalBytesUsed = this.mapping.variables.reduce((sum, v) => sum + v.size, 0);
    const totalBytesAvailable = this.mapping.totalSlots * 32;
    const efficiency = totalBytesAvailable > 0 ? (totalBytesUsed / totalBytesAvailable) * 100 : 0;

    const analysis = [
      `${this.formatBold('Total Bytes Used:')} ${totalBytesUsed}`,
      `${this.formatBold('Total Bytes Available:')} ${totalBytesAvailable}`,
      `${this.formatBold('Storage Efficiency:')} ${efficiency.toFixed(1)}%`,
      `${this.formatBold('Wasted Space:')} ${totalBytesAvailable - totalBytesUsed} bytes`
    ];

    section += this.formatList(analysis);
    return section;
  }

  private generatePackingAnalysis(): string {
    const packedSlotCount = Array.isArray(this.mapping.packedSlots) ? this.mapping.packedSlots.length : 0;

    if (packedSlotCount === 0) {
      return '';
    }

    let section = this.formatHeader(2, '📦 Packing Analysis');

    const packedVariables = this.mapping.variables.filter(v => v.packed);
    const packingDetails = [
      `${this.formatBold('Packed Slots:')} ${packedSlotCount}`,
      `${this.formatBold('Packed Variables:')} ${packedVariables.length}`,
      `${this.formatBold('Packing Efficiency:')} Variables are efficiently packed in ${packedSlotCount} slots`
    ];

    section += this.formatList(packingDetails);


    if (Array.isArray(this.mapping.packedSlots) && this.mapping.packedSlots.length > 0) {
      section += this.formatHeader(3, 'Packed Slot Details');

      const slotGroups = this.groupVariablesBySlot();
      this.mapping.packedSlots.forEach(slotNum => {
        const variables = slotGroups.get(slotNum) || [];
        if (variables.length > 1) {
          section += `${this.formatBold(`Slot ${slotNum}:`)} ${variables.map(v => `${v.name} (${v.size}b)`).join(', ')}\n\n`;
        }
      });
    }

    return section;
  }

  private generateOptimizationRecommendations(): string {
    let section = this.formatHeader(2, '💡 Optimization Recommendations');

    const recommendations = this.generateRecommendations();

    if (recommendations.length > 0) {
      section += this.formatList(recommendations, true);
    } else {
      section += `${this.formatEmoji('✅', 'No specific recommendations - storage layout looks good!')}\n\n`;
    }

    return section;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];


    const slotGroups = this.groupVariablesBySlot();
    let underutilizedSlots = 0;

    slotGroups.forEach((variables, slot) => {
      const totalUsed = variables.reduce((sum, v) => sum + v.size, 0);
      if (totalUsed < 20 && variables.length === 1) {
        underutilizedSlots++;
      }
    });

    if (underutilizedSlots > 0) {
      recommendations.push(`Consider packing small variables together to optimize ${underutilizedSlots} underutilized slots`);
    }


    if (this.mapping.totalSlots > 10) {
      recommendations.push('Consider using structs to organize related variables and reduce storage complexity');
    }


    if (this.contract.baseContracts.length > 0) {
      recommendations.push('For upgradeable contracts, consider adding storage gaps to prevent future layout conflicts');
    }


    const largeVariables = this.mapping.variables.filter(v => v.size === 32);
    const smallVariables = this.mapping.variables.filter(v => v.size < 32);

    if (largeVariables.length > 0 && smallVariables.length > 1) {
      recommendations.push('Consider reordering variables to group smaller types together for better packing');
    }

    return recommendations;
  }

  private groupVariablesBySlot(): Map<number, StorageVariable[]> {
    const groups = new Map<number, StorageVariable[]>();

    this.mapping.variables.forEach(variable => {
      if (!groups.has(variable.slot)) {
        groups.set(variable.slot, []);
      }
      groups.get(variable.slot)!.push(variable);
    });

    return groups;
  }
}
