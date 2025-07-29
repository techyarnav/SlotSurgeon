import { AssemblyAnalysis, GasHotspot, OptimizationSuggestion, FunctionGasAnalysis, StorageOperation } from '../assembly/assembly-analyzer';
import { SlotMapping } from '../../types/slot-mapping';
import { OutputFormatter } from '../../utils/formatters';

export interface TerminalAssemblyOptions {
  useColors?: boolean;
  detailed?: boolean;
  hotspotsOnly?: boolean;
  includeOptimizations?: boolean;
  compareBeforeAfter?: boolean;
  gasPrice?: number;
}

export class TerminalAssemblyVisualizer {
  constructor(
    private readonly analysis: AssemblyAnalysis,
    private readonly contract: any,
    private readonly sourceFile: string,
    private readonly slotMapping: SlotMapping
  ) {}

  async generate(options: TerminalAssemblyOptions = {}): Promise<string> {
    const {
      useColors = true,
      detailed = false,
      hotspotsOnly = false,
      includeOptimizations = true,
      compareBeforeAfter = false,
      gasPrice = 20
    } = options;

    let output = '';


    if (useColors) {
      output += OutputFormatter.formatSuccess(`\n⚡ Assembly Analysis: ${this.analysis.contractName}\n`);
      output += OutputFormatter.formatDim(`Source: ${this.sourceFile}\n`);
    } else {
      output += `# Assembly Analysis: ${this.analysis.contractName}\n`;
      output += `Source: ${this.sourceFile}\n`;
      output += `Generated: ${new Date().toISOString()}\n`;
    }

    if (!hotspotsOnly) {

      output += this.generateGasOverview(useColors, gasPrice);
    }


    output += this.generateHotspotsAnalysis(useColors);

    if (!hotspotsOnly) {

      output += this.generateFunctionAnalysis(useColors);


      if (detailed) {
        output += this.generateStorageOperationsAnalysis(useColors);
      }
    }


    if (includeOptimizations) {
      output += this.generateOptimizationSuggestions(useColors);
    }


    if (compareBeforeAfter) {
      output += this.generateBeforeAfterComparison(useColors);
    }

    if (!hotspotsOnly) {

      output += this.generateSummary(useColors, gasPrice);
    }

    return output;
  }

  private generateGasOverview(useColors: boolean, gasPrice: number): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatSuccess = useColors ? OutputFormatter.formatSuccess : (text: string) => text;
    const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

    const header = formatBold('\n📊 Gas Analysis Overview:');
    let output = `${header}\n`;

    const { gasAnalysis } = this.analysis;
    const ethPrice = 2000;
    const deploymentCostUSD = (gasAnalysis.deploymentCost * gasPrice * ethPrice) / 1e18;
    const runtimeCostUSD = (gasAnalysis.totalRuntimeCost * gasPrice * ethPrice) / 1e18;

    output += `   ${formatBold('Deployment Analysis')}:\n`;
    output += `     • Gas Cost: ${formatInfo(gasAnalysis.deploymentCost.toLocaleString())} gas\n`;
    output += `     • USD Cost: ${formatInfo('$' + deploymentCostUSD.toFixed(2))} (at ${gasPrice} gwei)\n`;
    output += `     • Contract Size: ${formatInfo(this.analysis.metadata.contractSize.toLocaleString())} bytes\n`;

    output += `   ${formatBold('Runtime Analysis')}:\n`;
    output += `     • Average Function Cost: ${formatInfo(Math.round(this.analysis.summary.averageFunctionCost).toLocaleString())} gas\n`;
    output += `     • USD per Operation: ${formatInfo('$' + runtimeCostUSD.toFixed(4))} (at ${gasPrice} gwei)\n`;
    output += `     • Storage Operations: ${formatWarning(Math.round((gasAnalysis.storageOperationsCost / gasAnalysis.totalRuntimeCost) * 100) + '%')} of total cost\n`;

    output += `   ${formatBold('Gas Breakdown')}:\n`;
    const breakdown = gasAnalysis.breakdown;

    const total = Object.values(breakdown).reduce((sum: number, val: number) => sum + val, 0);


    output += `     • Storage (SSTORE/SLOAD): ${formatInfo(Math.round(breakdown.sstore + breakdown.sload).toLocaleString())} gas (${Math.round(((breakdown.sstore + breakdown.sload) / total) * 100)}%)\n`;
    output += `     • Computation: ${formatInfo(Math.round(breakdown.computation).toLocaleString())} gas (${Math.round((breakdown.computation / total) * 100)}%)\n`;
    output += `     • External Calls: ${formatInfo(Math.round(breakdown.call).toLocaleString())} gas (${Math.round((breakdown.call / total) * 100)}%)\n`;
    output += `     • Memory Operations: ${formatInfo(Math.round(breakdown.memory).toLocaleString())} gas (${Math.round((breakdown.memory / total) * 100)}%)\n`;

    return output + '\n';
  }

  private generateHotspotsAnalysis(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatError = useColors ? OutputFormatter.formatError : (text: string) => text;
    const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;
    const formatSuccess = useColors ? OutputFormatter.formatSuccess : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

    const header = formatBold('\n🔥 Gas Usage Hotspots:');
    const separator = '─'.repeat(120);

    let output = `${header}\n${separator}\n`;


    output += `${formatBold('Function'.padEnd(20))} │ ${formatBold('Operation'.padEnd(20))} │ ${formatBold('Gas Cost'.padEnd(12))} │ ${formatBold('Frequency'.padEnd(10))} │ ${formatBold('Total Impact'.padEnd(15))} │ ${formatBold('Level'.padEnd(12))} │ ${formatBold('Optimization')}\n`;
    output += separator + '\n';

    if (this.analysis.hotspots.length === 0) {
      output += `${formatInfo('No significant gas hotspots detected')}\n`;
      return output + separator + '\n';
    }


    this.analysis.hotspots.slice(0, 10).forEach((hotspot: GasHotspot) => {

      const functionName = hotspot.function.padEnd(20);
      const operation = hotspot.operation.padEnd(20);
      const gasCost = (hotspot.gasCost.toLocaleString() + ' gas').padEnd(12);
      const frequency = (`${hotspot.frequency}x`).padEnd(10);
      const totalImpact = (hotspot.totalImpact.toLocaleString() + ' gas').padEnd(15);


      let levelDisplay = '';
      switch (hotspot.severity) {
        case 'critical':
          levelDisplay = formatError('🔥 CRITICAL'.padEnd(12));
          break;
        case 'high':
          levelDisplay = formatWarning('⚠️ HIGH'.padEnd(12));
          break;
        case 'medium':
          levelDisplay = formatWarning('📋 MEDIUM'.padEnd(12));
          break;
        case 'low':
          levelDisplay = formatSuccess('✅ LOW'.padEnd(12));
          break;
      }

      const optimization = hotspot.recommendation.length > 30
        ? hotspot.recommendation.substring(0, 27) + '...'
        : hotspot.recommendation;

      output += `${functionName} │ ${operation} │ ${gasCost} │ ${frequency} │ ${totalImpact} │ ${levelDisplay} │ ${optimization}\n`;
    });

    output += separator + '\n';

    if (this.analysis.hotspots.length > 10) {
      output += `${formatInfo(`... and ${this.analysis.hotspots.length - 10} more hotspots`)}\n\n`;
    }

    return output;
  }

  private generateFunctionAnalysis(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatError = useColors ? OutputFormatter.formatError : (text: string) => text;
    const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;
    const formatSuccess = useColors ? OutputFormatter.formatSuccess : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

    const header = formatBold('\n📈 Function Gas Analysis:');
    const separator = '─'.repeat(110);

    let output = `${header}\n${separator}\n`;


    output += `${formatBold('Function'.padEnd(15))} │ ${formatBold('Gas Cost'.padEnd(12))} │ ${formatBold('Storage Ops'.padEnd(12))} │ ${formatBold('Complexity'.padEnd(12))} │ ${formatBold('Hotspot Level'.padEnd(15))} │ ${formatBold('Optimization')}\n`;
    output += separator + '\n';

    if (this.analysis.functionAnalysis.length === 0) {
      output += `${formatInfo('No functions analyzed')}\n`;
      return output + separator + '\n';
    }


    this.analysis.functionAnalysis.forEach((func: FunctionGasAnalysis) => {

      const functionName = func.name.padEnd(15);
      const gasCost = (func.gasCost.toLocaleString() + ' gas').padEnd(12);
      const storageOps = (`${func.storageOps} ops`).padEnd(12);
      const complexity = func.complexity.toUpperCase().padEnd(12);


      let hotspotDisplay = '';
      switch (func.hotspotLevel) {
        case 'critical':
          hotspotDisplay = formatError('🔥 CRITICAL'.padEnd(15));
          break;
        case 'high':
          hotspotDisplay = formatWarning('⚠️ HIGH'.padEnd(15));
          break;
        case 'medium':
          hotspotDisplay = formatWarning('📋 MEDIUM'.padEnd(15));
          break;
        case 'low':
          hotspotDisplay = formatSuccess('✅ LOW'.padEnd(15));
          break;
      }

      const optimization = func.optimization.length > 25
        ? func.optimization.substring(0, 22) + '...'
        : func.optimization;

      output += `${functionName} │ ${gasCost} │ ${storageOps} │ ${complexity} │ ${hotspotDisplay} │ ${optimization}\n`;
    });

    output += separator + '\n';
    return output;
  }

  private generateStorageOperationsAnalysis(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatError = useColors ? OutputFormatter.formatError : (text: string) => text;
    const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

    const header = formatBold('\n💾 Storage Operations Analysis:');
    let output = `${header}\n`;

    const storageOps = this.analysis.storageOperations;


    const sstoreOps = storageOps.filter((op: StorageOperation) => op.type === 'SSTORE');
const sloadOps = storageOps.filter((op: StorageOperation) => op.type === 'SLOAD');

    output += `   ${formatBold('Storage Writes (SSTORE)')}:\n`;

    sstoreOps.slice(0, 5).forEach((op: StorageOperation) => {

      const costColor = op.gasCost > 15000 ? formatError : formatWarning;
      output += `     • ${op.variable} (Slot ${op.slot}): ${costColor(op.gasCost.toLocaleString())} gas\n`;
      if (op.optimization) {
        output += `       💡 ${formatInfo(op.optimization)}\n`;
      }
    });

    output += `   ${formatBold('Storage Reads (SLOAD)')}:\n`;

    sloadOps.slice(0, 5).forEach((op: StorageOperation) => {

      output += `     • ${op.variable} (Slot ${op.slot}): ${formatInfo(op.gasCost.toLocaleString())} gas\n`;
      if (op.optimization) {
        output += `       💡 ${formatInfo(op.optimization)}\n`;
      }
    });

    return output + '\n';
  }

  private generateOptimizationSuggestions(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatError = useColors ? OutputFormatter.formatError : (text: string) => text;
    const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;
    const formatSuccess = useColors ? OutputFormatter.formatSuccess : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;
    const formatDim = useColors ? OutputFormatter.formatDim : (text: string) => text;

    const header = formatBold('\n💡 Optimization Opportunities:');
    let output = `${header}\n`;

    if (this.analysis.optimizations.length === 0) {
      output += `   ${formatSuccess('✅ No significant optimizations needed')}\n`;
      return output + '\n';
    }


    const critical = this.analysis.optimizations.filter((opt: OptimizationSuggestion) => opt.impact === 'critical');
const high = this.analysis.optimizations.filter((opt: OptimizationSuggestion) => opt.impact === 'high');
const medium = this.analysis.optimizations.filter((opt: OptimizationSuggestion) => opt.impact === 'medium');
const low = this.analysis.optimizations.filter((opt: OptimizationSuggestion) => opt.impact === 'low');


    if (critical.length > 0 || high.length > 0) {
      const highImpact = [...critical, ...high];
      output += `   ${formatError(`🔥 HIGH IMPACT (${highImpact.length} found):`)} \n`;

      highImpact.slice(0, 3).forEach((opt, index) => {
        const gassSavedColor = opt.gassSaved > 10000 ? formatError : formatWarning;
        output += `      ${index + 1}. ${opt.title} → Save ${gassSavedColor(opt.gassSaved.toLocaleString())} gas per operation\n`;
        output += `         ${formatDim(opt.description)}\n`;
        if (opt.codeExample) {
          output += `         ${formatInfo('Implementation:')} ${opt.implementation}\n`;
        }
        output += '\n';
      });
    }


    if (medium.length > 0) {
      output += `   ${formatWarning(`⚡ MEDIUM IMPACT (${medium.length} found):`)} \n`;


      medium.slice(0, 2).forEach((opt: OptimizationSuggestion, index: number) => {

        output += `      ${index + 1}. ${opt.title} → Save ${formatWarning(opt.gassSaved.toLocaleString())} gas\n`;
        output += `         ${formatDim(opt.description)}\n`;
      });
      output += '\n';
    }


    if (low.length > 0) {

      const totalLowSavings = low.reduce((sum: number, opt: OptimizationSuggestion) => sum + opt.gassSaved, 0);

      output += `   ${formatInfo(`💡 LOW IMPACT (${low.length} found):`)} Total savings ~${formatInfo(totalLowSavings.toLocaleString())} gas\n`;

      low.slice(0, 2).forEach((opt: OptimizationSuggestion, index: number) => {

        output += `      ${index + 1}. ${opt.title}\n`;
      });
      if (low.length > 2) {
        output += `      ... and ${low.length - 2} more minor optimizations\n`;
      }
      output += '\n';
    }

    return output;
  }

  private generateBeforeAfterComparison(useColors: boolean): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatSuccess = useColors ? OutputFormatter.formatSuccess : (text: string) => text;
    const formatError = useColors ? OutputFormatter.formatError : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

    const header = formatBold('\n🔄 Before/After Optimization Comparison:');
    let output = `${header}\n`;

    const currentGas = this.analysis.gasAnalysis.totalRuntimeCost;
    const potentialSavings = this.analysis.summary.optimizationPotential;
    const optimizedGas = currentGas - potentialSavings;
    const savingsPercent = ((potentialSavings / currentGas) * 100).toFixed(1);

    output += `   ${formatBold('Current State')}:\n`;
    output += `     • Average Function Cost: ${formatError(Math.round(this.analysis.summary.averageFunctionCost).toLocaleString())} gas\n`;
    output += `     • Storage Operations: ${formatError(Math.round(this.analysis.gasAnalysis.storageOperationsCost).toLocaleString())} gas\n`;
    output += `     • Total Runtime Cost: ${formatError(currentGas.toLocaleString())} gas\n`;

    output += `   ${formatBold('Optimized State')}:\n`;
    output += `     • Average Function Cost: ${formatSuccess(Math.round(optimizedGas / this.analysis.summary.totalFunctions).toLocaleString())} gas\n`;
    output += `     • Storage Operations: ${formatSuccess(Math.round(this.analysis.gasAnalysis.storageOperationsCost * 0.7).toLocaleString())} gas (estimated)\n`;
    output += `     • Total Runtime Cost: ${formatSuccess(optimizedGas.toLocaleString())} gas\n`;

    output += `   ${formatBold('Savings Potential')}:\n`;
    output += `     • Gas Saved: ${formatInfo(potentialSavings.toLocaleString())} gas (${savingsPercent}% reduction)\n`;
    output += `     • USD Saved per Operation: ${formatInfo('$' + ((potentialSavings * 20 * 2000) / 1e18).toFixed(4))} (at 20 gwei)\n`;

    return output + '\n';
  }

  private generateSummary(useColors: boolean, gasPrice: number): string {
    const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
    const formatSuccess = useColors ? OutputFormatter.formatSuccess : (text: string) => text;
    const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;
    const formatError = useColors ? OutputFormatter.formatError : (text: string) => text;
    const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

    const header = formatBold('\n📋 Analysis Summary:');
    let output = `${header}\n`;

    const { summary, metadata } = this.analysis;

    output += `   ${formatBold('Contract Overview')}:\n`;
    output += `     • Total Functions Analyzed: ${formatInfo(summary.totalFunctions.toString())}\n`;
    output += `     • Contract Size: ${formatInfo(metadata.contractSize.toLocaleString())} bytes\n`;
    output += `     • Storage Slots Used: ${formatInfo(metadata.storageSlots.toString())}\n`;
    output += `     • Total Opcodes: ${formatInfo(metadata.opcodeCount.toString())}\n`;

    output += `   ${formatBold('Performance Metrics')}:\n`;
    output += `     • Storage-Intensive Functions: ${formatWarning(summary.storageIntensive.toString())}\n`;
    output += `     • Compute-Intensive Functions: ${formatInfo(summary.computeIntensive.toString())}\n`;
    output += `     • Average Function Cost: ${formatInfo(Math.round(summary.averageFunctionCost).toLocaleString())} gas\n`;

    output += `   ${formatBold('Optimization Assessment')}:\n`;
    const optimizationLevel = summary.optimizationPotential > 50000 ? 'HIGH' :
                             summary.optimizationPotential > 20000 ? 'MEDIUM' : 'LOW';
    const optimizationColor = optimizationLevel === 'HIGH' ? formatError :
                             optimizationLevel === 'MEDIUM' ? formatWarning : formatSuccess;

    output += `     • Optimization Potential: ${optimizationColor(optimizationLevel)} (${summary.optimizationPotential.toLocaleString()} gas)\n`;
    output += `     • Security Score: ${formatInfo(summary.securityScore.toString())}/100\n`;

    output += `   ${formatBold('Cost Analysis')} (at ${gasPrice} gwei):\n`;
    const deploymentCostUSD = (metadata.estimatedDeploymentCost * gasPrice * 2000) / 1e18;
    const runtimeCostUSD = (summary.averageFunctionCost * gasPrice * 2000) / 1e18;

    output += `     • Deployment Cost: ${formatInfo('$' + deploymentCostUSD.toFixed(2))}\n`;
    output += `     • Average Function Cost: ${formatInfo('$' + runtimeCostUSD.toFixed(4))}\n`;

    output += `   ${formatBold('Analysis Metadata')}:\n`;
    output += `     • Analysis Time: ${formatInfo(metadata.analysisTime.toString())}ms\n`;
    output += `     • Gas Price Used: ${formatInfo(metadata.gasPrice.toString())} gwei\n`;

    return output;
  }
}
