Feature: Phenogrid Works as a standalone widget

@ui
Scenario: Loading the phenogrid widget
   Given I go to page "/node_modules/phenogrid/index.html" and wait for the spinner "Loading Phenogrid Widget..."
     then the "pg_svg_container" div should contain "pg_svg_area" svg tag
	 and the document should contain "Cross-Species Comparison"

