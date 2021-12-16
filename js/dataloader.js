(function () {
	'use strict';

	var $ = require('jquery'); // Have to be 'jquery', can't use 'jQuery'

	var Utils = require('./utils.js');

	/*
		 Package: dataloader.js

		 Class: DataLoader
			  handles all loading of the data external
			 servers, transformations.

		 Parameters:
			 serverUrl - sim server url
			 useSimSearchQuery - whether to perform compare (false) or search (true)
			limit - cutoff number
	 */

	function isBioLinkServer(serverURL) {
		return serverURL.indexOf('https://api.monarchinitiative.org') === 0
			|| serverURL.indexOf('https://api-dev.monarchinitiative.org') === 0;
	}

	function buildSearchQuery(useBioLink, inputItemsString, qrySourceList) {
		// console.log('buildSearchQuery', useBioLink, inputItemsString, qrySourceList);
		if (useBioLink) {
			var result = inputItemsString + qrySourceList.join("&id=");
		}
		else {
			var result = inputItemsString + qrySourceList.join("+");
		}
		return result;
	}

	function buildCompareQuery(useBioLink, sourceList, compareList) {
		if (useBioLink) {
			//var result = "?is_feature_set=false&?ref_id=" + sourceList.join("&ref_id=") + "&query_id=" + compareList.join("&query_id=");
			// Figure out if we have either both hpo terms or not
			var isAllPhenotypes = compareList.filter(item => {
				return item.includes("HP:");
			});
			var feature_set = isAllPhenotypes.length > 0;
			var result = {
				"is_feature_set": feature_set,
				"reference_ids": sourceList,
				"query_ids": compareList
			}
		}
		else {
			var result = sourceList.join("+") + '/' + compareList.join(",");
		}
		return result;
	}

	// Define the DataLoader constructor using an object constructor function
	var DataLoader = function(serverURL, useSimSearchQuery, limit, forceBiolink=false) {
		this.serverURL = serverURL;
		this.forceBiolink = forceBiolink;
		var useBioLink = isBioLinkServer(serverURL) || forceBiolink;

		if (useSimSearchQuery) {
			if (useBioLink) {
				// https://api.monarchinitiative.org/api/sim/search?id=HP%3A0000006&id=HP%3A0000174&limit=100
				this.simQuery = { // HTTP POST
					URL: 'sim/search',
					inputItemsString: 'id=', // HTTP POST, body parameter
					targetSpeciesString: '&taxon=', // HTTP POST, body parameter
					limitString: '&limit'
				};
			}
			else {
				this.simQuery = { // HTTP POST
					URL: '/simsearch/phenotype',
					inputItemsString: 'input_items=', // HTTP POST, body parameter
					targetSpeciesString: '&target_species=', // HTTP POST, body parameter
					limitString: '&limit'
				};
			}
		}
		else {
			if (useBioLink) {
				this.simQuery = {
					URL: 'sim/compare'
				};
			}
			else {
				this.simQuery = { // compare API takes HTTP GET, so no body parameters
					URL: '/compare' // used for owlSimFunction === 'compare' and genotype expansion compare simsearch - Joe
				};
			}
		}

		this.qryString = '';
		this.groupsNoMatch = []; // contains group names that don't have simsearch matches
		this.limit = limit;
		this.owlsimsData = [];
		this.origSourceList = [];
		this.maxMaxIC = 0;
		this.targetData = {};
		this.sourceData = {};
		this.cellData = {};
		this.ontologyCacheLabels = [];
		this.ontologyCache = [];
		this.loadedNewTargetGroupItems = {}; // named array, no need to specify group since each gene ID is unique
		this.postDataLoadCallback = '';
	};

	// Add methods to DataLoader.prototype
	DataLoader.prototype = {
		constructor: DataLoader,

		/*
			Function: load

				fetch and load data from external source (i.e., owlsims)

			Parameters:
				sourceList - list of source items to query
				targetGroupList - list of targetGroups, array
				limit - value to limit targets returned
		*/
		load: function(sourceList, compareList, asyncDataLoadingCallback, limit) {
			// save the original source listing
			// The qrySourceList has already had all duplicated IDs removed in _parseQuerySourceList() of phenogrid.js - Joe
			this.origSourceList = sourceList;

			var useBioLink = isBioLinkServer(this.serverURL) || this.forceBiolink;
			// this.qryString = this.simQuery.inputItemsString + qrySourceList.join("+");
			this.qryString = buildSearchQuery(
				useBioLink,
				this.simQuery.inputItemsString,
				sourceList);

			// limit is used in analyze/phenotypes search mode
			// can also be used in general simsearch query - Joe
			if (typeof(limit) !== 'undefined') {
				this.qryString += this.simQuery.limitString + limit;
			}

			this.postDataLoadCallback = asyncDataLoadingCallback;

			// begin processing
			this.process(compareList, this.qryString);
		},

		/*
			Function: loadCompareData

				fetch and load data from the monarch compare api

			Parameters:
				qrySourceList - list of source items to query
				compareList - list of compare items to query
				asyncDataLoadingCallback - callback
		*/
		loadCompareData: function(targetGroup, sourceList, compareList, asyncDataLoadingCallback) {
			this.postDataLoadCallback = asyncDataLoadingCallback;

			// save the original source listing
			// The qrySourceList has already had all duplicated IDs removed in _parseQuerySourceList() of phenogrid.js - Joe
			this.origSourceList = sourceList;

			// example: monarchinitiative.org/compare/HP:0000726+HP:0000746+HP:0001300/NCBIGene:388552,NCBIGene:12166
			// this.qryString = this.serverURL + this.simQuery.URL + '/' + qrySourceList.join("+") + '/' + geneList.join(",");

			var useBioLink = isBioLinkServer(this.serverURL) || this.forceBiolink;
			var postBody = buildCompareQuery(
				useBioLink,
				sourceList,
				compareList);

			var self = this;

			var jqxhr = $.ajax({
				url: this.serverURL + self.simQuery.URL,
				method: 'POST',
				data: JSON.stringify(postBody),
				async : true,
				dataType : 'json',
				contentType: "application/json",
			});

			jqxhr.done(function(data) {
				// sometimes the compare api doesn't find any matches, we need to stop here - Joe
				if (typeof (data.matches) === 'undefined') {
					// Add the 'compare' name to the groupsNoMatch array
					self.groupsNoMatch.push(targetGroup);
				} else {
					// use 'compare' as the key of the named array
					var legacyMetadata = {
						'maxMaxIC': data.metadata.max_max_ic	// '14.87790',
					};
					data = self.mapBioLinkToLegacySchema(data, legacyMetadata);
					self.transform(targetGroup, data);
				}

				self.postDataLoadCallback();
			});

			jqxhr.fail(function () {
				console.log('Ajax error - loadCompareData()')
			});
		},

		/*
			Function: process

				process routine being async query to load data from external source (i.e., owlsims)

			Parameters:
				targetGrpList - list of target Group items (i.e., group)
				qryString - query list url parameters, which includes list of sources
		*/
		process: function(targetGrpList, qryString) {
			if (targetGrpList.length > 0) {
				var target = targetGrpList[0];  // pull off the first to start processing
				targetGrpList = targetGrpList.slice(1);

				// // need to add on target targetGroup groupId
				// var postData = qryString + this.simQuery.targetSpeciesString + target.groupId;
				var isBioLink = isBioLinkServer(this.serverURL) || this.forceBiolink;
				var postFetchCallback = isBioLink ?
					this.postSimsFetchBioLinkCb :
					this.postSimsFetchCb;

				this.postFetch(
					this.serverURL,
					this.simQuery.URL,
					target,
					targetGrpList,
					postFetchCallback,
					qryString,
					this.simQuery.targetSpeciesString,
					target.groupId);
			} else {
				this.postDataLoadCallback();  // make a call back to post data init function
			}
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
		postFetch: function (url, queryURL, target, targets, callback, qryString, targetSpeciesString, targetGroupId) {
			var self = this;
			var useBioLink = isBioLinkServer(url) || this.forceBiolink;

			if (useBioLink) {
				var getData = qryString + targetSpeciesString + targetGroupId;
				// Separate the ajax request with callbacks
				var jqxhr = $.ajax({
					url: url + queryURL,
					method: 'GET',
					data: getData,
					async : true,
					timeout: 60000,
					dataType : 'json'
				});
				jqxhr.done(function(data) {
					// console.log('doneget', target, targets, data);
					callback(self, target, targets, data);
				});

				jqxhr.fail(function(jqXHR, textStatus, errorThrown) {
					console.log('Ajax error - postFetch()', jqXHR, textStatus, errorThrown);
				});
			   }
			   else {
				   var postData = qryString + targetSpeciesString + targetGroupId;
				// Separate the ajax request with callbacks
				var jqxhr = $.ajax({
					url: url + queryURL,
					method: 'POST',
					data: postData,
					async : true,
					timeout: 60000,
					dataType : 'json'
				});
				jqxhr.done(function(data) {
					// console.log('donepost', target, targets, data);
					callback(self, target, targets, data);
				});

				jqxhr.fail(function(jqXHR, textStatus, errorThrown) {
					console.log('Ajax error - postFetch()', jqXHR, textStatus, errorThrown);
				});
			   }

		},

		mapBioLinkToLegacySchema(data, legacyMetadata){
			return {
				a: data.query.ids.map(function(i) {
					return i.id;
				}),
				b: this.legacyMatches(data.matches),
				metadata: legacyMetadata,
				ids: data.query.ids
			};
		},

		legacyMatches(bioLinkMatches) {
			return bioLinkMatches.map(function(e) {
				var legacy = Object.assign({}, e);
				legacy.matches = [];
				legacy.pairwise_match.forEach(function(m) {
					legacy.matches.push({
						a: m.reference,
						b: m.match,
						lcs: m.lcs
					});
				});
				delete legacy.pairwise_match;
				legacy.score = {
					score: legacy.score
				};
				return legacy;
			});
		},

		/*
			Function: postSimsFetchBioLinkCb
			Callback function for the post async ajax call
		*/
		postSimsFetchBioLinkCb: function(self, target, targetGrpList, data) {
			// console.log('postSimsFetchBioLinkCb', target, targetGrpList, data);

			var legacyMetadata = {
				'maxMaxIC': data.metadata.max_max_ic	// '14.87790',
			};
			var legacyData = self.mapBioLinkToLegacySchema(data, legacyMetadata);

			if (legacyData !== null || typeof(legacyData) !== 'undefined') {
				// legacyData.b contains all the matches, if not present, then no matches - Joe
				if (typeof(legacyData.b) === 'undefined' || legacyData.b.length === 0) {
					// Add the group name to the groupsNoMatch array
					self.groupsNoMatch.push(target.groupName);
				} else {
					// save the original raw owlsim data
					self.owlsimsData[target.groupName] = legacyData;
					// now transform data to there basic data structures
					self.transform(target.groupName, legacyData);
				}
			}
			// iterative back to process to make sure we processed all the targetGrpList
			self.process(targetGrpList, self.qryString);
		},

		postSimsFetchCb: function(self, target, targetGrpList, data) {
			// console.log('postSimsFetchCb', target, targetGrpList, data);
			if (data !== null || typeof(data) !== 'undefined') {
				// data.b contains all the matches, if not present, then no matches - Joe
				if (typeof(data.b) === 'undefined') {
					// Add the group name to the groupsNoMatch array
					self.groupsNoMatch.push(target.groupName);
				} else {
					// save the original raw owlsim data
					self.owlsimsData[target.groupName] = data;
					// now transform data to there basic data structures
					self.transform(target.groupName, data);
				}
			}
			// iterative back to process to make sure we processed all the targetGrpList
			self.process(targetGrpList, self.qryString);
		},

		/*
			Function: transform

				transforms data from raw owlsims into simplified format

				 For a given model, extract the sim search data including IC scores and the triple:
				The a column, b column, and lowest common subsumer for the triple's IC score, use the LCS score

			 Parameters:

				 targetGroup - targetGroup name
				 data - owlsims structured data
		*/
		transform: function(targetGroup, data) {
			// console.log('transform', targetGroup, data.a.length, data.b.length, this.sourceData);
			if (typeof(data) !== 'undefined' && typeof (data.b) !== 'undefined') {
				// console.log("Transforming simsearch data of group: " + targetGroup);

				// sometimes the 'metadata' field might be missing from the JSON - Joe
				// extract the maxIC score; ugh!
				if (typeof (data.metadata) !== 'undefined') {
					this.maxMaxIC = data.metadata.maxMaxIC;
				}
				if (typeof (data.ids) !== 'undefined') {
					this.ids = data.ids;
				}

				// just initialize the specific targetGroup

				// Here we don't reset the cellData, targetData, and sourceData every time,
				// because we want to append the genotype expansion data - Joe
				// No need to redefine this in transformNewTargetGroupItems() - Joe
				if (typeof(this.cellData[targetGroup]) === 'undefined') {
					this.cellData[targetGroup] = {};
				}
				if (typeof(this.targetData[targetGroup]) === 'undefined') {
					this.targetData[targetGroup] = {};
				}
				if (typeof(this.sourceData[targetGroup]) === 'undefined') {
					this.sourceData[targetGroup] = {};
				}

				for (var idx in data.b) {
					var item = data.b[idx];
					var targetID = Utils.getConceptId(item.id);

					// this change addresses issue #253
					var species = item.taxon.label;
					if (!species || species === "Not Specified") {
					   species = targetGroup;
					}
					// build the target list
					var targetVal = {
						"id":targetID,
						"label": item.label,
						"targetGroup": species ,
						//"targetGroup": targetGroup, // sometimes item.taxon.label is missing from result, use targetGroup instead - Joe
						"type": item.type,
						"rank": parseInt(idx)+1,  // start with 1 not zero
						"score": item.score.score
					};

					// We need to define this here since the targetID is newly added here, doesn't exist before - Joe
					if (typeof(this.targetData[targetGroup][targetID]) === 'undefined') {
						this.targetData[targetGroup][targetID] = {};
					}

					this.targetData[targetGroup][targetID] = targetVal;

					var matches = data.b[idx].matches;
					var curr_row, lcs, dataVals;
					var sourceID_a, currID_b, currID_lcs;
					if (typeof(matches) !== 'undefined' && matches.length > 0) {
						for (var matchIdx in matches) {
							// E.g., matches[i].b is one of the input phenotypes, witch matches to matches[i].a in the mouse
							// via the least common subumser (lcs) match[i].lcs. - Joe
							var sum = 0, count = 0;
							curr_row = matches[matchIdx];
							sourceID_a = Utils.getConceptId(curr_row.a.id);
							currID_b = Utils.getConceptId(curr_row.b.id);
							currID_lcs = Utils.getConceptId(curr_row.lcs.id);

							// get the normalized IC
							lcs = Utils.normalizeIC(curr_row, this.maxMaxIC);

							var srcElement = this.sourceData[targetGroup][sourceID_a]; // this checks to see if source already exists

							// build a unique list of sources
							if (typeof(srcElement) === 'undefined') {
								count++;
								sum += parseFloat(curr_row.lcs.IC);

								// create a new source object
								dataVals = {
									"id":sourceID_a,
									"label": curr_row.a.label,
									"IC": parseFloat(curr_row.a.IC),
									"count": count,
									"sum": sum,
									"type": "phenotype"
								};

								this.sourceData[targetGroup][sourceID_a] = dataVals;
							} else {
								this.sourceData[targetGroup][sourceID_a].count += 1;
								this.sourceData[targetGroup][sourceID_a].sum += parseFloat(curr_row.lcs.IC);
							}
							// building cell data points
							dataVals = {
								"source_id": sourceID_a,
								"target_id": targetID,
								"targetGroup": targetGroup,
								"value": lcs,
								"a_IC" : curr_row.a.IC,
								"a_label" : curr_row.a.label,
								"subsumer_id": currID_lcs,
								"subsumer_label": curr_row.lcs.label,
								"subsumer_IC": parseFloat(curr_row.lcs.IC),
								"b_id": currID_b,
								"b_label": curr_row.b.label,
								"b_IC": parseFloat(curr_row.b.IC),
								"type": 'cell'
							};

							// we need to define this before adding the data to named array, otherwise will get 'cannot set property of undefined' error
							// No need to redefine this in transformNewTargetGroupItems() - Joe
							if (typeof(this.cellData[targetGroup][sourceID_a]) === 'undefined') {
								this.cellData[targetGroup][sourceID_a] = {};
							}
							 this.cellData[targetGroup][sourceID_a][targetID] = dataVals;
						}
					}
				}
			}
		},

		/*
			Function: transformNewTargetGroupItems

				transforms data from raw owlsims into simplified format

				 For a given model, extract the sim search data including IC scores and the triple:
				The a column, b column, and lowest common subsumer for the triple's IC score, use the LCS score

			 Parameters:

				 targetGroup - targetGroup name
				 data - owlsims structured data
				parentGeneID - the parent gene ID that these genotypes are associated with
		*/
		transformNewTargetGroupItems: function(targetGroup, data, parentGeneID) {
			if (typeof(data) !== 'undefined' && typeof (data.b) !== 'undefined') {

				console.log("transforming genotype data...");

				// extract the maxIC score; ugh!
				if (typeof (data.metadata) !== 'undefined') {
					this.maxMaxIC = data.metadata.max_max_ic;
				}

				// no need to initialize the specific targetGroup
				// since they should've been set
				for (var idx in data.b) {
					var item = data.b[idx];
					var targetID = Utils.getConceptId(item.id);

					// build the target list
					var targetVal = {
						"id":targetID,
						"label": item.label,
						"targetGroup": item.taxon.label, // item.taxon.label is 'Not Specified' for fish sometimes
						//"targetGroup": targetGroup, // we use the provided targetGroup as a quick fix - Joe
						"type": item.type,
						'parentGeneID': parentGeneID, // added this for each added genotype so it knows which gene to be associated with - Joe
						"rank": parseInt(idx)+1,  // start with 1 not zero
						"score": item.score.score,
						"visible": true // set all newly added genotypes as visible, and update this when removing them from axis - Joe
					};

					// We need to define this again here since the targetID is newly added here, doesn't exist before - Joe
					if (typeof(this.targetData[targetGroup][targetID]) === 'undefined') {
						this.targetData[targetGroup][targetID] = {};
					}

					this.targetData[targetGroup][targetID] = targetVal;

					var matches = data.b[idx].matches;
					var curr_row, lcs, dataVals;
					var sourceID_a, currID_b, currID_lcs;
					if (typeof(matches) !== 'undefined' && matches.length > 0) {
						for (var matchIdx in matches) {
							var sum = 0, count = 0;
							curr_row = matches[matchIdx];
							sourceID_a = Utils.getConceptId(curr_row.a.id);
							currID_b = Utils.getConceptId(curr_row.b.id);
							currID_lcs = Utils.getConceptId(curr_row.lcs.id);

							// get the normalized IC
							lcs = Utils.normalizeIC(curr_row, this.maxMaxIC);

							if(typeof(this.sourceData[targetGroup]) === 'undefined') {
								this.sourceData[targetGroup] = {};
							}

							var srcElement = this.sourceData[targetGroup][sourceID_a]; // this checks to see if source already exists

							// build a unique list of sources
							if (typeof(srcElement) === 'undefined') {
								count++;
								sum += parseFloat(curr_row.lcs.IC);

								// create a new source object
								dataVals = {
									"id":sourceID_a,
									"label": curr_row.a.label,
									"IC": parseFloat(curr_row.a.IC),
									"count": count,
									"sum": sum,
									"type": "phenotype"
								};

								this.sourceData[targetGroup][sourceID_a] = dataVals;
							} else {
								this.sourceData[targetGroup][sourceID_a].count += 1;
								this.sourceData[targetGroup][sourceID_a].sum += parseFloat(curr_row.lcs.IC);
							}

							// building cell data points
							dataVals = {
								"source_id": sourceID_a,
								"target_id": targetID,
								"target_type": 'genotype', // to mark this cell is generated for genotype expansion - Joe
								"targetGroup": item.taxon.label,
								//"targetGroup": targetGroup,
								"value": lcs,
								"a_IC" : curr_row.a.IC,
								"a_label" : curr_row.a.label,
								"subsumer_id": currID_lcs,
								"subsumer_label": curr_row.lcs.label,
								"subsumer_IC": parseFloat(curr_row.lcs.IC),
								"b_id": currID_b,
								"b_label": curr_row.b.label,
								"b_IC": parseFloat(curr_row.b.IC),
								"type": 'cell'
							};

							// We need to define this here since we may have new matches for existing phenotypes which wasn't in the cellData before - Joe
							if (typeof(this.cellData[targetGroup][sourceID_a]) === 'undefined') {
								this.cellData[targetGroup][sourceID_a] = {};
							}

							 this.cellData[targetGroup][sourceID_a][targetID] = dataVals;
						}
					}  //if
				} // for
			} // if
		},

		loadCompareDataForVendor: function(qrySourceList, targetGroupList, asyncDataLoadingCallback, multiTargetsModeTargetLengthLimit) {
			// save the original source listing
			// The qrySourceList has already had all duplicated IDs removed in _parseQuerySourceList() of phenogrid.js - Joe
			this.origSourceList = qrySourceList;

			// use the default comma to separate each list into each genotype profile
			// example: monarchinitiative.org/compare/HP:0000726+HP:0000746+HP:0001300/MP+MP+MP,MP+MP,MP+MP+MP+MP...
			this.qryString = this.serverURL + this.simQuery.URL + '/' + qrySourceList.join("+") + '/';
			this.postDataLoadCallback = asyncDataLoadingCallback;

			// begin processing
			this.processDataForVendor(targetGroupList, this.qryString, multiTargetsModeTargetLengthLimit);
		},

		processDataForVendor: function(targetGrpList, qryString, multiTargetsModeTargetLengthLimit) {
			if (targetGrpList.length > 0) {
				var target = targetGrpList[0];  // pull off the first to start processing
				targetGrpList = targetGrpList.slice(1);


				var listOfListsPerTargetGroup = [];
				for (var j = 0; j < target.entities.length; j++) {
					var eachList = [];
					for (var k = 0; k < target.entities[j].phenotypes.length; k++) {
						eachList.push(target.entities[j].phenotypes[k].id);
					}
					// add new property
					target.entities[j].combinedList = eachList.join('+');

					// default separator of array.join(separator) is comma
					// join all the MP inside each MP list with plus sign, and join each list with default comma
					listOfListsPerTargetGroup.push(target.entities[j].combinedList);
				}


				// use the default comma to separate each list into each genotype profile
				// example: monarchinitiative.org/compare/HP:0000726+HP:0000746+HP:0001300/MP+MP+MP,MP+MP,MP+MP+MP+MP...
				var qryStringPerTargetGroup = qryString + listOfListsPerTargetGroup.join();

				var self = this;

				// Separate the ajax request with callbacks
				var jqxhr = $.ajax({
					url: qryStringPerTargetGroup,
					method: 'GET',
					async : true,
					dataType : 'json'
				});

				jqxhr.done(function(data) {
					//console.log('compare data loaded:');
					//console.log(data);

					// sometimes the compare api doesn't find any matches, we need to stop here - Joe
					if (typeof (data.b) === 'undefined') {
						// Add the target.groupName to the groupsNoMatch array
						self.groupsNoMatch.push(target.groupName);
					} else {
						// Will use target.groupName as the key of the named array
						self.transformDataForVendor(target, data, multiTargetsModeTargetLengthLimit);
					}

					// iterative back to process to make sure we processed all the targetGrpList
					self.processDataForVendor(targetGrpList, self.qryString, multiTargetsModeTargetLengthLimit);
				});

				jqxhr.fail(function () {
					console.log('Ajax error - processDataForVendor()')
				});
			} else {
				this.postDataLoadCallback();  // make a call back to post data init function
			}
		},

		transformDataForVendor: function(target, data, multiTargetsModeTargetLengthLimit) {
			if (typeof(data) !== 'undefined' && typeof (data.b) !== 'undefined') {
				console.log("Vendor Data transforming...");

				var targetGroupId = target.groupId;
				var targetGroup = target.groupName;

				// sometimes the 'metadata' field might be missing from the JSON - Joe
				// extract the maxIC score; ugh!
				if (typeof (data.metadata) !== 'undefined') {
					this.maxMaxIC = data.metadata.maxMaxIC;
				}

				// just initialize the specific targetGroup
				// Here we don't reset the cellData, targetData, and sourceData every time,
				// because we want to append the genotype expansion data - Joe
				// No need to redefine this in transformNewTargetGroupItems() - Joe

				if (typeof(this.targetData[targetGroup]) === 'undefined') {
					this.targetData[targetGroup] = {};
				}
				if (typeof(this.sourceData[targetGroup]) === 'undefined') {
					this.sourceData[targetGroup] = {};
				}
				if (typeof(this.cellData[targetGroup]) === 'undefined') {
					this.cellData[targetGroup] = {};
				}

				// Modify the resulting JSON
				// In this case, the id is a list of MP ids, e.g., MP:0000074+MP:0000081+MP:0000097+MP:0000189
				// we'll need to use the genotype id (IMPC internal) from input data as the new ID
				// Keep in mind that some lists may not have any simsearch matches, so the order of results don't always match the input impc JSON
				for (var i in data.b) {
					for (var j in target.entities) {
						if (data.b[i].id === target.entities[j].combinedList) {
							// add new id
							data.b[i].newid = target.entities[j].id;
							// add label with genotype label
							data.b[i].label = target.entities[j].label;
							// add phenodigm score
							data.b[i].phenodigmScore = target.entities[j].score;
							// add info for tooltip rendering
							data.b[i].info = target.entities[j].info;

							break;
						}
					}
				}

				for (var idx in data.b) {
					var item = data.b[idx];
					// In this case, the id is a list of MP ids, e.g., MP:0000074+MP:0000081+MP:0000097+MP:0000189
					// we'll need to use the genotype id (IMPC internal) as the new ID
					// Add prefix of groupId, otherwise may have javascript array ordering issues - Joe
					var targetID = target.groupId + item.newid;

					// build the target list
					var targetVal = {
						"id": targetID,
						"label": item.label,
						"targetGroup": targetGroup, // Mouse
						"type": "genotype", // Needs to be dynamic instead of hard coded - Joe
						"info": item.info, // for tooltip rendering
						"rank": parseInt(idx)+1,  // start with 1 not zero
						"score": Math.round(item.phenodigmScore.score) // rounded to the nearest integer, used in _createTextScores() in phenogrid.js
					};

					// We need to define this here since the targetID is newly added here, doesn't exist before - Joe
					if (typeof(this.targetData[targetGroup][targetID]) === 'undefined') {
						this.targetData[targetGroup][targetID] = {};
					}

					this.targetData[targetGroup][targetID] = targetVal;

					var matches = data.b[idx].matches;
					var curr_row, lcs, dataVals;
					var sourceID_a, currID_b, currID_lcs;
					if (typeof(matches) !== 'undefined' && matches.length > 0) {
						for (var matchIdx in matches) {
							// E.g., matches[i].b is one of the input phenotypes, witch matches to matches[i].a in the mouse
							// via the least common subumser (lcs) match[i].lcs. - Joe
							var sum = 0, count = 0;
							curr_row = matches[matchIdx];
							sourceID_a = Utils.getConceptId(curr_row.a.id);
							currID_b = Utils.getConceptId(curr_row.b.id);
							currID_lcs = Utils.getConceptId(curr_row.lcs.id);

							// get the normalized IC
							lcs = Utils.normalizeIC(curr_row, this.maxMaxIC);

							var srcElement = this.sourceData[targetGroup][sourceID_a]; // this checks to see if source already exists

							// build a unique list of sources
							if (typeof(srcElement) === 'undefined') {
								count++;
								sum += parseFloat(curr_row.lcs.IC);

								// create a new source object
								dataVals = {
									"id":sourceID_a,
									"label": curr_row.a.label,
									"IC": parseFloat(curr_row.a.IC),
									"count": count,
									"sum": sum,
									"type": "phenotype"
								};

								this.sourceData[targetGroup][sourceID_a] = dataVals;
							} else {
								this.sourceData[targetGroup][sourceID_a].count += 1;
								this.sourceData[targetGroup][sourceID_a].sum += parseFloat(curr_row.lcs.IC);
							}

							// building cell data points
							dataVals = {
								"source_id": sourceID_a,
								"target_id": targetID,
								"targetGroup": targetGroup,
								"value": lcs,
								"a_IC" : curr_row.a.IC,
								"a_label" : curr_row.a.label,
								"subsumer_id": currID_lcs,
								"subsumer_label": curr_row.lcs.label,
								"subsumer_IC": parseFloat(curr_row.lcs.IC),
								"b_id": currID_b,
								"b_label": curr_row.b.label,
								"b_IC": parseFloat(curr_row.b.IC),
								"type": 'cell'
							};

							// we need to define this before adding the data to named array, otherwise will get 'cannot set property of undefined' error
							// No need to redefine this in transformNewTargetGroupItems() - Joe
							if (typeof(this.cellData[targetGroup][sourceID_a]) === 'undefined') {
								this.cellData[targetGroup][sourceID_a] = {};
							}

							 this.cellData[targetGroup][sourceID_a][targetID] = dataVals;
						}
					}
				}
			}
		},


		/*
			Function: refresh

				freshes the data

			 Parameters:
				targetGroup - list of targetGroup (aka group) to fetch
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


		getFetch: function (self, url, target, callback, finalCallback, parent) {
			console.log('GET:' + url);

			// Separate the ajax request with callbacks
			var jqxhr = $.ajax({
				url: url,
				method: 'GET',
				async : true,
				dataType : 'json',
			});

			jqxhr.done(function(data) {
				callback(self, target, data, finalCallback, parent);
			});

			jqxhr.fail(function () {
				console.log('Ajax error - getFetch()')
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
			var relationship = parent.state.ontologyRelationship;
			var depth = ontologyDepth;

			// https://monarchinitiative.org/neighborhood/HP_0003273/2/OUTGOING/subClassOf.json is the URL path - Joe

			var url = this.serverURL + parent.state.ontologyQuery + id + "/" + depth + "/" + direction + "/" + relationship + ".json";

			var cb = this.postOntologyCb;

			// no postData parm will cause the fetch to do a GET, a pOST is not handled yet for the ontology lookup yet
			this.getFetch(self, url, id, cb, finalCallback, parent);
		},

		/*
			Function: getNewTargetGroupItems
				get genotypes of a specific gene

			 Parameters:
				id - id
				 finalCallback - final callback name
				 parent - phenogrid.js global this
		*/
		getNewTargetGroupItems: function(id, finalCallback, parent) {
			var self = this;
			// https://monarchinitiative.org/gene/MGI:98297/genotype_list.json
			var url = this.serverURL + "/gene/" + id + "/genotype_list.json";
			var cb = this.getNewTargetGroupItemsCb;
			// ajax get all the genotypes of this gene id
			this.getFetch(self, url, id, cb, finalCallback, parent);
		},

		/*
			Function: getNewTargetGroupItemsCb
				send the compare request to get all the matches data

			 Parameters:
				self - immediate parent
				 id - id which was searched
				results - returned genotypes data
				 finalCallback - final callback function
				 parent - top level parent
		*/
		getNewTargetGroupItemsCb: function(self, id, results, finalCallback, parent) {
			// get the first 5 genotypes
			// it's an array of genotype objects - [{id: MGI:4838785, label: MGI:4838785}, {}, ...]
			// some genes may don't have associated genotypes
			if (typeof(results.genotype_list) !== 'undefined') {
				// sometimes the results.genotype_list is an empty array (because some genes don't have associated genotypes) - Joe
				if (results.genotype_list.length > 0) {
					// First filter out genotype IDs with unstable prefix
					// https://github.com/monarch-initiative/monarch-app/issues/1024#issuecomment-163733837
					// According to Kent, IDs starting with an underscore or prefixed with MONARCH: do not persist across different scigraph loads
					var unstablePrefix = parent.state.unstableTargetGroupItemPrefix;
					for (var i in results.genotype_list) {
						for (var k in unstablePrefix) {
							if (results.genotype_list[i].id.indexOf(unstablePrefix[k]) === 0) {
								// remove that genotype with unstable prefix
								results.genotype_list.splice(i, 1);
							}
						}
					}

					// Now only get the first parent.state.targetGroupItemExpandLimit genotypes in the list
					var genotype_list = results.genotype_list.slice(0, parent.state.targetGroupItemExpandLimit);
					var phenotype_id_list = self.origSourceList.join("+");
					var genotype_id_list = '';
					for (var i in genotype_list) {
						genotype_id_list += genotype_list[i].id + ",";
					}
					// truncate the last ',' off
					if (genotype_id_list.slice(-1) === ',') {
						genotype_id_list = genotype_id_list.slice(0, -1);
					}
					// /compare/:id1+:id2/:id3+:id4+...idN (JSON only)
					var compare_url = self.serverURL +  parent.state.compareQuery.URL + '/' + phenotype_id_list + "/" + genotype_id_list;
					// Now we need to get all the matches data
					var cb = self.getNewTargetGroupItemsCbCb;
					self.getFetch(self, compare_url, id, cb, finalCallback, parent);
				} else {
					var simsearchResults = {};
					var errorMsg = parent.state.messaging.noAssociatedGenotype;
					// return empty JSON since we have an empty genotype_list - Joe
					finalCallback(simsearchResults, id, parent, errorMsg);
				}
			}
		},

		/*
			Function: getNewTargetGroupItemsCb
				return results(matches data) back to final callback (_fetchGenotypesCb() in phenogrid.js)

			 Parameters:
				self - immediate parent
				 id - id which was searched
				results - returned genotypes data
				 finalCallback - final callback function
				 parent - top level parent
		*/
		getNewTargetGroupItemsCbCb: function(self, id, results, finalCallback, parent) {
			// don't encode labels into html entities here, otherwise the tooltip content is good,
			// but genotype labels on x axis will have the encoded characters
			// we just need to encode the labels for tooltip use - Joe

			// save the expanded gene id for later
			var genotype_id_list = [];

			// there's no results.b is no matches found in the simsearch - Joe
			if (typeof(results.b) !== 'undefined') {
				for (var i = 0; i < results.b.length; i++) {
					genotype_id_list.push(results.b[i].id);
				}

				// for reactivation
				self.loadedNewTargetGroupItems[id] = genotype_id_list;

				// this `results` is the simsearch resulting JSON
				finalCallback(results, id, parent);
			} else {
				var simsearchResults = {};
				var errorMsg = parent.state.messaging.noSimSearchMatchForExpandedGenotype;
				// return empty JSON since we have no matches found - Joe
				finalCallback(simsearchResults, id, parent, errorMsg);
			}
		},

		/*
			Function: postOntologyCb

				post callback from async call to gets the ontology for a given id

			 Parameters:
				self - immediate parent
				 id - id which was searched
				 finalCallback - final callback function
				 parent - top level parent
		*/
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

		/*
			Function: dataExists

				convenient function to check the cell data for a given target group (i.e., group)

			 Parameters:
				 targetGroup - target Group label
		*/
		dataExists: function(targetGroup) {
			var t = this.cellData[targetGroup]  || this.targetData[targetGroup];
			if (typeof(t) === 'undefined') {
				return false;
			}
			return true;
		},

		/*
			Function: checkOntologyCache

				convenient function to check the ontology cache for a given id

			 Parameters:
				 id - id to check
		*/
		checkOntologyCache: function(id) {
			return this.ontologyCache[id];
		}


	};

	// CommonJS format
	module.exports = DataLoader;

	}());
