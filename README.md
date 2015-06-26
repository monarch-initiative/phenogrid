#1. Make sure npm installed

Before you get started, you will need to make sure you have npm installed first. npm is bundled and installed automatically with node.js. If not, you need to install them.

```
curl -sL https://rpm.nodesource.com/setup | bash -

yum install -y nodejs
```

#2. Install phenogrid widget

Now it's time to download and extract our phenogrid widget. In the phenogrid package directory, just run

```
npm install
```

This will create a local `/node_modules` folder in the phenogrid root directory, and download/install all the dependencies(jquery, jquery-ui, d3, and jshashtable) and tools (gulp, browserify, etc.) into the local `/node_modules` folder.

#3. Run gulp to build this widget

```
gulp browserify-byo
```

This command will use browserify to bundle up phenogrid core and its dependencies except jquery. And the target file `phenogrid-byo.js` will be put into the newly created `dist` folder. Because sometimes the users may already have jquery loaded. And not, you will need to run the following command to have everything all bundled together into a single concatenated file.

```
gulp create-bundle
```

Now the `phenogrid-bundle.js` will be created and put into the same `dist` folder.

#4. Use of phenogrid in your HTML

In the below sample code, you will see how to use phenogrid as a embeded widget in your HTML.

````html
<html>
<head>
<title>Monarch Phenotype Grid Widget</title>

<script src="dist/phenogrid-bundle.js"></script>
<script src="config/phenogrid_config.js"></script>

<link rel="stylesheet" type="text/css" href="css/jquery-ui.css"/>
<link rel="stylesheet" type="text/css" href="css/phenogrid.css"/>
<link rel="stylesheet" type="text/css" href="css/stickytooltip.css"/>

<script>
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
	{ id:"HP:0007159", observed:"positive"}
];	

$(document).ready(function(){
	$("#phenogrid_container").phenogrid({
		serverURL :"http://beta.monarchinitiative.org", 
		phenotypeData: phenotypes,
		targetSpeciesName: "Mus musculus" 
	});
});

</script>

</head>

<body>

<div id="phenogrid_container"></div>

</body>
</html>
````


