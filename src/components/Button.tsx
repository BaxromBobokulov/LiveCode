import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

const variantClasses = {
  primary: 'bg-accent text-white enabled:hover:bg-accentHover',
  secondary: 'border border-borderStrong bg-panel text-text enabled:hover:bg-surface',
}

function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`h-9 rounded-control px-3.5 text-body-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  )
}

export default Button
