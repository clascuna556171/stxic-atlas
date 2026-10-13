# Stxic Atlas interface

## Visual direction

The interface treats repository relationships as a gridded engineering field. Its visible construction grid belongs to the impact map, where edges and file nodes are measured; it does not extend behind unrelated page content. The map should feel inspectable and precise, while the surrounding review controls stay familiar.

## Palette

- Canvas: `#f2f3ef`
- Raised paper: `#f8f9f5`
- Main ink: `#18242e`
- Muted copy: `#63717b`
- Structural signal: `#227a97`
- Historical signal: `#d17252`
- Selected target: `#e25535`
- Map field: `#eef1ee`

Structural imports and history co-changes use different colors and line styles. The selected target uses vermilion. The graph background grid is reserved for that map surface.

## Type

Barlow Condensed carries display headings; DM Sans carries interface copy; IBM Plex Mono identifies paths, measurements, and evidence labels. The font files are bundled locally with the app.

## Structure and behavior

- Repository identity and local scan controls lead into an explicit synthetic sample notice.
- The overview strip reports counts and the selected file's connected evidence scope.
- The relationship field is the primary visualization. File nodes are keyboard operable as well as clickable.
- The evidence panel and review signals name their source: current relative imports or shared Git commits.
- The same app supports a narrow single-column layout. The graph preserves its canvas dimensions and can scroll horizontally on a phone.
- Focus rings, labeled inputs, status messages, reduced-motion handling, and transparent sample labeling are part of the interface contract.
- Review examples carry a persistent synthetic notice above the result. Example votes are temporary; they must not resemble saved feedback from a real run.
- The review report labels its summary source as model interpretation, Git counts, or a synthetic example. Incomplete reviews explain which passes or source coverage are missing.
- The field guide uses a native modal dialog for Escape, contained focus, and restoration to the opening control.
