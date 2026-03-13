import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const HIDE_ROUTES = ['/detail', '/komik/detail', '/baca', '/search'];

export default function AppHeader() {
  const hiddenRef     = useRef(false);
  const lastScrollRef = useRef(0);
  const headerRef     = useRef(null);
  const loc           = useLocation();

  const isHiddenRoute = HIDE_ROUTES.some(r => loc.pathname.startsWith(r));

  useEffect(() => {
    const el = document.getElementById('root');
    if (!el) return;
    function onScroll() {
      const st  = el.scrollTop;
      const hdr = headerRef.current;
      if (!hdr) return;
      if (st > 40) hdr.classList.add('scrolled');
      else         hdr.classList.remove('scrolled');
      const diff = st - lastScrollRef.current;
      if (diff > 4 && st > 80 && !hiddenRef.current) {
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

  return (
    <header ref={headerRef} className="app-header">
      <div className="header-top">
        <img src="/logo1.png" alt="OFLIX" className="header-logo"
          onError={e => { e.target.style.display = 'none'; }} />
      </div>
    </header>
  );
}
