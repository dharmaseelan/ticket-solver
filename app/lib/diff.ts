export type DiffLine = {
  type: "added" | "removed" | "unchanged";
  content: string;
};

export function computeDiff(original: string, updated: string): DiffLine[] {
  const a = original.split("\n");
  const b = updated.split("\n");

  // LCS DP table
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      result.push({ type: "unchanged", content: a[i] });
      i++; j++;
    } else if (i < a.length && (j >= b.length || dp[i + 1][j] >= dp[i][j + 1])) {
      result.push({ type: "removed", content: a[i] });
      i++;
    } else {
      result.push({ type: "added", content: b[j] });
      j++;
    }
  }
  return result;
}
