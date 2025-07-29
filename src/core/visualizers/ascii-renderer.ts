import chalk from 'chalk';
import { SlotMapping, StorageVariable } from '../../types/slot-mapping';

export interface AsciiOptions {
  width?: number;
  legend?: boolean;
  color?: boolean;
  showTable?: boolean;
  showSideDetails?: boolean;
}

export class AsciiRenderer {
  private readonly width: number;
  private readonly useColor: boolean;
  private readonly showLegend: boolean;
  private readonly showTable: boolean;
  private readonly showSideDetails: boolean;

  constructor(private readonly mapping: SlotMapping, opts: AsciiOptions = {}) {
    this.width = opts.width ?? 32;
    this.useColor = opts.color ?? true;
    this.showLegend = opts.legend ?? true;
    this.showTable = opts.showTable ?? true;
    this.showSideDetails = opts.showSideDetails ?? true;
  }

  render(): string {
    const rows: string[] = [];
    const legend: Map<string, string> = new Map();


    const palette = [
      chalk.cyan, chalk.green, chalk.yellow, chalk.magenta,
      chalk.blueBright, chalk.redBright, chalk.whiteBright,
    ];


    const matrix: string[][] = [];
    const slotVariables: Map<number, StorageVariable[]> = new Map();


    const totalSlots = Math.max(this.mapping.totalSlots, 0);
    for (let s = 0; s < totalSlots; s++) {
      matrix[s] = Array(this.width).fill('.');
      slotVariables.set(s, []);
    }

    const letterFor = (v: StorageVariable): string => {
      const first = v.name.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase() || '#';
      return first;
    };


    for (const v of this.mapping.variables) {
      let remaining = v.size;
      let slot = v.slot;
      let offset = v.offset;


      if (!slotVariables.get(slot)?.some(existing => existing.name === v.name)) {
        slotVariables.get(slot)?.push(v);
      }

      while (remaining > 0) {
        const bytesInThisSlot = Math.min(remaining, this.width - offset);
        for (let i = 0; i < bytesInThisSlot; i++) {
          if (matrix[slot]) {
            matrix[slot][offset + i] = letterFor(v);
          }
        }
        remaining -= bytesInThisSlot;
        slot += 1;
        offset = 0;


        if (remaining > 0 && slot < totalSlots && !slotVariables.get(slot)?.some(existing => existing.name === v.name)) {
          slotVariables.get(slot)?.push(v);
        }
      }
    }


    if (!this.useColor) {
      rows.push(`Storage Layout Visualization for ${this.mapping.contractName}`);
      rows.push('='.repeat(60));
      rows.push('');
    }


    if (totalSlots > 0) {
      rows.push('Storage Grid:');
      rows.push('');
    }

    matrix.forEach((row, slotIdx) => {
      const slotLabel = `S${slotIdx.toString().padStart(3, '0')}`;

      const displayRow = row
        .map(ch => {
          if (ch === '.') {
            return this.useColor ? chalk.dim('.') : '.';
          }
          if (!this.useColor) return ch;

          const idx = (ch.charCodeAt(0) - 65) % palette.length;
          return palette[idx](ch);
        })
        .join('');

      const formattedLabel = this.useColor
        ? chalk.gray(slotLabel)
        : slotLabel;

      let rowText = `${formattedLabel} ${displayRow}`;


      if (this.showSideDetails) {
        const varsInSlot = slotVariables.get(slotIdx) || [];
        if (varsInSlot.length > 0) {
          const varDetails = varsInSlot.map(v => {
            const letter = letterFor(v);
            const size = v.size < 32 ? `${v.size}b` : '32b';
            const offset = v.offset > 0 ? `+${v.offset}` : '';
            return `${letter}:${v.name}(${v.type})[${size}${offset}]`;
          }).join(' | ');

          rowText += `  ← ${varDetails}`;
        }
      }

      rows.push(rowText);
    });


    if (this.showTable) {
      rows.push('');
      rows.push('Detailed Variable Table:');
      rows.push(this.useColor ? '' : '-'.repeat(80));
      rows.push('');


      const headers = ['Slot', 'Offset', 'Size', 'Type', 'Variable', 'Packed'];
      const colWidths = [6, 8, 6, 20, 25, 8];

      if (this.useColor) {
        const headerRow = headers.map((h, i) => chalk.bold(h.padEnd(colWidths[i]))).join(' ');
        rows.push(headerRow);
        rows.push(chalk.gray('─'.repeat(80)));
      } else {
        const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' ');
        rows.push(headerRow);
        rows.push('-'.repeat(80));
      }


      this.mapping.variables.forEach(v => {
        const slotStr = v.slot.toString().padEnd(colWidths[0]);
        const offsetStr = v.offset.toString().padEnd(colWidths[1]);
        const sizeStr = `${v.size}b`.padEnd(colWidths[2]);
        const typeStr = v.type.padEnd(colWidths[3]);
        const nameStr = v.name.padEnd(colWidths[4]);
        const packedStr = (v.packed ? '✓' : '').padEnd(colWidths[5]);

        if (this.useColor) {
          const row = [
            chalk.yellow(slotStr),
            chalk.cyan(offsetStr),
            chalk.green(sizeStr),
            chalk.blue(typeStr),
            chalk.white(nameStr),
            v.packed ? chalk.green(packedStr) : packedStr
          ].join(' ');
          rows.push(row);
        } else {
          rows.push(`${slotStr} ${offsetStr} ${sizeStr} ${typeStr} ${nameStr} ${packedStr}`);
        }
      });
    }


    if (this.showLegend) {
      this.mapping.variables.forEach(v => {
        const letter = letterFor(v);
        if (!legend.has(letter)) legend.set(letter, v.name);
      });

      rows.push('');
      rows.push('Legend:');
      rows.push(this.useColor ? '' : '-'.repeat(20));

      legend.forEach((name, ch) => {
        const sym = this.useColor ? chalk.bold(ch) : ch;
        rows.push(`  ${sym} = ${name}`);
      });
    }

    return rows.join('\n');
  }
}
