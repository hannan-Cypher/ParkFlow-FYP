/**
 * lib/server/ngrok.ts
 *
 * Server-only utility to fetch the current public ngrok URL.
 * Only works if ngrok is running on localhost:4040.
 */

interface NgrokTunnel {
    public_url: string;
    proto: string;
    config: {
        addr: string;
    };
}

interface NgrokResponse {
    tunnels: NgrokTunnel[];
}

let cachedUrl: string | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds

export async function getNgrokPublicUrl(): Promise<string | null> {
    const now = Date.now();
    if (cachedUrl && now - lastFetchTime < CACHE_TTL) {
        return cachedUrl;
    }

    try {
        const res = await fetch('http://localhost:4040/api/tunnels', {
            next: { revalidate: 0 }, // Ensure no Next.js caching
        });

        if (!res.ok) return null;

        const data: NgrokResponse = await res.json();
        // Prefer https tunnel
        const tunnel = data.tunnels.find((t) => t.proto === 'https') || data.tunnels[0];

        if (tunnel?.public_url) {
            cachedUrl = tunnel.public_url;
            lastFetchTime = now;
            return cachedUrl;
        }
    } catch (error) {
        // ngrok probably not running or 4040 blocked
        console.warn('[ngrok] Failed to fetch tunnel info:', error);
    }

    return null;
}
