// Astryx's `CalendarShowcase` template, refactored onto the core: the JSX of
// src/stock/templates/CalendarShowcase.tsx, drawing `view` (core/src/templates/calendar/model.ts) and sending
// actions with `send`. It must look pixel-for-pixel like the stock copy (npm run parity).
// The selected date and the visible month both come from the core.
import {Calendar} from '@astryxdesign/core/Calendar';
import type {ISODateString} from '@astryxdesign/core/Calendar';
import type {View} from '../../../core/src/templates/calendar/model.ts';
import type {TemplateProps} from './props.ts';

export default function Template({view, send}: TemplateProps) {
  // The core keeps dates as plain "YYYY-MM-DD" strings (and checks them).
  const {value, focusDate} = view as View as {value: ISODateString | null; focusDate: ISODateString};
  return (
    <Calendar
      mode="single"
      value={value}
      onChange={next => send({type: 'set', id: 'tpl.calendar.select', value: next})}
      focusDate={focusDate}
      onFocusDateChange={next => send({type: 'set', id: 'tpl.calendar.focus', value: next})}
    />
  );
}
