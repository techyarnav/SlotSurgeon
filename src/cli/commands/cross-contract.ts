import { Command } from 'commander';
import { CrossContractAnalyzer } from '../../core/cross-contract/cross-contract-analyzer';
import { OutputFormatter } from '../../utils/formatters';
import * as path from 'path';

export const crossContractCommand = new Command('cross-contract')
  .description('Analyze storage layouts across multiple contracts')
  .argument('<directory>', 'Directory containing Solidity contracts')
  .option('-o, --output <file>', 'Save analysis report to file')
  .option('-f, --format <type>', 'Output format: terminal, json, html', 'terminal')
  .option('--no-color', 'Disable ANSI colors for terminal output')
  .action(async (directory, options) => {
    try {
      console.log(OutputFormatter.formatInfo(`🔍 Analyzing contracts in: ${directory}`));

      const analyzer = new CrossContractAnalyzer();
      const report = await analyzer.analyzeDirectory(directory);

      if (options.format === 'terminal') {
        console.log(OutputFormatter.formatSuccess('\n📊 Cross-Contract Analysis Results\n'));

        console.log(OutputFormatter.formatBold('Summary:'));
        console.log(`  Total Contracts: ${report.summary.totalContracts}`);
        console.log(`  Dependencies: ${report.summary.totalDependencies}`);
        console.log(`  Potential Issues: ${report.summary.potentialIssues}`);
        console.log(`  Inheritance Chains: ${report.summary.inheritanceChains}\n`);

        if (report.contracts.length > 0) {
          console.log(OutputFormatter.formatBold('Contracts Found:'));
          report.contracts.forEach(contract => {
            const relativePath = contract.filePath ? path.relative(directory, contract.filePath) : 'unknown';
            console.log(`  • ${contract.name} (${relativePath})`);
          });
          console.log();
        }

        if (report.dependencies.length > 0) {
          console.log(OutputFormatter.formatBold('Dependencies:'));
          report.dependencies.forEach(dep => {
            console.log(`  ${dep.from} → ${dep.to} (${dep.type})`);
          });
          console.log();
        }

        if (report.potentialCollisions.length > 0) {
          console.log(OutputFormatter.formatWarning('⚠️  Potential Storage Collisions:'));
          report.potentialCollisions.forEach(collision => {
            console.log(`  ${collision.contract1} ↔ ${collision.contract2}:`);
            collision.collisions.forEach(c => {
              console.log(`    Slot ${c.slot}: ${c.variable1} ↔ ${c.variable2} (${c.severity})`);
            });
          });
        } else {
          console.log(OutputFormatter.formatSuccess('✅ No storage collisions detected'));
        }

      } else if (options.format === 'json') {
        console.log(JSON.stringify(report, null, 2));
      }

      if (options.output) {
        const fs = require('fs-extra');
        const content = options.format === 'json'
          ? JSON.stringify(report, null, 2)
          : 'Cross-contract analysis completed';

        await fs.writeFile(options.output, content);
        console.log(OutputFormatter.formatSuccess(`Analysis saved to ${options.output}`));
      }

    } catch (err) {
      console.error(OutputFormatter.formatError(`Cross-contract analysis failed: ${err}`));
      process.exit(1);
    }
  });
