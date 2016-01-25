Feature: Specific features work when running Phenogrid as a standalone widget


    Scenario Outline: Visible items once the widget is loaded
        Given I go to page "/index.html"
    	    Then the id "<id>" should contain "<text>"
            Examples: <id> - <text> list
            | id                                        | text                            |
            | phenogrid_container_toptitle              | Phenotype Similarity Comparison |
            | phenogrid_container_gradient_legend_texts | Min                             |
            | phenogrid_container_gradient_legend_texts | Similarity                      |
            | phenogrid_container_gradient_legend_texts | Max                             |
            | phenogrid_container_svg_group             | Danio rerio                     |

            
    Scenario: Sort phenotype labels by Alphabetic
        Given I go to page "/index.html"
            And I click the "phenogrid_container_slide_btn"
            And I check the radio button labelled as "Alphabetic"
            Then the id "phenogrid_container_grid_row_0" should contain "Abnormality of the thorax"
            
    
    Scenario: Sort phenotype labels by Frequency and Rarity
        Given I go to page "/index.html"
            And I click the "phenogrid_container_slide_btn"
            And I check the radio button labelled as "Frequency and Rarity"
            Then the id "phenogrid_container_grid_row_0" should contain "Hypoplasia of the maxilla"
       

