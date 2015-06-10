var $ = require('jquery');
require('jquery-ui');
require('./js/phenogrid');

$(document).ready(function() {

    var phenotypes = [
	{ id:"HP:0000726", observed:"positive"},
	{ id:"HP:0000746", observed:"positive"},
	{ id:"HP:0001300", observed:"positive"},
	{ id:"HP:0002367", observed:"positive"},
	{ id:"HP:0000012", observed:"positive"},
	{ id:"HP:0000716", observed:"positive"},
	{ id:"HP:0000726", observed:"positive"},
	{ id:"HP:0000739", observed:"positive"},
	{ id:"HP:0001332", observed:"positive"},
	{ id:"HP:0001347", observed:"positive"},
	{ id:"HP:0002063", observed:"positive"},
	{ id:"HP:0002067", observed:"positive"},
	{ id:"HP:0002172", observed:"positive"},
	{ id:"HP:0002322", observed:"positive"},
	{ id:"HP:0007159", observed:"positive"}];	
    
    
    $("#phen_vis").phenogrid({serverURL : "http://beta.monarchinitiative.org",
			      phenotypeData:	phenotypes,
			      targetSpeciesName: "Mus musculus" });
});
