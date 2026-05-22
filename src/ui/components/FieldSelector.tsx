import { SearchableSelect } from './SearchableSelect'

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
}

export function FieldSelector({ label, options, value, onChange, required, disabled, highlight }: Props) {
  return (
    <SearchableSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      {...(required !== undefined && { required })}
      {...(disabled !== undefined && { disabled })}
      {...(highlight !== undefined && { highlight })}
    />
  )
}
