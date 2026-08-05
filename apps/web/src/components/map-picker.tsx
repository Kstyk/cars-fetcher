import L from 'leaflet';
import { Circle, MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

/**
 * Leaflet ships its marker icons as separate files that a bundler cannot see
 * from the CSS alone, so the default icon 404s. Pointing at the CDN copies
 * keeps it to a couple of lines.
 */
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Roughly the centre of Poland, used when no pin is set yet. */
const POLAND_CENTER: [number, number] = [52.07, 19.48];

export interface MapPoint {
  lat: number;
  lon: number;
}

function ClickHandler({ onPick }: { onPick: (point: MapPoint) => void }) {
  useMapEvents({
    click: (event) => onPick({ lat: event.latlng.lat, lon: event.latlng.lng }),
  });
  return null;
}

export function MapPicker({
  point,
  radiusKm,
  onPick,
}: {
  point: MapPoint | null;
  radiusKm: number | null;
  onPick: (point: MapPoint) => void;
}) {
  const center: [number, number] = point ? [point.lat, point.lon] : POLAND_CENTER;

  return (
    <div className="h-96 w-full overflow-hidden rounded-lg border">
      <MapContainer
        center={center}
        zoom={point ? 9 : 6}
        scrollWheelZoom
        className="size-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onPick} />

        {point ? (
          <>
            <Marker position={[point.lat, point.lon]} icon={markerIcon} />
            {radiusKm ? (
              <Circle
                center={[point.lat, point.lon]}
                radius={radiusKm * 1000}
                pathOptions={{ color: '#2563eb', fillOpacity: 0.1 }}
              />
            ) : null}
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}
