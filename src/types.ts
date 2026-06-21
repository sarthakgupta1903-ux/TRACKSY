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
}

export interface Feedback {
  id?: string;
  userId: string;
  userEmail: string;
  message: string;
  createdAt: string;
}
