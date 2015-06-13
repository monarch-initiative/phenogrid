////
//// Testing model.js.
////

// Prefer Chai assert. We're (somehow, it does not work for "assert")
// passing in "should" from the gulp-defined globals.
var assert = require('chai').assert;

describe('model is sane', function(){

    var model = require('../js/model');

    it('has correct data', function(){
	var dp = new model.modelDataPoint(1,1);
    	assert.deepEqual(dp, {xID:1, yID:1}, 'has same structure');
    });

    it('does stuff', function(){
	var dp = new model.modelDataPoint(1,1);
    	assert.isTrue(model.modelDataPointEquals(dp, {xID:1, yID:1}), 'equals');
    });
});
