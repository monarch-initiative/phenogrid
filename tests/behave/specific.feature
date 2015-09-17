Feature: Specific features work when running Phenogrid as a standalone widget


    Scenario: Loading the phenogrid widget
        Given I go to slow page "/index.html" and wait for id "mystickytooltip"
            Then the document should contain "Installation Instructions"


    Scenario Outline: Visible items once the widget is loaded
        Given I go to page "/index.html"
    	    Then the id "<id>" should contain "<text>"
            Examples: <id> - <text> list
            | id                       | text                         |
            | pg_toptitle              | Cross-Target Comparison      |
            | pg_gradient_legend_texts | Min                          |
            | pg_gradient_legend_texts | Similarity                   |
            | pg_gradient_legend_texts | Max                          |
            | pg_svg_group             | Danio rerio                  |

            
    Scenario: Sort phenotype labels by Alphabetic
        Given I go to page "/index.html"
            And I click the "pg_slide_btn"
            And I check the radio button labelled as "Alphabetic"
            Then the id "pg_grid_row_0" should contain "Abnormality of the thorax"
            
    
    Scenario: Sort phenotype labels by Frequency and Rarity
        Given I go to page "/index.html"
            And I click the "pg_slide_btn"
            And I check the radio button labelled as "Frequency and Rarity"
            Then the id "pg_grid_row_0" should contain "Hypoplasia of the maxilla"
       

