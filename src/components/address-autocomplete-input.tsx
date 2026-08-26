"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

type AddressAutocompleteInputProps = React.ComponentProps<typeof Input> & {
  onAddressSelect?: (address: string) => void;
};

let googleMapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsPlaces() {
  if (typeof window === "undefined") return Promise.resolve();
  const existingGoogle = (window as any).google;
  if (existingGoogle?.maps?.places) return Promise.resolve();

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.resolve();

  if (!googleMapsScriptPromise) {
    googleMapsScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-google-maps-places="true"]',
      );
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Google Places failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsPlaces = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Places failed to load."));
      document.head.appendChild(script);
    });
  }

  return googleMapsScriptPromise;
}

export const AddressAutocompleteInput = React.forwardRef<HTMLInputElement, AddressAutocompleteInputProps>(
  ({ onAddressSelect, onChange, autoComplete = "street-address", placeholder = "Start typing an address", ...props }, forwardedRef) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    React.useEffect(() => {
      let autocomplete: any = null;
      let listener: any = null;
      let cancelled = false;

      void loadGoogleMapsPlaces()
        .then(() => {
          if (cancelled || !inputRef.current) return;
          const google = (window as any).google;
          if (!google?.maps?.places) return;

          autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
            fields: ["formatted_address", "name"],
            componentRestrictions: { country: "ca" },
            types: ["address"],
          });
          listener = autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            const selectedAddress = String(place?.formatted_address || place?.name || inputRef.current?.value || "").trim();
            if (!selectedAddress) return;
            onAddressSelect?.(selectedAddress);
            if (onChange && inputRef.current) {
              const event = {
                target: inputRef.current,
                currentTarget: inputRef.current,
              } as React.ChangeEvent<HTMLInputElement>;
              inputRef.current.value = selectedAddress;
              onChange(event);
            }
          });
        })
        .catch(() => undefined);

      return () => {
        cancelled = true;
        if (listener?.remove) listener.remove();
        if (autocomplete) {
          const google = (window as any).google;
          google?.maps?.event?.clearInstanceListeners?.(autocomplete);
        }
      };
    }, [onAddressSelect, onChange]);

    return (
      <Input
        {...props}
        ref={setRefs}
        autoComplete={autoComplete}
        onChange={onChange}
        placeholder={placeholder}
      />
    );
  },
);

AddressAutocompleteInput.displayName = "AddressAutocompleteInput";
