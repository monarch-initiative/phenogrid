Feature: Phenogrid works as a standalone widget

@ui
Scenario: Loading the phenogrid widget
   Given I go to slow page "/index.html" and wait for id "pg_svg_container"
     then the document should contain "Loading Phenogrid Widget..."

@ui
Scenario: Once the widget is loaded
   Given I go to page "/index.html"
     then the id "pg_toptitle" should contain "Cross-Species Comparison"
	 and the class "pg_species_name" should contain "Mus musculus"
	 
@ui
Scenario: Check source labels
    Given I go to slow page "/index.html" and wait for id "pg_svg_area"
     then the id "pg_grid_row_0" should contain "Macrocytic anemia"
	 and the id "pg_grid_row_1" should contain "Bradykinesia"

@ui
Scenario: Check target labels
    Given I go to slow page "/index.html" and wait for id "pg_svg_area"
     then the id "pg_grid_col_0" should contain "Trp63"
	 and the id "pg_grid_col_1" should contain "Sfn"
