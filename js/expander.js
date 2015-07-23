(function () {
'use strict';

var jQuery = require('jquery'); // Have to be 'jquery', can't use 'jQuery'

/********************************************************** 
	Expander: 
	handles expansion form a single source into a 
	set of targets
***********************************************************/
var Expander = function() {}; // constructor

Expander.prototype = {
	parentObject: null,
	constructor:Expander,
	
	// general expansion starts here
	getTargets: function(parms) {
		var targets = null;
		try {
			// infers function based on type
			var func = parms.modelData.type;					
			var modelData = parms.modelData
			this.parentObject = parms.parentRef.state;  // instance of phenoGrid
			targets = this[func](modelData);   
		} catch(err) { console.log(err.message);}
		return targets;
	},

	gene: function(model) {
					//this.parent = [id];
			//print("Expanding Gene...for id="+id);
			modelInfo = model;
			var targets = new Hashtable();
			var genotypeIds = "", phenotypeIds = "", genoTypeAssociations;
			var genotypeLabelHashtable = new Hashtable();

			// go get the assocated genotypes
			//var url = this.parentObject.serverURL+"/gene/"+ modelInfo.id.replace('_', ':') + ".json";		
			//var url = this.state.serverURL+"/genotypes/"+ modelInfo.id.replace('_', ':');
			
			// CALL THAT SHOULD WORK FROM ROSIE; NICOLE WILL WRAP THIS IN THE APP LAYER 4/9/15			
			var url = this.parentObject.serverURL + "/scigraph/dynamic/genes/" + modelInfo.id.replace('_', ':') +
			 			"/genotypes/targets.json";
			//http://rosie.crbs.ucsd.edu:9000/scigraph/dynamic/genes/MGI:101926/genotypes/targets.json 
			// THIS SHOULD WORK
			//http://tartini.crbs.ucsd.edu/dynamic/genes/NCBIGene:14183/genotypes/nodes.json
			console.log("Getting Gene " + url);
			//console.profile("genotypes call");
			var res = null; //this.parentObject._ajaxLoadData(modelInfo.d.species,url);

			jQuery.ajax({
				url: url, 
				async : false,
				dataType : 'json',
				success : function(data) {
					res = data;
				},
				error: function (xhr, errorType, exception) { 
					console.log("ajax error: " + xhr.status);					
				} 
			});

			// UNCOMMENT LATER WHEN SCIGRAPH GETS WORKING MORE CONSISTANT
			//res = this.parentObject._filterGenotypeGraphList(res);  // this is for the /scigraph call
			//console.profileEnd();

			// can't go any further if we do get genotypes
			if (typeof (res) == 'undefined' || res.length === 0) { 
			 	return null;
			}

			//genoTypeAssociations = res.genotype_associations;  // this works with old /gene call above
			genoTypeAssociations = res.nodes;  // this is for the /scigraph call

			if (genoTypeAssociations !== null && genoTypeAssociations.length > 5) {
				console.log("There are " + genoTypeAssociations.length + " associated genotypes");
			}

			//var assocPhenotypes = this.parentObject.getMatchingPhenotypes(modelInfo.id);
			var modelKeys = this.parentObject.cellDataHash.keys();
			var assocPhenotypes = [];
			var key = modelInfo.id;
			for (var i in modelKeys){
				if (key == modelKeys[i].yID) {				
					assocPhenotypes.push(modelKeys[i].xID);   // phenotype id is xID
				} else if (key == modelKeys[i].xID){
					assocPhenotypes.push(modelKeys[i].yID); // phenotype id is in the yID					
				}
			}
			var ctr = 0;

			// assemble the phenotype ids 
			for (var p in assocPhenotypes) {
				phenotypeIds += assocPhenotypes[p] + "+";
				ctr++;

				// limit number of genotypes do display based on internalOptions
				if (ctr > this.parentObject.phenoCompareLimit && ctr < assocPhenotypes.length) break;  
			}
			// truncate the last + off, if there
			if (phenotypeIds.slice(-1) == '+') {
				phenotypeIds = phenotypeIds.slice(0, -1);
			}

			ctr = 0;
			// assemble a list of genotypes
			for (var g in genoTypeAssociations) {
				//genotypeIds += genoTypeAssociations[g].genotype.id + "+";
				genotypeIds += genoTypeAssociations[g].id + "+";
				// fill a hashtable with the labels so we can quickly get back to them later
				//var tmpLabel = this._encodeHtmlEntity(genoTypeAssociations[g].genotype.label); 				
				//var tmpLabel = this.encodeHtmlEntity(genoTypeAssociations[g].genotype.label); // scigraph
				var tmpLabel = this.encodeHtmlEntity(genoTypeAssociations[g].lbl);  				
				tmpLabel = (tmpLabel === null ? "undefined" : tmpLabel);
				genotypeLabelHashtable.put(genoTypeAssociations[g].id, tmpLabel);
				ctr++;

				// limit number of genotypes do display based on internalOptions 
				if (ctr > this.parentObject.genotypeExpandLimit && ctr < genoTypeAssociations.length) break;  
			}

			// truncate the last + off, if there
			if (genotypeIds.slice(-1) == '+') {
				genotypeIds = genotypeIds.slice(0, -1);
			}

			// call compare
			var compareScores = null;
			url = this.parentObject.serverURL + "/compare/" + phenotypeIds + "/" + genotypeIds;
			console.log("Comparing " + url);
			//console.profile("compare call");
			//compareScores = this.parentObject._ajaxLoadData(modelInfo.d.species,url);
			jQuery.ajax({
				url: url, 
				async : false,
				dataType : 'json',
				success : function(data) {
					compareScores = data;
				},
				error: function (xhr, errorType, exception) { 
					console.log("ajax error: " + xhr.status);
				} 
			});

			if (compareScores != null) {
				var iPosition = 1;
				// rebuild the model list with genotypes
				for (var idx in compareScores.b) {
					var newGtLabel = genotypeLabelHashtable.get(compareScores.b[idx].id); 
					var gt = {
					parent: modelInfo.id,
					label: (newGtLabel !== null?newGtLabel:compareScores.b[idx].label), // if label was null, then use previous fixed label
				// if label was null, then use previous fixed label
					score: compareScores.b[idx].score.score, 
					species: modelInfo.d.species,
					rank: compareScores.b[idx].score.rank,
					type: "genotype",
					taxon: compareScores.b[idx].taxon.id,
					pos: (modelInfo.d.pos + iPosition),
					count: modelInfo.d.count,
					sum: modelInfo.d.sum
					};

					targets.put( compareScores.b[idx].id.replace('_', ':'), gt);
					//genoTypeList.put( this._getConceptId(compareScores.b[idx].id), gt);

					// Hack: need to fix the label because genotypes have IDs as labels
					compareScores.b[idx].label = genotypeLabelHashtable.get(compareScores.b[idx].id);

					iPosition++;
				}			
			} else {
				targets = null;
			}
			// return a complex object with targets and scores
			returnObj = {targets: targets, scores: compareScores};
		return returnObj;
	},
	encodeHtmlEntity: function(str) {
		if (str !== null) {
			return str
			.replace(/»/g, "&#187;")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
		}
		return str;
	}
};

// CommonJS format
module.exports = Expander;

}());