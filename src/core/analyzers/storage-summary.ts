import { SlotMapping } from '../../types/slot-mapping';

export interface StorageSummary {
  totalVariables: number;
  totalSlots: number;
  totalSize: number;
  efficiency: number;
  estimatedGasCost: number;
  utilizationBySlot: SlotUtilization[];
  packingOpportunities: PackingOpportunity[];
}

export interface SlotUtilization {
  slot: number;
  usedBytes: number;
  availableBytes: number;
  utilizationPercent: number;
  variables: string[];
}

export interface PackingOpportunity {
  slot: number;
  currentVariables: string[];
  suggestedPacking: string[];
  gasSavings: number;
}

export class StorageSummaryGenerator {
  static generate(slotMapping: SlotMapping): StorageSummary {
    const totalVariables = slotMapping.variables.length;
    const totalSlots = slotMapping.variables.length > 0
      ? Math.max(...slotMapping.variables.map(v => v.slot)) + 1
      : 0;
    const totalSize = slotMapping.variables.reduce((sum, v) => sum + v.size, 0);
    const efficiency = totalSlots > 0 ? (totalSize / (totalSlots * 32)) * 100 : 0;
    const estimatedGasCost = totalSlots * 20000;


    const utilizationBySlot = this.calculateSlotUtilization(slotMapping);


    const packingOpportunities = this.findPackingOpportunities(slotMapping);

    return {
      totalVariables,
      totalSlots,
      totalSize,
      efficiency,
      estimatedGasCost,
      utilizationBySlot,
      packingOpportunities
    };
  }

  private static calculateSlotUtilization(slotMapping: SlotMapping): SlotUtilization[] {
    const slotGroups = new Map<number, any[]>();

    slotMapping.variables.forEach(v => {
      if (!slotGroups.has(v.slot)) {
        slotGroups.set(v.slot, []);
      }
      slotGroups.get(v.slot)!.push(v);
    });

    const utilizations: SlotUtilization[] = [];

    slotGroups.forEach((vars, slot) => {
      const usedBytes = vars.reduce((sum, v) => sum + v.size, 0);
      const availableBytes = 32 - usedBytes;
      const utilizationPercent = (usedBytes / 32) * 100;
      const variables = vars.map(v => v.name);

      utilizations.push( {
        slot,
        usedBytes,
        availableBytes,
        utilizationPercent,
        variables
      });
    });

    return utilizations.sort((a, b) => a.slot - b.slot);
  }

  private static findPackingOpportunities(slotMapping: SlotMapping): PackingOpportunity[] {
    const opportunities: PackingOpportunity[] = [];

    const utilizations = this.calculateSlotUtilization(slotMapping);

    utilizations.forEach(util => {
      if (util.utilizationPercent < 75 && util.availableBytes >= 4) {
        const smallVars = slotMapping.variables.filter(v =>
          v.size <= util.availableBytes && v.slot !== util.slot
        );

        if (smallVars.length > 0) {
          opportunities.push( {
            slot: util.slot,
            currentVariables: util.variables,
            suggestedPacking: [...util.variables, ...smallVars.slice(0, 2).map(v => v.name)],
            gasSavings: Math.min(smallVars.length, 2) * 5000
          });
        }
      }
    });

    return opportunities;
  }
}
