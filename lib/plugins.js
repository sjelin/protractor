var q = require('q'),
    ConfigParser = require('./configParser'),
    log = require('./logger');

/**
 * The plugin API for Protractor.  Note that this API is unstable. See
 * plugins/README.md for more information.
 *
 * @constructor
 * @param {Object} config parsed from the config file
 */
var Plugins = function(config) {
  var self = this;

  this.pluginConfs = config.plugins || [];
  this.pluginObjs = [];
  this.assertions = {};
  this.resultsReported = false;
  this.pluginConfs.forEach(function(pluginConf, i) {
    var path;
    if (pluginConf.path) {
      path = ConfigParser.resolveFilePatterns(pluginConf.path, true,
          config.configDir)[0];
    } else {
      path = pluginConf.package;
    }

    var pluginObj;
    if (path) {
      pluginObj = require(path);
    } else if(pluginConf.inline) {
      pluginObj = pluginConf.inline;
    } else {
      throw new Error('Plugin configuration did not contain a valid path or ' +
          'inline definition.');
    }

    self.annotatePluginObj(pluginObj, pluginConf, i);
    log.debug('Plugin "' + pluginObj.name + '" loaded.');
    self.pluginObjs.push(pluginObj);
  });
};

Plugins.prototype.annotatePluginObj = function(obj, conf, i) {
  var self = this;
  function addAssertion(info, passed, message) {
    if (self.resultsReported) {
      throw new Error('Cannot add new tests results, since they were already ' +
          'reported.');
    }
    info = info || {};
    var specName = info.specName || (obj.name + ' Plugin Tests');
    var assertion = {passed: passed};
    if (!passed) {
      assertion.errorMsg = message;
      if (info.stackTrace) {
        assertion.stackTrace = info.stackTrace;
      }
    }
    self.assertions[specName] = self.assertions[specName] || [];
    self.assertions[specName].push(assertion);
  }

  obj.name = obj.name || conf.name || conf.path || conf.package ||
      ('Plugin #' + i);
  obj.config = conf;
  obj.addFailure = function(message, options) {
    addAssertion(options, false, message);
  };
  obj.addSuccess = function(options) {
    addAssertion(options, true);
  };
  obj.addWarning = function(message, options) {
    options = options || {};
    log.puts('Warning ' + (options.specName ? 'in ' + options.specName :
        'from "' + obj.name + '" plugin') +
        ': ' + message);
  };
};

function printPluginResults(specResults) {
  var green = '\x1b[32m';
  var red = '\x1b[31m';
  var normalColor = '\x1b[39m';

  var printResult = function(message, pass) {
    log.puts(pass ? green : red,
        '\t', pass ? 'Pass: ' : 'Fail: ', message, normalColor);
  };

  for (var j = 0; j < specResults.length; j++) {
    var specResult = specResults[j];
    var passed = specResult.assertions.map(function(x) {
      return x.passed;
    }).reduce(function(x, y) {
      return x && y;
    }, true);

    printResult(specResult.description, passed);
    if (!passed) {
      for (var k = 0; k < specResult.assertions.length; k++) {
        var assertion = specResult.assertions[k];
        if (!assertion.passed) {
          log.puts('\t\t' + assertion.errorMsg);
          if (assertion.stackTrace) {
            log.puts('\t\t' + assertion.stackTrace.replace(/\n/g, '\n\t\t'));
          }
        }
      }
    }
  }
}

Plugins.prototype.getResults = function() {
  var results = {
    failedCount: 0,
    specResults: []
  };
  for (var specName in this.assertions) {
    results.specResults.push({
      description: specName,
      assertions: this.assertions[specName]
    });
    results.failedCount += this.assertions[specName].filter(
        function (assertion) {return !assertion.passed;}).length;
  }
  printPluginResults(results.specResults);
  this.resultsReported = true;
  return results;
};

function pluginFunFactory(funName) {
  return function() {
    var promises = [];
    var self = this;
    var args = arguments;
    this.pluginObjs.forEach(function(pluginObj) {
      if (pluginObj[funName]) {
        promises.push(q.fcall(function() {
          return pluginObj[funName].apply(pluginObj, args);
        }).fail(function(e) {
          if (self.resultsReported) {
            printPluginResults([{
              description: pluginObj.name + ' Runtime',
              assertions: [{
                passed: false,
                errorMsg: 'Failure during ' + funName + ': ' + (e.message || e),
                stackTrace: e.stack
              }]
            }]);
          } else {
              pluginObj.addFailure('Failure during ' + funName + ': ' +
                  e.message || e, {stackTrace: e.stack});
          }
        }));
      }
    });

    return q.all(promises);
  };
}

/**
 * @see docs/plugins.md for information on these functions
 */
Plugins.prototype.setup = pluginFunFactory('setup');
Plugins.prototype.teardown = pluginFunFactory('teardown');
Plugins.prototype.postResults = pluginFunFactory('postResults');
Plugins.prototype.postTest = pluginFunFactory('postTest');

module.exports = Plugins;
