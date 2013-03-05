module.exports = function(grunt) {
	grunt.initConfig({
		connect: {
			server: {
				options: {
					base: '.',
					port: 9999
				}
			}
		},

		'saucelabs-qunit': {
			all: {
				username: 'idbbackbone',
				key: '6ffa8cb3-47f3-4532-aedb-aee964d0eefb',
				urls: ['http://127.0.0.1:9999/tests/test.html'],
				tunnelTimeout: 5,
				build: process.env.TRAVIS_JOB_ID,
				concurrency: 3,
				browsers: [{
					browserName: 'googlechrome',
					platform: 'linux'
				}]
			}
		},
		watch: {}
	});

	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-saucelabs');

	grunt.registerTask('default', ['connect', 'watch']);
	grunt.registerTask('test', ['connect', 'saucelabs-qunit']);
};