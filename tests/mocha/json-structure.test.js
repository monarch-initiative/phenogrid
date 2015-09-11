var chai = require('chai');

var expect = chai.expect;
//var should = chai.should;
//var assert = chai.assert;

// JSON structure validator
// https://github.com/AntJanus/JSON-structure-validator
var _ = require('lodash');

var compareJSON = function(parent, compared) {
    var keys = _.keys(parent);
    var error = '';

    _.each(keys, function(key) {
        if (_.has(compared, key)) {
            var recursive = compareJSON(parent[key], compared[key]);
            if(recursive !== true) {
                error = key + ' ' + recursive;
            return false;
            }
        }
        else {
            error = key;
            return false;
        }
    });

    if ( !_.isEmpty(error)) {
        return error;
    }

    return true;
};


describe('Monarch API JSON Structure Validation for Phenogrid', function() {
    it('should be valid', function() {
        // Must use ./ to include the json files
        var simsearchSchema = require('./simsearch-schema.json');
        // Should use ajax to grab the data for comparison
        var homoSapiensData = require('./simsearch-homo-sapiens.json');
        var musMusculusData = require('./simsearch-mus-musculus.json');
        var danioRerioData = require('./simsearch-danio-rerio.json');
                
        expect(compareJSON(simsearchSchema, homoSapiensData)).to.be.true;
        expect(compareJSON(simsearchSchema, musMusculusData)).to.be.true;
        expect(compareJSON(simsearchSchema, danioRerioData)).to.be.true;
    });
});

describe('Ontology API JSON Structure Validation for Phenogrid', function() {
    it('should be valid', function() {
        // Must use ./ to include the json files
        var ontologySchema = require('./ontology-schema.json');
        var ontologyData = require('./ontology-HP_0000431.json');
                
        expect(compareJSON(ontologySchema, ontologyData)).to.be.true;
    });
});