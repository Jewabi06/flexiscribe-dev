"use client";

import { FileText } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import EducatorHeader from "@/layouts/educator/EducatorHeader";
import { Search, X } from "lucide-react";

export default function TranscriptionHeader() {
  const [userName, setUserName] = useState("Educator");
  
  // Search state
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);
  const router = useRouter();

  // Fetch user profile
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/educator/profile");
        if (res.ok) {
          const data = await res.json();
          setUserName(data.educator.username || data.educator.fullName.split(" ")[0] || "Educator");
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    }
    fetchProfile();
  }, []);

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
    <div className="mb-4 sm:mb-6">
      {/* ===== TOP BAR ===== */}
      <div className="flex items-center justify-between gap-3">
        {/* LEFT */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#9b8ae0] flex items-center justify-center text-white shadow-md">
            <FileText size={18} />
          </div>

          <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-[#6b5fcf] dark:text-[#c5b8f5]">
            Documents
          </h1>

          {/* DESKTOP SEARCH - Advanced version */}
          <div className="hidden lg:block flex-1 max-w-2xl ml-4">
            <div className="relative" ref={searchRef}>
              <div
                className="
                  w-full flex items-center gap-3
                  px-5 py-3 lg:px-6 lg:py-3
                  rounded-full
                  bg-gray-100 dark:bg-gray-800
                  shadow-[0_2px_10px_rgba(0,0,0,0.03)]
                  transition-all duration-300
                  hover:shadow-[0_4px_15px_rgba(0,0,0,0.05)]
                  border border-gray-200 dark:border-gray-700
                "
              >
                <Search size={20} className="text-[#9d8adb] dark:text-[#9d8adb] shrink-0" />

                <input
                  type="text"
                  placeholder="Search documents, courses, or topics..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => query && setIsOpen(true)}
                  className="
                    flex-1 bg-transparent outline-none
                    text-sm lg:text-base text-gray-700 dark:text-gray-200 
                    placeholder:text-gray-400 dark:placeholder:text-gray-500
                  "
                />

                {query && (
                  <button
                    onClick={() => { setQuery(""); setIsOpen(false); }}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* DROPDOWN RESULTS - Same width as search input */}
              {isOpen && (
                <div
                  className="
                    absolute left-0 right-0 mt-2
                    bg-white dark:bg-gray-800
                    rounded-xl shadow-lg border border-gray-200 dark:border-gray-700
                    max-h-[300px] overflow-y-auto z-50
                    w-full
                  "
                >
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
                      Searching...
                    </div>
                  ) : results.length > 0 ? (
                    <div className="py-2">
                      <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#9d8adb] dark:text-[#9d8adb]">
                        Documents
                      </div>
                      {results.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleResultClick(item)}
                          className="
                            w-full flex items-center gap-3 px-4 py-2.5
                            hover:bg-gray-50 dark:hover:bg-gray-700/50
                            transition text-left
                          "
                        >
                          <FileText size={16} className="text-[#9d8adb] dark:text-[#9d8adb] shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                              {item.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {item.subject}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                      <Search size={24} className="mb-2 opacity-40 text-[#9d8adb] dark:text-[#9d8adb]" />
                      <p className="text-sm">No results found</p>
                      <p className="text-xs opacity-70">Try a different search term</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <EducatorHeader userName={userName} />
      </div>

      {/* ===== MOBILE SEARCH ===== */}
      <div className="relative w-full mt-3 lg:hidden">
        <div className="relative" ref={searchRef}>
          <div
            className="
              w-full flex items-center gap-3
              px-5 py-3
              rounded-full
              bg-gray-100 dark:bg-gray-800
              shadow-[0_2px_10px_rgba(0,0,0,0.03)]
              border border-gray-200 dark:border-gray-700
            "
          >
            <Search size={18} className="text-[#9d8adb] dark:text-[#9d8adb] shrink-0" />

            <input
              type="text"
              placeholder="Search documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query && setIsOpen(true)}
              className="
                flex-1 bg-transparent outline-none
                text-sm text-gray-700 dark:text-gray-200 
                placeholder:text-gray-400 dark:placeholder:text-gray-500
              "
            />

            {query && (
              <button
                onClick={() => { setQuery(""); setIsOpen(false); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Mobile Dropdown - Same width as search input */}
          {isOpen && (
            <div
              className="
                absolute left-0 right-0 mt-2
                bg-white dark:bg-gray-800
                rounded-xl shadow-lg border border-gray-200 dark:border-gray-700
                max-h-[300px] overflow-y-auto z-50
                w-full
              "
            >
              {isSearching ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                  Searching...
                </div>
              ) : results.length > 0 ? (
                <div className="py-2">
                  {results.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleResultClick(item)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
                    >
                      <FileText size={16} className="text-[#9d8adb]" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-700 truncate">{item.title}</div>
                        <div className="text-xs text-gray-500 truncate">{item.subject}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Search size={24} className="mb-2 opacity-40 text-[#9d8adb]" />
                  <p className="text-sm">No results found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}