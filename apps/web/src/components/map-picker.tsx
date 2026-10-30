"use client";

import { useCallback, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, LocateFixed } from "lucide-react";

// Leaflet's default marker icon references image files via relative URLs that don't survive a
// webpack bundle — without this the pin renders as a broken image. Point it at the package's own
// CDN-hosted assets instead of trying to bundle the PNGs.
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const JAKARTA_CENTER: [number, number] = [-6.2088, 106.8456];

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPicker({ lat, lng, onChange }: MapPickerProps) {
  const [locating, setLocating] = useState(false);
  const position: [number, number] = lat != null && lng != null ? [lat, lng] : JAKARTA_CENTER;

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  }, [onChange]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-xl overflow-hidden border border-line" style={{ height: 220 }}>
        <MapContainer center={position} zoom={lat != null ? 15 : 11} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={onChange} />
          {lat != null && lng != null && (
            <Marker
              position={[lat, lng]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target.getLatLng();
                  onChange(m.lat, m.lng);
                },
              }}
            />
          )}
        </MapContainer>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="absolute bottom-2.5 right-2.5 z-[1000] flex items-center gap-1.5 bg-surface border border-line text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg shadow-card hover:bg-canvas transition-colors disabled:opacity-50"
        >
          <LocateFixed className="w-3.5 h-3.5" /> {locating ? "Mencari..." : "Lokasi saya"}
        </button>
      </div>
      <p className="text-[11.5px] text-muted flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        {lat != null && lng != null ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "Klik peta untuk menandai lokasi kamera."}
      </p>
    </div>
  );
}
