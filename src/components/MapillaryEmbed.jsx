/* ====================================================================
   MAPILLARY EMBED — crowdsourced street-level imagery in an iframe
   --------------------------------------------------------------------
   Mapillary's /embed endpoint is the only one that allows iframing
   (its /app page sends X-Frame-Options: DENY). The author pastes a
   Mapillary share/embed URL or image id on a map question; lib/model
   mapillaryEmbedUrl turns it into an embeddable URL. Keyless, but
   coverage varies and a given id may not always render.
   ==================================================================== */

import { mapillaryEmbedUrl } from "../lib/model.js";
import { useI18n } from "../i18n/I18nProvider.jsx";

/**
 * @param {object} props
 * @param {string} props.street Mapillary URL / image id from the map question.
 * @param {string} [props.className] Sizing classes (must give a height).
 * @param {string} [props.empty] Text shown when no embeddable URL can be built.
 */
export default function MapillaryEmbed({ street, className = "", empty = "" }) {
  const { t } = useI18n();
  const src = mapillaryEmbedUrl(street);
  if (!src) {
    return empty ? (
      <div
        className={`flex w-full items-center justify-center rounded-2xl border border-dashed border-stone-300 px-4 text-center text-sm text-stone-400 dark:border-stone-700 dark:text-stone-500 ${className}`}
      >
        {empty}
      </div>
    ) : null;
  }
  return (
    <iframe
      src={src}
      title={t("map.streetView")}
      loading="lazy"
      allowFullScreen
      className={`w-full rounded-2xl border border-stone-200 dark:border-stone-800 ${className}`}
      style={{ border: 0 }}
    />
  );
}
