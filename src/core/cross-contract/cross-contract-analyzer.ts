import { ContractAST, Function as SolidityFunction, Event as SolidityEvent, Modifier as SolidityModifier } from '../parser/types';
import { SlotMapping, StorageVariable } from '../../types/slot-mapping';
import { SlotCalculator } from '../slot-mapper/slot-calculator';
import { CollisionDetector, Collision } from '../slot-mapper/collision-detector';
import * as path from 'path';
import * as fs from 'fs-extra';

export interface CrossContractReport {
    contracts: ExtendedContractAST[];
    dependencies: ContractDependency[];
    potentialCollisions: CollisionReport[];
    inheritanceChains: InheritanceChain[];
    summary: AnalysisSummary;
}

export interface CrossContractAnalysis extends CrossContractReport {
}

export interface ContractInfo {
    name: string;
    filePath: string;
    source: string;
    size: number;
    complexity: number;
    dependencies: string[];
}

export interface ExtendedContractAST extends ContractAST {
    filePath?: string;
    source?: string;
    contractType?: string;
    dependencies?: string[];
    storageMapping?: SlotMapping;
    complexity?: number;
    size?: number;
    riskLevel?: 'low' | 'medium' | 'high';
}

export interface ContractDependency {
    from: string;
    to: string;
    type: 'inheritance' | 'import' | 'library';
    filePath: string;
    relationship?: string;
    riskLevel?: 'low' | 'medium' | 'high';
}

export interface CollisionReport {
    contract1: string;
    contract2: string;
    collisions: Array< {
        slot: number;
        variable1: string;
        variable2: string;
        severity: 'low' | 'medium' | 'high';
    }>;
}

export interface CrossContractCollision extends CollisionReport {
}

export interface InheritanceChain {
    baseContract: string;
    derivedContracts: string[];
    depth: number;
    complexity: number;
    potentialIssues: string[];
}

export interface AnalysisSummary {
    totalContracts: number;
    totalDependencies: number;
    potentialIssues: number;
    inheritanceChains: number;
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
}

export class CrossContractAnalyzer {
    async analyzeDirectory(directory: string): Promise<CrossContractReport> {
        console.log(`🔍 Scanning directory: ${directory}`);

        const contracts = await this.discoverContracts(directory);
        const enhancedContracts = await this.enhanceContracts(contracts);
        const dependencies = this.analyzeDependencies(enhancedContracts);
        const collisions = await this.detectCrossContractCollisions(enhancedContracts);
        const inheritanceChains = this.analyzeInheritanceChains(enhancedContracts);

        const summary: AnalysisSummary = {
            totalContracts: enhancedContracts.length,
            totalDependencies: dependencies.length,
            potentialIssues: collisions.reduce((sum, report) => sum + report.collisions.length, 0),
            inheritanceChains: inheritanceChains.length,
            riskLevel: this.calculateOverallRiskLevel(collisions, dependencies),
            recommendations: this.generateRecommendations(enhancedContracts, dependencies, collisions)
        };

        return {
            contracts: enhancedContracts,
            dependencies,
            potentialCollisions: collisions,
            inheritanceChains,
            summary
        };
    }

    private async discoverContracts(directory: string): Promise<Array<{ name: string; filePath: string; source: string }>> {
        const contracts: Array<{ name: string; filePath: string; source: string }> = [];

        try {
            const files = await this.getAllSolidityFiles(directory);

            for (const filePath of files) {
                try {
                    const source = await fs.readFile(filePath, 'utf8');
                    const contractNames = this.extractContractNames(source);

                    contractNames.forEach(name => {
                        contracts.push( {
                            name,
                            filePath,
                            source
                        });
                    });
                } catch (error) {
                    console.warn(`Failed to read file ${filePath}: ${error}`);
                }
            }
        } catch (error) {
            console.error(`Failed to discover contracts in ${directory}: ${error}`);
        }

        return contracts;
    }

    private async getAllSolidityFiles(directory: string): Promise<string[]> {
        const files: string[] = [];

        const scan = async (dir: string) => {
            try {
                const items = await fs.readdir(dir);

                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = await fs.stat(fullPath);

                    if (stat.isDirectory()) {
                        if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
                            await scan(fullPath);
                        }
                    } else if (item.endsWith('.sol')) {
                        files.push(fullPath);
                    }
                }
            } catch (error) {
                console.warn(`Failed to scan directory ${dir}: ${error}`);
            }
        };

        await scan(directory);
        return files;
    }

    private extractContractNames(source: string): string[] {
        const names: string[] = [];

        const patterns = [
            /contract\s+(\w+)/g,
            /interface\s+(\w+)/g,
            /library\s+(\w+)/g
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(source)) !== null) {
                names.push(match[1]);
            }
        });

        return names;
    }

    private async enhanceContracts(contracts: Array<{ name: string; filePath: string; source: string }>): Promise<ExtendedContractAST[]> {
        const enhanced: ExtendedContractAST[] = [];

        for (const contractInfo of contracts) {
            try {
                const { SolidityParser } = require('../parser/solidity-parser');
                const parser = new SolidityParser(contractInfo.filePath);
                const parsedContracts = await parser.parse();

                const contract = parsedContracts.find((c: ContractAST) => c.name === contractInfo.name);

                if (contract) {
                    const enhancedContract: ExtendedContractAST = {
                        ...contract,
                        filePath: contractInfo.filePath,
                        source: contractInfo.source,
                        contractType: this.determineContractType(contractInfo.source),
                        dependencies: [],
                        storageMapping: undefined,
                        complexity: this.calculateComplexity(contract),
                        size: contractInfo.source.length,
                        riskLevel: 'low'
                    };

                    try {
                        const mapping = SlotCalculator.calculateSlots(contract);
                        enhancedContract.storageMapping = mapping;
                        enhancedContract.riskLevel = this.assessRiskLevel(enhancedContract);
                    } catch (error) {
                        console.warn(`Failed to calculate slots for ${contract.name}: ${error}`);
                    }

                    enhanced.push(enhancedContract);
                }
            } catch (error) {
                console.error(`Failed to parse contract ${contractInfo.name}: ${error}`);
            }
        }

        return enhanced;
    }

    private determineContractType(source: string): string {
        if (source.includes('abstract contract')) return 'abstract';
        if (source.includes('interface ')) return 'interface';
        if (source.includes('library ')) return 'library';
        return 'contract';
    }

    private calculateComplexity(contract: ContractAST): number {
        return contract.stateVariables.length +
            contract.functions.length +
            contract.events.length +
            contract.modifiers.length;
    }

    private assessRiskLevel(contract: ExtendedContractAST): 'low' | 'medium' | 'high' {
        const complexity = contract.complexity || 0;
        const storageSlots = contract.storageMapping?.totalSlots || 0;

        if (complexity > 20 || storageSlots > 10) return 'high';
        if (complexity > 10 || storageSlots > 5) return 'medium';
        return 'low';
    }

    private analyzeDependencies(contracts: ExtendedContractAST[]): ContractDependency[] {
        const dependencies: ContractDependency[] = [];

        contracts.forEach(contract => {
            contract.baseContracts.forEach(baseContract => {
                dependencies.push( {
                    from: contract.name,
                    to: baseContract,
                    type: 'inheritance',
                    filePath: contract.filePath || 'unknown',
                    relationship: 'inherits from',
                    riskLevel: this.assessDependencyRisk('inheritance', contract, baseContract)
                });
            });

            if (contract.source) {
                const importMatches = contract.source.match(/import\s+[^;]+;/g) || [];
                importMatches.forEach(importStatement => {
                    const match = importStatement.match(/import\s+.*?"([^"]+)"/);
                    if (match) {
                        dependencies.push( {
                            from: contract.name,
                            to: match[1],
                            type: 'import',
                            filePath: contract.filePath || 'unknown',
                            relationship: 'imports',
                            riskLevel: this.assessDependencyRisk('import', contract, match[1])
                        });
                    }
                });
            }

            if (contract.source) {
                const libraryMatches = contract.source.match(/using\s+(\w+)\s+for/g) || [];
                libraryMatches.forEach(libraryStatement => {
                    const match = libraryStatement.match(/using\s+(\w+)\s+for/);
                    if (match) {
                        dependencies.push( {
                            from: contract.name,
                            to: match[1],
                            type: 'library',
                            filePath: contract.filePath || 'unknown',
                            relationship: 'uses library',
                            riskLevel: this.assessDependencyRisk('library', contract, match[1])
                        });
                    }
                });
            }
        });

        return dependencies;
    }

    private assessDependencyRisk(type: string, contract: ExtendedContractAST, dependency: string): 'low' | 'medium' | 'high' {
        if (type === 'inheritance') return 'medium';

        if (type === 'import' && dependency.includes('@')) return 'medium';

        return 'low';
    }


    private async detectCrossContractCollisions(contracts: ExtendedContractAST[]): Promise<CollisionReport[]> {
        const collisions: CollisionReport[] = [];

        for (let i = 0; i < contracts.length; i++) {
            for (let j = i + 1; j < contracts.length; j++) {
                const contract1 = contracts[i];
                const contract2 = contracts[j];

                if (contract1.storageMapping && contract2.storageMapping) {
                    try {
                        const report = CollisionDetector.compare(contract1.storageMapping, contract2.storageMapping);

                        if (report.collisions && report.collisions.length > 0) {
                            collisions.push( {
                                contract1: contract1.name,
                                contract2: contract2.name,
                                collisions: report.collisions.map((collision: any) => ( {
                                    slot: collision.slot || 0,
                                    variable1: this.getVariableNameBySlot(contract1.storageMapping!, collision.slot) || 'unknown',
                                    variable2: this.getVariableNameBySlot(contract2.storageMapping!, collision.slot) || 'unknown',
                                    severity: (collision.severity || collision.level || 'medium') as 'low' | 'medium' | 'high'
                                }))
                            });
                        }
                    } catch (error) {
                        console.warn(`Failed to compare storage layouts for ${contract1.name} and ${contract2.name}: ${error}`);
                    }
                }
            }
        }

        return collisions;
    }

    private getVariableNameBySlot(mapping: SlotMapping, slot: number): string | null {
        const variable = mapping.variables.find(v => v.slot === slot);
        return variable ? variable.name : null;
    }

    private analyzeInheritanceChains(contracts: ExtendedContractAST[]): InheritanceChain[] {
        const chains: InheritanceChain[] = [];
        const processed = new Set<string>();

        contracts.forEach(contract => {
            if (contract.baseContracts.length === 0 && !processed.has(contract.name)) {

                const chain = this.buildInheritanceChain(contract, contracts);
                if (chain.derivedContracts.length > 0) {
                    chains.push(chain);
                    processed.add(contract.name);
                    chain.derivedContracts.forEach(derived => processed.add(derived));
                }
            }
        });

        return chains;
    }

    private buildInheritanceChain(baseContract: ExtendedContractAST, allContracts: ExtendedContractAST[]): InheritanceChain {
        const derivedContracts: string[] = [];
        let maxDepth = 0;
        let totalComplexity = baseContract.complexity || 0;
        const potentialIssues: string[] = [];

        const findDerived = (contractName: string, depth: number) => {
            const derived = allContracts.filter(c => c.baseContracts.includes(contractName));

            derived.forEach(derivedContract => {
                derivedContracts.push(derivedContract.name);
                maxDepth = Math.max(maxDepth, depth + 1);
                totalComplexity += derivedContract.complexity || 0;


                if (derivedContract.baseContracts.length > 1) {
                    potentialIssues.push(`${derivedContract.name} uses multiple inheritance`);
                }

                if (derivedContract.riskLevel === 'high') {
                    potentialIssues.push(`${derivedContract.name} has high complexity risk`);
                }

                findDerived(derivedContract.name, depth + 1);
            });
        };

        findDerived(baseContract.name, 0);

        return {
            baseContract: baseContract.name,
            derivedContracts,
            depth: maxDepth,
            complexity: totalComplexity,
            potentialIssues
        };
    }

    private calculateOverallRiskLevel(collisions: CollisionReport[], dependencies: ContractDependency[]): 'low' | 'medium' | 'high' {
        const totalCollisions = collisions.reduce((sum, report) => sum + report.collisions.length, 0);
        const highRiskDependencies = dependencies.filter(dep => dep.riskLevel === 'high').length;

        if (totalCollisions > 5 || highRiskDependencies > 3) return 'high';
        if (totalCollisions > 2 || highRiskDependencies > 1) return 'medium';
        return 'low';
    }

    private generateRecommendations(
        contracts: ExtendedContractAST[],
        dependencies: ContractDependency[],
        collisions: CollisionReport[]
    ): string[] {
        const recommendations: string[] = [];

        if (collisions.length > 0) {
            recommendations.push('Review storage layouts to prevent potential collisions during upgrades');
            recommendations.push('Consider using storage gaps in upgradeable contracts');
        }

        const highComplexityContracts = contracts.filter(c => (c.complexity || 0) > 20);
        if (highComplexityContracts.length > 0) {
            recommendations.push(`Consider refactoring high-complexity contracts: ${highComplexityContracts.map(c => c.name).join(', ')}`);
        }


        const multipleInheritance = contracts.filter(c => c.baseContracts.length > 1);
        if (multipleInheritance.length > 0) {
            recommendations.push('Review multiple inheritance patterns for potential diamond problem issues');
        }

        const externalDependencies = dependencies.filter(dep => dep.type === 'import' && dep.to.includes('@'));
        if (externalDependencies.length > 0) {
            recommendations.push('Audit external dependencies for security vulnerabilities');
        }

        return recommendations;
    }

    private countInheritanceChains(contracts: ExtendedContractAST[]): number {
        return contracts.filter(contract => contract.baseContracts.length > 0).length;
    }

    private isAbstractContract(contract: ExtendedContractAST): boolean {
        return contract.isAbstract ||
            (contract.source?.includes('abstract contract') || false);
    }

    private isInterfaceContract(contract: ExtendedContractAST): boolean {
        return contract.isInterface ||
            (contract.source?.includes('interface ') || false);
    }

    private isLibraryContract(contract: ExtendedContractAST): boolean {
        return contract.isLibrary ||
            (contract.source?.includes('library ') || false);
    }
}
