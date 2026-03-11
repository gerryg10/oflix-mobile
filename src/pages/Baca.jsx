import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';


const KOMIK_API = '/komik_api.php';

// Fetch pages for one chapter slug
async function fetchChapterPages(slug) {
  const res = await fetch(`${KOMIK_API}?action=baca&bacaManga=${encodeURIComponent(slug)}`);
  const data = await res.json();
  if (data.status === 'ok' && data.images?.length) return data.images;
  throw new Error(data.message || 'Gagal memuat chapter');
}

export default function BacaPage() {
  const [params] = useSearchParams();
  const nav      = useNavigate();

  const slug       = params.get('m') || '';
  const title      = params.get('title') || '';
  const idxStr     = params.get('idx') || '0';
  const startIdx   = parseInt(idxStr, 10);

  // All chapters from sessionStorage
  const chapters = (() => {
    try { return JSON.parse(sessionStorage.getItem('komik_chapters')) || []; } catch { return []; }
  })();
  const series = sessionStorage.getItem('komik_series') || '';

  // Each "block" = one loaded chapter  { chIdx, title, slug, pages, sentinel }
  const [blocks, setBlocks]       = useState([]);
  const [loadedIdxs, setLoadedIdxs] = useState(new Set());
  const [loadingNext, setLoadingNext] = useState(false);
  const [endReached, setEndReached]   = useState(false);

  // Sticky back button — always visible, floats
  const [scrolled, setScrolled] = useState(false);
  const pageRef = useRef(null);

  // Sentinel refs map: chIdx → ref element
  const sentinelRefs = useRef({});

  // ── Load a chapter and append block ─────────────────────
  const loadChapter = useCallback(async (chIdx) => {
    if (loadedIdxs.has(chIdx) || chIdx < 0 || chIdx >= chapters.length) return;
    setLoadingNext(true);
    try {
      const ch    = chapters[chIdx];
      const pages = await fetchChapterPages(ch.url);
      setBlocks(prev => [...prev, { chIdx, title: ch.title, slug: ch.url, pages }]);
      setLoadedIdxs(prev => new Set([...prev, chIdx]));
    } catch (e) {
      console.warn('Load chapter failed:', e.message);
    }
    setLoadingNext(false);
  }, [chapters, loadedIdxs]);

  // ── Initial load ─────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    setBlocks([]);
    setLoadedIdxs(new Set());
    setEndReached(false);
    // Seed first block directly using the URL param (not necessarily chapters[startIdx])
    setLoadingNext(true);
    fetchChapterPages(slug)
      .then(pages => {
        setBlocks([{ chIdx: startIdx, title, slug, pages }]);
        setLoadedIdxs(new Set([startIdx]));
        setLoadingNext(false);
      })
      .catch(e => {
        console.warn(e.message);
        setLoadingNext(false);
      });
  }, [slug]);

  // ── IntersectionObserver — watch sentinels ───────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const chIdx = parseInt(entry.target.dataset.chidx, 10);
          const nextIdx = chIdx + 1;
          if (nextIdx >= chapters.length) {
            setEndReached(true);
            return;
          }
          loadChapter(nextIdx);
        });
      },
      { rootMargin: '400px' } // start loading 400px before reaching sentinel
    );

    // Observe all current sentinels
    Object.values(sentinelRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [blocks, loadChapter, chapters.length]);

  // ── Scroll: track for sticky back-button shadow ──────────
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 20);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  function goBack() {
    nav('/komik/detail?d=' + encodeURIComponent(slug));
  }

  return (
    <div
      ref={pageRef}
      style={{ background:'#0a0a0a', minHeight:'100vh', overflowY:'auto', paddingBottom:60, position:'relative' }}
    >
      {/* ── STICKY BACK BUTTON — floats on top, always visible ── */}
      <button
        onClick={goBack}
        style={{
          position: 'fixed',
          top: 14,
          left: 14,
          zIndex: 200,
          background: scrolled ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '50%',
          width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 16, cursor: 'pointer',
          transition: 'background 0.2s',
          boxShadow: scrolled ? '0 2px 12px rgba(0,0,0,0.6)' : 'none',
        }}
      >
        <i className="fas fa-chevron-left" />
      </button>

      {/* ── TITLE HEADER — normal flow, scrolls away ─────────── */}
      <div style={{
        padding: '12px 14px 10px 62px',
        borderBottom: '1px solid #1a1a1a',
        background: '#0a0a0a',
      }}>
        <div style={{ fontSize:10, color:'#555', fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>{series}</div>
        <div style={{ fontSize:14, color:'#fff', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div>
      </div>

      {/* ── CHAPTER BLOCKS ───────────────────────────────────── */}
      {blocks.map((block) => (
        <div key={block.chIdx}>
          {/* Chapter divider label (skip for first) */}
          {block.chIdx !== startIdx && (
            <div style={{
              padding: '14px 16px 10px',
              borderTop: '2px solid #1e1e1e',
              borderBottom: '1px solid #1a1a1a',
              background: '#0d0d0d',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:1 }}>Chapter selanjutnya</div>
                <div style={{ fontSize:13, color:'#fff', fontWeight:700 }}>{block.title}</div>
              </div>
            </div>
          )}

          {/* Pages */}
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {block.pages.map((pg, i) => {
              const src = typeof pg === 'string' ? pg : (pg.url || pg.src || pg.image || '');
              return (
                <img
                  key={i}
                  src={(src)}
                  alt={`Ch${block.chIdx+1} hal ${i+1}`}
                  loading="lazy"
                  style={{ width:'100%', display:'block' }}
                  onError={e => { e.target.style.opacity = 0.08; }}
                />
              );
            })}
          </div>

          {/* Sentinel — trigger next chapter load */}
          <div
            ref={el => { sentinelRefs.current[block.chIdx] = el; }}
            data-chidx={block.chIdx}
            style={{ height: 1 }}
          />
        </div>
      ))}

      {/* ── LOADING NEXT CHAPTER ─────────────────────────────── */}
      {loadingNext && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'32px 0', gap:12 }}>
          <div className="spinner" />
          <span style={{ color:'#444', fontSize:12 }}>Memuat chapter berikutnya...</span>
        </div>
      )}

      {/* ── END OF SERIES ────────────────────────────────────── */}
      {endReached && !loadingNext && (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'#333' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>🎉</div>
          <div style={{ fontSize:14, fontWeight:700, color:'#555' }}>Tamat</div>
          <div style={{ fontSize:12, color:'#333', marginTop:4 }}>Kamu sudah membaca semua chapter</div>
          <button
            onClick={goBack}
            style={{
              marginTop:20, padding:'10px 24px', borderRadius:10,
              background:'var(--primary)', border:'none',
              color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer',
            }}
          >← Kembali ke Detail</button>
        </div>
      )}
    </div>
  );
}
