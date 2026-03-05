"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaSearch, FaBook, FaGamepad, FaFileAlt, FaTimes } from "react-icons/fa";

export default function SearchBar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [filteredResults, setFilteredResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);
  const router = useRouter();

  // Map types to icons
  const getIconForType = (type) => {
    switch(type) {
      case "transcript":
        return FaFileAlt;
      case "quiz":
        return FaGamepad;
      case "summary":
      case "reviewer":
        return FaBook;
      default:
        return FaFileAlt;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
        // If they click outside, close the mobile search overlay too
        setIsMobileExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Search for files based on query (debounced API call)
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setFilteredResults([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setIsOpen(true);

    const controller = new AbortController();
    const debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/students/search?q=${encodeURIComponent(searchQuery.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setFilteredResults(data.results || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Search error:", err);
          setFilteredResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [searchQuery]);

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleResultClick = (item) => {
    setSearchQuery("");
    setIsOpen(false);
    setIsMobileExpanded(false); // Close mobile bar on navigation
    router.push(item.link);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setIsOpen(false);
    setIsMobileExpanded(false); // Close mobile bar on navigation
  };

  const groupedResults = {
    transcripts: filteredResults.filter((item) => item.type === "transcript"),
    quizzes: filteredResults.filter((item) => item.type === "quiz"),
    summaries: filteredResults.filter((item) => item.type === "summary" || item.type === "reviewer"),
  };

  return (
    <>
      {/* Mobile-only trigger button */}
      <button className="mobile-search-btn" onClick={() => setIsMobileExpanded(true)}>
        <FaSearch />
      </button>

      {/* Search bar container */}
      <div className={`search-bar-container ${isMobileExpanded ? 'expanded' : ''}`} ref={searchRef}>
        <div className="search-bar">
          <FaSearch className="search-icon" />
          <input
            type="search"
            placeholder="Search transcripts, quizzes, summaries..."
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={() => searchQuery && setIsOpen(true)}
            autoComplete="off"
          />
          {/* Show the close/clear button if there is text, OR if we are in the expanded state */}
          {(searchQuery || isMobileExpanded) && (
            <button className={`clear-search-btn ${!searchQuery ? 'close-mobile-search' : ''}`} onClick={handleClearSearch}>
              <FaTimes />
            </button>
          )}
        </div>

        {isOpen && (
          <div className="search-dropdown">
            {isSearching ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '2rem',
                color: 'var(--text-secondary)'
              }}>
                <p>Searching...</p>
              </div>
            ) : filteredResults.length > 0 ? (
              <>
                {groupedResults.transcripts.length > 0 && (
                  <div className="search-group">
                    <div className="search-group-title">Transcripts</div>
                    {groupedResults.transcripts.map((item) => {
                      const IconComponent = getIconForType(item.type);
                      return (
                        <div
                          key={item.id}
                          className="search-item"
                          onClick={() => handleResultClick(item)}
                        >
                          <IconComponent className="search-item-icon" />
                          <div className="search-item-info">
                            <div className="search-item-title">{item.title}</div>
                            <div className="search-item-subject">{item.subject}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {groupedResults.quizzes.length > 0 && (
                  <div className="search-group">
                    <div className="search-group-title">Quizzes</div>
                    {groupedResults.quizzes.map((item) => {
                      const IconComponent = getIconForType(item.type);
                      return (
                        <div
                          key={item.id}
                          className="search-item"
                          onClick={() => handleResultClick(item)}
                        >
                          <IconComponent className="search-item-icon" />
                          <div className="search-item-info">
                            <div className="search-item-title">{item.title}</div>
                            <div className="search-item-subject">{item.subject}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {groupedResults.summaries.length > 0 && (
                  <div className="search-group">
                    <div className="search-group-title">Summaries</div>
                    {groupedResults.summaries.map((item) => {
                      const IconComponent = getIconForType(item.type);
                      return (
                        <div
                          key={item.id}
                          className="search-item"
                          onClick={() => handleResultClick(item)}
                        >
                          <IconComponent className="search-item-icon" />
                          <div className="search-item-info">
                            <div className="search-item-title">{item.title}</div>
                            <div className="search-item-subject">{item.subject}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--text-secondary)'
              }}>
                <div>
                  <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</p>
                  <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>No results found</p>
                  <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Try searching for transcripts, quizzes, or summaries</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
