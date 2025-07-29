import { Command } from 'commander';
import { SolidityParser } from '../../core/parser/solidity-parser';
import { SlotCalculator } from '../../core/slot-mapper/slot-calculator';
import { CollisionDetector } from '../../core/slot-mapper/collision-detector';
import { OutputFormatter } from '../../utils/formatters';
import { FileSystemUtils } from '../../utils/file-system';

export const checkCommand = new Command('check')
  .description('Detect storage-layout collisions between two contract versions')
  .argument('<old>', 'Path to v1 Solidity file')
  .argument('<new>', 'Path to v2 Solidity file')
  .option('-j, --json', 'Print JSON report', false)
  .option('-o, --output <file>', 'Write report to file')
  .action(async (oldPath, newPath, opts) => {
    try {
      for (const p of [oldPath, newPath]) {
        if (!(await FileSystemUtils.fileExists(p))) {
          console.error(OutputFormatter.formatError(`file not found: ${p}`));
          process.exit(1);
        }
      }

      const [cOld] = await new SolidityParser(oldPath).parse();
      const [cNew] = await new SolidityParser(newPath).parse();
      const mapOld = SlotCalculator.calculateSlots(cOld);
      const mapNew = SlotCalculator.calculateSlots(cNew);

      const report = CollisionDetector.compare(mapOld, mapNew);

      if (opts.json) {
        const json = JSON.stringify(report, null, 2);
        console.log(json);
        if (opts.output) await FileSystemUtils.writeFile(opts.output, json);
        process.exit(report.safe ? 0 : 1);
      }

      console.log(
        OutputFormatter.formatSuccess(`Comparing  ${oldPath}  ↔︎  ${newPath}`)
      );

      if (report.safe) {
        console.log(OutputFormatter.formatSuccess('No layout conflicts detected'));
      } else {
        if (report.collisions.length) {
          console.log(OutputFormatter.formatError('💥  Slot collisions:'));
          report.collisions.forEach(c =>
            console.log(
              `  • slot ${c.slot} bytes [${c.range[0]}-${c.range[1]}]  ` +
                `${c.reason}`
            )
          );
        }
        if (report.moved.length) {
          console.log(OutputFormatter.formatError('💥  Variables moved slots:'));
          report.moved.forEach(v =>
            console.log(`  • ${v.name} moved to slot ${v.slot}`)
          );
        }
      }

      if (opts.output && !opts.json) {
        await FileSystemUtils.writeFile(
          opts.output,
          `# Slot-Surgeon collision report\n${JSON.stringify(report, null, 2)}\n`
        );
        console.log(OutputFormatter.formatSuccess(`Report saved to ${opts.output}`));
      }

      process.exit(report.safe ? 0 : 1);
    } catch (err) {
      console.error(OutputFormatter.formatError(String(err)));
      process.exit(1);
    }
  });
