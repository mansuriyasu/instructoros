"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Navigation, Phone, X } from "lucide-react";
import { useSession } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadGoogleMapsPlaces } from "@/lib/google-maps-loader";
import {
  clusterMapPoints,
  filterMapStudents,
  type MapData,
  type MapLocation,
} from "@/lib/student-map";

// In-memory only: discarded on reload/account change and after one hour. Never persisted in exports.
const locationCache = new Map<
  string,
  { position: MapLocation; expires: number }
>();
let cacheScope = "";

export default function StudentMapPage() {
  const { user, activeTenantId, isSessionLoading } = useSession();
  useEffect(() => {
    if (!user) {
      locationCache.clear();
      cacheScope = "";
    }
  }, [user]);
  if (isSessionLoading || !user || !activeTenantId)
    return <p role="status">Loading workspace…</p>;
  return (
    <StudentMap
      key={`${user.uid}:${activeTenantId}`}
      scope={`${user.uid}:${activeTenantId}`}
    />
  );
}

function StudentMap({ scope }: { scope: string }) {
  const { user, activeTenantId } = useSession();
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("current");
  const [date, setDate] = useState("");
  const [instructor, setInstructor] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [locations, setLocations] = useState<Record<string, MapLocation>>({});
  const [unavailable, setUnavailable] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState("");
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const details = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const googleRef = useRef<any>(null);
  const visible = useMemo(
    () => (data ? filterMapStudents(data, search, mode, date, instructor) : []),
    [data, search, mode, date, instructor],
  );

  useEffect(() => {
    if (cacheScope !== scope) {
      locationCache.clear();
      cacheScope = scope;
    }
    const controller = new AbortController();
    setError("");
    void user!
      .getIdToken()
      .then((token) =>
        fetch("/api/students/map", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tenantId: activeTenantId }),
          signal: controller.signal,
        }),
      )
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Could not load students.");
        if (!controller.signal.aborted) setData(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [activeTenantId, user, scope, reload]);

  useEffect(() => {
    if (!data || !data.students.length) return;
    setMapError("");
    let cancelled = false;
    const previousAuthFailure = (window as any).gm_authFailure;
    const authFailure = () => {
      if (!cancelled)
        setMapError(
          "Google Maps could not authorize this website. Check the API key, domain restrictions, enabled APIs, and billing in Google Cloud.",
        );
    };
    (window as any).gm_authFailure = authFailure;
    void loadGoogleMapsPlaces()
      .then(async () => {
        const google = (window as any).google;
        await google.maps.importLibrary("marker");
        if (cancelled || !canvas.current) return;
        googleRef.current = google;
        mapRef.current = new google.maps.Map(canvas.current, {
          center: { lat: 43.65, lng: -79.38 },
          zoom: 10,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
          streetViewControl: false,
          mapTypeControl: false,
          gestureHandling: "cooperative",
          fullscreenControl: true,
        });
        setReady(true);
      })
      .catch((error) => {
        if (!cancelled)
          setMapError(error.message || "Google Maps could not load.");
      });
    return () => {
      cancelled = true;
      setReady(false);
      mapRef.current = null;
      if ((window as any).gm_authFailure === authFailure)
        (window as any).gm_authFailure = previousAuthFailure;
    };
  }, [data]);

  useEffect(() => {
    if (!ready || !data) return;
    let cancelled = false;
    const geocoder = new googleRef.current.maps.Geocoder();
    setUnavailable({});
    setLocations({});
    void (async () => {
      for (let index = 0; index < data.students.length; index++) {
        if (cancelled) break;
        const student = data.students[index];
        setProgress(
          `Locating students ${index + 1} of ${data.students.length}…`,
        );
        if (!student.address.trim()) {
          setUnavailable((value) => ({
            ...value,
            [student.id]: "Address missing",
          }));
          continue;
        }
        const key = `${scope}:${student.address.trim().toLowerCase()}`;
        const cached = locationCache.get(key);
        if (cached && cached.expires > Date.now()) {
          setLocations((value) => ({
            ...value,
            [student.id]: cached.position,
          }));
          continue;
        }
        locationCache.delete(key);
        try {
          let timeout: number | undefined;
          const response = await Promise.race([
            geocoder.geocode({
              address: student.address,
              componentRestrictions: { country: "CA" },
            }),
            new Promise<never>((_, reject) => {
              timeout = window.setTimeout(
                () => reject(new Error("Lookup timeout")),
                15000,
              );
            }),
          ]).finally(() => window.clearTimeout(timeout));
          if (cancelled) break;
          const result = response.results?.[0];
          if (
            !result ||
            result.partial_match ||
            !["ROOFTOP", "RANGE_INTERPOLATED"].includes(
              result.geometry.location_type,
            )
          ) {
            setUnavailable((value) => ({
              ...value,
              [student.id]: "Address needs review",
            }));
            continue;
          }
          const position = {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
          };
          locationCache.set(key, { position, expires: Date.now() + 3600000 });
          window.setTimeout(() => locationCache.delete(key), 3600000);
          setLocations((value) => ({ ...value, [student.id]: position }));
        } catch (error) {
          if (cancelled) break;
          const code = String((error as { code?: string }).code || error);
          if (code.includes("ZERO_RESULTS")) {
            setUnavailable((value) => ({
              ...value,
              [student.id]: "Address not found",
            }));
            continue;
          }
          setMapError(
            "Address lookup is unavailable. Check that Geocoding API is enabled and that the Google key, billing, and quota allow requests.",
          );
          break;
        }
      }
      if (!cancelled) setProgress("");
    })();
    return () => {
      cancelled = true;
    };
  }, [data, ready, scope]);

  useEffect(() => {
    if (!ready) return;
    const google = googleRef.current;
    const map = mapRef.current;
    const points = visible
      .filter((student) => locations[student.id])
      .map((student) => ({ ...student, ...locations[student.id] }));
    let markers: any[] = [];
    const draw = () => {
      markers.forEach((marker) => {
        marker.map = null;
      });
      markers = clusterMapPoints(points, map.getZoom() || 10).map((group) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent =
          group.length > 1 ? `${group.length} students` : group[0].name;
        button.className =
          "rounded-full border-2 border-white bg-blue-700 px-3 py-2 text-xs font-bold text-white shadow-lg";
        button.setAttribute(
          "aria-label",
          group.map((student) => student.name).join(", "),
        );
        button.onclick = () =>
          setSelectedIds(group.map((student) => student.id));
        return new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: group[0].lat, lng: group[0].lng },
          content: button,
          title: button.getAttribute("aria-label"),
        });
      });
    };
    draw();
    if (points.length) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((point) =>
        bounds.extend({ lat: point.lat, lng: point.lng }),
      );
      map.fitBounds(bounds, 60);
      google.maps.event.addListenerOnce(map, "idle", () => {
        if (map.getZoom() > 16) map.setZoom(16);
      });
    }
    const listener = map.addListener("zoom_changed", draw);
    return () => {
      listener.remove();
      markers.forEach((marker) => {
        marker.map = null;
      });
    };
  }, [visible, locations, ready]);

  useEffect(() => {
    if (selectedIds.length)
      details.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedIds]);

  const selected = visible.filter((student) =>
    selectedIds.includes(student.id),
  );
  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/app/students" aria-label="Back to students">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Student Map</h1>
          <p className="text-sm text-muted-foreground">
            Find your active and booked students at a glance.
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="rounded-xl border p-4">
          {error}{" "}
          <Button size="sm" onClick={() => setReload((value) => value + 1)}>
            Try again
          </Button>
        </div>
      )}
      {!data && !error && <p role="status">Loading students…</p>}
      {data && (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              aria-label="Search students or addresses"
              placeholder="Search name or address"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Students shown"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="current">Active + booked</option>
              <option value="upcoming">Upcoming appointments</option>
            </select>
            <select
              aria-label="Instructor"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={instructor}
              onChange={(event) => setInstructor(event.target.value)}
            >
              <option value="">All permitted instructors</option>
              {data.instructors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div>
              <label htmlFor="map-date" className="sr-only">
                Appointment date
              </label>
              <Input
                id="map-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              {date && (
                <button
                  className="mt-1 text-xs underline"
                  onClick={() => setDate("")}
                >
                  Clear date
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground" role="status">
            {visible.filter((student) => locations[student.id]).length} located
            · {visible.length} students{progress && ` · ${progress}`}
          </p>
          {mapError && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
            >
              {mapError}
            </div>
          )}
          {data.students.length > 0 && (
            <div
              ref={canvas}
              aria-label="Map of student addresses"
              className="h-[55dvh] min-h-[320px] overflow-hidden rounded-2xl border bg-secondary lg:h-[600px]"
            />
          )}
          {!visible.length && (
            <p className="rounded-xl border p-5">
              No active or booked students match these filters.
            </p>
          )}
          {selected.length > 0 && (
            <section
              ref={details}
              aria-label="Selected students"
              className="rounded-2xl border bg-card p-4 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold">
                  {selected.length > 1
                    ? "Students at this location"
                    : selected[0].name}
                </h2>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Close student details"
                  onClick={() => setSelectedIds([])}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {selected.map((student) => (
                <div key={student.id} className="space-y-2 border-t py-3">
                  <p className="font-semibold">{student.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {student.address}
                  </p>
                  <p className="text-sm">
                    {student.nextEvent
                      ? `Next appointment: ${new Date(student.nextEvent.start).toLocaleString()}`
                      : "No upcoming appointment"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.instructors
                      .filter((item) =>
                        student.assignedInstructorIds.includes(item.id),
                      )
                      .map((item) => item.name)
                      .join(", ") || "Instructor not assigned"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/app/students?studentId=${encodeURIComponent(student.id)}`}
                      >
                        Student profile
                      </Link>
                    </Button>
                    {student.mobileNumber && (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={`tel:${student.mobileNumber.replace(/[^+\d]/g, "")}`}
                        >
                          <Phone className="mr-1 h-4 w-4" />
                          Call
                        </a>
                      </Button>
                    )}
                    {student.address && (
                      <Button asChild size="sm">
                        <a
                          href={`https://waze.com/ul?q=${encodeURIComponent(student.address)}&navigate=yes`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Navigation className="mr-1 h-4 w-4" />
                          Waze
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((student) => (
              <button
                key={student.id}
                className="flex items-start gap-2 rounded-xl border bg-card p-3 text-left hover:bg-secondary"
                onClick={() => {
                  setSelectedIds([student.id]);
                  if (locations[student.id] && mapRef.current) {
                    mapRef.current.panTo(locations[student.id]);
                    mapRef.current.setZoom(17);
                  }
                }}
              >
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block font-semibold">{student.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {student.address || "Address missing"}
                  </span>
                  {unavailable[student.id] && (
                    <span className="block text-xs text-amber-700">
                      {unavailable[student.id]} · Open profile to edit
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
