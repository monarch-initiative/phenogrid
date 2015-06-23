#Install Node/NPM

npm is packaged with node.js

```
curl -sL https://rpm.nodesource.com/setup | bash -

yum install -y nodejs
```

#Install browserify globally

```
npm install -g browserify
```

#Install NPM packages

```
npm install jquery jquery-ui d3 jshashtable
```

#Run browserify
In the ./js directory, run

```
browserify phenogrid.js --debug > bundle.js
```