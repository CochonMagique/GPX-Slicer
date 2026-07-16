
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

        // Single DOM pass over the file. (This used to go through the
        // gpxparser package plus a second DOMParser pass to work around its
        // multi-track elevation bug; parsing directly needs neither the
        // extra pass nor the dependency, and textContent decodes XML
        // entities correctly where gpxparser's innerHTML did not.)
        const xmlDoc = new DOMParser().parseFromString(gpxContent, "text/xml");
        if (xmlDoc.querySelector("parsererror")) {
          reject(new Error("Not a valid GPX file"));
          return;
        }

        const xmlTracks = Array.from(xmlDoc.querySelectorAll("trk"));
        if (xmlTracks.length === 0) {
          reject(new Error("No track found in GPX file"));
          return;
        }

        type RawPoint = { lat: number; lon: number; ele: number | null; time?: Date };
        const tracks = xmlTracks.map((trk) => {
          const points: RawPoint[] = [];
          trk.querySelectorAll("trkpt").forEach((pt) => {
            const lat = parseFloat(pt.getAttribute("lat") ?? "");
            const lon = parseFloat(pt.getAttribute("lon") ?? "");
            // A malformed trkpt (missing/garbage lat or lon) would poison
            // every subsequent cumulative distance with NaN — skip it.
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

            const eleText = pt.querySelector("ele")?.textContent;
            const ele = eleText != null ? parseFloat(eleText) : NaN;
            const timeText = pt.querySelector("time")?.textContent;
            const time = timeText ? new Date(timeText) : undefined;

            points.push({
              lat,
              lon,
              ele: Number.isFinite(ele) ? ele : null,
              time: time && !isNaN(time.getTime()) ? time : undefined,
            });
          });
          // :scope > name — the track's own name, not one nested in a trkpt.
          const name = trk.querySelector(":scope > name")?.textContent?.trim() || null;
          return { name, points };
        });

        let cumulativeDist = 0;
        let totalElevation = 0;
        let totalElevationLoss = 0;
        const allPoints: TrackPoint[] = [];
        const originalSplitDistances: number[] = [];

        // Seed missing-elevation fill from the first real elevation in the
        // file, not 0 — otherwise leading no-<ele> points fabricate a huge
        // fake climb from sea level up to the first real reading.
        let lastKnownElevation =
          tracks.flatMap((t) => t.points).find((p) => p.ele !== null)?.ele ?? 0;

        tracks.forEach((track, trackIndex) => {
          track.points.forEach((p) => {
            let dist = 0;
            const prev = allPoints[allPoints.length - 1];
            if (prev) {
              dist = calculateDistance(prev.lat, prev.lon, p.lat, p.lon);
              if (!Number.isFinite(dist)) dist = 0;
            }

            cumulativeDist += dist;

            const elevation = p.ele ?? lastKnownElevation;

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
        let name = file.name.replace(/\.gpx$/i, "");
        if (tracks.length === 1 && tracks[0].name) {
          name = tracks[0].name;
        } else if (tracks.length > 1) {
          // Try to extract common base name if multiple tracks have names
          const names = tracks.map(t => t.name).filter((n): n is string => Boolean(n));
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
          name,
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

// Escape text for embedding in XML element content or attributes.
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Make a string safe to use as a download filename across OSes.
function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/, "")
    .trim() || "segment";
}

// points are sorted by cumulative distance, so locate a [startDist, endDist]
// range with binary search + slice instead of filtering the whole array
// (matters on every divider drag with 10k+ point routes).
export const sliceByDistance = (points: TrackPoint[], startDist: number, endDist: number): TrackPoint[] => {
  if (points.length === 0 || endDist < startDist) return [];
  // lower bound: first index with dist >= startDist
  let lo = 0, hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].dist < startDist) lo = mid + 1;
    else hi = mid;
  }
  const start = lo;
  // upper bound: first index with dist > endDist
  hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].dist <= endDist) lo = mid + 1;
    else hi = mid;
  }
  return points.slice(start, lo);
};

export const calculateSegmentStats = (points: TrackPoint[], startDist: number, endDist: number) => {
  // Filter points within the distance range
  // We need to interpolate the exact start and end points for precision, 
  // but for this UI finding the closest points is usually sufficient for a first pass.
  // For better accuracy, we'll just slice the array.
  
  const segmentPoints = sliceByDistance(points, startDist, endDist);

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
    const segmentPoints = sliceByDistance(points, segment.startDist, segment.endDist);

    if (segmentPoints.length === 0) return;

    const safeName = escapeXml(segment.name);
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPX Slicer (gpxslicer.com)" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeName}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
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
      filename: sanitizeFilename(`${segment.name} - ${originalName}`) + ".gpx",
      content: gpx
    });
  });

  return files;
};