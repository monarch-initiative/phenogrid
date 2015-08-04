(function () {
'use strict';

/* 
	TooltipRender - Render the content of a tooltip.

	The tooltip consist of two 'areas', 1.) basic info area, which provides general info
	such as id, label, rank, score, etc. Most object will have these attribute. it accounts 
	for absent attributes. 2.) the action or extended info area, which render content specific to 
	performing actions such as displaying expand buttons and other specialized info. For new types,
	just add a specialized method, making sure the the name matches the data.type 
	(e.g, function phenotype => data.type='phenotype').
*/

var $ = require('jquery'); // Have to be 'jquery', can't use 'jQuery'

var TooltipRender = function(url) {  //parms
	 this.url = url;
};

TooltipRender.prototype = {
	constructor:TooltipRender,

	entityHreflink: function() {
		var s = "<a href=\"" + this.url +"/" +  this.data.type +"/"+ this.id +
				"\" target=\"_blank\">" + this.data.label + "</a>";
		return s;
	},

	// main method for rendering tooltip content
	html: function(parms) {
		this.parent = parms.parent;
		this.data = parms.data;
		this.id = parms.id;
		var retInfo = "";

		// making an assumption here that we want to display cell info
		if ( typeof(this.data.type) === 'undefined') {
			retInfo = this.cell(this, this.data);
		} else {
			// this creates the standard information portion of the tooltip, 
			retInfo =  "<strong>" + this._capitalizeString(this.data.type) + ": </strong> " + this.entityHreflink() + "<br>" +
					   this._rank() + this._score() + this._ic();

			// this creates the extended information for specialized tooltip info and functionality
			// try to dynamically invoke the function that matches the data.type
			try {
				var func = this.data.type;			
				retInfo += this[func](this);
			} catch(err) { console.log("searching for " + func);}
		}
		return retInfo;
	},
	
	_rank: function() {
		return (typeof(this.data.rank) !== 'undefined'?"<strong>Rank:</strong> " + this.data.rank+"<br>":"");
	},
	_score: function() {
		return (typeof(this.data.score) !== 'undefined'?"<strong>Score:</strong> " + this.data.score+"<br>":"");	
	},
	_ic: function() {
		return (typeof(this.data.IC) !== 'undefined'?"<strong>IC:</strong> " + this.data.IC.toFixed(2)+"<br>":"");
	},
	_species: function() {
		return (typeof(this.data.species) !== 'undefined'?"<strong>Species:</strong> " + this.data.species+"<br>":"");
	},

	_capitalizeString: function(word){
		if (word === undefined) {
			return "Undefined";
		} else {
			return word.charAt(0).toUpperCase() + word.slice(1);
		}
	}, 

	phenotype: function(tooltip) {
		
		var returnHtml = "";
		var hpoExpand = false;
		var hpoData = "<br>";
		var hpoCached = tooltip.parent.state.hpoCacheHash.get(tooltip.id.replace("_", ":"));
		if (hpoCached !== null && hpoCached.active === 1){
			hpoExpand = true;

			//HACKISH, BUT WORKS FOR NOW.  LIMITERS THAT ALLOW FOR TREE CONSTRUCTION BUT DONT NEED TO BE PASSED BETWEEN RECURSIONS
			tooltip.parent.state.hpoTreesDone = 0;
			tooltip.parent.state.hpoTreeHeight = 0;
			var hpoTree = "<div id='hpoDiv'>" + tooltip.parent.buildHPOTree(tooltip.id.replace("_", ":"), hpoCached.edges, 0) + "</div>";
			
			hpoData += "<strong>Classification hierarchy:</strong>" + hpoTree;
		}
		
		// Used font awesome for expand/collapse buttons - Joe
		if ( ! tooltip.parent.state.preloadHPO){
			if (hpoExpand){
				returnHtml = hpoData;
			} else {
				returnHtml = "<br>Click icon to <b>expand</b> classification hierarchy info";
				returnHtml += "<i class=\"pg_HPO_icon fa fa-plus-circle pg_cursor_pointer\" id=\"expandHPO_" + tooltip.id + "\"></i>";
			}
		}
		else {
			returnHtml = hpoData;
		}
	return returnHtml;		

	},

	cell: function(tooltip, d) {
		
		var returnHtml, fullInfo, prefix, modelLabel, phenoLabel;

		/* Sample xInfo
		label: "Hemiplegic migraine, familial type 1"
		pos: 16
		rank: 16
		score: 64
		species: "Homo sapiens"
		taxon: "NCBITaxon:9606"
		type: "disease"
		*/
		var xInfo = tooltip.parent._getAxisData(d.xID);
		
		/* Sample yInfo
		IC: 14.627721129873681
		count: 8
		label: "Fluctuations in consciousness"
		pos: 13
		sum: 60.89711102518358
		type: "phenotype"
		ypos: 384
		*/
		var yInfo = tooltip.parent._getAxisData(d.yID);

		// When use jquery's $.extend({}, xInfo, yInfo), type in yInfo will overwrite type in xInfo - Joe
		if (tooltip.parent.state.invertAxis) {
			fullInfo = $.extend({}, xInfo, yInfo); // use type from yInfo
		} else {
			fullInfo = $.extend({}, yInfo, xInfo); // use type from xInfo
		}

		var species = fullInfo.species;
		var taxon = fullInfo.taxon;

		//[vaa12] Could be done in a more sophisticated function, but this works and removed dependancy on invertAxis
		if (tooltip.parent.state.phenotypeListHash.containsKey(d.xID)) {
			phenoLabel = tooltip.parent.state.phenotypeListHash.get(d.xID).label;
		} else if (tooltip.parent.state.phenotypeListHash.containsKey(d.yID)) {
			phenoLabel = tooltip.parent.state.phenotypeListHash.get(d.yID).label;
		} else {
			phenoLabel = null;
		}

		if (tooltip.parent.state.modelListHash.containsKey(d.xID)) {
			modelLabel = tooltip.parent.state.modelListHash.get(d.xID).label;
		} else if (tooltip.parent.state.modelListHash.containsKey(d.yID)) {
			modelLabel = tooltip.parent.state.modelListHash.get(d.yID).label;
		} else {
			modelLabel = null;
		}

		if (taxon !== undefined || taxon !== null || taxon !== '' || isNaN(taxon)) {
			if (taxon.indexOf("NCBITaxon:") !== -1) {
				taxon = taxon.slice(10);
			}
		}

		for (var idx in tooltip.parent.state.similarityCalculation) {
			if ( ! tooltip.parent.state.similarityCalculation.hasOwnProperty(idx)) {
				break;
			}
			if (tooltip.parent.state.similarityCalculation[idx].calc === tooltip.parent.state.selectedCalculation) {
				prefix = tooltip.parent.state.similarityCalculation[idx].label;
				break;
			}
		}

		// Hiding scores which are equal to 0
		var formatScore =  function(score) {
			if (score === 0) {
				return "";
			} else {
				return " (IC: " + score + ")";
			}
		};

		returnHtml = "<strong>Query: </strong> " + phenoLabel + formatScore(fullInfo.IC.toFixed(2)) +
			"<br/><strong>Match: </strong> " + d.b_label + formatScore(d.b_IC.toFixed(2)) +
			"<br/><strong>Common: </strong> " + d.subsumer_label + formatScore(d.subsumer_IC.toFixed(2)) +
			"<br/><strong>" + tooltip.parent._capitalizeString(fullInfo.type)+": </strong> " + modelLabel +
			"<br/><strong>" + prefix + ":</strong> " + d.value[tooltip.parent.state.selectedCalculation].toFixed(2) + '%' +
			"<br/><strong>Species: </strong> " + species + " (" + taxon + ")";


		return returnHtml;
	},


	gene: function(tooltip) {
		var returnHtml = "";	
	/* DISABLE THIS FOR NOW UNTIL SCIGRAPH CALL IS WORKING
		// for gene and species mode only, show genotype link
		if (tooltip.parent.state.targetSpeciesName != "Overview"){
			var isExpanded = false;
			var gtCached = tooltip.parent.state.expandedHash.get(tooltip.id);
			if (gtCached !== null) { isExpanded = gtCached.expanded;}

			//if found just return genotypes scores
			if (isExpanded) {
	//					appearanceOverrides.offset = (gtCached.genoTypes.size() + (gtCached.genoTypes.size() * 0.40));   // magic numbers for extending the highlight
				returnHtml = "<br>Number of expanded genotypes: " + gtCached.genoTypes.size() +
					 "<br/><br/>Click button to <b>collapse</b> associated genotypes &nbsp;&nbsp;" +
					 "<button class=\"collapsebtn\" type=\"button\" onClick=\"self._collapseGenotypes('" + tooltip.id + "')\">" +
					 "</button>";
			} else {
				if (gtCached !== null) {
					returnHtml = "<br/><br/>Click button to <b>expand</b> <u>" + gtCached.genoTypes.size() + "</u> associated genotypes &nbsp;&nbsp;";
				} else {
					returnHtml = "<br/><br/>Click button to <b>expand</b> associated genotypes &nbsp;&nbsp;";
				}
				returnHtml += "<button class=\"expandbtn\" type=\"button\" onClick=\"self._expandGenotypes('" + tooltip.id + "')\"></button>";
			}
		}
	*/	
		return returnHtml;	
	},

	/*
	genotype: function(tooltip) {
		var returnHtml = "";
		if (typeof(info.parent) !== 'undefined' && info.parent !== null) {
			var parentInfo = tooltip.parent.state.modelListHash.get(info.parent);
			if (parentInfo !== null) {
				// var alink = this.url + "/" + parentInfo.type + "/" + info.parent.replace("_", ":");
				// var hyperLink = $("<a>")
				// 	.attr("href", alink)
				// 	.attr("target", "_blank")
				// 	.text(parentInfo.label);
				// return "<br/><strong>Gene:</strong> " + hyperLink;				

				var genehrefLink = "<a href=\"" + tooltip.url + "/" + parentInfo.type + "/" + info.parent.replace("_", ":") + "\" target=\"_blank\">" + parentInfo.label + "</a>";
				returnHtml = "<br/><strong>Gene:</strong> " + genehrefLink;
			}
		}
		return returnHtml;	
	}
	*/

};

// CommonJS format - Joe
module.exports = TooltipRender;


}());
