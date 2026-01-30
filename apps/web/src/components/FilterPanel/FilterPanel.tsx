import { FilterState, ActivityType, ACTIVITY_COLORS } from '../../types/report';
import { useI18n, getActivityTypeLabel, ACTIVITY_TYPE_KEYS } from '../../i18n';

interface FilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function FilterPanel({ filters, onChange, isOpen, onToggle }: FilterPanelProps) {
  const { t, language } = useI18n();

  const TIME_RANGES: { value: FilterState['timeRange']; label: string }[] = [
    { value: '24h', label: t.last24Hours },
    { value: '7d', label: t.last7Days },
    { value: '30d', label: t.last30Days },
    { value: 'all', label: t.allTime }
  ];

  const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, timeRange: e.target.value as FilterState['timeRange'] });
  };

  const handleActivityTypeToggle = (type: ActivityType) => {
    const newTypes = filters.activityTypes.includes(type)
      ? filters.activityTypes.filter(t => t !== type)
      : [...filters.activityTypes, type];
    onChange({ ...filters, activityTypes: newTypes });
  };

  const panelId = 'filter-panel';

  if (!isOpen) return null;

  return (
    <div className="absolute top-14 right-4 z-[1000]">
      <div
        id={panelId}
        className="bg-white rounded-lg shadow-lg p-4 min-w-[240px]"
        role="region"
        aria-label={t.filters}
      >
          <div className="mb-4">
            <label htmlFor="time-range-select" className="block text-sm font-medium text-gray-700 mb-1">
              {t.timeRange}
            </label>
            <select
              id="time-range-select"
              value={filters.timeRange}
              onChange={handleTimeRangeChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIME_RANGES.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">
              {t.activityTypes}
            </legend>
            <div className="space-y-2" role="group">
              {ACTIVITY_TYPE_KEYS.map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.activityTypes.includes(type)}
                    onChange={() => handleActivityTypeToggle(type)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: ACTIVITY_COLORS[type] }}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-gray-700">
                    {getActivityTypeLabel(type, language)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
    </div>
  );
}
