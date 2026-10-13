export default function UseGuide() {
  return <details className="how-to"><summary>New here? See how to use Stxic</summary>
    <p>Stxic helps you understand changes to an app or website before you approve or publish them. It reads your project; it does not edit your files.</p>
    <ol><li><strong>Choose your project.</strong> Browse to its folder on this computer. It needs Git: the saved-version history developers use. A website link or ZIP download alone is not enough.</li><li><strong>See what changed.</strong> Open AI change review and select Check changes. Current edits shows work since the last saved version. If you already saved it, select Latest saved version.</li><li><strong>Get a plain explanation.</strong> Explain with AI tells you what changed, why it matters, and what to check. Run deeper review is optional. AI suggestions can be wrong; they do not approve your work for you.</li></ol>
    <p><strong>File connections</strong> shows which project files use each other or often change together. A connection is a clue about what else to check, not proof something is broken.</p>
    <p><strong>Local or cloud?</strong> Local AI runs on your computer and needs Ollama. Cloud AI needs your own key and account access, and asks before sending selected code. Checking changes and the example work without AI.</p>
  </details>;
}
