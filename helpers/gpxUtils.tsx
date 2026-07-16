import GpxParser from "gpxparser";
import { format } from "date-fns";

export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
  dist: number; // Cumulative distance in km
  time?: Date;
}

export interface RouteStats {
  totalDistance: number; // km
  totalElevation: number; // m (gain)
  totalElevationLoss: number; // m
  name: string;
}

export interface Segment {
  id: string;
  name: string;
  startDist: number; // km
  endDist: number; // km
  color: string;
  stats: {
    distance: number;
    elevationGain: number;
    elevationLoss: number;
    startLocation?: { lat: number; lon: number };
    endLocation?: { lat: number; lon: number };
  };
}

// Palette for segments
export const SEGMENT_COLORS = [
  "#2D5016", // Forest Green
  "#8B7355", // Warm Brown
  "#E63946", // Red
  "#457B9D", // Blue
  "#E9C46A", // Yellow/Orange
  "#2A9D8F", // Teal
  "#F4A261", // Sandy
  "#9B2226", // Dark Red
];

export const parseGpxFile = async (file: File): Promise<{ points: TrackPoint[]; stats: RouteStats; originalSplitDistances?: number[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const gpxContent = e.target?.result as string;
        const gpx = new GpxParser();
        gpx.parse(gpxContent);

        const tracks = gpx.tracks;
        if (!tracks || tracks.length === 0) {
          reject(new Error("No track found in GPX file"));
          return;
        }

        let cumulativeDist = 0;
        let totalElevation = 0;
        let totalElevationLoss = 0;
        let lastKnownElevation = 0;
        const allPoints: TrackPoint[] = [];
        const originalSplitDistances: number[] = [];

        // Parse elevation manually from raw XML (gpxparser bug: only reads ele for first track)
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(gpxContent, "text/xml");
        const xmlTracks = xmlDoc.querySelectorAll("trk");

        // Build a map of elevation values: elevationMap[trackIndex][pointIndex] = elevation
        const elevationMap: (number | null)[][] = [];
        xmlTracks.forEach((xmlTrack) => {
          const trackElevations: (number | null)[] = [];
          const trkpts = (xmlTrack as Element).querySelectorAll("trkpt");
          trkpts.forEach((trkpt) => {
            const eleNode = (trkpt as Element).querySelector("ele");
            const ele = eleNode ? parseFloat(eleNode.textContent || "") : null;
            trackElevations.push((ele === null || isNaN(ele)) ? null : ele);
          });
          elevationMap.push(trackElevations);
        });

        tracks.forEach((track, trackIndex) => {
          track.points.forEach((p, i) => {
            let dist = 0;
            if (i > 0) {
              const prev = track.points[i - 1];
              dist = calculateDistance(prev.lat, prev.lon, p.lat, p.lon);
            } else if (trackIndex > 0) {
              // Connect to the last point of the previous track
              const prevTrack = tracks[trackIndex - 1];
              if (prevTrack.points.length > 0) {
                const prev = prevTrack.points[prevTrack.points.length - 1];
                dist = calculateDistance(prev.lat, prev.lon, p.lat, p.lon);
              }
            }
            
            cumulativeDist += dist;

            // Get elevation from our manual parsing (fixes gpxparser multi-track bug)
            const rawElevation = elevationMap[trackIndex]?.[i] ?? null;
            const elevation = rawElevation ?? lastKnownElevation;
            
            // Calculate stats using corrected elevation
            // Skip only the very first point in the entire route
            if (allPoints.length > 0) {
              const diff = elevation - lastKnownElevation;
              if (diff > 0) totalElevation += diff;
              else totalElevationLoss += Math.abs(diff);
            }
            
            lastKnownElevation = elevation;
            
            allPoints.push({
              lat: p.lat,
              lon: p.lon,
              ele: elevation,
              dist: cumulativeDist,
              time: p.time,
            });
          });

          // Record split point (end of this track), unless it's the last track
          if (trackIndex < tracks.length - 1) {
            originalSplitDistances.push(cumulativeDist);
          }
        });

        // Determine name
        let name = file.name.replace(".gpx", "");
        if (tracks.length === 1 && tracks[0].name) {
          name = tracks[0].name;
        } else if (tracks.length > 1) {
          // Try to extract common base name if multiple tracks have names
          const names = tracks.map(t => t.name).filter(Boolean);
          if (names.length === tracks.length) {
            const common = findCommonPrefix(names).trim();
            // Use common prefix if it's substantial enough
            if (common.length > 3) {
              name = common.replace(/[-_]$/, "").trim();
            }
          } else if (tracks[0].name) {
             // Fallback to first track name
             name = tracks[0].name;
          }
        }

        const stats: RouteStats = {
          totalDistance: cumulativeDist,
          totalElevation: totalElevation,
          totalElevationLoss: totalElevationLoss,
          name: decodeHtmlEntities(name),
        };

        resolve({ 
          points: allPoints, 
          stats,
          originalSplitDistances: originalSplitDistances.length > 0 ? originalSplitDistances : undefined 
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};

function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return "";
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (strings[i].indexOf(prefix) !== 0) {
      prefix = prefix.substring(0, prefix.length - 1);
      if (prefix === "") return "";
    }
  }
  return prefix;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export const calculateSegmentStats = (points: TrackPoint[], startDist: number, endDist: number) => {
  // Filter points within the distance range
  // We need to interpolate the exact start and end points for precision, 
  // but for this UI finding the closest points is usually sufficient for a first pass.
  // For better accuracy, we'll just slice the array.
  
  const segmentPoints = points.filter(p => p.dist >= startDist && p.dist <= endDist);
  
  if (segmentPoints.length < 2) {
    return {
      distance: 0,
      elevationGain: 0,
      elevationLoss: 0,
      startLocation: segmentPoints[0] ? { lat: segmentPoints[0].lat, lon: segmentPoints[0].lon } : undefined,
      endLocation: segmentPoints[segmentPoints.length - 1] ? { lat: segmentPoints[segmentPoints.length - 1].lat, lon: segmentPoints[segmentPoints.length - 1].lon } : undefined,
    };
  }

  let elevationGain = 0;
  let elevationLoss = 0;

  for (let i = 1; i < segmentPoints.length; i++) {
    const diff = segmentPoints[i].ele - segmentPoints[i - 1].ele;
    if (diff > 0) elevationGain += diff;
    else elevationLoss += Math.abs(diff);
  }

  return {
    distance: endDist - startDist,
    elevationGain,
    elevationLoss,
    startLocation: { lat: segmentPoints[0].lat, lon: segmentPoints[0].lon },
    endLocation: { lat: segmentPoints[segmentPoints.length - 1].lat, lon: segmentPoints[segmentPoints.length - 1].lon },
  };
};

export const generateGpxXml = (points: TrackPoint[], segments: Segment[], originalName: string): { filename: string, content: string }[] => {
  const files: { filename: string, content: string }[] = [];

  segments.forEach((segment) => {
    const segmentPoints = points.filter(p => p.dist >= segment.startDist && p.dist <= segment.endDist);
    
    if (segmentPoints.length === 0) return;

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPX Route Splitter" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${segment.name}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${segment.name}</name>
    <trkseg>
`;

    segmentPoints.forEach(p => {
      gpx += `      <trkpt lat="${p.lat}" lon="${p.lon}">
        <ele>${p.ele.toFixed(1)}</ele>
      </trkpt>
`;
    });

    gpx += `    </trkseg>
  </trk>
</gpx>`;

        files.push({
      filename: `${segment.name} - ${originalName}.gpx`,
      content: gpx
    });
  });

  return files;
};