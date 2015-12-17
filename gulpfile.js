(function () {
'use strict';

////
//// Usage: node ./node_modules/.bin/gulp <TARGET>
//// Current top targets:
////  - bundle: create the distribution files
////  - tests: run the unit tests
////

var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var rename = require("gulp-rename");
var mocha = require('gulp-mocha'); // Keep in mind that this is just a thin wrapper around Mocha and your issue is most likely with Mocha
var streamify = require('gulp-streamify');
var uglify = require('gulp-uglify');
var minifyCSS = require('gulp-minify-css');
var concat = require('gulp-concat');
var marked = require('marked');
var jshint = require('gulp-jshint');
var fileinclude = require('gulp-file-include');

function markdownHelper(text) {
  marked.setOptions({
    gfm: true,
    tables: true,
    breaks: true,
    pedantic: true,
    sanitize: true,
    smartLists: true,
    smartypants: true
  });
  return marked.parse(text);
}

var paths = {
    readme: ['./README.md'],
    transients:[],
    js: ['js/*.js'],
    tests: ['tests/mocha/*.test.js']
};

// The default task is to build the different distributions.
gulp.task('bundle', ['create-index', 'js-bundle', 'css-bundle']);


// an alternate task that won't uglify. useful for debugging
gulp.task('dev-bundle', ['lint', 'create-index', 'js-dev-bundle', 'css-bundle']);

// JSHint
gulp.task("lint", function() {
     return gulp.src(paths.js)
        .pipe(jshint())
        .pipe(jshint.reporter("jshint-stylish"));
        //.pipe(jshint.reporter("fail"));
});

gulp.task('create-index', ['clean'], function(cb) {
  gulp.src(['templates/index.html'])
    .pipe(fileinclude({
      filters: {
        marked: markdownHelper
      }
    }))
    .pipe(gulp.dest('./'));
});

// Get rid of anything that is transient.
gulp.task('clean', function(cb) {
    cb(null);
});

// Bundle JS together with browserify
gulp.task('js-bundle', function(cb) {
    var bundleStream = browserify('./js/phenogrid.js').bundle();
    
    bundleStream
    .pipe(source('./js/phenogrid.js'))
    .pipe(streamify(uglify())) // Minify JS
    .pipe(rename('phenogrid-bundle.js'))
    .pipe(gulp.dest('./dist/'))
    .on('end', cb);
});


// Bundle JS together with browserify
gulp.task('js-dev-bundle', function(cb) {
    var bundleStream = browserify('./js/phenogrid.js').bundle();
    
    bundleStream
    .pipe(source('./js/phenogrid.js'))
    .pipe(rename('phenogrid-bundle.js'))
    .pipe(gulp.dest('./dist/'))
    .on('end', cb);
});

// Bundle CSS together with gulp concat
gulp.task('css-bundle', function(cb) {
  return gulp.src(['./node_modules/normalize.css/normalize.css', './css/font-awesome-modified.css', './css/jquery-ui-modified.css', './css/phenogrid.css' , './css/sumoselect.css'])
    .pipe(concat('phenogrid-bundle.css'))
    .pipe(minifyCSS()) //Minify CSS
    .pipe(gulp.dest('./dist/'));
});

// Testing with mocha/chai
gulp.task('test', function() {
    return gulp.src(paths.tests, {read: false}).pipe(mocha({
        reporter: 'spec' // or 'nyan'
    }));
});



// The default task (called when you run `gulp` from cli)
gulp.task('default', function() {
    console.log("Please specify the task name!");
});


}());