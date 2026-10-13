export type Appearance = 'system' | 'light' | 'dark';
export function readAppearance(): Appearance {
  try {
    const saved = localStorage.getItem('stxic-atlas-appearance');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Appearance still works when storage is unavailable. */ }
  return 'system';
}
export function applyAppearance(appearance: Appearance) {
  const dark = appearance === 'dark' || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141c22' : '#f2f3ef');
}
