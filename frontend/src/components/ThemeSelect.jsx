import React, { useEffect } from 'react';
import { useLanguage } from '@/lib/language';
import { useTheme } from 'next-themes';
export default function ThemeSelect() {
  const { t } = useLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolvedTheme === "dark" ? "#19222f" : "#ffffff");
  }, [resolvedTheme]);
  return <select aria-label={t("Vzhled aplikace")} title={t("Vzhled aplikace")} value={theme || 'system'} onChange={e => setTheme(e.target.value)} className="theme-select min-h-11 rounded-lg border px-2 text-xs font-semibold">
    <option value="light">☀ {t("Světlý")}</option><option value="dark">☾ {t("Tmavý")}</option><option value="system">◐ {t("Automaticky")}</option>
  </select>;
}
