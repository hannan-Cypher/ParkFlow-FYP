export interface DamagePhoto {
    url: string;
    label?: string;
    timestamp?: string;
}

export function getHeaderPhotos(photos: DamagePhoto[] | null | undefined, limit: number = 3): DamagePhoto[] {
    if (!photos) return [];
    return photos.slice(0, limit);
}

export function getPhotoLabel(photo: DamagePhoto, index: number): string {
    if (photo.label) return photo.label;
    return `Photo ${index + 1}`;
}
