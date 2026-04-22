/**
 * Compresses an image data URL using the Canvas API.
 * @param dataUrl The original image as a data URL.
 * @param maxWidth The maximum width of the compressed image.
 * @param maxHeight The maximum height of the compressed image.
 * @param quality The quality of the JPEG compression (0 to 1).
 * @returns A promise that resolves to the compressed image data URL.
 */
export async function compressImage(
    dataUrl: string,
    maxWidth: number = 1280,
    maxHeight: number = 720,
    quality: number = 0.7
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions while maintaining aspect ratio
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Convert to compressed jpeg
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
        };
        img.onerror = (error) => reject(error);
    });
}

/**
 * Converts a data URL to a File object.
 */
export function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}
