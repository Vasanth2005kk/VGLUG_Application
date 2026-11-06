// A wavy edge between sections. It takes its colour from the CSS `color` of `.wave`.
export default function Wave({ flip, className = '' }) {
  return (
    <svg className={`wave${flip ? ' wave-flip' : ''} ${className}`.trim()} viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 42 C 240 8, 480 8, 760 30 S 1240 52, 1440 16 L1440 60 L0 60 Z" />
    </svg>
  )
}
