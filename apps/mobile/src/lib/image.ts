/**
 * URL image réellement enregistrée dans Supabase Storage.
 *
 * L'endpoint de transformation `/render/image` est bien disponible côté web,
 * mais les requêtes RN iOS de ce projet ne le rendent pas de manière fiable :
 * les bannières et photos apparaissent alors vides dans toute l'app. On sert
 * donc l'objet public d'origine, compatible avec Image/ImageBackground sur
 * iOS et Android. `width` et `quality` restent dans la signature pour ne pas
 * casser les appels existants ; l'optimisation sera réactivée avec un CDN
 * dédié une fois le comportement natif validé.
 */
export function imageThumb(url?: string | null, _width = 700, _quality = 70): string | undefined {
  return url || undefined;
}
