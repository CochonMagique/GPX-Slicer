import React, { useState, useCallback, useEffect } from "react";
import { SplitterSidebar } from "../components/SplitterSidebar";
import { ThemeModeSwitch } from "../components/ThemeModeSwitch";
import { SplitterMap } from "../components/SplitterMap";
import { SplitterElevationProfile } from "../components/SplitterElevationProfile";
import { FileDropzone } from "../components/FileDropzone";
import {
  parseGpxFile,
  TrackPoint,
  RouteStats,
  Segment,
  calculateSegmentStats,
  SEGMENT_COLORS,
  generateGpxXml
} from "../helpers/gpxUtils";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Mountain } from "lucide-react";
import { Spinner } from "../components/Spinner";
import styles from "./_index.module.css";

export default function IndexPage() {
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastModifiedSegmentIndex, setLastModifiedSegmentIndex] = useState<number | null>(null);

  // Keep the tab title in sync with app state (replaces react-helmet).
  useEffect(() => {
    document.title = routeStats ? "Splitter | GPX Slicer" : "GPX Slicer";
  }, [routeStats]);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    setIsUploading(true);

    try {
      const { points: parsedPoints, stats, originalSplitDistances } = await parseGpxFile(file);

      if (parsedPoints.length < 2 || stats.totalDistance <= 0) {
        toast.error("This GPX file has no usable distance — nothing to split.");
        return;
      }

      setPoints(parsedPoints);
      setRouteStats(stats);
      setLastModifiedSegmentIndex(null);

      if (originalSplitDistances && originalSplitDistances.length > 0) {
        // Initialize segments based on original splits
        const newSegments: Segment[] = [];
        let prevDist = 0;
        const boundaries = [...originalSplitDistances, stats.totalDistance];

        boundaries.forEach((endDist, i) => {
          const startDist = prevDist;
          const segmentStats = calculateSegmentStats(parsedPoints, startDist, endDist);
          
          newSegments.push({
            id: nanoid(),
            name: `Day ${i + 1}`,
            startDist,
            endDist,
            color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
            stats: segmentStats
          });
          
          prevDist = endDist;
        });

        setSegments(newSegments);
      } else {
        // Initialize with default 3 segments for single track files
        initializeSegments(parsedPoints, stats.totalDistance, 3);
      }

      // Trigger animation after a short delay
      setTimeout(() => {
        setIsLoaded(true);
      }, 100);

      toast.success("Route loaded successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to parse GPX file. Please try another one.");
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Initialize segments evenly
  const initializeSegments = (pts: TrackPoint[], totalDist: number, count: number) => {
    const segmentLength = totalDist / count;
    const newSegments: Segment[] = [];

    for (let i = 0; i < count; i++) {
      const startDist = i * segmentLength;
      const endDist = (i === count - 1) ? totalDist : (i + 1) * segmentLength;

      const stats = calculateSegmentStats(pts, startDist, endDist);

      newSegments.push({
        id: nanoid(),
        name: `Day ${i + 1}`,
        startDist,
        endDist,
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        stats
      });
    }

    setSegments(newSegments);
  };

  // Handle changing number of days
  const handleSegmentCountChange = (count: number) => {
    if (!routeStats) return;

    const currentCount = segments.length;

    // If count is the same, do nothing
    if (count === currentCount) return;

    const totalDist = routeStats.totalDistance;

    // If increasing count
    if (count > currentCount) {
      // If we haven't manually modified any segment, or if the modified segment is invalid/last,
      // redistribute everything evenly.
      if (lastModifiedSegmentIndex === null || lastModifiedSegmentIndex >= segments.length - 1) {
        initializeSegments(points, routeStats.totalDistance, count);
      } else {
        // Keep segments up to lastModifiedSegmentIndex unchanged
        const preservedSegments = segments.slice(0, lastModifiedSegmentIndex + 1);
        const startDistForNew = preservedSegments[lastModifiedSegmentIndex].endDist;
        const remainingDist = totalDist - startDistForNew;
        const segmentsToAdd = count - preservedSegments.length;

        // Safety check
        if (segmentsToAdd <= 0) {
          initializeSegments(points, routeStats.totalDistance, count);
          return;
        }

        const segmentLength = remainingDist / segmentsToAdd;
        const newSegments = [...preservedSegments];

        for (let i = 0; i < segmentsToAdd; i++) {
          const segIndex = preservedSegments.length + i;
          const start = startDistForNew + (i * segmentLength);
          const end = (i === segmentsToAdd - 1) ? totalDist : startDistForNew + ((i + 1) * segmentLength);

          const stats = calculateSegmentStats(points, start, end);

          newSegments.push({
id: nanoid(),
name: `Day ${segIndex + 1}`,
startDist: start,
endDist: end,
color: SEGMENT_COLORS[segIndex % SEGMENT_COLORS.length],
stats
});
        }

        setSegments(newSegments);
      }
    }
    // If decreasing count, merge segments from the end
    else {
      // If the modified segment index is beyond the new count or becomes the last segment (which is fixed), reset it
      if (lastModifiedSegmentIndex !== null && lastModifiedSegmentIndex >= count - 1) {
        setLastModifiedSegmentIndex(null);
      }

      const segmentsToRemove = currentCount - count;
      const newSegments = [...segments];

      // Remove the last segmentsToRemove segments by merging them into the segment before
      for (let i = 0; i < segmentsToRemove; i++) {
        if (newSegments.length <= 1) break;

        const lastSegment = newSegments[newSegments.length - 1];
        const secondLastIndex = newSegments.length - 2;

        // Extend the second-to-last segment to include the last segment
        newSegments[secondLastIndex] = {
          ...newSegments[secondLastIndex],
          endDist: lastSegment.endDist,
          stats: calculateSegmentStats(points, newSegments[secondLastIndex].startDist, lastSegment.endDist),
        };

        // Remove the last segment
        newSegments.pop();
      }

      // Reassign colors based on new indices
      const recoloredSegments = newSegments.map((seg, idx) => ({
        ...seg,
        color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
      }));

      setSegments(recoloredSegments);
    }
  };

  // Handle updating a segment (e.g. name)
  const handleSegmentUpdate = (id: string, updates: Partial<Segment>) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Handle removing a segment
  const handleSegmentRemove = (id: string) => {
    if (segments.length <= 1) {
      toast.error("Cannot remove the last segment");
      return;
    }

    const segmentIndex = segments.findIndex(s => s.id === id);
    if (segmentIndex === -1) return;

    const newSegments = [...segments];
    const removedSegment = newSegments[segmentIndex];

    // If it's not the first segment, merge with previous
    if (segmentIndex > 0) {
      newSegments[segmentIndex - 1] = {
        ...newSegments[segmentIndex - 1],
        endDist: removedSegment.endDist,
        stats: calculateSegmentStats(points, newSegments[segmentIndex - 1].startDist, removedSegment.endDist),
      };
    }
    // If it's the first segment, merge with next
    else if (segmentIndex === 0 && newSegments.length > 1) {
      newSegments[1] = {
        ...newSegments[1],
        startDist: 0,
        stats: calculateSegmentStats(points, 0, newSegments[1].endDist),
      };
    }

    // Remove the segment
    newSegments.splice(segmentIndex, 1);

    // Reassign names and colors based on new indices, so exported files and
    // embedded track names stay in sync with the "Day N" labels in the UI
    // (handleAddSegmentBoundary renumbers the same way).
    const renumberedSegments = newSegments.map((seg, idx) => ({
      ...seg,
      name: `Day ${idx + 1}`,
      color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
    }));

    setSegments(renumberedSegments);
    // Indices shifted — the remembered "last modified" boundary no longer
    // points at the same segment.
    setLastModifiedSegmentIndex(null);
    toast.success("Segment removed");
  };

    // Handle export all - with delay between downloads to avoid browser blocking
  const handleExportAll = () => {
    if (!routeStats || segments.length === 0) return;

    const files = generateGpxXml(points, segments, routeStats.name);

    files.forEach((file, index) => {
      setTimeout(() => {
        downloadFile(file.filename, file.content);
      }, index * 300); // 300ms delay between each download
    });

    toast.success(`Exporting ${files.length} files...`);
  };

  // Handle export single
  const handleExportSingle = (segment: Segment) => {
    if (!routeStats) return;

    const files = generateGpxXml(points, [segment], routeStats.name);
    if (files.length > 0) {
      downloadFile(files[0].filename, files[0].content);
      toast.success(`Exported ${segment.name}`);
    }
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(file);
    element.href = url;
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    // Release the blob once the download has been handed to the browser —
    // otherwise every export leaks a Blob for the lifetime of the page.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const handleDistributeEvenly = () => {
    if (!routeStats || segments.length === 0) return;
    
    setLastModifiedSegmentIndex(null);

    const totalDist = routeStats.totalDistance;
    const segmentLength = totalDist / segments.length;

    const redistributedSegments = segments.map((segment, index) => {
      const startDist = index * segmentLength;
      const endDist = (index === segments.length - 1) ? totalDist : (index + 1) * segmentLength;

      return {
        ...segment,
        startDist,
        endDist,
        stats: calculateSegmentStats(points, startDist, endDist),
      };
    });

    setSegments(redistributedSegments);
    toast.success("Segments distributed evenly");
  };

  const handleSegmentBoundaryChange = (segmentIndex: number, newEndDistance: number) => {
    if (!routeStats || segmentIndex >= segments.length - 1) return;

    // The boundary must stay between the previous segment's end and the next
    // segment's end. Clamp instead of rejecting: a silent reject leaves the
    // dragged Leaflet marker stranded wherever it was dropped (the segments
    // state doesn't change, so the marker's position prop never resets), and
    // the elevation divider clamps its drag to exactly [min, max], which a
    // strict-inequality reject would always no-op.
    const MIN_SEGMENT_KM = 0.05;
    const minDist = (segmentIndex > 0 ? segments[segmentIndex - 1].endDist : 0) + MIN_SEGMENT_KM;
    const maxDist = segments[segmentIndex + 1].endDist - MIN_SEGMENT_KM;
    if (minDist >= maxDist) return; // neighbors too close to fit a boundary between them

    const clampedEnd = Math.max(minDist, Math.min(maxDist, newEndDistance));

    // Update segments
    const newSegments = [...segments];

    // Update current segment's end
    newSegments[segmentIndex] = {
      ...newSegments[segmentIndex],
      endDist: clampedEnd,
      stats: calculateSegmentStats(points, newSegments[segmentIndex].startDist, clampedEnd),
    };

    // Update next segment's start
    newSegments[segmentIndex + 1] = {
      ...newSegments[segmentIndex + 1],
      startDist: clampedEnd,
      stats: calculateSegmentStats(points, clampedEnd, newSegments[segmentIndex + 1].endDist),
    };

    setSegments(newSegments);
    setLastModifiedSegmentIndex(segmentIndex);
  };

  const handleAddSegmentBoundary = (distance: number) => {
    if (!routeStats) return;

    // Find which segment this distance falls into
    const segmentIndex = segments.findIndex(s => distance > s.startDist && distance < s.endDist);
    
    if (segmentIndex === -1) {
      toast.error("Could not find segment for this location");
      return;
    }

    const originalSegment = segments[segmentIndex];
    
    // Don't split if too close to start or end (e.g. < 100m)
    if (distance - originalSegment.startDist < 0.1 || originalSegment.endDist - distance < 0.1) {
      toast.error("Too close to existing boundary");
      return;
    }

    // Create two new segments from the original one
    const firstPart: Segment = {
      id: originalSegment.id, // Keep ID for first part
      name: `Day ${segmentIndex + 1}`,
      startDist: originalSegment.startDist,
      endDist: distance,
      color: SEGMENT_COLORS[segmentIndex % SEGMENT_COLORS.length],
      stats: calculateSegmentStats(points, originalSegment.startDist, distance)
    };

    const secondPart: Segment = {
      id: nanoid(),
      name: `Day ${segmentIndex + 2}`,
      startDist: distance,
      endDist: originalSegment.endDist,
      color: SEGMENT_COLORS[(segmentIndex + 1) % SEGMENT_COLORS.length],
      stats: calculateSegmentStats(points, distance, originalSegment.endDist)
    };

    const newSegments = [...segments];
    newSegments.splice(segmentIndex, 1, firstPart, secondPart);

    // Update names and colors for subsequent segments
    for (let i = segmentIndex + 2; i < newSegments.length; i++) {
      newSegments[i] = {
        ...newSegments[i],
        name: `Day ${i + 1}`,
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length]
      };
    }

    setSegments(newSegments);
    setLastModifiedSegmentIndex(null); // Reset manual modification tracking as structure changed
    toast.success("Split added successfully");
  };

  const handleReset = () => {
    setIsLoaded(false);
    setTimeout(() => {
      setPoints([]);
      setRouteStats(null);
      setSegments([]);
      setLastModifiedSegmentIndex(null);
    }, 300);
  };

  // Initial state - centered dropzone
  if (!routeStats) {
    return (
      <div className={styles.container}>
        <div className={styles.themeSwitchCorner}>
          <ThemeModeSwitch />
        </div>
        <div className={styles.initialState}>
          <div className={styles.initialStateContent}>
            <div className={`${styles.heroIcon} ${isUploading ? styles.heroIconLoading : ''}`}>
              <div role="img" aria-label="GPX Slicer logo" className={styles.heroLogo} />
            </div>
            <h1 className={styles.heroTitle}>GPX Slicer</h1>
            <p className={styles.heroSubtitle}>Split your routes into multiple days with different length for each segment</p>
            <div className={styles.dropzoneWrapper}>
              <FileDropzone
                accept=".gpx"
                maxFiles={1}
                maxSize={50 * 1024 * 1024}
                onFilesSelected={handleFileUpload}
                title="Drop your GPX file here"
                subtitle="or click to browse"
                disabled={isUploading}
              />
            </div>

            {isUploading && (
              <div className={styles.loadingOverlay}>
                <div className={styles.loadingContent}>
                  <Spinner size="lg" />
                  <p className={styles.loadingText}>Processing your route...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loaded state - show panels with animation
  return (
    <div className={styles.container}>
      <div className={styles.appLayout}>
        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${isLoaded ? styles.sidebarVisible : ''}`}>
          <SplitterSidebar
            routeStats={routeStats}
            segments={segments}
            onFileUpload={handleFileUpload}
            onSegmentCountChange={handleSegmentCountChange}
            onSegmentUpdate={handleSegmentUpdate}
            onSegmentRemove={handleSegmentRemove}
            onExportAll={handleExportAll}
            onExportSingle={handleExportSingle}
            onReset={handleReset}
            onDistributeEvenly={handleDistributeEvenly}
          />
        </aside>

        {/* Main Content */}
        <main className={`${styles.mainContent} ${isLoaded ? styles.mainContentVisible : ''}`}>
          {/* Map */}
          <div className={styles.mapSection}>
            <SplitterMap
              points={points}
              segments={segments}
              onSegmentBoundaryChange={handleSegmentBoundaryChange}
              onAddSegmentBoundary={handleAddSegmentBoundary}
              isLoaded={isLoaded}
            />
          </div>

          {/* Elevation Profile */}
          <div className={styles.elevationSection}>
            <SplitterElevationProfile
              points={points}
              segments={segments}
              onSegmentBoundaryChange={handleSegmentBoundaryChange}
            />
          </div>
        </main>
      </div>
    </div>
  );
}