import { Command } from 'commander';
import { SolidityParser } from '../../core/parser/solidity-parser';
import { SlotCalculator } from '../../core/slot-mapper/slot-calculator';
import { CollisionDetector } from '../../core/slot-mapper/collision-detector';
import { OutputFormatter } from '../../utils/formatters';
import { FileSystemUtils } from '../../utils/file-system';
import path from 'path';
import fs from 'fs-extra';

export const analyzeCommand = new Command('analyze')
  .description('Analyze Solidity contract storage slots and detect collisions')
  .argument('<file>', 'Solidity file to analyze')
  .option('-o, --output <file>', 'Output file for analysis results')
  .option('-f, --format <type>', 'Output format: json, table', 'table')
  .option('--check-collisions', 'Check for storage slot collisions')
  .option('--verbose', 'Enable verbose output')
  .action(async (file, options) => {
    try {
      console.log(`🔍 Analyzing Solidity contract: ${file}`);

      if (!(await fs.pathExists(file))) {
        console.error(OutputFormatter.formatError(`File not found: ${file}`));
        process.exit(1);
      }

      const parser = new SolidityParser(file);
      const contracts = await parser.parse();

      if (contracts.length === 0) {
        console.error(OutputFormatter.formatError('No contracts found in file'));
        process.exit(1);
      }

      console.log(`📋 Found ${contracts.length} contract(s)`);

      const results: any[] = [];

      for (const contract of contracts) {
        console.log(`\n${OutputFormatter.formatInfo(`Analyzing contract: ${contract.name}`)}`);

        try {
          const slotMapping = SlotCalculator.calculateSlots(contract);

          let collisions: any[] = [];
          if (options.checkCollisions) {
            const detector = new CollisionDetector();
            collisions = detector.detectCollisions([contract]);
          }

          const analysis = {
            contractName: contract.name,
            filePath: file,
            slotMapping,
            collisions,
            summary: {
              totalVariables: slotMapping.variables.length,
              totalSlots: slotMapping.variables.length > 0
                ? Math.max(...slotMapping.variables.map(v => v.slot)) + 1
                : 0,
              hasCollisions: collisions.length > 0
            }
          };

          results.push(analysis);

          if (options.format === 'table') {
            console.log(OutputFormatter.formatSlotMapping(slotMapping));

            if (options.checkCollisions && collisions.length > 0) {
              console.log(`\n${OutputFormatter.formatError('⚠️ Storage Collisions Detected:')}`);
              collisions.forEach((collision, index) => {
                console.log(`${index + 1}. ${collision.description}`);
              });
            }
          }

          if (options.verbose) {
            console.log(`\n${OutputFormatter.formatInfo('Contract Details:')}`);
            console.log(`  Base Contracts: ${contract.baseContracts.length}`);
            console.log(`  State Variables: ${contract.stateVariables.length}`);
          }

        } catch (error) {
          console.error(OutputFormatter.formatError(`Failed to analyze ${contract.name}: ${error}`));
        }
      }

      if (options.output) {
        const outputData = options.format === 'json'
          ? JSON.stringify(results, null, 2)
          : results.map(r => OutputFormatter.formatSlotMapping(r.slotMapping)).join('\n\n');

        await FileSystemUtils.writeFile(options.output, outputData);
        console.log(`\n${OutputFormatter.formatSuccess(`Analysis saved to: ${options.output}`)}`);
      }


      const totalVariables = results.reduce((sum, r) => sum + r.summary.totalVariables, 0);
      const totalCollisions = results.reduce((sum, r) => sum + r.collisions.length, 0);

      console.log(`\n${OutputFormatter.formatSuccess('Analysis Complete!')}`);
      console.log(`📊 Total Variables: ${totalVariables}`);
      console.log(`🎯 Total Contracts: ${results.length}`);

      if (options.checkCollisions) {
        if (totalCollisions > 0) {
          console.log(`${OutputFormatter.formatError(`⚠️ Collisions Found: ${totalCollisions}`)}`);
          process.exit(1);
        } else {
          console.log(`${OutputFormatter.formatSuccess('✅ No collisions detected')}`);
        }
      }

    } catch (err) {
      console.error(OutputFormatter.formatError(`Analysis failed: ${err}`));
      process.exit(1);
    }
  });
