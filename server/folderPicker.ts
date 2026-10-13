import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { repositoryRoot } from './repository.js';
let selecting = false;
export async function pickProjectFolder() {
  if (process.platform !== 'win32') throw new Error('Folder browsing is available on Windows. Paste the project folder address instead.');
  if (selecting) throw new Error('A folder window is already open. Choose a folder or cancel it.');
  selecting = true;
  try {
    const script = "Add-Type -AssemblyName System.Windows.Forms; [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); $picker = New-Object System.Windows.Forms.FolderBrowserDialog; $picker.Description = 'Choose your Git project folder'; $picker.ShowNewFolderButton = $false; try { if ($picker.ShowDialog() -eq 'OK') { [Console]::Write($picker.SelectedPath) } } finally { $picker.Dispose() }";
    const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { timeout: 120_000, maxBuffer: 8192, windowsHide: true, encoding: 'utf8' });
    return { repoPath: stdout.trim() ? await repositoryRoot(stdout.trim()) : null };
  } catch (error) {
    if (error instanceof Error && 'killed' in error) throw new Error('The folder window timed out. Open it again or paste the folder address.');
    throw error;
  } finally { selecting = false; }
}
