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
 *         targetGroupList: [
 *           {"name": "Homo sapiens", "taxon": "9606","crossComparisonView": true, "active": true},
 *           {"name": "Mus musculus", "taxon": "10090", "crossComparisonView": true, "active": true},
 *           {"name": "Danio rerio", "taxon": "7955", "crossComparisonView": true, "active": true}
 *         ]
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
 *	the Phenogrid will call the Monarch API to get OWLSim results. These results will then be rendered in the Phenogrid
 */



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
            phenotypeData: [],
            serverURL: "http://monarchinitiative.org", // will be overwritten by phenogrid_config.js, and Phenogrid constructor
            selectedCalculation: 0, // index 0 is Similarity by default. (0 - Similarity, 1 - Ratio (q), 2 - Uniqueness, 3- Ratio (t))
            selectedSort: "Frequency", // sort method of sources: "Alphabetic", "Frequency and Rarity", "Frequency" 
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
                {name: "Caenorhabditis elegans", taxon: "6239", crossComparisonView: false, active: false},
                {name: "UDPICS", taxon: "UDPICS", crossComparisonView: false, active: false} // Undiagnosed Diseases Program Integrated Collaboration System(UDPICS)
            ],
            messaging: {
                misconfig: 'Please fix your config to enable at least one species.',
                noAssociatedGenotype: 'This gene has no associated genotypes.',
                noSimSearchMatchForExpandedGenotype: 'No matches found between the provided phenotypes and expanded genotypes.',
                noSimSearchMatch: 'No simsearch matches found for {%speciesName%} based on the provided phenotypes.' // {%speciesName%} is placeholder
            },
            // For IMPC integration
            gridSkeletonDataVendor: 'IMPC',
            gridSkeletonData: {}, //  skeleton json structure: https://github.com/monarch-initiative/phenogrid/blob/impc-integration/js/impc.json
            gridSkeletonTargetGroup: {}, // E.g., {name: "Mus musculus", taxon: "10090"}
            // hooks to the monarch app's Analyze/phenotypes page - Joe
            owlSimFunction: '', // 'compare', 'search'
            targetSpecies: '', // quoted 'taxon number' or 'all'
            searchResultLimit: 100, // the limit field under analyze/phenotypes search section in search mode, default 100, will be overwritten by user-input limit 
            geneList: [] // an array of gene IDs to be used in compare mode, already contains orthologs and paralogs when provided 
        },

        // Supposed to be used by developers for deeper customization
        // can not be overwritten from constructor
        internalOptions: {
            invertAxis: false,
            simSearchQuery: { // HTTP POST
                URL: '/simsearch/phenotype',
                inputItemsString: 'input_items=', // HTTP POST, body parameter
                targetSpeciesString: '&target_species=', // HTTP POST, body parameter
                limitString: '&limit'
            },
            compareQuery: { // compare API takes HTTP GET, so no body parameters
                URL: '/compare' // used for owlSimFunction === 'compare' and genotype expansion compare simsearch - Joe
            },
            unmatchedButtonLabel: 'Unmatched Phenotypes',
            gridTitle: 'Phenotype Similarity Comparison',       
            defaultSingleTargetDisplayLimit: 30, //  defines the limit of the number of targets to display
            defaultSourceDisplayLimit: 30, //  defines the limit of the number of sources to display
            defaultCrossCompareTargetLimitPerTargetGroup: 10,    // the number of visible targets per species to be displayed in cross compare mode  
            labelCharDisplayCount : 20,
            ontologyDepth: 10,	// Numerical value that determines how far to go up the tree in relations.
            ontologyDirection: "OUTGOING",	// String that determines what direction to go in relations.  Default is "out".
            ontologyRelationship: "subClassOf",
            ontologyQuery: "/neighborhood/", // Keep the slashes
            ontologyTreeAmounts: 1,	// Allows you to decide how many HPO Trees to render.  Once a tree hits the high-level parent, it will count it as a complete tree.  Additional branchs or seperate trees count as seperate items
                                // [vaa12] DO NOT CHANGE UNTIL THE DISPLAY HPOTREE FUNCTIONS HAVE BEEN CHANGED. WILL WORK ON SEPERATE TREES, BUT BRANCHES MAY BE INACCURATE
            genotypeExpandLimit: 5, // sets the limit for the number of genotype expanded on grid 
            // Genotype expansion flags - named/associative array
            // flag used for switching between single species and multi-species mode
            // add new species names here once needed - Joe
            // Add new species here when needed, human disease doesn't have genotype expansion - Joe
            genotypeExpansionSpeciesFlag: {
                "Mus musculus": false,
                "Danio rerio": false,
                "Drosophila melanogaster": false,
                "Caenorhabditis elegans": false
            },
            unstableGenotypePrefix: ['MONARCH:', '_:'], //https://github.com/monarch-initiative/monarch-app/issues/1024#issuecomment-163733837
            colorDomains: [0, 0.2, 0.4, 0.6, 0.8, 1],
            colorRanges: [ // each color sets the stop color based on the stop points in colorDomains - Joe
                'rgb(237,248,177)',
                'rgb(199,233,180)',
                'rgb(127,205,187)',
                'rgb(65,182,196)', 
                'rgb(29,145,192)',
                'rgb(34,94,168)'
            ], // stop colors for corresponding stop points - Joe
            minimap: {
                x:112, 
                y: 65, 
                width:110, // the actual width will be calculated based on the number of x count - Joe
                height:110, // the actual height will be calculated based on the number of y count - Joe
                bgColor: '#fff',
                borderColor: '#666',
                borderThickness:2, // 2 works best, any other number will cause imperfect display - Joe
                miniCellSize:2, // width/height
                shadedAreaBgColor: '#666',
                shadedAreaOpacity: 0.5
            },
            scrollbar: {
                barToGridMargin: 20,
                barThickness: 1,
                barColor: "#ccc",
                sliderThickness: 8,
                sliderColor: "#999",
            },
            /*
            logo: {
                x: 70, 
                y: 65, 
                width: 40, 
                height: 26
            },
            */
            targetGroupDividerLine: {
                color: "#EA763B",
                thickness: 1,
                rotatedDividerLength: 110 // the length of the divider line for the rotated labels
            },
            gridRegion: {
                x:254, 
                y:200, // origin coordinates for grid region (matrix)
                cellPad:19, // distance from the first cell to the next cell, odd number(19 - 12 = 7) makes the divider line entered perfectly - Joe
                cellSize:12, // grid cell width/height
                rowLabelOffset:25, // offset of the row label (left side)
                colLabelOffset:20,  // offset of column label (adjusted for text score) from the top of grid squares
                scoreOffset:5  // score text offset from the top of grid squares
            },
            gradientRegion: {
                width: 240,
                height: 5
            },
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
            ]
        },


    // The _create() method is the jquery UI widget's constructor. 
    // There are no parameters, but this.element and this.options are already set.
    // The widget factory automatically fires the _create() and then _init() during initialization
	_create: function() {
        // Loaded from a separate file config/phenogrid_config.js IF PROVIDED
		if (typeof(configoptions) !== 'undefined') {
            this.configoptions = configoptions;
        } else {
            this.configoptions = {}; // Define as an empty object 
        }

        // Merge into one object
        // this.options is the options object provided in phenogrid constructor
        // this.options overwrites this.configoptions overwrites this.config overwrites this.internalOptions
		this.state = $.extend({}, this.internalOptions, this.config, this.configoptions, this.options);

        // Create new arrays for later use
        // initialTargetGroupLoadList is used for loading the simsearch data for the first time
		this.state.initialTargetGroupLoadList = [];
        
        // selectedCompareTargetGroup is used to control what species are loaded
        // it's possible that a species is in initialTargetGroupLoadList but there's no simsearch data returned - Joe
		this.state.selectedCompareTargetGroup = [];

        // NOTE: without using jquery's extend(), all the new flags are referenced 
        // to the config object, not actual copy - Joe
        this.state.expandedGenotypes = $.extend({}, this.state.genotypeExpansionSpeciesFlag);
        
        // genotype flags to mark every genotype expansion on/off in each species
        this.state.newGenotypes = $.extend({}, this.state.genotypeExpansionSpeciesFlag);
        
        this.state.removedGenotypes = $.extend({}, this.state.genotypeExpansionSpeciesFlag);
        
        // flag to mark if hidden genotypes need to be reactivated
        this.state.reactivateGenotypes = $.extend({}, this.state.genotypeExpansionSpeciesFlag);
	},


    // _init() will be executed first and after the first time when phenogrid is created - Joe
    // So, if you draw a chart with jquery-ui plugin, after it's drawn out, 
    // then you want to use new data to update it, you need to do this in _init() to update your chart. 
    // If you just display something and won't update them totally, _create() will meet your needs.
	_init: function() {
		this.element.empty();

        // create the Phenogrid div
        this._createPhenogridContainer();
        
		// show loading spinner - Joe
		this._showLoadingSpinner();		

        // IMPC integration, IMPC returns its own list of mouse phenotypes
        if (this.state.gridSkeletonDataVendor === 'IMPC') {
            this._initGridSkeleton();
        } else {
            // Remove duplicated source IDs - Joe
            this.state.querySourceList = this._parseQuerySourceList(this.state.phenotypeData);

            var self = this;
            // no change to the callback - Joe
            this.state.asyncDataLoadingCallback = function() {
                self._asyncDataLoadingCB(self); 
            };

            // Load data from compare API for geneList
            // in compare mode, there's no crossComparisonView - Joe
            if (this.state.owlSimFunction === 'compare' && this.state.geneList.length !== 0) {
                this._initCompare();
            } else if (this.state.owlSimFunction === 'search' && this.state.targetSpecies !== '') {
                this._initSearch();
            } else {
                this._initDefault();
            }
        }
	},
    
    _initDefault: function() {
        // when not work with monarch's analyze/phenotypes page
        // this can be single species mode or cross comparison mode depends on the config
        // load the default selected target targetGroup list based on the active flag in config, 
        // has nothing to do with the monarch's analyze phenotypes page - Joe
        this._parseTargetGroupList(false);
        
        // initialize data processing class for simsearch query
        this.state.dataLoader = new DataLoader(this.state.serverURL, this.state.simSearchQuery);
        
        // starting loading the data from simsearch
        //optional parm: this.limit
        this.state.dataLoader.load(this.state.querySourceList, this.state.initialTargetGroupLoadList, this.state.asyncDataLoadingCallback);
    },
    
    _initCompare: function() {
        // overwrite the this.state.targetGroupList with only 'compare'
        // this 'compare' is used in dataLoader.loadCompareData() and dataManager.buildMatrix() too - Joe
        this.state.targetGroupList = [
            {name: "compare", taxon: "compare", crossComparisonView: true, active: true}
        ];
        
        // load the target targetGroup list based on the active flag
        this._parseTargetGroupList(false);	

        // initialize data processing class for compare query
        this.state.dataLoader = new DataLoader(this.state.serverURL, this.state.compareQuery);

        // starting loading the data from compare api
        // NOTE: the owlsim data returned form the ajax GET may be empty (no matches), we'll handle this in the callback - Joe
        this.state.dataLoader.loadCompareData(this.state.targetGroupList[0].name, this.state.querySourceList, this.state.geneList, this.state.asyncDataLoadingCallback);
    },

    _initSearch: function() {
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
                {name: "Caenorhabditis elegans", taxon: "6239", crossComparisonView: false, active: false},
                {name: "UDPICS", taxon: "UDPICS", crossComparisonView: false, active: false}
            ];
            
            // load the target targetGroup list based on the active flag
            this._parseTargetGroupList(false);
        } else { 
            // when single species is selected (taxon is passed in via this.state.targetSpecies)
            // load just the one selected from the dropdown menu - Joe
            if (this.state.targetGroupList[idx].taxon === this.state.targetSpecies) {
                this._parseTargetGroupList(true);	
            }	
        }
        
        // initialize data processing class for simsearch query
        this.state.dataLoader = new DataLoader(this.state.serverURL, this.state.simSearchQuery);
        
        // starting loading the data from simsearch
        this.state.dataLoader.load(this.state.querySourceList, this.state.initialTargetGroupLoadList, this.state.asyncDataLoadingCallback, this.state.searchResultLimit);
    },

    _initGridSkeleton: function() {
        // Use provided grid title if there's one, otherwise use the default title
        if (typeof(this.state.gridSkeletonData.title) !== 'undefined' && this.state.gridSkeletonData.title !== '') {
            this.state.gridTitle = this.state.gridSkeletonData.title;
        }
        
        // use the human phenotypes from the input JSON
        for (var i in this.state.gridSkeletonData.yAxis[0].phenotypes) {
            this.state.phenotypeData.push(this.state.gridSkeletonData.yAxis[0].phenotypes[i].id);
        }

         // Remove duplicated source IDs - Joe
        var querySourceList = this._parseQuerySourceList(this.state.phenotypeData);
        
        // no change to the callback - Joe
        var self = this;
        var asyncDataLoadingCallback = function() {
            self._asyncDataLoadingCB(self); 
        };
        
        // For only single species
        // If multi species needed as target groups, we'll need to change the skelton structure
        // Merge the provided this.state.gridSkeletonTargetGroup properties with {crossComparisonView: true, active: true}
        // so the new object is in the desired format
        var normalizedTargetGroup = $.extend({}, this.state.gridSkeletonTargetGroup, {crossComparisonView: true, active: true});
        this.state.targetGroupList = [
            normalizedTargetGroup
        ];
        
        // load the target targetGroup list based on the active flag
        this._parseTargetGroupList(true);

        var listOfLists = [];
        for (var idx in this.state.gridSkeletonData.xAxis) {
            var eachList = [];
            for (var i in this.state.gridSkeletonData.xAxis[idx].phenotypes) {
                eachList.push(this.state.gridSkeletonData.xAxis[idx].phenotypes[i].id);
            }
            // add new property
            this.state.gridSkeletonData.xAxis[idx].combinedList = eachList.join('+');
            // default separator of array.join(separator) is comma
            // join all the MP inside each MP list with plus sign, and join each list with default comma
            listOfLists.push(this.state.gridSkeletonData.xAxis[idx].combinedList);
        }
        
        // use the default comma to separate each list into each genotype profile
        var multipleTargetEntities = listOfLists.join();

        // initialize data processing class for compare query
        this.state.dataLoader = new DataLoader(this.state.serverURL, this.state.compareQuery);

        // starting loading the owlsim data from compare api for this vendor
        this.state.dataLoader.loadCompareDataForVendor(this.state.gridSkeletonData, this.state.gridSkeletonTargetGroup.name, querySourceList, multipleTargetEntities, asyncDataLoadingCallback);
    },
    
    // when not work with monarch's analyze/phenotypes page
    // this can be single species mode or cross comparison mode depends on the config
    // load the default selected target targetGroup list based on the active flag in config, 
    // has nothing to do with the monarch's analyze phenotypes page - Joe
    _parseTargetGroupList: function(forSingleSpecies) {
        for (var idx in this.state.targetGroupList) {
            if (forSingleSpecies === true) {
                this.state.initialTargetGroupLoadList.push(this.state.targetGroupList[idx]);	
                this.state.selectedCompareTargetGroup.push(this.state.targetGroupList[idx]);	
            } else {
                // for active targetGroup pre-load them
                if (this.state.targetGroupList[idx].active) {
                    this.state.initialTargetGroupLoadList.push(this.state.targetGroupList[idx]);	
                }	
                // should they be shown in the comparison view
                // crossComparisonView matters only when active = true - Joe
                if (this.state.targetGroupList[idx].active && this.state.targetGroupList[idx].crossComparisonView) {
                    this.state.selectedCompareTargetGroup.push(this.state.targetGroupList[idx]);	
                }
            }
        }
    },

    // Phenogrid container div
	_createPhenogridContainer: function() {
		// ID of base containing div of each instance
        this.state.pgInstanceId = this.element.attr('id');
        this.state.pgContainerId = this.state.pgInstanceId + '_container';
        this.state.pgContainer = $('<div id="' + this.state.pgContainerId + '" class="pg_container"></div>');
		this.element.append(this.state.pgContainer);
	},

    // Loading spinner image from font awesome - Joe
	_showLoadingSpinner: function() {
		var element = $('<div>Loading Phenogrid Widget...<i class="fa fa-spinner fa-pulse"></i></div>');
		element.appendTo(this.state.pgContainer);
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
        self.state.pgContainer.html('');

        // check owlsim data integrity - Joe
        if (self.state.owlSimFunction === 'compare') {
            if (this.state.dataLoader.speciesNoMatch.length > 0) {
                self._showSpeciesNoMatch();
            } else {
                // Create all UI components
                // create the display as usual if there's 'b' and 'metadata' fields found - Joe
                self._createDisplay();
            }
        } else {
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
			}
		}
	}, 


    // for genotype expansion, we need to update the target list 
    // for each species if they have added genotypes - Joe
    _updateTargetAxisRenderingGroup: function(species_name) {
    	var targetList = [];

        // get targetList based on the newGenotypes flag
        if (this.state.newGenotypes[species_name]) {
            // get the reordered target list in the format of a named array, has all added genotype data
            targetList = this.state.dataManager.reorderedTargetEntriesNamedArray[species_name];
        } else if (this.state.removedGenotypes[species_name]) {
            // get the reordered target list in the format of a named array, has all added genotype data
            targetList = this.state.dataManager.getReorderedTargetEntriesNamedArray(species_name); 
        } else if (this.state.reactivateGenotypes[species_name]) {
            targetList = this.state.dataManager.getReorderedTargetEntriesNamedArray(species_name); 
        } else {
            // unordered target list in the format of a named array, has all added genotype data
            targetList = this.state.dataManager.getData("target", species_name);
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

    // Being called only for the first time the widget is being loaded
	_createDisplay: function() {
        if (this.state.initialTargetGroupLoadList.length === 1) {
            // in this case, speciesNoMatch.length can only be 1 or 0
            if (this.state.dataLoader.speciesNoMatch.length === 0) {
                // create UI components
                this._createDisplayComponents();
            } else {
                // no need to show other SVG UI elements if no matched data
                this._showSpeciesNoMatch();
            }
        } else if (this.state.initialTargetGroupLoadList.length > 1) {
            if (this.state.dataLoader.speciesNoMatch.length > 0) {
                if (this.state.dataLoader.speciesNoMatch.length === this.state.initialTargetGroupLoadList.length) {
                    // in this case all species have no matches
                    this._showSpeciesNoMatch();
                } else {
                    // show error message and display grid for the rest of the species
                    this._showSpeciesNoMatch();
                    this._createDisplayComponents();
                }
            } else {
                this._createDisplayComponents();
            }
        } else {
            // no active species in config
            this._showConfigErrorMsg();
        }
    },
    
    _showConfigErrorMsg: function() {
        this.state.pgContainer.html(this.state.messaging.misconfig);
    },
    
    _createDisplayComponents: function() {
        // initialize axis groups
        this._createAxisRenderingGroups();
        
        // create the display as usual if there's 'b' and 'metadata' fields found - Joe
        this._createColorScalePerSimilarityCalculation();
        
        // No need to recreate this tooltip on _updateDisplay() - Joe
        this._createTooltipStub();
    
        this._createSvgComponents();

        // Create and postion HTML sections
        
        // Unmatched sources
        this._createUnmatchedSources();
        
        // Options menu
        this._createPhenogridControls();
        this._positionPhenogridControls();
        this._togglePhenogridControls();
        
        this._setSvgSize();
    },
    
    // Recreates the SVG content and leave the HTML sections unchanged
	_updateDisplay: function() {
        // Only remove the #pg_svg node and leave #this.state.pgInstanceId_controls there
        // since #this.state.pgInstanceId_controls is HTML not SVG - Joe
        this.element.find('#' + this.state.pgInstanceId + '_svg').remove();
    
        this._createSvgComponents();

        // Reposition HTML sections
        this._positionUnmatchedSources();
        this._positionPhenogridControls();
        
        this._setSvgSize();
	},

    _createSvgComponents: function() {
        this._createSvgContainer();
        // this._addLogoImage(); // Let's not to add the logo for now - Joe
        this._createOverviewTargetGroupLabels();
        this._createNavigation();
        this._createGrid();
        this._createScoresTipIcon();
        this._addGridTitle(); // Must after _createGrid() since it's positioned based on the _gridWidth() - Joe
        this._createGradientLegend();
        this._createTargetGroupDividerLines();
        this._createMonarchInitiativeText(); // For exported phenogrid SVG, hide by default
        
        // this must be called here so the tooltip disappears when we mouseout the current element - Joe
        this._relinkTooltip();
    },
    
    // the svg container
	_createSvgContainer: function() {
        this.state.pgContainer.append('<svg id="' + this.state.pgInstanceId + '_svg"><g id="' + this.state.pgInstanceId + '_svg_group"></g></svg>');
	
        // Define a font-family for all SVG texts 
        // so we don't have to apply font-family separately for each SVG text - Joe
        this.state.svg = d3.select('#' + this.state.pgInstanceId + '_svg_group')
            .style("font-family", "Verdana, Geneva, sans-serif");
	},
    
    // if no owlsim data returned for that species
    _showSpeciesNoMatch: function() {
        var output = '';
        for (var i = 0; i < this.state.dataLoader.speciesNoMatch.length; i++) {
            // replace the placeholder with species name
            output +=  this.state.messaging.noSimSearchMatch.replace(/{%speciesName%}/, this.state.dataLoader.speciesNoMatch[i]) + '<br>';
        }
        this.state.pgContainer.append(output);
    },
    
    // Positioned next to the grid region bottom
	_addLogoImage: function() { 
		var self = this;
        this.state.svg.append("svg:image")
			.attr("xlink:href", images.logo)
			.attr("x", this.state.logo.x)
			.attr("y", this.state.logo.y)
			.attr("id", this.state.pgInstanceId + "_logo")
			.attr('class', 'pg_cursor_pointer')
			.attr("width", this.state.logo.width)
			.attr("height", this.state.logo.height)
			.on('click', function() {
				window.open(self.state.serverURL, '_blank');
			});
	},
    
    _createOverviewTargetGroupLabels: function () {
        if (this.state.owlSimFunction !== 'compare') {
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
                    .attr("x", self.state.gridRegion.x + self._gridWidth() + 25) // 25 is margin - Joe
                    .attr("y", function(d, i) { 
                            return self.state.gridRegion.y + ((i + 1/2 ) * heightPerTargetGroup);
                        })
                    .attr('transform', function(d, i) {
                        var currX = self.state.gridRegion.x + self._gridWidth() + 25;
                        var currY = self.state.gridRegion.y + ((i + 1/2 ) * heightPerTargetGroup);
                        return 'rotate(90 ' + currX + ' ' + currY + ')';
                    }) // rotate by 90 degrees 
                    .attr("class", "pg_targetGroup_name") // Need to use id instead of class - Joe
                    .text(function (d, i){
                        return targetGroupList[i];
                    })
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

    // Create minimap and scrollbars based on needs
    // In single species mode, only show mini map 
    // when there are more sources than the default limit or more targets than default limit
    // In cross comparison mode, only show mini map 
    // when there are more sources than the default limit
    // Create scrollbars accordingly
    _createNavigation: function() {
        var xCount = this.state.xAxisRender.displayLength();
        var yCount = this.state.yAxisRender.displayLength();
        var width = this.state.minimap.width;
        var height =this.state.minimap.height;
        
        // check xCount based on yCount
        if ( ! this.state.invertAxis) {
            if ( ! this._isCrossComparisonView()) {
                if (yCount >= this.state.defaultSourceDisplayLimit) {
                    if (xCount >= this.state.defaultSingleTargetDisplayLimit) {
                        // just use the default mini map width and height
                        this._createMinimap(width, height);
                        // create both horizontal and vertical scrollbars
                        this._createScrollbars(true, true);
                    } else {
                        // shrink the width of mini map based on the xCount/this.state.defaultSingleTargetDisplayLimit
                        // and keep the hight unchanged
                        width = width * (xCount/this.state.defaultSingleTargetDisplayLimit);
                        this._createMinimap(width, height);
                        // only create vertical scrollbar
                        this._createScrollbars(false, true);
                    }
                } else {
                    if (xCount >= this.state.defaultSingleTargetDisplayLimit) {
                        // shrink the height of mini map based on the yCount/this.state.defaultSourceDisplayLimit ratio
                        // and keep the hight unchanged
                        height = height * (yCount/this.state.defaultSourceDisplayLimit);
                        this._createMinimap(width, height);
                        // only create horizontal scrollbar
                        this._createScrollbars(true, false);
                    } 
                    
                    // No need to create the mini map if both xCount and yCount are within the default limit
                }
            } else {
                // No need to check xCount since the max x limit per species is set to 10 in multi comparison mode
                if (yCount >= this.state.defaultSourceDisplayLimit) {  
                    // just use the default mini map width and height
                    this._createMinimap(width, height);
                    // only create vertical scrollbar
                    this._createScrollbars(false, true);
                } 
                
                // No need to create the mini map if yCount is within the default limit
            }
	   	} else {
            if ( ! this._isCrossComparisonView()) {
                if (xCount >= this.state.defaultSourceDisplayLimit) {
                    if (yCount >= this.state.defaultSingleTargetDisplayLimit) {
                        this._createMinimap(width, height);
                        // create both horizontal and vertical scrollbars
                        this._createScrollbars(true, true);
                    } else {
                        height = height * (yCount/this.state.defaultSingleTargetDisplayLimit);
                        this._createMinimap(width, height);
                        // only create horizontal scrollbar
                        this._createScrollbars(true, false);
                    }
                } else {
                    if (yCount >= this.state.defaultSingleTargetDisplayLimit) {
                        width = width * (xCount/this.state.defaultSourceDisplayLimit);
                        this._createMinimap(width, height);
                        // only create vertical scrollbar
                        this._createScrollbars(false, true);
                    }
                }
            } else {
                if (xCount >= this.state.defaultSourceDisplayLimit) {  
                    this._createMinimap(width, height);
                    // only create horizontal scrollbar
                    this._createScrollbars(true, false);
                } 
            } 
        }   
    },
    
	// For the selection area, see if you can convert the selection to the idx of the x and y then redraw the bigger grid 
	_createMinimap: function(width, height) {
		// display counts and total counts on each axis
	    var xDisplayCount = this.state.xAxisRender.displayLength();  
        var yDisplayCount = this.state.yAxisRender.displayLength();  
        var xTotalCount = this.state.xAxisRender.groupLength(); 
        var yTotalCount = this.state.yAxisRender.groupLength();  
	    
		// these translations from the top-left of the rectangular region give the absolute coordinates
		var overviewX = this.state.minimap.x;
		var overviewY = this.state.minimap.y;

		// create the main box
        // Group the overview region and text together - Joe
		var globalviewGrp = this.state.svg.append("g")
			.attr("id", this.state.pgInstanceId + "_navigator");
		
		// rectangular border for overview map
		// border color and thickness are defined inline so it can be used by exported svg - Joe
		globalviewGrp.append("rect")
			.attr("x", overviewX)
			.attr("y", overviewY)
			.attr("id", this.state.pgInstanceId + "_globalview")
			.attr("width", width + this.state.minimap.borderThickness*2) // include the border thickness - Joe
            .attr("height", height + this.state.minimap.borderThickness*2)
            .style("fill", this.state.minimap.bgColor)
            .style("stroke", this.state.minimap.borderColor)
            .style("stroke-width", this.state.minimap.borderThickness);

		// create the scales based on the mini map region size
		this._createSmallScales(width, height);

		// this should be the full set of cellData
		var xvalues = this.state.xAxisRender.groupEntries();
		//console.log(JSON.stringify(xvalues));
		var yvalues = this.state.yAxisRender.groupEntries();	

        // in compare mode, the targetGroup will be 'compare' instead of actual species name - Joe
        // each element in data contains source_id, targetGroup, target_id, type ('cell'), xpos, and ypos
        if (this.state.owlSimFunction === 'compare') {
            var data = this.state.dataManager.buildMatrix(xvalues, yvalues, true, this.state.owlSimFunction);
        } else {
            var data = this.state.dataManager.buildMatrix(xvalues, yvalues, true);
        }

		// Group all mini cells in g element
        // apply the translate to the #pg_mini_cells_container instead of each cell - Joe
		var miniCellsGrp = this.state.svg.select('#' + this.state.pgInstanceId + '_navigator').append('g')
							.attr("id", this.state.pgInstanceId + "_mini_cells_container")
                            .attr("transform", "translate(" + overviewX + "," + overviewY + ")");
						
        var self = this; // to be used in callback
        
        // Add cells to the miniCellsGrp	
		var cell_rects = miniCellsGrp.selectAll(".mini_cell")
			.data(data, function(d) {
                return d.source_id + d.target_id;
            })
            .enter()
			.append("rect")
			.attr("class", "mini_cell")
			.attr("x", function(d) { 
				return self.state.smallXScale(d.target_id) + self.state.minimap.miniCellSize / 2; 
            })
            .attr("y", function(d) { 
				return self.state.smallYScale(d.source_id) + self.state.minimap.miniCellSize / 2;
            })
			.attr("width", this.state.minimap.miniCellSize) 
			.attr("height", this.state.minimap.miniCellSize) 
			.attr("fill", function(d) {
				var el = self.state.dataManager.getCellDetail(d.source_id, d.target_id, d.targetGroup);
				return self._getCellColor(el.value[self.state.selectedCalculation]);			 
			});
		
        // start point (x, y) of the shaded draggable area
        var startYId = this.state.yAxisRender.itemAt(0).id; // start point should always be 0 - Joe  
	    var startXId = this.state.xAxisRender.itemAt(0).id; // start point should always be 0 - Joe  
        
		var selectRectX = this.state.smallXScale(startXId);
		var selectRectY = this.state.smallYScale(startYId);
        
		// Calculate the width and height of the shaded draggable area
		var selectRectHeight = height * (yDisplayCount/yTotalCount);
		var selectRectWidth = width * (xDisplayCount/xTotalCount);
		
		// Also add the shaded area in the pg_navigator group - Joe
		this.state.highlightRect = this.state.svg.select('#' + this.state.pgInstanceId + '_navigator').append("rect")
			.attr("x", overviewX + selectRectX)
			.attr("y", overviewY + selectRectY)
			.attr("id", this.state.pgInstanceId + "_navigator_shaded_area")
			.attr("height", selectRectHeight + this.state.minimap.borderThickness*2)
			.attr("width", selectRectWidth + this.state.minimap.borderThickness*2)
			.attr("class", "pg_draggable")
            .style("fill", this.state.minimap.shadedAreaBgColor)
            .style("opacity", this.state.minimap.shadedAreaOpacity)
			.call(d3.behavior.drag() // Constructs a new drag behavior
				.on("dragstart", self._dragstarted) // self._dragstarted() won't work - Joe
                .on("drag", function() {
                    // Random movement while dragging triggers mouseover on labels and cells (luckily, only crosshairs show up in this case)
                    self._crossHairsOff();
                    
                    /*
					 * drag the highlight in the overview window
					 * notes: account for the width of the rectangle in my x and y calculations
					 * do not use the event x and y, they will be out of range at times. Use the converted values instead.
					 */
					// limit the range of the x value
					var newX = parseFloat(d3.select(this).attr("x")) + d3.event.dx;
					var newY = parseFloat(d3.select(this).attr("y")) + d3.event.dy;

					// Restrict Movement if no need to move map
					if (selectRectHeight === height) {
						newY = overviewY;
					}
					if (selectRectWidth === width) {
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
					if (newX + selectRectWidth > overviewX + width) {
						newX = overviewX + width - selectRectWidth;
					}

					// bottom
					if (newY + selectRectHeight > overviewY + height) {
						newY = overviewY + height - selectRectHeight;
					}

                    // Update the position of the shaded area
                    self.state.svg.select("#" + self.state.pgInstanceId + "_navigator_shaded_area")
                        .attr("x", newX)
                        .attr("y", newY);

                    // update the position of slider in each scrollbar accordingly   
                    self.state.svg.select('#' + self.state.pgInstanceId + '_horizontal_scrollbar_slider')
                        .attr("x", function() {
                            var factor = (newX - overviewX) / width;
                            var horizontal_scrollbar_width = self._gridWidth();
                            return self.state.gridRegion.x + horizontal_scrollbar_width*factor;
                        });
                    
                    self.state.svg.select('#' + self.state.pgInstanceId + '_vertical_scrollbar_slider')
                        .attr("y", function() {
                            var factor = (newY - overviewY) / height;
                            var vertical_scrollbar_height = self._gridHeight();
                            return self.state.gridRegion.y + vertical_scrollbar_height*factor;
                        });
                    
                    
                    
					// adjust x back to have 0,0 as base instead of overviewX, overviewY
					newX = newX - overviewX;
					newY = newY - overviewY;

					// invert newX and newY into positions in the model and phenotype lists.
					var newXPos = self._invertDragPosition(self.state.smallXScale, newX) + xDisplayCount;
					var newYPos = self._invertDragPosition(self.state.smallYScale, newY) + yDisplayCount;

                    // grid region needs to be updated accordingly
					self._updateGrid(newXPos, newYPos);
		        })
                .on("dragend", self._dragended) // self._dragended() won't work - Joe
        );
	},

    // when a drag gesture starts
    // define the dragging color in CSS since it won't show in the exported SVG
    _dragstarted: function() {
        // change the slider color while dragging
        d3.select(this).classed("pg_dragging", true); 
    },

    // when the drag gesture finishes
    _dragended: function() {
        // remove the dragging color
        d3.select(this).classed("pg_dragging", false);
    },
    
    // Create horizontal and vertical scrollbars based on needs
    _createScrollbars: function(horizontal, vertical) {
        var self = this;
        
        // variables for scrollbar and slider SVG rendering
        var scrollbar = this.state.scrollbar;
        var barToGridMargin = scrollbar.barToGridMargin;
        var barThickness = scrollbar.barThickness;
        var barColor = scrollbar.barColor;
        var sliderThickness = scrollbar.sliderThickness;
        var sliderColor = scrollbar.sliderColor;

        // create the scales based on the scrollbar size
		this._createScrollbarScales(this._gridWidth(), this._gridHeight());
        
        // variables for creating horizontal bar
        var xDisplayCount = this.state.xAxisRender.displayLength();  
        var xTotalCount = this.state.xAxisRender.groupLength();  
        var startXId = this.state.xAxisRender.itemAt(0).id; // start point should always be 0 - Joe  
        var defaultX = this.state.gridRegion.x;
        var sliderRectX = this.state.horizontalScrollbarScale(startXId);
        var sliderWidth = this._gridWidth() * (xDisplayCount/xTotalCount);
        
        // variables for creating vertical scrollbar
        var yDisplayCount = this.state.yAxisRender.displayLength();  
        var yTotalCount = this.state.yAxisRender.groupLength();  
        var startYId = this.state.yAxisRender.itemAt(0).id; // start point should always be 0 - Joe  
        var defaultY = this.state.gridRegion.y;
        var sliderRectY = this.state.verticalScrollbarScale(startYId);
        var sliderHeight = this._gridHeight() * (yDisplayCount/yTotalCount);
    
        // horizontal scrollbar
        if (horizontal === true) {
            var horizontalScrollbarGrp = this.state.svg.append("g")
                .attr("id", this.state.pgInstanceId + "_horizontal_scrollbar_group");
            
            // scrollbar line
            horizontalScrollbarGrp.append("line")
                .attr("x1", this.state.gridRegion.x)
                .attr("y1", this.state.gridRegion.y + this._gridHeight() + barToGridMargin)
                .attr("x2", this.state.gridRegion.x + this._gridWidth())
                .attr("y2", this.state.gridRegion.y + this._gridHeight() + barToGridMargin)
                .attr("id", this.state.pgInstanceId + "_horizontal_scrollbar")
                .style("stroke", barColor)
                .style("stroke-width", barThickness);

            // slider rect
            horizontalScrollbarGrp.append("rect")
                .attr("x", defaultX + sliderRectX) // sets the slider to the desired position after inverting axis - Joe
                .attr("y", this.state.gridRegion.y + this._gridHeight() + barToGridMargin - sliderThickness/2)
                .attr("id", this.state.pgInstanceId + "_horizontal_scrollbar_slider")
                .attr("height", sliderThickness)
                .attr("width", sliderWidth)
                .style("fill", sliderColor)
                .attr("class", "pg_draggable")
                .call(d3.behavior.drag()
                    .on("dragstart", self._dragstarted)
                    .on("drag", function() {
                        // Random movement while dragging triggers mouseover on labels and cells (luckily, only crosshairs show up in this case)
                        self._crossHairsOff();
                        
                        var newX = parseFloat(d3.select(this).attr("x")) + d3.event.dx;
                        
                        // Make sure the slider moves within the scrollbar horizontally - Joe
                        // left
                        if (newX < defaultX) {
                            newX = defaultX;
                        }
                        
                        // right
                        if ((newX + sliderWidth) > (self.state.gridRegion.x + self._gridWidth())) {
                            newX = self.state.gridRegion.x + self._gridWidth() - sliderWidth;
                        }
                        
                        // update the position of slider
                        self.state.svg.select('#' + self.state.pgInstanceId + '_horizontal_scrollbar_slider')
                            .attr("x", newX);
                        
                        // update the shaded area in mini map accordingly  
                        self.state.svg.select('#' + self.state.pgInstanceId + '_navigator_shaded_area')
                            .attr("x", function() {
                                // NOTE: d3 returns string so we need to use parseFloat()
                                var factor = (newX - defaultX) / self._gridWidth();
                                var minimap_width = parseFloat(d3.select('#' + self.state.pgInstanceId + '_globalview').attr("width"))  - 2*self.state.minimap.borderThickness;
                                return self.state.minimap.x + minimap_width*factor;
                            });
                            
                        // adjust
                        newX = newX - defaultX;
                        
                        var newXPos = self._invertDragPosition(self.state.horizontalScrollbarScale, newX) + xDisplayCount;
                        
                        // Horizontal grid region needs to be updated accordingly
                        self._updateHorizontalGrid(newXPos);
                    })
                    .on("dragend", self._dragended)
                );
        }
        
        // vertical scrollbar
        if (vertical === true) {
            var verticalScrollbarGrp = this.state.svg.append("g")
                .attr("id", this.state.pgInstanceId + "_vertical_scrollbar_group");
            
            // scrollbar rect
            verticalScrollbarGrp.append("line")
                .attr("x1", this.state.gridRegion.x + this._gridWidth() + barToGridMargin)
                .attr("y1", this.state.gridRegion.y)
                .attr("x2", this.state.gridRegion.x + this._gridWidth() + barToGridMargin)
                .attr("y2", this.state.gridRegion.y + this._gridHeight())
                .attr("id", this.state.pgInstanceId + "_vertical_scrollbar")
                .style("stroke", barColor)
                .style("stroke-width", barThickness);

            // slider rect
            verticalScrollbarGrp.append("rect")
                .attr("x", this.state.gridRegion.x + this._gridWidth() + barToGridMargin - sliderThickness/2) 
                .attr("y", defaultY + sliderRectY) // sets the slider to the desired position after inverting axis - Joe
                .attr("id", this.state.pgInstanceId + "_vertical_scrollbar_slider")
                .attr("height", sliderHeight)
                .attr("width", sliderThickness)
                .style("fill", sliderColor)
                .attr("class", "pg_draggable")
                .call(d3.behavior.drag()
                    .on("dragstart", self._dragstarted)
                    .on("drag", function() {
                        // Random movement while dragging triggers mouseover on labels and cells (luckily, only crosshairs show up in this case)
                        // Adding this in _dragstarted() won't work since the crosshair lines are being created during dragging
                        self._crossHairsOff();
                        
                        var newY = parseFloat(d3.select(this).attr("y")) + d3.event.dy;
                        
                        // Make sure the slider moves within the scrollbar vertically - Joe
                        // top
                        if (newY < defaultY) {
                            newY = defaultY;
                        }
                        
                        // bottom
                        if ((newY + sliderHeight) > (self.state.gridRegion.y + self._gridHeight())) {
                            newY = self.state.gridRegion.y + self._gridHeight() - sliderHeight;
                        }
                        
                        // update the position of slider
                        self.state.svg.select('#' + self.state.pgInstanceId + '_vertical_scrollbar_slider')
                            .attr("y", newY);
                            
                        // update the shaded area in mini map accordingly  
                        self.state.svg.select('#' + self.state.pgInstanceId + '_navigator_shaded_area')
                            .attr("y", function() {
                                // NOTE: d3 returns string so we need to use parseFloat()
                                var factor = (newY - defaultY) / self._gridHeight();
                                var minimap_height = parseFloat(d3.select('#' + self.state.pgInstanceId + '_globalview').attr("height")) - 2*self.state.minimap.borderThickness; 
                                return self.state.minimap.y + minimap_height*factor;
                            });
                            
                       
                        // adjust
                        newY = newY - defaultY;

                        var newYPos = self._invertDragPosition(self.state.verticalScrollbarScale, newY) + yDisplayCount;
                        
                        // Vertical grid region needs to be updated accordingly
                        self._updateVerticalGrid(newYPos);
                    })
                    .on("dragend", self._dragended)
                );
        }
    },
    
    // for scrollbars
	_createScrollbarScales: function(width, height) {
		// create list of all item ids within each axis
   	    var sourceList = this.state.yAxisRender.groupIDs();
	    var targetList = this.state.xAxisRender.groupIDs();

		this.state.verticalScrollbarScale = d3.scale.ordinal()
			.domain(sourceList.map(function(d) {
                return d; 
            }))
			.rangePoints([0, height]);

		this.state.horizontalScrollbarScale = d3.scale.ordinal()
			.domain(targetList.map(function(d) {
				return d; 
            }))
			.rangePoints([0, width]);   	    
	},
    
    _setSvgSize: function() {
        // Update the width and height of #pg_svg
        var toptitleWidth = parseInt($('#' + this.state.pgInstanceId + '_toptitle').attr('x')) + $('#' + this.state.pgInstanceId + '_toptitle')[0].getBoundingClientRect().width/2;
        var calculatedSvgWidth = this.state.gridRegion.x + this._gridWidth();
        var svgWidth = (toptitleWidth >= calculatedSvgWidth) ? toptitleWidth : calculatedSvgWidth;
        
        d3.select('#' + this.state.pgInstanceId + '_svg')
            .attr('width', svgWidth + 100)
            .attr('height', this.state.gridRegion.y + this._gridHeight() + 100); // Add an extra 100 to height - Joe
    },
    
	// Click the setting button to open the control options
	// Click the cross mark to close when it's open
	_togglePhenogridControls: function() {
		var self = this;
        // Toggle the options panel by clicking the button
		$('#' + this.state.pgInstanceId + '_slide_btn').click(function() {
			// $(this) refers to $("#pg_slide_btn")
			if ( ! $(this).hasClass("pg_slide_open")) {
				// Show the phenogrid controls
				$("#" + self.state.pgInstanceId + "_controls_options").fadeIn();
				// Remove the top border of the button by adding .pg_slide_open CSS class
				$(this).addClass("pg_slide_open");
			}
		});
        
        $('#' + this.state.pgInstanceId + '_controls_close').click(function() {
			$('#' + self.state.pgInstanceId + '_controls_options').fadeOut();
            $('#' + self.state.pgInstanceId + '_slide_btn').removeClass("pg_slide_open");
		});
	},
	
    // Click the setting button to open unmatched sources
	// Click the cross mark to close when it's open
	_toggleUnmatchedSources: function() {
        var self = this;
        $('#' + this.state.pgInstanceId + '_unmatched_btn').click(function() {
			// $(this) refers to $("#pg_unmatched_btn")
			if ( ! $(this).hasClass("pg_unmatched_open")) {
				// Show the phenogrid controls
				$('#' + self.state.pgInstanceId + '_unmatched_list').fadeIn();
				// Remove the top border of the button by adding .pg_unmatched_open CSS class
				$(this).addClass("pg_unmatched_open");
			}
		});
        
        $('#' + this.state.pgInstanceId + '_unmatched_close').click(function() {
			$('#' + self.state.pgInstanceId + '_unmatched_list').fadeOut();
            $('#' + self.state.pgInstanceId + '_unmatched_btn').removeClass("pg_unmatched_open");
		});
	},
    

	_crossHairsOff: function() {
        this.state.svg.selectAll(".pg_focusLine").remove();			
	},

	// direction: 'vertical' or 'horizontal' or 'both'
	_crossHairsOn: function(id, ypos, direction) {
		var xScale = this.state.xAxisRender.getScale();

    	var xs = xScale(id);

    	var gridRegion = this.state.gridRegion; 
        var x = gridRegion.x + (xs * gridRegion.cellPad) + 5;  // magic number to make sure it goes through the middle of the cell
        var y = gridRegion.y + (ypos * gridRegion.cellPad) + 5; 

		if (direction === 'vertical') {
			this._createFocusLineVertical(x, gridRegion.y, x, gridRegion.y + this._gridHeight());
        } else if (direction === 'horizontal') {
			this._createFocusLineHorizontal(gridRegion.x, y, gridRegion.x + this._gridWidth(), y);	        
        } else {
			// creating 4 lines around the cell, this way there's no svg elements overlapped - Joe
            this._createFocusLineVertical(x, gridRegion.y, x, gridRegion.y + gridRegion.cellPad*ypos); // vertical line above cell
            this._createFocusLineVertical(x, gridRegion.y + gridRegion.cellPad*ypos + gridRegion.cellSize, x, gridRegion.y + this._gridHeight()); // vertical line under cell
			this._createFocusLineHorizontal(gridRegion.x, y, gridRegion.x + gridRegion.cellPad*xs, y); // horizontal line on the left of cell
            this._createFocusLineHorizontal(gridRegion.x + gridRegion.cellPad*xs + gridRegion.cellSize, y, gridRegion.x + this._gridWidth(), y); // horizontal line on the right of cell	         
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
		this._showTooltip($('#' + this.state.pgInstanceId + '_tooltip'), elem, d);
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
		  	d3.select("#" + this.state.pgInstanceId + "_grid_row_" + d.ypos +" text")
				  .classed("pg_active", true);
	  		d3.select("#" + this.state.pgInstanceId + "_grid_col_" + d.xpos +" text")
				  .classed("pg_active", true);
			
			// hightlight the cell
	 		d3.select("#" + this.state.pgInstanceId + "_cell_" + d.ypos +"_" + d.xpos)
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
		d3.selectAll(".row text").classed("pg_active", false);
		d3.selectAll(".column text").classed("pg_active", false);
		d3.selectAll(".row text").classed("pg_related_active", false);
		d3.selectAll(".column text").classed("pg_related_active", false);		
		d3.selectAll(".cell").classed("pg_rowcolmatch", false);	
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
					d3.select("#" + this.state.pgInstanceId + "_grid_row_" + matches[k].ypos +" text").classed("pg_related_active", true);
				}
			}	
	  		d3.select("#" + this.state.pgInstanceId + "_grid_col_" + currenPos +" text").classed("pg_active", true);	
		} else {  // hovered over a row
			hightlightSources = false;
			var matches = this.state.dataManager.getMatrixSourceTargetMatches(currenPos, hightlightSources);

			if (typeof(matches) !== 'undefined') {
				for (var k=0; k < matches.length; k++) {
					d3.select("#" + this.state.pgInstanceId + "_grid_col_" + matches[k].xpos +" text").classed("pg_related_active", true);
				}
			}		
			d3.select("#" + this.state.pgInstanceId + "_grid_row_" + currenPos +" text").classed("pg_active", true);
		}				

	},

	_gridWidth: function() {
        var gridRegion = this.state.gridRegion; 
        var gridWidth = (gridRegion.cellPad * this.state.xAxisRender.displayLength()) - (gridRegion.cellPad - gridRegion.cellSize);
        return gridWidth;
    },

	_gridHeight: function() {
		var gridRegion = this.state.gridRegion; 
		var height = (gridRegion.cellPad * this.state.yAxisRender.displayLength()) - (gridRegion.cellPad - gridRegion.cellSize);	
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
				.attr("transform", function(d) { 
  					return "translate(" + (gridRegion.x - gridRegion.cellPad) +", " + (gridRegion.y+scale(d)*gridRegion.cellPad + 9) + ")"; 
                });
	    } else {
	    	scores	      		
                .attr("transform", function(d) { 
                    return "translate(" + (gridRegion.x + scale(d)*gridRegion.cellPad) + "," + (gridRegion.y - gridRegion.scoreOffset) +")";
                    });
	    }
	}, 

	_getCellColor: function(score) {
		var selectedScale = this.state.colorScale[this.state.selectedCalculation];
		return selectedScale(score);
	},


    // Tip info icon for more info on those text scores
	_createScoresTipIcon: function() {
		var self = this; // Used in the anonymous function 

		this.state.svg.append("text")
			.attr('font-family', 'FontAwesome')
			.text(function() {
				return '\uF05A\n'; // Need to convert HTML/CSS unicode to javascript unicode - Joe
			})
			.attr("id", this.state.pgInstanceId + "_scores_tip_icon")
            .attr("class", "pg_scores_tip_icon")
			.attr("x", this.state.gridRegion.x - 21) // based on the grid region x, 21 is offset - Joe
			.attr("y", this.state.gridRegion.y - 5) // based on the grid region y, 5 is offset - Joe
			.on("click", function() {
				self._populateDialog(htmlnotes.scores);
			});
	},
		

    // for overview mini map
	_createSmallScales: function(width, height) {
		// create list of all item ids within each axis
   	    var sourceList = this.state.yAxisRender.groupIDs();
	    var targetList = this.state.xAxisRender.groupIDs();

		this.state.smallYScale = d3.scale.ordinal()
			.domain(sourceList.map(function (d) {
                return d; 
            }))
			.rangePoints([0, height]);

		this.state.smallXScale = d3.scale.ordinal()
			.domain(targetList.map(function (d) {
				return d; 
            }))
			.rangePoints([0, width]);   	    
	},

    // Used by minimap and scrollbars
	_invertDragPosition: function(scale, value) {
		var leftEdges = scale.range();
		var size = scale.rangeBand();
		var j;
		for (j = 0; value > (leftEdges[j] + size); j++) {} 
		// iterate until leftEdges[j]+size is past value
		return j;
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


    // create color scale for each calculation method
	_createColorScalePerSimilarityCalculation: function() {
        this.state.colorScale = []; // One color scale per calculation method - Joe
        // 4 different calculations (0 - Similarity, 1 - Ration (q), 2 - Uniqueness, 3- Ratio (t))
        var len = this.state.similarityCalculation.length;
 
        for (var i = 0; i < len; i++) {
            // Except Uniqueness (index is 2), all other three methods use 100 as the maxScore
            var maxScore = 100;
            if (i === 2) {
                maxScore = this.state.dataManager.maxMaxIC; // Uniqueness 
            }
            
            // Constructs a new linear scale with the default domain [0,1] and the default range [0,1]. 
            var cs = d3.scale.linear(); 
            // Simply put: scales transform a number in a certain interval (called the domain) 
            // into a number in another interval (called the range).

            // transform a score domain to a color domain, then transform a color domain into an actual color range
            cs.domain([0, maxScore]); // sets the scale's input domain to the specified array of numbers

            // this.state.colorDomains: [0, 0.2, 0.4, 0.6, 0.8, 1]
            // this.state.colorDomains.map(cs.invert): [0, 20, 40, 60, 80, 100]
            cs.domain(this.state.colorDomains.map(cs.invert));

            // sets the scale's output range to the specified array of values
            cs.range(this.state.colorRanges);

            // colorRanges has 6 stop colors
            this.state.colorScale[i] = cs;
        }
	},

    

    

	// add a tooltip div stub, this is used to dynamically set a tooltip info 
	_createTooltipStub: function() {
		var pg_tooltip = $("<div>")
						.attr("id", this.state.pgInstanceId + '_tooltip')
                        .attr("class", 'pg_tooltip');

        var pg_tooltip_inner = $("<div>")
						.attr("id", this.state.pgInstanceId + "_tooltip_inner")
                        .attr("class", 'pg_tooltip_inner');

        pg_tooltip.append(pg_tooltip_inner);
		// Append to #pg_container
        this.state.pgContainer.append(pg_tooltip);

        // Hide the tooltip div by default
        this._hideTooltip(pg_tooltip);
	},
    
    // Bind tooltip to SVG X and Y labels as well as grid cells for mouseout - Joe
    _relinkTooltip: function() {
		var self = this;

        $(document).ready(function($){
			var $targets = $("*[data-tooltip]");
			var $tooltip = $('#' + self.state.pgInstanceId + '_tooltip');
			if ($targets.length === 0) {
				return;
			}

			self._hideTooltip($tooltip);
			
			// this hides the tooltip when we move mouse out the current element
			$targets.mouseout(function(e){  
				var elem = e.relatedTarget ||  e.toElement || e.fromElement;
				if (typeof(elem) !== 'undefined' ) {
					if (elem.id !== (self.state.pgInstanceId + '_tooltip') && elem.id !== "") {					    
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
        var pgContainerPos = this.state.pgContainer.offset();
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
        // Add the top main title to pg_svg_group
        this.state.svg.append("svg:text")
            .attr("id", this.state.pgInstanceId + "_toptitle")
            .attr("x", this.state.gridRegion.x + this._gridWidth()/2) // Calculated based on the gridRegion - Joe
            .attr("y", 40) // Fixed y position - Joe
            .style('text-anchor', 'middle') // Center the main title - Joe
            .style('font-size', '1.4em')
            .style('font-weight', 'bold')
            .text(this.state.gridTitle);
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
		$("#" + this.state.pgInstanceId + "_tooltip_inner").empty();
		$("#" + this.state.pgInstanceId + "_tooltip_inner").html(retData);

		// For phenotype ontology tree 
		if (data.type === 'phenotype') {
			// https://api.jqueryui.com/jquery.widget/#method-_on
			// Binds click event to the ontology tree expand icon - Joe
			// _renderTooltip(), the font awesome icon <i> element follows the form of id="this.state.pgInstanceId_expandOntology_HP_0001300" - Joe
			var expandOntol_icon = $('#' + this.state.pgInstanceId + '_expandOntology_' + id);
			this._on(expandOntol_icon, {
				"click": function(event) {
					this._expandOntology(id);
				}
			});
		}
        
        // For genotype expansion
		if (data.type === 'gene') {
			// In renderTooltip(), the font awesome icon <i> element follows the form of id="this.state.pgInstanceId_insert_genotypes_MGI_98297" - Joe
			var insert = $('#' + this.state.pgInstanceId + '_insert_genotypes_' + id);
            this._on(insert, {
				"click": function(event) {
					this._insertGenotypes(id);
				}
			});
            
            var remove = $('#' + this.state.pgInstanceId + '_remove_genotypes_' + id);
			this._on(remove, {
				"click": function(event) {
					this._removeGenotypes(id);
				}
			});
		}
	},

    _phenotypeTooltip: function(id, data) {
        var htmlContent = '';
        
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
            var tree = '<div id="' + this.state.pgInstanceId + '_hpoDiv">' + this._buildOntologyTree(id.replace("_", ":"), cached.edges, 0) + '</div>';
            if (tree === "<br>"){
                ontologyData += "<em>No Classification hierarchy Found</em>";
            } else {
                ontologyData += "<strong>Classification hierarchy:</strong>" + tree;
            }
        }
        
        if (expanded){
            htmlContent += ontologyData;
        } else {
            htmlContent += '<br><div class="pg_expand_ontology" id="' + this.state.pgInstanceId + '_expandOntology_' + id + '">Expand classification hierarchy<i class="pg_expand_ontology_icon fa fa-plus-circle pg_cursor_pointer"></i></div>';
        }
        
        // Finally return the rendered HTML result
		return htmlContent;
    },
    
    _cellTooltip: function(id, data) {
        var htmlContent = '';
        
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

        var targetLabel = '';
        if (this.state.gridSkeletonDataVendor === 'IMPC') {
            // Do not show the label as hyperlink since IMPC doesn't have this genotype link
            targetLabel = targetInfo.label;
        } else {
            targetLabel = this._encodeTooltipHref(targetInfo.type, targetInfo.id, targetInfo.label);
        }

        htmlContent = "<strong>" + Utils.capitalizeString(sourceInfo.type) + "</strong><br>" 
                      + this._encodeTooltipHref(sourceInfo.type, sourceId, data.a_label ) +  " " + Utils.formatScore(data.a_IC.toFixed(2)) + "<br><br>" 
                      + "<strong>In-common</strong><br>" 
                      + this._encodeTooltipHref(sourceInfo.type, data.subsumer_id, data.subsumer_label) + " (" + Utils.formatScore(data.subsumer_IC.toFixed(2)) + ", " + prefix + " " + data.value[this.state.selectedCalculation].toFixed(2) + '%' + ")<br><br>" 
                      + "<strong>Match</strong><br>" 
                      + this._encodeTooltipHref(sourceInfo.type, data.b_id, data.b_label ) + Utils.formatScore(data.b_IC.toFixed(2)) + "<br><br>" 
                      + "<strong>" + Utils.capitalizeString(targetInfo.type) + " (" + data.targetGroup + ")</strong><br>" 
                      + targetLabel;
                      
        // Finally return the rendered HTML result
		return htmlContent;
    },
    
    _vendorTooltip: function(id, data) {
        var htmlContent = '';
        
        // IMPC-specific tooltip rendering: Source, Background, IMPC gene
        var source = '<strong>' + data.info[0].id + ': </strong> ' + data.info[0].value + '<br>';
        var background = '<strong>' + data.info[1].id + ': </strong> ' + data.info[1].value + '<br>';
        var impcGene = '<strong>' + data.info[2].id + ': </strong> ' + '<a href="'+ data.info[2].href +'" target="_blank">' + data.info[2].value + '</a>' + '<br>';
        var phenodigm = '<strong>' + data.phenodigmScore.metric + ': </strong> ' + data.phenodigmScore.score.toFixed(2) + '<br>';
        
        htmlContent = source + background + impcGene + phenodigm;
        
        // Finally return the rendered HTML result
		return htmlContent;
    },
    
    _defaultTooltip: function(id, data) {
        var htmlContent = '';
        
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
            // ENABLED for now, just comment to DISABLE genotype expansion - Joe
            // for gene and single species mode only, add genotype expansion link
            if (this.state.selectedCompareTargetGroup.length === 1 && this.state.selectedCompareTargetGroup[0].name !== 'compare') {
                var expanded = this.state.dataManager.isExpanded(id); // gene id

                if (expanded){
                    htmlContent += '<br><div class="pg_expand_genotype" id="' + this.state.pgInstanceId + '_remove_genotypes_' + id + '">Remove associated genotypes<i class="pg_expand_genotype_icon fa fa-minus-circle pg_cursor_pointer"></i></div>'; 
                } else {
                    htmlContent += '<br><div class="pg_expand_genotype" id="' + this.state.pgInstanceId + '_insert_genotypes_' + id + '">Insert associated genotypes<i class="pg_expand_genotype_icon fa fa-plus-circle pg_cursor_pointer"></i></div>'; 
                }
            }
        }
        
        // Finally return the rendered HTML result
		return htmlContent;
    },
    
    // main method for rendering tooltip content
    _renderTooltip: function(id, data) {
        var htmlContent = '';
        
        if (data.type === 'phenotype') {
            htmlContent = this._phenotypeTooltip(id, data);	
        } else if (data.type === 'cell') {
            htmlContent = this._cellTooltip(id, data);	
        } else if (data.type === 'genotype' && this.state.gridSkeletonDataVendor === 'IMPC') {
            htmlContent = this._vendorTooltip(id, data);	
        } else {
            htmlContent = this._defaultTooltip(id, data);	
        }
        
        // Finally return the rendered HTML result
		return htmlContent;
    },
    
    // also encode the labels into html entities, otherwise they will mess up the tooltip content format
	_encodeTooltipHref: function(type, id, label) {
		return '<a href="' + this.state.serverURL + '/' +  type + '/' + id + '" target="_blank">' + Utils.encodeHtmlEntity(label) + '</a>';
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
			if (edges[j].pred === "subClassOf" && this.state.ontologyTreesDone !== this.state.ontologyTreeAmounts){
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
		var indent = '<em class="pg_ontology_tree_indent"></em>';

		if (treeHeight === 0) {
			return indent;
		}

		for (var i = 1; i < treeHeight; i++){
			indent += '<em class="pg_ontology_tree_indent"></em>';
		}
			 
		return indent + '&#8627'; // HTML entity - Joe
	},

	// Based on the ID, it pulls the label from CacheLabels and creates a hyperlink that allows the user to go to the respective phenotype page
	_buildOntologyHyperLink: function(id){
		return '<a href="' + this.state.serverURL + '/phenotype/' + id + '" target="_blank">' + this.state.dataManager.getOntologyLabel(id) + '</a>';
	},

	_createTargetGroupDividerLines: function() {
		var gridRegion = this.state.gridRegion;

		if (this._isCrossComparisonView() ) {
			var numOfTargetGroup = this.state.selectedCompareTargetGroup.length; 

			for (var i = 1; i < numOfTargetGroup; i++) {
				if (this.state.invertAxis) {
					// gridRegion.colLabelOffset: offset the line to reach the labels
                    var y = gridRegion.y + gridRegion.cellPad * i * this.state.defaultCrossCompareTargetLimitPerTargetGroup - (gridRegion.cellPad - gridRegion.cellSize)/2;		

                    // render horizontal divider line
                    this.state.svg.append("line")				
                        .attr("class", "pg_target_grp_divider")				
                        .attr("x1", gridRegion.x - gridRegion.rowLabelOffset)
                        .attr("y1", y)
                        .attr("x2", gridRegion.x + this._gridWidth())   // adjust this for to go beyond the row label
                        .attr("y2", y)
                        .style("stroke", this.state.targetGroupDividerLine.color)
                        .style("stroke-width", this.state.targetGroupDividerLine.thickness)
                        .style("shape-rendering", "crispEdges");
				} else {
					// Perfectly center the first divider line between the 10th and 11th cell, same rule for the second line ...
                    var x = gridRegion.x + gridRegion.cellPad * i * this.state.defaultCrossCompareTargetLimitPerTargetGroup - (gridRegion.cellPad - gridRegion.cellSize)/2;		

                    // render vertical divider line
					this.state.svg.append("line")				
                        .attr("class", "pg_target_grp_divider")					
                        .attr("x1", x)
                        .attr("y1", gridRegion.y - gridRegion.colLabelOffset)
                        .attr("x2", x)
                        .attr("y2", gridRegion.y + this._gridHeight())
                        .style("stroke", this.state.targetGroupDividerLine.color)
                        .style("stroke-width", this.state.targetGroupDividerLine.thickness)
                        .style("shape-rendering", "crispEdges");

					// render the slanted line between targetGroup (targetGroup) columns
					this.state.svg.append("line")				
                        .attr("class", "pg_target_grp_divider")
                        // rotate(<rotate-angle> [<cx> <cy>])
                        // The optional cx and cy values represent the unitless coordinates of the point used as a center of rotation. 
                        // If cx and cy are not provided, the rotation is about the origin of the current user coordinate system. 
                        .attr("transform", "rotate(-45 " + x + " " + (gridRegion.y - gridRegion.colLabelOffset) + ")")				
                        .attr("x1", x)
                        .attr("y1", gridRegion.y - gridRegion.colLabelOffset)
                        .attr("x2", x + this.state.targetGroupDividerLine.rotatedDividerLength)  // extend the line out to underline the labels					
                        .attr("y2", gridRegion.y - gridRegion.colLabelOffset)
                        .style("stroke", this.state.targetGroupDividerLine.color)
                        .style("stroke-width", this.state.targetGroupDividerLine.thickness)
                        .style("shape-rendering", "crispEdges");
				}
			}
		}
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
            var matrix = this.state.dataManager.buildMatrix(xvalues, yvalues, false, this.state.owlSimFunction);
        } else {
            var matrix = this.state.dataManager.buildMatrix(xvalues, yvalues, false);
        }

        // create column labels first, so the added genotype cells will overwrite the background color - Joe
        // create columns using the xvalues (targets)
	  	var column = this.state.svg.selectAll(".column")
	        .data(xvalues)
	        .enter()
            .append("g")
            .attr("class", 'column')
            .style("font-size", '11px')            
			.attr("id", function(d, i) { 
				return self.state.pgInstanceId + "_grid_col_" + i;
            })	      	
	        .attr("transform", function(d, i) { 
                var offset = gridRegion.colLabelOffset;
                // i starts from 0
                return "translate(" + (gridRegion.x + (i*gridRegion.cellPad)) + "," + (gridRegion.y - offset) + ")rotate(-45)"; 
            }); //-45

	    // create column labels
	  	column.append("text")
	      	.attr("x", 0)
	      	.attr("y", xScale.rangeBand()+2)  //2
		    .attr("dy", ".32em")
            .style('fill', function(d) { // add different color to genotype labels
                // Only added genotypes have this `parentGeneID` property
                if (d.type === 'genotype' && typeof(d.parentGeneID) !== 'undefined') {
                    return '#EA763B'; // fill color needs to be here instead of CSS, for export purpose - Joe
                } else {
                    return '';
                }
            })
		    .attr("data-tooltip", this.state.pgInstanceId + "_tooltip")   			
	      	.attr("text-anchor", "start")
	      	.text(function(d) { 		
	      		return Utils.getShortLabel(d.label, self.state.labelCharDisplayCount); 
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
	
        // grey background for added genotype columns - Joe
        // no need to add this grey background for multi species or owlSimFunction === 'compare' - Joe
        if (this.state.selectedCompareTargetGroup.length === 1 && this.state.selectedCompareTargetGroup[0].name !== 'compare') {
            column.append("rect")
                .attr("y", xScale.rangeBand() - 1 + gridRegion.colLabelOffset)
                .attr('width', gridRegion.cellSize)
                .attr('height', self._gridHeight())
                .style('fill', function(d){
                    // Only added genotypes have this `parentGeneID` property
                    if (d.type === 'genotype' && typeof(d.parentGeneID) !== 'undefined') {
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
				return self.state.pgInstanceId + "_grid_row_" + i;
            })
  			.attr("transform", function(d, i) { 
                var y = self.state.gridRegion.y;
                var ypad = self.state.gridRegion.cellPad;

                return "translate(" + gridRegion.x +"," + (y + (i*ypad)) + ")"; 
            });

   		// create row labels
	  	row.append("text")
			.attr("x", -gridRegion.rowLabelOffset) // shift a bit to the left to create some white spaces for inverting	  		
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
                // Only added genotypes have this `parentGeneID` property
                if (el.type === 'genotype' && typeof(el.parentGeneID) !== 'undefined') {
                    return '#EA763B'; // fill color needs to be here instead of CSS, for SVG export purpose - Joe
                } else {
                    return '';
                }
            })
			.attr("data-tooltip", this.state.pgInstanceId + "_tooltip")   				      
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
                .attr('height', gridRegion.cellSize)
                .style('fill', function(d, i) { // add different color to genotype labels
                    var el = self.state.yAxisRender.itemAt(i);
                    // Only added genotypes have this `parentGeneID` property
                    if (el.type === 'genotype' && typeof(el.parentGeneID) !== 'undefined') {
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
		      	.attr("id", function(d) { 
		      		return self.state.pgInstanceId + "_cell_"+ d.ypos + "_" + d.xpos; 
                })
		        .attr("class", "cell")
		        .attr("x", function(d) { 
		        	return d.xpos * gridRegion.cellPad;
                })
		        .attr("width", gridRegion.cellSize)
		        .attr("height", gridRegion.cellSize) 
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
		        .on("mouseout", function() {
		        	// _mouseout() removes the matching highlighting as well as the crosshairs - Joe
                    self._mouseout();
		        });
		}
	},

    
	/*
	 * Change the list of phenotypes and filter the models accordingly.
	 */
	_updateGrid: function(newXPos, newYPos){
		var xSize = this.state.xAxisRender.groupLength();
		var ySize = this.state.yAxisRender.groupLength();

		this.state.currXIdx = (newXPos >= xSize) ? xSize : newXPos;

		this.state.currYIdx = (newYPos >= ySize) ? ySize : newYPos;

		// note: that the currXIdx accounts for the size of the highlighted selection area
		// so, the starting render position is this size minus the display limit
		this.state.xAxisRender.setRenderStartPos(this.state.currXIdx - this.state.xAxisRender.displayLength());
		this.state.xAxisRender.setRenderEndPos(this.state.currXIdx);

		this.state.yAxisRender.setRenderStartPos(this.state.currYIdx - this.state.yAxisRender.displayLength());
		this.state.yAxisRender.setRenderEndPos(this.state.currYIdx);
		
        this._recreateGrid();
	},
    
    // used by vertical scrollbar 
    _updateVerticalGrid: function(newYPos){
		var ySize = this.state.yAxisRender.groupLength();

		this.state.currYIdx = (newYPos >= ySize) ? ySize : newYPos;

		this.state.yAxisRender.setRenderStartPos(this.state.currYIdx - this.state.yAxisRender.displayLength());
		this.state.yAxisRender.setRenderEndPos(this.state.currYIdx);
		
        this._recreateGrid();
	},
    
    // used by horizontal scrollbar 
    _updateHorizontalGrid: function(newXPos){
		var xSize = this.state.xAxisRender.groupLength();

		this.state.currXIdx = (newXPos >= xSize) ? xSize : newXPos;

		// note: that the currXIdx accounts for the size of the hightlighted selection area
		// so, the starting render position is this size minus the display limit
		this.state.xAxisRender.setRenderStartPos(this.state.currXIdx - this.state.xAxisRender.displayLength());
		this.state.xAxisRender.setRenderEndPos(this.state.currXIdx);
		
        this._recreateGrid();
	},
    
    _recreateGrid: function() {
        this._clearGrid();
		this._createGrid();
        // this must be called  here so the tooltip disappears when we mouseout the current element - Joe
		this._relinkTooltip();
    },

	_clearGrid: function() {
		this.state.svg.selectAll("g.row").remove();
		this.state.svg.selectAll("g.column").remove();
		this.state.svg.selectAll("g.pg_score_text").remove();
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
				dialogClass: "pg_faq_dialog_bg_color",
				position: {
			 		my: "top", 
					at: "top+25%",
					of: '#' + this.state.pgContainerId
				},
				title: 'Phenogrid Notes'
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
			.attr('id', this.state.pgInstanceId + '_gradient_legend');
			
		var gridRegion = this.state.gridRegion;

		// The <linearGradient> element is used to define a linear gradient background - Joe
		// The <linearGradient> element must be nested within a <defs> tag. 
		// The <defs> tag is short for definitions and contains definition of special elements (such as gradients)
		var gradient = gradientGrp.append("svg:defs").append("svg:linearGradient") 
			.attr("id", this.state.pgInstanceId + "_gradient_legend_fill") // this id is used for the fill attribute - Joe
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
			.attr("id", this.state.pgInstanceId + "_gradient_legend_rect")
			.attr("width", this.state.gradientRegion.width)
			.attr("height", this.state.gradientRegion.height) 
			.attr("fill", "url(#" + this.state.pgInstanceId + "_gradient_legend_fill)"); // The fill attribute links the element to the gradient defined in svg:linearGradient - Joe
		
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
		var gradientTextGrp = this.state.svg.select('#' + this.state.pgInstanceId + '_gradient_legend').append("g")
			.attr('id', this.state.pgInstanceId + '_gradient_legend_texts')
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
        // First to check if there's any unmatched sources
        this.state.unmatchedSources = this._getUnmatchedSources();
        //console.log(this.state.pgInstanceId + ' Unmatched: ' + this.state.unmatchedSources);
        // Proceed if there's any unmatched
        if (this.state.unmatchedSources.length > 0) {
            // create the container div
            var pg_unmatched = $('<div id="' + this.state.pgInstanceId + '_unmatched" class="pg_unmatched"></div>');

            // Not in the #this.state.pgInstanceId_svg_group div since it's HTML - Joe
            this.state.pgContainer.append(pg_unmatched);
            
            // Need to put .pg_unmatched_list_arrow_border span before .pg_unmatched_list_arrow span - Joe
            var pg_unmatched_list = '<div id="' + this.state.pgInstanceId + '_unmatched_list" class="pg_unmatched_list"><i id="' + this.state.pgInstanceId + '_unmatched_close" class="fa fa-times pg_unmatched_close"></i><span class="pg_unmatched_list_arrow_border"></span><span class="pg_unmatched_list_arrow"></span><div id="' + this.state.pgInstanceId + '_unmatched_list_data"></div></div>';
            
            // Hide/show unmatched - button - Joe
            var pg_unmatched_btn ='<div id="' + this.state.pgInstanceId + '_unmatched_btn" class="pg_unmatched_btn"><i class="fa fa-exclamation-triangle"></i> ' + this.state.unmatchedButtonLabel + ' </div>';
     
            pg_unmatched.append(pg_unmatched_list);
            pg_unmatched.append(pg_unmatched_btn);

            $('#' + this.state.pgInstanceId + '_unmatched_list').hide(); // Hide by default
            
            // IMPC input data ships will all HP labels, no need to grab via ajax - Joe
            if (this.state.gridSkeletonDataVendor === 'IMPC') {
                var impcUnmatchedSources = [];
                for (var i=0; i< this.state.unmatchedSources.length; i++) {
                    for (var idx in this.state.gridSkeletonData.yAxis[0].phenotypes) {
                        if (this.state.gridSkeletonData.yAxis[0].phenotypes[idx].id === this.state.unmatchedSources[i]) {
                            // use "label" instead of "term" here
                            var item = {id: this.state.gridSkeletonData.yAxis[0].phenotypes[idx].id, label: this.state.gridSkeletonData.yAxis[0].phenotypes[idx].term};
                            impcUnmatchedSources.push(item);
                            break;
                        }
                    }
                }
                // Now we have all the unmatched source labels to render
                for (var j=0; j< impcUnmatchedSources.length; j++) {
                    var pg_unmatched_list_item = '<div class="pg_unmatched_list_item"><a href="' + this.state.serverURL + '/phenotype/' + impcUnmatchedSources[j].id + '" target="_blank">' + impcUnmatchedSources[j].label + '</a></div>';
                    $('#' + this.state.pgInstanceId + '_unmatched_list_data').append(pg_unmatched_list_item);
                }
            } else {
                // Fetch labels for unmatched sources via async ajax calls
                // then format and append them to the pg_unmatched_list div - Joe
                this._formatUnmatchedSources(this.state.unmatchedSources);
            }

            // Position and toggle
            this._positionUnmatchedSources();
            this._toggleUnmatchedSources();
        }
    },

	// Phengrid controls/options
	_createPhenogridControls: function() {
		var self = this; // Use self inside anonymous functions 
		
		var phenogridControls = $('<div id="' + this.state.pgInstanceId + '_controls" class="pg_controls"></div>');

		// Not in the #pg_svg_group div since it's HTML - Joe
		this.state.pgContainer.append(phenogridControls);
		
		// Need to put .pg_controls_options_arrow_border span before .pg_controls_options_arrow span - Joe
		var optionhtml = '<div id="' + this.state.pgInstanceId + '_controls_options" class="pg_controls_options"><i id="' + this.state.pgInstanceId + '_controls_close" class="fa fa-times pg_controls_close"></i><span class="pg_controls_options_arrow_border"></span><span class="pg_controls_options_arrow"></span></div>';
		
		// Hide/show panel - button - Joe
		var slideBtn = '<div id="' + this.state.pgInstanceId + '_slide_btn" class="pg_slide_btn"><i class="fa fa-bars"></i> OPTIONS</div>';
		
		var options = $(optionhtml);
        
        // only show the Organism(s) option when we have at least two speices
        if (this.state.initialTargetGroupLoadList.length > 1) {
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
        $('#' + this.state.pgInstanceId + '_controls_options').hide(); 
        
		// add the handler for the checkboxes control
		$('#' + this.state.pgInstanceId + '_organism').change(function(d) {
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
				alert("You must have at least 1 species selected.");
			}

			self._createAxisRenderingGroups();

            self._updateDisplay();
            
            // Update unmatched sources due to changes of species
            // No need to call this for other control actions - Joe
            // Unmatched sources
            // Remove the HTML if created from the former load
            $('#' + self.state.pgInstanceId + '_unmatched').remove();
            self._createUnmatchedSources();
		});

		$('#' + this.state.pgInstanceId + '_calculation').change(function(d) {
			self.state.selectedCalculation = parseInt(d.target.value); // d.target.value returns quoted number - Joe
            self._updateDisplay();
		});

		// add the handler for the select control
		$('#' + this.state.pgInstanceId + '_sortphenotypes').change(function(d) {
			self.state.selectedSort = d.target.value;
			// sort source with default sorting type
			if (self.state.invertAxis){
				self.state.xAxisRender.sort(self.state.selectedSort); 
			} else {
				self.state.yAxisRender.sort(self.state.selectedSort); 
			}
            self._updateDisplay();
		});

		$("#" + this.state.pgInstanceId + "_axisflip").click(function() {	
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
        $("#" + this.state.pgInstanceId + "_export").click(function() {	
            // SVG styles are applied with D3, not in CSS for this exporting purpose
            var svgElementClone = $('#' + self.state.pgInstanceId + '_svg').clone(); // clone the svg to manipulate
            // Use data uri for svg logo
            //svgElementClone.find('#' + self.state.pgInstanceId + '_logo').attr('href', images.logo);
            svgElementClone.find('#' + self.state.pgInstanceId + '_scores_tip_icon').remove(); // remove fontawesome icon
            svgElementClone.find('#' + self.state.pgInstanceId + '_monarchinitiative_text').removeClass('pg_hide'); // Show text in exported SVG
            
            var svgStr = '<svg xmlns="http://www.w3.org/2000/svg">' + svgElementClone.html() + '</svg>';
            // The standard W3C File API Blob interface is not available in all browsers. 
            // Blob.js is a cross-browser Blob implementation that solves this.
            var blob = new Blob([svgStr], {type: "image/svg+xml"});
            filesaver.saveAs(blob, "phenogrid.svg");
		});
        
		// FAQ popups
		$('#' + this.state.pgInstanceId + '_sorts_faq').click("click", function() {
			self._populateDialog(htmlnotes.sorts);
		});

		$('#' + this.state.pgInstanceId + '_calcs_faq').click(function(){
			self._populateDialog(htmlnotes.calcs);
		});
		
		$('#' + this.state.pgInstanceId + '_about_phenogrid').click(function() {	
			self._populateDialog(htmlnotes.faq);
		});
	},

    // To be used for exported phenogrid SVG, hide this by default
    _createMonarchInitiativeText: function() {
        this.state.svg.append("text")
			.attr("x", this.state.gridRegion.x - 90)
			.attr("y", this.state.gridRegion.y + this._gridHeight() + 90) // 90 is margin
			.attr("id", this.state.pgInstanceId + "_monarchinitiative_text")
            .style('font-size', '10px')
			.text('Phenotype comparison data provided by the Monarch Initiative ' + this.state.serverURL);
    },
    
	// Position the control panel when the gridRegion changes
	_positionPhenogridControls: function() {
		// Note: CANNOT use this inside _createPhenogridControls() since the _createGrid() is called after it
		// we won't have the _gridHeight() by that time - Joe
		var gridRegion = this.state.gridRegion; 
		var marginTop = 17; // Create some whitespace between the button and the y labels 
		$('#' + this.state.pgInstanceId + '_slide_btn').css('top', gridRegion.y + this._gridHeight() + marginTop);
        $('#' + this.state.pgInstanceId + '_slide_btn').css('left', gridRegion.x + this._gridWidth() + 20); // 20 is margin
		// The height of .pg_controls_options defined in phenogrid.css - Joe
		var pg_ctrl_options = $('#' + this.state.pgInstanceId + '_controls_options');
		// shrink the height when we don't show the species selection
        if (this.state.initialTargetGroupLoadList.length === 1) {
            pg_ctrl_options.css('height', 280);
        }
        // options div has an down arrow, -10 to create some space between the down arrow and the button - Joe
		pg_ctrl_options.css('top', gridRegion.y + this._gridHeight() - pg_ctrl_options.outerHeight() - 10 + marginTop);
        pg_ctrl_options.css('left', gridRegion.x + this._gridWidth() + 42); // create a 10px gap between the vertical scrollbar (12px wide) - Joe
    },	
	
	_createOrganismSelection: function() {
		var optionhtml = "<div class='pg_ctrl_label'>Organism(s)</div>" + 
			"<div id='" + this.state.pgInstanceId + "_organism'>";
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
				" <i class='fa fa-info-circle cursor_pointer' id='" + this.state.pgInstanceId + "_calcs_faq'></i></div>" + // <i class='fa fa-info-circle'></i> FontAwesome - Joe
				"<div id='" + this.state.pgInstanceId + "_calculation'>";

		for (var idx in this.state.similarityCalculation) {
			if ( ! this.state.similarityCalculation.hasOwnProperty(idx)) {
				break;
			}			
			var checked = "";
			if (this.state.similarityCalculation[idx].calc === this.state.selectedCalculation) {
				checked = "checked";
			}
			// We need the name attr for radio inputs so only one is checked - Joe
			optionhtml += '<div class="pg_select_item"><input type="radio" name="' + this.state.pgInstanceId + '_calc_method" value="' + this.state.similarityCalculation[idx].calc + '" ' + checked + ">" + this.state.similarityCalculation[idx].label + '</div>';
		}
		optionhtml += "</div><div class='pg_hr'></div>";
		return $(optionhtml);
	},

	// create the html necessary for selecting the sort
	_createSortPhenotypeSelection: function () {
		var optionhtml ="<div class='pg_ctrl_label'>Sort Phenotypes" + 
				' <i class="fa fa-info-circle cursor_pointer" id="' + this.state.pgInstanceId + '_sorts_faq"></i></div>' + // <i class='fa fa-info-circle'></i> FontAwesome - Joe
				'<div id="' + this.state.pgInstanceId + '_sortphenotypes">';

		for (var idx in this.state.phenotypeSort) {
			if ( ! this.state.phenotypeSort.hasOwnProperty(idx)) {
				break;
			}

			var checked = "";
			if (this.state.phenotypeSort[idx] === this.state.selectedSort) {
				checked = "checked";
			}
			// We need the name attr for radio inputs so only one is checked - Joe
			optionhtml += '<div class="pg_select_item"><input type="radio" name="' + this.state.pgInstanceId + '_sort" value="' + this.state.phenotypeSort[idx] + '" ' + checked + '>' + this.state.phenotypeSort[idx] + '</div>';
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
		var optionhtml = '<div class="pg_select_item"><input type="checkbox" id="' + this.state.pgInstanceId + '_axisflip"' + checked + '>Invert Axis</div><div class="pg_hr"></div>'; 
		return $(optionhtml);
	},

	// create about phenogrid FAQ inside the controls/options - Joe
	_createAboutPhenogrid: function () {
		var html = '<div class="pg_select_item">About Phenogrid <i class="fa fa-info-circle cursor_pointer" id="' + this.state.pgInstanceId + '_about_phenogrid"></i></div>'; 
		return $(html);
	},
	
    // Export current state of phenogrid as SVG file to be used in publications
    _createExportPhenogridButton: function() {
        var btn = '<div id="' + this.state.pgInstanceId + '_export" class="pg_export">Save as SVG...</div><div class="pg_hr"></div>';
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
		$('#' + this.state.pgInstanceId + '_unmatched_btn').css('top', gridRegion.y + this._gridHeight() + 17); // 17 is top margin
        $('#' + this.state.pgInstanceId + '_unmatched_list').css('top', gridRegion.y + this._gridHeight() + $('#' + this.state.pgInstanceId + '_unmatched_btn').outerHeight() + + 17 + 10);
        $('#' + this.state.pgInstanceId + '_unmatched_list').css('width', gridRegion.x + this._gridWidth() - 20); // don't include the paddings 2*10px = 20 - Joe
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
        $('#' + self.state.pgInstanceId + '_unmatched_list_data').append(pg_unmatched_list_item);
        
        // iterative back to process to make sure we processed all the targets
        self._formatUnmatchedSources(targets);
    },
    
    // ajax
    _fetchUnmatchedLabel: function(target, targets, callback) {
        var self = this;
        
        // Note: phenotype label is not in the unmatched array when this widget runs as a standalone app,
        // so we need to fetch each label from the monarch-app server
        // Sample output: http://monarchinitiative.org/phenotype/HP:0000746.json
        // Separate the ajax request with callbacks
        var jqxhr = $.ajax({
            url: this.state.serverURL + "/phenotype/" + target + ".json",
            async: true,
            method: 'GET',
            dataType: 'json'
        });
        
        jqxhr.done(function(data) {
            callback(self, target, targets, data); // callback needs self for reference to global this - Joe
        });
        
        jqxhr.fail(function () { 
            console.log('Ajax error - _fetchUnmatchedLabel()')
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
		var hrefLink = '<a href="' + parent.state.serverURL + '/phenotype/' + id + '" target="_blank">' + info.label + '</a>';
		var ontologyData = "<strong>Phenotype: </strong> " + hrefLink + "<br>";
		ontologyData += "<strong>IC:</strong> " + info.IC.toFixed(2) + "<br>";
        ontologyData += "<strong>Sum:</strong> " + info.sum.toFixed(2) + "<br>";
        ontologyData += "<strong>Frequency:</strong> " + info.count + "<br><br>";

		var classTree = parent._buildOntologyTree(id.replace("_", ":"), d.edges, 0);

		if (classTree === "<br>"){
			ontologyData += "<em>No classification hierarchy data found</em>";
		} else {
			ontologyData += "<strong>Classification hierarchy:</strong>" + classTree;
		}

		$('#' + parent.state.pgInstanceId + '_tooltip_inner').html(ontologyData);
	},

    // Genotypes expansion for gene (single species mode) - Joe
    _insertGenotypes: function(id) {
        // change the plus icon to spinner to indicate the loading
        $('.pg_expand_genotype_icon').removeClass('fa-plus-circle');
        $('.pg_expand_genotype_icon').addClass('fa-spinner fa-pulse');
        
        // When we can expand a gene, we must be in the single species mode,
        // and there must be only one species in this.state.selectedCompareTargetGroup - Joe
        var species_name = this.state.selectedCompareTargetGroup[0].name;

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
  
                // update the underlying data (not ordered) in dataLoader
                // In dataManager, reorderedTargetEntriesNamedArray and reorderedTargetEntriesIndexArray are also updated once we update the 
                // underlying data in dataLoader, because variable reference in javascript, not actual copy/clone - Joe 
                this.state.dataLoader.targetData[species_name][genotype_id].visible = true; 
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
            // Pass `this` to dataLoader as parent for callback use - Joe
            this.state.dataLoader.getGenotypes(id, cb, this);
        }
	},
    
    // this cb has all the matches info returned from the compare
    // e.g., http://monarchinitiative.org/compare/:id1+:id2/:id3,:id4,...idN
    // parent refers to the global `this` and we have to pass it
    _insertGenotypesCb: function(results, id, parent, errorMsg) {
        console.log(results);

        // When there's an error message specified, simsearch results must be empty - Joe
        if (typeof(errorMsg) === 'undefined') {
            // add genotypes to data, and update target axis
            if (results.b.length > 0) {
                // When we can expand a gene, we must be in the single species mode,
                // and there must be only one species in this.state.selectedCompareTargetGroup - Joe
                var species_name = parent.state.selectedCompareTargetGroup[0].name;

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
            }
        } else {
            // pop up the error message in dialog
            parent._populateDialog(errorMsg);
        }
	},

    // Genotypes expansion for gene (single species mode)
    // hide expanded genotypes
    _removeGenotypes: function(id) {
        // When we can expand a gene, we must be in the single species mode,
        // and there must be only one species in this.state.selectedCompareTargetGroup - Joe
        var species_name = this.state.selectedCompareTargetGroup[0].name;
        
        // array of genotype id list
        var associated_genotype_ids = this.state.dataLoader.loadedGenotypes[id];
        
        // change 'visible' to false 
        for (var i = 0; i < associated_genotype_ids.length; i++) {
            var genotype_id = associated_genotype_ids[i];
            // update the underlying data
            // In dataManager, reorderedTargetEntriesNamedArray and reorderedTargetEntriesIndexArray are also updated once we update the 
            // underlying data in dataLoader, because variable reference in javascript, not actual copy/clone - Joe 
            this.state.dataLoader.targetData[species_name][genotype_id].visible = false; 
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