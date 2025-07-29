import { ContractAST, StateVariable } from '../../src/core/parser/types';
import { SlotMapping, StorageVariable } from '../../src/types/slot-mapping';
import * as fs from 'fs-extra';
import * as path from 'path';

export class TestHelpers {
  static createMockContract(
    name: string,
    variables: Partial<StateVariable>[] = []
  ): ContractAST {
    return {
      name,

      baseContracts: [],
      stateVariables: variables.map((v, i) => ( {
        name: v.name || `var${i}`,
        typeName: v.typeName || 'uint256',
        visibility: v.visibility || 'public',
        isConstant: v.isConstant || false,
        isImmutable: v.isImmutable || false,
        initialValue: v.initialValue
      })),
      functions: [],
      events: [],
      modifiers: [],
      isAbstract: false,
      isInterface: false,
      isLibrary: false
    };
  }


  static createMockSlotMapping(
    contractName: string,
    variables: Partial<StorageVariable>[] = []
  ): SlotMapping {
    const mappedVariables = variables.map((v, i) => ( {
      name: v.name || `var${i}`,
      type: v.type || 'uint256',
      slot: v.slot || 0,
      offset: v.offset || 0,
      size: v.size || 32,
      isStateVariable: v.isStateVariable !== undefined ? v.isStateVariable : true,
      packed: v.packed || false
    }));

    const totalSlots = mappedVariables.length > 0
      ? Math.max(...mappedVariables.map(v => v.slot)) + 1
      : 0;


    const slotGroups = new Map<number, number>();
    mappedVariables.forEach(variable => {
      slotGroups.set(variable.slot, (slotGroups.get(variable.slot) || 0) + 1);
    });

    const packedSlots = Array.from(slotGroups.entries())
      .filter(([slot, count]) => count > 1)
      .map(([slot]) => slot);

    return {
      contractName,
      variables: mappedVariables,
      totalSlots,
      packedSlots
    };
  }

  static async createTempContract(name: string, content: string): Promise<string> {
    const tempDir = path.join(__dirname, '../temp');
    await fs.ensureDir(tempDir);

    const filePath = path.join(tempDir, `${name}.sol`);
    await fs.writeFile(filePath, content);

    return filePath;
  }

  static stripAnsiColors(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  static expectTableFormat(output: string): void {
    expect(output).toContain('─');
    expect(output).toContain('│');
  }

  static expectSlotInfo(output: string, variable: string): void {
    expect(output).toContain(variable);
    expect(output).toContain('Slot');
  }

  static createTestSuite(suiteName: string, tests: Array<{ name: string; test: () => void | Promise<void> }>) {
    describe(suiteName, () => {
      tests.forEach(({ name, test }) => {
        it(name, test);
      });
    });
  }


  static createInheritanceContract(
    baseName: string,
    childName: string,
    baseVars: Partial<StateVariable>[] = [],
    childVars: Partial<StateVariable>[] = []
  ): { base: ContractAST; child: ContractAST } {
    const base = this.createMockContract(baseName, baseVars);
    const child = {
      ...this.createMockContract(childName, childVars),
      baseContracts: [baseName]
    };

    return { base, child };
  }

  static createUpgradeScenario(
    contractName: string,
    v1Variables: Partial<StateVariable>[],
    v2Variables: Partial<StateVariable>[]
  ): { v1: ContractAST; v2: ContractAST } {
    return {
      v1: this.createMockContract(`${contractName}V1`, v1Variables),
      v2: this.createMockContract(`${contractName}V2`, v2Variables)
    };
  }

  static async cleanupTempFiles(): Promise<void> {
    const tempDir = path.join(__dirname, '../temp');
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  }

  static mockConsoleOutput() {
    const originalConsole = { ...console };
    const mockFunctions = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    };

    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(mockFunctions.log);
      jest.spyOn(console, 'error').mockImplementation(mockFunctions.error);
      jest.spyOn(console, 'warn').mockImplementation(mockFunctions.warn);
      jest.spyOn(console, 'info').mockImplementation(mockFunctions.info);
    });

    afterEach(() => {
      Object.assign(console, originalConsole);
      jest.restoreAllMocks();
    });

    return mockFunctions;
  }


  static validateSlotMapping(mapping: SlotMapping): boolean {
    if (!mapping.contractName || typeof mapping.contractName !== 'string') return false;
    if (!Array.isArray(mapping.variables)) return false;
    if (typeof mapping.totalSlots !== 'number') return false;
    if (typeof mapping.packedSlots !== 'number') return false;

    return mapping.variables.every(variable =>
      typeof variable.name === 'string' &&
      typeof variable.type === 'string' &&
      typeof variable.slot === 'number' &&
      typeof variable.offset === 'number' &&
      typeof variable.size === 'number' &&
      typeof variable.isStateVariable === 'boolean'
    );
  }

  static validateContractAST(contract: ContractAST): boolean {
    if (!contract.name || typeof contract.name !== 'string') return false;
    if (!Array.isArray(contract.baseContracts)) return false;
    if (!Array.isArray(contract.stateVariables)) return false;
    if (!Array.isArray(contract.functions)) return false;
    if (!Array.isArray(contract.events)) return false;
    if (!Array.isArray(contract.modifiers)) return false;
    if (typeof contract.isAbstract !== 'boolean') return false;
    if (typeof contract.isInterface !== 'boolean') return false;
    if (typeof contract.isLibrary !== 'boolean') return false;

    return true;
  }


  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
    const start = Date.now();
    const result = await fn();
    const time = Date.now() - start;
    return { result, time };
  }

  static expectExecutionTimeBelow(actualTime: number, maxTime: number): void {
    expect(actualTime).toBeLessThan(maxTime);
  }
}


export const mockConsole = () => {
  const originalConsole = { ...console };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
  });
};


export const TEST_CONTRACTS = {
  SIMPLE: {
    name: 'SimpleTest',
    variables: [
      { name: 'value', typeName: 'uint256' },
      { name: 'owner', typeName: 'address' }
    ]
  },
  COMPLEX: {
    name: 'ComplexTest',
    variables: [
      { name: 'packed1', typeName: 'uint128' },
      { name: 'packed2', typeName: 'uint128' },
      { name: 'owner', typeName: 'address' },
      { name: 'isActive', typeName: 'bool' },
      { name: 'data', typeName: 'bytes32' }
    ]
  }
};

export const UPGRADE_SCENARIOS = {
  SAFE: {
    v1: [
      { name: 'owner', typeName: 'address' },
      { name: 'value', typeName: 'uint256' }
    ],
    v2: [
      { name: 'owner', typeName: 'address' },
      { name: 'value', typeName: 'uint256' },
      { name: 'newFeature', typeName: 'uint256' }
    ]
  },
  UNSAFE: {
    v1: [
      { name: 'owner', typeName: 'address' },
      { name: 'value', typeName: 'uint256' }
    ],
    v2: [
      { name: 'value', typeName: 'uint256' },
      { name: 'owner', typeName: 'address' }
    ]
  }
};
