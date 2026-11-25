import { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { ProjectModal } from "./components/projects/ProjectModal";
import { ArcBoardView } from "./components/views/ArcBoardView";
import { ChaptersView } from "./components/views/ChaptersView";
import { CharactersView } from "./components/views/CharactersView";
import { SettingsView } from "./components/views/SettingsView";
import { TranslationView } from "./components/views/TranslationView";
import { WorldView } from "./components/views/WorldView";
import { AppProvider } from "./context/AppContext";
import type { NavSection } from "./types/navigation";

function AppShell() {
  const [activeSection, setActiveSection] = useState<NavSection>("world");

  const renderSection = () => {
    switch (activeSection) {
      case "world":
        return <WorldView />;
      case "characters":
        return <CharactersView />;
      case "arc-board":
        return <ArcBoardView />;
      case "chapters":
        return <ChaptersView />;
      case "translation":
        return <TranslationView />;
      case "settings":
        return <SettingsView />;
    }
  };

  return (
    <div className="app-ambient-canvas flex h-screen w-screen overflow-hidden text-ink">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar activeSection={activeSection} />

        <main className="flex-1 overflow-y-auto px-6 py-6">
          {renderSection()}
        </main>
      </div>

      <ProjectModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
