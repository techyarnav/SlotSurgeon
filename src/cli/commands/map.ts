import { Command } from 'commander';
import { SolidityParser } from '../../core/parser/solidity-parser';
import { SlotCalculator } from '../../core/slot-mapper/slot-calculator';
import { OutputFormatter } from '../../utils/formatters';
import { FileSystemUtils } from '../../utils/file-system';

export const mapCommand = new Command('map')
  .description('Generate storage slot mapping from Solidity file')
  .argument('<file>', 'Path to Solidity (.sol) file')
  .option('-o, --output <file>', 'Output file for the mapping (optional)')
  .option('-f, --format <type>', 'Output format (table|json)', 'table')
  .action(async (file: string, options) => {
    try {
      if (!FileSystemUtils.getFileExtension(file).includes('.sol')) {
        console.error(OutputFormatter.formatError('Input file must be a .sol file'));
        process.exit(1);
      }

      if (!(await FileSystemUtils.fileExists(file))) {
        console.error(OutputFormatter.formatError(`File not found: ${file}`));
        process.exit(1);
      }

      console.log(`🔍 Analyzing storage layout for: ${file}\n`);

      const parser = new SolidityParser(file);
      const contracts = await parser.parse();

      if (contracts.length === 0) {
        console.log(OutputFormatter.formatWarning('No contracts found in the file'));
        return;
      }

      for (const contract of contracts) {
        const slotMapping = SlotCalculator.calculateSlots(contract);

        if (options.format === 'json') {
          const jsonOutput = JSON.stringify(slotMapping, null, 2);
          console.log(jsonOutput);

          if (options.output) {
            await FileSystemUtils.writeFile(options.output, jsonOutput);
            console.log(OutputFormatter.formatSuccess(`Mapping saved to ${options.output}`));
          }
        } else {
          const tableOutput = OutputFormatter.formatSlotMapping(slotMapping);
          console.log(tableOutput);

          if (options.output) {
            await FileSystemUtils.writeFile(options.output, tableOutput);
            console.log(OutputFormatter.formatSuccess(`Mapping saved to ${options.output}`));
          }
        }
      }

    } catch (error) {
      console.error(OutputFormatter.formatError(`${error}`));
      process.exit(1);
    }
  });
