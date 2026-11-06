import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import Wave from '../../components/Wave'
import { useDocumentTitle } from '../../hooks/useApi'

const TELEGRAM_URL = 'https://t.me/vpmglug'
const MAILING_LIST_URL = 'https://groups.google.com/forum/#!forum/viluppuramglug/join'

const WHAT_WE_DO = [
  {
    title: 'Software Freedom Day',
    text: 'A yearly public exhibition on Free Software, online privacy, malware and surveillance — open to everyone since 2013.',
    icon: 'calendar',
    to: '/events',
  },
  {
    title: '100 Villages 100 GLUGs',
    text: 'User groups in villages that bring FOSS and cyber-crime awareness to the doorsteps of rural communities.',
    icon: 'home',
    to: '/about',
  },
  {
    title: 'Free Tech Training',
    text: 'Weekend meetups and courses in Python, GenAI, DevOps, cyber security, React and Flutter for rural youth.',
    icon: 'code',
    to: '/meetups',
  },
]

// Add a `photo` URL to replace the placeholder in a circle.
const JOURNEY = [
  { title: 'Mini Debian Conference Tamil Nadu 2023', date: 'Dec 2022', tone: 'red' },
  { title: 'இலவச திறன் மேம்பாட்டு பயிற்சி தொடக்க விழா', date: 'Aug 2022', tone: 'maroon', lang: 'ta' },
  { title: 'VGLUG Wikimedia Hackathon 2022', date: 'May 2022', tone: 'dark' },
]

const AWARDS = [
  { year: '2021', title: 'Achievers Award', from: 'from the Chief Minister of Tamil Nadu' },
  { year: '2020', title: 'Young Social Change Maker', from: 'Trust for Youth and Child Leadership', featured: true },
  { year: '2020', title: 'Nambikkai Viruthu', from: 'Vikatan' },
]

function WhatWeDo() {
  return (
    <section className="home-band" aria-labelledby="what-we-do-title">
      <Wave />
      <div className="home-band-inner">
        <div className="container">
          <div className="home-band-head">
            <h2 id="what-we-do-title">What we do</h2>
            <p>Technology should not be limited to a few people. It should reach millions — and give every user freedom.</p>
          </div>
          <ol className="home-work">
            {WHAT_WE_DO.map((w, i) => (
              <li key={w.title}>
                <div className="home-work-mark">
                  <span className="home-work-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span className="home-work-icon" aria-hidden="true"><Icon name={w.icon} /></span>
                </div>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
                <Link to={w.to} className="home-work-link" aria-label={`Learn more about ${w.title}`}>Learn more <Icon name="arrow" /></Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <Wave flip />
    </section>
  )
}

function Journey() {
  return (
    <section className="home-section" aria-labelledby="journey-title">
      <div className="container">
        <div className="home-journey-head">
          <h2 id="journey-title"><span className="home-star" aria-hidden="true">★</span> From our journey</h2>
          <Link to="/events" className="home-more">All events <Icon name="arrow" /></Link>
        </div>
        <div className="home-journey">
          <svg className="home-journey-line" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 80 C 80 40, 130 30, 200 70 S 340 170, 480 110 S 660 10, 800 60 S 980 190, 1040 150 S 1150 90, 1200 50" />
          </svg>
          <ul>
            {JOURNEY.map((j) => (
              <li key={j.date}>
                <div className="home-photo">
                  {j.photo ? <img src={j.photo} alt="" loading="lazy" /> : <Icon name="image" />}
                </div>
                <span className={`home-date home-date-${j.tone}`}>{j.date}</span>
                <h3 lang={j.lang}>{j.title}</h3>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function Volunteers() {
  return (
    <section className="home-section home-statement" aria-labelledby="volunteers-title">
      <div className="container">
        <h2 id="volunteers-title">Built by our volunteers</h2>
        <p>
          We made <mark>Sangailakkiyam</mark> to read Sangam literature, <mark>Spell4Wiki</mark> to give Wikipedia a
          voice, <mark>VizhiTamil</mark> so Tamil books can be heard — and brought <mark>Mozilla, VLC &amp; NewPipe</mark> into Tamil.
        </p>
      </div>
    </section>
  )
}

function Awards() {
  return (
    <section className="home-section home-awards" aria-labelledby="awards-title">
      <div className="container">
        <h2 id="awards-title">Recognised for change</h2>
        <ul>
          {AWARDS.map((a) => (
            <li key={a.title} className={a.featured ? 'is-featured' : undefined}>
              <div className="home-award">
                <span className="home-star" aria-hidden="true">★</span>
                <strong>{a.year}</strong>
                <h3>{a.title}</h3>
                <p>{a.from}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function ExternalButton({ href, className, children }) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}<span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  )
}

const HERO_BADGES = [
  { value: '10000+', label: 'youth trained', tone: 'red' },
  { value: '100', label: 'village GLUGs goal', tone: 'maroon' },
  { value: '2013', label: 'founded', tone: 'dark' },
]

function HeroEmblem() {
  return (
    <figure className="hero-emblem">
      <svg className="hero-ring" viewBox="0 0 500 500" aria-hidden="true">
        <circle className="hero-ring-dots" cx="250" cy="250" r="246" />
        <path id="hero-ring-path" fill="none" d="M 30 250 a 220 220 0 1 1 440 0 a 220 220 0 1 1 -440 0" />
        <text className="hero-ring-text">
          <textPath href="#hero-ring-path" textLength="1370" lengthAdjust="spacing">
            FREE SOFTWARE ★ FREE SOCIETY ★ VILUPPURAM ★ SINCE 2013 ★
          </textPath>
        </text>
      </svg>
      <div className="hero-disc">
        <img src="/vglug-logo-512.png" alt="VGLUG Foundation logo" width="512" height="512" fetchPriority="high" />
      </div>
      <ul className="hero-badges">
        {HERO_BADGES.map((b) => (
          <li key={b.tone} className={`hero-badge hero-badge-${b.tone}`}>
            <strong>{b.value}</strong>
            <span>{b.label}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

export default function HomePage() {
  useDocumentTitle('Home')

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="hero-highlight">Viluppuram GNU/Linux Users Group</span>{' '}
              <span className="hero-since">· Since 2013</span>
            </p>
            <h1 id="hero-title">
              Free Software<br />
              for Every{' '}
              <em>
                Village
                <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 8 C 40 3, 85 11, 130 7 S 185 5, 198 10" />
                </svg>
              </em>,<br />
              Every Student.
            </h1>
            <p className="hero-tagline">Bringing Free Software to Everyone!</p>
            <p className="lead">
              A volunteer-driven FOSS movement making technology, knowledge and digital freedom accessible to
              everyone. Through GNU/Linux, community meetups and hands-on training, we empower rural youth, inspire
              innovation and bring the freedom of technology to underserved communities.
            </p>
            <div className="hero-actions">
              <Link to="/join" className="btn btn-lg">Join VGLUG <Icon name="arrow" /></Link>
              <Link to="/events" className="btn btn-outline btn-lg">Explore Our Activities</Link>
            </div>
          </div>
          <HeroEmblem />
        </div>
      </section>

      <div className="home-sections">
        <WhatWeDo />
        <Journey />
        <Volunteers />
        <Awards />
      </div>
    </>
  )
}
