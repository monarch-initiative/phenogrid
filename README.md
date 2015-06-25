#Install Node/NPM

Before you get started, you will need to make sure you have npm installed first. npm is bundled and installed automatically with node.js.

```
curl -sL https://rpm.nodesource.com/setup | bash -

yum install -y nodejs
```

#Install browserify globally

Then we will need to install browserify via npm.

```
npm install -g browserify
```

#Install required NPM packages

Now it's time to download and extract our phenogrid widget. In the phenogrid package directory, just run

```
npm install
```

This will download and install all the dependencies(jquery, jquery-ui, d3, and jshashtable) in the local `/node_modules` folder.

#Run browserify

In the `/js` directory, run

```
browserify phenogrid.js --debug > bundle.js
```

Now the bundle.js will be created.