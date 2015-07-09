
Add phenogrid in your target page

Phenogrid widget is created based on several JavaScript libraries. In the below sample code, you will see how to use phenogrid as a embeded widget in your HTML.

````html
<html>
<head>
<title>Monarch Phenotype Grid Widget</title>

<script src="js/jquery-1.11.0.min.js"></script>
<script src="js/jquery-ui-1.10.3.custom.min.js"></script>
<script src="js/d3.min.js"></script>
<script src="js/jshashtable.js"></script>
<script src="config/phenogrid_config.js"></script>
<script src="js/phenogrid.js"></script>
<script src="js/stickytooltip.js"></script>
<script src="js/render.js"></script>

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

