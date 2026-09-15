let googleMapsScriptPromise: Promise<void> | null = null;

export function loadGoogleMapsPlaces() {
  if (typeof window === "undefined") return Promise.resolve();
  const existingGoogle = (window as any).google;
  if (existingGoogle?.maps?.places) return Promise.resolve();

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey)
    return Promise.reject(
      new Error(
        "Google Maps is not configured. Ask your workspace administrator to configure the Maps API key.",
      ),
    );

  if (!googleMapsScriptPromise) {
    googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () =>
          reject(
            new Error(
              "Google Maps took too long to load. Check your connection and try again.",
            ),
          ),
        20000,
      );
      const loaded = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      const failed = () => {
        window.clearTimeout(timeout);
        reject(new Error("Google Maps failed to load."));
      };
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-google-maps-places="true"]',
      );
      if (existingScript) {
        existingScript.addEventListener("load", loaded, { once: true });
        existingScript.addEventListener("error", failed, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsPlaces = "true";
      script.onload = loaded;
      script.onerror = failed;
      document.head.appendChild(script);
    }).catch((error) => {
      googleMapsScriptPromise = null;
      document
        .querySelector('script[data-google-maps-places="true"]')
        ?.remove();
      throw error;
    });
  }

  return googleMapsScriptPromise;
}
