var hpo = require('./mp.json');

var fs = require('fs');

// The IRI base to be removed in order to get the HP id
var iri = 'http://purl.obolibrary.org/obo/'

var graph = {};

var nodes = {};

var edges = [];

// This is used to build the treemap structure
var tree = [];

function getMP(classId) {
    for (k = 0; k < hpo.classAttribute.length; k++) {
        if (hpo.classAttribute[k].id === classId) {
            return hpo.classAttribute[k].iri.replace(iri, '');
        }
    }
}

// Get all the edges
for (var j = 0; j < hpo.classAttribute.length; j++) {
    
    // HP name is either in hpo.classAttribute[j].label.en or hpo.classAttribute[j].label.undefined
    var name = typeof(hpo.classAttribute[j].label.en) !== 'undefined' ? hpo.classAttribute[j].label.en : hpo.classAttribute[j].label.undefined;

    var node = {id: getMP(hpo.classAttribute[j].id), name: name, superClasses: [], subClasses: []};

    // Check super classes
    if (typeof(hpo.classAttribute[j].superClasses) !== 'undefined') {
        hpo.classAttribute[j].superClasses.forEach(function(classId) {
            // Add HPO id to the superClasses array
            node.superClasses.push(getMP(classId));

            var edge = {source: getMP(classId), target: hpo.classAttribute[j].iri.replace(iri, '')};
            // Only add this new edge if not presents
            if (edges.indexOf(edge) === -1) {
                edges.push(edge);
            }
        });
    }

    // Check sub classes
    if (typeof(hpo.classAttribute[j].subClasses) !== 'undefined') {
        hpo.classAttribute[j].subClasses.forEach(function(classId) {
            // Add HPO id to the subClasses array
            node.subClasses.push(getMP(classId));

            var edge = {source: hpo.classAttribute[j].iri.replace(iri, ''), target: getMP(classId)};
            // Only add this new edge if not presents
            if (edges.indexOf(edge) === -1) {
                edges.push(edge);
            }
        });
    }

    tree.push(node);
}

// Compute the nodes array from the edges
// Using object will prevent duplicates
var nodesObj = {};
edges.forEach(function (edge) {
    nodesObj[edge.source] = edge.source;
    nodesObj[edge.target] = edge.target;
});

// Convert object(named array) to index array
nodes = Object.keys(nodesObj).map(function (key) {
    return {id: nodesObj[key]};
});


console.log("Total " + nodes.length + " nodes");
console.log("Total " + edges.length + " edges");

// Compose the graph structure
graph = {nodes: nodes, edges: edges, tree: tree};

// Write the graph json into a json file
// JSON.stringify's third parameter defines white-space insertion for pretty-printing
var graphJson = JSON.stringify(graph, null, 4);

var outputFilename = 'mp_graph.json';
fs.writeFile(outputFilename, graphJson, 'utf8' ,function(err){
    if(err) {
        console.log(err);
    } else {
        console.log("Tree JSON saved to " + outputFilename);
    }
});

