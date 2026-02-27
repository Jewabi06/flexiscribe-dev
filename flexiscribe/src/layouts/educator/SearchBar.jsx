"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, X } from "lucide-react";

export default function SearchBar({ placeholder = "Search transcriptions..." }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced API search
  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setIsOpen(true);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/educator/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Search error:", err);
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleResultClick = (item) => {
    setQuery("");
    setIsOpen(false);
    router.push(item.link);
  };

  return (
    <div className="relative w-full" ref={searchRef}>
      {/* INPUT */}
      <div
        className="
          w-full flex items-center gap-3
          px-5 py-3 lg:px-6 lg:py-4
          rounded-full
          bg-gradient-to-b from-[#9d8adb] to-[#4c4172] dark:bg-[#2d2640]
          shadow-[0_4px_20px_rgba(0,0,0,0.08)]
          transition-all duration-300
          hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
        "
      >
        <Search size={22} className="text-white shrink-0" />

        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setIsOpen(true)}
          aria-label="Search"
          className="
            flex-1 bg-transparent outline-none
            text-sm lg:text-base text-white placeholder:text-white
          "
        />

        {query && (
          <button
            onClick={() => { setQuery(""); setIsOpen(false); }}
            className="text-white/70 hover:text-white transition"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* DROPDOWN */}
      {isOpen && (
        <div
          className="
            absolute top-full left-0 right-0 mt-2
            bg-white dark:bg-[#2d2640]
            rounded-xl shadow-lg border border-[#e3def4] dark:border-[#3d3560]
            max-h-[300px] overflow-y-auto z-50
          "
        >
          {isSearching ? (
            <div className="flex items-center justify-center py-8 text-sm text-[#6b6396]">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#9d8adb]">
                Transcriptions
              </div>
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleResultClick(item)}
                  className="
                    w-full flex items-center gap-3 px-4 py-2.5
                    hover:bg-[#f3f1fa] dark:hover:bg-[#3d3560]
                    transition text-left
                  "
                >
                  <FileText size={16} className="text-[#9d8adb] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#3f3764] dark:text-white truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-[#6b6396] dark:text-white/60 truncate">
                      {item.subject}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-[#6b6396]">
              <Search size={24} className="mb-2 opacity-40" />
              <p className="text-sm">No results found</p>
              <p className="text-xs opacity-70">Try a different search term</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
