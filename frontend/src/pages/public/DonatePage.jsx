import { useState } from 'react'
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

// Label, footer field and whether the value is a code people copy into a banking app.
const ACCOUNT_FIELDS = [
  { label: 'Holder Name', key: 'bank_holder_name' },
  { label: 'Acc No', key: 'bank_account_number', code: true },
  { label: 'IFSC code', key: 'bank_ifsc', code: true },
  { label: 'Bank name', key: 'bank_name' },
  { label: 'Branch', key: 'bank_branch' },
  { label: 'UPI ID', key: 'upi_id', code: true },
]

function CopyButton({ label, value }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied: the value stays selectable on the page.
    }
  }
  return (
    <button type="button" className="donate-copy" onClick={copy} aria-label={`Copy ${label}`}>
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

function AccountDetails({ rows }) {
  return (
    <div className="donate-account">
      <h2 id="donate-account">Account Details</h2>
      <dl>
        {rows.map((d) => (
          <div key={d.key}>
            <dt>{d.label}</dt>
            <dd>
              <span className={d.code ? 'donate-code' : undefined}>{d.value}</span>
              {d.code && <CopyButton label={d.label} value={d.value} />}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// The QR code, account details and message all come from the admin Footer settings.
function DonationPanel() {
  const site = useSite()
  if (site.loading) return <Loading />
  if (site.error) return <ErrorState error={site.error} onRetry={site.reload} />

  const footer = site.data?.footer || {}
  const rows = ACCOUNT_FIELDS.map((f) => ({ ...f, value: footer[f.key] })).filter((f) => f.value)
  if (!footer.donation_qr && rows.length === 0) {
    return (
      <EmptyState title="Donation details coming soon" glyph="[~]">
        <p>Please contact us if you would like to support VGLUG in the meantime.</p>
        <Link to="/contact" className="btn">Contact us</Link>
      </EmptyState>
    )
  }

  // QR code on the left, account details beside it; the support list sits underneath.
  return (
    <>
      <div className={`donate-grid${footer.donation_qr && rows.length > 0 ? '' : ' donate-grid-single'}`}>
        {footer.donation_qr && (
          <figure className="donate-qr">
            <img src={footer.donation_qr.url} alt={footer.donation_qr_alt || 'Donation QR code'} width="280" height="280" />
            <figcaption>Scan with your payment app</figcaption>
          </figure>
        )}
        {rows.length > 0 && <AccountDetails rows={rows} />}
      </div>
      <div className="donate-support">
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
    </>
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
      <section className="section" aria-labelledby="donate-account">
        <div className="container">
          <DonationPanel />
        </div>
      </section>
    </>
  )
}
