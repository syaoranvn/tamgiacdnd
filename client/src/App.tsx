import { useState, useEffect } from "react";
import CharacterSelector from "./components/CharacterSelector";
import CharacterWizard from "./components/CharacterWizard";
import Step7CharacterSheet from "./components/wizard/Step7CharacterSheet";
import { startPreload } from "./components/TextWithTooltips";
import { useTranslationContext } from "./contexts/TranslationContext";
import type { Character } from "./types";

type View = "selector" | "wizard" | "character";

function App() {
  const [view, setView] = useState<View>("selector");
  const [selectedCharacter, setSelectedCharacter] = useState<Character | undefined>();
  const { translationEnabled, toggleTranslation } = useTranslationContext();

  // Preload tooltip data sau khi app đã render (không block UI)
  useEffect(() => {
    // Delay một chút để UI render trước
    const timer = setTimeout(() => {
      startPreload();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSelectCharacter = (character: Character) => {
    setSelectedCharacter(character);
    setView("character");
  };

  const handleCreateNew = () => {
    setSelectedCharacter(undefined);
    setView("wizard");
  };

  const handleWizardComplete = (character: Character) => {
    setSelectedCharacter(character);
    setView("selector");
    // Character is already saved in CharacterWizard's handleSubmit
  };

  const handleWizardCancel = () => {
    setView("selector");
  };

  if (view === "wizard") {
    return (
      <CharacterWizard
        initialCharacter={selectedCharacter}
        onComplete={handleWizardComplete}
        onCancel={handleWizardCancel}
      />
    );
  }

  if (view === "character" && selectedCharacter) {
    return (
      <div className="min-h-screen px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <header className="mb-8 rounded-3xl border border-amber-200 bg-white/70 p-8 shadow-sheet backdrop-blur">
            <p className="text-sm uppercase tracking-[0.3em] text-amber-700">
              Tam Giác | D&D 5e
            </p>
            <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
              {selectedCharacter.name || "Nhân vật"}
            </h1>
          </header>

          <div className="mb-6 flex gap-4">
            <button
              onClick={() => setView("selector")}
              className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-slate-700 transition-all hover:bg-slate-50"
            >
              ← Quay lại danh sách
            </button>
            <button
              onClick={() => {
                setView("wizard");
              }}
              className="rounded-2xl bg-amber-600 px-6 py-3 text-white transition-all hover:bg-amber-700"
            >
              Chỉnh sửa
            </button>
          </div>

          {/* Use Step7CharacterSheet component */}
          <Step7CharacterSheet
            character={selectedCharacter}
            onComplete={() => setView("selector")}
          />
        </div>
      </div>
    );
  }

  return (
      <div>
      {/* Translation Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={toggleTranslation}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg transition-all ${
            translationEnabled
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-300"
          }`}
          title={translationEnabled ? "Tắt dịch tự động" : "Bật dịch tự động"}
        >
          <span className="text-base">
            {translationEnabled ? "🌐" : "🔤"}
          </span>
          <span>
            {translationEnabled ? "Dịch: Bật" : "Dịch: Tắt"}
          </span>
        </button>
      </div>

      <CharacterSelector
        onSelectCharacter={handleSelectCharacter}
        onCreateNew={handleCreateNew}
      />
    </div>
  );
}

export default App;
