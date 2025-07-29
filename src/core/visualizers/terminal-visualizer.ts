import { SlotMapping } from '../../types/slot-mapping';
import { CollisionDetector } from '../slot-mapper/collision-detector';
import { OutputFormatter } from '../../utils/formatters';

export interface TerminalVisualizationOptions {
  includeInheritance?: boolean;
  showCollisions?: boolean;
  useColors?: boolean;
}

export class TerminalVisualizer {
  constructor(
    private readonly slotMapping: SlotMapping,
    private readonly contract: any,
    private readonly sourceFile: string
  ) {}

  async generate(options: TerminalVisualizationOptions = {}): Promise<string> {
    const {
      includeInheritance = false,
      showCollisions = false,
      useColors = true
    } = options;

    let output = '';


    if (useColors) {
      output += OutputFormatter.formatSuccess(`\n🎯 Storage Visualization: ${this.contract.name}\n`);
      output += OutputFormatter.formatDim(`Source: ${this.sourceFile}\n`);
    } else {
      output += `# Storage Visualization: ${this.contract.name}\n`;
      output += `Source: ${this.sourceFile}\n`;
      output += `Generated: ${new Date().toISOString()}\n`;
    }


    output += this.generateStorageLayoutTable(useColors);


    if (this.slotMapping.variables.length > 0) {
      output += this.generateStorageMap(useColors);
    }


    output += this.generateStorageSummary(useColors);

    return output;
  }

  private generateStorageLayoutTable(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

    const header = formatBold('\n📋 Storage Layout:');
    const separator = '─'.repeat(80);

    let output = `${header}\n${separator}\n`;


    output += `${formatBold('Slot')} │ ${formatBold('Variable')} │ ${formatBold('Type')} │ ${formatBold('Size')} │ ${formatBold('Offset')}\n`;
    output += separator + '\n';

    if (this.slotMapping.variables.length === 0) {
      output += `${formatInfo('No storage variables found')}\n`;
      return output + separator + '\n';
    }


    this.slotMapping.variables.forEach((variable: any) => {
      const slotNum = variable.slot.toString().padEnd(4);
      const varName = variable.name.padEnd(20);
      const varType = variable.type.padEnd(15);
      const size = `${variable.size}b`.padEnd(6);
      const offset = `${variable.offset}b`.padEnd(6);

      output += `${slotNum} │ ${varName} │ ${varType} │ ${size} │ ${offset}\n`;
    });

    output += separator + '\n';
    return output;
  }

  private generateStorageMap(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;

    const header = formatBold('\n🗺️  Storage Slot Map:');
    let output = `${header}\n`;


    const slotGroups = new Map<number, any[]>();
    this.slotMapping.variables.forEach(v => {
      if (!slotGroups.has(v.slot)) {
        slotGroups.set(v.slot, []);
      }
      slotGroups.get(v.slot)!.push(v);
    });


    const maxSlot = Math.max(...this.slotMapping.variables.map(v => v.slot));

    for (let slot = 0; slot <= maxSlot; slot++) {
      const vars = slotGroups.get(slot) || [];
      const usage = vars.reduce((sum, v) => sum + v.size, 0);
      const utilization = (usage / 32) * 100;

      let slotDisplay = `Slot ${slot.toString().padStart(2, '0')}`;
      slotDisplay = `[${slotDisplay}] ${utilization.toFixed(0)}% used`;

      output += slotDisplay;


      if (vars.length > 0) {
        const varNames = vars.map(v => v.name).join(', ');
        output += ` → ${varNames}`;
      }

      output += '\n';
    }

    return output + '\n';
  }

  private generateStorageSummary(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

    const totalSlots = this.slotMapping.variables.length > 0
      ? Math.max(...this.slotMapping.variables.map(v => v.slot)) + 1
      : 0;

    const totalVariables = this.slotMapping.variables.length;
    const totalSize = this.slotMapping.variables.reduce((sum, v) => sum + v.size, 0);
    const efficiency = totalSlots > 0 ? ((totalSize / (totalSlots * 32)) * 100).toFixed(1) : '0';

    const header = formatBold('\n📊 Storage Summary:');
    let output = `${header}\n`;

    output += `   Total Variables: ${formatInfo(totalVariables.toString())}\n`;
    output += `   Total Slots Used: ${formatInfo(totalSlots.toString())}\n`;
    output += `   Storage Efficiency: ${formatInfo(efficiency + '%')}\n`;
    output += `   Total Size: ${formatInfo(totalSize + ' bytes')}\n`;

    return output;
  }
}
