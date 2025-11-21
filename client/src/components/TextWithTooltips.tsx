import { useState, useEffect, useMemo } from "react";
import Tooltip from "./Tooltip";
import TooltipContent from "./TooltipContent";
import { extractTags, parseText } from "../utils/textParser";
import { apiUrl } from "../config/api";

interface TextWithTooltipsProps {
  text: string;
  className?: string;
}

interface TooltipData {
  type: string;
  name: string;
  content: string;
  loading: boolean;
  fullData?: any;
}

// Client-side cache with LRU (max 200 items)
const tooltipCache = new Map<string, TooltipData>();
const MAX_CACHE_SIZE = 200;

// Preloaded data store - stores all preloaded data
const preloadedData = new Map<string, Map<string, any>>();

// Preload all common data on app startup
let preloadPromise: Promise<void> | null = null;
let essentialPreloadPromise: Promise<void> | null = null;

const preloadAllData = async (essentialOnly = false) => {
  if (essentialOnly && essentialPreloadPromise) return essentialPreloadPromise;
  if (!essentialOnly && preloadPromise) return preloadPromise;
  
  const endpoint = essentialOnly ? "/api/data/preload/essential" : "/api/data/preload";
  
  const promise = (async () => {
    try {
      const response = await fetch(apiUrl(endpoint.replace(/^\//, '')));
      if (response.ok) {
        const data = await response.json();
        
        // Store preloaded data by type
        Object.keys(data).forEach(type => {
          const typeMap = preloadedData.get(type) || new Map<string, any>();
          Object.entries(data[type]).forEach(([key, value]: [string, any]) => {
            typeMap.set(key.toLowerCase(), value);
          });
          preloadedData.set(type, typeMap);
        });
        
        // Pre-populate tooltip cache with preloaded data
        Object.keys(data).forEach(type => {
          const typeMap = preloadedData.get(type);
          if (typeMap) {
            typeMap.forEach((item, key) => {
              const cacheKey = `${type}:${key}`;
              if (!tooltipCache.has(cacheKey)) {
                tooltipCache.set(cacheKey, {
                  type,
                  name: item.name || key,
                  content: "",
                  loading: false,
                  fullData: item,
                });
              }
            });
          }
        });
        
        if (!essentialOnly) {
          console.log("Tooltip data preloaded:", {
            spells: preloadedData.get("spells")?.size || 0,
            items: preloadedData.get("items")?.size || 0,
            conditions: preloadedData.get("conditions")?.size || 0,
            skills: preloadedData.get("skills")?.size || 0,
            backgrounds: preloadedData.get("backgrounds")?.size || 0,
            variantrules: preloadedData.get("variantrules")?.size || 0,
            features: preloadedData.get("features")?.size || 0,
          });
        } else {
          console.log("Essential tooltip data preloaded:", {
            conditions: preloadedData.get("conditions")?.size || 0,
            skills: preloadedData.get("skills")?.size || 0,
          });
        }
      }
    } catch (error) {
      console.error(`Error preloading ${essentialOnly ? "essential" : "tooltip"} data:`, error);
    }
  })();
  
  if (essentialOnly) {
    essentialPreloadPromise = promise;
  } else {
    preloadPromise = promise;
  }
  
  return promise;
};

// Polyfill for requestIdleCallback
const requestIdleCallback = typeof window !== "undefined" && (window as any).requestIdleCallback
  ? (window as any).requestIdleCallback
  : (callback: () => void, options?: { timeout?: number }) => {
      const timeout = options?.timeout || 2000;
      return setTimeout(callback, Math.min(timeout, 100));
    };

// Start preload - essential ngay, full sau trong background
export const startPreload = () => {
  if (typeof window === "undefined") return;
  
  // Preload essential ngay (nhỏ, nhanh)
  if (!essentialPreloadPromise) {
    preloadAllData(true);
  }
  
  // Preload full trong background (không block UI)
  if (!preloadPromise) {
    requestIdleCallback(() => {
      preloadAllData(false);
    }, { timeout: 3000 });
  }
};

const useTooltipData = (type: string, name: string) => {
  const [data, setData] = useState<TooltipData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!name || !type || type === "unknown") {
      setData(null);
      return;
    }

    const cacheKey = `${type}:${name.toLowerCase()}`;
    
    // Check cache first
    const cached = tooltipCache.get(cacheKey);
    if (cached) {
      setData(cached);
      return;
    }

    // Check preloaded data
    const typeMap = preloadedData.get(type);
    if (typeMap) {
      const preloaded = typeMap.get(name.toLowerCase());
      if (preloaded) {
        const tooltipData: TooltipData = {
          type,
          name: preloaded.name || name,
          content: "",
          loading: false,
          fullData: preloaded,
        };
        tooltipCache.set(cacheKey, tooltipData);
        setData(tooltipData);
        return;
      }
    }

    // Fallback to API if not in preloaded data
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          apiUrl(`api/data/lookup/${type}/${encodeURIComponent(name)}`)
        );
        
        if (cancelled) return;
        
        if (response.ok) {
          const result = await response.json();
          
          const tooltipData: TooltipData = {
            type,
            name: result.name || name,
            content: "",
            loading: false,
            fullData: result,
          };
          
          // Cache the result (with LRU eviction)
          if (tooltipCache.size >= MAX_CACHE_SIZE) {
            const firstKey = tooltipCache.keys().next().value;
            if (firstKey) {
              tooltipCache.delete(firstKey);
            }
          }
          tooltipCache.set(cacheKey, tooltipData);
          
          setData(tooltipData);
        } else {
          const fallbackData: TooltipData = {
            type,
            name,
            content: name,
            loading: false,
            fullData: null,
          };
          tooltipCache.set(cacheKey, fallbackData);
          setData(fallbackData);
        }
      } catch (error) {
        if (cancelled) return;
        console.error(`Error loading ${type} data:`, error);
        const errorData: TooltipData = {
          type,
          name,
          content: name,
          loading: false,
          fullData: null,
        };
        tooltipCache.set(cacheKey, errorData);
        setData(errorData);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [type, name]);

  return { data, loading };
};

const TooltipText = ({ type, name, children }: { type: string; name: string; children: React.ReactNode }) => {
  const { data, loading } = useTooltipData(type, name);

  return (
    <Tooltip
      content={
        <TooltipContent
          type={type}
          name={name}
          data={data?.fullData || data}
          loading={loading}
        />
      }
    >
      <span className="cursor-help text-amber-700 underline decoration-dotted underline-offset-2 hover:text-amber-800 inline">
        {children}
      </span>
    </Tooltip>
  );
};

export default function TextWithTooltips({ text, className = "" }: TextWithTooltipsProps) {
  const parsedContent = useMemo(() => {
    if (!text || typeof text !== "string") return text;

    // Check if text is wrapped in {@i ...} tag
    const iTagMatch = text.match(/^\{@i\s+(.+)\}$/);
    let processedText = text;
    let isItalic = false;
    
    if (iTagMatch) {
      // Text is wrapped in {@i ...} tag
      processedText = iTagMatch[1];
      isItalic = true;
    } else if (text.startsWith("i ")) {
      // Text starts with "i " (legacy format)
      processedText = text.substring(2);
      isItalic = true;
    }

    const tags = extractTags(processedText);
    if (tags.length === 0) {
      // No tags, return plain text (with italic if needed)
      const parsed = parseText(processedText);
      return isItalic ? <em className="italic">{parsed}</em> : <span>{parsed}</span>;
    }

    // Split text by tags and create elements
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let keyCounter = 0;

    tags.forEach((tag) => {
      const tagIndex = processedText.indexOf(tag.full, lastIndex);
      
      // Add text before tag (preserve ALL original spacing)
      if (tagIndex > lastIndex) {
        const beforeText = processedText.substring(lastIndex, tagIndex);
        // Parse to remove any nested tags but keep ALL spacing including spaces
        const parsedBefore = parseText(beforeText);
        // Always add, even if empty after parsing, to preserve spacing context
        if (parsedBefore || beforeText.trim() === "") {
          parts.push(<span key={`text-${keyCounter++}`}>{parsedBefore}</span>);
        }
      }

      // Add tooltip for tag
      parts.push(
        <TooltipText key={`tag-${keyCounter++}`} type={tag.type} name={tag.name}>
          {tag.name}
        </TooltipText>
      );

      lastIndex = tagIndex + tag.full.length;
    });

    // Add remaining text (preserve ALL spacing)
    if (lastIndex < processedText.length) {
      const remainingText = processedText.substring(lastIndex);
      const parsedRemaining = parseText(remainingText);
      // Always add, even if empty after parsing
      if (parsedRemaining || remainingText.trim() === "") {
        parts.push(<span key={`text-${keyCounter++}`}>{parsedRemaining}</span>);
      }
    }

    const content = parts.length > 0 ? <>{parts}</> : <span>{parseText(processedText)}</span>;
    return isItalic ? <em className="italic">{content}</em> : content;
  }, [text]);

  return <span className={className}>{parsedContent}</span>;
}
