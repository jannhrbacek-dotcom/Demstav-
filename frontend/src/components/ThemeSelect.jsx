import React from 'react';
import { useTheme } from 'next-themes';
export default function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  return <select aria-label="Vzhled aplikace" title="Vzhled aplikace" value={theme || 'system'} onChange={e => setTheme(e.target.value)} className="theme-select min-h-11 rounded-lg border px-2 text-xs font-semibold">
    <option value="light">☀ Světlý</option><option value="dark">☾ Tmavý</option><option value="system">◐ Automaticky</option>
  </select>;
}
