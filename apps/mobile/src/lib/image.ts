/**
 * Transforme une URL publique Supabase Storage en URL redimensionnée (render/image)
 * pour servir une vignette légère au lieu de l'image d'origine (souvent > plusieurs Mo).
 * Corrige les images qui ne s'affichent pas / trop lentes sur mobile.
 *
 * Ex : .../storage/v1/object/public/terrains/x.jpg
 *   → .../storage/v1/render/image/public/terrains/x.jpg?width=600&quality=70&resize=cover
 */
export function imageThumb(url?: string | null, width = 700, quality = 70): string | undefined {
  if (!url) return undefined;
  if (url.includes('/storage/v1/object/public/')) {
    const base = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}width=${width}&quality=${quality}&resize=cover`;
  }
  return url;
}
