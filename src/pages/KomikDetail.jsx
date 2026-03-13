import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchKomikDetail } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const KOMIK_API = '/komik_api.php';

async function fetchPages(bacaSlug) {
  const res  = await fetch(`${KOMIK_API}?action=baca&bacaManga=${encodeURIComponent(bacaSlug)}`);
  const data = await res.json();
  if (data.status === 'ok' && data.images?.length) return data.images;
  throw new Error(data.message || 'Gagal memuat halaman');
}

/* ─── READER (inline, no route change) ──────────────────── */
function Reader({ chapters, startIdx, series, poster, onClose, saveProgress }) {
  const [blocks,      setBlocks]      = useState([]);
  const [loadedSet,   setLoadedSet]   = useState(new Set());
  const [loadingNext, setLoadingNext] = useState(false);
  const [endReached,  setEndReached]  = useState(false);
  const [curChIdx,    setCurChIdx]    = useState(startIdx);
  const [curChTitle,  setCurChTitle]  = useState(chapters[startIdx]?.title || '');

  const readyRef    = useRef(false);
  const loadingRef  = useRef(false);
  const sentinelRef = useRef(null);

  // ── hide BottomNav while reader open ──
  useEffect(() => {
    const nav = document.querySelector('.bottom-nav');
    if (nav) nav.style.display = 'none';
    const header = document.querySelector('.app-header');
    if (header) header.style.display = 'none';
    return () => {
      if (nav) nav.style.display = '';
      if (header) header.style.display = '';
    };
  }, []);

  // ── Initial chapter load ──
  useEffect(() => {
    const ch = chapters[startIdx];
    if (!ch) return;
    readyRef.current   = false;
    loadingRef.current = false;
    setBlocks([]);
    setLoadedSet(new Set());
    setEndReached(false);
    setLoadingNext(true);

    const slug = ch.bacaManga || ch.url || ch.slug || '';
    fetchPages(slug)
      .then(pages => {
        setBlocks([{ chIdx: startIdx, title: ch.title, pages }]);
        setLoadedSet(new Set([startIdx]));
        setCurChIdx(startIdx);
        setCurChTitle(ch.title);
        setLoadingNext(false);
        saveProgress(startIdx, ch.title, poster, series);
        setTimeout(() => { readyRef.current = true; }, 1500);
      })
      .catch(e => { console.warn(e); setLoadingNext(false); });
  }, [startIdx]);

  // ── Load next chapter ──
  function loadNext(currentBlocks, currentSet) {
    if (loadingRef.current || endReached) return;
    const last = currentBlocks[currentBlocks.length - 1];
    if (!last) return;
    const nextIdx = last.chIdx + 1;
    if (nextIdx >= chapters.length) { setEndReached(true); return; }
    if (currentSet.has(nextIdx)) return;

    const ch = chapters[nextIdx];
    if (!ch) { setEndReached(true); return; }
    const slug = ch.bacaManga || ch.url || ch.slug || '';

    loadingRef.current = true;
    readyRef.current   = false;
    setLoadingNext(true);

    fetchPages(slug)
      .then(pages => {
        setBlocks(prev => [...prev, { chIdx: nextIdx, title: ch.title, pages }]);
        setLoadedSet(prev => new Set([...prev, nextIdx]));
        setCurChIdx(nextIdx);
        setCurChTitle(ch.title);
        setLoadingNext(false);
        loadingRef.current = false;
        saveProgress(nextIdx, ch.title, poster, series);
        setTimeout(() => { readyRef.current = true; }, 1500);
      })
      .catch(e => { console.warn(e); setLoadingNext(false); loadingRef.current = false; });
  }

  // ── IntersectionObserver ──
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && readyRef.current && !loadingRef.current) {
          setBlocks(prev => {
            setLoadedSet(prevSet => { loadNext(prev, prevSet); return prevSet; });
            return prev;
          });
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [blocks.length, endReached]);

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', paddingTop: 56 }}>

      {/* ── STICKY HEADER ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
        height: 56,
        background: 'rgba(10,10,10,0.97)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px',
        maxWidth: '100%',
      }}>
        <button
          onClick={onClose}
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'var(--primary)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 15, cursor: 'pointer',
          }}
        >
          <i className="fas fa-chevron-left" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, color: '#aaa', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.8,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{series}</div>
          <div style={{
            fontSize: 13, color: '#fff', fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{curChTitle}</div>
        </div>
      </div>

      {/* ── CHAPTER BLOCKS ── */}
      {blocks.map((block, bi) => (
        <div key={block.chIdx}>
          {bi > 0 && (
            <div style={{
              padding: '12px 16px', borderTop: '3px solid #1e1e1e',
              background: '#0d0d0d',
            }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
                Chapter selanjutnya
              </div>
              <div style={{ fontSize: 14, color: '#fff', fontWeight: 700 }}>{block.title}</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {block.pages.map((pg, i) => {
              const src = typeof pg === 'string' ? pg : (pg.url || pg.src || pg.image || '');
              return (
                <img
                  key={i} src={src}
                  alt={`Ch${block.chIdx + 1} p${i + 1}`}
                  loading="lazy"
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    display: 'block',
                    objectFit: 'contain',
                  }}
                  onError={e => { e.target.style.opacity = '0.08'; }}
                />
              );
            })}
          </div>
        </div>
      ))}

      {!endReached && <div ref={sentinelRef} style={{ height: 1 }} />}

      {loadingNext && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 0', gap: 12 }}>
          <div className="spinner" />
          <span style={{ color: '#444', fontSize: 12 }}>Memuat chapter berikutnya...</span>
        </div>
      )}

      {endReached && !loadingNext && (
        <div style={{ textAlign: 'center', padding: '48px 20px 60px', color: '#333' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#555' }}>Tamat</div>
          <div style={{ fontSize: 12, color: '#333', marginTop: 6 }}>Semua chapter sudah dibaca</div>
          <button onClick={onClose} style={{
            marginTop: 20, padding: '10px 28px', borderRadius: 10,
            background: 'var(--primary)', border: 'none',
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>← Kembali ke Detail</button>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}

/* ─── KOMIK DETAIL page ──────────────────────────────────── */
export default function KomikDetail() {
  const [params] = useSearchParams();
  const slug     = params.get('d') || '';
  const nav      = useNavigate();
  const { getKomikProgress, saveKomikProgress } = useAuth();

  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [chapters,  setChapters]  = useState([]);
  const [series,    setSeries]    = useState('');
  const [poster,    setPoster]    = useState('');
  const [descOpen,  setDescOpen]  = useState(false);
  const [readerIdx, setReaderIdx] = useState(null); // null = detail view

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setReaderIdx(null);
    fetchKomikDetail(slug).then(res => {
      if (res.status === 'ok') {
        const info = res.info || {};
        const meta = info.meta || {};
        const chs  = (res.chapters || []).slice().reverse();
        setData({ info, meta });
        setChapters(chs);
        setSeries(meta['Judul Komik'] || meta['Judul'] || info.title || slug);
        setPoster(info.poster || '');
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [slug]);

  function openChapter(idx) {
    setReaderIdx(idx);
    window.scrollTo(0, 0);
  }

  function closeReader() {
    setReaderIdx(null);
    window.scrollTo(0, 0);
  }

  function saveProgress(chIdx, chTitle, posterUrl, seriesTitle) {
    saveKomikProgress(slug, chIdx, chTitle, posterUrl, seriesTitle);
  }

  // ── READER VIEW ──
  if (readerIdx !== null && chapters.length > 0) {
    return (
      <Reader
        chapters={chapters}
        startIdx={readerIdx}
        series={series}
        poster={poster}
        onClose={closeReader}
        saveProgress={saveProgress}
      />
    );
  }

  // ── LOADING ──
  if (loading) return (
    <div className="listing-page">
      <div className="spinner-center"><div className="spinner" /></div>
    </div>
  );

  if (!data) return (
    <div className="listing-page" style={{ padding: 40, color: '#666' }}>Gagal memuat komik.</div>
  );

  const { info, meta } = data;
  const title     = meta['Judul Komik'] || meta['Judul'] || info.title || slug;
  const pengarang = meta['Pengarang'] || meta['Author'] || '';
  const status    = meta['Status'] || '';
  const prog      = getKomikProgress(slug);

  return (
    <div className="detail-page">
      <div className="detail-hero" style={{ aspectRatio: '16/9', maxHeight: 220 }}>
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
          {status    && <span className="meta-badge" style={{ background: 'rgba(229,9,20,0.15)', color: 'var(--primary)' }}>{status}</span>}
          <span className="meta-badge">{chapters.length} Chapter</span>
        </div>

        {info.description && (
          <div style={{ marginBottom: 18 }}>
            <p className="detail-desc" style={{ maxHeight: descOpen ? 'none' : 72, overflow: 'hidden' }}>
              {info.description}
            </p>
            <button style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, cursor: 'pointer', padding: 0 }}
              onClick={() => setDescOpen(v => !v)}>
              {descOpen ? 'Sembunyikan ▲' : 'Baca selengkapnya ▼'}
            </button>
          </div>
        )}

        {/* Lanjutkan Baca */}
        {prog && (
          <button
            onClick={() => openChapter(prog.chapterIdx)}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              background: 'var(--primary)', color: '#fff',
              fontWeight: 800, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 16,
            }}
          >
            <i className="fas fa-book-open" />
            Lanjutkan Baca · {prog.chapterTitle || `Ch ${prog.chapterIdx + 1}`}
          </button>
        )}

        {/* Chapter List */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Daftar Chapter
          </div>
          <div style={{ background: '#111', borderRadius: 12, border: '1px solid #1e1e1e', overflow: 'hidden' }}>
            {chapters.length === 0
              ? <p style={{ color: '#666', padding: 20, textAlign: 'center' }}>Tidak ada chapter</p>
              : chapters.map((ch, i) => (
                <div key={i} className="ep-item" onClick={() => openChapter(i)} style={{ padding: '12px 14px' }}>
                  <div className="ep-info">
                    <div className="ep-title">{ch.title}</div>
                    {ch.date && <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>{ch.date}</div>}
                  </div>
                  <i className="fas fa-book-open" style={{ color: '#333', fontSize: 12, flexShrink: 0 }} />
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
