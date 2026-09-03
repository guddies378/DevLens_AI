import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";

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

function runMetricsAnalyzer(
  code: string,
  language: string
): Promise<CodeMetrics> {
  return new Promise((resolve, reject) => {
    const projectRoot = process.cwd();

    const pythonPath =
      process.platform === "win32"
        ? path.join(
            projectRoot,
            ".venv",
            "Scripts",
            "python.exe"
          )
        : path.join(
            projectRoot,
            ".venv",
            "bin",
            "python"
          );

    const analyzerPath = path.join(
      projectRoot,
      "python",
      "analyzer.py"
    );

    const pythonProcess = spawn(
      pythonPath,
      [analyzerPath],
      {
        stdio: [
          "pipe",
          "pipe",
          "pipe",
        ],
      }
    );

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on(
      "data",
      (data) => {
        output += data.toString();
      }
    );

    pythonProcess.stderr.on(
      "data",
      (data) => {
        errorOutput += data.toString();
      }
    );

    pythonProcess.on(
      "error",
      (error) => {
        reject(error);
      }
    );

    pythonProcess.on(
      "close",
      (exitCode) => {
        if (exitCode !== 0) {
          reject(
            new Error(
              errorOutput ||
                `Python exited with code ${exitCode}`
            )
          );

          return;
        }

        try {
          const result =
            JSON.parse(output);

          if (result.error) {
            reject(
              new Error(
                result.error
              )
            );

            return;
          }

          resolve(result);
        } catch {
          reject(
            new Error(
              `Could not parse metrics response: ${output}`
            )
          );
        }
      }
    );

    const input = JSON.stringify({
      code,
      language,
    });

    pythonProcess.stdin.write(
      input
    );

    pythonProcess.stdin.end();
  });
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const {
      code,
      language,
    } = body;

    if (!code || !code.trim()) {
      return NextResponse.json(
        {
          error:
            "Code is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!language) {
      return NextResponse.json(
        {
          error:
            "Programming language is required.",
        },
        {
          status: 400,
        }
      );
    }

    const metrics =
      await runMetricsAnalyzer(
        code,
        language
      );

    return NextResponse.json(
      metrics
    );
  } catch (error) {
    console.error(
      "Metrics error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate code metrics.",
      },
      {
        status: 500,
      }
    );
  }
}