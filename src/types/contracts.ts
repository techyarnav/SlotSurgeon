export interface ContractInfo {
  name: string;
  filePath: string;
  sourceCode: string;
  compilationTarget?: string;
}

export interface InheritanceChain {
  contract: string;
  parents: string[];
  linearization: string[];
}

export interface SolidityType {
  type: string;
  size: number;
  alignment: number;
  isDynamic: boolean;
  isMapping: boolean;
  isArray: boolean;
}
