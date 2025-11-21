import { useState, useEffect } from "react";
import { translateText } from "../utils/translator";

interface UseTranslationOptions {
  enabled?: boolean;
  immediate?: boolean;
}

export const useTranslation = (
  text: string,
  options: UseTranslationOptions = {}
) => {
  const { enabled = true, immediate = true } = options;
  const [translated, setTranslated] = useState<string>(text);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !text || text.trim() === "") {
      setTranslated(text);
      return;
    }

    if (!immediate) {
      setTranslated(text);
      return;
    }

    setLoading(true);
    translateText(text, enabled)
      .then((result) => {
        setTranslated(result);
      })
      .catch(() => {
        setTranslated(text); // Fallback to original
      })
      .finally(() => {
        setLoading(false);
      });
  }, [text, enabled, immediate]);

  return { translated, loading };
};

