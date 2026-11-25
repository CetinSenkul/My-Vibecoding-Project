# StoryStudio

**An open-source, local-first, AI-assisted book writing desktop application.**

![Status](https://img.shields.io/badge/status-all%208%20phases%20complete-brightgreen)
![Desktop](https://img.shields.io/badge/Electron-TypeScript-47848F?logo=electron&logoColor=white)
![Frontend](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=black)
![Database](https://img.shields.io/badge/SQLite-Local%20First-003B57?logo=sqlite&logoColor=white)
![UI](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css&logoColor=white)

StoryStudio lets authors manage their story worlds, evolving characters, infinite-canvas plot arcs, chapter outlines, manuscripts, and multi-language translations in one local-first desktop app. It combines **compressed SQLite storage**, **BYOK (Bring Your Own Key)** AI integration with OS-level secret encryption, and a **token-efficient, human-in-the-loop writing workflow**.

> **Status:** All 8 core development phases are implemented and verified. See the [Development Roadmap](#development-roadmap) below.

---

## Key Features

### Interface, Localization & Themes
- **Bilingual UI (EN / TR):** Instant switching between **English** and **Turkish** powered by `i18next` and `react-i18next`.
- **4 Built-in Themes:** Switch seamlessly between **Dark** (default matte dark), **Light** (clean off-white), **Space** (deep nebula navy & starlight accents), and **Fantasy** (parchment, warm gold, and burgundy/emerald tones).
- Persistent user preferences saved locally.

### Worldbuilding & Evolving Character System
- **Worldbuilding Hub:** Define genre, world summary, universe rules, magic/power systems, and factions in a structured workspace.
- **Rich Character Profiles:** Standard attributes (Name, Gender, Age, Family, Abilities, Personality, Appearance, About) plus an interactive **0–100 Alignment Slider** (`0–33` Evil | `34–66` Gray | `67–100` Good).
- **Dynamic Custom Modules ("Add to Character"):** Attach custom nested lists tailored to your genre—such as *Companions*, *Pets* (Name, Evolution Path, Backstory, Abilities), or *Magical Artifacts*—stored as flexible JSON schemas.
- **Chronological Progression Log:** Character updates never overwrite history. Growth is appended chronologically with chapter references (e.g., `Lvl 1 → Lvl 2 (Chapter 3)` or `New Skill: Shadow Step (Chapter 7)`).

### Infinite Arc Canvas
- Powered by **React Flow (`@xyflow/react`)**, providing an unbounded 2D pan-and-zoom board for plotting story arcs.
- Place event cards, notes, and directional arrows freely.
- Click long-form note cards to open a clean detail modal without cluttering the canvas.

### Chapters, Drafts & Ultra-Compact Storage
- **Structured Chapter Slots:** Each chapter includes a dedicated **Draft / Outline** area, **Main Text** editor, and **Translated Texts** tabs.
- **Compressed SQLite Storage:** Long chapter manuscripts and translations are stored as **Zstd / Gzip compressed BLOBs** inside a local SQLite database (`story_studio.db`)—allowing a **1,000,000-word novel to occupy roughly 1.5–2 MB**.

### 5-Step Human-in-the-Loop AI Writing Engine
Designed to keep the author in full control while minimizing token usage:
1. **Smart Delta Scan:** Compares SHA-256 `content_hash` values of World and Character records against `AiSyncCache`. Unchanged lore is never re-sent.
2. **Draft Scan:** Reads the active chapter slot's outline and notes.
3. **Chapter Flow & Approval Lock:** Generates a structured chapter outline first and waits for your feedback. Prose generation is strictly locked until you click **"Start Writing Chapter"**.
4. **Iterative Refinement:** Review the generated chapter and choose **"Continue Improving"** (with targeted feedback) or **"Complete Chapter"**.
5. **Post-Chapter Character Progression:** Automatically detects notable character changes in the completed chapter and asks for your approval before appending `(Chapter X)` entries to their Progression Log.

### AI Metrics Control Panel
Fine-tune every generation from a dedicated side panel:
- **Intervention Level (`0–100` Slider):** From `0` (grammar & literary polish only) to `100` (creative scene expansion and additions).
- **Chapter Length:** `Shorten` | `Approximate` | `Extend`.
- **20 Multi-Select Writing Styles:** *Calm/Serene, Time Skip, Combat Choreography, Suspense/Mystery, Political Intrigue, Internal Monologue, Fast-Paced Action, Dialogue-Driven, Emotional/Dramatic, Dark Humor/Irony, Epic, Horror/Dark Atmosphere, Detective/Investigation, Romantic, Exploration & World Intro, Psychological Depth, Tragic/Melancholic, Strategic/Tactical, Slice of Life, Cinematic/Visual*.
- **10 Writing Registers / Tones:** *Literary/Artistic, Clear & Direct, Richly Descriptive, Fluid & Simple, Archaic/Period, Poetic/Lyrical, Minimalist, Formal/Distant, Conversational/Intimate, Philosophical*.

### Multi-Language Translation & Technical Glossary
- **Flexible Language Pairs:** Translate chapters between any source and target language (e.g., EN ↔ TR, TR → DE/JA/FR/ES, and more).
- **Per-Chapter Translation Storage:** Each chapter keeps its compressed translations organized by target language.
- **Technical Terms Glossary:** A two-column glossary (`Term` | `Description & Usage Rules`, e.g., *Mana*, *Ether*) automatically injected into AI translation prompts to maintain lore consistency across languages.

### BYOK — Multi-Provider AI & Security
- Bring your own API keys for:
  - **Google Gemini**
  - **OpenAI**
  - **Anthropic (Claude)**
  - **Custom OpenAI-Compatible Endpoints** (OpenRouter, DeepSeek, Groq, or free local models via **Ollama / LM Studio**)
- Assign separate default models for **Writing** and **Translation**.
- Built-in **"Get API Key"** quick links and **"Test Connection"** verification.
- **Zero-Leak Credential Storage:** All API keys are encrypted using your operating system's native secret storage (Windows DPAPI, macOS Keychain, or Linux Secret Service) via Electron `safeStorage`—**never** saved in plaintext in source code, `.env` files, SQLite databases, or Git history.

---

## Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Desktop Shell** | Electron + TypeScript (Node.js) | Cross-platform desktop app with secure IPC and native OS integrations |
| **Frontend** | React + TypeScript + Tailwind CSS | Responsive, themeable desktop UI |
| **Localization** | `i18next` + `react-i18next` | Real-time English & Turkish UI switching |
| **Infinite Canvas** | `@xyflow/react` (React Flow) | Interactive 2D story arc & plot board |
| **Database** | Local SQLite (`story_studio.db`) | Structured local persistence for projects, lore, chapters, and cache |
| **Compression & Hashing** | Node.js `zlib` + `crypto` (SHA-256) | Compact BLOB text storage & delta change detection |
| **Secret Management** | Electron `safeStorage` | OS-native encrypted storage for BYOK API keys |

---

## Development Roadmap

StoryStudio is built incrementally across 8 focused phases:

- [x] **Phase 1:** Project Scaffold, Bilingual UI (EN/TR) & 4-Theme System
- [x] **Phase 2:** Local SQLite Database, Compression Layer & Project Management
- [x] **Phase 3:** BYOK Multi-Provider Settings & OS Encrypted Key Storage
- [x] **Phase 4:** Worldbuilding Hub & Character System (Dynamic Modules + Progression Log)
- [x] **Phase 5:** Chapter Slots, Draft Editor & Compressed Manuscript Persistence
- [x] **Phase 6:** Infinite Arc Canvas (`@xyflow/react`) & Note Detail Modals
- [x] **Phase 7:** AI Metrics Panel & 5-Step Human-in-the-Loop Writing Engine
- [x] **Phase 8:** Multi-Language Translation Engine & Technical Terms Glossary

---

## Getting Started (Development)

> **Prerequisites:**
> - [Node.js](https://nodejs.org/) (LTS recommended)

```bash
# Clone the repository
git clone https://github.com/CetinSenkul/My-Vibecoding-Project.git
cd "My-Vibecoding-Project/Story Writing Tools"

# Install dependencies
npm install

# Run in desktop development mode (Vite + Electron)
npm run dev

# Build frontend & Electron main process
npm run build

# Launch the built desktop application
npm start
```

---

## Security & Privacy

- **Local-First:** Your stories, characters, outlines, and translations stay on your machine inside a local SQLite database (`story_studio.db`, excluded from Git).
- **Encrypted API Keys:** API keys are encrypted via OS-native `safeStorage` and routed through the Electron main process (`AiProviderAdapter`). They are never stored in plaintext in the database or committed to version control.
- **Offline & Local LLM Ready:** Works without cloud AI keys, or with local models via Ollama / LM Studio using the Custom OpenAI-Compatible provider.

---

## Contributing

Contributions, bug reports, and feature suggestions are welcome. Please ensure you never commit `.db` files, `.env` files, or API credentials in pull requests.

## License

TBD (MIT License recommended for open-source distribution).
