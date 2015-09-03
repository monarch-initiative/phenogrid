Feature: Specific features work when running Phenogrid as a standalone widget


    Scenario: Loading the phenogrid widget
        Given I go to slow page "/index.html" and wait for id "pg_navigator"
            Then the document should contain "Cross-TargetGroup Comparison"


    Scenario Outline: Visible items once the widget is loaded
        Given I go to page "/index.html"
    	    Then the id "<id>" should contain "<text>"
            Examples: <id> - <text> list
            | id                       | text                         |
            | pg_toptitle              | Cross-TargetGroup Comparison |
            | pg_grid_row_0            | Macrocytic anemia            |
            | pg_grid_row_1            | Bradykinesia                 |
            | pg_grid_col_10           | Trp63                        |
            | pg_grid_col_11           | Sfn                          |
            | pg_slide_btn             | OPTIONS                      |
            | pg_gradient_legend_texts | Similarity                   |
            | pg_svg_area              | Danio rerio                  |


    Scenario: Inver Axis
        Given I go to page "/index.html"
            And I click the "pg_slide_btn"
            And I click the "pg_axisflip"
            Then the id "pg_grid_row_10" should contain "Trp63"


    Scenario: Check default target label text link
        Given I go to page "/index.html"
            And I move mouse to the "pg_grid_col_10"
            Then the document should contain link with "Trp63"
