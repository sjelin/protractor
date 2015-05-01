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
      setup: function() {
        browser.ignoreSynchronization = true;
      },
      onPageLoad: function() {
        return q.delay(5000).then(function() {
          protractor.ON_PAGE_LOAD = true;
        });
      },
      onPageSync: function() {
        this.addFailure('onPageSync should not have ran when ' +
            'browser.ignoreSynchronization is true.');
      },
      teardown: function() {
        if (protractor.ON_PAGE_LOAD) {
          this.addSuccess();
        } else {
          this.addFailure('onPageLoad did not finish before teardown');
        }
      }
    }
  }]
};
