import { useEffect, useRef, useState } from 'react';

export default function RiverSearch({ onSelectRiver }) {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  // Tracks whether the current input value came from a selection (not user typing).
  // When true, the search effect is skipped so selecting a river doesn't re-trigger a query.
  const selectedRef = useRef(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    // Skip the search if this change was caused by a selection, not user typing.
    if (selectedRef.current) {
      selectedRef.current = false;
      return;
    }

    if (!inputValue.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/satellite/search?river=${encodeURIComponent(inputValue)}`);
        const data = await res.json();
        if (!cancelled && data.success) {
          setSearchResults(data.rivers || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inputValue]);

  const handleSelect = (river) => {
    // Mark as a programmatic change so the effect doesn't fire a new search.
    selectedRef.current = true;
    setInputValue('');
    setSearchResults([]);
    setShowDropdown(false);
    onSelectRiver(river);
    // Keep focus on input so the user can immediately search again.
    searchInputRef.current?.focus();
  };

  const handleClear = () => {
    setInputValue('');
    setSearchResults([]);
    setShowDropdown(false);
    searchInputRef.current?.focus();
  };

  return (
    <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
        <div className="sat-search-input-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            className="sat-search-input"
            placeholder="Search any river or lake worldwide (e.g., Amazon, Lake Victoria, Ganga...)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
          />
          {isSearching && <span className="sat-search-spinner"></span>}
          {inputValue && (
            <button className="sat-search-clear" onClick={handleClear}>✕</button>
          )}
        </div>

        {showDropdown && searchResults.length > 0 && (
          <div className="sat-search-dropdown glass">
            {searchResults.map(river => (
              <div
                key={river.id}
                className="sat-search-dropdown-item"
                onClick={() => handleSelect(river)}
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
