import type { CSSProperties } from 'react'

type BrandLogoProps = {
  variant?: 'icon' | 'full'
  size?: number
  alt?: string
}

const logoSource = '/branding/worship-guitar-logo.png'

export function BrandLogo({ variant = 'icon', size = 36, alt = 'Worship Guitar' }: BrandLogoProps) {
  return (
    <span className={`brand-logo brand-logo-${variant}`} style={{ '--brand-logo-size': `${size}px` } as CSSProperties}>
      <img src={logoSource} alt={alt} aria-hidden={alt === ''} />
      {variant === 'full' && <span>Worship<b>Guitar</b></span>}
    </span>
  )
}