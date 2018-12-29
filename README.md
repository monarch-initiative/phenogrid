# Phenogrid

[![Build Status](https://travis-ci.org/monarch-initiative/phenogrid.svg)](https://travis-ci.org/monarch-initiative/phenogrid)

[![NPM](https://nodei.co/npm/phenogrid.png?downloads=true&stars=true)](https://nodei.co/npm/phenogrid/)

## About Phenogrid

Phenogrid is a Javascript component that visualizes semantic similarity calculations provided by [OWLSim](https://github.com/owlcollab/owltools), as provided through APIs from the [Monarch Initiative](https://monarchinitiative.org/).

Given an input list of phenotypes (you will see the sample input below) and parameters specified in config/phenogrid_config.js indicating desired source of matching models (humans, model organisms, etc.), the phenogrid will call the Monarch API to get OWLSim results and render them in your web browser in data visualization. And you may use the visualized data for your research.

## Installation Instructions

Phenogrid is published as a npm package, so you will need to have npm (npm is bundled and installed automatically with node.js) installed before you can install Phenogrid.

### 1. Install npm

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

### 2. Install Phenogrid package

To download and install the phenogrid widget, simply run

```
npm install phenogrid
```

Sometimes, it requires root access to for the installation, just run the following instead

```
sudo npm install phenogrid
```

This will create a local `/node_modules` folder in your current working directory, and download/install Phenogrid package and all its dependencies (except the devDepencies) into the local `/node_modules` folder.


## Add phenogrid in your target page

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
var data = {
    "title": "Diseases, Mouse and Fish models compared to Pfeiffer Syndrome (OMIM:101600)",
    "xAxis": [
        {
            "groupId": "9606",
            "groupName": "Homo sapiens"
        },
        {
            "groupId": "10090",
            "groupName": "Mus musculus"
        },
        {
            "groupId": "7955",
            "groupName": "Danio rerio"
        }
    ],
    "yAxis": [
        {
            "id": "HP:0000006",
            "term": "Autosomal dominant inheritance"
        },
        {
            "id": "HP:0000174",
            "term": "Abnormality of the palate"
        },
        {
            "id": "HP:0000194",
            "term": "Open mouth"
        },
        {
            "id": "HP:0000218",
            "term": "High palate"
        },
        {
            "id": "HP:0000238",
            "term": "Hydrocephalus"
        },
        {
            "id": "HP:0000244",
            "term": "Brachyturricephaly"
        },
        {
            "id": "HP:0000272",
            "term": "Malar flattening"
        },
        {
            "id": "HP:0000303",
            "term": "Mandibular prognathia"
        },
        {
            "id": "HP:0000316",
            "term": "Hypertelorism"
        },
        {
            "id": "HP:0000322",
            "term": "Short philtrum"
        },
        {
            "id": "HP:0000324",
            "term": "Facial asymmetry"
        },
        {
            "id": "HP:0000327",
            "term": "Hypoplasia of the maxilla"
        },
        {
            "id": "HP:0000348",
            "term": "High forehead"
        },
        {
            "id": "HP:0000431",
            "term": "Wide nasal bridge"
        },
        {
            "id": "HP:0000452",
            "term": "Choanal stenosis"
        },
        {
            "id": "HP:0000453",
            "term": "Choanal atresia"
        },
        {
            "id": "HP:0000470",
            "term": "Short neck"
        },
        {
            "id": "HP:0000486",
            "term": "Strabismus"
        },
        {
            "id": "HP:0000494",
            "term": "Downslanted palpebral fissures"
        },
        {
            "id": "HP:0000508",
            "term": "Ptosis"
        },
        {
            "id": "HP:0000586",
            "term": "Shallow orbits"
        },
        {
            "id": "HP:0000678",
            "term": "Dental crowding"
        },
        {
            "id": "HP:0001156",
            "term": "Brachydactyly syndrome"
        },
        {
            "id": "HP:0001249",
            "term": "Intellectual disability"
        },
        {
            "id": "HP:0002308",
            "term": "Arnold-Chiari malformation"
        },
        {
            "id": "HP:0002676",
            "term": "Cloverleaf skull"
        },
        {
            "id": "HP:0002780",
            "term": "Bronchomalacia"
        },
        {
            "id": "HP:0003041",
            "term": "Humeroradial synostosis"
        },
        {
            "id": "HP:0003070",
            "term": "Elbow ankylosis"
        },
        {
            "id": "HP:0003196",
            "term": "Short nose"
        },
        {
            "id": "HP:0003272",
            "term": "Abnormality of the hip bone"
        },
        {
            "id": "HP:0003307",
            "term": "Hyperlordosis"
        },
        {
            "id": "HP:0003795",
            "term": "Short middle phalanx of toe"
        },
        {
            "id": "HP:0004209",
            "term": "Clinodactyly of the 5th finger"
        },
        {
            "id": "HP:0004322",
            "term": "Short stature"
        },
        {
            "id": "HP:0004440",
            "term": "Coronal craniosynostosis"
        },
        {
            "id": "HP:0005048",
            "term": "Synostosis of carpal bones"
        },
        {
            "id": "HP:0005280",
            "term": "Depressed nasal bridge"
        },
        {
            "id": "HP:0005347",
            "term": "Cartilaginous trachea"
        },
        {
            "id": "HP:0006101",
            "term": "Finger syndactyly"
        },
        {
            "id": "HP:0006110",
            "term": "Shortening of all middle phalanges of the fingers"
        },
        {
            "id": "HP:0009602",
            "term": "Abnormality of thumb phalanx"
        },
        {
            "id": "HP:0009773",
            "term": "Symphalangism affecting the phalanges of the hand"
        },
        {
            "id": "HP:0010055",
            "term": "Broad hallux"
        },
        {
            "id": "HP:0010669",
            "term": "Hypoplasia of the zygomatic bone"
        },
        {
            "id": "HP:0011304",
            "term": "Broad thumb"
        }
    ]
};

window.onload = function() {
    // There are three species that are loaded and each of them has simsearch matches.
    Phenogrid.createPhenogridForElement(document.getElementById('phenogrid_container'), {
        serverURL : "https://monarchinitiative.org",
        gridSkeletonData: data
    });
}
</script>

</head>

<body>

<div id="phenogrid_container" class="clearfix"></div>

</body>
</html>
```

## Configuration Parameters

### `serverURL`  string | required

This URL should be pointed to the OWLSim URL server associated with your installation containing the Monarch web services. You have three options:
- Use http://beta.monarchinitiative.org to connect to the development/test web services. This server is less stable than the production server.
- Use https://monarchinitiative.org to connect to the stable, production version of the web services (better uptime)
- If you are running the complete monarch-app, you can point it to http://localhost:8080, or whichever server/port you are using in your local installation.


### `gridSkeletonData`  object | required

It is a Javascript object that contains all the target and source data to be rendered in the grid. Please refer to the above example. Basically, it consists of three parts: `title`, `xAxis`, and `yAxis`.

- `title` - Short description of the data.
- `xAxis` - An arry of target groups. Each group is a Javascript object that has `groupId` and `groupName` (must be unique), both are strings.
- `yAxis` - An array of phenotypes. Each phenotype is formatted as an object that has `id` and `term`, both are strings.

Following is an simple example:

````
{
    "title": "Diseases, Mouse and Fish models ",
    "xAxis": [
        {
            "groupId": "9606",
            "groupName": "Homo sapiens"
        },
        {
            "groupId": "10090",
            "groupName": "Mus musculus"
        },
        {
            "groupId": "7955",
            "groupName": "Danio rerio"
        }
    ],
    "yAxis": [
        {
            "id": "HP:0000006",
            "term": "Autosomal dominant inheritance"
        },
        {
            "id": "HP:0000174",
            "term": "Abnormality of the palate"
        },
        {
            "id": "HP:0011304",
            "term": "Broad thumb"
        }
    ]
}
````

### `selectedSort`  string | optional

The different ways that the sources (e.g., phenotypes) can be sorted. The sources that are shown on the left side of the grid may be sorted using one of three methods. 
- Alphabetical - A-Z
- Frequency and Rarity - sources, e.g., phenotypes are sorted by the sum of the phenotype values across all models/genes
- Frequency - Default, sources, e.g., phenotypes are sorted by the count of the number of model/gene matches per phenotype

### `selectedCalculation`  string | optional

For each pairwise comparison of phenotypes from the query (q) and target (t), we can assess their individual similarities in a number of ways. 
- 0 - Similarity
- 1 - Ratio (q)
- 2 - Uniqueness
- 3 - Ratio (t)

## Web Browser Support

Some phenogrid features are not support by IE 11 and below. So please use Google chrome, Fireffox, or Safari to open this widget.

## For developers

If you would like to poke around Phenogrid and make changes to the source code, you will also need to have all the devDepencies downloaded by running the following code in the Phenogrid package root directory:

````
npm install
````

Once the installation is finished, you are welcome to make code changes and test them out by running

````
gulp bundle
````

This command will use browserify to bundle up phenogrid core and its dependencies into phenogrid-bundle.js and create the merged phenogrid-bundle.css and put both files under dist folder. And both bundled files will be minified.

It's helpful to have unminified versions of phenogrid-bundle.js and phenogrid-bundle.css for development and debugging. If this is the case, you can run the following command.

````
gulp dev-bundle
````

This will also show you all the JSHint messages for debugging or improving the code.

## License

Phenogrid is released under the [GPL-2.0 license](https://opensource.org/licenses/GPL-2.0).

