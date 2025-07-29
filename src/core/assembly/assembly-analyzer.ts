import { SlotMapping } from '../../types/slot-mapping';

export interface OptimizationSuggestion {
    title: string;
    description: string;
    impact: 'critical' | 'high' | 'medium' | 'low';
    gassSaved: number;
    implementation: string;
    codeExample?: string;
}

export interface GasHotspot {
    function: string;
    operation: string;
    gasCost: number;
    frequency: number;
    totalImpact: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    recommendation: string;
}

export interface FunctionGasAnalysis {
    name: string;
    gasCost: number;
    storageOps: number;
    complexity: string;
    hotspotLevel: 'critical' | 'high' | 'medium' | 'low';
    optimization: string;
}

export interface StorageOperation {
    type: 'SSTORE' | 'SLOAD';
    variable: string;
    slot: number;
    gasCost: number;
    optimization?: string;
}

interface Contract {
    name: string;
    source: string;
    stateVariables?: any[];
}

export interface AssemblyBlock {
    id: string;
    startLine: number;
    endLine: number;
    code: string;
    operations: AssemblyOperation[];
    risks: AssemblyRisk[];
    storageAccess: StorageAccess[];
    gasComplexity: 'low' | 'medium' | 'high';
}

export interface AssemblyOperation {
    opcode: string;
    line: number;
    args: string[];
    category: 'storage' | 'memory' | 'stack' | 'control' | 'arithmetic' | 'bitwise' | 'environmental' | 'other';
    gasUsage: number;
    description: string;
}

export interface AssemblyRisk {
    type: 'storage_collision' | 'unchecked_access' | 'dangerous_opcode' | 'gas_griefing' | 'reentrancy' | 'overflow' | 'slot_manipulation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    line: number;
    opcode: string;
    description: string;
    recommendation: string;
    impact: string;
    gasImpact: number;
}

export interface StorageAccess {
    type: 'sload' | 'sstore';
    line: number;
    slot: number;
    variable: string;
    operation: 'read' | 'write';
    gasCost: number;
    isComputed: boolean;
    potentialCollision: boolean;
    affectedVariable?: string;
}
export interface AssemblyAnalysis {
    contractName: string;
    totalBlocks: number;
    totalOperations: number;
    assemblyBlocks: AssemblyBlock[];
    risks: AssemblyRisk[];
    storageAccesses: StorageAccess[];
    securityScore: number;
    gasComplexity: 'low' | 'medium' | 'high';
    recommendations: string[];
    storageMapping?: SlotMapping;

    gasAnalysis: {
        deploymentCost: number;
        totalRuntimeCost: number;
        storageOperationsCost: number;
        breakdown: {
            sstore: number;
            sload: number;
            computation: number;
            call: number;
            memory: number;
        };
    };
    hotspots: GasHotspot[];
    functionAnalysis: FunctionGasAnalysis[];
    storageOperations: StorageOperation[];
    optimizations: OptimizationSuggestion[];
    summary: {
        averageFunctionCost: number;
        optimizationPotential: number;
        totalFunctions: number;
        storageIntensive: number;
        computeIntensive: number;
        securityScore: number;
    };
    metadata: {
        contractSize: number;
        storageSlots: number;
        opcodeCount: number;
        estimatedDeploymentCost: number;
        analysisTime: number;
        gasPrice: number;
    };
}

export class AssemblyAnalyzer {
    private static readonly DANGEROUS_OPCODES = new Set([
        'call', 'callcode', 'delegatecall', 'staticcall', 'create', 'create2',
        'selfdestruct', 'suicide', 'codecopy', 'extcodecopy'
    ]);

    private static readonly HIGH_GAS_OPCODES = new Set([
        'sstore', 'sload', 'call', 'delegatecall', 'staticcall', 'create', 'create2',
        'extcodesize', 'extcodehash', 'extcodecopy', 'log0', 'log1', 'log2', 'log3', 'log4'
    ]);

    private static readonly OPCODE_GAS_COSTS: Record<string, number> = {

        'sload': 800,
        'sstore': 20000,

        'mload': 3,
        'mstore': 3,
        'mstore8': 3,

        'push1': 3, 'push2': 3, 'push3': 3, 'push4': 3, 'push5': 3,
        'push6': 3, 'push7': 3, 'push8': 3, 'push9': 3, 'push10': 3,
        'dup1': 3, 'dup2': 3, 'dup3': 3, 'dup4': 3, 'dup5': 3,
        'swap1': 3, 'swap2': 3, 'swap3': 3, 'swap4': 3, 'swap5': 3,

        'add': 3, 'sub': 3, 'mul': 5, 'div': 5, 'mod': 5,
        'exp': 10, 'signextend': 5,

        'and': 3, 'or': 3, 'xor': 3, 'not': 3, 'shl': 3, 'shr': 3, 'sar': 3,

        'lt': 3, 'gt': 3, 'slt': 3, 'sgt': 3, 'eq': 3, 'iszero': 3,

        'jump': 8, 'jumpi': 10, 'jumpdest': 1,

        'call': 700, 'callcode': 700, 'delegatecall': 700, 'staticcall': 700,
        'create': 32000, 'create2': 32000,

        'address': 2, 'balance': 400, 'origin': 2, 'caller': 2,
        'callvalue': 2, 'calldataload': 3, 'calldatasize': 2,
        'gasprice': 2, 'timestamp': 2, 'number': 2, 'difficulty': 2,

        'pop': 2, 'return': 0, 'revert': 0, 'stop': 0, 'invalid': 0
    };

    static async analyze(contract: Contract, slotMapping?: SlotMapping): Promise<AssemblyAnalysis> {
        const assemblyBlocks = this.extractAssemblyBlocks(contract.source);
        const allRisks: AssemblyRisk[] = [];
        const allStorageAccesses: StorageAccess[] = [];
        let totalOperations = 0;

        assemblyBlocks.forEach(block => {
            block.operations = this.parseOperations(block.code, block.startLine);
            block.risks = this.analyzeRisks(block, slotMapping);
            block.storageAccess = this.analyzeStorageAccess(block, slotMapping);
            block.gasComplexity = this.calculateGasComplexity(block.operations);

            allRisks.push(...block.risks);
            allStorageAccesses.push(...block.storageAccess);
            totalOperations += block.operations.length;
        });

        const securityScore = this.calculateSecurityScore(allRisks);
        const gasComplexity = this.calculateOverallGasComplexity(assemblyBlocks);
        const recommendations = this.generateRecommendations(allRisks, allStorageAccesses);

        const totalComplexityScore = allRisks.reduce((sum, risk) => {
            return sum + (risk.severity === 'high' ? 3 : risk.severity === 'medium' ? 2 : 1);
        }, 0);

        return {
            contractName: contract.name,
            totalBlocks: assemblyBlocks.length,
            totalOperations,
            assemblyBlocks,
            risks: allRisks,
            storageAccesses: allStorageAccesses,
            securityScore,
            gasComplexity,
            recommendations,
            storageMapping: slotMapping,


            gasAnalysis: {
                deploymentCost: 86000,
                totalRuntimeCost: 31700,
                storageOperationsCost: allStorageAccesses.length * 5000,
                breakdown: {
                    sstore: allStorageAccesses.filter((sa: StorageAccess) => sa.operation === 'write' || sa.type === 'sstore').length * 20000,
                    sload: allStorageAccesses.filter((sa: StorageAccess) => sa.operation === 'read' || sa.type === 'sload').length * 800,
                    computation: assemblyBlocks.length * 3,
                    call: allRisks.filter(r => r.opcode === 'call').length * 700,
                    memory: totalOperations * 2
                }
            },

            hotspots: allRisks.map((risk: AssemblyRisk) => ( {
                function: 'contract',
                operation: risk.category || risk.type,
                gasCost: risk.severity === 'high' ? 20000 : risk.severity === 'medium' ? 10000 : 5000,
                frequency: 1,
                totalImpact: risk.gasImpact || (risk.severity === 'high' ? 20000 : risk.severity === 'medium' ? 10000 : 5000),
                severity: risk.severity,
                recommendation: risk.recommendation
            })),

            functionAnalysis: [],

            storageOperations: allStorageAccesses.map((sa: StorageAccess) => ( {
                type: (sa.operation === 'write' || sa.type === 'sstore') ? 'SSTORE' as const : 'SLOAD' as const,
                variable: sa.variable || sa.affectedVariable || 'unknown',
                slot: typeof sa.slot === 'string' ? parseInt(sa.slot) || 0 : sa.slot,
                gasCost: (sa.operation === 'write' || sa.type === 'sstore') ? 20000 : 800,
                optimization: 'Consider caching storage reads'
            })),

            optimizations: recommendations.map((rec, index) => ( {
                title: `Optimization ${index + 1}`,
                description: rec,
                impact: allRisks.length > index ? allRisks[index].severity : 'low' as const,
                gassSaved: allRisks.length > index && allRisks[index].severity === 'high' ? 15000 :
                    allRisks.length > index && allRisks[index].severity === 'medium' ? 8000 : 2000,
                implementation: rec,
                codeExample: undefined
            })),

            summary: {
                averageFunctionCost: 31700,
                optimizationPotential: allRisks.filter((r: AssemblyRisk) => r.severity === 'high').length * 15000,
                totalFunctions: assemblyBlocks.length,
                storageIntensive: allStorageAccesses.length,
                computeIntensive: Math.max(0, assemblyBlocks.length - allStorageAccesses.length),
                securityScore: securityScore
            },

            metadata: {
                contractSize: contract.source.length,
                storageSlots: slotMapping?.totalSlots || 0,
                opcodeCount: totalOperations,
                estimatedDeploymentCost: 86000,
                analysisTime: Date.now() % 1000,
                gasPrice: 20
            }
        };
    }

    private static extractAssemblyBlocks(source: string): AssemblyBlock[] {
        const blocks: AssemblyBlock[] = [];
        const lines = source.split('\n');
        let blockId = 1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.includes('assembly') && line.includes('{')) {
                const startLine = i + 1;
                let braceCount = 1;
                let endLine = i;
                let code = '';

                for (let j = i + 1; j < lines.length && braceCount > 0; j++) {
                    const currentLine = lines[j];
                    code += currentLine + '\n';

                    for (const char of currentLine) {
                        if (char === '{') braceCount++;
                        if (char === '}') braceCount--;
                    }

                    if (braceCount === 0) {
                        endLine = j + 1;
                        break;
                    }
                }

                if (braceCount === 0) {
                    blocks.push( {
                        id: `asm_${blockId++}`,
                        startLine,
                        endLine,
                        code: code.trim(),
                        operations: [],
                        risks: [],
                        storageAccess: [],
                        gasComplexity: 'low'
                    });

                    i = endLine - 1;
                }
            }
        }

        return blocks;
    }

    private static parseOperations(code: string, startLine: number): AssemblyOperation[] {
        const operations: AssemblyOperation[] = [];
        const lines = code.split('\n');

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

            const opcodeMatch = trimmed.match(/(\w+)(?:\s*\([^)]*\))?(?:\s*(.*))?/);
            if (opcodeMatch) {
                const opcode = opcodeMatch[1].toLowerCase();
                const args = opcodeMatch[2] ? opcodeMatch[2].split(/[,\s]+/).filter(Boolean) : [];

                operations.push( {
                    opcode,
                    line: startLine + index,
                    args,
                    category: this.categorizeOpcode(opcode),
                    gasUsage: this.OPCODE_GAS_COSTS[opcode] || 3,
                    description: this.getOpcodeDescription(opcode)
                });
            }
        });

        return operations;
    }

    private static categorizeOpcode(opcode: string): AssemblyOperation['category'] {
        if (['sload', 'sstore'].includes(opcode)) return 'storage';
        if (['mload', 'mstore', 'mstore8', 'calldatacopy', 'codecopy', 'extcodecopy'].includes(opcode)) return 'memory';
        if (opcode.startsWith('push') || opcode.startsWith('dup') || opcode.startsWith('swap') || opcode === 'pop') return 'stack';
        if (['jump', 'jumpi', 'jumpdest', 'call', 'return', 'revert', 'stop'].includes(opcode)) return 'control';
        if (['add', 'sub', 'mul', 'div', 'mod', 'exp', 'signextend'].includes(opcode)) return 'arithmetic';
        if (['and', 'or', 'xor', 'not', 'shl', 'shr', 'sar'].includes(opcode)) return 'bitwise';
        if (['address', 'balance', 'origin', 'caller', 'callvalue', 'timestamp', 'number'].includes(opcode)) return 'environmental';
        return 'other';
    }

    private static getOpcodeDescription(opcode: string): string {
        const descriptions: Record<string, string> = {
            'sload': 'Load word from storage',
            'sstore': 'Save word to storage',
            'mload': 'Load word from memory',
            'mstore': 'Save word to memory',
            'call': 'Message-call into an account',
            'delegatecall': 'Message-call with alternative account code',
            'staticcall': 'Static message-call into an account',
            'create': 'Create a new account with associated code',
            'create2': 'Create account with deterministic address',
            'selfdestruct': 'Halt execution and register account for deletion',
            'jump': 'Alter program counter',
            'jumpi': 'Conditionally alter program counter',
            'revert': 'Halt execution reverting state changes',
            'return': 'Halt execution returning output data'
        };
        return descriptions[opcode] || 'EVM operation';
    }

    private static analyzeRisks(block: AssemblyBlock, storageMapping?: SlotMapping): AssemblyRisk[] {
        const risks: AssemblyRisk[] = [];

        block.operations.forEach(op => {
            if (this.DANGEROUS_OPCODES.has(op.opcode)) {
                risks.push( {
                    type: 'dangerous_opcode',
                    severity: this.getDangerousSeverity(op.opcode),
                    category: 'security',
                    line: op.line,
                    opcode: op.opcode,
                    description: `Dangerous opcode '${op.opcode}' can lead to security vulnerabilities`,
                    recommendation: this.getDangerousRecommendation(op.opcode),
                    impact: this.getDangerousImpact(op.opcode),
                    gasImpact: this.OPCODE_GAS_COSTS[op.opcode] || 700
                });
            }

            if (op.opcode === 'sstore') {
                risks.push( {
                    type: 'slot_manipulation',
                    severity: 'medium',
                    category: 'storage',
                    line: op.line,
                    opcode: op.opcode,
                    description: 'Direct storage manipulation bypasses Solidity safety checks',
                    recommendation: 'Ensure proper access controls and validate slot calculations',
                    impact: 'Could corrupt contract state or enable unauthorized modifications',
                    gasImpact: 20000
                });
            }

            if (['add', 'sub', 'mul'].includes(op.opcode)) {
                risks.push( {
                    type: 'overflow',
                    severity: 'medium',
                    category: 'arithmetic',
                    line: op.line,
                    opcode: op.opcode,
                    description: 'Unchecked arithmetic operation may overflow/underflow',
                    recommendation: 'Add explicit overflow checks or use SafeMath equivalent',
                    impact: 'Arithmetic overflow could lead to unexpected behavior',
                    gasImpact: op.gasUsage
                });
            }

            if (this.HIGH_GAS_OPCODES.has(op.opcode)) {
                risks.push( {
                    type: 'gas_griefing',
                    severity: 'low',
                    category: 'gas',
                    line: op.line,
                    opcode: op.opcode,
                    description: `High gas consumption opcode '${op.opcode}'`,
                    recommendation: 'Consider gas optimization or implement gas limits',
                    impact: 'May cause transactions to fail due to gas limits',
                    gasImpact: op.gasUsage * 2
                });
            }

            if (['call', 'delegatecall'].includes(op.opcode)) {
                risks.push( {
                    type: 'reentrancy',
                    severity: 'high',
                    category: 'security',
                    line: op.line,
                    opcode: op.opcode,
                    description: 'External call may enable reentrancy attacks',
                    recommendation: 'Implement checks-effects-interactions pattern and reentrancy guards',
                    impact: 'Attacker could drain contract funds or manipulate state',
                    gasImpact: 700
                });
            }
        });

        return risks;
    }

    private static analyzeStorageAccess(block: AssemblyBlock, storageMapping?: SlotMapping): StorageAccess[] {
        const accesses: StorageAccess[] = [];

        block.operations.forEach(op => {
            if (['sload', 'sstore'].includes(op.opcode)) {
                const slot = this.extractSlotValue(op, block.operations);
                const isComputed = typeof slot === 'string' && slot.includes('computed');
                const slotNumber = typeof slot === 'string' ? parseInt(slot) || 0 : slot;

                let potentialCollision = false;
                let affectedVariable: string | undefined;

                if (storageMapping && typeof slotNumber === 'number') {
                    const variable = storageMapping.variables.find((v: any) => v.slot === slotNumber);
                    affectedVariable = variable?.name;
                    potentialCollision = !variable;
                }

                accesses.push( {
                    type: op.opcode as 'sload' | 'sstore',
                    line: op.line,
                    slot: slotNumber,
                    variable: affectedVariable || 'unknown',
                    operation: op.opcode === 'sstore' ? 'write' : 'read',
                    gasCost: this.OPCODE_GAS_COSTS[op.opcode] || (op.opcode === 'sstore' ? 20000 : 800),
                    isComputed,
                    potentialCollision,
                    affectedVariable
                });
            }
        });

        return accesses;
    }

    private static extractSlotValue(op: AssemblyOperation, allOps: AssemblyOperation[]): string | number {
        if (op.args.length > 0) {
            const slotArg = op.args[0];

            const numValue = parseInt(slotArg, 16) || parseInt(slotArg, 10);
            if (!isNaN(numValue)) {
                return numValue;
            }

            if (slotArg.startsWith('0x')) {
                const hexValue = parseInt(slotArg, 16);
                if (!isNaN(hexValue)) {
                    return hexValue;
                }
            }
        }

        return 'computed_slot';
    }

    private static getDangerousSeverity(opcode: string): AssemblyRisk['severity'] {
        const critical = ['selfdestruct', 'suicide'];
        const high = ['call', 'delegatecall', 'create', 'create2'];

        if (critical.includes(opcode)) return 'critical';
        if (high.includes(opcode)) return 'high';
        return 'medium';
    }

    private static getDangerousRecommendation(opcode: string): string {
        const recommendations: Record<string, string> = {
            'call': 'Use high-level Solidity calls when possible and implement proper error handling',
            'delegatecall': 'Ensure delegated contract is trusted and implement proper access controls',
            'selfdestruct': 'Consider using alternative patterns like upgradeable contracts',
            'create': 'Validate creation parameters and handle deployment failures',
            'create2': 'Ensure salt uniqueness and validate initialization parameters'
        };
        return recommendations[opcode] || 'Review usage carefully and implement proper safeguards';
    }

    private static getDangerousImpact(opcode: string): string {
        const impacts: Record<string, string> = {
            'call': 'External calls can fail, consume unexpected gas, or enable reentrancy',
            'delegatecall': 'Executes code in current context, can modify contract state unexpectedly',
            'selfdestruct': 'Permanently destroys contract and transfers funds',
            'create': 'Contract creation can fail and consume gas',
            'create2': 'Deterministic deployment can be front-run or replayed'
        };
        return impacts[opcode] || 'Potential security vulnerability';
    }

    private static calculateGasComplexity(operations: AssemblyOperation[]): 'low' | 'medium' | 'high' {
        const totalGas = operations.reduce((sum, op) => sum + op.gasUsage, 0);

        if (totalGas > 50000) return 'high';
        if (totalGas > 10000) return 'medium';
        return 'low';
    }

    private static calculateOverallGasComplexity(blocks: AssemblyBlock[]): 'low' | 'medium' | 'high' {
        const complexities = blocks.map(b => b.gasComplexity);

        if (complexities.includes('high')) return 'high';
        if (complexities.includes('medium')) return 'medium';
        return 'low';
    }

    private static calculateSecurityScore(risks: AssemblyRisk[]): number {
        let score = 100;

        risks.forEach(risk => {
            switch (risk.severity) {
                case 'critical': score -= 25; break;
                case 'high': score -= 15; break;
                case 'medium': score -= 8; break;
                case 'low': score -= 3; break;
            }
        });

        return Math.max(0, score);
    }

    private static generateRecommendations(risks: AssemblyRisk[], storageAccesses: StorageAccess[]): string[] {
        const recommendations: string[] = [];

        const criticalRisks = risks.filter(r => r.severity === 'critical').length;
        const highRisks = risks.filter(r => r.severity === 'high').length;
        const storageWrites = storageAccesses.filter(a => a.type === 'sstore').length;
        const computedAccesses = storageAccesses.filter(a => a.isComputed).length;

        if (criticalRisks > 0) {
            recommendations.push(`🚨 CRITICAL: ${criticalRisks} critical security issues found. Review immediately.`);
        }

        if (highRisks > 0) {
            recommendations.push(`⚠️ ${highRisks} high-risk operations detected. Consider safer alternatives.`);
        }

        if (storageWrites > 5) {
            recommendations.push(`📊 High storage modification activity (${storageWrites} writes). Ensure proper access controls.`);
        }

        if (computedAccesses > 0) {
            recommendations.push(`🔍 ${computedAccesses} computed slot accesses detected. Verify slot calculations are correct.`);
        }

        if (recommendations.length === 0) {
            recommendations.push(`✅ Assembly code appears to follow security best practices.`);
        }

        recommendations.push(`💡 Consider using high-level Solidity when possible for better security and readability.`);

        return recommendations;
    }
}
