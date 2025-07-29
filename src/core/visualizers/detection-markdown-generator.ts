import { StorageDetectionReport, DetectorResult } from '../detectors/storage-detector-manager';
import { ContractAST } from '../parser/types';
import { BaseMarkdownGenerator } from './base-markdown-generator';

export interface DetectionMarkdownOptions {
  useColors?: boolean;
  includeGasEstimates?: boolean;
  includeTechnicalDetails?: boolean;
  severityFilter?: 'low' | 'medium' | 'high' | 'critical';
}

export class DetectionMarkdownGenerator extends BaseMarkdownGenerator {
  constructor(
    private readonly report: StorageDetectionReport,
    private readonly contract: ContractAST,
    private readonly sourceFile: string
  ) {
    super();
  }

  async generate(options: DetectionMarkdownOptions = {}): Promise<string> {
    const { includeGasEstimates = false, includeTechnicalDetails = true } = options;

    let markdown = this.generateMetadata();


    markdown += this.formatHeader(1, `Storage Detection Analysis: ${this.contract.name}`);
    markdown += `${this.formatBold('Source:')} ${this.sourceFile}  \n`;
    markdown += `${this.formatBold('Generated:')} ${new Date().toISOString()}  \n`;

    markdown += `${this.formatBold('Detectors Run:')} N/A  \n`;

    markdown += `${this.formatBold('Issues Found:')} ${this.report.results.length}  \n\n`;


    markdown += this.generateExecutiveSummary();


    markdown += this.generateDetectionResults(includeGasEstimates);


    markdown += this.generateSeverityBreakdown();


    if (includeGasEstimates) {
      markdown += this.generateGasImpactAnalysis();
    }


    if (includeTechnicalDetails) {
      markdown += this.generateTechnicalDetails();
    }


    markdown += this.generateRecommendations();

    return markdown;
  }

  private generateExecutiveSummary(): string {
    let section = this.formatHeader(2, '📊 Executive Summary');

    const severityCounts = this.getSeverityCounts();
    const overallRisk = this.calculateOverallRisk(severityCounts);


    const riskEmoji = overallRisk === 'critical' ? '🚨' :
                     overallRisk === 'high' ? '⚠️' :
                     overallRisk === 'medium' ? '🔶' : '✅';

    section += `${riskEmoji} ${this.formatBold('Overall Risk Level:')} ${overallRisk.toUpperCase()}\n\n`;


    const summaryStats = [
      `${this.formatBold('Total Issues:')} ${this.report.results.length}`,
      `${this.formatBold('Critical:')} ${severityCounts.critical}`,
      `${this.formatBold('High:')} ${severityCounts.high}`,
      `${this.formatBold('Medium:')} ${severityCounts.medium}`,
      `${this.formatBold('Low:')} ${severityCounts.low}`,

       `${this.formatBold('Analysis Time:')} ${Date.now()} ms`

    ];

    section += this.formatList(summaryStats);


    const criticalIssues = this.report.results.filter(r => r.severity === 'critical');
    const highIssues = this.report.results.filter(r => r.severity === 'high');

    if (criticalIssues.length > 0 || highIssues.length > 0) {
      section += this.formatHeader(3, '🔍 Key Findings');

      const keyFindings: string[] = [];

      if (criticalIssues.length > 0) {
        keyFindings.push(`🚨 ${criticalIssues.length} critical security issue${criticalIssues.length > 1 ? 's' : ''} detected`);
      }

      if (highIssues.length > 0) {
        keyFindings.push(`⚠️ ${highIssues.length} high-priority optimization${highIssues.length > 1 ? 's' : ''} available`);
      }

      section += this.formatList(keyFindings);
    }

    return section;
  }

  private generateDetectionResults(includeGasEstimates: boolean): string {
    let section = this.formatHeader(2, '🔍 Detection Results');

    if (this.report.results.length === 0) {
      section += `${this.formatEmoji('✅', 'No storage issues detected - your contract looks good!')}\n\n`;
      return section;
    }


    const resultsByCategory = this.groupResultsByCategory();

    resultsByCategory.forEach((results, category) => {
      section += this.formatHeader(3, `${this.getCategoryEmoji(category)} ${category}`);

      results.forEach((result, index) => {
        section += this.formatHeader(4, `${index + 1}. ${result.title}`);


        const severityEmoji = this.getSeverityEmoji(result.severity);
        section += `${severityEmoji} ${this.formatBold('Severity:')} ${result.severity.toUpperCase()}\n\n`;


        section += `${this.formatBold('Description:')} ${result.description}\n\n`;


        if (result.location) {
          section += `${this.formatBold('Location:')} ${result.location}\n\n`;
        }


        if (includeGasEstimates && result.gasImpact) {
          const gasValue = typeof result.gasImpact === 'number' ? result.gasImpact : 0;
          section += `${this.formatBold('Gas Impact:')} ${gasValue.toLocaleString()} gas\n\n`;
        }


        if (result.recommendation) {
          section += `${this.formatBold('Recommendation:')} ${result.recommendation}\n\n`;
        }


        if (result.codeExample) {
          section += this.formatBold('Example Fix:') + '\n';
          section += this.formatCodeBlock(result.codeExample, 'solidity');
        }

        section += '---\n\n';
      });
    });

    return section;
  }

  private generateSeverityBreakdown(): string {
    let section = this.formatHeader(2, '📈 Severity Breakdown');

    const severityCounts = this.getSeverityCounts();
    const total = this.report.results.length;

    if (total === 0) {
      section += 'No issues to analyze.\n\n';
      return section;
    }

    const headers = ['Severity', 'Count', 'Percentage', 'Impact'];
    const rows = [
      [
        '🚨 Critical',
        severityCounts.critical.toString(),
        `${Math.round((severityCounts.critical / total) * 100)}%`,
        'Security vulnerabilities, immediate action required'
      ],
      [
        '⚠️ High',
        severityCounts.high.toString(),
        `${Math.round((severityCounts.high / total) * 100)}%`,
        'Significant gas waste or potential issues'
      ],
      [
        '🔶 Medium',
        severityCounts.medium.toString(),
        `${Math.round((severityCounts.medium / total) * 100)}%`,
        'Optimization opportunities'
      ],
      [
        '🔵 Low',
        severityCounts.low.toString(),
        `${Math.round((severityCounts.low / total) * 100)}%`,
        'Minor improvements'
      ]
    ];

    section += this.formatTable(headers, rows);
    return section;
  }

  private generateGasImpactAnalysis(): string {
    let section = this.formatHeader(2, '⛽ Gas Impact Analysis');


    const resultsWithGas = this.report.results.filter(r => r.gasImpact && typeof r.gasImpact === 'number' && r.gasImpact > 0);

    if (resultsWithGas.length === 0) {
      section += 'No gas impact data available.\n\n';
      return section;
    }


    const totalGasImpact = resultsWithGas.reduce((sum, r) => sum + (typeof r.gasImpact === 'number' ? r.gasImpact : 0), 0);
    const avgGasImpact = totalGasImpact / resultsWithGas.length;

    const gasAnalysis = [
      `${this.formatBold('Total Potential Gas Savings:')} ${totalGasImpact.toLocaleString()} gas`,
      `${this.formatBold('Average per Issue:')} ${Math.round(avgGasImpact).toLocaleString()} gas`,
      `${this.formatBold('Issues with Gas Impact:')} ${resultsWithGas.length} of ${this.report.results.length}`
    ];

    section += this.formatList(gasAnalysis);


    const topGasIssues = resultsWithGas
      .sort((a, b) => {
        const gasA = typeof a.gasImpact === 'number' ? a.gasImpact : 0;
        const gasB = typeof b.gasImpact === 'number' ? b.gasImpact : 0;
        return gasB - gasA;
      })
      .slice(0, 5);

    if (topGasIssues.length > 0) {
      section += this.formatHeader(3, 'Top Gas Impact Issues');

      const gasHeaders = ['Rank', 'Issue', 'Gas Savings', 'Severity'];
      const gasRows = topGasIssues.map((issue, index) => [
        (index + 1).toString(),
        issue.title,
        (typeof issue.gasImpact === 'number' ? issue.gasImpact : 0).toLocaleString(),
        issue.severity
      ]);

      section += this.formatTable(gasHeaders, gasRows);
    }

    return section;
  }

  private generateTechnicalDetails(): string {
    let section = this.formatHeader(2, '🔧 Technical Details');


    const categories = Array.from(this.groupResultsByCategory().keys());
    section += this.formatHeader(3, 'Detection Categories');
    section += this.formatList(categories.map(cat => `${this.getCategoryEmoji(cat)} ${cat}`));


    section += this.formatHeader(3, 'Contract Analysis');
    const contractDetails = [
      `${this.formatBold('Contract Name:')} ${this.contract.name}`,
      `${this.formatBold('State Variables:')} ${this.contract.stateVariables.length}`,
      `${this.formatBold('Functions:')} ${this.contract.functions.length}`,
      `${this.formatBold('Events:')} ${this.contract.events.length}`,
      `${this.formatBold('Modifiers:')} ${this.contract.modifiers.length}`
    ];

    if (this.contract.baseContracts.length > 0) {
      contractDetails.push(`${this.formatBold('Inheritance:')} ${this.contract.baseContracts.join(', ')}`);
    }

    section += this.formatList(contractDetails);

    return section;
  }

  private generateRecommendations(): string {
    let section = this.formatHeader(2, '💡 Recommendations');

    const recommendations = this.generateSmartRecommendations();

    if (recommendations.length === 0) {
      section += `${this.formatEmoji('✅', 'No specific recommendations - your storage layout is well optimized!')}\n\n`;
      return section;
    }


    section += this.formatHeader(3, 'Priority Actions');
    const priorityRecs = recommendations.filter(r => r.priority === 'high');
    if (priorityRecs.length > 0) {
      section += this.formatList(priorityRecs.map(r => r.text), true);
    } else {
      section += 'No high-priority actions required.\n\n';
    }


    const generalRecs = recommendations.filter(r => r.priority !== 'high');
    if (generalRecs.length > 0) {
      section += this.formatHeader(3, 'General Improvements');
      section += this.formatList(generalRecs.map(r => r.text), true);
    }

    return section;
  }

  private getSeverityCounts() {
    return {
      critical: this.report.results.filter(r => r.severity === 'critical').length,
      high: this.report.results.filter(r => r.severity === 'high').length,
      medium: this.report.results.filter(r => r.severity === 'medium').length,
      low: this.report.results.filter(r => r.severity === 'low').length
    };
  }

  private calculateOverallRisk(severityCounts: any): 'low' | 'medium' | 'high' | 'critical' {
    if (severityCounts.critical > 0) return 'critical';
    if (severityCounts.high > 2) return 'high';
    if (severityCounts.high > 0 || severityCounts.medium > 3) return 'medium';
    return 'low';
  }

  private groupResultsByCategory(): Map<string, DetectorResult[]> {
    const groups = new Map<string, DetectorResult[]>();

    this.report.results.forEach(result => {
      const category = result.category || 'General';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(result);
    });

    return groups;
  }

  private getCategoryEmoji(category: string): string {
    const emojiMap: Record<string, string> = {
      'security': '🔒',
      'gas': '⛽',
      'storage': '📦',
      'upgrade': '🔄',
      'Security': '🔒',
      'Gas Optimization': '⛽',
      'Storage Layout': '📦',
      'Packing': '🧳',
      'Upgrade Safety': '🔄',
      'General': '🔍'
    };
    return emojiMap[category] || '🔍';
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

  private generateSmartRecommendations(): Array<{text: string, priority: 'high' | 'medium' | 'low'}> {
    const recommendations: Array<{text: string, priority: 'high' | 'medium' | 'low'}> = [];
    const severityCounts = this.getSeverityCounts();


    if (severityCounts.critical > 0) {
      recommendations.push( {
        text: `🚨 Address ${severityCounts.critical} critical security issue${severityCounts.critical > 1 ? 's' : ''} immediately`,
        priority: 'high'
      });
    }

    if (severityCounts.high > 0) {
      recommendations.push( {
        text: `⚠️ Resolve ${severityCounts.high} high-priority issue${severityCounts.high > 1 ? 's' : ''} before deployment`,
        priority: 'high'
      });
    }


    const gasIssues = this.report.results.filter(r => r.gasImpact && typeof r.gasImpact === 'number' && r.gasImpact > 1000);
    if (gasIssues.length > 0) {
      const totalGas = gasIssues.reduce((sum, r) => sum + (typeof r.gasImpact === 'number' ? r.gasImpact : 0), 0);
      recommendations.push( {
        text: `⛽ Implement gas optimizations to save approximately ${totalGas.toLocaleString()} gas per deployment`,
        priority: 'medium'
      });
    }


    const storageIssues = this.report.results.filter(r => r.category === 'storage');

    if (storageIssues.length > 0) {
      recommendations.push( {
        text: '📦 Review storage layout for better variable packing and reduced slot usage',
        priority: 'medium'
      });
    }


    if (severityCounts.critical > 0 || severityCounts.high > 0) {
      recommendations.push( {
        text: '🧪 Add comprehensive tests covering the identified issues before deployment',
        priority: 'high'
      });
    }


    if (this.report.results.length > 3) {
      recommendations.push( {
        text: '📚 Document storage layout decisions and optimization choices for future reference',
        priority: 'low'
      });
    }

    return recommendations;
  }
}
