import React, { useRef, useState } from "react";
import { useCallbackRef } from "../helpers/useCallbackRef";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { GripVertical } from "lucide-react";
import styles from "./SplitterElevationDivider.module.css";

interface SplitterElevationDividerProps {
  segmentIndex: number;
  distance: number;
  color: string;
  nextColor: string;
  minDistance: number;
  maxDistance: number;
  totalDistance: number;
  onDragEnd: (segmentIndex: number, newDistance: number) => void;
}

export const SplitterElevationDivider: React.FC<SplitterElevationDividerProps> =
  ({
    segmentIndex,
    distance,
    color,
    nextColor,
    minDistance,
    maxDistance,
    totalDistance,
    onDragEnd,
  }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragDistance, setDragDistance] = useState(distance);
    const dividerRef = useRef<HTMLDivElement>(null);

    // Calculate position as percentage relative to the track/plotting area
    const position =
      ((isDragging ? dragDistance : distance) / totalDistance) * 100;

    const handleMouseDown = useCallbackRef((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setDragDistance(distance);
    });

    const handleTouchStart = useCallbackRef((e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setDragDistance(distance);
    });

    const handleMouseMove = useCallbackRef((e: MouseEvent) => {
      if (!isDragging) return;

      // We need to find the parent container width to calculate percentage
      // The parent container is .dividersContainer in SplitterElevationProfile
      const container = dividerRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newDistance = percentage * totalDistance;

      // Constrain to valid range
      const constrainedDistance = Math.max(
        minDistance,
        Math.min(maxDistance, newDistance),
      );

      setDragDistance(constrainedDistance);
    });

    const handleTouchMove = useCallbackRef((e: TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault(); // Prevent page scrolling while dragging

      // We need to find the parent container width to calculate percentage
      // The parent container is .dividersContainer in SplitterElevationProfile
      const container = dividerRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newDistance = percentage * totalDistance;

      // Constrain to valid range
      const constrainedDistance = Math.max(
        minDistance,
        Math.min(maxDistance, newDistance),
      );

      setDragDistance(constrainedDistance);
    });

    const handleMouseUp = useCallbackRef(() => {
      if (!isDragging) return;
      setIsDragging(false);

      // Only call onDragEnd if the distance actually changed
      if (Math.abs(dragDistance - distance) > 0.01) {
        onDragEnd(segmentIndex, dragDistance);
      }
    });

    const handleTouchEnd = useCallbackRef(() => {
      if (!isDragging) return;
      setIsDragging(false);

      // Only call onDragEnd if the distance actually changed
      if (Math.abs(dragDistance - distance) > 0.01) {
        onDragEnd(segmentIndex, dragDistance);
      }
    });

    React.useEffect(() => {
      if (isDragging) {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("touchmove", handleTouchMove);
        document.addEventListener("touchend", handleTouchEnd);
        return () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          document.removeEventListener("touchmove", handleTouchMove);
          document.removeEventListener("touchend", handleTouchEnd);
        };
      }
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    return (
      <div
        ref={dividerRef}
        className={`${styles.divider} ${isDragging ? styles.dragging : ""}`}
        style={{
          left: `${position}%`,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <Tooltip open={isDragging ? true : undefined}>
          <TooltipTrigger asChild>
            <div className={styles.hitArea}>
              <div className={styles.line} />
              <div
                className={styles.handle}
                style={{
                  background: color,
                }}
              >
                <GripVertical size={16} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="text-center">
              <div className="font-bold mb-1">
                Split Day {segmentIndex + 1} / {segmentIndex + 2}
              </div>
                                          <div>
                Day {segmentIndex + 1}:{" "}
                {isDragging
                  ? `${(dragDistance - minDistance).toFixed(1)} km`
                  : `${(distance - minDistance).toFixed(1)} km`}
              </div>
              {isDragging && (
                <div className="text-xs text-muted-foreground mt-1">
                  Release to apply
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  };