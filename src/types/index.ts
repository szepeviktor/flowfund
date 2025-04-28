// Common types used throughout the application

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PaymentPlan {
  enabled: boolean;
  startDate: string; // ISO date string when to start saving
  frequency: 'weekly' | 'biweekly' | 'monthly';
  installmentAmount?: number; // If specified, user sets amount per installment
  // If installmentAmount is not specified, it's calculated based on total amount, startDate and dueDate
}

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
  // Custom recurrence fields
  isCustomRecurrence?: boolean;
  recurrenceInterval?: number;
  recurrenceUnit?: 'day' | 'week' | 'month' | 'year';
  notes?: string;
  accountId: string;
  paymentPlan?: PaymentPlan; // Optional payment plan for saving up for this expense
  isPaused?: boolean; // Whether the outgoing is temporarily paused
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

export interface FundSource {
  id: string;
  amount: number;
}

export interface PayCycle {
  dayOfMonth: number; // Day of the month for payday (1-31)
  frequency: 'monthly' | 'biweekly' | 'weekly'; // How often you get paid
  lastPayDate?: string; // ISO date string of last payday, needed for non-monthly frequencies
}