import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface TranslationContextType {
  translationEnabled: boolean;
  toggleTranslation: () => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(
  undefined
);

export const TranslationProvider = ({ children }: { children: ReactNode }) => {
  // Load from localStorage or default to false
  const [translationEnabled, setTranslationEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("translationEnabled");
      return saved === "true";
    }
    return false;
  });

  const toggleTranslation = () => {
    const newValue = !translationEnabled;
    setTranslationEnabled(newValue);
    if (typeof window !== "undefined") {
      localStorage.setItem("translationEnabled", String(newValue));
    }
  };

  return (
    <TranslationContext.Provider
      value={{ translationEnabled, toggleTranslation }}
    >
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslationContext = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error(
      "useTranslationContext must be used within a TranslationProvider"
    );
  }
  return context;
};

