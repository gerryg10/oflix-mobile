import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchKomikDetail } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const KOMIK_API = '/komik_api.php';

/* ─── READER view (inline, replaces /baca) ──────────────── */
function Reader({ chapter, chapters, currentIdx, series, onClose, onChangeChapter }) {
  const [pages, setPages]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!chapter?.bacaManga) return;
    setLoading(true);
    setPages([]);
    setError('');
    fetch(`${KOMIK_API}?action=baca&bacaManga=${encodeURIComponent(chapter.bacaManga)}`)
      .then(r => r.json())
      .then(res => {
        if (res.status === 'ok' && res.images?.length) setPages(res.images);
        else setError('Gagal memuat: ' + (res.message || ''));
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [chapter?.bacaManga]);

  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < chapters.length - 1;

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #1e1e1e',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          onClick={onClose}
          style={{ background:'none', border:'none', color:'#fff', fontSize:18, cursor:'pointer', padding:'4px 8px' }}>
          <i className="fas fa-chevron-left" />
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, color:'#555', fontWeight:700, textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{series}</div>
          <div style={{ fontSize:13, color:'#fff', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{chapter.title}</div>
        </div>
      </div>

      {loading && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'50vh' }}>
          <div className="spinner" />
        </div>
      )}

      {error && !loading && (
        <div style={{ margin:20, padding:16, background:'#1a0a0a', border:'1px solid #440000', borderRadius:10 }}>
          <div style={{ color:'#ff6b6b', fontWeight:700, marginBottom:6 }}>⚠️ Gagal memuat</div>
          <div style={{ color:'#555', fontSize:11, fontFamily:'monospace', wordBreak:'break-all' }}>{error}</div>
        </div>
      )}

      {!loading && pages.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          {pages.map((pg, i) => {
            const src = typeof pg === 'string' ? pg : (pg.url || pg.src || pg.image || '');
            return (
              <img key={i} src={(src)} alt={`Halaman ${i+1}`} loading="lazy"
                style={{ width:'100%', display:'block' }}
                onError={e => { e.target.style.opacity = 0.1; }} />
            );
          })}
        </div>
      )}

      {/* Prev / Next chapter bar */}
      {!loading && (
        <div style={{
          position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
          width:'100%', maxWidth:430,
          background:'rgba(0,0,0,0.95)', borderTop:'1px solid #1e1e1e',
          display:'flex', padding:'10px 14px', gap:10,
        }}>
          <button
            onClick={() => hasPrev && onChangeChapter(currentIdx - 1)}
            disabled={!hasPrev}
            style={{
              flex:1, padding:'12px 0', borderRadius:10, border:'1px solid #222',
              background: hasPrev ? '#1a1a1a' : '#111',
              color: hasPrev ? '#fff' : '#333', fontWeight:700, fontSize:13,
              cursor: hasPrev ? 'pointer' : 'default',
            }}>
            ← Sebelumnya
          </button>
          <button
            onClick={() => hasNext && onChangeChapter(currentIdx + 1)}
            disabled={!hasNext}
            style={{
              flex:1, padding:'12px 0', borderRadius:10, border:'none',
              background: hasNext ? 'var(--primary)' : '#222',
              color:'#fff', fontWeight:700, fontSize:13,
              cursor: hasNext ? 'pointer' : 'default',
            }}>
            Selanjutnya →
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── KOMIK DETAIL page ──────────────────────────────────── */
export default function KomikDetail() {
  const [params] = useSearchParams();
  const slug     = params.get('d') || '';
  const nav      = useNavigate();
  const { getKomikProgress } = useAuth();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState([]);
  const [series, setSeries]   = useState('');
  const [poster, setPoster]   = useState('');
  const [descOpen, setDescOpen] = useState(false);

  // Reader state — null = showing detail, object = showing reader
  const [reader, setReader]   = useState(null); // { chapter, idx }

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchKomikDetail(slug).then(res => {
      if (res.status === 'ok') {
        const info = res.info || {};
        const meta = info.meta || {};
        const chs  = (res.chapters || []).slice().reverse();
        setData({ info, meta });
        setChapters(chs);
        setSeries(meta['Judul Komik'] || meta['Judul'] || info.title || slug);
        setPoster((info.poster || ''));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [slug]);

  function openChapter(idx) {
    if (!chapters[idx]) return;
    // Save chapters list for infinite scroll in Baca
    sessionStorage.setItem('komik_chapters', JSON.stringify(chapters.map(c => ({ title: c.title, url: c.bacaManga || c.url || c.slug }))));
    sessionStorage.setItem('komik_series', series);
    setReader({ chapter: chapters[idx], idx });
    document.getElementById('root')?.scrollTo(0, 0);
  }

  function closeReader() {
    setReader(null);
    document.getElementById('root')?.scrollTo(0, 0);
  }

  function changeChapter(idx) {
    if (!chapters[idx]) return;
    setReader({ chapter: chapters[idx], idx });
    document.getElementById('root')?.scrollTo(0, 0);
  }

  // ── READER VIEW ───────────────────────────────────────────
  if (reader) {
    return (
      <Reader
        chapter={reader.chapter}
        chapters={chapters}
        currentIdx={reader.idx}
        series={series}
        onClose={closeReader}
        onChangeChapter={changeChapter}
      />
    );
  }

  // ── DETAIL VIEW ───────────────────────────────────────────
  if (loading) return (
    <div className="listing-page">
      <div className="spinner-center"><div className="spinner" /></div>
    </div>
  );

  if (!data) return (
    <div className="listing-page" style={{ padding:40, color:'#666' }}>Gagal memuat komik.</div>
  );

  const { info, meta } = data;
  const title     = meta['Judul Komik'] || meta['Judul'] || info.title || slug;
  const pengarang = meta['Pengarang'] || meta['Author'] || '';
  const status    = meta['Status'] || '';

  return (
    <div className="detail-page">
      <div className="detail-hero" style={{ aspectRatio:'16/9', maxHeight:220 }}>
        <img src={poster} alt={title} />
        <div className="detail-hero-overlay" />
        <button className="detail-hero-back" onClick={() => nav(-1)}>
          <i className="fas fa-chevron-left" />
        </button>
      </div>

      <div className="detail-content">
        <h1 className="detail-title">{title}</h1>
        <div className="detail-meta">
          {pengarang && <span className="meta-badge">✏️ {pengarang}</span>}
          {status    && <span className="meta-badge" style={{ background:'rgba(229,9,20,0.15)', color:'var(--primary)' }}>{status}</span>}
          <span className="meta-badge">{chapters.length} Chapter</span>
        </div>

        {info.description && (
          <div style={{ marginBottom:18 }}>
            <p className="detail-desc" style={{ maxHeight: descOpen ? 'none' : 72, overflow:'hidden' }}>
              {info.description}
            </p>
            <button style={{ background:'none', border:'none', color:'var(--primary)', fontSize:12, cursor:'pointer', padding:0 }}
              onClick={() => setDescOpen(v => !v)}>
              {descOpen ? 'Sembunyikan ▲' : 'Baca selengkapnya ▼'}
            </button>
          </div>
        )}

        {/* ── Lanjutkan Baca button ── */}
        {(() => {
          const prog = getKomikProgress(slug);
          if (!prog) return null;
          return (
            <button
              onClick={() => openChapter(prog.chapterIdx)}
              style={{
                width:'100%', padding:'14px 0', borderRadius:12, border:'none',
                background:'var(--primary)', color:'#fff',
                fontWeight:800, fontSize:14, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                marginBottom:16,
              }}
            >
              <i className="fas fa-book-open" />
              Lanjutkan Baca · {prog.chapterTitle || `Ch ${prog.chapterIdx+1}`}
            </button>
          );
        })()}

        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:12, color:'#666', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
            Daftar Chapter
          </div>
          <div style={{ background:'#111', borderRadius:12, border:'1px solid #1e1e1e', overflow:'hidden' }}>
            {chapters.length === 0
              ? <p style={{ color:'#666', padding:20, textAlign:'center' }}>Tidak ada chapter</p>
              : chapters.map((ch, i) => (
                <div key={i} className="ep-item" onClick={() => openChapter(i)} style={{ padding:'12px 14px' }}>
                  <div className="ep-info">
                    <div className="ep-title">{ch.title}</div>
                    {ch.date && <div style={{ fontSize:10, color:'#444', marginTop:2 }}>{ch.date}</div>}
                  </div>
                  <i className="fas fa-book-open" style={{ color:'#333', fontSize:12, flexShrink:0 }} />
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
