"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

type AddressAutocompleteInputProps = React.ComponentProps<typeof Input> & {
  onAddressSelect?: (address: string) => void;
};

let googleMapsScriptPromise: Promise<void> | null = null;

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(input, "value")?.set;
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(input, value);
  } else {
    valueSetter?.call(input, value);
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

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
    const autocompleteServiceRef = React.useRef<any>(null);
    const debounceRef = React.useRef<number | null>(null);
    const [predictions, setPredictions] = React.useState<Array<{ description: string; place_id: string }>>([]);
    const [isFocused, setIsFocused] = React.useState(false);

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

    const updatePredictions = React.useCallback((value: string) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);

      const query = value.trim();
      if (query.length < 3) {
        setPredictions([]);
        return;
      }

      debounceRef.current = window.setTimeout(() => {
        void loadGoogleMapsPlaces()
          .then(() => {
            const google = (window as any).google;
            if (!google?.maps?.places) return;
            if (!autocompleteServiceRef.current) {
              autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
            }

            autocompleteServiceRef.current.getPlacePredictions(
              {
                input: query,
                componentRestrictions: { country: "ca" },
                types: ["address"],
              },
              (results: Array<{ description: string; place_id: string }> | null, status: string) => {
                const ok = status === google.maps.places.PlacesServiceStatus.OK;
                setPredictions(ok && results ? results.slice(0, 5) : []);
              },
            );
          })
          .catch(() => undefined);
      }, 180);
    }, []);

    const selectAddress = React.useCallback((selectedAddress: string) => {
      if (!selectedAddress || !inputRef.current) return;
      setNativeInputValue(inputRef.current, selectedAddress);
      setPredictions([]);
      onAddressSelect?.(selectedAddress);
      if (onChange && inputRef.current) {
        const event = {
          target: inputRef.current,
          currentTarget: inputRef.current,
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
    }, [onAddressSelect, onChange]);

    React.useEffect(() => {
      let cancelled = false;

      void loadGoogleMapsPlaces()
        .then(() => {
          if (cancelled || !inputRef.current) return;
          const google = (window as any).google;
          if (!google?.maps?.places) return;
          autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        })
        .catch(() => undefined);

      return () => {
        cancelled = true;
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
      };
    }, []);

    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);
      updatePredictions(event.target.value);
    }, [onChange, updatePredictions]);

    return (
      <div className="relative">
        <Input
          {...props}
          ref={setRefs}
          autoComplete={autoComplete}
          onChange={handleChange}
          onFocus={(event) => {
            setIsFocused(true);
            props.onFocus?.(event);
            updatePredictions(event.currentTarget.value);
          }}
          onBlur={(event) => {
            window.setTimeout(() => setIsFocused(false), 160);
            props.onBlur?.(event);
          }}
          placeholder={placeholder}
        />
        {isFocused && predictions.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-[2147483647] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
            {predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                type="button"
                className="block min-h-12 w-full border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 active:bg-amber-50 hover:bg-slate-50"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectAddress(prediction.description);
                }}
                onTouchStart={(event) => {
                  event.preventDefault();
                  selectAddress(prediction.description);
                }}
              >
                {prediction.description}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);

AddressAutocompleteInput.displayName = "AddressAutocompleteInput";
