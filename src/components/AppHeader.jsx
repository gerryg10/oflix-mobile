import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const CATS = [
  { label: '🏠 Beranda', path: '/'        },
  { label: '🎬 Film',    path: '/film'    },
  { label: '📺 Series',  path: '/series'  },
  { label: '🐉 Donghua', path: '/donghua' },
  { label: '📚 Komik',   path: '/komik'   },
];

const HIDE_ROUTES = ['/detail', '/komik/detail', '/baca'];

export default function AppHeader() {
  const scrolledRef   = useRef(false);
  const hiddenRef     = useRef(false);
  const lastScrollRef = useRef(0);
  const headerRef     = useRef(null);
  const nav = useNavigate();
  const loc = useLocation();

  const isHiddenRoute = HIDE_ROUTES.some(r => loc.pathname.startsWith(r));

  useEffect(() => {
    const el = document.getElementById('root');
    if (!el) return;

    function onScroll() {
      const st  = el.scrollTop;
      const hdr = headerRef.current;
      if (!hdr) return;

      // scrolled background
      if (st > 40 && !scrolledRef.current) {
        scrolledRef.current = true;
        hdr.classList.add('scrolled');
      } else if (st <= 40 && scrolledRef.current) {
        scrolledRef.current = false;
        hdr.classList.remove('scrolled');
      }

      // auto-hide: going down → hide, going up → show
      const diff = st - lastScrollRef.current;
      if (diff > 4 && st > 100 && !hiddenRef.current) {
        hiddenRef.current = true;
        hdr.classList.add('header-hidden');
      } else if (diff < -4 && hiddenRef.current) {
        hiddenRef.current = false;
        hdr.classList.remove('header-hidden');
      }
      lastScrollRef.current = st;
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  if (isHiddenRoute) return null;

  function activeCat() {
    if (loc.pathname === '/') return '/';
    return CATS.slice(1).find(c => loc.pathname.startsWith(c.path))?.path || '';
  }

  return (
    <header ref={headerRef} className="app-header">
      <div className="header-top">
        <img src="/logo.svg" alt="OFLIX" className="header-logo"
          onError={e => { e.target.style.display = 'none'; }} />
      </div>
      <div className="category-tabs">
        {CATS.map(cat => (
          <a key={cat.path}
            className={`cat-tab ${activeCat() === cat.path ? 'active' : ''}`}
            onClick={e => { e.preventDefault(); nav(cat.path); }}
            href={cat.path}>
            {cat.label}
          </a>
        ))}
      </div>
    </header>
  );
}
