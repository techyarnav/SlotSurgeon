export interface ContractAST {
  name: string;
  source: string;
  functions: Function[];
  events: Event[];
  variables: Variable[];
  inheritance: string[];
  filePath?: string;
}

export interface Function {
  name: string;
  visibility: 'public' | 'private' | 'internal' | 'external';
  mutability: 'pure' | 'view' | 'payable' | 'nonpayable';
  parameters: Parameter[];
  returns: Parameter[];
  modifiers: string[];
}

export interface Event {
  name: string;
  parameters: Parameter[];
  anonymous: boolean;
}

export interface Variable {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'internal';
  mutability: 'constant' | 'immutable' | 'mutable';
  value?: string;
}

export interface Parameter {
  name: string;
  type: string;
  indexed?: boolean;
}
