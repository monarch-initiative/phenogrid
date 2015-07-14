#Development status of this repo

- npm-config-kltm branch and zy branch are dead
- The css/ folder contains all individual css files, changes made to jquery-ui and font-awesome, and added '-modified' in the file name, so you know they are customized versions. 
- The js/ folder contains all individual js files in CommonJS format.
- The dist/ folder contains two files, phenogrid-bundle.js and phenogrid-bundle.css that are generated after running `gulp bundle`. We can just specify these two files, together with the config js in webapp.js. 
- I'll remove the dist/ folder later, since it will be created during the installation. It's here for now, simply to make it work in monarch-app after duplication.
- The npm stuff is from the zy branch (based on Seth's kltm branch) and Dan's PR.

#About Phenogrid

Phenogrid is implemented as a jQuery UI widget. The phenogrid widget uses semantic similarity calculations provided by OWLSim (www.owlsim.org), as provided through APIs from the Monarch Initiative (www.monarchinitiative.org).

Given an input list of phenotypes (you will see the sample input below) and parameters specified in config/phenogrid_config.js indicating desired source of matching models (humans, model organisms, etc.), the phenogrid will call the Monarch API to get OWLSim results and render them in your web browser in data visualization. And you may use the visualized data for your research.

#Installation Instructions

##1. Make sure npm installed

Before you get started, you will need to make sure you have npm installed first. npm is bundled and installed automatically with node.js. If not, you need to install them.

```
curl -sL https://rpm.nodesource.com/setup | bash -

yum install -y nodejs
```

##2. Install phenogrid widget

Now it's time to download and extract our phenogrid widget. In the phenogrid package directory, just run

```
npm install
```

Sometimes, it requires root access to for the installation, just run the following instead

```
sudo npm install
```

This will create a local `/node_modules` folder in the phenogrid root directory, and download/install all the dependencies(jquery, jquery-ui, d3, and jshashtable) and tools (gulp, browserify, etc.) into the local `/node_modules` folder.

##3. Run gulp to build this widget

```
gulp bundle
```

This command will use browserify to bundle up phenogrid core and its dependencies into `phenogrid-bundle.js` and create the merge `phenogrid-bundle.css` and put both files under `dist` folder.

##4. Add phenogrid in your target page

In the below sample code, you will see how to use phenogrid as a embeded widget in your HTML.

````html
<html>
<head>
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
	{id:"HP:0000726", observed:"positive"},
	{id:"HP:0000739", observed:"positive"},
	{id:"HP:0001332", observed:"positive"},
	{id:"HP:0001347", observed:"positive"},
	{id:"HP:0002063", observed:"positive"},
	{id:"HP:0002067", observed:"positive"},
	{id:"HP:0002172", observed:"positive"},
	{id:"HP:0002322", observed:"positive"},
	{id:"HP:0007159", observed:"positive"}
];	

function initializePhenogrid(element) {
	Phenogrid.createPhenogridForElement(element, {
		serverURL : "http://beta.monarchinitiative.org",
 		phenotypeData: phenotypes,
		targetSpeciesName: "Mus musculus"
 	});
}
</script>

</head>

<body onload="initializePhenogrid(document.getElementById('phenogrid_container'))">

<div id="phenogrid_container"></div>

</body>
</html>
````
