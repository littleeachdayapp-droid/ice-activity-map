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

  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <button
        onClick={onToggle}
        className="bg-white px-4 py-2 rounded-lg shadow-lg font-medium hover:bg-gray-50 transition-colors"
      >
        {isOpen ? t.closeFilters : t.filters}
      </button>

      {isOpen && (
        <div className="mt-2 bg-white rounded-lg shadow-lg p-4 min-w-[240px]">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.timeRange}
            </label>
            <select
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.activityTypes}
            </label>
            <div className="space-y-2">
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
                  />
                  <span className="text-sm text-gray-700">
                    {getActivityTypeLabel(type, language)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
