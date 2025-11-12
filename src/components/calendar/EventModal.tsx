import * as React from "react";
import { createCalendarEvent } from "../../services/calendarEvents";
import type { CalendarEventInsert } from "../../types/calendar";
import { Button } from "../ui/Button";

type Props = {
  onCreated?: (evt: any) => void;
  defaultDate?: Date; // center the picker if you want
  canCreate: boolean; // role-gated
};

export default function EventModal({ onCreated, defaultDate, canCreate }: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  
  // Get Eastern Time date
  const getEasternDate = () => {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  };
  
  const [formData, setFormData] = React.useState({
    title: "",
    details: "",
    color: "#3b82f6",
    is_all_day: false,
    start_date: defaultDate ? defaultDate.toISOString().slice(0,10) : getEasternDate().toISOString().slice(0,10),
    end_date: defaultDate ? defaultDate.toISOString().slice(0,10) : getEasternDate().toISOString().slice(0,10),
    start_time: "",
    end_time: "",
    // Recurring event fields
    is_recurring: false,
    recurrence_type: "weekly" as const,
    recurrence_interval: 1,
    recurrence_days: [] as number[],
    recurrence_end_date: "",
  });



  if (!canCreate) return null;

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-update end_date to match start_date when start_date changes
      if (field === 'start_date') {
        newData.end_date = value;
      }
      
      return newData;
    });
  };



  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Validate recurring event data
      if (formData.is_recurring) {
        if (formData.recurrence_type === 'weekly' && formData.recurrence_days.length === 0) {
          alert('Please select at least one day of the week for weekly recurrence.');
          setLoading(false);
          return;
        }
        
        // Validate weekday numbers are between 0-6
        if (formData.recurrence_days.some(day => day < 0 || day > 6)) {
          alert('Invalid day selection. Please select valid days of the week.');
          setLoading(false);
          return;
        }
      }
      
      const { start_date, end_date, start_time, end_time, ...rest } = formData;

      // Build ISO timestamps (end is exclusive)
      let startISO: string;
      let endISO: string;
      
      if (formData.is_all_day) {
        // All-day events: start at 00:00 Eastern, end at next day 00:00 Eastern
        startISO = new Date(`${start_date}T00:00:00-05:00`).toISOString();
        const endBase = new Date(new Date(`${end_date}T00:00:00-05:00`).getTime() + 24*60*60*1000);
        endISO = endBase.toISOString();
      } else {
        // Timed events: use provided times or default to 1 hour duration
        if (start_time && end_time) {
          startISO = new Date(`${start_date}T${start_time}:00-05:00`).toISOString();
          endISO = new Date(`${end_date}T${end_time}:00-05:00`).toISOString();
        } else if (start_time) {
          // Only start time provided, default to 1 hour duration
          startISO = new Date(`${start_date}T${start_time}:00-05:00`).toISOString();
          const endBase = new Date(new Date(startISO).getTime() + 60*60*1000);
          endISO = endBase.toISOString();
        } else {
          // No times provided, default to 12:01 AM - 11:59 PM Eastern (full day)
          startISO = new Date(`${start_date}T00:01:00-05:00`).toISOString();
          endISO = new Date(`${end_date}T23:59:00-05:00`).toISOString();
        }
      }

      const payload: CalendarEventInsert = {
        title: rest.title?.trim(),
        details: rest.details?.trim() || null,
        color: rest.color || "#3b82f6",
        is_all_day: !!formData.is_all_day,
        start_at: startISO,
        end_at: endISO,
        // Recurring event fields
        is_recurring: formData.is_recurring,
        recurrence_type: formData.is_recurring ? formData.recurrence_type : undefined,
        recurrence_interval: formData.is_recurring ? formData.recurrence_interval : undefined,
        recurrence_days: formData.is_recurring && formData.recurrence_type === 'weekly' ? formData.recurrence_days : undefined,
        recurrence_end_date: formData.is_recurring && formData.recurrence_end_date ? new Date(`${formData.recurrence_end_date}T23:59:59-05:00`).toISOString() : undefined,
      };

      const inserted = await createCalendarEvent(payload);
      // Use console.log for now since toast might not be available
      console.log("Event created successfully");
      onCreated?.(inserted);
      setFormData({
        title: "",
        details: "",
        color: "#3b82f6",
        is_all_day: false,
        start_date: getEasternDate().toISOString().slice(0,10),
        end_date: getEasternDate().toISOString().slice(0,10),
        start_time: "",
        end_time: "",
        // Recurring event fields
        is_recurring: false,
        recurrence_type: "weekly" as const,
        recurrence_interval: 1,
        recurrence_days: [] as number[],
        recurrence_end_date: "",
      });
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      console.error(e?.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button 
        size="sm" 
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        + New Event
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-lg w-full shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Event</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Event name"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Details
            </label>
            <textarea
              rows={3}
              value={formData.details}
              onChange={(e) => handleInputChange("details", e.target.value)}
              placeholder="Additional details..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="color"
              value={formData.color}
              onChange={(e) => handleInputChange("color", e.target.value)}
              className="h-9 w-12 p-0 border rounded"
              aria-label="Event color"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Color</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is_all_day"
              type="checkbox"
              checked={formData.is_all_day}
              onChange={(e) => handleInputChange("is_all_day", e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="is_all_day" className="text-sm text-gray-700 dark:text-gray-300">
              All day
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleInputChange("start_date", e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End date
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => handleInputChange("end_date", e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            {!formData.is_all_day && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start time (optional)
                  </label>
                  <input
                    type="time"
                    step="60"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange("start_time", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Leave blank for all-day"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End time (optional)
                  </label>
                  <input
                    type="time"
                    step="60"
                    value={formData.end_time}
                    onChange={(e) => handleInputChange("end_time", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Leave blank for all-day"
                  />
                </div>
              </>
            )}
          </div>

          {/* Recurring Event Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_recurring"
                checked={formData.is_recurring}
                onChange={(e) => setFormData(prev => ({ ...prev, is_recurring: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_recurring" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Make this a recurring event
              </label>
            </div>

            {formData.is_recurring && (
              <div className="space-y-4 pl-6 border-l-2 border-gray-200 dark:border-gray-700">
                {/* Recurrence Type */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Repeat
                  </label>
                  <select
                    value={formData.recurrence_type}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      recurrence_type: e.target.value as any,
                      recurrence_days: e.target.value !== 'weekly' ? [] : prev.recurrence_days
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                {/* Recurrence Interval */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Every {formData.recurrence_type === 'daily' ? 'day(s)' : 
                           formData.recurrence_type === 'weekly' ? 'week(s)' :
                           formData.recurrence_type === 'monthly' ? 'month(s)' :
                           formData.recurrence_type === 'quarterly' ? 'quarter(s)' : 'year(s)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={formData.recurrence_interval}
                    onChange={(e) => setFormData(prev => ({ ...prev, recurrence_interval: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Days of Week for Weekly Recurrence */}
                {formData.recurrence_type === 'weekly' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Days of the week
                    </label>
                    <div className="grid grid-cols-7 gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const newDays = formData.recurrence_days.includes(index)
                              ? formData.recurrence_days.filter(d => d !== index)
                              : [...formData.recurrence_days, index];
                            setFormData(prev => ({ ...prev, recurrence_days: newDays }));
                          }}
                          className={`px-3 py-2 text-sm rounded-md border ${
                            formData.recurrence_days.includes(index)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* End Date */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    End date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.recurrence_end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, recurrence_end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
            >
              {loading ? "Saving..." : "Create Event"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
