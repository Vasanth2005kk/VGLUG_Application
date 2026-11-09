import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../../api/client'
import { useDebounced } from '../../hooks/useApi'
import Html from '../Html'
import Icon from '../Icon'
import MediaPicker from './MediaPicker'

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

// Toolbar groups. Every action is limited to what the server-side renderer supports,
// so nothing here produces syntax that would appear as raw text on the public site.
const GROUPS = [
  [
    { key: 'undo', label: '↶', title: 'Undo', shortcut: 'Z' },
    { key: 'redo', label: '↷', title: 'Redo', shortcut: 'Shift+Z' },
  ],
  [
    { key: 'h2', label: 'H2', title: 'Heading' },
    { key: 'h3', label: 'H3', title: 'Subheading' },
    { key: 'h4', label: 'H4', title: 'Small heading' },
  ],
  [
    { key: 'bold', label: 'B', title: 'Bold', shortcut: 'B', style: { fontWeight: 800 } },
    { key: 'italic', label: 'I', title: 'Italic', shortcut: 'I', style: { fontStyle: 'italic' } },
    { key: 'strike', label: 'S', title: 'Strikethrough', shortcut: 'Shift+X', style: { textDecoration: 'line-through' } },
    { key: 'inlineCode', label: '`c`', title: 'Inline code', shortcut: 'E' },
  ],
  [
    { key: 'link', label: 'Link', title: 'Link', shortcut: 'K' },
    { key: 'media', icon: 'image', title: 'Insert image or video' },
  ],
  [
    { key: 'ul', label: '• List', title: 'Bulleted list' },
    { key: 'ol', label: '1. List', title: 'Numbered list' },
    { key: 'quote', label: '“ ”', title: 'Quote' },
  ],
  [
    { key: 'codeBlock', label: '{ }', title: 'Code block' },
    { key: 'table', label: 'Table', title: 'Table' },
    { key: 'hr', label: '—', title: 'Horizontal line' },
  ],
]

const SHORTCUTS = { b: 'bold', i: 'italic', k: 'link', e: 'inlineCode' }

const HELP = [
  ['## Heading', 'Heading (### and #### for smaller)'],
  ['**bold**  _italic_  ~~strike~~', 'Text styles'],
  ['`code`', 'Inline code'],
  ['[text](https://example.org)', 'Link'],
  ['![description](/media/…)', 'Image or video (use the image button)'],
  ['- item  /  1. item', 'Lists; press Enter to continue, Enter twice to finish'],
  ['> quote', 'Quote'],
  ['```  …  ```', 'Code block'],
  ['| a | b |  then  | --- | --- |', 'Table'],
  ['---', 'Horizontal line'],
]

const LIST_RE = /^(\s*)([-*+]|(\d+)[.)])\s+/
const QUOTE_RE = /^(\s*>\s?)/
const HEADING_RE = /^#{1,6}\s+/

/**
 * Markdown editor with live preview. The preview is rendered by the same server-side
 * sanitising renderer that produces public pages, so what admins see is what visitors get.
 * Edits go through the browser's own text insertion, so Ctrl+Z / Ctrl+Y keep working.
 */
export default function MarkdownEditor({ label, value, onChange, error, hint, compact = false, mediaCategory = 'blogs', required }) {
  const id = useId()
  const textarea = useRef(null)
  const [mode, setMode] = useState(compact ? 'write' : 'split')
  const [fullscreen, setFullscreen] = useState(false)
  const [help, setHelp] = useState(false)
  const [preview, setPreview] = useState({ html: '', loading: false, error: null })
  const [picker, setPicker] = useState(false)
  const debounced = useDebounced(value, 350)
  const showPreview = mode !== 'write'
  const text = value || ''

  useEffect(() => {
    if (!showPreview) return undefined
    let cancelled = false
    const controller = new AbortController()
    setPreview((p) => ({ ...p, loading: true }))
    api
      .post('/api/admin/markdown/preview', { markdown: debounced || '' }, { signal: controller.signal })
      .then((res) => !cancelled && setPreview({ html: res.data.html, loading: false, error: null }))
      .catch((err) => !cancelled && err.name !== 'AbortError' && setPreview((p) => ({ ...p, loading: false, error: err })))
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debounced, showPreview])

  useEffect(() => {
    if (!fullscreen) return undefined
    document.body.classList.add('md-fullscreen-open')
    const onKey = (e) => e.key === 'Escape' && !picker && setFullscreen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('md-fullscreen-open')
      document.removeEventListener('keydown', onKey)
    }
  }, [fullscreen, picker])

  // Replace text[start, end) and then select [selStart, selEnd). Uses the browser's text
  // insertion when available so the change joins the native undo history.
  const replace = (start, end, insertText, selStart, selEnd = selStart) => {
    const el = textarea.current
    let done = false
    if (el && typeof document.execCommand === 'function') {
      el.focus()
      el.setSelectionRange(start, end)
      done = insertText ? document.execCommand('insertText', false, insertText) : start === end || document.execCommand('delete')
    }
    if (!done) onChange(text.slice(0, start) + insertText + text.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(selStart, selEnd)
    })
  }

  const selection = () => {
    const el = textarea.current
    return { start: el?.selectionStart ?? text.length, end: el?.selectionEnd ?? text.length }
  }

  // Wrap the selection in markers, or remove them if it is already wrapped.
  const wrap = (before, after, placeholder) => {
    const { start, end } = selection()
    const selected = text.slice(start, end)
    if (text.slice(start - before.length, start) === before && text.slice(end, end + after.length) === after) {
      replace(start - before.length, end + after.length, selected, start - before.length, end - before.length)
      return
    }
    const inner = selected || placeholder
    replace(start, end, before + inner + after, start + before.length, start + before.length + inner.length)
  }

  // Apply a prefix to every selected line, or remove it if all lines already have it.
  const prefixLines = (kind) => {
    const { start, end } = selection()
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    const nl = text.indexOf('\n', end)
    const lineEnd = nl === -1 ? text.length : nl
    const lines = text.slice(lineStart, lineEnd).split('\n')
    const strip = (l) => l.replace(HEADING_RE, '').replace(LIST_RE, '$1').replace(QUOTE_RE, '')
    const has = {
      h2: (l) => /^##\s/.test(l), h3: (l) => /^###\s/.test(l), h4: (l) => /^####\s/.test(l),
      ul: (l) => /^\s*[-*+]\s/.test(l), ol: (l) => /^\s*\d+[.)]\s/.test(l), quote: (l) => QUOTE_RE.test(l),
    }[kind]
    const marker = (i) => ({ h2: '## ', h3: '### ', h4: '#### ', ul: '- ', ol: `${i + 1}. `, quote: '> ' })[kind]
    const filled = lines.every((l) => !l.trim()) ? [kind.startsWith('h') ? 'Heading' : 'Text'] : lines
    const allHave = lines.every((l) => !l.trim() || has(l))
    const next = filled.map((l, i) => (allHave ? strip(l) : l.trim() ? marker(i) + strip(l) : l)).join('\n')
    replace(lineStart, lineEnd, next, lineStart, lineStart + next.length)
  }

  // Insert a standalone block, separated from surrounding text by blank lines.
  const insertBlock = (block, selectFrom = 0, selectTo = block.length) => {
    const { start, end } = selection()
    const before = text.slice(0, start)
    const lead = !before ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const after = text.slice(end)
    const trail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
    const at = start + lead.length
    replace(start, end, lead + block + (after ? trail : '\n'), at + selectFrom, at + selectTo)
  }

  const run = (key) => {
    const el = textarea.current
    const { start, end } = selection()
    const selected = text.slice(start, end)
    switch (key) {
      case 'undo':
      case 'redo':
        el?.focus()
        if (typeof document.execCommand === 'function') document.execCommand(key)
        break
      case 'bold': return wrap('**', '**', 'bold text')
      case 'italic': return wrap('_', '_', 'italic text')
      case 'strike': return wrap('~~', '~~', 'struck text')
      case 'inlineCode': return wrap('`', '`', 'code')
      case 'link': {
        if (/^https?:\/\/\S+$/.test(selected)) {
          replace(start, end, `[link text](${selected})`, start + 1, start + 10)
        } else {
          const label = selected || 'link text'
          const md = `[${label}](https://)`
          replace(start, end, md, start + label.length + 3, start + md.length - 1)
        }
        break
      }
      case 'media': return setPicker(true)
      case 'h2': case 'h3': case 'h4': case 'ul': case 'ol': case 'quote': return prefixLines(key)
      case 'codeBlock': {
        const body = selected || 'code'
        return insertBlock('```\n' + body + '\n```', 4, 4 + body.length)
      }
      case 'table': {
        const table = '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |'
        return insertBlock(table, 2, 10)
      }
      case 'hr': return insertBlock('---', 3, 3)
      default:
    }
    return undefined
  }

  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey
    if (mod && !e.altKey) {
      const k = e.key.toLowerCase()
      if (SHORTCUTS[k] && !e.shiftKey) {
        e.preventDefault()
        run(SHORTCUTS[k])
        return
      }
      if (k === 'x' && e.shiftKey) {
        e.preventDefault()
        run('strike')
        return
      }
    }
    // Continue lists and quotes on Enter; an empty item ends the list.
    if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey && !e.nativeEvent.isComposing) {
      const { start, end } = selection()
      if (start !== end) return
      const lineStart = text.lastIndexOf('\n', start - 1) + 1
      const line = text.slice(lineStart, start)
      const list = line.match(LIST_RE)
      const quote = !list && line.match(QUOTE_RE)
      const marker = list ? list[0] : quote ? quote[0] : null
      if (!marker) return
      e.preventDefault()
      if (!line.slice(marker.length).trim()) {
        replace(lineStart, start, '', lineStart)
        return
      }
      const next = list && list[3] ? `${list[1]}${Number(list[3]) + 1}${list[2].slice(-1)} ` : marker
      replace(start, start, '\n' + next, start + 1 + next.length)
    }
  }

  const insertMedia = (items) => {
    const list = Array.isArray(items) ? items : [items]
    const md = list.map((m) => `![${(m.alt_text || m.caption || '').replace(/[[\]]/g, '')}](${m.url})`).join('\n\n')
    insertBlock(md, md.length, md.length)
    setPicker(false)
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const minutes = Math.max(1, Math.round(words / 200))
  const disabled = mode === 'preview'

  return (
    <div className="field">
      <label htmlFor={id} id={`${id}-label`}>
        {label}
        {required && <span aria-hidden="true" style={{ color: 'var(--accent-text)' }}> *</span>}
      </label>
      <div className={`md-editor${error ? ' invalid' : ''}${fullscreen ? ' is-fullscreen' : ''}`}
        role={fullscreen ? 'dialog' : undefined} aria-modal={fullscreen || undefined} aria-label={fullscreen ? `${label} editor` : undefined}>
        <div className="md-toolbar" role="toolbar" aria-label={`${label} formatting`}>
          {GROUPS.map((group, gi) => (
            <span className="md-group" key={gi}>
              {group.map((t) => {
                const title = t.shortcut ? `${t.title} (${MOD}${t.shortcut})` : t.title
                return (
                  <button key={t.key} type="button" title={title} aria-label={t.title} onClick={() => run(t.key)}
                    disabled={disabled} aria-keyshortcuts={t.shortcut ? `Control+${t.shortcut}` : undefined}>
                    {t.icon ? <Icon name={t.icon} /> : <span style={t.style}>{t.label}</span>}
                  </button>
                )
              })}
            </span>
          ))}
          <span className="grow" />
          <span className="md-group">
            {[['write', 'Write'], ['split', 'Split'], ['preview', 'Preview']].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>
            ))}
          </span>
          <span className="md-group">
            <button type="button" aria-pressed={help} onClick={() => setHelp((h) => !h)} title="Markdown help" aria-label="Markdown help">?</button>
            <button type="button" aria-pressed={fullscreen} onClick={() => setFullscreen((f) => !f)}
              title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen'} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
              {fullscreen ? '⤡' : '⤢'}
            </button>
          </span>
        </div>
        {help && (
          <div className="md-help">
            <table>
              <tbody>
                {HELP.map(([syntax, what]) => (
                  <tr key={syntax}><td><code>{syntax}</code></td><td>{what}</td></tr>
                ))}
              </tbody>
            </table>
            <p>Shortcuts: {MOD}B bold · {MOD}I italic · {MOD}K link · {MOD}E code · {MOD}Shift+X strikethrough · {MOD}Z undo</p>
          </div>
        )}
        <div className={`md-panes ${mode}${compact ? ' compact' : ''}`}>
          {mode !== 'preview' && (
            <textarea
              ref={textarea}
              id={id}
              className="textarea code"
              value={text}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              aria-invalid={error ? true : undefined}
              aria-describedby={[hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined}
              spellCheck
            />
          )}
          {showPreview && (
            <div className="md-preview" aria-live="polite" aria-busy={preview.loading} aria-label={`${label} preview`} role="region">
              <div className="preview-label">
                <span>Live preview</span>
                {preview.loading && <span>updating…</span>}
              </div>
              {preview.error ? (
                <p className="error">Preview unavailable: {preview.error.message}</p>
              ) : preview.html ? (
                <Html html={preview.html} />
              ) : (
                <p className="muted">Nothing to preview yet.</p>
              )}
            </div>
          )}
        </div>
        <div className="md-footer">
          <span>Markdown · raw HTML is not allowed{fullscreen ? ' · Esc to exit full screen' : ''}</span>
          <span>{words} words · {text.length} characters · {minutes} min read</span>
        </div>
      </div>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="error" id={`${id}-err`}>{error}</p>}
      {picker && <MediaPicker title="Insert media" category={mediaCategory} multiple onClose={() => setPicker(false)} onSelect={insertMedia} />}
    </div>
  )
}
