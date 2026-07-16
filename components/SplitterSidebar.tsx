import React, { useEffect, useState, useRef } from "react";
import { FileDropzone } from "./FileDropzone";
import { Button } from "./Button";
import { Input } from "./Input";
import { Slider } from "./Slider";
import { Separator } from "./Separator";
import { Download, ArrowUpRight, ArrowDownRight, Trash2, Minus, Plus, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { RouteStats, Segment, SEGMENT_COLORS } from "../helpers/gpxUtils";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import styles from "./SplitterSidebar.module.css";

interface SplitterSidebarProps {
  routeStats: RouteStats | null;
  segments: Segment[];
  onFileUpload: (files: File[]) => void;
  onSegmentCountChange: (count: number) => void;
  onSegmentUpdate: (id: string, updates: Partial<Segment>) => void;
  onSegmentRemove: (id: string) => void;
  onExportAll: () => void;
  onExportSingle: (segment: Segment) => void;
  onReset: () => void;
  onDistributeEvenly: () => void;
}

export const SplitterSidebar: React.FC<SplitterSidebarProps> = ({
  routeStats,
  segments,
  onFileUpload,
  onSegmentCountChange,
  onSegmentUpdate,
  onSegmentRemove,
  onExportAll,
  onExportSingle,
  onReset,
  onDistributeEvenly,
}) => {
  const [dayCount, setDayCount] = useState<number>(3);
  const [exitingSegments, setExitingSegments] = useState<Set<string>>(new Set());
  const [collapsingSegments, setCollapsingSegments] = useState<Set<string>>(new Set());
  const [enteringSegments, setEnteringSegments] = useState<Set<string>>(new Set());
  const [updatingSegments, setUpdatingSegments] = useState<Set<string>>(new Set());
  const previousSegmentsRef = useRef<string[]>([]);
  const previousCountRef = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);
  // Latest day count already scheduled by a pending minus-click animation, so
  // rapid clicks chain decrements instead of all reading the same stale state.
  const pendingDayCountRef = useRef<number | null>(null);
  const previousSegmentDataRef = useRef<Map<string, { distance: number; elevationGain: number; elevationLoss: number; color: string }>>(new Map());

  useEffect(() => {
    if (segments.length > 0) {
      setDayCount(segments.length);
    }
  }, [segments.length]);

  // Track specifically which segment was just added (only the last one)
  useEffect(() => {
    const currentIds = segments.map(s => s.id);
    const previousIds = previousSegmentsRef.current;
    const previousCount = previousCountRef.current;
    
    // Initialize on first meaningful render (when segments exist)
    if (!hasInitializedRef.current && segments.length > 0) {
      hasInitializedRef.current = true;
      previousSegmentsRef.current = currentIds;
      previousCountRef.current = segments.length;
      return;
    }
    
    // Reset initialization flag when segments are cleared
    if (segments.length === 0) {
      hasInitializedRef.current = false;
      previousSegmentsRef.current = [];
      previousCountRef.current = 0;
      return;
    }
    
    let timer: NodeJS.Timeout | undefined;
    
    // Only animate if:
    // 1. We've initialized (not the first load)
    // 2. Count increased by exactly 1
    // 3. There's exactly one new segment ID
    if (
      hasInitializedRef.current &&
      segments.length === previousCount + 1
    ) {
      const newSegmentIds = currentIds.filter(id => !previousIds.includes(id));
      
      if (newSegmentIds.length === 1) {
        setEnteringSegments(new Set([newSegmentIds[0]]));
        
        // Remove from entering set after animation completes
        timer = setTimeout(() => {
          setEnteringSegments(new Set());
        }, 300);
      }
    }
    
    // Always update refs at the end
    previousSegmentsRef.current = currentIds;
    previousCountRef.current = segments.length;
    
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [segments]);

  // Track data changes in existing segments (for fade transitions)
  useEffect(() => {
    const currentData = new Map(
      segments.map(s => [
        s.id,
        {
          distance: s.stats.distance,
          elevationGain: s.stats.elevationGain,
          elevationLoss: s.stats.elevationLoss,
          color: s.color,
        },
      ])
    );

    const changedSegmentIds = new Set<string>();
    
    segments.forEach(segment => {
      const prevData = previousSegmentDataRef.current.get(segment.id);
      const currData = currentData.get(segment.id);
      
      if (prevData && currData) {
        // Check if any data has changed
        if (
          Math.abs(prevData.distance - currData.distance) > 0.01 ||
          Math.abs(prevData.elevationGain - currData.elevationGain) > 0.5 ||
          Math.abs(prevData.elevationLoss - currData.elevationLoss) > 0.5 ||
          prevData.color !== currData.color
        ) {
          changedSegmentIds.add(segment.id);
        }
      }
    });

    if (changedSegmentIds.size > 0) {
      setUpdatingSegments(changedSegmentIds);
      
      const timer = setTimeout(() => {
        setUpdatingSegments(new Set());
      }, 200);
      
      previousSegmentDataRef.current = currentData;
      return () => clearTimeout(timer);
    }
    
    previousSegmentDataRef.current = currentData;
  }, [segments]);

  const handleDayCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0 && val <= 20) {
      setDayCount(val);
      onSegmentCountChange(val);
    }
  };

  const handleMinusButtonClick = () => {
    // Base the decrement on any count already scheduled by a previous click's
    // 300ms animation — otherwise rapid clicks all capture the same stale
    // dayCount and only one decrement survives.
    const baseCount = pendingDayCountRef.current ?? dayCount;
    if (baseCount <= 1 || segments.length === 0) return;
    const newCount = baseCount - 1;
    pendingDayCountRef.current = newCount;

    // Get the last segment
    const lastSegment = segments[segments.length - 1];

    // Phase 1: Slide out animation (150ms)
    setExitingSegments(prev => new Set(prev).add(lastSegment.id));

    // Phase 2: Start collapse animation after 100ms (overlapping with slide-out)
    setTimeout(() => {
      setCollapsingSegments(prev => new Set(prev).add(lastSegment.id));
    }, 100);

    // After both animations complete, decrease the count (150ms slide + 150ms collapse)
    setTimeout(() => {
      // Apply only if this is still the latest scheduled count — a later
      // minus click superseded this one, or a plus click cancelled it.
      if (pendingDayCountRef.current === newCount) {
        pendingDayCountRef.current = null;
        setDayCount(newCount);
        onSegmentCountChange(newCount);
      }

      setExitingSegments(prev => {
        const next = new Set(prev);
        next.delete(lastSegment.id);
        return next;
      });
      setCollapsingSegments(prev => {
        const next = new Set(prev);
        next.delete(lastSegment.id);
        return next;
      });
    }, 300);
  };

  const handleSegmentRemove = (segmentId: string) => {
    // Phase 1: Slide out animation (150ms)
    setExitingSegments(prev => new Set(prev).add(segmentId));
    
    // Phase 2: Start collapse animation after 100ms (overlapping with slide-out)
    setTimeout(() => {
      setCollapsingSegments(prev => new Set(prev).add(segmentId));
    }, 100);
    
    // After both animations complete, actually remove the segment (150ms slide + 150ms collapse)
    setTimeout(() => {
      onSegmentRemove(segmentId);
      setExitingSegments(prev => {
        const next = new Set(prev);
        next.delete(segmentId);
        return next;
      });
      setCollapsingSegments(prev => {
        const next = new Set(prev);
        next.delete(segmentId);
        return next;
      });
    }, 300);
  };

  if (!routeStats) {
    return (
      <div className={styles.sidebarEmpty}>
        <div className={styles.uploadContainer}>
          <h2 className={styles.sidebarTitle}>Upload Route</h2>
          <p className={styles.sidebarSubtitle}>Start by uploading a GPX file to split.</p>
          <FileDropzone
            accept=".gpx"
            maxFiles={1}
            onFilesSelected={onFileUpload}
            title="Drop GPX file here"
            subtitle="or click to browse"
            className={styles.dropzone}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h2 className={styles.routeTitle} title={routeStats.name}>
            {routeStats.name}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onReset} title="Reset">
            <Trash2 size={16} />
          </Button>
        </div>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span>{routeStats.totalDistance.toFixed(1)} km</span>
          </div>
          <div className={styles.statItem}>
            <ArrowUpRight size={14} />
            <span>{Math.round(routeStats.totalElevation)} m</span>
          </div>
          <div className={styles.statItem}>
            <ArrowDownRight size={14} />
            <span>{Math.round(routeStats.totalElevationLoss)} m</span>
          </div>
        </div>
            </div>

      <div className={styles.controls}>
        <div className={styles.controlsHeader}>
          <label className={styles.label}>Number of Days</label>
        </div>
        <div className={styles.dayInputWrapper}>
          <Button
            variant="ghost"
            size="icon-md"
            className={`${styles.dayBtn} ${styles.dayBtnLeft}`}
            onClick={handleMinusButtonClick}
            disabled={dayCount <= 1}
          >
            <Minus size={14} />
          </Button>
          <Input
            type="number"
            min={1}
            max={20}
            value={dayCount}
            onChange={handleDayCountChange}
            className={styles.dayInput}
          />
          <Button
            variant="ghost"
            size="icon-md"
            className={`${styles.dayBtn} ${styles.dayBtnRight}`}
            onClick={() => {
              const baseCount = pendingDayCountRef.current ?? dayCount;
              if (baseCount < 20) {
                const newCount = baseCount + 1;
                pendingDayCountRef.current = null;
                setDayCount(newCount);
                onSegmentCountChange(newCount);
              }
            }}
            disabled={dayCount >= 20}
          >
            <Plus size={14} />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDistributeEvenly}
          disabled={segments.length <= 1}
          className={styles.distributeBtn}
        >
          Make distances even
        </Button>
      </div>

      <div className={styles.segmentsList}>
        <div className={styles.segmentCards}>
          {segments.map((segment, index) => {
            const isExiting = exitingSegments.has(segment.id);
            const isCollapsing = collapsingSegments.has(segment.id);
            const isEntering = enteringSegments.has(segment.id);
            const isUpdating = updatingSegments.has(segment.id);
            
            const wrapperClasses = [
              styles.segmentCardWrapper,
              isCollapsing && styles.segmentCardWrapperCollapse,
            ].filter(Boolean).join(' ');
            
            const cardClasses = [
              styles.segmentCard,
              isExiting && styles.segmentCardExit,
              isEntering && styles.segmentCardEnter,
            ].filter(Boolean).join(' ');
            
            const contentClasses = [
              styles.segmentCardContent,
              isUpdating && styles.segmentCardContentUpdating,
            ].filter(Boolean).join(' ');
            
            return (
            <div key={segment.id} className={wrapperClasses}>
              <div className={cardClasses}>
                <div className={styles.segmentColorIndicator} style={{ backgroundColor: segment.color }} />
                <div className={contentClasses}>
                <div className={styles.segmentCardHeader}>
                  <span className={styles.segmentTitle}>Day {index + 1}</span>
                  <div className={styles.segmentActions}>
<Tooltip>
<TooltipTrigger asChild>
<Button
variant="ghost"
size="icon-sm"
onClick={() => onExportSingle(segment)}
>
<Download size={14} />
</Button>
</TooltipTrigger>
<TooltipContent>Download segment</TooltipContent>
</Tooltip>
{segments.length > 1 && (
<Tooltip>
<TooltipTrigger asChild>
<Button
variant="ghost"
size="icon-sm"
onClick={() => handleSegmentRemove(segment.id)}
>
<X size={14} />
</Button>
</TooltipTrigger>
<TooltipContent>Remove segment</TooltipContent>
</Tooltip>
)}
</div>
                </div>
                <div className={styles.segmentStats}>
                  <span className={styles.segmentStat}>
                    {segment.stats.distance.toFixed(1)} km
                  </span>
                  <span className={styles.segmentStat}>
                    <ArrowUpRight size={12} />
                    {Math.round(segment.stats.elevationGain)} m
                  </span>
                  <span className={styles.segmentStat}>
                    <ArrowDownRight size={12} />
                    {Math.round(segment.stats.elevationLoss)} m
                  </span>
                </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      <div className={styles.footer}>
        <Button className={styles.exportAllBtn} onClick={onExportAll}>
          <Download size={16} /> Download All Segments
        </Button>
      </div>
    </div>
  );
};