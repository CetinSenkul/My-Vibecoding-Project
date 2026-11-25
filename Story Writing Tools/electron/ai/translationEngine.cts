import {
  getChapter,
  getDefaultAiProviderWithSecret,
  listGlossaryTerms,
  upsertChapterTranslation,
  type ChapterTranslationRecord,
  type GlossaryTermRecord,
} from "../db/database.cjs";
import { generateText } from "./providerAdapter.cjs";

export interface BuildTranslationPromptInput {
  sourceLang: string;
  targetLang: string;
  chapterTitle: string;
  chapterNumber: number;
  sourceText: string;
  glossaryTerms: GlossaryTermRecord[];
}

export interface TranslationPromptBundle {
  systemPrompt: string;
  userPrompt: string;
}

export function buildTranslationPrompt(
  input: BuildTranslationPromptInput
): TranslationPromptBundle {
  const glossarySection =
    input.glossaryTerms.length > 0
      ? [
          `[TECHNICAL TERMS GLOSSARY — MANDATORY RULES]`,
          ...input.glossaryTerms.map(
            (g) => `- "${g.term}": ${g.description}`
          ),
        ].join("\n")
      : `[TECHNICAL TERMS GLOSSARY]: (None specified)`;

  const systemPrompt = [
    `You are StoryStudio's expert literary book translator.`,
    `Translate faithfully from ${input.sourceLang} to ${input.targetLang} while preserving literary voice, emotional tone, rhythm, and paragraph structure.`,
    `STRICT GLOSSARY RULE: You MUST follow every term rule in the Technical Terms Glossary below accurately for the ${input.sourceLang} → ${input.targetLang} context.`,
    `Return ONLY the translated chapter prose without extra commentary.`,
  ].join(" ");

  const userPrompt = [
    `Translation Pair: ${input.sourceLang} → ${input.targetLang}`,
    glossarySection,
    `[CHAPTER ${input.chapterNumber}: ${input.chapterTitle}]`,
    input.sourceText,
  ].join("\n\n");

  return { systemPrompt, userPrompt };
}

export interface TranslateChapterResult {
  translation: ChapterTranslationRecord;
  glossaryTermsInjected: number;
  model: string;
}

export async function translateChapterWithGlossary(params: {
  projectId: number;
  chapterId: number;
  sourceLang: string;
  targetLang: string;
}): Promise<TranslateChapterResult> {
  const provider = getDefaultAiProviderWithSecret("translator");
  if (!provider) {
    throw new Error(
      "No AI provider is configured for translation. Please add one in Settings → AI Providers."
    );
  }

  const chapter = getChapter(params.chapterId);
  if (!chapter.content.trim()) {
    throw new Error(
      "This chapter has no main text to translate yet. Write or save chapter prose first."
    );
  }

  const glossaryTerms = listGlossaryTerms(params.projectId);
  const { systemPrompt, userPrompt } = buildTranslationPrompt({
    sourceLang: params.sourceLang,
    targetLang: params.targetLang,
    chapterTitle: chapter.title,
    chapterNumber: chapter.chapterNumber,
    sourceText: chapter.content,
    glossaryTerms,
  });

  const response = await generateText(
    {
      providerType: provider.record.providerType,
      baseUrl: provider.record.baseUrl,
      modelName: provider.record.modelName,
      apiKey: provider.apiKey,
    },
    {
      systemPrompt,
      userPrompt,
      temperature: 0.35,
    }
  );

  const saved = upsertChapterTranslation(
    chapter.id,
    params.sourceLang,
    params.targetLang,
    response.text.trim()
  );

  return {
    translation: saved,
    glossaryTermsInjected: glossaryTerms.length,
    model: response.model,
  };
}
