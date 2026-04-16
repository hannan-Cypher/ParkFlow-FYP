/**
 * Formats an ISO date string into a user-friendly format for check-in/out.
 * Example: "Apr 16, 11:46 AM"
 */
export function formatSessionDateTime(iso: string | null): string {
    if (!iso) return "—";
    const date = new Date(iso);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Returns a color configuration for a session based on its type (In or Out).
 */
export function getArrowConfig(type: 'in' | 'out'): { bg: string, text: string } {
    if (type === 'in') {
        // Green arrow for check-in
        return {
            bg: 'bg-emerald-50 dark:bg-emerald-900/30',
            text: 'text-emerald-700 dark:text-emerald-400'
        };
    }
    // Blue arrow for check-out
    return {
        bg: 'bg-sky-50 dark:bg-sky-900/30',
        text: 'text-sky-700 dark:text-sky-400'
    };
}
