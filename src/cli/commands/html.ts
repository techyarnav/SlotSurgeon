import { Command } from 'commander';
import { SolidityParser } from '../../core/parser/solidity-parser';
import { SlotCalculator } from '../../core/slot-mapper/slot-calculator';
import { HtmlGenerator } from '../../core/visualizers/html-generator';
import { StorageMarkdownGenerator } from '../../core/visualizers/storage-markdown-generator';
import { FileSystemUtils } from '../../utils/file-system';
import { OutputFormatter } from '../../utils/formatters';

export const htmlCommand = new Command('html')
  .description('Generate HTML or Markdown visualization of contract storage layout')
  .argument('<solidityFile>', '.sol file path')
  .option('-c, --contract <name>', 'Specify contract name if file contains many')
  .option('-o, --output <file>', 'Output file path')
  .option('-f, --format <type>', 'Output format: html, markdown', 'html')
  .option('--theme <theme>', 'Theme: light, dark', 'light')
  .option('--include-details', 'Include detailed variable information')
  .option('--include-assembly', 'Include assembly analysis (HTML only)')
  .action(async (file, options) => {
    try {
      if (!(await FileSystemUtils.fileExists(file))) {
        console.error(OutputFormatter.formatError(`File not found: ${file}`));
        process.exit(1);
      }

      const parser = new SolidityParser(file);
      const contracts = await parser.parse();

      if (contracts.length === 0) {
        console.error(OutputFormatter.formatError('No contracts found'));
        process.exit(1);
      }

      let target = contracts[0];
      if (options.contract) {
        const match = contracts.find(c => c.name === options.contract);
        if (!match) {
          console.error(OutputFormatter.formatError(`Contract ${options.contract} not found`));
          process.exit(1);
        }
        target = match;
      }

      const mapping = SlotCalculator.calculateSlots(target);

      console.log(`🎯 Packed Slots: ${Array.isArray(mapping.packedSlots) ? mapping.packedSlots.length : mapping.packedSlots}`);

      if (options.format === 'markdown') {
        const generator = new StorageMarkdownGenerator(mapping, target, file);
        const content = await generator.generate( {
          includeDetails: options.includeDetails,
          theme: options.theme
        });

        const outputPath = options.output || `${target.name}-storage-layout.md`;
        await FileSystemUtils.writeFile(outputPath, content);
        console.log(OutputFormatter.formatSuccess(`📝 Markdown report saved to ${outputPath}`));
      } else {
        const generator = new HtmlGenerator(mapping);

        const content = await generator.generate();

        const outputPath = options.output || `${target.name}-storage-layout.html`;
        await FileSystemUtils.writeFile(outputPath, content);
        console.log(OutputFormatter.formatSuccess(`🌐 HTML report saved to ${outputPath}`));
      }

    } catch (err) {
      console.error(OutputFormatter.formatError(`Report generation failed: ${err}`));
      process.exit(1);
    }
  });
