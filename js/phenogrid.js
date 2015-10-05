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
//var stickytooltip = require('./stickytooltip.js'); // to delete
var TooltipRender = require('./tooltiprender.js');
var Expander = require('./expander.js');
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
            simServerURL: "",  // URL of the server for similarity searches
            simSearchQuery: "/simsearch/phenotype",   //"/simsearch/phenotype?input_items=",    
            unmatchedButtonLabel: 'Unmatched Phenotypes',
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
                x: 70, 
                y: 65, 
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

		this.state.selectedCompareTargetGroup = [];
		this.state.initialTargetGroupLoadList = [];

		this._createTargetGroupList(this.options.targetSpecies);
	},

	
	//init is now reduced down completely to loading
	_init: function() {
		this.element.empty();

		// show loading spinner - Joe
		this._showLoadingSpinner();		

        // Remove duplicated source IDs - Joe
		var querySourceList = this._parseQuerySourceList(this.state.phenotypeData);

		// this.state.selectedCompareTargetGroup = [];
		// var targetGroupLoadList = [];

		// // load the default selected target targetGroup list based on the active flag
		// for (var idx in this.state.targetGroupList) {
		// 	// for active targetGroup pre-load them
		// 	if (this.state.targetGroupList[idx].active) {
		// 		targetGroupLoadList.push(this.state.targetGroupList[idx]);	
		// 	}	
		// 	// should they be shown in the comparison view
		// 	if (this.state.targetGroupList[idx].crossComparisonView) {
		// 		this.state.selectedCompareTargetGroup.push(this.state.targetGroupList[idx]);	
		// 	}			
		// }
		var self = this;
		var postAsyncCallback = function() {
            self._postDataInitCB(self); 
        };

		// initialize data processing class, 
		this.state.dataLoader = new DataLoader(this.state.simServerURL, this.state.serverURL, this.state.simSearchQuery, this.state.apiEntityMap);

		// starting loading the data
		this.state.dataLoader.load(querySourceList, this.state.initialTargetGroupLoadList, postAsyncCallback);  //optional parm:   this.limit);
	},

	_postDataInitCB: function(self) {
		// set a max IC score
		self.state.maxICScore = self.state.dataLoader.getMaxICScore();

		self.state.dataManager = new DataManager(self.state.dataLoader);

		// need to update the selectedCompareTargetGroup list depending on if we loaded all the data
		self._updateSelectedCompareTargetGroup();

		// initialize the ontologyCache
		self.state.ontologyCache = {};
		
	    // initialize axis groups
	    self._createAxisRenderingGroups();

		self._initDefaults();   
        
        // Create all UI components
		self._createDisplay();
	},

	_updateSelectedCompareTargetGroup: function() {
		// loop through to make sure we have data to display
		for ( var idx in this.state.selectedCompareTargetGroup) {
			var r = this.state.selectedCompareTargetGroup[idx];

			var len = this.state.dataManager.length("target", r.name);
			if (typeof(len) === 'undefined'  || len < 1) {

				this.state.selectedCompareTargetGroup.slice(idx, 1);

//				this.state.selectedCompareTargetGroup[idx].active = false;
//				this.state.selectedCompareTargetGroup[idx].crossComparisonView = false;
			}
		}
	}, 

	//Originally part of _init
	_initDefaults: function() {
		// must init the stickytooltip here initially, but then don't reinit later until in the redraw
		// this is weird behavior, but need to figure out why later
		
        /* to delete
        if (typeof(this.state.stickyInitialized) === 'undefined') {
			this._addStickyTooltipAreaStub();
			this.state.stickyInitialized = true;
			stickytooltip.init("*[data-tooltip]", "mystickytooltip");
		}
        */ 
        
        // Flag for tooltip
        this.state.tooltipIsDocked = false;
        
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
        
        // this must be initialized here after the _createModelLabels, or the mouse events don't get
        // initialized properly and tooltips won't work with the mouseover defined in _convertLableHTML
        //stickytooltip.init("*[data-tooltip]", "mystickytooltip"); /// to delete
    },
    
	// Click the setting button to open/close the control options
	// Click anywhere inside #pg_svg to close the options when it's open
	_togglePhenogridControls: function() {
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
	},
	
    // Click the setting button to open/close the control options
	// Click anywhere inside #pg_container to close the options when it's open
	_toggleUnmatchedSources: function() {
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
				self._crossHairsOn(d.id, i, 'horizontal');
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
		    	self._crossHairsOn(d.id, i, 'vertical');
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
		        	self._crossHairsOn(d.target_id, d.ypos, 'both');
		        	self._mouseover(this, d, self, p);})							
		        .on("mouseout", function(d) {
		        	self._crossHairsOff();		  		
		        	self._mouseout(d, $(this));});
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
	
	_calcYCoord: function (d, i) {
		var y = this.state.gridRegion.y;
		var ypad = this.state.gridRegion.ypad;

		return (y+(i*ypad));
	},

	_mouseover: function (self, d, parent, p) {
		var data;
		if (d.type === 'cell') {  
       		data = parent.state.dataManager.getCellDetail(d.source_id, d.target_id, d.targetGroup);

			// hightlight row/col labels
		  	d3.select("#pg_grid_row_" + d.ypos +" text")
				  .classed("pg_active", true);
	  		d3.select("#pg_grid_col_" + d.xpos +" text")
				  .classed("pg_active", true);
			
			// hightlight the cell
	 		d3.select("#pg_cell_" + d.ypos +"_" + d.xpos)
				  .classed("pg_rowcolmatch", true);					  

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
		//stickytooltip.show(position); // to delete
        
        // show tooltip
		this._showTooltip($('#stickyInner'), position);
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
				.classed("pg_rowcolmatch", false);					  				  

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


    // Being called only for the first time the widget is being loaded
	_createDisplay: function() {
        // This removes the loading spinner, otherwise the spinner will be always there - Joe
        this.element.empty();
        this._createPhenogridContainer();
        
        // No need to recreate this tooltip on _updateDisplay() - Joe
        this._addStickyTooltipAreaStub();
        
        if (this.state.dataManager.isInitialized()) {
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

	// add a sticky tooltip div stub, this is used to dynamically set a tooltip info 
	_addStickyTooltipAreaStub: function() {
		var sticky = $("<div>")
						.attr("id", "mystickytooltip")
						.attr("style", "padding: 1px");

		var stickyInner =  $("<div>")
						.attr("id", "stickyInner");

		sticky.append(stickyInner);

		// Append to #pg_container
        $('#pg_container').append(sticky);
        
        var self = this;
		sticky.mouseleave("mouseout", function() {
            self._hideTooltip(sticky);
		});
	},
    
    // tooltip is a jquery element
    _showTooltip: function(tooltip, position) {	
		tooltip.css({left: position.left, top: position.top});
        tooltip.show();
        this.state.tooltipIsDocked = true;
	},

    // tooltip is a jquery element
	_hideTooltip: function(tooltip) {
        if ( ! this.state.tooltipIsDocked){
			tooltip.stop(false, true).hide();
			this.state.tooltipIsDocked = false;
		}
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
			.attr("xlink:href", images.logo)
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
			//var grps = self.state.selectedCompareTargetGroup.forEach(function(d) { if(d.crossComparisonView)return d; });
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
		//stickytooltip.init("*[data-tooltip]", "mystickytooltip"); // to delete
	},

	_clearGrid: function() {
		this.state.svg.selectAll("g.row").remove();
		this.state.svg.selectAll("g.column").remove();
		this.state.svg.selectAll("g.pg_score_text").remove();
	},

	_createOverviewTargetGroupLabels: function () {
		if (this.state.owlSimFunction !== 'compare' && this.state.owlSimFunction !== 'exomiser'){
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
                var self = this;
                
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
		var pg_unmatched_list = '<div id="pg_unmatched_list"><span class="pg_unmatched_list_arrow_border"></span><span class="pg_unmatched_list_arrow"></span><div id="pg_unmatched_list_data"></div></div>';
		
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
        var btn = '<div class="pg_hr"></div><div id="pg_export">Save as SVG...</div>';
        
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

    // Used for genotype expansion - Joe
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
			this._updateDisplay();

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

	// Used for genotype expansion - Joe
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
			this._updateDisplay();
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

	_getTargetGroupTaxon: function(name) {
		for (var i in this.state.targetGroupList) {
			if (this.state.targetGroupList[i].name == name) {
				return this.state.targetGroupList[i].taxon;
			}
		}
		return "";
	},

	
	// create a shortcut index for quick access to target targetGroup by name - to get index (position) and taxon
	_createTargetGroupList: function(targetSpecies) {
	
		if (typeof(targetSpecies) !== 'undefined' && targetSpecies != 'all') {   // for All option, see the Analyze page
			// load just the one selected target targetGroup 
			for (var idx in this.state.targetGroupList) {
				// for active targetGroup pre-load them
				if (this.state.targetGroupList[idx].taxon == targetSpecies) {
					this.state.initialTargetGroupLoadList.push(this.state.targetGroupList[idx]);	
					this.state.selectedCompareTargetGroup.push(this.state.targetGroupList[idx]);	
				}	
			}

		} else {
			// load the default selected target targetGroup list based on the active flag
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

