import { SearchableSelect } from './SearchableSelect'
import React from 'react'

interface Option {
  id: string
  label: string
}

interface Props {
  label: string
  options: Option[]
  value: string | undefined
  onChange: (id: string) => void
  required?: boolean
  disabled?: boolean
  highlight?: boolean
  renderSuffix?: (option: Option) => React.ReactNode
  groupSeparatorAfter?: string
}

export function FieldSelector({ label, options, value, onChange, required, disabled, highlight, renderSuffix, groupSeparatorAfter }: Props) {
  return (
    <SearchableSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      {...(required !== undefined && { required })}
      {...(disabled !== undefined && { disabled })}
      {...(highlight !== undefined && { highlight })}
      {...(renderSuffix !== undefined && { renderSuffix })}
      {...(groupSeparatorAfter !== undefined && { groupSeparatorAfter })}
    />
  )
}
