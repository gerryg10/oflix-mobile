import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCategory, fetchDetail } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import HorizontalSection from '../components/HorizontalSection.jsx';

const SECTIONS = [
  { action: 'trending',          title: '🔥 Trending',        seeMore: '/film'   },
  { action: 'indonesian-movies', title: '🇮🇩 Film Indonesia',  seeMore: '/film?cat=indonesian-movies' },
  { action: 'indonesian-drama',  title: '🎭 Drama Indonesia',  seeMore: '/series?cat=indonesian-drama' },
  { action: 'kdrama',            title: '🇰🇷 K-Drama',         seeMore: '/series?cat=kdrama' },
  { action: 'anime',             title: '⛩️ Anime',            seeMore: '/series?cat=anime' },
  { action: 'western-tv',        title: '🇺🇸 Series Barat',    seeMore: '/series?cat=western-tv' },
  { action: 'short-tv',          title: '📱 Drama Box',         seeMore: '/series?cat=short-tv' },
];

function HeroBanner({ hero, onCardClick }) {
  const [showVideo, setShowVideo] = useState(false);
  const [muted, setMuted]         = useState(true);
  const [trailerUrl, setTrailerUrl] = useState('');
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!hero) return;
    setShowVideo(false);
    setTrailerUrl('');

    // Fetch detail to get trailerUrl after 5s
    timerRef.current = setTimeout(() => {
      if (!hero.detailPath) return;
      fetchDetail(hero.detailPath)
        .then(res => {
          if (res?.data?.trailerUrl) {
            setTrailerUrl(res.data.trailerUrl);
            setShowVideo(true);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearTimeout(timerRef.current);
  }, [hero?.detailPath]);

  if (!hero) return null;

  return (
    <div className="hero-banner" onClick={() => onCardClick(hero)}>
      <img src={(hero.poster)} alt={hero.title}
        style={{ display: showVideo ? 'none' : 'block' }}
        onError={e => { e.target.style.display='none'; }} />
      {showVideo && trailerUrl && (
        <video
          ref={videoRef}
          src={trailerUrl}
          autoPlay
          muted={muted}
          loop
          playsInline
          style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
        />
      )}
      <div className="hero-overlay" />
      <div className="hero-content">
        <div className="hero-title">{hero.title}</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button className="hero-play-btn" onClick={e => { e.stopPropagation(); onCardClick(hero); }}>
            <i className="fas fa-play"></i> Tonton
          </button>
          {showVideo && (
            <button className="hero-mute-btn" onClick={e => { e.stopPropagation(); setMuted(v=>!v); }}>
              <i className={`fas ${muted ? 'fa-volume-mute' : 'fa-volume-up'}`}></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home({ onCardClick }) {
  const [sections, setSections]       = useState({});
  const [hero, setHero]               = useState(null);
  const [apiError, setApiError]       = useState('');
  const [loadingFirst, setLoadingFirst] = useState(true);
  const nav = useNavigate();
  const { getAllCW, getWatchlist, getAllKomikProgress } = useAuth();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    fetchCategory('trending', 1)
      .then(res => {
        setLoadingFirst(false);
        if (res.success && res.items?.length) {
          setSections(prev => ({ ...prev, trending: res.items }));
          const rndIdx = Math.floor(Math.random() * Math.min(5, res.items.length));
          setHero(res.items[rndIdx]);
        } else {
          setApiError('API response: ' + JSON.stringify(res).slice(0, 150));
        }
      })
      .catch(err => { setLoadingFirst(false); setApiError('Fetch error: ' + err.message); });

    SECTIONS.slice(1).forEach(async sec => {
      try {
        const res = await fetchCategory(sec.action, 1);
        if (res.success && res.items?.length)
          setSections(prev => ({ ...prev, [sec.action]: res.items }));
      } catch {}
    });
  }, []);

  const cwItems    = getAllCW();
  const komikItems = getAllKomikProgress ? getAllKomikProgress() : [];
  // Merge and sort by savedAt
  const allCwItems = [...cwItems, ...komikItems].sort((a,b) => (b.savedAt||0)-(a.savedAt||0)).slice(0,15);
  const wlItems    = getWatchlist ? getWatchlist() : [];

  return (
    <div>
      {loadingFirst && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:16 }}>
          <div className="spinner" />
          <span style={{ color:'#555', fontSize:12 }}>Memuat konten...</span>
        </div>
      )}

      {apiError && !loadingFirst && (
        <div style={{ margin:14, padding:14, background:'#1a0a0a', border:'1px solid #440000', borderRadius:10 }}>
          <div style={{ color:'#ff6b6b', fontSize:12, fontWeight:700, marginBottom:6 }}>⚠️ Gagal load API</div>
          <div style={{ color:'#666', fontSize:10, fontFamily:'monospace', wordBreak:'break-all' }}>{apiError}</div>
        </div>
      )}

      <HeroBanner hero={!loadingFirst ? hero : null} onCardClick={onCardClick} />

      {/* Continue Watching */}
      {allCwItems.length > 0 && (
        <section className="cw-section fade-up">
          <div className="h-section-header"><h2 className="h-section-title">▶ Lanjut Nonton/Baca</h2></div>
          <div className="cw-scroll">
            {allCwItems.map((item, i) => {
              const isKomik = item.type === 'komik';
              const pct     = !isKomik && item.duration > 0 ? Math.min(100, Math.round((item.time/item.duration)*100)) : 0;
              const epLabel = isKomik
                ? (item.chapterTitle || `Ch ${(item.chapterIdx||0)+1}`)
                : (item.episode === -1 ? '' : `S${(item.seasonIdx||0)+1} E${(item.episode||0)+1}`);
              const handleClick = () => {
                if (isKomik) {
                  nav(`/komik/detail?d=${encodeURIComponent(item.slug)}`);
                } else {
                  onCardClick(item);
                }
              };
              return (
                <div key={i} className="cw-card" onClick={handleClick}>
                  <img src={(item.poster||'')} alt={item.seriesTitle||item.title||''} />
                  {isKomik && (
                    <div style={{ position:'absolute', top:6, left:6, background:'var(--primary)', borderRadius:4, fontSize:8, fontWeight:900, color:'#fff', padding:'2px 5px', letterSpacing:0.5 }}>KOMIK</div>
                  )}
                  <div className="cw-card-info">
                    <div className="cw-card-title">{item.seriesTitle||item.title||''}</div>
                    {epLabel && <div className="cw-card-ep">{epLabel}</div>}
                    {!isKomik && <div className="cw-progress-wrap"><div className="cw-progress-bar" style={{ width:pct+'%' }} /></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Watchlist */}
      {wlItems.length > 0 && (
        <section className="cw-section fade-up">
          <div className="h-section-header"><h2 className="h-section-title">+ Daftar Saya</h2></div>
          <div className="h-scroll">
            {wlItems.map((item, i) => (
              <div key={i} className="movie-card" style={{ width:110, flexShrink:0 }} onClick={() => onCardClick(item)}>
                <img src={(item.poster||'')} alt={item.title} />
                <div className="card-label">{item.title}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {SECTIONS.map(sec => {
        const items = sections[sec.action];
        if (!items?.length) return null;
        return <HorizontalSection key={sec.action} title={sec.title} items={items} seeMorePath={sec.seeMore} onCardClick={onCardClick} />;
      })}
    </div>
  );
}
