////
//// Testing model-exp.js.
////

// Prefer Chai assert. We're (somehow, it does not work for "assert")
// passing in "should" from the gulp-defined globals.
var assert = require('chai').assert;

describe('model-exp is sane', function(){

    var dataPoint = require('../js/model-exp');

    it('has correct data', function(){
	var dp = new dataPoint(1,1);
    	assert.equal(dp.xID, 1, 'has same structure X');
    	assert.equal(dp.yID, 1, 'has same structure Y');
    });

    it('does stuff', function(){
	var dp = new dataPoint(1,1);
    	assert.isTrue(dp.equals(new dataPoint(1,1)), 'equals');
    	assert.isFalse(dp.equals(new dataPoint(2,1)), '!equals');
    });
});
