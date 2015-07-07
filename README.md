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

Sometimes, it requires root access to for the installation, just run the following instead

```
sudo npm install
```

This will create a local `/node_modules` folder in the phenogrid root directory, and download/install all the dependencies(jquery, jquery-ui, d3, and jshashtable) and tools (gulp, browserify, etc.) into the local `/node_modules` folder.

#3. Run gulp to build this widget

```
gulp browserify-byo
```

This command will use browserify to bundle up phenogrid core and its dependencies except jquery. And the target file `phenogrid-byo.js` will be put into the newly created `dist` folder. Because sometimes the users may already have jquery loaded.

#4. Add phenogrid in your target page

Phenogrid widget is created based on jquery and jquery-ui, in order to give developers some flexibility, we provide two options for the actual use of phenogrid widget in your target web page.

##4.1 When jquery.js is used in your target page

In the below sample code, you will see how to use phenogrid as a embeded widget in your HTML.

````html
<html>
<head>
<title>Monarch Phenotype Grid Widget</title>

<script src="PATH_TO_YOUR/jquery.js"></script>
<script src="dist/phenogrid-byo.js"></script>
<script src="config/phenogrid_config.js"></script>

<link rel="stylesheet" type="text/css" href="css/normalize.css">
<link rel="stylesheet" type="text/css" href="css/font-awesome.css">
<link rel="stylesheet" type="text/css" href="css/phenogrid.css">

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

##4.2 When jquery is not used in your target page

If you don't have jquery used and you don't want to add it by yourself, you will need to run the following command to have everything (jquery.js + phenogrid-byo.js) all bundled together into a single concatenated file.

```
gulp create-bundle
```

Now the `phenogrid-bundle.js` will be created and put into the same `dist` folder.

````html
<html>
<head>
<title>Monarch Phenotype Grid Widget</title>

<script src="dist/phenogrid-bundle.js"></script>
<script src="config/phenogrid_config.js"></script>

<link rel="stylesheet" type="text/css" href="css/normalize.css">
<link rel="stylesheet" type="text/css" href="css/font-awesome.css">
<link rel="stylesheet" type="text/css" href="css/phenogrid.css">

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

