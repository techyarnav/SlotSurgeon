import { StorageVariable } from './slot-mapping';

export interface HeatmapSlot {
  slot: number;
  utilization: number;
  efficiency: number;
  variables: StorageVariable[];
  isPacked: boolean;
}

export interface HeatmapData {
  slots: HeatmapSlot[];
  maxUtilization: number;
  colors: string[];
}

export interface HeatmapConfig {
  colorScheme: string;
  showEfficiency: boolean;
  showWaste: boolean;
  interactive: boolean;
}

export interface VisualizationMetrics {
  totalSlots: number;
  usedSlots: number;
  wastedBytes: number;
  efficiency: number;
  packedSlots: number;
  largestWaste: {
    slot: number;
    bytes: number;
  };
}
