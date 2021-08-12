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
var uglify = require('gulp-uglify-es').default;
var cssnano = require('gulp-cssnano');
var concat = require('gulp-concat');
var replace = require('gulp-replace');
var eslint = require('gulp-eslint');
// var jshint = require('gulp-jshint');
var fileinclude = require('gulp-file-include');

// bundling config
var config = {
    eslint: {
        source: ['./js/*.js']
    },
    // jshint: {
    //     source: ['./js/*.js']
    // },
    tests: {
        source: ['./tests/mocha/*.test.js']
    },
    dist: './dist/', // output folder is a string, not an array
    js: {
        source: './js/phenogrid.js',
        target: 'phenogrid-bundle.js'
    },
    css: {
        source: [
            './node_modules/normalize.css/normalize.css',
            './node_modules/font-awesome/css/font-awesome.css',

            './node_modules/jquery-ui/themes/base/core.css',
            './node_modules/jquery-ui/themes/base/accordion.css',
            './node_modules/jquery-ui/themes/base/autocomplete.css',
            './node_modules/jquery-ui/themes/base/button.css',
            './node_modules/jquery-ui/themes/base/checkboxradio.css',
            './node_modules/jquery-ui/themes/base/controlgroup.css',
            './node_modules/jquery-ui/themes/base/datepicker.css',
            './node_modules/jquery-ui/themes/base/dialog.css',
            './node_modules/jquery-ui/themes/base/draggable.css',
            './node_modules/jquery-ui/themes/base/menu.css',
            './node_modules/jquery-ui/themes/base/progressbar.css',
            './node_modules/jquery-ui/themes/base/resizable.css',
            './node_modules/jquery-ui/themes/base/selectable.css',
            './node_modules/jquery-ui/themes/base/selectmenu.css',
            './node_modules/jquery-ui/themes/base/sortable.css',
            './node_modules/jquery-ui/themes/base/slider.css',
            './node_modules/jquery-ui/themes/base/spinner.css',
            './node_modules/jquery-ui/themes/base/tabs.css',
            './node_modules/jquery-ui/themes/base/tooltip.css',
            './node_modules/jquery-ui/themes/base/theme.css',
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

// // JSHint
// gulp.task("lint", function() {
//     return gulp.src(config.jshint.source)
//         .pipe(jshint())
//         .pipe(jshint.reporter("jshint-stylish"));
//         //.pipe(jshint.reporter("fail"));
// });

// ESLint
gulp.task("lint", function() {
    return gulp.src(config.eslint.source)
        .pipe(eslint());
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
        .pipe(cssnano()) //Minify CSS
        .pipe(gulp.dest(config.dist));
});

// No minify for dev bundle
gulp.task('css-dev-bundle', function(cb) {
    return gulp.src(config.css.source)
        .pipe(concat(config.css.target))
        .pipe(replace(config.css.replace.search, config.css.replace.replace)) // change fonts path in font-awesome.css
        .pipe(gulp.dest(config.dist));
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

// The default task is to build the different distributions.
gulp.task('bundle', gulp.series(
    'js-bundle',
    'css-bundle',
    'copy-font-awesome-fonts',
    'copy-jquery-ui-images'
));

// an alternate task that won't uglify. useful for debugging
gulp.task('dev-bundle', gulp.series(
    'lint',
    'js-dev-bundle',
    'css-dev-bundle',
    'copy-font-awesome-fonts',
    'copy-jquery-ui-images'
));

}());
