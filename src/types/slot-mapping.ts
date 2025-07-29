export interface StorageVariable {
  name: string;
  type: string;
  slot: number;
  offset: number;
  size: number;
  packed?: boolean;
  isStateVariable: boolean;
}

export interface SlotMapping {
  contractName: string;
  variables: StorageVariable[];
  totalSlots: number;
  packedSlots: number[];
}

export interface SlotLayout {
  slot: number;
  variables: StorageVariable[];
  utilization: number;
}

export interface ParsedContract {
  name: string;
  filePath: string;
  variables: StorageVariable[];
  inherits: string[];
}

export interface SlotLayout {
  slot: number;
  variables: StorageVariable[];
  utilization: number;
}
