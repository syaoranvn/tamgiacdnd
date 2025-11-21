import { useState, useEffect } from "react";
import { apiUrl } from "../config/api";

interface TooltipData {
  name: string;
  type: string;
  content: string;
}

export const useTooltipData = (name: string, type: string) => {
  const [data, setData] = useState<TooltipData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!name || !type) {
      setData(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        let url = "";
        switch (type) {
          case "spell":
            url = apiUrl(`api/data/spells/${encodeURIComponent(name)}`);
            break;
          case "item":
            url = apiUrl(`api/data/items/${encodeURIComponent(name)}`);
            break;
          case "feat":
            url = apiUrl(`api/data/feats/${encodeURIComponent(name)}`);
            break;
          case "class":
            url = apiUrl(`api/data/classes/${encodeURIComponent(name.toLowerCase())}`);
            break;
          case "race":
            url = apiUrl(`api/data/races/${encodeURIComponent(name)}`);
            break;
          default:
            setData(null);
            setLoading(false);
            return;
        }

        const response = await fetch(url);
        if (response.ok) {
          const result = await response.json();
          // Extract description from entries
          const description = result.entries
            ? result.entries
                .filter((e: any) => typeof e === "string")
                .slice(0, 2)
                .join(" ")
            : result.name || name;
          setData({ name, type, content: description });
        } else {
          setData(null);
        }
      } catch (error) {
        console.error(`Error loading ${type} data:`, error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [name, type]);

  return { data, loading };
};

