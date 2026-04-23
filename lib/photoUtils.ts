export interface DamagePhoto {
    url: string;
    label?: string;
    timestamp?: string;
}

export interface Base64DamagePhoto {
    data: string;
    label: string;
}

export function getHeaderPhotos(photos: DamagePhoto[] | null | undefined, limit: number = 3): DamagePhoto[] {
    if (!photos) return [];
    return photos.slice(0, limit);
}

export function getPhotoLabel(photo: DamagePhoto, index: number): string {
    if (photo.label) return photo.label;
    return `Photo ${index + 1}`;
}

/**
 * Processes a list of files into Base64DamagePhoto objects using parallel compression.
 */
export async function processDamagePhotos(
    files: File[],
    startIndex: number = 0
): Promise<Base64DamagePhoto[]> {
    const { compressImage } = await import("./imageUtils");

    const readFileAsDataURL = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(new Error("File read failed"));
            reader.readAsDataURL(file);
        });
    };

    const processFile = async (file: File, index: number): Promise<Base64DamagePhoto | null> => {
        try {
            const dataUrl = await readFileAsDataURL(file);
            const compressed = await compressImage(dataUrl, 1280, 1280, 0.7);
            return {
                data: compressed,
                label: `Photo ${startIndex + index + 1}`
            };
        } catch (err) {
            console.error(`Failed to process photo ${index + 1}:`, err);
            return null;
        }
    };

    const results = await Promise.all(files.map((file, i) => processFile(file, i)));
    return results.filter((r): r is Base64DamagePhoto => r !== null);
}
