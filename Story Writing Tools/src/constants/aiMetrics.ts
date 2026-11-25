export interface LocalizedOption {
  id: string;
  tr: string;
  en: string;
}

// 20 Multi-Select Writing Styles (exact specification from PROJECT_DOC Section 3.F)
export const WRITING_STYLES: LocalizedOption[] = [
  { id: "calm", tr: "Dingin / Sakin", en: "Calm / Serene" },
  { id: "time_skip", tr: "Zaman Atlaması", en: "Time Skip" },
  { id: "combat", tr: "Dövüş Koreografisi", en: "Combat Choreography" },
  { id: "suspense", tr: "Gerilim / Gizem", en: "Suspense / Mystery" },
  { id: "politics", tr: "Politik Entrika", en: "Political Intrigue" },
  { id: "monologue", tr: "İç Monolog Ağırlıklı", en: "Internal Monologue" },
  { id: "fast_action", tr: "Hızlı Tempo / Aksiyon", en: "Fast-Paced Action" },
  { id: "dialogue", tr: "Diyalog Odaklı", en: "Dialogue-Driven" },
  { id: "emotional", tr: "Duygusal / Dramatik", en: "Emotional / Dramatic" },
  { id: "dark_humor", tr: "Kara Mizah / İroni", en: "Dark Humor / Irony" },
  { id: "epic", tr: "Epik / Destansı", en: "Epic / Heroic" },
  { id: "horror", tr: "Korku / Karanlık Atmosfer", en: "Horror / Dark Atmosphere" },
  { id: "detective", tr: "Dedektif / Soruşturma", en: "Detective / Investigation" },
  { id: "romantic", tr: "Romantik / Yakınlaşma", en: "Romantic / Intimate" },
  { id: "exploration", tr: "Keşif ve Dünya Tanıtımı", en: "Exploration & World Intro" },
  { id: "psychological", tr: "Psikolojik Derinlik", en: "Psychological Depth" },
  { id: "tragic", tr: "Trajik / Melankolik", en: "Tragic / Melancholic" },
  { id: "strategic", tr: "Stratejik / Taktiksel", en: "Strategic / Tactical" },
  { id: "slice_of_life", tr: "Günlük Yaşam (Slice of Life)", en: "Slice of Life" },
  { id: "cinematic", tr: "Sinematik / Görsel Anlatım", en: "Cinematic / Visual" },
];

// 10 Writing Languages / Registers (exact specification from PROJECT_DOC Section 3.F)
export const WRITING_LANGUAGES: LocalizedOption[] = [
  { id: "literary", tr: "Edebi / Sanatsal", en: "Literary / Artistic" },
  { id: "clear", tr: "Açık ve Net", en: "Clear & Direct" },
  { id: "descriptive", tr: "Betimlemeli / Zengin", en: "Richly Descriptive" },
  { id: "fluid", tr: "Akıcı / Sade", en: "Fluid & Simple" },
  { id: "archaic", tr: "Arkaik / Eski Dönem Dili", en: "Archaic / Period" },
  { id: "poetic", tr: "Şiirsel / Lirik", en: "Poetic / Lyrical" },
  { id: "minimalist", tr: "Minimalist / Kısa Cümleli", en: "Minimalist / Short Sentences" },
  { id: "formal", tr: "Resmi / Mesafeli", en: "Formal / Distant" },
  { id: "conversational", tr: "Samimi / Günlük Konuşma", en: "Conversational / Warm" },
  { id: "philosophical", tr: "Felsefi / Düşündürücü", en: "Philosophical / Reflective" },
];
