import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchKomikDetail } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const KOMIK_API = '/komik_api.php';

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
    const ch = chapters[idx];
    // Save chapters list for infinite scroll
    sessionStorage.setItem('komik_chapters', JSON.stringify(
      chapters.map(c => ({ title: c.title, url: c.bacaManga || c.url || c.slug || '' }))
    ));
    sessionStorage.setItem('komik_series', series);
    const bacaSlug = ch.bacaManga || ch.url || ch.slug || '';
    nav(`/baca?m=${encodeURIComponent(bacaSlug)}&title=${encodeURIComponent(ch.title)}&idx=${idx}&series=${encodeURIComponent(series)}&poster=${encodeURIComponent(poster)}`);
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
