(function () {
'use strict';

////
//// Usage: node ./node_modules/.bin/gulp <TARGET>
//// Current top targets:
////  - bundle: create the distribution files in production mode
////  - dev-bundle: create the distribution files in development mode
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

// bundling config
var config = {
    jshint: {
        source: ['./js/*.js']
    },
    tests: {
        source: ['./tests/mocha/*.test.js']
    },
    dist: './dist/', // output folder is a string, not an array
    html: {
        source: ['templates/index.html'],
        target: './'
    },
    js: {
        source: './js/phenogrid.js',
        target: 'phenogrid-bundle.js'
    },
    css: {
        source: [
            './node_modules/normalize.css/normalize.css', 
            './node_modules/font-awesome/css/font-awesome.css', 
            './node_modules/jquery-ui/themes/base/jquery-ui.css', // 'base' theme
            './css/phenogrid.css'
        ],
        replace: {
            search: '../fonts/', // change fonts path in font-awesome.css
            replace: 'fonts/'
        },
        target: 'phenogrid-bundle.css'
    },
    images: {
        source: './node_modules/jquery-ui/themes/base/images/*',
        target: 'images/'
    },
    fonts: {
        source: './node_modules/font-awesome/fonts/*',
        target: 'fonts/'
    }
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
     return gulp.src(config.jshint.source)
        .pipe(jshint())
        .pipe(jshint.reporter("jshint-stylish"));
        //.pipe(jshint.reporter("fail"));
});


// Bundle JS together with browserify
gulp.task('js-bundle', function(cb) {
    var bundleStream = browserify(config.js.source).bundle();
    
    bundleStream
    .pipe(source(config.js.source))
    .pipe(streamify(uglify())) // Minify JS
    .pipe(rename(config.js.target))
    .pipe(gulp.dest(config.dist))
    .on('end', cb);
});


// No minify for dev bundle
gulp.task('js-dev-bundle', function(cb) {
    var bundleStream = browserify(config.js.source).bundle();
    
    bundleStream
    .pipe(source(config.js.source))
    .pipe(rename(config.js.target))
    .pipe(gulp.dest(config.dist))
    .on('end', cb);
});

// Bundle CSS together with gulp concat
gulp.task('css-bundle', function(cb) {
  return gulp.src(config.css.source)
    .pipe(concat(config.css.target))
    .pipe(replace(config.css.replace.search, config.css.replace.replace)) // change fonts path in font-awesome.css
    .pipe(minifyCSS()) //Minify CSS
    .pipe(gulp.dest(config.dist));
});

// No minify for dev bundle
gulp.task('css-dev-bundle', function(cb) {
  return gulp.src(config.css.source)
    .pipe(concat(config.css.target))
    .pipe(replace(config.css.replace.search, config.css.replace.replace)) // change fonts path in font-awesome.css
    .pipe(gulp.dest(config.dist));
});


// create index.html from template and README
gulp.task('create-index', ['clean'], function(cb) {
  gulp.src(config.html.source)
    .pipe(fileinclude({
      filters: {
        marked: marked.parse
      }
    }))
    .pipe(gulp.dest(config.html.target));
});

// Get rid of anything that is transient.
gulp.task('clean', function(cb) {
    cb(null);
});

// Copy font-awesome fonts used in font-awesome.css
// since we've already replaced '../fonts/' with 'fonts/' in the bundled CSS file, 
// we can put the fonts folder inside dist/ now
gulp.task('copy-font-awesome-fonts', function(cb) {
  return gulp.src(config.fonts.source)
    .pipe(gulp.dest(config.dist + config.fonts.target));
});

// Copy jquery-ui images used in jquery-ui.css
gulp.task('copy-jquery-ui-images', function(cb) {
  return gulp.src(config.images.source)
    .pipe(gulp.dest(config.dist + config.images.target));
});

// Testing with mocha/chai
gulp.task('test', function() {
    return gulp.src(config.tests.source, {read: false}).pipe(mocha({
        reporter: 'spec' // or 'nyan'
    }));
});



// The default task (called when you run `gulp` from cli)
gulp.task('default', function() {
    console.log("Please specify the task name!");
});


}());