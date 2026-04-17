/** Paste clipboard text into the operator token field (requires user gesture + permission). */
export async function pasteOperatorTokenFromClipboard(setToken: (value: string) => void): Promise<boolean> {
  try {
    const t = await navigator.clipboard.readText();
    const v = t.trim();
    if (!v) return false;
    setToken(v);
    return true;
  } catch {
    return false;
  }
}
