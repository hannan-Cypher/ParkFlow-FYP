import { getWhatsAppBaseUrl } from './whatsapp';

describe('getWhatsAppBaseUrl', () => {
    it('should use envUrl when provided and not localhost', () => {
        const envUrl = 'https://parkflow.pk';
        const windowOrigin = 'http://localhost:3000';
        expect(getWhatsAppBaseUrl(envUrl, windowOrigin)).toBe('https://parkflow.pk');
    });

    it('should fallback to windowOrigin when envUrl is missing or localhost', () => {
        const windowOrigin = 'https://parkflow.pk';
        expect(getWhatsAppBaseUrl('', windowOrigin)).toBe('https://parkflow.pk');
        expect(getWhatsAppBaseUrl('http://localhost:3000', windowOrigin)).toBe('https://parkflow.pk');
    });

    it('should NOT fallback to hardcoded ngrok in production', () => {
        // This is the failing test: currently it would probably return the hardcoded ngrok
        const envUrl = '';
        const windowOrigin = 'http://localhost:3000';
        // We want it to NOT return "https://ductless-case-overproficiently.ngrok-free.dev"
        // Instead it should probably just return the windowOrigin (localhost) if nothing else is available, 
        // or we should ensure NEXT_PUBLIC_APP_URL is set.
        const result = getWhatsAppBaseUrl(envUrl, windowOrigin);
        expect(result).not.toBe('https://ductless-case-overproficiently.ngrok-free.dev');
    });
});
