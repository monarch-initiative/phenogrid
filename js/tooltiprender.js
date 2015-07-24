(function () {
'use strict';

var Utils = require('./utils.js');


/* 
	Package: tooltiprender.js

 	Constructor: TooltipRender 
		Render the content of a tooltip
		The tooltip consist of two 'areas', 1.) basic info area, which provides general info
		such as id, label, rank, score, etc. Most object will have these attribute. it accounts 
		for absent attributes. 2.) the action or extended info area, which render content specific to 
		performing actions such as displaying expand buttons and other specialized info. For new types,
		just add a specialized method, making sure the the name matches the data.type 
		(e.g, function phenotype => data.type='phenotype').

 	Parameters:
 		url base
*/
var TooltipRender = function(url) {  //parms
	 this.url = url;
};

TooltipRender.prototype = {
	constructor:TooltipRender,

	entityHreflink: function(ptype, pid, plabel) {
		var s = "<a href=\"" + this.url +"/" +  ptype +"/"+ pid 
				+ "\" target=\"_blank\">" + plabel + "</a>";
		return s;
	},

	test: function() {
		console.log('test');
	}, 

	// main method for rendering tooltip content
	html: function(parms) {
		this.parent = parms.parent;
		this.data = parms.data;
		this.id = parms.data.id;
		var retInfo = "";

		// making an assumption here that we want to display cell info
		if ( typeof(this.data.type) == 'undefined') {
			retInfo = this.cell(this, this.data);
		} else {
			// this creates the standard information portion of the tooltip, 
			retInfo =  "<strong>" + this._capitalizeString(this.data.type) + ": </strong> " + 
						this.entityHreflink(this.data.type, this.data.id, this.data.label ) +
						"<br/>" + this._rank() + this._score() + this._ic();

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
		return (typeof(this.data.rank) !== 'undefined'?"<strong>Rank:</strong> " + this.data.rank+"<br/>":"");
	},
	_score: function() {
		return (typeof(this.data.score) !== 'undefined'?"<strong>Score:</strong> " + this.data.score+"<br/>":"");	
	},
	_ic: function() {
		return (typeof(this.data.IC) !== 'undefined'?"<strong>IC:</strong> " + this.data.IC.toFixed(2)+"<br/>":"");
	},
	_species: function() {
		return (typeof(this.data.species) !== 'undefined'?"<strong>Species:</strong> " + this.data.species+"<br/>":"");
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
		var hpoData = "<br/><br/>";
		var fixedId = tooltip.id.replace("_", ":");
		var hpoCached = tooltip.parent.state.hpoCacheHash[fixedId];
	var TEMP = tooltip.parent._expandHPO;

		if (hpoCached !== undefined) { //&& hpoCached.active == 1){
			hpoExpand = true;

			//HACKISH, BUT WORKS FOR NOW.  LIMITERS THAT ALLOW FOR TREE CONSTRUCTION BUT DONT NEED TO BE PASSED BETWEEN RECURSIONS
			tooltip.parent.state.ontologyTreesDone = 0;
			tooltip.parent.state.ontologyTreeHeight = 0;
			var hpoTree = "<div id='hpoDiv'>" + tooltip.parent.buildHPOTree(tooltip.id.replace("_", ":"), hpoCached.edges, 0) + "</div>";
			if (hpoTree == "<br/>"){
				hpoData += "<em>No HPO Data Found</em>";
			} else {
				hpoData += "<strong>HPO Structure:</strong>" + hpoTree;
			}
		}
		// Used font awesome for expand/collapse buttons - Joe
		if (!tooltip.parent.state.preloadHPO){
			if (hpoExpand){
				returnHtml = "<br/><br/>Click button to <b>collapse</b> HPO info &nbsp;&nbsp;";
				returnHtml += "<i class=\"HPO_icon fa fa-minus-circle cursor_pointer \" onClick=\"this._collapseHPO('" + tooltip.id + "')\"></i>";
				returnHtml += hpoData;
			} else {
				returnHtml = "<br/><br/>Click button to <b>expand</b> HPO info &nbsp;&nbsp;";
				returnHtml += "<i class=\"HPO_icon fa fa-plus-circle cursor_pointer \" onClick=\"this._expandHPO('" + tooltip.id + "')\"></i>";

			}
		}
		else {
			returnHtml = hpoData;
		}
	return returnHtml;		

	},

	gene: function(tooltip) {
		var returnHtml = "";	
	/* DISABLE THIS FOR NOW UNTIL SCIGRAPH CALL IS WORKING */
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
					 "<button class=\"collapsebtn\" type=\"button\" onClick=\"self._collapse('" + tooltip.id + "')\">" +
					 "</button>";
			} else {
				if (gtCached !== null) {
					returnHtml = "<br/><br/>Click button to <b>expand</b> <u>" + gtCached.genoTypes.size() + "</u> associated genotypes &nbsp;&nbsp;";
				} else {
					returnHtml = "<br/><br/>Click button to <b>expand</b> associated genotypes &nbsp;&nbsp;";
				}
				returnHtml += "<button class=\"expandbtn\" type=\"button\" onClick=\"self._expand('" + tooltip.id + "')\"></button>";
			}
		}
		
		return returnHtml;	
	},

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
	},

	cell: function(tooltip, d) {
		var returnHtml = "";

			var suffix = "";
			var selCalc = tooltip.parent.state.selectedCalculation;

		var prefix, targetId, sourceId, type;
			var species = d.species;
			//var taxon = d.taxon;

			 if (tooltip.parent.state.invertAxis) {
				sourceId = d.source_id;
			targetId = d.target_id;
	//			type = yInfo.type;
			 } else {
				sourceId = d.source_id;
			targetId = d.target_id;
	//			type = xInfo.type;
			 }

			// if (taxon !== undefined || taxon !== null || taxon !== '' || isNaN(taxon)) {
			// 	if (taxon.indexOf("NCBITaxon:") != -1) {
			// 		taxon = taxon.slice(10);
			// 	}
			// }

			for (var idx in tooltip.parent.state.similarityCalculation) {	
				if ( ! tooltip.parent.state.similarityCalculation.hasOwnProperty(idx)) {
					break;
				}
				if (tooltip.parent.state.similarityCalculation[idx].calc === tooltip.parent.state.selectedCalculation) {
					prefix = tooltip.parent.state.similarityCalculation[idx].label;
				break;
				}
			}

			// If the selected calculation isn't percentage based (aka similarity) make it a percentage
			if ( selCalc != 2) {suffix = '%';}

			returnHtml = "<table class=\"pgtb\">" +
				"<tbody><tr><td><u><b>Query</b></u><br>" +
				this.entityHreflink(d.type, sourceId, d.a_label ) +  
				" " + Utils.formatScore(d.a_IC.toFixed(2)) + "<br><b>Species:</b> " + d.species + "</td>" + 
				"<tr><td><u><b><br>In-common</b></u><br>" + 
			this.entityHreflink(d.type, d.subsumer_id, d.subsumer_label )
			+ Utils.formatScore(d.subsumer_IC.toFixed(2)) + "</td></tr>" +
				"<tr><td><br><u><b>Match</b></u><br>" + 
			this.entityHreflink(d.type, d.b_id, d.b_label )
			+ Utils.formatScore(d.b_IC.toFixed(2))+ "</td></tr>" +
				"</tbody>" + 
				"</table>";

				// "<br/><strong>Target:</strong> " + d.a_label +  //+ Utils.capitalizeString(type)
				// "<br/><strong>" + prefix + ":</strong> " + d.value[selCalc].toFixed(2) + suffix +
				// "<br/><strong>Species: </strong> " + d.species;  // + " (" + taxon + ")";


			// returnHtml = "<strong>Query: </strong> " + sourceLabel + Utils.formatScore(d.a_IC.toFixed(2)) +
			// 	"<br/><strong>Match: </strong> " + d.b_label + Utils.formatScore(d.b_IC.toFixed(2)) +
			// 	"<br/><strong>Common: </strong> " + d.subsumer_label + Utils.formatScore(d.subsumer_IC.toFixed(2)) +
			// 	"<br/><strong>Target:</strong> " + d.a_label +  //+ Utils.capitalizeString(type)
			// 	"<br/><strong>" + prefix + ":</strong> " + d.value[selCalc].toFixed(2) + suffix +
			// 	"<br/><strong>Species: </strong> " + d.species;  // + " (" + taxon + ")";
		
		return returnHtml;	

	}


};


// CommonJS format
module.exports = TooltipRender;

}());