GPX Route Splitter

I would like to create a web app to split GPX files with different length for each segment.

Core Functionality:
Create a web app that allows cyclists to split long-distance GPX routes into multi-day segments with visual, interactive controls.
Key Features:
	* GPX Import Options:
		+ Manual GPX file upload
		+ Komoot integration 
		+ Display list of synced routes with basic info 
	* Segment Creation Interface:
		+ Input field: Number of days/segments 
		+ Display total route stats: distance, elevation gain, estimated time
	* Interactive Map View:
		+ Show full route on map with segment markers/dividers
		+ Each segment shown in different color
		+ Draggable waypoint markers at segment boundaries
		+ Distance shown for each segment
	* Elevation Profile View:
		+ Horizontal elevation chart showing entire route
		+ Vertical divider lines showing segment boundaries
		+ Draggable cursors/sliders on dividers to adjust segment lengths
		+ Display elevation gain/loss per segment
	* Segment Adjustment Controls:
		+ Slider for each segment to adjust length in kilometers
		+ Input fields for precise kilometer entry
		+ Constraints: adjusting one segment affects adjacent segments
	* Display for Each Segment:
		+ Day number
		+ Distance 
		+ Elevation gain 
		+ Elevation loss 
		+ Starting point coordinates/location name
		+ Ending point coordinates/location name
	* Export Functionality:
		+ Auto-naming: Segments automatically named as “{{original_tour_name}} Day 1”, “{{original_tour_name}} Day 2”, etc.
		+ Export options:
		+ Download all segments as separate GPX files 
		+ Download individual segment GPX files
		+ Sync back to Komoot 
		+ Editable segment names before export 
		+ Preview of what will be exported/synced
Optional Features:
	* Save/load segment configurations
	* Suggest optimal overnight stops 
	* Calculate difficulty score per segment
	* Dark mode toggle
Design Style:
	* Clean, minimal interface
	* Focus on map and elevation profile as primary views
	* Grainy photo aesthetic for any background imagery
	* Hand-drawn style icons if possible
	* Earthy, cycling-friendly color palette