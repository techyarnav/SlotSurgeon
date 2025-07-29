import { OutputFormatter } from '../../src/utils/formatters'
import { SlotMapping } from '../../src/types/slot-mapping'

describe('OutputFormatter', () => {


  const mockSlotMapping: SlotMapping = {
    contractName: 'TestContract',
    variables: [
 {
        name: 'value',
        type: 'uint256',
        slot: 0,
        offset: 0,
        size: 32,
        isStateVariable: true,
        packed: false
      },
 {
        name: 'owner',
        type: 'address',
        slot: 1,
        offset: 0,
        size: 20,
        isStateVariable: true,
        packed: false
      },
 {
        name: 'isActive',
        type: 'bool',
        slot: 1,
        offset: 20,
        size: 1,
        isStateVariable: true,
        packed: true
      }
    ],
    totalSlots: 2,
    packedSlots: [1]
  }

  describe('color formatting', () => {
    it('should format success messages', () => {
      const result = OutputFormatter.formatSuccess('Test message')
      expect(result).toContain('Test message')
    })

    it('should format error messages', () => {
      const result = OutputFormatter.formatError('Error message')
      expect(result).toContain('Error message')
    })

    it('should format warning messages', () => {
      const result = OutputFormatter.formatWarning('Warning message')
      expect(result).toContain('Warning message')
    })

    it('should format info messages', () => {
      const result = OutputFormatter.formatInfo('Info message')
      expect(result).toContain('Info message')
    })
  })

  describe('slot mapping formatting', () => {
    it('should format slot mapping as table', () => {
      const result = OutputFormatter.formatSlotMapping(mockSlotMapping)

      expect(result).toContain('value')
      expect(result).toContain('owner')
      expect(result).toContain('isActive')

    })

    it('should handle empty slot mapping', () => {
      const emptyMapping: SlotMapping = {
        contractName: 'Empty',
        variables: [],
        totalSlots: 0,

        packedSlots: []

      }

      const result = OutputFormatter.formatSlotMapping(emptyMapping)

      expect(result).toContain('No storage variables found')

      expect(result).toContain('No storage variables')
    })
  })
})
