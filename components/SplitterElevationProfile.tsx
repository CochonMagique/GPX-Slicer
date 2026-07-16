import React, { useMemo, useState, useRef, useCallback } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  TooltipProps,
} from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { TrackPoint, Segment } from "../helpers/gpxUtils";
import { SplitterElevationDivider } from "./SplitterElevationDivider";
import styles from "./SplitterElevationProfile.module.css";

// Constants for chart layout to ensure alignment between Recharts and our overlays
const Y_AXIS_WIDTH = 40;
const CHART_MARGINS = { top: 10, right: 10, left: 0, bottom: 0 };

interface SplitterElevationProfileProps {
  points: TrackPoint[];
  segments: Segment[];
  onSegmentBoundaryChange?: (segmentIndex: number, newDistance: number) => void;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>{`Distance: ${Number(label).toFixed(
          1
        )} km`}</p>
        <p className={styles.tooltipValue}>{`Elevation: ${Math.round(
          payload[0].value as number
        )} m`}</p>
      </div>
    );
  }
  return null;
};

export const SplitterElevationProfile: React.FC<SplitterElevationProfileProps> =
  ({ points, segments, onSegmentBoundaryChange }) => {
    const [chartDimensions, setChartDimensions] = useState({
      width: 0,
      height: 0,
    });
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    const chartContainerRef = useCallback((node: HTMLDivElement | null) => {
      // Clean up previous observer
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      if (node) {
        // Read initial dimensions
        const rect = node.getBoundingClientRect();
        setChartDimensions({ width: rect.width, height: rect.height });

        // Set up observer for future changes
        resizeObserverRef.current = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            setChartDimensions({ width, height });
          }
        });
        resizeObserverRef.current.observe(node);
      }
    }, []);

    // Downsample points for performance if needed
    const chartData = useMemo(() => {
      const samplingRate = Math.max(1, Math.floor(points.length / 2000));
      return points
        .filter((_, i) => i % samplingRate === 0)
        .map((p) => ({
          dist: p.dist,
          ele: p.ele,
        }));
    }, [points]);

    const totalDistance = useMemo(() => {
      return points.length > 0 ? points[points.length - 1].dist : 0;
    }, [points]);

    if (points.length === 0) {
      return (
        <div className={styles.emptyProfile}>
          <p>Elevation profile will appear here</p>
        </div>
      );
    }

    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Elevation Profile</h3>
        <div className={styles.chartWrapper} ref={chartContainerRef}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={CHART_MARGINS}>
              <defs>
                <linearGradient id="colorEle" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--primary)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--primary)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
                            <XAxis
                dataKey="dist"
                type="number"
                unit=" km"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                domain={[0, "dataMax"]}
              />
              <YAxis
                unit=" m"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={Y_AXIS_WIDTH}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="ele"
                stroke="var(--primary)"
                fillOpacity={1}
                fill="url(#colorEle)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Draggable dividers overlay */}
{onSegmentBoundaryChange && chartDimensions.width > 0 && (
<div
              className={styles.dividersContainer}
              style={{
                left: Y_AXIS_WIDTH + CHART_MARGINS.left,
                top: CHART_MARGINS.top,
                width:
                  chartDimensions.width -
                  Y_AXIS_WIDTH -
                  CHART_MARGINS.left -
                  CHART_MARGINS.right,
                height:
                  chartDimensions.height -
                  CHART_MARGINS.top -
                  CHART_MARGINS.bottom,
              }}
            >
              {segments.slice(0, -1).map((segment, index) => {
                const minDist = index > 0 ? segments[index - 1].endDist : 0;
                const maxDist = segments[index + 1].endDist;

                return (
                  <SplitterElevationDivider
                    key={segment.id}
                    segmentIndex={index}
                    distance={segment.endDist}
                    color={segment.color}
                    nextColor={segments[index + 1].color}
                    minDistance={minDist}
                    maxDistance={maxDist}
                    totalDistance={totalDistance}
                    onDragEnd={onSegmentBoundaryChange}
                  />
                );
              })}
                            </div>
          )}
        </div>
      </div>
    );
  };