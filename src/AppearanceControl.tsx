import { Monitor, Moon, Sun } from 'lucide-react';
import type { Appearance } from './theme';
export default function AppearanceControl({ value, onChange }: { value: Appearance; onChange: (value: Appearance) => void }) {
  return <div className="theme-switch" role="group" aria-label="Appearance">{([
    ['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'Auto', Monitor],
  ] as const).map(([mode, label, Icon]) => <button key={mode} type="button" aria-label={mode === 'system' ? 'Use device appearance' : `Use ${label.toLowerCase()} appearance`} aria-pressed={value === mode} onClick={() => onChange(mode)} title={mode === 'system' ? 'Follow your device’s light or dark setting' : `Switch to ${label.toLowerCase()} mode`}><Icon size={15} aria-hidden="true" /><span>{label}</span></button>)}</div>;
}
