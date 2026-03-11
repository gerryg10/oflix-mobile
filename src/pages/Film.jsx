import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchCategory } from '../api.js';
import MovieCard from '../components/MovieCard.jsx';

const CAT_LABELS = {
  'trending':          '🔥 Trending',
  'indonesian-movies': '🇮🇩 Film Indonesia',
  'western':           '🇺🇸 Film Barat',
};

export default function FilmPage({ onCardClick }) {
  const [params] = useSearchParams();
  const cat      = params.get('cat') || 'trending';
  const [items, setItems]   = useState([]);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadedRef = useRef(false);

  async function loadPage(p, append = false) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetchCategory(cat, p);
      if (res.success && res.items?.length) {
        setItems(prev => append ? [...prev, ...res.items] : res.items);
        setPage(p);
        setHasMore(res.items.length >= 1);
      } else {
        setHasMore(false);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    setItems([]); setPage(1); setHasMore(true);
    loadPage(1, false);
  }, [cat]);

  return (
    <div className="listing-page">
      <h2 className="listing-title">{CAT_LABELS[cat] || '🎬 Film'}</h2>
      <div className="listing-grid">
        {items.map((item, i) => (
          <MovieCard key={i} item={item} onClick={onCardClick} />
        ))}
      </div>
      {loading && <div className="spinner-center"><div className="spinner" /></div>}
      {hasMore && !loading && (
        <button className="load-more-btn" onClick={() => loadPage(page + 1, true)}>
          Muat Lebih Banyak
        </button>
      )}
    </div>
  );
}
