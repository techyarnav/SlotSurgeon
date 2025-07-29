import { StorageDetectionReport, DetectorResult } from '../detectors/storage-detector-manager';
import { OutputFormatter } from '../../utils/formatters';

export interface TerminalDetectionOptions {
    useColors?: boolean;
    includeGasEstimates?: boolean;
}

export class TerminalDetectionVisualizer {
    constructor(
        private readonly report: StorageDetectionReport,
        private readonly contract: any,
        private readonly sourceFile: string
    ) { }


    async generate(options: TerminalDetectionOptions = {}): Promise<string> {
        const { useColors = true, includeGasEstimates = false } = options;

        let output = '';


        output += useColors ?
            OutputFormatter.formatInfo(`\n🔍 Storage Detection Analysis: ${this.contract.name}\n`) :
            `\nStorage Detection Analysis: ${this.contract.name}\n`;

        output += `Source: ${this.sourceFile}\n\n`;


        const severityCounts = this.getSeverityCounts();
        const totalGasImpact = this.report.results.reduce((sum, r) =>
            sum + (typeof r.gasImpact === 'number' ? r.gasImpact : 0), 0
        );

        output += useColors ?
            OutputFormatter.formatBold('📊 Detection Summary:\n') :
            'Detection Summary:\n';

        output += `   Total Issues: ${this.report.results.length}\n`;
        output += `   Critical: ${severityCounts.critical}\n`;
        output += `   High: ${severityCounts.high}\n`;
        output += `   Medium: ${severityCounts.medium}\n`;
        output += `   Low: ${severityCounts.low}\n`;

        if (includeGasEstimates && totalGasImpact > 0) {
            output += `   Potential Gas Savings: ${totalGasImpact.toLocaleString()} gas\n`;
        }

        output += '\n';


        if (this.report.results.length > 0) {
            output += useColors ?
                OutputFormatter.formatWarning('⚠️  Issues Detected:\n\n') :
                'Issues Detected:\n\n';

            this.report.results.forEach((result, index) => {
                const severityEmoji = this.getSeverityEmoji(result.severity);
                output += `${index + 1}. ${severityEmoji} ${result.title}\n`;
                output += `   ${result.description}\n`;

                if (result.location) {
                    output += `   Location: ${result.location}\n`;
                }

                if (includeGasEstimates && result.gasImpact) {
                    const gasValue = typeof result.gasImpact === 'number' ? result.gasImpact : 0;
                    output += `   Gas Impact: ${gasValue.toLocaleString()} gas\n`;
                }

                if (result.recommendation) {
                    output += `   💡 ${result.recommendation}\n`;
                }

                output += '\n';
            });
        } else {
            output += useColors ?
                OutputFormatter.formatSuccess('✅ No issues detected - contract looks good!\n\n') :
                'No issues detected - contract looks good!\n\n';
        }


        if (this.report.results.length > 0) {
            output += useColors ?
                OutputFormatter.formatBold('💡 Summary Recommendations:\n') :
                'Summary Recommendations:\n';

            const recommendations = this.generateSmartRecommendations();
            recommendations.forEach(rec => {
                output += `   ${rec}\n`;
            });
            output += '\n';
        }

        output += useColors ?
            OutputFormatter.formatSuccess('✅ Storage detection completed!\n') :
            'Storage detection completed!\n';

        return output;
    }
    private getSeverityCounts() {
        return {
            critical: this.report.results.filter(r => r.severity === 'critical').length,
            high: this.report.results.filter(r => r.severity === 'high').length,
            medium: this.report.results.filter(r => r.severity === 'medium').length,
            low: this.report.results.filter(r => r.severity === 'low').length
        };
    }

    private getSeverityEmoji(severity: string): string {
        const emojiMap: Record<string, string> = {
            'critical': '🚨',
            'high': '⚠️',
            'medium': '🔶',
            'low': '🔵'
        };
        return emojiMap[severity] || '🔍';
    }

    private generateSmartRecommendations(): string[] {
        const recommendations: string[] = [];
        const results = this.report.results;

        const gasIssues = results.filter(r => r.category === 'gas');
        const storageIssues = results.filter(r => r.category === 'storage');
        const upgradeIssues = results.filter(r => r.category === 'upgrade');

        if (gasIssues.length > 0) {
            recommendations.push('🔧 Optimize variable packing to reduce gas costs');
        }

        if (storageIssues.length > 0) {
            recommendations.push('📦 Review storage layout for better organization');
        }

        if (upgradeIssues.length > 0) {
            recommendations.push('🔄 Add storage gaps for safer contract upgrades');
        }

        if (recommendations.length === 0) {
            recommendations.push('✅ Storage layout is well optimized');
        }

        return recommendations;
    }

    private generateSummaryOverview(useColors: boolean, includeGasEstimates: boolean): string {
        const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
        const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

        const header = formatBold('\n📊 Detection Summary:');
        let output = `${header}\n`;

        output += `   Total Issues: ${formatInfo(this.report.totalIssues.toString())}\n`;
        output += `   Security Score: ${formatInfo(this.report.securityScore.toString())}/100\n`;
        output += `   Upgradeability Score: ${formatInfo(this.report.upgradeabilityScore.toString())}/100\n`;

        if (includeGasEstimates && this.report.gasImpact > 0) {
            output += `   Potential Gas Savings: ${formatInfo(this.report.gasImpact.toLocaleString())} gas\n`;
        }

        return output + '\n';
    }

    private generateIssuesBySeverity(useColors: boolean): string {
        const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
        const formatError = useColors ? OutputFormatter.formatError : (text: string) => text;
        const formatWarning = useColors ? OutputFormatter.formatWarning : (text: string) => text;
        const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

        if (this.report.results.length === 0) {
            return `${formatBold('\n✅ No issues detected - contract looks good!')}\n\n`;
        }

        const header = formatBold('\n🎯 Issues by Severity:');
        let output = `${header}\n`;


        const severities = ['critical', 'high', 'medium', 'low'];
        severities.forEach(severity => {
            const issues = this.report.results.filter(r => r.severity === severity);
            if (issues.length > 0) {
                const severityColor = severity === 'critical' ? formatError :
                    severity === 'high' ? formatWarning :
                        severity === 'medium' ? formatWarning : formatInfo;

                output += `   ${severityColor(`${severity.toUpperCase()} (${issues.length} issues)`)}\n`;
                issues.forEach(issue => {
                    output += `     • ${issue.title}\n`;
                });
            }
        });

        return output + '\n';
    }

    private generateDetailedResults(useColors: boolean, includeGasEstimates: boolean): string {
        const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
        const formatDim = useColors ? OutputFormatter.formatDim : (text: string) => text;

        if (this.report.results.length === 0) {
            return '';
        }

        const header = formatBold('\n📋 Detailed Results:');
        let output = `${header}\n`;

        this.report.results.forEach((result, index) => {
            output += `\n${index + 1}. ${formatBold(result.title)}\n`;
            output += `   ${formatDim('Description')}: ${result.description}\n`;
            output += `   ${formatDim('Impact')}: ${result.impact}\n`;
            output += `   ${formatDim('Recommendation')}: ${result.recommendation}\n`;

            if (result.affectedVariables.length > 0) {
                output += `   ${formatDim('Affected Variables')}: ${result.affectedVariables.join(', ')}\n`;
            }

            if (includeGasEstimates && result.gasImpact) {
                output += `   ${formatDim('Gas Impact')}: ${result.gasImpact.toLocaleString()} gas\n`;
            }
        });

        return output;
    }

    private generateRecommendations(useColors: boolean): string {
        const formatBold = useColors ? OutputFormatter.formatBold : (text: string) => text;
        const formatInfo = useColors ? OutputFormatter.formatInfo : (text: string) => text;

        const header = formatBold('\n💡 Summary Recommendations:');
        let output = `${header}\n`;

        if (this.report.summary.length === 0) {
            output += `   ${formatInfo('✅ No specific recommendations - contract follows good practices')}\n`;
            return output;
        }

        this.report.summary.forEach(summary => {
            output += `   ${summary}\n`;
        });

        return output;
    }
}
