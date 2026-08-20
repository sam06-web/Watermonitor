import { useEffect, useRef, useState } from 'react';

export default function RiverSearch({ onSelectRiver }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/satellite/search?river=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.success && !cancelled) {
          setSearchResults(data.rivers || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  return (
    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '750px' }}>
        <div className="sat-search-input-wrapper" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2.2"
              style={{ position: 'absolute', left: '16px', zIndex: 2, pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              ref={searchInputRef}
              type="text"
              className="sat-search-input"
              placeholder="Search any river or lake worldwide (e.g., Amazon, Lake Victoria, Ganga...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
            />

            {isSearching && <span className="sat-search-spinner"></span>}
            {searchQuery && (
              <button
                className="sat-search-clear"
                onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false); }}
              >
                ✕
              </button>
            )}
          </div>

          <button
            className="btn btn-primary sat-search-btn"
            onClick={() => { if (searchResults.length > 0) onSelectRiver(searchResults[0]); }}
          >
            🔍 Search Satellite
          </button>
        </div>

        {showDropdown && searchResults.length > 0 && (
          <div className="sat-search-dropdown glass">
            {searchResults.map(river => (
              <div
                key={river.id}
                className="sat-search-dropdown-item"
                onClick={() => {
                  setSearchQuery(river.name);
                  setShowDropdown(false);
                  onSelectRiver(river);
                }}
              >
                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{river.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {river.waterType === 'lake' ? 'Lake / reservoir' : 'River / waterway'}{river.state ? ` • ${river.state}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}