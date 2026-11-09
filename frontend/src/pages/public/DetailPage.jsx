import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Comments from '../../components/Comments'
import ContentCard from '../../components/ContentCard'
import Html from '../../components/Html'
import Icon from '../../components/Icon'
import { LikeButton, ShareButton } from '../../components/Interactions'
import { ErrorState, Loading, NotFoundState } from '../../components/States'
import { useApi, useDocumentTitle } from '../../hooks/useApi'
import { EVENT_STATUS_LABEL, TYPE_META, eventDates, formatDate, isPast, readingMinutes } from '../../lib/format'

/** Details panel. Event rows appear when `event` is given; `children` adds more rows. */
export function EventPanel({ event, title, children, className = '' }) {
  const past = isPast(event)
  return (
    <aside className={`event-panel ${className}`.trim()} aria-label={title}>
      <h2>{title}</h2>
      <dl>
        {event && (
          <>
            <div>
              <dt>Status</dt>
              <dd><span className={`badge badge-${event.event_status}`}>{EVENT_STATUS_LABEL[event.event_status]}{past && event.event_status === 'scheduled' ? ' · ended' : ''}</span></dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{eventDates(event)}</dd>
            </div>
            {(event.location_name || event.address) && (
              <div>
                <dt>Where</dt>
                {event.location_name && <dd>{event.location_name}</dd>}
                {event.address && <dd style={{ fontWeight: 400, whiteSpace: 'pre-line' }}>{event.address}</dd>}
              </div>
            )}
            {event.is_online && (
              <div>
                <dt>Online</dt>
                <dd>
                  {event.online_url ? (
                    <a href={event.online_url} target="_blank" rel="noopener noreferrer">Join online <Icon name="external" /></a>
                  ) : 'Online — link to be shared'}
                </dd>
              </div>
            )}
            {event.registration_info && (
              <div>
                <dt>Registration</dt>
                <dd style={{ fontWeight: 400, whiteSpace: 'pre-line' }}>{event.registration_info}</dd>
              </div>
            )}
          </>
        )}
        {children}
      </dl>
      {event?.registration_url && !past && event.event_status !== 'cancelled' && (
        <a className="btn" href={event.registration_url} target="_blank" rel="noopener noreferrer">
          Register <Icon name="external" /><span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      )}
    </aside>
  )
}

function GalleryItem({ media }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <figure><p className="media-fallback">This media could not be loaded.</p></figure>
  return (
    <figure>
      {media.kind === 'video' ? (
        <video src={media.url} controls preload="metadata" playsInline onError={() => setFailed(true)} title={media.alt_text || undefined} />
      ) : (
        <a href={media.url} target="_blank" rel="noopener noreferrer" aria-label={`Open image${media.alt_text ? `: ${media.alt_text}` : ''} in a new tab`}>
          <img src={media.thumb_url} alt={media.alt_text || ''} loading="lazy" decoding="async" width={media.width || 800} height={media.height || 600} onError={() => setFailed(true)} />
        </a>
      )}
      {media.caption && <figcaption>{media.caption}</figcaption>}
    </figure>
  )
}

export default function DetailPage({ type }) {
  const { ref } = useParams()
  const navigate = useNavigate()
  const id = Number.parseInt(ref, 10)
  const meta = TYPE_META[type]
  const res = useApi(Number.isFinite(id) && id > 0 ? `/api/content/${type}/${id}` : null)
  const item = res.data
  const [commentBump, setCommentBump] = useState(0)
  useDocumentTitle(item?.title || meta.label)

  // Canonicalise the URL (e.g. after a slug change) without adding a history entry.
  useEffect(() => {
    if (item && ref !== `${item.id}-${item.slug}`) navigate(item.path + window.location.hash, { replace: true })
  }, [item, ref, navigate])

  if (!Number.isFinite(id) || id <= 0 || res.error?.status === 404) {
    return <div className="container status-page"><NotFoundState title={`${meta.label} not found`} message={`This ${meta.label.toLowerCase()} does not exist or is no longer published.`} /></div>
  }
  if (res.loading) return <div className="container status-page"><Loading /></div>
  if (res.error) return <div className="container status-page"><ErrorState error={res.error} onRetry={res.reload} /></div>

  const ev = item.event
  const minutes = readingMinutes(item.body_html)
  const published = formatDate(item.published_at)
  const updated = item.updated_at && formatDate(item.updated_at) !== published ? formatDate(item.updated_at) : null
  const comments = item.comment_count + commentBump

  return (
    <article className="post">
      <div className="post-grid">
        <header className="post-col post-header">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link><span aria-hidden="true">/</span>
            <Link to={`/${meta.path}`}>{meta.plural}</Link><span aria-hidden="true">/</span>
            <span aria-current="page">{item.title}</span>
          </nav>
          <h1>{item.title}</h1>
          {item.summary && <p className="post-subtitle">{item.summary}</p>}
          {ev && ev.event_status !== 'scheduled' && (
            <div className={`notice ${ev.event_status === 'cancelled' ? 'notice-error' : 'notice-warning'} event-status-banner`} role="note">
              <p>This {meta.label.toLowerCase()} is {EVENT_STATUS_LABEL[ev.event_status].toLowerCase()}.</p>
            </div>
          )}
          <div className="post-author">
            <span className="post-avatar" aria-hidden="true">{(item.author || 'V').trim().charAt(0).toUpperCase()}</span>
            <div>
              <p className="post-author-name">{item.author}</p>
              <p className="post-meta">
                {minutes} min read
                {published && <> · <time dateTime={item.published_at}>{published}</time></>}
              </p>
            </div>
          </div>
          <div className="post-bar">
            <a href="#comments-title" className="action-btn">
              <Icon name="comment" /> <span className="count">{comments}</span><span className="visually-hidden"> comments</span>
            </a>
            <ShareButton path={item.path} title={item.title} placement="below" />
          </div>
        </header>

        <EventPanel event={ev} title={`${meta.label} details`} className="post-aside">
          {published && (
            <div>
              <dt>Published</dt>
              <dd><time dateTime={item.published_at}>{published}</time></dd>
            </div>
          )}
          {updated && (
            <div>
              <dt>Updated</dt>
              <dd><time dateTime={item.updated_at}>{updated}</time></dd>
            </div>
          )}
          <div>
            <dt>Reading time</dt>
            <dd>{minutes} min</dd>
          </div>
        </EventPanel>

        <div className="post-col post-content">
          {item.cover && (
            <figure className="post-cover">
              <img src={item.cover.url} alt={item.cover.alt_text || ''} width={item.cover.width || 1200} height={item.cover.height || 630} decoding="async" />
              {item.cover.caption && <figcaption>{item.cover.caption}</figcaption>}
            </figure>
          )}
          <Html html={item.body_html} className="prose post-body" />
          {item.gallery?.length > 0 && (
            <section aria-labelledby="gallery-title" className="post-gallery">
              <h2 id="gallery-title">Gallery</h2>
              <div className="gallery">
                {item.gallery.map((m) => <GalleryItem key={m.id} media={m} />)}
              </div>
            </section>
          )}
          <div className="engage-bar">
            <LikeButton contentId={item.id} initialCount={item.like_count} initialLiked={item.liked} />
            <a href="#comments-title" className="action-btn">
              <Icon name="comment" /> <span className="count">{comments}</span> Comments
            </a>
            <ShareButton path={item.path} title={item.title} />
          </div>
          <Comments contentId={item.id} onPosted={() => setCommentBump((n) => n + 1)} />
        </div>
      </div>

      {item.related?.length > 0 && (
        <section className="section section-alt" aria-labelledby="related-title">
          <div className="container">
            <div className="section-head">
              <h2 id="related-title">More {meta.plural.toLowerCase()}</h2>
              <Link to={`/${meta.path}`} className="btn btn-outline">View all <Icon name="arrow" /></Link>
            </div>
            <div className="content-grid">
              {item.related.map((r) => <ContentCard key={r.id} item={r} />)}
            </div>
          </div>
        </section>
      )}
    </article>
  )
}
