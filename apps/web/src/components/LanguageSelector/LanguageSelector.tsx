import { useI18n } from '../../i18n';
import type { Language } from '../../i18n';

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  return (
    <select
      value={language}
      onChange={handleChange}
      className="bg-white/10 text-white border border-white/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
      aria-label={t.language}
    >
      <option value="en" className="text-gray-900">{t.english}</option>
      <option value="es" className="text-gray-900">{t.spanish}</option>
    </select>
  );
}
