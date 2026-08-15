import { Plus, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import type {
  PluginConfigValue,
  SchemaMappingTableColumn,
  SchemaMappingTableOption,
} from '@/shared/types'
import type { FieldProps } from './types'

interface MappingTableFieldProps extends FieldProps<PluginConfigValue[]> {
  readonly option: SchemaMappingTableOption
}

type MappingTableRow = Record<string, PluginConfigValue>
const objectHasOwnProperty = Object.prototype.hasOwnProperty

function getColumnFallbackValue(column: SchemaMappingTableColumn): string {
  if (column.default !== undefined) {
    return column.default
  }

  if (column.type === 'select') {
    return column.options[0]?.value ?? ''
  }

  return ''
}

function getOwnMappedAutoFillValue(
  values: Readonly<Record<string, string>>,
  sourceValue: string,
): string | undefined {
  if (!objectHasOwnProperty.call(values, sourceValue)) {
    return undefined
  }

  const mappedValue = values[sourceValue]
  return typeof mappedValue === 'string' ? mappedValue : undefined
}

function applyAutoFillForTargetColumn(
  currentRow: MappingTableRow,
  sourceSnapshot: MappingTableRow,
  targetColumn: SchemaMappingTableColumn,
): MappingTableRow {
  const autoFill = targetColumn.autoFill
  if (autoFill?.kind !== 'value-by-column') {
    return currentRow
  }

  const sourceValue = sourceSnapshot[autoFill.sourceColumn]
  if (typeof sourceValue !== 'string') {
    return currentRow
  }

  const nextRow: MappingTableRow = { ...currentRow }
  const mappedValue = getOwnMappedAutoFillValue(autoFill.values, sourceValue)
  if (mappedValue !== undefined) {
    nextRow[targetColumn.key] = mappedValue
    return nextRow
  }

  if (autoFill.fallback === 'empty') {
    nextRow[targetColumn.key] = ''
  }

  if (autoFill.fallback === 'column-default') {
    nextRow[targetColumn.key] = getColumnFallbackValue(targetColumn)
  }

  return nextRow
}

function applyAutoFillForChangedColumn(
  option: SchemaMappingTableOption,
  row: MappingTableRow,
  changedColumnKey: string,
): MappingTableRow {
  const sourceSnapshot: MappingTableRow = { ...row }
  let nextRow: MappingTableRow = { ...row }

  for (const targetColumn of option.columns) {
    const autoFill = targetColumn.autoFill
    if (autoFill?.kind !== 'value-by-column') {
      continue
    }
    if (autoFill.sourceColumn !== changedColumnKey) {
      continue
    }

    nextRow = applyAutoFillForTargetColumn(
      nextRow,
      sourceSnapshot,
      targetColumn,
    )
  }

  return nextRow
}

function applyAutoFillForInitialRow(
  option: SchemaMappingTableOption,
  baseRow: MappingTableRow,
): MappingTableRow {
  const sourceSnapshot: MappingTableRow = { ...baseRow }
  let nextRow: MappingTableRow = { ...baseRow }

  for (const targetColumn of option.columns) {
    if (targetColumn.autoFill?.kind !== 'value-by-column') {
      continue
    }

    nextRow = applyAutoFillForTargetColumn(
      nextRow,
      sourceSnapshot,
      targetColumn,
    )
  }

  return nextRow
}

function createDefaultRow(option: SchemaMappingTableOption): MappingTableRow {
  const row: MappingTableRow = {}
  for (const column of option.columns) {
    row[column.key] = getColumnFallbackValue(column)
  }

  return applyAutoFillForInitialRow(option, row)
}

function getStringCellValue(row: PluginConfigValue, key: string): string {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    return ''
  }
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

export function MappingTableField({
  option,
  value,
  onChange,
  disabled,
}: MappingTableFieldProps): React.JSX.Element {
  const rows = Array.isArray(value) ? value : []

  const updateRow = (
    rowIndex: number,
    columnKey: string,
    nextValue: string,
  ): void => {
    const nextRows = rows.map((row, index) => {
      if (index !== rowIndex) {
        return row
      }

      const currentRow =
        typeof row === 'object' && row !== null && !Array.isArray(row)
          ? row
          : {}
      const nextRow: MappingTableRow = {
        ...currentRow,
        [columnKey]: nextValue,
      }

      return applyAutoFillForChangedColumn(
        option,
        nextRow,
        columnKey,
      ) as PluginConfigValue
    })
    onChange(nextRows)
  }

  return (
    <div className="space-y-2">
      {rows.map((row, rowIndex) => (
        <div
          key={`${option.key}-${rowIndex}`}
          className="grid grid-cols-[1fr_1fr_auto] gap-2"
        >
          {option.columns.map((column) =>
            column.type === 'select' ? (
              <Select
                key={column.key}
                value={getStringCellValue(row, column.key)}
                onValueChange={(nextValue) =>
                  updateRow(rowIndex, column.key, nextValue)
                }
                disabled={disabled === true}
              >
                <SelectTrigger>
                  <SelectValue placeholder={column.label} />
                </SelectTrigger>
                <SelectContent>
                  {column.options.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                key={column.key}
                value={getStringCellValue(row, column.key)}
                onChange={(event) =>
                  updateRow(rowIndex, column.key, event.target.value)
                }
                disabled={disabled}
                placeholder={column.label}
              />
            ),
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              onChange(rows.filter((_, index) => index !== rowIndex))
            }
            disabled={disabled === true}
            aria-label="Remove row"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, createDefaultRow(option)])}
        disabled={disabled === true}
      >
        <Plus className="mr-1 h-4 w-4" />
        Add row
      </Button>
    </div>
  )
}
