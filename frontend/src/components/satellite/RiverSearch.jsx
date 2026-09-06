import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../../utils/api';

const POPULAR_WATER_BODIES = [
  { id: 'thamirabarani', name: 'Thamirabarani', region: 'Tamil Nadu', badge: 'Perennial' },
  { id: 'cauvery', name: 'Cauvery', region: 'Tamil Nadu', badge: 'Main Basin' },
  { id: 'vaigai', name: 'Vaigai', region: 'Madurai' },
  { id: 'bhavani', name: 'Bhavani', region: 'Erode' },
  { id: 'noyyal', name: 'Noyyal', region: 'Coimbatore' },
  { id: 'ganga', name: 'Ganga', region: 'India' },
  { id: 'yamuna', name: 'Yamuna', region: 'Delhi' },
  { id: 'godavari', name: 'Godavari', region: 'India' },
  { id: 'amazon', name: 'Amazon', region: 'South America' },
  { id: 'nile', name: 'Nile', region: 'Egypt' }
];

export default function RiverSearch({ onSelectRiver }) {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeChip, setActiveChip] = useState(null);

  // Tracks whether the current input value came from a selection (not user typing).
  const selectedRef = useRef(false);
  const searchInputRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Skip the search if this change was caused by a selection, not user typing.
    if (selectedRef.current) {
      selectedRef.current = false;
      return;
    }

    if (!inputValue.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      setSelectedIndex(-1);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(getApiUrl(`/api/satellite/search?river=${encodeURIComponent(inputValue)}`));
        const data = await res.json();
        if (!cancelled && data.success) {
          setSearchResults(data.rivers || []);
          setShowDropdown(true);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);

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
    setSelectedIndex(-1);
    setActiveChip(river.id);
    onSelectRiver(river);
    // Keep focus on input so the user can immediately search again.
    searchInputRef.current?.focus();
  };

  const handleQuickSelect = async (item) => {
    setActiveChip(item.id);
    setIsSearching(true);
    try {
      const res = await fetch(getApiUrl(`/api/satellite/search?river=${encodeURIComponent(item.id)}`));
      const data = await res.json();
      if (data.success && data.rivers && data.rivers.length > 0) {
        handleSelect(data.rivers[0]);
      } else {
        handleSelect({ id: item.id, name: item.name, waterType: 'river', state: item.region });
      }
    } catch (err) {
      handleSelect({ id: item.id, name: item.name, waterType: 'river', state: item.region });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setSearchResults([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    searchInputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        handleSelect(searchResults[selectedIndex]);
      } else if (searchResults.length > 0) {
        handleSelect(searchResults[0]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '680px' }}>
        <div className="sat-search-input-wrapper">
          <div className="sat-search-icon-wrapper" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <input
            ref={searchInputRef}
            type="text"
            className="sat-search-input"
            placeholder="Search any river or lake (e.g., Thamirabarani, Cauvery, Ganga, Amazon...)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
            onKeyDown={handleKeyDown}
          />

          {isSearching && (
            <span className={`sat-search-spinner ${inputValue ? 'has-clear' : ''}`} title="Searching..."></span>
          )}

          {inputValue && (
            <button className="sat-search-clear" onClick={handleClear} title="Clear search" type="button">
              ✕
            </button>
          )}
        </div>

        {showDropdown && searchResults.length > 0 && (
          <div className="sat-search-dropdown">
            {searchResults.map((river, idx) => (
              <div
                key={river.id}
                className={`sat-search-dropdown-item ${idx === selectedIndex ? 'focused' : ''}`}
                onClick={() => handleSelect(river)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>
                    {river.waterType === 'lake' ? '🏞️' : '🌊'}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {river.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {[river.state, river.country].filter(Boolean).join(', ') || river.description || 'Water body'}
                    </div>
                  </div>
                </div>

                <span className="sat-search-badge">
                  {river.waterType === 'lake' ? 'Lake' : 'River'}
                </span>
              </div>
            ))}
          </div>
        )}

        {showDropdown && !isSearching && inputValue.trim().length >= 2 && searchResults.length === 0 && (
          <div className="sat-search-dropdown" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No water bodies found for &quot;{inputValue}&quot;. Try typing &quot;Thamirabarani&quot; or &quot;Cauvery&quot;.
          </div>
        )}
      </div>

      {/* Quick Suggestion Chips */}
      <div className="sat-quick-chips-wrapper">
        <span className="sat-quick-label">⚡ Quick Select:</span>
        <div className="sat-quick-chips">
          {POPULAR_WATER_BODIES.map(item => (
            <button
              key={item.id}
              type="button"
              className={`sat-chip-btn ${activeChip === item.id ? 'active' : ''}`}
              onClick={() => handleQuickSelect(item)}
              title={`View satellite imagery and telemetry for ${item.name} (${item.region})`}
            >
              <span className="sat-chip-icon">🌊</span>
              <span>{item.name}</span>
              {item.badge && <span className="sat-chip-pill">{item.badge}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
