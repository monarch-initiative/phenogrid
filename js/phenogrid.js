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
 *         targetSpeciesName: "Mus musculus"
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
		// core commit. Not changeable by options. 
		// merged into this.state - Joe
		// only used twice, one of them is for config.h, which according to the comments, h should be elimiated - Joe
		// so we can just use one variable for all configs to contain everything in congig and internalOptions - Joe		
	config: {		
		imagePath: 'image/',
		htmlPath: 'js/res/',		
		colorDomains: [0, 0.2, 0.4, 0.6, 0.8, 1],
		colorRanges: [ // each color sets the stop color based on the stop points in colorDomains - Joe
				'rgb(237,248,177)',
				'rgb(199,233,180)',
				'rgb(127,205,187)',
				'rgb(65,182,196)', 
				'rgb(29,145,192)',
				'rgb(34,94,168)'
			], // stop colors for corresponding stop points - Joe
		emptySvgY: 200,
		overviewCount: 3,
		colStartingPos: 10,
		detailRectWidth: 300,
		detailRectHeight: 140,
		detailRectStrokeWidth: 1,
		globalViewSize : 110,
		reducedGlobalViewSize: 50,
		minHeight: 310,
		h : 578,	// [vaa12] this number could/should be eliminated.  updateAxis sets it dynamically as it should be
		m :[ 30, 10, 10, 10 ],
		phenotypeSort: ["Alphabetic", "Frequency and Rarity", "Frequency" ],
		similarityCalculation: [{label: "Similarity", calc: 0, high: "Max", low: "Min"}, 
			{label: "Ratio (q)", calc: 1, high: "More Similar", low: "Less Similar"}, 
			{label: "Ratio (t)", calc: 3, high: "More Similar", low: "Less Similar"} , 
			{label: "Uniqueness", calc: 2, high: "Highest", low: "Lowest"}],
		smallestModelWidth: 400,
		textLength: 34,
		textWidth: 200,
		w : 720,
		headerAreaHeight: 160,
		comparisonTypes: [ { organism: "Homo sapiens", comparison: "diseases"}],
		defaultComparisonType: { comparison: "genes"},
		speciesLabels: [ { abbrev: "HP", label: "Human"},
			{ abbrev: "MP", label: "Mouse"},
			{ abbrev: "ZFIN", label: "Zebrafish"},
			{ abbrev: "ZP", label: "Zebrafish"},
			{ abbrev: "FB", label: "Fly"},
			{ abbrev: "GO", label: "Gene Ontology"},
			{ abbrev: "UDPICS", label: "UDP Patients"}],
		labelCharDisplayCount : 20,
		apiEntityMap: [ {prefix: "HP", apifragment: "disease"},
			{prefix: "OMIM", apifragment: "disease"}, 
			{prefix: "MGI", apifragment: "gene"}],
		defaultApiEntity: "gene",
		tooltips: {},
		widthOfSingleCell: 18,
		heightOfSingleCell: 13,    
		yoffsetOver: 30,
		overviewGridTitleXOffset: 340,
		overviewGridTitleFaqOffset: 230,
		nonOverviewGridTitleXOffset: 220,
		nonOverviewGridTitleFaqOffset: 570,
		gridTitleYOffset: 20,
		xOffsetOver: 20,
		baseYOffset: 150,
		faqImgSize: 15,
		invertAxis: false,
		dummyModelName: "dummy",
		simServerURL: "",  // URL of the server for similarity searches
		preloadHPO: false,	// Boolean value that allows for preloading of all HPO data at start.  If false, the user will have to manually select what HPO relations to load via hoverbox.
		selectedCompareSpecies: [],
		titleOffsets: [{"main": {x:280, y:15}, "disease": {x:0, y:100}}],
		gridRegion: [{x:254, y:200, // origin coordinates for grid region (matrix)
						ypad:13, xpad:15, // x/y padding between the labels and grid
						cellwd:10, cellht:10, // // cell width and height
						rowLabelOffset:-25, // offset of the row label (left side)
						colLabelOffset: 18,  // offset of column label (adjusted for text score) from the top of grid squares
						scoreOffset:5,  // score text offset from the top of grid squares
						speciesLabelOffset: -200    // -100offset of the species label, above grid
					}],
		defaultTargetDisplayLimit: 30, //  defines the limit of the number of targets to display
		defaultSourceDisplayLimit: 30, //  defines the limit of the number of sources to display
		defaultVisibleModelCt: 10,    // the number of visible targets per organisms to be displayed in overview mode
		gradientRegion: [{x:812, y:380,
						  width:180,
						  height:10
						}]
	},

	internalOptions: {
		/// good - legit options
		serverURL: "http://beta.monarchinitiative.org",
		simServerURL: "",  // URL of the server for similarity searches
		simSearchQuery: "/simsearch/phenotype",   //"/simsearch/phenotype?input_items=",
		selectedCalculation: 0,
		ontologyDepth: 10,	// Numerical value that determines how far to go up the tree in relations.
		ontologyDirection: "OUTGOING",	// String that determines what direction to go in relations.  Default is "out".
		ontologyTreeAmounts: 1,	// Allows you to decide how many HPO Trees to render.  Once a tree hits the high-level parent, it will count it as a complete tree.  Additional branchs or seperate trees count as seperate items
							// [vaa12] DO NOT CHANGE UNTIL THE DISPLAY HPOTREE FUNCTIONS HAVE BEEN CHANGED. WILL WORK ON SEPERATE TREES, BUT BRANCHES MAY BE INACCURATE
		selectedSort: "Frequency",
		defaulTargetSpeciesName: "Overview",  // MKD: not sure this works setting it here, need to look into this
		refSpecies: "Homo sapiens",
		genotypeExpandLimit: 5, // sets the limit for the number of genotype expanded on grid
		// targetSpeciesList : [{ name: "Homo sapiens", taxon: "9606", crossComparisonView: true},
		// 	{ name: "Mus musculus", taxon: "10090", crossComparisonView: true },
		// 	{ name: "Danio rerio", taxon: "7955", crossComparisonView: false},
		// 	{ name: "Drosophila melanogaster", taxon: "7227", crossComparisonView: false},
		// 	{ name: "UDPICS", taxon: "UDPICS", crossComparisonView: false}],
		// COMPARE CALL HACK - REFACTOR OUT
	    providedData: {},   
	    axisFlipConfig: {
		colorSelector: { true: "source_id", false: "target_id"}   //{ true: "yID", false: "xID"}
	    }
	},

	// NOTE: I'm not too sure what the default init() method signature should be given an imageDiv and phenotype_data list
	/*
	 * imageDiv - the place you want the widget to appear
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
		// will this work?
		this.configoptions = undefined;

		// set the current target species to the default
		//this.state.currentTargetSpeciesName = this.state.defaulTargetSpeciesName;

		this._createTargetSpeciesIndices();
		// index species
		this._reset();

		console.log("in create func...");
	},

	
	//init is now reduced down completely to loading
	_init: function() {

		console.log("init...");
		this.element.empty();

		// show loading spinner - Joe
		this._showLoadingSpinner();		

		var querySourceList = this._parseQuerySourceList(this.state.phenotypeData);

		this.state.selectedCompareSpecies = [];

		// load the default selected target species list based on the crossComparisonView flag
		for(var idx in this.state.targetSpeciesList) {
			if (this.state.targetSpeciesList[idx].crossComparisonView && this.state.targetSpeciesList[idx].active) {
				this.state.selectedCompareSpecies.push(this.state.targetSpeciesList[idx]);	
			}			
		}
		var self = this;
		var postAsyncCallback = function() {
					self._postDataInitCB(self); };

		// initialize data processing class, 
		this.state.dataLoader = new DataLoader(this.state.simServerURL, this.state.serverURL, this.state.simSearchQuery, 
						 this.state.apiEntityMap);

		// starting loading the data
		this.state.dataLoader.load(querySourceList, this.state.selectedCompareSpecies, postAsyncCallback);  //optional parm:   this.limit);
	

	},

	_postDataInitCB: function (self) {

		// set a max IC score
		self.state.maxICScore = self.state.dataLoader.getMaxICScore();

		self.state.dataManager = new DataManager(self.state.dataLoader);

		//if (preloadHPO) {
		// MKD: preload just one source id, to initialize the ontologyCache
		self.state.ontologyCache = {};

		//var srcs = self.state.dataManager.keys("source");
		//self.state.ontologyCache = self.state.dataLoader.getOntology(srcs[0], self.state.ontologyDirection, self.state.ontologyDepth);
		//}
		
	    // initialize axis groups
	    self._createAxisRenderingGroups();

		self._initDefaults();   
		self._processDisplay();

	},

	// _parseSpeciesList: function(species) {
	// 	var self = this;
	// 	var s = [];
	// 	var temp = species.split(";");
	// 	for(var t in temp) {
	// 		var tax = self._getTargetSpeciesTaxonByName(self, temp[t]);
	// 		var el = {name: temp[t], taxon: tax};
	// 		s.push(el);
	// 	}
	// 	return s;
	// }, 

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

		// shorthand for top of model region
		this.state.yModelRegion = this.state.yoffsetOver + this.state.yoffset;

		this._createColorScale();  
	},


    /* create the groups to contain the rendering 
       information for x and y axes. Use already loaded data
       in various hashes, etc. to create objects containing
       information for axis rendering. Then, switch source and target
       groups to be x or y depending on "flip axis" choice*/
    _createAxisRenderingGroups: function() {
    	var targetList = [];

		// set default display limits based on displaying defaultSourceDisplayLimit
    	this.state.sourceDisplayLimit = this.state.dataManager.length("source");

		if (this.state.sourceDisplayLimit > this.state.defaultSourceDisplayLimit) {
			this.state.sourceDisplayLimit = this.state.defaultSourceDisplayLimit;  // adjust the display limit within default limit
		}
	
       	// creates AxisGroup with full source and target lists with default rendering range
    	this.state.sourceAxis = new AxisGroup(0, this.state.sourceDisplayLimit,
					  this.state.dataManager.getData("source"));
		// sort source with default sorting type
		this.state.sourceAxis.sort(this.state.selectedSort); 

		// there is no longer a flag for 'Overview' mode, if the selected selectedCompareSpecies > 1 then it's Comparision mode 
		if (this.state.selectedCompareSpecies.length > 1) {  
			//this.state.targetDisplayLimit = (this.state.defaultTargetDisplayLimit / this.state.selectedCompareSpecies.length)*this.state.selectedCompareSpecies.length;
			this.state.targetDisplayLimit = this.state.defaultTargetDisplayLimit;

			// calculate how many target values we can show using the number of selectedCompareSpecies
			this.state.defaultVisibleModelCt = (this.state.defaultTargetDisplayLimit / this.state.selectedCompareSpecies.length);
			targetList = this.state.dataManager.createCombinedTargetList(this.state.selectedCompareSpecies, this.state.defaultVisibleModelCt);						
		} else if (this.state.selectedCompareSpecies.length === 1) {

			var singleSpeciesName = this.state.selectedCompareSpecies[0].name;

			targetList = this.state.dataManager.getData("target", singleSpeciesName);

			this.state.targetDisplayLimit = this.state.dataManager.length("target", singleSpeciesName);

			if ( this.state.targetDisplayLimit > this.state.defaultTargetDisplayLimit) {
				this.state.targetDisplayLimit = this.state.defaultTargetDisplayLimit;
			} 

		}
    	this.state.targetAxis =  new AxisGroup(0, this.state.targetDisplayLimit, targetList);

    	this._setAxisRenderers();
	},

    _setAxisRenderers: function() {
		var self= this;

	   	if (self.state.invertAxis) {
	       self.state.xAxisRender = self.state.sourceAxis;
	       self.state.yAxisRender = self.state.targetAxis;
	   	} else {
	       self.state.xAxisRender = self.state.targetAxis;
	       self.state.yAxisRender = self.state.sourceAxis;
	   	}

	   console.log("xaxis start:" + self.state.xAxisRender.getRenderStartPos() + " end: " +  self.state.xAxisRender.getRenderEndPos());
	   console.log("yaxis start:" + self.state.yAxisRender.getRenderStartPos() + " end: " +  self.state.yAxisRender.getRenderEndPos());
    },

    _resetDisplayLimits: function() {

    	this.state.sourceDisplayLimit = this.state.yAxisRender.displayLength();  //  this.state.defaultSourceDisplayLimit; 
		this.state.targetDisplayLimit = this.state.xAxisRender.displayLength();   //this.state.defaultTargetDisplayLimit;
    },

	// Loading spinner image from font awesome - Joe
	_showLoadingSpinner: function() {
		var element =$('<div>Loading Phenogrid Widget...<i class="fa fa-spinner fa-pulse"></i></div>');
		this._createSvgContainer();
		element.appendTo(this.state.svgContainer);
	},
	
	_reDraw: function() {
		//var self = this;
		if (this.state.dataManager.isInitialized()) {

			this._initCanvas();
			this._addLogoImage();
			//var rectHeight = this._createRectangularContainers();

			this._buildAxisPositionList();  // MKD: THIS NEEDS REFACTORED
			// this._createXLines();
			// this._createYLines();
			this._addPhenogridControls();

			if (this.state.owlSimFunction != 'compare' && this.state.owlSimFunction != 'exomiser'){
			 	this._createOverviewSpeciesLabels();
			}
			this._createGrid();
			this._createOverviewSection();
			this._addGradients();
			this._createSpeciesDividerLines();

			// this must be initialized here after the _createModelLabels, or the mouse events don't get
			// initialized properly and tooltips won't work with the mouseover defined in _convertLableHTML
			stickytooltip.init("*[data-tooltip]", "mystickytooltip");	

			var self = this;
			// Slide control panel - Joe
			$("#pg_controls_options").hide();
			$("#pg_slide_btn").on("click", function() {
				// Opens and closes the phenogrid controls
				$("#pg_controls_options").fadeIn();
				// $(this) refers to $("#pg_slide_btn")
				$(this).toggleClass("pg_slide_open");

				if ($(this).hasClass("pg_slide_open")) {
					// If the menu is open, then Change the menu button icon
					$("#pg_slide_btn > img").attr('src', self.state.imagePath + 'close_left.png');
				} else {
					// If the menu is closed, change to the original button icon
					$("#pg_slide_btn > img").attr('src', self.state.imagePath + 'menu_icon.png');
					$("#pg_controls_options").fadeOut();
				}
			});


		} else {
			var msg = "There are no results available.";
				this._createSvgContainer();
				this._createEmptyVisualization(msg);
		}

	},

	// create the grid
	_createGrid: function() {
		var self = this;
		var xvalues = self.state.xAxisRender.entries();   //keys();
		var yvalues = self.state.yAxisRender.entries();
		var gridRegion = self.state.gridRegion[0]; 
		var xScale = self.state.xAxisRender.getScale();
		var yScale = self.state.yAxisRender.getScale();
		var gridHeight = self._gridHeight();
		var gridWidth = self._gridWidth();		
		var domainVal = function(p) { 
				if (typeof(p) == 'undefined') {
					p = xvalues.length-1;
				}
				return xvalues[p].id;}

		// use the x/y renders to generate the matrix
	    var matrix = self.state.dataManager.getMatrix(xvalues, yvalues, false);

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
			.attr("data-tooltip", "sticky1")   				      
		      .text(function(d, i) { 
	      		var el = self.state.yAxisRender.itemAt(i);
	      		return Utils.getShortLabel(el.label); })
			.on("mouseover", function(d, i) { 
				var data = self.state.yAxisRender.itemAt(i); // d is really an array of data points, not individual data pt
				self._cellover(this, data, self);})
			.on("mouseout", function(d) {self._cellout(d);});

	    // create columns using the xvalues (targets)
	  	var column = this.state.svg.selectAll(".column")
	      .data(xvalues)
	    .enter().append("g")
	      	.attr("class", "column")	  		    
			.attr("id", function(d, i) { 
				return "pg_grid_col_"+i;})	      	
	      .attr("transform", function(d) { 
	      	var offset = gridRegion.colLabelOffset;
	      	var xs = xScale(d.id);
//	      	if (self.state.invertAxis) {offset = colLabelOffset;}  // if it's flipped then make minor adjustment to narrow gap due to removal of scores	      	
			return "translate(" + (gridRegion.x + (xs*gridRegion.xpad)) +	      		
	      				 "," + (gridRegion.y-offset) + ")rotate(-45)"; }); //-45

	    // create column labels
	  	column.append("text")
	  		//.style("font-size", "11px")
	      	.attr("x", 0)
	      	.attr("y", xScale.rangeBand()+2)  //2
		    .attr("dy", ".32em")
		    .attr("data-tooltip", "sticky1")   			
	      	.attr("text-anchor", "start")
	      		.text(function(d, i) { 		
	      		//console.log(JSON.stringify(d));      	
	      		return Utils.getShortLabel(d.label,self.state.labelCharDisplayCount); })
		    .on("mouseover", function(d) { self._cellover(this, d, self);})
			.on("mouseout", function(d) {self._cellout(d);});		    
	      	
		// set some lines for cross hairs
  		var focus = this.state.svg.append('g').style('display', 'none');
                
        focus.append('line')
            .attr('id', 'focusLineX')
            .attr('class', 'pg_focusLine');
        focus.append('line')
            .attr('id', 'focusLineY')
            .attr('class', 'pg_focusLine');

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
				//.attr("data-tooltip", "sticky1")   					        
				.on('click', function(d) { 
									self._createHoverBox(d);
									stickytooltip.show(null);})
		        .style("fill", function(d) { 
					var el = self.state.dataManager.getCellDetail(d.source_id, d.target_id, d.targetGroup);
					return self._getColorForModelValue(self, el.value[self.state.selectedCalculation]);
			        })
		        .on("mouseover", function(d) { 
		        	focus.style('display', null);
		        	self._cellover(this, d, self);})
		        .on("mouseout", function(d) {
		        	focus.style('display', 'none');
		        	self._cellout(d);})
		        .on('mousemove', function(d, i) { 
                    var xs = xScale(d.target_id);
                    var x = (gridRegion.x + (xs*gridRegion.xpad)) + 5;  // magic number to make sure it goes through the middle of the cell
                    var y = gridRegion.y + (d.ypos * gridRegion.ypad) + 5; 

                    // position the cross hairs
 					focus.select('#focusLineX')
                         .attr('x1', x).attr('y1', gridRegion.y)  // yScale(domainVal(0)))   //yDomain[0]))
                         .attr('x2', x).attr('y2', gridRegion.y + gridHeight);
 					focus.select('#focusLineY')
                        .attr('x1', gridRegion.x)
                        .attr('y1', y)
                        .attr('x2', gridRegion.x + gridWidth)  // ok
                        .attr('y2', y);
 				 	});                    
		}
	},

	_calcYCoord: function (d, i) {
		var y = this.state.gridRegion[0].y;
		var ypad = this.state.gridRegion[0].ypad;

		return (y+(i*ypad));
	},

	_cellover: function (self, d, parent) {

		var data;
		if (d.type == 'cell') {  
       		data = parent.state.dataManager.getCellDetail(d.source_id, d.target_id, d.targetGroup);

			// hightlight row/col labels
		  	d3.select("#pg_grid_row_" + d.ypos +" text")
				  .classed("active", true);
	  		d3.select("#pg_grid_col_" + d.xpos +" text")
				  .classed("active", true);
			
			// hightlight the cell
	 		d3.select("#pg_cell_" + d.ypos +"_" + d.xpos)
				  .classed("rowcolmatch", true);	

		} else {
			parent._highlightMatching(self, d);
			data = d;    			

			// show tooltip
			parent._createHoverBox(data);
		}
	},

	_cellout: function(d) {
		
		// unhighlight row/col
		d3.selectAll(".row text")
			  .classed("active", false);
		d3.selectAll(".column text")
			  .classed("active", false);
		d3.selectAll(".row text")
			  .classed("relatedActive", false);
		d3.selectAll(".column text")
			  .classed("relatedActive", false);		
		d3.selectAll(".cell")
				  .classed("rowcolmatch", false);

		if (!stickytooltip.isdocked) {
			// hide the tooltip
			stickytooltip.closetooltip();
		}

	},

	_highlightMatching: function(s, data) {
		var hightlightSources = true;
		var currenPos = this._getAxisDataPosition(data.id)

		// did we hover over a grid column
		if (s.parentElement.id.indexOf('grid_col') > -1) {
			hightlightSources = true;
			var matches = this.state.dataManager.getMatrixSourceTargetMatches(currenPos, hightlightSources);

			if (typeof(matches) != 'undefined') {
				for (var k=0; k < matches.length; k++) {
					d3.select("#pg_grid_row_" + matches[k].ypos +" text")
				  	.classed("relatedActive", true);
				}
			}	
	  		d3.select("#pg_grid_col_" + currenPos +" text")
				  .classed("active", true);	
		} else {  // hovered over a row
			hightlightSources = false;
			var matches = this.state.dataManager.getMatrixSourceTargetMatches(currenPos, hightlightSources);

			if (typeof(matches) != 'undefined') {
				for (var k=0; k < matches.length; k++) {
					d3.select("#pg_grid_col_" + matches[k].xpos +" text")
				  	.classed("relatedActive", true);
				}
			}		
			d3.select("#pg_grid_row_" + currenPos +" text")
				  .classed("active", true);
		}				

	},

	_highlightColumn: function() {
		// create the related model rectangles
		var highlight_rect = self.state.svg.append("svg:rect")
				.attr("transform","translate(" + (self.state.textWidth + self.state.xOffsetOver + 34.5) + "," + self.state.yoffsetOver + ")")
				.attr("x", function(d) {
					return (self.state.xScale(data) - 1);
				})
				.attr("y", self.state.yoffset + 3)
				.attr("class", "pg_col_accent")
				.attr("width", 15 * appearanceOverrides.offset)
				.attr("height", (displayCount * self.state.heightOfSingleModel));
	},

	_gridWidth: function() {
		var gridRegion = this.state.gridRegion[0]; 
		var gridWidth = (gridRegion.xpad * this.state.targetDisplayLimit) - (gridRegion.xpad - gridRegion.cellwd);
		return gridWidth;
	},

	_gridHeight: function() {
		var gridRegion = this.state.gridRegion[0]; 
		var height = (gridRegion.ypad * this.state.sourceDisplayLimit) - (gridRegion.ypad - gridRegion.cellht);		
		return height;
	},

	_createTextScores: function () {
		var self = this;
		var gridRegion = self.state.gridRegion[0]; 
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
		    //.attr("dy", ".32em")
		  //   .attr("fill", function(d, i) {
		  //   	var el = axRender.itemAt(i);
				// return self._getColorForCellValue(self, el.score);
		  //   })
	      	.attr("text-anchor", "start")
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
		d3.select("#pg_svg_area").remove();
		//this.state.svgContainer.append("<svg id='svg_area'></svg>");
		//this.state.svg = d3.select("#svg_area");

		//var svgContainer = this.state.svgContainer;
		//svgContainer.append("<svg id='svg_area'></svg>");
		//this.state.svg = d3.select("#svg_area")
		//	.attr("width", this.state.emptySvgX)
		//	.attr("height", this.state.emptySvgY);

		//var error = "<br /><div id='err'><h4>" + msg + "</h4></div><br /><div id='return'><button id='button' type='button'>Return</button></div>";
		//this.element.append(error);
		//if (this.state.currentTargetSpeciesName != "Overview"){
		if (!self._isCrossComparisonView()) {			
			html = "<h4 id='err'>" + msg + "</h4><br /><div id='return'><p><button id='button' type='button'>Return</button></p><br/></div>";
			//this.element.append(html);
			this.state.svgContainer.append(html);
			d3.selectAll("#button")
				.on("click", function(){
					$("#return").remove();
					$("#errmsg").remove();
					d3.select("#pg_svg_area").remove();

					//self._reset();
					//self.state.currentTargetSpeciesName = "Overview";
					self._init();
				});
		}else{
			html = "<h4 id='err'>" + msg + "</h4><br />";
			//this.element.append(html);
			this.state.svgContainer.append(html);
		}
	},


	// For the selection area, see if you can convert the selection to the idx of the x and y then redraw the bigger grid 
	_createOverviewSection: function() {
		var self = this;

		// set the display counts on each axis
	    var yCount = self.state.yAxisRender.displayLength();  //self.state.sourceDisplayLimit;
	    var xCount = self.state.xAxisRender.displayLength();  //self.state.targetDisplayLimit;

	    console.log("yCount: " + yCount + " xCount: " + xCount);

	    // get the rendered starting point on axis
		var startYIdx = self.state.yAxisRender.renderStartPos;    // this.state.currYIdx - yCount;
		var startXIdx = self.state.xAxisRender.renderStartPos;    // this.state.currXIdx - xCount;

		// add-ons for stroke size on view box. Preferably even numbers
		var linePad = 2;
		var viewPadding = linePad * 2 + 2;

		// overview region is offset by xTranslation, yTranslation
		var xTranslation = 42; 
		var yTranslation = 30;

		// these translations from the top-left of the rectangular region give the absolute coordinates
		var overviewX = self.state.axis_pos_list[2] + xTranslation;    //MKD NEEDS REFACTORED TO ELIMINATE AXIS_POS_LIST ARRAY
		var overviewY = self.state.yModelRegion + yTranslation;

		// size of the entire region - it is a square
		var overviewRegionSize = self.state.globalViewSize;
		if (this.state.yAxisRender.groupLength() < yCount) {  
			overviewRegionSize = self.state.reducedGlobalViewSize;
		}

		// make it a bit bigger to ccont for widths
		var overviewBoxDim = overviewRegionSize + viewPadding;

		// create the main box and the instruction labels.
		self._initializeOverviewRegion(overviewBoxDim,overviewX,overviewY);

		// create the scales
		self._createSmallScales(overviewRegionSize);

		// add the items using smaller rects
		//var cellData = self._mergeHashEntries(self.state.cellDataHash);
		//var data = self.state.filteredCellData;

		// this should be the full set of cellData
		var xvalues = self.state.xAxisRender.groupEntries();
		//console.log(JSON.stringify(xvalues));
		var yvalues = self.state.yAxisRender.groupEntries();		
		var data = this.state.dataManager.getMatrix(xvalues, yvalues, true);

		var cell_rects = this.state.svg.selectAll(".mini_cells")
			.data(data, function(d) {return d.source_id + d.target_id;});   //D.Yid + D.xID;});
		overviewX++;	// Corrects the gapping on the sides
		overviewY++;
		var cellRectTransform = "translate(" + overviewX +	"," + overviewY + ")";

	    var colorSelector = this.state.axisFlipConfig.colorSelector[this.state.invertAxis];

		cell_rects.enter()
			.append("rect")
			.attr("transform",cellRectTransform)
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
			.attr("width", linePad)
			.attr("height", linePad)
			.attr("fill", function(d) {
				var el = self.state.dataManager.getCellDetail(d.source_id, d.target_id, d.targetGroup);
				return self._getColorForModelValue(self, el.value[self.state.selectedCalculation]);			 
			});

		var yRenderedSize = this.state.yAxisRender.displayLength();
		var xRenderedSize = this.state.xAxisRender.displayLength();		
     	var lastYId = this.state.yAxisRender.itemAt(yRenderedSize - 1).id; 
	    var lastXId = this.state.xAxisRender.itemAt(xRenderedSize - 1).id; 
   	    var startYId = this.state.yAxisRender.itemAt(startYIdx).id;   
	    var startXId = this.state.xAxisRender.itemAt(startXIdx).id;

		var selectRectX = self.state.smallXScale(startXId);
		var selectRectY = self.state.smallYScale(startYId);
		var selectRectHeight = self.state.smallYScale(lastYId);
		var selectRectWidth = self.state.smallXScale(lastXId);
		console.log("yRenderedSize:" + yRenderedSize +" xRenderedSize" +xRenderedSize +
				 " selectRectX: " + selectRectX +  " selectRectY:" + selectRectY + 
			" selectRectHeight:" + selectRectHeight + " selectRectWidth:" + selectRectWidth);

		self.state.highlightRect = self.state.svg.append("rect")
			.attr("x",overviewX + selectRectX)
			.attr("y",overviewY + selectRectY)
			.attr("id", "pg_selectionrect")
			.attr("height", selectRectHeight + 4)
			.attr("width", selectRectWidth + 4)
			.attr("class", "draggable")
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

					console.log("curX:" + curX + " curY:"+ curY);

					var rect = self.state.svg.select("#pg_selectionrect");
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

					console.log("newXPos:" + newXPos + " newYPos:"+newYPos);

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

	_createModelScoresLegend: function() {
	// Make sure the legend is only created once - Joe
			if (this.state.svg.select(".pg_tip")[0][0] === null) {
				var self = this;
				var scoreTipY = self.state.yoffset;
				var faqY = scoreTipY - self.state.gridTitleYOffset;
				var tipTextLength = 92;
				var explYOffset = 15;
				var explXOffset = 10;
				
				var scoretip = self.state.svg.append("text")
					.attr("transform", "translate(" + (self.state.axis_pos_list[2] ) + "," + scoreTipY + ")")
					.attr("x", 0)
					.attr("y", 0)
					.attr("class", "pg_tip")
					.text("<- Model Scores"); // changed "<" to "<-" to make it look more like an arrow pointer - Joe

				var tip	= self.state.svg
					.append("text")
					.attr('font-family', 'FontAwesome')
					.text(function(d) { 
						return '\uF05A\n'; // Need to convert HTML/CSS unicode to javascript unicode - Joe
					})
					.attr("id", "modelscores")
					.attr("x", self.state.axis_pos_list[2] + tipTextLength)
					.attr("y", faqY + 20) // 20 padding - Joe
					.style('cursor', 'pointer')
					.on("click", function(d) {
						var name = "modelscores";
						self._showDialog(name);
					});

				var expl = self.state.svg.append("text")
					.attr("x", self.state.axis_pos_list[2] + explXOffset)
					.attr("y", scoreTipY + explYOffset)
					.attr("class", "pg_tip")
					.text("Best matches high to low"); // uppercased best - > Best - Joe
			}
	},

	_createDiseaseTitleBox: function() {
		var self = this;
		// var dTitleYOffset = self.state.yoffset - self.state.gridTitleYOffset/2;
		// var dTitleXOffset = self.state.colStartingPos;

		var x = self.state.titleOffsets[0]["disease"].x,
			y = self.state.titleOffsets[0]["disease"].y;

		var title = document.getElementsByTagName("title")[0].innerHTML;
		var dtitle = title.replace("Monarch Disease:", "");

		// place it at yoffset - the top of the rectangles with the phenotypes
		var disease = dtitle.replace(/ *\([^)]*\) */g,"");
		var shortDis = Utils.getShortLabel(disease,60);	// [vaa12] magic number needs removed

	// Use until SVG2. Word Wraps the Disease Title
		this.state.svg.append("foreignObject")
			.attr("width", 205)
			.attr("height", 50)
			.attr("id","pg_diseasetitle")
			//.attr("transform","translate(" + dTitleXOffset + "," + dTitleYOffset + ")")
			.attr("x", x)
			.attr("y", y)
			.append("xhtml:div")
			.html(shortDis);

	},

	_initializeOverviewRegion: function(overviewBoxDim,overviewX,overviewY) {
		var self = this;
		// rectangular border for overview
		var globalview = self.state.svg.append("rect")
			.attr("x", overviewX)
			.attr("y", overviewY)
			.attr("id", "pg_globalview")
			.attr("height", overviewBoxDim)
			.attr("width", overviewBoxDim);

		var overviewInstructionHeightOffset = 50;
		var lineHeight = 12;

		var y = self.state.yModelRegion + overviewBoxDim + overviewInstructionHeightOffset;
		var rect_instructions = self.state.svg.append("text")
			.attr("x", self.state.axis_pos_list[2] + 10)
			// This changes for vertical positioning
			.attr("y", y)
			.attr("class", "pg_instruct")
			.text("Use the phenotype map above to");

		rect_instructions = self.state.svg.append("text")
			.attr("x", self.state.axis_pos_list[2] + lineHeight)
			// This changes for vertical positioning
			.attr("y", y + 10) 
			.attr("class", "pg_instruct")
			.text("navigate the model view on the left");
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
			.rangePoints([0,overviewRegionSize]);

		self.state.smallXScale = d3.scale.ordinal()
			.domain(targetList.map(function (d) {
				var td = d;
				return d; }))
			.rangePoints([0,overviewRegionSize]);   	    
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

	// _setComparisonType: function(){
	// 	var comp = this.state.defaultComparisonType;
	// 	for (var i in this.state.comparisonTypes) {
	// 		if ( ! this.state.comparisonTypes.hasOwnProperty(i)) {
	// 				break;
	// 			}
	// 		if (this.state.currentTargetSpeciesName === this.state.comparisonTypes[i].organism) {
	// 			comp = this.state.comparisonTypes[i];
	// 		}
	// 	}
	// 	this.state.comparisonType = comp;
	// },

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

	// Previously processSelected
	_processDisplay: function(){
//		this.state.unmatchedSources = this._getUnmatchedSources();
		this.element.empty();
		this._reDraw();
	},

    /*
	 * Make sure there are limit items in res --
	 * If we don't have enough, add some dummy items in. 
	 * This will space things out appropriately, having dummy models take 
	 * up some of the x axis space. Later, we will make sure not to show the labels for these dummies.
	 */
	// _padSpeciesData: function(res,species,limit) {
	// 	var toadd = limit - res.b.length;
	// 	for (var i = 0; i < toadd; i++) {
	// 		var dummyId = "dummy" + species + i;
	// 		var newItem = { id: dummyId,
	// 			label: this.state.dummyModelName,
	// 			score: {score: 0, rank: Number.MAX_VALUE},
	// 		};
	// 		res.b.push(newItem);
	// 	}
	// 	return res;
	// },

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
		//var info = this.state.dataManager.getElement("target", key, this.state.currentTargetSpeciesName);
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
		this._createSvgContainer();
		var svgContainer = this.state.svgContainer;
		var sourceDisplayCount = this.state.yAxisRender.displayLength();
		var widthOfSingleCell = this.state.gridRegion[0].cellwd;

		svgContainer.append("<svg id='pg_svg_area'></svg>");
		this.state.svg = d3.select("#pg_svg_area")
				.attr("width", "100%")
				.attr("height", ((this.state.gridRegion[0].y + (sourceDisplayCount * widthOfSingleCell))+100));

		 this._addGridTitle();
//		 this._createDiseaseTitleBox();
		
	},

	_createSvgContainer: function() {
		var svgContainer = $('<div id="pg_svg_container"></div>');
		this.state.svgContainer = svgContainer;
		this.element.append(svgContainer);
	},

	// NEW - add a sticky tooltip div stub, this is used to dynamically set a tooltip for gene info and expansion
	_addStickyTooltipAreaStub: function() {
		var sticky = $("<div>")
						.attr("id", "mystickytooltip")
						.attr("class", "stickytooltip");
					
		var inner1 = $("<div>")
						.attr("style", "padding:5px");

		var atip =  $("<div>")
						.attr("id", "sticky1")
						.attr("class", "atip");
		
		var img = $("<img>")
				.attr("id", "img-spinner")
				.attr("src", this.state.imagePath + "waiting_ac.gif")
				.attr("alt", "Loading, please wait...");

		var wait = $("<div>")
			.attr("id", "wait")
			//.attr("class", "spinner")
			.attr("style", "display:none")
			.text("Searching for data...");

			wait.append(img);
		var status = $("<div>")
			.attr("class", "stickystatus");

		inner1.append(wait).append(atip);

		sticky.append(inner1);
				//.append(wait);
				//.append(status);

		// always append to body
		sticky.appendTo('body');
			sticky.mouseleave("mouseout",function(e) {
			//console.log("sticky mouse out. of sticky.");
			stickytooltip.closetooltip();
		});
	},
	
	_addGridTitle: function() {
		var species = '';
		var self = this;

		// set up defaults as if overview
		var xoffset = this.state.overviewGridTitleXOffset;
		var foffset = this.state.overviewGridTitleFaqOffset;

		var x = this.state.titleOffsets[0]["main"].x,
			y = this.state.titleOffsets[0]["main"].y;

		var titleText = "Cross-Species Comparison";

		//if (this.state.currentTargetSpeciesName !== "Overview") {
		if (!self._isCrossComparisonView()) {
			species= this.state.currentTargetSpeciesName;
			xoffset = this.state.nonOverviewGridTitleXOffset;
			foffset = this.state.nonOverviewGridTitleFaqOffset;
			var comp = this._getComparisonType(species);
			titleText = "Phenotype Comparison (grouped by " + species + " " + comp + ")";
		}
		// COMPARE CALL HACK - REFACTOR OUT
		if (this.state.owlSimFunction === 'compare' || this.state.owlSimFunction === 'exomiser'){
			titleText = "Phenotype Comparison";
		}

		var mtitle = this.state.svg.append("svg:text")
			.attr("id","pg_toptitle")
			.attr("x",x) 		//xoffset)
			.attr("y", y)		//this.state.gridTitleYOffset)
			.text(titleText);
			
		this.state.svg
				.append("text")
				.attr('font-family', 'FontAwesome')
				.attr("id", "pg_faqs")
				// Position faq icon on title right + 10px padding 
				// jQuery object doesn't have getBoundingClientRect() method, we need to use the array [] notation - Joe
				.attr("x", xoffset + $("#pg_toptitle")[0].getBoundingClientRect().width + 10) 
				.attr("y", y)		// Half logo height  this.state.gridTitleYOffset
				.text(function(d) {
					return "\uf05a"; // Need to convert HTML/CSS unicode to javascript unicode - Joe
				})
				.style('cursor', 'pointer')
				.on("click", function(d) {
					self._showDialog("faq");
				});
	},

	_configureFaqs: function() {
		var self = this;
		var sorts = $("#pg_sorts_faq")
			.on("click", function(d,i){
				self._showDialog( "sorts");
			});

		//var calcs = d3.selectAll("#calcs")
		var calcs = $("#pg_calcs_faq")
			.on("click", function(d){
				self._showDialog( "calcs");
			});
	},

	_resetSelections: function(type) {
		var self = this;

		$("#pg_svg_area").remove();

		if (type === "organism"){
			self._reset("organism");
			self._init();
		} else if (type === "calculation"){
			self._reset("calculation");
		} else if (type === "sortphenotypes"){
			self._reset("sortphenotypes");
		} else if (type === "axisflip"){
			self._reset("axisflip");
		}
	},

	_addLogoImage:	 function() { 
		this.state.svg.append("svg:image")
			.attr("xlink:href", this.state.imagePath + "logo.png")
			.attr("x", 0)
			.attr("y",0)
			.attr("id", "logo")
			.attr("width", "60")
			.attr("height", "90");
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
		$("#sticky1").empty();
		$("#sticky1").html(retData);

		// For phenotype HPO tree 
		if (data.type === 'phenotype') {
			// https://api.jqueryui.com/jquery.widget/#method-_on
			// Binds click event to the HPO tree expand icon - Joe
			// In tooltiprender.js, the font awesome icon <i> element follows the form of id="expandHPO_HP_0001300" - Joe
			var expandOntol_icon = $('#pg_expandOntology_' + id);
			this._on(expandOntol_icon, {
				"click": function(event) {
					this._expandOntology(id);
				}
			});
		}
	},

	// This builds the string to show the relations of the HPO nodes.  It recursively cycles through the edges and in the end returns the full visual structure displayed in the phenotype hover
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
		var indent = "<em class='pg_tree_indent'></em>";

		if (treeHeight === 0) {
			return indent;
		}

		for (var i = 1; i < treeHeight; i++){
			indent += "<em class='pg_tree_indent'></em>";
		}
			 
		return indent + '&#8627'; // HTML entity - Joe
	},

	_getOntologyLabel: function(id) {
		var label = this.state.dataManager.getOntologyLabel(id);
		return label;
	},

	// Based on the ID, it pulls the label from hpoCacheLabels and creates a hyperlink that allows the user to go to the respective phenotype page
	_buildOntologyHyperLink: function(id){
		//var label = this.state.hpoCacheLabels.get(id);
		var label = this._getOntologyLabel(id);
		var link = "<a href=\"" + this.state.serverURL + "/phenotype/" + id + "\" target=\"_blank\">" + label + "</a>";
		return link;
	},

	_createSpeciesDividerLines: function() {
		var self = this;
		var gridRegion = self.state.gridRegion[0];
		var x = gridRegion.x;     
		var y = gridRegion.y;   
		var height = gridRegion.y + self._gridHeight();// - 10;
		var width = self._gridWidth();

		if (self._isCrossComparisonView() ) {
			var numOfSpecies = self.state.selectedCompareSpecies.length;
			var xScale = self.state.xAxisRender.getScale();

			var cellsDisplayedPer = (self.state.defaultTargetDisplayLimit / numOfSpecies);

			var x1 = 0;
			if (self.state.invertAxis) {
				x1 = ((gridRegion.ypad * (cellsDisplayedPer-1)) + gridRegion.cellht);  //-gridRegion.rowLabelOffset; 								
			} else {
				x1 = ((gridRegion.xpad * (cellsDisplayedPer-1)) + gridRegion.cellwd); 
				y = y - gridRegion.colLabelOffset;  // offset the line to reach the labels
			}

			for (var i=1; i < numOfSpecies; i++) {

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
					.attr("y2", x1-2);

				} else {
					// render vertical divider line
					this.state.svg.append("line")				
					.attr("class", "pg_target_grp_divider")
					.attr("transform","translate(" + x + "," + y+ ")")					
					.attr("x1", x1)
					.attr("y1", 0)
					.attr("x2", x1)
					.attr("y2", height);


					// render the slanted line between targetGroup (species) columns
					 this.state.svg.append("line")				
					.attr("class", "pg_target_grp_divider")
					.attr("transform","translate(" + x + "," + y + ")rotate(-48 " + x1 + " 0)")		// -62			
					.attr("x1", x1)
					.attr("y1", 0)
					.attr("x2", x1 + 100)  // extend the line out to underline the labels					
					.attr("y2", 0);

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
		console.log("calc for start x:"+(this.state.currXIdx-this.state.targetDisplayLimit));
		this.state.xAxisRender.setRenderStartPos(this.state.currXIdx-this.state.targetDisplayLimit);
		this.state.xAxisRender.setRenderEndPos(this.state.currXIdx);
		console.log("xaxis end:" + this.state.currXIdx);
	   //  console.log("Xaxis end: " + this.state.xAxisRender.getRenderStartPos() + " end: "+this.state.xAxisRender.getRenderEndPos()
 			// + " limit size: " + this.state.targetDisplayLimit);

		console.log("calc for start y:"+(this.state.currYIdx-this.state.sourceDisplayLimit));
		this.state.yAxisRender.setRenderStartPos(this.state.currYIdx-this.state.sourceDisplayLimit);
		this.state.yAxisRender.setRenderEndPos(this.state.currYIdx);
		console.log("yaxis end:" + this.state.currYIdx);

// console.log("yaxis start: " + this.state.yAxisRender.getRenderStartPos() + " end: "+this.state.yAxisRender.getRenderEndPos()+
// 				" limit size: " + this.state.sourceDisplayLimit);

		this._clearGrid();
		this._createGrid();

		/*
		 * this must be initialized here after the _createGrid, or the mouse events don't get
		 * initialized properly and tooltips won't work with the mouseover 
		 */
		stickytooltip.init("*[data-tooltip]", "mystickytooltip");
	},

	// Previously _clearModelLabels
	_clearXLabels: function() {
		this.state.svg.selectAll("g.x").remove();
		this.state.svg.selectAll("g .tick.major").remove();
	},

	_clearGrid: function() {
		console.log("in clearGrid()....");
		this.state.svg.selectAll("g.row").remove();
		this.state.svg.selectAll("g.column").remove();
		this.state.svg.selectAll("g.pg_score_text").remove();
	},

	// Previously _createModelLines
	_createXLines: function() {
		if (this.state.svg.select("#x_line")[0][0] === null) {

		var modelLineGap = 10;
		var lineY = this.state.yoffset - modelLineGap;
		var len = this.state.xAxisRender.displayLength();
		var width = this.state.gridRegion[0].x + (len * this.state.gridRegion[0].cellwd)-5;
		// this.state.svg.selectAll("path.domain").remove();
		// this.state.svg.selectAll("text.scores").remove();
		// this.state.svg.selectAll("#pg_specieslist").remove();

		this.state.svg.append("line")
			.attr("transform","translate(" + (this.state.textWidth + this.state.xOffsetOver + 30) + "," + lineY + ")")
			.attr("class", "grid_line")			
			.attr("x1", 0)
			.attr("y1", 0)
			.attr("x2", width)
			.attr("y2", 0);
			// .attr("stroke", "#0F473E")
			// .attr("stroke-width", 1);
		}
	},

	_createYLines: function() {
	    var self = this;
		var modelLineGap = 30;
		var lineY = this.state.yoffset + modelLineGap;
	    var displayCount = self.state.yAxisRender.displayLength();
		var height = (displayCount * this.state.gridRegion[0].cellht);	    //this.state.gridRegion[0].y +

		// var gridHeight = displayCount * self.state.heightOfSingleCell + 10;
		// if (gridHeight < self.state.minHeight) {
		// 	gridHeight = self.state.minHeight;
		// }

		this.state.svg.append("line")
			//.attr("transform","translate(" + (this.state.textWidth + 15) + "," + lineY + ")")
			.attr("transform","translate(" + (this.state.gridRegion[0].x - 5) + "," + 
					(this.state.gridRegion[0].y-this.state.gridRegion[0].ypad) + ")")
			.attr("class", "grid_line")
			.attr("x1", 0)
			.attr("y1", 0)
			.attr("x2", 0)
			.attr("y2", height);
			// .attr("stroke", "#0F473E")
			// .attr("stroke-width", 1);
	},


	// Add species labels to top of Overview
	_createOverviewSpeciesLabels: function () {
		var self = this;
		var speciesList = this.state.selectedCompareSpecies.map( function(d) {return d.name;});  //[];
		var len = self.state.xAxisRender.displayLength();
		var width = (self.state.gridRegion[0].xpad*len) + self.state.gridRegion[0].cellwd;
		var height = self._gridHeight();
		var y = self.state.gridRegion[0].rowLabelOffset-90;  // height / 2 ;rowLabelOffset

		// position relative to the grid
		var translation = "translate(" + (self.state.gridRegion[0].x) + "," + (self.state.gridRegion[0].y) +")";

		// if inverted override the translate to rotate 90
		if (self.state.invertAxis && speciesList.length > 1){
				translation = "translate(" + self.state.gridRegion[0].x + "," + (self.state.gridRegion[0].y) + ")rotate(-90)";
				//speciesList = speciesList.reverse();  // need to do this to match order of the species order
				y = self.state.gridRegion[0].speciesLabelOffset;				
		} 

		var xPerModel = width/speciesList.length;  
		var species = self.state.svg.selectAll("#pg_specieslist")
			.data(speciesList)
			.enter()
			.append("text")
			.attr("transform",translation)
			.attr("x", function(d,i){ 
					var x = ((i + 1 / 2 ) * xPerModel) + 5;
					if (self.state.invertAxis && speciesList.length > 1) {
						x = -(x-20);  // this pushes the labels into negative quadrant w/ padding, when flipped
					}
					return x;
				})
			.attr("id", "pg_specieslist")
			.attr("y", y)
			.text(function (d,i){return speciesList[i];})
			.attr("text-anchor","middle");
	},
	
	// we might want to modify this to do a dynamic http retrieval to grab the dialog components...
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

	_populateDialog: function(self,name,text) {
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
					of: "#pg_svg_area"
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


	// Build out the positions of the 3 boxes
	_buildAxisPositionList: function() {
		// For Overview of Organisms 0 width = ((defaultVisibleModelCt*2)+2) *this.state.widthOfSingleCell	
		// Add two extra columns as separators
		this.state.axis_pos_list = [];
		// calculate width of model section
		//this.state.modelWidth = this.state.filteredXAxis.size() * this.state.widthOfSingleCell;
		this.state.modelWidth = this.state.xAxisRender.displayLength() * this.state.widthOfSingleCell;

		// add an axis for each ordinal scale found in the data
		for (var i = 0; i < 3; i++) {
			// move the last accent over a bit for the scrollbar
			if (i === 2) {
				// make sure it's not too narrow i
				var w = this.state.modelWidth;
				if(w < this.state.smallestModelWidth) {
					w = this.state.smallestModelWidth;
				}
				this.state.axis_pos_list.push((this.state.textWidth + 50) + this.state.colStartingPos + w);
			} else if (i === 1 ){
				this.state.axis_pos_list.push((i * (this.state.textWidth + this.state.xOffsetOver + 10)) + this.state.colStartingPos);
			} else {
				this.state.axis_pos_list.push((i * (this.state.textWidth + 10)) + this.state.colStartingPos);
			}
		}	
	},

	_addPhenogridControls: function() {
		var phenogridControls = $('<div id="pg_controls"></div>');
		//this.element.append(phenogridControls); // old
		$('#pg_svg_container').append(phenogridControls); // new, append controls to #pg_svg_container - Joe
		this._createSelectionControls(phenogridControls);
	},
 
	_addGradients: function() {
		this._createGradients();
		this._buildGradientTexts();
	},

	/*
	 * Add the gradients to the grid
	 */
	_createGradients: function(){
		var self = this;

		// baseline gradientRegion values
		var x = self.state.gradientRegion[0].x;
		var y = self.state.gradientRegion[0].y;
		var width = self.state.gradientRegion[0].width;
		var height = self.state.gradientRegion[0].height;

		var gradient = this.state.svg.append("svg:linearGradient") // The <linearGradient> element is used to define a linear gradient. - Joe
			.attr("id", "gradient")
			.attr("x1", "0")
			.attr("x2", "100%")
			.attr("y1", "0%")
			.attr("y2", "0%");

		for (var j in this.state.colorDomains) {
			if ( ! this.state.colorDomains.hasOwnProperty(j)) {
				break;
			}
			
			gradient.append("svg:stop") // SVG stop element
				.attr("offset", this.state.colorDomains[j]) // The offset attribute is used to define where the gradient color begin and end
				.style("stop-color", this.state.colorRanges[j]);
		}

		var legend = this.state.svg.append("rect")
			.attr("transform", "translate(" + x + "," + y +")")
			.attr("class", "legend_rect")
			.attr("id","legendscale")
			.attr("width", width)
			.attr("height", height) 
			.attr("fill", "url(#gradient)"); // The fill attribute links the element to the gradient defined in svg:linearGradient - Joe
	},


	/*
	 * Show the labels next to the gradients, including descriptions of min and max sides 
	 */
	_buildGradientTexts: function() {
		var self = this;
		var lowText, highText, labelText;

		// baseline gradientRegion
		var x = self.state.gradientRegion[0].x;
		var y = self.state.gradientRegion[0].y;


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

		// min label
		var div_text1 = self.state.svg.append("svg:text")
			.attr("transform", "translate(" + x + "," + y +")")		
			.attr("class", "pg_detail_text")
			.style("font-size", "10px")
			.text(lowText);

		// calc the postion of the display type Label
		var xLabelPos = (x + (self.state.gradientRegion[0].width/2) - labelText.length);		
		var div_text2 = self.state.svg.append("svg:text")
			.attr("transform", "translate(" + xLabelPos + "," + y +")")						
			.attr("class", "pg_detail_text")
			.style("font-size", "10px")
			.text(labelText);

		// calc the postion of the High Label
		var xHighPos = (x + self.state.gradientRegion[0].width)-20;
		var div_text3 = self.state.svg.append("svg:text")
			.attr("transform", "translate(" + xHighPos + "," + y +")")				
			.attr("class", "pg_detail_text")
			.style("font-size", "10px")
			.text(highText);
	},

	// build controls for selecting organism and comparison. Install handlers
	_createSelectionControls: function(container) {
		var self = this;
		var optionhtml ='<div id="pg_controls_options"></div>';
		
		// Hide/show panel - button - Joe
		var pushBtn ='<button id="pg_slide_btn">' + 
					'<img src="' + this.state.imagePath + 'menu_icon.png"/>' + 
					'</button>';
		
		
		var options = $(optionhtml);
		var orgSel = this._createOrganismSelection();
		options.append(orgSel);
		var sortSel = this._createSortPhenotypeSelection();
		options.append(sortSel);
		var calcSel = this._createCalculationSelection();
		options.append(calcSel);
		var axisSel = this._createAxisSelection();
		options.append(axisSel);

		container.append(options);
		
		// Append slide button - Joe
		container.append(pushBtn);
		
		// add the handler for the checkboxes control
		$("#pg_organism").change(function(d) {
			console.log('in the change()..');
//			self.state.selectedCompareSpecies = [];
			var items = this.childNodes; // this refers to $("#pg_organism") object - Joe
			var temp = [];
			for (var idx = 0; idx < items.length; idx++) {

				if (items[idx].childNodes[0].checked) {
					var rec = self._getTargetSpeciesInfo(self, items[idx].textContent);
					//self.state.selectedCompareSpecies.push(rec);
					temp.push(rec);
				}
			}
			
			//if (self.state.selectedCompareSpecies.length > 0) {
			if (temp.length > 0) {
				self.state.selectedCompareSpecies = temp;				
			} else {
				alert("You must have at least 1 species selected.");
			}
			// That last checked checkbox will be checked again after rerendering - Joe
			self.state.dataManager.reinitialize(self.state.selectedCompareSpecies, true);
			self._createAxisRenderingGroups();
			self._initDefaults();
			self._processDisplay();
		});

		$("#pg_calculation").change(function(d) {
			self.state.selectedCalculation = parseInt(d.target.value); // d.target.value returns quoted number - Joe
			self._resetSelections("calculation");
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
			self._resetSelections("sortphenotypes");
			self._processDisplay();
		});

		$("#pg_axisflip").click(function(d) {	
			var $this = $(this);
			// $this will contain a reference to the checkbox 
			if ($this.is(':checked')) {
				self.state.invertAxis = true;
			} else {
				self.state.invertAxis = false;
			}

		    self._resetSelections("axisflip");
		    self._setAxisRenderers();
		    self._resetDisplayLimits();
		    self._processDisplay();

		});

		self._configureFaqs();
	},

	_createOrganismSelection: function() {
		var optionhtml = "<div id='pg_org_div'><label class='pg_ctrl_label'>Organism(s)</label>" + 
			"<div id='pg_organism'>";
		for (var idx in this.state.targetSpeciesList) {
			if ( ! this.state.targetSpeciesList.hasOwnProperty(idx)) {
				break;
			}
			var checked = "";
			if (this.state.targetSpeciesList[idx].active) { 
				if (this._isTargetSpeciesSelected(this, this.state.targetSpeciesList[idx].name)) {
					checked = "checked";
				}
				optionhtml += "<div class='pg_select_item'><input type='checkbox' value=\"" + this.state.targetSpeciesList[idx].name +
				"\" " + checked + ">" + this.state.targetSpeciesList[idx].name + '</div>';
			}
		}
		optionhtml += "</div></div>";

		return $(optionhtml);
	},

	// create the html necessary for selecting the calculation
	_createCalculationSelection: function () {
		var optionhtml = "<div class='pg_hr'></div><div id='pg_calc_div'><label class='pg_ctrl_label'>Calculation Method</label>"+
				" <i class='fa fa-info-circle cursor_pointer' id='pg_calcs_faq'></i>" + // <i class='fa fa-info-circle'></i> FontAwesome - Joe
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
		optionhtml += "</div></div>";
		return $(optionhtml);
	},

	// create the html necessary for selecting the sort
	_createSortPhenotypeSelection: function () {
		var optionhtml ="<div class='pg_hr'></div><div id='pg_sort_div'><label class='pg_ctrl_label'>Sort Phenotypes</label>" + 
				" <i class='fa fa-info-circle cursor_pointer' id='pg_sorts_faq'></i>" + // <i class='fa fa-info-circle'></i> FontAwesome - Joe
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
		optionhtml += "</div></div>";
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

	_getUnmatchedSources: function(){
		//var fullset = this.state.origPhenotypeData;
		var fullset = this.state.dataManager.getOriginalSource();
		var partialset = this.state.dataManager.keys("source");
		var full = [];
		var partial = [];
		var unmatchedset = [];
		var tempObject = {"id": 0, "observed": "positive"};

		for (var i in fullset) {
			if (typeof(fullset[i].id) === 'undefined'){
				tempObject.id = fullset[i];
				full.push(tempObject);
			} else {
				full.push(fullset[i]);
			}
		}

		for (var j in partialset){
			partial.push(partialset[j].replace("_", ":"));
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
		for (var l in unmatchedset){
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

	_buildUnmatchedSourceDisplay: function() {
		var optionhtml;
		var prebl = $("#pg_prebl");
		if (prebl.length === 0) {
			var preblHtml ="<div id='pg_prebl'></div>";
			this.element.append(preblHtml);
			prebl = $("#pg_prebl");
		}
		prebl.empty();

		if (this.state.unmatchedSources !== undefined && this.state.unmatchedSources.length > 0){
			optionhtml = "<div class='clearfix'><form id='pg_matches'><input type='checkbox' name='unmatched' value='unmatched' >&nbsp;&nbsp;View Unmatched Phenotypes<br /><form><div id='clear'></div>";
			var phenohtml = this._buildUnmatchedPhenotypeTable();
			optionhtml = optionhtml + "<div id='unmatched' style='display:none;'>" + phenohtml + "</div></div>";
			prebl.append(optionhtml);
		} else { 
			// no unmatched phenotypes
			optionhtml = "<div id='pg_unmatchedlabel'>No Unmatched Phenotypes</div>";
			prebl.append(optionhtml);
		}

	$("#pg_matches[type=checkbox]").click(function() {
			var $this = $(this);
			// $this will contain a reference to the checkbox 
			if ($this.is(':checked')) {
				// the checkbox was checked 
				$("#pg_unmatched").show();
			} else {
				// the checkbox was unchecked
				$("#pg_unmatched").hide();
			}
		});
	},

	_buildUnmatchedPhenotypeTable: function(){
		var self = this;
		var columns = 4;
		var outer1 = "<table id='phentable'>";
		var outer2 = "</table>";
		var inner = "";

		var unmatched = self.state.unmatchedSources;
		var text = "";
		var i = 0;
		var label, id, url_origin;
		while (i < unmatched.length) {
			inner += "<tr>"; 
			text = "";
			for (var j = 0; j < columns; j++){
				id = Utils.getConceptId(unmatched[i++].id);
				if (unmatched[i - 1].label !== undefined){
					label = unmatched[i - 1].label;
				} else {
					label = unmatched[i - 1].id;
				}
				url_origin = self.document[0].location.origin;
				text += "<td><a href='" + url_origin + "/phenotype/" + id + "' target='_blank'>" + label + "</a></td>";
				if (i === unmatched.length) {
					break;
				}
			}
			inner += text + "</tr>";
		}
		return outer1 + inner + outer2;
	},

	_matchedClick: function(checkboxEl) {
		if (checkboxEl.checked) {
			// Do something special
			$("#pg_unmatched").show();
		} else {
			// Do something else
			$("#pg_unmatched").hide();
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

	// Will call the getHPO function to either load the HPO info or to make it visible if it was previously hidden.  Not available if preloading
	_expandOntology: function(id){
		var self = this;

		// check to see if id has been cached
		//var cache = this.state.ontologyCache[fixedId];
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

		$("#sticky1").html(ontologyData);

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

		/*
	 reset state values that must be cleared before reloading data
	*/
	_reset: function(type) {

		// target species name might be provided as a name or as taxon. Make sure that we translate to name
		this.state.currentTargetSpeciesName = this._getTargetSpeciesNameByTaxon(this,this.state.currentTargetSpeciesName);

		this.state.yAxisMax = 0;
		this.state.yoffset = this.state.baseYOffset;
		this.state.h = this.config.h;
	},

	_isTargetSpeciesSelected: function(self, name) {
		for (var i in self.state.selectedCompareSpecies) {
			if (self.state.selectedCompareSpecies[i].name == name) {
				return true;
			}
		}
		return false;
	},

	_getTargetSpeciesInfo: function(self, name) {
		for (var i in self.state.targetSpeciesList) {
			if (self.state.targetSpeciesList[i].name == name) {
				return self.state.targetSpeciesList[i];
			}
		}
	},

	// Several procedures for various aspects of filtering/identifying appropriate entries in the target species list.. 
	_getTargetSpeciesIndexByName: function(self,name) {
		var index = -1;
		if (typeof(self.state.targetSpeciesByName[name]) !== 'undefined') {
			index = self.state.targetSpeciesByName[name].index;
		}
		return index;
	},

	_getTargetSpeciesNameByIndex: function(self,index) {
		var species;
		if (typeof(self.state.targetSpeciesList[index]) !== 'undefined') {
			species = self.state.targetSpeciesList[index].name;
		}
		else {
			species = 'Overview';
		}
		return species;
	},

	_getTargetSpeciesTaxonByName: function(self,name) {
		var taxon;
		// first, find something that matches by name
		if (typeof(self.state.targetSpeciesByName[name]) !== 'undefined') {
			taxon = self.state.targetSpeciesByName[name].taxon;
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
	* make other calls easier to be consitently talking in terms of species name
	*/
	_getTargetSpeciesNameByTaxon: function(self,name) {
		// default - it actually was a species name
		var species = name;
		var found = false;

		/*
		 * check to see if the name exists.
		 * if it is found, then we say "true" and we're good.
		 * if, however, it matches the taxon, take the index in the array.
		 */

		for (var sname in self.state.targetSpeciesByName) {
			if(!self.state.targetSpeciesByName.hasOwnProperty(sname)){break;}
			// we've found a matching name.
			if (name == sname) {
				found = true;
			}

			if (name == self.state.targetSpeciesByName[sname].taxon) {
				found = true;
				species = sname;
				break;
			}
		}
		// if not found, it's overview.
		if (found === false) {
			species = "Overview";
		}
		return species;
	},

	// create a shortcut index for quick access to target species by name - to get index (position) and taxon
	_createTargetSpeciesIndices: function() {
		this.state.targetSpeciesByName = {};
		for (var j in this.state.targetSpeciesList) {
			// list starts as name, taxon pairs
			var name = this.state.targetSpeciesList[j].name;
			var taxon = this.state.targetSpeciesList[j].taxon;
			var entry = {};
			entry.index = j;
			entry.taxon = taxon;
			this.state.targetSpeciesByName[name] = entry;
		}
	},

	_getResourceUrl: function(name,type) {
		return this.state.htmlPath + name + '.' + type;
	},

	_isCrossComparisonView: function() {
		if (this.state.selectedCompareSpecies.length == 1) {
			return false;
		}
		return true;
	}



	}); // end of widget code
});

}());

