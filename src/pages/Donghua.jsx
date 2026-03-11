export default function DonghuaPage() {
  return (
    <div className="listing-page">
      <div className="coming-soon-page">
        <div className="coming-soon-icon">🐉</div>
        <h1 className="coming-soon-title">Donghua</h1>
        <p className="coming-soon-sub">
          Konten Donghua sedang dalam persiapan.<br />
          Segera hadir! Nantikan update terbaru kami.
        </p>
        <div style={{ marginTop: 30, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Battle Through the Heavens','Soul Land','Dragon Prince Yuan','Against the Gods'].map(t => (
            <span key={t} style={{
              background: '#1a1a1a', border: '1px solid #2a2a2a',
              color: '#666', fontSize: 11, padding: '5px 12px', borderRadius: 20
            }}>{t}</span>
          ))}
        </div>
        <p style={{ marginTop: 20, fontSize: 12, color: '#444' }}>dan banyak lagi...</p>
      </div>
    </div>
  );
}
