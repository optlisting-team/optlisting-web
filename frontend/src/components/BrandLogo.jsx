import { Link } from 'react-router-dom'

const sizeStyles = {
  sm: { icon: 'w-8 h-8', text: 'text-lg' },
  md: { icon: 'w-10 h-10', text: 'text-xl' },
  lg: { icon: 'w-12 h-12', text: 'text-2xl' },
}

function BrandLogo({ size = 'md', tone = 'light', to, className = '', showWordmark = true }) {
  const styles = sizeStyles[size] || sizeStyles.md
  const wordmarkColor = tone === 'dark' ? 'text-brand-navy' : 'text-white'
  const content = (
    <>
      <img src="/brand/optlisting-app-icon.jpg" alt="" aria-hidden="true" className={`${styles.icon} shrink-0 rounded-[22%]`} />
      {showWordmark && (
        <span className={`${styles.text} ${wordmarkColor} font-bold tracking-[-0.035em] leading-none`}>
          Optlisting
        </span>
      )}
    </>
  )
  const sharedClassName = `inline-flex items-center gap-2.5 ${className}`

  if (to) {
    return <Link to={to} className={sharedClassName} aria-label="Optlisting home">{content}</Link>
  }

  return <div className={sharedClassName} aria-label="Optlisting">{content}</div>
}

export default BrandLogo
