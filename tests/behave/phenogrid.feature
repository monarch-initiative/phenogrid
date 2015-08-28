Feature: Phenogrid works as a standalone widget

@ui
Scenario: Loading the phenogrid widget
    Given I go to slow page "/index.html" and wait for id "pg_svg_container"
         Then the document should contain "Loading Phenogrid Widget..."

@ui
Scenario Outline: Visible items once the widget is loaded
    Given I go to page "/index.html"
	    Then the id "<id>" should contain "<text>"
        Examples: <id> - <text> list
        | id                       | text                     |
        | pg_toptitle              | Cross-Species Comparison |
        | pg_grid_row_0            | Macrocytic anemia        |
        | pg_grid_row_1            | Bradykinesia             |
        | pg_grid_col_0            | Trp63                    |
        | pg_grid_col_1            | Sfn                      |
        | pg_slide_btn             | OPTIONS                  |
        | pg_gradient_legend_texts | Similarity               |
        | pg_svg_area              | Danio rerio              |


@ui
Scenario Outline: Visible items after clicking options panel
    Given I go to page "/index.html"
        And I click the "pg_slide_btn"
        Then the id "<id>" should contain "<text>"
        Examples: <id> - <text> list
        | id                       | text                     |
        | pg_organism              | Homo sapiens             |
        | pg_sortphenotypes        | Frequency and Rarity     |
        | pg_calculation           | Ratio (q)                |
        | pg_controls_options      | Invert Axis              |
        | pg_controls_options      | About Phenogrid          |