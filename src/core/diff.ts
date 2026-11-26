export type DiffLineType = "unchanged" | "added" | "removed";

export interface DiffLine {
  type: DiffLineType;
  line: string;
  beforeLineNumber: number | null;
  afterLineNumber: number | null;
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\r\n/g, "\n").split("\n");
}

function cell(dp: number[][], r: number, c: number): number {
  return dp[r]?.[c] ?? 0;
}

function buildLcsTable(before: string[], after: string[]): number[][] {
  const rows = before.length + 1;
  const cols = after.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(0),
  );

  for (let i = before.length - 1; i >= 0; i -= 1) {
    const row = dp[i]!;
    for (let j = after.length - 1; j >= 0; j -= 1) {
      row[j] =
        before[i] === after[j]
          ? cell(dp, i + 1, j + 1) + 1
          : Math.max(cell(dp, i + 1, j), cell(dp, i, j + 1));
    }
  }

  return dp;
}

function backtrackDiff(
  before: string[],
  after: string[],
  dp: number[][],
): DiffLine[] {
  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < before.length && j < after.length) {
    const bLine = before[i] ?? "";
    const aLine = after[j] ?? "";
    if (bLine === aLine) {
      result.push({
        type: "unchanged",
        line: bLine,
        beforeLineNumber: i + 1,
        afterLineNumber: j + 1,
      });
      i += 1;
      j += 1;
    } else if (cell(dp, i + 1, j) >= cell(dp, i, j + 1)) {
      result.push({
        type: "removed",
        line: bLine,
        beforeLineNumber: i + 1,
        afterLineNumber: null,
      });
      i += 1;
    } else {
      result.push({
        type: "added",
        line: aLine,
        beforeLineNumber: null,
        afterLineNumber: j + 1,
      });
      j += 1;
    }
  }

  while (i < before.length) {
    result.push({
      type: "removed",
      line: before[i] ?? "",
      beforeLineNumber: i + 1,
      afterLineNumber: null,
    });
    i += 1;
  }
  while (j < after.length) {
    result.push({
      type: "added",
      line: after[j] ?? "",
      beforeLineNumber: null,
      afterLineNumber: j + 1,
    });
    j += 1;
  }

  return result;
}

export function computeLineDiff(before: string, after: string): DiffLine[] {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  if (beforeLines.length === 0 && afterLines.length === 0) return [];
  const dp = buildLcsTable(beforeLines, afterLines);
  return backtrackDiff(beforeLines, afterLines, dp);
}
