(function () {
'use strict';

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
			dataset - which data set array to return (i.e., source, target, cellData)
			species - optional, species name

		Returns:
			array of objects
	*/	
	getData: function(dataset, species) {
		if (species != null) {
			return this[dataset][species];
		}
		return this[dataset];
	},
	/*
		Function: length
			provides the length of specified data structure

		Parameters:
			dataset - which data set array to return (i.e., source, target, cellData)
			species - optional, species name

		Return:
			length
	*/	
	length: function(dataset, species) {
		var len = 0, a;
			if (species == null) {
				a = this[dataset];
			} else {
				a = this[dataset][species];
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
			species - species name

		Returns:
			match - matching object
	*/
 	cellPointMatch: function (key1, key2, species) {

	     var rec;
	     if (typeof(this.cellData[species]) !== 'undefined') {
		 if (typeof(this.cellData[species][key1]) !== 'undefined') {
		     if (typeof (this.cellData[species][key1][key2]) !== 'undefined') {
			 rec = this.cellData[species][key1][key2];
		     }
		 } else if (typeof(this.cellData[species][key2]) !== 'undefined') {
		     if (typeof(this.cellData[species][key2][key1]) !== 'undefined') {
			 rec = this.cellData[species][key2][key1];
		     }
		 }
	     }
	     return rec
	 },

        // list of everything tht matches key - either as source or target.
        // two possibilities - either key is a source, in which case I get the whole list
        // or its a target, in which case I look in each source... 
 	matches: function (key, species) {
	    var matchList = [];
	    var cd = this.cellData; // convenience pointer. Good for scoping
	    if (typeof (cd[species]) != 'undefined')  {
		// it's  a source. grab all of them
		if (typeof (cd[species][key]) !=='undefined') {
		    matchList = Object.keys(cd[species][key]).map(function(k) 
		    						{return cd[species][key][k];});
		}
		else {
		    /// it's a target. find the entry for each source.
		    srcs = Object.keys(cd[species]);
		    for (i in srcs) {
				var src = srcs[i];
				if (typeof(cd[species][src]) !== 'undefined') {
			    	if (cd[species][src][key] != 'undefined') {
						matchList.push(cd[species][src][key]);
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
		if (typeof(rec) == 'undefined') {
			var species = data.species;
			rec = this.target[species][key];
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
	getElement: function (dataset, key, species) {
		var el;
		if (typeof(species) !== 'undefined') {
		 	el = this[dataset][species][key]; 
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
			species - species

		Returns:
			object
	*/	
	getCellDetail: function (s, t, species) {
		var rec;
		try {
			rec = this.cellData[species][s][t];
		} catch (err) {
			console.log(err);
			// if error, check for inverted source and target keys
			rec = this.cellData[species][t][s];
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
	contains: function(dataset, key, species) {
		var el = this.getElement(dataset, key, species);
		if (typeof(el) !== 'undefined') return false;
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
		var self = this;
	    var xvalues = xvals, yvalues = yvals;     
	    var matrix = [], species; 

	    for (var y=0; y < yvalues.length; y++ ) {
    		var list = [];
			for (var x=0; x < xvalues.length; x++ ) {

				var species = this._getSpecies(yvalues[y], xvalues[x]);
				// does a match exist in the cells
				if (typeof(this.cellPointMatch(yvalues[y].id, xvalues[x].id, species)) !== 'undefined') {
					var rec = {source_id: yvalues[y].id, target_id: xvalues[x].id, xpos: x, 
								ypos: y, species: species};
					// this will create a array as a 'flattened' list of data points
					if (flattened) {
						matrix.push(rec);
					} else {  // else, just create an array of arrays
						list.push(rec);	
					}
					
				}
			}
			if (list.length > 0 && !flattened) matrix.push(list);	
		}
	    return matrix;
	},

	// simple internal function for extracting out the species
	_getSpecies: function(el1, el2) {
		if (typeof(el1.species) !== 'undefined') {
			return el1.species;
		}
		if (typeof(el2.species) !== 'undefined') {
			return el2.species;
		}		
	},

	/*
		Function: reinitialize

			reinitializes the source, target and cellData for a specied species

		Parameters:
			species - species name
	 		lazy - performs a lazy load of the data checking for existing data			

	*/
	reinitialize: function(species, lazy) {
		console.log("reinitialize dataManager...");

		// tell dataLoader to refresh data, if data was reloaded, then reinject data 
		if (this.dataLoader.refresh(species, lazy) ) {
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

			generates a combined target list for multiple organisms/species

		Parameters:
			targetSpeciesList - species list
			limit - specify the number limit of targets from each species

	*/
	createCombinedTargetList: function(targetSpeciesList, limit) {
		var combinedTargetList = [];
		// loop thru for the number of comparisons

		for (var e in targetSpeciesList) {
			var data = this.getData("target", targetSpeciesList[e].name);
			var i=0;
			for (var idx in data) {
				combinedTargetList[data[idx].id] = data[idx];
				i++;
				if (i >= limit) break;
			}
		}
		return combinedTargetList;
	}
};

// CommonJS format
module.exports=DataManager;

}());