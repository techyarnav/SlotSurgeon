import { StorageVariable, SlotMapping } from '../types/slot-mapping';
import chalk from 'chalk';


export class OutputFormatter {
  static formatSuccess(text: string): string {
    return `\x1b[32m${text}\x1b[0m`;
  }

  static formatError(text: string): string {
    return `\x1b[31m${text}\x1b[0m`;
  }

  static formatWarning(text: string): string {
    return `\x1b[33m${text}\x1b[0m`;
  }

  static formatInfo(text: string): string {
    return `\x1b[36m${text}\x1b[0m`;
  }

  static formatHighlight(text: string): string {
    return `\x1b[35m${text}\x1b[0m`;
  }

  static formatBold(text: string): string {
    return `\x1b[1m${text}\x1b[0m`;
  }

  static formatDim(text: string): string {
    return `\x1b[2m${text}\x1b[0m`;
  }

  static formatUnderline(text: string): string {
    return `\x1b[4m${text}\x1b[0m`;
  }

  static formatSlotMapping(slotMapping: any): string {
    const header = `\n${this.formatBold('Storage Layout:')}`;
    const separator = '-'.repeat(60);

    let output = `${header}\n${separator}\n`;

    if (slotMapping.variables && slotMapping.variables.length > 0) {
      output += `${this.formatBold('Slot')} | ${this.formatBold('Variable')} | ${this.formatBold('Type')} | ${this.formatBold('Size')} | ${this.formatBold('Offset')}\n`;
      output += separator + '\n';

      slotMapping.variables.forEach((variable: any) => {
        const slot = variable.slot.toString().padEnd(4);
        const name = variable.name.padEnd(15);
        const type = variable.type.padEnd(15);
        const size = `${variable.size}b`.padEnd(6);
        const offset = `${variable.offset}b`.padEnd(6);

        output += `${slot} | ${name} | ${type} | ${size} | ${offset}\n`;
      });

      output += separator;
      output += `\n${this.formatInfo('Total Variables:')} ${slotMapping.variables.length}`;
      output += `\n${this.formatInfo('Total Slots Used:')} ${Math.max(...slotMapping.variables.map((v: any) => v.slot)) + 1}`;
    } else {
      output += `${this.formatWarning('No storage variables found')}\n`;
    }

    return output;
  }


  static formatTable(headers: string[], rows: string[][], options: { colors?: boolean } = {}): string {
    const { colors = true } = options;

    if (rows.length === 0) {
      return colors ? this.formatWarning('No data to display') : 'No data to display';
    }


    const widths = headers.map((header, i) =>
      Math.max(header.length, ...rows.map(row => (row[i] || '').length))
    );

    const separator = '─'.repeat(widths.reduce((sum, w) => sum + w + 3, -1));
    const formatHeader = colors ? this.formatBold : (text: string) => text;

    let output = separator + '\n';


    output += headers.map((header, i) =>
      formatHeader(header.padEnd(widths[i]))
    ).join(' │ ') + '\n';

    output += separator + '\n';


    rows.forEach(row => {
      output += row.map((cell, i) =>
        (cell || '').padEnd(widths[i])
      ).join(' │ ') + '\n';
    });

    output += separator;
    return output;
  }
}
