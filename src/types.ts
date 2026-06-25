export interface UserProfile {
  name: string;
  email: string;
  createdAt: string;
}

export type TaskCategory = 'Work' | 'Personal' | 'Shopping' | 'Health' | 'Fitness' | 'Ideas' | 'Other';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'completed';
export type RepeatPattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Task {
  id?: string;
  userId: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: string;
  dueDate: string;
  reminderTime: string;
  createdAt: string;
  updatedAt: string;
  isRecurring: boolean;
  repeatPattern: RepeatPattern;
  customActiveDays?: string[]; // Active days for custom day selection (e.g. ['Mon', 'Wed', 'Fri'])
  marked?: boolean; // rows can be shown as marked or unmarked
}

export interface TaskOccurrence {
  id?: string;
  userId: string;
  taskId: string; // references the Task.id
  scheduledDate: string; // YYYY-MM-DD
  status: 'completed' | 'missed' | 'pending' | 'skipped';
  notes?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface Feedback {
  id?: string;
  userId: string;
  userEmail: string;
  message: string;
  createdAt: string;
}

export type RecordTemplateType = 'habit' | 'delivery' | 'attendance' | 'maintenance' | 'custom';

export interface RecordTracker {
  id?: string;
  userId: string;
  title: string;
  description: string;
  templateType: RecordTemplateType;
  unit: string; // e.g. 'packet', 'liter', 'present', 'serviced', 'checked'
  defaultValue: string | number;
  marked?: boolean;
  createdAt: string;
  updatedAt: string;
  recurrencePerDay?: number; // multiple times per day recurrence (e.g. 1, 2, 3...)
  activeDays?: string[]; // custom days of the week (e.g. ['Mon', 'Wed', 'Fri'])
}

export interface RecordLog {
  id?: string;
  userId: string;
  trackerId: string; // references RecordTracker.id
  date: string; // YYYY-MM-DD
  status: string; // e.g. "Done", "Present", "Absent", "Delivered", "Pending"
  quantity?: number; // useful for Delivery Tracker (e.g. 2 water cans, 3 packets milk)
  notes?: string; // memo updates
  updatedAt: string;
  slotIndex?: number; // index of the recurrence slot (0-indexed) for daily occurrences
}

