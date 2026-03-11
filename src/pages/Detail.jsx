import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchDetail, fetchStream, parseFoodcashUrl } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';

function toArr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(',').map(s=>s.trim()).filter(Boolean);
  return [];
}

const FALLBACK_CAST_SVG = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect fill='%23222' width='40' height='40' rx='20'/><circle cx='20' cy='14' r='7' fill='%23444'/><path d='M4 38c0-9 7-14 16-14s16 5 16 14' fill='%23444'/></svg>`;

export default function DetailPage() {
  const [params]   = useSearchParams();
  const detailPath = params.get('p') || '';
  const nav        = useNavigate();
  const { user, saveCW, getSavedProgress, addToWatchlist, removeFromWatchlist, isInWatchlist } = useAuth();

  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [playerData, setPlayerData] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(0);
  const [currentEp, setCurrentEp]   = useState(-1);
  const [liked, setLiked]           = useState(false);
  const [disliked, setDisliked]     = useState(false);
  const [inList, setInList]         = useState(false);

  useEffect(() => {
    if (!detailPath) return;
    setLoading(true); setError('');
    fetchDetail(detailPath)
      .then(res => {
        if (res.success && res.data) setData(res.data);
        else setError(JSON.stringify(res).slice(0, 200));
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });

    setLiked(localStorage.getItem(`oflix_like_${detailPath}`) === '1');
    setDisliked(localStorage.getItem(`oflix_dislike_${detailPath}`) === '1');
    setInList(isInWatchlist(detailPath));
  }, [detailPath]);

  async function playVideo(epIdx = -1, sIdx = 0) {
    if (!data) return;
    setPlayerLoading(true);
    try {
      const isMovie  = !data.seasons?.length;
      const sourceUrl = isMovie
        ? (data.playerUrl || data.sources?.[0]?.url || '')
        : (data.seasons?.[sIdx]?.episodes?.[epIdx]?.playerUrl || data.seasons?.[sIdx]?.episodes?.[epIdx]?.url || '');

      if (!sourceUrl) { setPlayerLoading(false); return; }
      const parsed = parseFoodcashUrl(sourceUrl);
      if (!parsed.id) { setPlayerLoading(false); return; }

      const seasonVal  = isMovie ? '' : (data.seasons[sIdx]?.season || sIdx + 1);
      const episodeVal = isMovie ? '' : (data.seasons[sIdx]?.episodes?.[epIdx]?.episode || epIdx + 1);
      const res = await fetchStream(parsed.id, seasonVal, episodeVal, detailPath);
      if (!res.success) { setPlayerLoading(false); return; }

      // Pass ALL quality options so VideoPlayer can switch
      const downloads = [];
      if (res.downloads?.length) {
        const sorted = [...res.downloads].sort((a,b) => (a.resolution||0)-(b.resolution||0));
        sorted.forEach(d => { if (d.url) downloads.push({ label: d.resolution ? d.resolution+'p' : 'Auto', url: d.url }); });
      }
      // fallback single URL
      const finalUrl = downloads.length ? downloads[0].url : (res.url || '');

      const subtitles = [];
      if (res.captions?.length) {
        const seen = new Set();
        [
          { code:'in_id', label:'Indonesia' },
          { code:'id',    label:'Indonesia' },
          { code:'en',    label:'English'   },
        ].forEach(({ code, label }) => {
          const cap = res.captions.find(c => c?.url && (c.languageCode===code || c.lan===code));
          if (!cap || seen.has(label)) return;
          seen.add(label);
          // subtitle-proxy.php converts SRT→VTT and returns with CORS header
          subtitles.push({
            url: `/subtitle-proxy.php?url=${encodeURIComponent(cap.url)}`,
            name: label,
            language: code,
          });
        });
      }

      const saved = getSavedProgress(detailPath, epIdx);
      setCurrentSeason(sIdx); setCurrentEp(epIdx);
      setPlayerData({ url: finalUrl, downloads, subtitles, savedTime: saved?.time || 0 });
    } catch(e) { console.error('playVideo', e); }
    setPlayerLoading(false);
  }

  function handleWatchBtn() {
    if (!data) return;
    const isMovie = !data.seasons?.length;
    if (isMovie) { playVideo(-1, 0); return; }
    const saved = getSavedProgress(detailPath);
    if (saved && saved.episode >= 0) playVideo(saved.episode, saved.seasonIdx || 0);
    else playVideo(0, 0);
  }

  function handleSaveCW(progress) {
    if (!data) return;
    saveCW({ title: data.title, detailPath, poster: data.poster || '', ...progress });
  }

  function toggleLike()    { const v=!liked;    setLiked(v);    if(v) setDisliked(false); localStorage.setItem(`oflix_like_${detailPath}`,v?'1':'0'); localStorage.setItem(`oflix_dislike_${detailPath}`,'0'); }
  function toggleDislike() { const v=!disliked; setDisliked(v); if(v) setLiked(false);   localStorage.setItem(`oflix_dislike_${detailPath}`,v?'1':'0'); localStorage.setItem(`oflix_like_${detailPath}`,'0'); }
  function toggleList() {
    const v = !inList;
    setInList(v);
    if (v) addToWatchlist({ title: data?.title, detailPath, poster: data?.poster || '' });
    else removeFromWatchlist(detailPath);
  }

  if (playerData) {
    const seasons = data?.seasons || [];
    const title   = data?.title || '';
    const epTitle = currentEp >= 0 && seasons[currentSeason]?.episodes?.[currentEp]
      ? `S${seasons[currentSeason].season||currentSeason+1} E${seasons[currentSeason].episodes[currentEp].episode||currentEp+1}` : '';
    return (
      <VideoPlayer
        url={playerData.url} title={epTitle ? `${title} · ${epTitle}` : title}
        downloads={playerData.downloads||[]} subtitles={playerData.subtitles} savedTime={playerData.savedTime}
        seasons={seasons} currentSeasonIdx={currentSeason} currentEpIdx={currentEp}
        onEpisodeChange={(si,ei) => playVideo(ei, si)}
        onClose={() => setPlayerData(null)}
        onSaveCW={handleSaveCW}
      />
    );
  }

  if (loading) return (
    <div className="detail-page">
      <div className="spinner-center" style={{ minHeight:'60vh' }}><div className="spinner" /></div>
    </div>
  );

  if (error || !data) return (
    <div className="detail-page" style={{ padding:24 }}>
      <button onClick={() => nav(-1)} style={{ background:'none', border:'none', color:'#888', marginBottom:16, cursor:'pointer' }}>← Kembali</button>
      <div style={{ background:'#1a0a0a', border:'1px solid #440000', borderRadius:10, padding:16 }}>
        <div style={{ color:'#ff6b6b', fontWeight:700, marginBottom:8 }}>Gagal memuat detail</div>
        <div style={{ color:'#555', fontSize:11, fontFamily:'monospace', wordBreak:'break-all' }}>{error || 'Data kosong'}</div>
      </div>
    </div>
  );

  const isMovie   = !data.seasons?.length;
  const genres    = toArr(data.genre || data.genres);
  const hasCW     = !!getSavedProgress(detailPath);
  const watchLabel = isMovie ? '▶ Tonton Film' : (hasCW ? '▶ Lanjutkan Nonton' : '▶ Tonton Ep. 1');

  return (
    <div className="detail-page">
      <div className="detail-hero">
        <img src={(data.poster || '')} alt={data.title} onError={e=>{e.target.style.opacity=0.1;}} />
        <div className="detail-hero-overlay" />
        <button className="detail-hero-back" onClick={() => nav(-1)}>
          <i className="fas fa-chevron-left"></i>
        </button>
      </div>

      <div className="detail-content">
        <h1 className="detail-title">{data.title}</h1>
        <div className="detail-meta">
          {data.year   && <span className="meta-badge">{data.year}</span>}
          {data.rating && <span className="meta-badge">⭐ {data.rating}</span>}
          {genres.slice(0,3).map((g,i)=><span key={i} className="meta-badge">{g}</span>)}
          <span className="meta-badge" style={{ background:'rgba(229,9,20,0.15)', color:'var(--primary)' }}>{isMovie?'Film':'Series'}</span>
        </div>

        <div className="detail-btns">
          <button className="btn-watch" onClick={handleWatchBtn} disabled={playerLoading} style={{ opacity:playerLoading?0.7:1 }}>
            {playerLoading
              ? <><div className="spinner" style={{ width:18,height:18,borderWidth:2 }}></div> Memuat...</>
              : <><i className="fas fa-play"></i> {watchLabel}</>}
          </button>
          {data.trailerUrl && (
            <button className="btn-watch" style={{ background:'#1a1a1a', border:'1px solid #333', color:'#ccc', flex:'0 0 auto', minWidth:'auto', padding:'13px 16px' }}
              onClick={() => setPlayerData({ url:data.trailerUrl, subtitles:[], savedTime:0 })}>
              <i className="fas fa-film"></i>
            </button>
          )}
        </div>

        <div style={{ display:'flex', gap:14, marginBottom:20 }}>
          {[
            { label:'DAFTAR',   icon:inList?'fa-check':'fa-plus',  active:inList,   fn:toggleList    },
            { label:'SUKA',     icon:'fa-thumbs-up',               active:liked,    fn:toggleLike    },
            { label:'TDK SUKA', icon:'fa-thumbs-down',             active:disliked, fn:toggleDislike },
          ].map(({ label, icon, active, fn }) => (
            <div key={label} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <button className={`btn-icon-action ${active?'active':''}`} onClick={fn}>
                <i className={`fas ${icon}`}></i>
              </button>
              <span style={{ fontSize:9, color:'#555', fontWeight:700 }}>{label}</span>
            </div>
          ))}
        </div>

        {data.description && <p className="detail-desc">{data.description}</p>}

        <div className="detail-info-row">
          {data.country  && <span className="info-chip"><strong>Negara:</strong> {data.country}</span>}
          {data.duration && <span className="info-chip"><strong>Durasi:</strong> {data.duration}</span>}
          {data.network  && <span className="info-chip"><strong>Network:</strong> {data.network}</span>}
        </div>

        {toArr(data.cast).length > 0 && (
          <section style={{ marginBottom:24 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:12 }}>Pemeran</div>
            <div className="cast-scroll">
              {toArr(data.cast).map((c,i)=>(
                <div key={i} className="cast-item">
                  <img className="cast-avatar" src={(c.avatar || '')} alt={c.name}
                    onError={e => { e.target.onerror=null; e.target.src=FALLBACK_CAST_SVG; }} />
                  <span className="cast-name">{c.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {!isMovie && data.seasons?.length > 0 && (
          <section style={{ marginBottom:24 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:12 }}>Episode</div>
            {data.seasons.length > 1 && (
              <div className="season-tabs">
                {data.seasons.map((s,si)=>(
                  <button key={si} className={`season-tab ${si===currentSeason?'active':''}`}
                    onClick={()=>setCurrentSeason(si)}>Season {s.season||si+1}</button>
                ))}
              </div>
            )}
            <div>
              {(data.seasons[currentSeason]?.episodes||[]).map((ep,ei)=>(
                <div key={ei} className="ep-item" onClick={()=>playVideo(ei,currentSeason)}>
                  <div className={`ep-num ${ei===currentEp?'active':''}`}>{ep.episode||ei+1}</div>
                  <div className="ep-info"><div className="ep-title">{ep.title||`Episode ${ep.episode||ei+1}`}</div></div>
                  <i className="fas fa-play ep-play"></i>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
