Feature: Generic features work when running Phenogrid as a standalone widget


    Scenario: Loading the phenogrid widget
        Given I go to slow page "/index.html" and wait for id "phenogrid_container1_slide_btn"
            Then the document should contain "Powered by The Monarch Initiative"


    Scenario Outline: Visible items once the widget is loaded
        Given I go to page "/index.html"
    	    Then the id "<id>" should contain "<text>"
            Examples: <id> - <text> list
            | id                                        | text                         |
            | phenogrid_container1_slide_btn            | Options                      |


    Scenario Outline: Visible items after open options panel
        Given I go to page "/index.html"
            And I click the "phenogrid_container1_slide_btn"
            Then the id "<id>" should contain "<text>"
            Examples: <id> - <text> list
            | id                                        | text                         |
            | phenogrid_container1_targetGroup          | Homo sapiens                 |
            | phenogrid_container1_targetGroup          | Mus musculus                 |
            | phenogrid_container1_targetGroup          | Danio rerio                  |
            | phenogrid_container1_sortphenotypes       | Alphabetic                   |
            | phenogrid_container1_sortphenotypes       | Frequency and Rarity         |
            | phenogrid_container1_sortphenotypes       | Frequency                    |
            | phenogrid_container1_calculation          | Similarity                   |
            | phenogrid_container1_calculation          | Ratio (q)                    |
            | phenogrid_container1_calculation          | Ratio (t)                    |
            | phenogrid_container1_calculation          | Uniqueness                   |
            | phenogrid_container1_controls_options     | Invert Axis                  |
            | phenogrid_container1_controls_options     | About Phenogrid              |


    Scenario: Model scores popup dialog
        Given I go to page "/index.html"
            And I click the "phenogrid_container1_scores_tip_icon"
            Then the document should contain "What is the score shown at the top of the grid?"

    
    Scenario: Appearance of vertical scrollbar slider
        Given I go to page "/index.html"
            Then the document should contain id "phenogrid_container1_vertical_scrollbar_slider"
            
            
    Scenario: Appearance of horizontal scrollbar slider after inverting axis
        Given I go to page "/index.html"
            And I click the "phenogrid_container1_slide_btn"
            And I click the "phenogrid_container1_axisflip"
            Then the document should contain id "phenogrid_container1_horizontal_scrollbar_slider"