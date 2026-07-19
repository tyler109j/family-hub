(function attachFamilyTime(root) {
  const timeZone = 'America/New_York';
  const dateTimePartsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  function validDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function partsFor(value) {
    const date = validDate(value);
    if (!date) return null;
    const parts = {};
    for (const part of dateTimePartsFormatter.formatToParts(date)) {
      if (part.type !== 'literal') parts[part.type] = Number(part.value);
    }
    return parts;
  }

  function dateKey(value = new Date()) {
    const parts = partsFor(value);
    if (!parts) return '';
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  function parsedDateKey(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const check = new Date(Date.UTC(year, month - 1, day, 12));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
    return { year, month, day, date: check };
  }

  function formatDateKey(value, options) {
    const parsed = parsedDateKey(value);
    if (!parsed) return '';
    const requested = options || { dateStyle: 'medium' };
    return new Intl.DateTimeFormat('en-US', { ...requested, timeZone }).format(parsed.date);
  }

  function formatDateTime(value) {
    const date = validDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function formatTime(value) {
    const date = validDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  function formatWallTime(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return '';
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return '';
    return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
  }

  function toInputValue(value) {
    const parts = partsFor(value);
    if (!parts) return '';
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  }

  function offsetAt(value) {
    const date = validDate(value);
    const parts = partsFor(date);
    if (!date || !parts) return 0;
    const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return representedAsUtc - date.getTime();
  }

  function fromInputValue(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const [, yearText, monthText, dayText, hourText, minuteText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (hour > 23 || minute > 59 || !parsedDateKey(`${yearText}-${monthText}-${dayText}`)) return null;

    const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    const offsets = new Set([-43200000, 0, 43200000].map(delta => offsetAt(new Date(wallClockAsUtc + delta))));
    for (const offset of offsets) {
      const candidate = new Date(wallClockAsUtc - offset);
      if (toInputValue(candidate) === value) return candidate.toISOString();
    }
    return null;
  }

  root.FamilyTime = Object.freeze({
    timeZone,
    dateKey,
    formatDateKey,
    formatDateTime,
    formatTime,
    formatWallTime,
    toInputValue,
    fromInputValue,
  });
})(globalThis);
