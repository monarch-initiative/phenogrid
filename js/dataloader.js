(function () {
'use strict';

var jQuery = require('jquery'); // Have to be 'jquery', can't use 'jQuery'

var Utils = require('./utils.js');

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
var DataLoader = function(simServerUrl, serverUrl, simSearchQuery, apiEntityMap, limit) {
	this.simServerURL = simServerUrl;
	this.serverURL = serverUrl;	
	this.simSearchURL = serverUrl + simSearchQuery;
//	this.qrySourceList = qrySourceList;
	this.qryString = '';
//	this.targetGroupList = targetGroupList;
	this.limit = limit;
	this.apiEntityMap = apiEntityMap;
	this.owlsimsData = [];
	this.origSourceList = [];
	this.maxICScore = 0;
	this.targetData = [];
	this.sourceData = [];
	this.cellData = [];
	this.ontologyCacheLabels = [];
	this.ontologyCache = [];
	this.postDataLoadCallback = '';
	//this.load(this.qrySourceList, this.targetGroupList, this.limit);

};

DataLoader.prototype = {
	constructor: DataLoader,

	/*
		Function: load

			fetch and load data from external source (i.e., owlsims)

		Parameters:	
			qrySourceList - list of source items to query
			targetGroup - list of targetGroup
			limit - value to limit targets returned
	*/
	load: function(qrySourceList, targetGroup, postDataLoadCB, limit) {
		var targetGroupList = [];

		// save the original source listing
		this.origSourceList = qrySourceList;

		if (typeof(targetGroup) === 'object') {
			targetGroupList = targetGroup;
		}
		else if (typeof(targetGroup) === 'string') { // for just string passed place it into an array
			targetGroupList = [targetGroup];
		}

	    this.qryString = 'input_items=' + qrySourceList.join("+");

		if (typeof(limit) !== 'undefined') {
	    	this.qryString += "&limit=" + limit;
		}

		this.postDataLoadCallback = postDataLoadCB;

		// begin processing
		this.process(targetGroupList, this.qryString);

	},

	process: function(targetGrpList, qryString) {
		var postData = '';

		if (targetGrpList.length > 0) {
			var target = targetGrpList[0];  // pull off the first to start processing
			targetGrpList = targetGrpList.slice(1);
	    	
	    	// need to add on target targetGroup id
	    	postData = qryString + "&target_species=" + target.taxon;

	    	var postFetchCallback = this.postSimsFetchCb;

			this.postFetch(this.simSearchURL, target, targetGrpList, postFetchCallback, postData);
		} else {
			this.postDataLoadCallback();  // make a call back to post data init function
		}
	},

	/*
		Function: postSimsFetchCb
		Callback function for the post async ajax call
	*/
	postSimsFetchCb: function(self, target, targetGrpList, data) {
		//var self = s;
		// save the original owlsim data
			self.owlsimsData[target.name] = data;

			if (typeof (data) !=='undefined' && data !== null) {
				// now transform data to there basic data structures
				self.transform(target.name, data);  
			}

			// iterative back to process to make sure we processed all the targetGrpList
			self.process(targetGrpList, self.qryString);
	},

	/*
		Function: transform

			transforms data from raw owlsims into simplified format
	
	 	Parameters:

	 		targetGroup - targetGroup name
	 		data - owlsims structured data
	*/
	transform: function(targetGroup, data) {      		

		if (typeof(data) !== 'undefined' &&
		    typeof (data.b) !== 'undefined') {
			console.log("transforming...");

			// extract the maxIC score; ugh!
			if (typeof (data.metadata) !== 'undefined') {
				this.maxICScore = data.metadata.maxMaxIC;
			}
			this.cellData[targetGroup] = [];
			this.targetData[targetGroup] = [];
			this.sourceData = [];

			//var variantNum = 0;
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

				var type = '';
				for (var j in this.apiEntityMap) {
				 	if (targetID.indexOf(this.apiEntityMap[j].prefix) === 0) {
				 		type = this.apiEntityMap[j].apifragment; 
				 	}
				}
				
				// build the target list
				var t = {"id":targetID, 
					 "label": item.label, 
					 "targetGroup": item.taxon.label, 
					 "taxon": item.taxon.id, 
					 "type": type, 
					 "rank": parseInt(idx)+1,  // start with 1 not zero
					 "score": item.score.score};  
				this.targetData[targetGroup][targetID] = t;

				var matches = data.b[idx].matches;
				var curr_row, lcs, dataVals;
				var sourceID_a, currID_b, currID_lcs;  // Added currID_b - Joe
				if (typeof(matches) !== 'undefined' && matches.length > 0) {

					var sum =0, count=0;
					for (var matchIdx in matches) 
					{
						curr_row = matches[matchIdx];
						sourceID_a = Utils.getConceptId(curr_row.a.id);
						currID_b = Utils.getConceptId(curr_row.b.id);
						currID_lcs = Utils.getConceptId(curr_row.lcs.id);

						// get the normalized IC
						lcs = Utils.normalizeIC(curr_row, this.maxICScore);

						var srcElement = this.sourceData[sourceID_a]; // this checks to see if source already exists

						// build a unique list of sources
						if (typeof(srcElement) === 'undefined') {
							dataVals = {"id":sourceID_a, "label": curr_row.a.label, "IC": parseFloat(curr_row.a.IC), //"pos": 0, 
											"count": count, "sum": sum, "type": "phenotype"};
							this.sourceData[sourceID_a] = dataVals;
							// if (!this.state.hpoCacheBuilt && this.state.preloadHPO){
							// 	this._getHPO(this.getConceptId(curr_row.a.id));
							// }
						} else {
							this.sourceData[sourceID_a].count += 1;
							this.sourceData[sourceID_a].sum += parseFloat(curr_row.lcs.IC);							
						}

						// building cell data points
						dataVals = {"source_id": sourceID_a, 
									"target_id": targetID, 
									"targetGroup": item.taxon.label,									
									"value": lcs, 
									"a_IC" : curr_row.a.IC,  
									"a_label" : curr_row.a.label,
									"subsumer_id": currID_lcs, 
									"subsumer_label": curr_row.lcs.label, 
									"subsumer_IC": parseFloat(curr_row.lcs.IC), 
									"b_id": currID_b,
									"b_label": curr_row.b.label, 
									"b_IC": parseFloat(curr_row.b.IC),
									"type": 'cell'};
							    
					    if (typeof(this.cellData[targetGroup][sourceID_a]) === 'undefined') {
							this.cellData[targetGroup][sourceID_a] = {};
					    }
					    if(typeof(this.cellData[targetGroup][sourceID_a][targetID]) === 'undefined') {
							this.cellData[targetGroup][sourceID_a][targetID] = {};
					    } 
					 	this.cellData[targetGroup][sourceID_a][targetID] = dataVals;
					}
				}  //if
			} // for
		} // if
	}, 

	/*
		Function: refresh

			freshes the data 
	
	 	Parameters:
			targetGroup - list of targetGroup (aka species) to fetch
	 		lazy - performs a lazy load of the data checking for existing data
	*/
	refresh: function(targetGroup, lazy) {
		var list = [], reloaded = false;
		if (lazy) {
			for (var idx in targetGroup) {
				if (this.dataExists(targetGroup[idx].name) === false) {
					list.push(targetGroup[idx]); // load to list to be reloaded
				}
			}
		} else {
			list = targetGroup;
		}
		// if list is empty, that means we already have data loaded for targetGroup, or possible none were passed in
		if (list.length > 0) {
			this.load(this.origSourceList, list, this.postDataLoadCallback);
			reloaded = true;
		}
		return reloaded;
	},

	/*
		Function: postFetch		
	 		generic ajax call for all POST queries

	 	Parameters:
	 		url - server url
	 		target - some target e.g., id
	 		targets - target list
	 		callback
	 		postData - data to be posted
	 */ 
	postFetch: function (url, target, targets, callback, postData) {
		var self = this;

		if (typeof(postData) != 'undefined') {
			console.log('POST:' + url);
			jQuery.ajax({
				url: url,
				method: 'POST', 
				data: postData,
				async : true,
				dataType : 'json',
				success : function(data) {
					callback(self, target, targets, data);
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
						console.log("exception: " + xhr.status + " " + exception);
						console.log("We're having some problems. Please check your network connection.");
						break;
					}
				} 
			});
		}
	},

	getFetch: function (self, url, target, callback, finalCallback, parent) {

			console.log('GET:' + url);
			jQuery.ajax({
				url: url,
				method: 'GET', 
				async : true,
				dataType : 'json',
				success : function(data) {
					callback(self, target, data, finalCallback, parent);					
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
						console.log("exception: " + xhr.status + " " + exception);
						console.log("We're having some problems. Please check your network connection.");
						break;
					}
				} 
			});
	},

	/*
		Function: getOntology

			gets the ontology for a given id; wraps scigraph call
	
	 	Parameters:
			id - id
	 		ontologyDirection - which direction to search for relationships
	 		ontologyDepth - how deep to go for relationships
	*/
	getOntology: function(id, ontologyDirection, ontologyDepth, finalCallback, parent) {
		var self = this;
		// check cached hashtable first
		var direction = ontologyDirection;
		var relationship = "subClassOf";
		var depth = ontologyDepth;

		// http://beta.monarchinitiative.org/neighborhood/HP_0003273/2/OUTGOING/subClassOf.json is the URL path - Joe

		var url = this.serverURL + "/neighborhood/" + id + "/" + depth + "/" + direction + "/" + relationship + ".json";

		var cb = this.postOntologyCb;

		// no postData parm will cause the fetch to do a GET, a pOST is not handled yet for the ontology lookup yet
		this.getFetch(self, url, id, cb, finalCallback, parent);

	},

	postOntologyCb: function(self, id, results, finalCallback, parent) {
		var ontologyInfo = [];	
		var nodes, edges;

		if (typeof (results) !== 'undefined') {
				edges = results.edges;
				nodes = results.nodes;
				// Labels/Nodes are done seperately to reduce redunancy as there might be multiple phenotypes with the same related nodes
				for (var i in nodes){
					if ( ! nodes.hasOwnProperty(i)) {
						break;
					}
					var lab = self.ontologyCacheLabels[nodes[i].id];
					if ( typeof(lab) == 'undefined' ||
						(nodes[i].id !== "MP:0000001" &&
						nodes[i].id !== "OBO:UPHENO_0001001" &&
						nodes[i].id !== "OBO:UPHENO_0001002" &&
						nodes[i].id !== "HP:0000118" &&
						nodes[i].id !== "HP:0000001")) {
						self.ontologyCacheLabels[nodes[i].id] = Utils.capitalizeString(nodes[i].lbl);
					}
				}

				// Used to prevent breaking objects
				for (var j in edges) {
					if ( ! edges.hasOwnProperty(j)) {
						break;
					}
					if (edges[j].obj !== "MP:0000001" &&
						edges[j].obj !== "OBO:UPHENO_0001001" &&
						edges[j].obj !== "OBO:UPHENO_0001002" &&
						edges[j].obj !== "HP:0000118" &&
						edges[j].obj !== "HP:0000001") {
						ontologyInfo.push(edges[j]);
					}
				}
			}

			// HACK:if we return a null just create a zero-length array for now to add it to hashtable
			// this is for later so we don't have to lookup concept again
			if (ontologyInfo === null) {
				ontologyInfo = {};
			}

			// save the ontology in cache for later
			var ontoData = {"edges": ontologyInfo, "active": 1};
			self.ontologyCache[id] = ontoData;
		
		// return results back to final callback
		finalCallback(ontoData, id, parent);
	},

	getOntologyLabel: function(id) {
		return this.ontologyCacheLabels[id];
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

	getOntologyCacheLabels: function() {
		return this.ontologyCacheLabels;
	},

	getMaxICScore: function() {
		return this.maxICScore;
	},

	dataExists: function(targetGroup) {
		var t = this.cellData[targetGroup]  || this.targetData[targetGroup];
		if (typeof(t) === 'undefined') {
			return false;
		}
		return true;
	},

	checkOntologyCache: function(id) {
		return this.ontologyCache[id];
	}


};

// CommonJS format
module.exports = DataLoader;

}());