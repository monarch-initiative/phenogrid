/** 
 * Simple data point.
 * 
 * @see module:phenogrid
 * @module model
 */
module.exports = {

    /**
     * Data point.
     * 
     * @constructor
     * @param {Number} x - x cordinate.
     * @param {Number} y - y cordinate.
     * @returns {this} new instance
     */
    modelDataPoint: function(x,y) {
	this.xID = x;
	this.yID = y;
    },

    /**
     * Makes sure that matches are when both the X & Y values are the
     * same.
     * 
     * @static
     * @param {modelDataPoint} point1 - A point.
     * @param {modelDataPoint} point2 - A point.
     * @returns {Boolean} data equality
     */
    modelDataPointEquals: function(point1,point2) {
	return point1.xID === point2.xID && point1.yID === point2.yID;
    },

    /**
     * Prints the point in an easy to understand way.
     * 
     * @static
     * @param {modelDataPoint} point1 - A point.
     * @returns {String} printable version on point.
     */
    modelDataPointPrint: function(point) {
	return "X:" + point.xID + ", Y:" + point.yID;
    }
}
