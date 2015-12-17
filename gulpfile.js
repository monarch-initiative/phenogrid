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
var replace = require('gulp-replace');
var marked = require('marked');
var jshint = require('gulp-jshint');
var fileinclude = require('gulp-file-include');

// helper function of marked
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

// path config
var paths = {
    readme: ['./README.md'],
    js: ['./js/*.js'],
    tests: ['./tests/mocha/*.test.js'],
    dist:'./dist/' // output folder is a string, not an array
};

// The default task is to build the different distributions.
gulp.task('bundle', [
    'js-bundle', 
    'css-bundle', 
    'create-index', 
    'copy-font-awesome-fonts', 
    'copy-jquery-ui-images'
]);

// an alternate task that won't uglify. useful for debugging
gulp.task('dev-bundle', [
    'lint', 
    'js-dev-bundle', 
    'css-dev-bundle', 
    'create-index',
    'copy-font-awesome-fonts', 
    'copy-jquery-ui-images'
]);

// JSHint
gulp.task("lint", function() {
     return gulp.src(paths.js)
        .pipe(jshint())
        .pipe(jshint.reporter("jshint-stylish"));
        //.pipe(jshint.reporter("fail"));
});


// Bundle JS together with browserify
gulp.task('js-bundle', function(cb) {
    var bundleStream = browserify('./js/phenogrid.js').bundle();
    
    bundleStream
    .pipe(source('./js/phenogrid.js'))
    .pipe(streamify(uglify())) // Minify JS
    .pipe(rename('phenogrid-bundle.js'))
    .pipe(gulp.dest(paths.dist))
    .on('end', cb);
});


// No minify for dev bundle
gulp.task('js-dev-bundle', function(cb) {
    var bundleStream = browserify('./js/phenogrid.js').bundle();
    
    bundleStream
    .pipe(source('./js/phenogrid.js'))
    .pipe(rename('phenogrid-bundle.js'))
    .pipe(gulp.dest(paths.dist))
    .on('end', cb);
});

// Bundle CSS together with gulp concat
gulp.task('css-bundle', function(cb) {
  return gulp.src(['./node_modules/normalize.css/normalize.css', 
                   './node_modules/font-awesome/css/font-awesome.css', 
                   './node_modules/jquery-ui/themes/base/jquery-ui.css', // 'base' theme
                   './css/phenogrid.css'])
    .pipe(concat('phenogrid-bundle.css'))
    .pipe(replace('../fonts/', 'fonts/')) // change fonts path in font-awesome.css
    .pipe(minifyCSS()) //Minify CSS
    .pipe(gulp.dest(paths.dist));
});

// No minify for dev bundle
gulp.task('css-dev-bundle', function(cb) {
  return gulp.src(['./node_modules/normalize.css/normalize.css', 
                   './node_modules/font-awesome/css/font-awesome.css', 
                   './node_modules/jquery-ui/themes/base/jquery-ui.css', // 'base' theme
                   './css/phenogrid.css'])
    .pipe(concat('phenogrid-bundle.css'))
    .pipe(replace('../fonts/', 'fonts/')) // change fonts path in font-awesome.css
    .pipe(gulp.dest(paths.dist));
});

// create index.html from template and README
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

// Copy font-awesome fonts used in font-awesome.css
// since we've already replaced '../fonts/' with 'fonts/' in the bundled CSS file, 
// we can put the fonts folder inside dist/ now
gulp.task('copy-font-awesome-fonts', function(cb) {
  return gulp.src('./node_modules/font-awesome/fonts/*')
    .pipe(gulp.dest(paths.dist + 'fonts/'));
});

// Copy jquery-ui images used in jquery-ui.css
gulp.task('copy-jquery-ui-images', function(cb) {
  return gulp.src('./node_modules/jquery-ui/themes/base/images/*')
    .pipe(gulp.dest(paths.dist + 'images/'));
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