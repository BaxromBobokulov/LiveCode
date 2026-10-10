import type { SelectHTMLAttributes } from 'react'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string; disabled?: boolean }[]
}

function Select({ options, className = '', ...props }: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        className="h-9 w-full appearance-none rounded-control border border-borderStrong bg-panel pr-9 pl-3.5 text-body-sm text-text focus-visible:outline-2 focus-visible:outline-accent"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-text"
      >
        <path
          d="M2.5 4.5 6 8l3.5-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export default Select
