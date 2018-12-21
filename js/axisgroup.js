(function () {
'use strict';

var d3 = require('d3');

/*
	Package: axisgroup.js

	Namespace: phenogrid.axisgroup

 	Constructor: AxisGroup
		an object routine that will wrap data required for axis rendering

 	Parameters:
		renderStartPos - render starting position
		renderEndPos - render end position
		items - item list to use for the axis display
*/
var AxisGroup = function(renderStartPos, renderEndPos, items)  {
	this.renderStartPos = renderStartPos;
    this.renderEndPos = renderEndPos;

    // remove all invisible genotypes
    for (var index in items) {
        if (items[index].type === 'genotype' && items[index].visible === false) {
            delete items[index];
        }
    }
    this.items = items
};

/*
 	Class: AxisGroup
		an object routine that will wrap data required for axis rendering
*/
AxisGroup.prototype = {
	constructor: AxisGroup,
	/*
		Function: getRenderStartPos
	 		gets the rendered starting position

	 	Return:
	 		position index
	*/
	getRenderStartPos: function() {
		return this.renderStartPos;
	},
	setRenderStartPos: function(position) {
		// don't allow out of position starts
		if (position < 0 || position > this.groupLength()) {
			position = 0; // default to zero
		}

		this.renderStartPos = position;
	},

	/*
		Function: getRenderEndPos
	 		gets the rendered end position

	 	Return:
	 		position index
	*/
	getRenderEndPos: function() {
		return this.renderEndPos;
	},
	setRenderEndPos: function(position) {
		// don't let the postion go pass the max group size
		if (position > this.groupLength()) {
			position = this.groupLength();
		}
		this.renderEndPos = position;
	},
	/*
		Function: itemAt
			gets a single item at a specified index position within the rendered axisgroup

		Parameters:
			index

		Return:
			item data object
	*/
	itemAt: function(index) {
		var renderedList = this.keys();
		var item = renderedList[index];
    	return this.get(item);
	},

	/*
		Function: get
			gets a single item element using a key from the axis

		Parameters:
			key
		Returns:
			item element
	*/
	get: function(key) {
		return this.items[key];
	},

	/*
		Function: entries
			provides the array of rendered entries, can be phenotypes/genes/genotypes/diseases

		Return:
			array of objects of items
	*/
	entries: function() {
		var keys = Object.keys(this.items);
		var a = [];
		// loop through on those rendered
		for (var i = this.renderStartPos; i < this.renderEndPos;i++) {
			var key = keys[i];
			var el = this.items[key];
            a.push(el);
		}
		return a;
	},

	/*
		Function: getItems
			provides the subset group of items to be rendered

		Return:
			array of objects of items
	*/
	getItems: function() {
/*		if (typeof(this.items) !== 'undefined' && this.items != null) {


			var a = this.items.map(function(d) { return d;} );

		 	return a.slice(this.renderStartPos, this.renderEndPos);
		}
*/
		var keys = Object.keys(this.items);
		var a = [];
		// loop through only those that are rendered
		for (var i = this.renderStartPos; i < this.renderEndPos;i++) {
			var key = keys[i];
			var el = this.items[key];
			a[key] = el;
		}
		return a;
	},

	/*
		Function: keys
			returns a list of key (id) values

		Returns:
			array of key ids
	*/
	keys: function () {
		var renderedList = this.getItems();
		return Object.keys(renderedList);
	},

	/*
		Function: displayLength
			provides the number of items diplayed (rendered portion of the axisgroup)

		Return:
			length
	*/
    displayLength: function() {
		return (this.renderEndPos - this.renderStartPos);
    },

	/*
		Function: groupLength
			provides the length of the entire axis group

		Return:
			length
	*/
	groupLength: function() {
    	return Object.keys(this.items).length;
	},

	/*
		Function: position
			gets the relative position a key within the rendered or viewable range

		Parameters:
			key - a key value to locate

		Return:
			index value, -1 if item not found within rendered range
	*/
	position: function(key) {
		var renderedList = this.keys();
		return renderedList.indexOf(key);
	},

	/*
		Function: groupIDs
			provides list of IDs for all entries within the axis group

		Return:
			array
	*/
	groupIDs: function() {
		return Object.keys(this.items);
	},
	/*
		Function: groupEntries
			provides list of all entries within the axis group

		Return:
			array of objects of items
	*/
	groupEntries: function() {
		var keys = Object.keys(this.items);
		var a = [];
		// loop through on those rendered
		for (var i = 0; i < keys.length;i++) {
			var key = keys[i];
			var el = this.items[key];
			a.push(el);
		}
		return a;
	},

	/*
		Function: contains
			determines if a item element is contained within the axis

		Parameters:
			key - key id to locate

		Returns:
			boolean
	*/

	contains: function(key) {
		if (typeof(this.get(key)) != 'undefined') {
			return true;
		}
		else {
			return false;
		}
	},
    /*
		Function: sort
			sorts the data on the axis

		Parameters:
			by - specifies the the sort type

	*/
    sort: function(by) {
    	var temp = this.groupEntries();

 		if (by === 'Frequency') {
			//sortFunc = self._sortByFrequency;
			//this.items.sort(function(a,b) {
			temp.sort(function(a,b) {
				var diff = b.count - a.count;
				if (diff === 0) {
					diff = a.id.localeCompare(b.id);
				}
				return diff;
			});
		} else if (by === 'Frequency and Rarity') {
			//this.items.sort(function(a,b) {
			temp.sort(function(a,b) {
				return b.sum - a.sum;
			});
		} else if (by === 'Alphabetic') {
			//this.items.sort(function(a,b) {
			  temp.sort(function(a,b) {
				var labelA = a.label,
				labelB = b.label;
				if (labelA < labelB) {return -1;}
				if (labelA > labelB) {return 1;}
				return 0;
			});
		}

		// rebuild items
		this.items = [];
		for (var t in temp) {
			this.items[temp[t].id] = temp[t];
		}

    },

 	/*
		Function: getScale
			creates a d3 scale from the data on the axis

		Parameters:
			d3 scale

	*/
    getScale: function() {
		var values = this.keys();
		var scale = d3.scaleBand()
					.domain(values)
					.rangeRound([0, values.length]);
		return scale;
    }
};

// CommonJS format
module.exports = AxisGroup;

}());