import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { TrackPoint, Segment, sliceByDistance } from "../helpers/gpxUtils";
import "leaflet/dist/leaflet.css";
// Self-hosted Leaflet marker images, bundled from the installed leaflet package
// (previously loaded from cdnjs). Vite fingerprints and serves these from our origin.
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import styles from "./SplitterMap.module.css";

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Create custom boundary marker icon
const createBoundaryIcon = (color: string) => {
  return L.divIcon({
    className: styles.boundaryMarker,
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: move;"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

interface SplitterMapProps {
  points: TrackPoint[];
  segments: Segment[];
  onSegmentBoundaryChange?: (segmentIndex: number, newDistance: number) => void;
  onAddSegmentBoundary?: (distance: number) => void;
  isLoaded?: boolean;
}

// Component to update map view when points change
const MapUpdater = ({ points }: { points: TrackPoint[] }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
    if (!bounds.isValid()) return;

    // Fit the route only once the map container actually has a size. The
    // splitter view (and its map) mount together, so an immediate fit can run
    // against a 0-height container, which makes Leaflet jump to maxZoom.
    // maxZoom also caps any degenerate fit.
    const fit = () => {
      const { x, y } = map.getSize();
      if (x === 0 || y === 0) return false;
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      return true;
    };

    if (fit()) return;

    // Container not laid out yet — fit as soon as it gets a real size.
    const observer = new ResizeObserver(() => {
      if (fit()) observer.disconnect();
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [points, map]);

  return null;
};

// Draggable boundary marker component
const DraggableBoundaryMarker = ({
  segmentIndex,
  segment,
  points,
  onDragEnd,
}: {
  segmentIndex: number;
  segment: Segment;
  points: TrackPoint[];
  onDragEnd: (segmentIndex: number, newDistance: number) => void;
}) => {
  const markerRef = React.useRef<L.Marker>(null);

  const handleDragEnd = () => {
    if (!markerRef.current) return;
    
    const newLatLng = markerRef.current.getLatLng();
    
    // Find the closest point on the route to the new marker position
    let closestPoint = points[0];
    let minDistance = Number.MAX_VALUE;
    
    points.forEach((point) => {
      const dist = Math.sqrt(
        Math.pow(point.lat - newLatLng.lat, 2) + 
        Math.pow(point.lon - newLatLng.lng, 2)
      );
      
      if (dist < minDistance) {
        minDistance = dist;
        closestPoint = point;
      }
    });
    
    // Call the callback with the new distance
    onDragEnd(segmentIndex, closestPoint.dist);
  };

  if (!segment.stats.endLocation) return null;

  return (
    <Marker
      ref={markerRef}
      position={[segment.stats.endLocation.lat, segment.stats.endLocation.lon]}
      icon={createBoundaryIcon(segment.color)}
      draggable={true}
      eventHandlers={{
        dragend: handleDragEnd,
      }}
    >
      <Popup>
        <strong>Day {segmentIndex + 1} / Day {segmentIndex + 2}</strong>
        <br />
        Distance: {segment.endDist.toFixed(1)} km
        <br />
        <em style={{ fontSize: "0.85em", color: "var(--muted-foreground)" }}>
          Drag to adjust boundary
        </em>
      </Popup>
    </Marker>
  );
};

// Animated polyline component
const AnimatedPolyline = ({ 
  positions, 
  color, 
  segmentId,
  isLoaded,
  onPolylineClick
}: { 
  positions: [number, number][]; 
  color: string; 
  segmentId: string;
  isLoaded: boolean;
  onPolylineClick?: (lat: number, lng: number) => void;
}) => {
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    if (isLoaded && positions.length > 0) {
      // Trigger animation after component mounts
      requestAnimationFrame(() => {
        setAnimationClass(styles.polylineAnimate);
      });
    }
  }, [isLoaded, positions.length]);

  if (positions.length === 0) return null;

  return (
    <Polyline
      positions={positions}
      pathOptions={{ 
        color, 
        weight: 5, 
        opacity: 0.8,
        className: `${animationClass} ${onPolylineClick ? styles.clickablePolyline : ''}`
      }}
      eventHandlers={{
        click: (e) => {
          if (onPolylineClick) {
            onPolylineClick(e.latlng.lat, e.latlng.lng);
          }
        }
      }}
    />
  );
};

export const SplitterMap: React.FC<SplitterMapProps> = ({ 
  points, 
  segments,
  onSegmentBoundaryChange,
  onAddSegmentBoundary,
  isLoaded = false,
}) => {
  // Handle polyline click to add new split point
  const handlePolylineClick = (lat: number, lng: number) => {
    if (!onAddSegmentBoundary || points.length === 0) return;

    // Find nearest point
    let closestPoint = points[0];
    let minDistance = Number.MAX_VALUE;
    
    // Optimization: we could use a spatial index, but for typical GPX sizes linear scan is okay
    // We can optimize by searching only within the relevant segment if we knew it, 
    // but iterating all points guarantees finding the true closest point globally.
    points.forEach((point) => {
      const dist = Math.sqrt(
        Math.pow(point.lat - lat, 2) + 
        Math.pow(point.lon - lng, 2)
      );
      
      if (dist < minDistance) {
        minDistance = dist;
        closestPoint = point;
      }
    });

    onAddSegmentBoundary(closestPoint.dist);
  };

  // Memoize polylines to prevent unnecessary re-renders. sliceByDistance is a
  // binary search over the distance-sorted points, so recomputing on every
  // divider drag stays cheap even with 10k+ point routes.
  const segmentPolylines = useMemo(() => {
    return segments.map((segment) => {
      const segmentPoints = sliceByDistance(points, segment.startDist, segment.endDist);
      return {
        ...segment,
        positions: segmentPoints.map((p) => [p.lat, p.lon] as [number, number]),
      };
    });
  }, [points, segments]);

  // Boundary markers (draggable) - exclude the last segment boundary
  const boundaryMarkers = useMemo(() => {
    if (!onSegmentBoundaryChange) return null;
    
    return segments.slice(0, -1).map((segment, index) => (
      <DraggableBoundaryMarker
        key={`boundary-${segment.id}`}
        segmentIndex={index}
        segment={segment}
        points={points}
        onDragEnd={onSegmentBoundaryChange}
      />
    ));
  }, [segments, points, onSegmentBoundaryChange]);

  // Start marker (not draggable)
  const startMarker = useMemo(() => {
    if (points.length === 0) return null;
    const start = points[0];
    return (
      <Marker position={[start.lat, start.lon]} title="Start">
        <Popup>Start</Popup>
      </Marker>
    );
  }, [points]);

  // End marker (not draggable)
  const endMarker = useMemo(() => {
    if (points.length === 0) return null;
    const end = points[points.length - 1];
    return (
      <Marker position={[end.lat, end.lon]} title="End">
        <Popup>End</Popup>
      </Marker>
    );
  }, [points]);

  if (points.length === 0) {
    return (
      <div className={styles.emptyMap}>
        <p>Upload a GPX file to view the map</p>
      </div>
    );
  }

  return (
    <div className={styles.mapContainer}>
      <MapContainer
        center={[0, 0]}
        zoom={2}
        scrollWheelZoom={true}
        className={styles.leafletMap}
      >
        <TileLayer
          attribution='<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> | Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
          maxZoom={20}
        />
        
        <MapUpdater points={points} />

        {segmentPolylines.map((seg) => (
          <AnimatedPolyline
            key={seg.id}
            positions={seg.positions}
            color={seg.color}
            segmentId={seg.id}
            isLoaded={isLoaded}
            onPolylineClick={onAddSegmentBoundary ? handlePolylineClick : undefined}
          />
        ))}

        {startMarker}
        {boundaryMarkers}
        {endMarker}
      </MapContainer>
    </div>
  );
};