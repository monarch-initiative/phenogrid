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

	entityHreflink: function() {
		var s = "<a href=\"" + this.url +"/" +  this.data.type +"/"+ this.id 
				+ "\" target=\"_blank\">" + this.data.label + "</a>";
		return s;
	},

	// main method for rendering tooltip content
	html: function(parms) {
		this.parent = parms.parent;
		this.data = parms.data;
		this.id = parms.id;

		// this creates the standard information portion of the tooltip, 
		var inf =  "<strong>" + this._capitalizeString(this.data.type) + ": </strong> " + this.entityHreflink() + "<br/>" +
				   this._rank() + this._score() + this._ic();

		// this creates the extended information for specialized tooltip info and functionality
		// try to dynamically invoke the function that matches the data.type
		try {
			var func = this.data.type;			
			inf += this[func](this);
		} catch(err) { console.log("searching for " + func);}

		return inf;
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
	var hpoCached = tooltip.parent.state.hpoCacheHash.get(tooltip.id.replace("_", ":"));
	if (hpoCached !== null && hpoCached.active == 1){
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
			returnHtml += "<i class=\"HPO_icon fa fa-minus-circle cursor_pointer \" onClick=\"self._collapseHPO('" + tooltip.id + "')\"></i>";
			returnHtml += hpoData;
		} else {
			returnHtml = "<br/><br/>Click button to <b>expand</b> HPO info &nbsp;&nbsp;";
			returnHtml += "<i class=\"HPO_icon fa fa-plus-circle cursor_pointer \" onClick=\"self._expandHPO('" + tooltip.id + "')\"></i>";
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
}

};

/********************************************************** 
	Expander: 
	handles expansion form a single source into a 
	set of targets
***********************************************************/
var Expander = function() {   // constructor
};

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
