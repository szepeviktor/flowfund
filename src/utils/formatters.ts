// Utility functions for formatting data

/**
 * Format a number as currency
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format a date in a user-friendly way
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

/**
 * Get formatted display for recurrence type
 */
export const formatRecurrence = (recurrence: string): string => {
  switch(recurrence) {
    case 'none':
      return 'One-time';
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Bi-weekly';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'yearly':
      return 'Yearly';
    default:
      return 'Custom';
  }
};

/**
 * Calculate the next occurrence of a recurring date
 */
export const getNextOccurrence = (date: Date, recurrence: string): Date => {
  const now = new Date();
  let nextDate = new Date(date);
  
  // Set both dates to start of day for accurate comparison
  now.setHours(0, 0, 0, 0);
  nextDate.setHours(0, 0, 0, 0);

  // If the date is today or in the future, return it
  if (nextDate >= now) return nextDate;

  // For non-recurring items, return the original date
  if (recurrence === 'none') return nextDate;

  // Calculate next occurrence based on recurrence
  while (nextDate < now) {
    switch (recurrence) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
  }

  return nextDate;
};

/**
 * Calculate days from now to a date
 */
export const daysFromNow = (dateString: string): number => {
  const now = new Date();
  const targetDate = new Date(dateString);
  const diffTime = targetDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Get relative date description
 */
export const getRelativeDateDescription = (dateString: string, recurrence: string = 'none'): string => {
  const originalDate = new Date(dateString);
  const nextDate = getNextOccurrence(originalDate, recurrence);
  
  // Set both dates to start of day for accurate comparison
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nextDay = new Date(nextDate);
  nextDay.setHours(0, 0, 0, 0);
  
  // Check if nextDate is today
  if (nextDay.getTime() === now.getTime()) return 'Today';
  
  // Calculate days difference
  const days = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days < 7) return `In ${days} days`;
  if (days < 30) return `In ${Math.floor(days / 7)} weeks`;
  
  return formatDate(nextDate.toISOString());
};