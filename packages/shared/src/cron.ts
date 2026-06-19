import parser from 'cron-parser';

export function validateCronExpression(cronExpression: string): void {
  try {
    parser.parseExpression(cronExpression, { utc: true });
  } catch {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }
}

export function computeNextRun(cronExpression: string, from: Date = new Date()): Date {
  try {
    const interval = parser.parseExpression(cronExpression, {
      currentDate: from,
      utc: true,
    });
    return interval.next().toDate();
  } catch {
    throw new Error(`Cannot compute next run for cron: ${cronExpression}`);
  }
}
