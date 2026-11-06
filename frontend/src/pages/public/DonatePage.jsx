import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { EmptyState, ErrorState, Loading } from '../../components/States'
import { useSite } from '../../context/SiteContext'
import { useDocumentTitle } from '../../hooks/useApi'

const SUPPORTS = [
  { title: 'Tech Training', text: 'Free technology training for rural youth.' },
  { title: '100 Villages 100 GLUGs', text: 'Our goal of GNU/Linux Users Groups in 100 villages.' },
  { title: 'Meetups and camps', text: 'Open community meetups, workshops, and summer and winter camps.' },
]

// The QR code and message come from the admin Footer settings, the same source as the footer.
function DonationPanel() {
  const site = useSite()
  if (site.loading) return <Loading />
  if (site.error) return <ErrorState error={site.error} onRetry={site.reload} />

  const footer = site.data?.footer
  if (!footer?.donation_qr) {
    return (
      <EmptyState title="Donation details coming soon" glyph="[~]">
        <p>Please contact us if you would like to support VGLUG in the meantime.</p>
        <Link to="/contact" className="btn">Contact us</Link>
      </EmptyState>
    )
  }

  return (
    <div className="donate-grid">
      <figure className="donate-qr">
        <img src={footer.donation_qr.url} alt={footer.donation_qr_alt || 'Donation QR code'} width="280" height="280" />
        <figcaption>Scan with your payment app</figcaption>
      </figure>
      <div>
        <h2 id="donate-support">What your support helps</h2>
        <ul className="donate-list">
          {SUPPORTS.map((s) => (
            <li key={s.title}>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
        {footer.donation_text && <p className="donate-note">{footer.donation_text}</p>}
        <Link to="/contact" className="text-link">Questions about donating? Contact us <Icon name="arrow" /></Link>
      </div>
    </div>
  )
}

export default function DonatePage() {
  useDocumentTitle('Donate')
  return (
    <>
      <header className="page-header">
        <div className="container">
          <p className="eyebrow">Support our work</p>
          <h1>Donate</h1>
          <p className="lead">
            VGLUG is a non-profit, volunteer-run community taking free software and digital freedom to everyone.
            Your donation helps keep that work going.
          </p>
        </div>
      </header>
      <section className="section" aria-labelledby="donate-support">
        <div className="container">
          <DonationPanel />
        </div>
      </section>
    </>
  )
}
