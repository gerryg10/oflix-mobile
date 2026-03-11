import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const KOMIK_API = '/komik_api.php';

async function fetchChapterPages(slug) {
  const res  = await fetch(`${KOMIK_API}?action=baca&bacaManga=${encodeURIComponent(slug)}`);
  const data = await res.json();
  if (data.status === 'ok' && data.images?.length) return data.images;
  throw new Error(data.message || 'Gagal memuat');
}

export default function BacaPage() {
  const [params] = useSearchParams();
  const nav      = useNavigate();

  const slug     = params.get('m')     || '';
  const title    = params.get('title') || '';
  const startIdx = parseInt(params.get('idx') || '0', 10);

  const chapters = (() => {
    try { return JSON.parse(sessionStorage.getItem('komik_chapters')) || []; } catch { return []; }
  })();
  const series = sessionStorage.getItem('komik_series') || '';

  // Each block = { chIdx, title, slug, pages }
  const [blocks,      setBlocks]      = useState([]);
  const [loadedSet,   setLoadedSet]   = useState(new Set());
  const [loadingNext, setLoadingNext] = useState(false);
  const [endReached,  setEndReached]  = useState(false);
  const [scrolled,    setScrolled]    = useState(false);

  // Track which chapter is currently "ready to trigger next"
  // Only allow trigger after current chapter images have all loaded
  const readyRef      = useRef(false);   // true = first chapter done loading
  const loadingRef    = useRef(false);   // prevent double-trigger
  const sentinelRef   = useRef(null);    // single sentinel at bottom of last block
  const containerRef  = useRef(null);

  // ── Initial load ────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    readyRef.current   = false;
    loadingRef.current = false;
    setBlocks([]);
    setLoadedSet(new Set());
    setEndReached(false);
    setLoadingNext(true);

    fetchChapterPages(slug)
      .then(pages => {
        setBlocks([{ chIdx: startIdx, title, slug, pages }]);
        setLoadedSet(new Set([startIdx]));
        setLoadingNext(false);
        // Give images time to render before enabling infinite scroll
        setTimeout(() => { readyRef.current = true; }, 1500);
      })
      .catch(e => { console.warn(e); setLoadingNext(false); });
  }, [slug]);

  // ── Load next chapter ────────────────────────────────────
  function loadNext(currentBlocks, currentSet) {
    if (loadingRef.current || endReached) return;
    const lastBlock = currentBlocks[currentBlocks.length - 1];
    if (!lastBlock) return;
    const nextIdx = lastBlock.chIdx + 1;
    if (nextIdx >= chapters.length) { setEndReached(true); return; }
    if (currentSet.has(nextIdx)) return;

    loadingRef.current = true;
    readyRef.current   = false; // pause trigger until new chapter renders
    setLoadingNext(true);

    const ch = chapters[nextIdx];
    fetchChapterPages(ch.url)
      .then(pages => {
        setBlocks(prev => {
          const next = [...prev, { chIdx: nextIdx, title: ch.title, slug: ch.url, pages }];
          return next;
        });
        setLoadedSet(prev => new Set([...prev, nextIdx]));
        setLoadingNext(false);
        loadingRef.current = false;
        // Re-enable after new chapter renders
        setTimeout(() => { readyRef.current = true; }, 1500);
      })
      .catch(e => {
        console.warn(e);
        setLoadingNext(false);
        loadingRef.current = false;
      });
  }

  // ── IntersectionObserver on sentinel ────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && readyRef.current && !loadingRef.current) {
          // Capture current state at trigger time
          setBlocks(prev => {
            setLoadedSet(prevSet => {
              loadNext(prev, prevSet);
              return prevSet;
            });
            return prev;
          });
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [blocks.length, endReached]); // re-attach when new block added

  // ── Scroll: sticky back button shadow ───────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 30);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ background: '#0a0a0a', minHeight: '100vh', overflowY: 'auto', position: 'relative' }}
    >
      {/* ── FLOATING BACK BUTTON — always sticky ── */}
      <button
        onClick={() => nav('/komik/detail?d=' + encodeURIComponent(slug))}
        style={{
          position:       'fixed',
          top:            14,
          left:           14,
          zIndex:         300,
          background:     scrolled ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(10px)',
          border:         '1px solid rgba(255,255,255,0.12)',
          borderRadius:   '50%',
          width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 16, cursor: 'pointer',
          boxShadow:  scrolled ? '0 2px 16px rgba(0,0,0,0.7)' : 'none',
          transition: 'background 0.2s, box-shadow 0.2s',
        }}
      >
        <i className="fas fa-chevron-left" />
      </button>

      {/* ── TITLE — normal flow, scrolls away ── */}
      <div style={{
        padding:      '12px 14px 10px 66px',
        borderBottom: '1px solid #1a1a1a',
      }}>
        <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          {series}
        </div>
        <div style={{ fontSize: 14, color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
      </div>

      {/* ── CHAPTER BLOCKS ── */}
      {blocks.map((block, bi) => (
        <div key={block.chIdx}>
          {/* Chapter divider for subsequent chapters */}
          {bi > 0 && (
            <div style={{
              padding: '16px 16px 12px',
              borderTop: '3px solid #1e1e1e',
              background: '#0d0d0d',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Chapter selanjutnya
                </div>
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 700 }}>
                  {block.title}
                </div>
              </div>
            </div>
          )}

          {/* Pages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {block.pages.map((pg, i) => {
              const src = typeof pg === 'string' ? pg : (pg.url || pg.src || pg.image || '');
              return (
                <img
                  key={i}
                  src={src}
                  alt={`Ch${block.chIdx + 1} p${i + 1}`}
                  loading="lazy"
                  style={{ width: '100%', display: 'block' }}
                  onError={e => { e.target.style.opacity = '0.08'; }}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* ── SENTINEL — IntersectionObserver target ── */}
      {!endReached && (
        <div ref={sentinelRef} style={{ height: 1 }} />
      )}

      {/* ── LOADING SPINNER ── */}
      {loadingNext && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 0', gap: 12 }}>
          <div className="spinner" />
          <span style={{ color: '#444', fontSize: 12 }}>Memuat chapter berikutnya...</span>
        </div>
      )}

      {/* ── END OF SERIES ── */}
      {endReached && !loadingNext && (
        <div style={{ textAlign: 'center', padding: '48px 20px 80px', color: '#333' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#555' }}>Tamat</div>
          <div style={{ fontSize: 12, color: '#333', marginTop: 6 }}>Semua chapter sudah dibaca</div>
          <button
            onClick={() => nav('/komik/detail?d=' + encodeURIComponent(slug))}
            style={{
              marginTop: 20, padding: '10px 28px', borderRadius: 10,
              background: 'var(--primary)', border: 'none',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >← Kembali ke Detail</button>
        </div>
      )}

      {/* Bottom padding so last content isn't hidden behind nav */}
      <div style={{ height: 60 }} />
    </div>
  );
}
