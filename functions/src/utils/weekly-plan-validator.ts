/**
 * Weekly Plan Validator
 * 
 * Validates WeeklyPlan structure and data integrity.
 */

import { WeeklyPlan } from "../types/schemas";

/**
 * Validate WeeklyPlan structure and data integrity
 * 
 * Validations:
 * 1. totalTrainingDays === trainingDays.length
 * 2. schedule.length === totalTrainingDays
 * 3. No duplicate days in trainingDays
 * 4. trainingDays values are in valid range (0-6)
 * 5. schedule[i].dayIndex === trainingDays[i] (consistent order)
 * 
 * @param weeklyPlan - The WeeklyPlan to validate
 * @throws Error if validation fails
 */
export function validateWeeklyPlan(weeklyPlan: WeeklyPlan): void {
  // 1. totalTrainingDays === trainingDays.length
  if (weeklyPlan.totalTrainingDays !== weeklyPlan.trainingDays.length) {
    throw new Error(
      `totalTrainingDays (${weeklyPlan.totalTrainingDays}) must equal trainingDays.length (${weeklyPlan.trainingDays.length})`
    );
  }

  // 2. schedule.length === totalTrainingDays
  if (weeklyPlan.schedule.length !== weeklyPlan.totalTrainingDays) {
    throw new Error(
      `schedule.length (${weeklyPlan.schedule.length}) must equal totalTrainingDays (${weeklyPlan.totalTrainingDays})`
    );
  }

  // 3. No duplicate days in trainingDays
  const uniqueDays = new Set(weeklyPlan.trainingDays);
  if (uniqueDays.size !== weeklyPlan.trainingDays.length) {
    throw new Error(
      `trainingDays contains duplicates: [${weeklyPlan.trainingDays.join(", ")}]`
    );
  }

  // 4. trainingDays values are in valid range (0-6)
  const invalidDays = weeklyPlan.trainingDays.filter(day => day < 0 || day > 6);
  if (invalidDays.length > 0) {
    throw new Error(
      `trainingDays contains invalid day indices: [${invalidDays.join(", ")}]. Days must be between 0 (Sunday) and 6 (Saturday).`
    );
  }

  // 5. schedule[i].dayIndex === trainingDays[i] (consistent order)
  for (let i = 0; i < weeklyPlan.trainingDays.length; i++) {
    if (weeklyPlan.schedule[i].dayIndex !== weeklyPlan.trainingDays[i]) {
      throw new Error(
        `schedule[${i}].dayIndex (${weeklyPlan.schedule[i].dayIndex}) must match trainingDays[${i}] (${weeklyPlan.trainingDays[i]})`
      );
    }
  }

  // Additional validations for schedule items
  weeklyPlan.schedule.forEach((scheduledDay, index) => {
    if (!scheduledDay.focus || scheduledDay.focus.trim() === "") {
      throw new Error(`schedule[${index}].focus is required and cannot be empty`);
    }
    
    if (!scheduledDay.description || scheduledDay.description.trim() === "") {
      throw new Error(`schedule[${index}].description is required and cannot be empty`);
    }
    
    if (!scheduledDay.systemGoal || scheduledDay.systemGoal.trim() === "") {
      throw new Error(`schedule[${index}].systemGoal is required and cannot be empty`);
    }
  });

  // Validate goalDescription
  if (!weeklyPlan.goalDescription || weeklyPlan.goalDescription.trim() === "") {
    throw new Error("goalDescription is required and cannot be empty");
  }
}

