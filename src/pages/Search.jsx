import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSearch, fetchKomikSearch, fetchDonghuaSearch, stripQuery } from '../api.js';
import MovieCard from '../components/MovieCard.jsx';

export default function SearchPage({ onCardClick }) {
  const [q, setQ]           = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 3) { setResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(() => doSearch(q.trim()), 450);
  }, [q]);

  async function doSearch(query) {
    setLoading(true);
    const all = [];
    await Promise.allSettled([
      // Film/Series
      fetchSearch(query, 1).then(res => {
        if (res.success && res.items) {
          res.items.forEach(item => all.push({ ...item, _src: 'film', _path: item.detailPath }));
        }
      }).catch(() => {}),
      // Donghua
      fetchDonghuaSearch(query).then(res => {
        const items = res.items || res.results || res.data || [];
        items.forEach(item => all.push({
          title: item.title || item.name,
          poster: stripQuery(item.poster || item.thumbnail || ''),
          _src: 'donghua',
          _slug: item.slug || item.id,
        }));
      }).catch(() => {}),
      // Komik
      fetchKomikSearch(query).then(res => {
        if (res.status === 'ok' && res.data) {
          res.data.forEach(item => all.push({
            title: item.title,
            poster: stripQuery(item.poster || ''),
            _src: 'komik',
            _detailManga: item.detailManga,
          }));
        }
      }).catch(() => {}),
    ]);
    setResults(all);
    setSearched(true);
    setLoading(false);
  }

  function handleClick(item) {
    if (item._src === 'komik') {
      nav(`/komik/detail?d=${encodeURIComponent(item._detailManga)}`);
    } else if (item._src === 'donghua') {
      // donghua coming soon
    } else {
      onCardClick(item);
    }
  }

  const srcBadge = { film: '🎬', donghua: '🐉', komik: '📚' };
  const srcColor = { film: '#e50914', donghua: '#e5a000', komik: '#4CAF50' };

  return (
    <div className="search-page">
      <div className="search-header">
        <div className="search-bar">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Cari film, series, komik..."
            value={q}
            onChange={e => setQ(e.target.value)}
            autoFocus
          />
          {q && (
            <button style={{ background: 'none', border: 'none', color: '#555', fontSize: 16 }}
              onClick={() => { setQ(''); setResults([]); setSearched(false); }}>
              &times;
            </button>
          )}
        </div>
      </div>

      {loading && <div className="spinner-center" style={{ minHeight: 160 }}><div className="spinner" /></div>}

      {searched && !loading && results.length === 0 && (
        <div style={{ textAlign: 'center', color: '#555', padding: '60px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <p>Tidak ada hasil untuk <strong style={{ color: '#fff' }}>"{q}"</strong></p>
        </div>
      )}

      {results.length > 0 && (
        <div className="search-results-grid">
          {results.map((item, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <MovieCard item={item} onClick={() => handleClick(item)} />
              <span style={{
                position: 'absolute', top: 6, right: 6,
                background: srcColor[item._src] || '#333',
                color: '#fff', fontSize: 9, fontWeight: 800,
                padding: '2px 6px', borderRadius: 6,
              }}>
                {srcBadge[item._src]}
              </span>
            </div>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div style={{ textAlign: 'center', color: '#333', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
          <p style={{ fontSize: 14 }}>Ketik minimal 3 huruf untuk mencari</p>
        </div>
      )}
    </div>
  );
}
