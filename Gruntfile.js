module.exports = function(grunt) {
    grunt.initConfig({
        concat: {
            dev: {
                src: [
                    "javascript/handlebars.runtime.js",
                    "javascript/templates.compiled.js",
                    "javascript/html-sanitiser.js",
                    "javascript/mousetrap.js",
                    "javascript/jfeed/*.js",
                    "javascript/app.js"
                ],
                dest: "javascript/app.dev.js"
            }
        },
        handlebars: {
            compile: {
                options: {
                    namespace: "JST"
                },
                files: {
                    "javascript/templates.compiled.js": "templates/*.hbs"
                }
            }
        },
        watch: {
            templates: {
                files: [
                    'templates/*.hbs',
                ],
                tasks: ['handlebars','concat']
            },
            scripts: {
                files: [
                    'javascript/app.js',
                    'javascript/*/*.js'
                ],
                tasks: ['concat']
            },
        },
    });

    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-contrib-handlebars");

    grunt.registerTask("default", ["watch"]);
    grunt.registerTask("build", ["handlebars","concat"]);
}