import { Command } from 'commander';
import { SolidityParser } from '../../core/parser/solidity-parser';
import { SlotCalculator } from '../../core/slot-mapper/slot-calculator';
import { AssemblyAnalyzer } from '../../core/assembly/assembly-analyzer';
import { TerminalAssemblyVisualizer } from '../../core/visualizers/terminal-assembly-visualizer';
import { FileSystemUtils } from '../../utils/file-system';
import { OutputFormatter } from '../../utils/formatters';

export const assemblyCommand = new Command('assembly')
  .description('Analyze assembly bytecode and gas optimization opportunities')
  .argument('<solidityFile>', 'Solidity file to analyze')
  .option('-c, --contract <name>', 'Specify contract name if file contains many')
  .option('-o, --output <file>', 'Save assembly analysis to file')
  .option('-f, --format <type>', 'Output format: terminal, html, markdown', 'terminal')
  .option('--no-color', 'Disable ANSI colors for terminal output')
  .option('--detailed', 'Show detailed assembly instruction analysis')
  .option('--gas-price <price>', 'Gas price in gwei for cost calculations', '20')
  .option('--hotspots-only', 'Show only gas hotspot analysis')
  .option('--optimizations', 'Include optimization suggestions')
  .option('--compare-before-after', 'Show before/after optimization comparison')
  .action(async (file, options) => {
    try {
      if (!(await FileSystemUtils.fileExists(file))) {
        console.error(OutputFormatter.formatError(`File not found: ${file}`));
        process.exit(1);
      }

      const parser = new SolidityParser(file);
      const contracts = await parser.parse();

      if (contracts.length === 0) {
        console.error(OutputFormatter.formatError('No contracts found in file'));
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

      const slotMapping = SlotCalculator.calculateSlots(target);

      const targetWithSource = {
        ...target,
        source: await FileSystemUtils.readFile(file)
      };

      const analysis = await AssemblyAnalyzer.analyze(targetWithSource, slotMapping);

      if (options.format === 'html') {
        const { AssemblyHtmlGenerator } = require('../../core/visualizers/assembly-html-generator');

        const generator = new AssemblyHtmlGenerator(analysis, target, file, slotMapping);
        const content = await generator.generate( {
          theme: 'light',
          includeOptimizations: options.optimizations || !options.hotspotsOnly,
          includeRiskDetails: options.detailed,
          interactive: true
        });

        const outputPath = options.output || `${target.name}-assembly-analysis.html`;
        await FileSystemUtils.writeFile(outputPath, content);
        console.log(OutputFormatter.formatSuccess(`🌐 Assembly HTML report saved to ${outputPath}`));

      } else if (options.format === 'markdown') {
        const { AssemblyMarkdownGenerator } = require('../../core/visualizers/assembly-markdown-generator');
        const generator = new AssemblyMarkdownGenerator(analysis, target, file, slotMapping);
        const content = await generator.generate( {
          detailed: options.detailed,
          hotspotsOnly: options.hotspotsOnly,
          includeOptimizations: options.optimizations
        });

        const outputPath = options.output || `${target.name}-assembly-analysis.md`;
        await FileSystemUtils.writeFile(outputPath, content);
        console.log(OutputFormatter.formatSuccess(`📝 Markdown assembly report saved to ${outputPath}`));

      } else if (options.format === 'terminal') {
        const visualizer = new TerminalAssemblyVisualizer(
          analysis,
          target,
          file,
          slotMapping
        );

        const output = await visualizer.generate( {
          useColors: options.color,
          detailed: options.detailed,
          hotspotsOnly: options.hotspotsOnly,
          includeOptimizations: options.optimizations || !options.hotspotsOnly,
          compareBeforeAfter: options.compareBeforeAfter,
          gasPrice: parseFloat(options.gasPrice)
        });

        console.log(output);

        if (options.output) {
          const fileOutput = await visualizer.generate( {
            useColors: false,
            detailed: options.detailed,
            hotspotsOnly: options.hotspotsOnly,
            includeOptimizations: options.optimizations || !options.hotspotsOnly,
            compareBeforeAfter: options.compareBeforeAfter,
            gasPrice: parseFloat(options.gasPrice)
          });

          await FileSystemUtils.writeFile(options.output, fileOutput);
          console.log(OutputFormatter.formatSuccess(`\nAssembly analysis saved to ${options.output}`));
        }

      } else {
        console.error(OutputFormatter.formatError(`Format ${options.format} not yet implemented for assembly command`));
        console.log('Available formats: terminal, html, markdown');
        process.exit(1);
      }

      const highImpactOptimizations = analysis.optimizations.filter((opt: any) => opt.impact === 'high').length;

      if (highImpactOptimizations > 3) {
        console.log(OutputFormatter.formatWarning(`\n⚠️ ${highImpactOptimizations} high-impact optimizations available!`));
      } else {
        console.log(OutputFormatter.formatSuccess('\n✅ Assembly analysis completed!'));
      }

    } catch (err) {
      console.error(OutputFormatter.formatError(`Assembly analysis failed: ${err}`));
      process.exit(1);
    }
  });
