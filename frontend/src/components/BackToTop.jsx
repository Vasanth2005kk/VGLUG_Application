import { useEffect, useState } from 'react'
import Icon from './Icon'

/** Floating "back to top" button, bottom-right, shown once the page has been scrolled. */
export default function BackToTop({ targetId = 'main' }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toTop = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    // Move keyboard focus to the start of the page content as well.
    document.getElementById(targetId)?.focus({ preventScroll: true })
  }

  return (
    <button type="button" className={`back-to-top${visible ? ' is-visible' : ''}`} onClick={toTop}
      aria-label="Back to top" title="Back to top" tabIndex={visible ? 0 : -1} aria-hidden={!visible}>
      <Icon name="up" />
    </button>
  )
}
