(function () {
'use strict';

/*
 * Phenogrid
 *
 * Phenogrid is implemented as a jQuery UI widget. The phenogrid widget uses semantic similarity calculations provided
 * by OWLSim (www.owlsim.org),  as provided through APIs from the Monarch Initiative (www.monarchinitiative.org).
 *
 * Phenogrid widget can be instantiated on a jquery-enabled web page with a call of the form
 *
 * window.onload = function() {
 *     Phenogrid.createPhenogridForElement(document.getElementById('phenogrid_container'), {
 *         serverURL : "http://monarchinitiative.org",
 *         phenotypeData: phenotypes,
 *     });
 * }
 *
 * 'phenogrid_container' is the id of the div that will contain the phenogrid widget
 *	phenotypes is a Javascript array of objects listing the phenotypes to be rendered in the widget, it takes one of two forms:
 *
 *	1. A list of hashes
 *		[{"id": "HP:12345", "observed":"positive"}, {"id: "HP:23451", "observed": "negative"}, ...]
 *	2. A list of phenotype ids
 *		["HP:12345", "HP:23451"]
 *
 *	Given an input list of phenotypes and parameters indicating
 *	desired source of matching models (humans, model organisms, etc.),
 *	the phenogrid will call the Monarch API to get OWLSim results
 *	consisting of arrays of the items of the following form:
 *	{
 *		"id":"HP_0000716_MP_0001413_MGI_006446",
 *		"label_a":"Depression",
 *		"id_a":"HP:0000716",
 *		"subsumer_label":"Abnormal emotion/affect behavior",
 *		"subsumer_id":"HP:0100851",
 *		"value":5.667960271407814,
 *		"label_b":"abnormal response to new environment",
 *		"id_b":"MP:0001413",
 *		"model_id":"MGI_006446",
 *		"model_label":"B10.Cg-H2<sup>h4</sup>Sh3pxd2b<sup>nee</sup>/GrsrJ",
 *	},
 *
 *	These results will then be rendered in the phenogrid
 */


// Will need to install jquery, jquery-ui, d3, jshashtable first via npm - Joe
// Note: jquery 2.1.0 is capable of using browserify's module.exports - Joe
// npm install jquery jquery-ui d3 filesaver

// NPM installed packages, you will find them in /node_modules - Joe

// jquery  is commonsJS compliant as of 2.1.0 - Joe

require('jquery'); //  Browserify encapsulates every module into its own scope - Joe
require('jquery-ui');
var d3 = require('d3');
var filesaver = require('filesaver.js');

// load other non-npm dependencies - Joe
// need to specify the relative path ./ and .js extension
var AxisGroup = require('./axisgroup.js');
var DataLoader = require('./dataloader.js');
var DataManager = require('./datamanager.js');
var Utils = require('./utils.js');

// html content to be used for popup dialogues
var htmlnotes = require('./htmlnotes.json');

// images in data uri format, only monarch logo so far
var images = require('./images.json');

(function(factory) {
	// If there is a variable named module and it has an exports property,
	// then we're working in a Node-like environment. Use require to load
	// the jQuery object that the module system is using and pass it in.
	// Otherwise, we're working in a browser, so just pass in the global jQuery object.
	if (typeof module === "object" && typeof module.exports === "object") {
		module.exports = factory(require("jquery"), window, document);
	} else {
		factory($, window, document);
	}
})

(function($, window, document, __undefined__) {
	var createPhenogridForElement = function(element, options) {
		var jqElement = $(element); // element is a jQuery object containing the element used to instantiate the widget - Joe
		jqElement.phenogrid(options);
	};

	window.Phenogrid = {
		createPhenogridForElement: createPhenogridForElement
	};

	// Use widget factory to define the UI plugin - Joe
	// Can aslo be ns.phenogrid (ns can be anything else - namespace) - Joe
	// Later can be called using $().phenogrid(); - Joe
	// Widget factory API documentation https://api.jqueryui.com/jquery.widget/ - Joe
	$.widget("ui.phenogrid", {
	    // Public API, can be overwritten in Phenogrid constructor
        config: {		
            serverURL: "http://beta.monarchinitiative.org",
            selectedCalculation: 0,
            invertAxis: false,
            selectedSort: "Frequency",
            // this default targetGroupList config will be used if it's not specified 
            // in either the phenogrid_config.js or phenogrid constructor
            // There are two parameters which allow you to control whether a target group is displayed 
            // as a default in the multi-target comparison view, crossComparisonView and whether it should be active, active = true, 
            // and thus fully visible within phenogrid. If crossComparisonView = true, for example, 
            // the target group will be visible as a default within the multi-target comparison view.
            // The active parameter can override other parameters, but activating or deactivating a target group. 
            // For example, if the active = false, then the target group is not active within phenogrid and is not shown in comparison 
            // nor is it a selectable option from the menu. This is useful, if you not longer want that target group to be 
            // displayed within phenogrid and would like to retain the target group reference within the list. - MD
            // taxon is used by dataLoader to specify 'target_species' in query URL - Joe
            targetGroupList: [
                {name: "Homo sapiens", taxon: "9606", crossComparisonView: true, active: true},
                {name: "Mus musculus", taxon: "10090", crossComparisonView: true, active: true},
                {name: "Danio rerio", taxon: "7955", crossComparisonView: true, active: true},
                {name: "Drosophila melanogaster", taxon: "7227", crossComparisonView: false, active: false},
                {name: "UDPICS", taxon: "UDPICS", crossComparisonView: false, active: false} // Undiagnosed Diseases Program Integrated Collaboration System(UDPICS)
            ],
            // hooks to the monarch app's Analyze/phenotypes page - Joe
            owlSimFunction: '', // 'compare', 'search' or 'exomiser'
            targetSpecies: '', // quoted 'taxon number' or 'all'
            searchResultLimit: 100, // the limit field under analyze/phenotypes search section in search mode, default 100, will be overwritten by user-input limit 
            geneList: [] // an array of gene IDs to be used in compare mode, already contains orthologs and paralogs when provided 
        },

        // Supposed to be used by developers for deeper customization
        // can not be overwritten from constructor
        internalOptions: {
            simSearchQuery: "/simsearch/phenotype",
            compareQuery: "/compare", // used for owlSimFunction === 'compare' - Joe
            unmatchedButtonLabel: 'Unmatched Phenotypes',
            gridTitle: 'Phenotype Similarity Comparison',       
            defaultSingleTargetDisplayLimit: 30, //  defines the limit of the number of targets to display
            defaultSourceDisplayLimit: 30, //  defines the limit of the number of sources to display
            defaultCrossCompareTargetLimitPerTargetGroup: 10,    // the number of visible targets per species to be displayed in cross compare mode  
            labelCharDisplayCount : 20,
            ontologyDepth: 10,	// Numerical value that determines how far to go up the tree in relations.
            ontologyDirection: "OUTGOING",	// String that determines what direction to go in relations.  Default is "out".
            ontologyTreeAmounts: 1,	// Allows you to decide how many HPO Trees to render.  Once a tree hits the high-level parent, it will count it as a complete tree.  Additional branchs or seperate trees count as seperate items
                                // [vaa12] DO NOT CHANGE UNTIL THE DISPLAY HPOTREE FUNCTIONS HAVE BEEN CHANGED. WILL WORK ON SEPERATE TREES, BUT BRANCHES MAY BE INACCURATE
            genotypeExpandLimit: 5, // sets the limit for the number of genotype expanded on grid 
            colorDomains: [0, 0.2, 0.4, 0.6, 0.8, 1],
            colorRanges: [ // each color sets the stop color based on the stop points in colorDomains - Joe
                'rgb(237,248,177)',
                'rgb(199,233,180)',
                'rgb(127,205,187)',
                'rgb(65,182,196)', 
                'rgb(29,145,192)',
                'rgb(34,94,168)'
            ], // stop colors for corresponding stop points - Joe
            navigator: {
                x:112, 
                y: 65, 
                size:110, 
                reducedSize: 50, 
                miniCellSize: 2
            },// controls the navigator mapview - Joe
            logo: {
                x: 70, 
                y: 65, 
                width: 40, 
                height: 26
            },
            gridRegion: {
                x:254, 
                y:200, // origin coordinates for grid region (matrix)
                ypad:18, // x distance from the first cell to the next cell
                xpad:18, // y distance from the first cell to the next cell
                cellwd:12, // grid cell width
                cellht:12, // // grid cell height
                rowLabelOffset:-25, // offset of the row label (left side)
                colLabelOffset: 18,  // offset of column label (adjusted for text score) from the top of grid squares
                scoreOffset:5  // score text offset from the top of grid squares
            },
            gradientRegion: {
                width: 240,
                height: 5
            }, // width will be calculated - Joe
            phenotypeSort: [
                "Alphabetic", 
                "Frequency and Rarity", 
                "Frequency" 
            ],
            similarityCalculation: [
                {label: "Similarity", calc: 0, high: "Max", low: "Min"}, 
                {label: "Ratio (q)", calc: 1, high: "More Similar", low: "Less Similar"}, 
                {label: "Uniqueness", calc: 2, high: "Highest", low: "Lowest"},
                {label: "Ratio (t)", calc: 3, high: "More Similar", low: "Less Similar"}
            ],
            comparisonTypes: [ 
                {organism: "Homo sapiens", comparison: "diseases"}
            ],
            defaultComparisonType: {comparison: "genes"}
        },


    // The _create() method is the jquery UI widget's constructor. 
    // There are no parameters, but this.element and this.options are already set.
    // The widget factory automatically fires the _create() and then _init() during initialization
	_create: function() {
        // Loaded from a separate file config/phenogrid_config.js
		this.configoptions = configoptions;
        // Merge into one object
        // this.options is the options object provided in phenogrid constructor
        // this.options overwrites this.configoptions overwrites this.config overwrites this.internalOptions
		this.state = $.extend({},this.internalOptions,this.config,this.configoptions,this.options);

        // Create new arrays for later use
        // initialTargetGroupLoadList is used for loading the simsearch data
		this.state.initialTargetGroupLoadList = [];
        
        // selectedCompareTargetGroup is used to control what species are loaded
        // it's possible that a species is in initialTargetGroupLoadList but there's no simsearch data returned - Joe
		this.state.selectedCompareTargetGroup = [];

        // Genotype expansion flags - named/associative array
        // flag used for switching between single species and multi-species mode
        // add new species names here once needed - Joe
        var genotypeExpansionSpeciesFlagConfig = {
            "Mus musculus": false,
            "Danio rerio": false
        };
        
        this.state.expandedGenotypes = genotypeExpansionSpeciesFlagConfig;
        
        // genotype flags to mark every genotype expansion on/off in each species
        this.state.newGenotypes = genotypeExpansionSpeciesFlagConfig;
        
        this.state.removedGenotypes = genotypeExpansionSpeciesFlagConfig;
        
        // flag to mark if hidden genotypes need to be reactivated
        this.state.reactivateGenotypes = genotypeExpansionSpeciesFlagConfig;
	},

	
    // _init() will be executed first and after the first time when phenogrid is created - Joe
    // So, if you draw a chart with jquery-ui plugin, after it's drawn out, 
    // then you want to use new data to update it, you need to do this in _init() to update your chart. 
    // If you just display something and won't update them totally, _create() will meet your needs.
	_init: function() {
		this.element.empty();

		// show loading spinner - Joe
		this._showLoadingSpinner();		

        // Remove duplicated source IDs - Joe
		var querySourceList = this._parseQuerySourceList(this.state.phenotypeData);

		var self = this;
        // no change to the callback - Joe
        var asyncDataLoadingCallback = function() {
            self._asyncDataLoadingCB(self); 
        };

        // Load data from compare API for geneList
        // in compare mode, there's no crossComparisonView - Joe
        if (this.state.owlSimFunction === 'compare' && this.state.geneList.length !== 0) {
            // overwrite the this.state.targetGroupList with only 'compare'
            // this 'compare' is hard coded in dataLoader.loadCompareData() and dataManager.buildMatrix() too - Joe
            this.state.targetGroupList = [
                {name: "compare", taxon: "compare", crossComparisonView: true, active: true}
            ];
            
            // load the target targetGroup list based on the active flag
            for (var idx in this.state.targetGroupList) {
                // for active targetGroup pre-load them
                if (this.state.targetGroupList[idx].active) {
                    this.state.initialTargetGroupLoadList.push(this.state.targetGroupList[idx]);	
                }	
                // should they be shown in the comparison view
                if (this.state.targetGroupList[idx].crossComparisonView) {
                    this.state.selectedCompareTargetGroup.push(this.state.targetGroupList[idx]);	
                }			
            }	

            // initialize data processing class for compare query
            this.state.dataLoader = new DataLoader(this.state.serverURL, this.state.compareQuery);

            // starting loading the data from compare api
            // NOTE: the owlsim data returned form the ajax GET may be empty (no matches), we'll handle this in the callback - Joe
		    this.state.dataLoader.loadCompareData(querySourceList, this.state.geneList, asyncDataLoadingCallback);
        } else if (this.state.owlSimFunction === 'search' && this.state.targetSpecies !== '') {
            // targetSpecies is used by monarch-app's Analyze page, the dropdown menu under "Search" section - Joe
            if (this.state.targetSpecies === 'all') {
                // overwrite the this.state.targetGroupList by enabling Homo sapiens, Mus musculus, and Danio rerio - Joe
                this.state.targetGroupList = [
                    // Because only the three species are supported in monarch analyze/phenotypes page at this point - Joe
                    {name: "Homo sapiens", taxon: "9606", crossComparisonView: true, active: true},
                    {name: "Mus musculus", taxon: "10090", crossComparisonView: true, active: true},
                    {name: "Danio rerio", taxon: "7955", crossComparisonView: true, active: true},
                    // Disabled species
                    {name: "Drosophila melanogaster", taxon: "7227", crossComparisonView: false, active: false},
                    {name: "UDPICS", taxon: "UDPICS", crossComparisonView: false, active: false}
                ];
                
                // load the target targetGroup list based on the active flag
                for (var idx in this.state.targetGroupList) {
                    // for active targetGroup pre-load them
                    if (this.state.targetGroupList[idx].active) {
                        this.state.initialTargetGroupLoadList.push(this.state.targetGroupList[idx]);	
                    }	
                    // should they be shown in the comparison view
                    if (this.state.targetGroupList[idx].crossComparisonView) {
                        this.state.selectedCompareTargetGroup.push(this.state.targetGroupList[idx]);	
                    }			
                }
            } else { // when single species is selected (taxon is passed in)
                // load just the one selected from the dropdown menu - Joe
                for (var idx in this.state.targetGroupList) {
                    // for active targetGroup pre-load them
                    // The phenogrid constructor settings will overwrite the one in phenogrid_config.js - Joe
                    if (this.state.targetGroupList[idx].taxon === this.state.targetSpecies) {
                        this.state.initialTargetGroupLoadList.push(this.state.targetGroupList[idx]);	
                        this.state.selectedCompareTargetGroup.push(this.state.targetGroupList[idx]);	
                    }	
                }
            }
            
            // initialize data processing class for simsearch query
		    this.state.dataLoader = new DataLoader(this.state.serverURL, this.state.simSearchQuery);
            
            // starting loading the data from simsearch
		    this.state.dataLoader.load(querySourceList, this.state.initialTargetGroupLoadList, asyncDataLoadingCallback, this.state.searchResultLimit);
        } else if (this.state.owlSimFunction === 'exomiser') {
            // hook for exomiser, PENDING - Joe
            // from the old code
			this.state.selectedCalculation = 2; // Force the color to Uniqueness
        } else {
            // when not work with monarch's analyze/phenotypes page
            // load the default selected target targetGroup list based on the active flag in config, 
            // has nothing to do with the monarch's analyze phenotypes page - Joe
			for (var idx in this.state.targetGroupList) {
				// for active targetGroup pre-load them
				if (this.state.targetGroupList[idx].active) {
					this.state.initialTargetGroupLoadList.push(this.state.targetGroupList[idx]);	
				}	
				// should they be shown in the comparison view
				if (this.state.targetGroupList[idx].crossComparisonView) {
					this.state.selectedCompareTargetGroup.push(this.state.targetGroupList[idx]);	
				}			
			}
            
            // initialize data processing class for simsearch query
		    this.state.dataLoader = new DataLoader(this.state.serverURL, this.state.simSearchQuery);
            
            // starting loading the data from simsearch
		    this.state.dataLoader.load(querySourceList, this.state.initialTargetGroupLoadList, asyncDataLoadingCallback);  //optional parm:   this.limit);
        }
	},

    // callback to handle the loaded owlsim data
	_asyncDataLoadingCB: function(self) {
		// add dataManager to this.state
        self.state.dataManager = new DataManager(self.state.dataLoader);

        // No need to update in owlSimFunction === 'compare' mode
        // since compare only loads data once - Joe
        if (self.state.owlSimFunction !== 'compare') { 
            // need to update the selectedCompareTargetGroup list depending on if we loaded all the data
		    self._updateSelectedCompareTargetGroup();
        }

        
        // This removes the loading spinner, otherwise the spinner will be always there - Joe
        self.element.empty();
        self._createPhenogridContainer();

        // check owlsim data integrity - Joe
        if (self.state.owlSimFunction === 'compare') {
            // noMatchesFound and noMetadataFound are compare api flags
            // they are only available in compare mode
            // check the flags to see if there's matches data found - Joe
            if (self.state.dataManager.noMatchesFound) {
                self._showNoResults();
            } else if (self.state.dataManager.noMetadataFound) {
                self._showNoMetadata();
            } else {
                // initialize axis groups
	            self._createAxisRenderingGroups();
        
                // Create all UI components
                // create the display as usual if there's 'b' and 'metadata' fields found - Joe
                self._createDisplay();
            }
        } else {
	        // initialize axis groups
            self._createAxisRenderingGroups();
    
            // Create all UI components
            // create the display as usual if there's 'b' and 'metadata' fields found - Joe
            self._createDisplay();
        }
	},

    // If owlSimFunction === 'compare', we do not have comparison mode
	_updateSelectedCompareTargetGroup: function() {
		// loop through to make sure we have data to display
		for (var idx in this.state.selectedCompareTargetGroup) {
			var r = this.state.selectedCompareTargetGroup[idx];

			var len = this.state.dataManager.length("target", r.name);
			if (typeof(len) === 'undefined'  || len < 1) {
                // remove the target that has no data
                // use splice() not slice() - Joe
                // splice() modifies the array in place and returns a new array containing the elements that have been removed.
                this.state.selectedCompareTargetGroup.splice(idx, 1);

//				this.state.selectedCompareTargetGroup[idx].active = false;
//				this.state.selectedCompareTargetGroup[idx].crossComparisonView = false;
			}
		}
	}, 


    // for genotype expansion, we need to update the target list 
    // for each species if they have added genotypes - Joe
    _updateTargetAxisRenderingGroup: function(species_name) {
    	var targetList = [];

		if (this.state.selectedCompareTargetGroup.length === 1) {
            // get targetList based on the newGenotypes flag
            if (this.state.newGenotypes[species_name]) {
                // get the reordered target list in the format of a named array, has all added genotype data
                targetList = this.state.dataManager.reorderedTargetEntriesNamedArray[species_name];
            } else if (this.state.removedGenotypes[species_name]) {
                // get the reordered target list in the format of a named array, has all added genotype data
                //targetList = this.state.dataManager.reorderedTargetEntriesNamedArray[species_name];
                
                targetList = this.state.dataManager.getReorderedTargetEntriesNamedArray(species_name); 
            } else if (this.state.reactivateGenotypes[species_name]) {
                targetList = this.state.dataManager.getReorderedTargetEntriesNamedArray(species_name); 
            } else {
                // unordered target list in the format of a named array, has all added genotype data
                targetList = this.state.dataManager.getData("target", species_name);
            }	  
		}

		// update target axis group
        var targetAxisRenderStartPos = this.state.targetAxis.getRenderStartPos();
        var targetAxisRenderEndPos = this.state.targetAxis.getRenderEndPos();
    	this.state.targetAxis = new AxisGroup(targetAxisRenderStartPos, targetAxisRenderEndPos, targetList);

    	this._setAxisRenderers();
	},
    
    
    
    /* create the groups to contain the rendering 
       information for x and y axes. Use already loaded data
       in various hashes, etc. to create objects containing
       information for axis rendering. Then, switch source and target
       groups to be x or y depending on "flip axis" choice*/
    _createAxisRenderingGroups: function() {
    	var targetList = [], sourceList = [];

		if (this._isCrossComparisonView()) {  
			// create a combined list of targets
			sourceList = this.state.dataManager.createCombinedSourceList(this.state.selectedCompareTargetGroup, this.state.defaultCrossCompareTargetLimitPerTargetGroup);	

			// get the length of the sourceList, this sets that limit since we are in comparison mode
			// only the defaultCrossCompareTargetLimitPerTargetGroup is set, which provides the overall display limit
			this.state.sourceDisplayLimit = Object.keys(sourceList).length;

			// create a combined list of targets
			targetList = this.state.dataManager.createCombinedTargetList(this.state.selectedCompareTargetGroup, this.state.defaultCrossCompareTargetLimitPerTargetGroup);	

			// get the length of the targetlist, this sets that limit since we are in comparison mode
			// only the defaultCrossCompareTargetLimitPerTargetGroup is set, which provides the overall display limit
			this.state.targetDisplayLimit = Object.keys(targetList).length;
		} else if (this.state.selectedCompareTargetGroup.length === 1) {
			// just get the target group name 
            // in analyze/phenotypes compare mode, the singleTargetGroupName will be 'compare' - Joe
			var singleTargetGroupName = this.state.selectedCompareTargetGroup[0].name;
			
			sourceList = this.state.dataManager.getData("source", singleTargetGroupName);

			// set default display limits based on displaying defaultSourceDisplayLimit
    		this.state.sourceDisplayLimit = this.state.dataManager.length("source", singleTargetGroupName);
	
            // display all the expanded genotypes when we switch back from multi-species mode to single-species mode
            // at this point, this.state.expandedGenotypes is true, and this.state.newGenotypes is false - Joe
            if (this.state.expandedGenotypes[singleTargetGroupName]) {
                //targetList = this.state.dataManager.reorderedTargetEntriesNamedArray[singleTargetGroupName];
                targetList = this.state.dataManager.getReorderedTargetEntriesNamedArray(singleTargetGroupName); 
            } else {
                // unordered target list in the format of a named array, has all added genotype data
                targetList = this.state.dataManager.getData("target", singleTargetGroupName);
            }
            
			this.state.targetDisplayLimit = this.state.dataManager.length("target", singleTargetGroupName);			
		}

		// check to make sure the display limits are not over the default display limits
		if (this.state.sourceDisplayLimit > this.state.defaultSourceDisplayLimit) {
			this.state.sourceDisplayLimit = this.state.defaultSourceDisplayLimit;  // adjust the display limit within default limit
		}

		if (this.state.targetDisplayLimit > this.state.defaultSingleTargetDisplayLimit) {
			this.state.targetDisplayLimit = this.state.defaultSingleTargetDisplayLimit;
		} 

       	// creates AxisGroup with full source and target lists with default rendering range
    	this.state.sourceAxis = new AxisGroup(0, this.state.sourceDisplayLimit, sourceList);
		
		// sort source with default sorting type
		this.state.sourceAxis.sort(this.state.selectedSort); 

		//create target axis group
    	this.state.targetAxis =  new AxisGroup(0, this.state.targetDisplayLimit, targetList);

    	this._setAxisRenderers();
	},

    _setAxisRenderers: function() {
	   	if (this.state.invertAxis) {
	   		// invert our x/y Renders
	    	this.state.xAxisRender = this.state.sourceAxis;
	       	this.state.yAxisRender = this.state.targetAxis;
	   	} else {
	       	this.state.xAxisRender = this.state.targetAxis;
	       	this.state.yAxisRender = this.state.sourceAxis;
	   	}
    },

	// Loading spinner image from font awesome - Joe
	_showLoadingSpinner: function() {
		var element =$('<div>Loading Phenogrid Widget...<i class="fa fa-spinner fa-pulse"></i></div>');
		this._createPhenogridContainer();
		element.appendTo(this.state.pgContainer);
	},
	
    // Recreates the SVG content and leave the HTML sections unchanged
	_updateDisplay: function() {
        // Only remove the #pg_svg node and leave #pg_controls and #pg_unmatched there
        // since #pg_controls and #pg_unmatched are HTML not SVG - Joe
        this.element.find('#pg_svg').remove();
        
        if (this.state.dataManager.isInitialized()) {
			this._createSvgComponents();

            // Reposition HTML sections
            this._positionUnmatchedSources();
			this._positionPhenogridControls();
		} else {
			this._showNoResults();
		}
        
        this._setSvgSize();
	},

    _createSvgComponents: function() {
        this._createSvgContainer();
        this._addLogoImage();
        this._createOverviewTargetGroupLabels();
        this._createGrid();
        this._createScoresTipIcon();
        this._addGridTitle(); // Must after _createGrid() since it's positioned based on the _gridWidth() - Joe
        this._createOverviewSection();
        this._createGradientLegend();
        this._createTargetGroupDividerLines();
        this._createMonarchInitiativeText(); // For exported phenogrid SVG, hide by default
        
        // this must be called here so the tooltip disappears when we mouseout the current element - Joe
        this._relinkTooltip();
    },
    
	// Click the setting button to open the control options
	// Click the cross mark to close when it's open
	_togglePhenogridControls: function() {
		// Toggle the options panel by clicking the button
		$("#pg_slide_btn").click(function() {
			// $(this) refers to $("#pg_slide_btn")
			if ( ! $(this).hasClass("pg_slide_open")) {
				// Show the phenogrid controls
				$("#pg_controls_options").fadeIn();
				// Remove the top border of the button by adding .pg_slide_open CSS class
				$(this).addClass("pg_slide_open");
			}
		});
        
        $("#pg_controls_close").click(function() {
			$("#pg_controls_options").fadeOut();
            $("#pg_slide_btn").removeClass("pg_slide_open");
		});
	},
	
    // Click the setting button to open unmatched sources
	// Click the cross mark to close when it's open
	_toggleUnmatchedSources: function() {
        $("#pg_unmatched_btn").click(function() {
			// $(this) refers to $("#pg_unmatched_btn")
			if ( ! $(this).hasClass("pg_unmatched_open")) {
				// Show the phenogrid controls
				$("#pg_unmatched_list").fadeIn();
				// Remove the top border of the button by adding .pg_unmatched_open CSS class
				$(this).addClass("pg_unmatched_open");
			}
		});
        
        $("#pg_unmatched_close").click(function() {
			$("#pg_unmatched_list").fadeOut();
            $("#pg_unmatched_btn").removeClass("pg_unmatched_open");
		});
	},
    
	// create the grid
	_createGrid: function() {
		var self = this;
        // xvalues and yvalues are index arrays that contain the current x and y items, not all of them
        // if any items are added genotypes, they only contain visible genotypes
        // Axisgroup's constructor does the data filtering - Joe
		var xvalues = this.state.xAxisRender.entries(); 
		var yvalues = this.state.yAxisRender.entries();
		var gridRegion = this.state.gridRegion; 
		var xScale = this.state.xAxisRender.getScale();
		var yScale = this.state.yAxisRender.getScale();

		// use the x/y renders to generate the matrix
        if (this.state.owlSimFunction === 'compare') {
            var matrix = this.state.dataManager.buildMatrix(xvalues, yvalues, false, true);
        } else {
            var matrix = this.state.dataManager.buildMatrix(xvalues, yvalues, false, false);
        }
	    
        // create column lables first, so the added genotype cells will overwrite the background color - Joe
        // create columns using the xvalues (targets)
	  	var column = this.state.svg.selectAll(".column")
	        .data(xvalues)
	        .enter().append("g")
            .attr("class", 'column')
            .style("font-size", '11px')            
			.attr("id", function(d, i) { 
				return "pg_grid_col_"+i;
            })	      	
	        .attr("transform", function(d) { 
                var offset = gridRegion.colLabelOffset;
                var xs = xScale(d.id);
                return "translate(" + (gridRegion.x + (xs*gridRegion.xpad)) + "," + (gridRegion.y-offset) + ")rotate(-45)"; 
            }); //-45

	    // create column labels
	  	column.append("text")
	      	.attr("x", 0)
	      	.attr("y", xScale.rangeBand()+2)  //2
		    .attr("dy", ".32em")
            .style('fill', function(d) { // add different color to genotype labels
                if (d.type === 'genotype') {
                    return '#EA763B'; // fill color needs to be here instead of CSS, for export purpose - Joe
                } else {
                    return '';
                }
            })
		    .attr("data-tooltip", "pg_tooltip")   			
	      	.attr("text-anchor", "start")
	      	.text(function(d, i) { 		
	      		return Utils.getShortLabel(d.label, self.state.labelCharDisplayCount); 
            })
		    .on("mouseover", function(d, i) { 				
		    	// self is the global widget this
                // this passed to _mouseover refers to the current element
                // _mouseover() highlights and matching x/y labels, and creates crosshairs on current grid cell
                // _mouseover() also triggers the tooltip popup as well as the tooltip mouseover/mouseleave - Joe
                self._mouseover(this, d, self);})
			.on("mouseout", function(d) {
				// _mouseout() removes the matching highlighting as well as the crosshairs - Joe
                self._mouseout();
			});
	
        // grey background for added genotype columns - Joe
        // no need to add this grey background for multi species or owlSimFunction === 'compare' - Joe
        if (this.state.selectedCompareTargetGroup.length === 1 && this.state.selectedCompareTargetGroup[0].name !== 'compare') {
            column.append("rect")
                .attr("y", xScale.rangeBand() - 1 + gridRegion.colLabelOffset)
                .attr('width', gridRegion.cellwd)
                .attr('height', self._gridHeight())
                .style('fill', function(d){
                    if (d.type === 'genotype') {
                        return '#ededed'; // fill color needs to be here instead of CSS, for SVG export purpose - Joe
                    } else {
                        return 'none'; // transparent 
                    }
                })
                .style('opacity', 0.8)
                .attr("transform", function(d) { 
                    return "rotate(45)"; 
                }); //45
        }
        
        // add the scores for labels
	    self._createTextScores();

		// create a row, the matrix contains an array of rows (yscale) with an array of columns (xscale)
		var row = this.state.svg.selectAll(".row")
  			.data(matrix)
			.enter().append("g")			
			.attr("class", "row")	 		
			.attr("id", function(d, i) { 
				return "pg_grid_row_"+i;
            })
  			.attr("transform", function(d, i) { 
                var y = self.state.gridRegion.y;
                var ypad = self.state.gridRegion.ypad;

                return "translate(" + gridRegion.x +"," + (y+(i*ypad)) + ")"; 
            });

   		// create row labels
	  	row.append("text")
			.attr("x", gridRegion.rowLabelOffset)	  		
	      	.attr("y",  function(d, i) {
	      		var rb = yScale.rangeBand(i)/2;
	      		return rb;
	      	})  
	      	.attr("dy", ".80em")  // this makes small adjustment in position	      	
	      	.attr("text-anchor", "end")
            .style("font-size", "11px")
            
            // the d.type is cell instead of genotype because the d refers to cell data
            // we'll need to get the genotype data from yAxisRender - Joe
            .style('fill', function(d, i) { // add different color to genotype labels
                var el = self.state.yAxisRender.itemAt(i);
                if (el.type === 'genotype') {
                    return '#EA763B'; // fill color needs to be here instead of CSS, for SVG export purpose - Joe
                } else {
                    return '';
                }
            })
			.attr("data-tooltip", "pg_tooltip")   				      
		    .text(function(d, i) { 
	      		var el = self.state.yAxisRender.itemAt(i);
	      		return Utils.getShortLabel(el.label); 
            })
			.on("mouseover", function(d, i) { 		
				var data = self.state.yAxisRender.itemAt(i); // d is really an array of data points, not individual data pt
				// self is the global widget this
                // this passed to _mouseover refers to the current element
                // _mouseover() highlights and matching x/y labels, and creates crosshairs on current grid cell
                // _mouseover() also triggers the tooltip popup as well as the tooltip mouseover/mouseleave - Joe
                self._mouseover(this, data, self);
            })
			.on("mouseout", function() {
				// _mouseout() removes the matching highlighting as well as the crosshairs - Joe
                self._mouseout();		  		
			});

        // no need to add this grey background for multi species or owlSimFunction === 'compare' - Joe
        if (this.state.selectedCompareTargetGroup.length === 1 && this.state.selectedCompareTargetGroup[0].name !== 'compare') {
            row.append("rect")
                .attr('width', self._gridWidth())
                .attr('height', gridRegion.cellht)
                .style('fill', function(d, i) { // add different color to genotype labels
                    var el = self.state.yAxisRender.itemAt(i);
                    if (el.type === 'genotype') {
                        return '#ededed'; // fill color needs to be here instead of CSS, for SVG export purpose - Joe
                    } else {
                        return 'none'; // transparent 
                    }
                })
                .style('opacity', 0.8);
        }
        
        // create the grid cells after appending all the background rects
        // so they can overwrite the row background for those added genotype rows - Joe 
        row.each(createrow);

        // callback for row.each()
		function createrow(row) {
            // The each operator can be used to process selections recursively, by using d3.select(this) within the callback function.
		    var cell = d3.select(this).selectAll(".cell")
		        .data(row)
		        .enter().append("rect")
		      	.attr("id", function(d, i) { 
		      		return "pg_cell_"+ d.ypos + "_" + d.xpos; 
                })
		        .attr("class", "cell")
		        .attr("x", function(d) { 
		        	return d.xpos * gridRegion.xpad;
                })
		        .attr("width", gridRegion.cellwd)
		        .attr("height", gridRegion.cellht) 
				.attr("data-tooltip", "tooltip")   					        
		        .style("fill", function(d) { 
					var el = self.state.dataManager.getCellDetail(d.source_id, d.target_id, d.targetGroup);
					return self._getCellColor(el.value[self.state.selectedCalculation]);
			    })
		        .on("mouseover", function(d) { 					
                    // self is the global widget this
                    // this passed to _mouseover refers to the current element
                    // _mouseover() highlights and matching x/y labels, and creates crosshairs on current grid cell
                    // _mouseover() also triggers the tooltip popup as well as the tooltip mouseover/mouseleave - Joe
		        	self._mouseover(this, d, self);})							
		        .on("mouseout", function(d) {
		        	// _mouseout() removes the matching highlighting as well as the crosshairs - Joe
                    self._mouseout();
		        });
		}
	},

	_crossHairsOff: function() {
        this.state.svg.selectAll(".pg_focusLine").remove();			
	},

	// direction: 'vertical' or 'horizontal' or 'both'
	_crossHairsOn: function(id, ypos, direction) {
		var xScale = this.state.xAxisRender.getScale();

    	var xs = xScale(id);

    	var gridRegion = this.state.gridRegion; 
        var x = gridRegion.x + (xs * gridRegion.xpad) + 5;  // magic number to make sure it goes through the middle of the cell
        var y = gridRegion.y + (ypos * gridRegion.ypad) + 5; 

		if (direction === 'vertical') {
			this._createFocusLineVertical(x, gridRegion.y, x, gridRegion.y + this._gridHeight());
        } else if (direction === 'horizontal') {
			this._createFocusLineHorizontal(gridRegion.x, y, gridRegion.x + this._gridWidth(), y);	        
        } else {
			// creating 4 lines around the cell, this way there's no svg elements overlapped - Joe
            this._createFocusLineVertical(x, gridRegion.y, x, gridRegion.y + gridRegion.ypad*ypos); // vertical line above cell
            this._createFocusLineVertical(x, gridRegion.y + gridRegion.ypad*ypos + gridRegion.cellht, x, gridRegion.y + this._gridHeight()); // vertical line under cell
			this._createFocusLineHorizontal(gridRegion.x, y, gridRegion.x + gridRegion.xpad*xs, y); // horizontal line on the left of cell
            this._createFocusLineHorizontal(gridRegion.x + gridRegion.xpad*xs + gridRegion.cellwd, y, gridRegion.x + this._gridWidth(), y); // horizontal line on the right of cell	         
        }
	},
	
	_createFocusLineVertical: function(x1, y1, x2, y2) {     
        this.state.svg.append('line')
            .attr('class', 'pg_focusLine')
            .attr('x1', x1)
			.attr('y1', y1)
			.attr('x2', x2)
			.attr('y2', y2);
	},

	_createFocusLineHorizontal: function(x1, y1, x2, y2) {   
		this.state.svg.append('line')
            .attr('class', 'pg_focusLine')
            .attr('x1', x1)
			.attr('y1', y1)
			.attr('x2', x2)
			.attr('y2', y2);
	},

    // mouseover x/y label and grid cell
    // tooltip and crosshair highlighting show up at the same time and disappear together as well - Joe
	_mouseover: function (elem, d) {
        // show matching highlighting and crosshairs on mouseover lebel/cell
        this._showEffectsOnMouseover(elem, d);
        
		// render tooltip data
        var data;
        
        if (d.type === 'cell') {  
       		data = this.state.dataManager.getCellDetail(d.source_id, d.target_id, d.targetGroup);			  
		} else {
            data = d;   
		}
		this._createHoverBox(data);
        
        // show tooltip
        // elem is a native DOM element
		this._showTooltip($('#pg_tooltip'), elem, d);
	},

    // _mouseout() removes the matching highlighting as well as the crosshairs - Joe
    _mouseout: function() {
    	this._removeMatchingHighlight();
    	this._crossHairsOff();
    },

    // show effects(matching highlighting and crosshairs) on mouseover lebel/cell and tooltip
    // this is reused by x/y label mouseover as well as tooltip mouseover - Joe
    _showEffectsOnMouseover: function(elem, d) {
        // d.xpos and d.ypos only appear for cell - Joe
		if (d.type === 'cell') {  
			// hightlight row/col labels
		  	d3.select("#pg_grid_row_" + d.ypos +" text")
				  .classed("pg_active", true);
	  		d3.select("#pg_grid_col_" + d.xpos +" text")
				  .classed("pg_active", true);
			
			// hightlight the cell
	 		d3.select("#pg_cell_" + d.ypos +"_" + d.xpos)
				  .classed("pg_rowcolmatch", true);		

		    // show crosshairs
	        this._crossHairsOn(d.target_id, d.ypos, 'both');			  
		} else if (d.type === 'phenotype') {
			this._createMatchingHighlight(elem, d);
			// show crosshair
            if ( ! this.state.invertAxis) {
                var yScale = this.state.yAxisRender.getScale();
                var ypos = yScale(d.id);
                this._crossHairsOn(d.id, ypos, 'horizontal');
            } else {
                var xScale = this.state.xAxisRender.getScale();
                var xpos = xScale(d.id);
                this._crossHairsOn(d.id, xpos, 'vertical');
            }
		} else {  
			this._createMatchingHighlight(elem, d);
			// show crosshair
			if ( ! this.state.invertAxis) {
                var xScale = this.state.xAxisRender.getScale();
                var xpos = xScale(d.id);
                this._crossHairsOn(d.id, xpos, 'vertical');
            } else {
                var yScale = this.state.yAxisRender.getScale();
                var ypos = yScale(d.id);
                this._crossHairsOn(d.id, ypos, 'horizontal');
            }
		}
    },
    
    // removes the highlighted x/y labels as well as highlighted grid cell
	_removeMatchingHighlight: function() {
		// remove highlighting for row/col
		d3.selectAll(".row text")
			  .classed("pg_active", false);
		d3.selectAll(".column text")
			  .classed("pg_active", false);
		d3.selectAll(".row text")
			  .classed("pg_related_active", false);
		d3.selectAll(".column text")
			  .classed("pg_related_active", false);		
		d3.selectAll(".cell")
				.classed("pg_rowcolmatch", false);	
	},

	_createMatchingHighlight: function(elem, data) {
		var hightlightSources = true;
		var currenPos = this._getAxisDataPosition(data.id);
		var nameId = elem.parentNode.id;  // using parentNode is compatible across browsers, not elem.parentElement.id

		// did we hover over a grid column
		if (nameId.indexOf('grid_col') > -1) {
			hightlightSources = true;
			var matches = this.state.dataManager.getMatrixSourceTargetMatches(currenPos, hightlightSources);

			if (typeof(matches) !== 'undefined') {
				for (var k=0; k < matches.length; k++) {
					d3.select("#pg_grid_row_" + matches[k].ypos +" text")
				  	.classed("pg_related_active", true);
				}
			}	
	  		d3.select("#pg_grid_col_" + currenPos +" text")
				  .classed("pg_active", true);	
		} else {  // hovered over a row
			hightlightSources = false;
			var matches = this.state.dataManager.getMatrixSourceTargetMatches(currenPos, hightlightSources);

			if (typeof(matches) !== 'undefined') {
				for (var k=0; k < matches.length; k++) {
					d3.select("#pg_grid_col_" + matches[k].xpos +" text")
				  	.classed("pg_related_active", true);
				}
			}		
			d3.select("#pg_grid_row_" + currenPos +" text")
				  .classed("pg_active", true);
		}				

	},

	_gridWidth: function() {
        var gridRegion = this.state.gridRegion; 
        var gridWidth = (gridRegion.xpad * this.state.xAxisRender.displayLength()) - (gridRegion.xpad - gridRegion.cellwd);
        return gridWidth;
    },

	_gridHeight: function() {
		var gridRegion = this.state.gridRegion; 
		var height = (gridRegion.ypad * this.state.yAxisRender.displayLength()) - (gridRegion.ypad - gridRegion.cellht);
		//var height = (gridRegion.ypad * this.state.sourceDisplayLimit) - (gridRegion.ypad - gridRegion.cellht);		
		return height;
	},

	_createTextScores: function () {
		var self = this;
		var gridRegion = self.state.gridRegion; 
		var list, scale, axRender;

		if (self.state.invertAxis) {
			list = self.state.yAxisRender.keys();  
			scale = self.state.yAxisRender.getScale();
			axRender = self.state.yAxisRender;
		} else {
			list = self.state.xAxisRender.keys(); 
			scale = self.state.xAxisRender.getScale();
			axRender = self.state.xAxisRender;
		}
	    var scores = this.state.svg.selectAll(".scores")
	        .data(list)
	        .enter().append("g")
	    	.attr("class", "pg_score_text");

	    scores.append("text")	 
	      	.attr("text-anchor", "start")
            .style("font-size", "9px")
            .style("fill", "#8763A3")
	      	.text(function(d, i) { 		      	
				var el = axRender.itemAt(i);
	      		return el.score; 
	      	});

	    if (self.state.invertAxis) { // score are render vertically
			scores
				.attr("transform", function(d, i) { 
  					return "translate(" + (gridRegion.x-gridRegion.xpad-5) +"," + (gridRegion.y+scale(d)*gridRegion.ypad+10) + ")"; 
                })
	      		.attr("x", gridRegion.rowLabelOffset)
	      		.attr("y",  function(d, i) {
                    return scale.rangeBand(i)/2;
                });  
	    } else {
	    	scores	      		
                .attr("transform", function(d, i) { 
                    return "translate(" + (gridRegion.x + scale(d)*gridRegion.xpad-1) +
                         "," + (gridRegion.y-gridRegion.scoreOffset ) +")";
                    })
                .attr("x", 0)
                .attr("y", scale.rangeBand()+2);
	    }
	}, 
    
	_getCellColor: function(score) {
		// This is for the new "Overview" target option
		var selectedScale = this.state.colorScale[this.state.selectedCalculation];
		return selectedScale(score);
	},

	// For the selection area, see if you can convert the selection to the idx of the x and y then redraw the bigger grid 
	_createOverviewSection: function() {
		var self = this;

		// set the display counts on each axis
		var yCount = self.state.yAxisRender.displayLength();  
	    var xCount = self.state.xAxisRender.displayLength();  

		// add-ons for stroke size on view box. Preferably even numbers
		var linePad = self.state.navigator.miniCellSize;
		var viewPadding = linePad * 2 + 2;

		// overview region is offset by xTranslation, yTranslation
		var xTranslation = 42; 
		var yTranslation = 30;

		// these translations from the top-left of the rectangular region give the absolute coordinates
		var overviewX = self.state.navigator.x;
		var overviewY = self.state.navigator.y;

		// size of the entire region - it is a square
		var overviewRegionSize = self.state.navigator.size;
		if (this.state.yAxisRender.groupLength() < yCount) {  
			overviewRegionSize = self.state.navigator.reducedSize;
		}

		// make it a bit bigger to ccont for widths
		var overviewBoxDim = overviewRegionSize + viewPadding;

		// create the main box and the instruction labels.
		this._initializeOverviewRegion(overviewBoxDim, overviewX, overviewY);

		// create the scales
		this._createSmallScales(overviewRegionSize);

		// this should be the full set of cellData
		var xvalues = this.state.xAxisRender.groupEntries();
		//console.log(JSON.stringify(xvalues));
		var yvalues = this.state.yAxisRender.groupEntries();	

        if (this.state.owlSimFunction === 'compare') {
            var data = this.state.dataManager.buildMatrix(xvalues, yvalues, true, true);
        } else {
            var data = this.state.dataManager.buildMatrix(xvalues, yvalues, true, false);
        }

		// Group all mini cells in g element - Joe
		var miniCellsGrp = this.state.svg.select("#pg_navigator").append('g')
							.attr("id", "pg_mini_cells_container");
						
        // Add cells to the miniCellsGrp - Joe						
		var cell_rects = miniCellsGrp.selectAll(".mini_cell")
			.data(data, function(d) {return d.source_id + d.target_id;});  
			
			
		overviewX++;	// Corrects the gapping on the sides
		overviewY++;
		var cellRectTransform = "translate(" + overviewX +	"," + overviewY + ")";

		cell_rects.enter()
			.append("rect")
			.attr("transform", cellRectTransform)
			.attr("class", "mini_cell")
			.attr("y", function(d, i) { 
				var yid = d.source_id;
				var yscale = self.state.smallYScale(yid);
			    var y = yscale + linePad / 2;
				return y;
            })
			.attr("x", function(d) { 
				var xid = d.target_id;
				var xscale = self.state.smallXScale(xid);
				var x =  xscale + linePad / 2; 
				return x;
            })
			.attr("width", linePad) // Defined in navigator.miniCellSize
			.attr("height", linePad) // Defined in navigator.miniCellSize
			.attr("fill", function(d) {
				var el = self.state.dataManager.getCellDetail(d.source_id, d.target_id, d.targetGroup);
				return self._getCellColor(el.value[self.state.selectedCalculation]);			 
			});
	
		var yRenderedSize = this.state.yAxisRender.displayLength();
		var xRenderedSize = this.state.xAxisRender.displayLength();		
     	var lastYId = this.state.yAxisRender.itemAt(yRenderedSize - 1).id; 
	    var lastXId = this.state.xAxisRender.itemAt(xRenderedSize - 1).id; 
		var startYId = this.state.yAxisRender.itemAt(0).id; // start point should always be 0 - Joe  
	    var startXId = this.state.xAxisRender.itemAt(0).id; // start point should always be 0 - Joe  	

        // start point (x, y) of the shaded draggable area
		var selectRectX = this.state.smallXScale(startXId);
		var selectRectY = this.state.smallYScale(startYId);
		// width and height of the shaded draggable area
		var selectRectHeight = this.state.smallYScale(lastYId) - this.state.smallYScale(startYId);
		var selectRectWidth = this.state.smallXScale(lastXId) - this.state.smallXScale(startXId);
		
		// Also add the shaded area in the pg_navigator group - Joe
		this.state.highlightRect = this.state.svg.select("#pg_navigator").append("rect")
			.attr("x", overviewX + selectRectX)
			.attr("y", overviewY + selectRectY)
			.attr("id", "pg_navigator_shaded_area")
			.attr("height", selectRectHeight + 4)
			.attr("width", selectRectWidth + 4)
			.attr("class", "pg_draggable")
            .style("fill", "grey")
            .style("opacity", 0.5)
			.call(d3.behavior.drag()
				.on("drag", function(d) {
					/*
					 * drag the highlight in the overview window
					 * notes: account for the width of the rectangle in my x and y calculations
					 * do not use the event x and y, they will be out of range at times. Use the converted values instead.
					 */

					var current = d3.select(this);
					var curX = parseFloat(current.attr("x"));
					var curY = parseFloat(current.attr("y"));

					var rect = self.state.svg.select("#pg_navigator_shaded_area");
					rect.attr("transform","translate(0,0)");

					// limit the range of the x value
					var newX = curX + d3.event.dx;
					var newY = curY + d3.event.dy;

					// Restrict Movement if no need to move map
					if (selectRectHeight === overviewRegionSize) {
						newY = overviewY;
					}
					if (selectRectWidth === overviewRegionSize) {
						newX = overviewX;
					}

					// block from going out of bounds on left
					if (newX < overviewX) {
						newX = overviewX;
					}
					// top
					if (newY < overviewY) {
						newY = overviewY;
					}
					// right
					if (newX + selectRectWidth > overviewX + overviewRegionSize) {
						newX = overviewX + overviewRegionSize - selectRectWidth;
					}

					// bottom
					if (newY + selectRectHeight > overviewY + overviewRegionSize) {
						newY = overviewY + overviewRegionSize - selectRectHeight;
					}
					rect.attr("x", newX);
					// This changes for vertical positioning
					rect.attr("y", newY);

					// adjust x back to have 0,0 as base instead of overviewX, overviewY
					newX = newX - overviewX;
					newY = newY - overviewY;

					// invert newX and newY into posiions in the model and phenotype lists.
					var j = self._invertOverviewDragPosition(self.state.smallXScale,newX);
					var newXPos = j + xCount;

					var jj = self._invertOverviewDragPosition(self.state.smallYScale,newY);
					var newYPos = jj + yCount;

					self._updateGrid(newXPos, newYPos);
		}));
		// set this back to 0 so it doesn't affect other rendering
	},

    // Tip info icon for more info on those text scores
	_createScoresTipIcon: function() {
		var self = this; // Used in the anonymous function 

		this.state.svg.append("text")
			.attr('font-family', 'FontAwesome')
			.text(function(d) {
				return '\uF05A\n'; // Need to convert HTML/CSS unicode to javascript unicode - Joe
			})
			.attr("id", "pg_scores_tip_icon")
			.attr("x", this.state.gridRegion.x - 21) // based on the grid region x, 21 is offset - Joe
			.attr("y", this.state.gridRegion.y - 5) // based on the grid region y, 5 is offset - Joe
			.on("click", function() {
				self._populateDialog(htmlnotes.scores);
			});
	},
		
	_initializeOverviewRegion: function(overviewBoxDim, overviewX, overviewY) {
		// Group the overview region and text together - Joe
		var globalviewGrp = this.state.svg.append("g")
			.attr("id", "pg_navigator");
		
		// rectangular border for overview
		// border color and thickness are defined in phenogrid.css #pg_globalview - Joe
		globalviewGrp.append("rect")
			.attr("x", overviewX)
			.attr("y", overviewY)
			.attr("id", "pg_globalview")
			.attr("height", overviewBoxDim)
			.attr("width", overviewBoxDim)
            .style("fill", "#fff")
            .style("stroke", "#000")
            .style("stroke-width", 2);
	},

	_createSmallScales: function(overviewRegionSize) {
		var self = this;
		var sourceList = [];
		var targetList = [];

		// create list of all item ids within each axis
   	    sourceList = self.state.yAxisRender.groupIDs();
	    targetList = self.state.xAxisRender.groupIDs();

		self.state.smallYScale = d3.scale.ordinal()
			.domain(sourceList.map(function (d) {
                return d; 
            }))
			.rangePoints([0, overviewRegionSize]);

		self.state.smallXScale = d3.scale.ordinal()
			.domain(targetList.map(function (d) {
				var td = d;
				return d; 
            }))
			.rangePoints([0, overviewRegionSize]);   	    
	},

	_invertOverviewDragPosition: function(scale,value) {
		var leftEdges = scale.range();
		var size = scale.rangeBand();
		var j;
		for (j = 0; value > (leftEdges[j] + size); j++) {} 
		// iterate until leftEdges[j]+size is past value
		return j;
	},

	_getComparisonType: function(organism){
		var label = '';

		for (var i in this.state.comparisonTypes) {
			if (organism === this.state.comparisonTypes[i].organism){
				label = this.state.comparisonTypes[i].comparison;
			}
		}
		if (label === ''){
			label = this.state.defaultComparisonType.comparison;
		}
		return label;
	}, 


    // Being called only for the first time the widget is being loaded
	_createDisplay: function() {
        // create the display as usual if there's 'b' and 'metadata' fields found - Joe
        if (this.state.dataManager.isInitialized()) {
            // uses the metadata to get maxICScore - Joe
            this._createColorScale();
            
            // No need to recreate this tooltip on _updateDisplay() - Joe
            this._createTooltipStub();
        
            this._createSvgComponents();

            // Create and postion HTML sections
            
            // Unmatched sources
            this._createUnmatchedSources();
            this._positionUnmatchedSources();
            this._toggleUnmatchedSources();
            
            this._addUnmatchedData(this);
            
            // Options menu
            this._createPhenogridControls();
            this._positionPhenogridControls();
            this._togglePhenogridControls();
        } else {
            this._showNoResults();
        }
        
        this._setSvgSize();
    },
    
    _setSvgSize: function() {
        // Update the width and height of #pg_svg
        var toptitleWidth = parseInt($('#pg_toptitle').attr('x')) + $('#pg_toptitle')[0].getBoundingClientRect().width/2;
        var calculatedSvgWidth = this.state.gridRegion.x + this._gridWidth();
        var svgWidth = (toptitleWidth >= calculatedSvgWidth) ? toptitleWidth : calculatedSvgWidth;
        
        d3.select("#pg_svg")
            .attr('width', svgWidth + 100)
            .attr('height', this.state.gridRegion.y + this._gridHeight() + 100) // Add an extra 100 to height - Joe
    },
    
    // Add the unmatched data to #pg_unmatched_list
    _addUnmatchedData: function(self) {
        // Reset/empty the list
        $('#pg_unmatched_list_data').html('');
            
        // Get unmatched sources, add labels via async ajax calls if not found
        // Must be called after _createUnmatchedSources()
        self.state.unmatchedSources = self._getUnmatchedSources();
        // Proceed if there's any unmatched
        if (self.state.unmatchedSources.length > 0) {
            // Fetch labels for unmatched sources via async ajax calls
            // then format and append them to the pg_unmatched_list div - Joe
            self._formatUnmatchedSources(self.state.unmatchedSources);
        } else {
            // Show no unmatched message
            $('#pg_unmatched_list_data').html('<div class="pg_unmatched_list_item">No ' + self.state.unmatchedButtonLabel + '</div>');
        }
    },
    
    _showNoResults: function() {
        $('#pg_container').html('No results returned.');
    },
    
    _showNoMetadata: function() {
        $('#pg_container').html('No data returned to render the grid cell color for each calculation method.');
    },
    
	// Returns axis data from a ID of models or phenotypes
	_getAxisData: function(key) {
	 	key = key.replace(":", "_");  // keys are stored with _ not : in AxisGroups
        if (this.state.yAxisRender.contains(key)) {
            return this.state.yAxisRender.get(key);
        } else if (this.state.xAxisRender.contains(key)) {
            return this.state.xAxisRender.get(key);
        } else { 
            return null; 
        }
	},

	_getAxisDataPosition: function(key) {
	    if (this.state.yAxisRender.contains(key)) {
		    return this.state.yAxisRender.position(key);
		} else if (this.state.xAxisRender.contains(key)) {
		    return this.state.xAxisRender.position(key);
		} else { 
            return -1; 
        }
	},

	_createColorScale: function() {
        // set a max IC score
        // metadata.maxMaxIC is used to generate the color sace in phenogrid.js _createColorScale()
        // sometimes the 'metadata' field might be missing from the JSON,
        // then the dataLoader.getMaxICScore() returns 0 (default value) - Joe
        this.state.maxICScore = this.state.dataManager.maxICScore;
            
        var maxScore = 0;
        var method = this.state.selectedCalculation; // 4 different calculations (Similarity, Ration (q), Ratio (t), Uniqueness) - Joe

        switch(method){
            case 0: // Similarity
                maxScore = 100;
                break;
            case 1: // Ration (q)
                maxScore = 100;
                break;
            case 2: // Uniqueness
                maxScore = this.state.maxICScore; 
                break;
            case 3: // Ratio (t)
                maxScore = 100;
                break;
            default: 
                maxScore = this.state.maxICScore;
                break;
        }

        this.state.colorScale = new Array(4); // Why 4? One color scale per calculation method - Joe
        for (var i = 0; i < 4; i++) {
            maxScore = 100;
            if (i === 2) {
                maxScore = this.state.maxICScore; // Uniqueness 
            }
            
            // colorRanges has 6 stop colors
            this.state.colorScale[i] = this._getColorScale(maxScore);
        }
	},

    // create color scale for each calculation method
	_getColorScale: function(maxScore) {
        var cs = d3.scale.linear(); // Constructs a new linear scale with the default domain [0,1] and the default range [0,1]. 
        // Simply put: scales transform a number in a certain interval (called the domain) 
        // into a number in another interval (called the range).

        // transform a score domain to a color domain, then transform a color domain into an actual color range
        cs.domain([0, maxScore]); // sets the scale's input domain to the specified array of numbers

        // this.state.colorDomains: [0, 0.2, 0.4, 0.6, 0.8, 1]
        // this.state.colorDomains.map(cs.invert): [0, 20, 40, 60, 80, 100]
        cs.domain(this.state.colorDomains.map(cs.invert));

        // sets the scale's output range to the specified array of values
        cs.range(this.state.colorRanges);

        // returns function
        return cs;
	},

	_createSvgContainer: function() {
        this.state.pgContainer.append("<svg id='pg_svg'><g id='pg_svg_group'></g></svg>");
	
        // Define a font-family for all SVG texts 
        // so we don't have to apply font-family separately for each SVG text - Joe
        this.state.svg = d3.select("#pg_svg_group")
            .style("font-family", "Verdana, Geneva, sans-serif");
	},

	_createPhenogridContainer: function(msg) {
		var container = $('<div id="pg_container"></div>');
		this.state.pgContainer = container;
		this.element.append(container);
	},

	// add a tooltip div stub, this is used to dynamically set a tooltip info 
	_createTooltipStub: function() {
		var pg_tooltip = $("<div>")
						.attr("id", "pg_tooltip");

        var pg_tooltip_inner = $("<div>")
						.attr("id", "pg_tooltip_inner");

        pg_tooltip.append(pg_tooltip_inner);
		// Append to #pg_container
        $('#pg_container').append(pg_tooltip);

        // Hide the tooltip div by default
        this._hideTooltip(pg_tooltip);
	},
    
    // Bind tooltip to SVG X and Y labels as well as grid cells for mouseout - Joe
    _relinkTooltip: function() {
		var self = this;

        $(document).ready(function($){
			var $targets = $("*[data-tooltip]");
			var $tooltip = $('#pg_tooltip');
			if ($targets.length === 0) {
				return;
			}

			self._hideTooltip($tooltip);
			
			// this hides the tooltip when we move mouse out the current element
			$targets.mouseout(function(e){  
				var elem = e.relatedTarget ||  e.toElement || e.fromElement;
				if (typeof(elem) !== 'undefined' ) {
					if (elem.id !== 'pg_tooltip' && elem.id !== "") {					    
				 		self._hideTooltip($tooltip);
					}
				}
			 });
		});
	},
    
    // tooltip is a jquery element
    // elem is the mouseover element, native DOM element - Joe
    _showTooltip: function(tooltip, elem, d) {	
		// Firstly we need to position the tooltip
        
        // The .offset() method allows us to retrieve the current position of an element relative to the document. 
		// get the position of the x/y label or cell where the mouse event happened		
        // .offset() is a jquery method, so we need to use $(elem) - Joe
        var pos = $(elem).offset();
        // position of the pg_container
        var pgContainerPos = $('#pg_container').offset();
        // Calculate the absolute x and y position of the tooltip,
        // otherwise, the tooltip will be incorrectly position when run phenogrid inside monarch-app - Joe
		var leftPos = pos.left - pgContainerPos.left;
        var topPos = pos.top - pgContainerPos.top; 

		// When we hover over a grid row (label text or grid cell), place the tooltip on the far right of the element
		if (elem.parentNode.id.indexOf('grid_row') > -1) {
			// Modify the left and top position of tooltip to create some overlaps
            // otherwise the tooltip will be gone when we move the mouse
            // and we also want to show the crosshair highlighting - Joe
            leftPos += elem.getBoundingClientRect().width; // Don't use elem[0] since elem is native DOM element - Joe
			topPos += elem.getBoundingClientRect().height/2;
		} else { 
            // shift overlap for y label mouseover - Joe
			leftPos += 10;
		}
		var position = {left: leftPos, top: topPos};

        tooltip.css({left: position.left, top: position.top});
        tooltip.show();

        // Secondly we need to add add mouseover and mouseleave events to tooltip
        
        // Remove all event handlers from #pg_tooltip to prevent duplicated mouseover/mouseleave
        // without using this, the previously added mouseover/mouseleave enent will stay there - Joe
        // https://api.jqueryui.com/jquery.widget/#method-_off
        this._off(tooltip, "mouseover");
        this._off(tooltip, "mouseleave");

        // jquery-ui widget factory api: _on()
        // https://api.jqueryui.com/jquery.widget/#method-_on
        // _on() maintains proper this context inside the handlers 
        // so we can reuse this._showEffectsOnMouseover() wihout using `var self = this;`
        this._on(tooltip, {
            "mouseover": function() {
                // show matching highlighting and crosshairs on mouseover tooltip
                this._showEffectsOnMouseover(elem, d);
            }
        });
        
        // Attach mouseleave event to tooltip
        // mouseout doesn't work - Joe
        // The mouseout event triggers when the mouse pointer leaves any child elements as well the selected element.
        // The mouseleave event is only triggered when the mouse pointer leaves the selected element.
        this._on(tooltip, {
            "mouseleave": function() {
                // hide tooltip
                this._hideTooltip(tooltip);
                // remove matching highlighting and crosshairs
                this._mouseout();
            }
        });
	},

    // tooltip is a jquery element
	_hideTooltip: function(tooltip) {
        tooltip.hide();
	},

	// Grid main top title
	_addGridTitle: function() {
		var targetGroup = '';

		// set up defaults as if overview
		var titleText = this.state.gridTitle;

		if ( ! this._isCrossComparisonView()) {
			targetGroup = this.state.selectedCompareTargetGroup[0].name;
			var comp = this._getComparisonType(targetGroup);
			titleText = this.state.gridTitle + " (grouped by " + targetGroup + " " + comp + ")";
		}
		
        // Show the default gridTitle for compare mode
        // not sure what to show for exomiser mode, will decide later - Joe
		if (this.state.owlSimFunction === 'compare') {
			titleText = this.state.gridTitle;
		}

		// Add the top main title to pg_svg_group
		this.state.svg.append("svg:text")
			.attr("id", "pg_toptitle")
			.attr("x", this.state.gridRegion.x + this._gridWidth()/2) // Calculated based on the gridRegion - Joe
			.attr("y", 40) // Fixed y position - Joe
			.style('text-anchor', 'middle') // Center the main title - Joe
            .style('font-size', '1.4em')
            .style('font-weight', 'bold')
			.text(titleText);
	},


	// Positioned next to the grid region bottom
	_addLogoImage: function() { 
		var self = this;
        this.state.svg.append("svg:image")
			.attr("xlink:href", images.logo)
			.attr("x", this.state.logo.x)
			.attr("y", this.state.logo.y)
			.attr("id", "pg_logo")
			.attr('class', 'pg_cursor_pointer')
			.attr("width", this.state.logo.width)
			.attr("height", this.state.logo.height)
			.on('click', function() {
				window.open(self.state.serverURL, '_blank');
			});
	},

    // data is either cell data or label data details - Joe
	_createHoverBox: function(data){
		var id;

		// for cells we need to check the invertAxis to adjust for correct id
		if (data.type === 'cell') {
            if (this.state.invertAxis) {
                id = data.target_id;
            } else {
                id = data.source_id;
            }
		} else {
			id = data.id;
		}

		// format data for rendering in a tooltip
		var retData = this._renderTooltip(id, data);   

		// update the stub pg_tooltip div dynamically to display
		$("#pg_tooltip_inner").empty();
		$("#pg_tooltip_inner").html(retData);

		// For phenotype ontology tree 
		if (data.type === 'phenotype') {
			// https://api.jqueryui.com/jquery.widget/#method-_on
			// Binds click event to the ontology tree expand icon - Joe
			// _renderTooltip(), the font awesome icon <i> element follows the form of id="pg_expandOntology_HP_0001300" - Joe
			var expandOntol_icon = $('#pg_expandOntology_' + id);
			this._on(expandOntol_icon, {
				"click": function(event) {
					this._expandOntology(id);
				}
			});
		}
        
        // For genotype expansion
		if (data.type === 'gene') {
			// In renderTooltip(), the font awesome icon <i> element follows the form of id="pg_insert_genotypes_MGI_98297" - Joe
			var insert = $('#pg_insert_genotypes_' + id);
            this._on(insert, {
				"click": function(event) {
					this._insertGenotypes(id);
				}
			});
            
            var remove = $('#pg_remove_genotypes_' + id);
			this._on(remove, {
				"click": function(event) {
					this._removeGenotypes(id);
				}
			});
		}
	},

    // main method for rendering tooltip content
    _renderTooltip: function(id, data) {
        var htmlContent = '';

        if (data.type === 'phenotype') {
            // phenotype tooltip shows type, id, sum, frequency, and ontology expansion
            var tooltipType = (typeof(data.type) !== 'undefined' ? "<strong>" + Utils.capitalizeString(data.type) + ": </strong> " + this._encodeTooltipHref(data.type, id, data.label) + "<br>" : "");
            var ic = (typeof(data.IC) !== 'undefined' ? "<strong>IC:</strong> " + data.IC.toFixed(2)+"<br>" : "");
            var sum = (typeof(data.sum) !== 'undefined' ? "<strong>Sum:</strong> " + data.sum.toFixed(2)+"<br>" : "");
            var frequency = (typeof(data.count) !== 'undefined' ? "<strong>Frequency:</strong> " + data.count +"<br>" : "");

            htmlContent = tooltipType + ic + sum + frequency;
                            
            var expanded = false;
            var ontologyData = "<br>";

            var cached = this.state.dataLoader.checkOntologyCache(id);

            if (typeof(cached) !== 'undefined') {
                expanded = true;

                //HACKISH, BUT WORKS FOR NOW.  LIMITERS THAT ALLOW FOR TREE CONSTRUCTION BUT DONT NEED TO BE PASSED BETWEEN RECURSIONS
                this.state.ontologyTreesDone = 0;
                this.state.ontologyTreeHeight = 0;
                var tree = "<div id='hpoDiv'>" + this._buildOntologyTree(id.replace("_", ":"), cached.edges, 0) + "</div>";
                if (tree === "<br>"){
                    ontologyData += "<em>No Classification hierarchy Found</em>";
                } else {
                    ontologyData += "<strong>Classification hierarchy:</strong>" + tree;
                }
            }
            
            if (expanded){
                htmlContent += ontologyData;
            } else {
                htmlContent += "<br><div class=\"pg_expand_ontology\" id=\"pg_expandOntology_" + id + "\">Expand classification hierarchy<i class=\"pg_expand_ontology_icon fa fa-plus-circle pg_cursor_pointer\"></i></div>";
            }	
        } else if (data.type === 'cell') {
            var suffix = "";
            var selCalc = this.state.selectedCalculation;

            var prefix, targetId, sourceId, targetInfo, sourceInfo;

            sourceId = data.source_id;
            targetId = data.target_id;
                
            if (this.state.invertAxis) {
                targetInfo = this.state.yAxisRender.get(data.target_id); 
                sourceInfo = this.state.xAxisRender.get(data.source_id); 			
            } else {
                targetInfo = this.state.xAxisRender.get(data.target_id); 
                sourceInfo = this.state.yAxisRender.get(data.source_id); 						
            }

            for (var idx in this.state.similarityCalculation) {	
                if (this.state.similarityCalculation[idx].calc === this.state.selectedCalculation) {
                    prefix = this.state.similarityCalculation[idx].label;
                    break;
                }
            }

            // If the selected calculation isn't percentage based (aka similarity) make it a percentage
            if (selCalc !== 2) {
                suffix = '%';
            }

            htmlContent = "<strong>" + Utils.capitalizeString(sourceInfo.type) + "</strong><br>" 
                          + this._encodeTooltipHref(sourceInfo.type, sourceId, data.a_label ) +  " " + Utils.formatScore(data.a_IC.toFixed(2)) + "<br><br>" 
                          + "<strong>In-common</strong><br>" 
                          + this._encodeTooltipHref(sourceInfo.type, data.subsumer_id, data.subsumer_label) + " (" + Utils.formatScore(data.subsumer_IC.toFixed(2)) + ", " + prefix + " " + data.value[this.state.selectedCalculation].toFixed(2) + '%' + ")<br><br>" 
                          + "<strong>Match</strong><br>" 
                          + this._encodeTooltipHref(sourceInfo.type, data.b_id, data.b_label ) + Utils.formatScore(data.b_IC.toFixed(2)) + "<br><br>" 
                          + "<strong>" + Utils.capitalizeString(targetInfo.type) + " (" + data.targetGroup + ")</strong><br>" 
                          + this._encodeTooltipHref(targetInfo.type, targetInfo.id, targetInfo.label);
        } else {
            // disease and gene/genotype share common items
            var tooltipType = (typeof(data.type) !== 'undefined' ? "<strong>" + Utils.capitalizeString(data.type) + ": </strong> " + this._encodeTooltipHref(data.type, id, data.label) + "<br>" : "");
            var rank = (typeof(data.rank) !== 'undefined' ? "<strong>Rank:</strong> " + data.rank+"<br>" : "");
            var score = (typeof(data.score) !== 'undefined' ? "<strong>Score:</strong> " + data.score+"<br>" : "");	
            var species = (typeof(data.targetGroup) !== 'undefined' ? "<strong>Species:</strong> " + data.targetGroup+"<br>" : "");

            htmlContent = tooltipType + rank + score + species;
            
            // Add genotype expansion link to genes
            // genotype expansion won't work with owlSimFunction === 'compare' since we use
            // 'compare' as the key of the named array, while the added genotypes are named based on their species - Joe
            if (data.type === 'gene') {
                // DISABLED for now, just uncomment to ENABLE genotype expansion - Joe
                // for gene and single species mode only, add genotype expansion link
                if (this.state.selectedCompareTargetGroup.length === 1 && this.state.selectedCompareTargetGroup[0].name !== 'compare') {
                    var expanded = this.state.dataManager.isExpanded(id); // gene id

                    if (expanded){
                        htmlContent += "<br><div class=\"pg_expand_genotype\" data-species=\"" + data.targetGroup + "\" id=\"pg_remove_genotypes_" + id + "\">Remove associated genotypes<i class=\"pg_expand_genotype_icon fa fa-minus-circle pg_cursor_pointer\"></i></div>"; 
                    } else {
                        htmlContent += "<br><div class=\"pg_expand_genotype\" data-species=\"" + data.targetGroup + "\" id=\"pg_insert_genotypes_" + id + "\">Insert associated genotypes<i class=\"pg_expand_genotype_icon fa fa-plus-circle pg_cursor_pointer\"></i></div>"; 
                    }
                }
                //
            }
        }
        
         // Finally return the rendered HTML result
		return htmlContent;
    },
    
    // also encode the labels into html entities, otherwise they will mess up the tooltip content format
	_encodeTooltipHref: function(type, id, label) {
		return "<a href=\"" + this.state.serverURL +"/" +  type +"/" + id + "\" target=\"_blank\">" + Utils.encodeHtmlEntity(label) + "</a>";
	},
    
	// This builds the string to show the relations of the ontology nodes.  It recursively cycles through the edges and in the end returns the full visual structure displayed in the phenotype hover
	_buildOntologyTree: function(id, edges, level) {
		var results = "";
		var nextResult;
		var nextLevel = level + 1;

		for (var j in edges){
			if ( ! edges.hasOwnProperty(j)) {
				break;
			}
			// Currently only allows subClassOf relations.  When new relations are introducted, it should be simple to implement
			if (edges[j].pred === "subClassOf" && this.state.ontologyTreesDone != this.state.ontologyTreeAmounts){
				if (edges[j].sub === id){
					if (this.state.ontologyTreeHeight < nextLevel){
						this.state.ontologyTreeHeight++;
					}
					nextResult = this._buildOntologyTree(edges[j].obj, edges, nextLevel);
					if (nextResult === ""){
						// Bolds the 'top of the line' to see what is the root or closet to the root.  It will hit this point either when it reaches the ontologyDepth or there are no parents
						results += "<br>" + this._buildIndentMark(this.state.ontologyTreeHeight - nextLevel) + "<strong>" + this._buildOntologyHyperLink(edges[j].obj) + "</strong>";
						this.state.ontologyTreesDone++;
					} else {
						results += nextResult + "<br>" + this._buildIndentMark(this.state.ontologyTreeHeight - nextLevel) + this._buildOntologyHyperLink(edges[j].obj);
					}
					
					if (level === 0){
						results += "<br>" + this._buildIndentMark(this.state.ontologyTreeHeight) + this.state.dataManager.getOntologyLabel(id) + "<br>";
						this.state.ontologyTreeHeight = 0;
					}
				}
			}
		}
		return results;
	},

	_buildIndentMark: function (treeHeight){
		var indent = "<em class='pg_ontology_tree_indent'></em>";

		if (treeHeight === 0) {
			return indent;
		}

		for (var i = 1; i < treeHeight; i++){
			indent += "<em class='pg_ontology_tree_indent'></em>";
		}
			 
		return indent + '&#8627'; // HTML entity - Joe
	},

	// Based on the ID, it pulls the label from CacheLabels and creates a hyperlink that allows the user to go to the respective phenotype page
	_buildOntologyHyperLink: function(id){
		return "<a href=\"" + this.state.serverURL + "/phenotype/" + id + "\" target=\"_blank\">" + this.state.dataManager.getOntologyLabel(id) + "</a>";
	},

	_createTargetGroupDividerLines: function() {
		var gridRegion = this.state.gridRegion;
		var x = gridRegion.x;     
		var y = gridRegion.y;   
		var height = this._gridHeight() + gridRegion.colLabelOffset;// adjust due to extending it to the col labels
		var width = this._gridWidth();

		if (this._isCrossComparisonView() ) {
			//var grps = self.state.selectedCompareTargetGroup.forEach(function(d) { if(d.crossComparisonView)return d; });
			var numOfTargetGroup = this.state.selectedCompareTargetGroup.length; 
			var xScale = this.state.xAxisRender.getScale();

			//var cellsDisplayedPer = (self.state.defaultSingleTargetDisplayLimit / numOfTargetGroup);
			var cellsDisplayedPer = this.state.defaultCrossCompareTargetLimitPerTargetGroup;
			var x1 = 0;
			if (this.state.invertAxis) {
				x1 = ((gridRegion.ypad * (cellsDisplayedPer-1)) + gridRegion.cellht);  //-gridRegion.rowLabelOffset; 								
			} else {
				x1 = ((gridRegion.xpad * (cellsDisplayedPer-1)) + gridRegion.cellwd); 
				y = y - gridRegion.colLabelOffset;  // offset the line to reach the labels
			}

			for (var i = 1; i < numOfTargetGroup; i++) {
				var fudgeFactor = 3; //magic num
				if (i > 1) {
					fudgeFactor = 1;
				}
				x1 = (x1 * i)+ fudgeFactor;  // add a few extra padding so it won't overlap cells

				if (this.state.invertAxis) {
					this.state.svg.append("line")				
					.attr("class", "pg_target_grp_divider")
					.attr("transform","translate(" + x + "," + y+ ")")					
					.attr("x1", gridRegion.rowLabelOffset)  // 0
					.attr("y1", x1-2)
					.attr("x2", width)   // adjust this for to go beyond the row label
					.attr("y2", x1-2)
                    .style("stroke", "black")
                    .style("stroke-width", 1)
                    .style("shape-rendering", "crispEdges");

				} else {
					// render vertical divider line
					this.state.svg.append("line")				
					.attr("class", "pg_target_grp_divider")
					.attr("transform","translate(" + x + "," + y+ ")")					
					.attr("x1", x1)
					.attr("y1", 0)
					.attr("x2", x1)
					.attr("y2", height)
                    .style("stroke", "black")
                    .style("stroke-width", 1)
                    .style("shape-rendering", "crispEdges");


					// render the slanted line between targetGroup (targetGroup) columns
					this.state.svg.append("line")				
					.attr("class", "pg_target_grp_divider")
					.attr("transform","translate(" + x + "," + y + ")rotate(-45 " + x1 + " 0)")				
					.attr("x1", x1)
					.attr("y1", 0)
					.attr("x2", x1 + 110)  // extend the line out to underline the labels					
					.attr("y2", 0)
                    .style("stroke", "black")
                    .style("stroke-width", 1)
                    .style("shape-rendering", "crispEdges");
				}
			}
		}
	},


	/*
	 * Change the list of phenotypes and filter the models accordingly.
	 */
	_updateGrid: function(newXPos, newYPos){
		var xSize = this.state.xAxisRender.groupLength();
		var ySize = this.state.yAxisRender.groupLength();
		var newXEndPos, newYEndPos;

		if (newXPos >= xSize){
			this.state.currXIdx = xSize;
		} else {
			this.state.currXIdx = newXPos;
		}

		if (newYPos >= ySize){
			this.state.currYIdx = ySize;
		} else {
			this.state.currYIdx = newYPos;
		}

	
		// note: that the currXIdx accounts for the size of the hightlighted selection area
		// so, the starting render position is this size minus the display limit
		this.state.xAxisRender.setRenderStartPos(this.state.currXIdx-this.state.xAxisRender.displayLength());
		this.state.xAxisRender.setRenderEndPos(this.state.currXIdx);

		this.state.yAxisRender.setRenderStartPos(this.state.currYIdx-this.state.yAxisRender.displayLength());
		this.state.yAxisRender.setRenderEndPos(this.state.currYIdx);
		this._clearGrid();
		this._createGrid();
        
        // this must be called here so the tooltip disappears when we mouseout the current element - Joe
		this._relinkTooltip();
	},

	_clearGrid: function() {
		this.state.svg.selectAll("g.row").remove();
		this.state.svg.selectAll("g.column").remove();
		this.state.svg.selectAll("g.pg_score_text").remove();
	},

	_createOverviewTargetGroupLabels: function () {
		if (this.state.owlSimFunction !== 'compare' && this.state.owlSimFunction !== 'exomiser') {
            var self = this;
            // targetGroupList is an array that contains all the selected targetGroup names
            var targetGroupList = self.state.selectedCompareTargetGroup.map(function(d){return d.name;}); 

            // Inverted and multi targetGroup
            if (self.state.invertAxis) { 
                var heightPerTargetGroup = self._gridHeight()/targetGroupList.length;

                this.state.svg.selectAll(".pg_targetGroup_name")
                    .data(targetGroupList)
                    .enter()
                    .append("text")
                    .attr("x", self.state.gridRegion.x + self._gridWidth() + 20) // 20 is margin - Joe
                    .attr("y", function(d, i) { 
                            return self.state.gridRegion.y + ((i + 1/2 ) * heightPerTargetGroup);
                        })
                    .attr('transform', function(d, i) {
                        var currX = self.state.gridRegion.x + self._gridWidth() + 20;
                        var currY = self.state.gridRegion.y + ((i + 1/2 ) * heightPerTargetGroup);
                        return 'rotate(90 ' + currX + ' ' + currY + ')';
                    }) // rotate by 90 degrees 
                    .attr("class", "pg_targetGroup_name") // Need to use id instead of class - Joe
                    .text(function (d, i){return targetGroupList[i];})
                    .attr("text-anchor", "middle"); // Keep labels aligned in middle vertically
            } else {
            	var widthPerTargetGroup = self._gridWidth()/targetGroupList.length;

                this.state.svg.selectAll(".pg_targetGroup_name")
                    .data(targetGroupList)
                    .enter()
                    .append("text")
                    .attr("x", function(d, i){ 
                            return self.state.gridRegion.x + ((i + 1/2 ) * widthPerTargetGroup);
                        })
                    .attr("y", self.state.gridRegion.y - 110) // based on the grid region y, margin-top -110 - Joe
                    .attr("class", "pg_targetGroup_name") // Need to use id instead of class - Joe
                    .text(function(d, i){return targetGroupList[i];})
                    .attr("text-anchor", function() {
                        if (self._isCrossComparisonView()) {
                            return 'start'; // Try to align with the rotated divider lines for cross-target comparison
                        } else {
                            return 'middle'; // Position the label in middle for single species
                        }
                    }); 
            }
        } 
	},

	_populateDialog: function(text) {
		var SplitText = "Title";
		var $dialog = $('<div></div>')
			.html(SplitText )
			.dialog({
				modal: true,
				width: 400,
				minHeight: 200,
				height: 260,
				maxHeight: 300,
				minWidth: 400,
				resizable: false,
				draggable: true,
				dialogClass: "faqdialog_bg_color",
				position: {
			 		my: "top", 
					at: "top+25%",
					of: "#pg_container"
				},
				title: 'Phenogrid Notes',
				
				// Replace default jquery-ui titlebar close icon with font awesome - Joe
				open: function(event, ui) {
					// remove default close icon
					$('.ui-dialog-titlebar-close span').removeClass('ui-icon ui-icon-thickclose');
					// Yuck they have close text let's remove that
					$('.ui-dialog-titlebar-close span').text('');
					// Lets add font awesome close icon
					$('.ui-dialog-titlebar-close span').addClass('fa fa-times');
				}
			});

		$dialog.html(text);
		$dialog.dialog('open');
	},

	/*
	 * Add the gradient legend (bar and label texts) to the grid bottom
	 */
	_createGradientLegend: function(){
		// Create a group for gradient bar and legend texts - Joe
		var gradientGrp = this.state.svg.append("g")
			.attr('id', 'pg_gradient_legend');
			
		var gridRegion = this.state.gridRegion;

		// The <linearGradient> element is used to define a linear gradient background - Joe
		// The <linearGradient> element must be nested within a <defs> tag. 
		// The <defs> tag is short for definitions and contains definition of special elements (such as gradients)
		var gradient = gradientGrp.append("svg:defs").append("svg:linearGradient") 
			.attr("id", "pg_gradient_legend_fill") // this id is used for the fill attribute - Joe
			.attr("x1", "0")
			.attr("x2", "100%")
			.attr("y1", "0%")
			.attr("y2", "0%");

		// create the color stops
		for (var j in this.state.colorDomains) {
			if ( ! this.state.colorDomains.hasOwnProperty(j)) {
				break;
			}
			
			gradient.append("svg:stop") // SVG stop element
				.attr("offset", this.state.colorDomains[j]) // The offset attribute is used to define where the gradient color begin and end
				.style("stop-color", this.state.colorRanges[j]);
		}

		// Create the gradient rect
		gradientGrp.append("rect")
			.attr("x", gridRegion.x)
			.attr("y", gridRegion.y + this._gridHeight() + 60) // use x and y instead of transform since rect has x and y, 60 is margin - Joe
			.attr("id", "pg_gradient_legend_rect")
			.attr("width", this.state.gradientRegion.width)
			.attr("height", this.state.gradientRegion.height) 
			.attr("fill", "url(#pg_gradient_legend_fill)"); // The fill attribute links the element to the gradient defined in svg:linearGradient - Joe
		
		// Now create the label texts
	    var lowText, highText, labelText;

		// Texts are based on the calculation method
		for (var idx in this.state.similarityCalculation) {	
			if ( ! this.state.similarityCalculation.hasOwnProperty(idx)) {
				break;
			}			
			if (this.state.similarityCalculation[idx].calc === this.state.selectedCalculation) {
				lowText = this.state.similarityCalculation[idx].low;
				highText = this.state.similarityCalculation[idx].high;
				labelText = this.state.similarityCalculation[idx].label;
				break;
			}
		}

		// Create a group for gradient bar and legends - Joe
		var gradientTextGrp = this.state.svg.select('#pg_gradient_legend').append("g")
			.attr('id', 'pg_gradient_legend_texts')
            .style('font-size', '11px');
		
		// Dynamicly change, relative to grid region - Joe
		var yTexts = gridRegion.y + this._gridHeight() + 57; // 57 is margin - Joe

		// create and position the low label
		gradientTextGrp.append("svg:text")
			.attr("x", gridRegion.x)
			.attr("y", yTexts)
			.style('text-anchor', 'start') // Actually no need to specify this here since it's the default - Joe
			.text(lowText);

		// create and position the display type label
		gradientTextGrp.append("svg:text")
			.attr("x", gridRegion.x + (this.state.gradientRegion.width/2))
			.attr("y", yTexts)	
			.style('text-anchor', 'middle') // This renders the middle of the text string as the current text position x - Joe			
			.text(labelText);

		// create and position the high label
		gradientTextGrp.append("svg:text")
			.attr("x", gridRegion.x + this.state.gradientRegion.width) 
			.attr("y", yTexts)	
            .style('text-anchor', 'end') // This renders the end of the text to align the end of the rect - Joe 			
			.text(highText);
	},


    _createUnmatchedSources: function() {
        var pg_unmatched = $('<div id="pg_unmatched"></div>');

        // Not in the #pg_svg_group div since it's HTML - Joe
		$('#pg_container').append(pg_unmatched);
        
        // Need to put .pg_unmatched_list_arrow_border span before .pg_unmatched_list_arrow span - Joe
		var pg_unmatched_list = '<div id="pg_unmatched_list"><i id="pg_unmatched_close" class="fa fa-times"></i><span class="pg_unmatched_list_arrow_border"></span><span class="pg_unmatched_list_arrow"></span><div id="pg_unmatched_list_data"></div></div>';
		
		// Hide/show unmatched - button - Joe
		var pg_unmatched_btn ='<div id="pg_unmatched_btn"><i class="fa fa-exclamation-triangle"></i> ' + this.state.unmatchedButtonLabel + ' </div>';
 
        pg_unmatched.append(pg_unmatched_list);
		pg_unmatched.append(pg_unmatched_btn);

        $("#pg_unmatched_list").hide(); // Hide by default
    },

	// Phengrid controls/options
	_createPhenogridControls: function() {
		var self = this; // Use self inside anonymous functions 
		
		var phenogridControls = $('<div id="pg_controls"></div>');

		// Not in the #pg_svg_group div since it's HTML - Joe
		$('#pg_container').append(phenogridControls);
		
		// Need to put .pg_controls_options_arrow_border span before .pg_controls_options_arrow span - Joe
		var optionhtml = '<div id="pg_controls_options"><i id="pg_controls_close"class="fa fa-times"></i><span class="pg_controls_options_arrow_border"></span><span class="pg_controls_options_arrow"></span></div>';
		
		// Hide/show panel - button - Joe
		var slideBtn = '<div id="pg_slide_btn"><i class="fa fa-bars"></i> OPTIONS</div>';
		
		var options = $(optionhtml);
        
        // only show the Organism(s) option when not in compare mode - Joe
        if (this.state.owlSimFunction !== 'compare') {
            var orgSel = this._createOrganismSelection();
		    options.append(orgSel);
        }

		var sortSel = this._createSortPhenotypeSelection();
		options.append(sortSel);
		var calcSel = this._createCalculationSelection();
		options.append(calcSel);
		var axisSel = this._createAxisSelection();
		options.append(axisSel);
		
        var exportBtn = this._createExportPhenogridButton();
		options.append(exportBtn);
        
        var aboutPhenogrid = this._createAboutPhenogrid();
		options.append(aboutPhenogrid);
		
		phenogridControls.append(options);
		
		// Append slide button - Joe
		phenogridControls.append(slideBtn);
		
        // Hide options menu by default
        $("#pg_controls_options").hide(); 
        
		// add the handler for the checkboxes control
		$("#pg_organism").change(function(d) {
			var items = this.childNodes; // this refers to $("#pg_organism") object - Joe
			var temp = [];
			for (var idx = 0; idx < items.length; idx++) {
				if (items[idx].childNodes[0].checked) {
					var rec = self._getTargetGroupInfo(self, items[idx].textContent);
					temp.push(rec);
				}
			}
			
			if (temp.length > 0) {
				self.state.selectedCompareTargetGroup = temp;				
			} else {
				alert("You must have at least 1 targetGroup selected.");
			}

			self._createAxisRenderingGroups();

            self._updateDisplay();
            
            // Update unmatched sources due to changes of species
            // No need to call this for other control actions - Joe
            self._addUnmatchedData(self);
		});

		$("#pg_calculation").change(function(d) {
			self.state.selectedCalculation = parseInt(d.target.value); // d.target.value returns quoted number - Joe
            self._updateDisplay();
		});

		// add the handler for the select control
		$("#pg_sortphenotypes").change(function(d) {
			self.state.selectedSort = d.target.value;
			// sort source with default sorting type
			if (self.state.invertAxis){
				self.state.xAxisRender.sort(self.state.selectedSort); 
			} else {
				self.state.yAxisRender.sort(self.state.selectedSort); 
			}
            self._updateDisplay();
		});

		$("#pg_axisflip").click(function() {	
			var $this = $(this);
			// $this will contain a reference to the checkbox 
			if ($this.is(':checked')) {
				self.state.invertAxis = true;
			} else {
				self.state.invertAxis = false;
			}
		    self._setAxisRenderers();
            self._updateDisplay();
		});

        // Click save button to export the current phenogrid view as a SVG file - Joe
        $("#pg_export").click(function() {	
            // SVG styles are applied with D3, not in CSS for this exporting purpose
            var svgElementClone = $('#pg_svg').clone(); // clone the svg to manipulate
            // Use data uri for svg logo
            svgElementClone.find('#pg_logo').attr('href',images.logo);
            svgElementClone.find('#pg_scores_tip_icon').remove(); // remove fontawesome icon
            svgElementClone.find('#pg_monarchinitiative_text').removeClass('pg_hide'); // Show text in exported SVG
            
            var svgStr = '<svg xmlns="http://www.w3.org/2000/svg">' + svgElementClone.html() + '</svg>';
            // The standard W3C File API Blob interface is not available in all browsers. 
            // Blob.js is a cross-browser Blob implementation that solves this.
            var blob = new Blob([svgStr], {type: "image/svg+xml"});
            filesaver.saveAs(blob, "phenogrid.svg");
		});
        
		// FAQ popups
		$("#pg_sorts_faq").click("click", function(){
			self._populateDialog(htmlnotes.sorts);
		});

		$("#pg_calcs_faq").click(function(){
			self._populateDialog(htmlnotes.calcs);
		});
		
		$("#pg_about_phenogrid").click(function() {	
			self._populateDialog(htmlnotes.faq);
		});
	},

    // To be used for exported phenogrid SVG, hide this by default
    _createMonarchInitiativeText: function() {
        this.state.svg.append("text")
			.attr("x", this.state.gridRegion.x)
			.attr("y", this.state.gridRegion.y + this._gridHeight() + 90) // 90 is margin
			.attr("id", "pg_monarchinitiative_text")
			.attr('class', 'pg_hide') // Only show this text in exported SVG of Phenogrid 
            .style('font-size', '11px')
			.text(this.state.serverURL);
    },
    
	// Position the control panel when the gridRegion changes
	_positionPhenogridControls: function(){
		// Note: CANNOT use this inside _createPhenogridControls() since the _createGrid() is called after it
		// we won't have the _gridHeight() by that time - Joe
		var gridRegion = this.state.gridRegion; 
		var marginTop = 17; // Create some whitespace between the button and the y labels 
		$('#pg_slide_btn').css('top', gridRegion.y + this._gridHeight() + marginTop);
        $('#pg_slide_btn').css('left', gridRegion.x + this._gridWidth() + 20); // 20 is margin
		// The height of #pg_controls_options defined in phenogrid.css - Joe
		var pg_ctrl_options = $('#pg_controls_options');
		// options div has an down arrow, -10 to create some space between the down arrow and the button - Joe
		pg_ctrl_options.css('top', gridRegion.y + this._gridHeight() - pg_ctrl_options.outerHeight() - 10 + marginTop);
        pg_ctrl_options.css('left', gridRegion.x + this._gridWidth() + 20);
    },	
	
	_createOrganismSelection: function() {
		var optionhtml = "<div class='pg_ctrl_label'>Organism(s)</div>" + 
			"<div id='pg_organism'>";
		for (var idx in this.state.targetGroupList) {
			if ( ! this.state.targetGroupList.hasOwnProperty(idx)) {
				break;
			}
			var checked = "";
            var disabled = "";
            var linethrough = "";
			if (this.state.targetGroupList[idx].active) { 
				if (this._isTargetGroupSelected(this, this.state.targetGroupList[idx].name)) {
					checked = "checked";
				}
                // If there is no data for a given species, even if it's set as active in config, 
                // it should not be shown in the species selector - Joe
                if (this.state.dataManager.length('target', this.state.targetGroupList[idx].name) === 0) {
					disabled = "disabled";
                    linethrough = "pg_linethrough";
				}

				optionhtml += "<div class='pg_select_item " + linethrough + "'><input type='checkbox' value=\"" + this.state.targetGroupList[idx].name +
				"\" " + checked + disabled + ">" + this.state.targetGroupList[idx].name + '</div>';
			}
		}
		optionhtml += "</div><div class='pg_hr'></div>";

		return $(optionhtml);
	},

	// create the html necessary for selecting the calculation
	_createCalculationSelection: function () {
		var optionhtml = "<div class='pg_ctrl_label'>Calculation Method"+
				" <i class='fa fa-info-circle cursor_pointer' id='pg_calcs_faq'></i></div>" + // <i class='fa fa-info-circle'></i> FontAwesome - Joe
				"<div id='pg_calculation'>";

		for (var idx in this.state.similarityCalculation) {
			if ( ! this.state.similarityCalculation.hasOwnProperty(idx)) {
				break;
			}			
			var checked = "";
			if (this.state.similarityCalculation[idx].calc === this.state.selectedCalculation) {
				checked = "checked";
			}
			// We need the name attr for radio inputs so only one is checked - Joe
			optionhtml += "<div class='pg_select_item'><input type='radio' name='pg_calc_method' value='" + this.state.similarityCalculation[idx].calc + "' " + checked + ">" + this.state.similarityCalculation[idx].label + '</div>';
		}
		optionhtml += "</div><div class='pg_hr'></div>";
		return $(optionhtml);
	},

	// create the html necessary for selecting the sort
	_createSortPhenotypeSelection: function () {
		var optionhtml ="<div class='pg_ctrl_label'>Sort Phenotypes" + 
				" <i class='fa fa-info-circle cursor_pointer' id='pg_sorts_faq'></i></div>" + // <i class='fa fa-info-circle'></i> FontAwesome - Joe
				"<div id='pg_sortphenotypes'>";

		for (var idx in this.state.phenotypeSort) {
			if ( ! this.state.phenotypeSort.hasOwnProperty(idx)) {
				break;
			}

			var checked = "";
			if (this.state.phenotypeSort[idx] === this.state.selectedSort) {
				checked = "checked";
			}
			// We need the name attr for radio inputs so only one is checked - Joe
			optionhtml += "<div class='pg_select_item'><input type='radio' name='pg_sort' value='" + this.state.phenotypeSort[idx] + "' " + checked + ">" + this.state.phenotypeSort[idx] + '</div>';
		}
		optionhtml += "</div><div class='pg_hr'></div>";
		return $(optionhtml);
	},

	// create the html necessary for selecting the axis flip
	_createAxisSelection: function () {
		var checked = "";
		if (this.state.invertAxis) {
			checked = "checked";
		}
		var optionhtml = '<div class="pg_select_item"><input type="checkbox" id="pg_axisflip"' + checked + '>Invert Axis</div><div class="pg_hr"></div>'; 
		return $(optionhtml);
	},

	// create about phenogrid FAQ inside the controls/options - Joe
	_createAboutPhenogrid: function () {
		var html = '<div class="pg_select_item">About Phenogrid <i class="fa fa-info-circle cursor_pointer" id="pg_about_phenogrid"></i></div>'; 
		return $(html);
	},
	
    // Export current state of phenogrid as SVG file to be used in publications
    _createExportPhenogridButton: function() {
        var btn = '<div id="pg_export">Save as SVG...</div><div class="pg_hr"></div>';
        return $(btn);
    },
    
    // Returns the unmatched phenotype IDs as an array
	_getUnmatchedSources: function() {
		// Already removed duplicated phenotype IDs
        var origSourceList = this.state.dataLoader.origSourceList; // Get the original source list of IDs
		var matchedList = this.state.yAxisRender.groupIDs(); // Get all the matched source IDs

		var normalizedMatchedList = [];
		var unmatchedList = [];

        // Normalize. E.g., HP_0000252 -> HP:0000252
		for (var j in matchedList){
			normalizedMatchedList.push(matchedList[j].replace("_", ":"));
		}

        // Now origSourceList should contain all elements that are in normalizedMatchedList
        // but it's very possible that some elements in origSourceList are not in normalizedMatchedList - Joe
        for (var i in origSourceList) {
			if (normalizedMatchedList.indexOf(origSourceList[i]) === -1) {
				// if there unmatched set is empty, add this umatched phenotype
				unmatchedList.push(origSourceList[i]);
			}
		}

        return unmatchedList;
	},

    // Position the unmatched sources when the gridRegion changes
	_positionUnmatchedSources: function(){
		var gridRegion = this.state.gridRegion; 
		$('#pg_unmatched_btn').css('top', gridRegion.y + this._gridHeight() + 17); // 17 is top margin
        $('#pg_unmatched_list').css('top', gridRegion.y + this._gridHeight() + $('#pg_unmatched_btn').outerHeight() + + 17 + 10);
        $('#pg_unmatched_list').css('width', gridRegion.x + this._gridWidth());
    },	
    
    // ajax callback
    _fetchSourceLabelCallback: function(self, target, targets, data) {
        var label;
        // Show id if label is not found
        if (data.label !== undefined) {
            label = Utils.getShortLabel(data.label, self.state.labelCharDisplayCount);
        } else {
            label = data.id;
        }

        var pg_unmatched_list_item = '<div class="pg_unmatched_list_item"><a href="' + self.state.serverURL + '/phenotype/' + data.id + '" target="_blank">' + label + '</a></div>';
        $('#pg_unmatched_list_data').append(pg_unmatched_list_item);
        
        // iterative back to process to make sure we processed all the targets
        self._formatUnmatchedSources(targets);
    },
    
    // ajax
    _fetchUnmatchedLabel: function(target, targets, callback) {
        var self = this;
        
        // Note: phenotype label is not in the unmatched array when this widget runs as a standalone app,
        // so we need to fetch each label from the monarch-app server
        // Sample output: http://beta.monarchinitiative.org/phenotype/HP:0000746.json
        $.ajax({
            url: this.state.serverURL + "/phenotype/" + target + ".json",
            async: true,
            method: 'GET',
            dataType: 'json',
            success: function(data) {
                callback(self, target, targets, data); // callback needs self for reference to global this - Joe
            },
            error: function (xhr, errorType, exception) {
                console.log("We are having problems fetching the unmatched phenotypes from the server. Please try again later. Error:" + xhr.status);
            }
        });
    },
    
    _formatUnmatchedSources: function(targetGrpList) {
        if (targetGrpList.length > 0) {
            var target = targetGrpList[0];  // pull off the first to start processing
            targetGrpList = targetGrpList.slice(1);

            var callback = this._fetchSourceLabelCallback;
            // Make the ajax call to fetch phenotype label
            this._fetchUnmatchedLabel(target, targetGrpList, callback);
        }
    },

	/*
	 * given an array of phenotype objects edit the object array.
	 * items are either ontology ids as strings, in which case they are handled as is,
	 * or they are objects of the form { "id": <id>, "observed": <obs>}.
	 * in that case take id if "observed" is "positive"
	 * refactor: _filterPhenotypeResults
	 */
	_parseQuerySourceList: function(phenotypelist) {
		var filteredList = {};
		var newlist = [];
		var pheno;
		for (var i in phenotypelist) {
			pheno = phenotypelist[i];
			if (typeof pheno === 'string') {
				newlist.push(pheno);
			}
			if (pheno.observed === "positive") {
				newlist.push(pheno.id);
			}
		}

		// Now we have all the phenotype IDs ('HP:23451' like strings) in array,
		// since JavaScript Array push() doesn't remove duplicates,
		// we need to get rid of the duplicates. There are many duplicates from the monarch-app returned json - Joe
		// Based on "Smart" but naïve way - http://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array - Joe
		// filter() calls a provided callback function once for each element in an array, 
		// and constructs a new array of all the values for which callback returns a true value or a value that coerces to true.
		newlist = newlist.filter(function(item) {
			return filteredList.hasOwnProperty(item) ? false : (filteredList[item] = true);
		});

		return newlist;
	},

	_expandOntology: function(id) {
		// check to see if id has been cached
		var cache = this.state.dataLoader.checkOntologyCache(id);

		if (typeof(cache) === 'undefined') {
			var cb = this._postExpandOntologyCB;
			this.state.dataLoader.getOntology(id, this.state.ontologyDirection, this.state.ontologyDepth, cb, this);						
		} else {
			this._postExpandOntologyCB(cache, id, this);
		}

	},

    // Must use parent to pass this - Joe
	_postExpandOntologyCB: function(d, id, parent) {
		parent.state.ontologyTreesDone = 0;
		parent.state.ontologyTreeHeight = 0;		
		var info = parent._getAxisData(id);
		var hrefLink = "<a href=\"" + parent.state.serverURL+"/phenotype/"+ id + "\" target=\"_blank\">" + info.label + "</a>";
		var ontologyData = "<strong>Phenotype: </strong> " + hrefLink + "<br/>";
		ontologyData += "<strong>IC:</strong> " + info.IC.toFixed(2) + "<br/>";
        ontologyData += "<strong>Sum:</strong> " + info.sum.toFixed(2) + "<br/>";
        ontologyData += "<strong>Frequency:</strong> " + info.count + "<br/><br/>";

		var classTree = parent._buildOntologyTree(id.replace("_", ":"), d.edges, 0);

		if (classTree === "<br>"){
			ontologyData += "<em>No classification hierarchy data found</em>";
		} else {
			ontologyData += "<strong>Classification hierarchy:</strong>" + classTree;
		}

		$("#pg_tooltip_inner").html(ontologyData);
	},

    // Genotypes expansion for gene (single species mode) - Joe
    _insertGenotypes: function(id) {
        // change the plus icon to spinner to indicate the loading
        $('.pg_expand_genotype_icon').removeClass('fa-plus-circle');
        $('.pg_expand_genotype_icon').addClass('fa-spinner fa-pulse');
        
        var species_name = $('#pg_insert_genotypes_' + id).attr('data-species');
        
        var loaded = this.state.dataManager.checkGenotypesLoaded(species_name, id);
        
        // when we can see the insert genotypes link in tooltip, 
        // the genotypes are either haven't been loaded or have already been loaded but then removed(invisible)
        if (loaded) {
            // change those associated genotypes to 'visible' and render them
            // array of genotype id list
            var associated_genotype_ids = this.state.dataLoader.loadedGenotypes[id];
            
            // reactivating by changing 'visible' to true
            for (var i = 0; i < associated_genotype_ids.length; i++) {
                var genotype_id = associated_genotype_ids[i];
                
                if (typeof(this.state.dataLoader.targetData[species_name][genotype_id]) === 'undefined') {
                    this.state.dataLoader.targetData[species_name][genotype_id] = {}; // object
                }
                this.state.dataLoader.targetData[species_name][genotype_id].visible = true; 

                // Now we update the reorderedTargetEntriesNamedArray and reorderedTargetEntriesIndexArray in dataManager
                if (typeof(this.state.dataManager.reorderedTargetEntriesNamedArray[species_name][genotype_id]) === 'undefined') {
                    this.state.dataManager.reorderedTargetEntriesNamedArray[species_name][genotype_id] = {}; // object
                }
                this.state.dataManager.reorderedTargetEntriesNamedArray[species_name][genotype_id].visible = true;  
                
                // delete the corresponding genotypes from reorderedTargetEntriesIndexArray
                for (var j = 0; j < this.state.dataManager.reorderedTargetEntriesIndexArray[species_name].length; j++) {
                    if (typeof(this.state.dataManager.reorderedTargetEntriesIndexArray[species_name][j]) === 'undefined') {
                        this.state.dataManager.reorderedTargetEntriesIndexArray[species_name][j] = {}; // object
                    }
                    
                    if (this.state.dataManager.reorderedTargetEntriesIndexArray[species_name][j].id === genotype_id) {
                        this.state.dataManager.reorderedTargetEntriesIndexArray[species_name][j].visible = true; 
                        break;
                    }
                }         
            }
            
            this.state.reactivateGenotypes[species_name] = true;
            this._updateTargetAxisRenderingGroup(species_name);
            this.state.reactivateGenotypes[species_name] = false;
            
            this._updateDisplay();
            
            // Remove the spinner icon
            $('.pg_expand_genotype_icon').removeClass('fa-spinner fa-pulse');
            $('.pg_expand_genotype_icon').addClass('fa-plus-circle');
            
            // Tell dataManager that the loaded genotypes of this gene have been expanded
            this.state.dataManager.expandedGenotypeList[id] = this.state.dataLoader.loadedGenotypes[id];
        } else {
            // Load the genotypes only once
            var cb = this._insertGenotypesCb;
            this.state.dataLoader.getGenotypes(id, cb, this);
        }
	},
    
    // this cb has all the matches info returned from the compare
    // e.g., http://beta.monarchinitiative.org/compare//compare/:id1+:id2/:id3,:id4,...idN
    // parent refers to the global `this` and we have to pass it
    _insertGenotypesCb: function(results, id, parent) {
        console.log(results);
        
        // add genotypes to data, and update target axis
        if (results.b.length > 0) {
            var species_name = $('#pg_insert_genotypes_' + id).attr('data-species');
            // transform raw owlsims into simplified format
            // append the genotype matches data to targetData[targetGroup]/sourceData[targetGroup]/cellData[targetGroup]
            parent.state.dataLoader.genotypeTransform(species_name, results, id); 

            // call this before reordering the target list
            // to update this.state.targetAxis so it has the newly added genotype data in the format of named array
            // when we call parent.state.targetAxis.groupEntries()
            parent._updateTargetAxisRenderingGroup(species_name);
            
            if (typeof(parent.state.dataManager.reorderedTargetEntriesIndexArray[species_name]) === 'undefined') {
                parent.state.dataManager.reorderedTargetEntriesIndexArray[species_name] = [];
            }
            
            // for the first time, just get the unordered groupEntries()
            // starting from second time, append the genotype data of following expansions to the already ordered target list
            if (parent.state.dataManager.reorderedTargetEntriesIndexArray[species_name].length === 0) {
                var updatedTargetEntries = parent.state.targetAxis.groupEntries(); // numeric index array
            } else {
                var updatedTargetEntries = parent.state.dataManager.appendNewGenotypesToOrderedTargetList(species_name, results.b);
            }
            
            // Now we update the target list in dataManager
            // and place those genotypes right after their parent gene
            var genotypesData = {
                    targetEntries: updatedTargetEntries, 
                    genotypes: results.b, 
                    parentGeneID: id,
                    species: species_name
                };
                
            // this will give us a reordered target list in two formats.
            // one is associative/named array(reorderedTargetEntriesNamedArray), the other is number indexed array(reorderedTargetEntriesIndexArray)
            parent.state.dataManager.updateTargetList(genotypesData);

            // we set the genotype flag before calling _updateTargetAxisRenderingGroup() again
            // _updateTargetAxisRenderingGroup() uses this flag for creating this.state.targetAxis
            parent.state.newGenotypes[species_name] = true;
            
            // call this again after the target list gets updated
            // so this.state.targetAxis gets updated with the reordered target list (reorderedTargetEntriesNamedArray)
            // as well as the new start position and end position
            parent._updateTargetAxisRenderingGroup(species_name);
            
            // then reset the flag to false so it can still grab the newly added genotypes of another gene
            // and add them to the unordered target list.
            // without resetting this flag, we'll just get reorderedTargetEntriesNamedArray from dataManager and 
            // reorderedTargetEntriesNamedArray hasn't been updated with the genotypes of the new expansion            
            parent.state.newGenotypes[species_name] = false;
            
            // flag, indicates that we have expanded genotypes for this species, 
            // so they show up when we switch from multi-species mode back to single species mode
            parent.state.expandedGenotypes[species_name] = true;

            parent._updateDisplay();
            
            // Remove the spinner icon
            $('.pg_expand_genotype_icon').removeClass('fa-spinner fa-pulse');
            $('.pg_expand_genotype_icon').addClass('fa-plus-circle');
            
            // Tell dataManager that the loaded genotypes of this gene have been expanded
            parent.state.dataManager.expandedGenotypeList[id] = parent.state.dataLoader.loadedGenotypes[id];
        } else {
            // tell users there's no genotypes associated to this gene
            parent._populateDialog('This gene has no associated genotypes.');
        }
	},

    // Genotypes expansion for gene (single species mode)
    // hide expanded genotypes
    _removeGenotypes: function(id) {
        var species_name = $('#pg_remove_genotypes_' + id).attr('data-species');
        // array of genotype id list
        var associated_genotype_ids = this.state.dataLoader.loadedGenotypes[id];
        
        // change 'visible' to false 
        for (var i = 0; i < associated_genotype_ids.length; i++) {
            var genotype_id = associated_genotype_ids[i];
            this.state.dataLoader.targetData[species_name][genotype_id].visible = false; 

            // Now we update the reorderedTargetEntriesNamedArray in dataManager
            this.state.dataManager.reorderedTargetEntriesNamedArray[species_name][genotype_id].visible = false;   
            // Also hide the corresponding genotypes in reorderedTargetEntriesIndexArray
            for (var j = 0; j < this.state.dataManager.reorderedTargetEntriesIndexArray[species_name].length; j++) {
                if (typeof(this.state.dataManager.reorderedTargetEntriesIndexArray[species_name][j]) === 'undefined') {
                    this.state.dataManager.reorderedTargetEntriesIndexArray[species_name][j] = {}; // object
                }
                
                if (this.state.dataManager.reorderedTargetEntriesIndexArray[species_name][j].id === genotype_id) {
                    this.state.dataManager.reorderedTargetEntriesIndexArray[species_name][j].visible = false;
                    break;
                }
            }         
        }
        
        // Tell dataManager that the loaded genotypes of this gene have been collapsed from display 
        delete this.state.dataManager.expandedGenotypeList[id];
        
        // set the flag
        this.state.removedGenotypes[species_name] = true;
        
        // update the target list for axis render
        this._updateTargetAxisRenderingGroup(species_name);

        // reset flag
        this.state.removedGenotypes[species_name] = false;
        
        // update display
        this._updateDisplay();
	},    
    
	_isTargetGroupSelected: function(self, name) {
		for (var i in self.state.selectedCompareTargetGroup) {
			if (self.state.selectedCompareTargetGroup[i].name === name) {
				return true;
			}
		}
		return false;
	},

	_getTargetGroupInfo: function(self, name) {
		for (var i in self.state.targetGroupList) {
			if (self.state.targetGroupList[i].name === name) {
				return self.state.targetGroupList[i];
			}
		}
	},


	_isCrossComparisonView: function() {
		if (this.state.selectedCompareTargetGroup.length === 1) {
			return false;
		}
		return true;
	}



	}); // end of widget code
});

}());

