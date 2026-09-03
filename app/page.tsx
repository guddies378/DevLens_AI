"use client";

import { useState } from "react";
import { languages } from "@/data/languages";
import CodeEditor from "@/components/CodeEditor";

type AnalysisResult = {
  score: number;
  explanation: string;
  issues: string[];
  suggestions: string[];
  improvedCode: string;
};

type CodeMetrics = {
  language: string;
  totalLines: number;
  codeLines: number;
  blankLines: number;
  commentLines: number;
  functions: number;
  classes: number;
  imports: number;
  syntaxValid: boolean;
  complexity: number;
  complexityBlocks: {
    name: string;
    complexity: number;
    line: number;
  }[];
  maintainability: number;
};

export default function Home() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("JavaScript");

  const [analysis, setAnalysis] =
    useState<AnalysisResult | null>(null);

  const [metrics, setMetrics] =
    useState<CodeMetrics | null>(null);

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [analysisError, setAnalysisError] =
    useState("");

  const [metricsError, setMetricsError] =
    useState("");

  const [languageOpen, setLanguageOpen] =
    useState(false);

  const [languageSearch, setLanguageSearch] =
    useState("");

  const filteredLanguages = languages.filter((item) =>
    item.name
      .toLowerCase()
      .includes(languageSearch.toLowerCase())
  );

  const selectedLanguage = languages.find(
    (item) => item.name === language
  );

  // =========================================================
  // ANALYZE CODE
  // =========================================================

  const analyzeCode = async () => {
    if (!code.trim()) {
      return;
    }

    setLoading(true);

    setAnalysis(null);
    setMetrics(null);

    setAnalysisError("");
    setMetricsError("");

    setCopied(false);

    try {
      // Gemini AI analysis
      const aiRequest = fetch("/api/analyze", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          code,
          language,
        }),
      });

      // DevLens metrics engine
      // Runs for every supported language
      const metricsRequest = fetch("/api/metrics", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          code,
          language,
        }),
      });

      // =====================================================
      // AI RESPONSE
      // =====================================================

      const aiResponse = await aiRequest;

      if (!aiResponse.ok) {
        const errorData = await aiResponse
          .json()
          .catch(() => null);

        setAnalysisError(
          errorData?.error ||
            "AI analysis failed. Please try again."
        );

        return;
      }

      const aiResult: AnalysisResult =
        await aiResponse.json();

      setAnalysis(aiResult);

      // =====================================================
      // METRICS RESPONSE
      // =====================================================

      const metricsResponse =
        await metricsRequest;

      if (metricsResponse.ok) {
        const metricsResult: CodeMetrics =
          await metricsResponse.json();

        setMetrics(metricsResult);
      } else {
        const errorData = await metricsResponse
          .json()
          .catch(() => null);

        setMetricsError(
          errorData?.error ||
            "Code metrics are currently unavailable."
        );
      }
    } catch (error) {
      console.error(
        "Analysis request error:",
        error
      );

      setAnalysisError(
        "Unable to connect to the analysis service."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // COPY IMPROVED CODE
  // =========================================================

  const copyImprovedCode = async () => {
    if (!analysis?.improvedCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        analysis.improvedCode
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "Failed to copy improved code:",
        error
      );
    }
  };

  // =========================================================
  // LANGUAGE SELECTOR
  // =========================================================

  const selectLanguage = (
    newLanguage: string
  ) => {
    setLanguage(newLanguage);

    setLanguageOpen(false);
    setLanguageSearch("");

    setAnalysis(null);
    setMetrics(null);

    setAnalysisError("");
    setMetricsError("");

    setCopied(false);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="mb-10 flex items-center justify-between gap-4 sm:mb-12">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              DevLens
              <span className="text-zinc-500">
                {" "}
                AI
              </span>
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              AI-powered multi-language code analysis
            </p>
          </div>

          <span className="shrink-0 rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 sm:px-4 sm:py-2">
            v1.0
          </span>
        </header>

        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <section className="grid gap-8 lg:grid-cols-2">

          {/* =================================================
              LEFT SIDE
          ================================================= */}

          <div>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="font-semibold">
                Your Code
              </h2>

              {/* LANGUAGE SELECTOR */}

              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setLanguageOpen(
                      (previous) => !previous
                    )
                  }
                  className="
                    flex
                    min-w-40
                    items-center
                    justify-between
                    gap-4
                    rounded-lg
                    border
                    border-zinc-800
                    bg-zinc-950
                    px-3
                    py-2
                    text-sm
                    text-zinc-300
                    transition
                    hover:border-zinc-700
                  "
                >
                  <span>
                    {selectedLanguage?.name ||
                      language}
                  </span>

                  <span className="text-[10px] text-zinc-600">
                    ▼
                  </span>
                </button>

                {/* LANGUAGE DROPDOWN */}

                {languageOpen && (
                  <div
                    className="
                      absolute
                      right-0
                      top-full
                      z-50
                      mt-2
                      w-70
                      overflow-hidden
                      rounded-xl
                      border
                      border-zinc-800
                      bg-zinc-950
                      shadow-2xl
                    "
                  >
                    {/* SEARCH */}

                    <div className="border-b border-zinc-800 p-3">
                      <input
                        type="text"
                        value={languageSearch}
                        onChange={(event) =>
                          setLanguageSearch(
                            event.target.value
                          )
                        }
                        placeholder="Search language..."
                        autoFocus
                        className="
                          w-full
                          rounded-lg
                          border
                          border-zinc-800
                          bg-black
                          px-3
                          py-2
                          text-sm
                          text-zinc-200
                          outline-none
                          placeholder:text-zinc-600
                          focus:border-zinc-600
                        "
                      />
                    </div>

                    {/* LANGUAGE LIST */}

                    <div className="max-h-80 overflow-y-auto p-2">
                      {filteredLanguages.length >
                      0 ? (
                        filteredLanguages.map(
                          (item) => (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() =>
                                selectLanguage(
                                  item.name
                                )
                              }
                              className={`
                                flex
                                w-full
                                items-center
                                justify-between
                                rounded-lg
                                px-3
                                py-2.5
                                text-left
                                text-sm
                                transition
                                ${
                                  language ===
                                  item.name
                                    ? "bg-zinc-800 text-white"
                                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                }
                              `}
                            >
                              <span>
                                {item.name}
                              </span>

                              <span className="text-xs text-zinc-600">
                                {item.short}
                              </span>
                            </button>
                          )
                        )
                      ) : (
                        <p className="px-3 py-6 text-center text-sm text-zinc-600">
                          No language found.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* =================================================
                MAIN MONACO EDITOR
            ================================================= */}

            <CodeEditor
              code={code}
              language={language}
              onChange={setCode}
            />

            {/* =================================================
                ANALYZE BUTTON
            ================================================= */}

            <button
              type="button"
              onClick={analyzeCode}
              disabled={
                loading || !code.trim()
              }
              className="
                mt-4
                w-full
                rounded-xl
                bg-white
                px-6
                py-3
                font-semibold
                text-black
                transition
                hover:bg-zinc-200
                disabled:cursor-not-allowed
                disabled:bg-zinc-700
                disabled:text-zinc-400
              "
            >
              {loading
                ? "Analyzing..."
                : "Analyze Code"}
            </button>
          </div>

          {/* =================================================
              RIGHT SIDE
          ================================================= */}

          <div>
            <h2 className="mb-3 font-semibold">
              Analysis
            </h2>

            <div
              className="
                min-h-125
                rounded-xl
                border
                border-zinc-800
                bg-zinc-950
                p-4
                sm:p-6
              "
            >

              {/* =================================================
                  ANALYSIS ERROR
              ================================================= */}

              {analysisError && (
                <div className="mb-6 rounded-xl border border-red-900/50 bg-red-950/20 p-4">
                  <p className="text-sm font-medium text-red-300">
                    Analysis Error
                  </p>

                  <p className="mt-2 text-sm leading-6 text-red-400">
                    {analysisError}
                  </p>
                </div>
              )}

              {/* =================================================
                  EMPTY STATE
              ================================================= */}

              {!analysis &&
                !loading &&
                !analysisError && (
                  <div className="flex min-h-112.5 items-center justify-center">
                    <div className="text-center">
                      <div className="mb-4 text-4xl">
                        ⌘
                      </div>

                      <h3 className="font-medium text-zinc-300">
                        Ready to analyze
                      </h3>

                      <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-600">
                        Paste your code, choose the
                        programming language, and
                        click Analyze Code.
                      </p>

                      <p className="mt-3 text-xs text-zinc-700">
                        Code metrics are available
                        for all supported languages.
                      </p>
                    </div>
                  </div>
                )}

              {/* =================================================
                  LOADING
              ================================================= */}

              {loading && (
                <div className="flex min-h-112.5 items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />

                    <p className="text-sm text-zinc-400">
                      Analyzing your code...
                    </p>

                    <p className="mt-2 text-xs text-zinc-600">
                      Running AI review and static
                      code metrics
                    </p>
                  </div>
                </div>
              )}

              {/* =================================================
                  ANALYSIS RESULTS
              ================================================= */}

              {analysis && (
                <div>

                  {/* =============================================
                      QUALITY SCORE
                  ============================================= */}

                  <div className="mb-8">
                    <p className="text-xs font-medium tracking-wider text-zinc-500">
                      CODE QUALITY
                    </p>

                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-5xl font-bold">
                        {analysis.score}
                      </span>

                      <span className="mb-1 text-zinc-500">
                        /100
                      </span>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full bg-white transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            Math.max(
                              analysis.score,
                              0
                            ),
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* =============================================
                      EXPLANATION
                  ============================================= */}

                  <div className="mb-8">
                    <h3 className="mb-3 font-semibold">
                      Explanation
                    </h3>

                    <p className="text-sm leading-7 text-zinc-400">
                      {analysis.explanation}
                    </p>
                  </div>

                  {/* =============================================
                      POTENTIAL ISSUES
                  ============================================= */}

                  <div className="mb-8">
                    <h3 className="mb-3 font-semibold">
                      Potential Issues
                    </h3>

                    {analysis.issues.length >
                    0 ? (
                      <div className="space-y-3">
                        {analysis.issues.map(
                          (issue, index) => (
                            <div
                              key={index}
                              className="
                                rounded-lg
                                border
                                border-zinc-800
                                bg-black/30
                                p-3
                                text-sm
                                leading-6
                                text-zinc-400
                              "
                            >
                              <span className="mr-2 text-zinc-600">
                                {index + 1}.
                              </span>

                              {issue}
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-zinc-800 p-3 text-sm text-zinc-400">
                        No major issues detected.
                      </div>
                    )}
                  </div>

                  {/* =============================================
                      SUGGESTIONS
                  ============================================= */}

                  <div className="mb-8">
                    <h3 className="mb-3 font-semibold">
                      Suggestions
                    </h3>

                    {analysis.suggestions.length >
                    0 ? (
                      <div className="space-y-3">
                        {analysis.suggestions.map(
                          (
                            suggestion,
                            index
                          ) => (
                            <div
                              key={index}
                              className="
                                rounded-lg
                                bg-zinc-900
                                p-3
                                text-sm
                                leading-6
                                text-zinc-400
                              "
                            >
                              <span className="mr-2">
                                ✓
                              </span>

                              {suggestion}
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg bg-zinc-900 p-3 text-sm text-zinc-400">
                        No additional improvements
                        required.
                      </div>
                    )}
                  </div>

                  {/* =============================================
                      METRICS ERROR
                  ============================================= */}

                  {metricsError && (
                    <div className="mb-8 rounded-xl border border-yellow-900/50 bg-yellow-950/20 p-4">
                      <p className="text-sm font-medium text-yellow-300">
                        Code Metrics Unavailable
                      </p>

                      <p className="mt-2 text-sm leading-6 text-yellow-400">
                        {metricsError}
                      </p>
                    </div>
                  )}

                  {/* =============================================
                      CODE METRICS
                  ============================================= */}

                  {metrics && (
                    <div className="mb-8">
                      <div className="mb-4">
                        <h3 className="font-semibold">
                          {language} Code Metrics
                        </h3>

                        <p className="mt-1 text-xs text-zinc-600">
                          Static analysis calculated
                          by the DevLens metrics engine
                        </p>
                      </div>

                      {/* MAIN METRICS */}

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <p className="text-2xl font-bold">
                            {metrics.totalLines}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            Total Lines
                          </p>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <p className="text-2xl font-bold">
                            {metrics.codeLines}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            Code Lines
                          </p>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <p className="text-2xl font-bold">
                            {metrics.functions}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            Functions
                          </p>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <p className="text-2xl font-bold">
                            {metrics.classes}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            Classes
                          </p>
                        </div>
                      </div>

                      {/* COMPLEXITY + MAINTAINABILITY */}

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
                          <p className="text-xs uppercase tracking-wide text-zinc-500">
                            {language === "Python"
                              ? "Complexity"
                              : "Estimated Complexity"}
                          </p>

                          <p className="mt-2 text-3xl font-bold">
                            {metrics.complexity}
                          </p>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
                          <p className="text-xs uppercase tracking-wide text-zinc-500">
                            Maintainability
                          </p>

                          <div className="mt-2 flex items-end gap-1">
                            <p className="text-3xl font-bold">
                              {
                                metrics.maintainability
                              }
                            </p>

                            <span className="mb-1 text-sm text-zinc-600">
                              /100
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ADDITIONAL METRICS */}

                      <div className="mt-3 rounded-xl border border-zinc-800 bg-black/30 p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                          <div>
                            <p className="text-zinc-500">
                              Blank Lines
                            </p>

                            <p className="mt-1 font-medium">
                              {
                                metrics.blankLines
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-zinc-500">
                              Comments
                            </p>

                            <p className="mt-1 font-medium">
                              {
                                metrics.commentLines
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-zinc-500">
                              Imports
                            </p>

                            <p className="mt-1 font-medium">
                              {metrics.imports}
                            </p>
                          </div>

                          <div>
                            <p className="text-zinc-500">
                              Syntax
                            </p>

                            <p className="mt-1 font-medium">
                              {language === "Python"
                                ? metrics.syntaxValid
                                  ? "✓ Valid"
                                  : "✕ Invalid"
                                : "Estimated"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* =========================================
                          PYTHON COMPLEXITY BREAKDOWN
                      ========================================= */}

                      {language === "Python" &&
                        metrics.complexityBlocks
                          .length > 0 && (
                          <div className="mt-3 rounded-xl border border-zinc-800 p-4">
                            <h4 className="mb-3 text-sm font-medium text-zinc-300">
                              Complexity Breakdown
                            </h4>

                            <div className="space-y-2">
                              {metrics.complexityBlocks.map(
                                (
                                  block,
                                  index
                                ) => (
                                  <div
                                    key={`${block.name}-${index}`}
                                    className="flex items-center justify-between gap-4 text-sm"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-zinc-400">
                                        {
                                          block.name
                                        }
                                      </p>

                                      <p className="text-xs text-zinc-600">
                                        Line{" "}
                                        {block.line}
                                      </p>
                                    </div>

                                    <span className="shrink-0 rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
                                      Complexity{" "}
                                      {
                                        block.complexity
                                      }
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* =============================================
                      IMPROVED CODE
                  ============================================= */}

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">
                          Improved Code
                        </h3>

                        <p className="mt-1 text-xs text-zinc-600">
                          AI-generated improved{" "}
                          {language} code
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={copyImprovedCode}
                        disabled={
                          !analysis.improvedCode
                        }
                        className="
                          shrink-0
                          rounded-md
                          border
                          border-zinc-700
                          px-3
                          py-1.5
                          text-xs
                          text-zinc-300
                          transition
                          hover:border-zinc-600
                          hover:bg-zinc-800
                          disabled:cursor-not-allowed
                          disabled:opacity-50
                        "
                      >
                        {copied
                          ? "✓ Copied!"
                          : "Copy Code"}
                      </button>
                    </div>

                    {/* =========================================
                        READ-ONLY MONACO EDITOR
                    ========================================= */}

                    <CodeEditor
                      code={analysis.improvedCode}
                      language={language}
                      onChange={() => {}}
                      readOnly={true}
                      height="420px"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="mt-16 border-t border-zinc-900 pt-6 text-center text-xs text-zinc-600">
          DevLens AI — AI-powered multi-language
          code analysis
        </footer>
      </div>
    </main>
  );
}