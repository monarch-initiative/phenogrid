(function () {
'use strict';

/*
 * Phenogrid
 *
 * Phenogrid is implemented as a jQuery UI widget. The phenogrid widget uses semantic similarity calculations provided
 * by OWLSim (www.owlsim.org),  as provided through APIs from the Monarch Initiative (www.monarchinitiative.org).
 *
 * https://github.com/monarch-initiative/phenogrid
 *
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
            serverURL: "https://monarchinitiative.org", // will be overwritten by phenogrid_config.js, and Phenogrid constructor
            gridSkeletonData: {},
            selectedCalculation: 0, // index 0 is Similarity by default. (0 - Similarity, 1 - Ratio (q), 2 - Uniqueness, 3- Ratio (t))
            selectedSort: "Frequency", // sort method of sources: "Alphabetic", "Frequency and Rarity", "Frequency" 
            messaging: {
                misconfig: 'Please fix your config to have at least one target group.',
                gridSkeletonDataError: 'No phenotypes to compare.',
                noAssociatedGenotype: 'This gene has no associated genotypes.',
                noSimSearchMatchForExpandedGenotype: 'No similarity matches found between the provided phenotypes and expanded genotypes.',
                noSimSearchMatch: 'No similarity matches found for {%groupName%} based on the provided phenotypes.' // {%groupName%} is placeholder
            },
            // For Vendor data integration
            gridSkeletonDataVendor: '', // Use 'IMPC' in constructor
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
            monarchInitiativeText: 'Powered by The Monarch Initiative',
            unmatchedButtonLabel: 'Unmatched Phenotypes',
            optionsBtnText: 'Options',
            gridTitle: 'Phenotype Similarity Comparison',       
            singleTargetModeTargetLengthLimit: 30, //  defines the limit of the number of targets to display
            sourceLengthLimit: 30, //  defines the limit of the number of sources to display
            multiTargetsModeTargetLengthLimit: 10,    // the number of visible targets per group to be displayed in cross compare mode  
            targetLabelCharLimit : 23,
            ontologyDepth: 10,	// Numerical value that determines how far to go up the tree in relations.
            ontologyDirection: "OUTGOING",	// String that determines what direction to go in relations.  Default is "out".
            ontologyRelationship: "subClassOf",
            ontologyQuery: "/neighborhood/", // Keep the slashes
            ontologyTreeAmounts: 1,	// Allows you to decide how many HPO Trees to render.  Once a tree hits the high-level parent, it will count it as a complete tree.  Additional branchs or seperate trees count as seperate items
                                // [vaa12] DO NOT CHANGE UNTIL THE DISPLAY HPOTREE FUNCTIONS HAVE BEEN CHANGED. WILL WORK ON SEPERATE TREES, BUT BRANCHES MAY BE INACCURATE
            targetGroupItemExpandLimit: 5, // sets the limit for the number of genotype expanded on grid 
            unstableTargetGroupItemPrefix: ['MONARCH:', '_:'], //https://github.com/monarch-initiative/monarch-app/issues/1024#issuecomment-163733837
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
                y: 75, 
                width:100, // the actual width will be calculated based on the number of x count - Joe
                height:100, // the actual height will be calculated based on the number of y count - Joe
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
            targetGroupDividerLine: {
                color: "#EA763B",
                thickness: 1,
                rotatedDividerLength: 150 // the length of the divider line for the rotated labels
            },
            gridRegion: {
                x:240, 
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
            optionsControls: {
                left: 30,
                top: 35,
                defaultButtonWidth: 75 // the width of the 'Options' button
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

        // The widget is responsible for removing everything that it introduced into the DOM
        _destroy: function() {
            this.element.empty();
        },
    
        // The _create() method is the jquery UI widget's constructor. 
        // There are no parameters, but this.element and this.options are already set.
        // According to this article, http://www.erichynds.com/blog/tips-for-developing-jquery-ui-widgets
        // the widget factory automatically fires the _create() and _init() methods during initialization, 
        // in that order. At first glance it appears that the effort is duplicated, but there is a sight difference 
        // between the two. Because the widget factory protects against multiple instantiations on the same element, 
        // _create() will be called a maximum of one time for each widget instance, 
        // whereas _init() will be called each time the widget is called without arguments.
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

            // taxon is used by dataLoader to specify 'target_species' in query URL - Joe
            this.state.targetGroupList = [];
            
            // Create new arrays for later use
            // initialTargetGroupLoadList is used for loading the simsearch data for the first time
            this.state.initialTargetGroupLoadList = [];
            
            // selectedCompareTargetGroup is used to control what group are loaded
            // it's possible that a group is in initialTargetGroupLoadList but there's no simsearch data returned - Joe
            this.state.selectedCompareTargetGroup = [];

            // create the Phenogrid div
            this._createPhenogridContainer();
            
            // show loading spinner - Joe
            this._showLoadingSpinner();

            // We need some basic data validation here to make sure 
            // there are at least two phenotypes (one from each axis) to send off to the compare API before trying
            if (this.state.gridSkeletonData.xAxis.length > 0 && this.state.gridSkeletonData.yAxis.length > 0) { 
                // Use provided grid title if there's one, otherwise use default
                if (typeof(this.state.gridSkeletonData.title) !== 'undefined' && this.state.gridSkeletonData.title !== '' && this.state.gridSkeletonData.title !== null) {
                    this.state.gridTitle = this.state.gridSkeletonData.title;
                }
                
                // Parse to get unique source phenotype ID list
                this._parseGridSourceList();
                
                // Specify the final data loading callback to create all the display components
                var self = this;
                // no change to the callback - Joe
                this.state.asyncDataLoadingCallback = function() {
                    self._asyncDataLoadingCB(self); 
                };
                    
                // Vendor data integration
                if (this.state.gridSkeletonDataVendor === 'IMPC') {
                    this._initGridSkeletonDataForVendor();
                } else {
                    // Load data from compare API for geneList
                    if (this.state.owlSimFunction === 'compare' && this.state.geneList.length !== 0) {
                        this._initCompare();
                    } else if (this.state.owlSimFunction === 'search' && this.state.targetSpecies !== '') {
                        this._initSearch();
                    } else {
                        this._initGridSkeletonData();
                    }
                }
            } else {
                // No need to compose the compare API call 
                this._showGridSkeletonDataErrorMsg();
            }
        },

        // use the human phenotypes from the input JSON
        _parseGridSourceList: function() {
            // gridSourceList is an array of phenotype ids
            var gridSourceList = [];
            for (var i = 0; i < this.state.gridSkeletonData.yAxis.length; i++) {
                gridSourceList.push(this.state.gridSkeletonData.yAxis[i].id);
            }

            // Remove duplicated source IDs and add this gridSourceList to the global state variable - Joe
            this.state.gridSourceList = this._removeDuplicatedSourceId(gridSourceList);
        },
        
        // Monarch use case
        _initGridSkeletonData: function() {
            // Compose the target group list based on gridSkeletonData.xAxis
            for (var j = 0; j < this.state.gridSkeletonData.xAxis.length; j++) {
                // E.g., {groupName: "Homo sapiens", groupId: "9606"}
                this.state.targetGroupList.push(this.state.gridSkeletonData.xAxis[j]);
            }

            // load the target targetGroup list
            this._parseTargetGroupList();
     
            // initialize data processing class for simsearch query
            this.state.dataLoader = new DataLoader(this.state.serverURL, this.state.simSearchQuery);
            
            // starting loading the data from simsearch
            //optional parm: this.limit
            this.state.dataLoader.load(this.state.gridSourceList, this.state.initialTargetGroupLoadList, this.state.asyncDataLoadingCallback);
        },
        
        // Monarch analyze/phenotype compare use case
        _initCompare: function() {
            // overwrite the this.state.targetGroupList with only 'compare'
            // this 'compare' is used in dataLoader.loadCompareData() and dataManager.buildMatrix() too - Joe
            var compare = "compare";
            this.state.targetGroupList = [
                {groupName: compare, groupId: compare}
            ];
            
            // load the target targetGroup list
            this._parseTargetGroupList();	

            // initialize data processing class for compare query
            this.state.dataLoader = new DataLoader(this.state.serverURL, this.state.compareQuery);

            // starting loading the data from compare api
            // NOTE: the owlsim data returned form the ajax GET may be empty (no matches), we'll handle this in the callback - Joe
            this.state.dataLoader.loadCompareData(this.state.targetGroupList[0].groupName, this.state.gridSourceList, this.state.geneList, this.state.asyncDataLoadingCallback);
        },

        // Monarch analyze/phenotype search use case
        _initSearch: function() {
            // targetSpecies is used by monarch-app's Analyze page, the dropdown menu under "Search" section - Joe
            if (this.state.targetSpecies === 'all') {
                this.state.targetGroupList = this.state.gridSkeletonData.xAxis;

                // load the target targetGroup list
                this._parseTargetGroupList();
            } else { 
                // when single group is selected (taxon is passed in via this.state.targetSpecies)
                // load just the one selected from the dropdown menu - Joe
                for (var i = 0; i < this.state.gridSkeletonData.xAxis.length; i++) {
                    if (this.state.gridSkeletonData.xAxis[i].groupId === this.state.targetSpecies) {
                        this.state.targetGroupList.push(this.state.gridSkeletonData.xAxis[i]);
                        this._parseTargetGroupList();	
                        break;
                    }	
                }
            }
            
            // initialize data processing class for simsearch query
            this.state.dataLoader = new DataLoader(this.state.serverURL, this.state.simSearchQuery);
            
            // starting loading the data from simsearch
            this.state.dataLoader.load(this.state.gridSourceList, this.state.initialTargetGroupLoadList, this.state.asyncDataLoadingCallback, this.state.searchResultLimit);
        },

        // Vendor (E.g., IMPC) use case or similar
        _initGridSkeletonDataForVendor: function() {
            // Compose the target group list based on gridSkeletonData.xAxis
            for (var j = 0; j < this.state.gridSkeletonData.xAxis.length; j++) {
                // E.g., {groupName: "Homo sapiens", groupId: "9606"}
                this.state.targetGroupList.push(this.state.gridSkeletonData.xAxis[j]);
            }

            // load the target targetGroup list
            this._parseTargetGroupList();

            // initialize data processing class for compare query
            this.state.dataLoader = new DataLoader(this.state.serverURL, this.state.compareQuery);

            // starting loading the owlsim data from compare api for this vendor
            if (this._isCrossComparisonView()) {
                this.state.dataLoader.loadCompareDataForVendor(this.state.gridSourceList, this.state.initialTargetGroupLoadList, this.state.asyncDataLoadingCallback, this.state.multiTargetsModeTargetLengthLimit);
            } else {
                this.state.dataLoader.loadCompareDataForVendor(this.state.gridSourceList, this.state.initialTargetGroupLoadList, this.state.asyncDataLoadingCallback);
            }
        },
        
        _showGridSkeletonDataErrorMsg: function() {
            this.state.pgContainer.html(this.state.messaging.gridSkeletonDataError);
        },
        
        // when not work with monarch's analyze/phenotypes page
        _parseTargetGroupList: function() {
            for (var idx in this.state.targetGroupList) {
                this.state.initialTargetGroupLoadList.push(this.state.targetGroupList[idx]);		
                this.state.selectedCompareTargetGroup.push(this.state.targetGroupList[idx]);
            } 
            
            // Then we init the flag obj for group target item (genotype) expansion
            this._createTargetGroupItemExpansionFlag();
        },

        _createTargetGroupItemExpansionFlag: function() {
            // Genotype expansion flags - named/associative array
            // flag used for switching between single group and multi-group mode
            var targetGroupItemExpansionFlag = {};
            // Add new group here, human disease doesn't have genotype expansion, 
            // but we still have that group in the flag obj - Joe
            for (var i = 0; i < this.state.initialTargetGroupLoadList.length; i++) {
                // Add all group names as properties on this flag obj
                targetGroupItemExpansionFlag[this.state.initialTargetGroupLoadList[i].groupName] = false;
            }

            // NOTE: without using jquery's extend(), all the new flags are referenced 
            // to the config object, not actual copy - Joe
            this.state.expandedTargetGroupItems = $.extend({}, this.state.targetGroupItemExpansionFlag);
            
            // genotype flags to mark every genotype expansion on/off in each group
            this.state.newTargetGroupItems = $.extend({}, this.state.targetGroupItemExpansionFlag);
            
            this.state.removedTargetGroupItems = $.extend({}, this.state.targetGroupItemExpansionFlag);
            
            // flag to mark if hidden genotypes need to be reactivated
            this.state.reactivateTargetGroupItems = $.extend({}, this.state.targetGroupItemExpansionFlag);
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
            var spinner = $('<div>Loading Phenogrid Widget...<i class="fa fa-spinner fa-pulse"></i></div>');
            spinner.appendTo(this.state.pgContainer);
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
                if (this.state.dataLoader.groupsNoMatch.length > 0) {
                    self._showGroupsNoMatch();
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
            for (var i = 0; i < this.state.selectedCompareTargetGroup.length; i++) {
                var len = this.state.dataManager.length("target", this.state.selectedCompareTargetGroup[i].groupName);
                if (typeof(len) === 'undefined' || len < 1) {
                    // remove the target that has no data
                    // use splice() not slice() - Joe
                    // splice() modifies the array in place and returns a new array containing the elements that have been removed.
                    this.state.selectedCompareTargetGroup.splice(i, 1);
                    i--; // Need to go back to the first element of updated array
                }
            }
        }, 


        // for genotype expansion, we need to update the target list 
        // for each group if they have added genotypes - Joe
        _updateTargetAxisRenderingGroup: function(group_name) {
            var targetList = [];

            // get targetList based on the newTargetGroupItems flag
            if (this.state.newTargetGroupItems[group_name]) {
                // get the reordered target list in the format of a named array, has all added genotype data
                targetList = this.state.dataManager.reorderedTargetEntriesNamedArray[group_name];
            } else if (this.state.removedTargetGroupItems[group_name]) {
                // get the reordered target list in the format of a named array, has all added genotype data
                targetList = this.state.dataManager.getReorderedTargetEntriesNamedArray(group_name); 
            } else if (this.state.reactivateTargetGroupItems[group_name]) {
                targetList = this.state.dataManager.getReorderedTargetEntriesNamedArray(group_name); 
            } else {
                // unordered target list in the format of a named array, has all added genotype data
                targetList = this.state.dataManager.getData("target", group_name);
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
                sourceList = this.state.dataManager.createCombinedSourceList(this.state.selectedCompareTargetGroup);	

                // get the length of the sourceList, this sets that limit since we are in comparison mode
                // only the multiTargetsModeTargetLengthLimit is set, which provides the overall display limit
                this.state.sourceDisplayLimit = Object.keys(sourceList).length;

                // create a combined list of targets
                // show as many columns as possible within the multiTargetsModeTargetLengthLimit
                // only show multiTargetsModeTargetLengthLimit columns if there are more columns
                var targetLengthPerGroup = []; 
				//this variable captures to total number of targets returned per group (groupTargetLength is limited
				//to be less than or equal to the multiTargetsModeTargetLengthLimit
				var targetReturnedLength = [];
                for (var i = 0; i < this.state.selectedCompareTargetGroup.length; i++) {
                    // This targetDataPerGroup is an Object, not an array
                    var targetDataPerGroup = this.state.dataManager.getData('target', this.state.selectedCompareTargetGroup[i].groupName);
                    var groupTargetLength = {};
                    var singleTargetReturnedLength = {};
                    singleTargetReturnedLength = {
                            groupName: this.state.selectedCompareTargetGroup[i].groupName,
                            targetLength: Object.keys(targetDataPerGroup).length
                    
                    };
                    targetReturnedLength.push(singleTargetReturnedLength);
                    
                    if (Object.keys(targetDataPerGroup).length <= this.state.multiTargetsModeTargetLengthLimit) {
                        groupTargetLength = {
                            groupName: this.state.selectedCompareTargetGroup[i].groupName,
                            targetLength: Object.keys(targetDataPerGroup).length
                        };
                    } else {
                        groupTargetLength = {
                            groupName: this.state.selectedCompareTargetGroup[i].groupName,
                            targetLength: this.state.multiTargetsModeTargetLengthLimit
                        };
                    }
                    targetLengthPerGroup.push(groupTargetLength);
                }
                
                // Also make it available in the global scope
                // to be used when creating divider lines
                this.state.targetLengthPerGroup = targetLengthPerGroup;

                this.state.targetTotalReturnedPerGroup = targetReturnedLength;

                targetList = this.state.dataManager.createCombinedTargetList(this.state.selectedCompareTargetGroup, this.state.multiTargetsModeTargetLengthLimit);	

                // get the length of the targetlist, this sets that limit since we are in comparison mode
                this.state.targetDisplayLimit = Object.keys(targetList).length;
            } else if (this.state.selectedCompareTargetGroup.length === 1) {
                // just get the target group name 
                // in analyze/phenotypes compare mode, the singleTargetGroupName will be 'compare' - Joe
                var singleTargetGroupName = this.state.selectedCompareTargetGroup[0].groupName;
                
                sourceList = this.state.dataManager.getData("source", singleTargetGroupName);

                // set default display limits based on displaying sourceLengthLimit
                this.state.sourceDisplayLimit = this.state.dataManager.length("source", singleTargetGroupName);
        
                // display all the expanded genotypes when we switch back from multi-group mode to single-group mode
                // at this point, this.state.expandedTargetGroupItems is true, and this.state.newTargetGroupItems is false - Joe
                if (this.state.expandedTargetGroupItems[singleTargetGroupName]) {
                    //targetList = this.state.dataManager.reorderedTargetEntriesNamedArray[singleTargetGroupName];
                    targetList = this.state.dataManager.getReorderedTargetEntriesNamedArray(singleTargetGroupName); 
                } else {
                    // unordered target list in the format of a named array, has all added genotype data
                    targetList = this.state.dataManager.getData("target", singleTargetGroupName);
                }
                
                this.state.targetDisplayLimit = this.state.dataManager.length("target", singleTargetGroupName);	

                // In single target mode, use singleTargetModeTargetLengthLimit if more than that
                if (this.state.targetDisplayLimit > this.state.singleTargetModeTargetLengthLimit) {
                    this.state.targetDisplayLimit = this.state.singleTargetModeTargetLengthLimit;
                }                 
            }

            // check to make sure the display limits are not over the default display limits
            if (this.state.sourceDisplayLimit > this.state.sourceLengthLimit) {
                this.state.sourceDisplayLimit = this.state.sourceLengthLimit;  // adjust the display limit within default limit
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
                // in this case, groupsNoMatch.length can only be 1 or 0
                if (this.state.dataLoader.groupsNoMatch.length === 0) {
                    // create UI components
                    this._createDisplayComponents();
                } else {
                    // no need to show other SVG UI elements if no matched data
                    this._showGroupsNoMatch();
                }
            } else if (this.state.initialTargetGroupLoadList.length > 1) {
                if (this.state.dataLoader.groupsNoMatch.length > 0) {
                    if (this.state.dataLoader.groupsNoMatch.length === this.state.initialTargetGroupLoadList.length) {
                        // in this case all group have no matches
                        this._showGroupsNoMatch();
                    } else {
                        // show error message and display grid for the rest of the group
                        this._showGroupsNoMatch();
                        this._createDisplayComponents();
                    }
                } else {
                    this._createDisplayComponents();
                }
            } else {
                // no active group in config
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
            
            // calculate the button padding
            // whitespace size between left boundry to unmatched button, same as the options button to right boundry
            this.state.btnPadding = this.state.gridRegion.x - $('#' + this.state.pgInstanceId + '_unmatched_btn').width() - this.state.gridRegion.rowLabelOffset;
            
            // Must after the this.state.btnPadding calculation since we use the padding to position the unmatched button - Joe
            this._positionUnmatchedSources();
            
            // Options menu
            this._createPhenogridControls();
            this._positionPhenogridControls();
            this._togglePhenogridControls();
            
            // Must after calling this._createPhenogridControls()
            // since it uses the control options width to 
            // calculate the gridWidth of the final group grid width - Joe
            this._scalableCutoffGroupLabel();
            
            this._setSvgSize();
        },
        
        // Recreates the SVG content and leave the HTML sections unchanged
        _updateDisplay: function() {
            // Only remove the #pg_svg node and leave #this.state.pgInstanceId_controls there
            // since #this.state.pgInstanceId_controls is HTML not SVG - Joe
            this.element.find('#' + this.state.pgInstanceId + '_svg').remove();
        
            this._createSvgComponents();

            // Recalculate the button padding
            // whitespace size between left boundry to unmatched button, same as the options button to right boundry
            this.state.btnPadding = this.state.gridRegion.x - $('#' + this.state.pgInstanceId + '_unmatched_btn').width() - this.state.gridRegion.rowLabelOffset;
            
            // Reposition HTML sections
            this._positionUnmatchedSources();
            this._positionPhenogridControls();
            
            this._setSvgSize();
        },

        _createSvgComponents: function() {
            this._createSvgContainer();
            this._createTargetGroupLabels();
            this._createNavigation();
            this._createGrid();
            this._createScoresTipIcon();
            this._addGridTitle(); // Must after _createGrid() since it's positioned based on the _gridWidth() - Joe
            this._createGradientLegend();
            this._createTargetGroupDividerLines();
            this._createMonarchInitiativeRecognition(); // For exported phenogrid SVG, hide by default

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
        
        // if no owlsim data returned for that group
        _showGroupsNoMatch: function() {
            var output = '';
            var groups = '';
            for (var i = 0; i < this.state.dataLoader.groupsNoMatch.length; i++) {
                // replace the placeholder with group name
                groups +=  this.state.dataLoader.groupsNoMatch[i] + ', ';
            }
            //remove the last comma
            groups = groups.substring(0, groups.length - 2);
            //if there is a list of two or more items, change the ', '
            var conjunctionJunction = ' or ';
            if (this.state.dataLoader.groupsNoMatch.length > 2) {
               conjunctionJunction = ',' + conjunctionJunction;
            }
            // change the last ', ' to ', or '
            if (this.state.dataLoader.groupsNoMatch.length > 1) {
               var n = groups.lastIndexOf(', ');
               groups = groups.slice(0, n) + groups.slice(n).replace(', ', conjunctionJunction);
            }
            output =  this.state.messaging.noSimSearchMatch.replace(/{%groupName%}/, groups) + '<br>';
            // Insert the error messages before the container div, so it won't mess up the alignment of 
            // unmatched and options that are aligned relatively to the container
            $('<div class="pg_message">' + output + '</div>').insertBefore(this.state.pgContainer);
        },
        
        // Positioned next to the grid region bottom
        _addLogoImage: function() { 
            var gridRegion = this.state.gridRegion;
            
            var x = (gridRegion.x + this.state.singleTargetModeTargetLengthLimit*gridRegion.cellPad + gridRegion.rowLabelOffset)/2;
            
            var self = this;
            this.state.svg.append("svg:image")
                .attr("xlink:href", images.logo)
                .attr("x", x + $("#" + this.state.pgInstanceId + "_monarchinitiative_text")[0].getBoundingClientRect().width + 5) // 5 is left margin to the monarch text
                .attr("y", this.state.gridRegion.y + this._gridHeight() + 74) // 74 is margin to grid bottom
                .attr("id", this.state.pgInstanceId + "_logo")
                .attr('class', 'pg_cursor_pointer')
                .attr("width", 40)
                .attr("height", 26)
                .on('click', function() {
                    window.open(self.state.serverURL, '_blank');
                });
        },
        
        _createTargetGroupLabels: function () {
            if (this.state.owlSimFunction !== 'compare') {
                var self = this;
                // targetGroupList is an array that contains all the selected targetGroup names
                var targetGroupList = this.state.selectedCompareTargetGroup.map(function(d){return d.groupName;}); 

                var titleXPerGroup = [];
                var titleYPerGroup = [];
                
                if (this._isCrossComparisonView()) {
                    var totalColumns = 0;
                    var columnsCounter = [];
                    for (var i = 0; i < this.state.targetLengthPerGroup.length; i++) {
                        // Get the target length (number of columns) per group
                        // and add them up
                        totalColumns += this.state.targetLengthPerGroup[i].targetLength;
                        columnsCounter.push(totalColumns);

                        if (i === 0) {
                            // Center the first label based on the corresponding grid width + the X projection of angled divider line
                            var x = this.state.gridRegion.x + (this.state.gridRegion.cellPad*columnsCounter[i] + (this.state.targetGroupDividerLine.rotatedDividerLength)*Math.sin(Math.PI/4) - (this.state.gridRegion.cellPad - this.state.gridRegion.cellSize)/2 )/2;
                        } else {
                            // calculate the x coordinate of the point where the angled red diving will hit the horizontal line containing the labels. Start the label there.
                            // add 30 to rotatedDividerLength
                            var x = this.state.gridRegion.x + this.state.gridRegion.cellPad*(columnsCounter[i] - this.state.targetLengthPerGroup[i].targetLength) + (this.state.targetGroupDividerLine.rotatedDividerLength)*Math.sin(Math.PI/4) - (this.state.gridRegion.cellPad - this.state.gridRegion.cellSize)/2;
                        }
                        
                        var y = this.state.gridRegion.y + this.state.gridRegion.cellPad*(columnsCounter[i] - this.state.targetLengthPerGroup[i].targetLength/2);
                        titleXPerGroup.push(x);
                        titleYPerGroup.push(y);
                    }
                } else {
                    var x = this.state.gridRegion.x + this._gridWidth()/2;
                    var y = this.state.gridRegion.y + this._gridHeight()/2;
                    titleXPerGroup.push(x);
                    titleYPerGroup.push(y);
                }
                    
                // No group labels after inverting axis
                if ( ! this.state.invertAxis) { 
                    this.state.svg.selectAll(".pg_targetGroup_name")
                        .data(targetGroupList)
                        .enter()
                        .append("text")
                        .attr("x", function(d, i){ 
                            return titleXPerGroup[i];
                        })
                        .attr("y", function(d, i) {
                            // Stagger up every other group label
                            if (i%2 === 0) {
                                return self.state.gridRegion.y - 135
                            } else {
                                return self.state.gridRegion.y - 135 - 12; // Move up 12px
                            }
                        })
                        .attr("class", "pg_targetGroup_name") 
                        .attr("id", function(d, i) {
                            return self.state.pgInstanceId + "_groupName_" + (i + 1);
                        }) 
                        .text(function(d, i){
                            var totalTargetCount = 0;
                            //display the total number of targets found per group
                            for (var x = 0;x < self.state.targetTotalReturnedPerGroup.length; x++) {
                               if (self.state.targetTotalReturnedPerGroup[x].groupName === d) { 
                                  totalTargetCount = self.state.targetTotalReturnedPerGroup[x].targetLength;
                                  if (totalTargetCount >= self.state.searchResultLimit) {
                                    totalTargetCount = ">" + totalTargetCount;
                                  }
                                  continue;
                               }
                            }
							return targetGroupList[i] + " (" + totalTargetCount + ")";
                        })
                        .style("font-size", '11px')    
                        .attr("text-anchor", function(d, i) {
                            if (i === 0) {
                                return 'middle';
                            } else {
                                return 'start';
                            }
                        })
                        .on('click', function(d, i) {
                            //the onclick event "expands" the selected taxon (identified as targetGroupList[i])
                            //if no taxon is expanded (check self.state.taxonExpanded) then expand the current taxon
                            //and hide the other taxa
                            //otherwise, show all the available taxa
                    		var elem = $('#' + self.state.pgInstanceId + '_targetGroup');
                    		var items = elem.children();
                    		//if no other taxon is expanded... 
							if (!self.state.taxonExpanded) {
							  self.state.taxonExpanded = true;
							  for (var idx = 0; idx < items.length; idx++) {
							    //only check the current taxon
								if (items[idx].childNodes[0].value === targetGroupList[i]) {
								    items[idx].childNodes[0].checked = true;
								} else {
								    items[idx].childNodes[0].checked = false;
								}
							  }
							} else {
							  //reset the screen to display all the taxa
							  self.state.taxonExpanded = false;
							  for (var idx = 0; idx < items.length; idx++) {
							    //check to make sure the checkbox is enabled before checking it
							    if (!items[idx].childNodes[0].disabled) {
								   items[idx].childNodes[0].checked = true;
								}								
							  }
							}
							//the above "click" event basically mimics a user selecting one organism
							//after the checkboxes are resets, trigger the change event on the checkbox group
							$('#' + self.state.pgInstanceId + '_targetGroup').trigger("change");

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
            } 
        },
        
        // Use a scalable cutoff for group label length based on the group size
        // Adjust the group name length once it's rendered
        // Only applied to the multi group mode
        _scalableCutoffGroupLabel: function() {
            if (this._isCrossComparisonView()) {
                for (var i = 0; i < this.state.selectedCompareTargetGroup.length; i++) {
                    var groupNameWidth = $('#' + this.state.pgInstanceId + ' .pg_targetGroup_name')[i].getBoundingClientRect().width;
                    
                    // For the first group, scale the label based on the grid width and the divider line's projection on X coordinate.
                    if (i === 0) {
                        var groupGridWidth = this.state.targetLengthPerGroup[i].targetLength * this.state.gridRegion.cellPad - (this.state.gridRegion.cellPad - this.state.gridRegion.cellSize)/2 + (this.state.targetGroupDividerLine.rotatedDividerLength)*Math.sin(Math.PI/4);
                    } else if (i === this.state.selectedCompareTargetGroup.length -1) {
                        var groupGridWidth = this.state.targetLengthPerGroup[i].targetLength * this.state.gridRegion.cellPad - (this.state.gridRegion.cellPad - this.state.gridRegion.cellSize)/2 - (this.state.targetGroupDividerLine.rotatedDividerLength)*Math.sin(Math.PI/4) + $('#' + this.state.pgInstanceId + '_controls_options').outerWidth();
                    } else {
                        var groupGridWidth = this.state.targetLengthPerGroup[i].targetLength * this.state.gridRegion.cellPad - (this.state.gridRegion.cellPad - this.state.gridRegion.cellSize)/2;
                    }

                    // No change when group name is within the group grid width
                    if (groupNameWidth > groupGridWidth) {
                        var newCharCount = Math.floor(this.state.selectedCompareTargetGroup[i].groupName.length * (groupGridWidth/groupNameWidth));
                        $('#' + this.state.pgInstanceId + '_groupName_' + (i + 1)).text(this.state.selectedCompareTargetGroup[i].groupName.substring(0, newCharCount));
                    } else {
                        if (i === 0) {
                            // Just center the 1st group label based on the mid point of the grid width
                            // when it's not longer than the grid width
                            $('#' + this.state.pgInstanceId + '_groupName_' + (i + 1)).attr("x", this.state.gridRegion.x + (this.state.targetLengthPerGroup[i].targetLength * this.state.gridRegion.cellPad - (this.state.gridRegion.cellPad - this.state.gridRegion.cellSize)/2)/2);
                        }
                    }
                }
            }
        },

        // Create minimap and scrollbars based on needs
        // In single group mode, only show mini map 
        // when there are more sources than the default limit or more targets than default limit
        // In cross comparison mode, only show mini map 
        // when there are more sources than the default limit
        // Create scrollbars accordingly
        _createNavigation: function() {
            var xCount = this.state.xAxisRender.groupLength();
            var yCount = this.state.yAxisRender.groupLength();
            var width = this.state.minimap.width;
            var height = this.state.minimap.height;
            
            // check xCount based on yCount
            if ( ! this.state.invertAxis) {
                if ( ! this._isCrossComparisonView()) {
                    if (yCount > this.state.sourceLengthLimit) {
                        if (xCount > this.state.singleTargetModeTargetLengthLimit) {
                            // just use the default mini map width and height
                            this._createMinimap(width, height);
                            // create both horizontal and vertical scrollbars
                            this._createScrollbars(true, true);
                        } else {
                            // shrink the width of mini map based on the xCount/this.state.singleTargetModeTargetLengthLimit
                            // and keep the hight unchanged
                            width = width * (xCount/this.state.singleTargetModeTargetLengthLimit);
                            this._createMinimap(width, height);
                            // only create vertical scrollbar
                            this._createScrollbars(false, true);
                        }
                    } else {
                        if (xCount > this.state.singleTargetModeTargetLengthLimit) {
                            // shrink the height of mini map based on the yCount/this.state.sourceLengthLimit ratio
                            // and keep the hight unchanged
                            height = height * (yCount/this.state.sourceLengthLimit);
                            this._createMinimap(width, height);
                            // only create horizontal scrollbar
                            this._createScrollbars(true, false);
                        } 
                        
                        // No need to create the mini map if both xCount and yCount are within the default limit
                    }
                } else {
                    // No need to check xCount since the max x limit per group is set to multiTargetsModeTargetLengthLimit
                    if (yCount > this.state.sourceLengthLimit) {  
                        // just use the default mini map width and height
                        this._createMinimap(width, height);
                        // only create vertical scrollbar
                        this._createScrollbars(false, true);
                    } 
                    
                    // No need to create the mini map if yCount is within the default limit
                }
            } else {
                if ( ! this._isCrossComparisonView()) {
                    if (xCount > this.state.sourceLengthLimit) {
                        if (yCount > this.state.singleTargetModeTargetLengthLimit) {
                            this._createMinimap(width, height);
                            // create both horizontal and vertical scrollbars
                            this._createScrollbars(true, true);
                        } else {
                            height = height * (yCount/this.state.singleTargetModeTargetLengthLimit);
                            this._createMinimap(width, height);
                            // only create horizontal scrollbar
                            this._createScrollbars(true, false);
                        }
                    } else {
                        if (yCount > this.state.singleTargetModeTargetLengthLimit) {
                            width = width * (xCount/this.state.sourceLengthLimit);
                            this._createMinimap(width, height);
                            // only create vertical scrollbar
                            this._createScrollbars(false, true);
                        }
                    }
                } else {
                    if (xCount > this.state.sourceLengthLimit) {  
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

            // in compare mode, the targetGroup will be 'compare' instead of actual group name - Joe
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
                    .attr("x1", this._positionVerticalScrollbarLine(sliderThickness, barToGridMargin))
                    .attr("y1", this.state.gridRegion.y)
                    .attr("x2", this._positionVerticalScrollbarLine(sliderThickness, barToGridMargin))
                    .attr("y2", this.state.gridRegion.y + this._gridHeight())
                    .attr("id", this.state.pgInstanceId + "_vertical_scrollbar")
                    .style("stroke", barColor)
                    .style("stroke-width", barThickness);

                // slider rect
                verticalScrollbarGrp.append("rect")
                    .attr("x", this._positionVerticalScrollbarRect(sliderThickness, barToGridMargin)) 
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
        
        _positionVerticalScrollbarLine: function(sliderThickness, barToGridMargin) {
            var x;
            
            if (this._isCrossComparisonView()) {
                x = this.state.gridRegion.x + this.state.multiTargetsModeTargetLengthLimit*this.state.selectedCompareTargetGroup.length*this.state.gridRegion.cellPad - sliderThickness/2 + barToGridMargin
            } else {
                x = this.state.gridRegion.x + this.state.singleTargetModeTargetLengthLimit*this.state.gridRegion.cellPad - sliderThickness/2 + barToGridMargin;
            }
            
            return x;
        },
        
        _positionVerticalScrollbarRect: function(sliderThickness, barToGridMargin) {
            var x;
            
            if (this._isCrossComparisonView()) {
                x = this.state.gridRegion.x + this.state.multiTargetsModeTargetLengthLimit*this.state.selectedCompareTargetGroup.length*this.state.gridRegion.cellPad + barToGridMargin - sliderThickness;
            } else {
                x = this.state.gridRegion.x + this.state.singleTargetModeTargetLengthLimit*this.state.gridRegion.cellPad + barToGridMargin - sliderThickness;
            }
            
            return x;
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
            var svgWidth;
            
            if (this._isCrossComparisonView()) {
                svgWidth = this.state.gridRegion.x + this.state.multiTargetsModeTargetLengthLimit*this.state.selectedCompareTargetGroup.length*this.state.gridRegion.cellPad + this.state.gridRegion.rowLabelOffset +  this.state.btnPadding;
            } else {
                svgWidth = this.state.gridRegion.x + this.state.singleTargetModeTargetLengthLimit*this.state.gridRegion.cellPad + this.state.gridRegion.rowLabelOffset  + this.state.btnPadding;
            }
            
            d3.select('#' + this.state.pgInstanceId + '_svg')
                .attr('width', svgWidth)
                .attr('height', this.state.gridRegion.y + this._gridHeight() + 100);     
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
            } else if (elem.classList.contains("pg_targetGroup_name")) {
               data = new Array();
               data["type"] = "targetgroup";
               data["name"] = d;
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
            if (elem.classList.contains("pg_targetGroup_name")) {
              d3.select("#" + elem.id).classed("pg_active", true);
            } else if (d.type === 'cell') {  
                // d.xpos and d.ypos only appear for cell - Joe
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
            d3.selectAll(".pg_targetGroup_name").classed("pg_active", false);
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
            //adjust the tooltip for group headers
            } else if (elem.classList.contains('pg_targetGroup_name')) {
                topPos += elem.getBoundingClientRect().height;
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
                    //this._hideTooltip(tooltip);
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
            if (this.state.gridTitle !== '') {
                var self = this;
                // Add the top main title to pg_svg_group
                this.state.svg.append("svg:text")
                    .attr("id", this.state.pgInstanceId + "_toptitle")
                    //after moving the Options control to the left, the title needs to be moved left as well to center it
                    //subtracting 75 appears to help -Chuck
                    .attr("x", function() {
                        if (self._isCrossComparisonView()) {
                            return (self.state.gridRegion.x + self.state.multiTargetsModeTargetLengthLimit*self.state.selectedCompareTargetGroup.length*self.state.gridRegion.cellPad/2) -self.state.optionsControls.defaultButtonWidth;
                        } else {
                            return (self.state.gridRegion.x + self.state.singleTargetModeTargetLengthLimit*self.state.gridRegion.cellPad/2) -self.state.optionsControls.defaultButtonWidth;
                        }
                    }) // Calculated based on the singleTargetModeTargetLengthLimit - Joe
                    .attr("y", 25) // Fixed y position - Joe
                    .style('text-anchor', 'middle') // Center the main title - Joe
                    .style('font-size', '1.4em')
                    .style('font-weight', 'bold')
                    .text(this.state.gridTitle);
            }
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
                        this._insertExpandedItems(id);
                    }
                });
                
                var remove = $('#' + this.state.pgInstanceId + '_remove_genotypes_' + id);
                this._on(remove, {
                    "click": function(event) {
                        this._removeExpandedItems(id);
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
        
        _targetTooltip: function(id, data) {
            var htmlContent = '';
            
            var msg = "Show only <strong>" + data.name + "</strong> results";
            if (this.state.taxonExpanded || this.state.selectedCompareTargetGroup.length === 1) {
              msg = "Show results for <strong>all</strong> species";
            }

            htmlContent = msg;
                          
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

            htmlContent = "<strong>" + Utils.capitalizeString(sourceInfo.type) + "</strong><br>" 
                          + this._encodeTooltipHref(sourceInfo.type, sourceId, data.a_label ) +  " " + Utils.formatScore(data.a_IC.toFixed(2)) + "<br><br>" 
                          + "<strong>In-common</strong><br>" 
                          + this._encodeTooltipHref(sourceInfo.type, data.subsumer_id, data.subsumer_label) + " (" + Utils.formatScore(data.subsumer_IC.toFixed(2)) + ", " + prefix + " " + data.value[this.state.selectedCalculation].toFixed(2) + '%' + ")<br><br>" 
                          + "<strong>Match</strong><br>" 
                          + this._encodeTooltipHref(sourceInfo.type, data.b_id, data.b_label ) + Utils.formatScore(data.b_IC.toFixed(2));
                          
            // Finally return the rendered HTML result
            return htmlContent;
        },
        
        _vendorTooltip: function(id, data) {
            var htmlContent = '';
            
            // Tooltip rendering for Vendor
            for (var idx in data.info) {
                // null is a javascript object
                // id can be float or string or null
                if (typeof(data.info[idx].id) !== null) {
                    // If value is null, then no need to have href
                    // So the assumption is value is not null at any time.
                    // href can only be string
                    if (typeof(data.info[idx].href) === 'string') {
                        htmlContent += '<strong>' + data.info[idx].id + '</strong> ' + '<a href="'+ data.info[idx].href +'" target="_blank">' + data.info[idx].value + '</a>' + '<br>';
                    } else {
                        htmlContent += '<strong>' + data.info[idx].id + '</strong> ' + data.info[idx].value + '<br>';
                    }
                } else {
                    // Only display value and href (if provided)
                    if (typeof(data.info[idx].href) === 'string') {
                        htmlContent += '<a href="'+ data.info[idx].href +'" target="_blank">' + data.info[idx].value + '</a>' + '<br>';
                    } else {
                        htmlContent += data.info[idx].value + '<br>';
                    }
                }
            }

            // Finally return the rendered HTML result
            return htmlContent.slice(0, -4); // Trim off the last '<br>'
        },
        
        _defaultTooltip: function(id, data) {
            var htmlContent = '';
            
            // disease and gene/genotype share common items
            var tooltipType = (typeof(data.type) !== 'undefined' ? "<strong>" + Utils.capitalizeString(data.type) + ": </strong> " + this._encodeTooltipHref(data.type, id, data.label) + "<br>" : "");
            var rank = (typeof(data.rank) !== 'undefined' ? "<strong>Rank:</strong> " + data.rank+"<br>" : "");
            var score = (typeof(data.score) !== 'undefined' ? "<strong>Score:</strong> " + data.score+"<br>" : "");	
            var group = (typeof(data.targetGroup) !== 'undefined' ? "<strong>Species:</strong> " + data.targetGroup+"<br>" : "");

            htmlContent = tooltipType + rank + score + group;
            
            // Add genotype expansion link to genes
            // genotype expansion won't work with owlSimFunction === 'compare' since we use
            // 'compare' as the key of the named array, while the added genotypes are named based on their group - Joe
            if (data.type === 'gene') {
                // ENABLED for now, just comment to DISABLE genotype expansion - Joe
                // for gene and single group mode only, add genotype expansion link
                if (this.state.selectedCompareTargetGroup.length === 1 && this.state.selectedCompareTargetGroup[0].groupName !== 'compare') {
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
            } else if (this.state.gridSkeletonDataVendor === 'IMPC') {
                htmlContent = this._vendorTooltip(id, data);	
            } else if (data.type === 'targetgroup') {
                htmlContent = this._targetTooltip(id, data);	
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

            // Only create divider lines in multi-group mode
            if (this._isCrossComparisonView()) {
                
                var totalColumns = 0;
                var columnsCounter = [];
                // No need to get the last group length
                for (var i = 0; i < this.state.targetLengthPerGroup.length - 1; i++) {
                    // Get the target length (number of columns) per group
                    // and add them up
                    totalColumns += this.state.targetLengthPerGroup[i].targetLength;
                    columnsCounter.push(totalColumns);
                }
                
                for (var i = 1; i < this.state.selectedCompareTargetGroup.length; i++) {
                    if (this.state.invertAxis) {
                        // gridRegion.colLabelOffset: offset the line to reach the labels
                        var y = gridRegion.y + gridRegion.cellPad * columnsCounter[i-1] - (gridRegion.cellPad - gridRegion.cellSize)/2;		

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
                        var x = gridRegion.x + gridRegion.cellPad * columnsCounter[i-1] - (gridRegion.cellPad - gridRegion.cellSize)/2;		

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
                    return Utils.getShortLabel(d.label, self.state.targetLabelCharLimit); 
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
            // no need to add this grey background for multi group or owlSimFunction === 'compare' - Joe
            if (this.state.selectedCompareTargetGroup.length === 1 && this.state.selectedCompareTargetGroup[0].groupName !== 'compare') {
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

            // no need to add this grey background for multi groups or owlSimFunction === 'compare' - Joe
            if (this.state.selectedCompareTargetGroup.length === 1 && this.state.selectedCompareTargetGroup[0].groupName !== 'compare') {
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
                        self._mouseover(this, d, self);	
                    })
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
            var gridRegion = this.state.gridRegion;
            
            if (this._isCrossComparisonView()) {
                var x = gridRegion.x + this.state.multiTargetsModeTargetLengthLimit*this.state.selectedCompareTargetGroup.length*gridRegion.cellPad/2;
            } else {
                var x = gridRegion.x + this.state.singleTargetModeTargetLengthLimit*gridRegion.cellPad/2;
            }

            // Create a group for gradient bar and legend texts - Joe
            var gradientGrp = this.state.svg.append("g")
                .attr('id', this.state.pgInstanceId + '_gradient_legend');

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
                .attr("x", x - this.state.gradientRegion.width/2)
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
                .attr("x", x - this.state.gradientRegion.width/2)
                .attr("y", yTexts)
                .style('text-anchor', 'start') // Actually no need to specify this here since it's the default - Joe
                .text(lowText);

            // create and position the display type label
            gradientTextGrp.append("svg:text")
                .attr("x", x)
                .attr("y", yTexts)	
                .style('text-anchor', 'middle') // This renders the middle of the text string as the current text position x - Joe			
                .text(labelText);

            // create and position the high label
            gradientTextGrp.append("svg:text")
                .attr("x", x + this.state.gradientRegion.width/2) 
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
                
                // Vendor data ships will all HP labels, no need to grab via ajax - Joe
                if (this.state.gridSkeletonDataVendor === 'IMPC') {
                    var vendorDataUnmatchedSources = [];
                    for (var i = 0; i< this.state.unmatchedSources.length; i++) {
                        for (var idx in this.state.gridSkeletonData.yAxis) {
                            if (this.state.gridSkeletonData.yAxis[idx].id === this.state.unmatchedSources[i]) {
                                // use "label" instead of "term" here
                                var item = {id: this.state.gridSkeletonData.yAxis[idx].id, label: this.state.gridSkeletonData.yAxis[idx].term};
                                vendorDataUnmatchedSources.push(item);
                                break;
                            }
                        }
                    }
                    // Now we have all the unmatched source labels to render
                    for (var j = 0; j< vendorDataUnmatchedSources.length; j++) {
                        var pg_unmatched_list_item = '<div class="pg_unmatched_list_item"><a href="' + this.state.serverURL + '/phenotype/' + vendorDataUnmatchedSources[j].id + '" target="_blank">' + vendorDataUnmatchedSources[j].label + '</a></div>';
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
            var slideBtn = '<div id="' + this.state.pgInstanceId + '_slide_btn" class="pg_slide_btn"><i class="fa fa-bars"></i> ' + this.state.optionsBtnText + '</div>';
            
            var options = $(optionhtml);
            
            // only show the Organism(s) option when we have at least two speices
            if (this.state.initialTargetGroupLoadList.length > 1) {
                var targetGroupSelection = this._createTargetGroupSelection();
                options.append(targetGroupSelection);
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
            $('#' + this.state.pgInstanceId + '_targetGroup').change(function(d) {
                var items = this.childNodes; // this refers to $("#pg_targetGroup") object - Joe
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
                    alert("You must have at least 1 target group selected.");
                }

                self._createAxisRenderingGroups();

                // Update unmatched sources due to changes of group
                // No need to call this for other control actions - Joe
                // Unmatched sources
                // Remove the HTML if created from the former load
                $('#' + self.state.pgInstanceId + '_unmatched').remove();
                self._createUnmatchedSources();
                
                self._updateDisplay();
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

            $("#" + this.state.pgInstanceId + "_invert_axis").click(function() {	
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
                svgElementClone.find('#' + self.state.pgInstanceId + '_logo').attr('href', images.logo);
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

        // Recognition text and monarch logo
        _createMonarchInitiativeRecognition: function() {
            var gridRegion = this.state.gridRegion;
            
            if (this._isCrossComparisonView()) {
                var x = gridRegion.x + this.state.multiTargetsModeTargetLengthLimit*this.state.selectedCompareTargetGroup.length*gridRegion.cellPad/2;
            } else {
                var x = gridRegion.x + this.state.singleTargetModeTargetLengthLimit*gridRegion.cellPad/2;
            }

            // Create a group for text and logo
            var recognitionGrp = this.state.svg.append("g")
                .attr('id', this.state.pgInstanceId + '_recognition');  
            
            // Add text
            recognitionGrp.append("text")
                .attr("x", x)
                .attr("y", this.state.gridRegion.y + this._gridHeight() + 90) // 90 is margin
                .attr("id", this.state.pgInstanceId + "_monarchinitiative_text")
                .style('font-size', '10px')
                .text(this.state.monarchInitiativeText);
                
            // Add logo
            var self = this;
            recognitionGrp.append("svg:image")
                .attr("xlink:href", images.logo)
                .attr("x", x + $("#" + this.state.pgInstanceId + "_monarchinitiative_text")[0].getBoundingClientRect().width + 3) // 3 is left margin to the monarch text
                .attr("y", this.state.gridRegion.y + this._gridHeight() + 74) // 74 is margin to grid bottom
                .attr("id", this.state.pgInstanceId + "_logo")
                .attr('class', 'pg_cursor_pointer')
                .attr("width", 40)
                .attr("height", 26)
                .on('click', function() {
                    window.open(self.state.serverURL, '_blank');
                });
                
            var recognitionGrpWidth = $("#" + this.state.pgInstanceId + "_recognition")[0].getBoundingClientRect().width;
            // Center the group by left shift half the width of the group element
            recognitionGrp.attr("transform", "translate(" + -recognitionGrpWidth/2 + "0)");
        },
        
        // Position the control panel when the gridRegion changes
        _positionPhenogridControls: function() {
            // Note: CANNOT use this inside _createPhenogridControls() since the _createGrid() is called after it
            // we won't have the _gridHeight() by that time - Joe
            var gridRegion = this.state.gridRegion; 
            var marginTop = 17; // Create some whitespace between the button and the y labels 
            //$('#' + this.state.pgInstanceId + '_slide_btn').css('top', gridRegion.y + this._gridHeight() + marginTop);
            $('#' + this.state.pgInstanceId + '_slide_btn').css('top', this.state.optionsControls.top);
            
            // The height of .pg_controls_options defined in phenogrid.css - Joe
            var pg_ctrl_options = $('#' + this.state.pgInstanceId + '_controls_options');
            // shrink the height when we don't show the group selection
            if (this.state.initialTargetGroupLoadList.length === 1) {
                pg_ctrl_options.css('height', 310);
            }
            // options div has an down arrow, -10 to create some space between the down arrow and the button - Joe
            //pg_ctrl_options.css('top', gridRegion.y + this._gridHeight() - pg_ctrl_options.outerHeight() - 10 + marginTop);
            pg_ctrl_options.css('top', this.state.optionsControls.top + 30);
            pg_ctrl_options.css('left', this.state.optionsControls.left); 
            $('#' + this.state.pgInstanceId + '_slide_btn').css('left', this.state.optionsControls.left);
/*            // Place the options button to the right of the default limit of columns
            if (this._isCrossComparisonView()) {
                pg_ctrl_options.css('left', gridRegion.x + this.state.multiTargetsModeTargetLengthLimit*this.state.selectedCompareTargetGroup.length*gridRegion.cellPad + gridRegion.rowLabelOffset); 
                $('#' + this.state.pgInstanceId + '_slide_btn').css('left', gridRegion.x + this.state.multiTargetsModeTargetLengthLimit*this.state.selectedCompareTargetGroup.length*gridRegion.cellPad + gridRegion.rowLabelOffset);
            } else {
                pg_ctrl_options.css('left', gridRegion.x + this.state.singleTargetModeTargetLengthLimit*gridRegion.cellPad + gridRegion.rowLabelOffset); 
                $('#' + this.state.pgInstanceId + '_slide_btn').css('left', gridRegion.x + this.state.singleTargetModeTargetLengthLimit*gridRegion.cellPad + gridRegion.rowLabelOffset);
            }
            */
        },	
        
        _createTargetGroupSelection: function() {
            var optionhtml = "<div class='pg_ctrl_label'>Target Group(s)</div>" + 
                "<div id='" + this.state.pgInstanceId + "_targetGroup'>";
            for (var idx in this.state.targetGroupList) {
                if ( ! this.state.targetGroupList.hasOwnProperty(idx)) {
                    break;
                }
                var checked = "";
                var disabled = "";
                var linethrough = "";

                if (this._isTargetGroupSelected(this, this.state.targetGroupList[idx].groupName)) {
                    checked = "checked";
                }
                // If there is no data for a given group, even if it's set as active in config, 
                // it should not be shown in the group selector - Joe
                if (this.state.dataManager.length('target', this.state.targetGroupList[idx].groupName) === 0) {
                    disabled = "disabled";
                    linethrough = "pg_linethrough";
                }

                optionhtml += "<div class='pg_select_item " + linethrough + "'><input type='checkbox' value=\"" + this.state.targetGroupList[idx].groupName +
                "\" " + checked + disabled + ">" + this.state.targetGroupList[idx].groupName + '</div>';
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
            var optionhtml = '<div class="pg_select_item"><input type="checkbox" id="' + this.state.pgInstanceId + '_invert_axis"' + checked + '>Invert Axis</div><div class="pg_hr"></div>'; 
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
            $('#' + this.state.pgInstanceId + '_unmatched_btn').css('left', this.state.btnPadding);
            $('#' + this.state.pgInstanceId + '_unmatched_list').css('top', gridRegion.y + this._gridHeight() + $('#' + this.state.pgInstanceId + '_unmatched_btn').outerHeight() + + 17 + 10);
            
            if (this._isCrossComparisonView()) {
                $('#' + this.state.pgInstanceId + '_unmatched_list').css('width', gridRegion.x + this.state.multiTargetsModeTargetLengthLimit*this.state.selectedCompareTargetGroup.length*gridRegion.cellPad - 20); 
            } else {
                $('#' + this.state.pgInstanceId + '_unmatched_list').css('width', gridRegion.x + this.state.singleTargetModeTargetLengthLimit*gridRegion.cellPad - 20); 
            }
        },	
        
        // ajax callback
        _fetchSourceLabelCallback: function(self, target, targets, data) {
            var label;
            // Show id if label is not found
            if (typeof(data.label) !== 'undefined') {
                label = data.label;
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
         * Given an array of phenotype objects edit the object array.
         * items are objects of the form { "id": "HP:0000174", "term": "Abnormality of the palate"}
         */
        _removeDuplicatedSourceId: function(gridSourceList) {
            var filteredList = {};
            var newlist = [];
            var pheno;
            for (var i in gridSourceList) {
                pheno = gridSourceList[i];
                if (typeof pheno === 'string') {
                    newlist.push(pheno);
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

        // Genotypes expansion for gene (single group mode) - Joe
        _insertExpandedItems: function(id) {
            // change the plus icon to spinner to indicate the loading
            $('.pg_expand_genotype_icon').removeClass('fa-plus-circle');
            $('.pg_expand_genotype_icon').addClass('fa-spinner fa-pulse');
            
            // When we can expand a gene, we must be in the single group mode,
            // and there must be only one group in this.state.selectedCompareTargetGroup - Joe
            var group_name = this.state.selectedCompareTargetGroup[0].groupName;

            var loaded = this.state.dataManager.checkExpandedItemsLoaded(group_name, id);

            // when we can see the insert genotypes link in tooltip, 
            // the genotypes are either haven't been loaded or have already been loaded but then removed(invisible)
            if (loaded) {
                // change those associated genotypes to 'visible' and render them
                // array of genotype id list
                var associated_genotype_ids = this.state.dataLoader.loadedNewTargetGroupItems[id];
                
                // reactivating by changing 'visible' to true
                for (var i = 0; i < associated_genotype_ids.length; i++) {
                    var genotype_id = associated_genotype_ids[i];
      
                    // update the underlying data (not ordered) in dataLoader
                    // In dataManager, reorderedTargetEntriesNamedArray and reorderedTargetEntriesIndexArray are also updated once we update the 
                    // underlying data in dataLoader, because variable reference in javascript, not actual copy/clone - Joe 
                    this.state.dataLoader.targetData[group_name][genotype_id].visible = true; 
                }
                
                this.state.reactivateTargetGroupItems[group_name] = true;
                
                this._updateTargetAxisRenderingGroup(group_name);
                
                this.state.reactivateTargetGroupItems[group_name] = false;
                
                this._updateDisplay();
                
                // Remove the spinner icon
                $('.pg_expand_genotype_icon').removeClass('fa-spinner fa-pulse');
                $('.pg_expand_genotype_icon').addClass('fa-plus-circle');
                
                // Tell dataManager that the loaded genotypes of this gene have been expanded
                this.state.dataManager.expandedItemList[id] = this.state.dataLoader.loadedNewTargetGroupItems[id];
            } else {
                // Load the genotypes only once
                var cb = this._insertExpandedItemsCb;
                // Pass `this` to dataLoader as parent for callback use - Joe
                this.state.dataLoader.getNewTargetGroupItems(id, cb, this);
            }
        },
        
        // this cb has all the matches info returned from the compare
        // e.g., http://monarchinitiative.org/compare/:id1+:id2/:id3,:id4,...idN
        // parent refers to the global `this` and we have to pass it
        _insertExpandedItemsCb: function(results, id, parent, errorMsg) {
            console.log(results);

            // When there's an error message specified, simsearch results must be empty - Joe
            if (typeof(errorMsg) === 'undefined') {
                // add genotypes to data, and update target axis
                if (results.b.length > 0) {
                    // When we can expand a gene, we must be in the single group mode,
                    // and there must be only one group in this.state.selectedCompareTargetGroup - Joe
                    var group_name = parent.state.selectedCompareTargetGroup[0].groupName;

                    // transform raw owlsims into simplified format
                    // append the genotype matches data to targetData[targetGroup]/sourceData[targetGroup]/cellData[targetGroup]
                    parent.state.dataLoader.transformNewTargetGroupItems(group_name, results, id); 
     
                    // call this before reordering the target list
                    // to update this.state.targetAxis so it has the newly added genotype data in the format of named array
                    // when we call parent.state.targetAxis.groupEntries()
                    parent._updateTargetAxisRenderingGroup(group_name);
                    
                    if (typeof(parent.state.dataManager.reorderedTargetEntriesIndexArray[group_name]) === 'undefined') {
                        parent.state.dataManager.reorderedTargetEntriesIndexArray[group_name] = [];
                    }
                    
                    // for the first time, just get the unordered groupEntries()
                    // starting from second time, append the genotype data of following expansions to the already ordered target list
                    if (parent.state.dataManager.reorderedTargetEntriesIndexArray[group_name].length === 0) {
                        var updatedTargetEntries = parent.state.targetAxis.groupEntries(); // numeric index array
                    } else {
                        var updatedTargetEntries = parent.state.dataManager.appendNewItemsToOrderedTargetList(group_name, results.b);
                    }
                    
                    // Now we update the target list in dataManager
                    // and place those genotypes right after their parent gene
                    var newItemsData = {
                            targetEntries: updatedTargetEntries, 
                            genotypes: results.b, 
                            parentGeneID: id,
                            group: group_name
                        };
                        
                    // this will give us a reordered target list in two formats.
                    // one is associative/named array(reorderedTargetEntriesNamedArray), the other is number indexed array(reorderedTargetEntriesIndexArray)
                    parent.state.dataManager.updateTargetList(newItemsData);

                    // we set the genotype flag before calling _updateTargetAxisRenderingGroup() again
                    // _updateTargetAxisRenderingGroup() uses this flag for creating this.state.targetAxis
                    parent.state.newTargetGroupItems[group_name] = true;
                    
                    // call this again after the target list gets updated
                    // so this.state.targetAxis gets updated with the reordered target list (reorderedTargetEntriesNamedArray)
                    // as well as the new start position and end position
                    parent._updateTargetAxisRenderingGroup(group_name);
                    
                    // then reset the flag to false so it can still grab the newly added genotypes of another gene
                    // and add them to the unordered target list.
                    // without resetting this flag, we'll just get reorderedTargetEntriesNamedArray from dataManager and 
                    // reorderedTargetEntriesNamedArray hasn't been updated with the genotypes of the new expansion            
                    parent.state.newTargetGroupItems[group_name] = false;
                    
                    // flag, indicates that we have expanded genotypes for this group, 
                    // so they show up when we switch from multi-group mode back to single group mode
                    parent.state.expandedTargetGroupItems[group_name] = true;

                    parent._updateDisplay();
                    
                    // Remove the spinner icon
                    $('.pg_expand_genotype_icon').removeClass('fa-spinner fa-pulse');
                    $('.pg_expand_genotype_icon').addClass('fa-plus-circle');
                    
                    // Tell dataManager that the loaded genotypes of this gene have been expanded
                    parent.state.dataManager.expandedItemList[id] = parent.state.dataLoader.loadedNewTargetGroupItems[id];
                }
            } else {
                // pop up the error message in dialog
                parent._populateDialog(errorMsg);
            }
        },

        // Genotypes expansion for gene (single group mode)
        // hide expanded genotypes
        _removeExpandedItems: function(id) {
            // When we can expand a gene, we must be in the single group mode,
            // and there must be only one group in this.state.selectedCompareTargetGroup - Joe
            var group_name = this.state.selectedCompareTargetGroup[0].groupName;
            
            // array of genotype id list
            var associated_genotype_ids = this.state.dataLoader.loadedNewTargetGroupItems[id];
            
            // change 'visible' to false 
            for (var i = 0; i < associated_genotype_ids.length; i++) {
                var genotype_id = associated_genotype_ids[i];
                // update the underlying data
                // In dataManager, reorderedTargetEntriesNamedArray and reorderedTargetEntriesIndexArray are also updated once we update the 
                // underlying data in dataLoader, because variable reference in javascript, not actual copy/clone - Joe 
                this.state.dataLoader.targetData[group_name][genotype_id].visible = false; 
            }
            
            // Tell dataManager that the loaded genotypes of this gene have been collapsed from display 
            delete this.state.dataManager.expandedItemList[id];
            
            // set the flag
            this.state.removedTargetGroupItems[group_name] = true;
            
            // update the target list for axis render
            this._updateTargetAxisRenderingGroup(group_name);

            // reset flag
            this.state.removedTargetGroupItems[group_name] = false;
            
            // update display
            this._updateDisplay();
        },    
        
        _isTargetGroupSelected: function(self, name) {
            for (var i in self.state.selectedCompareTargetGroup) {
                if (self.state.selectedCompareTargetGroup[i].groupName === name) {
                    return true;
                }
            }
            return false;
        },

        _getTargetGroupInfo: function(self, name) {
            for (var i in self.state.targetGroupList) {
                if (self.state.targetGroupList[i].groupName === name) {
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