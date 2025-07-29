export interface StateVariable {
  name: string;
  typeName: string;
  visibility: 'public' | 'private' | 'internal' | 'external';
  isConstant: boolean;
  isImmutable: boolean;
  initialValue?: string;
}

export interface Function {
  name: string;
  visibility: 'public' | 'private' | 'internal' | 'external';
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
  parameters: Parameter[];
  returnParameters: Parameter[];
}

export interface Event {
  name: string;
  parameters: Parameter[];
}

export interface Modifier {
  name: string;
  parameters: Parameter[];
}

export interface Parameter {
  name: string;
  type: string;
}

export interface ContractAST {
  name: string;
  baseContracts: string[];
  stateVariables: StateVariable[];
  functions: Function[];
  events: Event[];
  modifiers: Modifier[];
  isAbstract: boolean;
  isInterface: boolean;
  isLibrary: boolean;
  foundryData?: {
    storageLayout?: any;
    abi?: any[];
    bytecode?: any;
    metadata?: any;
  };
}
