Feature: Generic features work when running Phenogrid as a standalone widget


    Scenario: Loading the phenogrid widget
        Given I go to slow page "/index.html" and wait for id "pg_slide_btn"
            Then the document should contain "About Phenogrid"


    Scenario Outline: Visible items once the widget is loaded
        Given I go to page "/index.html"
    	    Then the id "<id>" should contain "<text>"
            Examples: <id> - <text> list
            | id                       | text                         |
            | pg_slide_btn             | OPTIONS                      |


    Scenario Outline: Visible items after open options panel
        Given I go to page "/index.html"
            And I click the "pg_slide_btn"
            Then the id "<id>" should contain "<text>"
            Examples: <id> - <text> list
            | id                       | text                         |
            | pg_organism              | Homo sapiens                 |
            | pg_organism              | Mus musculus                 |
            | pg_organism              | Danio rerio                  |
            | pg_sortphenotypes        | Alphabetic                   |
            | pg_sortphenotypes        | Frequency and Rarity         |
            | pg_sortphenotypes        | Frequency                    |
            | pg_calculation           | Similarity                   |
            | pg_calculation           | Ratio (q)                    |
            | pg_calculation           | Ratio (t)                    |
            | pg_calculation           | Uniqueness                   |
            | pg_controls_options      | Invert Axis                  |
            | pg_controls_options      | About Phenogrid              |


    Scenario: Model scores popup dialog
        Given I go to page "/index.html"
            And I click the "pg_scores_tip_icon"
            Then the document should contain "What is the score shown at the top of the grid?"
