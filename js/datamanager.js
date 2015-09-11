(function () {
'use strict';

require('jquery'); 
var $ = jQuery;
/*
 	Package: datamanager.js

 	Class: DataManager
		handles all interaction with the data, from fetching from external 
 		servers, transformation and storage.
 
 	Parameters:
 		dataLoader - reference to the dataLoader 	
*/
var DataManager = function(dataLoader) {
	this.dataLoader = dataLoader;

	// inject data
	this.target = this.dataLoader.getTargets();
	this.source = this.dataLoader.getSources();
	this.cellData = this.dataLoader.getCellData();

	// this is rebuilt everytime grid needs rerendered, cached here for quick lookup
	this.matrix = [];
};

DataManager.prototype = {
	constructor: DataManager,

	/*
		Function: isInitialized
			check to see if datasets have been initialized 

		Returns:
			boolean
	*/	
	isInitialized: function() {
		var targetSize = Object.keys(this.target).length;
		var sourceSize = Object.keys(this.source).length;

		if (sourceSize > 0 && targetSize > 0) {
			this.initialized = true;
		} else {
			this.initialized = false;
		}
		return this.initialized;
	},
	/*
		Function: getOriginalSource
			gets the original source listing used for query 

		Returns:
			array of objects
	*/
	getOriginalSource: function() {
		return this.qrySourceList;
	},
	/*
		Function: getData
			gets a list of entries from specified dataset

		Parameters:
			dataset - which data set array to return (i.e., 'source', 'target', 'cellData')
			targetGroup - optional, targetGroup name

		Returns:
			array of objects
	*/	
	getData: function(dataset, targetGroup) {
		if (typeof(targetGroup) != 'undefined') {
			return this[dataset][targetGroup];
		}
		return this[dataset];
	},
	/*
		Function: length
			provides the length of specified data structure

		Parameters:
			dataset - which data set array to return (i.e., source, target, cellData)
			targetGroup - optional, targetGroup name

		Return:
			length
	*/	
	length: function(dataset, targetGroup) {
		var len = 0, a;
			if (typeof(targetGroup) === 'undefined') {
				a = this[dataset];
			} else {
				a = this[dataset][targetGroup];
			}
			len = Object.keys(a).length;
		return len;
	},
	/*
		Function: cellPointMatch
			takes to a key pair and matches it to the cellData point

		Parameters:
			key1 - first key to match
			key2  - second key to match
			targetGroup - targetGroup name

		Returns:
			match - matching object
	*/
 	cellPointMatch: function (key1, key2, targetGroup) {

	     var rec;
	     if (typeof(this.cellData[targetGroup]) !== 'undefined') {
		 if (typeof(this.cellData[targetGroup][key1]) !== 'undefined') {
		     if (typeof (this.cellData[targetGroup][key1][key2]) !== 'undefined') {
			 rec = this.cellData[targetGroup][key1][key2];
		     }
		 } else if (typeof(this.cellData[targetGroup][key2]) !== 'undefined') {
		     if (typeof(this.cellData[targetGroup][key2][key1]) !== 'undefined') {
			 rec = this.cellData[targetGroup][key2][key1];
		     }
		 }
	     }
	     return rec;
	 },

        // list of everything that matches key - either as source or target.
        // two possibilities - either key is a source, in which case I get the whole list
        // or its a target, in which case I look in each source... 
 	matches: function (key, targetGroup) {
	    var matchList = [];
	    var cd = this.cellData; // convenience pointer. Good for scoping
	    if (typeof (cd[targetGroup]) !== 'undefined')  {
		// it's  a source. grab all of them
		if (typeof (cd[targetGroup][key]) !=='undefined') {
		    matchList = Object.keys(cd[targetGroup][key]).map(function(k) 
		    						{return cd[targetGroup][key][k];});
		}
		else {
		    /// it's a target. find the entry for each source.
		    var srcs = Object.keys(cd[targetGroup]);
		    for (var i in srcs) {
				var src = srcs[i];
				if (typeof(cd[targetGroup][src]) !== 'undefined') {
			    	if (cd[targetGroup][src][key] !== 'undefined') {
						matchList.push(cd[targetGroup][src][key]);
			    	}
				}
		    }
		}
	    }
	    return matchList;
	},

	getTargetSourceElement: function (data) {
		var rec;
		var key = data.id;  //both source/targets have id's

		// check whether it's in the sources
		rec = this.source[key];

		// if not check as target
		if (typeof(rec) === 'undefined') {
			var targetGroup = data.targetGroup;
			rec = this.target[targetGroup][key];
		}
		return rec;
	},
    
	/*
		Function: keys
			returns a list of key (id) values from a given dataset
	
		Parameters:
			dataset - which data set array to return (i.e., source, target, cellData)

		Returns:
			array of ids
	*/
	keys: function (dataset) {
		var a = this[dataset];
		return Object.keys(a);		// Object.keys(this.target["Homo sapiens"])
	},

	/*
		Function: getElement
			gets a single element object from a data set 
	
		Parameters:
			dataset - which data set
			key - key to search

		Returns:
			object
	*/	
	getElement: function (dataset, key, targetGroup) {
		var el;
		if (typeof(targetGroup) !== 'undefined') {
		 	el = this[dataset][targetGroup][key]; 
		} else {
			el = this[dataset][key];
		}
		return el;
	},

	/*
		Function: getCellDetail
			gets detailed from the cell data
	
		Parameters:
			s - source key
			t - target key 
			targetGroup - targetGroup

		Returns:
			object
	*/	
	getCellDetail: function (s, t, targetGroup) {
		var rec;
		try {
			rec = this.cellData[targetGroup][s][t];
		} catch (err) {
			// if error, check for inverted source and target keys
			rec = this.cellData[targetGroup][t][s];
		}
	 	return rec;
	},
	/*
		Function: contains

			searches for value element contained with a data set 

		Parameters:
			dataset - which data set to search
			key - key to search


		Returns:
			boolean
	*/
	contains: function(dataset, key, targetGroup) {
		var el = this.getElement(dataset, key, targetGroup);
		if (typeof(el) !== 'undefined') {return false;}
		return true;
	}, 	

	/*
		Function: getMatrix

			builds a matrix data set from the source and target lists 

		Parameters:
			xvals - target value list
			yvals - source value list
			flattened - flag to flatten the array into a single list of data points

		Returns:
			array
	*/
	getMatrix: function(xvals, yvals, flattened) {
	    var xvalues = xvals, yvalues = yvals;     
	    //var matrix = []; 
	    this.matrix = [];

	    for (var y=0; y < yvalues.length; y++ ) {
    		var list = [];
			for (var x=0; x < xvalues.length; x++ ) {

				var targetGroup = this._getTargetGroup(yvalues[y], xvalues[x]);

				if ((typeof(yvalues[y]) != 'undefined') && (typeof(xvalues[x]) != 'undefined')) 
				{
					// does a match exist in the cells
					if (typeof(this.cellPointMatch(yvalues[y].id, xvalues[x].id, targetGroup)) !== 'undefined') 
					{
						var rec = {source_id: yvalues[y].id, target_id: xvalues[x].id, xpos: x, 
									ypos: y, targetGroup: targetGroup, type: 'cell'};
						// this will create a array as a 'flattened' list of data points, used by mini mapping
						if (flattened) {
							this.matrix.push(rec);
						} else {  // else, just create an array of arrays, grid likes this format
							list.push(rec);	
						}
						
					}
				}
			}
			if (!flattened) {  //list.length > 0 && 
				this.matrix.push(list);
			} 
		}
	    return this.matrix;
	},

	getMatrixSourceTargetMatches: function(matchpos, highlightSources) {
		var matchedPositions = [];

		for (var i in this.matrix) {
			var r = this.matrix[i];
			if (r.ypos == matchpos && !highlightSources) {
				matchedPositions.push(r);
			} else if (r.xpos == matchpos && highlightSources) {
				matchedPositions.push(r);
			}
		}
			
		return matchedPositions;
	},

	// simple internal function for extracting out the targetGroup
	_getTargetGroup: function(el1, el2) {
		if ((typeof(el1) !== 'undefined') && (typeof(el1.targetGroup) !== 'undefined')) {
			return el1.targetGroup;
		}
		if ((typeof(el2) !== 'undefined') && (typeof(el2.targetGroup) !== 'undefined')) {
			return el2.targetGroup;
		}		
	},

	/*
		Function: reinitialize

			reinitializes the source, target and cellData for a specied targetGroup

		Parameters:
			targetGroup - targetGroup name
	 		lazy - performs a lazy load of the data checking for existing data			

	*/
	reinitialize: function(targetGroup, lazy) {
		console.log("reinitialize dataManager...");

		// tell dataLoader to refresh data, if data was reloaded, then reinject data 
		if (this.dataLoader.refresh(targetGroup, lazy) ) {
			this.source = [];
			this.target = [];
			this.cellData = [];

			// inject data
			this.target = this.dataLoader.getTargets();
			this.source = this.dataLoader.getSources();
			this.cellData = this.dataLoader.getCellData();
		}
	},

	/*
		Function: createCombinedTargetList

			generates a combined target list for multiple organisms/targetGroup

		Parameters:
			targetGroupList - targetGroup list
			limit - specify the number limit of targets from each targetGroup

	*/
	createCombinedTargetList: function(targetGroupList, limit) {
		var combinedTargetList = [];
		// loop thru for the number of comparisons

		for (var k in targetGroupList) {
			var data = this.getData("target", targetGroupList[k].name);
			var i=0;
			for (var idx in data) {
				combinedTargetList[data[idx].id] = data[idx];
				i++;

				// if we've reached our limit break out
				if (i >= limit) {break;}
			}
		}
		return combinedTargetList;
	},

	/*
		Function: createCombinedSourceList

			generates a combined source list for multiple organisms/targetGroup

		Parameters:
			targetGroupList - targetGroup list
	*/
	createCombinedSourceList: function(targetGroupList) {
		var combinedSourceList = [];

		// loop thru for the number of comparisons and build a combined list
		// also build the frequency and sum for the subset
		for (var k in targetGroupList) {
			var srcs = this.getData("source", targetGroupList[k].name);

			for (var idx in srcs) {
				var id = srcs[idx].id;

				// try adding source as an associative array, if not found then add new object
				var srcData = combinedSourceList[id];
				if (typeof(srcData) == 'undefined') {	
					var newElement = {};
					// this needs to be a copy, don't assign srcs[idx] directly to avoid object reference problems when modifying
					combinedSourceList[id] = $.extend({}, newElement, srcs[idx]);	
				}
			}

		}
		// compute the frequency and rarity across all targetgroups
		for (var s in combinedSourceList) {
				combinedSourceList[s].count = 0;
				combinedSourceList[s].sum = 0;

			for (var t in targetGroupList) {
				// get all the cell data
				var cellData = this.getData("cellData", targetGroupList[t].name);
				for (var cd in cellData) {

				var cells = cellData[cd];
					for (var c in cells) {
						if (combinedSourceList[s].id == cells[c].source_id) {
							combinedSourceList[s].count += 1;
							combinedSourceList[s].sum += cells[c].subsumer_IC;
						}
					}
				}
			}	
		}
		return combinedSourceList;
	},

	getOntologyLabel: function(id) {
		return this.dataLoader.getOntologyLabel(id);
	}
};

// CommonJS format
module.exports=DataManager;

}());