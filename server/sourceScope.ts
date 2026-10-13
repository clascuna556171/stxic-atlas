// Build products and tool exports are not editable project source.
export function isGeneratedPath(path: string) {
  return path.split(/[\\/]/).some((part) => ['node_modules', 'dist', 'build', '.git', '.dart_tool', '.next', '.hyperframes', 'coverage'].includes(part) || part.startsWith('brag-output-'));
}
