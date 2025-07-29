import { CrossContractReport as CrossContractAnalysis, ContractInfo, ContractDependency, CollisionReport as CrossContractCollision, InheritanceChain, ExtendedContractAST } from '../cross-contract/cross-contract-analyzer';

export interface CrossContractReportOptions {
  includeSourceCode?: boolean;
  includeDependencyGraph?: boolean;
  includeCollisionDetails?: boolean;
  format?: 'html' | 'markdown' | 'json';
  theme?: 'light' | 'dark';
}

export class CrossContractReportGenerator {
  constructor(
    private analysis: CrossContractAnalysis,
    private options: CrossContractReportOptions = {}
  ) {}

  generateReport(): string {
    switch (this.options.format || 'html') {
      case 'html':
        return this.generateHTMLReport();
      case 'markdown':
        return this.generateMarkdownReport();
      case 'json':
        return this.generateJSONReport();
      default:
        return this.generateHTMLReport();
    }
  }

  private generateHTMLReport(): string {
    const theme = this.options.theme || 'light';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cross-Contract Storage Analysis Report</title>
    <style>
        ${this.getHTMLStyles(theme)}
    </style>
</head>
<body class="${theme}">
    <div class="container">
        ${this.generateHTMLHeader()}
        ${this.generateHTMLSummary()}
        ${this.generateHTMLContracts()}
        ${this.generateHTMLDependencies()}
        ${this.generateHTMLCollisions()}
        ${this.generateHTMLInheritanceChains()}
        ${this.generateHTMLRecommendations()}
    </div>
    <script>
        ${this.getHTMLScript()}
    </script>
</body>
</html>`;
  }

  private generateHTMLHeader(): string {
    return `
        <header class="report-header">
            <h1>🔍 Cross-Contract Storage Analysis Report</h1>
            <div class="report-meta">
                <span class="generated-time">Generated: ${new Date().toLocaleString()}</span>
                <span class="contracts-count">${this.analysis.contracts.length} Contracts Analyzed</span>
            </div>
        </header>`;
  }

  private generateHTMLSummary(): string {
    const summary = this.analysis.summary;
    const riskColor = summary.riskLevel === 'high' ? 'risk-high' :
                     summary.riskLevel === 'medium' ? 'risk-medium' : 'risk-low';

    return `
        <section class="summary-section">
            <h2>📊 Analysis Summary</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-value">${summary.totalContracts}</div>
                    <div class="summary-label">Total Contracts</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${summary.totalDependencies}</div>
                    <div class="summary-label">Dependencies</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${summary.potentialIssues}</div>
                    <div class="summary-label">Potential Issues</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${summary.inheritanceChains}</div>
                    <div class="summary-label">Inheritance Chains</div>
                </div>
                <div class="summary-card ${riskColor}">
                    <div class="summary-value">${summary.riskLevel.toUpperCase()}</div>
                    <div class="summary-label">Overall Risk Level</div>
                </div>
            </div>
        </section>`;
  }

  private generateHTMLContracts(): string {
    let html = `
        <section class="contracts-section">
            <h2>📋 Contract Details</h2>
            <div class="contracts-grid">`;

    this.analysis.contracts.forEach(contract => {
      const riskClass = `risk-${contract.riskLevel || 'low'}`;
      const storageSlots = contract.storageMapping?.totalSlots || 0;
      const complexity = contract.complexity || 0;

      html += `
                <div class="contract-card ${riskClass}">
                    <div class="contract-header">
                        <h3>${contract.name}</h3>
                        <span class="contract-type">${contract.contractType || 'contract'}</span>
                    </div>
                    <div class="contract-details">
                        <div class="detail-item">
                            <span class="detail-label">Storage Slots:</span>
                            <span class="detail-value">${storageSlots}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Complexity:</span>
                            <span class="detail-value">${complexity}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Risk Level:</span>
                            <span class="detail-value ${riskClass}">${contract.riskLevel || 'low'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Base Contracts:</span>
                            <span class="detail-value">${contract.baseContracts.length}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">State Variables:</span>
                            <span class="detail-value">${contract.stateVariables.length}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Functions:</span>
                            <span class="detail-value">${contract.functions.length}</span>
                        </div>
                    </div>
                    ${contract.filePath ? `<div class="contract-path">${contract.filePath}</div>` : ''}
                </div>`;
    });

    html += `
            </div>
        </section>`;

    return html;
  }

  private generateHTMLDependencies(): string {
    let html = `
        <section class="dependencies-section">
            <h2>🔗 Contract Dependencies</h2>`;

    if (this.analysis.dependencies.length === 0) {
      html += `<div class="no-data">No dependencies found</div>`;
    } else {
      html += `<div class="dependencies-list">`;

      this.analysis.dependencies.forEach(dep => {
        const riskClass = `risk-${dep.riskLevel || 'low'}`;
        html += `
            <div class="dependency-item ${riskClass}">
                <div class="dependency-content">
                    <div class="dependency-main">
                        <span class="contract-name">${dep.from}</span>
                        <span class="arrow">→</span>
                        <span class="contract-name">${dep.to}</span>
                    </div>
                    <div class="dependency-meta">
                        <span class="dependency-type">${dep.type}</span>
                        <span class="relationship">${dep.relationship || dep.type}</span>
                        <span class="risk-level ${dep.riskLevel || 'low'}">${(dep.riskLevel || 'low')} risk</span>
                    </div>
                </div>
            </div>`;
      });

      html += `</div>`;
    }

    html += `</section>`;
    return html;
  }

  private generateHTMLCollisions(): string {
    let html = `
        <section class="collisions-section">
            <h2>⚠️ Potential Storage Collisions</h2>`;

    if (this.analysis.potentialCollisions.length === 0) {
      html += `<div class="no-data success">✅ No storage collisions detected</div>`;
    } else {
      html += `<div class="collisions-list">`;

      this.analysis.potentialCollisions.forEach(collision => {
        html += `
            <div class="collision-item">
                <div class="collision-header">
                    <h4>${collision.contract1} ↔ ${collision.contract2}</h4>
                    <span class="collision-count">${collision.collisions.length} collision(s)</span>
                </div>
                <div class="collision-details">`;

        collision.collisions.forEach(c => {
          const severityClass = `severity-${c.severity}`;
          html += `
                    <div class="collision-detail ${severityClass}">
                        <div class="slot-info">Slot ${c.slot}</div>
                        <div class="variable-conflict">
                            <span class="variable">${c.variable1}</span>
                            <span class="vs">vs</span>
                            <span class="variable">${c.variable2}</span>
                        </div>
                        <div class="severity ${severityClass}">${c.severity} severity</div>
                    </div>`;
        });

        html += `
                </div>
            </div>`;
      });

      html += `</div>`;
    }

    html += `</section>`;
    return html;
  }

  private generateHTMLInheritanceChains(): string {
    let html = `
        <section class="inheritance-section">
            <h2>🏗️ Inheritance Chains</h2>`;

    if (this.analysis.inheritanceChains.length === 0) {
      html += `<div class="no-data">No inheritance chains found</div>`;
    } else {
      html += `<div class="inheritance-list">`;

      this.analysis.inheritanceChains.forEach(chain => {
        html += `
            <div class="inheritance-chain">
                <div class="chain-header">
                    <h4>${chain.baseContract}</h4>
                    <div class="chain-stats">
                        <span class="depth">Depth: ${chain.depth}</span>
                        <span class="complexity">Complexity: ${chain.complexity}</span>
                        <span class="derived-count">${chain.derivedContracts.length} derived</span>
                    </div>
                </div>
                <div class="chain-tree">
                    <div class="base-contract">${chain.baseContract}</div>
                    ${chain.derivedContracts.map(derived => `
                        <div class="derived-contract">└─ ${derived}</div>
                    `).join('')}
                </div>
                ${chain.potentialIssues.length > 0 ? `
                    <div class="chain-issues">
                        <h5>Potential Issues:</h5>
                        <ul>
                            ${chain.potentialIssues.map(issue => `<li>${issue}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>`;
      });

      html += `</div>`;
    }

    html += `</section>`;
    return html;
  }

  private generateHTMLRecommendations(): string {
    let html = `
        <section class="recommendations-section">
            <h2>💡 Recommendations</h2>`;

    if (this.analysis.summary.recommendations.length === 0) {
      html += `<div class="no-data success">✅ No specific recommendations at this time</div>`;
    } else {
      html += `<div class="recommendations-list">`;

      this.analysis.summary.recommendations.forEach((recommendation, index) => {
        html += `
            <div class="recommendation-item">
                <div class="recommendation-number">${index + 1}</div>
                <div class="recommendation-text">${recommendation}</div>
            </div>`;
      });

      html += `</div>`;
    }

    html += `</section>`;
    return html;
  }

  private generateMarkdownReport(): string {
    return `# Cross-Contract Storage Analysis Report

Generated: ${new Date().toLocaleString()}

## Summary
- **Total Contracts**: ${this.analysis.summary.totalContracts}
- **Dependencies**: ${this.analysis.summary.totalDependencies}
- **Potential Issues**: ${this.analysis.summary.potentialIssues}
- **Inheritance Chains**: ${this.analysis.summary.inheritanceChains}
- **Overall Risk Level**: ${this.analysis.summary.riskLevel.toUpperCase()}

## Contracts
${this.analysis.contracts.map(contract => `
### ${contract.name}
- **Type**: ${contract.contractType || 'contract'}
- **Storage Slots**: ${contract.storageMapping?.totalSlots || 0}
- **Complexity**: ${contract.complexity || 0}
- **Risk Level**: ${contract.riskLevel || 'low'}
- **Base Contracts**: ${contract.baseContracts.length}
- **State Variables**: ${contract.stateVariables.length}
- **Functions**: ${contract.functions.length}
${contract.filePath ? `- **File**: ${contract.filePath}` : ''}
`).join('')}

## Dependencies
${this.analysis.dependencies.map(dep => `
- **${dep.from}** → **${dep.to}** (${dep.type}, ${dep.riskLevel || 'low'} risk)
`).join('')}

## Storage Collisions
${this.analysis.potentialCollisions.length > 0 ?
  this.analysis.potentialCollisions.map(collision => `
### ${collision.contract1} ↔ ${collision.contract2}
${collision.collisions.map(c => `- Slot ${c.slot}: ${c.variable1} vs ${c.variable2} (${c.severity} severity)`).join('\n')}
`).join('') :
  '✅ No storage collisions detected'}

## Recommendations
${this.analysis.summary.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}
`;
  }

  private generateJSONReport(): string {
    return JSON.stringify(this.analysis, null, 2);
  }

  private getHTMLStyles(theme: string): string {
    return `
        :root {
            --primary-color: ${theme === 'dark' ? '#4CAF50' : '#2196F3'};
            --background-color: ${theme === 'dark' ? '#1a1a1a' : '#ffffff'};
            --text-color: ${theme === 'dark' ? '#ffffff' : '#333333'};
            --border-color: ${theme === 'dark' ? '#333333' : '#e0e0e0'};
            --card-background: ${theme === 'dark' ? '#2d2d2d' : '#f9f9f9'};
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background-color: var(--background-color);
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .report-header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border-bottom: 2px solid var(--primary-color);
        }

        .report-header h1 {
            color: var(--primary-color);
            margin-bottom: 10px;
        }

        .report-meta {
            display: flex;
            justify-content: center;
            gap: 20px;
            font-size: 0.9em;
            color: #666;
        }

        .summary-section {
            margin-bottom: 30px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .summary-card {
            background: var(--card-background);
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid var(--border-color);
        }

        .summary-value {
            font-size: 2em;
            font-weight: bold;
            color: var(--primary-color);
        }

        .summary-label {
            font-size: 0.9em;
            color: #666;
            margin-top: 5px;
        }

        .risk-high { border-left: 4px solid #f44336; }
        .risk-medium { border-left: 4px solid #ff9800; }
        .risk-low { border-left: 4px solid #4caf50; }

        .contracts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .contract-card {
            background: var(--card-background);
            border-radius: 8px;
            padding: 20px;
            border: 1px solid var(--border-color);
        }

        .contract-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .contract-header h3 {
            color: var(--primary-color);
        }

        .contract-type {
            background: var(--primary-color);
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.8em;
        }

        .detail-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .detail-label {
            font-weight: 500;
        }

        .contract-path {
            margin-top: 15px;
            font-size: 0.8em;
            color: #666;
            border-top: 1px solid var(--border-color);
            padding-top: 10px;
        }

        .dependencies-list, .collisions-list, .inheritance-list {
            margin-top: 20px;
        }

        .dependency-item, .collision-item, .inheritance-chain {
            background: var(--card-background);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
        }

        .no-data {
            text-align: center;
            padding: 40px;
            color: #666;
            font-style: italic;
        }

        .no-data.success {
            color: #4caf50;
        }

        .recommendations-list {
            margin-top: 20px;
        }

        .recommendation-item {
            display: flex;
            gap: 15px;
            padding: 15px;
            background: var(--card-background);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            margin-bottom: 15px;
        }

        .recommendation-number {
            background: var(--primary-color);
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            flex-shrink: 0;
        }

        section {
            margin-bottom: 40px;
        }

        section h2 {
            color: var(--primary-color);
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
        }
    `;
  }

  private getHTMLScript(): string {
    return `

        document.addEventListener('DOMContentLoaded', function() {

            const cards = document.querySelectorAll('.contract-card, .collision-item, .inheritance-chain');
            cards.forEach(card => {
                card.addEventListener('click', function() {
                    this.classList.toggle('expanded');
                });
            });
        });
    `;
  }
}
