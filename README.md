#1. Install Node/NPM

Before you get started, you will need to make sure you have npm installed first. npm is bundled and installed automatically with node.js.

```
curl -sL https://rpm.nodesource.com/setup | bash -

yum install -y nodejs
```

#2. Install browserify globally

Then we will need to install browserify via npm.

```
npm install -g browserify
```

#3. Install required NPM packages

Now it's time to download and extract our phenogrid widget. In the phenogrid package directory, just run

```
npm install
```

This will download and install all the dependencies(jquery, jquery-ui, d3, and jshashtable) in the local `/node_modules` folder.

#4. Run browserify

In the `/js` directory, run

```
browserify phenogrid.js --debug > bundle.js
```

Now the bundle.js will be created.