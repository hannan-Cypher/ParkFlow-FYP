/**
 * lib/realtime.ts
 *
 * Global Realtime Manager — Singleton SSE Broadcast Pattern
 *
 * Instead of each SSE client opening its own LISTEN connection to Postgres,
 * this module maintains exactly ONE dedicated pg client that listens for
 * 'realtime_updates' notifications and fans them out to all registered
 * in-process subscribers via a Node.js EventEmitter.
 *
 * Result: N open dashboard tabs = 1 DB connection (not N).
 */

import { EventEmitter } from 'events';
import pool from './db';
import type { PoolClient } from 'pg';

class RealtimeManager extends EventEmitter {
    private static instance: RealtimeManager;
    private client: PoolClient | null = null;
    private connecting = false;
    private reconnectTimer: NodeJS.Timeout | null = null;

    private constructor() {
        super();
        this.setMaxListeners(500); // allow many SSE subscribers
    }

    static getInstance(): RealtimeManager {
        if (!RealtimeManager.instance) {
            RealtimeManager.instance = new RealtimeManager();
        }
        return RealtimeManager.instance;
    }

    async ensureConnected() {
        if (this.client || this.connecting) return;
        this.connecting = true;

        try {
            this.client = await pool.connect();

            // Listen for Postgres NOTIFY events
            this.client.on('notification', (msg) => {
                if (msg.channel === 'realtime_updates' && msg.payload) {
                    try {
                        const payload = JSON.parse(msg.payload);
                        this.emit('event', payload);
                    } catch (e) {
                        console.error('[Realtime] Failed to parse notification payload', e);
                    }
                }
            });

            this.client.on('error', (err) => {
                console.error('[Realtime] DB client error, will reconnect:', err.message);
                this.cleanup();
                this.scheduleReconnect();
            });

            await this.client.query('LISTEN realtime_updates');
            console.log('[Realtime] Shared listener connected and LISTENING');
        } catch (err) {
            console.error('[Realtime] Failed to connect shared listener:', err);
            this.cleanup();
            this.scheduleReconnect();
        } finally {
            this.connecting = false;
        }
    }

    private cleanup() {
        if (this.client) {
            try {
                this.client.query('UNLISTEN realtime_updates').catch(() => { });
                this.client.release();
            } catch (e) { }
            this.client = null;
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            console.log('[Realtime] Attempting reconnect...');
            this.ensureConnected();
        }, 5000);
    }

    subscribe(handler: (event: unknown) => void) {
        this.ensureConnected(); // make sure the shared client is up
        this.on('event', handler);
    }

    unsubscribe(handler: (event: unknown) => void) {
        this.off('event', handler);
    }
}

export const realtimeManager = RealtimeManager.getInstance();
