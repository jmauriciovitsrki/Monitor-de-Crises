import { DailyLog } from './types';

/**
 * Calculates sleep hours between two HH:MM strings.
 * Handles sleep crossing midnight correctly.
 */
export function calculateSleepDuration(sleepTime: string, wakeTime: string): number {
  if (!sleepTime || !wakeTime) return 0;
  
  try {
    const [sleepH, sleepM] = sleepTime.split(':').map(Number);
    const [wakeH, wakeM] = wakeTime.split(':').map(Number);
    
    if (isNaN(sleepH) || isNaN(sleepM) || isNaN(wakeH) || isNaN(wakeM)) return 0;
    
    const sleepTotalMinutes = sleepH * 60 + sleepM;
    const wakeTotalMinutes = wakeH * 60 + wakeM;
    
    let diffMinutes = 0;
    if (wakeTotalMinutes < sleepTotalMinutes) {
      // Crossed midnight (e.g., slept 22:00, woke 07:00)
      diffMinutes = (1440 - sleepTotalMinutes) + wakeTotalMinutes;
    } else {
      // Slept and woke in the same calendar day (e.g., slept 01:00, woke 08:00)
      diffMinutes = wakeTotalMinutes - sleepTotalMinutes;
    }
    
    const hours = diffMinutes / 60;
    return parseFloat(hours.toFixed(1));
  } catch (error) {
    console.error('Error calculating sleep duration:', error);
    return 0;
  }
}

/**
 * Generates a clean localized date string (e.g., "02/06/2026") from YYYY-MM-DD
 */
export function formatLocalDateStr(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Generates a localized day of the week abbreviation (e.g. "Ter", "Qua") in Portuguese
 */
export function getWeekdayLabel(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00'); // set mid day to prevent timezone shifts
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return weekdays[date.getDay()];
}

/**
 * Generates CSV structure for importing template
 */
export function generateCSVTemplateString(): string {
  const headers = [
    'Data (AAAA-MM-DD)',
    'Status Sono (dormiu | não dormiu | dormiu tarde)',
    'Horario Dormiu (HH:MM)',
    'Horario Acordou (HH:MM)',
    'Qualidade Sono (1 a 5)',
    'Vezes Acordou Noite',
    'Observacao Sono',
    'Teve Crise (Sim | Não)',
    'Crises Manha Leve',
    'Crises Manha Media',
    'Crises Manha Forte',
    'Crises Tarde Leve',
    'Crises Tarde Media',
    'Crises Tarde Forte',
    'Crises Noite Leve',
    'Crises Noite Media',
    'Crises Noite Forte',
    'Gatilhos Crise',
    'Observacao Crise',
    'Medicacao Tomou (Sim | Não)',
    'Observacao Medicacao'
  ];
  
  const exampleRow = [
    '2023-01-01',
    'dormiu',
    '21:00',
    '07:00',
    '4',
    '1',
    'Dormiu tranquilo',
    'Sim',
    '1', '0', '0',
    '0', '2', '0',
    '0', '0', '0',
    'Calor excessivo',
    'Crise leve de 30s de manhã, 2 médias à tarde',
    'Sim',
    'Medicamentos no horário habitual'
  ];
  
  return [headers.join(','), exampleRow.join(',')].join('\n');
}

/**
 * Custom light CSV parser that handles double quotes safely
 */
export function parseCSV(rawText: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let insideQuote = false;
  
  for (let i = 0; i < rawText.length; i++) {
    const char = rawText[i];
    const nextChar = rawText[i + 1];
    
    if (insideQuote) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++; // Skip second quote
        } else {
          insideQuote = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        insideQuote = true;
      } else if (char === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\r' || char === '\n') {
        row.push(cell.trim());
        cell = '';
        if (row.length > 0 && row.some(c => c !== '')) {
          lines.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n
        }
      } else {
        cell += char;
      }
    }
  }
  
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) {
      lines.push(row);
    }
  }
  
  return lines;
}
