/** 
 * Simple data point. This version is object/class based, rather than
 * static function based.
 * 
 * @see module:phenogrid
 * @module model-exp
 */

/**
 * Data point.
 * 
 * @constructor
 * @param {Number} x - x cordinate.
 * @param {Number} y - y cordinate.
 * @returns {this} new instance
 */
function dataPoint(x, y){
    this.xID = x;
    this.yID = y;
}

/**
 * Makes sure that matches are when both the X & Y values are the
 * same.
 * 
 * @param {dataPoint} point - Another point.
 * @returns {Boolean} data equality
 */
dataPoint.prototype.equals = function(point){
    return this.xID === point.xID && this.yID === point.yID;
};

/**
 * Prints the point in an easy to understand way.
 * 
 * @param {modelDataPoint} point1 - A point.
 * @returns {String} printable version on point.
 */
dataPoint.prototype.print = function(){
    return "X:" + this.xID + ", Y:" + this.yID;
};

// Exportable.
module.exports = dataPoint;
