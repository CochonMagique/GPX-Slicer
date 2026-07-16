import { describe, it, expect } from "vitest";
import {
  parseGpxFile,
  calculateSegmentStats,
  generateGpxXml,
  sliceByDistance,
  type TrackPoint,
  type Segment,
} from "./gpxUtils";

const gpxFile = (body: string, name = "test.gpx") =>
  new File(
    [
      `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`,
    ],
    name,
    { type: "application/gpx+xml" },
  );

// ~1.1km apart per 0.01 deg of latitude
const trkpt = (lat: number, lon: number, ele?: number) =>
  `<trkpt lat="${lat}" lon="${lon}">${ele !== undefined ? `<ele>${ele}</ele>` : ""}</trkpt>`;

const mkPoint = (dist: number, ele = 100): TrackPoint => ({ lat: 45, lon: 6, ele, dist });

const mkSegment = (name: string, startDist: number, endDist: number): Segment => ({
  id: name,
  name,
  startDist,
  endDist,
  color: "#000",
  stats: { distance: endDist - startDist, elevationGain: 0, elevationLoss: 0 },
});

describe("parseGpxFile", () => {
  it("parses a simple track and accumulates distance", async () => {
    const file = gpxFile(
      `<trk><name>Test Route</name><trkseg>${trkpt(45.0, 6.0, 100)}${trkpt(45.01, 6.0, 150)}${trkpt(45.02, 6.0, 120)}</trkseg></trk>`,
    );
    const { points, stats } = await parseGpxFile(file);
    expect(points).toHaveLength(3);
    expect(stats.name).toBe("Test Route");
    expect(stats.totalDistance).toBeGreaterThan(2);
    expect(stats.totalDistance).toBeLessThan(2.5);
    expect(stats.totalElevation).toBe(50);
    expect(stats.totalElevationLoss).toBe(30);
  });

  it("skips malformed trkpts instead of poisoning distances with NaN", async () => {
    const file = gpxFile(
      `<trk><trkseg>${trkpt(45.0, 6.0, 100)}<trkpt lon="6.0"><ele>110</ele></trkpt>${trkpt(45.01, 6.0, 120)}</trkseg></trk>`,
    );
    const { points, stats } = await parseGpxFile(file);
    expect(points).toHaveLength(2);
    expect(Number.isFinite(stats.totalDistance)).toBe(true);
    expect(points.every((p) => Number.isFinite(p.dist))).toBe(true);
  });

  it("seeds missing leading elevations from the first real elevation (no fake climb)", async () => {
    const file = gpxFile(
      `<trk><trkseg>${trkpt(45.0, 6.0)}${trkpt(45.01, 6.0)}${trkpt(45.02, 6.0, 1000)}${trkpt(45.03, 6.0, 1010)}</trkseg></trk>`,
    );
    const { stats } = await parseGpxFile(file);
    // Without seeding, the jump 0 -> 1000 would fabricate 1000m of gain.
    expect(stats.totalElevation).toBe(10);
  });

  it("decodes XML entities in track names exactly once", async () => {
    const file = gpxFile(
      `<trk><name>Ben &amp; Jerry &lt;3</name><trkseg>${trkpt(45.0, 6.0, 1)}${trkpt(45.01, 6.0, 1)}</trkseg></trk>`,
    );
    const { stats } = await parseGpxFile(file);
    expect(stats.name).toBe("Ben & Jerry <3");
  });

  it("rejects malformed XML", async () => {
    await expect(
      parseGpxFile(new File(["<gpx><trk>broken"], "x.gpx")),
    ).rejects.toThrow();
  });

  it("rejects files with no track", async () => {
    await expect(parseGpxFile(gpxFile("<wpt lat=\"1\" lon=\"1\"></wpt>"))).rejects.toThrow();
  });
});

describe("sliceByDistance", () => {
  const points = [0, 1, 2, 3, 4, 5].map((d) => mkPoint(d));

  it("returns the inclusive range", () => {
    expect(sliceByDistance(points, 1, 3).map((p) => p.dist)).toEqual([1, 2, 3]);
  });

  it("matches the equivalent filter for fractional bounds", () => {
    expect(sliceByDistance(points, 1.5, 4.5).map((p) => p.dist)).toEqual([2, 3, 4]);
  });

  it("handles empty and out-of-range inputs", () => {
    expect(sliceByDistance([], 0, 10)).toEqual([]);
    expect(sliceByDistance(points, 7, 9)).toEqual([]);
    expect(sliceByDistance(points, 3, 1)).toEqual([]);
  });
});

describe("calculateSegmentStats", () => {
  it("computes gain/loss within the segment only", () => {
    const points = [
      mkPoint(0, 100),
      mkPoint(1, 200),
      mkPoint(2, 150),
      mkPoint(3, 300),
    ];
    const stats = calculateSegmentStats(points, 0, 2);
    expect(stats.elevationGain).toBe(100);
    expect(stats.elevationLoss).toBe(50);
    expect(stats.distance).toBe(2);
  });
});

describe("generateGpxXml", () => {
  const points = [mkPoint(0), mkPoint(1), mkPoint(2)];

  it("escapes XML-special characters in names", () => {
    const files = generateGpxXml(points, [mkSegment('Day 1 & <2> "quoted"', 0, 2)], "route");
    expect(files).toHaveLength(1);
    expect(files[0].content).toContain("<name>Day 1 &amp; &lt;2&gt; &quot;quoted&quot;</name>");
    // The result must be well-formed XML.
    const doc = new DOMParser().parseFromString(files[0].content, "text/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelector("trk > name")?.textContent).toBe('Day 1 & <2> "quoted"');
  });

  it("sanitizes filenames of characters that break downloads", () => {
    const files = generateGpxXml(points, [mkSegment("Day 1/2: test?", 0, 2)], "a\\b|c");
    expect(files[0].filename).toBe("Day 1-2- test- - a-b-c.gpx");
  });

  it("exports one file per non-empty segment", () => {
    const files = generateGpxXml(
      points,
      [mkSegment("Day 1", 0, 1), mkSegment("Day 2", 1, 2), mkSegment("Empty", 5, 6)],
      "route",
    );
    expect(files.map((f) => f.filename)).toEqual(["Day 1 - route.gpx", "Day 2 - route.gpx"]);
  });
});
