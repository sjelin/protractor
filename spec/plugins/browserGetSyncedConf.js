var env = require('../environment.js'),
    q = require('q');

// A small suite to make sure the basic functionality of plugins work
// Tests the (potential) edge case of exactly one plugin being used
exports.config = {
  seleniumAddress: env.seleniumAddress,

  framework: 'jasmine2',

  // Spec patterns are relative to this directory.
  specs: [
    'specs/browser_get_spec.js'
  ],

  capabilities: env.capabilities,

  baseUrl: env.baseUrl,

  jasmineNodeOpts: {
    isVerbose: true,
    realtimeFailure: true
  },

  // Plugin patterns are relative to this directory.
  plugins: [{
    inline: {
      rewriteURL: function(oldURL) {
        return q.delay(5000).then(function() {
          return oldURL + '#/form';
        });
      },
      onPageLoad: function() {
        return q.delay(5000).then(function() {
          protractor.ON_PAGE_LOAD = true;
        });
      },
      onPageSync: function() {
        if (protractor.ON_PAGE_LOAD) {
          this.addSuccess();
        } else {
          this.addFailure('onPageLoad did not finish before onPageSync began');
        }
        return q.delay(5000).then(function() {
          protractor.ON_PAGE_SYNC = true;
        });
      },
      teardown: function() {
        if (protractor.ON_PAGE_SYNC) {
          this.addSuccess();
        } else {
          this.addFailure('onPageSync did not finish before teardown');
        }
        var self = this;
        return browser.getCurrentUrl().then(function(url) {
          if (url != 'http://localhost:8081/index.html#/form') {
            self.addFailure('Got url "' + url +
                '", but expected "http://localhost:8081/index.html#/form"');
          } else {
            self.addSuccess();
          }
        });
      }
    }
  }]
};
