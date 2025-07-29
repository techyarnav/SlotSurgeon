import { Command } from 'commander';
import { SolidityParser } from '../../core/parser/solidity-parser';
import { SlotCalculator } from '../../core/slot-mapper/slot-calculator';
import { UpgradeAnalyzer } from '../../core/slot-mapper/upgrade-analyzer';
import { DiffReportGenerator } from '../../core/visualizers/diff-report-generator';
import { FileSystemUtils } from '../../utils/file-system';
import { OutputFormatter } from '../../utils/formatters';

export const diffCommand = new Command('diff')
  .description('Analyze upgrade safety between two contract versions')
  .argument('<v1-file>', 'Path to version 1 (current) Solidity file')
  .argument('<v2-file>', 'Path to version 2 (new) Solidity file')
  .option('-c1, --contract1 <name>', 'Contract name in v1 file')
  .option('-c2, --contract2 <name>', 'Contract name in v2 file')
  .option('-o, --output <file>', 'Output file for the analysis report')
  .option('-f, --format <type>', 'Output format: html, markdown, json', 'html')
  .option('--no-visual-diff', 'Disable visual diff in report')
  .option('--no-recommendations', 'Disable recommendations in report')
  .option('--json-summary', 'Print JSON summary to console')
  .action(async (v1File, v2File, options) => {
    try {

      for (const file of [v1File, v2File]) {
        if (!(await FileSystemUtils.fileExists(file))) {
          console.error(OutputFormatter.formatError(`File not found: ${file}`));
          process.exit(1);
        }
        if (!FileSystemUtils.getFileExtension(file).includes('.sol')) {
          console.error(OutputFormatter.formatError(`File must be a .sol file: ${file}`));
          process.exit(1);
        }
      }

      console.log(`🔍 Analyzing upgrade safety...`);
      console.log(`   V1: ${v1File}`);
      console.log(`   V2: ${v2File}\n`);

      const v1Parser = new SolidityParser(v1File);
      const v2Parser = new SolidityParser(v2File);

      const v1Contracts = await v1Parser.parse();
      const v2Contracts = await v2Parser.parse();

      if (v1Contracts.length === 0 || v2Contracts.length === 0) {
        console.error(OutputFormatter.formatError('No contracts found in one or both files'));
        process.exit(1);
      }

      let v1Contract = v1Contracts[0];
      let v2Contract = v2Contracts[0];

      if (options.contract1) {
        const match = v1Contracts.find(c => c.name === options.contract1);
        if (!match) {
          console.error(OutputFormatter.formatError(`Contract ${options.contract1} not found in v1`));
          process.exit(1);
        }
        v1Contract = match;
      }

      if (options.contract2) {
        const match = v2Contracts.find(c => c.name === options.contract2);
        if (!match) {
          console.error(OutputFormatter.formatError(`Contract ${options.contract2} not found in v2`));
          process.exit(1);
        }
        v2Contract = match;
      }

      const v1Mapping = SlotCalculator.calculateSlots(v1Contract);
      const v2Mapping = SlotCalculator.calculateSlots(v2Contract);

      const analysis = UpgradeAnalyzer.analyze(v1Mapping, v2Mapping);

      console.log(OutputFormatter.formatSuccess(`Analysis complete for ${analysis.contractName}`));
      console.log(`🎯 Compatibility Score: ${analysis.compatibility.score}/100 (${analysis.compatibility.level.toUpperCase()})`);
      console.log(`📊 Changes Detected: ${analysis.changes.length}`);

      const criticalCount = analysis.changes.filter(c => c.severity === 'critical').length;
      const warningCount = analysis.changes.filter(c => c.severity === 'warning').length;
      const safeCount = analysis.changes.filter(c => c.severity === 'safe').length;

      if (criticalCount > 0) {
        console.log(OutputFormatter.formatError(`💥 Critical Issues: ${criticalCount}`));
      }
      if (warningCount > 0) {
        console.log(OutputFormatter.formatWarning(`⚠️  Warnings: ${warningCount}`));
      }
      if (safeCount > 0) {
        console.log(OutputFormatter.formatSuccess(`✅ Safe Changes: ${safeCount}`));
      }

      console.log(`📈 Storage Growth: ${analysis.storageGrowth.slotsAdded} slots`);
      console.log(`⚡ Efficiency Change: ${analysis.storageGrowth.efficiencyChange}%\n`);

      if (analysis.recommendations.length > 0) {
        console.log('💡 Key Recommendations:');
        analysis.recommendations.slice(0, 3).forEach(rec => {
          console.log(`   ${rec}`);
        });
        console.log('');
      }

      if (options.format === 'markdown') {
        const { DiffMarkdownGenerator } = require('../../core/visualizers/diff-markdown-generator');
        const generator = new DiffMarkdownGenerator(v1Mapping, v2Mapping, v1Contract, v2Contract, v1File, v2File);
        const content = await generator.generate( {
          detailed: options.detailed,
          migrationTips: options.migrationTips
        });

        const outputPath = options.output || `storage-diff-${v1Contract.name}.md`;
        await FileSystemUtils.writeFile(outputPath, content);
        console.log(OutputFormatter.formatSuccess(`📝 Markdown diff report saved to ${outputPath}`));
      } else {
        if (options.output) {
          const reportGenerator = new DiffReportGenerator(analysis, v1Mapping, v2Mapping, {
            format: options.format,
            theme: options.theme,
            includeVisualDiff: options.visualDiff,
            includeRecommendations: options.recommendations
          });

          const report = reportGenerator.generate();
          await FileSystemUtils.writeFile(options.output, report);
          console.log(OutputFormatter.formatSuccess(`Detailed report saved: ${options.output}`));
        }
      }

      if (options.jsonSummary) {
        console.log('\nJSON Summary:');
        console.log(JSON.stringify( {
          compatibility: analysis.compatibility,
          changes: analysis.changes.length,
          breakdown: {
            critical: criticalCount,
            warning: warningCount,
            safe: safeCount
          },
          growth: analysis.storageGrowth
        }, null, 2));
      }

      process.exit(criticalCount > 0 ? 1 : 0);

    } catch (err) {
      console.error(OutputFormatter.formatError(String(err)));
      process.exit(1);
    }
  });
