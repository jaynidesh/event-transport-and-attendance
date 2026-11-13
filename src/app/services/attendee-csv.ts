import type { Attendee } from './models';

function csvCell(value: string): string {
  // Keep spreadsheet applications from evaluating imported text as formulas.
  const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function attendeeCsv(attendees: readonly Attendee[]): string {
  const rows = [['employeeId', 'ticketNumber', 'registrationStatus', 'attendanceStatus', 'lastUpdatedUTC']];
  for (const attendee of attendees) {
    if (attendee.registrationStatus !== 'attending') continue;
    const timestamp = attendee.attendance?.checkedInAt;
    const date = typeof timestamp === 'number' ? new Date(timestamp) : null;
    rows.push([
      attendee.employeeId,
      attendee.ticketNumber || '',
      attendee.registrationStatus,
      attendee.attendance?.status || 'pending',
      date && !Number.isNaN(date.getTime()) ? date.toISOString() : ''
    ]);
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
