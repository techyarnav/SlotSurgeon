import { AssemblyAnalysis, GasHotspot, OptimizationSuggestion, AssemblyRisk, StorageOperation, AssemblyBlock } from '../assembly/assembly-analyzer';
import { ContractAST } from '../parser/types';
import { SlotMapping } from '../../types/slot-mapping';

export interface AssemblyHtmlOptions {
  theme?: 'light' | 'dark';
  includeSourceCode?: boolean;
  includeOptimizations?: boolean;
  includeRiskDetails?: boolean;
  interactive?: boolean;
}

export class AssemblyHtmlGenerator {
  constructor(
    private readonly analysis: AssemblyAnalysis,
    private readonly contract: ContractAST,
    private readonly sourceFile: string,
    private readonly slotMapping?: SlotMapping
  ) {}

  async generate(options: AssemblyHtmlOptions = {}): Promise<string> {
    const {
      theme = 'light',
      includeOptimizations = true,
      includeRiskDetails = true,
      interactive = true
    } = options;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assembly Analysis: ${this.analysis.contractName}</title>
    ${this.generateStyles(theme)}
</head>
<body class="theme-${theme}">
    <div class="container">
        ${this.generateHeader()}
        ${this.generateExecutiveSummary()}
        ${this.generateSecurityRisksSection()}
        ${this.generateStorageAccessSection()}
        ${this.generateAssemblyBlocksSection()}
        ${this.generateGasAnalysisSection()}
        ${includeOptimizations ? this.generateRecommendationsSection() : ''}
        ${this.generateFooter()}
    </div>
    ${interactive ? this.generateInteractiveScripts() : ''}
</body>
</html>`;
  }

  private generateStyles(theme: string): string {
    const isDark = theme === 'dark';
    return `<style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            line-height: 1.6;
            background: ${isDark ? '#0d1117' : '#ffffff'};
            color: ${isDark ? '#c9d1d9' : '#24292f'};
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: ${isDark ? '#161b22' : '#f6f8fa'};
            border-radius: 12px;
            border: 1px solid ${isDark ? '#30363d' : '#d0d7de'};
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            color: ${isDark ? '#58a6ff' : '#0969da'};
        }

        .contract-name {
            font-size: 1.5rem;
            color: ${isDark ? '#7c3aed' : '#8b5cf6'};
            margin-bottom: 10px;
        }

        .security-score {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 1.1rem;
        }

        .score-critical { background: #ff4444; color: white; }
        .score-high { background: #ff8800; color: white; }
        .score-medium { background: #ffdd00; color: black; }
        .score-good { background: #00cc44; color: white; }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }

        .summary-card {
            background: ${isDark ? '#161b22' : '#f6f8fa'};
            border: 1px solid ${isDark ? '#30363d' : '#d0d7de'};
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }

        .summary-card h3 {
            font-size: 2rem;
            margin-bottom: 5px;
            color: ${isDark ? '#58a6ff' : '#0969da'};
        }

        .summary-card p {
            color: ${isDark ? '#8b949e' : '#656d76'};
            font-size: 0.9rem;
        }

        .section {
            margin: 40px 0;
        }

        .section-title {
            font-size: 1.8rem;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid ${isDark ? '#30363d' : '#d0d7de'};
            color: ${isDark ? '#f0f6fc' : '#24292f'};
        }

        .risk-item {
            background: ${isDark ? '#161b22' : '#f6f8fa'};
            border: 1px solid ${isDark ? '#30363d' : '#d0d7de'};
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
        }

        .risk-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }

        .risk-icon {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
        }

        .severity-critical { background: #da3633; }
        .severity-high { background: #fb8500; }
        .severity-medium { background: #d1a01f; }
        .severity-low { background: #2da44e; }

        .risk-title {
            font-weight: bold;
            font-size: 1.1rem;
        }

        .risk-line {
            color: ${isDark ? '#8b949e' : '#656d76'};
            font-size: 0.9rem;
        }

        .risk-description {
            margin: 10px 0;
            padding: 10px;
            background: ${isDark ? '#0d1117' : '#ffffff'};
            border-radius: 6px;
            border-left: 4px solid ${isDark ? '#58a6ff' : '#0969da'};
        }

        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: ${isDark ? '#161b22' : '#ffffff'};
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid ${isDark ? '#30363d' : '#d0d7de'};
        }

        .table th,
        .table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid ${isDark ? '#30363d' : '#d0d7de'};
        }

        .table th {
            background: ${isDark ? '#21262d' : '#f6f8fa'};
            font-weight: bold;
        }

        .table tr:hover {
            background: ${isDark ? '#21262d' : '#f6f8fa'};
        }

        .assembly-block {
            background: ${isDark ? '#161b22' : '#f6f8fa'};
            border: 1px solid ${isDark ? '#30363d' : '#d0d7de'};
            border-radius: 8px;
            margin: 15px 0;
            overflow: hidden;
        }

        .block-header {
            background: ${isDark ? '#21262d' : '#ffffff'};
            padding: 15px;
            border-bottom: 1px solid ${isDark ? '#30363d' : '#d0d7de'};
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .block-title {
            font-weight: bold;
            font-size: 1.1rem;
        }

        .gas-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: bold;
        }

        .gas-low { background: #2da44e; color: white; }
        .gas-medium { background: #fb8500; color: white; }
        .gas-high { background: #da3633; color: white; }

        .code-block {
            background: ${isDark ? '#0d1117' : '#f6f8fa'};
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 0.85rem;
            line-height: 1.5;
            overflow-x: auto;
        }

        .recommendation {
            background: ${isDark ? '#1f2937' : '#ecfdf5'};
            border: 1px solid ${isDark ? '#374151' : '#10b981'};
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
        }

        .recommendation-icon {
            display: inline-block;
            margin-right: 8px;
            font-size: 1.2rem;
        }

        .footer {
            margin-top: 40px;
            padding: 20px;
            text-align: center;
            border-top: 1px solid ${isDark ? '#30363d' : '#d0d7de'};
            color: ${isDark ? '#8b949e' : '#656d76'};
            font-size: 0.9rem;
        }

        .collapsible {
            cursor: pointer;
            user-select: none;
        }

        .collapsible::after {
            content: ' ▼';
            font-size: 0.8rem;
            transition: transform 0.3s;
        }

        .collapsible.collapsed::after {
            transform: rotate(-90deg);
        }

        .collapsible-content {
            transition: max-height 0.3s ease-out;
            overflow: hidden;
        }

        .collapsible-content.collapsed {
            max-height: 0;
        }
    </style>`;
  }

  private generateHeader(): string {
    const securityScore = this.analysis.securityScore;
    const scoreClass = securityScore >= 80 ? 'score-good' :
                      securityScore >= 60 ? 'score-medium' :
                      securityScore >= 40 ? 'score-high' : 'score-critical';

    const scoreLabel = securityScore >= 80 ? 'GOOD' :
                      securityScore >= 60 ? 'MEDIUM' :
                      securityScore >= 40 ? 'HIGH RISK' : 'CRITICAL';

    return `
        <div class="header">
            <h1>⚡ Assembly Analysis Report</h1>
            <div class="contract-name">${this.analysis.contractName}</div>
            <div class="security-score ${scoreClass}">
                ${securityScore}/100 ${scoreLabel}
            </div>
        </div>
    `;
  }

  private generateExecutiveSummary(): string {
    return `
        <div class="section">
            <h2 class="section-title">📊 Analysis Summary</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <h3>${this.analysis.totalBlocks}</h3>
                    <p>Assembly Blocks</p>
                </div>
                <div class="summary-card">
                    <h3>${this.analysis.totalOperations}</h3>
                    <p>Total Operations</p>
                </div>
                <div class="summary-card">
                    <h3>${this.analysis.risks.length}</h3>
                    <p>Security Risks</p>
                </div>
                <div class="summary-card">
                    <h3>${this.analysis.storageAccesses.length}</h3>
                    <p>Storage Accesses</p>
                </div>
            </div>
            <p><strong>Gas Complexity:</strong> ${this.analysis.gasComplexity.toUpperCase()}</p>
        </div>
    `;
  }

  private generateSecurityRisksSection(): string {
    const risksByCategory = this.groupRisksByCategory();

    let html = `
        <div class="section">
            <h2 class="section-title">🛡️ Security Risks (${this.analysis.risks.length})</h2>
    `;

    Object.entries(risksByCategory).forEach(([category, risks]) => {
      html += `
            <h3 class="collapsible" onclick="toggleCollapse('${category.replace(' ', '-')}')">${category} (${risks.length})</h3>
            <div class="collapsible-content" id="${category.replace(' ', '-')}">
      `;

      risks.forEach(risk => {
        const severityIcon = this.getSeverityIcon(risk.severity);
        html += `
                <div class="risk-item">
                    <div class="risk-header">
                        <div class="risk-icon severity-${risk.severity}">${severityIcon}</div>
                        <div>
                            <div class="risk-title">${risk.opcode}</div>
                            <div class="risk-line">Line ${risk.line} • ${risk.severity}</div>
                        </div>
                    </div>
                    <div class="risk-description">
                        <strong>Description:</strong> ${risk.description}<br>
                        <strong>Impact:</strong> ${risk.impact}<br>
                        <strong>Recommendation:</strong> ${risk.recommendation}
                    </div>
                </div>
        `;
      });

      html += `</div>`;
    });

    html += `</div>`;
    return html;
  }

  private generateStorageAccessSection(): string {
    return `
        <div class="section">
            <h2 class="section-title">💾 Storage Access Analysis (${this.analysis.storageAccesses.length})</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Line</th>
                        <th>Operation</th>
                        <th>Slot</th>
                        <th>Variable</th>
                        <th>Risk</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.analysis.storageAccesses.map(access => `
                        <tr>
                            <td>${access.line}</td>
                            <td><strong>${access.type}</strong></td>
                            <td>${access.slot}</td>
                            <td>${access.affectedVariable || 'Unknown'}</td>
                            <td>${access.isComputed ? 'Computed Slot' : 'Direct Access'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
  }

  private generateAssemblyBlocksSection(): string {
    let html = `
        <div class="section">
            <h2 class="section-title">⚙️ Assembly Operations</h2>
    `;

    this.analysis.assemblyBlocks.forEach(block => {
      const gasClass = `gas-${block.gasComplexity}`;
      html += `
            <div class="assembly-block">
                <div class="block-header">
                    <div class="block-title">${block.id}</div>
                    <div>
                        <span>Lines ${block.startLine}-${block.endLine} • ${block.operations.length} operations • </span>
                        <span class="gas-badge ${gasClass}">${block.gasComplexity} gas</span>
                    </div>
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Line</th>
                            <th>Opcode</th>
                            <th>Category</th>
                            <th>Gas</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${block.operations.map(op => `
                            <tr>
                                <td>${op.line}</td>
                                <td><strong>${op.opcode.toUpperCase()}</strong></td>
                                <td>${op.category}</td>
                                <td>${op.gasUsage.toLocaleString()}</td>
                                <td>${op.description}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
      `;
    });

    html += `</div>`;
    return html;
  }

  private generateGasAnalysisSection(): string {
    const totalGas = this.analysis.gasAnalysis.deploymentCost + this.analysis.gasAnalysis.totalRuntimeCost;
    const avgPerBlock = Math.round(totalGas / this.analysis.totalBlocks);
    const highCostOps = this.analysis.assemblyBlocks
      .flatMap(block => block.operations)
      .filter(op => op.gasUsage > 1000)
      .sort((a, b) => b.gasUsage - a.gasUsage)
      .slice(0, 5);

    return `
        <div class="section">
            <h2 class="section-title">⛽ Gas Analysis</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <h3>${totalGas.toLocaleString()}</h3>
                    <p>Total Estimated Gas</p>
                </div>
                <div class="summary-card">
                    <h3>${avgPerBlock.toLocaleString()}</h3>
                    <p>Average per Block</p>
                </div>
                <div class="summary-card">
                    <h3>${highCostOps.length}</h3>
                    <p>High-Cost Operations</p>
                </div>
            </div>

            ${highCostOps.length > 0 ? `
                <h3>High Gas Operations</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Operation</th>
                            <th>Line</th>
                            <th>Gas Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${highCostOps.map(op => `
                            <tr>
                                <td><strong>${op.opcode.toUpperCase()}</strong></td>
                                <td>${op.line}</td>
                                <td>${op.gasUsage.toLocaleString()} gas</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : ''}
        </div>
    `;
  }

  private generateRecommendationsSection(): string {
    return `
        <div class="section">
            <h2 class="section-title">💡 Recommendations</h2>
            ${this.analysis.recommendations.map(rec => `
                <div class="recommendation">
                    <span class="recommendation-icon">💡</span>
                    ${rec}
                </div>
            `).join('')}
        </div>
    `;
  }

  private generateFooter(): string {
    return `
        <div class="footer">
            Generated by SlotSurgeon • ${new Date().toISOString()}
        </div>
    `;
  }

  private generateInteractiveScripts(): string {
    return `
        <script>
            function toggleCollapse(id) {
                const element = document.getElementById(id);
                const header = element.previousElementSibling;

                if (element.classList.contains('collapsed')) {
                    element.classList.remove('collapsed');
                    header.classList.remove('collapsed');
                    element.style.maxHeight = element.scrollHeight + 'px';
                } else {
                    element.classList.add('collapsed');
                    header.classList.add('collapsed');
                    element.style.maxHeight = '0';
                }
            }


            document.addEventListener('DOMContentLoaded', function() {
                const collapsibleSections = document.querySelectorAll('.collapsible-content');
                collapsibleSections.forEach(section => {
                    section.style.maxHeight = section.scrollHeight + 'px';
                });
            });
        </script>
    `;
  }

  private groupRisksByCategory(): Record<string, AssemblyRisk[]> {
    const groups: Record<string, AssemblyRisk[]> = {};

    this.analysis.risks.forEach(risk => {
      const category = this.getCategoryName(risk.type);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(risk);
    });

    return groups;
  }

  private getCategoryName(type: string): string {
    const categoryMap: Record<string, string> = {
      'slot_manipulation': 'Storage Manipulation',
      'gas_griefing': 'Gas Issues',
      'dangerous_opcode': 'Dangerous Operations',
      'reentrancy': 'Reentrancy Risks',
      'overflow': 'Arithmetic Issues',
      'unchecked_access': 'Access Control'
    };
    return categoryMap[type] || 'Other Issues';
  }

  private getSeverityIcon(severity: string): string {
    const iconMap: Record<string, string> = {
      'critical': '🚨',
      'high': '⚠️',
      'medium': '🎯',
      'low': '⛽'
    };
    return iconMap[severity] || '🔍';
  }
}
