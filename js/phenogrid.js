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
 *         serverURL : "http://beta.monarchinitiative.org",
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
 *	Configuration options useful for setting species displayed, similarity calculations, and
 *	related parameters can also be passed in this hash. As of September
 *	2014, these options are currently being refactored - further
 *	documentation hopefully coming soon.
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
// npm install jquery jquery-ui d3 jshashtable

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
var stickytooltip = require('./stickytooltip.js');
var TooltipRender = require('./tooltiprender.js');
var Expander = require('./expander.js');
var Utils = require('./utils.js');

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
            serverURL: "http://monarchinitiative.org",
            selectedCalculation: 0,
            invertAxis: false,
            selectedSort: "Frequency",
            targetGroupList: [
                {name: "Homo sapiens", taxon: "9606",crossComparisonView: true, active: true},
                {name: "Mus musculus", taxon: "10090", crossComparisonView: true, active: true},
                {name: "Danio rerio", taxon: "7955", crossComparisonView: true, active: true},
                {name: "Drosophila melanogaster", taxon: "7227", crossComparisonView: false, active: false},
                {name: "UDPICS", taxon: "UDPICS", crossComparisonView: false, active: false}
            ]
        },

        // Supposed to be used by developers for deeper customization
        // can not be overwritten from constructor
        internalOptions: {
            imagePath: 'image/',
            htmlPath: 'js/res/',	
            simServerURL: "",  // URL of the server for similarity searches
            simSearchQuery: "/simsearch/phenotype",   //"/simsearch/phenotype?input_items=",    
            unmatchedButtonLabel: 'UNMATCHED PHENOTYPES',
            gridTitle: 'Phenotype Similarity Comparison',       
            defaultSingleTargetDisplayLimit: 30, //  defines the limit of the number of targets to display
            defaultSourceDisplayLimit: 30, //  defines the limit of the number of sources to display
            defaultCrossCompareTargetLimitPerTargetGroup: 10,    // the number of visible targets per organisms to be displayed in cross compare mode  
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
                x: 80, 
                y: 25, 
                width: 40, 
                height: 26
            },
            gridRegion: {
                x:254, 
                y:200, // origin coordinates for grid region (matrix)
                ypad:13, // x distance from the first cell to the next cell
                xpad:15, // y distance from the first cell to the next cell
                cellwd:10, 
                cellht:10, // // cell width and height
                rowLabelOffset:-25, // offset of the row label (left side)
                colLabelOffset: 18,  // offset of column label (adjusted for text score) from the top of grid squares
                scoreOffset:5  // score text offset from the top of grid squares
            },
            gradientRegion: {
                x:254, 
                y:620, 
                height:10
            }, // width will be calculated - Joe
            phenotypeSort: [
                "Alphabetic", 
                "Frequency and Rarity", 
                "Frequency" 
            ],
            similarityCalculation: [
                {label: "Similarity", calc: 0, high: "Max", low: "Min"}, 
                {label: "Ratio (q)", calc: 1, high: "More Similar", low: "Less Similar"}, 
                {label: "Ratio (t)", calc: 3, high: "More Similar", low: "Less Similar"} , 
                {label: "Uniqueness", calc: 2, high: "Highest", low: "Lowest"}],
            comparisonTypes: [ 
                {organism: "Homo sapiens", comparison: "diseases"}
            ],
            defaultComparisonType: {comparison: "genes"},
            apiEntityMap: [ 
                {prefix: "HP", apifragment: "disease"},
                {prefix: "OMIM", apifragment: "disease"}, 
                {prefix: "ZFIN", apifragment: "gene"}, 			
                {prefix: "MGI", apifragment: "gene"}
            ]
        },


	/*
	 * phenotype_data - a list of phenotypes in the following format:
	 * [ {"id": "HP:12345", "observed" :"positive"}, {"id: "HP:23451", "observed" : "negative"},]
	 * or simply a list of IDs.
	 * [ "HP:12345", "HP:23451", ...]
	 */
	_create: function() {
		// must be available from js loaded in a separate file...
		this.configoptions = configoptions;
		// check these 
		// important that config options (from the file) and this. options (from
		// the initializer) come last
		this.state = $.extend({},this.internalOptions,this.config,this.configoptions,this.options);
		// default simServerURL value..
		if (typeof(this.state.simServerURL) === 'undefined' || this.state.simServerURL === "") {
			this.state.simServerURL=this.state.serverURL;
		}
		this.state.data = {};

		this._createTargetGroupIndices();
	},

	
	//init is now reduced down completely to loading
	_init: function() {
		this.element.empty();

		// show loading spinner - Joe
		this._showLoadingSpinner();		

        // Remove duplicated source IDs - Joe
		var querySourceList = this._parseQuerySourceList(this.state.phenotypeData);

		this.state.selectedCompareTargetGroup = [];
		var targetGroupLoadList = [];

        this.state.tooltips = {}; // Holds the FAQ popups
        
		// load the default selected target targetGroup list based on the active flag
		for (var idx in this.state.targetGroupList) {
			// for active targetGroup pre-load them
			if (this.state.targetGroupList[idx].active) {
				targetGroupLoadList.push(this.state.targetGroupList[idx]);	
			}	
			// should they be shown in the comparison view
			if (this.state.targetGroupList[idx].crossComparisonView) {
				this.state.selectedCompareTargetGroup.push(this.state.targetGroupList[idx]);	
			}			
		}
		var self = this;
		var postAsyncCallback = function() {
            self._postDataInitCB(self); 
        };

		// initialize data processing class, 
		this.state.dataLoader = new DataLoader(this.state.simServerURL, this.state.serverURL, this.state.simSearchQuery, this.state.apiEntityMap);

		// starting loading the data
		this.state.dataLoader.load(querySourceList, targetGroupLoadList, postAsyncCallback);  //optional parm:   this.limit);
	},

	_postDataInitCB: function (self) {
		// set a max IC score
		self.state.maxICScore = self.state.dataLoader.getMaxICScore();

		self.state.dataManager = new DataManager(self.state.dataLoader);

		// initialize the ontologyCache
		self.state.ontologyCache = {};
		
	    // initialize axis groups
	    self._createAxisRenderingGroups();

		self._initDefaults();   
		self._processDisplay();
	},

	//Originally part of _init
	_initDefaults: function() {
		// must init the stickytooltip here initially, but then don't reinit later until in the redraw
		// this is weird behavior, but need to figure out why later
		if (typeof(this.state.stickyInitialized) === 'undefined') {
			this._addStickyTooltipAreaStub();
			this.state.stickyInitialized = true;
			stickytooltip.init("*[data-tooltip]", "mystickytooltip");
		}
		this.state.tooltipRender = new TooltipRender(this.state.serverURL);   
		
		// MKD: NEEDS REFACTORED init a single instance of Expander
		this.state.expander = new Expander(); 

		if (this.state.owlSimFunction === 'exomiser') {
			this.state.selectedCalculation = 2; // Force the color to Uniqueness
		}

	    this._setSelectedCalculation(this.state.selectedCalculation);
		this._setDefaultSelectedSort(this.state.selectedSort);

		this._createColorScale();  
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
			var singleTargetGroupName = this.state.selectedCompareTargetGroup[0].name;
			
			sourceList = this.state.dataManager.getData("source", singleTargetGroupName);

			// set default display limits based on displaying defaultSourceDisplayLimit
    		this.state.sourceDisplayLimit = this.state.dataManager.length("source", singleTargetGroupName);
	
			// target list
			targetList = this.state.dataManager.getData("target", singleTargetGroupName);
			this.state.targetDisplayLimit = this.state.dataManager.length("target", singleTargetGroupName);			
		}

		// check to make sure the display limits are not over the default display limits
		if (this.state.sourceDisplayLimit > this.state.defaultSourceDisplayLimit) {
			this.state.sourceDisplayLimit = this.state.defaultSourceDisplayLimit;  // adjust the display limit within default limit
		}

		if ( this.state.targetDisplayLimit > this.state.defaultSingleTargetDisplayLimit) {
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
	
	_reDraw: function() {
		if (this.state.dataManager.isInitialized()) {
			this._initCanvas();

			this._addLogoImage();

			this._createPhenogridControls();
			this._positionPhenogridControls();
            this._togglePhenogridControls();
            
			if (this.state.owlSimFunction != 'compare' && this.state.owlSimFunction != 'exomiser'){
			 	this._createOverviewTargetGroupLabels();
			}
			this._createGrid();
			
			this._createScoresTipIcon();
			
			this._addGridTitle(); // Must after _createGrid() since it's positioned based on the _gridWidth() - Joe
			
			this._createOverviewSection();
			this._createGradientLegend();
			this._createTargetGroupDividerLines();

			// this must be initialized here after the _createModelLabels, or the mouse events don't get
			// initialized properly and tooltips won't work with the mouseover defined in _convertLableHTML
			stickytooltip.init("*[data-tooltip]", "mystickytooltip");	

            // Unmatched sources
            this._createUnmatchedSources();
            this._positionUnmatchedSources();
            this._toggleUnmatchedSources();
            
            // Get unmatched sources, add labels via async ajax calls if not found
            // Must be called after _createAxisRenderingGroups() - Joe
            this.state.unmatchedSources = this._getUnmatchedSources();
            // Proceed if there's any unmatched
            if (this.state.unmatchedSources.length > 0) {
                // Fetch labels for unmatched sources via async ajax calls
                // then format and append them to the pg_unmatched_list div - Joe
                this._formatUnmatchedSources(this.state.unmatchedSources);
            }
            
            // For exported phenogrid SVG, hide by default
            this._createMonarchInitiativeText();
		} else {
			var msg = "There are no results available.";
			this._createPhenogridContainer();
			this._createEmptyVisualization(msg);
		}
	},

	// Click the setting button to open/close the control options
	// Click anywhere inside #pg_svg to close the options when it's open
	_togglePhenogridControls: function() {
		var self = this; // Needed for inside the anonymous function - Joe
		// Slide control panel - Joe
		$("#pg_controls_options").hide(); // Hide the options by default
		
		// Toggle the options panel by clicking the button
		$("#pg_slide_btn").click(function() {
			// $(this) refers to $("#pg_slide_btn")
			if ( ! $(this).hasClass("pg_slide_open")) {
				// Show the phenogrid controls
				$("#pg_controls_options").fadeIn();
				// Remove the top border of the button by adding .pg_slide_open CSS class
				$(this).addClass("pg_slide_open");
			} else {
				$("#pg_controls_options").fadeOut();
				// Add top border back
				$(this).removeClass("pg_slide_open");
			}
		});
		
		// When the options panel is visible, click anywhere inside #pg_svg to close the options, 
		// more user-friendly than just force to click the button again - Joe
		$('#pg_svg').click(function(event) {
			if ($(event.target) !== $('#pg_slide_btn') && $(event.target) !== $('#pg_controls_options')) {
				// Only close the options if it's visible
				if ($('#pg_controls_options').is(':visible')) {
					// Add the top border of the button back
					$("#pg_slide_btn").removeClass("pg_slide_open");
					// Then close the options
					$("#pg_controls_options").fadeOut();
				}
			}
		});
	},
	
    // Click the setting button to open/close the control options
	// Click anywhere inside #pg_container to close the options when it's open
	_toggleUnmatchedSources: function() {
		var self = this; // Needed for inside the anonymous function - Joe
		$("#pg_unmatched_list").hide(); // Hide the options by default
		
		// Toggle the options panel by clicking the button
		$("#pg_unmatched_btn").click(function() {
			// $(this) refers to $("#pg_slide_btn")
			if ( ! $(this).hasClass("pg_unmatched_open")) {
				// Show the phenogrid controls
				$("#pg_unmatched_list").fadeIn();
				// Remove the top border of the button by adding .pg_unmatched_open CSS class
				$(this).addClass("pg_unmatched_open");
			} else {
				$("#pg_unmatched_list").fadeOut();
				// Add top border back
				$(this).removeClass("pg_unmatched_open");
			}
		});
		
		// When the options panel is visible, click anywhere inside #pg_svg to close the options, 
		// more user-friendly than just force to click the button again
		// NOTE: it's very interesting that if use 'html' or document instead of '#pg_svg', it won't work - Joe
		$('#pg_svg').click(function(event) {
			if ($(event.target) !== $('#pg_unmatched_btn') && $(event.target) !== $('#pg_unmatched_list')) {
				// Only close the options if it's visible
				if ($('#pg_unmatched_list').is(':visible')) {
					// Add the top border of the button back
					$("#pg_unmatched_btn").removeClass("pg_unmatched_open");
					// Then close the options
					$("#pg_unmatched_list").fadeOut();
				}
			}
		});
	},
    
	// create the grid
	_createGrid: function() {
		var self = this;
		var xvalues = self.state.xAxisRender.entries();   //keys();
		var yvalues = self.state.yAxisRender.entries();
		var gridRegion = self.state.gridRegion; 
		var xScale = self.state.xAxisRender.getScale();
		var yScale = self.state.yAxisRender.getScale();
		var gridHeight = self._gridHeight();
		var gridWidth = self._gridWidth();		

		// use the x/y renders to generate the matrix
	    var matrix = self.state.dataManager.buildMatrix(xvalues, yvalues, false);

		// create a row, the matrix contains an array of rows (yscale) with an array of columns (xscale)
		var row = this.state.svg.selectAll(".row")
  			.data(matrix)
				.enter().append("g")			
			.attr("class", "row")	 		
			.attr("id", function(d, i) { 
				return "pg_grid_row_"+i;})
  			 .attr("transform", function(d, i) { 
  			 	return "translate(" + gridRegion.x +"," + self._calcYCoord(d, i) + ")"; })
  			.each(createrow);

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
			.attr("data-tooltip", "stickyInner")   				      
		      .text(function(d, i) { 
	      		var el = self.state.yAxisRender.itemAt(i);
	      		return Utils.getShortLabel(el.label); })
			.on("mouseover", function(d, i) { 
				var p = $(this);			
				self._crossHairsOn(d.id, i, focus, 'horizontal');
				var data = self.state.yAxisRender.itemAt(i); // d is really an array of data points, not individual data pt
				self._mouseover(this, data, self, p);})
			.on("mouseout", function(d) {
				self._crossHairsOff();		  		
				self._mouseout(d);
			});

	    // create columns using the xvalues (targets)
	  	var column = this.state.svg.selectAll(".column")
	      .data(xvalues)
	    .enter().append("g")
	      	.attr("class", "column")
            .style("font-size", '11px')            
			.attr("id", function(d, i) { 
				return "pg_grid_col_"+i;})	      	
	      .attr("transform", function(d) { 
	      	var offset = gridRegion.colLabelOffset;
	      	var xs = xScale(d.id);
			return "translate(" + (gridRegion.x + (xs*gridRegion.xpad)) +	      		
	      				 "," + (gridRegion.y-offset) + ")rotate(-45)"; }); //-45

	    // create column labels
	  	column.append("text")
	      	.attr("x", 0)
	      	.attr("y", xScale.rangeBand()+2)  //2
		    .attr("dy", ".32em")
		    .attr("data-tooltip", "stickyInner")   			
	      	.attr("text-anchor", "start")
	      		.text(function(d, i) { 		
	      		return Utils.getShortLabel(d.label,self.state.labelCharDisplayCount); })
		    .on("mouseover", function(d, i) { 
		    	var p = $(this);					
		    	self._crossHairsOn(d.id, i, focus, 'vertical');
		    	self._mouseover(this, d, self, p);})
			.on("mouseout", function(d) {
				self._crossHairsOff();		  		
				self._mouseout(d);});
	      	
	    // add the scores  
	    self._createTextScores();

		function createrow(row) {
		    var cell = d3.select(this).selectAll(".cell")
		        .data(row)
		      .enter().append("rect")
		      	.attr("id", function(d, i) { 
		      		return "pg_cell_"+ d.ypos + "_" + d.xpos; })
		        .attr("class", "cell")
		        .attr("x", function(d) { 
		        		return d.xpos * gridRegion.xpad;})
		        .attr("width", gridRegion.cellwd)
		        .attr("height", gridRegion.cellht) 
				.attr("data-tooltip", "stickyInner")   					        
		        .style("fill", function(d) { 
					var el = self.state.dataManager.getCellDetail(d.source_id, d.target_id, d.targetGroup);
					return self._getColorForModelValue(self, el.value[self.state.selectedCalculation]);
			        })
		        .on("mouseenter", function(d) { 
		        	var p = $(this);					
		        	self._crossHairsOn(d.target_id, d.ypos, focus, 'both');
		        	self._mouseover(this, d, self, p);})							
		        .on("mouseout", function(d) {
		        	self._crossHairsOff();		  		
		        	self._mouseout(d, $(this));});
		}
	},

	_crossHairsOff: function() {
        this.state.svg.selectAll(".pg_focusLine").remove();			
	},

	// directions: 'vertical' or 'horizontal' or 'both'
	_crossHairsOn: function(id, ypos, focus, direction) {
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
			this._createFocusLineVertical(x, gridRegion.y, x, gridRegion.y + this._gridHeight());
			this._createFocusLineHorizontal(gridRegion.x, y, gridRegion.x + this._gridWidth(), y);	        
        }
	},
	
	_createFocusLineVertical: function(x1, y1, x2, y2) {     
        this.state.svg.append('line')
            .attr('id', 'focusLineVertical')
            .attr('class', 'pg_focusLine')
            .attr('x1', x1)
			.attr('y1', y1)
			.attr('x2', x2)
			.attr('y2', y2);
	},

	_createFocusLineHorizontal: function(x1, y1, x2, y2) {   
		this.state.svg.append('line')
            .attr('id', 'focusLineHorizontal')
            .attr('class', 'pg_focusLine')
            .attr('x1', x1)
			.attr('y1', y1)
			.attr('x2', x2)
			.attr('y2', y2);
	},
	
	_calcYCoord: function (d, i) {
		var y = this.state.gridRegion.y;
		var ypad = this.state.gridRegion.ypad;

		return (y+(i*ypad));
	},

	_mouseover: function (self, d, parent, p) {

		var data;
		if (d.type == 'cell') {  
       		data = parent.state.dataManager.getCellDetail(d.source_id, d.target_id, d.targetGroup);

			// hightlight row/col labels
		  	d3.select("#pg_grid_row_" + d.ypos +" text")
				  .classed("pg_active", true);
	  		d3.select("#pg_grid_col_" + d.xpos +" text")
				  .classed("pg_active", true);
			
			// hightlight the cell
	 		d3.select("#pg_cell_" + d.ypos +"_" + d.xpos)
				  .classed("pg_rowcolmatch", true)	
				  .classed("pg_cursor_pointer", true);					  

		} else {
			parent._highlightMatching(self, d);
			data = d;    			
		}
		// show tooltip
		parent._createHoverBox(data);

		// get the position of object where the mouse event happened		
		var pos = p.offset();

		// add the width of the client rect to the left position to place it at the end
		var leftPos = pos.left, topPos = pos.top; 


		// did we hover over a grid row, place the tooltip on the far right of the label
		if (self.parentNode.id.indexOf('grid_row') > -1) {
			leftPos += p[0].getBoundingClientRect().width-5;
			topPos += 7;
		} else { // columns add a little spacing from the current mouse position
			leftPos += 20;
		}
		var position = {left: leftPos, top: topPos};

		// show a stickytooltip
		stickytooltip.show(position);

	},

	_mouseout: function(d, p) {
		
		// unhighlight row/col
		d3.selectAll(".row text")
			  .classed("pg_active", false);
		d3.selectAll(".column text")
			  .classed("pg_active", false);
		d3.selectAll(".row text")
			  .classed("pg_related_active", false);
		d3.selectAll(".column text")
			  .classed("pg_related_active", false);		
		d3.selectAll(".cell")
				.classed("pg_rowcolmatch", false)
				.classed("pg_cursor_pointer", false);					  				  

		// if (!stickytooltip.isdocked) {
		// // 	// hide the tooltip
		//  	stickytooltip.closetooltip();
		// }

	},

	_highlightMatching: function(s, data) {
		var hightlightSources = true;
		var currenPos = this._getAxisDataPosition(data.id);
		var nameId = s.parentNode.id;  // using parentNode is compatible across browsers, not s.parentElement.id

		// did we hover over a grid column
		if (nameId.indexOf('grid_col') > -1) {
			hightlightSources = true;
			var matches = this.state.dataManager.getMatrixSourceTargetMatches(currenPos, hightlightSources);

			if (typeof(matches) != 'undefined') {
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

			if (typeof(matches) != 'undefined') {
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
  					return "translate(" + (gridRegion.x-gridRegion.xpad-5) +"," + (gridRegion.y+scale(d)*gridRegion.ypad+10) + ")"; })
	      		.attr("x", gridRegion.rowLabelOffset)
	      		.attr("y",  function(d, i) {return scale.rangeBand(i)/2;});  
	    } else {
	    	scores	      		
	    	.attr("transform", function(d, i) { 
	      			return "translate(" + (gridRegion.x + scale(d)*gridRegion.xpad-1) +
	      				 "," + (gridRegion.y-gridRegion.scoreOffset ) +")";})
	      		.attr("x", 0)
	      		.attr("y", scale.rangeBand()+2);
	    }
	}, 
	_getColorForModelValue: function(self, score) {
		// This is for the new "Overview" target option
		var selectedScale = this.state.colorScale[self.state.selectedCalculation];
		return selectedScale(score);
	},

	/* dummy option procedures as per 
	 * http://learn.jquery.com/jquery-ui/widget-factory/how-to-use-the-widget-factory/
	 * likely to have some content added as we proceed
	 */
	_setOption: function( key, value ) {
		this._super( key, value );
	},

	_setOptions: function( options ) {
		this._super( options );
	},

	// create this visualization if no phenotypes or models are returned
	// [vaa12] the commented-out code has been here for a while.  Check to see if its unneeded and good to remove
	_createEmptyVisualization: function(msg) {
		var self = this;
		var html;
		d3.select("#pg_svg_group").remove();
		//this.state.pgContainer.append("<svg id='svg_area'></svg>");
		//this.state.svg = d3.select("#svg_area");

		//var pgContainer = this.state.pgContainer;
		//pgContainer.append("<svg id='svg_area'></svg>");
		//this.state.svg = d3.select("#svg_area")
		//	.attr("width", this.state.emptySvgX)
		//	.attr("height", this.state.emptySvgY);

		//var error = "<br /><div id='err'><h4>" + msg + "</h4></div><br /><div id='return'><button id='button' type='button'>Return</button></div>";
		//this.element.append(error);
		//if (this.state.currentTargetGroupName != "Overview"){
		if (!self._isCrossComparisonView()) {			
			html = "<h4 id='err'>" + msg + "</h4><br /><div id='return'><p><button id='button' type='button'>Return</button></p><br/></div>";
			//this.element.append(html);
			this.state.pgContainer.append(html);
			d3.selectAll("#button")
				.on("click", function(){
					$("#return").remove();
					$("#errmsg").remove();
					d3.select("#pg_svg_group").remove();
					self._init();
				});
		}else{
			html = "<h4 id='err'>" + msg + "</h4><br />";
			//this.element.append(html);
			this.state.pgContainer.append(html);
		}
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
		var data = this.state.dataManager.buildMatrix(xvalues, yvalues, true);
		//var data = this.state.dataManager.getFlattenMatrix();

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
				return y;})
			.attr("x", function(d) { 
				var xid = d.target_id;
				var xscale = self.state.smallXScale(xid);
				var x =  xscale + linePad / 2; 
				return x;})
			.attr("width", linePad) // Defined in navigator.miniCellSize
			.attr("height", linePad) // Defined in navigator.miniCellSize
			.attr("fill", function(d) {
				var el = self.state.dataManager.getCellDetail(d.source_id, d.target_id, d.targetGroup);
				return self._getColorForModelValue(self, el.value[self.state.selectedCalculation]);			 
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

	// We only have 3 color,s but that will do for now
	_getColorForCellValue: function(self, score) {
		// This is for the new "Overview" target option
		var selectedScale = self.state.colorScale[self.state.selectedCalculation];
		return selectedScale(score);
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
				self._showDialog("modelscores");
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
			.domain(sourceList.map(function (d) {return d; }))
			.rangePoints([0, overviewRegionSize]);

		self.state.smallXScale = d3.scale.ordinal()
			.domain(targetList.map(function (d) {
				var td = d;
				return d; }))
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
		var label = "";

		for (var i in this.state.comparisonTypes) {
			if (organism === this.state.comparisonTypes[i].organism){
				label = this.state.comparisonTypes[i].comparison;
			}
		}
		if (label === ""){
			label = this.state.defaultComparisonType.comparison;
		}
		return label;
	}, 


	_setSelectedCalculation: function(calc) {
		var self = this;

		var tempdata = self.state.similarityCalculation.filter(function(d) {
			return d.calc == calc;
		});
		self.state.selectedCalculation = tempdata[0].calc;
	},

	_setDefaultSelectedSort: function(type) {
		var self = this;
		self.state.selectedSort = type;
	},

	// Previously  
	_processDisplay: function(){
        this.element.empty();
		this._reDraw();
	},

	// Returns axis data from a ID of models or phenotypes
	_getAxisData: function(key) {
	 
	 	key = key.replace(":", "_");  // keys are stored with _ not : in AxisGroups
	     if (this.state.yAxisRender.contains(key)){
		     return this.state.yAxisRender.get(key);
		 } else if (this.state.xAxisRender.contains(key)){
		     return this.state.xAxisRender.get(key);
		 }
		 else { return null; }
	},

	_getAxisDataPosition: function(key) {
	    if (this.state.yAxisRender.contains(key)){
		    return this.state.yAxisRender.position(key);
		} else if (this.state.xAxisRender.contains(key)){
		    return this.state.xAxisRender.position(key);
		}
		else { return -1; }
	},

	_getIDTypeDetail: function(key) {
		//var info = this.state.modelListHash.get(key);
		//var info = this.state.dataManager.getElement("target", key, this.state.currentTargetGroupName);
		var info;
	     if (this.state.yAxisRender.contains(key)){
		     info = this.state.yAxisRender.get(key);
		 } else if (this.state.xAxisRender.contains(key)){
		     info = this.state.xAxisRender.get(key);
		 }
		if (typeof(info) !== 'undefined') return info.type;
		return "unknown";
	},


	_createColorScale: function() {
			var maxScore = 0,
			method = this.state.selectedCalculation; // 4 different calculations (similarity, ration (q), ratio (t), uniqueness) - Joe

			switch(method){
				case 2: maxScore = this.state.maxICScore; // Uniqueness ? - Joe
				break;
				case 1: maxScore = 100;
				break;
				case 0: maxScore = 100;
				break;
				case 3: maxScore = 100;
				break;
				default: maxScore = this.state.maxICScore;
				break;
			}
			// 3 september 2014 still a bit clunky in handling many organisms, but much less hardbound.
			this.state.colorScale = {};


			this.state.colorScale = new Array(4); // Why 4? Maybe one color scale per calculation method? - Joe
			for (var j = 0; j < 4; j++) {
				maxScore = 100;
				if (j === 2) {
					maxScore = this.state.maxICScore; // Uniqueness ? - Joe
				}
				if (typeof(this.state.colorRanges[j]) !== 'undefined') {
					this.state.colorScale[j] = this._getColorScale(maxScore);
				}
			}
	},

	_getColorScale: function(maxScore) {
		var cs = d3.scale.linear();
		cs.domain([3, maxScore]);
		cs.domain(this.state.colorDomains.map(cs.invert));
		cs.range(this.state.colorRanges);
		return cs;
	},

	_initCanvas: function() {
		this._createPhenogridContainer();
		var pgContainer = this.state.pgContainer;
		var sourceDisplayCount = this.state.yAxisRender.displayLength();
		var widthOfSingleCell = this.state.gridRegion.cellwd;

		pgContainer.append("<svg id='pg_svg'><g id='pg_svg_group'></g></svg>");
	
        // Define a font-family for all SVG texts 
        // so we don't have to apply font-family separately for each SVG text - Joe
        this.state.svg = d3.select("#pg_svg_group")
            .style("font-family", "Verdana, Geneva, sans-serif");
	},

	_createPhenogridContainer: function() {
		var container = $('<div id="pg_container"></div>');
		this.state.pgContainer = container;
		this.element.append(container);
	},

	// add a sticky tooltip div stub, this is used to dynamically set a tooltip info 
	_addStickyTooltipAreaStub: function() {
		var sticky = $("<div>")
						.attr("id", "mystickytooltip")
						.attr("style", "padding: 1px");
						//.attr("class", "stickytooltip");
					
		// var inner1 = $("<div>")
		// 				.attr("id", "sticky1")
		// 				.attr("style", "padding:5px");

		var stickyInner =  $("<div>")
						.attr("id", "stickyInner");
						
		
		var img = $("<img>")
				.attr("id", "img-spinner")
				.attr("src", this.state.imagePath + "waiting_ac.gif")
				.attr("alt", "Loading, please wait...");

		// var wait = $("<div>")
		// 	.attr("id", "wait")
		// 	//.attr("class", "spinner")
		// 	.attr("style", "display:none")
		// 	.text("Searching for data...");

		// 	wait.append(img);
		// var status = $("<div>")
		// 	.attr("class", "stickystatus");

		sticky.append(stickyInner);

		//sticky.append(inner1);
				//.append(wait);
				//.append(status);

		// always append to body
		sticky.appendTo('body');
		sticky.mouseleave("mouseout",function(e) {
		 	stickytooltip.closetooltip();
		});
	},
	
	// Grid main top title
	_addGridTitle: function() {
		var targetGroup = '';

		// set up defaults as if overview
		var titleText = this.state.gridTitle;

		//if (this.state.currentTargetGroupName !== "Overview") {
		if ( ! this._isCrossComparisonView()) {
			targetGroup = this.state.selectedCompareTargetGroup[0].name;
			var comp = this._getComparisonType(targetGroup);
			titleText = this.state.gridTitle + " (grouped by " + targetGroup + " " + comp + ")";
		}
		// COMPARE CALL HACK - REFACTOR OUT
		if (this.state.owlSimFunction === 'compare' || this.state.owlSimFunction === 'exomiser'){
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
		this.state.svg.append("svg:image")
			.attr("xlink:href", this.state.imagePath + "logo.svg")
			.attr("x", this.state.logo.x)
			.attr("y", this.state.logo.y)
			.attr("id", "pg_logo")
			.attr('class', 'pg_cursor_pointer')
			.attr("width", this.state.logo.width)
			.attr("height", this.state.logo.height)
			.on('click', function() {
				window.open('http://monarchinitiative.org', '_blank');
			});
	},

	_resetLinks: function() {
		// don't put these styles in css file - these styles change depending on state
		this.state.svg.selectAll("#pg_detail_content").remove();

		var link_lines = d3.selectAll(".data_text");
		for (var i in link_lines[0]){
			if ( ! link_lines[0].hasOwnProperty(i)) {
					break;
				}
			link_lines[0][i].style.fill = this._getExpandStyling(link_lines[0][i].id);
		}
		link_lines.style("font-weight", "normal");
		link_lines.style("text-decoration", "none");
		link_lines.style("text-anchor", "end");

		var link_labels = d3.selectAll(".model_label");
		for (var j in link_labels[0]){
			if ( ! link_lines[0].hasOwnProperty(j)) {
				break;
			}			
			link_labels[0][j].style.fill = this._getExpandStyling(link_labels[0][j].id);
		}
		link_labels.style("font-weight", "normal");
		link_labels.style("text-decoration", "none");
	},

	// Will return all partial matches in the cellDataHash structure.  Good for finding rows/columns of data
	_getMatchingModels: function (key) {
		//var cellKeys = this.state.cellDataHash.keys();
		var cellKeys = this.state.dataManager.keys("cellData");  // MKD: this still needs work, esp for overview mode
		var matchingKeys = [];
		for (var i in cellKeys){
//			if (key == cellKeys[i].yID || key == cellKeys[i].xID){
			if (key === cellKeys[i].source_id || key === cellKeys[i].target_id){
				matchingKeys.push(cellKeys[i]);
			}
		}
		return matchingKeys;
	},

	_createHoverBox: function(data){
		var id;

		// for cells we need to check the invertAxis to adjust for correct id
		if (data.type == 'cell') {
			 if (this.state.invertAxis) {
				id = data.target_id;
			 } else {
				id = data.source_id;
			 }
		} else {
			id = data.id;
		}

		// format data for rendering in a tooltip
		var retData = this.state.tooltipRender.html({parent: this, id:id, data: data});   

		// update the stub stickytool div dynamically to display
		$("#stickyInner").empty();
		$("#stickyInner").html(retData);

		// For phenotype ontology tree 
		if (data.type === 'phenotype') {
			// https://api.jqueryui.com/jquery.widget/#method-_on
			// Binds click event to the ontology tree expand icon - Joe
			// In tooltiprender.js, the font awesome icon <i> element follows the form of id="pg_expandOntology_HP_0001300" - Joe
			var expandOntol_icon = $('#pg_expandOntology_' + id);
			this._on(expandOntol_icon, {
				"click": function(event) {
					this._expandOntology(id);
				}
			});
		}
	},

	// This builds the string to show the relations of the ontology nodes.  It recursively cycles through the edges and in the end returns the full visual structure displayed in the phenotype hover
	buildOntologyTree: function(id, edges, level) {
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
					nextResult = this.buildOntologyTree(edges[j].obj, edges, nextLevel);
					if (nextResult === ""){
						// Bolds the 'top of the line' to see what is the root or closet to the root.  It will hit this point either when it reaches the ontologyDepth or there are no parents
						results += "<br>" + this._buildIndentMark(this.state.ontologyTreeHeight - nextLevel) + "<strong>" + this._buildOntologyHyperLink(edges[j].obj) + "</strong>";
						this.state.ontologyTreesDone++;
					} else {
						results += nextResult + "<br>" + this._buildIndentMark(this.state.ontologyTreeHeight - nextLevel) + this._buildOntologyHyperLink(edges[j].obj);
					}
					
					if (level === 0){
						results += "<br>" + this._buildIndentMark(this.state.ontologyTreeHeight) + this._getOntologyLabel(id) + "<br>";
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

	_getOntologyLabel: function(id) {
		var label = this.state.dataManager.getOntologyLabel(id);
		return label;
	},

	// Based on the ID, it pulls the label from CacheLabels and creates a hyperlink that allows the user to go to the respective phenotype page
	_buildOntologyHyperLink: function(id){
		var label = this._getOntologyLabel(id);
		var link = "<a href=\"" + this.state.serverURL + "/phenotype/" + id + "\" target=\"_blank\">" + label + "</a>";
		return link;
	},

	_createTargetGroupDividerLines: function() {
		var self = this;
		var gridRegion = self.state.gridRegion;
		var x = gridRegion.x;     
		var y = gridRegion.y;   
		var height = self._gridHeight() + gridRegion.colLabelOffset;// adjust due to extending it to the col labels
		var width = self._gridWidth();

		if (self._isCrossComparisonView() ) {
			var numOfTargetGroup = self.state.selectedCompareTargetGroup.length;
			var xScale = self.state.xAxisRender.getScale();

			//var cellsDisplayedPer = (self.state.defaultSingleTargetDisplayLimit / numOfTargetGroup);
			var cellsDisplayedPer = self.state.defaultCrossCompareTargetLimitPerTargetGroup;
			var x1 = 0;
			if (self.state.invertAxis) {
				x1 = ((gridRegion.ypad * (cellsDisplayedPer-1)) + gridRegion.cellht);  //-gridRegion.rowLabelOffset; 								
			} else {
				x1 = ((gridRegion.xpad * (cellsDisplayedPer-1)) + gridRegion.cellwd); 
				y = y - gridRegion.colLabelOffset;  // offset the line to reach the labels
			}

			for (var i=1; i < numOfTargetGroup; i++) {

				var fudgeFactor = 3; //magic num
						if (i > 1) {
						fudgeFactor = 1;
				}
				x1 = (x1 * i)+ fudgeFactor;  // add a few extra padding so it won't overlap cells

				if (self.state.invertAxis) {

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
	 * Change the list of phenotypes and filter the models accordingly. The 
	 * Movecount is an integer and can be either positive or negative
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

		/*
		 * this must be initialized here after the _createGrid, or the mouse events don't get
		 * initialized properly and tooltips won't work with the mouseover 
		 */
		stickytooltip.init("*[data-tooltip]", "mystickytooltip");
	},

	_clearGrid: function() {
		this.state.svg.selectAll("g.row").remove();
		this.state.svg.selectAll("g.column").remove();
		this.state.svg.selectAll("g.pg_score_text").remove();
	},

	// Add targetGroup labels (watermark-like) to top of grid
	_createOverviewTargetGroupLabels: function () {
		var self = this;
		// targetGroupList is an array that contains all the selected targetGroup names
		var targetGroupList = this.state.selectedCompareTargetGroup.map( function(d) {return d.name;});  //[];

		// Inverted and multi targetGroup
		if (this.state.invertAxis) { 
			var heightPerTargetGroup = this._gridHeight()/targetGroupList.length;

			this.state.svg.selectAll(".pg_targetGroup_name")
				.data(targetGroupList)
				.enter()
				.append("text")
				.attr("x", this.state.gridRegion.x + this._gridWidth() + 20) // 20 is margin - Joe
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
			var self = this;
            
            var widthPerTargetGroup = this._gridWidth()/targetGroupList.length;

			this.state.svg.selectAll(".pg_targetGroup_name")
				.data(targetGroupList)
				.enter()
				.append("text")
				.attr("x", function(d, i){ 
						return self.state.gridRegion.x + ((i + 1/2 ) * widthPerTargetGroup);
					})
				.attr("y", this.state.gridRegion.y - 110) // based on the grid region y, margin-top -110 - Joe
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
	},
	
	// Google chrome disallows the access to local files cia ajax call, 
    // so you may find out that the FAQ popup dialog won't show the content 
    // if you open index.html in the file:/// format
	_showDialog: function(name){
		var self = this;
		var url = this._getResourceUrl(name,'html');
		if (typeof(self.state.tooltips[name]) === 'undefined') {
			$.ajax( {url: url,
				dataType: 'html',
				async: 'false',
				success: function(data) {
					self._populateDialog(self,name,data);
				},
				error: function ( xhr, errorType, exception ) { 
				// Triggered if an error communicating with server
					self._populateDialog(self,"Error", "We are having problems with the server. Please try again soon. Error:" + xhr.status);
				}
			});
		}
		else {
			this._populateDialog(self,name,self.state.tooltips[name]);
		}
	},

	_populateDialog: function(self, name, text) {
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
		self.state.tooltips[name] = text;
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
			.attr("x", gridRegion.x + this.state.gridRegion.xpad * 3) // Shift 3 (cells+spaceing) - Joe
			.attr("y", gridRegion.y + this._gridHeight() + 22) // use x and y instead of transform since rect has x and y, 22 is margin - Joe
			.attr("id", "pg_gradient_legend_rect")
			.attr("width", this._gridWidth() - this.state.gridRegion.xpad * 3 * 2) // // Shift 3 (cells+spaceing) on each side - Joe
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
		var yTexts = gridRegion.y + this._gridHeight() + 20; // 20 is margin - Joe

		// create and position the low label
		gradientTextGrp.append("svg:text")
			.attr("x", gridRegion.x + this.state.gridRegion.xpad * 3) // Shift 3 (cells+spaceing) - Joe
			.attr("y", yTexts)
			.style('text-anchor', 'start') // Actually no need to specify this here since it's the default - Joe
			.text(lowText);

		// create and position the display type label
		gradientTextGrp.append("svg:text")
			.attr("x", gridRegion.x + (this._gridWidth()/2))
			.attr("y", yTexts)	
			.style('text-anchor', 'middle') // This renders the middle of the text string as the current text position x - Joe			
			.text(labelText);

		// create and position the high label
		gradientTextGrp.append("svg:text")
			.attr("x", gridRegion.x + this._gridWidth() - this.state.gridRegion.xpad * 3) // Shift 3 (cells+spaceing) - Joe
			.attr("y", yTexts)	
            .style('text-anchor', 'end') // This renders the end of the text to align the end of the rect - Joe 			
			.text(highText);
	},


    _createUnmatchedSources: function() {
        var pg_unmatched = $('<div id="pg_unmatched"></div>');

        // Not in the #pg_svg_group div since it's HTML - Joe
		$('#pg_container').append(pg_unmatched);
        
        // Need to put .pg_unmatched_list_arrow_border span before .pg_unmatched_list_arrow span - Joe
		var pg_unmatched_list = '<div id="pg_unmatched_list"><span class="pg_unmatched_list_arrow_border"></span><span class="pg_unmatched_list_arrow"></span></div>';
		
		// Hide/show unmatched - button - Joe
		var pg_unmatched_btn ='<div id="pg_unmatched_btn"><i class="fa fa-exclamation-triangle"></i> ' + this.state.unmatchedButtonLabel + ' </div>';
 
        pg_unmatched.append(pg_unmatched_list);
		pg_unmatched.append(pg_unmatched_btn);
        
        // Show no unmatched by default, if there's any unmatched found, add the labels in ajax callback - Joe
        var pg_unmatched_list_default = '<div id="pg_unmatched_list_default">No unmatched sources</div>';
        // Insert the html list in #pg_unmatched_list div
        $("#pg_unmatched_list").append(pg_unmatched_list_default);
    },

	// Phengrid controls/options
	_createPhenogridControls: function() {
		var self = this; // Use self inside anonymous functions 
		
		var phenogridControls = $('<div id="pg_controls"></div>');

		// Not in the #pg_svg_group div since it's HTML - Joe
		$('#pg_container').append(phenogridControls);
		
		// Need to put .pg_controls_options_arrow_border span before .pg_controls_options_arrow span - Joe
		var optionhtml = '<div id="pg_controls_options"><span class="pg_controls_options_arrow_border"></span><span class="pg_controls_options_arrow"></span></div>';
		
		// Hide/show panel - button - Joe
		var slideBtn = '<div id="pg_slide_btn"><i class="fa fa-bars"></i> OPTIONS</div>';
		
		var options = $(optionhtml);
		var orgSel = this._createOrganismSelection();
		options.append(orgSel);
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
            
			self._processDisplay();
		});

		$("#pg_calculation").change(function(d) {
			self.state.selectedCalculation = parseInt(d.target.value); // d.target.value returns quoted number - Joe
			self._processDisplay();
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
			self._processDisplay();
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
		    self._processDisplay();
            
            // Flip shouldn't reset the unmatched - Joe
		});

        // Click save button to export the current phenogrid view as a SVG file - Joe
        $("#pg_export").click(function() {	
            // SVG styles are applied with D3, not in CSS for this exporting purpose
            var svgElementClone = $('#pg_svg').clone(); // clone the svg to manipulate
            // Use data uri for svg logo
            svgElementClone.find('#pg_logo').attr('href', 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPjxzdmcgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIgd2lkdGg9IjIwMC40NjNweCIgaGVpZ2h0PSIxMzMuMDY1cHgiIHZpZXdCb3g9IjAgMCAyMDAuNDYzIDEzMy4wNjUiIGVuYWJsZS1iYWNrZ3JvdW5kPSJuZXcgMCAwIDIwMC40NjMgMTMzLjA2NSIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PGcgaWQ9ImFubm90YXRpb25zIiBkaXNwbGF5PSJub25lIj48ZyBkaXNwbGF5PSJpbmxpbmUiPjxkZWZzPjxsaW5lIGlkPSJTVkdJRF8xXyIgeDE9IjEwMy44MDMiIHkxPSI1OS41MzIiIHgyPSIxMDMuODEyIiB5Mj0iNTkuNTQxIi8+PC9kZWZzPjxjbGlwUGF0aCBpZD0iU1ZHSURfMl8iPjx1c2UgeGxpbms6aHJlZj0iI1NWR0lEXzFfIiAgb3ZlcmZsb3c9InZpc2libGUiLz48L2NsaXBQYXRoPjxnIGNsaXAtcGF0aD0idXJsKCNTVkdJRF8yXykiPjxkZWZzPjxsaW5lIGlkPSJTVkdJRF8zXyIgeDE9IjEwMy4zMjMiIHkxPSI2MC4xNjkiIHgyPSIxMDMuMzIzIiB5Mj0iNDguMjY1Ii8+PC9kZWZzPjxjbGlwUGF0aCBpZD0iU1ZHSURfNF8iPjx1c2UgeGxpbms6aHJlZj0iI1NWR0lEXzNfIiAgb3ZlcmZsb3c9InZpc2libGUiLz48L2NsaXBQYXRoPjwvZz48L2c+PGcgZGlzcGxheT0iaW5saW5lIj48ZGVmcz48cmVjdCBpZD0iU1ZHSURfNV8iIHg9Ii0wLjI0NSIgeT0iLTEyLjg3OSIgd2lkdGg9IjIwMS4zMjkiIGhlaWdodD0iMTYyLjE3NSIvPjwvZGVmcz48Y2xpcFBhdGggaWQ9IlNWR0lEXzZfIj48dXNlIHhsaW5rOmhyZWY9IiNTVkdJRF81XyIgIG92ZXJmbG93PSJ2aXNpYmxlIi8+PC9jbGlwUGF0aD48cGF0aCBjbGlwLXBhdGg9InVybCgjU1ZHSURfNl8pIiBmaWxsPSIjRTZFN0U4IiBkPSJNMTQ2Ljk1OSwxMzIuOTczdi0yLjM5NWgtMTkuNzg1Yy0zLjkyOCwwLTYuMzcxLTEuNDg1LTYuMzcxLTYuNzA3YzAtNS4yNywyLjc3OC02LjQxOSw4LTYuNDE5aDE4LjE1NnYtMi4zOTZoLTE4Ljg3NWMtNC4wMjIsMC03LjI4MS0xLjUzNC03LjI4MS02Ljc1NWMwLTUuMjcsMi4wNi02LjQxOSw4LTYuNDE5aDE4LjE1NnYtMi4zOTZoLTE4LjEwOGMtNi42MTEsMC0xMC4yNSwxLjcyNi0xMC4yNSw4LjU3NWMwLDMuMDY2LDAuNjIxLDUuNzQ5LDQuMTE4LDguMDQ5Yy0yLjM5NiwxLjAwNi00LjExOCwzLjQtNC4xMTgsNy41MjFjMCwzLjA2NiwwLjc2Niw1LjQxMywyLjc3Nyw2Ljg5OGwtMi4yNTIsMC4yMzh2Mi4yMDRIMTQ2Ljk1OXoiLz48cGF0aCBjbGlwLXBhdGg9InVybCgjU1ZHSURfNl8pIiBmaWxsPSIjRTZFN0U4IiBkPSJNMTQ2Ljk1OSwzMy44OHYtMi4zOTZoLTE5Ljc4NWMtMy45MjgsMC02LjM3MS0xLjQ4NC02LjM3MS02LjcwN2MwLTUuMjY5LDIuNzc4LTYuNDE5LDgtNi40MTloMTguMTU2di0yLjM5NWgtMTguODc1Yy00LjAyMiwwLTcuMjgxLTEuNTM0LTcuMjgxLTYuNzU1YzAtNS4yNzEsMi4wNi02LjQxOSw4LTYuNDE5aDE4LjE1NlYwLjM5NGgtMTguMTA4Yy02LjYxMSwwLTEwLjI1LDEuNzI2LTEwLjI1LDguNTc1YzAsMy4wNjYsMC42MjEsNS43NDksNC4xMTgsOC4wNDljLTIuMzk2LDEuMDA1LTQuMTE4LDMuNC00LjExOCw3LjUyMWMwLDMuMDY1LDAuNzY2LDUuNDEzLDIuNzc3LDYuODk3bC0yLjI1MiwwLjIzOXYyLjIwNEgxNDYuOTU5eiIvPjxwYXRoIGNsaXAtcGF0aD0idXJsKCNTVkdJRF82XykiIGZpbGw9IiNFNkU3RTgiIGQ9Ik0xNjcuNTk5LDgwLjU0NGgyLjM5NVY2MC43NmMwLTMuOTI5LDEuNDg1LTYuMzcxLDYuNzA3LTYuMzcxYzUuMjcsMCw2LjQxOSwyLjc3Nyw2LjQxOSw4djE4LjE1NWgyLjM5NlY2MS42NjljMC00LjAyMiwxLjUzMy03LjI4LDYuNzU0LTcuMjhjNS4yNzEsMCw2LjQyLDIuMDYsNi40Miw4djE4LjE1NWgyLjM5NlY2Mi40MzZjMC02LjYxMS0xLjcyNi0xMC4yNS04LjU3Ni0xMC4yNWMtMy4wNjUsMC01Ljc0OCwwLjYyMi04LjA0OSw0LjExOWMtMS4wMDUtMi4zOTYtMy40LTQuMTE5LTcuNTIxLTQuMTE5Yy0zLjA2NiwwLTUuNDEzLDAuNzY2LTYuODk3LDIuNzc3bC0wLjI0LTIuMjUyaC0yLjIwM1Y4MC41NDR6Ii8+PHBhdGggY2xpcC1wYXRoPSJ1cmwoI1NWR0lEXzZfKSIgZmlsbD0iI0U2RTdFOCIgZD0iTS0wLjI0NSw4MC41NDRIMi4xNVY2MC43NmMwLTMuOTI5LDEuNDg1LTYuMzcxLDYuNzA3LTYuMzcxYzUuMjY5LDAsNi40MTksMi43NzcsNi40MTksOHYxOC4xNTVoMi4zOTVWNjEuNjY5YzAtNC4wMjIsMS41MzQtNy4yOCw2Ljc1NS03LjI4YzUuMjcsMCw2LjQxOSwyLjA2LDYuNDE5LDh2MTguMTU1aDIuMzk2VjYyLjQzNmMwLTYuNjExLTEuNzI1LTEwLjI1LTguNTc1LTEwLjI1Yy0zLjA2NiwwLTUuNzQ5LDAuNjIyLTguMDQ5LDQuMTE5Yy0xLjAwNS0yLjM5Ni0zLjQtNC4xMTktNy41MjEtNC4xMTljLTMuMDY2LDAtNS40MTMsMC43NjYtNi44OTgsMi43NzdsLTAuMjM5LTIuMjUyaC0yLjIwNFY4MC41NDR6Ii8+PGxpbmUgY2xpcC1wYXRoPSJ1cmwoI1NWR0lEXzZfKSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNTg1OTVCIiBzdHJva2Utd2lkdGg9IjAuNSIgc3Ryb2tlLW1pdGVybGltaXQ9IjIiIHN0cm9rZS1kYXNoYXJyYXk9IjIuOTI0LDUuOTI0IiB4MT0iMTAwLjA0IiB5MT0iMTQ5LjI5NiIgeDI9IjEwMC4wNCIgeTI9Ii0xMi44NzkiLz48L2c+PC9nPjxnIGlkPSJGdWxsX0NvbG9yIj48Zz48cGF0aCBmaWxsPSIjNDZBNTk3IiBkPSJNMTQxLjc5MiwzNC43ODVjLTIuMDg4LTAuNDI5LTQuMjUtMC42NTQtNi40NjMtMC42NTRjLTguNTE0LDAtMTYuMjU4LDMuMzMyLTIyLjAwOCw4Ljc2Yy0wLjQ1MSwwLjQyNy0wLjg5LDAuODY1LTEuMzE2LDEuMzE3bC0xMS43NzEsMTEuNzcxTDg4LjQ2Miw0NC4yMDhjLTAuNDI2LTAuNDUyLTAuODY0LTAuODkxLTEuMzE2LTEuMzE3Yy01Ljc1LTUuNDI4LTEzLjQ5Ni04Ljc2LTIyLjAwNy04Ljc2Yy0yLjIxNSwwLTQuMzc2LDAuMjI2LTYuNDY0LDAuNjU0Yy0xNC42MDQsMy0yNS42MjEsMTUuOTUyLTI1LjYyMSwzMS40M2gwLjAxN2MwLDE1LjQ1OCwxMC45ODksMjguMzk3LDI1LjU2NSwzMS40MThjMi4xMDYsMC40MzgsNC4yODUsMC42NjgsNi41MTcsMC42NjhjOC4wMDksMCwxNS4zMzctMi45NTEsMjAuOTY0LTcuODJsMi42Ny0yLjY3bDAuMTU3LTAuMTU2YzAuMzktMC40MjYsMC42MjktMC45OTQsMC42MjktMS42MTljMC0xLjMzLTEuMDc3LTIuNDA2LTIuNDA3LTIuNDA2Yy0wLjYwNywwLTEuMTYyLDAuMjI3LTEuNTg0LDAuNkw4NS4zNiw4NC40NWwtMi41MTEsMi41MWMtNC45MzYsNC4yMTktMTEuMjE0LDYuNTQxLTE3LjY5Niw2LjU0MWMtMS44NjQsMC0zLjcyOS0wLjE5MS01LjU0My0wLjU2OGMtMTIuNTk1LTIuNjA5LTIxLjczOS0xMy44NDYtMjEuNzM5LTI2LjcxN2gwLjA3M2MwLTEyLjg5NSw5LjE2My0yNC4xMzUsMjEuNzg2LTI2LjcyOGwtMC4wMDQtMC4wMTdjMS43NzEtMC4zNTcsMy41OTEtMC41MzksNS40MTMtMC41MzljNi45NzYsMCwxMy42MjMsMi42NDYsMTguNzExLDcuNDQ5YzAuMzgzLDAuMzYyLDIzLjA2MiwyMy4yNTUsMjMuMDYyLDIzLjI1NWwwLjAwNC0wLjAwNGwwLjAxMywwLjAxMmwxNi41MjgtMTYuNTI1YzMuMTQyLTIuODQ4LDcuMzA2LTQuNTg3LDExLjg2OS00LjU4N2M5Ljc1MiwwLDE3LjY4NSw3LjkzMywxNy42ODUsMTcuNjg0YzAsOS43NS03LjkzMywxNy42ODQtMTcuNjg1LDE3LjY4NGMtNC4zMjYsMC04LjI5My0xLjU2Ni0xMS4zNjktNC4xNTRsLTIuMDE3LTIuMDE2bC0wLjM5LTAuMzkzYy0wLjQxMS0wLjMyNC0wLjkzLTAuNTIxLTEuNDk0LTAuNTIxYy0xLjMyOSwwLTIuNDA3LDEuMDgtMi40MDcsMi40MDhjMCwwLjcxMSwwLjMxMiwxLjM0OCwwLjgwMiwxLjc4OWwtMC4wOC0wLjA3MmwyLjMzNiwyLjM0NGwwLjE1OCwwLjEzM2M0LjA0NywzLjQwNiw5LjE4NCw1LjI4MywxNC40NjEsNS4yODNjMTIuMzk5LDAsMjIuNDg1LTEwLjA4NiwyMi40ODUtMjIuNDg1YzAtMTIuMzk4LTEwLjA4Ni0yMi40ODQtMjIuNDg1LTIyLjQ4NGMtNS41ODYsMC0xMC45NDcsMi4wNzEtMTUuMDk0LDUuODMybC0wLjA4NiwwLjA3OEwxMDYuOTQsNjIuODQ2bC0zLjM5NS0zLjM5MWwxMS44NTMtMTEuODUzbDAuMDk3LTAuMWMwLjM1OS0wLjM4MiwwLjczNy0wLjc2LDEuMTIxLTEuMTIyYzUuMDktNC44MDQsMTEuNzM0LTcuNDQ5LDE4LjcxMy03LjQ0OWMxLjg1MSwwLDMuNywwLjE4Nyw1LjQ5OCwwLjU1NmMxMi42MjMsMi41OTMsMjEuNzg1LDEzLjgzMywyMS43ODUsMjYuNzI4YzAsMTIuODcyLTkuMTQ1LDI0LjEwOC0yMS43MzgsMjYuNzE3Yy0xLjgxNCwwLjM3Ny0zLjY4LDAuNTY4LTUuNTQ1LDAuNTY4Yy02LjQ4MSwwLTEyLjc1OS0yLjMyMi0xNy42OTUtNi41NDFsLTIuNTEtMi41MWwtMC4yMjItMC4yMjFjLTAuNDIzLTAuMzczLTAuOTc4LTAuNi0xLjU4NS0wLjZjLTEuMzMsMC0yLjQwNiwxLjA3Ni0yLjQwNiwyLjQwNmMwLDAuNjI1LDAuMjM5LDEuMTkzLDAuNjI5LDEuNjE5bDAuMTU3LDAuMTU2bDIuNjY5LDIuNjdjNS42MjcsNC44NjksMTIuOTU1LDcuODIsMjAuOTYzLDcuODJjMi4yMzMsMCw0LjQxMi0wLjIzLDYuNTE5LTAuNjY4YzE0LjU3NS0zLjAyMSwyNS41NjUtMTUuOTYxLDI1LjU2NS0zMS40MThDMTY3LjQxMyw1MC43MzcsMTU2LjM5NSwzNy43ODUsMTQxLjc5MiwzNC43ODUiLz48cGF0aCBmaWxsPSIjNDZBNTk3IiBkPSJNODAuMjMyLDQ5LjU2M2MtNC4xMjQtMy43NDEtOS40NDgtNS44MDgtMTUuMDA0LTUuODN2LTAuMDAybC0wLjA1OCwwLjAwMWwtMC4wMzItMC4wMDFjLTEyLjM5OCwwLTIyLjQ4NCwxMC4wODYtMjIuNDg0LDIyLjQ4NGgwLjAxN2MwLDEyLjM5OSwxMC4wODYsMjIuNDg1LDIyLjQ4NCwyMi40ODVjNS4yNzgsMCwxMC40MTUtMS44NzUsMTQuNDYzLTUuMjgzbDAuMTU2LTAuMTMzbDIuMzM3LTIuMzQybC0wLjA4LDAuMDdjMC40ODktMC40MzksMC44MDEtMS4wNzgsMC44MDEtMS43OTFjMC0xLjMyOC0xLjA3OC0yLjQwNi0yLjQwNy0yLjQwNmMtMC41NjQsMC0xLjA4MywwLjE5Ny0xLjQ5MywwLjUyM2wtMC4zOTEsMC4zOTFsLTIuMDE3LDIuMDE2Yy0zLjA3NiwyLjU5LTcuMDQyLDQuMTU0LTExLjM2OSw0LjE1NGMtOS43NTEsMC0xNy42ODMtNy45MzQtMTcuNjgzLTE3LjY4NGgwLjA3M2MwLTkuNzM2LDcuOTA5LTE3LjY2LDE3LjYzOS0xNy42ODJjNC41NDYsMC4wMTEsOC42OTQsMS43NDcsMTEuODIzLDQuNTg1bDIzLjIyMiwyMy4yMjVsMy40MS0zLjQxTDgwLjQwMSw0OS43MjRMODAuMjMyLDQ5LjU2M3oiLz48L2c+PGc+PGRlZnM+PHBhdGggaWQ9IlNWR0lEXzdfIiBkPSJNMTEwLjM5Miw2Ni4xODJsMC4wMDQsMC4wMDRsMC45NzktMC45ODhMMTEwLjM5Miw2Ni4xODJ6IE0xMDYuOTc5LDYyLjc2OGwwLjAyLDAuMDJsMTAuMzY3LTEwLjM2N2wtMC4wMDctMC4wMDlMMTA2Ljk3OSw2Mi43Njh6Ii8+PC9kZWZzPjxjbGlwUGF0aCBpZD0iU1ZHSURfOF8iPjx1c2UgeGxpbms6aHJlZj0iI1NWR0lEXzdfIiAgb3ZlcmZsb3c9InZpc2libGUiLz48L2NsaXBQYXRoPjxnIGNsaXAtcGF0aD0idXJsKCNTVkdJRF84XykiPjxkZWZzPjxyZWN0IGlkPSJTVkdJRF85XyIgeD0iMTA2LjU5MiIgeT0iNTEuOTU2IiB3aWR0aD0iMTEuNTIxIiBoZWlnaHQ9IjE0Ljk3NiIvPjwvZGVmcz48Y2xpcFBhdGggaWQ9IlNWR0lEXzEwXyI+PHVzZSB4bGluazpocmVmPSIjU1ZHSURfOV8iICBvdmVyZmxvdz0idmlzaWJsZSIvPjwvY2xpcFBhdGg+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMSAwIDAgMSA3LjYyOTM5NWUtMDYgMCkiIGNsaXAtcGF0aD0idXJsKCNTVkdJRF8xMF8pIj48aW1hZ2Ugb3ZlcmZsb3c9InZpc2libGUiIHdpZHRoPSIzMCIgaGVpZ2h0PSIzOSIgeGxpbms6aHJlZj0iZGF0YTppbWFnZS9qcGVnO2Jhc2U2NCwvOWovNEFBUVNrWkpSZ0FCQWdFQXV3QzdBQUQvN0FBUlJIVmphM2tBQVFBRUFBQUFIZ0FBLys0QUlVRmtiMkpsQUdUQUFBQUFBUU1BRUFNQ0F3WUFBQUdjQUFBQjNBQUFBaWYvMndDRUFCQUxDd3NNQ3hBTURCQVhEdzBQRnhzVUVCQVVHeDhYRnhjWEZ4OGVGeG9hR2hvWEhoNGpKU2NsSXg0dkx6TXpMeTlBUUVCQVFFQkFRRUJBUUVCQVFFQUJFUThQRVJNUkZSSVNGUlFSRkJFVUdoUVdGaFFhSmhvYUhCb2FKakFqSGg0ZUhpTXdLeTRuSnljdUt6VTFNREExTlVCQVAwQkFRRUJBUUVCQVFFQkFRUC9DQUJFSUFDb0FJZ01CSWdBQ0VRRURFUUgveEFCOUFBRUFBd0VCQVFBQUFBQUFBQUFBQUFBQUFnTUVBUVVHQVFFQkFBQUFBQUFBQUFBQUFBQUFBQUFBQVJBQUFRUUJCUUVBQUFBQUFBQUFBQUFBQXdBQkFnUUZFQ0F3RVJKQkVRQUJBZ1FIQVFFQUFBQUFBQUFBQUFBQkFBSWdZWUVERVNGQmNaR3gwY0V6RWdFQUFBQUFBQUFBQUFBQUFBQUFBQUF3LzlvQURBTUJBQUlSQXhFQUFBRDZMSk9tdGV1amRHeEllRjNUYU5pWUJtdTdJQUEvLzlvQUNBRUNBQUVGQU9ILzJnQUlBUU1BQVFVQTRmL2FBQWdCQVFBQkJRREs1QzRDNjJWeUx1Szlma2hXTGNsMjZ6TE8rUkNGQkNnaFhTeVkvVjhJVUVLaEJvc3JZL1ZzSVZDRFJiUWd2Um9RYUxhL2RuLy8yZ0FJQVFJQ0JqOEFILy9hQUFnQkF3SUdQd0FmLzlvQUNBRUJBUVkvQUgyN1YwdFlBM0FZRFVUQy9ZOE44V2Q0OER4WjNDYUR4VVZ6WnZRZ29ubVRlaEM0eUhVSk8wT24ySC8vMlE9PSIgdHJhbnNmb3JtPSJtYXRyaXgoMC4zODQgMCAwIC0wLjM4NCAxMDYuNTkyMyA2Ni45MzIxKSI+PC9pbWFnZT48L2c+PC9nPjwvZz48Zz48ZGVmcz48cmVjdCBpZD0iU1ZHSURfMTFfIiB4PSIxMDguOTA4IiB5PSI0Ni42MDciIHRyYW5zZm9ybT0ibWF0cml4KC0wLjY2OSAtMC43NDMzIDAuNzQzMyAtMC42NjkgMTQxLjU2NzggMTcxLjIzNjUpIiB3aWR0aD0iMC4wMTMiIGhlaWdodD0iMTQuOTc0Ii8+PC9kZWZzPjxjbGlwUGF0aCBpZD0iU1ZHSURfMTJfIj48dXNlIHhsaW5rOmhyZWY9IiNTVkdJRF8xMV8iICBvdmVyZmxvdz0idmlzaWJsZSIvPjwvY2xpcFBhdGg+PGcgY2xpcC1wYXRoPSJ1cmwoI1NWR0lEXzEyXykiPjxkZWZzPjxyZWN0IGlkPSJTVkdJRF8xM18iIHg9IjEwMy4xMzYiIHk9IjQ4LjExNiIgd2lkdGg9IjExLjUyMSIgaGVpZ2h0PSIxMS45MDQiLz48L2RlZnM+PGNsaXBQYXRoIGlkPSJTVkdJRF8xNF8iPjx1c2UgeGxpbms6aHJlZj0iI1NWR0lEXzEzXyIgIG92ZXJmbG93PSJ2aXNpYmxlIi8+PC9jbGlwUGF0aD48ZyB0cmFuc2Zvcm09Im1hdHJpeCgxIDAgMCAxIDAgMy44MTQ2OTdlLTA2KSIgY2xpcC1wYXRoPSJ1cmwoI1NWR0lEXzE0XykiPjxpbWFnZSBvdmVyZmxvdz0idmlzaWJsZSIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMxIiB4bGluazpocmVmPSJkYXRhOmltYWdlL2pwZWc7YmFzZTY0LC85ai80QUFRU2taSlJnQUJBZ0VBdXdDN0FBRC83QUFSUkhWamEza0FBUUFFQUFBQUhnQUEvKzRBSVVGa2IySmxBR1RBQUFBQUFRTUFFQU1DQXdZQUFBR1dBQUFCdndBQUFnei8yd0NFQUJBTEN3c01DeEFNREJBWER3MFBGeHNVRUJBVUd4OFhGeGNYRng4ZUZ4b2FHaG9YSGg0akpTY2xJeDR2THpNekx5OUFRRUJBUUVCQVFFQkFRRUJBUUVBQkVROFBFUk1SRlJJU0ZSUVJGQkVVR2hRV0ZoUWFKaG9hSEJvYUpqQWpIaDRlSGlNd0t5NG5KeWN1S3pVMU1EQTFOVUJBUDBCQVFFQkFRRUJBUUVCQVFQL0NBQkVJQUNJQUh3TUJJZ0FDRVFFREVRSC94QUIvQUFFQUF3RUJBQUFBQUFBQUFBQUFBQUFBQVFNRUJRSUJBUUVBQUFBQUFBQUFBQUFBQUFBQUFBQUJFQUFDQWdJQ0F3QUFBQUFBQUFBQUFBQUJBd0lFQUNBUkJSQVNFeEVBQVFJREJRa0FBQUFBQUFBQUFBQUFBUUFDRVNFREVEQlJZZEV4UVlHeEVpSkNncklTQVFBQUFBQUFBQUFBQUFBQUFBQUFBQ0QvMmdBTUF3RUFBaEVERVFBQUFPL2ZUc3EvVkZrYzdiUHNBQUEvLzlvQUNBRUNBQUVGQU52LzJnQUlBUU1BQVFVQTIvL2FBQWdCQVFBQkJRQi9aZGhHMHE3ZmxpVzJaWUJQMVlubTBoR0xXSURQank5YXhBZUl3QU8vLzlvQUNBRUNBZ1kvQUYvLzJnQUlBUU1DQmo4QVgvL2FBQWdCQVFFR1B3Q3RUWlZneGxSeldqcGJzQklIaXU2ckgxYm9wdmp3R2lNVE9FbFdPTlIzMFVKTE94NXhjZWF6dEoza3h1UC8yUT09IiB0cmFuc2Zvcm09Im1hdHJpeCgwLjM4NCAwIDAgLTAuMzg0IDEwMy4xMzYyIDYwLjAyKSI+PC9pbWFnZT48L2c+PC9nPjwvZz48bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzE1XyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSIxMDguNjk1OCIgeTE9IjY0LjQ4NjMiIHgyPSIxMTguODg1OSIgeTI9IjU0LjI5NjIiPjxzdG9wICBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDAiLz48c3RvcCAgb2Zmc2V0PSIwLjA4OTYiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAuOTEwNCIvPjxzdG9wICBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAiLz48L2xpbmVhckdyYWRpZW50Pjxwb2x5Z29uIG9wYWNpdHk9IjAuNSIgZmlsbD0idXJsKCNTVkdJRF8xNV8pIiBwb2ludHM9IjEwNi45OTksNjIuNzg4IDExMC4zOTIsNjYuMTgyIDExMS4zNzUsNjUuMTk4IDEyMC40MzMsNTYuMDY2IDExNy4zNjYsNTIuNDIxICIvPjxsaW5lYXJHcmFkaWVudCBpZD0iU1ZHSURfMTZfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjEwMS45MTk0IiB5MT0iNTcuNzE0NCIgeDI9IjExMi4xMDk5IiB5Mj0iNDcuNTIzOSI+PHN0b3AgIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMCIvPjxzdG9wICBvZmZzZXQ9IjAuMDg5NiIgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MC45MTA0Ii8+PHN0b3AgIG9mZnNldD0iMSIgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MCIvPjwvbGluZWFyR3JhZGllbnQ+PHBvbHlnb24gb3BhY2l0eT0iMC41IiBmaWxsPSJ1cmwoI1NWR0lEXzE2XykiIHBvaW50cz0iMTAwLjI1LDU2LjAxNyAxMDMuNjE3LDU5LjM4MyAxMTQuMjA2LDQ4Ljc5NSAxMTAuOTcxLDQ1LjI5NSAiLz48L2c+PGcgaWQ9IkJXIiBkaXNwbGF5PSJub25lIj48ZyBkaXNwbGF5PSJpbmxpbmUiPjxwYXRoIGZpbGw9IiM5Mzk1OTgiIGQ9Ik0xNDEuNjc3LDM0Ljg5Yy0yLjA4OC0wLjQyOS00LjI1LTAuNjU0LTYuNDYzLTAuNjU0Yy04LjUxNCwwLTE2LjI1OCwzLjMzMi0yMi4wMDgsOC43NmMtMC40NTEsMC40MjctMC44OSwwLjg2NS0xLjMxNiwxLjMxN2wtMTEuNzcxLDExLjc3MWwtMTEuNzctMTEuNzcxYy0wLjQyNi0wLjQ1Mi0wLjg2NS0wLjg5MS0xLjMxNy0xLjMxN2MtNS43NS01LjQyOC0xMy40OTYtOC43Ni0yMi4wMDctOC43NmMtMi4yMTUsMC00LjM3NiwwLjIyNi02LjQ2NCwwLjY1NGMtMTQuNjA0LDMtMjUuNjIxLDE1Ljk1Mi0yNS42MjEsMzEuNDMxaDAuMDE3YzAsMTUuNDU3LDEwLjk4OSwyOC4zOTYsMjUuNTY1LDMxLjQxOGMyLjEwNiwwLjQzOCw0LjI4NSwwLjY2OCw2LjUxNywwLjY2OGM4LjAwOSwwLDE1LjMzNy0yLjk1MywyMC45NjQtNy44MmwyLjY2OS0yLjY3bDAuMTU4LTAuMTU2YzAuMzg5LTAuNDI4LDAuNjI5LTAuOTk2LDAuNjI5LTEuNjIxYzAtMS4zMjgtMS4wNzctMi40MDQtMi40MDctMi40MDRjLTAuNjA4LDAtMS4xNjMsMC4yMjctMS41ODUsMC42bC0wLjIyMSwwLjIxOWwtMi41MTEsMi41MWMtNC45MzYsNC4yMjEtMTEuMjE0LDYuNTQxLTE3LjY5Niw2LjU0MWMtMS44NjQsMC0zLjcyOS0wLjE4OS01LjU0My0wLjU2NkM0Ni45MDEsOTAuNDI2LDM3Ljc1Nyw3OS4xODksMzcuNzU3LDY2LjMyaDAuMDczYzAtMTIuODk2LDkuMTYzLTI0LjEzNiwyMS43ODYtMjYuNzI5bC0wLjAwNC0wLjAxN2MxLjc3MS0wLjM1NywzLjU5MS0wLjUzOSw1LjQxMy0wLjUzOWM2Ljk3NiwwLDEzLjYyMywyLjY0NiwxOC43MTEsNy40NDljMC4zODMsMC4zNjIsMjMuMDYyLDIzLjI1NSwyMy4wNjIsMjMuMjU1bDAuMDA0LTAuMDA0bDAuMDEzLDAuMDEzbDE2LjUyOC0xNi41MjZjMy4xNDItMi44NDgsNy4zMDYtNC41ODcsMTEuODY5LTQuNTg3YzkuNzUyLDAsMTcuNjg1LDcuOTMzLDE3LjY4NSwxNy42ODVjMCw5Ljc1LTcuOTMzLDE3LjY4Mi0xNy42ODUsMTcuNjgyYy00LjMyNiwwLTguMjkzLTEuNTY0LTExLjM2OS00LjE1MmwtMi4wMTctMi4wMThsLTAuMzktMC4zOTFjLTAuNDExLTAuMzI0LTAuOTMtMC41MjEtMS40OTQtMC41MjFjLTEuMzI5LDAtMi40MDcsMS4wNzgtMi40MDcsMi40MDZjMCwwLjcxMywwLjMxMiwxLjM1LDAuODAyLDEuNzkxbC0wLjA4LTAuMDcybDIuMzM2LDIuMzQybDAuMTU4LDAuMTM1YzQuMDQ3LDMuNDA2LDkuMTg0LDUuMjgxLDE0LjQ2MSw1LjI4MWMxMi4zOTksMCwyMi40ODUtMTAuMDg2LDIyLjQ4NS0yMi40ODJjMC0xMi4zOTgtMTAuMDg2LTIyLjQ4NC0yMi40ODUtMjIuNDg0Yy01LjU4NiwwLTEwLjk0NywyLjA3MS0xNS4wOTQsNS44MzJsLTAuMDg2LDAuMDc4bC0xMy4yMDcsMTMuMjA1bC0zLjM5NS0zLjM5MmwxMS44NTMtMTEuODUzbDAuMDk3LTAuMWMwLjM1OS0wLjM4MiwwLjczNy0wLjc2LDEuMTIxLTEuMTIyYzUuMDktNC44MDQsMTEuNzM0LTcuNDQ5LDE4LjcxMy03LjQ0OWMxLjg1MSwwLDMuNywwLjE4Nyw1LjQ5OCwwLjU1NmMxMi42MjMsMi41OTMsMjEuNzg1LDEzLjgzMywyMS43ODUsMjYuNzI5YzAsMTIuODY5LTkuMTQ1LDI0LjEwNS0yMS43MzgsMjYuNzE3Yy0xLjgxNCwwLjM3Ny0zLjY4LDAuNTY2LTUuNTQ1LDAuNTY2Yy02LjQ4MSwwLTEyLjc1OS0yLjMyLTE3LjY5NS02LjU0MWwtMi41MS0yLjUxbC0wLjIyMi0wLjIxOWMtMC40MjMtMC4zNzMtMC45NzgtMC42LTEuNTg1LTAuNmMtMS4zMywwLTIuNDA2LDEuMDc2LTIuNDA2LDIuNDA0YzAsMC42MjUsMC4yMzksMS4xOTMsMC42MjksMS42MjFsMC4xNTcsMC4xNTZsMi42NjksMi42N2M1LjYyNyw0Ljg2NywxMi45NTUsNy44MiwyMC45NjMsNy44MmMyLjIzMywwLDQuNDEyLTAuMjMsNi41MTktMC42NjhjMTQuNTc1LTMuMDIxLDI1LjU2NS0xNS45NjEsMjUuNTY1LTMxLjQxOEMxNjcuMjk4LDUwLjg0MiwxNTYuMjgxLDM3Ljg5LDE0MS42NzcsMzQuODkiLz48cGF0aCBmaWxsPSIjOTM5NTk4IiBkPSJNODAuMTE4LDQ5LjY2OGMtNC4xMjQtMy43NDEtOS40NDgtNS44MDgtMTUuMDA0LTUuODN2LTAuMDAybC0wLjA1OCwwLjAwMWwtMC4wMzItMC4wMDFjLTEyLjM5OCwwLTIyLjQ4NCwxMC4wODYtMjIuNDg0LDIyLjQ4M2gwLjAxN2MwLDEyLjM5OSwxMC4wODYsMjIuNDg1LDIyLjQ4NCwyMi40ODVjNS4yNzgsMCwxMC40MTUtMS44NzcsMTQuNDYzLTUuMjgzbDAuMTU2LTAuMTMzbDIuMzM3LTIuMzQ0bC0wLjA4LDAuMDdjMC40OS0wLjQzOSwwLjgwMS0xLjA3OCwwLjgwMS0xLjc4OWMwLTEuMzI4LTEuMDc4LTIuNDA2LTIuNDA3LTIuNDA2Yy0wLjU2NCwwLTEuMDgzLDAuMTk1LTEuNDkzLDAuNTIxbC0wLjM5MSwwLjM5M0w3Ni40MSw3OS44NWMtMy4wNzYsMi41ODgtNy4wNDIsNC4xNTQtMTEuMzY5LDQuMTU0Yy05Ljc1MSwwLTE3LjY4My03LjkzNi0xNy42ODMtMTcuNjg1aDAuMDczYzAtOS43MzUsNy45MDktMTcuNjU5LDE3LjYzOS0xNy42ODJjNC41NDYsMC4wMTEsOC42OTQsMS43NDcsMTEuODIzLDQuNTg1bDIzLjIyMiwyMy4yMjVsMy40MS0zLjQxTDgwLjI4Nyw0OS44MjhMODAuMTE4LDQ5LjY2OHoiLz48L2c+PGxpbmVhckdyYWRpZW50IGlkPSJTVkdJRF8xN18iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iMTA4LjU4MDYiIHkxPSI2NC4zODg3IiB4Mj0iMTE4Ljc3MDYiIHkyPSI1NC4xOTg2Ij48c3RvcCAgb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwIi8+PHN0b3AgIG9mZnNldD0iMC4wODk2IiBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eTowLjkxMDQiLz48c3RvcCAgb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eTowIi8+PC9saW5lYXJHcmFkaWVudD48cG9seWdvbiBkaXNwbGF5PSJpbmxpbmUiIG9wYWNpdHk9IjAuNSIgZmlsbD0idXJsKCNTVkdJRF8xN18pIiBwb2ludHM9IjEwNi44ODQsNjIuNjkgMTEwLjI3OCw2Ni4wODYgMTExLjI2MSw2NS4xMDIgMTIwLjMxOSw1NS45NyAxMTcuMjUxLDUyLjMyNCAiLz48bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzE4XyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSIxMDEuODA1MiIgeTE9IjU3LjYxODIiIHgyPSIxMTEuOTk1NiIgeTI9IjQ3LjQyNzciPjxzdG9wICBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDAiLz48c3RvcCAgb2Zmc2V0PSIwLjA4OTYiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAuOTEwNCIvPjxzdG9wICBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAiLz48L2xpbmVhckdyYWRpZW50Pjxwb2x5Z29uIGRpc3BsYXk9ImlubGluZSIgb3BhY2l0eT0iMC41IiBmaWxsPSJ1cmwoI1NWR0lEXzE4XykiIHBvaW50cz0iMTAwLjEzNiw1NS45MiAxMDMuNTAyLDU5LjI4NiAxMTQuMDkxLDQ4LjY5OCAxMTAuODU3LDQ1LjE5OCAiLz48L2c+PGcgaWQ9InJldmVyc2UiIGRpc3BsYXk9Im5vbmUiPjxwYXRoIGRpc3BsYXk9ImlubGluZSIgZmlsbD0iIzkzOTU5OCIgZD0iTTAsMHYxMzMuMDY1aDIwMC40NjNWMEgweiBNMTAwLjExNSw3Ni40NDdMNzYuODkzLDUzLjIyM2MtMy4xMjktMi44MzgtNy4yNzctNC41NzQtMTEuODIzLTQuNTg1Yy05LjczLDAuMDIyLTE3LjYzOSw3Ljk0Ni0xNy42MzksMTcuNjgyaC0wLjA3M2MwLDkuNzQ5LDcuOTMyLDE3LjY4NSwxNy42ODMsMTcuNjg1YzQuMzI3LDAsOC4yOTMtMS41NjYsMTEuMzY5LTQuMTU0bDIuMDE3LTIuMDE2bDAuMzkxLTAuMzkzYzAuNDEtMC4zMjYsMC45MjktMC41MjEsMS40OTMtMC41MjFjMS4zMjksMCwyLjQwNywxLjA3OCwyLjQwNywyLjQwNmMwLDAuNzExLTAuMzExLDEuMzUtMC44MDEsMS43ODlsMC4wOC0wLjA3bC0yLjMzNywyLjM0NGwtMC4xNTYsMC4xMzNjLTQuMDQ4LDMuNDA2LTkuMTg1LDUuMjgzLTE0LjQ2Myw1LjI4M2MtMTIuMzk4LDAtMjIuNDg0LTEwLjA4Ni0yMi40ODQtMjIuNDg1SDQyLjU0YzAtMTIuMzk3LDEwLjA4Ni0yMi40ODMsMjIuNDg0LTIyLjQ4M2wwLjAzMiwwLjAwMWwwLjA1OC0wLjAwMXYwLjAwMmM1LjU1NiwwLjAyMiwxMC44OCwyLjA4OSwxNS4wMDQsNS44M2wwLjE2OSwwLjE2bDIzLjIzOCwyMy4yMDlMMTAwLjExNSw3Ni40NDd6IE0xNDEuNzMzLDk3LjczOGMtMi4xMDYsMC40MzgtNC4yODUsMC42NjgtNi41MTksMC42NjhjLTguMDA4LDAtMTUuMzM2LTIuOTUzLTIwLjk2My03LjgybC0yLjY2OS0yLjY3bC0wLjE1Ny0wLjE1NmMtMC4zOS0wLjQyOC0wLjYyOS0wLjk5Ni0wLjYyOS0xLjYyMWMwLTEuMzI4LDEuMDc2LTIuNDA0LDIuNDA2LTIuNDA0YzAuNjA3LDAsMS4xNjIsMC4yMjcsMS41ODUsMC42bDAuMjIyLDAuMjE5bDIuNTEsMi41MWM0LjkzNyw0LjIyMSwxMS4yMTQsNi41NDEsMTcuNjk1LDYuNTQxYzEuODY1LDAsMy43My0wLjE4OSw1LjU0NS0wLjU2NmMxMi41OTQtMi42MTEsMjEuNzM4LTEzLjg0OCwyMS43MzgtMjYuNzE3YzAtMTIuODk2LTkuMTYyLTI0LjEzNi0yMS43ODUtMjYuNzI5Yy0xLjc5OC0wLjM2OS0zLjY0Ny0wLjU1Ni01LjQ5OC0wLjU1NmMtNi45NzksMC0xMy42MjMsMi42NDYtMTguNzEzLDcuNDQ5Yy0wLjM4NCwwLjM2Mi0wLjc2MiwwLjc0LTEuMTIxLDEuMTIybC0wLjA5NywwLjFMMTAzLjQzMSw1OS41NmwzLjM5NSwzLjM5MmwxMy4yMDctMTMuMjA1bDAuMDg2LTAuMDc4YzQuMTQ2LTMuNzYxLDkuNTA4LTUuODMyLDE1LjA5NC01LjgzMmMxMi4zOTksMCwyMi40ODUsMTAuMDg2LDIyLjQ4NSwyMi40ODRjMCwxMi4zOTYtMTAuMDg2LDIyLjQ4Mi0yMi40ODUsMjIuNDgyYy01LjI3NywwLTEwLjQxNC0xLjg3NS0xNC40NjEtNS4yODFsLTAuMTU4LTAuMTM1bC0yLjMzNi0yLjM0MmwwLjA4LDAuMDcyYy0wLjQ5LTAuNDQxLTAuODAyLTEuMDc4LTAuODAyLTEuNzkxYzAtMS4zMjgsMS4wNzgtMi40MDYsMi40MDctMi40MDZjMC41NjQsMCwxLjA4MywwLjE5NywxLjQ5NCwwLjUyMWwwLjM5LDAuMzkxbDIuMDE3LDIuMDE4YzMuMDc2LDIuNTg4LDcuMDQzLDQuMTUyLDExLjM2OSw0LjE1MmM5Ljc1MiwwLDE3LjY4NS03LjkzMiwxNy42ODUtMTcuNjgyYzAtOS43NTItNy45MzMtMTcuNjg1LTE3LjY4NS0xNy42ODVjLTQuNTYzLDAtOC43MjgsMS43MzktMTEuODY5LDQuNTg3bC0xNi41MjgsMTYuNTI2bC0wLjAxMy0wLjAxM2wtMC4wMDQsMC4wMDRjMCwwLTIyLjY4LTIyLjg5My0yMy4wNjItMjMuMjU1Yy01LjA4OC00LjgwNC0xMS43MzUtNy40NDktMTguNzExLTcuNDQ5Yy0xLjgyMiwwLTMuNjQyLDAuMTgyLTUuNDEzLDAuNTM5bDAuMDA0LDAuMDE3QzQ2Ljk5Myw0Mi4xODUsMzcuODMsNTMuNDI1LDM3LjgzLDY2LjMyaC0wLjA3M2MwLDEyLjg2OSw5LjE0NCwyNC4xMDUsMjEuNzM5LDI2LjcxN2MxLjgxNCwwLjM3NywzLjY3OSwwLjU2Niw1LjU0MywwLjU2NmM2LjQ4MiwwLDEyLjc2LTIuMzIsMTcuNjk2LTYuNTQxbDIuNTExLTIuNTFsMC4yMjEtMC4yMTljMC40MjItMC4zNzMsMC45NzctMC42LDEuNTg1LTAuNmMxLjMzLDAsMi40MDcsMS4wNzYsMi40MDcsMi40MDRjMCwwLjYyNS0wLjI0LDEuMTkzLTAuNjI5LDEuNjIxbC0wLjE1OCwwLjE1NmwtMi42NjksMi42N2MtNS42MjcsNC44NjctMTIuOTU1LDcuODItMjAuOTY0LDcuODJjLTIuMjMyLDAtNC40MTEtMC4yMy02LjUxNy0wLjY2OEM0My45NDYsOTQuNzE3LDMyLjk1Nyw4MS43NzcsMzIuOTU3LDY2LjMySDMyLjk0YzAtMTUuNDc5LDExLjAxNy0yOC40MzEsMjUuNjIxLTMxLjQzMWMyLjA4OC0wLjQyOSw0LjI0OS0wLjY1NCw2LjQ2NC0wLjY1NGM4LjUxMSwwLDE2LjI1NywzLjMzMiwyMi4wMDcsOC43NmMwLjQ1MiwwLjQyNywwLjg5MSwwLjg2NSwxLjMxNywxLjMxN2wxMS43NywxMS43NzFsMTEuNzcxLTExLjc3MWMwLjQyNy0wLjQ1MiwwLjg2NS0wLjg5MSwxLjMxNi0xLjMxN2M1Ljc1LTUuNDI4LDEzLjQ5NC04Ljc2LDIyLjAwOC04Ljc2YzIuMjEzLDAsNC4zNzUsMC4yMjYsNi40NjMsMC42NTRjMTQuNjA0LDMsMjUuNjIxLDE1Ljk1MiwyNS42MjEsMzEuNDMxQzE2Ny4yOTgsODEuNzc3LDE1Ni4zMDgsOTQuNzE3LDE0MS43MzMsOTcuNzM4eiIvPjwvZz48L3N2Zz4='); 
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
			self._showDialog("sorts");
		});

		$("#pg_calcs_faq").click(function(){
			self._showDialog("calcs");
		});
		
		$("#pg_about_phenogrid").click(function() {	
			self._showDialog("faq");
		});
	},

    // To be used for exported phenogrid SVG, hide this by default
    _createMonarchInitiativeText: function() {
        this.state.svg.append("text")
			.attr("x", this.state.gridRegion.x + this._gridWidth()/2)
			.attr("y", this.state.gridRegion.y + this._gridHeight() + 60) // 60 is margin
			.attr("id", "pg_monarchinitiative_text")
			.attr('class', 'pg_hide') // Only show this text in exported SVG of Phenogrid 
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
			.text('monarchinitiative.org');
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
		optionhtml += "</div>";

		return $(optionhtml);
	},

	// create the html necessary for selecting the calculation
	_createCalculationSelection: function () {
		var optionhtml = "<div class='pg_hr'></div><div class='pg_ctrl_label'>Calculation Method"+
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
		optionhtml += "</div>";
		return $(optionhtml);
	},

	// create the html necessary for selecting the sort
	_createSortPhenotypeSelection: function () {
		var optionhtml ="<div class='pg_hr'></div><div class='pg_ctrl_label'>Sort Phenotypes" + 
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
		optionhtml += "</div>";
		return $(optionhtml);
	},

	// create the html necessary for selecting the axis flip
	_createAxisSelection: function () {
		var checked = "";
		if (this.state.invertAxis) {
			checked = "checked";
		}
		var optionhtml = '<div class="pg_hr"></div><div class="pg_select_item"><input type="checkbox" id="pg_axisflip"' + checked + '>Invert Axis</div>'; 
		return $(optionhtml);
	},

	// create about phenogrid FAQ inside the controls/options - Joe
	_createAboutPhenogrid: function () {
		var html = '<div class="pg_hr"></div><div class="pg_select_item">About Phenogrid <i class="fa fa-info-circle cursor_pointer" id="pg_about_phenogrid"></i></div>'; 
		
		return $(html);
	},
	
    // Export current state of phenogrid as SVG file to be used in publications
    _createExportPhenogridButton: function() {
        var btn = '<div class="pg_hr"></div><div id="pg_export">Save Phenogrid as SVG</div>';
        
        return $(btn);
    },
    
	_getUnmatchedSources: function() {
		var fullset = this.state.dataLoader.origSourceList; // Get the original source list of IDs
		var matchedset = this.state.yAxisRender.groupIDs(); // Get all the matched source IDs
		var full = [];
		var partial = [];
		var unmatchedset = [];
		var tempObject = {"id": 0, "observed": "positive"};

		for (var i in fullset) {
			if (typeof(fullset[i].id) === 'undefined') {
				tempObject.id = fullset[i];
				full.push(tempObject);
			} else {
				full.push(fullset[i]);
			}
		}

		for (var j in matchedset){
			partial.push(matchedset[j].replace("_", ":"));
		}

		for (var k in full) {
			// if no match in fullset
			if (partial.indexOf(full[k].id) < 0) {
				// if there unmatched set is empty, add this umatched phenotype
				unmatchedset.push(full[k]);
			}
		}

		var dupArray = [];
		dupArray.push(unmatchedset[0]);	
		// check for dups
		for (var l in unmatchedset) {
			var found = false;
			for (var m in dupArray) {
				if (dupArray[m].id === unmatchedset[l].id) {
					found = true;
				}
			}
			if (found === false) {
				dupArray.push(unmatchedset[l]);
			}
		}
		if (dupArray[0] === undefined) {
			dupArray = [];
		}

        return dupArray;
	},

    // Position the unmatched sources when the gridRegion changes
	_positionUnmatchedSources: function(){
		var gridRegion = this.state.gridRegion; 
		$('#pg_unmatched_btn').css('top', gridRegion.y + this._gridHeight() + 17); // 17 is top margin
        $('#pg_unmatched_list').css('top', gridRegion.y + this._gridHeight() + $('#pg_unmatched_btn').outerHeight() + + 17 + 10);
    },	
    
    // ajax callback
    _fetchSourceLabelCallback: function(self, target, targets, data) {
        var label;
        // Show id if label is not found
        if (data.label !== undefined) {
            label = data.label;
        } else {
            label = data.id;
        }

        // Append unmatched phenotype to pg_unmatched_list - Joe
        $('#pg_unmatched_list_default').hide();
        var pg_unmatched_list_item = '<div class="pg_unmatched_list_item"><a href="' + self.state.serverURL + '/phenotype/' + data.id + '" target="_blank">' + label + ' (' + data.id + ')' + '</a></div>';
        $('#pg_unmatched_list').append(pg_unmatched_list_item);
        
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
            url: this.state.serverURL + "/phenotype/" + target.id + ".json",
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
        //console.log(targetGrpList);
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

	_expandOntology: function(id){
		var self = this;

		// check to see if id has been cached
		var cache = this.state.dataLoader.checkOntologyCache(id);

		if (typeof(cache) == 'undefined') 
		{
			var cb = self._postExpandOntologyCB;
			this.state.dataLoader.getOntology(id, this.state.ontologyDirection, this.state.ontologyDepth, cb, self);						
		} else {
			self._postExpandOntologyCB(cache, id, self);
		}

	},

	_postExpandOntologyCB: function(d, id, parent) {

		parent.state.ontologyTreesDone = 0;
		parent.state.ontologyTreeHeight = 0;		
		var info = parent._getAxisData(id);
		var hrefLink = "<a href=\"" + parent.state.serverURL+"/phenotype/"+ id + "\" target=\"_blank\">" + info.label + "</a>";
		var ontologyData = "<strong>Phenotype: </strong> " + hrefLink + "<br/>";
		ontologyData += "<strong>IC:</strong> " + info.IC.toFixed(2) + "<br/><br/>";

		var classTree = parent.buildOntologyTree(id.replace("_", ":"), d.edges, 0);

		if (classTree === "<br>"){
			ontologyData += "<em>No classification hierarchy data found</em>";
		} else {
			ontologyData += "<strong>Classification hierarchy:</strong>" + classTree;
		}

		$("#stickyInner").html(ontologyData);

		// reshow the sticky with updated info
		stickytooltip.show(null);

	},

	// collapse the expanded items for the current selected model targets
	_collapse: function(curModel) {
		var curData = this.state.dataManager.getElement("target", curModel);
		var modelInfo = {id: curModel, d: curData};

		// check cached hashtable first 
		var cachedScores = this.state.expandedHash.get(modelInfo.id);

		// if found just return genotypes scores
		if (cachedScores !== null && cachedScores.expanded) {
// MKD:  this needs to use DM
			this.state.modelListHash = this._removalFromModelList(cachedScores);

// MKD: do this through DM
//			this._rebuildCellHash();
			this.state.modelLength = this.state.modelListHash.size();

//			this._setAxisValues();
			this._processDisplay();

			// update the expanded flag
			var vals = this.state.expandedHash.get(modelInfo.id);
			vals.expanded = false;
			this.state.expandedHash.put(modelInfo.id, vals);
			stickytooltip.closetooltip();
		}
	},

	// get all matching phenotypes for a model
// MKD: get this from DM
	_getMatchingPhenotypes: function(curModelId) {
		var self = this;
		var models = self.state.modelData;
		var phenoTypes = [];
		for (var i in models){
			// models[i] is the matching model that contains all phenotypes
			if (models[i].model_id === curModelId){
				phenoTypes.push({id: models[i].id_a, label: models[i].label_a});
			}
		}
		return phenoTypes;
	}, 

	// insert into the model list
	_insertionModelList: function (insertPoint, insertions) {
		var newModelList = []; //new Hashtable();  //MKD REFACTOR
		//var sortedModelList= self._getSortedIDList( this.state.dataManager.getData("target")); 
		var sortedModelList = this.state.xAxisRender.keys();
		var reorderPointOffset = insertions.size();
		var insertionOccurred = false;

		for (var i in sortedModelList){
			var entry = this.state.dataManager.getElement("target", sortedModelList[i]);
			if (entry.pos === insertPoint) {
				// add the entry, or gene in this case	
				newModelList.push(entry);   //put(sortedModelList[i], entry);
				var insertsKeys = insertions.keys();
				// begin insertions, they already have correct positions applied
				for(var j in insertsKeys) {
					var id = insertsKeys[j];
					newModelList.push(insertions.get(id));  //put(id, insertions.get(id));
				}
				insertionOccurred = true;
			} else if (insertionOccurred) {
				entry.pos = entry.pos + reorderPointOffset;
				newModelList.push(entry);   //put(sortedModelList[i], entry);
			} else {
				newModelList.push(entry);  //put(sortedModelList[i], entry);
			}
		}
		//var tmp = newModelList.entries();
		return newModelList;
	},

	// remove a models children from the model list
	_removalFromModelList: function (removalList) {
		var newModelList = [];  //new Hashtable();    // MKD: NEEDS REFACTORED
		var newModelData = [];  
		var removalKeys = removalList.genoTypes.keys();   // MKD: needs refactored
		//var sortedModelList= self._getSortedIDList(this.state.dataManager.getData("target"));
		var sortedModelList = this.state.xAxisRender.keys();
		var removeEntries = removalList.genoTypes.entries();

		// get the max position that was inserted
		var maxInsertedPosition = 0;
		for (var x in removeEntries){
			var obj = removeEntries[x][1];
			if (obj.pos > maxInsertedPosition) {
				maxInsertedPosition = obj.pos;
			}
		}

		for (var i in sortedModelList){
			var entry = this.state.dataManager.getElement("target",sortedModelList[i]);
			var found = false, cnt = 0;

			// check list to make sure it needs removed
			while (cnt < removalKeys.length && !found) {
				if (removalKeys[cnt] === sortedModelList[i]) {
					found = true;
				}
				cnt++;
			}
			if (found === false) {
				// need to reorder it back to original position
				if (entry.pos > maxInsertedPosition) {
					entry.pos =  entry.pos - removalKeys.length;
					//pos++;  
					//entry.pos - maxInsertedPosition;
				}
				newModelList.push(entry); //put(sortedModelList[i], entry);
			}
		}

		// loop through to rebuild model data and remove any removals
//MKD: needs refactored		
		for (var y = 0; y < this.state.modelData.length; y++) {
			var id = this.state.modelData[y].model_id;
			var ret = removalKeys.indexOf(id);
			if (ret <  0) {
				newModelData.push(this.state.modelData[y]);
			}
		}
// MKD: REFACTOR TO USE DM
		this.state.modelData = newModelData;
		return newModelList;
	},

	// get the css styling for expanded gene/genotype
	_getExpandStyling: function(data) {
		var concept = this._getConceptId(data);

		if(typeof(concept) === 'undefined' ) return "#000000";
		var info = this._getIDTypeDetail(concept);

		if (info === 'gene') {
			var g = this.state.expandedHash.get(concept);
			if (g !== null && g.expanded) {
				return "#08594B";
			}
		}
		else if (info === 'genotype') {
			return "#488B80"; //"#0F473E";
		}
		return "#000000";
	},

	// check to see object is expanded
	_isExpanded: function(data) {
		var concept = this._getConceptId(data);
		var info = this._getIDTypeDetail(concept);

		if (info === 'gene') {
			var g = this.state.expandedHash.get(concept);
			// if it was ever expanded
			if (g !== null){
				return g.expanded;  
			}
		}
		return null;
	}, 

	// check to see object has children
	_hasChildrenForExpansion: function(data) {
		var concept = this._getConceptId(data);
		var info = this._getIDTypeDetail(concept);

		if (info == 'gene') {
			var g = this.state.expandedHash.get(concept);
			// if it was ever expanded it will have children
			if (g !== null) {
				return true;  
			}
		}
		return false;
	},

	_isGenoType: function(data) {
		var concept = this._getConceptId(data);
		var info = this._getIDTypeDetail(concept);

		if (info == 'genotype') {
			return true;
		}
		return false;
	},

	_refreshSticky: function() {
		var div=$('#mystickytooltip').html();
		$('#mystickytooltip').html(div);
	},

		// expand the model with the associated targets
	_expand: function(curModel) {
		$('#wait').show();
		var div=$('#mystickytooltip').html();
		$('#mystickytooltip').html(div);

		var refresh = true;
		var targets = [];   //new Hashtable();   MKD: NEEDS REFACTORED
		var type = this._getIDTypeDetail(curModel);
		var curData = this.state.dataManager.getElement("target", curModel);
		var modelData = {id: curModel, type: type, d: curData};
		var returnObj;

		// check cached hashtable first 
		var cachedTargets = this.state.expandedHash.get(modelData.id);
		var savedData = null;

		// if cached info not found, try get targets
		if (cachedTargets == null) {
	
			// get targets
			returnObj = this.state.expander.getTargets({modelData: modelData, parentRef: this});

			if (returnObj != null) {
				// save the results to the expandedHash for later
				if (returnObj.targets == null && returnObj.compareScores == null) {
					savedData = {expanded: false, data: returnObj}; 	
				} else {
					savedData = {expanded: true, data: returnObj};  // in expanded state by default
				}
				this.state.expandedHash.put(modelData.id, savedData);
			}
		} else {
			returnObj = cachedTargets.data;  // just reuse what we cached
		}

		if (returnObj != null && returnObj.targets != null && returnObj.compareScores != null) { 

			// update the model data 
			for (var idx in returnObj.compareScores.b) {
				var b = returnObj.compareScores.b;
// MKD: need this refactored
//				this._loadDataForModel(b);
			}

			console.log("Starting Insertion...");
// MKD: do this using DM
			this.state.modelListHash = this._insertIntoModelList(modelData.d.pos, returnObj.targets);

// MKD: do this using DM
			console.log("Rebuilding hashtables...");
			this._rebuildModelHash();

			this.state.modelLength = this.state.modelListHash.size();
//			this._setAxisValues();

			console.log("updating display...");
			this._processDisplay();
		} else {
			alert("No data found to expand targets");
		}

		$('#wait').hide();
		stickytooltip.closetooltip();
	},


	_isTargetGroupSelected: function(self, name) {
		for (var i in self.state.selectedCompareTargetGroup) {
			if (self.state.selectedCompareTargetGroup[i].name == name) {
				return true;
			}
		}
		return false;
	},

	_getTargetGroupInfo: function(self, name) {
		for (var i in self.state.targetGroupList) {
			if (self.state.targetGroupList[i].name == name) {
				return self.state.targetGroupList[i];
			}
		}
	},

	// Several procedures for various aspects of filtering/identifying appropriate entries in the target targetGroup list.. 
	_getTargetGroupIndexByName: function(self,name) {
		var index = -1;
		if (typeof(self.state.targetGroupByName[name]) !== 'undefined') {
			index = self.state.targetGroupByName[name].index;
		}
		return index;
	},

	_getTargetGroupNameByIndex: function(self,index) {
		var targetGroup;
		if (typeof(self.state.targetGroupList[index]) !== 'undefined') {
			targetGroup = self.state.targetGroupList[index].name;
		}
		else {
			targetGroup = 'Overview';
		}
		return targetGroup;
	},

	_getTargetGroupTaxonByName: function(self,name) {
		var taxon;
		// first, find something that matches by name
		if (typeof(self.state.targetGroupByName[name]) !== 'undefined') {
			taxon = self.state.targetGroupByName[name].taxon;
		}
		// default to overview, so as to always do somethign sensible
		if (typeof(taxon) === 'undefined') {
			taxon ='Overview';
		}

		return taxon;
	},

	/*
	* some installations might send in a taxon - "10090" - as opposed to a name - "Mus musculus".
	* here, we make sure that we are dealing with names by translating back
	* this might be somewhat inefficient, as we will later translate to taxon, but it will
	* make other calls easier to be consitently talking in terms of targetGroup name
	*/
	_getTargetGroupNameByTaxon: function(self,name) {
		// default - it actually was a targetGroup name
		var targetGroup = name;
		var found = false;

		/*
		 * check to see if the name exists.
		 * if it is found, then we say "true" and we're good.
		 * if, however, it matches the taxon, take the index in the array.
		 */

		for (var sname in self.state.targetGroupByName) {
			if(!self.state.targetGroupByName.hasOwnProperty(sname)){break;}
			// we've found a matching name.
			if (name == sname) {
				found = true;
			}

			if (name == self.state.targetGroupByName[sname].taxon) {
				found = true;
				targetGroup = sname;
				break;
			}
		}
		// if not found, it's overview.
		if (found === false) {
			targetGroup = "Overview";
		}
		return targetGroup;
	},

	// create a shortcut index for quick access to target targetGroup by name - to get index (position) and taxon
	_createTargetGroupIndices: function() {
		this.state.targetGroupByName = {};
		for (var j in this.state.targetGroupList) {
			// list starts as name, taxon pairs
			var name = this.state.targetGroupList[j].name;
			var taxon = this.state.targetGroupList[j].taxon;
			var entry = {};
			entry.index = j;
			entry.taxon = taxon;
			this.state.targetGroupByName[name] = entry;
		}
	},

	_getResourceUrl: function(name,type) {
		return this.state.htmlPath + name + '.' + type;
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

