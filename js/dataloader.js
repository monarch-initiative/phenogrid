/*
 	Package: dataloader.js

 	Class: DataLoader
  		handles all loading of the data external
 		servers, transformations.
 
 	Parameters:
 	 	parent - reference to parent calling object
 		serverUrl - sim server url
 		simSearchQuery - sim search query specific url string
 		apiEntityMap - entity map identifies the prefix maps (this is probably temporary)
 */
var DataLoader = function(serverUrl, simSearchQuery, qrySourceList, speciesList, apiEntityMap, limit) {
	this.simServerURL = serverUrl;
	this.simSearchQuery = simSearchQuery;
	this.qrySourceList = qrySourceList;
	this.speciesList = speciesList;
	this.limit = limit;
	this.apiEntityMap = apiEntityMap;
	this.owlsimsData = [];
	this.origSourceList;
	this.maxICScore = 0;
	this.targetData = [];
	this.sourceData = [];
	this.cellData = [];

	this.load(this.qrySourceList, this.speciesList, this.limit);

};

DataLoader.prototype = {
	constructor: DataLoader,

	/*
		Function: load

			fetch and load data from external source (i.e., owlsims)

		Parameters:	
			qrySourceList - list of source items to query
			species - list of species
			limit - value to limit targets returned
	*/
	load: function(qrySourceList, species, limit) {
		var res, speciesName = [];

		// save the original source listing
		this.origSourceList = qrySourceList;

		if (typeof(species) == 'object') {
			speciesName = species;
		}
		else if (typeof(species) == 'string') {
			speciesName = [species];
		}

		for (var i=0; i < speciesName.length; i++) {

	    	var url = this.simServerURL + this.simSearchQuery + qrySourceList.join("+");

		    if (typeof(speciesName[i]) !== 'undefined') {
		    	url += "&target_species=" + speciesName[i].taxon;
		    } 
		    if (typeof(limit) !== 'undefined') {
		    	url += "&limit=" + limit;
			}
		    console.log(url);

		    res = this.fetch(url);
		    //TODO: Make call to function below
			// jQuery.ajax({
			// 	url: url, 
			// 	async : false,
			// 	dataType : 'json',
			// 	success : function(data) {
			// 		res = data;
			// 	},
			// 	error: function (xhr, errorType, exception) { 
			// 		var msg;
			// 		// Triggered if an error communicating with server
			// 		switch(xhr.status){
			// 		case 404:
			// 		case 500:
			// 		case 501:
			// 		case 502:
			// 		case 503:
			// 		case 504:
			// 		case 505:
			// 		default:
			// 			msg = "We're having some problems. Please try again soon.";
			// 			break;
			// 		case 0: 
			// 			msg = "Please check your network connection.";
			// 			break;
			// 		}
			// 		console.log(msg);
			// 	} 
			// });	


			// if (typeof (res) !=='undefined' && res !== null) {
			// 	if (typeof(limit) !== 'undefined' && typeof(res.b) !== 'undefined' && res.b !== null && res.b.length < limit) {
			// 		res = this._padSpeciesData(res,speciesName,limit);
			// 	}
			// }
			// save the original owlsim data
			this.owlsimsData[speciesName[i].name] = res;

			if (typeof (res) !=='undefined' && res !== null) {
				// now transform data to there basic data structures
				this.transform(speciesName[i].name);   //res, speciesName[i].name);  
			}
		}

	},

	/*
		Function: transform

			transforms data from raw owlsims into simplified format
	
	 	Parameters:

	 		data - owlsims structured data
	 		species - species name
	*/
	transform: function(species) {      
		var data = this.owlsimsData[species];

		if (typeof(data) !== 'undefined' &&
		    typeof (data.b) !== 'undefined') {
			console.log("transforming...");

			// extract the maxIC score; ugh!
			if (typeof (data.metadata) !== 'undefined') {
				this.maxICScore = data.metadata.maxMaxIC;
			}
			this.cellData[species] = [];
			this.targetData[species] = []
			this.sourceData = [];

			var variantNum = 0;
			for (var idx in data.b) {
				var item = data.b[idx];
				var targetID = Utils.getConceptId(item.id);

				// [vaa12] HACK.  NEEDED FOR ALLOWING MODELS OF THE SAME ID AKA VARIANTS TO BE DISPLAYED W/O OVERLAP
				// SEEN MOST WITH COMPARE AND/OR EXOMISER DATA
				// if (this.contains("target", targetID)){
				// 	targetID += "_" + variantNum;
				// 	variantNum++;
				// }

				// TODO: THIS NEEDS CHANGED TO CATEGORY (I THINK MONARCH TEAM MENTIONED ADDING THIS)
				//type = this.parent.defaultApiEntity;
				for (var j in this.apiEntityMap) {
				 	if (targetID.indexOf(this.apiEntityMap[j].prefix) === 0) {
				 		type = this.apiEntityMap[j].apifragment;
				 	}
				}
				
				// build the target list
				var t = {"id":targetID, 
					 "label": item.label, 
					 "species": item.taxon.label, 
					 "taxon": item.taxon.id, 
					 "type": type, 
					 "rank": parseInt(idx)+1,  // start with 1 not zero
					 "score": item.score.score};  
				this.targetData[species][targetID] = t;

				var matches = data.b[idx].matches;
				var curr_row, lcs, cellPoint, dataVals;
				var sourceID_a, currID_lcs;
				if (typeof(matches) !== 'undefined' && matches.length > 0) {

					var sum =0, count=0;
					for (var matchIdx in matches) {
						curr_row = matches[matchIdx];
						sourceID_a = Utils.getConceptId(curr_row.a.id);
						currID_b = Utils.getConceptId(curr_row.b.id)
						currID_lcs = Utils.getConceptId(curr_row.lcs.id);

						lcs = Utils.normalizeIC(curr_row, this.maxICScore);

						//var srcElement = this.getElement("source", sourceID_a);
						var srcElement = this.sourceData[sourceID_a]; // this checks to see if source already exists

						// build a unique list of sources
						if (typeof(srcElement) == 'undefined') {
						//if (!this.contains("source", sourceID_a)) {

							dataVals = {"id":sourceID_a, "label": curr_row.a.label, "IC": parseFloat(curr_row.a.IC), //"pos": 0, 
											"count": count, "sum": sum, "type": "phenotype"};
							this.sourceData[sourceID_a] = dataVals;
							//sourceData.put(sourceID_a, hashDataVals);
							// if (!this.state.hpoCacheBuilt && this.state.preloadHPO){
							// 	this._getHPO(this.getConceptId(curr_row.a.id));
							// }
						} else {
							this.sourceData[sourceID_a].count += 1;
							this.sourceData[sourceID_a].sum += parseFloat(curr_row.lcs.IC);
							
							// console.log('source count: ' + sourceData[sourceID_a].count);
							// console.log('source sum' + sourceData[sourceID_a].sum);
						}

						// update values for sorting
						//var index = this.getElementIndex("source", sourceID_a);

						//if(  index > -1) {
							//sourceData[index].count += 1;
							//sourceData[index].sum += parseFloat(curr_row.lcs.IC);


						// building cell data points
						dataVals = {"source_id": sourceID_a, "target_id": targetID, "value": lcs, 
									"subsumer_label": curr_row.lcs.label, "subsumer_id": currID_lcs, 
									"subsumer_IC": parseFloat(curr_row.lcs.IC), "b_label": curr_row.b.label, 
									"species": item.taxon.label,
									"b_id": currID_b, "b_IC": parseFloat(curr_row.b.IC),
							    "rowid": sourceID_a + "_" + currID_lcs};						
					    if (typeof(this.cellData[species][sourceID_a]) == 'undefined') {
							this.cellData[species][sourceID_a] = {};
					    }
					    if(typeof(this.cellData[species][sourceID_a][targetID]) == 'undefined') {
							this.cellData[species][sourceID_a][targetID] = {};
					    }
					    this.cellData[species][sourceID_a][targetID] = dataVals;
					}
				}  //if
			} // for
		} // if
	}, 

	getTargets: function() {
		return this.targetData;
	},

	getSources: function() {
		return this.sourceData;
	},

	getCellData: function() {
		return this.cellData;
	},

	getMaxICScore: function() {
		return this.maxICScore;
	},

	refresh: function(species) {
		this.transform(species);
	},

	// generic ajax call for all queries
	fetch: function (url) {
		var self = this;
		var res;
		jQuery.ajax({
			url: url, 
			async : false,
			dataType : 'json',
			success : function(data) {
				res = data;
			},
			error: function (xhr, errorType, exception) { 
			// Triggered if an error communicating with server

			switch(xhr.status){
				case 404:
				case 500:
				case 501:
				case 502:
				case 503:
				case 504:
				case 505:
				default:
					console.log("We're having some problems. Please try again soon.");
					break;
				case 0: 
					console.log("Please check your network connection.");
					break;
				}
			} 
		});
		return res;
	}

}