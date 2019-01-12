(function () {
'use strict';

var $ = require('jquery'); 

var Utils = require('./utils.js');

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

    this.maxMaxIC = this.dataLoader.maxMaxIC;

	// this is rebuilt every time grid needs re-rendered, cached here for quick lookup
	this.matrix = [];
    
    // genotype expansion, named arrays of each single group
    // these two arrays are referenced to the underlying data in dataLoader, not actual clone
    // so changes made to the underlying data array will populate to these two - Joe
    this.reorderedTargetEntriesNamedArray = {};
    this.reorderedTargetEntriesIndexArray = {};
    
    this.expandedItemList = {}; // named array, no need to specify group since each gene ID is unique
};

DataManager.prototype = {
	constructor: DataManager,

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
		// console.log('getData', dataset, targetGroup, this[dataset][targetGroup]);
        return this[dataset][targetGroup];
	},
    
    /*
		Function: appendNewItemsToOrderedTargetList
			each single group (fish/mouse) has its own ordered target list

		Parameters:
			targetGroup - group name
            data - newly added genotypes data

		Returns:
			reordered index array
	*/
    appendNewItemsToOrderedTargetList: function(targetGroup, data) {
        // can't slice the object this.target[targetGroup]
        var newlyAdded = {}; // named array, group name is the key
        for (var i = 0; i < data.length; i++) {
            var id = Utils.getConceptId(data[i].id);
            
            if (typeof(newlyAdded[targetGroup]) === 'undefined') {
                newlyAdded[targetGroup] = []; // index array
            }
            
            // value of each group name is an index array
            newlyAdded[targetGroup].push(this.target[targetGroup][id]);
        }
        
        if (typeof(this.reorderedTargetEntriesIndexArray[targetGroup]) === 'undefined') {
            this.reorderedTargetEntriesIndexArray[targetGroup] = [];
        }
        
        // append the newly added to the already sorted numeric array of target list (sorted from last expansion)
        return this.reorderedTargetEntriesIndexArray[targetGroup].concat(newlyAdded[targetGroup]);
    },
    
    /*
		Function: updateTargetList
			each single group (fish/mouse) has its own ordered target list

		Parameters:
			genotypesData - defined in _fetchGenotypesCb() of phenogrid.js
	*/
    updateTargetList: function(genotypesData) {
		var targetEntries = genotypesData.targetEntries; // unordered target entries of current active single group 
        var genotypes = genotypesData.genotypes; // an array of genotype objects derived from genotypesData.parentGeneID
        var parentGeneID = genotypesData.parentGeneID;
        var group = genotypesData.group;

        var gene_position;
        var first_genotype_position;
        var header = [];
        var body = [];
        var footer = [];
        for (var i = 0; i < targetEntries.length; i++) {
            if (typeof(targetEntries[i]) === 'undefined') {
                targetEntries[i] = {};
            }
            
            // loop through all the target entries and find the parent gene
            if (targetEntries[i].id === parentGeneID) {
                gene_position = i; // remember the parent gene's position
                break;
            }
        }
        
        header = targetEntries.slice(0, gene_position+1); // the last element of header is the parent gene

        body = targetEntries.slice(header.length, targetEntries.length - genotypes.length);
        
        // footer contains all newly added genotypes
        footer = targetEntries.slice(header.length + body.length);

        // header + footer + body
        // Position those genotypes right after their parent gene
        // no we have the new target entries in the desired order
        var reorderedTargetEntriesIndexArray = header.concat(footer, body);
        
        // Format 1 - sorted index numeric array for each target group 
        this.reorderedTargetEntriesIndexArray[group] = reorderedTargetEntriesIndexArray;
        
        // Format into named associative array
        // same return format as getData()
        var reorderedTargetEntriesNamedArray = {}; // named array
        for (var k = 0; k < reorderedTargetEntriesIndexArray.length; k++) {
            if (typeof(reorderedTargetEntriesIndexArray[k]) === 'undefined') {
                reorderedTargetEntriesIndexArray[k] = {};
            }
            
            reorderedTargetEntriesNamedArray[reorderedTargetEntriesIndexArray[k].id] = reorderedTargetEntriesIndexArray[k];
        }
        
        // Format 2 - sorted associative/named array for each target group 
        this.reorderedTargetEntriesNamedArray[group] = reorderedTargetEntriesNamedArray;
	},
    
    getReorderedTargetEntriesNamedArray: function(group) {
        //this.reorderedTargetEntriesIndexArray[group] and this.reorderedTargetEntriesNamedArray[group] 
        // have the same order and number of elements, just two different formats
        var t = []
        for (var i = 0; i < this.reorderedTargetEntriesIndexArray[group].length; i++) {
            // only added genotypes have that 'visible' property
            if (typeof(this.reorderedTargetEntriesIndexArray[group][i].visible) === 'undefined') {
                t.push(this.reorderedTargetEntriesIndexArray[group][i]);
            } else {
                if (this.reorderedTargetEntriesIndexArray[group][i].visible === true) {
                    t.push(this.reorderedTargetEntriesIndexArray[group][i]);
                }
            }
        }
        
        // now t only contains all the genes and their visible genotypes in an ordered array
        
        var reorderedVisibleTargetEntriesNamedArray = {}; // named array
        for (var k = 0; k < t.length; k++) {
            reorderedVisibleTargetEntriesNamedArray[t[k].id] = t[k];
        }
        
        return reorderedVisibleTargetEntriesNamedArray;
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
			if (typeof(a) !== 'undefined') {
				len = Object.keys(a).length;
			}
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
		    // it's a target. find the entry for each source.
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
		Function: buildMatrix

			builds a matrix data set from the source and target lists 

		Parameters:
			xvals - target value list
			yvals - source value list
			flattened - flag to flatten the array into a single list of data points; true for usage with overview map
            forCompare - "compare" to indicate if phenogrid is in owlSimFunction === 'compare' mode

		Returns:
			array
	*/
	buildMatrix: function(xvals, yvals, flattened, forCompare) {
	    var xvalues = xvals, yvalues = yvals;     
	    var matrixFlatten = []; 

	    // if it's not a flattened, reset matrix
	    if ( ! flattened) { 
	    	this.matrix = []; 
	    }

	    for (var y = 0; y < yvalues.length; y++ ) {
    		var list = [];
			for (var x = 0; x < xvalues.length; x++ ) {
                // when owlSimFunction === 'compare', we use 'compare' as the targetGroup name - Joe
                if (typeof(forCompare) !== 'undefined') {
                    var targetGroup = forCompare;
                } else {
                    var targetGroup = this._getTargetGroup(yvalues[y], xvalues[x]);
                }

				if ((typeof(yvalues[y]) !== 'undefined') && (typeof(xvalues[x]) !== 'undefined')) {
					// does a match exist in the cells
					if (typeof(this.cellPointMatch(yvalues[y].id, xvalues[x].id, targetGroup)) !== 'undefined') {
						var rec = {
                                source_id: yvalues[y].id, 
                                target_id: xvalues[x].id, 
                                xpos: x, 
                                ypos: y, 
                                targetGroup: targetGroup, 
                                type: 'cell'
                            };
						// this will create a array as a 'flattened' list of data points, used by mini mapping
						if (flattened) {
							matrixFlatten.push(rec);
						} else {  // else, just create an array of arrays, grid likes this format
							list.push(rec);	
						}
					}
				}
			}
			if ( ! flattened) {  
				this.matrix.push(list);
			} 
		}
		if (flattened) {
			return matrixFlatten;
		} else {
	    	return this.matrix;
		}
	},

	getMatrixSourceTargetMatches: function(matchpos, highlightSources) {
		var matchedPositions = [];

		for (var i in this.matrix) {
			var r = this.matrix[i];
			for (var j = 0; j < r.length; j++) {
				if (r[j].ypos == matchpos && !highlightSources) {
					matchedPositions.push(r[j]);
				} else if (r[j].xpos == matchpos && highlightSources) {
					matchedPositions.push(r[j]);
				}
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
			var data = this.getData("target", targetGroupList[k].groupName);
			if (typeof(data) !== 'undefined') {
				var i=0;
				for (var idx in data) {
					combinedTargetList[data[idx].id] = data[idx];
					i++;

					// if we've reached our limit break out
					if (i >= limit) {break;}
				}
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
			var srcs = this.getData("source", targetGroupList[k].groupName);

			if (typeof(srcs) !== 'undefined') {
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
		}
		// compute the frequency and rarity across all targetgroups
		for (var s in combinedSourceList) {
				combinedSourceList[s].count = 0;
				combinedSourceList[s].sum = 0;

			for (var t in targetGroupList) {
				// get all the cell data
				var cellData = this.getData("cellData", targetGroupList[t].groupName);
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
	},
    
    /*
		Function: isExpanded

			convenient function to check the genotype expansion cache for a given gene id
	
	 	Parameters:
	 		id - gene id to check
	*/
	isExpanded: function(id) {
        if (typeof(this.expandedItemList[id]) === 'undefined') {
            return false;
        } else {
            return true;
        }
	},
    
    /*
		Function: checkExpandedItemsLoaded

			check if the genotypes data of that specific gene id has been loaded
	
	 	Parameters:
	 		group - group name
            id - gene id to check
	*/
    checkExpandedItemsLoaded: function(group, id) {
		if (typeof(this.reorderedTargetEntriesIndexArray[group]) === 'undefined') {
            this.reorderedTargetEntriesIndexArray[group] = []; // index array
        }
    
        for (var i = 0; i < this.reorderedTargetEntriesIndexArray[group].length; i++) {
            // only added genotypes have 'parentGeneID' property
            if (typeof(this.reorderedTargetEntriesIndexArray[group][i].parentGeneID) !== 'undefined') {
                if (this.reorderedTargetEntriesIndexArray[group][i].parentGeneID === id) {
                    return true;
                }
            }  
        }
        // loop through the array and didn't find genotypes of the target gene id
        return false;
	}
    
};

// CommonJS format
module.exports=DataManager;

}());