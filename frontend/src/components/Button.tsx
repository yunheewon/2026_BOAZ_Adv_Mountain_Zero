import type { ButtonHTMLAttributes } from 'react'
import './components.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Figma "Component / Button · Primary" / "· Outline" */
  variant?: 'primary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'outline', size = 'md', className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={`fs-btn fs-btn--${variant} fs-btn--${size} ${className}`} {...rest} />
}
