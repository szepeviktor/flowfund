// Common types used throughout the application

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Income {
  id: string;
  source: string;
  amount: number;
  date: string; // ISO date string
  recurrence: RecurrenceType;
  received: boolean;
}

export interface Outgoing {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // ISO date string
  recurrence: RecurrenceType;
  notes?: string;
  accountId: string;
}

export interface Account {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
}

export interface AllocationItem {
  id: string;
  accountId: string;
  amount: number;
}