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

// Define the TooltipRender constructor, empty constructor
var TooltipRender = function() {};

// Add some methods to TooltipRender.prototype
TooltipRender.prototype = {
	constructor:TooltipRender,

	// main method for rendering tooltip content
    // params is an object {parent, id, data}
	html: function(parms) {
		this.parent = parms.parent;  // refers to the global this in phenogrid.js
        this.id = parms.id;
		this.data = parms.data; // data is either cell data or label data details - Joe

        var type = this.data.type;
        
        var htmlContent = '';

        if (type === 'phenotype') {
            var tooltipType = (typeof(type) !== 'undefined' ? "<strong>" + Utils.capitalizeString(type) + ": </strong> " + this.entityHreflink(type, this.id, this.data.label) + "<br/>" : "");
            var ic = (typeof(this.data.IC) !== 'undefined' ? "<strong>IC:</strong> " + this.data.IC.toFixed(2)+"<br/>" : "");
            var sum = (typeof(this.data.sum) !== 'undefined' ? "<strong>Sum:</strong> " + this.data.sum.toFixed(2)+"<br/>" : "");
            var frequency = (typeof(this.data.count) !== 'undefined' ? "<strong>Frequency:</strong> " + this.data.count +"<br/>" : "");

            htmlContent = tooltipType + ic + sum + frequency;
                            
            var expanded = false;
            var ontologyData = "<br>";

            var cached = this.parent.state.dataLoader.checkOntologyCache(this.id);

            if (typeof(cached) !== 'undefined') {
                expanded = true;

                //HACKISH, BUT WORKS FOR NOW.  LIMITERS THAT ALLOW FOR TREE CONSTRUCTION BUT DONT NEED TO BE PASSED BETWEEN RECURSIONS
                this.parent.state.ontologyTreesDone = 0;
                this.parent.state.ontologyTreeHeight = 0;
                var tree = "<div id='hpoDiv'>" + this.parent.buildOntologyTree(this.id.replace("_", ":"), cached.edges, 0) + "</div>";
                if (tree === "<br>"){
                    ontologyData += "<em>No Classification hierarchy Found</em>";
                } else {
                    ontologyData += "<strong>Classification hierarchy:</strong>" + tree;
                }
            }
            
            if (expanded){
                htmlContent += ontologyData;
            } else {
                htmlContent += "<br><div class=\"pg_expand_ontology\" id=\"pg_expandOntology_" + this.id + "\">Expand classification hierarchy<i class=\"pg_expand_ontology_icon fa fa-plus-circle pg_cursor_pointer\"></i></div>";
            }	
        } else if (this.data.type === 'cell') {

            var suffix = "";
            var selCalc = this.parent.state.selectedCalculation;

            var prefix, targetId, sourceId, targetInfo, sourceInfo;
            //var taxon = this.data.taxon;

            sourceId = this.data.source_id;
            targetId = this.data.target_id;
                
            if (this.parent.state.invertAxis) {
                targetInfo = this.parent.state.yAxisRender.get(this.data.target_id); 
                sourceInfo = this.parent.state.xAxisRender.get(this.data.source_id); 			
            } else {
                targetInfo = this.parent.state.xAxisRender.get(this.data.target_id); 
                sourceInfo = this.parent.state.yAxisRender.get(this.data.source_id); 						
            }

             
                // if (taxon !== undefined || taxon !== null || taxon !== '' || isNaN(taxon)) {
                // 	if (taxon.indexOf("NCBITaxon:") != -1) {
                // 		taxon = taxon.slice(10);
                // 	}
                // }

            for (var idx in this.parent.state.similarityCalculation) {	
                if (this.parent.state.similarityCalculation[idx].calc === this.parent.state.selectedCalculation) {
                    prefix = this.parent.state.similarityCalculation[idx].label;
                break;
                }
            }

            // If the selected calculation isn't percentage based (aka similarity) make it a percentage
            if (selCalc !== 2) {
                suffix = '%';
            }

            htmlContent = "<table class=\"pgtb\">" +
                "<tbody><tr><td>" +     
                    "<b><u>" + Utils.capitalizeString(sourceInfo.type) + "</u></b><br>" + this.entityHreflink(sourceInfo.type, sourceId, this.data.a_label ) +  
                    " " + Utils.formatScore(this.data.a_IC.toFixed(2)) + "<br>" + 
                "</td><tr><td><u><b><br>In-common</b></u><br>" + 
                    this.entityHreflink(sourceInfo.type, this.data.subsumer_id, this.data.subsumer_label ) + " (" +
                    Utils.formatScore(this.data.subsumer_IC.toFixed(2)) + ", " +
                    prefix + " " + this.data.value[this.parent.state.selectedCalculation].toFixed(2) + '%' + ")<br>" +		
                "</td></tr>" +
                "<tr><td><br><u><b>Match</b></u><br>" + 
                    this.entityHreflink(sourceInfo.type, this.data.b_id, this.data.b_label ) +
                        Utils.formatScore(this.data.b_IC.toFixed(2))+ "</td></tr>" +
                "<tr><td><br><u><b>" + Utils.capitalizeString(targetInfo.type) + "</b></u><br>" + 
                    this.entityHreflink(targetInfo.type, targetInfo.id, targetInfo.label) + 
                    "<br>" + this.data.targetGroup + " (" + this.parent._getTargetGroupTaxon(this.data.targetGroup) + ")</td>" + 			
                "</td></tr>" +
                "</tbody>" + "</table>";
        } else {
            var tooltipType = (typeof(type) !== 'undefined' ? "<strong>" + Utils.capitalizeString(type) + ": </strong> " + this.entityHreflink(type, this.id, this.data.label) + "<br/>" : "");
            var rank = (typeof(this.data.rank) !== 'undefined' ? "<strong>Rank:</strong> " + this.data.rank+"<br/>" : "");
            var score = (typeof(this.data.score) !== 'undefined' ? "<strong>Score:</strong> " + this.data.score+"<br/>" : "");	
            var species = (typeof(this.data.targetGroup) !== 'undefined' ? "<strong>Species:</strong> " + this.data.targetGroup+"<br/>" : "");

            htmlContent = tooltipType + rank + score + species;
            
            // Add genotype expansion link to genes
            if (type === 'gene') {
                /* DISABLED for now, just uncomment to ENABLE genotype expansion - Joe
                // for gene and single species mode only, add genotype expansion link
                if (this.parent.state.selectedCompareTargetGroup.length === 1) {
                    var expanded = this.parent.state.dataManager.isExpanded(this.id); // gene id

                    if (expanded){
                        htmlContent += "<br><div class=\"pg_expand_genotype\" data-species=\"" + this.data.targetGroup + "\" id=\"pg_remove_genotypes_" + this.id + "\">Remove associated genotypes<i class=\"pg_expand_genotype_icon fa fa-minus-circle pg_cursor_pointer\"></i></div>"; 
                    } else {
                        htmlContent += "<br><div class=\"pg_expand_genotype\" data-species=\"" + this.data.targetGroup + "\" id=\"pg_insert_genotypes_" + this.id + "\">Insert associated genotypes<i class=\"pg_expand_genotype_icon fa fa-plus-circle pg_cursor_pointer\"></i></div>"; 
                    }
                }
                */
            }
        }
        
         // Finally return the rendered HTML result
		return htmlContent;
	},
    
    // also encode the labels into html entities, otherwise they will mess up the tooltip content format
	entityHreflink: function(type, id, label) {
		return "<a href=\"" + this.parent.state.serverURL +"/" +  type +"/"+ id + "\" target=\"_blank\">" + Utils.encodeHtmlEntity(label) + "</a>";
	}
    
};


// CommonJS format
module.exports = TooltipRender;

}());