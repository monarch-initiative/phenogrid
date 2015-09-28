[![Build Status](https://travis-ci.org/monarch-initiative/phenogrid.svg)](https://travis-ci.org/monarch-initiative/phenogrid)

# About Phenogrid

Phenogrid is a Javascript component that visualizes semantic similarity calculations provided by OWLSim (www.owlsim.org), as provided through APIs from the Monarch Initiative (www.monarchinitiative.org).

Given an input list of phenotypes (you will see the sample input below) and parameters specified in config/phenogrid_config.js indicating desired source of matching models (humans, model organisms, etc.), the phenogrid will call the Monarch API to get OWLSim results and render them in your web browser in data visualization. And you may use the visualized data for your research.

# Installation Instructions

Phenogrid is published as a npm package, so you will need to have npm (npm is bundled and installed automatically with node.js) installed before you can install Phenogrid.

## 1. Install npm

If you have not installed node.js, try:

```
curl -sL https://rpm.nodesource.com/setup | bash -

yum install -y nodejs
```

This above commands work on RedHat and CentOS.

For OS X machines, you can try these instructions: http://blog.teamtreehouse.com/install-node-js-npm-mac. Or, just visit nodejs.org.

If you are running Ubuntu, you can 

````
sudo apt-get install nodejs
sudo apt-get install npm
````

Then create a symbolic link for "node" as many Node.js tools use this name to execute.

````
sudo ln -s /usr/bin/nodejs /usr/bin/node
````

## 2. Install Phenogrid package

To download and install the phenogrid widget, simply run

```
npm install phenogrid
```

Sometimes, it requires root access to for the installation, just run the following instead

```
sudo npm install phenogrid
```

This will create a local `/node_modules` folder in your working directory, and download/install Phenogrid and all its dependencies into the local `/node_modules` folder.


# Add phenogrid in your target page

In the below sample code, you will see how to use phenogrid as a embeded widget in your HTML. Please note that in order to parse the js file correctly (since it uses D3.js and D3.js requires UTF-8 charset encoding), we suggest you to add the `<meta charset="UTF-8">` tag in your HTML head.

```html
<html>
<head>
<meta charset="UTF-8">
<title>Monarch Phenotype Grid Widget</title>

<script src="config/phenogrid_config.js"></script>
<script src="dist/phenogrid-bundle.js"></script>

<link rel="stylesheet" type="text/css" href="dist/phenogrid-bundle.css">

<script>
var phenotypes = [
    {id:"HP:0000726", observed:"positive"},
    {id:"HP:0000746", observed:"positive"},
    {id:"HP:0001300", observed:"positive"},
    {id:"HP:0002367", observed:"positive"},
    {id:"HP:0000012", observed:"positive"},
    {id:"HP:0000716", observed:"positive"},
    {id:"HP:0000739", observed:"positive"},
    {id:"HP:0001332", observed:"positive"},
    {id:"HP:0001347", observed:"positive"},
    {id:"HP:0002063", observed:"positive"},
    {id:"HP:0002067", observed:"positive"},
    {id:"HP:0002172", observed:"positive"},
    {id:"HP:0002322", observed:"positive"},
    {id:"HP:0007159", observed:"positive"},
    {id:"HP:0009466", observed:"positive"},
    {id:"HP:0001972", observed:"positive"},
    {id:"HP:0003502", observed:"positive"},
    {id:"HP:0005190", observed:"positive"},
    {id:"HP:0001763", observed:"positive"},
    {id:"HP:0003318", observed:"positive"},
    {id:"HP:0001371", observed:"positive"},
    {id:"HP:0001380", observed:"positive"},
    {id:"HP:0001394", observed:"positive"},
    {id:"HP:0001156", observed:"positive"},
    {id:"HP:0001159", observed:"positive"},
    {id:"HP:0001004", observed:"positive"},
    {id:"HP:0010886", observed:"positive"},
    {id:"HP:0006530", observed:"positive"},
    {id:"HP:0004792", observed:"positive"},
    {id:"HP:0002816", observed:"positive"},
    {id:"HP:0000954", observed:"positive"},
    {id:"HP:0000974", observed:"positive"},
    {id:"HP:0000765", observed:"positive"},
    {id:"HP:0000602", observed:"positive"},
    {id:"HP:0002240", observed:"positive"},
    {id:"HP:0030084", observed:"positive"},
    {id:"HP:0000049", observed:"positive"},
    {id:"HP:0000028", observed:"positive"},
    {id:"HP:0000175", observed:"positive"},
    {id:"HP:0000204", observed:"positive"},
    {id:"HP:0000202", observed:"positive"},
    {id:"HP:0000316", observed:"positive"},
    {id:"HP:0000343", observed:"positive"},
    {id:"HP:0000349", observed:"positive"},
    {id:"HP:0002023", observed:"positive"},
    {id:"HP:0000327", observed:"positive"},
    {id:"HP:0002055", observed:"positive"},
    {id:"HP:0000394", observed:"positive"},
    {id:"HP:0000463", observed:"positive"},
    {id:"HP:0000431", observed:"positive"},
    {id:"HP:0000494", observed:"positive"},
    {id:"HP:0000484", observed:"positive"},
    {id:"HP:0000486", observed:"positive"},
    {id:"HP:0000508", observed:"positive"},
    {id:"HP:0009748", observed:"positive"},
    {id:"HP:0007018", observed:"positive"},
    {id:"HP:0001773", observed:"positive"},
    {id:"HP:0001769", observed:"positive"},
    {id:"HP:0003311", observed:"positive"},
    {id:"HP:0001544", observed:"positive"},
    {id:"HP:0001508", observed:"positive"},
    {id:"HP:0003196", observed:"positive"},
    {id:"HP:0001249", observed:"positive"},
    {id:"HP:0001187", observed:"positive"},
    {id:"HP:0001169", observed:"positive"},
    {id:"HP:0012774", observed:"positive"},
    {id:"HP:0002650", observed:"positive"}
];

window.onload = function() {
    Phenogrid.createPhenogridForElement(document.getElementById('phenogrid_container'), {
        serverURL : "http://monarchinitiative.org",
        phenotypeData: phenotypes,
        targetGroupList: [
            {"name": "Homo sapiens", "taxon": "9606","crossComparisonView": true, "active": true},
            {"name": "Mus musculus", "taxon": "10090", "crossComparisonView": true, "active": true},
            {"name": "Danio rerio", "taxon": "7955", "crossComparisonView": true, "active": true},
            {"name": "Drosophila melanogaster", "taxon": "7227", "crossComparisonView": false, "active": false},
            {"name": "UDPICS", "taxon": "UDPICS", "crossComparisonView": false, "active": false}
       ]
    });
}
</script>

</head>

<body>

<div id="phenogrid_container"></div>

</body>
</html>
```

# Configuration Parameters

## `serverURL`  string | required

This URL should be pointed to the OWLSim URL server associated with your installation containing the Monarch web services. You have three options:
- Use http://beta.monarchinitiative.org to connect to the development/test web services. This server is less stable than the production server.
- Use http://monarch.monarchinitiative.org to connect to the stable, production version of the web services (better uptime)
- If you are running the complete monarch-app, you can point it to http://localhost:8080, or whichever server/port you are using in your local installation.


## `phenotypeData`  array | required

It is a Javascript array of objects listing the phenotypes to be rendered in the widget.


## `targetGroupList`  array | optional

This option allows you to specify the set of target groups (i.e., species) that will be visible throughout Phenogrid. There are two parameters which allow you to control whether a target group is displayed as a default in the multi-target comparison view, `crossComparisonView` and whether it should be active, `active = true`,  and thus fully visible within phenogrid. If `crossComparisonView = true`, for example, the target group will be visible as a default within the multi-target comparison view. For example, by default the following targets will be visible upon loading phenogrid (active must be set to true):

```
{"name": "Homo sapiens", "taxon": "9606","crossComparisonView": true, "active": true},
{"name": "Mus musculus", "taxon": "10090", "crossComparisonView": true, "active": true},
{"name": "Danio rerio", "taxon": "7955", "crossComparisonView": true, "active": true}
```

The `active` parameter can override other parameters, but activating or deactivating a target group. For example, if the `active = false`, then the target group is not active within phenogrid and is not shown in comparison nor is it a selectable option from the menu. This is useful, if you not longer want that target group to be displayed within phenogrid and would like to retain the target group reference within the list. For example, the following are not active and will not be visible within phenogrid:

```
{"name": "Drosophila melanogaster", "taxon": "7227", "crossComparisonView": false, "active": false},
{"name": "UDPICS", "taxon": "UDPICS", "crossComparisonView": false, "active": false}
```

# Testing and further configuration

Open the modified `index.html` or your target web page that has the phenogrid embeded in a web browser (Google chrome disallows the access to local files via ajax call, so you may find out that the FAQ popup dialog won't show the content if you open `index.html` in the `file:///` format). This page will display an instance of the phenogrid, as configured above. Additional instructions for further customization of parameters will also be available on this page.

# Web Browser Support

Some phenogrid features are not support by IE 11 and below. So please use Google chrome, Fireffox, or Safari to open this widget.

# For developers

````
gulp bundle
````

This command will use browserify to bundle up phenogrid core and its dependencies into phenogrid-bundle.js and create the merged phenogrid-bundle.css and put both files under dist folder. And both bundled files will be minified.

It's helpful to have unminified versions of phenogrid-bundle.js and phenogrid-bundle.css for development and debugging. If this is the case, you can run the following command.

````
gulp dev-bundle
````

This will also show you all the JSHint messages for debugging or improving the code.

# License

Phenogrid is released under []GPL-2.0 license](https://opensource.org/licenses/GPL-2.0).