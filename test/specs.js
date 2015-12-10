"format global";
(function(global) {

  var defined = {};

  // indexOf polyfill for IE8
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  var getOwnPropertyDescriptor = true;
  try {
    Object.getOwnPropertyDescriptor({ a: 0 }, 'a');
  }
  catch(e) {
    getOwnPropertyDescriptor = false;
  }

  var defineProperty;
  (function () {
    try {
      if (!!Object.defineProperty({}, 'a', {}))
        defineProperty = Object.defineProperty;
    }
    catch (e) {
      defineProperty = function(obj, prop, opt) {
        try {
          obj[prop] = opt.value || opt.get.call(obj);
        }
        catch(e) {}
      }
    }
  })();

  function register(name, deps, declare) {
    if (arguments.length === 4)
      return registerDynamic.apply(this, arguments);
    doRegister(name, {
      declarative: true,
      deps: deps,
      declare: declare
    });
  }

  function registerDynamic(name, deps, executingRequire, execute) {
    doRegister(name, {
      declarative: false,
      deps: deps,
      executingRequire: executingRequire,
      execute: execute
    });
  }

  function doRegister(name, entry) {
    entry.name = name;

    // we never overwrite an existing define
    if (!(name in defined))
      defined[name] = entry;

    // we have to normalize dependencies
    // (assume dependencies are normalized for now)
    // entry.normalizedDeps = entry.deps.map(normalize);
    entry.normalizedDeps = entry.deps;
  }


  function buildGroups(entry, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];

      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;

      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {

        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, groups);
    }
  }

  function link(name) {
    var startEntry = defined[name];

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry);
        else
          linkDynamicModule(entry);
      }
      curGroupDeclarative = !curGroupDeclarative; 
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(global, function(name, value) {
      module.locked = true;

      if (typeof name == 'object') {
        for (var p in name)
          exports[p] = name[p];
      }
      else {
        exports[name] = value;
      }

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          for (var j = 0; j < importerModule.dependencies.length; ++j) {
            if (importerModule.dependencies[j] === module) {
              importerModule.setters[j](exports);
            }
          }
        }
      }

      module.locked = false;
      return value;
    });

    module.setters = declaration.setters;
    module.execute = declaration.execute;

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      else if (depEntry && !depEntry.declarative) {
        depExports = depEntry.esModule;
      }
      // in the module registry
      else if (!depEntry) {
        depExports = load(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else
        module.dependencies.push(null);

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name) {
    var exports;
    var entry = defined[name];

    if (!entry) {
      exports = load(name);
      if (!exports)
        throw new Error("Unable to load dependency " + name + ".");
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, []);

      else if (!entry.evaluated)
        linkDynamicModule(entry);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];

    return exports;
  }

  function linkDynamicModule(entry) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i]);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);

    if (output)
      module.exports = output;

    // create the esModule object, which allows ES6 named imports of dynamics
    exports = module.exports;
 
    if (exports && exports.__esModule) {
      entry.esModule = exports;
    }
    else {
      entry.esModule = {};
      
      // don't trigger getters/setters in environments that support them
      if ((typeof exports == 'object' || typeof exports == 'function') && exports !== global) {
        if (getOwnPropertyDescriptor) {
          var d;
          for (var p in exports)
            if (d = Object.getOwnPropertyDescriptor(exports, p))
              defineProperty(entry.esModule, p, d);
        }
        else {
          var hasOwnProperty = exports && exports.hasOwnProperty;
          for (var p in exports) {
            if (!hasOwnProperty || exports.hasOwnProperty(p))
              entry.esModule[p] = exports[p];
          }
         }
       }
      entry.esModule['default'] = exports;
      defineProperty(entry.esModule, '__useDefault', {
        value: true
      });
    }
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right 
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen) {
    var entry = defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (!entry || entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!defined[depName])
          load(depName);
        else
          ensureEvaluated(depName, seen);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(global);
  }

  // magical execution function
  var modules = {};
  function load(name) {
    if (modules[name])
      return modules[name];

    // node core modules
    if (name.substr(0, 6) == '@node/')
      return require(name.substr(6));

    var entry = defined[name];

    // first we check if this module has already been defined in the registry
    if (!entry)
      throw "Module " + name + " not present.";

    // recursively ensure that the module and all its 
    // dependencies are linked (with dependency group handling)
    link(name);

    // now handle dependency execution in correct order
    ensureEvaluated(name, []);

    // remove from the registry
    defined[name] = undefined;

    // exported modules get __esModule defined for interop
    if (entry.declarative)
      defineProperty(entry.module.exports, '__esModule', { value: true });

    // return the defined module object
    return modules[name] = entry.declarative ? entry.module.exports : entry.esModule;
  };

  return function(mains, depNames, declare) {
    return function(formatDetect) {
      formatDetect(function(deps) {
        var System = {
          _nodeRequire: typeof require != 'undefined' && require.resolve && typeof process != 'undefined' && require,
          register: register,
          registerDynamic: registerDynamic,
          get: load, 
          set: function(name, module) {
            modules[name] = module; 
          },
          newModule: function(module) {
            return module;
          }
        };
        System.set('@empty', {});

        // register external dependencies
        for (var i = 0; i < depNames.length; i++) (function(depName, dep) {
          if (dep && dep.__esModule)
            System.register(depName, [], function(_export) {
              return {
                setters: [],
                execute: function() {
                  for (var p in dep)
                    if (p != '__esModule' && !(typeof p == 'object' && p + '' == 'Module'))
                      _export(p, dep[p]);
                }
              };
            });
          else
            System.registerDynamic(depName, [], false, function() {
              return dep;
            });
        })(depNames[i], arguments[i]);

        // register modules in this bundle
        declare(System);

        // load mains
        var firstLoad = load(mains[0]);
        if (mains.length > 1)
          for (var i = 1; i < mains.length; i++)
            load(mains[i]);

        if (firstLoad.__useDefault)
          return firstLoad['default'];
        else
          return firstLoad;
      });
    };
  };

})(typeof self != 'undefined' ? self : global)
/* (['mainModule'], ['external-dep'], function($__System) {
  System.register(...);
})
(function(factory) {
  if (typeof define && define.amd)
    define(['external-dep'], factory);
  // etc UMD / module pattern
})*/

(['1'], [], function($__System) {

(function(__global) {
  var loader = $__System;
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  function readMemberExpression(p, value) {
    var pParts = p.split('.');
    while (pParts.length)
      value = value[pParts.shift()];
    return value;
  }

  // bare minimum ignores for IE8
  var ignoredGlobalProps = ['_g', 'sessionStorage', 'localStorage', 'clipboardData', 'frames', 'external', 'mozAnimationStartTime', 'webkitStorageInfo', 'webkitIndexedDB'];

  var globalSnapshot;

  function forEachGlobal(callback) {
    if (Object.keys)
      Object.keys(__global).forEach(callback);
    else
      for (var g in __global) {
        if (!hasOwnProperty.call(__global, g))
          continue;
        callback(g);
      }
  }

  function forEachGlobalValue(callback) {
    forEachGlobal(function(globalName) {
      if (indexOf.call(ignoredGlobalProps, globalName) != -1)
        return;
      try {
        var value = __global[globalName];
      }
      catch (e) {
        ignoredGlobalProps.push(globalName);
      }
      callback(globalName, value);
    });
  }

  loader.set('@@global-helpers', loader.newModule({
    prepareGlobal: function(moduleName, exportName, globals) {
      // disable module detection
      var curDefine = __global.define;
       
      __global.define = undefined;
      __global.exports = undefined;
      if (__global.module && __global.module.exports)
        __global.module = undefined;

      // set globals
      var oldGlobals;
      if (globals) {
        oldGlobals = {};
        for (var g in globals) {
          oldGlobals[g] = globals[g];
          __global[g] = globals[g];
        }
      }

      // store a complete copy of the global object in order to detect changes
      if (!exportName) {
        globalSnapshot = {};

        forEachGlobalValue(function(name, value) {
          globalSnapshot[name] = value;
        });
      }

      // return function to retrieve global
      return function() {
        var globalValue;

        if (exportName) {
          globalValue = readMemberExpression(exportName, __global);
        }
        else {
          var singleGlobal;
          var multipleExports;
          var exports = {};

          forEachGlobalValue(function(name, value) {
            if (globalSnapshot[name] === value)
              return;
            if (typeof value == 'undefined')
              return;
            exports[name] = value;

            if (typeof singleGlobal != 'undefined') {
              if (!multipleExports && singleGlobal !== value)
                multipleExports = true;
            }
            else {
              singleGlobal = value;
            }
          });
          globalValue = multipleExports ? exports : singleGlobal;
        }

        // revert globals
        if (oldGlobals) {
          for (var g in oldGlobals)
            __global[g] = oldGlobals[g];
        }
        __global.define = curDefine;

        return globalValue;
      };
    }
  }));

})(typeof self != 'undefined' ? self : global);

$__System.registerDynamic("2", [], false, function(__require, __exports, __module) {
  var _retrieveGlobal = $__System.get("@@global-helpers").prepareGlobal(__module.id, null, null);
  (function() {})();
  return _retrieveGlobal();
});

$__System.registerDynamic("3", ["2", "4"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var Snake = $__require('2'),
      SnakePart = $__require('4');
  describe('Snake', function() {
    describe('interface has a', function() {
      var snake = new Snake();
      it('property "parts[]"', function() {
        expect(snake.parts).toBeDefined();
      });
      it('property "head"', function() {
        expect(snake.head).not.toBeDefined();
      });
      it('property "length"', function() {
        expect(snake.length).toBeDefined();
      });
      it('property "direction"', function() {
        expect(snake.direction).toBeDefined();
      });
      it('method "eat()"', function() {
        expect(snake.eat).toBeDefined();
      });
      it('method "move()"', function() {
        expect(snake.move).toBeDefined();
      });
    });
    it('property "length" is `0` by default', function() {
      var snake = new Snake();
      expect(snake.length).toEqual(0);
    });
    describe('config argument correctly affects a', function() {
      var config = {
        direction: 'down',
        length: 5
      };
      var snake = new Snake(config);
      it('property "direction"', function() {
        expect(snake.direction).toEqual(config.direction);
      });
      it('property "length"', function() {
        expect(snake.length).toEqual(config.length);
      });
    });
    describe('parts has dinamic coordinates according to configuration', function() {
      it('length: 5, direction: down', function() {
        var config = {
          direction: 'down',
          length: 5
        };
        var snake = new Snake(config);
        [{
          x: 0,
          y: 4
        }, {
          x: 0,
          y: 3
        }, {
          x: 0,
          y: 2
        }, {
          x: 0,
          y: 1
        }, {
          x: 0,
          y: 0
        }].forEach(function(coords, i) {
          expect({
            x: snake.parts[i].x,
            y: snake.parts[i].y
          }).toEqual(coords);
        });
      });
      it('length: 3, direction: right', function() {
        var config = {
          direction: 'right',
          length: 3
        };
        var snake = new Snake(config);
        [{
          x: 2,
          y: 0
        }, {
          x: 1,
          y: 0
        }, {
          x: 0,
          y: 0
        }].forEach(function(coords, i) {
          expect({
            x: snake.parts[i].x,
            y: snake.parts[i].y
          }).toEqual(coords);
        });
      });
      it('length: 4, direction: left', function() {
        var config = {
          direction: 'left',
          length: 4
        };
        var snake = new Snake(config);
        [{
          x: -3,
          y: 0
        }, {
          x: -2,
          y: 0
        }, {
          x: -1,
          y: 0
        }, {
          x: 0,
          y: 0
        }].forEach(function(coords, i) {
          expect({
            x: snake.parts[i].x,
            y: snake.parts[i].y
          }).toEqual(coords);
        });
      });
      it('length: 2, direction: up', function() {
        var config = {
          direction: 'up',
          length: 2
        };
        var snake = new Snake(config);
        [{
          x: 0,
          y: -1
        }, {
          x: 0,
          y: 0
        }].forEach(function(coords, i) {
          expect({
            x: snake.parts[i].x,
            y: snake.parts[i].y
          }).toEqual(coords);
        });
      });
    });
    describe('parts has the same direction on initialization', function() {
      it('length: 5, direction: down', function() {
        var config = {
          direction: 'down',
          length: 5
        };
        var snake = new Snake(config);
        var allhasSameDirection = snake.parts.every(function(part) {
          return part.direction === config.direction;
        });
        expect(allhasSameDirection).toBe(true);
      });
      it('length: 3, direction: up', function() {
        var config = {
          direction: 'up',
          length: 3
        };
        var snake = new Snake(config);
        var allhasSameDirection = snake.parts.every(function(part) {
          return part.direction === config.direction;
        });
        expect(allhasSameDirection).toBe(true);
      });
      it('length: 50, direction: right', function() {
        var config = {
          direction: 'right',
          length: 50
        };
        var snake = new Snake(config);
        var allhasSameDirection = snake.parts.every(function(part) {
          return part.direction === config.direction;
        });
        expect(allhasSameDirection).toBe(true);
      });
      it('length: 13, direction: left', function() {
        var config = {
          direction: 'left',
          length: 13
        };
        var snake = new Snake(config);
        var allhasSameDirection = snake.parts.every(function(part) {
          return part.direction === config.direction;
        });
        expect(allhasSameDirection).toBe(true);
      });
    });
    describe('can eat', function() {
      it('when empty', function() {
        var config = {direction: 'down'};
        var snake = new Snake(config);
        var newSnakePart = {
          x: 0,
          y: -1
        };
        snake.eat();
        expect(snake.length).toEqual(1);
        expect(snake.length).toEqual(snake.parts.length);
        expect(snake.direction).toEqual(config.direction);
        expect(snake.direction).toEqual(snake.parts[0].direction);
        expect(snake.head).toBe(snake.parts[0]);
        expect(snake.head.x).toEqual(newSnakePart.x);
        expect(snake.head.y).toEqual(newSnakePart.y);
      });
      it('when has length, new part is attached to the end', function() {
        var config = {
          direction: 'right',
          length: 10
        };
        var newSnakePart = {
          x: -1,
          y: 0,
          direction: 'right'
        };
        var snake = new Snake(config);
        var lastPart = snake.parts[snake.length - 1];
        snake.eat();
        expect(snake.length).toEqual(11);
        expect(snake.length).toEqual(snake.parts.length);
        expect(snake.direction).toEqual(config.direction);
        expect(snake.direction).toEqual(snake.parts[0].direction);
        expect(snake.head).toBe(snake.parts[0]);
        expect(snake.head).not.toEqual(newSnakePart);
        expect(snake.parts[snake.length - 1].x).toEqual(newSnakePart.x);
        expect(snake.parts[snake.length - 1].y).toEqual(newSnakePart.y);
        expect(lastPart.direction).toEqual(newSnakePart.direction);
      });
    });
    describe('can move', function() {
      it('one step forward', function() {
        var config = {
          direction: 'right',
          length: 5
        };
        var snake = new Snake(config);
        snake.move(1);
        [{
          x: 5,
          y: 0
        }, {
          x: 4,
          y: 0
        }, {
          x: 3,
          y: 0
        }, {
          x: 2,
          y: 0
        }, {
          x: 1,
          y: 0
        }].forEach(function(coords, i) {
          expect({
            x: snake.parts[i].x,
            y: snake.parts[i].y
          }).toEqual(coords);
        });
      });
      it('one step forward by default', function() {
        var config = {
          direction: 'right',
          length: 5
        };
        var snake = new Snake(config);
        snake.move();
        [{
          x: 5,
          y: 0
        }, {
          x: 4,
          y: 0
        }, {
          x: 3,
          y: 0
        }, {
          x: 2,
          y: 0
        }, {
          x: 1,
          y: 0
        }].forEach(function(coords, i) {
          expect({
            x: snake.parts[i].x,
            y: snake.parts[i].y
          }).toEqual(coords);
        });
      });
      it('5 steps forward', function() {
        var config = {
          direction: 'right',
          length: 5
        };
        var snake = new Snake(config);
        snake.move(5);
        [{
          x: 9,
          y: 0
        }, {
          x: 8,
          y: 0
        }, {
          x: 7,
          y: 0
        }, {
          x: 6,
          y: 0
        }, {
          x: 5,
          y: 0
        }].forEach(function(coords, i) {
          expect({
            x: snake.parts[i].x,
            y: snake.parts[i].y
          }).toEqual(coords);
        });
      });
      it('right(2)-down(2)', function() {
        var config = {
          direction: 'right',
          length: 5
        };
        var snake = new Snake(config);
        snake.direction = 'right';
        snake.move(2);
        snake.direction = 'down';
        snake.move(2);
        [{
          x: 6,
          y: 2
        }, {
          x: 6,
          y: 1
        }, {
          x: 6,
          y: 0
        }, {
          x: 5,
          y: 0
        }, {
          x: 4,
          y: 0
        }].forEach(function(coords, i) {
          expect({
            x: snake.parts[i].x,
            y: snake.parts[i].y
          }).toEqual(coords);
        });
      });
      it('down(2)-right(3)-up(4)-left(5)', function() {
        var config = {
          direction: 'down',
          length: 5
        };
        var snake = new Snake(config);
        snake.direction = 'down';
        snake.move(2);
        snake.direction = 'right';
        snake.move(3);
        snake.direction = 'up';
        snake.move(4);
        snake.direction = 'left';
        snake.move(5);
        [{
          x: -2,
          y: 2
        }, {
          x: -1,
          y: 2
        }, {
          x: 0,
          y: 2
        }, {
          x: 1,
          y: 2
        }, {
          x: 2,
          y: 2
        }].forEach(function(coords, i) {
          expect({
            x: snake.parts[i].x,
            y: snake.parts[i].y
          }).toEqual(coords);
        });
      });
    });
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4", [], false, function(__require, __exports, __module) {
  var _retrieveGlobal = $__System.get("@@global-helpers").prepareGlobal(__module.id, null, null);
  (function() {})();
  return _retrieveGlobal();
});

$__System.registerDynamic("5", ["4", "6"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var SnakePart = $__require('4'),
      Element = $__require('6');
  describe('Snake Part', function() {
    describe('interface has a', function() {
      var part = new SnakePart();
      it('property "direction"', function() {
        expect(part.direction).toBeDefined();
      });
      it('method "move()"', function() {
        expect(part.move).toBeDefined();
      });
    });
    describe('recieves a', function() {
      var part = new SnakePart();
      it('property "x" from a Base Element', function() {
        expect(part.x).toBeDefined();
      });
      it('property "y" from a Base Element', function() {
        expect(part.y).toBeDefined();
      });
      it('property "isVisible" from a Base Element', function() {
        expect(part.isVisible).toBeDefined();
      });
    });
    it('is instance of a Base Element', function() {
      var part = new SnakePart();
      expect(part instanceof Element).toBe(true);
    });
    it('property "isVisible" is `true` by default', function() {
      var part = new SnakePart();
      expect(part.isVisible).toBe(true);
    });
    it('has {x:0, y:0} coordinates by default', function() {
      var part = new SnakePart();
      expect(part.x).toBe(0);
      expect(part.y).toBe(0);
    });
    describe('config argument correctly affects a', function() {
      var config = {
        x: 774,
        y: 88,
        isVisible: false,
        direction: 'down'
      };
      var part = new SnakePart(config);
      it('property "x"', function() {
        expect(part.x).toEqual(config.x);
      });
      it('property "y"', function() {
        expect(part.y).toEqual(config.y);
      });
      it('property "isVisible"', function() {
        expect(part.isVisible).toEqual(config.isVisible);
      });
      it('property "direction"', function() {
        expect(part.direction).toEqual(config.direction);
      });
    });
    describe('can move', function() {
      var part;
      beforeEach(function() {
        part = new SnakePart({
          x: 10,
          y: 10
        });
        spyOn(part, 'move').and.callThrough();
      });
      it('left', function() {
        var steps = 3;
        part.direction = 'left';
        part.move(steps);
        expect(part.x).toEqual(7);
        expect(part.y).toEqual(10);
      });
      it('right', function() {
        var steps = 4;
        part.direction = 'right';
        part.move(steps);
        expect(part.x).toEqual(14);
        expect(part.y).toEqual(10);
      });
      it('up', function() {
        var steps = 15;
        part.direction = 'up';
        part.move(steps);
        expect(part.x).toEqual(10);
        expect(part.y).toEqual(-5);
      });
      it('down', function() {
        var steps = 3;
        part.direction = 'down';
        part.move(steps);
        expect(part.x).toEqual(10);
        expect(part.y).toEqual(13);
      });
    });
    describe('don\'t move, if no steps', function() {
      var part;
      beforeEach(function() {
        part = new SnakePart({
          x: 10,
          y: 10
        });
      });
      ['left', 'right', 'up', 'down'].forEach(function(direction) {
        it(direction, function() {
          part.direction = direction;
          part.move();
          expect(part.x).toEqual(10);
          expect(part.y).toEqual(10);
        });
      });
    });
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7", [], false, function(__require, __exports, __module) {
  var _retrieveGlobal = $__System.get("@@global-helpers").prepareGlobal(__module.id, null, null);
  (function() {})();
  return _retrieveGlobal();
});

$__System.registerDynamic("8", ["7", "6"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var Food = $__require('7'),
      Element = $__require('6');
  describe('Food', function() {
    describe('interface has a', function() {
      var food = new Food();
      it('method "feed()"', function() {
        expect(food.feed).toBeDefined();
      });
    });
    describe('recieves a', function() {
      var food = new Food();
      it('property "x" from a Base Element', function() {
        expect(food.x).toBeDefined();
      });
      it('property "y" from a Base Element', function() {
        expect(food.y).toBeDefined();
      });
      it('property "isVisible" from a Base Element', function() {
        expect(food.isVisible).toBeDefined();
      });
    });
    it('is instance of a Base Element', function() {
      var food = new Food();
      expect(food instanceof Element).toBe(true);
    });
    it('property "isVisible" is `true` by default', function() {
      var food = new Food();
      expect(food.isVisible).toBe(true);
    });
    it('has {x:0, y:0} coordinates by default', function() {
      var food = new Food();
      expect(food.x).toBe(0);
      expect(food.y).toBe(0);
    });
    describe('config argument correctly affects a', function() {
      var config = {
        x: 774,
        y: 88,
        isVisible: false
      };
      var food = new Food(config);
      it('property "x"', function() {
        expect(food.x).toEqual(config.x);
      });
      it('property "y"', function() {
        expect(food.y).toEqual(config.y);
      });
      it('property "isVisible"', function() {
        expect(food.isVisible).toEqual(config.isVisible);
      });
    });
    it('sets "isVisible" to `false`, when call "feed()"', function() {
      var food = new Food();
      food.feed();
      expect(food.isVisible).toBe(false);
    });
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6", [], false, function(__require, __exports, __module) {
  var _retrieveGlobal = $__System.get("@@global-helpers").prepareGlobal(__module.id, null, null);
  (function() {})();
  return _retrieveGlobal();
});

$__System.registerDynamic("9", ["6"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var Element = $__require('6');
  describe('Base Element', function() {
    describe('interface has a', function() {
      var element = new Element();
      it('property "x"', function() {
        expect(element.x).toBeDefined();
      });
      it('property "y"', function() {
        expect(element.y).toBeDefined();
      });
      it('property "isVisible"', function() {
        expect(element.isVisible).toBeDefined();
      });
    });
    it('property "isVisible" is `true` by default', function() {
      var element = new Element();
      expect(element.isVisible).toBe(true);
    });
    it('has {x:0, y:0} coordinates by default', function() {
      var element = new Element();
      expect(element.x).toBe(0);
      expect(element.y).toBe(0);
    });
    describe('config argument correctly affects a', function() {
      var config = {
        x: 774,
        y: 88,
        isVisible: false
      };
      var element = new Element(config);
      it('property "x"', function() {
        expect(element.x).toEqual(config.x);
      });
      it('property "y"', function() {
        expect(element.y).toEqual(config.y);
      });
      it('property "isVisible"', function() {
        expect(element.isVisible).toEqual(config.isVisible);
      });
    });
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("1", ["9", "8", "5", "3"], true, function($__require, exports, module) {
  "use strict";
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  describe('Module', function() {
    $__require('9');
    $__require('8');
    $__require('5');
    $__require('3');
  });
  global.define = __define;
  return module.exports;
});

})
(function(factory) {
  factory();
});