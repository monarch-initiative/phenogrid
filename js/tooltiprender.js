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
var TooltipRender = function(url) {
	 this.url = url;
};

TooltipRender.prototype = {
	constructor:TooltipRender,
    // also encode the labels into html entities, otherwise they will mess up the tooltip format
	entityHreflink: function(ptype, pid, plabel) {
		var s = "<a href=\"" + this.url +"/" +  ptype +"/"+ pid +
				"\" target=\"_blank\">" + Utils.encodeHtmlEntity(plabel) + "</a>";
		return s;
	},

	// main method for rendering tooltip content
	html: function(parms) {
		this.parent = parms.parent;
		this.data = parms.data;
		this.id = parms.data.id;
		var retInfo = "";
        
        switch (this.data.type) {
            case 'cell':
                retInfo = this.cell(this, this.data);
                break;
            case 'gene':
                retInfo = this.gene(this);
                break;
            case 'phenotype':
                retInfo = this.phenotype(this);
                break;
            case 'genotype':
                retInfo = this.genotype(this);
                break;
            case 'disease':
                retInfo = this.disease(this);
                break;
        }

		return retInfo;
	},
    
    _type: function(type, id, label) {
		return (typeof(type) !== 'undefined' ? "<strong>" + Utils.capitalizeString(type) + ": </strong> " + this.entityHreflink(type, id, label ) + "<br/>" : "");
	},
    
	_rank: function() {
		return (typeof(this.data.rank) !== 'undefined' ? "<strong>Rank:</strong> " + this.data.rank+"<br/>" : "");
	},
    
	_score: function() {
		return (typeof(this.data.score) !== 'undefined' ? "<strong>Score:</strong> " + this.data.score+"<br/>" : "");	
	},
    
	_ic: function() {
		return (typeof(this.data.IC) !== 'undefined' ? "<strong>IC:</strong> " + this.data.IC.toFixed(2)+"<br/>" : "");
	},
    
	_targetGroup: function() {
		return (typeof(this.data.targetGroup) !== 'undefined' ? "<strong>Species:</strong> " + this.data.targetGroup+"<br/>" : "");
	},
    
	_sum: function() {
		return (typeof(this.data.sum) !== 'undefined' ? "<strong>Sum:</strong> " + this.data.sum.toFixed(2)+"<br/>" : "");
	},
    
	_freq: function() {
		return (typeof(this.data.count) !== 'undefined' ? "<strong>Frequency:</strong> " + this.data.count +"<br/>" : "");
	},

	phenotype: function(tooltip) {
        var returnHtml = tooltip._type(tooltip.data.type, tooltip.data.id, tooltip.data.label)
                         + tooltip._ic()
                         + tooltip._sum() 
                         + tooltip._freq() 
                         + tooltip._targetGroup();
                        
		var expanded = false;
		var ontologyData = "<br>";
		var id = tooltip.id;

		var cached = tooltip.parent.state.dataLoader.checkOntologyCache(id);

		if (typeof(cached) !== 'undefined') {
			expanded = true;

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
        
		if (expanded){
			returnHtml += ontologyData;
		} else {
			returnHtml += "<br><div class=\"pg_expand_ontology\" id=\"pg_expandOntology_" + id + "\">Expand classification hierarchy<i class=\"pg_expand_ontology_icon fa fa-plus-circle pg_cursor_pointer\"></i></div>";
		}
        
        return returnHtml;		
	},

	gene: function(tooltip) {
		var returnHtml = tooltip._type(tooltip.data.type, tooltip.data.id, tooltip.data.label)
                         + tooltip._rank() 
                         + tooltip._score() 
                         + tooltip._targetGroup();

		// for gene and single species mode only, add genotype expansion link
		if (tooltip.parent.state.selectedCompareTargetGroup.length === 1) {
            var expanded = false;
        
            var id = tooltip.id;

            var cached = tooltip.parent.state.dataLoader.checkGenotypeExpansionCache(id); // gene id

            if (typeof(cached) !== 'undefined') {
                expanded = true;
            }
        
            if (expanded){
                returnHtml += "<br><div class=\"pg_insert_genotypes\" data-species=\"" + tooltip.data.targetGroup + "\" id=\"pg_remove_genotypes_" + tooltip.id + "\">Collapse associated genotypes<i class=\"pg_expand_ontology_icon fa fa-plus-circle pg_cursor_pointer\"></i></div>"; 
            } else {
                returnHtml += "<br><div class=\"pg_insert_genotypes\" data-species=\"" + tooltip.data.targetGroup + "\" id=\"pg_insert_genotypes_" + tooltip.id + "\">Expand associated genotypes<i class=\"pg_expand_ontology_icon fa fa-plus-circle pg_cursor_pointer\"></i></div>"; 
            }
        }
		
		return returnHtml;	
	},

	genotype: function(tooltip) {
		var returnHtml = tooltip._type(tooltip.data.type, tooltip.data.id, tooltip.data.label)
                         + tooltip._rank() 
                         + tooltip._score() 
                         + tooltip._targetGroup();

		return returnHtml;	
	},

    disease: function(tooltip) {
		var returnHtml = tooltip._type(tooltip.data.type, tooltip.data.id, tooltip.data.label)
                         + tooltip._rank() 
                         + tooltip._score() 
                         + tooltip._targetGroup();

		return returnHtml;	
	},
    
	cell: function(tooltip, d) {
		var returnHtml = "";

		var suffix = "";
		var selCalc = tooltip.parent.state.selectedCalculation;

		var prefix, targetId, sourceId, targetInfo, sourceInfo;
		//var taxon = d.taxon;

        sourceId = d.source_id;
		targetId = d.target_id;
            
		if (tooltip.parent.state.invertAxis) {
			targetInfo = tooltip.parent.state.yAxisRender.get(d.target_id); 
			sourceInfo = tooltip.parent.state.xAxisRender.get(d.source_id); 			
		} else {
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
			"<tbody><tr><td>" +     
				"<b><u>" + Utils.capitalizeString(sourceInfo.type) + "</u></b><br>" + this.entityHreflink(sourceInfo.type, sourceId, d.a_label ) +  
				" " + Utils.formatScore(d.a_IC.toFixed(2)) + "<br>" + 
			"</td><tr><td><u><b><br>In-common</b></u><br>" + 
				this.entityHreflink(sourceInfo.type, d.subsumer_id, d.subsumer_label ) + " (" +
				Utils.formatScore(d.subsumer_IC.toFixed(2)) + ", " +
			    prefix + " " + d.value[tooltip.parent.state.selectedCalculation].toFixed(2) + '%' + ")<br>" +		
			"</td></tr>" +
			"<tr><td><br><u><b>Match</b></u><br>" + 
				this.entityHreflink(sourceInfo.type, d.b_id, d.b_label ) +
					Utils.formatScore(d.b_IC.toFixed(2))+ "</td></tr>" +
			"<tr><td><br><u><b>" + Utils.capitalizeString(targetInfo.type) + "</b></u><br>" + 
				this.entityHreflink(targetInfo.type, targetInfo.id, targetInfo.label) + 
				"<br>" + d.targetGroup + " (" + tooltip.parent._getTargetGroupTaxon(d.targetGroup) + ")</td>" + 			
			"</td></tr>" +
			"</tbody>" + "</table>";
		
		return returnHtml;	
	}


};


// CommonJS format
module.exports = TooltipRender;

}());