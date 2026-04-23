/**
 * Checks if the shift duration has exceeded the 14-hour limit.
 * 
 * @param shiftStart - ISO string or Date object representing the start of the shift
 * @returns Object containing whether the limit is exceeded and the elapsed hours
 */
export function checkShiftThresholds(shiftStart: string | Date): { isExceeded: boolean, elapsedHours: number } {
    const startTime = new Date(shiftStart).getTime();
    const elapsedHours = (Date.now() - startTime) / (1000 * 60 * 60);

    return {
        isExceeded: elapsedHours >= 14,
        elapsedHours
    };
}
