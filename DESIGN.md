# Stxic Atlas interface

## Visual direction

The Stxic mark replaces the four-tile placeholder: a vermilion diamond contains an angular S-shaped trace, three commit nodes, and a short branch. The Git-inspired geometry relates directly to saved changes; the S identifies Stxic. It is an original SVG mark, reused in the header/footer and favicon, and stays legible in both themes without raster generation or gradients.

The primary labels are File connections and AI change review. Folder guidance, ordinary-language reviewer descriptions, comparison choices, and a factual preview lead into optional AI interpretation. Setup controls remain visible rather than hiding required actions behind technical vocabulary. Readable text export supports sharing with someone who does not use JSON.

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

## Appearance and accessibility

The header offers Light, Dark, and Auto (default) appearance buttons. Auto follows the operating system, including changes while the app is open. The choice stays in browser local storage; it is not sent to the backend. Appearance is applied before React mounts. Shared semantic color tokens cover both workspaces, SVG map labels, form controls, diff excerpts, and dialogs. Dark appearance uses a charcoal canvas with raised surfaces, cyan structural signals, and vermilion selection. Both themes retain explicit labels and line styles for signal meaning.

Small supporting copy has stronger contrast; important annotations have larger text. Mobile actions have at least 44px height, form focus remains visible, and a skip link goes directly to the workspace. Signal filters are pressed buttons rather than incomplete ARIA tabs.

## Typefaces

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


## Explanation first

Long model paragraphs display a 55-word preview and a clearly labeled full-text expansion. Keep the complete original available in exports and evidence views. In-flight actions reject rapid duplicate clicks; changing project invalidates prior request results even when the user returns to that project.

Organize the main task around project choice, factual change preview, and a short AI explanation. Keep specialist weights and debate details out of the initial screen; they appear when a deeper review runs or has results. Quick explanations use three ordinary questions, with expandable code evidence rather than unsupported certainty. Local/cloud selection states the privacy boundary before submission. A native confirmation dialog exposes outgoing cloud context and requires explicit consent, with cancellation and Escape available. Folder browsing and recent paths complement the pasted path without replacing it. Existing palette, fonts, themes, keyboard controls, and reduced-motion behavior remain.


## Clear appearance and guidance

Light/Dark/Auto are labeled pressed buttons in a group, with 44px mobile targets and an independent full-width row on narrow screens. Auto follows the operating system. Optional inline guidance and the help dialog explain the actual task and the Git prerequisite. Cloud confirmation leads with filenames, bounded-coverage notes, and plain consent; raw context is an expandable detail. A zero-completion failure uses a warning icon and explicit failure wording, never a success checkmark.
