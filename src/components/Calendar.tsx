import React from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export interface BookingCalendarProps {
  value: Date | null;
  onChange: (date: Date) => void;
  tileDisabled?: (props: { date: Date }) => boolean;
  tileContent?: (props: { date: Date }) => React.ReactNode;
}

const BookingCalendar: React.FC<BookingCalendarProps> = ({ value, onChange, tileDisabled, tileContent }) => {
  return (
    <Calendar
      value={value}
      onChange={date => onChange(date as Date)}
      tileDisabled={tileDisabled}
      tileContent={tileContent}
      minDate={new Date()}
      maxDetail="month"
      prev2Label={null}
      next2Label={null}
    />
  );
};

export default BookingCalendar;
