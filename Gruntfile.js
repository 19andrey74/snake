module.exports = function (grunt) {
	var DOC_DIR = 'doc',
		SRC_DIR = 'src',
		TEST_DIR = 'test',
		BUILD_DIR = 'build';

	grunt.initConfig({
		watch: {
			sources: {
				files: [
					SRC_DIR + '/**/*.js',
					SRC_DIR + '/**/*.css',
					SRC_DIR + '/**/*.html',
					TEST_DIR + '/**/*.js',
					TEST_DIR + '/**/*.css',
					TEST_DIR + '/**/*.html'
				],
				//tasks: ['jshint'],
				options: {
					interrupt: true,
					livereload: 35729
				}
			}
		},
		jshint: {
			dev: {
				options: {
					jshintrc: '.jshintrc'
				},
				src: [
					'src/**/*.js'
				]
			}
		},
		jsdoc: {
			dist: {
				src: ['src/**/*.js'],
				dest: DOC_DIR
			}
		},
		clean: {
			doc: [DOC_DIR],
			build: [BUILD_DIR],
			test: ['test/specs.js']
		},
		jasmine: {
			dev: {
				//src: '',
				options: {
					polyfills: [],
					vendor: [
						'./node_modules/systemjs/dist/system.js'
					],
					helpers: [],
					keepRunner: false,
					outfile: 'test/specs.html',
					specs: ['test/specs.js']
				}
			}
		},
		targethtml: {
			build: {
				files: {
					'build/index.html': SRC_DIR + '/index.html'
				}
			}
		},
		systemjs: {
			build: {
				src: SRC_DIR + '/index.js',
				dest: BUILD_DIR + '/build.js',
				options: {
					baseURL: SRC_DIR,
					type: 'sfx', //sfx, bundle
					format: 'global',
					minify: true,
					mangle: true,
					sourceMaps: true
				}
			},
			test: {
				src: TEST_DIR + '/index.js',
				dest: TEST_DIR + '/specs.js',
				options: {
					baseURL: './',
					type: 'sfx', //sfx, bundle
					format: 'global'
				}
			}
		}
	});
	
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-jsdoc');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-jasmine');
	grunt.loadNpmTasks('grunt-targethtml');
	grunt.loadTasks('custom_modules/grunt-systemjs-bundler/tasks');

	grunt.registerTask('live', ['watch']);
	grunt.registerTask('jscode', ['jshint:dev']);
	grunt.registerTask('doc', ['clean:doc', 'jsdoc']);
	grunt.registerTask('test', ['systemjs:test', 'jasmine', 'clean:test']);
	grunt.registerTask('build', ['clean:build', 'systemjs:build', 'targethtml:build']);
};