import { ContractAST, StateVariable } from '../parser/types';
import { SlotMapping } from '../../types/slot-mapping';

export interface DetectorResult {
  id: string;
  title: string;
  category: 'storage' | 'upgrade' | 'gas' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  recommendation: string;
  location: string;
  affectedVariables: string[];
  gasImpact?: number;
  codeExample?: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface DetectorOptions {
  includeGasEstimates?: boolean;
  strictMode?: boolean;
  targetSolidityVersion?: string;
}

export abstract class BaseStorageDetector {
  abstract readonly id: string;
  abstract readonly title: string;
  abstract readonly category: 'storage' | 'upgrade' | 'gas' | 'security';
  abstract readonly severity: 'low' | 'medium' | 'high' | 'critical';

  abstract detect(
    contract: ContractAST,
    slotMapping: SlotMapping,
    options?: DetectorOptions
  ): DetectorResult[];

  protected createResult(
    description: string,
    impact: string,
    recommendation: string,
    location: string,
    affectedVariables: string[],
    options?: {
      gasImpact?: number;
      codeExample?: string;
      confidence?: 'low' | 'medium' | 'high';
    }
  ): DetectorResult {
    return {
      id: this.id,
      title: this.title,
      category: this.category,
      severity: this.severity,
      description,
      impact,
      recommendation,
      location,
      affectedVariables,
      gasImpact: options?.gasImpact,
      codeExample: options?.codeExample,
      confidence: options?.confidence || 'medium'
    };
  }
}
