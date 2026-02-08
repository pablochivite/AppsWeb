/**
 * Date Helper Utilities
 * 
 * Utilities for calculating dates and day indices for training schedules.
 */

/**
 * Get the day of week index (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export function getTodayDayIndex(): number {
  return new Date().getDay();
}

/**
 * Get a date for a specific day of week in the current week
 * @param dayIndex - Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @returns Date object for that day in the current week
 */
export function getThisWeekDate(dayIndex: number): Date {
  const today = new Date();
  const currentDay = today.getDay();
  const diff = dayIndex - currentDay;
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);
  targetDate.setHours(0, 0, 0, 0); // Reset time to midnight
  
  return targetDate;
}

/**
 * Get a date for a specific day of week in the next week
 * @param dayIndex - Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @returns Date object for that day in the next week
 */
export function getNextWeekDate(dayIndex: number): Date {
  const today = new Date();
  const currentDay = today.getDay();
  const diff = dayIndex - currentDay + 7; // Add 7 days to go to next week
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);
  targetDate.setHours(0, 0, 0, 0); // Reset time to midnight
  
  return targetDate;
}

/**
 * Format date as YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate the start date for a training plan based on training days and current date
 * 
 * Logic:
 * 1. If today > max(trainingDays): Generate sessions for next week, startDate = first trainingDay of next week
 * 2. If today is in trainingDays: Generate sessions for this week, startDate = today
 * 3. If today < min(trainingDays): Generate sessions for this week, startDate = first trainingDay of this week
 * 4. If min(trainingDays) < today < max(trainingDays) and today is not a trainingDay:
 *    Generate sessions for this week, startDate = next trainingDay after today
 * 
 * @param trainingDays - Array of day indices (0-6) when training occurs
 * @returns Date object representing the start date
 */
export function calculateStartDate(trainingDays: number[]): Date {
  if (!trainingDays || trainingDays.length === 0) {
    throw new Error("trainingDays cannot be empty");
  }

  // Validate day indices
  const invalidDays = trainingDays.filter(day => day < 0 || day > 6);
  if (invalidDays.length > 0) {
    throw new Error(
      `Invalid day indices: ${invalidDays.join(", ")}. Days must be between 0 (Sunday) and 6 (Saturday).`
    );
  }

  // Sort training days
  const sortedTrainingDays = [...trainingDays].sort((a, b) => a - b);
  const minDay = sortedTrainingDays[0];
  const maxDay = sortedTrainingDays[sortedTrainingDays.length - 1];
  
  const today = getTodayDayIndex();

  // Case 1: Today is after the last training day of the week
  if (today > maxDay) {
    // Generate sessions for next week, start on first training day of next week
    return getNextWeekDate(minDay);
  }

  // Case 2: Today is a training day
  if (trainingDays.includes(today)) {
    // Generate sessions for this week, start today
    return new Date(); // Today
  }

  // Case 3: Today is before the first training day
  if (today < minDay) {
    // Generate sessions for this week, start on first training day
    return getThisWeekDate(minDay);
  }

  // Case 4: Today is between minDay and maxDay but not a training day
  // Find the next training day after today
  const nextDay = sortedTrainingDays.find(day => day > today);
  
  if (nextDay !== undefined) {
    // Next training day exists in this week
    return getThisWeekDate(nextDay);
  }

  // Fallback: This shouldn't happen given our cases, but if it does, use first day of next week
  return getNextWeekDate(minDay);
}

