module.exports = function(grunt) {
	grunt.initConfig({
		connect: {
			server: {
				options: {
					base: '',
					port: 9999
				}
			}
		},

		'saucelabs-qunit': {
			all: {
                options: {
                    username: 'idbbackbone',
                    key: '6ffa8cb3-47f3-4532-aedb-aee964d0eefb',
                    urls: ['http://127.0.0.1:9999/tests/test.html'],
                    testname: 'qunit tests',
                    browsers: [{
                        browserName: 'chrome',
                        platform: 'linux'
                    }]
                }
            }
		},
		watch: {}
	});

    // Loading dependencies
	for (var key in grunt.file.readJSON('package.json').devDependencies) {
		if (key !== 'grunt' && key.indexOf('grunt') === 0) grunt.loadNpmTasks(key);
	}

	grunt.registerTask('default', ['connect', 'watch']);
	grunt.registerTask('test', ['connect', 'saucelabs-qunit']);
};