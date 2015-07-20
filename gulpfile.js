(function () {
'use strict';

////
//// Usage: node ./node_modules/.bin/gulp <TARGET>
//// Current top targets:
////  - bundle: create the distribution files
////  - tests: run the unit tests
//// Watch targets:
////  - watch-tests: run tests on changes to source files
////

var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var rename = require("gulp-rename");
var mocha = require('gulp-mocha');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var bump = require('gulp-bump');
var del = require('del');
var shell = require('gulp-shell');
var marked = require('marked');
var jshint = require('gulp-jshint');
var jshints = require('jshint-stylish');

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
var fileinclude = require('gulp-file-include');


var paths = {
    readme: ['./README.md'],
    transients:[],
    js: ['js/*.js'],
    tests: ['tests/*.test.js', 'tests/*.tests.js']
};

// The default task is to build the different distributions.
gulp.task('bundle', ['lint', 'create-index', 'js-bundle', 'css-bundle']);

gulp.task('create-index', ['clean'], function(cb) {
  gulp.src(['templates/index.html'])
    .pipe(fileinclude({
      filters: {
        marked: markdownHelper
      }
    }))
    .pipe(gulp.dest('./'));
});

// Bundle JS together with browserify
gulp.task('js-bundle', function(cb) {
    browserify('./js/phenogrid.js')
    .bundle()
    .pipe(source('./js/phenogrid.js'))
    .pipe(rename('phenogrid-bundle.js'))
    .pipe(gulp.dest('./dist/'))
    .on('end', cb);
});

// Bundle CSS together with gulp concat
gulp.task('css-bundle', function(cb) {
  return gulp.src(['./css/normalize.css', './css/font-awesome-modified.css', './css/jquery-ui-modified.css', './css/phenogrid.css'])
    .pipe(concat('phenogrid-bundle.css'))
    .pipe(gulp.dest('./dist/'));
});

// Browser runtime environment construction.
gulp.task('build', ['bundle', 'patch-bump']);

gulp.task('patch-bump', function(cb){
    gulp.src('./package.json')
	.pipe(bump({type: 'patch'}))
	.pipe(gulp.dest('./'));
    cb(null);
});

gulp.task('minor-bump', function(cb){
    gulp.src('./package.json')
	.pipe(bump({type: 'minor'}))
	.pipe(gulp.dest('./'));
    cb(null);
});

gulp.task('major-bump', function(cb){
    gulp.src('./package.json')
	.pipe(bump({type: 'major'}))
	.pipe(gulp.dest('./'));
    cb(null);
});

// Get rid of anything that is transient.
gulp.task('clean', function(cb) {
    cb(null);
});

// Testing with mocha/chai.
gulp.task('tests', function() {
    return gulp.src(paths.tests, { read: false }).pipe(mocha({
	reporter: 'spec',
	globals: {
	    // Use a different should.
	    should: require('chai').should()
	}
    }));
});

gulp.task('release', ['build', 'publish-npm']);

// Needs to have ""
gulp.task('publish-npm', function() {
    var npm = require("npm");
    npm.load(function (er, npm) {
	// NPM
	npm.commands.publish();
    });
});

// Rerun test build when a file changes.
gulp.task('watch-tests', function() {
  gulp.watch(paths.tests, ['tests', 'bundle']);
});

gulp.task("lint", function() {
     return gulp.src(paths.js)
        .pipe(jshint())
        .pipe(jshint.reporter("jshint-stylish"));
        //.pipe(jshint.reporter("fail"));
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', function() {
    console.log("'allo 'allo!");
});


}());
