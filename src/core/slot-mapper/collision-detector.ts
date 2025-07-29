import { SlotMapping, StorageVariable } from '../../types/slot-mapping';
import { SlotCalculator } from './slot-calculator';

export interface Collision {
  slot: number;
  range: [number, number];
  v1: StorageVariable;
  v2: StorageVariable;
  reason: string;
}

export interface CollisionReport {
  contract: string;
  collisions: Collision[];
  moved: StorageVariable[];
  added: StorageVariable[];
  removed: StorageVariable[];
  safe: boolean;
}


export interface StorageCollision {
  id: string;
  type: 'variable_overlap' | 'inheritance_conflict' | 'proxy_collision' | 'layout_mismatch';
  severity: 'low' | 'medium' | 'high' | 'critical';
  slot: number;
  variables: CollisionVariable[];
  description: string;
  impact: string;
  recommendation: string;
  gasImpact?: number;
}

export interface CollisionVariable {
  name: string;
  type: string;
  contract?: string;
  size: number;
  offset: number;
}

export class CollisionDetector {


  static compare(v1: SlotMapping, v2: SlotMapping): CollisionReport {
    const collisions: Collision[] = [];


    const byKey = (v: StorageVariable) => `${v.name}|${v.type}`;
    const keys1 = new Map(v1.variables.map(v => [byKey(v), v]));
    const keys2 = new Map(v2.variables.map(v => [byKey(v), v]));

    const moved: StorageVariable[] = [];
    const removed: StorageVariable[] = [];
    const added: StorageVariable[] = [];


    for (const [k, var1] of keys1) {
      if (!keys2.has(k)) {
        removed.push(var1);
      } else {
        const var2 = keys2.get(k)!;
        if (var2.slot !== var1.slot || var2.offset !== var1.offset) {
          moved.push(var2);
        }
      }
    }


    for (const [k, var2] of keys2) {
      if (!keys1.has(k)) {
        added.push(var2);
      }
    }


    const occ1 = this.occupancy(v1);
    const occ2 = this.occupancy(v2);

    const slots = new Set<number>([
      ...Object.keys(occ1).map(Number),
      ...Object.keys(occ2).map(Number),
    ]);


    const movedKeys = new Set(moved.map(v => `${v.name}|${v.type}`));

    for (const slot of slots) {
      const list1 = occ1[slot] ?? [];
      const list2 = occ2[slot] ?? [];

      for (const a of list1) {
        for (const b of list2) {

          const keyA = `${a.name}|${a.type}`;
          const keyB = `${b.name}|${b.type}`;

          if (movedKeys.has(keyA) || movedKeys.has(keyB)) {
            continue;
          }


          const aStart = a.offset;
          const aEnd = a.offset + a.size;
          const bStart = b.offset;
          const bEnd = b.offset + b.size;

          const hasOverlap = aStart < bEnd && bStart < aEnd;

          if (hasOverlap) {
            const sameName = a.name === b.name;
            const sameType = a.type === b.type;


            if (!sameName || !sameType) {
              collisions.push( {
                slot,
                range: [
                  Math.max(aStart, bStart),
                  Math.min(aEnd - 1, bEnd - 1),
                ],
                v1: a,
                v2: b,
                reason: !sameName
                  ? `different variables occupy same bytes (${a.name} vs ${b.name})`
                  : `same variable has different type (${a.type} vs ${b.type})`,
              });
            }
          }
        }
      }
    }


    const unsafe = moved.length > 0 || collisions.length > 0;

    return {
      contract: v1.contractName,
      collisions,
      moved,
      added,
      removed,
      safe: !unsafe,
    };
  }


  detect(slotMapping: SlotMapping): StorageCollision[] {
    const collisions: StorageCollision[] = [];
    const slotGroups = this.groupVariablesBySlot(slotMapping.variables);

    for (const [slot, variables] of slotGroups) {
      if (variables.length > 1) {
        const collision = this.analyzeSlotCollision(slot, variables);
        if (collision) {
          collisions.push(collision);
        }
      }
    }

    return collisions;
  }


  public detectCollisions(contracts: any[]): StorageCollision[] {
    const allCollisions: StorageCollision[] = [];

    for (const contract of contracts) {
      try {

        const slotMapping = SlotCalculator.calculateSlots(contract);


        const contractCollisions = this.detect(slotMapping);


        contractCollisions.forEach((collision: StorageCollision) => {
          allCollisions.push( {
            ...collision,
            description: `Storage collision in ${contract.name}: ${collision.description}`
          });
        });
      } catch (error) {

        console.warn(`Warning: Could not analyze contract ${contract.name} for collisions`);
      }
    }

    return allCollisions;
  }


  private groupVariablesBySlot(variables: StorageVariable[]): Map<number, StorageVariable[]> {
    const groups = new Map<number, StorageVariable[]>();

    for (const variable of variables) {
      if (!groups.has(variable.slot)) {
        groups.set(variable.slot, []);
      }
      groups.get(variable.slot)!.push(variable);
    }

    return groups;
  }

  private analyzeSlotCollision(slot: number, variables: StorageVariable[]): StorageCollision | null {
    if (variables.length <= 1) return null;

    const totalSize = variables.reduce((sum, v) => sum + v.size, 0);
    const hasOverlap = totalSize > 32;

    if (!hasOverlap) return null;

    const severity = this.calculateSeverity(variables, totalSize);
    const collisionVars: CollisionVariable[] = variables.map(v => ( {
      name: v.name,
      type: v.type,
      size: v.size,
      offset: v.offset
    }));

    return {
      id: `collision_slot_${slot}`,
      type: 'variable_overlap',
      severity,
      slot,
      variables: collisionVars,
      description: `Multiple variables overlap in slot ${slot}`,
      impact: this.getImpactDescription(severity),
      recommendation: this.getRecommendation(variables),
      gasImpact: this.estimateGasImpact(variables)
    };
  }

  private calculateSeverity(variables: StorageVariable[], totalSize: number): 'low' | 'medium' | 'high' | 'critical' {
    if (totalSize > 64) return 'critical';
    if (totalSize > 48) return 'high';
    if (variables.length > 3) return 'medium';
    return 'low';
  }

  private getImpactDescription(severity: string): string {
    switch (severity) {
      case 'critical': return 'Critical storage corruption risk';
      case 'high': return 'High risk of data corruption';
      case 'medium': return 'Potential storage conflicts';
      case 'low': return 'Minor storage inefficiency';
      default: return 'Storage layout issue';
    }
  }

  private getRecommendation(variables: StorageVariable[]): string {
    return `Reorganize variables to prevent slot overlap. Consider using smaller data types or packing variables efficiently.`;
  }

  private estimateGasImpact(variables: StorageVariable[]): number {
    return variables.length * 20000;
  }


  private static occupancy(mapping: SlotMapping): {
    [slot: number]: StorageVariable[];
  } {
    const occ: { [slot: number]: StorageVariable[] } = {};
    for (const v of mapping.variables) {
      if (!occ[v.slot]) {
        occ[v.slot] = [];
      }
      occ[v.slot].push(v);
    }
    return occ;
  }
}
