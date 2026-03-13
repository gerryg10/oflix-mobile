import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

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
  const { saveKomikProgress } = useAuth();

  const slug     = params.get('m')     || '';
  const title    = params.get('title') || '';
  const startIdx = parseInt(params.get('idx') || '0', 10);
  const series   = params.get('series') || sessionStorage.getItem('komik_series') || '';
  const poster   = params.get('poster') || '';

  const chapters = (() => {
    try { return JSON.parse(sessionStorage.getItem('komik_chapters')) || []; } catch { return []; }
  })();

  // Each block = { chIdx, title, slug, pages }
  const [blocks,      setBlocks]      = useState([]);
  const [loadedSet,   setLoadedSet]   = useState(new Set());
  const [loadingNext, setLoadingNext] = useState(false);
  const [endReached,  setEndReached]  = useState(false);
  const [curChTitle,  setCurChTitle]  = useState(title);

  const readyRef    = useRef(false);
  const loadingRef  = useRef(false);
  const sentinelRef = useRef(null);
  const containerRef = useRef(null);

  // ── Initial load ────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    readyRef.current   = false;
    loadingRef.current = false;
    setBlocks([]);
    setLoadedSet(new Set());
    setEndReached(false);
    setLoadingNext(true);
    setCurChTitle(title);

    fetchChapterPages(slug)
      .then(pages => {
        setBlocks([{ chIdx: startIdx, title, slug, pages }]);
        setLoadedSet(new Set([startIdx]));
        setLoadingNext(false);
        // Save progress
        saveKomikProgress(slug, startIdx, title, poster, series);
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
    readyRef.current   = false;
    setLoadingNext(true);

    const ch = chapters[nextIdx];
    fetchChapterPages(ch.url)
      .then(pages => {
        setBlocks(prev => {
          const next = [...prev, { chIdx: nextIdx, title: ch.title, slug: ch.url, pages }];
          return next;
        });
        setLoadedSet(prev => new Set([...prev, nextIdx]));
        setCurChTitle(ch.title);
        setLoadingNext(false);
        loadingRef.current = false;
        // Save progress for new chapter
        saveKomikProgress(slug, nextIdx, ch.title, poster, series);
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
  }, [blocks.length, endReached]);

  const goBack = () => nav('/komik/detail?d=' + encodeURIComponent(slug));

  return (
    <div
      ref={containerRef}
      style={{ background: '#0a0a0a', minHeight: '100vh', position: 'relative', paddingTop: 56 }}
    >
      {/* ── STICKY HEADER — always visible ── */}
      <div style={{
        position:       'fixed',
        top:            0,
        left:           0,
        right:          0,
        zIndex:         300,
        height:         56,
        background:     'rgba(10,10,10,0.97)',
        backdropFilter: 'blur(14px)',
        borderBottom:   '1px solid #1a1a1a',
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        padding:        '0 14px',
      }}>
        {/* Back button — red circle like contoh */}
        <button
          onClick={goBack}
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background:   'var(--primary)',
            border:       'none',
            display:      'flex', alignItems: 'center', justifyContent: 'center',
            color:        '#fff', fontSize: 15, cursor: 'pointer',
          }}
        >
          <i className="fas fa-chevron-left" />
        </button>

        {/* Title + Chapter */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, color: '#aaa', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.8,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {series || slug}
          </div>
          <div style={{
            fontSize: 13, color: '#fff', fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {curChTitle}
          </div>
        </div>
      </div>

      {/* ── CHAPTER BLOCKS ── */}
      {blocks.map((block, bi) => (
        <div key={block.chIdx}>
          {/* Chapter divider for subsequent chapters */}
          {bi > 0 && (
            <div style={{
              padding: '14px 16px 12px',
              borderTop: '3px solid #1e1e1e',
              background: '#0d0d0d',
            }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
                Chapter selanjutnya
              </div>
              <div style={{ fontSize: 14, color: '#fff', fontWeight: 700 }}>
                {block.title}
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

      {/* ── SENTINEL ── */}
      {!endReached && (
        <div ref={sentinelRef} style={{ height: 1 }} />
      )}

      {/* ── LOADING ── */}
      {loadingNext && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 0', gap: 12 }}>
          <div className="spinner" />
          <span style={{ color: '#444', fontSize: 12 }}>Memuat chapter berikutnya...</span>
        </div>
      )}

      {/* ── END ── */}
      {endReached && !loadingNext && (
        <div style={{ textAlign: 'center', padding: '48px 20px 80px', color: '#333' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#555' }}>Tamat</div>
          <div style={{ fontSize: 12, color: '#333', marginTop: 6 }}>Semua chapter sudah dibaca</div>
          <button
            onClick={goBack}
            style={{
              marginTop: 20, padding: '10px 28px', borderRadius: 10,
              background: 'var(--primary)', border: 'none',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >← Kembali ke Detail</button>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
