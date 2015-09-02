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
		var s = "<a href=\"" + this.url +"/" +  ptype +"/"+ pid +
				"\" target=\"_blank\">" + plabel + "</a>";
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
		//if ( typeof(this.data.type) == 'undefined') {
		if ( this.data.type === 'cell') {
			retInfo = this.cell(this, this.data);
		} else {
			// this creates the standard information portion of the tooltip, 
			retInfo =  "<strong>" + this._capitalizeString(this.data.type) + ": </strong> " + 
						this.entityHreflink(this.data.type, this.data.id, this.data.label ) +
						"<br/>" + this._rank() + this._score() + this._ic() + this._targetGroup();

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
	_targetGroup: function() {
		return (typeof(this.data.targetGroup) !== 'undefined'?"<strong>Species:</strong> " + this.data.targetGroup+"<br/>":"");
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
		var expand = false;
		var ontologyData = "<br>";
		var id = tooltip.id;

		var cached = tooltip.parent.state.dataLoader.checkOntologyCache(id);

		if (cached !== undefined) { //&& hpoCached.active == 1){
			expand = true;

			//HACKISH, BUT WORKS FOR NOW.  LIMITERS THAT ALLOW FOR TREE CONSTRUCTION BUT DONT NEED TO BE PASSED BETWEEN RECURSIONS
			tooltip.parent.state.ontologyTreesDone = 0;
			tooltip.parent.state.ontologyTreeHeight = 0;
			var tree = "<div id='hpoDiv'>" + tooltip.parent.buildOntologyTree(id.replace("_", ":"), cached.edges, 0) + "</div>";
			if (tree === "<br>"){
				ontologyData += "<em>No Classification hierarchy Found</em>";
			} else {
				ontologyData += "<strong>Classification hierarchy:</strong>" + tree;
			}
		}
		if (expand){
			returnHtml += ontologyData;
		} else {
			//returnHtml = "<br>Click icon to <b>expand</b> classification hierarchy info";
			returnHtml = "<br><div class=\"pg_expandHPO\" id=\"pg_expandOntology_" + id + "\">Expand classification hierarchy<i class=\"pg_HPO_icon fa fa-plus-circle pg_cursor_pointer\"></i></div>";
		}
	return returnHtml;		

	},

	gene: function(tooltip) {
		var returnHtml = "";	
	/* DISABLE THIS FOR NOW UNTIL SCIGRAPH CALL IS WORKING */
		
		if (tooltip.parent.state.targetGroupName !== "Overview"){
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

		var prefix, targetId, sourceId, targetInfo, sourceInfo;
			//var taxon = d.taxon;

		if (tooltip.parent.state.invertAxis) {
			sourceId = d.target_id;
			targetId = d.source_id;
			targetInfo = tooltip.parent.state.yAxisRender.get(d.target_id); 
			sourceInfo = tooltip.parent.state.xAxisRender.get(d.source_id); 			
		 } else {
			sourceId = d.source_id;
			targetId = d.target_id;
			targetInfo = tooltip.parent.state.xAxisRender.get(d.target_id); 
			sourceInfo = tooltip.parent.state.yAxisRender.get(d.source_id); 						
		 }

		 
			// if (taxon !== undefined || taxon !== null || taxon !== '' || isNaN(taxon)) {
			// 	if (taxon.indexOf("NCBITaxon:") != -1) {
			// 		taxon = taxon.slice(10);
			// 	}
			// }

		for (var idx in tooltip.parent.state.similarityCalculation) {	
			if (tooltip.parent.state.similarityCalculation[idx].calc === tooltip.parent.state.selectedCalculation) {
				prefix = tooltip.parent.state.similarityCalculation[idx].label;
			break;
			}
		}

		// If the selected calculation isn't percentage based (aka similarity) make it a percentage
		if ( selCalc !== 2) {suffix = '%';}

		returnHtml = "<table class=\"pgtb\">" +
			"<tbody><tr><td><u><b>Query</b></u><br>" +   //Utils.capitalizeString(d.type) + 
			"<b>Source: </b>" + this.entityHreflink(sourceInfo.type, sourceId, d.a_label ) +  
			" " + Utils.formatScore(d.a_IC.toFixed(2)) + "<br>" + 
			"<b>" + prefix + ":</b> " + d.value[tooltip.parent.state.selectedCalculation].toFixed(2) + '%' + "<br>" +		
			"<b>Species:</b> " + d.targetGroup + "(" + tooltip.parent.state.targetGroupByName[d.targetGroup].taxon + ")</td>" + 
			"<tr><td><u><b><br>In-common</b></u><br>" + 
		this.entityHreflink(sourceInfo.type, d.subsumer_id, d.subsumer_label ) +
				Utils.formatScore(d.subsumer_IC.toFixed(2)) + "</td></tr>" +
				"<tr><td><br><u><b>Match</b></u><br>" + 
		this.entityHreflink(sourceInfo.type, d.b_id, d.b_label ) +
			Utils.formatScore(d.b_IC.toFixed(2))+ "</td></tr>" +
			"<tr><td><br><u><b>Target</b></u><br>" + 
			"<b>Name:</b> " + 
			this.entityHreflink(targetInfo.type, targetInfo.id, targetInfo.label) +
			"</td></tr>" +
			"</tbody>" + "</table>";
		
		return returnHtml;	

	}


};


// CommonJS format
module.exports = TooltipRender;

}());