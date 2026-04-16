'use client';

import { useEffect } from 'react';
import { RealtimeEvent } from '@/types/events';

/**
 * A hook to listen for real-time database updates via SSE.
 * @param callback Function to call when a relevant event occurs.
 * @param table Optional table name or array of table names to filter by.
 */
export function useRealtime(callback: (event: RealtimeEvent) => void, table?: string | string[]) {
    // Stabilize the dependency to prevent infinite reconnects if an inline array is passed
    const tableDep = Array.isArray(table) ? [...table].sort().join(',') : table;

    useEffect(() => {
        let eventSource: EventSource | null = null;
        let retryCount = 0;
        const maxRetries = 5;

        const setupSSE = () => {
            eventSource = new EventSource('/api/events');

            eventSource.onmessage = (event) => {
                try {
                    // Ignore heartbeats
                    if (event.data === ': heartbeat') return;

                    const data: RealtimeEvent = JSON.parse(event.data);

                    // Filter by table if specified
                    if (tableDep) {
                        const tableFilters = tableDep.split(',');
                        if (!tableFilters.includes(data.table)) return;
                    }

                    callback(data);
                } catch (err) {
                    console.error('Error parsing SSE event data', err);
                }
            };

            eventSource.onerror = (err) => {
                console.error('SSE connection error', err);
                eventSource?.close();

                // Simple exponential backoff for reconnection
                if (retryCount < maxRetries) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    setTimeout(setupSSE, delay);
                    retryCount++;
                }
            };

            eventSource.onopen = () => {
                retryCount = 0; // Reset retry count on successful connection
            };
        };

        setupSSE();

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [callback, tableDep]);
}
