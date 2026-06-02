export type SleepStatus = 'dormiu' | 'não dormiu' | 'dormiu tarde';

export interface SleepDetails {
  status: SleepStatus;
  sleepTime: string; // "HH:MM" format
  wakeTime: string;  // "HH:MM" format
  hoursSlept: number; // calculated field
  quality: number; // range 1 to 5
  wakeUpCount: number; // count of nightly awakenings
  observations: string; // text field
}

export type SeizureSeverity = 'light' | 'medium' | 'strong';

export interface SeizureTimingCounts {
  light: number;
  medium: number;
  strong: number;
}

export interface SeizureDetails {
  occurred: boolean; // "sim" or "não"
  morningCount: number;
  afternoonCount: number;
  nightCount: number;
  morningDetails: SeizureTimingCounts;
  afternoonDetails: SeizureTimingCounts;
  nightDetails: SeizureTimingCounts;
  totalCount: number; // total count across all categories/strengths
  triggers: string; // triggers field
  observations: string; // seizure observations
}

export interface MedicationDetails {
  taken: boolean; // "sim" or "não"
  observations: string; // observations regarding medication
}

export interface DailyLog {
  id?: string; // documents id in users/{userId}/logs/{logId} is the date "YYYY-MM-DD"
  userId: string;
  date: string; // "YYYY-MM-DD"
  sleep: SleepDetails;
  seizures: SeizureDetails;
  medication: MedicationDetails;
  createdAt: string; // ISO string or firebase timestamp placeholder
  updatedAt: string; // ISO string or firebase timestamp placeholder
}

// Child Info (Stored locally or derived)
export interface ChildProfile {
  name: string;
  birthDate?: string;
}
