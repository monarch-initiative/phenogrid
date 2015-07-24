/*
 *
 *	Phenogrid - the Phenogrid widget.
 * 
 *	implemented as a jQuery UI (jqueryui.com) widget, this can be instantiated on a jquery-enabled web page
 *	with a call of the form 
 *	$("#mydiv).phenogrid({phenotypeData: phenotypeList}).
 *	where #mydiv is the id of the div that will contain the phenogrid widget
 *	and phenotypeList takes one of two forms:
 *
 *	1. a list of hashes of the form 
 *		[ {"id": "HP:12345", "observed" :"positive"}, {"oid: "HP:23451", "observed" : "negative"},]
 *	2. a simple list of ids..
 *		[ "HP:12345", "HP:23451"], etc.
 *
 *	Configuration options useful for setting species displayed, similarity calculations, and 
 *	related parameters can also be passed in this hash. As of September
 *	2014, these options are currently being refactored - further
 *	documentation hopefully coming soon.
 *
 *	The phenogrid widget uses semantic similarity calculations
 *	provided by OWLSim (www.owlsim.org), as provided through APIs from
 *	the Monarch initiative (www.monarchinitiative.org). 
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
 *		"rowid":"HP_0000716_HP_0100851"
 *	},
 *
 *	These results will then be rendered in the phenogrid
 *
 *	NOTE: I probably need a model_url to render additional model info on 
 *	the screen. Alternatively I can load the data 
 *	as a separate call in the init function.
 *
 *	META NOTE (HSH - 8/25/2014): Can we remove this note, or at least clarify?
 */
var url = document.URL;

/* main phenogrid widget */
(function($) {


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
		//scriptpath : $('script[src]').last().attr('src').split('?')[0].split('/').slice(0, -1).join('/')+'/',
		scriptpath : $('script[src*="phenogrid"]').last().attr('src').split('?')[0].split('/').slice(0, -1).join('/')+'/',
		colorDomains: [0, 0.2, 0.4, 0.6, 0.8, 1],
		colorRanges: [['rgb(229,229,229)','rgb(164,214,212)','rgb(68,162,147)','rgb(97,142,153)','rgb(66,139,202)','rgb(25,59,143)'],
			['rgb(252,248,227)','rgb(249,205,184)','rgb(234,118,59)','rgb(221,56,53)','rgb(181,92,85)','rgb(70,19,19)'],
			['rgb(230,209,178)','rgb(210,173,116)','rgb(148,114,60)','rgb(68,162,147)','rgb(31,128,113)','rgb(3,82,70)'],
			['rgb(229,229,229)','rgb(164,214,212)','rgb(68,162,147)','rgb(97,142,153)','rgb(66,139,202)','rgb(25,59,143)'],
			['rgb(0,0,0)','rgb(0,0,0)','rgb(0,0,0)','rgb(0,0,0)','rgb(0,0,0)','rgb(0,0,0)'],  //	temp dummy color
			],
		emptySvgX: 1100,
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
						colLabelOffset: 45,  // offset of column label (adjusted for text score)
						scoreOffset:30,  // score text offset
						speciesLabelOffset: -10    // offset of the species label, above grid
					}],
		defaultTargetDisplayLimit: 30, //  defines the limit of the number of targets to display
		defaultSourceDisplayLimit: 30, //  defines the limit of the number of sources to display
		defaultVisibleModelCt: 10    // the number of visible targets per organisms to be displayed in overview mode
	},

	internalOptions: {
		/// good - legit options
		serverURL: "",
		simServerURL: "",  // URL of the server for similarity searches
		simSearchQuery: "/simsearch/phenotype?input_items=",
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
		if (typeof(this.state.simServerURL) == 'undefined' || this.state.simServerURL ==="") {
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
		this._loadSpinner();

		// target species name might be provided as a name or as taxon. Make sure that we translate to name
		//this.state.currentTargetSpeciesName = this._getTargetSpeciesNameByTaxon(this,this.state.currentTargetSpeciesName);
//		this.state.phenotypeData = this._parseQuerySourceList(this.state.phenotypeData);
		var querySourceList = this._parseQuerySourceList(this.state.phenotypeData);

		this.state.selectedCompareSpecies = [];

		// load the default selected target species list based on the crossComparisonView flag
		for(var idx in this.state.targetSpeciesList) {
			if (this.state.targetSpeciesList[idx].crossComparisonView && this.state.targetSpeciesList[idx].active) {
				this.state.selectedCompareSpecies.push(this.state.targetSpeciesList[idx]);	
			}			
		}

		// initialize data processing classes 
		this.state.dataLoader = new DataLoader(this.state.simServerURL, this.state.simSearchQuery, querySourceList, 
				this.state.selectedCompareSpecies, this.state.apiEntityMap);

		this.state.dataManager = new DataManager(this.state.dataLoader);

		//if (preloadHPO) {
		// MKD: just testing one source id
		var srcs = this.state.dataManager.keys("source");
		this.state.hpoCacheHash = this.state.dataLoader.getOntology(srcs[0], this.state.ontologyDirection, this.state.ontologyDepth)
		//}
		
	    // initialize axis groups
	    this._createAxisRenderingGroups();

		this._initDefaults();   
		this._processDisplay();

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
		if (typeof(this.state.stickyInitialized) == 'undefined') {
			this._addStickyTooltipAreaStub();
			this.state.stickyInitialized = true;
			stickytooltip.init("*[data-tooltip]", "mystickytooltip");
		}
		this.state.tooltipRender = new TooltipRender(this.state.serverURL);   
		
		// MKD: NEEDS REFACTORED init a single instance of Expander
		this.state.expander = new Expander(); 

		if (this.state.owlSimFunction == 'exomiser') {
			this.state.selectedCalculation = 2; // Force the color to Uniqueness
		}

	    this._setSelectedCalculation(this.state.selectedCalculation);
		this._setDefaultSelectedSort(this.state.selectedSort);

		// shorthand for top of model region
		this.state.yModelRegion = this.state.yoffsetOver + this.state.yoffset;

	    
//MKD: move to rendering code??    	
		this._createColorScale();  
	},


    /* create the groups to contain the rendering 
       information for x and y axes. Use already loaded data
       in various hashes, etc. to create objects containing
       information for axis rendering. Then, switch source and target
       groups to be x or y depending on "flip axis" choice*/
    _createAxisRenderingGroups: function() {
    
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
		} else if (this.state.selectedCompareSpecies.length == 1) {

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
    	this.state.sourceDisplayLimit = this.state.defaultSourceDisplayLimit; 
		this.state.targetDisplayLimit = this.state.defaultTargetDisplayLimit;
    },

	_loadSpinner: function() {
		var element =$('<div><h3>Loading...</h3><div class="cube1"></div><div class="cube2"></div></div>');
		this._createSvgContainer();
		element.appendTo(this.state.svgContainer);
	},

	
	_reDraw: function() {
		//var self = this;
		if (this.state.dataManager.isInitialized()) {
			var displayRangeCount = this.state.yAxisRender.displayLength();

			this._initCanvas();
			this._addLogoImage();
			//var rectHeight = this._createRectangularContainers();

//			self._createGridlines();

			this._buildAxisPositionList();  // MKD: THIS NEEDS REFACTORED
			// this._createXLines();
			// this._createYLines();
			this._addPhenogridControls();
			this._createSpeciesBorderOutline();
			if (this.state.owlSimFunction != 'compare' && this.state.owlSimFunction != 'exomiser'){
			 	this._createOverviewSpeciesLabels();
			}
			this._createGrid();
			this._createOverviewSection();

			// this must be initialized here after the _createModelLabels, or the mouse events don't get
			// initialized properly and tooltips won't work with the mouseover defined in _convertLableHTML
			stickytooltip.init("*[data-tooltip]", "mystickytooltip");

			$(document).ready(function() {
				// @see for parameters:  https://github.com/HemantNegi/jquery.sumoselect
				$('.SlectBox').SumoSelect({ triggerChangeCombined: false,
			       						selectAll: true,
			       						selectAlltext: 'Check All',
			       						forceCustomRendering: false	
										});
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
		var invertAxis = self.state.invertAxis;
		var lastRowHighlighted=0;
		var gridWidth = gridRegion.x + (self.state.xAxisRender.displayLength() * gridRegion.cellwd)-5;

		var xScale = self.state.xAxisRender.getScale();
		var yScale = self.state.yAxisRender.getScale();

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
  				return "translate(" + gridRegion.x +"," + (gridRegion.y+yScale(i)*gridRegion.ypad) + ")"; })
  			.each(createrow);

		 // row.append("line")
		 // 	.attr("class", "grid_line")
   //     		.attr("x2", gridWidth);

   		// create row labels
	  	row.append("text")
	  		//.style("font-size", "11px")
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
					var coords = {x: d.xpos, y: d.ypos};
		        	var data = self.state.yAxisRender.itemAt(i);
		        	self._cellover(coords,data, self);
		        	})
			.on("mouseout", self._cellout);		    

	    // create columns using the xvalues (targets)
	  	var column = this.state.svg.selectAll(".column")
	      .data(xvalues)
	    .enter().append("g")
	      	.attr("class", "column")	  		    
			.attr("id", function(d, i) { 
				return "pg_grid_col_"+i;})	      	
	      .attr("transform", function(d, i) { 
	      	var offset = gridRegion.colLabelOffset;
	      	var xs = xScale(d.id);
	      	if (self.state.invertAxis) {offset = 30;}  // if it's flipped then make minor adjustment to narrow gap due to removal of scores
	      	//return "translate(" + (gridRegion.x + self.state.xScale(i)*gridRegion.xpad) +
			return "translate(" + (gridRegion.x + (xs*gridRegion.xpad)) +	      		
	      				 "," + (gridRegion.y-offset) + ")rotate(-60)"; }); //-45

	    // create column labels
	  	column.append("text")
	  		//.style("font-size", "11px")
	      	.attr("x", 0)
	      	.attr("y", xScale.rangeBand()+2)  //2
		    .attr("dy", ".32em")
		    .attr("data-tooltip", "sticky1")   			
	      	.attr("text-anchor", "start")
	      		.text(function(d, i) { 		      	
	      		return Utils.getShortLabel(d.label,self.state.labelCharDisplayCount); })
		    .on("mouseover", function(d, i) { 
		        	//var data = d[i];
		        	var coords = {x: d.xpos, y: d.ypos};
		        	var data = self.state.xAxisRender.itemAt(i);
		        	self._cellover(coords, data, self);
		        	})
			.on("mouseout", self._cellout);		    
	      	

	    // add the scores  
	    self._createTextScores();

		function createrow(row) {
		    var cell = d3.select(this).selectAll(".cell")
		        .data(row)
		      .enter().append("rect")
		        .attr("class", "cell")
		        .attr("x", function(d) { 
		        		return d.xpos * gridRegion.xpad;})
		        .attr("width", gridRegion.cellwd)
		        .attr("height", gridRegion.cellht) 
				.attr("data-tooltip", "sticky1")   					        
				// .attr("rx", "3")
				// .attr("ry", "3")			        
		        .style("fill", function(d) { 
					var el = self.state.dataManager.getCellDetail(d.source_id, d.target_id, d.species);
					return self._getColorForModelValue(self, d.species, el.value[self.state.selectedCalculation]);
			        })
		        .on("mouseover", function(d) { 
		        	var coords = {x: d.xpos, y: d.ypos};
		        	var data = self.state.dataManager.getCellDetail(d.source_id, d.target_id, d.species);
		        	self._cellover(coords, data, self);
		        	//console.log(JSON.stringify(coords));
		        	})
		        .on("mouseout", self._cellout);
		}
	},

	_cellover: function (coords, data, parent) {

		// show tooltip
		parent._createHoverBox(data);

		// hightlight row/col
	  	d3.select("#pg_grid_row_" + coords.y +" text")
			  .classed("active", true);
 		d3.select("#pg_grid_row_" + coords.y +" .cell")
			  .classed("rowcolmatch", true);			  
	  	d3.select("#pg_grid_col_" + coords.x +" text")
			  .classed("active", true);
	},

	_cellout: function() {
		
		// unhighlight row/col
		d3.selectAll(".row text")
			  .classed("active", false);
		d3.selectAll(".column text")
			  .classed("active", false);

		if (!stickytooltip.isdocked) {
			// hide the tooltip
			stickytooltip.closetooltip();
		}

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
		    .attr("fill", function(d, i) {
		    	var el = axRender.itemAt(i);
				return self._getColorForCellValue(self, el.species, el.score);
		    })
	      	.attr("text-anchor", "start")
	      		.text(function(d, i) { 		      	
				var el = axRender.itemAt(i);
	      		return el.score; 
	      	})
	      	;

	    if (self.state.invertAxis) { // score are render vertically
			scores
				.attr("transform", function(d, i) { 
  					return "translate(" + (gridRegion.x-gridRegion.xpad-5) +"," + (gridRegion.y+scale(i)*gridRegion.ypad+10) + ")"; })
	      		.attr("x", gridRegion.rowLabelOffset)
	      		.attr("y",  function(d, i) {return scale.rangeBand(i)/2;});  
	    } else {
	    	scores	      		
	    	.attr("transform", function(d, i) { 
	      			return "translate(" + (gridRegion.x + scale(i)*gridRegion.xpad-1) +
	      				 "," + (gridRegion.y-gridRegion.scoreOffset ) +")"})
	      		.attr("x", 0)
	      		.attr("y", scale.rangeBand()+2);
	    }
	}, 
	_getColorForModelValue: function(self,species,score) {
		// This is for the new "Overview" target option
		var selectedScale = this.state.colorScale[species][self.state.selectedCalculation];
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

		var svgContainer = this.state.svgContainer;
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
			var btn = d3.selectAll("#button")
				.on("click", function(d,i){
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

	// adds light gray gridlines to make it easier to see which row/column selected matches occur
	_createGridlines: function() {
		var self = this;
		var mWidth = self.state.widthOfSingleCell;
		var mHeight = self.state.heightOfSingleCell;
		// create a blank grid to match the size of the phenogrid grid
		var data = [];
   	    var rowCt = self.state.yAxisRender.displayLength();
   	    var colCt = self.state.xAxisRender.displayLength();
	     

		//this.state.xScale = this.state.xAxisRender.getScale();
		var xScale = this.state.xAxisRender.getScale();

		for (var k = 0; k < rowCt; k++){
			for (var l = 0; l < colCt; l++) {
				var r = [];
				r.push(k);
				r.push(l);
				data.push( r );
			}
		}
		self.state.svg.selectAll("rect.bordered")
			.data(data)
			.enter()
			.append("rect")
			.attr("id","pg_gridline")
			.attr("transform","translate(" + ((self.state.gridRegion[0].x)-2) + "," + ((self.state.gridRegion[0].y)-1)+ ")") 	//252, " + (this.state.yModelRegion + 5) + ")")
			.attr("x", 0) //function(d,i) { return d[1] * self.state.gridRegion[0].cellwd;})  //mWidth;})
			.attr("y", function(d,i) { 
							return xScale.rangeBand()*20;})
			//return d[0] * self.state.gridRegion[0].cellht;}) //mHeight;})
			.attr("class", "hour bordered deselected")
			.attr("width", self.state.gridRegion[0].cellwd) //14)
			.attr("height", self.state.gridRegion[0].cellht);  //11.5);
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
		console.log(JSON.stringify(xvalues));
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
				var el = self.state.dataManager.getCellDetail(d.source_id, d.target_id, d.species);
				return self._getColorForModelValue(self, d.species, el.value[self.state.selectedCalculation]);			 
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

					var rect = self.state.svg.select("#pg_selectionrect");
					rect.attr("transform","translate(0,0)");

					// limit the range of the x value
					var newX = curX + d3.event.dx;
					var newY = curY + d3.event.dy;

					// Restrict Movement if no need to move map
					if (selectRectHeight == overviewRegionSize) {
						newY = overviewY;
					}
					if (selectRectWidth == overviewRegionSize) {
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
	_getColorForCellValue: function(self,species,score) {
		// This is for the new "Overview" target option
		var selectedScale = self.state.colorScale[species][self.state.selectedCalculation];
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

	// Determines if an ID belongs to the SOURCE or TARGET
	// MKD: MOVE TIS TO DATAMANAGER;  use type attribute instead of this hard-code
	_getIDType: function(key) {
		if (this.state.dataManager.contains("target",key, this.state.currentTargetSpeciesName)){
			return "target";
		}
		//else if (this.state.phenotypeListHash.containsKey(key)){
		else if (this.state.dataManager.contains("source", key)) {
			return "source";
		}
		else { return false; }
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
		method = this.state.selectedCalculation;

		switch(method){
			case 2: maxScore = this.state.maxICScore;
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

		for (var i in this.state.targetSpeciesList) {
			if ( ! this.state.targetSpeciesList.hasOwnProperty(i)) {
					break;
				}
			var species = this.state.targetSpeciesList[i].name;
			this.state.colorScale[species] = new Array(4);
			for (var j = 0; j <4; j++) {
				maxScore = 100;
				if (j == 2) {
					maxScore = this.state.maxICScore;
				}
				if (typeof(this.state.colorRanges[i][j]) !== 'undefined') {
					this.state.colorScale[species][j] = this._getColorScale(i, maxScore);
				}
			}
		}
	},

	_getColorScale: function(speciesIndex,maxScore) {
		var cs = d3.scale.linear();
		cs.domain([3, maxScore]);
		cs.domain(this.state.colorDomains.map(cs.invert));
		cs.range(this.state.colorRanges[speciesIndex]);
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
		 this._createDiseaseTitleBox();
		
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
				.attr("src", this.state.scriptpath + "../image/waiting_ac.gif")
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
			
		/*
		 * foffset is the offset to place the icon at the right of the grid title.
		 * ideally should do this by dynamically grabbing the width of mtitle,
		 * but that doesn't seem to work.
		 */
		
		var faq	= this.state.svg
				.append("text")
				.attr('font-family', 'FontAwesome')
				.text(function(d) { 
					return '\uF05A\n'; // Need to convert HTML/CSS unicode to javascript unicode - Joe
				})
				 .attr("x", x + (22.4*titleText.length))
				 .attr("y", y)
				.style('cursor', 'pointer')
				.on("click", function(d) {
					self._showDialog("faq");
				});
	},

	_configureFaqs: function() {
		var self = this;
		var sorts = $("#pg_sorts")
			.on("click", function(d,i){
				self._showDialog( "sorts");
			});

		//var calcs = d3.selectAll("#calcs")
		var calcs = $("#pg_calcs")
			.on("click", function(d){
				self._showDialog( "calcs");
			});
	},

	_resetSelections: function(type) {
		var self = this;
		$("#pg_unmatchedlabel").remove();
		$("#pg_unmatchedlabelhide").remove();
		$("#unmatched").remove();
		$("#selects").remove();
		$("#pg_org_div").remove();
		$("#pg_calc_div").remove();
		$("#pg_sort_div").remove();
		$("#mtitle").remove();
		$("#header").remove();
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
			.attr("xlink:href", this.state.scriptpath + "../image/logo.png")
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
			if (key == cellKeys[i].source_id || key == cellKeys[i].target_id){
				matchingKeys.push(cellKeys[i]);
			}
		}
		return matchingKeys;
	},

	_createHoverBox: function(data){
		var appearanceOverrides = {offset: 1, style: "pg_col_accent"}; // may use this structure later, offset is only used now

		var id;

		 if (this.state.invertAxis) {
			id = data.target_id;
		 } else {
			id = data.source_id;
		 }

		// format data for rendering in a tooltip
		var retData = this.state.tooltipRender.html({parent: this, id:id, data: data});   

		// update the stub stickytool div dynamically to display
		$("#sticky1").empty();
		$("#sticky1").html(retData);

		// not really good to do this but, we need to be able to override some appearance attributes		
		return appearanceOverrides;
	},

	// This builds the string to show the relations of the HPO nodes.  It recursively cycles through the edges and in the end returns the full visual structure displayed in the phenotype hover
	buildHPOTree: function(id, edges, level) {
		var results = "";
		var nextResult;
		var nextLevel = level + 1;

		for (var j in edges){
			if ( ! edges.hasOwnProperty(j)) {
				break;
			}
			// Currently only allows subClassOf relations.  When new relations are introducted, it should be simple to implement
			if (edges[j].pred == "subClassOf" && this.state.ontologyTreesDone != this.state.ontologyTreeAmounts){
				if (edges[j].sub == id){
					if (this.state.ontologyTreeHeight < nextLevel){
						this.state.ontologyTreeHeight++;
					}
					nextResult = this.buildHPOTree(edges[j].obj, edges, nextLevel);
					if (nextResult === ""){
						// Bolds the 'top of the line' to see what is the root or closet to the root.  It will hit this point either when it reaches the ontologyDepth or there are no parents
						results += "<br/>" + this._buildIndentMark(this.state.ontologyTreeHeight - nextLevel) + "<strong>" + this._buildHPOHyperLink(edges[j].obj) + "</strong>";
						this.state.ontologyTreesDone++;
					} else {
						results += nextResult + "<br/>" + this._buildIndentMark(this.state.ontologyTreeHeight - nextLevel) + this._buildHPOHyperLink(edges[j].obj);
					}
					
					if (level === 0){
						results += "<br/>" + this._buildIndentMark(this.state.ontologyTreeHeight) + this.state.hpoCacheLabels.get(id) + "<br/>";
						this.state.ontologyTreeHeight = 0;
					}
				}
			}
		}
		return results;
	},

	_buildIndentMark: function (treeHeight){
		var indent = "<em class='HPO_tree_indent'></em>";

		if (treeHeight === 0) {
			return indent;
		}

		for (var i = 1; i < treeHeight; i++){
			indent += "<em class='HPO_tree_indent'></em>";
		}
			 
		return indent + '&#8627'; // HTML entity - Joe
	},

	// Based on the ID, it pulls the label from hpoCacheLabels and creates a hyperlink that allows the user to go to the respective phenotype page
	_buildHPOHyperLink: function(id){
		var label = this.state.hpoCacheLabels.get(id);
		var link = "<a href=\"" + this.state.serverURL + "/phenotype/" + id + "\" target=\"_blank\">" + label + "</a>";
		return link;
	},

	_createSpeciesBorderOutline: function () {
		// create the related model rectangles
		var self = this;
		var list = [];
		var ct, width, height, borderStroke;
		var gridRegion = self.state.gridRegion[0];
		var vwidthAndGap = gridRegion.cellht;     //self.state.heightOfSingleCell;
		var hwidthAndGap = gridRegion.cellwd;     //self.state.widthOfSingleCell;
		var totCt = 0;
		var parCt = 0;
	    var displayCount = self.state.yAxisRender.displayLength();
	    var displayCountX = self.state.xAxisRender.displayLength();


		// Have temporarly until fix for below during Axis Flip
		if (self.state.currentTargetSpeciesName == "Overview"){
			return;  //TEMP ONLY
			if (this.state.invertAxis) {
				list = self.state.selectedCompareSpecies;
				ct = self.state.defaultVisibleModelCt;
				borderStroke = self.state.detailRectStrokeWidth / 2;
				// width = gridRegion.x + hwidthAndGap * displayCountX;
				// height = gridRegion.y + vwidthAndGap * ct + borderStroke;
				width =  (gridRegion.xpad*ct) + hwidthAndGap + borderStroke*2;//(hwidthAndGap * ct) +   * 2;  
				height = (gridRegion.ypad*displayCount)+ vwidthAndGap + borderStroke*2;			
			} else {
				list = self.state.selectedCompareSpecies;
				ct = self.state.defaultVisibleModelCt;
				borderStroke = self.state.detailRectStrokeWidth;
				width =  (gridRegion.xpad*ct) + hwidthAndGap + borderStroke*2;//(hwidthAndGap * ct) +   * 2;  
				height = (gridRegion.ypad*displayCount)+ vwidthAndGap + borderStroke*2;							
			}
		} else {
			list.push(self.state.currentTargetSpeciesName);
			ct = displayCountX;
			borderStroke = self.state.detailRectStrokeWidth;
			width =  (gridRegion.xpad*ct) + hwidthAndGap + borderStroke*2;//(hwidthAndGap * ct) +   * 2;  
			height = (gridRegion.ypad*displayCount)+ vwidthAndGap + borderStroke*2;			
			//height = (vwidthAndGap * displayCount)+(gridRegion.ypad*4);  //+ borderStroke * 2; gridRegion.y + 
		}

		var border_rect = self.state.svg.selectAll(".species_accent")
			.data(list)
			.enter()
			.append("rect")
			.attr("transform","translate(" + (gridRegion.x-5) + "," + (gridRegion.y-5) + ")")	
			.attr("class", "species_accent")
			.attr("width", width)
			.attr("height", height)
			.attr("stroke", "black")
			.attr("stroke-width", borderStroke)
			.attr("fill", "none");

			if (self._isCrossComparisonView() && this.state.invertAxis){
				border_rect.attr("x", 0);
				border_rect.attr("y", function(d,i) { 
					totCt += ct;
					if (i === 0) { return (gridRegion.y + borderStroke); }  //self.state.yoffset
					else {
						parCt = totCt - ct;
						return (borderStroke) + ((vwidthAndGap) * parCt + i);
					}
				});
			} else {
				border_rect.attr("x", function(d,i) { 
					totCt += ct;
					if (i === 0) { return 0; }
					else {
						parCt = totCt - ct;
						return gridRegion.x + hwidthAndGap * parCt;
					}
				});
				//border_rect.attr("y", gridRegion.y + 1);
			}
	},

	_enableRowColumnRects: function(curr_rect){
	    var self = this;
		var cell_rects = self.state.svg.selectAll("rect.cells")
			.filter(function (d) { return d.rowid == curr_rect.__data__.rowid;});
		for (var i in cell_rects[0]){
			if ( ! cell_rects[0].hasOwnProperty(i)) {
				break;
			}
			cell_rects[0][i].parentNode.appendChild(cell_rects[0][i]);
		}
		var data_rects = self.state.svg.selectAll("rect.cells")
			.filter(function (d) { return d.target_id == curr_rect.__data__.target_id;});
		for (var j in data_rects[0]){
			if ( ! data_rects[0].hasOwnProperty(j)) {
				break;
			}
			data_rects[0][j].parentNode.appendChild(data_rects[0][j]);
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
		console.log("curX:"+this.state.currXIdx + " curY:"+this.state.currYIdx);
		this.state.xAxisRender.setRenderStartPos(this.state.currXIdx-this.state.targetDisplayLimit);  //-this.state.targetDisplayLimit
		this.state.xAxisRender.setRenderEndPos(this.state.currXIdx);
console.log("Xaxis start: " + this.state.xAxisRender.getRenderStartPos() + " end: "+this.state.xAxisRender.getRenderEndPos()
			+ " limit size: " + this.state.targetDisplayLimit);

		this.state.yAxisRender.setRenderStartPos(this.state.currYIdx-this.state.sourceDisplayLimit);
		this.state.yAxisRender.setRenderEndPos(this.state.currYIdx);

console.log("yaxis start: " + this.state.yAxisRender.getRenderStartPos() + " end: "+this.state.yAxisRender.getRenderEndPos()+
				" limit size: " + this.state.sourceDisplayLimit);

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
			.attr("y2", 0)
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
			.attr("y2", height)
			// .attr("stroke", "#0F473E")
			// .attr("stroke-width", 1);
	},


	// Add species labels to top of Overview
	_createOverviewSpeciesLabels: function () {
		var self = this;
		var speciesList = this.state.selectedCompareSpecies.map( function(d) {return d.name;});  //[];
		var len = self.state.xAxisRender.displayLength();
		var width = (self.state.gridRegion[0].xpad*len) + self.state.gridRegion[0].cellwd;

		// position relative to the grid
		var translation = "translate(" + (self.state.gridRegion[0].x) + "," + (self.state.gridRegion[0].y) + ")";

		var xPerModel = width/speciesList.length;  //self.state.modelWidth
		var species = self.state.svg.selectAll("#pg_specieslist")
			.data(speciesList)
			.enter()
			.append("text")
			.attr("transform",translation)
			.attr("x", function(d,i){ return (i + 1 / 2 ) * xPerModel;})
			.attr("id", "pg_specieslist")
			.attr("y", self.state.gridRegion[0].speciesLabelOffset)
			.attr("width", xPerModel)
			.attr("height", 5)
			.style("font-size", "11px")
		//	.attr("fill", "#0F473E")
		//	.attr("stroke-width", 1)
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

	/*
	 * Build the three main left-right visual components: the rectangle containing the 
	 * phenotypes, the main grid iself, and the right-hand side including the overview and color scales
	 */
	_createRectangularContainers: function() {
		var self = this;
		this._buildAxisPositionList();
	    //var displayCount = self._getYLimit();
	    var displayCount = self.state.yAxisRender.displayLength();

		var gridHeight = displayCount * self.state.heightOfSingleCell + 10;
		if (gridHeight < self.state.minHeight) {
			gridHeight = self.state.minHeight;
		}

		var y = self.state.yModelRegion;
		// create accent boxes
		var rect_accents = this.state.svg.selectAll("#rect.accent")
			.data([0,1,2], function(d) { return d;});
		rect_accents.enter()
			.append("rect")
			.attr("class", "accent")
			.attr("x", function(d, i) { return self.state.axis_pos_list[i];})
			.attr("y", y)
			.attr("width", self.state.textWidth + 5)
			.attr("height", gridHeight)
			.attr("id", function(d, i) {
				if(i === 0) {return "leftrect";}
				else if(i == 1) {return "centerrect";}
				else {return "rightrect";}
			})
			.style("opacity", '0.4')
			.attr("fill", function(d, i) {
				return i != 0 ? d3.rgb("#eee") : "white";
			});

		return gridHeight + self.state.yModelRegion;
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
			if (i == 2) {
				// make sure it's not too narrow i
				var w = this.state.modelWidth;
				if(w < this.state.smallestModelWidth) {
					w = this.state.smallestModelWidth;
				}
				this.state.axis_pos_list.push((this.state.textWidth + 50) + this.state.colStartingPos + w);
			} else if (i == 1 ){
				this.state.axis_pos_list.push((i * (this.state.textWidth + this.state.xOffsetOver + 10)) + this.state.colStartingPos);
			} else {
				this.state.axis_pos_list.push((i * (this.state.textWidth + 10)) + this.state.colStartingPos);
			}
		}	
	},

	_addPhenogridControls: function() {
		var phenogridControls = $('<div id="phenogrid_controls"></div>');
		this.element.append(phenogridControls);
		this._createSelectionControls(phenogridControls);
	},
 
	_addGradients: function() {
		var self = this;
		//var cellData = this.state.cellDataHash.values();
		//MKD: NEEDS REFACTORED
		var cellData = this.state.dataManager.getData("cellData", self.state.currentTargetSpeciesName);
		var temp_data = cellData.map(function(d) { return d.value[self.state.selectedCalculation];} );
		var diff = d3.max(temp_data) - d3.min(temp_data);
		var y1;

		// only show the scale if there is more than one value represented in the scale
		if (diff > 0) {
			// baseline for gradient positioning
			if (this.state.dataManager.length("source") < this.state.sourceDisplayLimit) {
				y1 = 172;
			} else {
				y1 = 262;
			}
			this._buildGradientDisplays(y1);
			this._buildGradientTexts(y1);
		}
	},

	// build the gradient displays used to show the range of colors
	_buildGradientDisplays: function(y1) {
		var ymax = 0;
		var y;
		// If this is the Overview, get gradients for all species with an index
		// COMPARE CALL HACK - REFACTOR OUT
		// MKD: NEEDS REFACTORED
		if ((this.state.currentTargetSpeciesName == "Overview" || this.state.currentTargetSpeciesName == "All") || (this.state.currentTargetSpeciesName == "Homo sapiens" && (this.state.owlSimFunction == "compare" || this.state.owlSimFunction == "exomiser"))) {			
			//this.state.overviewCount tells us how many fit in the overview
			for (var i = 0; i < this.state.overviewCount; i++) {
				y = this._createGradients(i,y1);
				if (y > ymax) {
					ymax = y;
				}
			}
		} else {	
			// This is not the overview - determine species and create single gradient
			var j = this._getTargetSpeciesIndexByName(this,this.state.currentTargetSpeciesName);
			y = this._createGradients(j,y1);
			if (y > ymax) {
				ymax = y;
			}
		}
		return ymax;
	},

	/*
	 * Add the gradients to the grid, returning the max x so that
	 * we know how much space the grid will need vertically on the
	 * right. This is important because this region will extend 
	 * below the main grid if there are only a few phenotypes.
	 *
	 * y1 is the baseline for computing the y position of the gradient
	 */
	_createGradients: function(i, y1){
		self = this;
		var y;
		var gradientHeight = 20;
		var gradient = this.state.svg.append("svg:linearGradient")
			.attr("id", "gradient_" + i)
			.attr("x1", "0")
			.attr("x2", "100%")
			.attr("y1", "0%")
			.attr("y2", "0%");
		for (var j in this.state.colorDomains){
			if ( ! this.state.colorDomains.hasOwnProperty(j)) {
					break;
			}			
			gradient.append("svg:stop")
				.attr("offset", this.state.colorDomains[j])
				.style("stop-color", this.state.colorRanges[i][j])
				.style("stop-opacity", 1);
		}

		// gradient + gap is 20 pixels
		y = y1 + (gradientHeight * i) + self.state.yoffset;
		var x = self.state.axis_pos_list[2] + 12;
		var translate = "translate(0,10)";
		var legend = this.state.svg.append("rect")
			.attr("transform",translate)
			.attr("class", "legend_rect_" + i)
			.attr("id","legendscale_" + i)
			.attr("y", y)
			.attr("x", x)
			.attr("rx",8)
			.attr("ry",8)
			.attr("width", 180)
			.attr("height", 12) 
			.attr("fill", "url(#gradient_" + i + ")"); // The fill attribute links the element to the gradient defined in svg:linearGradient - Joe

		// text is 20 below gradient
		y = (gradientHeight * (i + 1)) + y1 + self.state.yoffset - 1; // magic number to make it vertical aligined in center - Joe
		// [vaa12] BUG. IF LOOKING AT ONLY 1 SPECIES, SOMEHOW Y IS EITHER ADDED BY 180 OR 360 AT THIS POINT. NOT OTHER VARS CHANGED
		x = self.state.axis_pos_list[2] + 100;  //205;
		var gclass = "grad_text_" + i;
		var specName = this.state.targetSpeciesList[i].name;
		var grad_text = this.state.svg.append("svg:text")
			.attr("class", gclass)
			.attr("y", y)
			.attr("x", x)
			.attr("text-anchor", 'middle')
			.attr("font-size", "10px")
			.text(specName);
		y += gradientHeight;
		return y;
	},

	/*
	 * Show the labels next to the gradients, including descriptions of min and max sides 
	 * y1 is the baseline to work from
	 */
	_buildGradientTexts: function(y1) {
		var lowText, highText, labelText;
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

		var ylowText = y1 + self.state.yoffset;
		var xlowText = self.state.axis_pos_list[2] + 10;
		var div_text1 = self.state.svg.append("svg:text")
			.attr("class", "pg_detail_text")
			.attr("y", ylowText)
			.attr("x", xlowText)
			.style("font-size", "10px")
			.text(lowText);

		var ylabelText = y1 + self.state.yoffset;
		var xlabelText = self.state.axis_pos_list[2] + 75;
		var div_text2 = self.state.svg.append("svg:text")
			.attr("class", "pg_detail_text")
			.attr("y", ylabelText)
			.attr("x", xlabelText)
			.style("font-size", "12px")
			.text(labelText);

		var yhighText = y1 + self.state.yoffset;
		var xhighText = self.state.axis_pos_list[2] + 125;
		var div_text3 = self.state.svg.append("svg:text")
			.attr("class", "pg_detail_text")
			.attr("y", yhighText)
			.style("font-size", "10px")
			.text(highText);
		if (highText == "Max" || highText == "Highest"){
			div_text3.attr("x", xhighText + 25);
		} else {
			div_text3.attr("x", xhighText);
		}
	},

	// build controls for selecting organism and comparison. Install handlers
	_createSelectionControls: function(container) {
		var self = this;
		var optionhtml ='<div id="selects"></div>';
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
		// add the handler for the select control
		$( "#pg_organism" ).change(function(d) {
			console.log('in the change()..');
			self.state.selectedCompareSpecies = [];
			var opts = this.options;
			for (var idx in opts) {
				if (opts[idx].selected) {
					var rec = self._getTargetSpeciesInfo(self, opts[idx].text);
					self.state.selectedCompareSpecies.push(rec);
				}
			}
			if (self.state.selectedCompareSpecies.length > 0) {
				self.state.dataManager.reinitialize(self.state.selectedCompareSpecies, true);
				self._createAxisRenderingGroups();
				self._initDefaults();
				self._processDisplay();
			} else {
				alert("You must have at least 1 species selected.");
			}
		});

		$( "#pg_calculation" ).change(function(d) {
			self.state.selectedCalculation = self.state.similarityCalculation[d.target.selectedIndex].calc;
			self._resetSelections("calculation");
			self._processDisplay();
		});

		// add the handler for the select control
		$( "#pg_sortphenotypes" ).change(function(d) {
			self.state.selectedSort = self.state.phenotypeSort[d.target.selectedIndex];
			// sort source with default sorting type
			if (self.state.invertAxis){
				self.state.xAxisRender.sort(self.state.selectedSort); 
			} else {
				self.state.yAxisRender.sort(self.state.selectedSort); 
			}
			self._resetSelections("sortphenotypes");
			self._processDisplay();
		});

		$( "#pg_axisflip" ).click(function(d) {
		    self.state.invertAxis = !self.state.invertAxis;
		    self._resetSelections("axisflip");
		    self._setAxisRenderers();
		    self._resetDisplayLimits();
		    self._processDisplay();

		});

		self._configureFaqs();
	},

	_createOrganismSelection: function() {
		var selectedItem;
		var optionhtml = "<div id='pg_org_div'><label class='pg_ctrl_label'>Organism</label>" + 
			//"<div class='SumoSelect' tabindex='0'>" +
			"<select id='pg_organism' multiple='multiple' class='SlectBox'>"; // select is inline level element, it's fine to use <span> - Joe
		for (var idx in this.state.targetSpeciesList) {
			if ( ! this.state.targetSpeciesList.hasOwnProperty(idx)) {
				break;
			}
			selectedItem = "";
			if (this.state.targetSpeciesList[idx].active) {  //MKD: NEEDS CHANGED AFTER MULTIPLE SELCTION WIDGET
				if (this._isTargetSpeciesSelected(this, this.state.targetSpeciesList[idx].name)) {
					selectedItem = "selected";
				}
				optionhtml += "<option value=\"" + this.state.targetSpeciesList[idx].name +
				"\" " + selectedItem + ">" + this.state.targetSpeciesList[idx].name + "</option>";
			}
		}
		optionhtml += "</select></div>";
		//return $(optionhtml);
		return optionhtml;
	},

	// create the html necessary for selecting the calculation
	_createCalculationSelection: function () {
		var optionhtml = "<div id='pg_calc_div'><label class='pg_ctrl_label'>Display</label>"+ // changed span to div since the CSS name has "_div" - Joe
				"<span id='pg_calcs'> <i class='fa fa-info-circle cursor_pointer'></i></span>" + // <i class='fa fa-info-circle'></i> FontAwesome - Joe
				"<span id='calc_sel'><select id='pg_calculation'>";

		for (var idx in this.state.similarityCalculation) {
			if ( ! this.state.similarityCalculation.hasOwnProperty(idx)) {
					break;
			}			
			var selecteditem = "";
			if (this.state.similarityCalculation[idx].calc === this.state.selectedCalculation) {
				selecteditem = "selected";
			}
			optionhtml += "<option value='" + this.state.similarityCalculation[idx].calc + "' " + selecteditem + ">" +
				this.state.similarityCalculation[idx].label + "</option>";
		}
		optionhtml += "</select></span></div>"; // changed span to div since the CSS name has "_div" - Joe
		return $(optionhtml);
	},

	// create the html necessary for selecting the sort
	_createSortPhenotypeSelection: function () {
		var optionhtml ="<div id='pg_sort_div'><label class='pg_ctrl_label'>Sort Phenotypes</label>" + // changed span to div since the CSS name has "_div" - Joe
				"<span id='pg_sorts'> <i class='fa fa-info-circle cursor_pointer'></i></span>" + // <i class='fa fa-info-circle'></i> FontAwesome - Joe
				"<span><select id='pg_sortphenotypes'>";

		for (var idx in this.state.phenotypeSort) {
			if ( ! this.state.phenotypeSort.hasOwnProperty(idx)) {
				break;
			}

			var selecteditem = "";
			if (this.state.phenotypeSort[idx] === this.state.selectedSort) {
				selecteditem = "selected";
			}
			optionhtml += "<option value='" + "' " + selecteditem + ">" + this.state.phenotypeSort[idx] + "</option>";
		}
		optionhtml += "</select></span></div>"; // Added missing </div> - Joe
		return $(optionhtml);
	},

	// create the html necessary for selecting the axis flip
	_createAxisSelection: function () {
		var optionhtml = "<div id='pg_axis_div'><label class='pg_ctrl_label'>Axis Flip</label>" +
			"<span id='org_sel'><button type='button' id='pg_axisflip'>Flip Axis</button></span></div>"; // <button> is an inline tag - Joe
			
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
				if (dupArray[m].id == unmatchedset[l].id) {
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
				if (i == unmatched.length) {
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
		return newlist;
	},

	// Will call the getHPO function to either load the HPO info or to make it visible if it was previously hidden.  Not available if preloading
	_expandHPO: function(id){
		
		var displayIt = false;
		var fixedId = id.replace("_", ":");
		var hpoCached = this.state.hpoCacheHash[fixedId];

		if (hpoCached == null){
			var hpoInfo = this.state.dataLoader.getOntology(fixedId, this.state.ontologyDirection, this.state.ontologyDepth);			
			this.state.hpoCacheHash[fixedId] = hpoInfo;
			hpoCached = hpoInfo;
			displayIt = true;
		} else {
			displayIt = true;
		}

		if (displayIt) {
			this.state.ontologyTreesDone = 0;
			this.state.ontologyTreeHeight = 0;
			var info = this._getAxisData(id);
			var type = this._getIDType(id);
			var hrefLink = "<a href=\"" + this.state.serverURL+"/phenotype" + type +"/"+ fixedId + "\" target=\"_blank\">" + info.label + "</a>";
			var hpoData = "<strong>" + Utils.capitalizeString(type) + ": </strong> " + hrefLink + "<br/>";
			hpoData += "<strong>IC:</strong> " + info.IC.toFixed(2) + "<br/><br/>";

			var hpoTree = this.buildHPOTree(fixedId, hpoCached.edges, 0);

			if (hpoTree == "<br/>"){
				hpoData += "<em>No HPO Data Found</em>";
			} else {
				hpoData += "<strong>HPO Structure:</strong>" + hpoTree;
			}
			$("#sticky1").html(hpoData);

			// reshow the sticky with updated info
			stickytooltip.show(null);
		}		
	},

	// Will hide the hpo info, not delete it.  This allows for reloading to be done faster and avoid unneeded server calls.  Not available if preloading
	_collapseHPO: function(id){
		var idClean = id.replace("_", ":");
		var HPOInfo = this.state.hpoCacheHash.get(idClean);
		HPOInfo.active = 0;
		this.state.hpoCacheHash.put(idClean,HPOInfo);
		stickytooltip.closetooltip();
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
			if (models[i].model_id == curModelId){
				phenoTypes.push({id: models[i].id_a, label: models[i].label_a});
			}
		}
		return phenoTypes;
	}, 

	// insert into the model list
	_insertionModelList: function (insertPoint, insertions) {
		var newModelList = []; //new Hashtable();  //MKD REFACTOR
		//var sortedModelList= self._getSortedIDList( this.state.dataManager.getData("target")); 
		var sortedModelList = self.state.xAxisRender.keys();
		var reorderPointOffset = insertions.size();
		var insertionOccurred = false;

		for (var i in sortedModelList){
			var entry = this.state.dataManager.getElement("target", sortedModelList[i]);
			if (entry.pos == insertPoint) {
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
		var sortedModelList = self.state.xAxisRender.keys();
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
				if (removalKeys[cnt] == sortedModelList[i]) {
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

		if (info == 'gene') {
			var g = this.state.expandedHash.get(concept);
			if (g !== null && g.expanded) {
				return "#08594B";
			}
		}
		else if (info == 'genotype') {
			return "#488B80"; //"#0F473E";
		}
		return "#000000";
	},

	// check to see object is expanded
	_isExpanded: function(data) {
		var concept = this._getConceptId(data);
		var info = this._getIDTypeDetail(concept);

		if (info == 'gene') {
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

	/*
	 * HACK WARNING - 20140926, harryh@pitt.edu
	 * phenogrid assumes a path of /js/res relative to the scriptpath directory. This will contain configuration files
	 * that will be loaded via urls constructed in this function.
	 * As of 9/26/2014, the puptent application used in monarch-app breaks this.
	 * thus, a workaround is included below to set the path correctly if it come up as '/'.
	 * this should not impact any standalone uses of phenogrid, and will be removed once monarch-app is cleaned up.
	 */
	_getResourceUrl: function(name,type) {
		var prefix = this.state.serverURL+'/widgets/phenogrid/js/';
		return prefix + 'res/' + name + '.' + type;
	},

	_isCrossComparisonView: function() {
		if (this.state.selectedCompareSpecies.length == 1) {
			return false;
		}
		return true;
	}



	}); // end of widget code
})(jQuery);
