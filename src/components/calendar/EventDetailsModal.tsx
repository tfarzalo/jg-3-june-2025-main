import * as React from "react";
import { addDays, format, parseISO, subDays } from "date-fns";
import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";
import { Pencil, X } from "lucide-react";
import { Button } from "../ui/Button";
import { updateCalendarEvent, deleteCalendarEvent } from "../../services/calendarEvents";
import type { CalendarEvent, CalendarEventInsert } from "../../types/calendar";

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
  onEventUpdated: (event: CalendarEvent) => void;
  onEventDeleted: (eventId: string) => void;
  canEdit: boolean;
}

export default function EventDetailsModal({ event, onClose, onEventUpdated, onEventDeleted, canEdit }: Props) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const timeZone = "America/New_York";
  const toUtcISO = React.useCallback(
    (dateStr: string, timeStr: string) =>
      zonedTimeToUtc(`${dateStr}T${timeStr}`, timeZone).toISOString(),
    [timeZone]
  );
  const nextDateInZone = React.useCallback(
    (dateStr: string) =>
      formatInTimeZone(addDays(parseISO(dateStr), 1), timeZone, "yyyy-MM-dd"),
    [timeZone]
  );
  
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
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    // Recurring event fields
    is_recurring: false,
    recurrence_type: "weekly" as const,
    recurrence_interval: 1,
    recurrence_days: [] as number[],
    recurrence_end_date: "",
  });

  // Initialize form data when event changes
  React.useEffect(() => {
    if (event) {
      const startDate = new Date(event.start_at);
      const endDate = new Date(event.end_at);
      const endDateForAllDay = event.is_all_day ? subDays(endDate, 1) : endDate;
      
      setFormData({
        title: event.title || "",
        details: event.details || "",
        color: event.color || "#3b82f6",
        is_all_day: event.is_all_day || false,
        start_date: formatInTimeZone(startDate, timeZone, "yyyy-MM-dd"),
        end_date: formatInTimeZone(endDateForAllDay, timeZone, "yyyy-MM-dd"),
        start_time: event.is_all_day ? "" : formatInTimeZone(startDate, timeZone, "HH:mm"),
        end_time: event.is_all_day ? "" : formatInTimeZone(endDate, timeZone, "HH:mm"),
        // Recurring event fields
        is_recurring: event.is_recurring || false,
        recurrence_type: event.recurrence_type || "weekly",
        recurrence_interval: event.recurrence_interval || 1,
        recurrence_days: event.recurrence_days || [],
        recurrence_end_date: event.recurrence_end_date
          ? formatInTimeZone(new Date(event.recurrence_end_date), timeZone, "yyyy-MM-dd")
          : "",
      });
    }
  }, [event]);

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

  const handleSave = async () => {
    if (!event) return;
    
    try {
      setLoading(true);
      console.log('EventDetailsModal: Starting save for event:', event.id);
      console.log('EventDetailsModal: Form data:', formData);
      
      // Check if this is a recurring event instance (has parent_event_id)
      const isRecurringInstance = event.parent_event_id;
      const eventIdToUpdate = isRecurringInstance ? event.parent_event_id : event.id;
      
      console.log('EventDetailsModal: Is recurring instance:', isRecurringInstance);
      console.log('EventDetailsModal: Event ID to update:', eventIdToUpdate);
      
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

      let startISO: string;
      let endISO: string;

      if (formData.is_all_day) {
        // All-day events: start at 00:00 Eastern, end at next day 00:00 Eastern
        startISO = toUtcISO(start_date, "00:00:00");
        endISO = toUtcISO(nextDateInZone(end_date), "00:00:00");
      } else {
        // Timed events: use provided times or default to 1 hour duration
        if (start_time && end_time) {
          startISO = toUtcISO(start_date, `${start_time}:00`);
          endISO = toUtcISO(end_date, `${end_time}:00`);
        } else if (start_time) {
          // Only start time provided, default to 1 hour duration
          startISO = toUtcISO(start_date, `${start_time}:00`);
          endISO = new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString();
        } else {
          // No times provided, default to 12:01 AM - 11:59 PM Eastern (full day)
          startISO = toUtcISO(start_date, "00:01:00");
          endISO = toUtcISO(end_date, "23:59:00");
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
        recurrence_end_date: formData.is_recurring && formData.recurrence_end_date
          ? toUtcISO(formData.recurrence_end_date, "23:59:59")
          : undefined,
      };

      console.log('EventDetailsModal: Payload to send:', payload);
      console.log('EventDetailsModal: Start ISO:', startISO);
      console.log('EventDetailsModal: End ISO:', endISO);

      // Update the parent event if this is a recurring instance, otherwise update the event itself
      const updatedEvent = await updateCalendarEvent(eventIdToUpdate, payload);
      console.log('EventDetailsModal: Update successful:', updatedEvent);
      
      // If this was a recurring instance, we need to update the local event object
      // to reflect the changes in the UI
      const finalEvent = isRecurringInstance ? {
        ...event,
        ...updatedEvent,
        id: event.id, // Keep the original instance ID
        parent_event_id: event.parent_event_id, // Keep the parent reference
      } : updatedEvent;
      
      onEventUpdated(finalEvent);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update event:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm("Are you sure you want to delete this event?")) return;
    
    try {
      setLoading(true);
      await deleteCalendarEvent(event.id);
      onEventDeleted(event.id);
      onClose();
    } catch (error) {
      console.error("Failed to delete event:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  const startDate = new Date(event.start_at);
  const endDate = new Date(event.end_at);
  const displayEndDate = event.is_all_day ? subDays(endDate, 1) : endDate;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-lg w-full shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? "Edit Event" : "Event Details"}
          </h2>
          <div className="flex gap-2">
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="Edit Event"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Details
              </label>
              <textarea
                value={formData.details}
                onChange={(e) => handleInputChange("details", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Color
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => handleInputChange("color", e.target.value)}
                className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-md"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_all_day"
                checked={formData.is_all_day}
                onChange={(e) => handleInputChange("is_all_day", e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="is_all_day" className="text-sm text-gray-700 dark:text-gray-300">
                All day event
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
                  onClick={(e) => e.currentTarget.showPicker?.()}
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
                  onClick={(e) => e.currentTarget.showPicker?.()}
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
                      onClick={(e) => e.currentTarget.showPicker?.()}
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
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                loading={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {event.title}
              </h3>
              {event.details && (
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {event.details}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: event.color }}
              ></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {event.is_all_day ? "All day" : "Timed event"}
              </span>
            </div>

            {/* Only show Start/End dates for non-agenda summary events */}
            {!(event.title.includes('Paint') && event.title.includes('Callback') && event.title.includes('Repair')) && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Start:</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {formatInTimeZone(startDate, timeZone, "PPP")}
                    {!event.is_all_day && ` at ${formatInTimeZone(startDate, timeZone, "p")}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">End:</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {formatInTimeZone(displayEndDate, timeZone, "PPP")}
                    {!event.is_all_day && ` at ${formatInTimeZone(displayEndDate, timeZone, "p")}`}
                  </span>
                </div>
              </div>
            )}

            {canEdit && (
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDelete}
                  loading={loading}
                >
                  Delete Event
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
