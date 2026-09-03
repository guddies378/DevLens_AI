import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-3.6-flash";
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

type AnalysisResult = {
  score: number;
  explanation: string;
  issues: string[];
  suggestions: string[];
  improvedCode: string;
};

function getErrorText(error: unknown): string {
  if (!error) return "";

  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isQuotaError(error: unknown): boolean {
  const errorText = getErrorText(error).toLowerCase();

  return (
    errorText.includes("429") ||
    errorText.includes("resource_exhausted") ||
    errorText.includes("quota exceeded") ||
    errorText.includes("generate_content_free_tier_requests")
  );
}

function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Quota errors should NOT be retried.
  if (isQuotaError(error)) {
    return false;
  }

  const errorText = getErrorText(error).toLowerCase();

  return (
    errorText.includes("503") ||
    errorText.includes("unavailable") ||
    errorText.includes("high demand") ||
    errorText.includes("service unavailable")
  );
}

async function generateWithTimeout(prompt: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      ai.models.generateContent({
        model: MODEL,
        contents: prompt,
      }),

      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Gemini request timed out."));
        }, TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function cleanGeminiResponse(text: string): string {
  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function parseAnalysis(text: string): AnalysisResult {
  const cleanedText = cleanGeminiResponse(text);

  try {
    const parsed = JSON.parse(cleanedText);

    if (
      typeof parsed.score !== "number" ||
      typeof parsed.explanation !== "string" ||
      !Array.isArray(parsed.issues) ||
      !Array.isArray(parsed.suggestions) ||
      typeof parsed.improvedCode !== "string"
    ) {
      throw new Error(
        "Gemini returned JSON with an invalid structure."
      );
    }

    return {
      score: Math.max(0, Math.min(100, parsed.score)),
      explanation: parsed.explanation,
      issues: parsed.issues,
      suggestions: parsed.suggestions,
      improvedCode: parsed.improvedCode,
    };
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { code, language } = body;

    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json(
        {
          error: "Code is required.",
        },
        {
          status: 400,
        }
      );
    }

    const selectedLanguage =
      typeof language === "string" && language.trim()
        ? language
        : "unknown";

    const prompt = `
You are DevLens AI, an expert software code reviewer.

Analyze the following ${selectedLanguage} code.

Return ONLY valid JSON using exactly this structure:

{
  "score": 0,
  "explanation": "",
  "issues": [],
  "suggestions": [],
  "improvedCode": ""
}

Rules:

- score must be a number from 0 to 100
- explain clearly what the code does
- identify real potential problems
- provide practical improvements
- don't invent problems if the code is correct
- keep the explanation understandable for junior developers
- improvedCode must contain a cleaner or safer version of the user's code
- if the original code is already good, return the original code with only necessary improvements
- do not use markdown
- do not use code fences
- return only JSON

CODE:

${code}
`;

    let response;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        response = await generateWithTimeout(prompt);
        break;
      } catch (error) {
        console.error(
          `Gemini attempt ${attempt + 1} failed:`,
          error
        );

        // Do not retry quota errors.
        if (isQuotaError(error)) {
          throw error;
        }

        const shouldRetry =
          attempt < MAX_RETRIES && isRetryableError(error);

        if (!shouldRetry) {
          throw error;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 2000)
        );
      }
    }

    if (!response) {
      throw new Error("Gemini did not return a response.");
    }

    const text = response.text;

    if (!text || !text.trim()) {
      throw new Error("Gemini returned an empty response.");
    }

    const analysis = parseAnalysis(text);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);

    // Gemini daily/free-tier quota has been exhausted.
    if (isQuotaError(error)) {
      return NextResponse.json(
        {
          error:
            "DevLens AI has reached its Gemini API quota. Please try again later.",
        },
        {
          status: 429,
        }
      );
    }

    // Gemini service temporarily unavailable.
    if (isRetryableError(error)) {
      return NextResponse.json(
        {
          error:
            "DevLens AI is temporarily unavailable. Gemini is currently experiencing high demand. Please try again in a few moments.",
        },
        {
          status: 503,
        }
      );
    }

    // Request timed out.
    if (
      error instanceof Error &&
      error.message.includes("timed out")
    ) {
      return NextResponse.json(
        {
          error:
            "The AI analysis took too long to respond. Please try again.",
        },
        {
          status: 504,
        }
      );
    }

    // Gemini returned malformed JSON.
    if (
      error instanceof Error &&
      error.message.includes("invalid JSON")
    ) {
      return NextResponse.json(
        {
          error:
            "The AI returned an unexpected response. Please try again.",
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to analyze code. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}