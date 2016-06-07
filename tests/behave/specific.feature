Feature: Specific features work when running Phenogrid as a standalone widget


    Scenario Outline: Visible items once the widget is loaded
        Given I go to page "/index.html"
    	    Then the id "<id>" should contain "<text>"
            Examples: <id> - <text> list
            | id                                         | text                                                                     |
            | phenogrid_container1_toptitle              | Human, Mouse and Fish models compared to Pfeiffer Syndrome (OMIM:101600) |
            | phenogrid_container1_gradient_legend_texts | Min                                                                      |
            | phenogrid_container1_gradient_legend_texts | Similarity                                                               |
            | phenogrid_container1_gradient_legend_texts | Max                                                                      |
            | phenogrid_container1_svg_group             | Danio rerio                                                              |

            
    Scenario: Sort phenotype labels by Alphabetic
        Given I go to page "/index.html"
            And I click the "phenogrid_container1_slide_btn"
            And I check the radio button labelled as "Alphabetic"
            Then the id "phenogrid_container1_grid_row_0" should contain "Abnormality of the hip bone"
            
    
    Scenario: Sort phenotype labels by Frequency and Rarity
        Given I go to page "/index.html"
            And I click the "phenogrid_container1_slide_btn"
            And I check the radio button labelled as "Frequency and Rarity"
            Then the id "phenogrid_container1_grid_row_0" should contain "Coronal craniosynostosis"
       

