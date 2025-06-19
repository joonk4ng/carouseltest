import React, { useState, useEffect } from 'react';
import '../styles/DateCalendar.css';

// DateCalendar object properties
interface DateCalendarProps {
  savedDates: string[];
  onDateSelect: (dateRange: string) => void;
  onClose: () => void;
}

// Export function DateCalendar and properties
export const DateCalendar: React.FC<DateCalendarProps> = ({ savedDates, onDateSelect, onClose }) => {
  // Current date state
  const [currentDate, setCurrentDate] = useState(new Date());
  // Selected date state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // Calendar days state
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);

  // Generate calendar days for the current month
  useEffect(() => {
    // Get the year, month, and first day of the current month
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDay.getDay();
    
    // Calculate the number of days to show from the previous month
    const daysFromPrevMonth = firstDayOfWeek;
    
    // Calculate the number of days to show from the next month
    const totalDays = 35; // 5 rows * 7 days
    const daysFromNextMonth = totalDays - (lastDay.getDate() + daysFromPrevMonth);
    
    const days: Date[] = [];
    
    // Add days from previous month
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    
    // Add days from current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    // Add days from next month
    for (let i = 1; i <= daysFromNextMonth; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    setCalendarDays(days);
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    // Find if there's a saved date range that includes this date
    const dateStr = date.toISOString().split('T')[0];
    const matchingDateRange = savedDates.find(range => {
      const [start, end] = range.split(' to ');
      return dateStr >= start && dateStr <= end;
    });
    
    if (matchingDateRange) {
      onDateSelect(matchingDateRange);
      onClose();
    }
  };

  const isDateSaved = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return savedDates.some(range => {
      const [start, end] = range.split(' to ');
      return dateStr >= start && dateStr <= end;
    });
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  // Handles the rendering of the date calendar
  return (
    <div className="date-calendar-modal">
      <div className="date-calendar-content">
        <div className="date-calendar-header">
          <button onClick={handlePrevMonth}>&lt;</button>
          <h3>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
          <button onClick={handleNextMonth}>&gt;</button>
        </div>
        <div className="date-calendar-grid">
          <div className="date-calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="date-calendar-weekday">{day}</div>
            ))}
          </div>
          <div className="date-calendar-days">
            {calendarDays.map((date, index) => (
              <div
                key={index}
                className={`date-calendar-day ${
                  !isCurrentMonth(date) ? 'other-month' : ''
                } ${isDateSaved(date) ? 'has-entry' : ''} ${
                  selectedDate?.toDateString() === date.toDateString() ? 'selected' : ''
                }`}
                onClick={() => handleDateClick(date)}
              >
                {date.getDate()}
              </div>
            ))}
          </div>
        </div>
        <button className="date-calendar-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}; 