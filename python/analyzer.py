import ast
import json
import re
import sys

from radon.complexity import cc_visit
from radon.metrics import mi_visit


HASH_COMMENT_LANGUAGES = {
    "Python",
    "Ruby",
    "R",
    "Perl",
    "Shell / Bash",
    "PowerShell",
    "YAML",
}

SLASH_COMMENT_LANGUAGES = {
    "JavaScript",
    "TypeScript",
    "Java",
    "C",
    "C++",
    "C#",
    "PHP",
    "Go",
    "Rust",
    "Swift",
    "Kotlin",
    "Dart",
    "Scala",
    "Objective-C",
    "Solidity",
    "Groovy",
}

HTML_COMMENT_LANGUAGES = {
    "HTML",
    "XML",
}


def count_lines(code: str, language: str):
    lines = code.splitlines()

    total_lines = len(lines)
    blank_lines = 0
    comment_lines = 0
    code_lines = 0

    in_block_comment = False

    for line in lines:
        stripped = line.strip()

        if not stripped:
            blank_lines += 1
            continue

        if language in HTML_COMMENT_LANGUAGES:
            if stripped.startswith("<!--"):
                comment_lines += 1

                if "-->" not in stripped:
                    in_block_comment = True

                continue

            if in_block_comment:
                comment_lines += 1

                if "-->" in stripped:
                    in_block_comment = False

                continue

        if language in SLASH_COMMENT_LANGUAGES:
            if stripped.startswith("/*"):
                comment_lines += 1

                if "*/" not in stripped:
                    in_block_comment = True

                continue

            if in_block_comment:
                comment_lines += 1

                if "*/" in stripped:
                    in_block_comment = False

                continue

            if stripped.startswith("//"):
                comment_lines += 1
                continue

        if language in HASH_COMMENT_LANGUAGES:
            if stripped.startswith("#"):
                comment_lines += 1
                continue

        if language == "SQL":
            if stripped.startswith("--"):
                comment_lines += 1
                continue

        if language == "MATLAB":
            if stripped.startswith("%"):
                comment_lines += 1
                continue

        code_lines += 1

    return {
        "totalLines": total_lines,
        "codeLines": code_lines,
        "blankLines": blank_lines,
        "commentLines": comment_lines,
    }


def analyze_python_structures(code: str):
    try:
        tree = ast.parse(code)

    except SyntaxError:
        return {
            "functions": 0,
            "classes": 0,
            "imports": 0,
            "syntaxValid": False,
        }

    functions = 0
    classes = 0
    imports = 0

    for node in ast.walk(tree):
        if isinstance(
            node,
            (
                ast.FunctionDef,
                ast.AsyncFunctionDef,
            ),
        ):
            functions += 1

        elif isinstance(node, ast.ClassDef):
            classes += 1

        elif isinstance(
            node,
            (
                ast.Import,
                ast.ImportFrom,
            ),
        ):
            imports += 1

    return {
        "functions": functions,
        "classes": classes,
        "imports": imports,
        "syntaxValid": True,
    }


def count_matches(patterns, code):
    count = 0

    for pattern in patterns:
        count += len(
            re.findall(
                pattern,
                code,
                flags=re.MULTILINE,
            )
        )

    return count


def analyze_generic_structures(code: str, language: str):
    functions = 0
    classes = 0
    imports = 0

    # JavaScript / TypeScript
    if language in {"JavaScript", "TypeScript"}:
        functions += count_matches(
            [
                r"\bfunction\s+\w+\s*\(",
                r"\b(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>",
                r"\b(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\w+\s*=>",
                r"^\s*(?:async\s+)?\w+\s*\([^)]*\)\s*\{",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\bclass\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*import\s+",
                r"\brequire\s*\(",
            ],
            code,
        )

    # Java
    elif language == "Java":
        functions += count_matches(
            [
                r"^\s*(?:public|private|protected|static|final|abstract|synchronized|\s)+"
                r"[\w<>\[\]?]+\s+\w+\s*\([^;{}]*\)\s*(?:throws\s+[^{]+)?\{",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\bclass\s+\w+",
                r"\binterface\s+\w+",
                r"\benum\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*import\s+",
            ],
            code,
        )

    # C / C++
    elif language in {"C", "C++"}:
        functions += count_matches(
            [
                r"^\s*(?!if\b|for\b|while\b|switch\b|catch\b)"
                r"[\w:*&<>\[\]\s]+\s+\w+(?:::\w+)?\s*\([^;{}]*\)\s*\{",
            ],
            code,
        )

        if language == "C++":
            classes = count_matches(
                [
                    r"\bclass\s+\w+",
                    r"\bstruct\s+\w+",
                ],
                code,
            )

        imports = count_matches(
            [
                r"^\s*#include\s+",
            ],
            code,
        )

    # C#
    elif language == "C#":
        functions += count_matches(
            [
                r"^\s*(?:public|private|protected|internal|static|virtual|override|async|sealed|\s)+"
                r"[\w<>\[\]?]+\s+\w+\s*\([^;{}]*\)\s*\{",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\bclass\s+\w+",
                r"\binterface\s+\w+",
                r"\bstruct\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*using\s+[\w.]",
            ],
            code,
        )

    # Go
    elif language == "Go":
        functions = count_matches(
            [
                r"\bfunc\s+(?:\([^)]*\)\s*)?\w+\s*\(",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\btype\s+\w+\s+struct\b",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*import\s+",
                r'^\s*"[^"]+"\s*$',
            ],
            code,
        )

    # Rust
    elif language == "Rust":
        functions = count_matches(
            [
                r"\bfn\s+\w+\s*\(",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\bstruct\s+\w+",
                r"\benum\s+\w+",
                r"\btrait\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*use\s+",
                r"^\s*extern\s+crate\s+",
            ],
            code,
        )

    # PHP
    elif language == "PHP":
        functions = count_matches(
            [
                r"\bfunction\s+\w+\s*\(",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\bclass\s+\w+",
                r"\binterface\s+\w+",
                r"\btrait\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*use\s+",
                r"\brequire(?:_once)?\s*\(",
                r"\binclude(?:_once)?\s*\(",
            ],
            code,
        )

    # Ruby
    elif language == "Ruby":
        functions = count_matches(
            [
                r"^\s*def\s+\w+",
            ],
            code,
        )

        classes = count_matches(
            [
                r"^\s*class\s+\w+",
                r"^\s*module\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*require\s+",
                r"^\s*require_relative\s+",
            ],
            code,
        )

    # Kotlin
    elif language == "Kotlin":
        functions = count_matches(
            [
                r"\bfun\s+\w+\s*\(",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\bclass\s+\w+",
                r"\binterface\s+\w+",
                r"\bobject\s+\w+",
                r"\bdata\s+class\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*import\s+",
            ],
            code,
        )

    # Swift
    elif language == "Swift":
        functions = count_matches(
            [
                r"\bfunc\s+\w+\s*\(",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\bclass\s+\w+",
                r"\bstruct\s+\w+",
                r"\benum\s+\w+",
                r"\bprotocol\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*import\s+",
            ],
            code,
        )

    # Dart
    elif language == "Dart":
        functions = count_matches(
            [
                r"^\s*(?:[\w<>?]+\s+)?\w+\s*\([^;{}]*\)\s*\{",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\bclass\s+\w+",
                r"\benum\s+\w+",
                r"\bmixin\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*import\s+",
            ],
            code,
        )

    # Scala
    elif language == "Scala":
        functions = count_matches(
            [
                r"\bdef\s+\w+\s*\(",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\bclass\s+\w+",
                r"\bobject\s+\w+",
                r"\btrait\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*import\s+",
            ],
            code,
        )

    # Solidity
    elif language == "Solidity":
        functions = count_matches(
            [
                r"\bfunction\s+\w+\s*\(",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\bcontract\s+\w+",
                r"\binterface\s+\w+",
                r"\blibrary\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*import\s+",
            ],
            code,
        )

    # Julia
    elif language == "Julia":
        functions = count_matches(
            [
                r"^\s*function\s+\w+",
            ],
            code,
        )

        classes = count_matches(
            [
                r"^\s*(?:mutable\s+)?struct\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*using\s+",
                r"^\s*import\s+",
            ],
            code,
        )

    # R
    elif language == "R":
        functions = count_matches(
            [
                r"\b\w+\s*<-\s*function\s*\(",
                r"\b\w+\s*=\s*function\s*\(",
            ],
            code,
        )

        imports = count_matches(
            [
                r"\blibrary\s*\(",
                r"\brequire\s*\(",
            ],
            code,
        )

    # Shell / Bash
    elif language == "Shell / Bash":
        functions = count_matches(
            [
                r"^\s*\w+\s*\(\)\s*\{",
                r"^\s*function\s+\w+",
            ],
            code,
        )

    # PowerShell
    elif language == "PowerShell":
        functions = count_matches(
            [
                r"^\s*function\s+[\w-]+",
            ],
            code,
        )

        classes = count_matches(
            [
                r"^\s*class\s+\w+",
            ],
            code,
        )

        imports = count_matches(
            [
                r"^\s*Import-Module\s+",
            ],
            code,
        )

    # HTML
    elif language == "HTML":
        classes = count_matches(
            [
                r"\bclass\s*=",
            ],
            code,
        )

    # CSS / SCSS
    elif language in {"CSS", "SCSS"}:
        classes = count_matches(
            [
                r"(?m)^\s*\.[A-Za-z_-][\w-]*",
            ],
            code,
        )

        imports = count_matches(
            [
                r"@import\s+",
                r"@use\s+",
            ],
            code,
        )

    # SQL
    elif language == "SQL":
        functions = count_matches(
            [
                r"\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b",
                r"\bCREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\b",
            ],
            code,
        )

    # GraphQL
    elif language == "GraphQL":
        functions = count_matches(
            [
                r"\bquery\s+\w+",
                r"\bmutation\s+\w+",
                r"\bsubscription\s+\w+",
            ],
            code,
        )

        classes = count_matches(
            [
                r"\btype\s+\w+",
                r"\binterface\s+\w+",
            ],
            code,
        )

    return {
        "functions": functions,
        "classes": classes,
        "imports": imports,
        "syntaxValid": True,
    }


def calculate_python_complexity(code: str):
    try:
        blocks = cc_visit(code)

        # Radon includes methods in the class complexity it reports. Only
        # aggregate top-level blocks so methods are not counted twice.
        total_complexity = sum(
            block.complexity
            for block in blocks
            if not getattr(block, "classname", None)
        )

        results = []

        for block in blocks:
            results.append(
                {
                    "name": block.name,
                    "complexity": block.complexity,
                    "line": block.lineno,
                }
            )

        return {
            "complexity": total_complexity,
            "complexityBlocks": results,
        }

    except Exception:
        return {
            "complexity": 0,
            "complexityBlocks": [],
        }


def calculate_generic_complexity(code: str):
    patterns = [
        r"\bif\b",
        r"\belse\s+if\b",
        r"\belif\b",
        r"\bfor\b",
        r"\bwhile\b",
        r"\bcase\b",
        r"\bcatch\b",
        r"\bexcept\b",
        r"\bwhen\b",
        r"\bmatch\b",
        r"&&",
        r"\|\|",
    ]

    complexity = 1

    for pattern in patterns:
        complexity += len(
            re.findall(
                pattern,
                code,
                flags=re.IGNORECASE,
            )
        )

    return {
        "complexity": complexity,
        "complexityBlocks": [],
    }


def calculate_python_maintainability(code: str):
    try:
        return round(
            mi_visit(
                code,
                multi=True,
            ),
            2,
        )

    except Exception:
        return 0


def calculate_generic_maintainability(
    code_lines: int,
    comment_lines: int,
    complexity: int,
):
    score = 100.0

    score -= min(
        complexity * 1.5,
        35,
    )

    if code_lines > 50:
        score -= min(
            (code_lines - 50) * 0.10,
            20,
        )

    if code_lines > 200:
        score -= 10

    if code_lines > 0:
        comment_ratio = (
            comment_lines / code_lines
        )

        score += min(
            comment_ratio * 15,
            5,
        )

    return round(
        max(
            0,
            min(score, 100),
        ),
        2,
    )


def analyze_code(code: str, language: str):
    line_metrics = count_lines(
        code,
        language,
    )

    if language == "Python":
        structure_metrics = (
            analyze_python_structures(code)
        )

        complexity_metrics = (
            calculate_python_complexity(code)
        )

        maintainability = (
            calculate_python_maintainability(
                code
            )
        )

    else:
        structure_metrics = (
            analyze_generic_structures(
                code,
                language,
            )
        )

        complexity_metrics = (
            calculate_generic_complexity(
                code
            )
        )

        maintainability = (
            calculate_generic_maintainability(
                line_metrics["codeLines"],
                line_metrics["commentLines"],
                complexity_metrics[
                    "complexity"
                ],
            )
        )

    return {
        "language": language,
        **line_metrics,
        **structure_metrics,
        **complexity_metrics,
        "maintainability": maintainability,
    }


def main():
    try:
        raw_input = sys.stdin.read()

        if not raw_input.strip():
            print(
                json.dumps(
                    {
                        "error": "No input provided."
                    }
                )
            )
            return

        data = json.loads(raw_input)

        code = data.get(
            "code",
            "",
        )

        language = data.get(
            "language",
            "",
        )

        if not code.strip():
            print(
                json.dumps(
                    {
                        "error": "No code provided."
                    }
                )
            )
            return

        if not language:
            print(
                json.dumps(
                    {
                        "error": "Language is required."
                    }
                )
            )
            return

        result = analyze_code(
            code,
            language,
        )

        print(
            json.dumps(result)
        )

    except Exception as error:
        print(
            json.dumps(
                {
                    "error": str(error)
                }
            )
        )


if __name__ == "__main__":
    main()