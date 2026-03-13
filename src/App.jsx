import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Preloader   from './components/Preloader.jsx';
import BottomNav   from './components/BottomNav.jsx';
import AppHeader      from './components/AppHeader.jsx';
import CategoryTabs   from './components/CategoryTabs.jsx';
import AuthModal   from './components/AuthModal.jsx';
import Home        from './pages/Home.jsx';
import FilmPage    from './pages/Film.jsx';
import SeriesPage  from './pages/Series.jsx';
import DonghuaPage from './pages/Donghua.jsx';
import KomikPage   from './pages/Komik.jsx';
import KomikDetail from './pages/KomikDetail.jsx';
import SearchPage  from './pages/Search.jsx';
import DetailPage  from './pages/Detail.jsx';

const FULL_ROUTES   = ['/detail'];   // no header, no bottom nav, no padding
const NO_NAV_ROUTES = ['/detail'];

function AppInner() {
  const nav = useNavigate();
  const loc = useLocation();
  const [ready, setReady]       = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const isFull  = FULL_ROUTES.some(r => loc.pathname.startsWith(r));
  const hideNav = NO_NAV_ROUTES.some(r => loc.pathname.startsWith(r));

  function handleCardClick(item) {
    if (item?.detailPath) nav(`/detail?p=${encodeURIComponent(item.detailPath)}`);
  }

  return (
    <>
      {!ready && <Preloader onDone={() => setReady(true)} />}
      {ready && (
        <>
          <AppHeader />
          <CategoryTabs />
          {/* main wrapper — no padding on full-screen routes */}
          <div className={isFull ? 'full-page' : 'home-main'}>
            <Routes>
              <Route path="/"             element={<Home        onCardClick={handleCardClick} />} />
              <Route path="/film"         element={<FilmPage    onCardClick={handleCardClick} />} />
              <Route path="/series"       element={<SeriesPage  onCardClick={handleCardClick} />} />
              <Route path="/donghua"      element={<DonghuaPage />} />
              <Route path="/komik"        element={<KomikPage />} />
              <Route path="/komik/detail" element={<KomikDetail />} />
              <Route path="/search"       element={<SearchPage  onCardClick={handleCardClick} />} />
              <Route path="/detail"       element={<DetailPage />} />
            </Routes>
          </div>
          {!hideNav && <BottomNav onAccountClick={() => setShowAuth(true)} />}
          {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        </>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </BrowserRouter>
  );
}
