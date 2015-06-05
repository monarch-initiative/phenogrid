////
//// Usage: node ./node_modules/.bin/gulp build, clean, etc.
////

var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var rename = require("gulp-rename");

gulp.task('browserify', function() {
    return browserify('./entry.js')
	.bundle()
        .pipe(source('./entry.js'))
	.pipe(rename('bundle.js'))
	.pipe(gulp.dest('.'));
});

gulp.task('default', ['browserify']);
