import { Command } from 'commander';
import { SolidityParser } from '../../core/parser/solidity-parser';
import { SlotCalculator } from '../../core/slot-mapper/slot-calculator';
import { StorageDetectorManager, DetectorResult, StorageDetectionReport } from '../../core/detectors/storage-detector-manager';
import { TerminalDetectionVisualizer } from '../../core/visualizers/terminal-detection-visualizer';
import { FileSystemUtils } from '../../utils/file-system';
import { OutputFormatter } from '../../utils/formatters';

export const detectCommand = new Command('detect')
    .description('Run storage-related security and optimization detectors')
    .argument('<solidityFile>', 'Solidity file to analyze')
    .option('-c, --contract <name>', 'Specify contract name if file contains many')
    .option('-o, --output <file>', 'Save detection results to file')
    .option('-f, --format <type>', 'Output format: terminal, json, markdown', 'terminal')
    .option('--no-color', 'Disable ANSI colors for terminal output')
    .option('--detectors <list>', 'Comma-separated list of detector IDs to run')
    .option('--severity <level>', 'Minimum severity level: low, medium, high, critical', 'low')
    .option('--gas-estimates', 'Include gas impact estimates')
    .option('--list-detectors', 'List available detectors and exit')
    .action(async (file, options) => {
        try {
            const manager = new StorageDetectorManager();

            if (options.listDetectors) {
                console.log(OutputFormatter.formatSuccess('\n🔍 Available Storage Detectors:\n'));
                const detectors = manager.getAvailableDetectors();

                detectors.forEach(detector => {
                    const severityColor = detector.severity === 'critical' ? OutputFormatter.formatError :
                        detector.severity === 'high' ? OutputFormatter.formatWarning :
                            detector.severity === 'medium' ? OutputFormatter.formatInfo :
                                OutputFormatter.formatDim;

                    console.log(`  ${detector.id.padEnd(20)} ${severityColor(detector.severity.toUpperCase().padEnd(8))} ${detector.category.padEnd(10)} ${detector.title}`);
                });

                console.log('\nUsage: slot-surgeon detect contract.sol --detectors "test-storage"');
                process.exit(0);
            }

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

            const detectionOptions = {
                includeGasEstimates: options.gasEstimates
            };

            let report: StorageDetectionReport;
            if (options.detectors) {
                const detectorIds = options.detectors.split(',').map((id: string) => id.trim());
                report = await manager.runSpecificDetectors(detectorIds, target, slotMapping, detectionOptions);
            } else {
                report = await manager.runAllDetectors(target, slotMapping, detectionOptions);
            }

            if (options.severity !== 'low') {
                const severityLevels = ['low', 'medium', 'high', 'critical'];
                const minLevel = severityLevels.indexOf(options.severity);
                report.results = report.results.filter((result: DetectorResult) =>
                    severityLevels.indexOf(result.severity) >= minLevel
                );
            }

            if (options.format === 'terminal') {
                const visualizer = new TerminalDetectionVisualizer(report, target, file);
                const output = await visualizer.generate( {
                    useColors: options.color,
                    includeGasEstimates: options.gasEstimates
                });

                console.log(output);

                if (options.output) {
                    const fileOutput = await visualizer.generate( {
                        useColors: false,
                        includeGasEstimates: options.gasEstimates
                    });
                    await FileSystemUtils.writeFile(options.output, fileOutput);
                    console.log(OutputFormatter.formatSuccess(`\nDetection results saved to ${options.output}`));
                }
            } else if (options.format === 'markdown') {
                const { DetectionMarkdownGenerator } = require('../../core/visualizers/detection-markdown-generator');
                const generator = new DetectionMarkdownGenerator(report, target, file);
                const content = await generator.generate( {
                    useColors: false,
                    includeGasEstimates: options.gasEstimates
                });

                const outputPath = options.output || `${target.name}-detection-report.md`;
                await FileSystemUtils.writeFile(outputPath, content);
                console.log(OutputFormatter.formatSuccess(`📝 Markdown detection report saved to ${outputPath}`));
            } else {
                console.log(JSON.stringify(report, null, 2));
            }


            const hasHighSeverityIssues = report.results.some((r: DetectorResult) => r.severity === 'critical' || r.severity === 'high');
            if (hasHighSeverityIssues) {
                console.log(OutputFormatter.formatError(`\n🚨 High severity storage issues detected!`));
                process.exit(1);
            } else {
                console.log(OutputFormatter.formatSuccess('\n✅ Storage detection completed!'));
                process.exit(0);
            }

        } catch (err) {
            console.error(OutputFormatter.formatError(`Storage detection failed: ${err}`));
            process.exit(1);
        }
    });
