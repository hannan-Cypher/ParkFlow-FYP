export type RealtimeAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeEvent {
    table: string;
    action: RealtimeAction;
    id: string;
    data?: any;
}
