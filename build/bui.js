/**
 * @preserve SeaJS - A Module Loader for the Web
 * v1.3.0 | seajs.org | MIT Licensed
 */


/**
 * Base namespace for the framework.
 */
this.seajs = { _seajs: this.seajs }


/**
 * The version of the framework. It will be replaced with "major.minor.patch"
 * when building.
 */
seajs.version = '1.3.0'


/**
 * The private utilities. Internal use only.
 */
seajs._util = {}


/**
 * The private configuration data. Internal use only.
 */
seajs._config = {

  /**
   * Debug mode. It will be turned off automatically when compressing.
   */
  debug: '%DEBUG%',

  /**
   * Modules that are needed to load before all other modules.
   */
  preload: []
}

/**
 * The minimal language enhancement
 */
;(function(util) {

  var toString = Object.prototype.toString
  var AP = Array.prototype


  util.isString = function(val) {
    return toString.call(val) === '[object String]'
  }


  util.isFunction = function(val) {
    return toString.call(val) === '[object Function]'
  }


  util.isRegExp = function(val) {
    return toString.call(val) === '[object RegExp]'
  }


  util.isObject = function(val) {
    return val === Object(val)
  }


  util.isArray = Array.isArray || function(val) {
    return toString.call(val) === '[object Array]'
  }


  util.indexOf = AP.indexOf ?
      function(arr, item) {
        return arr.indexOf(item)
      } :
      function(arr, item) {
        for (var i = 0; i < arr.length; i++) {
          if (arr[i] === item) {
            return i
          }
        }
        return -1
      }


  var forEach = util.forEach = AP.forEach ?
      function(arr, fn) {
        arr.forEach(fn)
      } :
      function(arr, fn) {
        for (var i = 0; i < arr.length; i++) {
          fn(arr[i], i, arr)
        }
      }


  util.map = AP.map ?
      function(arr, fn) {
        return arr.map(fn)
      } :
      function(arr, fn) {
        var ret = []
        forEach(arr, function(item, i, arr) {
          ret.push(fn(item, i, arr))
        })
        return ret
      }


  util.filter = AP.filter ?
      function(arr, fn) {
        return arr.filter(fn)
      } :
      function(arr, fn) {
        var ret = []
        forEach(arr, function(item, i, arr) {
          if (fn(item, i, arr)) {
            ret.push(item)
          }
        })
        return ret
      }


  var keys = util.keys = Object.keys || function(o) {
    var ret = []

    for (var p in o) {
      if (o.hasOwnProperty(p)) {
        ret.push(p)
      }
    }

    return ret
  }


  util.unique = function(arr) {
    var o = {}

    forEach(arr, function(item) {
      o[item] = 1
    })

    return keys(o)
  }


  util.now = Date.now || function() {
    return new Date().getTime()
  }

})(seajs._util)

/**
 * The tiny console
 */
;(function(util) {

  /**
   * The safe wrapper of console.log/error/...
   */
  util.log = function() {
    if (typeof console === 'undefined') return

    var args = Array.prototype.slice.call(arguments)

    var type = 'log'
    var last = args[args.length - 1]
    console[last] && (type = args.pop())

    // Only show log info in debug mode
    if (type === 'log' && !seajs.debug) return

    if (console[type].apply) {
      console[type].apply(console, args)
      return
    }

    // See issue#349
    var length = args.length
    if (length === 1) {
      console[type](args[0])
    }
    else if (length === 2) {
      console[type](args[0], args[1])
    }
    else if (length === 3) {
      console[type](args[0], args[1], args[2])
    }
    else {
      console[type](args.join(' '))
    }
  }

})(seajs._util)

/**
 * Path utilities
 */
;(function(util, config, global) {

  var DIRNAME_RE = /.*(?=\/.*$)/
  var MULTIPLE_SLASH_RE = /([^:\/])\/\/+/g
  var FILE_EXT_RE = /\.(?:css|js)$/
  var ROOT_RE = /^(.*?\w)(?:\/|$)/


  /**
   * Extracts the directory portion of a path.
   * dirname('a/b/c.js') ==> 'a/b/'
   * dirname('d.js') ==> './'
   * @see http://jsperf.com/regex-vs-split/2
   */
  function dirname(path) {
    var s = path.match(DIRNAME_RE)
    return (s ? s[0] : '.') + '/'
  }


  /**
   * Canonicalizes a path.
   * realpath('./a//b/../c') ==> 'a/c'
   */
  function realpath(path) {
    MULTIPLE_SLASH_RE.lastIndex = 0

    // 'file:///a//b/c' ==> 'file:///a/b/c'
    // 'http://a//b/c' ==> 'http://a/b/c'
    if (MULTIPLE_SLASH_RE.test(path)) {
      path = path.replace(MULTIPLE_SLASH_RE, '$1\/')
    }

    // 'a/b/c', just return.
    if (path.indexOf('.') === -1) {
      return path
    }

    var original = path.split('/')
    var ret = [], part

    for (var i = 0; i < original.length; i++) {
      part = original[i]

      if (part === '..') {
        if (ret.length === 0) {
          throw new Error('The path is invalid: ' + path)
        }
        ret.pop()
      }
      else if (part !== '.') {
        ret.push(part)
      }
    }

    return ret.join('/')
  }


  /**
   * Normalizes an uri.
   */
  function normalize(uri) {
    uri = realpath(uri)
    var lastChar = uri.charAt(uri.length - 1)

    if (lastChar === '/') {
      return uri
    }

    // Adds the default '.js' extension except that the uri ends with #.
    // ref: http://jsperf.com/get-the-last-character
    if (lastChar === '#') {
      uri = uri.slice(0, -1)
    }
    else if (uri.indexOf('?') === -1 && !FILE_EXT_RE.test(uri)) {
      uri += '.js'
    }

    // Remove ':80/' for bug in IE
    if (uri.indexOf(':80/') > 0) {
      uri = uri.replace(':80/', '/')
    }

    return uri
  }


  /**
   * Parses alias in the module id. Only parse the first part.
   */
  function parseAlias(id) {
    // #xxx means xxx is already alias-parsed.
    if (id.charAt(0) === '#') {
      return id.substring(1)
    }

    var alias = config.alias

    // Only top-level id needs to parse alias.
    if (alias && isTopLevel(id)) {
      var parts = id.split('/')
      var first = parts[0]

      if (alias.hasOwnProperty(first)) {
        parts[0] = alias[first]
        id = parts.join('/')
      }
    }

    return id
  }


  var mapCache = {}

  /**
   * Converts the uri according to the map rules.
   */
  function parseMap(uri) {
    // map: [[match, replace], ...]
    var map = config.map || []
    if (!map.length) return uri

    var ret = uri

    // Apply all matched rules in sequence.
    for (var i = 0; i < map.length; i++) {
      var rule = map[i]

      if (util.isArray(rule) && rule.length === 2) {
        var m = rule[0]

        if (util.isString(m) && ret.indexOf(m) > -1 ||
            util.isRegExp(m) && m.test(ret)) {
          ret = ret.replace(m, rule[1])
        }
      }
      else if (util.isFunction(rule)) {
        ret = rule(ret)
      }
    }

    if (!isAbsolute(ret)) {
      ret = realpath(dirname(pageUri) + ret)
    }

    if (ret !== uri) {
      mapCache[ret] = uri
    }

    return ret
  }


  /**
   * Gets the original uri.
   */
  function unParseMap(uri) {
    return mapCache[uri] || uri
  }


  /**
   * Converts id to uri.
   */
  function id2Uri(id, refUri) {
    if (!id) return ''

    id = parseAlias(id)
    refUri || (refUri = pageUri)

    var ret

    // absolute id
    if (isAbsolute(id)) {
      ret = id
    }
    // relative id
    else if (isRelative(id)) {
      // Converts './a' to 'a', to avoid unnecessary loop in realpath.
      if (id.indexOf('./') === 0) {
        id = id.substring(2)
      }
      ret = dirname(refUri) + id
    }
    // root id
    else if (isRoot(id)) {
      ret = refUri.match(ROOT_RE)[1] + id
    }
    // top-level id
    else {
      ret = config.base + '/' + id
    }

    return normalize(ret)
  }


  function isAbsolute(id) {
    return id.indexOf('://') > 0 || id.indexOf('//') === 0
  }


  function isRelative(id) {
    return id.indexOf('./') === 0 || id.indexOf('../') === 0
  }


  function isRoot(id) {
    return id.charAt(0) === '/' && id.charAt(1) !== '/'
  }


  function isTopLevel(id) {
    var c = id.charAt(0)
    return id.indexOf('://') === -1 && c !== '.' && c !== '/'
  }


  /**
   * Normalizes pathname to start with '/'
   * Ref: https://groups.google.com/forum/#!topic/seajs/9R29Inqk1UU
   */
  function normalizePathname(pathname) {
    if (pathname.charAt(0) !== '/') {
      pathname = '/' + pathname
    }
    return pathname
  }


  var loc = global['location']
  var pageUri = loc.protocol + '//' + loc.host +
      normalizePathname(loc.pathname)

  // local file in IE: C:\path\to\xx.js
  if (pageUri.indexOf('\\') > 0) {
    pageUri = pageUri.replace(/\\/g, '/')
  }


  util.dirname = dirname
  util.realpath = realpath
  util.normalize = normalize

  util.parseAlias = parseAlias
  util.parseMap = parseMap
  util.unParseMap = unParseMap

  util.id2Uri = id2Uri
  util.isAbsolute = isAbsolute
  util.isRoot = isRoot
  util.isTopLevel = isTopLevel

  util.pageUri = pageUri

})(seajs._util, seajs._config, this)

/**
 * Utilities for fetching js and css files
 */
;(function(util, config) {

  var doc = document
  var head = doc.head ||
      doc.getElementsByTagName('head')[0] ||
      doc.documentElement

  var baseElement = head.getElementsByTagName('base')[0]

  var IS_CSS_RE = /\.css(?:\?|$)/i
  var READY_STATE_RE = /loaded|complete|undefined/

  var currentlyAddingScript
  var interactiveScript


  util.fetch = function(url, callback, charset) {
    var isCSS = IS_CSS_RE.test(url)
    var node = document.createElement(isCSS ? 'link' : 'script')

    if (charset) {
      var cs = util.isFunction(charset) ? charset(url) : charset
      cs && (node.charset = cs)
    }

    assetOnload(node, callback || noop)

    if (isCSS) {
      node.rel = 'stylesheet'
      node.href = url
    } else {
      node.async = 'async'
      node.src = url
    }

    // For some cache cases in IE 6-9, the script executes IMMEDIATELY after
    // the end of the insertBefore execution, so use `currentlyAddingScript`
    // to hold current node, for deriving url in `define`.
    currentlyAddingScript = node

    // ref: #185 & http://dev.jquery.com/ticket/2709
    baseElement ?
        head.insertBefore(node, baseElement) :
        head.appendChild(node)

    currentlyAddingScript = null
  }

  function assetOnload(node, callback) {
    if (node.nodeName === 'SCRIPT') {
      scriptOnload(node, callback)
    } else {
      styleOnload(node, callback)
    }
  }

  function scriptOnload(node, callback) {

    node.onload = node.onerror = node.onreadystatechange = function() {
      if (READY_STATE_RE.test(node.readyState)) {

        // Ensure only run once and handle memory leak in IE
        node.onload = node.onerror = node.onreadystatechange = null

        // Remove the script to reduce memory leak
        if (node.parentNode && !config.debug) {
          head.removeChild(node)
        }

        // Dereference the node
        node = undefined

        callback()
      }
    }

  }

  function styleOnload(node, callback) {

    // for Old WebKit and Old Firefox
    if (isOldWebKit || isOldFirefox) {
      util.log('Start poll to fetch css')

      setTimeout(function() {
        poll(node, callback)
      }, 1) // Begin after node insertion
    }
    else {
      node.onload = node.onerror = function() {
        node.onload = node.onerror = null
        node = undefined
        callback()
      }
    }

  }

  function poll(node, callback) {
    var isLoaded

    // for WebKit < 536
    if (isOldWebKit) {
      if (node['sheet']) {
        isLoaded = true
      }
    }
    // for Firefox < 9.0
    else if (node['sheet']) {
      try {
        if (node['sheet'].cssRules) {
          isLoaded = true
        }
      } catch (ex) {
        // The value of `ex.name` is changed from
        // 'NS_ERROR_DOM_SECURITY_ERR' to 'SecurityError' since Firefox 13.0
        // But Firefox is less than 9.0 in here, So it is ok to just rely on
        // 'NS_ERROR_DOM_SECURITY_ERR'
        if (ex.name === 'NS_ERROR_DOM_SECURITY_ERR') {
          isLoaded = true
        }
      }
    }

    setTimeout(function() {
      if (isLoaded) {
        // Place callback in here due to giving time for style rendering.
        callback()
      } else {
        poll(node, callback)
      }
    }, 1)
  }

  function noop() {
  }


  util.getCurrentScript = function() {
    if (currentlyAddingScript) {
      return currentlyAddingScript
    }

    // For IE6-9 browsers, the script onload event may not fire right
    // after the the script is evaluated. Kris Zyp found that it
    // could query the script nodes and the one that is in "interactive"
    // mode indicates the current script.
    // Ref: http://goo.gl/JHfFW
    if (interactiveScript &&
        interactiveScript.readyState === 'interactive') {
      return interactiveScript
    }

    var scripts = head.getElementsByTagName('script')

    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i]
      if (script.readyState === 'interactive') {
        interactiveScript = script
        return script
      }
    }
  }

  util.getScriptAbsoluteSrc = function(node) {
    return node.hasAttribute ? // non-IE6/7
        node.src :
        // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
        node.getAttribute('src', 4)
  }


  util.importStyle = function(cssText, id) {
    // Don't add multi times
    if (id && doc.getElementById(id)) return

    var element = doc.createElement('style')
    id && (element.id = id)

    // Adds to DOM first to avoid the css hack invalid
    head.appendChild(element)

    // IE
    if (element.styleSheet) {
      element.styleSheet.cssText = cssText
    }
    // W3C
    else {
      element.appendChild(doc.createTextNode(cssText))
    }
  }


  var UA = navigator.userAgent

  // `onload` event is supported in WebKit since 535.23
  // Ref:
  //  - https://bugs.webkit.org/show_activity.cgi?id=38995
  var isOldWebKit = Number(UA.replace(/.*AppleWebKit\/(\d+)\..*/, '$1')) < 536

  // `onload/onerror` event is supported since Firefox 9.0
  // Ref:
  //  - https://bugzilla.mozilla.org/show_bug.cgi?id=185236
  //  - https://developer.mozilla.org/en/HTML/Element/link#Stylesheet_load_events
  var isOldFirefox = UA.indexOf('Firefox') > 0 &&
      !('onload' in document.createElement('link'))


  /**
   * References:
   *  - http://unixpapa.com/js/dyna.html
   *  - ../test/research/load-js-css/test.html
   *  - ../test/issues/load-css/test.html
   *  - http://www.blaze.io/technical/ies-premature-execution-problem/
   */

})(seajs._util, seajs._config, this)

/**
 * The parser for dependencies
 */
;(function(util) {

  var REQUIRE_RE = /(?:^|[^.$])\brequire\s*\(\s*(["'])([^"'\s\)]+)\1\s*\)/g


  util.parseDependencies = function(code) {
    // Parse these `requires`:
    //   var a = require('a');
    //   someMethod(require('b'));
    //   require('c');
    //   ...
    // Doesn't parse:
    //   someInstance.require(...);
    var ret = [], match

    code = removeComments(code)
    REQUIRE_RE.lastIndex = 0

    while ((match = REQUIRE_RE.exec(code))) {
      if (match[2]) {
        ret.push(match[2])
      }
    }

    return util.unique(ret)
  }

  // See: research/remove-comments-safely
  function removeComments(code) {
    return code
        .replace(/^\s*\/\*[\s\S]*?\*\/\s*$/mg, '') // block comments
        .replace(/^\s*\/\/.*$/mg, '') // line comments
  }

})(seajs._util)

/**
 * The core of loader
 */
;(function(seajs, util, config) {

  var cachedModules = {}
  var cachedModifiers = {}
  var compileStack = []

  var STATUS = {
    'FETCHING': 1,  // The module file is fetching now.
    'FETCHED': 2,   // The module file has been fetched.
    'SAVED': 3,     // The module info has been saved.
    'READY': 4,     // All dependencies and self are ready to compile.
    'COMPILING': 5, // The module is in compiling now.
    'COMPILED': 6   // The module is compiled and module.exports is available.
  }


  function Module(uri, status) {
    this.uri = uri
    this.status = status || 0

    // this.id is set when saving
    // this.dependencies is set when saving
    // this.factory is set when saving
    // this.exports is set when compiling
    // this.parent is set when compiling
    // this.require is set when compiling
  }


  Module.prototype._use = function(ids, callback) {
    util.isString(ids) && (ids = [ids])
    var uris = resolve(ids, this.uri)

    this._load(uris, function() {
      // Loads preload files introduced in modules before compiling.
      preload(function() {
        var args = util.map(uris, function(uri) {
          return uri ? cachedModules[uri]._compile() : null
        })

        if (callback) {
          callback.apply(null, args)
        }
      })
    })
  }


  Module.prototype._load = function(uris, callback) {
    var unLoadedUris = util.filter(uris, function(uri) {
      return uri && (!cachedModules[uri] ||
          cachedModules[uri].status < STATUS.READY)
    })

    var length = unLoadedUris.length
    if (length === 0) {
      callback()
      return
    }

    var remain = length

    for (var i = 0; i < length; i++) {
      (function(uri) {
        var module = cachedModules[uri] ||
            (cachedModules[uri] = new Module(uri, STATUS.FETCHING))

        module.status >= STATUS.FETCHED ? onFetched() : fetch(uri, onFetched)

        function onFetched() {
          // cachedModules[uri] is changed in un-correspondence case
          module = cachedModules[uri]

          if (module.status >= STATUS.SAVED) {
            var deps = getPureDependencies(module)

            if (deps.length) {
              Module.prototype._load(deps, function() {
                cb(module)
              })
            }
            else {
              cb(module)
            }
          }
          // Maybe failed to fetch successfully, such as 404 or non-module.
          // In these cases, just call cb function directly.
          else {
            cb()
          }
        }

      })(unLoadedUris[i])
    }

    function cb(module) {
      (module || {}).status < STATUS.READY && (module.status = STATUS.READY)
      --remain === 0 && callback()
    }
  }


  Module.prototype._compile = function() {
    var module = this
    if (module.status === STATUS.COMPILED) {
      return module.exports
    }

    // Just return null when:
    //  1. the module file is 404.
    //  2. the module file is not written with valid module format.
    //  3. other error cases.
    if (module.status < STATUS.SAVED && !hasModifiers(module)) {
      return null
    }

    module.status = STATUS.COMPILING


    function require(id) {
      var uri = resolve(id, module.uri)
      var child = cachedModules[uri]

      // Just return null when uri is invalid.
      if (!child) {
        return null
      }

      // Avoids circular calls.
      if (child.status === STATUS.COMPILING) {
        return child.exports
      }

      child.parent = module
      return child._compile()
    }

    require.async = function(ids, callback) {
      module._use(ids, callback)
    }

    require.resolve = function(id) {
      return resolve(id, module.uri)
    }

    require.cache = cachedModules


    module.require = require
    module.exports = {}
    var factory = module.factory

    if (util.isFunction(factory)) {
      compileStack.push(module)
      runInModuleContext(factory, module)
      compileStack.pop()
    }
    else if (factory !== undefined) {
      module.exports = factory
    }

    module.status = STATUS.COMPILED
    execModifiers(module)
    return module.exports
  }


  Module._define = function(id, deps, factory) {
    var argsLength = arguments.length

    // define(factory)
    if (argsLength === 1) {
      factory = id
      id = undefined
    }
    // define(id || deps, factory)
    else if (argsLength === 2) {
      factory = deps
      deps = undefined

      // define(deps, factory)
      if (util.isArray(id)) {
        deps = id
        id = undefined
      }
    }

    // Parses dependencies.
    if (!util.isArray(deps) && util.isFunction(factory)) {
      deps = util.parseDependencies(factory.toString())
    }

    var meta = { id: id, dependencies: deps, factory: factory }
    var derivedUri

    // Try to derive uri in IE6-9 for anonymous modules.
    if (document.attachEvent) {
      // Try to get the current script.
      var script = util.getCurrentScript()
      if (script) {
        derivedUri = util.unParseMap(util.getScriptAbsoluteSrc(script))
      }

      if (!derivedUri) {
        util.log('Failed to derive URI from interactive script for:',
            factory.toString(), 'warn')

        // NOTE: If the id-deriving methods above is failed, then falls back
        // to use onload event to get the uri.
      }
    }

    // Gets uri directly for specific module.
    var resolvedUri = id ? resolve(id) : derivedUri

    if (resolvedUri) {
      // For IE:
      // If the first module in a package is not the cachedModules[derivedUri]
      // self, it should assign to the correct module when found.
      if (resolvedUri === derivedUri) {
        var refModule = cachedModules[derivedUri]
        if (refModule && refModule.realUri &&
            refModule.status === STATUS.SAVED) {
          cachedModules[derivedUri] = null
        }
      }

      var module = Module._save(resolvedUri, meta)

      // For IE:
      // Assigns the first module in package to cachedModules[derivedUrl]
      if (derivedUri) {
        // cachedModules[derivedUri] may be undefined in combo case.
        if ((cachedModules[derivedUri] || {}).status === STATUS.FETCHING) {
          cachedModules[derivedUri] = module
          module.realUri = derivedUri
        }
      }
      else {
        firstModuleInPackage || (firstModuleInPackage = module)
      }
    }
    else {
      // Saves information for "memoizing" work in the onload event.
      anonymousModuleMeta = meta
    }

  }


  Module._getCompilingModule = function() {
    return compileStack[compileStack.length - 1]
  }


  Module._find = function(selector) {
    var matches = []

    util.forEach(util.keys(cachedModules), function(uri) {
      if (util.isString(selector) && uri.indexOf(selector) > -1 ||
          util.isRegExp(selector) && selector.test(uri)) {
        var module = cachedModules[uri]
        module.exports && matches.push(module.exports)
      }
    })

    return matches
  }


  Module._modify = function(id, modifier) {
    var uri = resolve(id)
    var module = cachedModules[uri]

    if (module && module.status === STATUS.COMPILED) {
      runInModuleContext(modifier, module)
    }
    else {
      cachedModifiers[uri] || (cachedModifiers[uri] = [])
      cachedModifiers[uri].push(modifier)
    }

    return seajs
  }


  // For plugin developers
  Module.STATUS = STATUS
  Module._resolve = util.id2Uri
  Module._fetch = util.fetch
  Module._save = save


  // Helpers
  // -------

  var fetchingList = {}
  var fetchedList = {}
  var callbackList = {}
  var anonymousModuleMeta = null
  var firstModuleInPackage = null
  var circularCheckStack = []

  function resolve(ids, refUri) {
    if (util.isString(ids)) {
      return Module._resolve(ids, refUri)
    }

    return util.map(ids, function(id) {
      return resolve(id, refUri)
    })
  }

  function fetch(uri, callback) {
    var requestUri = util.parseMap(uri)

    if (fetchedList[requestUri]) {
      // See test/issues/debug-using-map
      cachedModules[uri] = cachedModules[requestUri]
      callback()
      return
    }

    if (fetchingList[requestUri]) {
      callbackList[requestUri].push(callback)
      return
    }

    fetchingList[requestUri] = true
    callbackList[requestUri] = [callback]

    // Fetches it
    Module._fetch(
        requestUri,

        function() {
          fetchedList[requestUri] = true

          // Updates module status
          var module = cachedModules[uri]
          if (module.status === STATUS.FETCHING) {
            module.status = STATUS.FETCHED
          }

          // Saves anonymous module meta data
          if (anonymousModuleMeta) {
            Module._save(uri, anonymousModuleMeta)
            anonymousModuleMeta = null
          }

          // Assigns the first module in package to cachedModules[uri]
          // See: test/issues/un-correspondence
          if (firstModuleInPackage && module.status === STATUS.FETCHED) {
            cachedModules[uri] = firstModuleInPackage
            firstModuleInPackage.realUri = uri
          }
          firstModuleInPackage = null

          // Clears
          if (fetchingList[requestUri]) {
            delete fetchingList[requestUri]
          }

          // Calls callbackList
          var fns = callbackList[requestUri]
          if (fns) {
            delete callbackList[requestUri]
            util.forEach(fns, function(fn) {
              fn()
            })
          }

        },

        config.charset
    )
  }

  function save(uri, meta) {
    var module = cachedModules[uri] || (cachedModules[uri] = new Module(uri))

    // Don't override already saved module
    if (module.status < STATUS.SAVED) {
      // Lets anonymous module id equal to its uri
      module.id = meta.id || uri

      module.dependencies = resolve(
          util.filter(meta.dependencies || [], function(dep) {
            return !!dep
          }), uri)

      module.factory = meta.factory

      // Updates module status
      module.status = STATUS.SAVED
    }

    return module
  }

  function runInModuleContext(fn, module) {
    var ret = fn(module.require, module.exports, module)
    if (ret !== undefined) {
      module.exports = ret
    }
  }

  function hasModifiers(module) {
    return !!cachedModifiers[module.realUri || module.uri]
  }

  function execModifiers(module) {
    var uri = module.realUri || module.uri
    var modifiers = cachedModifiers[uri]

    if (modifiers) {
      util.forEach(modifiers, function(modifier) {
        runInModuleContext(modifier, module)
      })

      delete cachedModifiers[uri]
    }
  }

  function getPureDependencies(module) {
    var uri = module.uri

    return util.filter(module.dependencies, function(dep) {
      circularCheckStack = [uri]

      var isCircular = isCircularWaiting(cachedModules[dep])
      if (isCircular) {
        circularCheckStack.push(uri)
        printCircularLog(circularCheckStack)
      }

      return !isCircular
    })
  }

  function isCircularWaiting(module) {
    if (!module || module.status !== STATUS.SAVED) {
      return false
    }

    circularCheckStack.push(module.uri)
    var deps = module.dependencies

    if (deps.length) {
      if (isOverlap(deps, circularCheckStack)) {
        return true
      }

      for (var i = 0; i < deps.length; i++) {
        if (isCircularWaiting(cachedModules[deps[i]])) {
          return true
        }
      }
    }

    circularCheckStack.pop()
    return false
  }

  function printCircularLog(stack, type) {
    util.log('Found circular dependencies:', stack.join(' --> '), type)
  }

  function isOverlap(arrA, arrB) {
    var arrC = arrA.concat(arrB)
    return arrC.length > util.unique(arrC).length
  }

  function preload(callback) {
    var preloadMods = config.preload.slice()
    config.preload = []
    preloadMods.length ? globalModule._use(preloadMods, callback) : callback()
  }


  // Public API
  // ----------

  var globalModule = new Module(util.pageUri, STATUS.COMPILED)

  seajs.use = function(ids, callback) {
    // Loads preload modules before all other modules.
    preload(function() {
      globalModule._use(ids, callback)
    })

    // Chain
    return seajs
  }


  // For normal users
  seajs.define = Module._define
  seajs.cache = Module.cache = cachedModules
  seajs.find = Module._find
  seajs.modify = Module._modify


  // For plugin developers
  Module.fetchedList = fetchedList
  seajs.pluginSDK = {
    Module: Module,
    util: util,
    config: config
  }

})(seajs, seajs._util, seajs._config)

/**
 * The configuration
 */
;(function(seajs, util, config) {

  var noCachePrefix = 'seajs-ts='
  var noCacheTimeStamp = noCachePrefix + util.now()


  // Async inserted script
  var loaderScript = document.getElementById('seajsnode')

  // Static script
  if (!loaderScript) {
    var scripts = document.getElementsByTagName('script')
    loaderScript = scripts[scripts.length - 1]
  }

  var loaderSrc = (loaderScript && util.getScriptAbsoluteSrc(loaderScript)) ||
      util.pageUri // When sea.js is inline, set base to pageUri.

  var base = util.dirname(getLoaderActualSrc(loaderSrc))
  util.loaderDir = base

  // When src is "http://test.com/libs/seajs/1.0.0/sea.js", redirect base
  // to "http://test.com/libs/"
  var match = base.match(/^(.+\/)seajs\/[\.\d]+(?:-dev)?\/$/)
  if (match) base = match[1]

  config.base = base
  config.main = loaderScript && loaderScript.getAttribute('data-main')
  config.charset = 'utf-8'


  /**
   * The function to configure the framework
   * config({
   *   'base': 'path/to/base',
   *   'alias': {
   *     'app': 'biz/xx',
   *     'jquery': 'jquery-1.5.2',
   *     'cart': 'cart?t=20110419'
   *   },
   *   'map': [
   *     ['test.cdn.cn', 'localhost']
   *   ],
   *   preload: [],
   *   charset: 'utf-8',
   *   debug: false
   * })
   *
   */
  seajs.config = function(o) {
    for (var k in o) {
      if (!o.hasOwnProperty(k)) continue

      var previous = config[k]
      var current = o[k]

      if (previous && k === 'alias') {
        for (var p in current) {
          if (current.hasOwnProperty(p)) {

            var prevValue = previous[p]
            var currValue = current[p]

            // Converts {jquery: '1.7.2'} to {jquery: 'jquery/1.7.2/jquery'}
            if (/^\d+\.\d+\.\d+$/.test(currValue)) {
              currValue = p + '/' + currValue + '/' + p
            }

            checkAliasConflict(prevValue, currValue, p)
            previous[p] = currValue

          }
        }
      }
      else if (previous && (k === 'map' || k === 'preload')) {
        // for config({ preload: 'some-module' })
        if (util.isString(current)) {
          current = [current]
        }

        util.forEach(current, function(item) {
          if (item) {
            previous.push(item)
          }
        })
      }
      else {
        config[k] = current
      }
    }

    // Makes sure config.base is an absolute path.
    var base = config.base
    if (base && !util.isAbsolute(base)) {
      config.base = util.id2Uri((util.isRoot(base) ? '' : './') + base + '/')
    }

    // Uses map to implement nocache.
    if (config.debug === 2) {
      config.debug = 1
      seajs.config({
        map: [
          [/^.*$/, function(url) {
            if (url.indexOf(noCachePrefix) === -1) {
              url += (url.indexOf('?') === -1 ? '?' : '&') + noCacheTimeStamp
            }
            return url
          }]
        ]
      })
    }

    debugSync()

    return this
  }


  function debugSync() {
    if (config.debug) {
      // For convenient reference
      seajs.debug = !!config.debug
    }
  }

  debugSync()


  function getLoaderActualSrc(src) {
    if (src.indexOf('??') === -1) {
      return src
    }

    // Such as: http://cdn.com/??seajs/1.2.0/sea.js,jquery/1.7.2/jquery.js
    // Only support nginx combo style rule. If you use other combo rule, please
    // explicitly config the base path and the alias for plugins.
    var parts = src.split('??')
    var root = parts[0]
    var paths = util.filter(parts[1].split(','), function(str) {
      return str.indexOf('sea.js') !== -1
    })

    return root + paths[0]
  }

  function checkAliasConflict(previous, current, key) {
    if (previous && previous !== current) {
      util.log('The alias config is conflicted:',
          'key =', '"' + key + '"',
          'previous =', '"' + previous + '"',
          'current =', '"' + current + '"',
          'warn')
    }
  }

})(seajs, seajs._util, seajs._config)

/**
 * Prepare for bootstrapping
 */
;(function(seajs, util, global) {

  // The safe and convenient version of console.log
  seajs.log = util.log


  // Creates a stylesheet from a text blob of rules.
  seajs.importStyle = util.importStyle


  // Sets a alias to `sea.js` directory for loading plugins.
  seajs.config({
    alias: { seajs: util.loaderDir }
  })


  // Uses `seajs-xxx` flag to load plugin-xxx.
  util.forEach(getStartupPlugins(), function(name) {
    seajs.use('seajs/plugin-' + name)

    // Delays `seajs.use` calls to the onload of `mapfile` in debug mode.
    if (name === 'debug') {
      seajs._use = seajs.use
      seajs._useArgs = []
      seajs.use = function() { seajs._useArgs.push(arguments); return seajs }
    }
  })


  // Helpers
  // -------

  function getStartupPlugins() {
    var ret = []
    var str = global.location.search

    // Converts `seajs-xxx` to `seajs-xxx=1`
    str = str.replace(/(seajs-\w+)(&|$)/g, '$1=1$2')

    // Add cookie string
    str += ' ' + document.cookie

    // Excludes seajs-xxx=0
    str.replace(/seajs-(\w+)=[1-9]/g, function(m, name) {
      ret.push(name)
    })

    return util.unique(ret)
  }

})(seajs, seajs._util, this)

/**
 * The bootstrap and entrances
 */
;(function(seajs, config, global) {

  var _seajs = seajs._seajs

  // Avoids conflicting when sea.js is loaded multi times.
  if (_seajs && !_seajs['args']) {
    global.seajs = seajs._seajs
    return
  }


  // Assigns to global define.
  global.define = seajs.define


  // Loads the data-main module automatically.
  config.main && seajs.use(config.main)


    // Parses the pre-call of seajs.config/seajs.use/define.
  // Ref: test/bootstrap/async-3.html
  ;(function(args) {
    if (args) {
      var hash = {
        0: 'config',
        1: 'use',
        2: 'define'
      }
      for (var i = 0; i < args.length; i += 2) {
        seajs[hash[args[i]]].apply(seajs, args[i + 1])
      }
    }
  })((_seajs || 0)['args'])


  // Add define.amd property for clear indicator.
  global.define.cmd = {}


  // Keeps clean!
  delete seajs.define
  delete seajs._util
  delete seajs._config
  delete seajs._seajs

})(seajs, seajs._config, this)


var loaderPath = seajs.pluginSDK.util.loaderDir;
seajs.config({
  map : [
    ['.js', '-min.js']
  ],
  alias : {
    'bui' : loaderPath
  },
  charset: 'utf-8'
});

var BUI = BUI || {};

BUI.use = seajs.use;

BUI.config = seajs.config;

BUI.setDebug = function (debug) {
  BUI.debug = debug;
  if(debug){
    seajs.config({
      map : [
        ['-min.js', '.js']
      ]
    });
  }else{
    seajs.config({
      map : [
        ['.js', '-min.js']
      ]
    });
  }
}
define('bui/common',['bui/ua','bui/json','bui/date','bui/array','bui/keycode','bui/observable','bui/observable','bui/base','bui/component'],function(require){

  var BUI = require('bui/util');

  BUI.mix(BUI,{
    UA : require('bui/ua'),
    JSON : require('bui/json'),
    Date : require('bui/date'),
    Array : require('bui/array'),
    KeyCode : require('bui/keycode'),
    Observable : require('bui/observable'),
    Base : require('bui/base'),
    Component : require('bui/component')
  });
  return BUI;
});
/**
 * \u5b9a\u4e49\u547d\u540d\u7a7a\u95f4
 * <p>
 * <img src="../assets/img/class-bui.jpg"/>
 * </p>
 * @class  BUI
 * @singleton
 */  
var BUI = BUI || {};

/**
 * BUI \u7684\u9759\u6001\u51fd\u6570
 * @ignore
 */
define('bui/util',function(){
  
    /**
     * \u517c\u5bb9 jquery 1.6
     * @ignore
     */
    (function($){
      if($.fn){
        $.fn.on = $.fn.on || $.fn.bind;
        $.fn.off = $.fn.off || $.fn.unbind;
      }
     
    })(jQuery);
    
  var win = window,
    doc = document,
    objectPrototype = Object.prototype,
    toString = objectPrototype.toString,
    ATTRS = 'ATTRS',
    PARSER = 'PARSER',
    GUID_DEFAULT = 'guid';

  $.extend(BUI,
  {
    /**
     * \u7248\u672c\u53f7
     * @type {Number}
     */
    version:1.0,

    /**
     * \u5b50\u7248\u672c\u53f7
     * @type {String}
     */
    subVersion : 1,

    /**
     * \u662f\u5426\u4e3a\u51fd\u6570
     * @param  {*} fn \u5bf9\u8c61
     * @return {Boolean}  \u662f\u5426\u51fd\u6570
     */
    isFunction : function(fn){
      return typeof(fn) === 'function';
    },
    /**
     * \u662f\u5426\u6570\u7ec4
     * @method 
     * @param  {*}  obj \u662f\u5426\u6570\u7ec4
     * @return {Boolean}  \u662f\u5426\u6570\u7ec4
     */
    isArray : ('isArray' in Array) ? Array.isArray : function(value) {
        return toString.call(value) === '[object Array]';
    },
    /**
     * \u662f\u5426\u65e5\u671f
     * @param  {*}  value \u5bf9\u8c61
     * @return {Boolean}  \u662f\u5426\u65e5\u671f
     */
    isDate: function(value) {
        return toString.call(value) === '[object Date]';
    },
    /**
     * \u662f\u5426\u662fjavascript\u5bf9\u8c61
     * @param {Object} value The value to test
     * @return {Boolean}
     * @method
     */
    isObject: (toString.call(null) === '[object Object]') ?
    function(value) {
        // check ownerDocument here as well to exclude DOM nodes
        return value !== null && value !== undefined && toString.call(value) === '[object Object]' && value.ownerDocument === undefined;
    } :
    function(value) {
        return toString.call(value) === '[object Object]';
    },
    /**
     * \u5c06\u6307\u5b9a\u7684\u65b9\u6cd5\u6216\u5c5e\u6027\u653e\u5230\u6784\u9020\u51fd\u6570\u7684\u539f\u578b\u94fe\u4e0a\uff0c
     * \u51fd\u6570\u652f\u6301\u591a\u4e8e2\u4e2a\u53d8\u91cf\uff0c\u540e\u9762\u7684\u53d8\u91cf\u540cs1\u4e00\u6837\u5c06\u5176\u6210\u5458\u590d\u5236\u5230\u6784\u9020\u51fd\u6570\u7684\u539f\u578b\u94fe\u4e0a\u3002
     * @param  {Function} r  \u6784\u9020\u51fd\u6570
     * @param  {Object} s1 \u5c06s1 \u7684\u6210\u5458\u590d\u5236\u5230\u6784\u9020\u51fd\u6570\u7684\u539f\u578b\u94fe\u4e0a
     *			@example
     *			BUI.augment(class1,{
     *				method1: function(){
     *   
     *				}
     *			});
     */
    augment : function(r,s1){
      if(!BUI.isFunction(r))
      {
        return r;
      }
      for (var i = 1; i < arguments.length; i++) {
        BUI.mix(r.prototype,arguments[i].prototype || arguments[i]);
      };
      return r;
    },
    /**
     * \u62f7\u8d1d\u5bf9\u8c61
     * @param  {Object} obj \u8981\u62f7\u8d1d\u7684\u5bf9\u8c61
     * @return {Object} \u62f7\u8d1d\u751f\u6210\u7684\u5bf9\u8c61
     */
    cloneObject : function(obj){
            var result = BUI.isArray(obj) ? [] : {};
            
      return BUI.mix(true,result,obj);
    },
    /**
    * \u629b\u51fa\u9519\u8bef
    */
    error : function(msg){
        if(BUI.debug){
            throw msg;
        }
    },
    /**
     * \u5b9e\u73b0\u7c7b\u7684\u7ee7\u627f\uff0c\u901a\u8fc7\u7236\u7c7b\u751f\u6210\u5b50\u7c7b
     * @param  {Function} subclass
     * @param  {Function} superclass \u7236\u7c7b\u6784\u9020\u51fd\u6570
     * @param  {Object} overrides  \u5b50\u7c7b\u7684\u5c5e\u6027\u6216\u8005\u65b9\u6cd5
     * @return {Function} \u8fd4\u56de\u7684\u5b50\u7c7b\u6784\u9020\u51fd\u6570
		 * \u793a\u4f8b:
     *		@example
     *		//\u7236\u7c7b
     *		function base(){
     * 
     *		}
     *
     *		function sub(){
     * 
     *		}
     *		//\u5b50\u7c7b
     *		BUI.extend(sub,base,{
     *			method : function(){
     *    
     *			}
     *		});
     *
     *		//\u6216\u8005
     *		var sub = BUI.extend(base,{});
     */
    extend : function(subclass,superclass,overrides, staticOverrides){
      //\u5982\u679c\u53ea\u63d0\u4f9b\u7236\u7c7b\u6784\u9020\u51fd\u6570\uff0c\u5219\u81ea\u52a8\u751f\u6210\u5b50\u7c7b\u6784\u9020\u51fd\u6570
      if(!BUI.isFunction(superclass))
      {
        
        overrides = superclass;
        superclass = subclass;
        subclass =  function(){};
      }

      var create = Object.create ?
            function (proto, c) {
                return Object.create(proto, {
                    constructor: {
                        value: c
                    }
                });
            } :
            function (proto, c) {
                function F() {
                }

                F.prototype = proto;

                var o = new F();
                o.constructor = c;
                return o;
            };
      var superObj = create(superclass.prototype,subclass);//new superclass(),//\u5b9e\u4f8b\u5316\u7236\u7c7b\u4f5c\u4e3a\u5b50\u7c7b\u7684prototype
      subclass.prototype = BUI.mix(superObj,subclass.prototype);     //\u6307\u5b9a\u5b50\u7c7b\u7684prototype
      subclass.superclass = create(superclass.prototype,superclass);  
      BUI.mix(superObj,overrides);
      BUI.mix(subclass,staticOverrides);
      return subclass;
    },
    /**
     * \u751f\u6210\u552f\u4e00\u7684Id
     * @method
     * @param {String} prefix \u524d\u7f00
     * @default 'bui-guid'
     * @return {String} \u552f\u4e00\u7684\u7f16\u53f7
     */
    guid : (function(){
        var map = {};
        return function(prefix){
            prefix = prefix || BUI.prefix + GUID_DEFAULT;
            if(!map[prefix]){
                map[prefix] = 1;
            }else{
                map[prefix] += 1;
            }
            return prefix + map[prefix];
        };
    })(),
    /**
     * \u5224\u65ad\u662f\u5426\u662f\u5b57\u7b26\u4e32
     * @return {Boolean} \u662f\u5426\u662f\u5b57\u7b26\u4e32
     */
    isString : function(value){
      return typeof value === 'string';
    },
    /**
     * \u5224\u65ad\u662f\u5426\u6570\u5b57\uff0c\u7531\u4e8e$.isNumberic\u65b9\u6cd5\u4f1a\u628a '123'\u8ba4\u4e3a\u6570\u5b57
     * @return {Boolean} \u662f\u5426\u6570\u5b57
     */
    isNumber : function(value){
      return typeof value === 'number';
    },
    /**
     * \u63a7\u5236\u53f0\u8f93\u51fa\u65e5\u5fd7
     * @param  {Object} obj \u8f93\u51fa\u7684\u6570\u636e
     */
    log : function(obj){
      if(BUI.debug && win.console && win.console.log){
        win.console.log(obj);
      }
    },
    /**
    * \u5c06\u591a\u4e2a\u5bf9\u8c61\u7684\u5c5e\u6027\u590d\u5236\u5230\u4e00\u4e2a\u65b0\u7684\u5bf9\u8c61
    */
    merge : function(){
      var args = $.makeArray(arguments);
      args.unshift({});
      return BUI.mix.apply(null,args);

    },
    /**
     * \u5c01\u88c5 jQuery.extend \u65b9\u6cd5\uff0c\u5c06\u591a\u4e2a\u5bf9\u8c61\u7684\u5c5e\u6027merge\u5230\u7b2c\u4e00\u4e2a\u5bf9\u8c61\u4e2d
     * @return {Object} 
     */
    mix : function(){
      return $.extend.apply(null,arguments);
    },
    /**
    * \u521b\u9020\u9876\u5c42\u7684\u547d\u540d\u7a7a\u95f4\uff0c\u9644\u52a0\u5230window\u5bf9\u8c61\u4e0a,
    * \u5305\u542bnamespace\u65b9\u6cd5
    */
    app : function(name){
      if(!window[name]){
        window[name] = {
          namespace :function(nsName){
            return BUI.namespace(nsName,window[name]);
          }
        };
      }
      return window[name];
    },
    /**
     * \u5c06\u5176\u4ed6\u7c7b\u4f5c\u4e3amixin\u96c6\u6210\u5230\u6307\u5b9a\u7c7b\u4e0a\u9762
     * @param {Function} c \u6784\u9020\u51fd\u6570
     * @param {Array} mixins \u6269\u5c55\u7c7b
     * @param {Array} attrs \u6269\u5c55\u7684\u9759\u6001\u5c5e\u6027\uff0c\u9ed8\u8ba4\u4e3a['ATTRS']
     * @return {Function} \u4f20\u5165\u7684\u6784\u9020\u51fd\u6570
     */
    mixin : function(c,mixins,attrs){
        attrs = attrs || [ATTRS,PARSER];
        var extensions = mixins;
        if (extensions) {
            c.mixins = extensions;

            var desc = {
                // ATTRS:
                // HTML_PARSER:
            }, constructors = extensions['concat'](c);

            // [ex1,ex2]\uff0c\u6269\u5c55\u7c7b\u540e\u9762\u7684\u4f18\u5148\uff0cex2 \u5b9a\u4e49\u7684\u8986\u76d6 ex1 \u5b9a\u4e49\u7684
            // \u4e3b\u7c7b\u6700\u4f18\u5148
            BUI.each(constructors, function (ext) {
                if (ext) {
                    // \u5408\u5e76 ATTRS/HTML_PARSER \u5230\u4e3b\u7c7b
                    BUI.each(attrs, function (K) {
                        if (ext[K]) {
                            desc[K] = desc[K] || {};
                            // \u4e0d\u8986\u76d6\u4e3b\u7c7b\u4e0a\u7684\u5b9a\u4e49\uff0c\u56e0\u4e3a\u7ee7\u627f\u5c42\u6b21\u4e0a\u6269\u5c55\u7c7b\u6bd4\u4e3b\u7c7b\u5c42\u6b21\u9ad8
                            // \u4f46\u662f\u503c\u662f\u5bf9\u8c61\u7684\u8bdd\u4f1a\u6df1\u5ea6\u5408\u5e76
                            // \u6ce8\u610f\uff1a\u6700\u597d\u503c\u662f\u7b80\u5355\u5bf9\u8c61\uff0c\u81ea\u5b9a\u4e49 new \u51fa\u6765\u7684\u5bf9\u8c61\u5c31\u4f1a\u6709\u95ee\u9898(\u7528 function return \u51fa\u6765)!
                             BUI.mix(true,desc[K], ext[K]);
                        }
                    });
                }
            });

            BUI.each(desc, function (v,k) {
                c[k] = v;
            });

            var prototype = {};

            // \u4e3b\u7c7b\u6700\u4f18\u5148
            BUI.each(constructors, function (ext) {
                if (ext) {
                    var proto = ext.prototype;
                    // \u5408\u5e76\u529f\u80fd\u4ee3\u7801\u5230\u4e3b\u7c7b\uff0c\u4e0d\u8986\u76d6
                    for (var p in proto) {
                        // \u4e0d\u8986\u76d6\u4e3b\u7c7b\uff0c\u4f46\u662f\u4e3b\u7c7b\u7684\u7236\u7c7b\u8fd8\u662f\u8986\u76d6\u5427
                        if (proto.hasOwnProperty(p)) {
                            prototype[p] = proto[p];
                        }
                    }
                }
            });

            BUI.each(prototype, function (v,k) {
                c.prototype[k] = v;
            });
        }
        return c;
    },
    /**
     * \u751f\u6210\u547d\u540d\u7a7a\u95f4
     * @param  {String} name \u547d\u540d\u7a7a\u95f4\u7684\u540d\u79f0
     * @param  {Object} baseNS \u5728\u5df2\u6709\u7684\u547d\u540d\u7a7a\u95f4\u4e0a\u521b\u5efa\u547d\u540d\u7a7a\u95f4\uff0c\u9ed8\u8ba4\u201cBUI\u201d
     * @return {Object} \u8fd4\u56de\u7684\u547d\u540d\u7a7a\u95f4\u5bf9\u8c61
     *		@example
     *		BUI.namespace("Grid"); // BUI.Grid
     */
    namespace : function(name,baseNS){
      baseNS = baseNS || BUI;
      if(!name){
        return baseNS;
      }
      var list = name.split('.'),
        //firstNS = win[list[0]],
        curNS = baseNS;
      
      for (var i = 0; i < list.length; i++) {
        var nsName = list[i];
        if(!curNS[nsName]){
          curNS[nsName] = {};
        }
        curNS = curNS[nsName];
      };    
      return curNS;
    },
    /**
     * BUI \u63a7\u4ef6\u7684\u516c\u7528\u524d\u7f00
     * @type {String}
     */
    prefix : 'bui-',
    /**
     * \u66ff\u6362\u5b57\u7b26\u4e32\u4e2d\u7684\u5b57\u6bb5.
     * @param {String} str \u6a21\u7248\u5b57\u7b26\u4e32
     * @param {Object} o json data
     * @param {RegExp} [regexp] \u5339\u914d\u5b57\u7b26\u4e32\u7684\u6b63\u5219\u8868\u8fbe\u5f0f
     */
    substitute: function (str, o, regexp) {
        if (!BUI.isString(str)
            || (!BUI.isObject(o)) && !BUI.isArray(o)) {
            return str;
        }

        return str.replace(regexp || /\\?\{([^{}]+)\}/g, function (match, name) {
            if (match.charAt(0) === '\\') {
                return match.slice(1);
            }
            return (o[name] === undefined) ? '' : o[name];
        });
    },
    /**
     * \u4f7f\u7b2c\u4e00\u4e2a\u5b57\u6bcd\u53d8\u6210\u5927\u5199
     * @param  {String} s \u5b57\u7b26\u4e32
     * @return {String} \u9996\u5b57\u6bcd\u5927\u5199\u540e\u7684\u5b57\u7b26\u4e32
     */
    ucfirst : function(s){
      s += '';
            return s.charAt(0).toUpperCase() + s.substring(1);
    },
    /**
     * \u9875\u9762\u4e0a\u7684\u4e00\u70b9\u662f\u5426\u5728\u7528\u6237\u7684\u89c6\u56fe\u5185
     * @param {Object} offset \u5750\u6807\uff0cleft,top
     * @return {Boolean} \u662f\u5426\u5728\u89c6\u56fe\u5185
     */
    isInView : function(offset){
      var left = offset.left,
        top = offset.top,
        viewWidth = BUI.viewportWidth(),
        wiewHeight = BUI.viewportHeight(),
        scrollTop = BUI.scrollTop(),
        scrollLeft = BUI.scrollLeft();
      //\u5224\u65ad\u6a2a\u5750\u6807
      if(left < scrollLeft ||left > scrollLeft + viewWidth){
        return false;
      }
      //\u5224\u65ad\u7eb5\u5750\u6807
      if(top < scrollTop || top > scrollTop + wiewHeight){
        return false;
      }
      return true;
    },
    /**
     * \u9875\u9762\u4e0a\u7684\u4e00\u70b9\u7eb5\u5411\u5750\u6807\u662f\u5426\u5728\u7528\u6237\u7684\u89c6\u56fe\u5185
     * @param {Object} top  \u7eb5\u5750\u6807
     * @return {Boolean} \u662f\u5426\u5728\u89c6\u56fe\u5185
     */
    isInVerticalView : function(top){
      var wiewHeight = BUI.viewportHeight(),
        scrollTop = BUI.scrollTop();
      
      //\u5224\u65ad\u7eb5\u5750\u6807
      if(top < scrollTop || top > scrollTop + wiewHeight){
        return false;
      }
      return true;
    },
    /**
     * \u9875\u9762\u4e0a\u7684\u4e00\u70b9\u6a2a\u5411\u5750\u6807\u662f\u5426\u5728\u7528\u6237\u7684\u89c6\u56fe\u5185
     * @param {Object} left \u6a2a\u5750\u6807
     * @return {Boolean} \u662f\u5426\u5728\u89c6\u56fe\u5185
     */
    isInHorizontalView : function(left){
      var viewWidth = BUI.viewportWidth(),     
        scrollLeft = BUI.scrollLeft();
      //\u5224\u65ad\u6a2a\u5750\u6807
      if(left < scrollLeft ||left > scrollLeft + viewWidth){
        return false;
      }
      return true;
    },
    /**
     * \u83b7\u53d6\u7a97\u53e3\u53ef\u89c6\u8303\u56f4\u5bbd\u5ea6
     * @return {Number} \u53ef\u89c6\u533a\u5bbd\u5ea6
     */
    viewportWidth : function(){
        return $(window).width();
    },
    /**
     * \u83b7\u53d6\u7a97\u53e3\u53ef\u89c6\u8303\u56f4\u9ad8\u5ea6
     * @return {Number} \u53ef\u89c6\u533a\u9ad8\u5ea6
     */
    viewportHeight:function(){
         return $(window).height();
    },
    /**
     * \u6eda\u52a8\u5230\u7a97\u53e3\u7684left\u4f4d\u7f6e
     */
    scrollLeft : function(){
        return $(window).scrollLeft();
    },
    /**
     * \u6eda\u52a8\u5230\u6a2a\u5411\u4f4d\u7f6e
     */
    scrollTop : function(){
        return $(window).scrollTop();
    },
    /**
     * \u7a97\u53e3\u5bbd\u5ea6
     * @return {Number} \u7a97\u53e3\u5bbd\u5ea6
     */
    docWidth : function(){
        var body = document.documentElement || document.body;
        return $(body).width();
    },
    /**
     * \u7a97\u53e3\u9ad8\u5ea6
     * @return {Number} \u7a97\u53e3\u9ad8\u5ea6
     */
    docHeight : function(){
        var body = document.documentElement || document.body;
        return $(body).height();
    },
    /**
     * \u904d\u5386\u6570\u7ec4\u6216\u8005\u5bf9\u8c61
     * @param {Object|Array} element/Object \u6570\u7ec4\u4e2d\u7684\u5143\u7d20\u6216\u8005\u5bf9\u8c61\u7684\u503c 
     * @param {Function} func \u904d\u5386\u7684\u51fd\u6570 function(elememt,index){} \u6216\u8005 function(value,key){}
     */
    each : function (elements,func) {
      if(!elements){
        return;
      }
      $.each(elements,function(k,v){
        return func(v,k);
      });
    },
    /**
     * \u5c01\u88c5\u4e8b\u4ef6\uff0c\u4fbf\u4e8e\u4f7f\u7528\u4e0a\u4e0b\u6587this,\u548c\u4fbf\u4e8e\u89e3\u9664\u4e8b\u4ef6\u65f6\u4f7f\u7528
     * @protected
     * @param  {Object} self   \u5bf9\u8c61
     * @param  {String} action \u4e8b\u4ef6\u540d\u79f0
     */
    wrapBehavior : function(self, action) {
      return self['__bui_wrap_' + action] = function (e) {
        if (!self.get('disabled')) {
            self[action](e);
        }
      };
    },
    /**
     * \u83b7\u53d6\u5c01\u88c5\u7684\u4e8b\u4ef6
     * @protected
     * @param  {Object} self   \u5bf9\u8c61
     * @param  {String} action \u4e8b\u4ef6\u540d\u79f0
     */
    getWrapBehavior : function(self, action) {
        return self['__bui_wrap_' + action];
    }

  });

  /**
  * \u8868\u5355\u5e2e\u52a9\u7c7b\uff0c\u5e8f\u5217\u5316\u3001\u53cd\u5e8f\u5217\u5316\uff0c\u8bbe\u7f6e\u503c
  * @class BUI.FormHelper
  * @singleton
  */
  var formHelper = BUI.FormHelper = {
    /**
    * \u5c06\u8868\u5355\u683c\u5f0f\u5316\u6210\u952e\u503c\u5bf9\u5f62\u5f0f
    * @param {HTMLElement} form \u8868\u5355
    * @return {Object} \u952e\u503c\u5bf9\u7684\u5bf9\u8c61
    */
    serializeToObject:function(form){
      var array = $(form).serializeArray(),
        result = {};
      BUI.each(array,function(item){
        var name = item.name;
        result[item.name] = item.value;
      });
      return result;
    },
    /**
     * \u8bbe\u7f6e\u8868\u5355\u7684\u503c
     * @param {HTMLElement} form \u8868\u5355
     * @param {Object} obj  \u952e\u503c\u5bf9
     */
    setValues : function(form,obj){
      for(var name in obj){
        if(obj.hasOwnProperty(name)){
          BUI.FormHelper.setField(form,name,obj[name]);
        }
      }
    },
    /**
     * \u6e05\u7a7a\u8868\u5355
     * @param  {HTMLElement} form \u8868\u5355\u5143\u7d20
     */
    clear : function(form){
      var elements = $.makeArray(form.elements);

      BUI.each(elements,function(element){
        if(element.type === 'checkbox' || element.type === 'radio' ){
          $(element).attr('checked',false);
        }else{
          $(element).val('');
        }
        $(element).change();
      });
    },
    /**
    * \u8bbe\u7f6e\u8868\u5355\u5b57\u6bb5
    * @param {HTMLElement} form \u8868\u5355\u5143\u7d20
    * @param {string} field \u5b57\u6bb5\u540d 
    * @param {string} value \u5b57\u6bb5\u503c
    */
    setField:function(form,fieldName,value){
      var fields = form.elements[fieldName];
      if(BUI.isArray(fields)){
        BUI.each(fields,function(field){
          if(field.type === 'checkbox'){
            if(field.value === value || BUI.Array.indexOf(field.value,value) !== -1){
              $(field).attr('checked',true);
            }
          }else if(field.type === 'radio' && field.value === value){
            $(field).attr('checked',true);
          }else{
            $(field).val(value);
          }
        
        });
      }else{
        $(fields).val(value);
      }
    },
    /**
     * \u83b7\u53d6\u8868\u5355\u5b57\u6bb5\u503c
     * @param {HTMLElement} form \u8868\u5355\u5143\u7d20
     * @param {string} field \u5b57\u6bb5\u540d 
     * @return {String}   \u5b57\u6bb5\u503c
     */
    getField : function(form,fieldName){
      return BUI.FormHelper.serializeToObject(form)[fieldName];
    }
  };

  return BUI;
});/**
 * @fileOverview \u6570\u7ec4\u5e2e\u52a9\u7c7b
 * @ignore
 */

define('bui/array',['bui/util'],function (r) {
  
  var BUI = r('bui/util');
  /**
   * @class BUI.Array
   * \u6570\u7ec4\u5e2e\u52a9\u7c7b
   */
  BUI.Array ={
    /**
     * \u8fd4\u56de\u6570\u7ec4\u7684\u6700\u540e\u4e00\u4e2a\u5bf9\u8c61
     * @param {Array} array \u6570\u7ec4\u6216\u8005\u7c7b\u4f3c\u4e8e\u6570\u7ec4\u7684\u5bf9\u8c61.
     * @return {*} \u6570\u7ec4\u7684\u6700\u540e\u4e00\u9879.
     */
    peek : function(array) {
      return array[array.length - 1];
    },
    /**
     * \u67e5\u627e\u8bb0\u5f55\u6240\u5728\u7684\u4f4d\u7f6e
     * @param  {*} value \u503c
     * @param  {Array} array \u6570\u7ec4\u6216\u8005\u7c7b\u4f3c\u4e8e\u6570\u7ec4\u7684\u5bf9\u8c61
     * @param  {Number} [fromIndex=0] \u8d77\u59cb\u9879\uff0c\u9ed8\u8ba4\u4e3a0
     * @return {Number} \u4f4d\u7f6e\uff0c\u5982\u679c\u4e3a -1\u5219\u4e0d\u5728\u6570\u7ec4\u5185
     */
    indexOf : function(value, array,opt_fromIndex){
       var fromIndex = opt_fromIndex == null ?
          0 : (opt_fromIndex < 0 ?
               Math.max(0, array.length + opt_fromIndex) : opt_fromIndex);

      for (var i = fromIndex; i < array.length; i++) {
        if (i in array && array[i] === value)
          return i;
      }
      return -1;
    },
    /**
     * \u6570\u7ec4\u662f\u5426\u5b58\u5728\u6307\u5b9a\u503c
     * @param  {*} value \u503c
     * @param  {Array} array \u6570\u7ec4\u6216\u8005\u7c7b\u4f3c\u4e8e\u6570\u7ec4\u7684\u5bf9\u8c61
     * @return {Boolean} \u662f\u5426\u5b58\u5728\u4e8e\u6570\u7ec4\u4e2d
     */
    contains : function(value,array){
      return BUI.Array.indexOf(value,array) >=0;
    },
    /**
     * \u904d\u5386\u6570\u7ec4\u6216\u8005\u5bf9\u8c61
     * @method 
     * @param {Object|Array} element/Object \u6570\u7ec4\u4e2d\u7684\u5143\u7d20\u6216\u8005\u5bf9\u8c61\u7684\u503c 
     * @param {Function} func \u904d\u5386\u7684\u51fd\u6570 function(elememt,index){} \u6216\u8005 function(value,key){}
     */
    each : BUI.each,
    /**
     * 2\u4e2a\u6570\u7ec4\u5185\u90e8\u7684\u503c\u662f\u5426\u76f8\u7b49
     * @param  {Array} a1 \u6570\u7ec41
     * @param  {Array} a2 \u6570\u7ec42
     * @return {Boolean} 2\u4e2a\u6570\u7ec4\u76f8\u7b49\u6216\u8005\u5185\u90e8\u5143\u7d20\u662f\u5426\u76f8\u7b49
     */
    equals : function(a1,a2){
      if(a1 == a2){
        return true;
      }
      if(!a1 || !a2){
        return false;
      }

      if(a1.length != a2.length){
        return false;
      }
      var rst = true;
      for(var i = 0 ;i < a1.length; i++){
        if(a1[i] !== a2[i]){
          rst = false;
          break;
        }
      }
      return rst;
    },

    /**
     * \u8fc7\u6ee4\u6570\u7ec4
     * @param {Object|Array} element/Object \u6570\u7ec4\u4e2d\u7684\u5143\u7d20\u6216\u8005\u5bf9\u8c61\u7684\u503c 
     * @param {Function} func \u904d\u5386\u7684\u51fd\u6570 function(elememt,index){} \u6216\u8005 function(value,key){},\u5982\u679c\u8fd4\u56detrue\u5219\u6dfb\u52a0\u5230\u7ed3\u679c\u96c6
     * @return {Array} \u8fc7\u6ee4\u7684\u7ed3\u679c\u96c6
     */
    filter : function(array,func){
      var result = [];
      BUI.Array.each(array,function(value,index){
        if(func(value,index)){
          result.push(value);
        }
      });
      return result;
    },
    /**
     * \u8f6c\u6362\u6570\u7ec4\u6570\u7ec4
     * @param {Object|Array} element/Object \u6570\u7ec4\u4e2d\u7684\u5143\u7d20\u6216\u8005\u5bf9\u8c61\u7684\u503c 
     * @param {Function} func \u904d\u5386\u7684\u51fd\u6570 function(elememt,index){} \u6216\u8005 function(value,key){},\u5c06\u8fd4\u56de\u7684\u7ed3\u679c\u6dfb\u52a0\u5230\u7ed3\u679c\u96c6
     * @return {Array} \u8fc7\u6ee4\u7684\u7ed3\u679c\u96c6
     */
    map : function(array,func){
      var result = [];
      BUI.Array.each(array,function(value,index){
        result.push(func(value,index));
      });
      return result;
    },
    /**
     * \u83b7\u53d6\u7b2c\u4e00\u4e2a\u7b26\u5408\u6761\u4ef6\u7684\u6570\u636e
     * @param  {Array} array \u6570\u7ec4
     * @param  {Function} func  \u5339\u914d\u51fd\u6570
     * @return {*}  \u7b26\u5408\u6761\u4ef6\u7684\u6570\u636e
     */
    find : function(array,func){
      var i = BUI.Array.findIndex(array, func);
      return i < 0 ? null : array[i];
    },
    /**
     * \u83b7\u53d6\u7b2c\u4e00\u4e2a\u7b26\u5408\u6761\u4ef6\u7684\u6570\u636e\u7684\u7d22\u5f15\u503c
    * @param  {Array} array \u6570\u7ec4
     * @param  {Function} func  \u5339\u914d\u51fd\u6570
     * @return {Number} \u7b26\u5408\u6761\u4ef6\u7684\u6570\u636e\u7684\u7d22\u5f15\u503c
     */
    findIndex : function(array,func){
      var result = -1;
      BUI.Array.each(array,function(value,index){
        if(func(value,index)){
          result = index;
          return false;
        }
      });
      return result;
    },
    /**
     * \u6570\u7ec4\u662f\u5426\u4e3a\u7a7a
     * @param  {Array}  array \u6570\u7ec4
     * @return {Boolean}  \u662f\u5426\u4e3a\u7a7a
     */
    isEmpty : function(array){
      return array.length == 0;
    },
    /**
     * \u63d2\u5165\u6570\u7ec4
     * @param  {Array} array \u6570\u7ec4
     * @param  {Number} index \u4f4d\u7f6e
     * @param {*} value \u63d2\u5165\u7684\u6570\u636e
     */
    add : function(array,value){
      array.push(value);
    },
    /**
     * \u5c06\u6570\u636e\u63d2\u5165\u6570\u7ec4\u6307\u5b9a\u7684\u4f4d\u7f6e
     * @param  {Array} array \u6570\u7ec4
     * @param {*} value \u63d2\u5165\u7684\u6570\u636e
     * @param  {Number} index \u4f4d\u7f6e
     */
    addAt : function(array,value,index){
      BUI.Array.splice(array, index, 0, value);
    },
    /**
     * \u6e05\u7a7a\u6570\u7ec4
     * @param  {Array} array \u6570\u7ec4
     * @return {Array}  \u6e05\u7a7a\u540e\u7684\u6570\u7ec4
     */
    empty : function(array){
      if(!(array instanceof(Array))){
        for (var i = array.length - 1; i >= 0; i--) {
          delete array[i];
        }
      }
      array.length = 0;
    },
    /**
     * \u79fb\u9664\u8bb0\u5f55
     * @param  {Array} array \u6570\u7ec4
     * @param  {*} value \u8bb0\u5f55
     * @return {Boolean}   \u662f\u5426\u79fb\u9664\u6210\u529f
     */
    remove : function(array,value){
      var i = BUI.Array.indexOf(value, array);
      var rv;
      if ((rv = i >= 0)) {
        BUI.Array.removeAt(array, i);
      }
      return rv;
    },
    /**
     * \u79fb\u9664\u6307\u5b9a\u4f4d\u7f6e\u7684\u8bb0\u5f55
     * @param  {Array} array \u6570\u7ec4
     * @param  {Number} index \u7d22\u5f15\u503c
     * @return {Boolean}   \u662f\u5426\u79fb\u9664\u6210\u529f
     */
    removeAt : function(array,index){
      return BUI.Array.splice(array, index, 1).length == 1;
    },
    /**
     * @private
     */
    slice : function(arr, start, opt_end){
      if (arguments.length <= 2) {
        return Array.prototype.slice.call(arr, start);
      } else {
        return Array.prototype.slice.call(arr, start, opt_end);
      }
    },
    /**
     * @private
     */
    splice : function(arr, index, howMany, var_args){
      return Array.prototype.splice.apply(arr, BUI.Array.slice(arguments, 1))
    }

  };
  return BUI.Array;
});/**
 * @fileOverview \u89c2\u5bdf\u8005\u6a21\u5f0f\u5b9e\u73b0\u4e8b\u4ef6
 * @ignore
 */

define('bui/observable',['bui/util'],function (r) {
  
  var BUI = r('bui/util');
  /**
   * @private
   * @class BUI.Observable.Callbacks
   * jquery 1.7 \u65f6\u5b58\u5728 $.Callbacks,\u4f46\u662ffireWith\u7684\u8fd4\u56de\u7ed3\u679c\u662f$.Callbacks \u5bf9\u8c61\uff0c
   * \u800c\u6211\u4eec\u60f3\u8981\u7684\u6548\u679c\u662f\uff1a\u5f53\u5176\u4e2d\u6709\u4e00\u4e2a\u51fd\u6570\u8fd4\u56de\u4e3afalse\u65f6\uff0c\u963b\u6b62\u540e\u9762\u7684\u6267\u884c\uff0c\u5e76\u8fd4\u56defalse
   */
  var Callbacks = function(){
    this._init();
  };

  BUI.augment(Callbacks,{

    _functions : null,

    _init : function(){
      var _self = this;

      _self._functions = [];
    },
    /**
     * \u6dfb\u52a0\u56de\u8c03\u51fd\u6570
     * @param {Function} fn \u56de\u8c03\u51fd\u6570
     */
    add:function(fn){
      this._functions.push(fn);
    },
    /**
     * \u79fb\u9664\u56de\u8c03\u51fd\u6570
     * @param  {Function} fn \u56de\u8c03\u51fd\u6570
     */
    remove : function(fn){
      var functions = this._functions;
        index = BUI.Array.indexOf(fn,functions);
      if(index>=0){
        functions.splice(index,1);
      }
    },
    empty : function(){
      var length = this._functions.length; //ie6,7\u4e0b\uff0c\u5fc5\u987b\u6307\u5b9a\u9700\u8981\u5220\u9664\u7684\u6570\u91cf
      this._functions.splice(0,length);
    },
    /**
     * \u89e6\u53d1\u56de\u8c03
     * @param  {Object} scope \u4e0a\u4e0b\u6587
     * @param  {Array} args  \u56de\u8c03\u51fd\u6570\u7684\u53c2\u6570
     * @return {Boolean|undefined} \u5f53\u5176\u4e2d\u6709\u4e00\u4e2a\u51fd\u6570\u8fd4\u56de\u4e3afalse\u65f6\uff0c\u963b\u6b62\u540e\u9762\u7684\u6267\u884c\uff0c\u5e76\u8fd4\u56defalse
     */
    fireWith : function(scope,args){
      var _self = this,
        rst;

      BUI.each(_self._functions,function(fn){
        rst = fn.apply(scope,args);
        if(rst === false){
          return false;
        }
      });
      return rst;
    }
  });

  function getCallbacks(){
    return new Callbacks();
  }
  /**
   * \u652f\u6301\u4e8b\u4ef6\u7684\u5bf9\u8c61\uff0c\u53c2\u8003\u89c2\u5bdf\u8005\u6a21\u5f0f
   *  - \u6b64\u7c7b\u63d0\u4f9b\u4e8b\u4ef6\u7ed1\u5b9a
   *  - \u63d0\u4f9b\u4e8b\u4ef6\u5192\u6ce1\u673a\u5236
   *
   * <pre><code>
   *   var control = new Control();
   *   control.on('click',function(ev){
   *   
   *   });
   *
   *   control.off();  //\u79fb\u9664\u6240\u6709\u4e8b\u4ef6
   * </code></pre>
   * @class BUI.Observable
   * @abstract
   * @param {Object} config \u914d\u7f6e\u9879\u952e\u503c\u5bf9
   */
  var Observable = function(config){
        this._events = [];
        this._eventMap = {};
        this._bubblesEvents = [];
    this._initEvents(config);
  };

  BUI.augment(Observable,
  {

    /**
     * @cfg {Object} listeners 
     *  \u521d\u59cb\u5316\u4e8b\u4ef6,\u5feb\u901f\u6ce8\u518c\u4e8b\u4ef6
     *  <pre><code>
     *    var list = new BUI.List.SimpleList({
     *      listeners : {
     *        itemclick : function(ev){},
     *        itemrendered : function(ev){}
     *      },
     *      items : []
     *    });
     *    list.render();
     *  </code></pre>
     */
    
    /**
     * @cfg {Function} handler
     * \u70b9\u51fb\u4e8b\u4ef6\u7684\u5904\u7406\u51fd\u6570\uff0c\u5feb\u901f\u914d\u7f6e\u70b9\u51fb\u4e8b\u4ef6\u800c\u4e0d\u9700\u8981\u5199listeners\u5c5e\u6027
     * <pre><code>
     *    var list = new BUI.List.SimpleList({
     *      handler : function(ev){} //click \u4e8b\u4ef6
     *    });
     *    list.render();
     *  </code></pre>
     */
    
    /**
     * \u652f\u6301\u7684\u4e8b\u4ef6\u540d\u5217\u8868
     * @private
     */
    _events:[],

    /**
     * \u7ed1\u5b9a\u7684\u4e8b\u4ef6
     * @private
     */
    _eventMap : {},

    _bubblesEvents : [],

    _bubbleTarget : null,

    //\u83b7\u53d6\u56de\u8c03\u96c6\u5408
    _getCallbacks : function(eventType){
      var _self = this,
        eventMap = _self._eventMap;
      return eventMap[eventType];
    },
    //\u521d\u59cb\u5316\u4e8b\u4ef6\u5217\u8868
    _initEvents : function(config){
      var _self = this,
        listeners = null; 

      if(!config){
        return;
      }
      listeners = config.listeners || {};
      if(config.handler){
        listeners.click = config.handler;
      }
      if(listeners){
        for (var name in listeners) {
          if(listeners.hasOwnProperty(name)){
            _self.on(name,listeners[name]);
          }
        };
      }
    },
    //\u4e8b\u4ef6\u662f\u5426\u652f\u6301\u5192\u6ce1
    _isBubbles : function (eventType) {
        return BUI.Array.indexOf(eventType,this._bubblesEvents) >= 0;
    },
    /**
     * \u6dfb\u52a0\u5192\u6ce1\u7684\u5bf9\u8c61
     * @protected
     * @param {Object} target  \u5192\u6ce1\u7684\u4e8b\u4ef6\u6e90
     */
    addTarget : function(target) {
        this._bubbleTarget = target;
    },
    /**
     * \u6dfb\u52a0\u652f\u6301\u7684\u4e8b\u4ef6
     * @protected
     * @param {String|String[]} events \u4e8b\u4ef6
     */
    addEvents : function(events){
      var _self = this,
        existEvents = _self._events,
        eventMap = _self._eventMap;

      function addEvent(eventType){
        if(BUI.Array.indexOf(eventType,existEvents) === -1){
          eventMap[eventType] = getCallbacks();
          existEvents.push(eventType);
        }
      }
      if(BUI.isArray(events)){
        $.each(events,function(index,eventType){
          addEvent(eventType);
        });
      }else{
        addEvent(events);
      }
    },
    /**
     * \u79fb\u9664\u6240\u6709\u7ed1\u5b9a\u7684\u4e8b\u4ef6
     * @protected
     */
    clearListeners : function(){
      var _self = this,
        eventMap = _self._eventMap;
      for(var name in eventMap){
        if(eventMap.hasOwnProperty(name)){
          eventMap[name].empty();
        }
      }
    },
    /**
     * \u89e6\u53d1\u4e8b\u4ef6
     * <pre><code>
     *   //\u7ed1\u5b9a\u4e8b\u4ef6
     *   list.on('itemclick',function(ev){
     *     alert('21');
     *   });
     *   //\u89e6\u53d1\u4e8b\u4ef6
     *   list.fire('itemclick');
     * </code></pre>
     * @param  {String} eventType \u4e8b\u4ef6\u7c7b\u578b
     * @param  {Object} eventData \u4e8b\u4ef6\u89e6\u53d1\u65f6\u4f20\u9012\u7684\u6570\u636e
     * @return {Boolean|undefined}  \u5982\u679c\u5176\u4e2d\u4e00\u4e2a\u4e8b\u4ef6\u5904\u7406\u5668\u8fd4\u56de false , \u5219\u8fd4\u56de false, \u5426\u5219\u8fd4\u56de\u6700\u540e\u4e00\u4e2a\u4e8b\u4ef6\u5904\u7406\u5668\u7684\u8fd4\u56de\u503c
     */
    fire : function(eventType,eventData){
      var _self = this,
        callbacks = _self._getCallbacks(eventType),
        args = $.makeArray(arguments),
        result;
      if(!eventData){
        eventData = {};
        args.push(eventData);
      }
      if(!eventData.target){
        eventData.target = _self;
      }
      if(callbacks){
        result = callbacks.fireWith(_self,Array.prototype.slice.call(args,1));
      }
      if(_self._isBubbles(eventType)){
          var bubbleTarget = _self._bubbleTarget;
          if(bubbleTarget && bubbleTarget.fire){
              bubbleTarget.fire(eventType,eventData);
          }
      }
      return result;
    },
    /**
     * \u6dfb\u52a0\u7ed1\u5b9a\u4e8b\u4ef6
     * <pre><code>
     *   //\u7ed1\u5b9a\u5355\u4e2a\u4e8b\u4ef6
     *   list.on('itemclick',function(ev){
     *     alert('21');
     *   });
     *   //\u7ed1\u5b9a\u591a\u4e2a\u4e8b\u4ef6
     *   list.on('itemrendered itemupdated',function(){
     *     //\u5217\u8868\u9879\u521b\u5efa\u3001\u66f4\u65b0\u65f6\u89e6\u53d1\u64cd\u4f5c
     *   });
     * </code></pre>
     * @param  {String}   eventType \u4e8b\u4ef6\u7c7b\u578b
     * @param  {Function} fn        \u56de\u8c03\u51fd\u6570
     */
    on : function(eventType,fn){
      //\u4e00\u6b21\u76d1\u542c\u591a\u4e2a\u4e8b\u4ef6
      var arr = eventType.split(' '),
        _self = this,
        callbacks =null;
      if(arr.length > 1){
        BUI.each(arr,function(name){
          _self.on(name,fn);
        });
      }else{
        callbacks = _self._getCallbacks(eventType);
        if(callbacks){
          callbacks.add(fn);
        }else{
          _self.addEvents(eventType);
          _self.on(eventType,fn);
        }
      }
      return _self;
    },
    /**
     * \u79fb\u9664\u7ed1\u5b9a\u7684\u4e8b\u4ef6
     * <pre><code>
     *  //\u79fb\u9664\u6240\u6709\u4e8b\u4ef6
     *  list.off();
     *  
     *  //\u79fb\u9664\u7279\u5b9a\u4e8b\u4ef6
     *  function callback(ev){}
     *  list.on('click',callback);
     *
     *  list.off('click',callback);//\u9700\u8981\u4fdd\u5b58\u56de\u8c03\u51fd\u6570\u7684\u5f15\u7528
     * 
     * </code></pre>
     * @param  {String}   eventType \u4e8b\u4ef6\u7c7b\u578b
     * @param  {Function} fn        \u56de\u8c03\u51fd\u6570
     */
    off : function(eventType,fn){
      if(!eventType && !fn){
        this.clearListeners();
        return this;
      }
      var _self = this,
        callbacks = _self._getCallbacks(eventType);
      if(callbacks){
        callbacks.remove(fn);
      }
      return _self;
    },
    /**
     * \u914d\u7f6e\u4e8b\u4ef6\u662f\u5426\u5141\u8bb8\u5192\u6ce1
     * @protected
     * @param  {String} eventType \u652f\u6301\u5192\u6ce1\u7684\u4e8b\u4ef6
     * @param  {Object} cfg \u914d\u7f6e\u9879
     * @param {Boolean} cfg.bubbles \u662f\u5426\u652f\u6301\u5192\u6ce1
     */
    publish : function(eventType, cfg){
      var _self = this,
          bubblesEvents = _self._bubblesEvents;

      if(cfg.bubbles){
          if(BUI.Array.indexOf(eventType,bubblesEvents) === -1){
              bubblesEvents.push(eventType);
          }
      }else{
          var index = BUI.Array.indexOf(eventType,bubblesEvents);
          if(index !== -1){
              bubblesEvents.splice(index,1);
          }
      }
    }
  });

  return Observable;
});/**
 * @fileOverview UA,jQuery\u7684 $.browser \u5bf9\u8c61\u975e\u5e38\u96be\u4f7f\u7528
 * @ignore
 * @author dxq613@gmail.com
 */
define('bui/ua',function(){

    function numberify(s) {
        var c = 0;
        // convert '1.2.3.4' to 1.234
        return parseFloat(s.replace(/\./g, function () {
            return (c++ === 0) ? '.' : '';
        }));
    };

    var UA = $.UA || (function(){
        var browser = $.browser,
            versionNumber = numberify(browser.version),
            /**
             * \u6d4f\u89c8\u5668\u7248\u672c\u68c0\u6d4b
             * @class BUI.UA
                     * @singleton
             */
            ua = 
            {
                /**
                 * ie \u7248\u672c
                 * @type {Number}
                 */
                ie : browser.msie && versionNumber,

                /**
                 * webkit \u7248\u672c
                 * @type {Number}
                 */
                webkit : browser.webkit && versionNumber,
                /**
                 * opera \u7248\u672c
                 * @type {Number}
                 */
                opera : browser.opera && versionNumber,
                /**
                 * mozilla \u706b\u72d0\u7248\u672c
                 * @type {Number}
                 */
                mozilla : browser.mozilla && versionNumber
            };
        return ua;
    })();

    return UA;
});/**
 * @fileOverview \u7531\u4e8ejQuery\u53ea\u6709 parseJSON \uff0c\u6ca1\u6709stringify\u6240\u4ee5\u4f7f\u7528\u8fc7\u7a0b\u4e0d\u65b9\u4fbf
 * @ignore
 */
define('bui/json',['bui/ua'],function (require) {

  var win = window,
    UA = require('bui/ua'),
    JSON = win.JSON;

  // ie 8.0.7600.16315@win7 json \u6709\u95ee\u9898
  if (!JSON || UA['ie'] < 9) {
      JSON = win.JSON = {};
  }

  function f(n) {
      // Format integers to have at least two digits.
      return n < 10 ? '0' + n : n;
  }

  if (typeof Date.prototype.toJSON !== 'function') {

      Date.prototype.toJSON = function (key) {

          return isFinite(this.valueOf()) ?
              this.getUTCFullYear() + '-' +
                  f(this.getUTCMonth() + 1) + '-' +
                  f(this.getUTCDate()) + 'T' +
                  f(this.getUTCHours()) + ':' +
                  f(this.getUTCMinutes()) + ':' +
                  f(this.getUTCSeconds()) + 'Z' : null;
      };

      String.prototype.toJSON =
          Number.prototype.toJSON =
              Boolean.prototype.toJSON = function (key) {
                  return this.valueOf();
              };
  }


  var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
    escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
    gap,
    indent,
    meta = {    // table of character substitutions
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
    },
    rep;

    function quote(string) {

      // If the string contains no control characters, no quote characters, and no
      // backslash characters, then we can safely slap some quotes around it.
      // Otherwise we must also replace the offending characters with safe escape
      // sequences.

      escapable['lastIndex'] = 0;
      return escapable.test(string) ?
          '"' + string.replace(escapable, function (a) {
              var c = meta[a];
              return typeof c === 'string' ? c :
                  '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
          }) + '"' :
          '"' + string + '"';
    }

    function str(key, holder) {

      // Produce a string from holder[key].

      var i,          // The loop counter.
          k,          // The member key.
          v,          // The member value.
          length,
          mind = gap,
          partial,
          value = holder[key];

      // If the value has a toJSON method, call it to obtain a replacement value.

      if (value && typeof value === 'object' &&
          typeof value.toJSON === 'function') {
          value = value.toJSON(key);
      }

      // If we were called with a replacer function, then call the replacer to
      // obtain a replacement value.

      if (typeof rep === 'function') {
          value = rep.call(holder, key, value);
      }

      // What happens next depends on the value's type.

      switch (typeof value) {
          case 'string':
              return quote(value);

          case 'number':

      // JSON numbers must be finite. Encode non-finite numbers as null.

              return isFinite(value) ? String(value) : 'null';

          case 'boolean':
          case 'null':

      // If the value is a boolean or null, convert it to a string. Note:
      // typeof null does not produce 'null'. The case is included here in
      // the remote chance that this gets fixed someday.

              return String(value);

      // If the type is 'object', we might be dealing with an object or an array or
      // null.

          case 'object':

      // Due to a specification blunder in ECMAScript, typeof null is 'object',
      // so watch out for that case.

              if (!value) {
                  return 'null';
              }

      // Make an array to hold the partial results of stringifying this object value.

              gap += indent;
              partial = [];

      // Is the value an array?

              if (Object.prototype.toString.apply(value) === '[object Array]') {

      // The value is an array. Stringify every element. Use null as a placeholder
      // for non-JSON values.

                  length = value.length;
                  for (i = 0; i < length; i += 1) {
                      partial[i] = str(i, value) || 'null';
                  }

      // Join all of the elements together, separated with commas, and wrap them in
      // brackets.

                  v = partial.length === 0 ? '[]' :
                      gap ? '[\n' + gap +
                          partial.join(',\n' + gap) + '\n' +
                          mind + ']' :
                          '[' + partial.join(',') + ']';
                  gap = mind;
                  return v;
              }

      // If the replacer is an array, use it to select the members to be stringified.

              if (rep && typeof rep === 'object') {
                  length = rep.length;
                  for (i = 0; i < length; i += 1) {
                      k = rep[i];
                      if (typeof k === 'string') {
                          v = str(k, value);
                          if (v) {
                              partial.push(quote(k) + (gap ? ': ' : ':') + v);
                          }
                      }
                  }
              } else {

      // Otherwise, iterate through all of the keys in the object.

                  for (k in value) {
                      if (Object.hasOwnProperty.call(value, k)) {
                          v = str(k, value);
                          if (v) {
                              partial.push(quote(k) + (gap ? ': ' : ':') + v);
                          }
                      }
                  }
              }

      // Join all of the member texts together, separated with commas,
      // and wrap them in braces.

              v = partial.length === 0 ? '{}' :
                  gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' +
                      mind + '}' : '{' + partial.join(',') + '}';
              gap = mind;
              return v;
      }
  }

  if (typeof JSON.stringify !== 'function') {
    JSON.stringify = function (value, replacer, space) {

      // The stringify method takes a value and an optional replacer, and an optional
      // space parameter, and returns a JSON text. The replacer can be a function
      // that can replace values, or an array of strings that will select the keys.
      // A default replacer method can be provided. Use of the space parameter can
      // produce text that is more easily readable.

      var i;
      gap = '';
      indent = '';

      // If the space parameter is a number, make an indent string containing that
      // many spaces.

      if (typeof space === 'number') {
          for (i = 0; i < space; i += 1) {
              indent += ' ';
          }

      // If the space parameter is a string, it will be used as the indent string.

      } else if (typeof space === 'string') {
          indent = space;
      }

      // If there is a replacer, it must be a function or an array.
      // Otherwise, throw an error.

      rep = replacer;
      if (replacer && typeof replacer !== 'function' &&
          (typeof replacer !== 'object' ||
              typeof replacer.length !== 'number')) {
          throw new Error('JSON.stringify');
      }

      // Make a fake root object containing our value under the key of ''.
      // Return the result of stringifying the value.

      return str('', {'': value});
      };
    }

  function looseParse(data){
    try{
      return new Function('return ' + data + ';')();
    }catch(e){
      throw 'Json parse error!';
    }
  }
 /**
	* JSON \u683c\u5f0f\u5316
  * @class BUI.JSON
	* @singleton
  */
  var JSON = {
    /**
     * \u8f6c\u6210json \u7b49\u540c\u4e8e$.parseJSON
     * @method
     * @param {String} jsonstring \u5408\u6cd5\u7684json \u5b57\u7b26\u4e32
     */
    parse : $.parseJSON,
    /**
     * \u4e1a\u52a1\u4e2d\u6709\u4e9b\u5b57\u7b26\u4e32\u7ec4\u6210\u7684json\u6570\u636e\u4e0d\u662f\u4e25\u683c\u7684json\u6570\u636e\uff0c\u5982\u4f7f\u7528\u5355\u5f15\u53f7\uff0c\u6216\u8005\u5c5e\u6027\u540d\u4e0d\u662f\u5b57\u7b26\u4e32
     * \u5982 \uff1a {a:'abc'}
     * @method 
     * @param {String} jsonstring
     */
    looseParse : looseParse,
    /**
     * \u5c06Json\u8f6c\u6210\u5b57\u7b26\u4e32
     * @method 
     * @param {Object} json json \u5bf9\u8c61
     */
    stringify : JSON.stringify
  }

  return JSON;
});/**
 * @fileOverview \u952e\u76d8\u503c
 * @ignore
 */

define('bui/keycode',function () {
  
  /**
   * \u952e\u76d8\u6309\u952e\u5bf9\u5e94\u7684\u6570\u5b57\u503c
   * @class BUI.KeyCode
   * @singleton
   */
  var keyCode = {
    /** Key constant @type Number */
    BACKSPACE: 8,
    /** Key constant @type Number */
    TAB: 9,
    /** Key constant @type Number */
    NUM_CENTER: 12,
    /** Key constant @type Number */
    ENTER: 13,
    /** Key constant @type Number */
    RETURN: 13,
    /** Key constant @type Number */
    SHIFT: 16,
    /** Key constant @type Number */
    CTRL: 17,
    /** Key constant @type Number */
    ALT: 18,
    /** Key constant @type Number */
    PAUSE: 19,
    /** Key constant @type Number */
    CAPS_LOCK: 20,
    /** Key constant @type Number */
    ESC: 27,
    /** Key constant @type Number */
    SPACE: 32,
    /** Key constant @type Number */
    PAGE_UP: 33,
    /** Key constant @type Number */
    PAGE_DOWN: 34,
    /** Key constant @type Number */
    END: 35,
    /** Key constant @type Number */
    HOME: 36,
    /** Key constant @type Number */
    LEFT: 37,
    /** Key constant @type Number */
    UP: 38,
    /** Key constant @type Number */
    RIGHT: 39,
    /** Key constant @type Number */
    DOWN: 40,
    /** Key constant @type Number */
    PRINT_SCREEN: 44,
    /** Key constant @type Number */
    INSERT: 45,
    /** Key constant @type Number */
    DELETE: 46,
    /** Key constant @type Number */
    ZERO: 48,
    /** Key constant @type Number */
    ONE: 49,
    /** Key constant @type Number */
    TWO: 50,
    /** Key constant @type Number */
    THREE: 51,
    /** Key constant @type Number */
    FOUR: 52,
    /** Key constant @type Number */
    FIVE: 53,
    /** Key constant @type Number */
    SIX: 54,
    /** Key constant @type Number */
    SEVEN: 55,
    /** Key constant @type Number */
    EIGHT: 56,
    /** Key constant @type Number */
    NINE: 57,
    /** Key constant @type Number */
    A: 65,
    /** Key constant @type Number */
    B: 66,
    /** Key constant @type Number */
    C: 67,
    /** Key constant @type Number */
    D: 68,
    /** Key constant @type Number */
    E: 69,
    /** Key constant @type Number */
    F: 70,
    /** Key constant @type Number */
    G: 71,
    /** Key constant @type Number */
    H: 72,
    /** Key constant @type Number */
    I: 73,
    /** Key constant @type Number */
    J: 74,
    /** Key constant @type Number */
    K: 75,
    /** Key constant @type Number */
    L: 76,
    /** Key constant @type Number */
    M: 77,
    /** Key constant @type Number */
    N: 78,
    /** Key constant @type Number */
    O: 79,
    /** Key constant @type Number */
    P: 80,
    /** Key constant @type Number */
    Q: 81,
    /** Key constant @type Number */
    R: 82,
    /** Key constant @type Number */
    S: 83,
    /** Key constant @type Number */
    T: 84,
    /** Key constant @type Number */
    U: 85,
    /** Key constant @type Number */
    V: 86,
    /** Key constant @type Number */
    W: 87,
    /** Key constant @type Number */
    X: 88,
    /** Key constant @type Number */
    Y: 89,
    /** Key constant @type Number */
    Z: 90,
    /** Key constant @type Number */
    CONTEXT_MENU: 93,
    /** Key constant @type Number */
    NUM_ZERO: 96,
    /** Key constant @type Number */
    NUM_ONE: 97,
    /** Key constant @type Number */
    NUM_TWO: 98,
    /** Key constant @type Number */
    NUM_THREE: 99,
    /** Key constant @type Number */
    NUM_FOUR: 100,
    /** Key constant @type Number */
    NUM_FIVE: 101,
    /** Key constant @type Number */
    NUM_SIX: 102,
    /** Key constant @type Number */
    NUM_SEVEN: 103,
    /** Key constant @type Number */
    NUM_EIGHT: 104,
    /** Key constant @type Number */
    NUM_NINE: 105,
    /** Key constant @type Number */
    NUM_MULTIPLY: 106,
    /** Key constant @type Number */
    NUM_PLUS: 107,
    /** Key constant @type Number */
    NUM_MINUS: 109,
    /** Key constant @type Number */
    NUM_PERIOD: 110,
    /** Key constant @type Number */
    NUM_DIVISION: 111,
    /** Key constant @type Number */
    F1: 112,
    /** Key constant @type Number */
    F2: 113,
    /** Key constant @type Number */
    F3: 114,
    /** Key constant @type Number */
    F4: 115,
    /** Key constant @type Number */
    F5: 116,
    /** Key constant @type Number */
    F6: 117,
    /** Key constant @type Number */
    F7: 118,
    /** Key constant @type Number */
    F8: 119,
    /** Key constant @type Number */
    F9: 120,
    /** Key constant @type Number */
    F10: 121,
    /** Key constant @type Number */
    F11: 122,
    /** Key constant @type Number */
    F12: 123
  };

  return keyCode;
});/*
 * @fileOverview Date Format 1.2.3
 * @ignore
 * (c) 2007-2009 Steven Levithan <stevenlevithan.com>
 * MIT license
 *
 * Includes enhancements by Scott Trenda <scott.trenda.net>
 * and Kris Kowal <cixar.com/~kris.kowal/>
 *
 * Accepts a date, a mask, or a date and a mask.
 * Returns a formatted version of the given date.
 * The date defaults to the current date/time.
 * The mask defaults to dateFormat.masks.default.
 *
 * Last modified by jayli \u62d4\u8d64 2010-09-09
 * - \u589e\u52a0\u4e2d\u6587\u7684\u652f\u6301
 * - \u7b80\u5355\u7684\u672c\u5730\u5316\uff0c\u5bf9w\uff08\u661f\u671fx\uff09\u7684\u652f\u6301
 * 
 */
define('bui/date',function () {

    var dateRegex = /^(?:(?!0000)[0-9]{4}([-/.]+)(?:(?:0?[1-9]|1[0-2])\1(?:0?[1-9]|1[0-9]|2[0-8])|(?:0?[13-9]|1[0-2])\1(?:29|30)|(?:0?[13578]|1[02])\1(?:31))|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)([-/.]?)0?2\2(?:29))(\s+([01]|([01][0-9]|2[0-3])):([0-9]|[0-5][0-9]):([0-9]|[0-5][0-9]))?$/;
    function dateParse(data, s) {

        var date = null;
        s = s || '-';
        //Convert to date
        if (!(date instanceof Date)) {
            if(BUI.isString(data)){
                date = new Date(data.replace(/-/g,'/'));
            }else{
                date = new Date(data);
            }
            
        }
        else {
            return date;
        }

        // Validate
        if (date instanceof Date && (date != 'Invalid Date') && !isNaN(date)) {
            return date;
        }
        else {
            var arr = data.toString().split(s);
            if (arr.length == 3) {
                date = new Date(arr[0], (parseInt(arr[1], 10) - 1), arr[2]);
                if (date instanceof Date && (date != 'Invalid Date') && !isNaN(date)) {
                    return date;
                }
            }
        }
        return null;

    }

    function   DateAdd(strInterval,   NumDay,   dtDate)   {   
        var   dtTmp   =   new   Date(dtDate);   
        if   (isNaN(dtTmp)){
            dtTmp   =   new   Date(); 
        }     
        switch   (strInterval)   {   
           case   's':
             dtTmp =   new   Date(dtTmp.getTime()   +   (1000   *   parseInt(NumDay))); 
             break; 
           case   'n':
             dtTmp =   new   Date(dtTmp.getTime()   +   (60000   *   parseInt(NumDay))); 
             break; 
           case   'h':
             dtTmp =   new   Date(dtTmp.getTime()   +   (3600000   *   parseInt(NumDay)));
             break;
           case   'd':
             dtTmp =   new   Date(dtTmp.getTime()   +   (86400000   *   parseInt(NumDay)));
             break;
           case   'w':
             dtTmp =   new   Date(dtTmp.getTime()   +   ((86400000   *   7)   *   parseInt(NumDay))); 
             break;
           case   'm':
             dtTmp =   new   Date(dtTmp.getFullYear(),   (dtTmp.getMonth())+parseInt(NumDay),   dtTmp.getDate(),   dtTmp.getHours(),   dtTmp.getMinutes(),   dtTmp.getSeconds());
             break;   
           case   'y':
             //alert(dtTmp.getFullYear());
             dtTmp =   new   Date(dtTmp.getFullYear()+parseInt(NumDay),   dtTmp.getMonth(),   dtTmp.getDate(),   dtTmp.getHours(),   dtTmp.getMinutes(),   dtTmp.getSeconds());
             //alert(dtTmp);
             break;
        }
        return dtTmp;
    }   

    var dateFormat = function () {
        var token = /w{1}|d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
            timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
            timezoneClip = /[^-+\dA-Z]/g,
            pad = function (val, len) {
                val = String(val);
                len = len || 2;
                while (val.length < len) {
                    val = '0' + val;
                }
                return val;
            },
            // Some common format strings
            masks = {
                'default':'ddd mmm dd yyyy HH:MM:ss',
                shortDate:'m/d/yy',
                //mediumDate:     'mmm d, yyyy',
                longDate:'mmmm d, yyyy',
                fullDate:'dddd, mmmm d, yyyy',
                shortTime:'h:MM TT',
                //mediumTime:     'h:MM:ss TT',
                longTime:'h:MM:ss TT Z',
                isoDate:'yyyy-mm-dd',
                isoTime:'HH:MM:ss',
                isoDateTime:"yyyy-mm-dd'T'HH:MM:ss",
                isoUTCDateTime:"UTC:yyyy-mm-dd'T'HH:MM:ss'Z'",

                //added by jayli
                localShortDate:'yy\u5e74mm\u6708dd\u65e5',
                localShortDateTime:'yy\u5e74mm\u6708dd\u65e5 hh:MM:ss TT',
                localLongDate:'yyyy\u5e74mm\u6708dd\u65e5',
                localLongDateTime:'yyyy\u5e74mm\u6708dd\u65e5 hh:MM:ss TT',
                localFullDate:'yyyy\u5e74mm\u6708dd\u65e5 w',
                localFullDateTime:'yyyy\u5e74mm\u6708dd\u65e5 w hh:MM:ss TT'

            },

            // Internationalization strings
            i18n = {
                dayNames:[
                    'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
                    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
                    '\u661f\u671f\u65e5', '\u661f\u671f\u4e00', '\u661f\u671f\u4e8c', '\u661f\u671f\u4e09', '\u661f\u671f\u56db', '\u661f\u671f\u4e94', '\u661f\u671f\u516d'
                ],
                monthNames:[
                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
                    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
                ]
            };

        // Regexes and supporting functions are cached through closure
        return function (date, mask, utc) {

            // You can't provide utc if you skip other args (use the "UTC:" mask prefix)
            if (arguments.length === 1 && Object.prototype.toString.call(date) === '[object String]' && !/\d/.test(date)) {
                mask = date;
                date = undefined;
            }

            // Passing date through Date applies Date.parse, if necessary
            date = date ? new Date(date) : new Date();
            if (isNaN(date)) {
                throw SyntaxError('invalid date');
            }

            mask = String(masks[mask] || mask || masks['default']);

            // Allow setting the utc argument via the mask
            if (mask.slice(0, 4) === 'UTC:') {
                mask = mask.slice(4);
                utc = true;
            }

            var _ = utc ? 'getUTC' : 'get',
                d = date[_ + 'Date'](),
                D = date[_ + 'Day'](),
                m = date[_ + 'Month'](),
                y = date[_ + 'FullYear'](),
                H = date[_ + 'Hours'](),
                M = date[_ + 'Minutes'](),
                s = date[_ + 'Seconds'](),
                L = date[_ + 'Milliseconds'](),
                o = utc ? 0 : date.getTimezoneOffset(),
                flags = {
                    d:d,
                    dd:pad(d, undefined),
                    ddd:i18n.dayNames[D],
                    dddd:i18n.dayNames[D + 7],
                    w:i18n.dayNames[D + 14],
                    m:m + 1,
                    mm:pad(m + 1, undefined),
                    mmm:i18n.monthNames[m],
                    mmmm:i18n.monthNames[m + 12],
                    yy:String(y).slice(2),
                    yyyy:y,
                    h:H % 12 || 12,
                    hh:pad(H % 12 || 12, undefined),
                    H:H,
                    HH:pad(H, undefined),
                    M:M,
                    MM:pad(M, undefined),
                    s:s,
                    ss:pad(s, undefined),
                    l:pad(L, 3),
                    L:pad(L > 99 ? Math.round(L / 10) : L, undefined),
                    t:H < 12 ? 'a' : 'p',
                    tt:H < 12 ? 'am' : 'pm',
                    T:H < 12 ? 'A' : 'P',
                    TT:H < 12 ? 'AM' : 'PM',
                    Z:utc ? 'UTC' : (String(date).match(timezone) || ['']).pop().replace(timezoneClip, ''),
                    o:(o > 0 ? '-' : '+') + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
                    S:['th', 'st', 'nd', 'rd'][d % 10 > 3 ? 0 : (d % 100 - d % 10 !== 10) * d % 10]
                };

            return mask.replace(token, function ($0) {
                return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
            });
        };
    }();

	/**
	* \u65e5\u671f\u7684\u5de5\u5177\u65b9\u6cd5
	* @class BUI.Date
	*/
    var DateUtil = {
        /**
         * \u65e5\u671f\u52a0\u6cd5
         * @param {String} strInterval \u52a0\u6cd5\u7684\u7c7b\u578b\uff0cs(\u79d2),n(\u5206),h(\u65f6),d(\u5929),w(\u5468),m(\u6708),y(\u5e74)
         * @param {Number} Num         \u6570\u91cf\uff0c\u5982\u679c\u4e3a\u8d1f\u6570\uff0c\u5219\u4e3a\u51cf\u6cd5
         * @param {Date} dtDate      \u8d77\u59cb\u65e5\u671f\uff0c\u9ed8\u8ba4\u4e3a\u6b64\u65f6
         */
        add : function(strInterval,Num,dtDate){
            return DateAdd(strInterval,Num,dtDate);
        },
        /**
         * \u5c0f\u65f6\u7684\u52a0\u6cd5
         * @param {Number} hours \u5c0f\u65f6
         * @param {Date} date \u8d77\u59cb\u65e5\u671f
         */
        addHour : function(hours,date){
            return DateAdd('h',hours,date);
        },
         /**
         * \u5206\u7684\u52a0\u6cd5
         * @param {Number} minutes \u5206
         * @param {Date} date \u8d77\u59cb\u65e5\u671f
         */
        addMinute : function(minutes,date){
            return DateAdd('n',minutes,date);
        },
         /**
         * \u79d2\u7684\u52a0\u6cd5
         * @param {Number} seconds \u79d2
         * @param {Date} date \u8d77\u59cb\u65e5\u671f
         */
        addSecond : function(seconds,date){
            return DateAdd('s',seconds,date);
        },
        /**
         * \u5929\u7684\u52a0\u6cd5
         * @param {Number} days \u5929\u6570
         * @param {Date} date \u8d77\u59cb\u65e5\u671f
         */
        addDay : function(days,date){ 
            return DateAdd('d',days,date);
        },
        /**
         * \u589e\u52a0\u5468
         * @param {Number} weeks \u5468\u6570
         * @param {Date} date  \u8d77\u59cb\u65e5\u671f
         */
        addWeek : function(weeks,date){
            return DateAdd('w',weeks,date);
        },
        /**
         * \u589e\u52a0\u6708
         * @param {Number} months \u6708\u6570
         * @param {Date} date  \u8d77\u59cb\u65e5\u671f
         */
        addMonths : function(months,date){
            return DateAdd('m',months,date);
        },
        /**
         * \u589e\u52a0\u5e74
         * @param {Number} years \u5e74\u6570
         * @param {Date} date  \u8d77\u59cb\u65e5\u671f
         */
        addYear : function(years,date){
            return DateAdd('y',years,date);
        },
        /**
         * \u65e5\u671f\u662f\u5426\u76f8\u7b49\uff0c\u5ffd\u7565\u65f6\u95f4
         * @param  {Date}  d1 \u65e5\u671f\u5bf9\u8c61
         * @param  {Date}  d2 \u65e5\u671f\u5bf9\u8c61
         * @return {Boolean}    \u662f\u5426\u76f8\u7b49
         */
        isDateEquals : function(d1,d2){

            return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
        },
        /**
         * \u65e5\u671f\u65f6\u95f4\u662f\u5426\u76f8\u7b49\uff0c\u5305\u542b\u65f6\u95f4
         * @param  {Date}  d1 \u65e5\u671f\u5bf9\u8c61
         * @param  {Date}  d2 \u65e5\u671f\u5bf9\u8c61
         * @return {Boolean}    \u662f\u5426\u76f8\u7b49
         */
        isEquals : function (d1,d2) {
            if(d1 == d2){
                return true;
            }
            if(!d1 || !d2){
                return false;
            }
            if(!d1.getTime || !d2.getTime){
                return false;
            }
            return d1.getTime() == d2.getTime();
        },
        /**
         * \u5b57\u7b26\u4e32\u662f\u5426\u662f\u6709\u6548\u7684\u65e5\u671f\u7c7b\u578b
         * @param {String} str \u5b57\u7b26\u4e32
         * @return \u5b57\u7b26\u4e32\u662f\u5426\u80fd\u8f6c\u6362\u6210\u65e5\u671f
         */
        isDateString : function(str){
            return dateRegex.test(str);
        },
        /**
         * \u5c06\u65e5\u671f\u683c\u5f0f\u5316\u6210\u5b57\u7b26\u4e32
         * @param  {Date} date \u65e5\u671f
         * @param  {String} mask \u683c\u5f0f\u5316\u65b9\u5f0f
         * @param  {Date} utc  \u662f\u5426utc\u65f6\u95f4
         * @return {String}      \u65e5\u671f\u7684\u5b57\u7b26\u4e32
         */
        format:function (date, mask, utc) {
            return dateFormat(date, mask, utc);
        },
        /**
         * \u8f6c\u6362\u6210\u65e5\u671f
         * @param  {String|Date} date \u5b57\u7b26\u4e32\u6216\u8005\u65e5\u671f
         * @param  {String} s    \u65f6\u95f4\u7684\u5206\u5272\u7b26\uff0c\u5982 2001-01-01\u4e2d\u7684 '-'
         * @return {Date}      \u65e5\u671f\u5bf9\u8c61
         */
        parse:function (date, s) {
            return dateParse(date, s);
        },
        /**
         * \u5f53\u524d\u5929
         * @return {Date} \u5f53\u524d\u5929 00:00:00
         */
        today : function(){
            var now = new Date();
            return new Date(now.getFullYear(),now.getMonth(),now.getDate());
        },
        /**
         * \u8fd4\u56de\u5f53\u524d\u65e5\u671f
         * @return {Date} \u65e5\u671f\u7684 00:00:00
         */
        getDate : function(date){
            return new Date(date.getFullYear(),date.getMonth(),date.getDate());
        }
    };

    return DateUtil;
});/**
 * @fileOverview  Base UI\u63a7\u4ef6\u7684\u6700\u57fa\u7840\u7684\u7c7b
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */
define('bui/base',['bui/observable'],function(require){

  var INVALID = {},
    Observable = require('bui/observable');

  function ensureNonEmpty(obj, name, create) {
        var ret = obj[name] || {};
        if (create) {
            obj[name] = ret;
        }
        return ret;
  }

  function normalFn(host, method) {
      if (BUI.isString(method)) {
          return host[method];
      }
      return method;
  }

  function __fireAttrChange(self, when, name, prevVal, newVal) {
      var attrName = name;
      return self.fire(when + BUI.ucfirst(name) + 'Change', {
          attrName: attrName,
          prevVal: prevVal,
          newVal: newVal
      });
  }

  function setInternal(self, name, value, opts, attrs) {
      opts = opts || {};

      var ret,
          subVal,
          prevVal;

      prevVal = self.get(name);

      //\u5982\u679c\u672a\u6539\u53d8\u503c\u4e0d\u8fdb\u884c\u4fee\u6539
      if(!$.isPlainObject(value) && !BUI.isArray(value) && prevVal === value){
        return undefined;
      }
      // check before event
      if (!opts['silent']) {
          if (false === __fireAttrChange(self, 'before', name, prevVal, value)) {
              return false;
          }
      }
      // set it
      ret = self._set(name, value, opts);

      if (ret === false) {
          return ret;
      }

      // fire after event
      if (!opts['silent']) {
          value = self.getAttrVals()[name];
          __fireAttrChange(self, 'after', name, prevVal, value);
      }
      return self;
  }

  /**
   * \u57fa\u7840\u7c7b\uff0c\u6b64\u7c7b\u63d0\u4f9b\u4ee5\u4e0b\u529f\u80fd
   *  - \u63d0\u4f9b\u8bbe\u7f6e\u83b7\u53d6\u5c5e\u6027
   *  - \u63d0\u4f9b\u4e8b\u4ef6\u652f\u6301
   *  - \u5c5e\u6027\u53d8\u5316\u65f6\u4f1a\u89e6\u53d1\u5bf9\u5e94\u7684\u4e8b\u4ef6
   *  - \u5c06\u914d\u7f6e\u9879\u81ea\u52a8\u8f6c\u6362\u6210\u5c5e\u6027
   *
   * ** \u521b\u5efa\u7c7b\uff0c\u7ee7\u627fBUI.Base\u7c7b **
   * <pre><code>
   *   var Control = function(cfg){
   *     Control.superclass.constructor.call(this,cfg); //\u8c03\u7528BUI.Base\u7684\u6784\u9020\u65b9\u6cd5\uff0c\u5c06\u914d\u7f6e\u9879\u53d8\u6210\u5c5e\u6027
   *   };
   *
   *   BUI.extend(Control,BUI.Base);
   * </code></pre>
   *
   * ** \u58f0\u660e\u9ed8\u8ba4\u5c5e\u6027 ** 
   * <pre><code>
   *   Control.ATTRS = {
   *     id : {
   *       value : 'id' //value \u662f\u6b64\u5c5e\u6027\u7684\u9ed8\u8ba4\u503c
   *     },
   *     renderTo : {
   *      
   *     },
   *     el : {
   *       valueFn : function(){                 //\u7b2c\u4e00\u6b21\u8c03\u7528\u7684\u65f6\u5019\u5c06renderTo\u7684DOM\u8f6c\u6362\u6210el\u5c5e\u6027
   *         return $(this.get('renderTo'));
   *       }
   *     },
   *     text : {
   *       getter : function(){ //getter \u7528\u4e8e\u83b7\u53d6\u503c\uff0c\u800c\u4e0d\u662f\u8bbe\u7f6e\u7684\u503c
   *         return this.get('el').val();
   *       },
   *       setter : function(v){ //\u4e0d\u4ec5\u4ec5\u662f\u8bbe\u7f6e\u503c\uff0c\u53ef\u4ee5\u8fdb\u884c\u76f8\u5e94\u7684\u64cd\u4f5c
   *         this.get('el').val(v);
   *       }
   *     }
   *   };
   * </code></pre>
   *
   * ** \u58f0\u660e\u7c7b\u7684\u65b9\u6cd5 ** 
   * <pre><code>
   *   BUI.augment(Control,{
   *     getText : function(){
   *       return this.get('text');   //\u53ef\u4ee5\u7528get\u65b9\u6cd5\u83b7\u53d6\u5c5e\u6027\u503c
   *     },
   *     setText : function(txt){
   *       this.set('text',txt);      //\u4f7f\u7528set \u8bbe\u7f6e\u5c5e\u6027\u503c
   *     }
   *   });
   * </code></pre>
   *
   * ** \u521b\u5efa\u5bf9\u8c61 ** 
   * <pre><code>
   *   var c = new Control({
   *     id : 'oldId',
   *     text : '\u6d4b\u8bd5\u6587\u672c',
   *     renderTo : '#t1'
   *   });
   *
   *   var el = c.get(el); //$(#t1);
   *   el.val(); //text\u7684\u503c \uff1a '\u6d4b\u8bd5\u6587\u672c'
   *   c.set('text','\u4fee\u6539\u7684\u503c');
   *   el.val();  //'\u4fee\u6539\u7684\u503c'
   *
   *   c.set('id','newId') //\u4f1a\u89e6\u53d12\u4e2a\u4e8b\u4ef6\uff1a beforeIdChange,afterIdChange 2\u4e2a\u4e8b\u4ef6 ev.newVal \u548cev.prevVal\u6807\u793a\u65b0\u65e7\u503c
   * </code></pre>
   * @class BUI.Base
   * @abstract
   * @extends BUI.Observable
   * @param {Object} config \u914d\u7f6e\u9879
   */
  var Base = function(config){
    var _self = this,
            c = _self.constructor,
            constructors = [];

        Observable.apply(this,arguments);
        // define
        while (c) {
            constructors.push(c);
            //_self.addAttrs(c['ATTRS']);
            c = c.superclass ? c.superclass.constructor : null;
        }
        //\u4ee5\u5f53\u524d\u5bf9\u8c61\u7684\u5c5e\u6027\u6700\u7ec8\u6dfb\u52a0\u5230\u5c5e\u6027\u4e2d\uff0c\u8986\u76d6\u4e4b\u524d\u7684\u5c5e\u6027
        for (var i = constructors.length - 1; i >= 0; i--) {
          _self.addAttrs(constructors[i]['ATTRS'],true);
        };
        _self._initAttrs(config);

  };

  Base.INVALID = INVALID;

  BUI.extend(Base,Observable);

  BUI.augment(Base,
  {
    /**
     * \u6dfb\u52a0\u5c5e\u6027\u5b9a\u4e49
     * @protected
     * @param {String} name       \u5c5e\u6027\u540d
     * @param {Object} attrConfig \u5c5e\u6027\u5b9a\u4e49
     * @param {Boolean} overrides \u662f\u5426\u8986\u76d6\u5b57\u6bb5
     */
    addAttr: function (name, attrConfig,overrides) {
            var _self = this,
                attrs = _self.getAttrs(),
                cfg = BUI.cloneObject(attrConfig);//;//$.clone(attrConfig);

            if (!attrs[name]) {
                attrs[name] = cfg;
            } else if(overrides){
                BUI.mix(true,attrs[name], cfg);
            }
            return _self;
    },
    /**
     * \u6dfb\u52a0\u5c5e\u6027\u5b9a\u4e49
     * @protected
     * @param {Object} attrConfigs  An object with attribute name/configuration pairs.
     * @param {Object} initialValues user defined initial values
     * @param {Boolean} overrides \u662f\u5426\u8986\u76d6\u5b57\u6bb5
     */
    addAttrs: function (attrConfigs, initialValues,overrides) {
        var _self = this;
        if(!attrConfigs)
        {
          return _self;
        }
        if(typeof(initialValues) === 'boolean'){
          overrides = initialValues;
          initialValues = null;
        }
        BUI.each(attrConfigs, function (attrConfig, name) {
            _self.addAttr(name, attrConfig,overrides);
        });
        if (initialValues) {
            _self.set(initialValues);
        }
        return _self;
    },
    /**
     * \u662f\u5426\u5305\u542b\u6b64\u5c5e\u6027
     * @protected
     * @param  {String}  name \u503c
     * @return {Boolean} \u662f\u5426\u5305\u542b
     */
    hasAttr : function(name){
      return name && this.getAttrs().hasOwnProperty(name);
    },
    /**
     * \u83b7\u53d6\u9ed8\u8ba4\u7684\u5c5e\u6027\u503c
     * @protected
     * @return {Object} \u5c5e\u6027\u503c\u7684\u952e\u503c\u5bf9
     */
    getAttrs : function(){
       return ensureNonEmpty(this, '__attrs', true);
    },
    /**
     * \u83b7\u53d6\u5c5e\u6027\u540d/\u5c5e\u6027\u503c\u952e\u503c\u5bf9
     * @protected
     * @return {Object} \u5c5e\u6027\u5bf9\u8c61
     */
    getAttrVals: function(){
      return ensureNonEmpty(this, '__attrVals', true);
    },
    /**
     * \u83b7\u53d6\u5c5e\u6027\u503c\uff0c\u6240\u6709\u7684\u914d\u7f6e\u9879\u548c\u5c5e\u6027\u90fd\u53ef\u4ee5\u901a\u8fc7get\u65b9\u6cd5\u83b7\u53d6
     * <pre><code>
     *  var control = new Control({
     *   text : 'control text'
     *  });
     *  control.get('text'); //control text
     *
     *  control.set('customValue','value'); //\u4e34\u65f6\u53d8\u91cf
     *  control.get('customValue'); //value
     * </code></pre>
     * ** \u5c5e\u6027\u503c/\u914d\u7f6e\u9879 **
     * <pre><code> 
     *   Control.ATTRS = { //\u58f0\u660e\u5c5e\u6027\u503c
     *     text : {
     *       valueFn : function(){},
     *       value : 'value',
     *       getter : function(v){} 
     *     }
     *   };
     *   var c = new Control({
     *     text : 'text value'
     *   });
     *   //get \u51fd\u6570\u53d6\u7684\u987a\u5e8f\u4e3a\uff1a\u662f\u5426\u6709\u4fee\u6539\u503c\uff08\u914d\u7f6e\u9879\u3001set)\u3001\u9ed8\u8ba4\u503c\uff08\u7b2c\u4e00\u6b21\u8c03\u7528\u6267\u884cvalueFn)\uff0c\u5982\u679c\u6709getter\uff0c\u5219\u5c06\u503c\u4f20\u5165getter\u8fd4\u56de
     *
     *   c.get('text') //text value
     *   c.set('text','new text');//\u4fee\u6539\u503c
     *   c.get('text');//new text
     * </code></pre>
     * @param  {String} name \u5c5e\u6027\u540d
     * @return {Object} \u5c5e\u6027\u503c
     */
    get : function(name){
      var _self = this,
                declared = _self.hasAttr(name),
                attrVals = _self.getAttrVals(),
                attrConfig,
                getter, 
                ret;

            attrConfig = ensureNonEmpty(_self.getAttrs(), name);
            getter = attrConfig['getter'];

            // get user-set value or default value
            //user-set value takes privilege
            ret = name in attrVals ?
                attrVals[name] :
                _self._getDefAttrVal(name);

            // invoke getter for this attribute
            if (getter && (getter = normalFn(_self, getter))) {
                ret = getter.call(_self, ret, name);
            }

            return ret;
    },
  	/**
  	* @\u6e05\u7406\u6240\u6709\u5c5e\u6027\u503c
    * @protected 
  	*/
  	clearAttrVals : function(){
  		this.__attrVals = {};
  	},
    /**
     * \u79fb\u9664\u5c5e\u6027\u5b9a\u4e49
     * @protected
     */
    removeAttr: function (name) {
        var _self = this;

        if (_self.hasAttr(name)) {
            delete _self.getAttrs()[name];
            delete _self.getAttrVals()[name];
        }

        return self;
    },
    /**
     * \u8bbe\u7f6e\u5c5e\u6027\u503c\uff0c\u4f1a\u89e6\u53d1before+Name+Change,\u548c after+Name+Change\u4e8b\u4ef6
     * <pre><code>
     *  control.on('beforeTextChange',function(ev){
     *    var newVal = ev.newVal,
     *      attrName = ev.attrName,
     *      preVal = ev.prevVal;
     *
     *    //TO DO
     *  });
     *  control.set('text','new text');  //\u6b64\u65f6\u89e6\u53d1 beforeTextChange,afterTextChange
     *  control.set('text','modify text',{silent : true}); //\u6b64\u65f6\u4e0d\u89e6\u53d1\u4e8b\u4ef6
     * </code></pre>
     * @param {String|Object} name  \u5c5e\u6027\u540d
     * @param {Object} value \u503c
     * @param {Object} opts \u914d\u7f6e\u9879
     * @param {Boolean} opts.silent  \u914d\u7f6e\u5c5e\u6027\u65f6\uff0c\u662f\u5426\u4e0d\u89e6\u53d1\u4e8b\u4ef6
     */
    set : function(name,value,opts){
      var _self = this;
            if ($.isPlainObject(name)) {
                opts = value;
                var all = Object(name),
                    attrs = [];
                   
                for (name in all) {
                    if (all.hasOwnProperty(name)) {
                        setInternal(_self, name, all[name], opts);
                    }
                }
                return self;
            }
            return setInternal(_self, name, value, opts);
    },
    /**
     * \u8bbe\u7f6e\u5c5e\u6027\uff0c\u4e0d\u89e6\u53d1\u4e8b\u4ef6
     * <pre><code>
     *  control.setInternal('text','text');//\u6b64\u65f6\u4e0d\u89e6\u53d1\u4e8b\u4ef6
     * </code></pre>
     * @param  {String} name  \u5c5e\u6027\u540d
     * @param  {Object} value \u5c5e\u6027\u503c
     * @return {Boolean|undefined}   \u5982\u679c\u503c\u65e0\u6548\u5219\u8fd4\u56defalse,\u5426\u5219\u8fd4\u56deundefined
     */
    setInternal : function(name, value, opts){
        return this._set(name, value, opts);
    },
    //\u83b7\u53d6\u5c5e\u6027\u9ed8\u8ba4\u503c
    _getDefAttrVal : function(name){
      var _self = this,
        attrs = _self.getAttrs(),
              attrConfig = ensureNonEmpty(attrs, name),
              valFn = attrConfig.valueFn,
              val;

          if (valFn && (valFn = normalFn(_self, valFn))) {
              val = valFn.call(_self);
              if (val !== undefined) {
                  attrConfig.value = val;
              }
              delete attrConfig.valueFn;
              attrs[name] = attrConfig;
          }

          return attrConfig.value;
    },
    //\u4ec5\u4ec5\u8bbe\u7f6e\u5c5e\u6027\u503c
    _set : function(name, value, opts){
      var _self = this,
                setValue,
            // if host does not have meta info corresponding to (name,value)
            // then register on demand in order to collect all data meta info
            // \u4e00\u5b9a\u8981\u6ce8\u518c\u5c5e\u6027\u5143\u6570\u636e\uff0c\u5426\u5219\u5176\u4ed6\u6a21\u5757\u901a\u8fc7 _attrs \u4e0d\u80fd\u679a\u4e3e\u5230\u6240\u6709\u6709\u6548\u5c5e\u6027
            // \u56e0\u4e3a\u5c5e\u6027\u5728\u58f0\u660e\u6ce8\u518c\u524d\u53ef\u4ee5\u76f4\u63a5\u8bbe\u7f6e\u503c
                attrConfig = ensureNonEmpty(_self.getAttrs(), name, true),
                setter = attrConfig['setter'];

            // if setter has effect
            if (setter && (setter = normalFn(_self, setter))) {
                setValue = setter.call(_self, value, name);
            }

            if (setValue === INVALID) {
                return false;
            }

            if (setValue !== undefined) {
                value = setValue;
            }
            
            // finally set
            _self.getAttrVals()[name] = value;
    },
    //\u521d\u59cb\u5316\u5c5e\u6027
    _initAttrs : function(config){
      var _self = this;
      if (config) {
              for (var attr in config) {
                  if (config.hasOwnProperty(attr)) {
                      // \u7528\u6237\u8bbe\u7f6e\u4f1a\u8c03\u7528 setter/validator \u7684\uff0c\u4f46\u4e0d\u4f1a\u89e6\u53d1\u5c5e\u6027\u53d8\u5316\u4e8b\u4ef6
                      _self._set(attr, config[attr]);
                  }

              }
          }
    }
  });

  //BUI.Base = Base;
  return Base;
});/**
 * @fileOverview Component\u547d\u540d\u7a7a\u95f4\u7684\u5165\u53e3\u6587\u4ef6
 * @ignore
 */

define('bui/component',['bui/component/manage','bui/component/uibase','bui/component/view','bui/component/controller'],function (require) {
  /**
   * @class BUI.Component
   * <p>
   * <img src="../assets/img/class-common.jpg"/>
   * </p>
   * \u63a7\u4ef6\u57fa\u7c7b\u7684\u547d\u540d\u7a7a\u95f4
   */
  var Component = {};

  BUI.mix(Component,{
    Manager : require('bui/component/manage'),
    UIBase : require('bui/component/uibase'),
    View : require('bui/component/view'),
    Controller : require('bui/component/controller')
  });

  function create(component, self) {
    var childConstructor, xclass;
    if (component && (xclass = component.xclass)) {
        if (self && !component.prefixCls) {
            component.prefixCls = self.get('prefixCls');
        }
        childConstructor = Component.Manager.getConstructorByXClass(xclass);
        if (!childConstructor) {
            BUI.error('can not find class by xclass desc : ' + xclass);
        }
        component = new childConstructor(component);
    }
    return component;
  }

  /**
   * \u6839\u636eXclass\u521b\u5efa\u5bf9\u8c61
   * @method
   * @static
   * @param  {Object} component \u63a7\u4ef6\u7684\u914d\u7f6e\u9879\u6216\u8005\u63a7\u4ef6
   * @param  {Object} self      \u7236\u7c7b\u5b9e\u4f8b
   * @return {Object} \u5b9e\u4f8b\u5bf9\u8c61
   */
  Component.create = create;

  return Component;
});/**
 * @fileOverview  Base UI\u63a7\u4ef6\u7684\u7ba1\u7406\u7c7b
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */



//\u63a7\u4ef6\u7c7b\u7684\u7ba1\u7406\u5668
define('bui/component/manage',function(require){

    var uis = {
        // \u4e0d\u5e26\u524d\u7f00 prefixCls
        /*
         "menu" :{
         priority:0,
         constructor:Menu
         }
         */
    };

    function getConstructorByXClass(cls) {
        var cs = cls.split(/\s+/), 
            p = -1, 
            t, 
            ui = null;
        for (var i = 0; i < cs.length; i++) {
            var uic = uis[cs[i]];
            if (uic && (t = uic.priority) > p) {
                p = t;
                ui = uic.constructor;
            }
        }
        return ui;
    }

    function getXClassByConstructor(constructor) {
        for (var u in uis) {
            var ui = uis[u];
            if (ui.constructor == constructor) {
                return u;
            }
        }
        return 0;
    }

    function setConstructorByXClass(cls, uic) {
        if (BUI.isFunction(uic)) {
            uis[cls] = {
                constructor:uic,
                priority:0
            };
        } else {
            uic.priority = uic.priority || 0;
            uis[cls] = uic;
        }
    }


    function getCssClassWithPrefix(cls) {
        var cs = $.trim(cls).split(/\s+/);
        for (var i = 0; i < cs.length; i++) {
            if (cs[i]) {
                cs[i] = this.get('prefixCls') + cs[i];
            }
        }
        return cs.join(' ');
    }



    var componentInstances = {};

    /**
     * Manage component metadata.
     * @class BUI.Component.Manager
     * @singleton
     */
    var Manager ={

        __instances:componentInstances,
        /**
         * \u6bcf\u5b9e\u4f8b\u5316\u4e00\u4e2a\u63a7\u4ef6\uff0c\u5c31\u6ce8\u518c\u5230\u7ba1\u7406\u5668\u4e0a
         * @param {String} id  \u63a7\u4ef6 id
         * @param {BUI.Component.Controller} component \u63a7\u4ef6\u5bf9\u8c61
         */
        addComponent:function (id, component) {
            componentInstances[id] = component;
        },
        /**
         * \u79fb\u9664\u6ce8\u518c\u7684\u63a7\u4ef6
         * @param  {String} id \u63a7\u4ef6 id
         */
        removeComponent:function (id) {
            delete componentInstances[id];
        },

        /**
         * \u6839\u636eId\u83b7\u53d6\u63a7\u4ef6
         * @param  {String} id \u7f16\u53f7
         * @return {BUI.Component.UIBase}   \u7ee7\u627f UIBase\u7684\u7c7b\u5bf9\u8c61
         */
        getComponent:function (id) {
            return componentInstances[id];
        },

        getCssClassWithPrefix:getCssClassWithPrefix,
        /**
         * \u901a\u8fc7\u6784\u9020\u51fd\u6570\u83b7\u53d6xclass.
         * @param {Function} constructor \u63a7\u4ef6\u7684\u6784\u9020\u51fd\u6570.
         * @type {Function}
         * @return {String}
         * @method
         */
        getXClassByConstructor:getXClassByConstructor,
        /**
         * \u901a\u8fc7xclass\u83b7\u53d6\u63a7\u4ef6\u7684\u6784\u9020\u51fd\u6570
         * @param {String} classNames Class names separated by space.
         * @type {Function}
         * @return {Function}
         * @method
         */
        getConstructorByXClass:getConstructorByXClass,
        /**
         * \u5c06 xclass \u540c\u6784\u9020\u51fd\u6570\u76f8\u5173\u8054.
         * @type {Function}
         * @param {String} className \u63a7\u4ef6\u7684xclass\u540d\u79f0.
         * @param {Function} componentConstructor \u6784\u9020\u51fd\u6570
         * @method
         */
        setConstructorByXClass:setConstructorByXClass
    };

    return Manager;
});/**
 * @fileOverview uibase\u7684\u5165\u53e3\u6587\u4ef6
 * @ignore
 */
;(function(){
var BASE = 'bui/component/uibase/';
define('bui/component/uibase',[BASE + 'base',BASE + 'align',BASE + 'autoshow',BASE + 'autohide',
    BASE + 'close',BASE + 'collapseable',BASE + 'drag',BASE + 'keynav',BASE + 'list',
    BASE + 'listitem',BASE + 'mask',BASE + 'position',BASE + 'selection',BASE + 'stdmod',
    BASE + 'decorate',BASE + 'tpl',BASE + 'childcfg',BASE + 'bindable',BASE + 'depends'],function(r){

  var UIBase = r(BASE + 'base');
    
  BUI.mix(UIBase,{
    Align : r(BASE + 'align'),
    AutoShow : r(BASE + 'autoshow'),
    AutoHide : r(BASE + 'autohide'),
    Close : r(BASE + 'close'),
    Collapseable : r(BASE + 'collapseable'),
    Drag : r(BASE + 'drag'),
    KeyNav : r(BASE + 'keynav'),
    List : r(BASE + 'list'),
    ListItem : r(BASE + 'listitem'),
    Mask : r(BASE + 'mask'),
    Position : r(BASE + 'position'),
    Selection : r(BASE + 'selection'),
    StdMod : r(BASE + 'stdmod'),
    Decorate : r(BASE + 'decorate'),
    Tpl : r(BASE + 'tpl'),
    ChildCfg : r(BASE + 'childcfg'),
    Bindable : r(BASE + 'bindable'),
    Depends : r(BASE + 'depends')
  });

  BUI.mix(UIBase,{
    CloseView : UIBase.Close.View,
    CollapseableView : UIBase.Collapseable.View,
    ChildList : UIBase.List.ChildList,
    /*DomList : UIBase.List.DomList,
    DomListView : UIBase.List.DomList.View,*/
    ListItemView : UIBase.ListItem.View,
    MaskView : UIBase.Mask.View,
    PositionView : UIBase.Position.View,
    StdModView : UIBase.StdMod.View,
    TplView : UIBase.Tpl.View
  });
  return UIBase;
});   
})();
/**
 * @fileOverview  UI\u63a7\u4ef6\u7684\u6d41\u7a0b\u63a7\u5236
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */
define('bui/component/uibase/base',['bui/component/manage'],function(require){

  var Manager = require('bui/component/manage'),
   
    UI_SET = '_uiSet',
        ATTRS = 'ATTRS',
        ucfirst = BUI.ucfirst,
        noop = $.noop,
        Base = require('bui/base');
   /**
     * \u6a21\u62df\u591a\u7ee7\u627f
     * init attr using constructors ATTRS meta info
     * @ignore
     */
    function initHierarchy(host, config) {
        callMethodByHierarchy(host, 'initializer', 'constructor');
    }

    function callMethodByHierarchy(host, mainMethod, extMethod) {
        var c = host.constructor,
            extChains = [],
            ext,
            main,
            exts,
            t;

        // define
        while (c) {

            // \u6536\u96c6\u6269\u5c55\u7c7b
            t = [];
            if (exts = c.mixins) {
                for (var i = 0; i < exts.length; i++) {
                    ext = exts[i];
                    if (ext) {
                        if (extMethod != 'constructor') {
                            //\u53ea\u8c03\u7528\u771f\u6b63\u81ea\u5df1\u6784\u9020\u5668\u539f\u578b\u7684\u5b9a\u4e49\uff0c\u7ee7\u627f\u539f\u578b\u94fe\u4e0a\u7684\u4e0d\u8981\u7ba1
                            if (ext.prototype.hasOwnProperty(extMethod)) {
                                ext = ext.prototype[extMethod];
                            } else {
                                ext = null;
                            }
                        }
                        ext && t.push(ext);
                    }
                }
            }

            // \u6536\u96c6\u4e3b\u7c7b
            // \u53ea\u8c03\u7528\u771f\u6b63\u81ea\u5df1\u6784\u9020\u5668\u539f\u578b\u7684\u5b9a\u4e49\uff0c\u7ee7\u627f\u539f\u578b\u94fe\u4e0a\u7684\u4e0d\u8981\u7ba1 !important
            // \u6240\u4ee5\u4e0d\u7528\u81ea\u5df1\u5728 renderUI \u4e2d\u8c03\u7528 superclass.renderUI \u4e86\uff0cUIBase \u6784\u9020\u5668\u81ea\u52a8\u641c\u5bfb
            // \u4ee5\u53ca initializer \u7b49\u540c\u7406
            if (c.prototype.hasOwnProperty(mainMethod) && (main = c.prototype[mainMethod])) {
                t.push(main);
            }

            // \u539f\u5730 reverse
            if (t.length) {
                extChains.push.apply(extChains, t.reverse());
            }

            c = c.superclass && c.superclass.constructor;
        }

        // \u521d\u59cb\u5316\u51fd\u6570
        // \u987a\u5e8f\uff1a\u7236\u7c7b\u7684\u6240\u6709\u6269\u5c55\u7c7b\u51fd\u6570 -> \u7236\u7c7b\u5bf9\u5e94\u51fd\u6570 -> \u5b50\u7c7b\u7684\u6240\u6709\u6269\u5c55\u51fd\u6570 -> \u5b50\u7c7b\u5bf9\u5e94\u51fd\u6570
        for (i = extChains.length - 1; i >= 0; i--) {
            extChains[i] && extChains[i].call(host);
        }
    }

     /**
     * \u9500\u6bc1\u7ec4\u4ef6\u987a\u5e8f\uff1a \u5b50\u7c7b destructor -> \u5b50\u7c7b\u6269\u5c55 destructor -> \u7236\u7c7b destructor -> \u7236\u7c7b\u6269\u5c55 destructor
     * @ignore
     */
    function destroyHierarchy(host) {
        var c = host.constructor,
            extensions,
            d,
            i;

        while (c) {
            // \u53ea\u89e6\u53d1\u8be5\u7c7b\u771f\u6b63\u7684\u6790\u6784\u5668\uff0c\u548c\u7236\u4eb2\u6ca1\u5173\u7cfb\uff0c\u6240\u4ee5\u4e0d\u8981\u5728\u5b50\u7c7b\u6790\u6784\u5668\u4e2d\u8c03\u7528 superclass
            if (c.prototype.hasOwnProperty('destructor')) {
                c.prototype.destructor.apply(host);
            }

            if ((extensions = c.mixins)) {
                for (i = extensions.length - 1; i >= 0; i--) {
                    d = extensions[i] && extensions[i].prototype.__destructor;
                    d && d.apply(host);
                }
            }

            c = c.superclass && c.superclass.constructor;
        }
    }

    /**
     * \u6784\u5efa \u63d2\u4ef6
     * @ignore
     */
    function constructPlugins(plugins) {
        if(!plugins){
        return;
        }
        BUI.each(plugins, function (plugin,i) {
            if (BUI.isFunction(plugin)) {
                plugins[i] = new plugin();
            }
        });
    }

    /**
     * \u8c03\u7528\u63d2\u4ef6\u7684\u65b9\u6cd5
     * @ignore
     */
    function actionPlugins(self, plugins, action) {
        if(!plugins){
        return;
        }
        BUI.each(plugins, function (plugin,i) {
            if (plugin[action]) {
                plugin[action](self);
            }
        });
    }

     /**
     * \u6839\u636e\u5c5e\u6027\u53d8\u5316\u8bbe\u7f6e UI
     * @ignore
     */
    function bindUI(self) {
        var attrs = self.getAttrs(),
            attr,
            m;

        for (attr in attrs) {
            if (attrs.hasOwnProperty(attr)) {
                m = UI_SET + ucfirst(attr);
                if (self[m]) {
                    // \u81ea\u52a8\u7ed1\u5b9a\u4e8b\u4ef6\u5230\u5bf9\u5e94\u51fd\u6570
                    (function (attr, m) {
                        self.on('after' + ucfirst(attr) + 'Change', function (ev) {
                            // fix! \u9632\u6b62\u5192\u6ce1\u8fc7\u6765\u7684
                            if (ev.target === self) {
                                self[m](ev.newVal, ev);
                            }
                        });
                    })(attr, m);
                }
            }
        }
    }

        /**
     * \u6839\u636e\u5f53\u524d\uff08\u521d\u59cb\u5316\uff09\u72b6\u6001\u6765\u8bbe\u7f6e UI
     * @ignore
     */
    function syncUI(self) {
        var v,
            f,
            attrs = self.getAttrs();
        for (var a in attrs) {
            if (attrs.hasOwnProperty(a)) {
                var m = UI_SET + ucfirst(a);
                //\u5b58\u5728\u65b9\u6cd5\uff0c\u5e76\u4e14\u7528\u6237\u8bbe\u7f6e\u4e86\u521d\u59cb\u503c\u6216\u8005\u5b58\u5728\u9ed8\u8ba4\u503c\uff0c\u5c31\u540c\u6b65\u72b6\u6001
                if ((f = self[m])
                    // \u7528\u6237\u5982\u679c\u8bbe\u7f6e\u4e86\u663e\u5f0f\u4e0d\u540c\u6b65\uff0c\u5c31\u4e0d\u540c\u6b65\uff0c\u6bd4\u5982\u4e00\u4e9b\u503c\u4ece html \u4e2d\u8bfb\u53d6\uff0c\u4e0d\u9700\u8981\u540c\u6b65\u518d\u6b21\u8bbe\u7f6e
                    && attrs[a].sync !== false
                    && (v = self.get(a)) !== undefined) {
                    f.call(self, v);
                }
            }
        }
    }

  /**
   * \u63a7\u4ef6\u5e93\u7684\u57fa\u7c7b\uff0c\u5305\u62ec\u63a7\u4ef6\u7684\u751f\u547d\u5468\u671f,\u4e0b\u9762\u662f\u57fa\u672c\u7684\u6269\u5c55\u7c7b
   * <p>
   * <img src="../assets/img/class-mixins.jpg"/>
   * </p>
   * @class BUI.Component.UIBase
   * @extends BUI.Base
   * @param  {Object} config \u914d\u7f6e\u9879
   */
  var UIBase = function(config){

     var _self = this, 
      id;

        // \u8bfb\u53d6\u7528\u6237\u8bbe\u7f6e\u7684\u5c5e\u6027\u503c\u5e76\u8bbe\u7f6e\u5230\u81ea\u8eab
        Base.apply(_self, arguments);

        //\u4fdd\u5b58\u7528\u6237\u4f20\u5165\u7684\u914d\u7f6e\u9879
        _self.setInternal('userConfig',config);
        // \u6309\u7167\u7c7b\u5c42\u6b21\u6267\u884c\u521d\u59cb\u51fd\u6570\uff0c\u4e3b\u7c7b\u6267\u884c initializer \u51fd\u6570\uff0c\u6269\u5c55\u7c7b\u6267\u884c\u6784\u9020\u5668\u51fd\u6570
        initHierarchy(_self, config);

        var listener,
            n,
            plugins = _self.get('plugins'),
            listeners = _self.get('listeners');

        constructPlugins(plugins);
    
        var xclass= _self.get('xclass');
        if(xclass){
          _self.__xclass = xclass;//debug \u65b9\u4fbf
        }
        actionPlugins(_self, plugins, 'initializer');

        // \u662f\u5426\u81ea\u52a8\u6e32\u67d3
        config && config.autoRender && _self.render();

  };

  UIBase.ATTRS = 
  {
    
    
    /**
     * \u7528\u6237\u4f20\u5165\u7684\u914d\u7f6e\u9879
     * @type {Object}
     * @readOnly
     * @protected
     */
    userConfig : {

    },
    /**
     * \u662f\u5426\u81ea\u52a8\u6e32\u67d3,\u5982\u679c\u4e0d\u81ea\u52a8\u6e32\u67d3\uff0c\u9700\u8981\u7528\u6237\u8c03\u7528 render()\u65b9\u6cd5
     * <pre><code>
     *  //\u9ed8\u8ba4\u72b6\u6001\u4e0b\u521b\u5efa\u5bf9\u8c61\uff0c\u5e76\u6ca1\u6709\u8fdb\u884crender
     *  var control = new Control();
     *  control.render(); //\u9700\u8981\u8c03\u7528render\u65b9\u6cd5
     *
     *  //\u8bbe\u7f6eautoRender\u540e\uff0c\u4e0d\u9700\u8981\u8c03\u7528render\u65b9\u6cd5
     *  var control = new Control({
     *   autoRender : true
     *  });
     * </code></pre>
     * @cfg {Boolean} autoRender
     */
    /**
     * \u662f\u5426\u81ea\u52a8\u6e32\u67d3,\u5982\u679c\u4e0d\u81ea\u52a8\u6e32\u67d3\uff0c\u9700\u8981\u7528\u6237\u8c03\u7528 render()\u65b9\u6cd5
     * @type {Boolean}
     * @ignore
     */
    autoRender : {
      value : false
    },
    /**
     * @type {Object}
     * \u4e8b\u4ef6\u5904\u7406\u51fd\u6570:
     *      {
     *        'click':function(e){}
     *      }
     *  @ignore
     */
    listeners: {
        value: {}
    },
    /**
     * \u63d2\u4ef6\u96c6\u5408
     * <pre><code>
     *  var grid = new Grid({
     *    columns : [{},{}],
     *    plugins : [Grid.Plugins.RadioSelection]
     *  });
     * </code></pre>
     * @cfg {Array} plugins
     */
    /**
     * \u63d2\u4ef6\u96c6\u5408
     * @type {Array}
     * @readOnly
     */
    plugins : {
      value : []
    },
    /**
     * \u662f\u5426\u5df2\u7ecf\u6e32\u67d3\u5b8c\u6210
     * @type {Boolean}
     * @default  false
     * @readOnly
     */
    rendered : {
        value : false
    },
    /**
    * \u83b7\u53d6\u63a7\u4ef6\u7684 xclass
    * @readOnly
    * @type {String}
    * @protected
    */
    xclass: {
        valueFn: function () {
            return Manager.getXClassByConstructor(this.constructor);
        }
    }
  };
  
  BUI.extend(UIBase,Base);

  BUI.augment(UIBase,
  {
    /**
     * \u521b\u5efaDOM\u7ed3\u6784
     * @protected
     */
    create : function(){
      var self = this;
            // \u662f\u5426\u751f\u6210\u8fc7\u8282\u70b9
            if (!self.get('created')) {
                /**
                 * @event beforeCreateDom
                 * fired before root node is created
                 * @param e
                 */
                self.fire('beforeCreateDom');
                callMethodByHierarchy(self, 'createDom', '__createDom');
                self._set('created', true);
                /**
                 * @event afterCreateDom
                 * fired when root node is created
                 * @param e
                 */
                self.fire('afterCreateDom');
                actionPlugins(self, self.get('plugins'), 'createDom');
            }
            return self;
    },
    /**
     * \u6e32\u67d3
     */
    render : function(){
      var _self = this;
            // \u662f\u5426\u5df2\u7ecf\u6e32\u67d3\u8fc7
            if (!_self.get('rendered')) {
                var plugins = _self.get('plugins');
                _self.create(undefined);

                /**
                 * @event beforeRenderUI
                 * fired when root node is ready
                 * @param e
                 */
                _self.fire('beforeRenderUI');
                callMethodByHierarchy(_self, 'renderUI', '__renderUI');

                /**
                 * @event afterRenderUI
                 * fired after root node is rendered into dom
                 * @param e
                 */

                _self.fire('afterRenderUI');
                actionPlugins(_self, plugins, 'renderUI');

                /**
                 * @event beforeBindUI
                 * fired before UIBase 's internal event is bind.
                 * @param e
                 */

                _self.fire('beforeBindUI');
                bindUI(_self);
                callMethodByHierarchy(_self, 'bindUI', '__bindUI');

                /**
                 * @event afterBindUI
                 * fired when UIBase 's internal event is bind.
                 * @param e
                 */

                _self.fire('afterBindUI');
                actionPlugins(_self, plugins, 'bindUI');

                /**
                 * @event beforeSyncUI
                 * fired before UIBase 's internal state is synchronized.
                 * @param e
                 */

                _self.fire('beforeSyncUI');

                syncUI(_self);
                callMethodByHierarchy(_self, 'syncUI', '__syncUI');

                /**
                 * @event afterSyncUI
                 * fired after UIBase 's internal state is synchronized.
                 * @param e
                 */

                _self.fire('afterSyncUI');
                actionPlugins(_self, plugins, 'syncUI');
                _self._set('rendered', true);
            }
            return _self;
    },
    /**
     * \u5b50\u7c7b\u53ef\u7ee7\u627f\u6b64\u65b9\u6cd5\uff0c\u5f53DOM\u521b\u5efa\u65f6\u8c03\u7528
     * @protected
     * @method
     */
    createDom : noop,
    /**
     * \u5b50\u7c7b\u53ef\u7ee7\u627f\u6b64\u65b9\u6cd5\uff0c\u6e32\u67d3UI\u65f6\u8c03\u7528
     * @protected
     *  @method
     */
    renderUI : noop,
    /**
     * \u5b50\u7c7b\u53ef\u7ee7\u627f\u6b64\u65b9\u6cd5,\u7ed1\u5b9a\u4e8b\u4ef6\u65f6\u8c03\u7528
     * @protected
     * @method
     */
    bindUI : noop,
    /**
     * \u540c\u6b65\u5c5e\u6027\u503c\u5230UI\u4e0a
     * @protected
     * @method
     */
    syncUI : noop,

    /**
     * \u6790\u6784\u51fd\u6570
     */
    destroy: function () {
        var _self = this;

        actionPlugins(_self, _self.get('plugins'), 'destructor');
        destroyHierarchy(_self);
        _self.fire('destroy');
        _self.off();
        _self.clearAttrVals();
        _self.destroyed = true;
        return _self;
    } 
  });
  
  BUI.mix(UIBase,
    {
    /**
     * \u5b9a\u4e49\u4e00\u4e2a\u7c7b
     * @static
     * @param  {Function} base   \u57fa\u7c7b\u6784\u9020\u51fd\u6570
     * @param  {Array} extensions \u6269\u5c55
     * @param  {Object} px  \u539f\u578b\u94fe\u4e0a\u7684\u6269\u5c55
     * @param  {Object} sx  
     * @return {Function} \u7ee7\u627f\u4e0e\u57fa\u7c7b\u7684\u6784\u9020\u51fd\u6570
     */
    define : function(base, extensions, px, sx){
          if ($.isPlainObject(extensions)) {
              sx = px;
              px = extensions;
              extensions = [];
          }

          function C() {
              UIBase.apply(this, arguments);
          }

          BUI.extend(C, base, px, sx);
          BUI.mixin(C,extensions);
         
          return C;
    },
    /**
     * \u6269\u5c55\u4e00\u4e2a\u7c7b\uff0c\u57fa\u7c7b\u5c31\u662f\u7c7b\u672c\u8eab
     * @static
     * @param  {Array} extensions \u6269\u5c55
     * @param  {Object} px  \u539f\u578b\u94fe\u4e0a\u7684\u6269\u5c55
     * @param  {Object} sx  
     * @return {Function} \u7ee7\u627f\u4e0e\u57fa\u7c7b\u7684\u6784\u9020\u51fd\u6570
     */
    extend: function extend(extensions, px, sx) {
        var args = $.makeArray(arguments),
            ret,
            last = args[args.length - 1];
        args.unshift(this);
        if (last.xclass) {
            args.pop();
            args.push(last.xclass);
        }
        ret = UIBase.define.apply(UIBase, args);
        if (last.xclass) {
            var priority = last.priority || (this.priority ? (this.priority + 1) : 1);

            Manager.setConstructorByXClass(last.xclass, {
                constructor: ret,
                priority: priority
            });
            //\u65b9\u4fbf\u8c03\u8bd5
            ret.__xclass = last.xclass;
            ret.priority = priority;
            ret.toString = function(){
                return last.xclass;
            }
        }
        ret.extend = extend;
        return ret;
    }
  });

  return UIBase;
});
/**
 * @fileOverview \u8ddf\u6307\u5b9a\u7684\u5143\u7d20\u9879\u5bf9\u9f50\u7684\u65b9\u5f0f
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */


define('bui/component/uibase/align',['bui/ua'],function (require) {
    var UA = require('bui/ua'),
        CLS_ALIGN_PREFIX ='x-align-',
        win = window;

    // var ieMode = document.documentMode || UA.ie;

    /*
     inspired by closure library by Google
     see http://yiminghe.iteye.com/blog/1124720
     */

    /**
     * \u5f97\u5230\u4f1a\u5bfc\u81f4\u5143\u7d20\u663e\u793a\u4e0d\u5168\u7684\u7956\u5148\u5143\u7d20
     * @ignore
     */
    function getOffsetParent(element) {
        // ie \u8fd9\u4e2a\u4e5f\u4e0d\u662f\u5b8c\u5168\u53ef\u884c
        /**
         <div style="width: 50px;height: 100px;overflow: hidden">
         <div style="width: 50px;height: 100px;position: relative;" id="d6">
         \u5143\u7d20 6 \u9ad8 100px \u5bbd 50px<br/>
         </div>
         </div>
         @ignore
         **/
        // element.offsetParent does the right thing in ie7 and below. Return parent with layout!
        //  In other browsers it only includes elements with position absolute, relative or
        // fixed, not elements with overflow set to auto or scroll.
        //        if (UA.ie && ieMode < 8) {
        //            return element.offsetParent;
        //        }
                // \u7edf\u4e00\u7684 offsetParent \u65b9\u6cd5
        var doc = element.ownerDocument,
            body = doc.body,
            parent,
            positionStyle = $(element).css('position'),
            skipStatic = positionStyle == 'fixed' || positionStyle == 'absolute';

        if (!skipStatic) {
            return element.nodeName.toLowerCase() == 'html' ? null : element.parentNode;
        }

        for (parent = element.parentNode; parent && parent != body; parent = parent.parentNode) {
            positionStyle = $(parent).css('position');
            if (positionStyle != 'static') {
                return parent;
            }
        }
        return null;
    }

    /**
     * \u83b7\u5f97\u5143\u7d20\u7684\u663e\u793a\u90e8\u5206\u7684\u533a\u57df
     * @private
     * @ignore
     */
    function getVisibleRectForElement(element) {
        var visibleRect = {
                left:0,
                right:Infinity,
                top:0,
                bottom:Infinity
            },
            el,
            scrollX,
            scrollY,
            winSize,
            doc = element.ownerDocument,
            body = doc.body,
            documentElement = doc.documentElement;

        // Determine the size of the visible rect by climbing the dom accounting for
        // all scrollable containers.
        for (el = element; el = getOffsetParent(el);) {
            // clientWidth is zero for inline block elements in ie.
            if ((!UA.ie || el.clientWidth != 0) &&
                // body may have overflow set on it, yet we still get the entire
                // viewport. In some browsers, el.offsetParent may be
                // document.documentElement, so check for that too.
                (el != body && el != documentElement && $(el).css('overflow') != 'visible')) {
                var pos = $(el).offset();
                // add border
                pos.left += el.clientLeft;
                pos.top += el.clientTop;

                visibleRect.top = Math.max(visibleRect.top, pos.top);
                visibleRect.right = Math.min(visibleRect.right,
                    // consider area without scrollBar
                    pos.left + el.clientWidth);
                visibleRect.bottom = Math.min(visibleRect.bottom,
                    pos.top + el.clientHeight);
                visibleRect.left = Math.max(visibleRect.left, pos.left);
            }
        }

        // Clip by window's viewport.
        scrollX = $(win).scrollLeft();
        scrollY = $(win).scrollTop();
        visibleRect.left = Math.max(visibleRect.left, scrollX);
        visibleRect.top = Math.max(visibleRect.top, scrollY);
        winSize = {
            width:BUI.viewportWidth(),
            height:BUI.viewportHeight()
        };
        visibleRect.right = Math.min(visibleRect.right, scrollX + winSize.width);
        visibleRect.bottom = Math.min(visibleRect.bottom, scrollY + winSize.height);
        return visibleRect.top >= 0 && visibleRect.left >= 0 &&
            visibleRect.bottom > visibleRect.top &&
            visibleRect.right > visibleRect.left ?
            visibleRect : null;
    }

    function getElFuturePos(elRegion, refNodeRegion, points, offset) {
        var xy,
            diff,
            p1,
            p2;

        xy = {
            left:elRegion.left,
            top:elRegion.top
        };

        p1 = getAlignOffset(refNodeRegion, points[0]);
        p2 = getAlignOffset(elRegion, points[1]);

        diff = [p2.left - p1.left, p2.top - p1.top];

        return {
            left:xy.left - diff[0] + (+offset[0]),
            top:xy.top - diff[1] + (+offset[1])
        };
    }

    function isFailX(elFuturePos, elRegion, visibleRect) {
        return elFuturePos.left < visibleRect.left ||
            elFuturePos.left + elRegion.width > visibleRect.right;
    }

    function isFailY(elFuturePos, elRegion, visibleRect) {
        return elFuturePos.top < visibleRect.top ||
            elFuturePos.top + elRegion.height > visibleRect.bottom;
    }

    function adjustForViewport(elFuturePos, elRegion, visibleRect, overflow) {
        var pos = BUI.cloneObject(elFuturePos),
            size = {
                width:elRegion.width,
                height:elRegion.height
            };

        if (overflow.adjustX && pos.left < visibleRect.left) {
            pos.left = visibleRect.left;
        }

        // Left edge inside and right edge outside viewport, try to resize it.
        if (overflow['resizeWidth'] &&
            pos.left >= visibleRect.left &&
            pos.left + size.width > visibleRect.right) {
            size.width -= (pos.left + size.width) - visibleRect.right;
        }

        // Right edge outside viewport, try to move it.
        if (overflow.adjustX && pos.left + size.width > visibleRect.right) {
            // \u4fdd\u8bc1\u5de6\u8fb9\u754c\u548c\u53ef\u89c6\u533a\u57df\u5de6\u8fb9\u754c\u5bf9\u9f50
            pos.left = Math.max(visibleRect.right - size.width, visibleRect.left);
        }

        // Top edge outside viewport, try to move it.
        if (overflow.adjustY && pos.top < visibleRect.top) {
            pos.top = visibleRect.top;
        }

        // Top edge inside and bottom edge outside viewport, try to resize it.
        if (overflow['resizeHeight'] &&
            pos.top >= visibleRect.top &&
            pos.top + size.height > visibleRect.bottom) {
            size.height -= (pos.top + size.height) - visibleRect.bottom;
        }

        // Bottom edge outside viewport, try to move it.
        if (overflow.adjustY && pos.top + size.height > visibleRect.bottom) {
            // \u4fdd\u8bc1\u4e0a\u8fb9\u754c\u548c\u53ef\u89c6\u533a\u57df\u4e0a\u8fb9\u754c\u5bf9\u9f50
            pos.top = Math.max(visibleRect.bottom - size.height, visibleRect.top);
        }

        return BUI.mix(pos, size);
    }


    function flip(points, reg, map) {
        var ret = [];
        $.each(points, function (index,p) {
            ret.push(p.replace(reg, function (m) {
                return map[m];
            }));
        });
        return ret;
    }

    function flipOffset(offset, index) {
        offset[index] = -offset[index];
        return offset;
    }


    /**
     * @class BUI.Component.UIBase.Align
     * Align extension class.
     * Align component with specified element.
     * <img src="http://images.cnitblog.com/blog/111279/201304/09180221-201343d4265c46e7987e6b1c46d5461a.jpg"/>
     */
    function Align() {
    }


    Align.__getOffsetParent = getOffsetParent;

    Align.__getVisibleRectForElement = getVisibleRectForElement;

    Align.ATTRS =
    {
        /**
         * \u5bf9\u9f50\u914d\u7f6e\uff0c\u8be6\u7ec6\u8bf4\u660e\u8bf7\u53c2\u770b\uff1a <a href="http://www.cnblogs.com/zaohe/archive/2013/04/09/3010651.html">JS\u63a7\u4ef6 \u5bf9\u9f50</a>
         * @cfg {Object} align
         * <pre><code>
         *  var overlay = new Overlay( {  
         *       align :{
         *         node: null,         // \u53c2\u8003\u5143\u7d20, falsy \u6216 window \u4e3a\u53ef\u89c6\u533a\u57df, 'trigger' \u4e3a\u89e6\u53d1\u5143\u7d20, \u5176\u4ed6\u4e3a\u6307\u5b9a\u5143\u7d20
         *         points: ['cc','cc'], // ['tr', 'tl'] \u8868\u793a overlay \u7684 tl \u4e0e\u53c2\u8003\u8282\u70b9\u7684 tr \u5bf9\u9f50
         *         offset: [0, 0]      // \u6709\u6548\u503c\u4e3a [n, m]
         *       }
         *     }); 
         * </code></pre>
         */

        /**
         * \u8bbe\u7f6e\u5bf9\u9f50\u5c5e\u6027
         * @type {Object}
         * @field
         * <code>
         *   var align =  {
         *        node: null,         // \u53c2\u8003\u5143\u7d20, falsy \u6216 window \u4e3a\u53ef\u89c6\u533a\u57df, 'trigger' \u4e3a\u89e6\u53d1\u5143\u7d20, \u5176\u4ed6\u4e3a\u6307\u5b9a\u5143\u7d20
         *        points: ['cc','cc'], // ['tr', 'tl'] \u8868\u793a overlay \u7684 tl \u4e0e\u53c2\u8003\u8282\u70b9\u7684 tr \u5bf9\u9f50
         *        offset: [0, 0]      // \u6709\u6548\u503c\u4e3a [n, m]
         *     };
         *   overlay.set('align',align);
         * </code>
         */
        align:{
            value:{}
        }
    };

    function getRegion(node) {
        var offset, w, h;
        if (!$.isWindow(node[0])) {
            offset = node.offset();
            w = node.outerWidth();
            h = node.outerHeight();
        } else {
            offset = { left:BUI.scrollLeft(), top:BUI.scrollTop() };
            w = BUI.viewportWidth();
            h = BUI.viewportHeight();
        }
        offset.width = w;
        offset.height = h;
        return offset;
    }

    /**
     * \u83b7\u53d6 node \u4e0a\u7684 align \u5bf9\u9f50\u70b9 \u76f8\u5bf9\u4e8e\u9875\u9762\u7684\u5750\u6807
     * @param region
     * @param align
     */
    function getAlignOffset(region, align) {
        var V = align.charAt(0),
            H = align.charAt(1),
            w = region.width,
            h = region.height,
            x, y;

        x = region.left;
        y = region.top;

        if (V === 'c') {
            y += h / 2;
        } else if (V === 'b') {
            y += h;
        }

        if (H === 'c') {
            x += w / 2;
        } else if (H === 'r') {
            x += w;
        }

        return { left:x, top:y };
    }

    //\u6e05\u9664\u5bf9\u9f50\u7684css\u6837\u5f0f
    function clearAlignCls(el){
        var cls = el.attr('class'),
            regex = new RegExp('\s?'+CLS_ALIGN_PREFIX+'[a-z]{2}-[a-z]{2}','ig'),
            arr = regex.exec(cls);
        if(arr){
            el.removeClass(arr.join(' '));
        }
    }

    Align.prototype =
    {
        _uiSetAlign:function (v,ev) {
            var alignCls = '',
                el,   
                selfAlign; //points \u7684\u7b2c\u4e8c\u4e2a\u53c2\u6570\uff0c\u662f\u81ea\u5df1\u5bf9\u9f50\u4e8e\u5176\u4ed6\u8282\u70b9\u7684\u7684\u65b9\u5f0f
            if (v && v.points) {
                this.align(v.node, v.points, v.offset, v.overflow);
                this.set('cachePosition',null);
                el = this.get('el');
                clearAlignCls(el);
                selfAlign = v.points.join('-');
                alignCls = CLS_ALIGN_PREFIX + selfAlign;
                el.addClass(alignCls);
                /**/
            }
        },

        /*
         \u5bf9\u9f50 Overlay \u5230 node \u7684 points \u70b9, \u504f\u79fb offset \u5904
         @method
         @ignore
         @param {Element} node \u53c2\u7167\u5143\u7d20, \u53ef\u53d6\u914d\u7f6e\u9009\u9879\u4e2d\u7684\u8bbe\u7f6e, \u4e5f\u53ef\u662f\u4e00\u5143\u7d20
         @param {String[]} points \u5bf9\u9f50\u65b9\u5f0f
         @param {Number[]} [offset] \u504f\u79fb
         */
        align:function (refNode, points, offset, overflow) {
            refNode = $(refNode || win);
            offset = offset && [].concat(offset) || [0, 0];
            overflow = overflow || {};

            var self = this,
                el = self.get('el'),
                fail = 0,
            // \u5f53\u524d\u8282\u70b9\u53ef\u4ee5\u88ab\u653e\u7f6e\u7684\u663e\u793a\u533a\u57df
                visibleRect = getVisibleRectForElement(el[0]),
            // \u5f53\u524d\u8282\u70b9\u6240\u5360\u7684\u533a\u57df, left/top/width/height
                elRegion = getRegion(el),
            // \u53c2\u7167\u8282\u70b9\u6240\u5360\u7684\u533a\u57df, left/top/width/height
                refNodeRegion = getRegion(refNode),
            // \u5f53\u524d\u8282\u70b9\u5c06\u8981\u88ab\u653e\u7f6e\u7684\u4f4d\u7f6e
                elFuturePos = getElFuturePos(elRegion, refNodeRegion, points, offset),
            // \u5f53\u524d\u8282\u70b9\u5c06\u8981\u6240\u5904\u7684\u533a\u57df
                newElRegion = BUI.merge(elRegion, elFuturePos);

            // \u5982\u679c\u53ef\u89c6\u533a\u57df\u4e0d\u80fd\u5b8c\u5168\u653e\u7f6e\u5f53\u524d\u8282\u70b9\u65f6\u5141\u8bb8\u8c03\u6574
            if (visibleRect && (overflow.adjustX || overflow.adjustY)) {

                // \u5982\u679c\u6a2a\u5411\u4e0d\u80fd\u653e\u4e0b
                if (isFailX(elFuturePos, elRegion, visibleRect)) {
                    fail = 1;
                    // \u5bf9\u9f50\u4f4d\u7f6e\u53cd\u4e0b
                    points = flip(points, /[lr]/ig, {
                        l:'r',
                        r:'l'
                    });
                    // \u504f\u79fb\u91cf\u4e5f\u53cd\u4e0b
                    offset = flipOffset(offset, 0);
                }

                // \u5982\u679c\u7eb5\u5411\u4e0d\u80fd\u653e\u4e0b
                if (isFailY(elFuturePos, elRegion, visibleRect)) {
                    fail = 1;
                    // \u5bf9\u9f50\u4f4d\u7f6e\u53cd\u4e0b
                    points = flip(points, /[tb]/ig, {
                        t:'b',
                        b:'t'
                    });
                    // \u504f\u79fb\u91cf\u4e5f\u53cd\u4e0b
                    offset = flipOffset(offset, 1);
                }

                // \u5982\u679c\u5931\u8d25\uff0c\u91cd\u65b0\u8ba1\u7b97\u5f53\u524d\u8282\u70b9\u5c06\u8981\u88ab\u653e\u7f6e\u7684\u4f4d\u7f6e
                if (fail) {
                    elFuturePos = getElFuturePos(elRegion, refNodeRegion, points, offset);
                    BUI.mix(newElRegion, elFuturePos);
                }

                var newOverflowCfg = {};

                // \u68c0\u67e5\u53cd\u4e0b\u540e\u7684\u4f4d\u7f6e\u662f\u5426\u53ef\u4ee5\u653e\u4e0b\u4e86
                // \u5982\u679c\u4ecd\u7136\u653e\u4e0d\u4e0b\u53ea\u6709\u6307\u5b9a\u4e86\u53ef\u4ee5\u8c03\u6574\u5f53\u524d\u65b9\u5411\u624d\u8c03\u6574
                newOverflowCfg.adjustX = overflow.adjustX &&
                    isFailX(elFuturePos, elRegion, visibleRect);

                newOverflowCfg.adjustY = overflow.adjustY &&
                    isFailY(elFuturePos, elRegion, visibleRect);

                // \u786e\u5b9e\u8981\u8c03\u6574\uff0c\u751a\u81f3\u53ef\u80fd\u4f1a\u8c03\u6574\u9ad8\u5ea6\u5bbd\u5ea6
                if (newOverflowCfg.adjustX || newOverflowCfg.adjustY) {
                    newElRegion = adjustForViewport(elFuturePos, elRegion,
                        visibleRect, newOverflowCfg);
                }
            }

            // \u65b0\u533a\u57df\u4f4d\u7f6e\u53d1\u751f\u4e86\u53d8\u5316
            if (newElRegion.left != elRegion.left) {
                self.setInternal('x', null);
                self.get('view').setInternal('x', null);
                self.set('x', newElRegion.left);
            }

            if (newElRegion.top != elRegion.top) {
                // https://github.com/kissyteam/kissy/issues/190
                // \u76f8\u5bf9\u4e8e\u5c4f\u5e55\u4f4d\u7f6e\u6ca1\u53d8\uff0c\u800c left/top \u53d8\u4e86
                // \u4f8b\u5982 <div 'relative'><el absolute></div>
                // el.align(div)
                self.setInternal('y', null);
                self.get('view').setInternal('y', null);
                self.set('y', newElRegion.top);
            }

            // \u65b0\u533a\u57df\u9ad8\u5bbd\u53d1\u751f\u4e86\u53d8\u5316
            if (newElRegion.width != elRegion.width) {
                el.width(el.width() + newElRegion.width - elRegion.width);
            }
            if (newElRegion.height != elRegion.height) {
                el.height(el.height() + newElRegion.height - elRegion.height);
            }

            return self;
        },

        /**
         * \u5bf9\u9f50\u5230\u5143\u7d20\u7684\u4e2d\u95f4\uff0c\u67e5\u770b\u5c5e\u6027 {@link BUI.Component.UIBase.Align#property-align} .
         * <pre><code>
         *  control.center('#t1'); //\u63a7\u4ef6\u5904\u4e8e\u5bb9\u5668#t1\u7684\u4e2d\u95f4\u4f4d\u7f6e
         * </code></pre>
         * @param {undefined|String|HTMLElement|jQuery} node
         * 
         */
        center:function (node) {
            var self = this;
            self.set('align', {
                node:node,
                points:['cc', 'cc'],
                offset:[0, 0]
            });
            return self;
        }
    };
    
  return Align;
});/**
 * @fileOverview click\uff0cfocus,hover\u7b49\u5f15\u8d77\u63a7\u4ef6\u663e\u793a\uff0c\u5e76\u4e14\u5b9a\u4f4d
 * @ignore
 */

define('bui/component/uibase/autoshow',function () {

  /**
   * \u5904\u7406\u81ea\u52a8\u663e\u793a\u63a7\u4ef6\u7684\u6269\u5c55\uff0c\u4e00\u822c\u7528\u4e8e\u663e\u793amenu,picker,tip\u7b49
   * @class BUI.Component.UIBase.AutoShow
   */
  function autoShow() {
    
  }

  autoShow.ATTRS = {

    /**
     * \u89e6\u53d1\u663e\u793a\u63a7\u4ef6\u7684DOM\u9009\u62e9\u5668
     * <pre><code>
     *  var overlay = new Overlay({ //\u70b9\u51fb#t1\u65f6\u663e\u793a\uff0c\u70b9\u51fb#t1,overlay\u4e4b\u5916\u7684\u5143\u7d20\u9690\u85cf
     *    trigger : '#t1',
     *    autoHide : true,
     *    content : '\u60ac\u6d6e\u5185\u5bb9'
     *  });
     *  overlay.render();
     * </code></pre>
     * @cfg {HTMLElement|String|jQuery} trigger
     */
    /**
     * \u89e6\u53d1\u663e\u793a\u63a7\u4ef6\u7684DOM\u9009\u62e9\u5668
     * @type {HTMLElement|String|jQuery}
     */
    trigger : {

    },
    /**
     * \u662f\u5426\u4f7f\u7528\u4ee3\u7406\u7684\u65b9\u5f0f\u89e6\u53d1\u663e\u793a\u63a7\u4ef6,\u5982\u679ctigger\u4e0d\u662f\u5b57\u7b26\u4e32\uff0c\u6b64\u5c5e\u6027\u65e0\u6548
     * <pre><code>
     *  var overlay = new Overlay({ //\u70b9\u51fb.t1(\u65e0\u8bba\u521b\u5efa\u63a7\u4ef6\u65f6.t1\u662f\u5426\u5b58\u5728)\u65f6\u663e\u793a\uff0c\u70b9\u51fb.t1,overlay\u4e4b\u5916\u7684\u5143\u7d20\u9690\u85cf
     *    trigger : '.t1',
     *    autoHide : true,
     *    delegateTigger : true, //\u4f7f\u7528\u59d4\u6258\u7684\u65b9\u5f0f\u89e6\u53d1\u663e\u793a\u63a7\u4ef6
     *    content : '\u60ac\u6d6e\u5185\u5bb9'
     *  });
     *  overlay.render();
     * </code></pre>
     * @cfg {Boolean} [delegateTigger = false]
     */
    /**
     * \u662f\u5426\u4f7f\u7528\u4ee3\u7406\u7684\u65b9\u5f0f\u89e6\u53d1\u663e\u793a\u63a7\u4ef6,\u5982\u679ctigger\u4e0d\u662f\u5b57\u7b26\u4e32\uff0c\u6b64\u5c5e\u6027\u65e0\u6548
     * @type {Boolean}
     * @ignore
     */
    delegateTigger : {
      value : false
    },
    /**
     * \u9009\u62e9\u5668\u662f\u5426\u59cb\u7ec8\u8ddf\u968f\u89e6\u53d1\u5668\u5bf9\u9f50
     * @cfg {Boolean} autoAlign
     * @ignore
     */
    /**
     * \u9009\u62e9\u5668\u662f\u5426\u59cb\u7ec8\u8ddf\u968f\u89e6\u53d1\u5668\u5bf9\u9f50
     * @type {Boolean}
     * @protected
     */
    autoAlign :{
      value : true
    },
    /**
     * \u63a7\u4ef6\u663e\u793a\u65f6\u7531\u6b64trigger\u89e6\u53d1\uff0c\u5f53\u914d\u7f6e\u9879 trigger \u9009\u62e9\u5668\u4ee3\u8868\u591a\u4e2aDOM \u5bf9\u8c61\u65f6\uff0c
     * \u63a7\u4ef6\u53ef\u7531\u591a\u4e2aDOM\u5bf9\u8c61\u89e6\u53d1\u663e\u793a\u3002
     * <pre><code>
     *  overlay.on('show',function(){
     *    var curTrigger = overlay.get('curTrigger');
     *    //TO DO
     *  });
     * </code></pre>
     * @type {jQuery}
     * @readOnly
     */
    curTrigger : {

    },
    /**
     * \u89e6\u53d1\u663e\u793a\u65f6\u7684\u56de\u8c03\u51fd\u6570
     * @cfg {Function} triggerCallback
     * @ignore
     */
    /**
     * \u89e6\u53d1\u663e\u793a\u65f6\u7684\u56de\u8c03\u51fd\u6570
     * @type {Function}
     * @ignore
     */
    triggerCallback : {
      value : function (ev) {
        
      }
    },
    /**
     * \u663e\u793a\u83dc\u5355\u7684\u4e8b\u4ef6
     *  <pre><code>
     *    var overlay = new Overlay({ //\u79fb\u52a8\u5230#t1\u65f6\u663e\u793a\uff0c\u79fb\u52a8\u51fa#t1,overlay\u4e4b\u5916\u63a7\u4ef6\u9690\u85cf
     *      trigger : '#t1',
     *      autoHide : true,
     *      triggerEvent :'mouseover',
     *      autoHideType : 'leave',
     *      content : '\u60ac\u6d6e\u5185\u5bb9'
     *    });
     *    overlay.render();
     * 
     *  </code></pre>
     * @cfg {String} [triggerEvent='click']
     * @default 'click'
     */
    /**
     * \u663e\u793a\u83dc\u5355\u7684\u4e8b\u4ef6
     * @type {String}
     * @default 'click'
     * @ignore
     */
    triggerEvent : {
      value:'click'
    },
    /**
     * \u56e0\u4e3a\u89e6\u53d1\u5143\u7d20\u53d1\u751f\u6539\u53d8\u800c\u5bfc\u81f4\u63a7\u4ef6\u9690\u85cf
     * @cfg {String} triggerHideEvent
     * @ignore
     */
    /**
     * \u56e0\u4e3a\u89e6\u53d1\u5143\u7d20\u53d1\u751f\u6539\u53d8\u800c\u5bfc\u81f4\u63a7\u4ef6\u9690\u85cf
     * @type {String}
     * @ignore
     */
    triggerHideEvent : {

    },
    events : {
      value : {
        /**
         * \u5f53\u89e6\u53d1\u5668\uff08\u89e6\u53d1\u9009\u62e9\u5668\u51fa\u73b0\uff09\u53d1\u751f\u6539\u53d8\u65f6\uff0c\u7ecf\u5e38\u7528\u4e8e\u4e00\u4e2a\u9009\u62e9\u5668\u5bf9\u5e94\u591a\u4e2a\u89e6\u53d1\u5668\u7684\u60c5\u51b5
         * <pre><code>
         *  overlay.on('triggerchange',function(ev){
         *    var curTrigger = ev.curTrigger;
         *    overlay.set('content',curTrigger.html());
         *  });
         * </code></pre>
         * @event
         * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
         * @param {jQuery} e.prevTrigger \u4e4b\u524d\u89e6\u53d1\u5668\uff0c\u53ef\u80fd\u4e3anull
         * @param {jQuery} e.curTrigger \u5f53\u524d\u7684\u89e6\u53d1\u5668
         */
        'triggerchange':false
      }
    }
  };

  autoShow.prototype = {

    __createDom : function () {
      this._setTrigger();
    },
    _setTrigger : function () {
      var _self = this,
        triggerEvent = _self.get('triggerEvent'),
        triggerHideEvent = _self.get('triggerHideEvent'),
        triggerCallback = _self.get('triggerCallback'),
        trigger = _self.get('trigger'),
        isDelegate = _self.get('delegateTigger'),
        triggerEl = $(trigger);

      //\u89e6\u53d1\u663e\u793a
      function tiggerShow (ev) {
        var prevTrigger = _self.get('curTrigger'),
          curTrigger = isDelegate ?$(ev.currentTarget) : $(this),
          align = _self.get('align');
        if(!prevTrigger || prevTrigger[0] != curTrigger[0]){

          _self.set('curTrigger',curTrigger);
          _self.fire('triggerchange',{prevTrigger : prevTrigger,curTrigger : curTrigger});
        }
        if(_self.get('autoAlign')){
          align.node = curTrigger;
          
        }
        _self.set('align',align);
        _self.show();
        triggerCallback && triggerCallback(ev);
      }

      //\u89e6\u53d1\u9690\u85cf
      function tiggerHide (ev){
        var toElement = ev.toElement;
        if(!toElement || !_self.containsElement(toElement)){ //mouseleave\u65f6\uff0c\u5982\u679c\u79fb\u52a8\u5230\u5f53\u524d\u63a7\u4ef6\u4e0a\uff0c\u53d6\u6d88\u6d88\u5931
          _self.hide();
        }
      }

      if(triggerEvent){
        if(isDelegate && BUI.isString(trigger)){
          $(document).delegate(trigger,triggerEvent,tiggerShow);
        }else{
          triggerEl.on(triggerEvent,tiggerShow);
        }
        
      }

      if(triggerHideEvent){
        if(isDelegate && BUI.isString(trigger)){
          $(document).delegate(trigger,triggerHideEvent,tiggerHide);
        }else{
          triggerEl.on(triggerHideEvent,tiggerHide);
        }
      } 
    },
    __renderUI : function () {
      var _self = this,
        align = _self.get('align');
      //\u5982\u679c\u63a7\u4ef6\u663e\u793a\u65f6\u4e0d\u662f\u7531trigger\u89e6\u53d1\uff0c\u5219\u540c\u7236\u5143\u7d20\u5bf9\u9f50
      if(align && !align.node){
        align.node = _self.get('render') || _self.get('trigger');
      }
    }
  };

  return autoShow;
});/**
 * @fileOverview \u70b9\u51fb\u6216\u79fb\u51fa\u63a7\u4ef6\u5916\u90e8\uff0c\u63a7\u4ef6\u9690\u85cf
 * @author dxq613@gmail.com
 * @ignore
 */
define('bui/component/uibase/autohide',function () {

  var wrapBehavior = BUI.wrapBehavior,
      getWrapBehavior = BUI.getWrapBehavior;

  function isExcept(self,elem){
    var hideExceptNode = self.get('hideExceptNode');
    if(hideExceptNode && hideExceptNode.length){
      return $.contains(hideExceptNode[0],elem);
    }
    return false;
  }
  /**
   * \u70b9\u51fb\u9690\u85cf\u63a7\u4ef6\u7684\u6269\u5c55
   * @class BUI.Component.UIBase.AutoHide
   */
  function autoHide() {
  
  }

  autoHide.ATTRS = {

    /**
     * \u63a7\u4ef6\u81ea\u52a8\u9690\u85cf\u7684\u4e8b\u4ef6\uff0c\u8fd9\u91cc\u652f\u63012\u79cd\uff1a
     *  - 'click'
     *  - 'leave'
     *  <pre><code>
     *    var overlay = new Overlay({ //\u70b9\u51fb#t1\u65f6\u663e\u793a\uff0c\u70b9\u51fb#t1\u4e4b\u5916\u7684\u5143\u7d20\u9690\u85cf
     *      trigger : '#t1',
     *      autoHide : true,
     *      content : '\u60ac\u6d6e\u5185\u5bb9'
     *    });
     *    overlay.render();
     *
     *    var overlay = new Overlay({ //\u79fb\u52a8\u5230#t1\u65f6\u663e\u793a\uff0c\u79fb\u52a8\u51fa#t1,overlay\u4e4b\u5916\u63a7\u4ef6\u9690\u85cf
     *      trigger : '#t1',
     *      autoHide : true,
     *      triggerEvent :'mouseover',
     *      autoHideType : 'leave',
     *      content : '\u60ac\u6d6e\u5185\u5bb9'
     *    });
     *    overlay.render();
     * 
     *  </code></pre>
     * @cfg {String} [autoHideType = 'click']
     */
    /**
     * \u63a7\u4ef6\u81ea\u52a8\u9690\u85cf\u7684\u4e8b\u4ef6\uff0c\u8fd9\u91cc\u652f\u63012\u79cd\uff1a
     * 'click',\u548c'leave',\u9ed8\u8ba4\u4e3a'click'
     * @type {String}
     */
    autoHideType : {
      value : 'click'
    },
    /**
     * \u662f\u5426\u81ea\u52a8\u9690\u85cf
     * <pre><code>
     *  
     *  var overlay = new Overlay({ //\u70b9\u51fb#t1\u65f6\u663e\u793a\uff0c\u70b9\u51fb#t1,overlay\u4e4b\u5916\u7684\u5143\u7d20\u9690\u85cf
     *    trigger : '#t1',
     *    autoHide : true,
     *    content : '\u60ac\u6d6e\u5185\u5bb9'
     *  });
     *  overlay.render();
     * </code></pre>
     * @cfg {Object} autoHide
     */
    /**
     * \u662f\u5426\u81ea\u52a8\u9690\u85cf
     * @type {Object}
     * @ignore
     */
    autoHide:{
      value : false
    },
    /**
     * \u70b9\u51fb\u6216\u8005\u79fb\u52a8\u5230\u6b64\u8282\u70b9\u65f6\u4e0d\u89e6\u53d1\u81ea\u52a8\u9690\u85cf
     * <pre><code>
     *  
     *  var overlay = new Overlay({ //\u70b9\u51fb#t1\u65f6\u663e\u793a\uff0c\u70b9\u51fb#t1,#t2,overlay\u4e4b\u5916\u7684\u5143\u7d20\u9690\u85cf
     *    trigger : '#t1',
     *    autoHide : true,
     *    hideExceptNode : '#t2',
     *    content : '\u60ac\u6d6e\u5185\u5bb9'
     *  });
     *  overlay.render();
     * </code></pre>
     * @cfg {Object} hideExceptNode
     */
    hideExceptNode :{

    },
    events : {
      value : {
        /**
         * @event autohide
         * \u70b9\u51fb\u63a7\u4ef6\u5916\u90e8\u65f6\u89e6\u53d1\uff0c\u53ea\u6709\u5728\u63a7\u4ef6\u8bbe\u7f6e\u81ea\u52a8\u9690\u85cf(autoHide = true)\u6709\u6548
         * \u53ef\u4ee5\u963b\u6b62\u63a7\u4ef6\u9690\u85cf\uff0c\u901a\u8fc7\u5728\u4e8b\u4ef6\u76d1\u542c\u51fd\u6570\u4e2d return false
         * <pre><code>
         *  overlay.on('autohide',function(){
         *    var curTrigger = overlay.curTrigger; //\u5f53\u524d\u89e6\u53d1\u7684\u9879
         *    if(condtion){
         *      return false; //\u963b\u6b62\u9690\u85cf
         *    }
         *  });
         * </code></pre>
         */
        autohide : false
      }
    }
  };

  autoHide.prototype = {

    __bindUI : function() {
      var _self = this;

      _self.on('afterVisibleChange',function (ev) {
        var visible = ev.newVal;
        if(_self.get('autoHide')){
          if(visible){
            _self._bindHideEvent();
          }else{
            _self._clearHideEvent();
          }
        }
      });
    },
    /**
     * \u5904\u7406\u9f20\u6807\u79fb\u51fa\u4e8b\u4ef6\uff0c\u4e0d\u5f71\u54cd{BUI.Component.Controller#handleMouseLeave}\u4e8b\u4ef6
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleMoveOuter : function (ev) {
      var _self = this,
        target = ev.toElement;
      if(!_self.containsElement(target) && !isExcept(_self,target)){
        if(_self.fire('autohide') !== false){
          _self.hide();
        }
      }
    },
    /**
     * \u70b9\u51fb\u9875\u9762\u65f6\u7684\u5904\u7406\u51fd\u6570
     * @param {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     * @protected
     */
    handleDocumentClick : function (ev) {
      var _self = this,
        target = ev.target;
      if(!_self.containsElement(target) && !isExcept(_self,target)){
        if(_self.fire('autohide') !== false){
          _self.hide();
        }
      }
    },
    _bindHideEvent : function() {
      var _self = this,
        trigger = _self.get('curTrigger'),
        autoHideType = _self.get('autoHideType');
      if(autoHideType === 'click'){
        $(document).on('mousedown',wrapBehavior(this,'handleDocumentClick'));
      }else{
        _self.get('el').on('mouseleave',wrapBehavior(this,'handleMoveOuter'));
        if(trigger){
          $(trigger).on('mouseleave',wrapBehavior(this,'handleMoveOuter'))
        }
      }

    },
    //\u6e05\u9664\u7ed1\u5b9a\u7684\u9690\u85cf\u4e8b\u4ef6
    _clearHideEvent : function() {
      var _self = this,
        trigger = _self.get('curTrigger'),
        autoHideType = _self.get('autoHideType');
      if(autoHideType === 'click'){
        $(document).off('mousedown',getWrapBehavior(this,'handleDocumentClick'));
      }else{
        _self.get('el').off('mouseleave',wrapBehavior(this,'handleMoveOuter'));
        if(trigger){
          $(trigger).off('mouseleave',wrapBehavior(this,'handleMoveOuter'))
        }
      }
    }
  };

  return autoHide;

});




/**
 * @fileOverview close \u5173\u95ed\u6216\u9690\u85cf\u63a7\u4ef6
 * @author yiminghe@gmail.com
 * copied and modified by dxq613@gmail.com
 * @ignore
 */

define('bui/component/uibase/close',function () {
  
  var CLS_PREFIX = BUI.prefix + 'ext-';

  function getCloseRenderBtn(self) {
      return $(self.get('closeTpl'));
  }

  /**
  * \u5173\u95ed\u6309\u94ae\u7684\u89c6\u56fe\u7c7b
  * @class BUI.Component.UIBase.CloseView
  * @private
  */
  function CloseView() {
  }

  CloseView.ATTRS = {
    closeTpl : {
      value : '<a ' +
            'tabindex="0" ' +
            "href='javascript:void(\"\u5173\u95ed\")' " +
            'role="button" ' +
            'class="' + CLS_PREFIX + 'close' + '">' +
            '<span class="' +
            CLS_PREFIX + 'close-x' +
            '">\u5173\u95ed<' + '/span>' +
            '<' + '/a>'
    },
    closable:{
        value:true
    },
    closeBtn:{
    }
  };

  CloseView.prototype = {
      _uiSetClosable:function (v) {
          var self = this,
              btn = self.get('closeBtn');
          if (v) {
              if (!btn) {
                  self.setInternal('closeBtn', btn = getCloseRenderBtn(self));
              }
              btn.appendTo(self.get('el'), undefined);
          } else {
              if (btn) {
                  btn.remove();
              }
          }
      }
  };

   /**
   * @class BUI.Component.UIBase.Close
   * Close extension class.
   * Represent a close button.
   */
  function Close() {
  }

  var HIDE = 'hide';
  Close.ATTRS =
  {
      /**
      * \u5173\u95ed\u6309\u94ae\u7684\u9ed8\u8ba4\u6a21\u7248
      * <pre><code>
      *   var overlay = new Overlay({
      *     closeTpl : '<a href="#" title="close">x</a>',
      *     closable : true,
      *     trigger : '#t1'
      *   });
      *   overlay.render();
      * </code></pre>
      * @cfg {String} closeTpl
      */
      /**
      * \u5173\u95ed\u6309\u94ae\u7684\u9ed8\u8ba4\u6a21\u7248
      * @type {String}
      * @protected
      */
      closeTpl:{
        view : true
      },
      /**
       * \u662f\u5426\u51fa\u73b0\u5173\u95ed\u6309\u94ae
       * @cfg {Boolean} [closable = false]
       */
      /**
       * \u662f\u5426\u51fa\u73b0\u5173\u95ed\u6309\u94ae
       * @type {Boolean}
       */
      closable:{
          view:1
      },

      /**
       * \u5173\u95ed\u6309\u94ae.
       * @protected
       * @type {jQuery}
       */
      closeBtn:{
          view:1
      },
      /**
       * \u5173\u95ed\u65f6\u9690\u85cf\u8fd8\u662f\u79fb\u9664DOM\u7ed3\u6784<br/>
       * default "hide". \u53ef\u4ee5\u8bbe\u7f6e "destroy" \uff0c\u5f53\u70b9\u51fb\u5173\u95ed\u6309\u94ae\u65f6\u79fb\u9664\uff08destroy)\u63a7\u4ef6
       * @cfg {String} [closeAction = 'hide']
       */
      /**
       * \u5173\u95ed\u65f6\u9690\u85cf\u8fd8\u662f\u79fb\u9664DOM\u7ed3\u6784
       * default "hide".\u53ef\u4ee5\u8bbe\u7f6e "destroy" \uff0c\u5f53\u70b9\u51fb\u5173\u95ed\u6309\u94ae\u65f6\u79fb\u9664\uff08destroy)\u63a7\u4ef6
       * @type {String}
       * @protected
       */
      closeAction:{
        value:HIDE
      }
  };

  var actions = {
      hide:HIDE,
      destroy:'destroy'
  };

  Close.prototype = {
      _uiSetClosable:function (v) {
          var self = this;
          if (v && !self.__bindCloseEvent) {
              self.__bindCloseEvent = 1;
              self.get('closeBtn').on('click', function (ev) {
                  self[actions[self.get('closeAction')] || HIDE]();
                  ev.preventDefault();
              });
          }
      },
      __destructor:function () {
          var btn = this.get('closeBtn');
          btn && btn.detach();
      }
  };

  Close.View = CloseView;

  return Close;
});
/**
 * @fileOverview \u62d6\u62fd
 * @author by dxq613@gmail.com
 * @ignore
 */

define('bui/component/uibase/drag',function(){

   
    var dragBackId = BUI.guid('drag');
    
    /**
     * \u62d6\u62fd\u63a7\u4ef6\u7684\u6269\u5c55
     * <pre><code>
     *  var Control = Overlay.extend([UIBase.Drag],{
     *      
     *  });
     *
     *  var c = new Contol({ //\u62d6\u52a8\u63a7\u4ef6\u65f6\uff0c\u5728#t2\u5185
     *      content : '<div id="header"></div><div></div>',
     *      dragNode : '#header',
     *      constraint : '#t2'
     *  });
     * </code></pre>
     * @class BUI.Component.UIBase.Drag
     */
    var drag = function(){

    };

    drag.ATTRS = 
    {

        /**
         * \u70b9\u51fb\u62d6\u52a8\u7684\u8282\u70b9
         * <pre><code>
         *  var Control = Overlay.extend([UIBase.Drag],{
         *      
         *  });
         *
         *  var c = new Contol({ //\u62d6\u52a8\u63a7\u4ef6\u65f6\uff0c\u5728#t2\u5185
         *      content : '<div id="header"></div><div></div>',
         *      dragNode : '#header',
         *      constraint : '#t2'
         *  });
         * </code></pre>
         * @cfg {jQuery} dragNode
         */
        /**
         * \u70b9\u51fb\u62d6\u52a8\u7684\u8282\u70b9
         * @type {jQuery}
         * @ignore
         */
        dragNode : {

        },
        /**
         * \u662f\u5426\u6b63\u5728\u62d6\u52a8
         * @type {Boolean}
         * @protected
         */
        draging:{
            setter:function (v) {
                if (v === true) {
                    return {};
                }
            },
            value:null
        },
        /**
         * \u62d6\u52a8\u7684\u9650\u5236\u8303\u56f4
         * <pre><code>
         *  var Control = Overlay.extend([UIBase.Drag],{
         *      
         *  });
         *
         *  var c = new Contol({ //\u62d6\u52a8\u63a7\u4ef6\u65f6\uff0c\u5728#t2\u5185
         *      content : '<div id="header"></div><div></div>',
         *      dragNode : '#header',
         *      constraint : '#t2'
         *  });
         * </code></pre>
         * @cfg {jQuery} constraint
         */
        /**
         * \u62d6\u52a8\u7684\u9650\u5236\u8303\u56f4
         * @type {jQuery}
         * @ignore
         */
        constraint : {

        },
        /**
         * @private
         * @type {jQuery}
         */
        dragBackEl : {
            /** @private **/
            getter:function(){
                return $('#'+dragBackId);
            }
        }
    };
    var dragTpl = '<div id="' + dragBackId + '" style="background-color: red; position: fixed; left: 0px; width: 100%; height: 100%; top: 0px; cursor: move; z-index: 999999; display: none; "></div>';
       
    function initBack(){
        var el = $(dragTpl).css('opacity', 0).prependTo('body');
        return el;
    }
    drag.prototype = {
        
        __bindUI : function(){
            var _self = this,
                constraint = _self.get('constraint'),
                dragNode = _self.get('dragNode');
            if(!dragNode){
                return;
            }
            dragNode.on('mousedown',function(e){

                if(e.which == 1){
                    e.preventDefault();
                    _self.set('draging',{
                        elX: _self.get('x'),
                        elY: _self.get('y'),
                        startX : e.pageX,
                        startY : e.pageY
                    });
                    registEvent();
                }
            });
            /**
             * @private
             */
            function mouseMove(e){
                var draging = _self.get('draging');
                if(draging){
                    e.preventDefault();
                    _self._dragMoveTo(e.pageX,e.pageY,draging,constraint);
                }
            }
            /**
             * @private
             */
            function mouseUp(e){
                if(e.which == 1){
                    _self.set('draging',false);
                    var dragBackEl = _self.get('dragBackEl');
                    if(dragBackEl){
                        dragBackEl.hide();
                    }
                    unregistEvent();
                }
            }
            /**
             * @private
             */
            function registEvent(){
                $(document).on('mousemove',mouseMove);
                $(document).on('mouseup',mouseUp);
            }
            /**
             * @private
             */
            function unregistEvent(){
                $(document).off('mousemove',mouseMove);
                $(document).off('mouseup',mouseUp);
            }

        },
        _dragMoveTo : function(x,y,draging,constraint){
            var _self = this,
                dragBackEl = _self.get('dragBackEl'),
                draging = draging || _self.get('draging'),
                offsetX = draging.startX - x,
                offsetY = draging.startY - y;
            if(!dragBackEl.length){
                 dragBackEl = initBack();
            }
            dragBackEl.css({
                cursor: 'move',
                display: 'block'
            });
            _self.set('xy',[_self._getConstrainX(draging.elX - offsetX,constraint),
                            _self._getConstrainY(draging.elY - offsetY,constraint)]);    

        },
        _getConstrainX : function(x,constraint){
            var _self = this,
                width =  _self.get('el').outerWidth(),
                endX = x + width,
                curX = _self.get('x');
            //\u5982\u679c\u5b58\u5728\u7ea6\u675f
            if(constraint){
                var constraintOffset = constraint.offset();
                if(constraintOffset.left >= x){
                    return constraintOffset.left;
                }
                if(constraintOffset.left + constraint.width() < endX){
                    return constraintOffset.left + constraint.width() - width;
                }
                return x;
            }
            //\u5f53\u5de6\u53f3\u9876\u70b9\u90fd\u5728\u89c6\u56fe\u5185\uff0c\u79fb\u52a8\u5230\u6b64\u70b9
            if(BUI.isInHorizontalView(x) && BUI.isInHorizontalView(endX)){
                return x;
            }

            return curX;
        },
        _getConstrainY : function(y,constraint){
             var _self = this,
                height =  _self.get('el').outerHeight(),
                endY = y + height,
                curY = _self.get('y');
            //\u5982\u679c\u5b58\u5728\u7ea6\u675f
            if(constraint){
                var constraintOffset = constraint.offset();
                if(constraintOffset.top > y){
                    return constraintOffset.top;
                }
                if(constraintOffset.top + constraint.height() < endY){
                    return constraintOffset.top + constraint.height() - height;
                }
                return y;
            }
            //\u5f53\u5de6\u53f3\u9876\u70b9\u90fd\u5728\u89c6\u56fe\u5185\uff0c\u79fb\u52a8\u5230\u6b64\u70b9
            if(BUI.isInVerticalView(y) && BUI.isInVerticalView(endY)){
                return y;
            }

            return curY;
        }
    };

    return drag;

});/**
 * @fileOverview \u4f7f\u7528\u952e\u76d8\u5bfc\u822a
 * @ignore
 */

define('bui/component/uibase/keynav',['bui/keycode'],function (require) {

  var KeyCode = require('bui/keycode'),
      wrapBehavior = BUI.wrapBehavior,
      getWrapBehavior = BUI.getWrapBehavior;
  /**
   * \u952e\u76d8\u5bfc\u822a
   * @class BUI.Component.UIBase.KeyNav
   */
  var keyNav = function () {
    
  };

  keyNav.ATTRS = {

    /**
     * \u662f\u5426\u5141\u8bb8\u952e\u76d8\u5bfc\u822a
     * @cfg {Boolean} [allowKeyNav = true]
     */
    allowKeyNav : {
      value : true
    },
    /**
     * \u5bfc\u822a\u4f7f\u7528\u7684\u4e8b\u4ef6
     * @cfg {String} [navEvent = 'keydown']
     */
    navEvent : {
      value : 'keydown'
    },
    /**
     * \u5f53\u83b7\u53d6\u4e8b\u4ef6\u7684DOM\u662f input,textarea,select\u7b49\u65f6\uff0c\u4e0d\u5904\u7406\u952e\u76d8\u5bfc\u822a
     * @cfg {Object} [ignoreInputFields='true']
     */
    ignoreInputFields : {
      value : true
    }

  };

  keyNav.prototype = {

    __bindUI : function () {
      
    },
    _uiSetAllowKeyNav : function(v){
      var _self = this,
        eventName = _self.get('navEvent'),
        el = _self.get('el');
      if(v){
        el.on(eventName,wrapBehavior(_self,'_handleKeyDown'));
      }else{
        el.off(eventName,getWrapBehavior(_self,'_handleKeyDown'));
      }
    },
    /**
     * \u5904\u7406\u952e\u76d8\u5bfc\u822a
     * @private
     */
    _handleKeyDown : function(ev){
      var _self = this,
        code = ev.which;
      switch(code){
        case KeyCode.UP :
          _self.handleNavUp(ev);
          break;
        case KeyCode.DOWN : 
          _self.handleNavDown(ev);
          break;
        case KeyCode.RIGHT : 
          _self.handleNavRight(ev);
          break;
        case KeyCode.LEFT : 
          _self.handleNavLeft(ev);
          break;
        case KeyCode.ENTER : 
          _self.handleNavEnter(ev);
          break;
        case KeyCode.ESC : 
          _self.handleNavEsc(ev);
          break;
        case KeyCode.TAB :
          _self.handleNavTab(ev);
          break;
        default:
          break;
      }
    },
    /**
     * \u5904\u7406\u5411\u4e0a\u5bfc\u822a
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavUp : function (ev) {
      // body...
    },
    /**
     * \u5904\u7406\u5411\u4e0b\u5bfc\u822a
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavDown : function (ev) {
      // body...
    },
    /**
     * \u5904\u7406\u5411\u5de6\u5bfc\u822a
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavLeft : function (ev) {
      // body...
    },
    /**
     * \u5904\u7406\u5411\u53f3\u5bfc\u822a
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavRight : function (ev) {
      // body...
    },
    /**
     * \u5904\u7406\u786e\u8ba4\u952e
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavEnter : function (ev) {
      // body...
    },
    /**
     * \u5904\u7406 esc \u952e
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavEsc : function (ev) {
      // body...
    },
    /**
     * \u5904\u7406Tab\u952e
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavTab : function(ev){

    }

  };

  return keyNav;
});
/**
 * @fileOverview mask \u906e\u7f69\u5c42
 * @author yiminghe@gmail.com
 * copied and modified by dxq613@gmail.com
 * @ignore
 */

define('bui/component/uibase/mask',function (require) {

    var UA = require('bui/ua'),
        
        /**
         * \u6bcf\u7ec4\u76f8\u540c prefixCls \u7684 position \u5171\u4eab\u4e00\u4e2a\u906e\u7f69
         * @ignore
         */
        maskMap = {
            /**
             * @ignore
             * {
             *  node:
             *  num:
             * }
             */

    },
        ie6 = UA.ie == 6;

    function getMaskCls(self) {
        return self.get('prefixCls') + 'ext-mask';
    }

    function docWidth() {
        return  ie6 ? BUI.docWidth() + 'px' : '100%';
    }

    function docHeight() {
        return ie6 ? BUI.docHeight() + 'px' : '100%';
    }

    function initMask(maskCls) {
        var mask = $('<div ' +
            ' style="width:' + docWidth() + ';' +
            'left:0;' +
            'top:0;' +
            'height:' + docHeight() + ';' +
            'position:' + (ie6 ? 'absolute' : 'fixed') + ';"' +
            ' class="' +
            maskCls +
            '">' +
            (ie6 ? '<' + 'iframe ' +
                'style="position:absolute;' +
                'left:' + '0' + ';' +
                'top:' + '0' + ';' +
                'background:white;' +
                'width: expression(this.parentNode.offsetWidth);' +
                'height: expression(this.parentNode.offsetHeight);' +
                'filter:alpha(opacity=0);' +
                'z-index:-1;"></iframe>' : '') +
            '</div>')
            .prependTo('body');
        /**
         * \u70b9 mask \u7126\u70b9\u4e0d\u8f6c\u79fb
         * @ignore
         */
       // mask.unselectable();
        mask.on('mousedown', function (e) {
            e.preventDefault();
        });
        return mask;
    }

    /**
    * \u906e\u7f69\u5c42\u7684\u89c6\u56fe\u7c7b
    * @class BUI.Component.UIBase.MaskView
    * @private
    */
    function MaskView() {
    }

    MaskView.ATTRS = {
        maskShared:{
            value:true
        }
    };

    MaskView.prototype = {

        _maskExtShow:function () {
            var self = this,
                zIndex,
                maskCls = getMaskCls(self),
                maskDesc = maskMap[maskCls],
                maskShared = self.get('maskShared'),
                mask = self.get('maskNode');
            if (!mask) {
                if (maskShared) {
                    if (maskDesc) {
                        mask = maskDesc.node;
                    } else {
                        mask = initMask(maskCls);
                        maskDesc = maskMap[maskCls] = {
                            num:0,
                            node:mask
                        };
                    }
                } else {
                    mask = initMask(maskCls);
                }
                self.setInternal('maskNode', mask);
            }
            if (zIndex = self.get('zIndex')) {
                mask.css('z-index', zIndex - 1);
            }
            if (maskShared) {
                maskDesc.num++;
            }
            if (!maskShared || maskDesc.num == 1) {
                mask.show();
            }
        },

        _maskExtHide:function () {
            var self = this,
                maskCls = getMaskCls(self),
                maskDesc = maskMap[maskCls],
                maskShared = self.get('maskShared'),
                mask = self.get('maskNode');
            if (maskShared && maskDesc) {
                maskDesc.num = Math.max(maskDesc.num - 1, 0);
                if (maskDesc.num == 0) {
                    mask.hide();
                }
            } else if(mask){
                mask.hide();
            }
        },

        __destructor:function () {
            var self = this,
                maskShared = self.get('maskShared'),
                mask = self.get('maskNode');
            if (self.get('maskNode')) {
                if (maskShared) {
                    if (self.get('visible')) {
                        self._maskExtHide();
                    }
                } else {
                    mask.remove();
                }
            }
        }

    };

   /**
     * @class BUI.Component.UIBase.Mask
     * Mask extension class.
     * Make component to be able to show with mask.
     */
    function Mask() {
    }

    Mask.ATTRS =
    {
        /**
         * \u63a7\u4ef6\u663e\u793a\u65f6\uff0c\u662f\u5426\u663e\u793a\u5c4f\u853d\u5c42
         * <pre><code>
         *   var overlay = new Overlay({ //\u663e\u793aoverlay\u65f6\uff0c\u5c4f\u853dbody
         *     mask : true,
         *     maskNode : 'body',
         *     trigger : '#t1'
         *   });
         *   overlay.render();
         * </code></pre>
         * @cfg {Boolean} [mask = false]
         */
        /**
         * \u63a7\u4ef6\u663e\u793a\u65f6\uff0c\u662f\u5426\u663e\u793a\u5c4f\u853d\u5c42
         * @type {Boolean}
         * @protected
         */
        mask:{
            value:false
        },
        /**
         * \u5c4f\u853d\u7684\u5185\u5bb9
         * <pre><code>
         *   var overlay = new Overlay({ //\u663e\u793aoverlay\u65f6\uff0c\u5c4f\u853dbody
         *     mask : true,
         *     maskNode : 'body',
         *     trigger : '#t1'
         *   });
         *   overlay.render();
         * </code></pre>
         * @cfg {jQuery} maskNode
         */
        /**
         * \u5c4f\u853d\u7684\u5185\u5bb9
         * @type {jQuery}
         * @protected
         */
        maskNode:{
            view:1
        },
        /**
         * Whether to share mask with other overlays.
         * @default true.
         * @type {Boolean}
         * @protected
         */
        maskShared:{
            view:1
        }
    };

    Mask.prototype = {

        __bindUI:function () {
            var self = this,
                view = self.get('view'),
                _maskExtShow = view._maskExtShow,
                _maskExtHide = view._maskExtHide;
            if (self.get('mask')) {
                self.on('show', _maskExtShow, view);
                self.on('hide', _maskExtHide, view);
            }
        }
    };

  Mask = Mask;
  Mask.View = MaskView;

  return Mask;
});

/**
 * @fileOverview \u4f4d\u7f6e\uff0c\u63a7\u4ef6\u7edd\u5bf9\u5b9a\u4f4d
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */
define('bui/component/uibase/position',function () {


    /**
    * \u5bf9\u9f50\u7684\u89c6\u56fe\u7c7b
    * @class BUI.Component.UIBase.PositionView
    * @private
    */
    function PositionView() {

    }

    PositionView.ATTRS = {
        x:{
            /**
             * \u6c34\u5e73\u65b9\u5411\u7edd\u5bf9\u4f4d\u7f6e
             * @private
             * @ignore
             */
            valueFn:function () {
                var self = this;
                // \u8bfb\u5230\u8fd9\u91cc\u65f6\uff0cel \u4e00\u5b9a\u662f\u5df2\u7ecf\u52a0\u5230 dom \u6811\u4e2d\u4e86\uff0c\u5426\u5219\u62a5\u672a\u77e5\u9519\u8bef
                // el \u4e0d\u5728 dom \u6811\u4e2d offset \u62a5\u9519\u7684
                // \u6700\u65e9\u8bfb\u5c31\u662f\u5728 syncUI \u4e2d\uff0c\u4e00\u70b9\u91cd\u590d\u8bbe\u7f6e(\u8bfb\u53d6\u81ea\u8eab X \u518d\u8c03\u7528 _uiSetX)\u65e0\u6240\u8c13\u4e86
                return self.get('el') && self.get('el').offset().left;
            }
        },
        y:{
            /**
             * \u5782\u76f4\u65b9\u5411\u7edd\u5bf9\u4f4d\u7f6e
             * @private
             * @ignore
             */
            valueFn:function () {
                var self = this;
                return self.get('el') && self.get('el').offset().top;
            }
        },
        zIndex:{
        },
        /**
         * @private
         * see {@link BUI.Component.UIBase.Box#visibleMode}.
         * @default "visibility"
         * @ignore
         */
        visibleMode:{
            value:'visibility'
        }
    };


    PositionView.prototype = {

        __createDom:function () {
            this.get('el').addClass(BUI.prefix + 'ext-position');
        },

        _uiSetZIndex:function (x) {
            this.get('el').css('z-index', x);
        },
        _uiSetX:function (x) {
            if (x != null) {
                this.get('el').offset({
                    left:x
                });
            }
        },
        _uiSetY:function (y) {
            if (y != null) {
                this.get('el').offset({
                    top:y
                });
            }
        },
        _uiSetLeft:function(left){
            if(left != null){
                this.get('el').css({left:left});
            }
        },
        _uiSetTop : function(top){
            if(top != null){
                this.get('el').css({top:top});
            }
        }
    };
  
    /**
     * @class BUI.Component.UIBase.Position
     * Position extension class.
     * Make component positionable
     */
    function Position() {
    }

    Position.ATTRS =
    /**
     * @lends BUI.Component.UIBase.Position#
     * @ignore
     */
    {
        /**
         * \u6c34\u5e73\u5750\u6807
         * @cfg {Number} x
         */
        /**
         * \u6c34\u5e73\u5750\u6807
         * <pre><code>
         *     overlay.set('x',100);
         * </code></pre>
         * @type {Number}
         */
        x:{
            view:1
        },
        /**
         * \u5782\u76f4\u5750\u6807
         * @cfg {Number} y
         */
        /**
         * \u5782\u76f4\u5750\u6807
         * <pre><code>
         *     overlay.set('y',100);
         * </code></pre>
         * @type {Number}
         */
        y:{
            view:1
        },
        /**
         * \u76f8\u5bf9\u4e8e\u7236\u5143\u7d20\u7684\u6c34\u5e73\u4f4d\u7f6e
         * @type {Number}
         * @protected
         */
        left : {
            view:1
        },
        /**
         * \u76f8\u5bf9\u4e8e\u7236\u5143\u7d20\u7684\u5782\u76f4\u4f4d\u7f6e
         * @type {Number}
         * @protected
         */
        top : {
            view:1
        },
        /**
         * \u6c34\u5e73\u548c\u5782\u76f4\u5750\u6807
         * <pre><code>
         * var overlay = new Overlay({
         *   xy : [100,100],
         *   trigger : '#t1',
         *   srcNode : '#c1'
         * });
         * </code></pre>
         * @cfg {Number[]} xy
         */
        /**
         * \u6c34\u5e73\u548c\u5782\u76f4\u5750\u6807
         * <pre><code>
         *     overlay.set('xy',[100,100]);
         * </code></pre>
         * @type {Number[]}
         */
        xy:{
            // \u76f8\u5bf9 page \u5b9a\u4f4d, \u6709\u6548\u503c\u4e3a [n, m], \u4e3a null \u65f6, \u9009 align \u8bbe\u7f6e
            setter:function (v) {
                var self = this,
                    xy = $.makeArray(v);
                /*
                 \u5c5e\u6027\u5185\u5206\u53d1\u7279\u522b\u6ce8\u610f\uff1a
                 xy -> x,y
                 */
                if (xy.length) {
                    xy[0] && self.set('x', xy[0]);
                    xy[1] && self.set('y', xy[1]);
                }
                return v;
            },
            /**
             * xy \u7eaf\u4e2d\u8f6c\u4f5c\u7528
             * @ignore
             */
            getter:function () {
                return [this.get('x'), this.get('y')];
            }
        },
        /**
         * z-index value.
         * <pre><code>
         *   var overlay = new Overlay({
         *       zIndex : '1000'
         *   });
         * </code></pre>
         * @cfg {Number} zIndex
         */
        /**
         * z-index value.
         * <pre><code>
         *   overlay.set('zIndex','1200');
         * </code></pre>
         * @type {Number}
         */
        zIndex:{
            view:1
        },
        /**
         * Positionable element is by default visible false.
         * For compatibility in overlay and PopupMenu.
         * @default false
         * @ignore
         */
        visible:{
            view:true,
            value:true
        }
    };


    Position.prototype =
    /**
     * @lends BUI.Component.UIBase.Position.prototype
     * @ignore
     */
    {
        /**
         * Move to absolute position.
         * @param {Number|Number[]} x
         * @param {Number} [y]
         * @example
         * <pre><code>
         * move(x, y);
         * move(x);
         * move([x,y])
         * </code></pre>
         */
        move:function (x, y) {
            var self = this;
            if (BUI.isArray(x)) {
                y = x[1];
                x = x[0];
            }
            self.set('xy', [x, y]);
            return self;
        },
        //\u8bbe\u7f6e x \u5750\u6807\u65f6\uff0c\u91cd\u7f6e left
        _uiSetX : function(v){
            if(v != null){
                var _self = this,
                    el = _self.get('el');
                _self.setInternal('left',el.position().left);
                if(v != -999){
                    this.set('cachePosition',null);
                }
                
            }
            
        },
        //\u8bbe\u7f6e y \u5750\u6807\u65f6\uff0c\u91cd\u7f6e top
        _uiSetY : function(v){
            if(v != null){
                var _self = this,
                    el = _self.get('el');
                _self.setInternal('top',el.position().top);
                if(v != -999){
                    this.set('cachePosition',null);
                }
            }
        },
        //\u8bbe\u7f6e left\u65f6\uff0c\u91cd\u7f6e x
        _uiSetLeft : function(v){
            var _self = this,
                    el = _self.get('el');
            if(v != null){
                _self.setInternal('x',el.offset().left);
            }/*else{ //\u5982\u679clef \u4e3anull,\u540c\u65f6\u8bbe\u7f6e\u8fc7left\u548ctop\uff0c\u90a3\u4e48\u53d6\u5bf9\u5e94\u7684\u503c
                _self.setInternal('left',el.position().left);
            }*/
        },
        //\u8bbe\u7f6etop \u65f6\uff0c\u91cd\u7f6ey
        _uiSetTop : function(v){
            var _self = this,
                el = _self.get('el');
            if(v != null){
                _self.setInternal('y',el.offset().top);
            }/*else{ //\u5982\u679clef \u4e3anull,\u540c\u65f6\u8bbe\u7f6e\u8fc7left\u548ctop\uff0c\u90a3\u4e48\u53d6\u5bf9\u5e94\u7684\u503c
                _self.setInternal('top',el.position().top);
            }*/
        }
    };

    Position.View = PositionView;
    return Position;
});
/**
 * @fileOverview \u53ef\u9009\u4e2d\u7684\u63a7\u4ef6,\u7236\u63a7\u4ef6\u652f\u6301selection\u6269\u5c55
 * @ignore
 */

define('bui/component/uibase/listitem',function () {

  /**
   * \u5217\u8868\u9879\u63a7\u4ef6\u7684\u89c6\u56fe\u5c42
   * @class BUI.Component.UIBase.ListItemView
   * @private
   */
  function listItemView () {
    // body...
  }

  listItemView.ATTRS = {
    /**
     * \u662f\u5426\u9009\u4e2d
     * @type {Boolean}
     */
    selected : {

    }
  };

  listItemView.prototype = {
     _uiSetSelected : function(v){
      var _self = this,
        cls = _self.getStatusCls('selected'),
        el = _self.get('el');
      if(v){
        el.addClass(cls);
      }else{
        el.removeClass(cls);
      }
    }
  };
  /**
   * \u5217\u8868\u9879\u7684\u6269\u5c55
   * @class BUI.Component.UIBase.ListItem
   */
  function listItem() {
    
  }

  listItem.ATTRS = {

    /**
     * \u662f\u5426\u53ef\u4ee5\u88ab\u9009\u4e2d
     * @cfg {Boolean} [selectable=true]
     */
    /**
     * \u662f\u5426\u53ef\u4ee5\u88ab\u9009\u4e2d
     * @type {Boolean}
     */
    selectable : {
      value : true
    },
    
    /**
     * \u662f\u5426\u9009\u4e2d,\u53ea\u80fd\u901a\u8fc7\u8bbe\u7f6e\u7236\u7c7b\u7684\u9009\u4e2d\u65b9\u6cd5\u6765\u5b9e\u73b0\u9009\u4e2d
     * @type {Boolean}
     * @readOnly
     */
    selected :{
      view : true,
      sync : false,
      value : false
    }
  };

  listItem.prototype = {
    
  };

  listItem.View = listItemView;

  return listItem;

});
/**
 * @fileOverview 
 * \u63a7\u4ef6\u5305\u542b\u5934\u90e8\uff08head)\u3001\u5185\u5bb9(content)\u548c\u5c3e\u90e8\uff08foot)
 * @ignore
 */
define('bui/component/uibase/stdmod',function () {

    var CLS_PREFIX = BUI.prefix + 'stdmod-';
        

    /**
    * \u6807\u51c6\u6a21\u5757\u7ec4\u7ec7\u7684\u89c6\u56fe\u7c7b
    * @class BUI.Component.UIBase.StdModView
    * @private
    */
    function StdModView() {
    }

    StdModView.ATTRS = {
        header:{
        },
        body:{
        },
        footer:{
        },
        bodyStyle:{
        },
        footerStyle:{
        },
        headerStyle:{
        },
        headerContent:{
        },
        bodyContent:{
        },
        footerContent:{
        }
    };

    StdModView.PARSER = {
        header:function (el) {
            return el.one("." + CLS_PREFIX + "header");
        },
        body:function (el) {
            return el.one("." + CLS_PREFIX + "body");
        },
        footer:function (el) {
            return el.one("." + CLS_PREFIX + "footer");
        }
    };/**/

    function createUI(self, part) {
        var el = self.get('contentEl'),
            partEl = self.get(part);
        if (!partEl) {
            partEl = $('<div class="' +
                CLS_PREFIX + part + '"' +
                ' ' +
                ' >' +
                '</div>');
            partEl.appendTo(el);
            self.setInternal(part, partEl);
        }
    }


    function _setStdModRenderContent(self, part, v) {
        part = self.get(part);
        if (BUI.isString(v)) {
            part.html(v);
        } else {
            part.html('')
                .append(v);
        }
    }

    StdModView.prototype = {

        __createDom:function () {
            createUI(this, 'header');
            createUI(this, 'body');
            createUI(this, 'footer');
        },

        _uiSetBodyStyle:function (v) {
            this.get('body').css(v);
        },

        _uiSetHeaderStyle:function (v) {
            this.get('header').css(v);
        },
        _uiSetFooterStyle:function (v) {
            this.get('footer').css(v);
        },

        _uiSetBodyContent:function (v) {
            _setStdModRenderContent(this, 'body', v);
        },

        _uiSetHeaderContent:function (v) {
            _setStdModRenderContent(this, 'header', v);
        },

        _uiSetFooterContent:function (v) {
            _setStdModRenderContent(this, 'footer', v);
        }
    };

   /**
     * @class BUI.Component.UIBase.StdMod
     * StdMod extension class.
     * Generate head, body, foot for component.
     */
    function StdMod() {
    }

    StdMod.ATTRS =
    /**
     * @lends BUI.Component.UIBase.StdMod#
     * @ignore
     */
    {
        /**
         * \u63a7\u4ef6\u7684\u5934\u90e8DOM. Readonly
         * @readOnly
         * @type {jQuery}
         */
        header:{
            view:1
        },
        /**
         * \u63a7\u4ef6\u7684\u5185\u5bb9DOM. Readonly
         * @readOnly
         * @type {jQuery}
         */
        body:{
            view:1
        },
        /**
         * \u63a7\u4ef6\u7684\u5e95\u90e8DOM. Readonly
         * @readOnly
         * @type {jQuery}
         */
        footer:{
            view:1
        },
        /**
         * \u5e94\u7528\u5230\u63a7\u4ef6\u5185\u5bb9\u7684css\u5c5e\u6027\uff0c\u952e\u503c\u5bf9\u5f62\u5f0f
         * @cfg {Object} bodyStyle
         */
        /**
         * \u5e94\u7528\u5230\u63a7\u4ef6\u5185\u5bb9\u7684css\u5c5e\u6027\uff0c\u952e\u503c\u5bf9\u5f62\u5f0f
         * @type {Object}
         * @protected
         */
        bodyStyle:{
            view:1
        },
        /**
         * \u5e94\u7528\u5230\u63a7\u4ef6\u5e95\u90e8\u7684css\u5c5e\u6027\uff0c\u952e\u503c\u5bf9\u5f62\u5f0f
         * @cfg {Object} footerStyle
         */
        /**
         * \u5e94\u7528\u5230\u63a7\u4ef6\u5e95\u90e8\u7684css\u5c5e\u6027\uff0c\u952e\u503c\u5bf9\u5f62\u5f0f
         * @type {Object}
         * @protected
         */
        footerStyle:{
            view:1
        },
        /**
         * \u5e94\u7528\u5230\u63a7\u4ef6\u5934\u90e8\u7684css\u5c5e\u6027\uff0c\u952e\u503c\u5bf9\u5f62\u5f0f
         * @cfg {Object} headerStyle
         */
        /**
         * \u5e94\u7528\u5230\u63a7\u4ef6\u5934\u90e8\u7684css\u5c5e\u6027\uff0c\u952e\u503c\u5bf9\u5f62\u5f0f
         * @type {Object}
         * @protected
         */
        headerStyle:{
            view:1
        },
        /**
         * \u63a7\u4ef6\u5934\u90e8\u7684html
         * <pre><code>
         * var dialog = new Dialog({
         *     headerContent: '&lt;div class="header"&gt;&lt;/div&gt;',
         *     bodyContent : '#c1',
         *     footerContent : '&lt;div class="footer"&gt;&lt;/div&gt;'
         * });
         * dialog.show();
         * </code></pre>
         * @cfg {jQuery|String} headerContent
         */
        /**
         * \u63a7\u4ef6\u5934\u90e8\u7684html
         * @type {jQuery|String}
         */
        headerContent:{
            view:1
        },
        /**
         * \u63a7\u4ef6\u5185\u5bb9\u7684html
         * <pre><code>
         * var dialog = new Dialog({
         *     headerContent: '&lt;div class="header"&gt;&lt;/div&gt;',
         *     bodyContent : '#c1',
         *     footerContent : '&lt;div class="footer"&gt;&lt;/div&gt;'
         * });
         * dialog.show();
         * </code></pre>
         * @cfg {jQuery|String} bodyContent
         */
        /**
         * \u63a7\u4ef6\u5185\u5bb9\u7684html
         * @type {jQuery|String}
         */
        bodyContent:{
            view:1
        },
        /**
         * \u63a7\u4ef6\u5e95\u90e8\u7684html
         * <pre><code>
         * var dialog = new Dialog({
         *     headerContent: '&lt;div class="header"&gt;&lt;/div&gt;',
         *     bodyContent : '#c1',
         *     footerContent : '&lt;div class="footer"&gt;&lt;/div&gt;'
         * });
         * dialog.show();
         * </code></pre>
         * @cfg {jQuery|String} footerContent
         */
        /**
         * \u63a7\u4ef6\u5e95\u90e8\u7684html
         * @type {jQuery|String}
         */
        footerContent:{
            view:1
        }
    };

  StdMod.View = StdModView;
  return StdMod;
});/**
 * @fileOverview \u4f7f\u7528wrapper
 * @ignore
 */

define('bui/component/uibase/decorate',['bui/array','bui/json','bui/component/manage'],function (require) {
  
  var ArrayUtil = require('bui/array'),
    JSON = require('bui/json'),
    prefixCls = BUI.prefix,
    FIELD_PREFIX = 'data-'
    FIELD_CFG = FIELD_PREFIX + 'cfg',
    PARSER = 'PARSER',
    Manager = require('bui/component/manage'),
    regx = /^[\{\[]/;

  function isConfigField(name,cfgFields){
    if(cfgFields[name]){
      return true;
    }
    var reg = new RegExp("^"+FIELD_PREFIX);  
    if(name !== FIELD_CFG && reg.test(name)){
      return true;
    }
    return false;
  }

  // \u6536\u96c6\u5355\u7ee7\u627f\u94fe\uff0c\u5b50\u7c7b\u5728\u524d\uff0c\u7236\u7c7b\u5728\u540e
  function collectConstructorChains(self) {
      var constructorChains = [],
          c = self.constructor;
      while (c) {
          constructorChains.push(c);
          c = c.superclass && c.superclass.constructor;
      }
      return constructorChains;
  }

  //\u5982\u679c\u5c5e\u6027\u4e3a\u5bf9\u8c61\u6216\u8005\u6570\u7ec4\uff0c\u5219\u8fdb\u884c\u8f6c\u6362
  function parseFieldValue(value){
    value = $.trim(value);
    if(regx.test(value)){
      value = JSON.looseParse(value);
    }
    return value;
  }

  function setConfigFields(self,cfg){

    var userConfig = self.userConfig || {};
    for (var p in cfg) {
      // \u7528\u6237\u8bbe\u7f6e\u8fc7\u90a3\u4e48\u8fd9\u91cc\u4e0d\u4ece dom \u8282\u70b9\u53d6
      // \u7528\u6237\u8bbe\u7f6e > html parser > default value
      if (!(p in userConfig)) {
        self.setInternal(p,cfg[p]);
      }
    }
  }
  function applyParser(srcNode, parser) {
    var self = this,
      p, v,
      userConfig = self.userConfig || {};

    // \u4ece parser \u4e2d\uff0c\u9ed8\u9ed8\u8bbe\u7f6e\u5c5e\u6027\uff0c\u4e0d\u89e6\u53d1\u4e8b\u4ef6
    for (p in parser) {
      // \u7528\u6237\u8bbe\u7f6e\u8fc7\u90a3\u4e48\u8fd9\u91cc\u4e0d\u4ece dom \u8282\u70b9\u53d6
      // \u7528\u6237\u8bbe\u7f6e > html parser > default value
      if (!(p in userConfig)) {
        v = parser[p];
        // \u51fd\u6570
        if (BUI.isFunction(v)) {
            self.setInternal(p, v.call(self, srcNode));
        }
        // \u5355\u9009\u9009\u62e9\u5668
        else if (typeof v == 'string') {
            self.setInternal(p, srcNode.find(v));
        }
        // \u591a\u9009\u9009\u62e9\u5668
        else if (BUI.isArray(v) && v[0]) {
            self.setInternal(p, srcNode.find(v[0]))
        }
      }
    }
  }

  function initParser(self,srcNode){

    var c = self.constructor,
      len,
      p,
      constructorChains;

    constructorChains = collectConstructorChains(self);

    // \u4ece\u7236\u7c7b\u5230\u5b50\u7c7b\u5f00\u59cb\u4ece html \u8bfb\u53d6\u5c5e\u6027
    for (len = constructorChains.length - 1; len >= 0; len--) {
        c = constructorChains[len];
        if (p = c[PARSER]) {
            applyParser.call(self, srcNode, p);
        }
    }
  }

  function initDecorate(self){
    var _self = self,
      srcNode = _self.get('srcNode'),
      userConfig,
      decorateCfg;
    if(srcNode){
      srcNode = $(srcNode);
      _self.setInternal('el',srcNode);
      _self.setInternal('srcNode',srcNode);

      userConfig = _self.get('userConfig');
      decorateCfg = _self.getDecorateConfig(srcNode);
      setConfigFields(self,decorateCfg);
      
      //\u5982\u679c\u4eceDOM\u4e2d\u8bfb\u53d6\u5b50\u63a7\u4ef6
      if(_self.get('isDecorateChild') && _self.decorateInternal){
        _self.decorateInternal(srcNode);
      }
      initParser(self,srcNode);
    }
  }

  /**
   * @class BUI.Component.UIBase.Decorate
   * \u5c06DOM\u5bf9\u8c61\u5c01\u88c5\u6210\u63a7\u4ef6
   */
  function decorate(){
    initDecorate(this);
  }

  decorate.ATTRS = {

    /**
     * \u914d\u7f6e\u63a7\u4ef6\u7684\u6839\u8282\u70b9\u7684DOM
     * <pre><code>
     * new Form.Form({
     *   srcNode : '#J_Form'
     * }).render();
     * </code></pre>
     * @cfg {jQuery} srcNode
     */
    /**
     * \u914d\u7f6e\u63a7\u4ef6\u7684\u6839\u8282\u70b9\u7684DOM
     * @type {jQuery} 
     */
    srcNode : {
      view : true
    },
    /**
     * \u662f\u5426\u6839\u636eDOM\u751f\u6210\u5b50\u63a7\u4ef6
     * @type {Boolean}
     * @protected
     */
    isDecorateChild : {
      value : false
    },
    /**
     * \u6b64\u914d\u7f6e\u9879\u914d\u7f6e\u4f7f\u7528\u90a3\u4e9bsrcNode\u4e0a\u7684\u8282\u70b9\u4f5c\u4e3a\u914d\u7f6e\u9879
     *  - \u5f53\u65f6\u7528 decorate \u65f6\uff0c\u53d6 srcNode\u4e0a\u7684\u8282\u70b9\u7684\u5c5e\u6027\u4f5c\u4e3a\u63a7\u4ef6\u7684\u914d\u7f6e\u4fe1\u606f
     *  - \u9ed8\u8ba4id,name,value,title \u90fd\u4f1a\u4f5c\u4e3a\u5c5e\u6027\u4f20\u5165
     *  - \u4f7f\u7528 'data-cfg' \u4f5c\u4e3a\u6574\u4f53\u7684\u914d\u7f6e\u5c5e\u6027
     *  <pre><code>
     *     <input id="c1" type="text" name="txtName" id="id",data-cfg="{allowBlank:false}" />
     *     //\u4f1a\u751f\u6210\u4ee5\u4e0b\u914d\u7f6e\u9879\uff1a
     *     {
     *         name : 'txtName',
     *         id : 'id',
     *         allowBlank:false
     *     }
     *     new Form.Field({
     *        src:'#c1'
     *     }).render();
     *  </code></pre>
     * @type {Object}
     * @protected
     */
    decorateCfgFields : {
      value : {
        'id' : true,
        'name' : true,
        'value' : true,
        'title' : true
      }
    }
  };

  decorate.prototype = {

    /**
     * \u83b7\u53d6\u63a7\u4ef6\u7684\u914d\u7f6e\u4fe1\u606f
     * @protected
     */
    getDecorateConfig : function(el){
      if(!el.length){
        return null;
      }
      var _self = this,
        dom = el[0],
        attributes = dom.attributes,
        decorateCfgFields = _self.get('decorateCfgFields'),
        config = {};

      BUI.each(attributes,function(attr){
        var name = attr.nodeName;
        try{
          if(name === FIELD_CFG){
              var cfg = parseFieldValue(attr.nodeValue);
              BUI.mix(config,cfg);
          }
          else if(isConfigField(name,decorateCfgFields)){
            name = name.replace(FIELD_PREFIX,'');
            config[name] = parseFieldValue(attr.nodeValue);
          }
        }catch(e){
          BUI.log('parse field error,the attribute is:' + name);
        }
      });
      return config;
    },
    /**
     * \u83b7\u53d6\u5c01\u88c5\u6210\u5b50\u63a7\u4ef6\u7684\u8282\u70b9\u96c6\u5408
     * @protected
     * @return {Array} \u8282\u70b9\u96c6\u5408
     */
    getDecorateElments : function(){
      var _self = this,
        el = _self.get('el'),
        contentContainer = _self.get('contentContainer');
      if(contentContainer){
        return el.find(contentContainer).children();
      }else{
        return el.children();
      }
    },

    /**
     * \u5c01\u88c5\u6240\u6709\u7684\u5b50\u63a7\u4ef6
     * @protected
     * @param {jQuery} el Root element of current component.
     */
    decorateInternal: function (el) {
      var self = this;
      self.decorateChildren(el);
    },
    /**
     * \u83b7\u53d6\u5b50\u63a7\u4ef6\u7684xclass\u7c7b\u578b
     * @protected
     * @param {jQuery} \u5b50\u63a7\u4ef6\u7684\u6839\u8282\u70b9
     */
    findXClassByNode: function (childNode, ignoreError) {
      var _self = this,
        cls = childNode.attr("class") || '',
        childClass = _self.get('defaultChildClass'); //\u5982\u679c\u6ca1\u6709\u6837\u5f0f\u6216\u8005\u67e5\u627e\u4e0d\u5230\u5bf9\u5e94\u7684\u7c7b\uff0c\u4f7f\u7528\u9ed8\u8ba4\u7684\u5b50\u63a7\u4ef6\u7c7b\u578b

          // \u8fc7\u6ee4\u6389\u7279\u5b9a\u524d\u7f00
      cls = cls.replace(new RegExp("\\b" + prefixCls, "ig"), "");

      var UI = Manager.getConstructorByXClass(cls) ||  Manager.getConstructorByXClass(childClass);

      if (!UI && !ignoreError) {
        BUI.log(childNode);
        BUI.error("can not find ui " + cls + " from this markup");
      }
      return Manager.getXClassByConstructor(UI);
    },
    // \u751f\u6210\u4e00\u4e2a\u7ec4\u4ef6
    decorateChildrenInternal: function (xclass, c) {
      var _self = this,
        children = _self.get('children');
      children.push({
        xclass : xclass,
        srcNode: c
      });
    },
    /**
     * \u5c01\u88c5\u5b50\u63a7\u4ef6
     * @private
     * @param {jQuery} el component's root element.
     */
    decorateChildren: function (el) {
      var _self = this,
          children = _self.getDecorateElments();
      BUI.each(children,function(c){
        var xclass = _self.findXClassByNode($(c));
        _self.decorateChildrenInternal(xclass, $(c));
      });
    }
  };

  return decorate;
});/**
 * @fileOverview \u63a7\u4ef6\u6a21\u677f
 * @author dxq613@gmail.com
 * @ignore
 */
define('bui/component/uibase/tpl',function () {

  /**
   * @private
   * \u63a7\u4ef6\u6a21\u677f\u6269\u5c55\u7c7b\u7684\u6e32\u67d3\u7c7b(view)
   * @class BUI.Component.UIBase.TplView
   */
  function tplView () {
    
  }

  tplView.ATTRS = {
    /**
     * \u6a21\u677f
     * @protected
     * @type {String}
     */
    tpl:{

    }
  };

  tplView.prototype = {
    __renderUI : function(){
      var _self = this,
        contentContainer = _self.get('childContainer'),
        contentEl;

      if(contentContainer){
        contentEl = _self.get('el').find(contentContainer);
        if(contentEl.length){
          _self.set('contentEl',contentEl);
        }
      }
    },
    /**
     * \u83b7\u53d6\u751f\u6210\u63a7\u4ef6\u7684\u6a21\u677f
     * @protected
     * @param  {Object} attrs \u5c5e\u6027\u503c
     * @return {String} \u6a21\u677f
     */
    getTpl:function (attrs) {
        var _self = this,
            tpl = _self.get('tpl'),
            tplRender = _self.get('tplRender');
        attrs = attrs || _self.getAttrVals();

        if(tplRender){
          return tplRender(attrs);
        }
        if(tpl){
          return BUI.substitute(tpl,attrs);
        }
        return '';
    },
    /**
     * \u5982\u679c\u63a7\u4ef6\u8bbe\u7f6e\u4e86\u6a21\u677f\uff0c\u5219\u6839\u636e\u6a21\u677f\u548c\u5c5e\u6027\u503c\u751f\u6210DOM
     * \u5982\u679c\u8bbe\u7f6e\u4e86content\u5c5e\u6027\uff0c\u6b64\u6a21\u677f\u4e0d\u5e94\u7528
     * @protected
     * @param  {Object} attrs \u5c5e\u6027\u503c\uff0c\u9ed8\u8ba4\u4e3a\u521d\u59cb\u5316\u65f6\u4f20\u5165\u7684\u503c
     */
    setTplContent:function (attrs) {
        var _self = this,
            el = _self.get('el'),
            content = _self.get('content'),
            tpl = _self.getTpl(attrs);
        if(!content && tpl){
          el.empty();
          el.html(tpl);
        }
    }
  }

  /**
   * \u63a7\u4ef6\u7684\u6a21\u677f\u6269\u5c55
   * @class BUI.Component.UIBase.Tpl
   */
  function tpl() {

  }

  tpl.ATTRS = {
    /**
    * \u63a7\u4ef6\u7684\u6a21\u7248\uff0c\u7528\u4e8e\u521d\u59cb\u5316
    * <pre><code>
    * var list = new List.List({
    *   tpl : '&lt;div class="toolbar"&gt;&lt;/div&gt;&lt;ul&gt;&lt;/ul&gt;',
    *   childContainer : 'ul'
    * });
    * //\u7528\u4e8e\u7edf\u4e00\u5b50\u63a7\u4ef6\u6a21\u677f
    * var list = new List.List({
    *   defaultChildCfg : {
    *     tpl : '&lt;span&gt;{text}&lt;/span&gt;'
    *   }
    * });
    * list.render();
    * </code></pre>
    * @cfg {String} tpl
    */
    /**
     * \u63a7\u4ef6\u7684\u6a21\u677f
     * <pre><code>
     *   list.set('tpl','&lt;div class="toolbar"&gt;&lt;/div&gt;&lt;ul&gt;&lt;/ul&gt;&lt;div class="bottom"&gt;&lt;/div&gt;')
     * </code></pre>
     * @type {String}
     */
    tpl : {
      view : true,
      sync: false
    },
    /**
     * <p>\u63a7\u4ef6\u7684\u6e32\u67d3\u51fd\u6570\uff0c\u5e94\u5bf9\u4e00\u4e9b\u7b80\u5355\u6a21\u677f\u89e3\u51b3\u4e0d\u4e86\u7684\u95ee\u9898\uff0c\u4f8b\u5982\u6709if,else\u903b\u8f91\uff0c\u6709\u5faa\u73af\u903b\u8f91,
     * \u51fd\u6570\u539f\u578b\u662ffunction(data){},\u5176\u4e2ddata\u662f\u63a7\u4ef6\u7684\u5c5e\u6027\u503c</p>
     * <p>\u63a7\u4ef6\u6a21\u677f\u7684\u52a0\u5f3a\u6a21\u5f0f\uff0c\u6b64\u5c5e\u6027\u4f1a\u8986\u76d6@see {BUI.Component.UIBase.Tpl#property-tpl}\u5c5e\u6027</p>
     * //\u7528\u4e8e\u7edf\u4e00\u5b50\u63a7\u4ef6\u6a21\u677f
     * var list = new List.List({
     *   defaultChildCfg : {
     *     tplRender : funciton(item){
     *       if(item.type == '1'){
     *         return 'type1 html';
     *       }else{
     *         return 'type2 html';
     *       }
     *     }
     *   }
     * });
     * list.render();
     * @cfg {Function} tplRender
     */
    tplRender : {
      view : true,
      value : null
    },
    /**
     * \u8fd9\u662f\u4e00\u4e2a\u9009\u62e9\u5668\uff0c\u4f7f\u7528\u4e86\u6a21\u677f\u540e\uff0c\u5b50\u63a7\u4ef6\u53ef\u80fd\u4f1a\u6dfb\u52a0\u5230\u6a21\u677f\u5bf9\u5e94\u7684\u4f4d\u7f6e,
     *  - \u9ed8\u8ba4\u4e3anull,\u6b64\u65f6\u5b50\u63a7\u4ef6\u4f1a\u5c06\u63a7\u4ef6\u6700\u5916\u5c42 el \u4f5c\u4e3a\u5bb9\u5668
     * <pre><code>
     * var list = new List.List({
     *   tpl : '&lt;div class="toolbar"&gt;&lt;/div&gt;&lt;ul&gt;&lt;/ul&gt;',
     *   childContainer : 'ul'
     * });
     * </code></pre>
     * @cfg {String} childContainer
     */
    childContainer : {
      view : true
    }
  };

  tpl.prototype = {

    __renderUI : function () {
      //\u4f7f\u7528srcNode\u65f6\uff0c\u4e0d\u4f7f\u7528\u6a21\u677f
      if(!this.get('srcNode')){
        this.setTplContent();
      }
    },
    /**
     * \u6839\u636e\u63a7\u4ef6\u7684\u5c5e\u6027\u548c\u6a21\u677f\u751f\u6210\u63a7\u4ef6\u5185\u5bb9
     * @protected
     */
    setTplContent : function () {
      var _self = this,
        attrs = _self.getAttrVals();
      _self.get('view').setTplContent(attrs);
    },
    //\u6a21\u677f\u53d1\u751f\u6539\u53d8
    _uiSetTpl : function(){
      this.setTplContent();
    }
  };


  tpl.View = tplView;

  return tpl;
});
 

/**
 * @fileOverview \u53ef\u4ee5\u5c55\u5f00\u6298\u53e0\u7684\u63a7\u4ef6
 * @ignore
 */

define('bui/component/uibase/collapseable',function () {

  /**
  * \u63a7\u4ef6\u5c55\u5f00\u6298\u53e0\u7684\u89c6\u56fe\u7c7b
  * @class BUI.Component.UIBase.CollapseableView
  * @private
  */
  var collapseableView = function(){
  
  };

  collapseableView.ATTRS = {
    collapsed : {}
  }

  collapseableView.prototype = {
    //\u8bbe\u7f6e\u6536\u7f29\u6837\u5f0f
    _uiSetCollapsed : function(v){
      var _self = this,
        cls = _self.getStatusCls('collapsed'),
        el = _self.get('el');
      if(v){
        el.addClass(cls);
      }else{
        el.removeClass(cls);
      }
    }
  }
  /**
   * \u63a7\u4ef6\u5c55\u5f00\u6298\u53e0\u7684\u6269\u5c55
   * @class BUI.Component.UIBase.Collapseable
   */
  var collapseable = function(){
    
  };

  collapseable.ATTRS = {
    /**
     * \u662f\u5426\u53ef\u6298\u53e0
     * @type {Boolean}
     */
    collapseable: {
      value : false
    },
    /**
     * \u662f\u5426\u5df2\u7ecf\u6298\u53e0 collapsed
     * @cfg {Boolean} collapsed
     */
    /**
     * \u662f\u5426\u5df2\u7ecf\u6298\u53e0
     * @type {Boolean}
     */
    collapsed : {
      view : true,
      value : false
    },
    events : {
      value : {
        /**
         * \u63a7\u4ef6\u5c55\u5f00
         * @event
         * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
         * @param {BUI.Component.Controller} target \u63a7\u4ef6
         */
        'expanded' : true,
        /**
         * \u63a7\u4ef6\u6298\u53e0
         * @event
         * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
         * @param {BUI.Component.Controller} target \u63a7\u4ef6
         */
        'collapsed' : true
      }
    }
  };

  collapseable.prototype = {
    _uiSetCollapsed : function(v){
      var _self = this;
      if(v){
        _self.fire('collapsed');
      }else{
        _self.fire('expanded');
      }
    }
  };

  collapseable.View = collapseableView;
  
  return collapseable;
});/**
 * @fileOverview \u5355\u9009\u6216\u8005\u591a\u9009
 * @author  dxq613@gmail.com
 * @ignore
 */
define('bui/component/uibase/selection',function () {
    var 
        SINGLE_SELECTED = 'single';

    /**
     * @class BUI.Component.UIBase.Selection
     * \u9009\u4e2d\u63a7\u4ef6\u4e2d\u7684\u9879\uff08\u5b50\u5143\u7d20\u6216\u8005DOM\uff09\uff0c\u6b64\u7c7b\u9009\u62e9\u7684\u5185\u5bb9\u67092\u79cd
     * <ol>
     *     <li>\u5b50\u63a7\u4ef6</li>
     *     <li>DOM\u5143\u7d20</li>
     * </ol>
     * ** \u5f53\u9009\u62e9\u662f\u5b50\u63a7\u4ef6\u65f6\uff0celement \u548c item \u90fd\u662f\u6307 \u5b50\u63a7\u4ef6\uff1b**
     * ** \u5f53\u9009\u62e9\u7684\u662fDOM\u5143\u7d20\u65f6\uff0celement \u6307DOM\u5143\u7d20\uff0citem \u6307DOM\u5143\u7d20\u5bf9\u5e94\u7684\u8bb0\u5f55 **
     * @abstract
     */
    var selection = function(){

    };

    selection.ATTRS = 
    /**
     * @lends BUI.Component.UIBase.Selection#
     * @ignore
     */
    {
        /**
         * \u9009\u4e2d\u7684\u4e8b\u4ef6
         * <pre><code>
         * var list = new List.SimpleList({
         *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;',
         *   idField : 'value',
         *   selectedEvent : 'mouseenter',
         *   render : '#t1',
         *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
         * });
         * </code></pre>
         * @cfg {String} [selectedEvent = 'click']
         */
        selectedEvent:{
            value : 'click'
        },
        events : {
            value : {
                /**
                   * \u9009\u4e2d\u7684\u83dc\u5355\u6539\u53d8\u65f6\u53d1\u751f\uff0c
                   * \u591a\u9009\u65f6\uff0c\u9009\u4e2d\uff0c\u53d6\u6d88\u9009\u4e2d\u90fd\u89e6\u53d1\u6b64\u4e8b\u4ef6\uff0c\u5355\u9009\u65f6\uff0c\u53ea\u6709\u9009\u4e2d\u65f6\u89e6\u53d1\u6b64\u4e8b\u4ef6
                   * @name  BUI.Component.UIBase.Selection#selectedchange
                   * @event
                   * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                   * @param {Object} e.item \u5f53\u524d\u9009\u4e2d\u7684\u9879
                   * @param {HTMLElement} e.domTarget \u5f53\u524d\u9009\u4e2d\u7684\u9879\u7684DOM\u7ed3\u6784
                   * @param {Boolean} e.selected \u662f\u5426\u9009\u4e2d
                   */
                'selectedchange' : false,

                /**
                   * \u9009\u62e9\u6539\u53d8\u524d\u89e6\u53d1\uff0c\u53ef\u4ee5\u901a\u8fc7return false\uff0c\u963b\u6b62selectedchange\u4e8b\u4ef6
                   * @event
                   * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                   * @param {Object} e.item \u5f53\u524d\u9009\u4e2d\u7684\u9879
                   * @param {Boolean} e.selected \u662f\u5426\u9009\u4e2d
                   */
                'beforeselectedchange' : false,

                /**
                   * \u83dc\u5355\u9009\u4e2d
                   * @event
                   * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                   * @param {Object} e.item \u5f53\u524d\u9009\u4e2d\u7684\u9879
                   * @param {HTMLElement} e.domTarget \u5f53\u524d\u9009\u4e2d\u7684\u9879\u7684DOM\u7ed3\u6784
                   */
                'itemselected' : false,
                /**
                   * \u83dc\u5355\u53d6\u6d88\u9009\u4e2d
                   * @event
                   * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                   * @param {Object} e.item \u5f53\u524d\u9009\u4e2d\u7684\u9879
                   * @param {HTMLElement} e.domTarget \u5f53\u524d\u9009\u4e2d\u7684\u9879\u7684DOM\u7ed3\u6784
                   */
                'itemunselected' : false
            }
        },
        /**
         * \u6570\u636e\u7684id\u5b57\u6bb5\u540d\u79f0\uff0c\u901a\u8fc7\u6b64\u5b57\u6bb5\u67e5\u627e\u5bf9\u5e94\u7684\u6570\u636e
         * <pre><code>
         * var list = new List.SimpleList({
         *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;',
         *   idField : 'value',
         *   render : '#t1',
         *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
         * });
         * </code></pre>
         * @cfg {String} [idField = 'id']
         */
        /**
         * \u6570\u636e\u7684id\u5b57\u6bb5\u540d\u79f0\uff0c\u901a\u8fc7\u6b64\u5b57\u6bb5\u67e5\u627e\u5bf9\u5e94\u7684\u6570\u636e
         * @type {String}
         * @ignore
         */
        idField : {
            value : 'id'
        },
        /**
         * \u662f\u5426\u591a\u9009
         * <pre><code>
         * var list = new List.SimpleList({
         *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;',
         *   idField : 'value',
         *   render : '#t1',
         *   multipleSelect : true,
         *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
         * });
         * </code></pre>
         * @cfg {Boolean} [multipleSelect=false]
         */
        /**
         * \u662f\u5426\u591a\u9009
         * @type {Boolean}
         * @default false
         */
        multipleSelect : {
            value : false
        }

    };

    selection.prototype = 
    /**
     * @lends BUI.Component.UIBase.Selection.prototype
     * @ignore
     */
    {
        /**
         * \u6e05\u7406\u9009\u4e2d\u7684\u9879
         * <pre><code>
         *  list.clearSelection();
         * </code></pre>
         *
         */
        clearSelection : function(){
            var _self = this,
                selection = _self.getSelection();
            BUI.each(selection,function(item){
                _self.clearSelected(item);
            });
        },
        /**
         * \u83b7\u53d6\u9009\u4e2d\u7684\u9879\u7684\u503c
         * @template
         * @return {Array} 
         */
        getSelection : function(){

        },
        /**
         * \u83b7\u53d6\u9009\u4e2d\u7684\u7b2c\u4e00\u9879
         * <pre><code>
         * var item = list.getSelected(); //\u591a\u9009\u6a21\u5f0f\u4e0b\u7b2c\u4e00\u6761
         * </code></pre>
         * @return {Object} \u9009\u4e2d\u7684\u7b2c\u4e00\u9879\u6216\u8005\u4e3aundefined
         */
        getSelected : function(){
            return this.getSelection()[0];
        },
        /**
         * \u6839\u636e idField \u83b7\u53d6\u5230\u7684\u503c
         * @protected
         * @return {Object} \u9009\u4e2d\u7684\u503c
         */
        getSelectedValue : function(){
            var _self = this,
                field = _self.get('idField'),
                item = _self.getSelected();

            return _self.getValueByField(item,field);
        },
        /**
         * \u83b7\u53d6\u9009\u4e2d\u7684\u503c\u96c6\u5408
         * @protected
         * @return {Array} \u9009\u4e2d\u503c\u5f97\u96c6\u5408
         */
        getSelectionValues:function(){
            var _self = this,
                field = _self.get('idField'),
                items = _self.getSelection();
            return $.map(items,function(item){
                return _self.getValueByField(item,field);
            });
        },
        /**
         * \u83b7\u53d6\u9009\u4e2d\u7684\u6587\u672c
         * @protected
         * @return {Array} \u9009\u4e2d\u7684\u6587\u672c\u96c6\u5408
         */
        getSelectionText:function(){
            var _self = this,
                items = _self.getSelection();
            return $.map(items,function(item){
                return _self.getItemText(item);
            });
        },
        /**
         * \u79fb\u9664\u9009\u4e2d
         * <pre><code>
         *    var item = list.getItem('id'); //\u901a\u8fc7id \u83b7\u53d6\u9009\u9879
         *    list.setSelected(item); //\u9009\u4e2d
         *
         *    list.clearSelected();//\u5355\u9009\u6a21\u5f0f\u4e0b\u6e05\u9664\u6240\u9009\uff0c\u591a\u9009\u6a21\u5f0f\u4e0b\u6e05\u9664\u9009\u4e2d\u7684\u7b2c\u4e00\u9879
         *    list.clearSelected(item); //\u6e05\u9664\u9009\u9879\u7684\u9009\u4e2d\u72b6\u6001
         * </code></pre>
         * @param {Object} [item] \u6e05\u9664\u9009\u9879\u7684\u9009\u4e2d\u72b6\u6001\uff0c\u5982\u679c\u672a\u6307\u5b9a\u5219\u6e05\u9664\u9009\u4e2d\u7684\u7b2c\u4e00\u4e2a\u9009\u9879\u7684\u9009\u4e2d\u72b6\u6001
         */
        clearSelected : function(item){
            var _self = this;
            item = item || _self.getSelected();
            if(item){
                _self.setItemSelected(item,false);
            } 
        },
        /**
         * \u83b7\u53d6\u9009\u9879\u663e\u793a\u7684\u6587\u672c
         * @protected
         */
        getSelectedText : function(){
            var _self = this,
                item = _self.getSelected();
            return _self.getItemText(item);
        },
        /**
         * \u8bbe\u7f6e\u9009\u4e2d\u7684\u9879
         * <pre><code>
         *  var items = list.getItemsByStatus('active'); //\u83b7\u53d6\u67d0\u79cd\u72b6\u6001\u7684\u9009\u9879
         *  list.setSelection(items);
         * </code></pre>
         * @param {Array} items \u9879\u7684\u96c6\u5408
         */
        setSelection: function(items){
            var _self = this;

            items = BUI.isArray(items) ? items : [items];

            BUI.each(items,function(item){
                _self.setSelected(item);
            }); 
        },
        /**
         * \u8bbe\u7f6e\u9009\u4e2d\u7684\u9879
         * <pre><code>
         *   var item = list.getItem('id');
         *   list.setSelected(item);
         * </code></pre>
         * @param {Object} item \u8bb0\u5f55\u6216\u8005\u5b50\u63a7\u4ef6
         * @param {BUI.Component.Controller|Object} element \u5b50\u63a7\u4ef6\u6216\u8005DOM\u7ed3\u6784
         */
        setSelected: function(item){
            var _self = this,
                multipleSelect = _self.get('multipleSelect');
                
            if(!multipleSelect){
                var selectedItem = _self.getSelected();
                if(item != selectedItem){
                    //\u5982\u679c\u662f\u5355\u9009\uff0c\u6e05\u9664\u5df2\u7ecf\u9009\u4e2d\u7684\u9879
                    _self.clearSelected(selectedItem);
                }
               
            }
            _self.setItemSelected(item,true);
            
        },
        /**
         * \u9009\u9879\u662f\u5426\u88ab\u9009\u4e2d
         * @template
         * @param  {*}  item \u9009\u9879
         * @return {Boolean}  \u662f\u5426\u9009\u4e2d
         */
        isItemSelected : function(item){

        },
        /**
         * \u8bbe\u7f6e\u9009\u9879\u7684\u9009\u4e2d\u72b6\u6001
         * @param {*} item \u9009\u9879
         * @param {Boolean} selected \u9009\u4e2d\u6216\u8005\u53d6\u6d88\u9009\u4e2d
         * @protected
         */
        setItemSelected : function(item,selected){
            var _self = this,
                isSelected;
            //\u5f53\u524d\u72b6\u6001\u7b49\u4e8e\u8981\u8bbe\u7f6e\u7684\u72b6\u6001\u65f6\uff0c\u4e0d\u89e6\u53d1\u6539\u53d8\u4e8b\u4ef6
            if(item){
                isSelected =  _self.isItemSelected(item);
                if(isSelected == selected){
                    return;
                }
            }
            if(_self.fire('beforeselectedchange') !== false){
                _self.setItemSelectedStatus(item,selected);
            }
        },
        /**
         * \u8bbe\u7f6e\u9009\u9879\u7684\u9009\u4e2d\u72b6\u6001
         * @template
         * @param {*} item \u9009\u9879
         * @param {Boolean} selected \u9009\u4e2d\u6216\u8005\u53d6\u6d88\u9009\u4e2d
         * @protected
         */
        setItemSelectedStatus : function(item,selected){

        },
        /**
         * \u8bbe\u7f6e\u6240\u6709\u9009\u9879\u9009\u4e2d
         * <pre><code>
         *  list.setAllSelection(); //\u9009\u4e2d\u5168\u90e8\uff0c\u591a\u9009\u72b6\u6001\u4e0b\u6709\u6548
         * </code></pre>
         * @template
         */
        setAllSelection : function(){
          
        },
        /**
         * \u8bbe\u7f6e\u9879\u9009\u4e2d\uff0c\u901a\u8fc7\u5b57\u6bb5\u548c\u503c
         * @param {String} field \u5b57\u6bb5\u540d,\u9ed8\u8ba4\u4e3a\u914d\u7f6e\u9879'idField',\u6240\u4ee5\u6b64\u5b57\u6bb5\u53ef\u4ee5\u4e0d\u586b\u5199\uff0c\u4ec5\u586b\u5199\u503c
         * @param {Object} value \u503c
         * @example
         * <pre><code>
         * var list = new List.SimpleList({
         *   itemTpl : '&lt;li id="{id}"&gt;{text}&lt;/li&gt;',
         *   idField : 'id', //id \u5b57\u6bb5\u4f5c\u4e3akey
         *   render : '#t1',
         *   items : [{id : '1',text : '1'},{id : '2',text : '2'}]
         * });
         *
         *   list.setSelectedByField('123'); //\u9ed8\u8ba4\u6309\u7167id\u5b57\u6bb5\u67e5\u627e
         *   //\u6216\u8005
         *   list.setSelectedByField('id','123');
         *
         *   list.setSelectedByField('value','123');
         * </code></pre>
         */
        setSelectedByField:function(field,value){
            if(!value){
                value = field;
                field = this.get('idField');
            }
            var _self = this,
                item = _self.findItemByField(field,value);
            _self.setSelected(item);
        },
        /**
         * \u8bbe\u7f6e\u591a\u4e2a\u9009\u4e2d\uff0c\u6839\u636e\u5b57\u6bb5\u548c\u503c
         * <pre><code>
         * var list = new List.SimpleList({
         *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;',
         *   idField : 'value', //value \u5b57\u6bb5\u4f5c\u4e3akey
         *   render : '#t1',
         *   multipleSelect : true,
         *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
         * });
         *   var values = ['1','2','3'];
         *   list.setSelectionByField(values);//
         *
         *   //\u7b49\u4e8e
         *   list.setSelectionByField('value',values);
         * </code></pre>
         * @param {String} field \u9ed8\u8ba4\u4e3aidField
         * @param {Array} values \u503c\u5f97\u96c6\u5408
         */
        setSelectionByField:function(field,values){
            if(!values){
                values = field;
                field = this.get('idField');
            }
            var _self = this;
            BUI.each(values,function(value){
                _self.setSelectedByField(field,value);
            });   
        },
        /**
         * \u9009\u4e2d\u5b8c\u6210\u540e\uff0c\u89e6\u53d1\u4e8b\u4ef6
         * @protected
         * @param  {*} item \u9009\u9879
         * @param  {Boolean} selected \u662f\u5426\u9009\u4e2d
         * @param  {jQuery} element 
         */
        afterSelected : function(item,selected,element){
            var _self = this;

            if(selected){
                _self.fire('itemselected',{item:item,domTarget:element});
                _self.fire('selectedchange',{item:item,domTarget:element,selected:selected});
            }else{
                _self.fire('itemunselected',{item:item,domTarget:element});
                if(_self.get('multipleSelect')){ //\u53ea\u6709\u5f53\u591a\u9009\u65f6\uff0c\u53d6\u6d88\u9009\u4e2d\u624d\u89e6\u53d1selectedchange
                    _self.fire('selectedchange',{item:item,domTarget:element,selected:selected});
                } 
            } 
        }

    }
    
    return selection;
});/**
 * @fileOverview \u6240\u6709\u5b50\u5143\u7d20\u90fd\u662f\u540c\u4e00\u7c7b\u7684\u96c6\u5408
 * @ignore
 */

define('bui/component/uibase/list',['bui/component/uibase/selection'],function (require) {
  
  var Selection = require('bui/component/uibase/selection');

  /**
   * \u5217\u8868\u4e00\u7c7b\u7684\u63a7\u4ef6\u7684\u6269\u5c55\uff0clist,menu,grid\u90fd\u662f\u53ef\u4ee5\u4ece\u6b64\u7c7b\u6269\u5c55
   * @class BUI.Component.UIBase.List
   */
  var list = function(){

  };

  list.ATTRS = {

    /**
     * \u9009\u62e9\u7684\u6570\u636e\u96c6\u5408
     * <pre><code>
     * var list = new List.SimpleList({
     *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;',
     *   idField : 'value',
     *   render : '#t1',
     *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
     * });
     * list.render();
     * </code></pre>
     * @cfg {Array} items
     */
    /**
     * \u9009\u62e9\u7684\u6570\u636e\u96c6\u5408
     * <pre><code>
     *  list.set('items',items); //\u5217\u8868\u4f1a\u76f4\u63a5\u66ff\u6362\u5185\u5bb9
     *  //\u7b49\u540c\u4e8e 
     *  list.clearItems();
     *  list.addItems(items);
     * </code></pre>
     * @type {Array}
     */
    items:{
      view : true
    },
    /**
     * \u9009\u9879\u7684\u9ed8\u8ba4key\u503c
     * @cfg {String} [idField = 'id']
     */
    idField : {
      value : 'id'
    },
    /**
     * \u5217\u8868\u9879\u7684\u9ed8\u8ba4\u6a21\u677f,\u4ec5\u5728\u521d\u59cb\u5316\u65f6\u4f20\u5165\u3002
     * @type {String}
     * @ignore
     */
    itemTpl : {
      view : true
    },
    /**
     * \u5217\u8868\u9879\u7684\u6e32\u67d3\u51fd\u6570\uff0c\u5e94\u5bf9\u5217\u8868\u9879\u4e4b\u95f4\u6709\u5f88\u591a\u5dee\u5f02\u65f6
     * <pre><code>
     * var list = new List.SimpleList({
     *   itemTplRender : function(item){
     *     if(item.type == '1'){
     *       return '&lt;li&gt;&lt;img src="xxx.jpg"/&gt;'+item.text+'&lt;/li&gt;'
     *     }else{
     *       return '&lt;li&gt;item.text&lt;/li&gt;'
     *     }
     *   },
     *   idField : 'value',
     *   render : '#t1',
     *   items : [{value : '1',text : '1',type : '0'},{value : '2',text : '2',type : '1'}]
     * });
     * list.render();
     * </code></pre>
     * @type {Function}
     */
    itemTplRender : {
      view : true
    },
    /**
     * \u5b50\u63a7\u4ef6\u5404\u4e2a\u72b6\u6001\u9ed8\u8ba4\u91c7\u7528\u7684\u6837\u5f0f
     * <pre><code>
     * var list = new List.SimpleList({
     *   render : '#t1',
     *   itemStatusCls : {
     *     selected : 'active', //\u9ed8\u8ba4\u6837\u5f0f\u4e3alist-item-selected,\u73b0\u5728\u53d8\u6210'active'
     *     hover : 'hover' //\u9ed8\u8ba4\u6837\u5f0f\u4e3alist-item-hover,\u73b0\u5728\u53d8\u6210'hover'
     *   },
     *   items : [{id : '1',text : '1',type : '0'},{id : '2',text : '2',type : '1'}]
     * });
     * list.render();
     * </code></pre>
     * see {@link BUI.Component.Controller#property-statusCls}
     * @type {Object}
     */
    itemStatusCls : {
      view : true,
      value : {}
    },
    events : {

      value : {
        /**
         * \u9009\u9879\u70b9\u51fb\u4e8b\u4ef6
         * @event
         * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
         * @param {BUI.Component.UIBase.ListItem} e.item \u70b9\u51fb\u7684\u9009\u9879
         * @param {HTMLElement} e.element \u9009\u9879\u4ee3\u8868\u7684DOM\u5bf9\u8c61
         * @param {HTMLElement} e.domTarget \u70b9\u51fb\u7684DOM\u5bf9\u8c61
         * @param {HTMLElement} e.domEvent \u70b9\u51fb\u7684\u539f\u751f\u4e8b\u4ef6\u5bf9\u8c61
         */
        'itemclick' : true
      }  
    }
  };

  list.prototype = {

    /**
     * \u83b7\u53d6\u9009\u9879\u7684\u6570\u91cf
     * <pre><code>
     *   var count = list.getItemCount();
     * </code></pre>
     * @return {Number} \u9009\u9879\u6570\u91cf
     */
    getItemCount : function () {
        return this.getItems().length;
    },
    /**
     * \u83b7\u53d6\u5b57\u6bb5\u7684\u503c
     * @param {*} item \u5b57\u6bb5\u540d
     * @param {String} field \u5b57\u6bb5\u540d
     * @return {*} \u5b57\u6bb5\u7684\u503c
     * @protected
     */
    getValueByField : function(item,field){

    },
    /**
     * \u83b7\u53d6\u6240\u6709\u9009\u9879\u503c\uff0c\u5982\u679c\u9009\u9879\u662f\u5b50\u63a7\u4ef6\uff0c\u5219\u662f\u6240\u6709\u5b50\u63a7\u4ef6
     * <pre><code>
     *   var items = list.getItems();
     *   //\u7b49\u540c
     *   list.get(items);
     * </code></pre>
     * @return {Array} \u9009\u9879\u503c\u96c6\u5408
     */
    getItems : function () {
      
    },
    /**
     * \u83b7\u53d6\u7b2c\u4e00\u9879
     * <pre><code>
     *   var item = list.getFirstItem();
     *   //\u7b49\u540c
     *   list.getItemAt(0);
     * </code></pre>
     * @return {Object|BUI.Component.Controller} \u9009\u9879\u503c\uff08\u5b50\u63a7\u4ef6\uff09
     */
    getFirstItem : function () {
      return this.getItemAt(0);
    },
    /**
     * \u83b7\u53d6\u6700\u540e\u4e00\u9879
     * <pre><code>
     *   var item = list.getLastItem();
     *   //\u7b49\u540c
     *   list.getItemAt(list.getItemCount()-1);
     * </code></pre>
     * @return {Object|BUI.Component.Controller} \u9009\u9879\u503c\uff08\u5b50\u63a7\u4ef6\uff09
     */
    getLastItem : function () {
      return this.getItemAt(this.getItemCount() - 1);
    },
    /**
     * \u901a\u8fc7\u7d22\u5f15\u83b7\u53d6\u9009\u9879\u503c\uff08\u5b50\u63a7\u4ef6\uff09
     * <pre><code>
     *   var item = list.getItemAt(0); //\u83b7\u53d6\u7b2c1\u4e2a
     *   var item = list.getItemAt(2); //\u83b7\u53d6\u7b2c3\u4e2a
     * </code></pre>
     * @param  {Number} index \u7d22\u5f15\u503c
     * @return {Object|BUI.Component.Controller}  \u9009\u9879\uff08\u5b50\u63a7\u4ef6\uff09
     */
    getItemAt : function  (index) {
      return this.getItems()[index] || null;
    },
    /**
     * \u901a\u8fc7Id\u83b7\u53d6\u9009\u9879\uff0c\u5982\u679c\u662f\u6539\u53d8\u4e86idField\u5219\u901a\u8fc7\u6539\u53d8\u7684idField\u6765\u67e5\u627e\u9009\u9879
     * <pre><code>
     *   //\u5982\u679cidField = 'id'
     *   var item = list.getItem('2'); 
     *   //\u7b49\u540c\u4e8e
     *   list.findItemByField('id','2');
     *
     *   //\u5982\u679cidField = 'value'
     *   var item = list.getItem('2'); 
     *   //\u7b49\u540c\u4e8e
     *   list.findItemByField('value','2');
     * </code></pre>
     * @param {String} id \u7f16\u53f7
     * @return {Object|BUI.Component.Controller} \u9009\u9879\uff08\u5b50\u63a7\u4ef6\uff09
     */
    getItem : function(id){
      var field = this.get('idField');
      return this.findItemByField(field,id);
    },
    /**
     * \u8fd4\u56de\u6307\u5b9a\u9879\u7684\u7d22\u5f15
     * <pre><code>
     * var index = list.indexOf(item); //\u8fd4\u56de\u7d22\u5f15\uff0c\u4e0d\u5b58\u5728\u5219\u8fd4\u56de-1
     * </code></pre>
     * @param  {Object|BUI.Component.Controller} \u9009\u9879
     * @return {Number}   \u9879\u7684\u7d22\u5f15\u503c
     */
    indexOfItem : function(item){
      return BUI.Array.indexOf(item,this.getItems());
    },
    /**
     * \u6dfb\u52a0\u591a\u6761\u9009\u9879
     * <pre><code>
     * var items = [{id : '1',text : '1'},{id : '2',text : '2'}];
     * list.addItems(items);
     * </code></pre>
     * @param {Array} items \u8bb0\u5f55\u96c6\u5408\uff08\u5b50\u63a7\u4ef6\u914d\u7f6e\u9879\uff09
     */
    addItems : function (items) {
      var _self = this;
      BUI.each(items,function (item) {
          _self.addItem(item);
      });
    },
    /**
     * \u63d2\u5165\u591a\u6761\u8bb0\u5f55
     * <pre><code>
     * var items = [{id : '1',text : '1'},{id : '2',text : '2'}];
     * list.addItemsAt(items,0); // \u5728\u6700\u524d\u9762\u63d2\u5165
     * list.addItemsAt(items,2); //\u7b2c\u4e09\u4e2a\u4f4d\u7f6e\u63d2\u5165
     * </code></pre>
     * @param  {Array} items \u591a\u6761\u8bb0\u5f55
     * @param  {Number} start \u8d77\u59cb\u4f4d\u7f6e
     */
    addItemsAt : function(items,start){
      var _self = this;
      BUI.each(items,function (item,index) {
        _self.addItemAt(item,start + index);
      });
    },
    /**
     * \u66f4\u65b0\u5217\u8868\u9879\uff0c\u4fee\u6539\u9009\u9879\u503c\u540e\uff0cDOM\u8ddf\u968f\u53d8\u5316
     * <pre><code>
     *   var item = list.getItem('2');
     *   list.text = '\u65b0\u5185\u5bb9'; //\u6b64\u65f6\u5bf9\u5e94\u7684DOM\u4e0d\u4f1a\u53d8\u5316
     *   list.updateItem(item); //DOM\u8fdb\u884c\u76f8\u5e94\u7684\u53d8\u5316
     * </code></pre>
     * @param  {Object} item \u9009\u9879\u503c
     */
    updateItem : function(item){

    },
    /**
     * \u6dfb\u52a0\u9009\u9879,\u6dfb\u52a0\u5728\u63a7\u4ef6\u6700\u540e
     * 
     * <pre><code>
     * list.addItem({id : '3',text : '3',type : '0'});
     * </code></pre>
     * 
     * @param {Object|BUI.Component.Controller} item \u9009\u9879\uff0c\u5b50\u63a7\u4ef6\u914d\u7f6e\u9879\u3001\u5b50\u63a7\u4ef6
     * @return {Object|BUI.Component.Controller} \u5b50\u63a7\u4ef6\u6216\u8005\u9009\u9879\u8bb0\u5f55
     */
    addItem : function (item) {
       return this.addItemAt(item,this.getItemCount());
    },
    /**
     * \u5728\u6307\u5b9a\u4f4d\u7f6e\u6dfb\u52a0\u9009\u9879
     * <pre><code>
     * list.addItemAt({id : '3',text : '3',type : '0'},0); //\u7b2c\u4e00\u4e2a\u4f4d\u7f6e
     * </code></pre>
     * @param {Object|BUI.Component.Controller} item \u9009\u9879\uff0c\u5b50\u63a7\u4ef6\u914d\u7f6e\u9879\u3001\u5b50\u63a7\u4ef6
     * @param {Number} index \u7d22\u5f15
     * @return {Object|BUI.Component.Controller} \u5b50\u63a7\u4ef6\u6216\u8005\u9009\u9879\u8bb0\u5f55
     */
    addItemAt : function(item,index) {

    },
    /**
      * \u6839\u636e\u5b57\u6bb5\u67e5\u627e\u6307\u5b9a\u7684\u9879
      * @param {String} field \u5b57\u6bb5\u540d
      * @param {Object} value \u5b57\u6bb5\u503c
      * @return {Object} \u67e5\u8be2\u51fa\u6765\u7684\u9879\uff08\u4f20\u5165\u7684\u8bb0\u5f55\u6216\u8005\u5b50\u63a7\u4ef6\uff09
      * @protected
    */
    findItemByField:function(field,value){

    },
    /**
     * 
     * \u83b7\u53d6\u6b64\u9879\u663e\u793a\u7684\u6587\u672c  
     * @param {Object} item \u83b7\u53d6\u8bb0\u5f55\u663e\u793a\u7684\u6587\u672c
     * @protected            
     */
    getItemText:function(item){

    },
    /**
     * \u6e05\u9664\u6240\u6709\u9009\u9879,\u4e0d\u7b49\u540c\u4e8e\u5220\u9664\u5168\u90e8\uff0c\u6b64\u65f6\u4e0d\u4f1a\u89e6\u53d1\u5220\u9664\u4e8b\u4ef6
     * <pre><code>
     * list.clearItems(); 
     * //\u7b49\u540c\u4e8e
     * list.set('items',items);
     * </code></pre>
     */
    clearItems : function(){
      var _self = this,
          items = _self.getItems();
      items.splice(0);
      _self.clearControl();
    },
    /**
     * \u5220\u9664\u9009\u9879
     * <pre><code>
     * var item = list.getItem('1');
     * list.removeItem(item);
     * </code></pre>
     * @param {Object|BUI.Component.Controller} item \u9009\u9879\uff08\u5b50\u63a7\u4ef6\uff09
     */
    removeItem : function (item) {

    },
    /**
     * \u79fb\u9664\u9009\u9879\u96c6\u5408
     * <pre><code>
     * var items = list.getSelection();
     * list.removeItems(items);
     * </code></pre>
     * @param  {Array} items \u9009\u9879\u96c6\u5408
     */
    removeItems : function(items){
      var _self = this;

      BUI.each(items,function(item){
          _self.removeItem(item);
      });
    },
    /**
     * \u901a\u8fc7\u7d22\u5f15\u5220\u9664\u9009\u9879
     * <pre><code>
     * list.removeItemAt(0); //\u5220\u9664\u7b2c\u4e00\u4e2a
     * </code></pre>
     * @param  {Number} index \u7d22\u5f15
     */
    removeItemAt : function (index) {
      this.removeItem(this.getItemAt(index));
    },
    /**
     * @protected
     * @template
     * \u6e05\u9664\u6240\u6709\u7684\u5b50\u63a7\u4ef6\u6216\u8005\u5217\u8868\u9879\u7684DOM
     */
    clearControl : function(){

    }
  }

  

  

  function clearSelected(item){
    if(item.selected){
        item.selected = false;
    }
    if(item.set){
        item.set('selected',false);
    }
  }

  function beforeAddItem(self,item){

    var c = item.isController ? item.getAttrVals() : item,
      defaultTpl = self.get('itemTpl'),
      defaultStatusCls = self.get('itemStatusCls'),
      defaultTplRender = self.get('itemTplRender');

    //\u914d\u7f6e\u9ed8\u8ba4\u6a21\u677f
    if(defaultTpl && !c.tpl){
      setItemAttr(item,'tpl',defaultTpl);
      //  c.tpl = defaultTpl;
    }
    //\u914d\u7f6e\u9ed8\u8ba4\u6e32\u67d3\u51fd\u6570
    if(defaultTplRender && !c.tplRender){
      setItemAttr(item,'tplRender',defaultTplRender);
      //c.tplRender = defaultTplRender;
    }
    //\u914d\u7f6e\u9ed8\u8ba4\u72b6\u6001\u6837\u5f0f
    if(defaultStatusCls){
      var statusCls = c.statusCls || item.isController ? item.get('statusCls') : {};
      BUI.each(defaultStatusCls,function(v,k){
        if(v && !statusCls[k]){
            statusCls[k] = v;
        }
      });
      setItemAttr(item,'statusCls',statusCls)
      //item.statusCls = statusCls;
    }
   // clearSelected(item);
  }
  function setItemAttr(item,name,val){
    if(item.isController){
      item.set(name,val);
    }else{
      item[name] = val;
    }
  }
  
  /**
  * @class BUI.Component.UIBase.ChildList
  * \u9009\u4e2d\u5176\u4e2d\u7684DOM\u7ed3\u6784
  * @extends BUI.Component.UIBase.List
  * @mixins BUI.Component.UIBase.Selection
  */
  var childList = function(){
    this.__init();
  };

  childList.ATTRS = BUI.merge(true,list.ATTRS,Selection.ATTRS,{
    items : {
      sync : false
    },
    /**
     * \u914d\u7f6e\u7684items \u9879\u662f\u5728\u521d\u59cb\u5316\u65f6\u4f5c\u4e3achildren
     * @protected
     * @type {Boolean}
     */
    autoInitItems : {
      value : true
    }
  });

  BUI.augment(childList,list,Selection,{
    //\u521d\u59cb\u5316\uff0c\u5c06items\u8f6c\u6362\u6210children
    __init : function(){
      var _self = this,
        items = _self.get('items');
      if(items && _self.get('autoInitItems')){
        _self.addItems(items);
      } 
      _self.on('beforeRenderUI',function(){
        _self._beforeRenderUI();
      });
    },
    _uiSetItems : function (items) {
      var _self = this;
      //\u6e05\u7406\u5b50\u63a7\u4ef6
      _self.clearControl();
      _self.addItems(items);
    },
    //\u6e32\u67d3\u5b50\u63a7\u4ef6
    _beforeRenderUI : function(){
      var _self = this,
        children = _self.get('children'),
        items = _self.get('items');   
      BUI.each(children,function(item){
        beforeAddItem(_self,item);
      });
    },
    //\u7ed1\u5b9a\u4e8b\u4ef6
    __bindUI : function(){
      var _self = this,
        selectedEvent = _self.get('selectedEvent');
     
      _self.on(selectedEvent,function(e){
        var item = e.target;
        if(item.get('selectable')){
            if(!item.get('selected')){
              _self.setSelected(item);
            }else if(_self.get('multipleSelect')){
              _self.clearSelected(item);
            }
        }
      });

      _self.on('click',function(e){
        if(e.target !== _self){
          _self.fire('itemclick',{item:e.target,domTarget : e.domTarget,domEvent : e});
        }
      });
      _self.on('beforeAddChild',function(ev){
        beforeAddItem(_self,ev.child);
      });
      _self.on('beforeRemoveChild',function(ev){
        var item = ev.child,
          selected = item.get('selected');
        //\u6e05\u7406\u9009\u4e2d\u72b6\u6001
        if(selected){
          if(_self.get('multipleSelect')){
            _self.clearSelected(item);
          }else{
            _self.setSelected(null);
          }
        }
        item.set('selected',false);
      });
    },
    /**
     * @protected
     * @override
     * \u6e05\u9664\u8005\u5217\u8868\u9879\u7684DOM
     */
    clearControl : function(){
      this.removeChildren(true);
    },
    /**
     * \u83b7\u53d6\u6240\u6709\u5b50\u63a7\u4ef6
     * @return {Array} \u5b50\u63a7\u4ef6\u96c6\u5408
     * @override
     */
    getItems : function () {
      return this.get('children');
    },
    /**
     * \u66f4\u65b0\u5217\u8868\u9879
     * @param  {Object} item \u9009\u9879\u503c
     */
    updateItem : function(item){
      var _self = this,
        idField = _self.get('idField'),
        element = _self.findItemByField(idField,item[idField]);
      if(element){
        element.setTplContent();
      }
      return element;
    },
    /**
     * \u5220\u9664\u9879,\u5b50\u63a7\u4ef6\u4f5c\u4e3a\u9009\u9879
     * @param  {Object} element \u5b50\u63a7\u4ef6
     */
    removeItem : function (item) {
      var _self = this,
        idField = _self.get('idField');
      if(!(item instanceof BUI.Component.Controller)){
        item = _self.findItemByField(idField,item[idField]);
      }
      this.removeChild(item,true);
    },
    /**
     * \u5728\u6307\u5b9a\u4f4d\u7f6e\u6dfb\u52a0\u9009\u9879,\u6b64\u5904\u9009\u9879\u6307\u5b50\u63a7\u4ef6
     * @param {Object|BUI.Component.Controller} item \u5b50\u63a7\u4ef6\u914d\u7f6e\u9879\u3001\u5b50\u63a7\u4ef6
     * @param {Number} index \u7d22\u5f15
     * @return {Object|BUI.Component.Controller} \u5b50\u63a7\u4ef6
     */
    addItemAt : function(item,index) {
      return this.addChild(item,index);
    },
    findItemByField : function(field,value,root){

      root = root || this;
      var _self = this,
        children = root.get('children'),
        result = null;
      $(children).each(function(index,item){
        if(item.get(field) == value){
            result = item;
        }else if(item.get('children').length){
            result = _self.findItemByField(field,value,item);
        }
        if(result){
          return false;
        }
      });
      return result;
    },
    getItemText : function(item){
      return item.get('el').text();
    },
    getValueByField : function(item,field){
        return item && item.get(field);
    },
    /**
     * @protected
     * @ignore
     */
    setItemSelectedStatus : function(item,selected){
      var _self = this,
        method = selected ? 'addClass' : 'removeClass',
        element = null;

      if(item){
        item.set('selected',selected);
        element = item.get('el');
      }
      _self.afterSelected(item,selected,element);
    },
    /**
     * \u9009\u9879\u662f\u5426\u88ab\u9009\u4e2d
     * @override
     * @param  {*}  item \u9009\u9879
     * @return {Boolean}  \u662f\u5426\u9009\u4e2d
     */
    isItemSelected : function(item){
        return item ? item.get('selected') : false;
    },
    /**
     * \u8bbe\u7f6e\u6240\u6709\u9009\u9879\u9009\u4e2d
     * @override
     */
    setAllSelection : function(){
      var _self = this,
        items = _self.getItems();
      _self.setSelection(items);
    },
    /**
     * \u83b7\u53d6\u9009\u4e2d\u7684\u9879\u7684\u503c
     * @return {Array} 
     * @override
     * @ignore
     */
    getSelection : function(){
        var _self = this,
            items = _self.getItems(),
            rst = [];
        BUI.each(items,function(item){
            if(_self.isItemSelected(item)){
                rst.push(item);
            }
           
        });
        return rst;
    }
  });

  list.ChildList = childList;

  return list;
});

/**
 * @ignore
 * 2013-1-22 
 *   \u66f4\u6539\u663e\u793a\u6570\u636e\u7684\u65b9\u5f0f\uff0c\u4f7f\u7528 _uiSetItems
 *//**
 * @fileOverview \u5b50\u63a7\u4ef6\u7684\u9ed8\u8ba4\u914d\u7f6e\u9879
 * @ignore
 */

define('bui/component/uibase/childcfg',function (require) {

  /**
   * @class BUI.Component.UIBase.ChildCfg
   * \u5b50\u63a7\u4ef6\u9ed8\u8ba4\u914d\u7f6e\u9879\u7684\u6269\u5c55\u7c7b
   */
  var childCfg = function(config){
    this._init();
  };

  childCfg.ATTRS = {
    /**
     * \u9ed8\u8ba4\u7684\u5b50\u63a7\u4ef6\u914d\u7f6e\u9879,\u5728\u521d\u59cb\u5316\u63a7\u4ef6\u65f6\u914d\u7f6e
     * 
     *  - \u5982\u679c\u63a7\u4ef6\u5df2\u7ecf\u6e32\u67d3\u8fc7\uff0c\u6b64\u914d\u7f6e\u9879\u65e0\u6548\uff0c
     *  - \u63a7\u4ef6\u751f\u6210\u540e\uff0c\u4fee\u6539\u6b64\u914d\u7f6e\u9879\u65e0\u6548\u3002
     * <pre><code>
     *   var control = new Control({
     *     defaultChildCfg : {
     *       tpl : '&lt;li&gt;{text}&lt;/li&gt;',
     *       xclass : 'a-b'
     *     }
     *   });
     * </code></pre>
     * @cfg {Object} defaultChildCfg
     */
    /**
     * @ignore
     */
    defaultChildCfg : {

    }
  };

  childCfg.prototype = {

    _init : function(){
      var _self = this,
        defaultChildCfg = _self.get('defaultChildCfg');
      if(defaultChildCfg){
        _self.on('beforeAddChild',function(ev){
          var child = ev.child;
          if($.isPlainObject(child)){
            BUI.each(defaultChildCfg,function(v,k){
              if(!child[k]){
                child[k] = v;
              }
            });
          }
        });
      }
    }

  };

  return childCfg;

});/**
 * @fileOverview \u4f9d\u8d56\u6269\u5c55\uff0c\u7528\u4e8e\u89c2\u5bdf\u8005\u6a21\u5f0f\u4e2d\u7684\u89c2\u5bdf\u8005
 * @ignore
 */

define('bui/component/uibase/depends',['bui/component/manage'],function (require) {
  
  var regexp = /^#(.*):(.*)$/,
    Manager = require('bui/component/manage');

  //\u83b7\u53d6\u4f9d\u8d56\u4fe1\u606f
  function getDepend(name){

    var arr = regexp.exec(name),
      id = arr[1],
      eventType = arr[2],
      source = getSource(id);
    return {
      source : source,
      eventType: eventType
    };
  }

  //\u7ed1\u5b9a\u4f9d\u8d56
  function bindDepend(self,name,action){
    var depend = getDepend(name),
      source = depend.source,
      eventType = depend.eventType,
      callbak;
    if(source && action && eventType){

      if(BUI.isFunction(action)){//\u5982\u679caction\u662f\u4e00\u4e2a\u51fd\u6570
        callbak = action;
      }else if(BUI.isArray(action)){//\u5982\u679c\u662f\u4e00\u4e2a\u6570\u7ec4\uff0c\u6784\u5efa\u4e00\u4e2a\u56de\u8c03\u51fd\u6570
        callbak = function(){
          BUI.each(action,function(methodName){
            if(self[methodName]){
              self[methodName]();
            }
          });
        }
      }
    }
    if(callbak){
      depend.callbak = callbak;
      source.on(eventType,callbak);
      return depend;
    }
    return null;
  }
  //\u53bb\u9664\u4f9d\u8d56
  function offDepend(depend){
    var source = depend.source,
      eventType = depend.eventType,
      callbak = depend.callbak;
    source.off(eventType,callbak);
  }

  //\u83b7\u53d6\u7ed1\u5b9a\u7684\u4e8b\u4ef6\u6e90
  function getSource(id){
    var control = Manager.getComponent(id);
    if(!control){
      control = $('#' + id);
      if(!control.length){
        control = null;
      }
    }
    return control;
  }

  /**
   * @class BUI.Component.UIBase.Depends
   * \u4f9d\u8d56\u4e8b\u4ef6\u6e90\u7684\u6269\u5c55
   * <pre><code>
   *       var control = new Control({
   *         depends : {
   *           '#btn:click':['toggle'],//\u5f53\u70b9\u51fbid\u4e3a'btn'\u7684\u6309\u94ae\u65f6\uff0c\u6267\u884c control \u7684toggle\u65b9\u6cd5
   *           '#checkbox1:checked':['show'],//\u5f53\u52fe\u9009checkbox\u65f6\uff0c\u663e\u793a\u63a7\u4ef6
   *           '#menu:click',function(){}
   *         }
   *       });
   * </code></pre>
   */
  function Depends (){

  };

  Depends.ATTRS = {
    /**
     * \u63a7\u4ef6\u7684\u4f9d\u8d56\u4e8b\u4ef6\uff0c\u662f\u4e00\u4e2a\u6570\u7ec4\u96c6\u5408\uff0c\u6bcf\u4e00\u6761\u8bb0\u5f55\u662f\u4e00\u4e2a\u4f9d\u8d56\u5173\u7cfb<br/>
     * \u4e00\u4e2a\u4f9d\u8d56\u662f\u6ce8\u518c\u4e00\u4e2a\u4e8b\u4ef6\uff0c\u6240\u4ee5\u9700\u8981\u5728\u4e00\u4e2a\u4f9d\u8d56\u4e2d\u63d0\u4f9b\uff1a
     * <ol>
     * <li>\u7ed1\u5b9a\u6e90\uff1a\u4e3a\u4e86\u65b9\u4fbf\u914d\u7f6e\uff0c\u6211\u4eec\u4f7f\u7528 #id\u6765\u6307\u5b9a\u7ed1\u5b9a\u6e90\uff0c\u53ef\u4ee5\u4f7f\u63a7\u4ef6\u7684ID\uff08\u53ea\u652f\u6301\u7ee7\u627f{BUI.Component.Controller}\u7684\u63a7\u4ef6\uff09\uff0c\u4e5f\u53ef\u4ee5\u662fDOM\u7684id</li>
     * <li>\u4e8b\u4ef6\u540d\uff1a\u4e8b\u4ef6\u540d\u662f\u4e00\u4e2a\u4f7f\u7528":"\u4e3a\u524d\u7f00\u7684\u5b57\u7b26\u4e32\uff0c\u4f8b\u5982 "#id:change",\u5373\u76d1\u542cchange\u4e8b\u4ef6</li>
     * <li>\u89e6\u53d1\u7684\u65b9\u6cd5\uff1a\u53ef\u4ee5\u662f\u4e00\u4e2a\u6570\u7ec4\uff0c\u5982["disable","clear"],\u6570\u7ec4\u91cc\u9762\u662f\u63a7\u4ef6\u7684\u65b9\u6cd5\u540d\uff0c\u4e5f\u53ef\u4ee5\u662f\u4e00\u4e2a\u56de\u8c03\u51fd\u6570</li>
     * </ol>
     * <pre><code>
     *       var control = new Control({
     *         depends : {
     *           '#btn:click':['toggle'],//\u5f53\u70b9\u51fbid\u4e3a'btn'\u7684\u6309\u94ae\u65f6\uff0c\u6267\u884c control \u7684toggle\u65b9\u6cd5
     *           '#checkbox1:checked':['show'],//\u5f53\u52fe\u9009checkbox\u65f6\uff0c\u663e\u793a\u63a7\u4ef6
     *           '#menu:click',function(){}
     *         }
     *       });
     * </code></pre>
     * ** \u6ce8\u610f\uff1a** \u8fd9\u4e9b\u4f9d\u8d56\u9879\u662f\u5728\u63a7\u4ef6\u6e32\u67d3\uff08render\uff09\u540e\u8fdb\u884c\u7684\u3002         
     * @type {Object}
     */
    depends : {
      value : {}
    },
    /**
     * @private
     * \u4f9d\u8d56\u7684\u6620\u5c04\u96c6\u5408
     * @type {Object}
     */
    dependencesMap : {
      value : {}
    }
  };

  Depends.prototype = {

    __syncUI : function(){
      this.initDependences();
    },
    /**
     * \u521d\u59cb\u5316\u4f9d\u8d56\u9879
     * @protected
     */
    initDependences : function(){
      var _self = this,
        depends = _self.get('depends');
      BUI.each(depends,function(action,name){
        _self.addDependence(name,action);
      });
    },
    /**
     * \u6dfb\u52a0\u4f9d\u8d56\uff0c\u5982\u679c\u5df2\u7ecf\u6709\u540c\u540d\u7684\u4e8b\u4ef6\uff0c\u5219\u79fb\u9664\uff0c\u518d\u6dfb\u52a0
     * <pre><code>
     *  form.addDependence('#btn:click',['toggle']); //\u5f53\u6309\u94ae#btn\u70b9\u51fb\u65f6\uff0c\u8868\u5355\u4ea4\u66ff\u663e\u793a\u9690\u85cf
     *
     *  form.addDependence('#btn:click',function(){//\u5f53\u6309\u94ae#btn\u70b9\u51fb\u65f6\uff0c\u8868\u5355\u4ea4\u66ff\u663e\u793a\u9690\u85cf
     *   //TO DO
     *  }); 
     * </code></pre>
     * @param {String} name \u4f9d\u8d56\u9879\u7684\u540d\u79f0
     * @param {Array|Function} action \u4f9d\u8d56\u9879\u7684\u4e8b\u4ef6
     */
    addDependence : function(name,action){
      var _self = this,
        dependencesMap = _self.get('dependencesMap'),
        depend;
      _self.removeDependence(name);
      depend = bindDepend(_self,name,action)
      if(depend){
        dependencesMap[name] = depend;
      }
    },
    /**
     * \u79fb\u9664\u4f9d\u8d56
     * <pre><code>
     *  form.removeDependence('#btn:click'); //\u5f53\u6309\u94ae#btn\u70b9\u51fb\u65f6\uff0c\u8868\u5355\u4e0d\u5728\u76d1\u542c
     * </code></pre>
     * @param  {String} name \u4f9d\u8d56\u540d\u79f0
     */
    removeDependence : function(name){
      var _self = this,
        dependencesMap = _self.get('dependencesMap'),
        depend = dependencesMap[name];
      if(depend){
        offDepend(depend);
        delete dependencesMap[name];
      }
    },
    /**
     * \u6e05\u9664\u6240\u6709\u7684\u4f9d\u8d56
     * <pre><code>
     *  form.clearDependences();
     * </code></pre>
     */
    clearDependences : function(){
      var _self = this,
        map = _self.get('dependencesMap');
      BUI.each(map,function(depend,name){
        offDepend(depend);
      });
      _self.set('dependencesMap',{});
    },
    __destructor : function(){
      this.clearDependences();
    }

  };
  
  return Depends;
});/**
 * @fileOverview bindable extension class.
 * @author dxq613@gmail.com
 * @ignore
 */
define('bui/component/uibase/bindable',function(){
	
	/**
		* bindable extension class.
		* <pre><code>
		*   BUI.use(['bui/list','bui/data','bui/mask'],function(List,Data,Mask){
		*     var store = new Data.Store({
		*       url : 'data/xx.json'
		*     });
		*   	var list = new List.SimpleList({
		*  	    render : '#l1',
		*  	    store : store,
		*  	    loadMask : new Mask.LoadMask({el : '#t1'})
		*     });
		*
		*     list.render();
		*     store.load();
		*   });
		* </code></pre>
		* \u4f7f\u63a7\u4ef6\u7ed1\u5b9astore\uff0c\u5904\u7406store\u7684\u4e8b\u4ef6 {@link BUI.Data.Store}
		* @class BUI.Component.UIBase.Bindable
		*/
	function bindable(){
		
	}

	bindable.ATTRS = 
	{
		/**
		* \u7ed1\u5b9a {@link BUI.Data.Store}\u7684\u4e8b\u4ef6
		* <pre><code>
		*  var store = new Data.Store({
		*   url : 'data/xx.json',
		*   autoLoad : true
		*  });
		*
		*  var list = new List.SimpleList({
		*  	 render : '#l1',
		*  	 store : store
		*  });
		*
		*  list.render();
		* </code></pre>
		* @cfg {BUI.Data.Store} store
		*/
		/**
		* \u7ed1\u5b9a {@link BUI.Data.Store}\u7684\u4e8b\u4ef6
		* <pre><code>
		*  var store = list.get('store');
		* </code></pre>
		* @type {BUI.Data.Store}
		*/
		store : {
			
		},
		/**
		* \u52a0\u8f7d\u6570\u636e\u65f6\uff0c\u662f\u5426\u663e\u793a\u7b49\u5f85\u52a0\u8f7d\u7684\u5c4f\u853d\u5c42
		* <pre><code>
		*   BUI.use(['bui/list','bui/data','bui/mask'],function(List,Data,Mask){
		*     var store = new Data.Store({
		*       url : 'data/xx.json'
		*     });
		*   	var list = new List.SimpleList({
		*  	    render : '#l1',
		*  	    store : store,
		*  	    loadMask : new Mask.LoadMask({el : '#t1'})
		*     });
		*
		*     list.render();
		*     store.load();
		*   });
		* </code></pre>
		* @cfg {Boolean|Object} loadMask
		*/
		/**
		* \u52a0\u8f7d\u6570\u636e\u65f6\uff0c\u662f\u5426\u663e\u793a\u7b49\u5f85\u52a0\u8f7d\u7684\u5c4f\u853d\u5c42
		* @type {Boolean|Object} 
		* @ignore
		*/
		loadMask : {
			value : false
		}
	};


	BUI.augment(bindable,
	/**
	* @lends BUI.Data.Bindable.prototype
	* @ignore
	*/	
	{

		__bindUI : function(){
			var _self = this,
				store = _self.get('store'),
				loadMask = _self.get('loadMask');
			if(!store){
				return;
			}
			store.on('beforeload',function(e){
				_self.onBeforeLoad(e);
				if(loadMask && loadMask.show){
					loadMask.show();
				}
			});
			store.on('load',function(e){
				_self.onLoad(e);
				if(loadMask && loadMask.hide){
					loadMask.hide();
				}
			});
			store.on('exception',function(e){
				_self.onException(e);
				if(loadMask && loadMask.hide){
					loadMask.hide();
				}
			});
			store.on('add',function(e){
				_self.onAdd(e);
			});
			store.on('remove',function(e){
				_self.onRemove(e);
			});
			store.on('update',function(e){
				_self.onUpdate(e);
			});
			store.on('localsort',function(e){
				_self.onLocalSort(e);
			});
		},
		__syncUI : function(){
			var _self = this,
				store = _self.get('store');
			if(!store){
				return;
			}
			if(store.hasData()){
				_self.onLoad();
			}
		},
		/**
		* @protected
    * @template
		* before store load data
		* @param {Object} e The event object
		* @see {@link BUI.Data.Store#event-beforeload}
		*/
		onBeforeLoad : function(e){

		},
		/**
		* @protected
    * @template
		* after store load data
		* @param {Object} e The event object
		* @see {@link BUI.Data.Store#event-load}
		*/
		onLoad : function(e){
			
		},
		/**
		* @protected
    * @template
		* occurred exception when store is loading data
		* @param {Object} e The event object
		* @see {@link BUI.Data.Store#event-exception}
		*/
		onException : function(e){
			
		},
		/**
		* @protected
    * @template
		* after added data to store
		* @param {Object} e The event object
		* @see {@link BUI.Data.Store#event-add}
		*/
		onAdd : function(e){
		
		},
		/**
		* @protected
    * @template
		* after remvoed data to store
		* @param {Object} e The event object
		* @see {@link BUI.Data.Store#event-remove}
		*/
		onRemove : function(e){
		
		},
		/**
		* @protected
    * @template
		* after updated data to store
		* @param {Object} e The event object
		* @see {@link BUI.Data.Store#event-update}
		*/
		onUpdate : function(e){
		
		},
		/**
		* @protected
    * @template
		* after local sorted data to store
		* @param {Object} e The event object
		* @see {@link BUI.Data.Store#event-localsort}
		*/
		onLocalSort : function(e){
			
		}
	});

	return bindable;
});/**
 * @fileOverview  \u63a7\u4ef6\u7684\u89c6\u56fe\u5c42
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */
define('bui/component/view',['bui/component/manage','bui/component/uibase'],function(require){

  var win = window,
    Manager = require('bui/component/manage'),
    UIBase = require('bui/component/uibase'),//BUI.Component.UIBase,
    doc = document;
    
    /**
     * \u63a7\u4ef6\u7684\u89c6\u56fe\u5c42\u57fa\u7c7b
     * @class BUI.Component.View
     * @protected
     * @extends BUI.Component.UIBase
     * @mixins BUI.Component.UIBase.TplView
     */
    var View = UIBase.extend([UIBase.TplView],
    {

        /**
         * Get all css class name to be applied to the root element of this component for given state.
         * the css class names are prefixed with component name.
         * @param {String} [state] This component's state info.
         */
        getComponentCssClassWithState: function (state) {
            var self = this,
                componentCls = self.get('ksComponentCss');
            state = state || '';
            return self.getCssClassWithPrefix(componentCls.split(/\s+/).join(state + ' ') + state);
        },

        /**
         * Get full class name (with prefix) for current component
         * @param classes {String} class names without prefixCls. Separated by space.
         * @method
         * @return {String} class name with prefixCls
         * @private
         */
        getCssClassWithPrefix: Manager.getCssClassWithPrefix,

        /**
         * Returns the dom element which is responsible for listening keyboard events.
         * @return {jQuery}
         */
        getKeyEventTarget: function () {
            return this.get('el');
        },
        /**
         * Return the dom element into which child component to be rendered.
         * @return {jQuery}
         */
        getContentElement: function () {
            return this.get('contentEl') || this.get('el');
        },
        /**
         * \u83b7\u53d6\u72b6\u6001\u5bf9\u5e94\u7684css\u6837\u5f0f
         * @param  {String} name \u72b6\u6001\u540d\u79f0 \u4f8b\u5982\uff1ahover,disabled\u7b49\u7b49
         * @return {String} \u72b6\u6001\u6837\u5f0f
         */
        getStatusCls : function(name){
            var self = this,
                statusCls = self.get('statusCls'),
                cls = statusCls[name];
            if(!cls){
                cls = self.getComponentCssClassWithState('-' + name);
            }
            return cls;
        },
        /**
         * \u6e32\u67d3\u63a7\u4ef6
         * @protected
         */
        renderUI: function () {
            var self = this;

            // \u65b0\u5efa\u7684\u8282\u70b9\u624d\u9700\u8981\u6446\u653e\u5b9a\u4f4d,\u4e0d\u652f\u6301srcNode\u6a21\u5f0f
            if (!self.get('srcNode')) {
                var render = self.get('render'),
                    el = self.get('el'),
                    renderBefore = self.get('elBefore');
                if (renderBefore) {
                    el.insertBefore(renderBefore, undefined);
                } else if (render) {
                    el.appendTo(render, undefined);
                } else {
                    el.appendTo(doc.body, undefined);
                }
            }
        },
        /**
         * \u53ea\u8d1f\u8d23\u5efa\u7acb\u8282\u70b9\uff0c\u5982\u679c\u662f decorate \u8fc7\u6765\u7684\uff0c\u751a\u81f3\u5185\u5bb9\u4f1a\u4e22\u5931
         * @protected
         * \u901a\u8fc7 render \u6765\u91cd\u5efa\u539f\u6709\u7684\u5185\u5bb9
         */
        createDom: function () {
            var self = this,
                contentEl = self.get('contentEl'),
                el = self.get('el');
            if (!self.get('srcNode')) {

                el = $('<' + self.get('elTagName') + '>');

                if (contentEl) {
                    el.append(contentEl);
                }

                self.setInternal('el', el);   
            }
            
            el.addClass(self.getComponentCssClassWithState());
            if (!contentEl) {
                // \u6ca1\u53d6\u5230,\u8fd9\u91cc\u8bbe\u4e0b\u503c, uiSet \u65f6\u53ef\u4ee5 set('content')  \u53d6\u5230
                self.setInternal('contentEl', el);
            }
        },
        /**
         * \u8bbe\u7f6e\u9ad8\u4eae\u663e\u793a
         * @protected
         */
        _uiSetHighlighted: function (v) {
            var self = this,
                componentCls = self.getStatusCls('hover'),
                el = self.get('el');
            el[v ? 'addClass' : 'removeClass'](componentCls);
        },

        /**
         * \u8bbe\u7f6e\u7981\u7528
         * @protected
         */
        _uiSetDisabled: function (v) {
            var self = this,
                componentCls = self.getStatusCls('disabled'),
                el = self.get('el');
            el[v ? 'addClass' : 'removeClass'](componentCls)
                .attr('aria-disabled', v);
      
            //\u5982\u679c\u7981\u7528\u63a7\u4ef6\u65f6\uff0c\u5904\u4e8ehover\u72b6\u6001\uff0c\u5219\u6e05\u9664
            if(v && self.get('highlighted')){
            self.set('highlighted',false);
            }

            if (self.get('focusable')) {
                //\u4e0d\u80fd\u88ab tab focus \u5230
                self.getKeyEventTarget().attr('tabIndex', v ? -1 : 0);
            }
        },
        /**
         * \u8bbe\u7f6e\u6fc0\u6d3b\u72b6\u6001
         * @protected
         */
        _uiSetActive: function (v) {
            var self = this,
                componentCls = self.getStatusCls('active');
            self.get('el')[v ? 'addClass' : 'removeClass'](componentCls)
                .attr('aria-pressed', !!v);
        },
        /**
         * \u8bbe\u7f6e\u83b7\u5f97\u7126\u70b9
         * @protected
         */
        _uiSetFocused: function (v) {
            var self = this,
                el = self.get('el'),
                componentCls = self.getStatusCls('focused');
            el[v ? 'addClass' : 'removeClass'](componentCls);
        },
        /**
         * \u8bbe\u7f6e\u63a7\u4ef6\u6700\u5916\u5c42DOM\u7684\u5c5e\u6027
         * @protected
         */
        _uiSetElAttrs: function (attrs) {
            this.get('el').attr(attrs);
        },
        /**
         * \u8bbe\u7f6e\u5e94\u7528\u5230\u63a7\u4ef6\u6700\u5916\u5c42DOM\u7684css class
         * @protected
         */
        _uiSetElCls: function (cls) {
            this.get('el').addClass(cls);
        },
        /**
         * \u8bbe\u7f6e\u5e94\u7528\u5230\u63a7\u4ef6\u6700\u5916\u5c42DOM\u7684css style
         * @protected
         */
        _uiSetElStyle: function (style) {
            this.get('el').css(style);
        },
        /**
         * \u8bbe\u7f6e\u5e94\u7528\u5230\u63a7\u4ef6\u5bbd\u5ea6
         * @protected
         */
        _uiSetWidth: function (w) {
            this.get('el').width(w);
        },
        /**
         * \u8bbe\u7f6e\u5e94\u7528\u5230\u63a7\u4ef6\u9ad8\u5ea6
         * @protected
         */
        _uiSetHeight: function (h) {
            var self = this;
            self.get('el').height(h);
        },
        /**
         * \u8bbe\u7f6e\u5e94\u7528\u5230\u63a7\u4ef6\u7684\u5185\u5bb9
         * @protected
         */
        _uiSetContent: function (c) {
            var self = this, 
                el;
            // srcNode \u65f6\u4e0d\u91cd\u65b0\u6e32\u67d3 content
            // \u9632\u6b62\u5185\u90e8\u6709\u6539\u53d8\uff0c\u800c content \u5219\u662f\u8001\u7684 html \u5185\u5bb9
            if (self.get('srcNode') && !self.get('rendered')) {
            } else {
                el = self.get('contentEl');
                if (typeof c == 'string') {
                    el.html(c);
                } else if (c) {
                    el.empty().append(c);
                }
            }
        },
        /**
         * \u8bbe\u7f6e\u5e94\u7528\u5230\u63a7\u4ef6\u662f\u5426\u53ef\u89c1
         * @protected
         */
        _uiSetVisible: function (isVisible) {
            var self = this,
                el = self.get('el'),
                visibleMode = self.get('visibleMode');
            if (visibleMode === 'visibility') {
                el.css('visibility', isVisible ? 'visible' : 'hidden');
            } else {
                el.css('display', isVisible ? '' : 'none');
            }
        },
        /**
         * \u6790\u6784\u51fd\u6570
         * @protected
         */
        destructor : function () {
            var el = this.get('el');
            if (el) {
                el.remove();
            }
        }
    },{
        xclass : 'view',
        priority : 0
    });


    View.ATTRS = 
    {   
        /**
         * \u63a7\u4ef6\u6839\u8282\u70b9
         * @readOnly
         * see {@link BUI.Component.Controller#property-el}
         */
        el: {
            /**
			* @private
			*/
            setter: function (v) {
                return $(v);
            }
        },

        /**
         * \u63a7\u4ef6\u6839\u8282\u70b9\u6837\u5f0f
         * see {@link BUI.Component.Controller#property-elCls}
         */
        elCls: {
        },
        /**
         * \u63a7\u4ef6\u6839\u8282\u70b9\u6837\u5f0f\u5c5e\u6027
         * see {@link BUI.Component.Controller#property-elStyle}
         */
        elStyle: {
        },
        /**
         * \u63a7\u4ef6\u5bbd\u5ea6
         * see {@link BUI.Component.Controller#property-width}
         */
        width: {
        },
        /**
         * \u63a7\u4ef6\u9ad8\u5ea6
         * see {@link BUI.Component.Controller#property-height}
         */
        height: {
        },
        /**
         * \u72b6\u6001\u76f8\u5173\u7684\u6837\u5f0f,\u9ed8\u8ba4\u60c5\u51b5\u4e0b\u4f1a\u4f7f\u7528 \u524d\u7f00\u540d + xclass + '-' + \u72b6\u6001\u540d
         * see {@link BUI.Component.Controller#property-statusCls}
         * @type {Object}
         */
        statusCls : {
            value : {}
        },
        /**
         * \u63a7\u4ef6\u6839\u8282\u70b9\u4f7f\u7528\u7684\u6807\u7b7e
         * @type {String}
         */
        elTagName: {
            // \u751f\u6210\u6807\u7b7e\u540d\u5b57
            value: 'div'
        },
        /**
         * \u63a7\u4ef6\u6839\u8282\u70b9\u5c5e\u6027
         * see {@link BUI.Component.Controller#property-elAttrs}
         * @ignore
         */
        elAttrs: {
        },
        /**
         * \u63a7\u4ef6\u5185\u5bb9\uff0chtml,\u6587\u672c\u7b49
         * see {@link BUI.Component.Controller#property-content}
         */
        content: {
        },
        /**
         * \u63a7\u4ef6\u63d2\u5165\u5230\u6307\u5b9a\u5143\u7d20\u524d
         * see {@link BUI.Component.Controller#property-tpl}
         */
        elBefore: {
            // better named to renderBefore, too late !
        },
        /**
         * \u63a7\u4ef6\u5728\u6307\u5b9a\u5143\u7d20\u5185\u90e8\u6e32\u67d3
         * see {@link BUI.Component.Controller#property-render}
         * @ignore
         */
        render: {},
        /**
         * \u662f\u5426\u53ef\u89c1
         * see {@link BUI.Component.Controller#property-visible}
         */
        visible: {
            value: true
        },
        /**
         * \u53ef\u89c6\u6a21\u5f0f
         * see {@link BUI.Component.Controller#property-visibleMode}
         */
        visibleMode: {
            value: 'display'
        },
        /**
         * @private
         * \u7f13\u5b58\u9690\u85cf\u65f6\u7684\u4f4d\u7f6e\uff0c\u5bf9\u5e94visibleMode = 'visiblity' \u7684\u573a\u666f
         * @type {Object}
         */
        cachePosition : {

        },
        /**
         * content \u8bbe\u7f6e\u7684\u5185\u5bb9\u8282\u70b9,\u9ed8\u8ba4\u6839\u8282\u70b9
         * @type {jQuery}
         * @default  el
         */
        contentEl: {
            valueFn: function () {
                return this.get('el');
            }
        },
        /**
         * \u6837\u5f0f\u524d\u7f00
         * see {@link BUI.Component.Controller#property-prefixCls}
         */
        prefixCls: {
            value: BUI.prefix
        },
        /**
         * \u53ef\u4ee5\u83b7\u53d6\u7126\u70b9
         * @protected
         * see {@link BUI.Component.Controller#property-focusable}
         */
        focusable: {
            value: true
        },
        /**
         * \u83b7\u53d6\u7126\u70b9
         * see {@link BUI.Component.Controller#property-focused}
         */
        focused: {},
        /**
         * \u6fc0\u6d3b
         * see {@link BUI.Component.Controller#property-active}
         */
        active: {},
        /**
         * \u7981\u7528
         * see {@link BUI.Component.Controller#property-disabled}
         */
        disabled: {},
        /**
         * \u9ad8\u4eae\u663e\u793a
         * see {@link BUI.Component.Controller#property-highlighted}
         */
        highlighted: {}
    };

    return View;
});/**
 * @fileOverview  \u63a7\u4ef6\u53ef\u4ee5\u5b9e\u4f8b\u5316\u7684\u57fa\u7c7b
 * @ignore
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 */

/**
 * jQuery \u4e8b\u4ef6
 * @class jQuery.Event
 * @private
 */


define('bui/component/controller',['bui/component/uibase','bui/component/manage','bui/component/view'],function(require){

    var UIBase = require('bui/component/uibase'),
        Manager = require('bui/component/manage'),
        View = require('bui/component/view'),
        wrapBehavior = BUI.wrapBehavior,
        getWrapBehavior = BUI.getWrapBehavior;

     /**
      * @ignore
      */
     function wrapperViewSetter(attrName) {
        return function (ev) {
            var self = this;
            // in case bubbled from sub component
            if (self === ev.target) {
                var value = ev.newVal,
                    view = self.get('view');
                if(view){
                    view.set(attrName, value); 
                }
               
            }
        };
    }

    /**
      * @ignore
      */
    function wrapperViewGetter(attrName) {
        return function (v) {
            var self = this,
                view = self.get('view');
            return v === undefined ? view.get(attrName) : v;
        };
    }

    /**
      * @ignore
      */
    function initChild(self, c, renderBefore) {
        // \u751f\u6210\u7236\u7ec4\u4ef6\u7684 dom \u7ed3\u6784
        self.create();
        var contentEl = self.getContentElement(),
            defaultCls = self.get('defaultChildClass');
        //\u914d\u7f6e\u9ed8\u8ba4 xclass
        if(!c.xclass && !(c instanceof Controller)){
            if(!c.xtype){
                c.xclass = defaultCls;
            }else{
                c.xclass = defaultCls + '-' + c.xtype;
            }
            
        }

        c = BUI.Component.create(c, self);
        c.setInternal('parent', self);
        // set \u901a\u77e5 view \u4e5f\u66f4\u65b0\u5bf9\u5e94\u5c5e\u6027
        c.set('render', contentEl);
        c.set('elBefore', renderBefore);
        // \u5982\u679c parent \u4e5f\u6ca1\u6e32\u67d3\uff0c\u5b50\u7ec4\u4ef6 create \u51fa\u6765\u548c parent \u8282\u70b9\u5173\u8054
        // \u5b50\u7ec4\u4ef6\u548c parent \u7ec4\u4ef6\u4e00\u8d77\u6e32\u67d3
        // \u4e4b\u524d\u8bbe\u597d\u5c5e\u6027\uff0cview \uff0clogic \u540c\u6b65\u8fd8\u6ca1 bind ,create \u4e0d\u662f render \uff0c\u8fd8\u6ca1\u6709 bindUI
        c.create(undefined);
        return c;
    }

    /**
     * \u4e0d\u4f7f\u7528 valueFn\uff0c
     * \u53ea\u6709 render \u65f6\u9700\u8981\u627e\u5230\u9ed8\u8ba4\uff0c\u5176\u4ed6\u65f6\u5019\u4e0d\u9700\u8981\uff0c\u9632\u6b62\u83ab\u540d\u5176\u5999\u521d\u59cb\u5316
     * @ignore
     */
    function constructView(self) {
        // \u9010\u5c42\u627e\u9ed8\u8ba4\u6e32\u67d3\u5668
        var attrs,
            attrCfg,
            attrName,
            cfg = {},
            v,
            Render = self.get('xview');

      
        //\u5c06\u6e32\u67d3\u5c42\u521d\u59cb\u5316\u6240\u9700\u8981\u7684\u5c5e\u6027\uff0c\u76f4\u63a5\u6784\u9020\u5668\u8bbe\u7f6e\u8fc7\u53bb

        attrs = self.getAttrs();

        // \u6574\u7406\u5c5e\u6027\uff0c\u5bf9\u7eaf\u5c5e\u4e8e view \u7684\u5c5e\u6027\uff0c\u6dfb\u52a0 getter setter \u76f4\u63a5\u5230 view
        for (attrName in attrs) {
            if (attrs.hasOwnProperty(attrName)) {
                attrCfg = attrs[attrName];
                if (attrCfg.view) {
                    // \u5148\u53d6\u540e getter
                    // \u9632\u6b62\u6b7b\u5faa\u73af
                    if (( v = self.get(attrName) ) !== undefined) {
                        cfg[attrName] = v;
                    }

                    // setter \u4e0d\u5e94\u8be5\u6709\u5b9e\u9645\u64cd\u4f5c\uff0c\u4ec5\u7528\u4e8e\u6b63\u89c4\u5316\u6bd4\u8f83\u597d
                    // attrCfg.setter = wrapperViewSetter(attrName);
                    self.on('after' + BUI.ucfirst(attrName) + 'Change',
                        wrapperViewSetter(attrName));
                    // \u903b\u8f91\u5c42\u8bfb\u503c\u76f4\u63a5\u4ece view \u5c42\u8bfb
                    // \u90a3\u4e48\u5982\u679c\u5b58\u5728\u9ed8\u8ba4\u503c\u4e5f\u8bbe\u7f6e\u5728 view \u5c42
                    // \u903b\u8f91\u5c42\u4e0d\u8981\u8bbe\u7f6e getter
                    attrCfg.getter = wrapperViewGetter(attrName);
                }
            }
        }
        // does not autoRender for view
        delete cfg.autoRender;
        cfg.ksComponentCss = getComponentCss(self);
        return new Render(cfg);
    }

    function getComponentCss(self) {
        var constructor = self.constructor,
            cls,
            re = [];
        while (constructor && constructor !== Controller) {
            cls = Manager.getXClassByConstructor(constructor);
            if (cls) {
                re.push(cls);
            }
            constructor = constructor.superclass && constructor.superclass.constructor;
        }
        return re.join(' ');
    }

    function isMouseEventWithinElement(e, elem) {
        var relatedTarget = e.relatedTarget;
        // \u5728\u91cc\u9762\u6216\u7b49\u4e8e\u81ea\u8eab\u90fd\u4e0d\u7b97 mouseenter/leave
        return relatedTarget &&
            ( relatedTarget === elem[0] ||$.contains(elem,relatedTarget));
    }

    /**
     * \u53ef\u4ee5\u5b9e\u4f8b\u5316\u7684\u63a7\u4ef6\uff0c\u4f5c\u4e3a\u6700\u9876\u5c42\u7684\u63a7\u4ef6\u7c7b\uff0c\u4e00\u5207\u7528\u6237\u63a7\u4ef6\u90fd\u7ee7\u627f\u6b64\u63a7\u4ef6
     * xclass: 'controller'.
     * ** \u521b\u5efa\u5b50\u63a7\u4ef6 ** 
     * <pre><code>
     * var Control = Controller.extend([mixin1,mixin2],{ //\u539f\u578b\u94fe\u4e0a\u7684\u51fd\u6570
     *   renderUI : function(){ //\u521b\u5efaDOM
     *   
     *   }, 
     *   bindUI : function(){  //\u7ed1\u5b9a\u4e8b\u4ef6
     *   
     *   },
     *   destructor : funciton(){ //\u6790\u6784\u51fd\u6570
     *   
     *   }
     * },{
     *   ATTRS : { //\u9ed8\u8ba4\u7684\u5c5e\u6027
     *       text : {
     *       
     *       }
     *   }
     * },{
     *     xclass : 'a' //\u7528\u4e8e\u628a\u5bf9\u8c61\u89e3\u6790\u6210\u7c7b
     * });
     * </code></pre>
     *
     * ** \u521b\u5efa\u5bf9\u8c61 **
     * <pre><code>
     * var c1 = new Control({
     *     render : '#t1', //\u5728t1\u4e0a\u521b\u5efa
     *     text : 'text1',
     *     children : [{xclass : 'a',text : 'a1'},{xclass : 'b',text : 'b1'}]
     * });
     *
     * c1.render();
     * </code></pre>
     * @extends BUI.Component.UIBase
     * @mixins BUI.Component.UIBase.Tpl
     * @mixins BUI.Component.UIBase.Decorate
     * @mixins BUI.Component.UIBase.Depends
     * @mixins BUI.Component.UIBase.ChildCfg
     * @class BUI.Component.Controller
     */
    var Controller = UIBase.extend([UIBase.Decorate,UIBase.Tpl,UIBase.ChildCfg,UIBase.KeyNav,UIBase.Depends],
    {
        /**
         * \u662f\u5426\u662f\u63a7\u4ef6\uff0c\u6807\u793a\u5bf9\u8c61\u662f\u5426\u662f\u4e00\u4e2aUI \u63a7\u4ef6
         * @type {Boolean}
         */
        isController: true,

        /**
         * \u4f7f\u7528\u524d\u7f00\u83b7\u53d6\u7c7b\u7684\u540d\u5b57
         * @param classes {String} class names without prefixCls. Separated by space.
         * @method
         * @protected
         * @return {String} class name with prefixCls
         */
        getCssClassWithPrefix: Manager.getCssClassWithPrefix,

        /**
         * From UIBase, Initialize this component.             *
         * @protected
         */
        initializer: function () {
            var self = this;

            if(!self.get('id')){
                self.set('id',self.getNextUniqueId())
            }
            Manager.addComponent(self.get('id'),self);
            // initialize view
            self.setInternal('view', constructView(self));
        },

        /**
         * \u8fd4\u56de\u65b0\u7684\u552f\u4e00\u7684Id,\u7ed3\u679c\u662f 'xclass' + number
         * @protected
         * @return {String} \u552f\u4e00id
         */
        getNextUniqueId : function(){
            var self = this,
                xclass = Manager.getXClassByConstructor(self.constructor);
            return BUI.guid(xclass);
        },
        /**
         * From UIBase. Constructor(or get) view object to create ui elements.
         * @protected
         *
         */
        createDom: function () {
            var self = this,
                el,
                view = self.get('view');
            view.create(undefined);
            el = view.getKeyEventTarget();
            if (!self.get('allowTextSelection')) {
                //el.unselectable(undefined);
            }
        },

        /**
         * From UIBase. Call view object to render ui elements.
         * @protected
         *
         */
        renderUI: function () {
            var self = this, i, children, child;
            self.get('view').render();
            // then render my children
            children = self.get('children').concat();
            self.get('children').length = 0;
            for (i = 0; i < children.length; i++) {
                child = self.addChild(children[i]);
                child.render();
            }
        },
        /**
         * bind ui for box
         * @private
         */
        bindUI:function () {
            var self = this,
                events = self.get('events');
            this.on('afterVisibleChange', function (e) {
                this.fire(e.newVal ? 'show' : 'hide');
            });
            //\u5904\u7406\u63a7\u4ef6\u4e8b\u4ef6\uff0c\u8bbe\u7f6e\u4e8b\u4ef6\u662f\u5426\u5192\u6ce1
            BUI.each(events, function (v,k) {
              self.publish(k, {
                  bubbles:v
              });
            });
        },
        /**
         * \u63a7\u4ef6\u662f\u5426\u5305\u542b\u6307\u5b9a\u7684DOM\u5143\u7d20,\u5305\u62ec\u6839\u8282\u70b9
         * <pre><code>
         *   var control = new Control();
         *   $(document).on('click',function(ev){
         *     var target = ev.target;
         *
         *     if(!control.containsElement(elem)){ //\u672a\u70b9\u51fb\u5728\u63a7\u4ef6\u5185\u90e8
         *       control.hide();
         *     }
         *   });
         * </code></pre>
         * @param  {HTMLElement} elem DOM \u5143\u7d20
         * @return {Boolean}  \u662f\u5426\u5305\u542b
         */
        containsElement : function (elem) {
          var _self = this,
            el = _self.get('el'),
            children = _self.get('children'),
            result = false;
          if(!_self.get('rendered')){
            return false;
          }
          if($.contains(el[0],elem) || el[0] === elem){
            result = true;
          }else{
            BUI.each(children,function (item) {
                if(item.containsElement(elem)){
                    result = true;
                    return false;
                }
            });
          }
          return result;
        },
        /**
         * \u662f\u5426\u662f\u5b50\u63a7\u4ef6\u7684DOM\u5143\u7d20
         * @protected
         * @return {Boolean} \u662f\u5426\u5b50\u63a7\u4ef6\u7684DOM\u5143\u7d20
         */
        isChildrenElement : function(elem){
            var _self = this,
                children = _self.get('children'),
                rst = false;
            BUI.each(children,function(child){
                if(child.containsElement(elem)){
                    rst = true;
                    return false;
                }
            });
            return rst;
        },
        /**
         * \u663e\u793a\u63a7\u4ef6
         */
        show:function () {
            var self = this;
            self.render();
            self.set('visible', true);
            return self;
        },

        /**
         * \u9690\u85cf\u63a7\u4ef6
         */
        hide:function () {
            var self = this;
            self.set('visible', false);
            return self;
        },
        /**
         * \u4ea4\u66ff\u663e\u793a\u6216\u8005\u9690\u85cf
         * <pre><code>
         *  control.show(); //\u663e\u793a
         *  control.toggle(); //\u9690\u85cf
         *  control.toggle(); //\u663e\u793a
         * </code></pre>
         */
        toggle : function(){
            this.set('visible',!this.get('visible'));
            return this;
        },
        _uiSetFocusable: function (focusable) {
            var self = this,
                t,
                el = self.getKeyEventTarget();
            if (focusable) {
                el.attr('tabIndex', 0)
                    // remove smart outline in ie
                    // set outline in style for other standard browser
                    .attr('hideFocus', true)
                    .on('focus', wrapBehavior(self, 'handleFocus'))
                    .on('blur', wrapBehavior(self, 'handleBlur'))
                    .on('keydown', wrapBehavior(self, 'handleKeydown'))
                    .on('keyup',wrapBehavior(self,'handleKeyUp'));
            } else {
                el.removeAttr('tabIndex');
                if (t = getWrapBehavior(self, 'handleFocus')) {
                    el.off('focus', t);
                }
                if (t = getWrapBehavior(self, 'handleBlur')) {
                    el.off('blur', t);
                }
                if (t = getWrapBehavior(self, 'handleKeydown')) {
                    el.off('keydown', t);
                }
                if (t = getWrapBehavior(self, 'handleKeyUp')) {
                    el.off('keyup', t);
                }
            }
        },

        _uiSetHandleMouseEvents: function (handleMouseEvents) {
            var self = this, el = self.get('el'), t;
            if (handleMouseEvents) {
                el.on('mouseenter', wrapBehavior(self, 'handleMouseEnter'))
                    .on('mouseleave', wrapBehavior(self, 'handleMouseLeave'))
                    .on('contextmenu', wrapBehavior(self, 'handleContextMenu'))
                    .on('mousedown', wrapBehavior(self, 'handleMouseDown'))
                    .on('mouseup', wrapBehavior(self, 'handleMouseUp'))
                    .on('dblclick', wrapBehavior(self, 'handleDblClick'));
            } else {
                t = getWrapBehavior(self, 'handleMouseEnter') &&
                    el.off('mouseenter', t);
                t = getWrapBehavior(self, 'handleMouseLeave') &&
                    el.off('mouseleave', t);
                t = getWrapBehavior(self, 'handleContextMenu') &&
                    el.off('contextmenu', t);
                t = getWrapBehavior(self, 'handleMouseDown') &&
                    el.off('mousedown', t);
                t = getWrapBehavior(self, 'handleMouseUp') &&
                    el.off('mouseup', t);
                t = getWrapBehavior(self, 'handleDblClick') &&
                    el.off('dblclick', t);
            }
        },

        _uiSetFocused: function (v) {
            if (v) {
                this.getKeyEventTarget()[0].focus();
            }
        },
        //\u5f53\u4f7f\u7528visiblity\u663e\u793a\u9690\u85cf\u65f6\uff0c\u9690\u85cf\u65f6\u628aDOM\u79fb\u9664\u51fa\u89c6\u56fe\u5185\uff0c\u663e\u793a\u65f6\u56de\u590d\u539f\u4f4d\u7f6e
        _uiSetVisible : function(isVisible){
            var self = this,
                el = self.get('el'),
                visibleMode = self.get('visibleMode');
            if (visibleMode === 'visibility') {
                if(isVisible){
                    var position = self.get('cachePosition');
                    if(position){
                        self.set('xy',position);
                    }
                }
                if(!isVisible){
                    var position = [
                        self.get('x'),self.get('y')
                    ];
                    self.set('cachePosition',position);
                    self.set('xy',[-999,-999]);
                }
            }
        },
        /**
         * \u4f7f\u63a7\u4ef6\u53ef\u7528
         */
        enable : function(){
            this.set('disabled',false);
            return this;
        },
        /**
         * \u4f7f\u63a7\u4ef6\u4e0d\u53ef\u7528\uff0c\u63a7\u4ef6\u4e0d\u53ef\u7528\u65f6\uff0c\u70b9\u51fb\u7b49\u4e8b\u4ef6\u4e0d\u4f1a\u89e6\u53d1
         * <pre><code>
         *  control.disable(); //\u7981\u7528
         *  control.enable(); //\u89e3\u9664\u7981\u7528
         * </code></pre>
         */
        disable : function(){
            this.set('disabled',true);
            return this;
        },
        /**
         * \u5b50\u7ec4\u4ef6\u5c06\u8981\u6e32\u67d3\u5230\u7684\u8282\u70b9\uff0c\u5728 render \u7c7b\u4e0a\u8986\u76d6\u5bf9\u5e94\u65b9\u6cd5
         * @protected
         * @ignore
         */
        getContentElement: function () {
            return this.get('view').getContentElement();
        },

        /**
         * \u7126\u70b9\u6240\u5728\u5143\u7d20\u5373\u952e\u76d8\u4e8b\u4ef6\u5904\u7406\u5143\u7d20\uff0c\u5728 render \u7c7b\u4e0a\u8986\u76d6\u5bf9\u5e94\u65b9\u6cd5
         * @protected
         * @ignore
         */
        getKeyEventTarget: function () {
            return this.get('view').getKeyEventTarget();
        },

        /**
         * \u6dfb\u52a0\u63a7\u4ef6\u7684\u5b50\u63a7\u4ef6\uff0c\u7d22\u5f15\u503c\u4e3a 0-based
         * <pre><code>
         *  control.add(new Control());//\u6dfb\u52a0controller\u5bf9\u8c61
         *  control.add({xclass : 'a'});//\u6dfb\u52a0xclass \u4e3aa \u7684\u4e00\u4e2a\u5bf9\u8c61
         *  control.add({xclass : 'b'},2);//\u63d2\u5165\u5230\u7b2c\u4e09\u4e2a\u4f4d\u7f6e
         * </code></pre>
         * @param {BUI.Component.Controller|Object} c \u5b50\u63a7\u4ef6\u7684\u5b9e\u4f8b\u6216\u8005\u914d\u7f6e\u9879
         * @param {String} [c.xclass] \u5982\u679cc\u4e3a\u914d\u7f6e\u9879\uff0c\u8bbe\u7f6ec\u7684xclass
         * @param {Number} [index]  0-based  \u5982\u679c\u672a\u6307\u5b9a\u7d22\u5f15\u503c\uff0c\u5219\u63d2\u5728\u63a7\u4ef6\u7684\u6700\u540e
         */
        addChild: function (c, index) {
            var self = this,
                children = self.get('children'),
                renderBefore;
            if (index === undefined) {
                index = children.length;
            }
            /**
             * \u6dfb\u52a0\u5b50\u63a7\u4ef6\u524d\u89e6\u53d1
             * @event beforeAddChild
             * @param {Object} e
             * @param {Object} e.child \u6dfb\u52a0\u5b50\u63a7\u4ef6\u65f6\u4f20\u5165\u7684\u914d\u7f6e\u9879\u6216\u8005\u5b50\u63a7\u4ef6
             * @param {Number} e.index \u6dfb\u52a0\u7684\u4f4d\u7f6e
             */
            self.fire('beforeAddChild',{child : c,index : index});
            renderBefore = children[index] && children[index].get('el') || null;
            c = initChild(self, c, renderBefore);
            children.splice(index, 0, c);
            // \u5148 create \u5360\u4f4d \u518d render
            // \u9632\u6b62 render \u903b\u8f91\u91cc\u8bfb parent.get('children') \u4e0d\u540c\u6b65
            // \u5982\u679c parent \u5df2\u7ecf\u6e32\u67d3\u597d\u4e86\u5b50\u7ec4\u4ef6\u4e5f\u8981\u7acb\u5373\u6e32\u67d3\uff0c\u5c31 \u521b\u5efa dom \uff0c\u7ed1\u5b9a\u4e8b\u4ef6
            if (self.get('rendered')) {
                c.render();
            }

            /**
             * \u6dfb\u52a0\u5b50\u63a7\u4ef6\u540e\u89e6\u53d1
             * @event afterAddChild
             * @param {Object} e
             * @param {Object} e.child \u6dfb\u52a0\u5b50\u63a7\u4ef6
             * @param {Number} e.index \u6dfb\u52a0\u7684\u4f4d\u7f6e
             */
            self.fire('afterAddChild',{child : c,index : index});
            return c;
        },
        /**
         * \u5c06\u81ea\u5df1\u4ece\u7236\u63a7\u4ef6\u4e2d\u79fb\u9664
         * <pre><code>
         *  control.remove(); //\u5c06\u63a7\u4ef6\u4ece\u7236\u63a7\u4ef6\u4e2d\u79fb\u9664\uff0c\u5e76\u672a\u5220\u9664
         *  parent.addChild(control); //\u8fd8\u53ef\u4ee5\u6dfb\u52a0\u56de\u7236\u63a7\u4ef6
         *  
         *  control.remove(true); //\u4ece\u63a7\u4ef6\u4e2d\u79fb\u9664\u5e76\u8c03\u7528\u63a7\u4ef6\u7684\u6790\u6784\u51fd\u6570
         * </code></pre>
         * @param  {Boolean} destroy \u662f\u5426\u5220\u9664DON\u8282\u70b9
         * @return {BUI.Component.Controller} \u5220\u9664\u7684\u5b50\u5bf9\u8c61.
         */
        remove : function(destroy){
            var self = this,
                parent = self.get('parent');
            if(parent){
                parent.removeChild(self,destroy);
            }else if (destroy) {
                self.destroy();
            }
            return self;
        },
        /**
         * \u79fb\u9664\u5b50\u63a7\u4ef6\uff0c\u5e76\u8fd4\u56de\u79fb\u9664\u7684\u63a7\u4ef6
         *
         * ** \u5982\u679c destroy=true,\u8c03\u7528\u79fb\u9664\u63a7\u4ef6\u7684 {@link BUI.Component.UIBase#destroy} \u65b9\u6cd5,
         * \u540c\u65f6\u5220\u9664\u5bf9\u5e94\u7684DOM **
         * <pre><code>
         *  var child = control.getChild(id);
         *  control.removeChild(child); //\u4ec5\u4ec5\u79fb\u9664
         *  
         *  control.removeChild(child,true); //\u79fb\u9664\uff0c\u5e76\u8c03\u7528\u6790\u6784\u51fd\u6570
         * </code></pre>
         * @param {BUI.Component.Controller} c \u8981\u79fb\u9664\u7684\u5b50\u63a7\u4ef6.
         * @param {Boolean} [destroy=false] \u5982\u679c\u662ftrue,
         * \u8c03\u7528\u63a7\u4ef6\u7684\u65b9\u6cd5 {@link BUI.Component.UIBase#destroy} .
         * @return {BUI.Component.Controller} \u79fb\u9664\u7684\u5b50\u63a7\u4ef6.
         */
        removeChild: function (c, destroy) {
            var self = this,
                children = self.get('children'),
                index = BUI.Array.indexOf(c, children);

            if(index === -1){
                return;
            }
            /**
             * \u5220\u9664\u5b50\u63a7\u4ef6\u524d\u89e6\u53d1
             * @event beforeRemoveChild
             * @param {Object} e
             * @param {Object} e.child \u5b50\u63a7\u4ef6
             * @param {Boolean} e.destroy \u662f\u5426\u6e05\u9664DOM
             */
            self.fire('beforeRemoveChild',{child : c,destroy : destroy});

            if (index !== -1) {
                children.splice(index, 1);
            }
            if (destroy &&
                // c is still json
                c.destroy) {
                c.destroy();
            }
            /**
             * \u5220\u9664\u5b50\u63a7\u4ef6\u524d\u89e6\u53d1
             * @event afterRemoveChild
             * @param {Object} e
             * @param {Object} e.child \u5b50\u63a7\u4ef6
             * @param {Boolean} e.destroy \u662f\u5426\u6e05\u9664DOM
             */
            self.fire('afterRemoveChild',{child : c,destroy : destroy});

            return c;
        },

        /**
         * \u5220\u9664\u5f53\u524d\u63a7\u4ef6\u7684\u5b50\u63a7\u4ef6
         * <pre><code>
         *   control.removeChildren();//\u5220\u9664\u6240\u6709\u5b50\u63a7\u4ef6
         *   control.removeChildren(true);//\u5220\u9664\u6240\u6709\u5b50\u63a7\u4ef6\uff0c\u5e76\u8c03\u7528\u5b50\u63a7\u4ef6\u7684\u6790\u6784\u51fd\u6570
         * </code></pre>
         * @see Component.Controller#removeChild
         * @param {Boolean} [destroy] \u5982\u679c\u8bbe\u7f6e true,
         * \u8c03\u7528\u5b50\u63a7\u4ef6\u7684 {@link BUI.Component.UIBase#destroy}\u65b9\u6cd5.
         */
        removeChildren: function (destroy) {
            var self = this,
                i,
                t = [].concat(self.get('children'));
            for (i = 0; i < t.length; i++) {
                self.removeChild(t[i], destroy);
            }
        },

        /**
         * \u6839\u636e\u7d22\u5f15\u83b7\u53d6\u5b50\u63a7\u4ef6
         * <pre><code>
         *  control.getChildAt(0);//\u83b7\u53d6\u7b2c\u4e00\u4e2a\u5b50\u63a7\u4ef6
         *  control.getChildAt(2); //\u83b7\u53d6\u7b2c\u4e09\u4e2a\u5b50\u63a7\u4ef6
         * </code></pre>
         * @param {Number} index 0-based \u7d22\u5f15\u503c.
         * @return {BUI.Component.Controller} \u5b50\u63a7\u4ef6\u6216\u8005null 
         */
        getChildAt: function (index) {
            var children = this.get('children');
            return children[index] || null;
        },
        /**
         * \u6839\u636eId\u83b7\u53d6\u5b50\u63a7\u4ef6
         * <pre><code>
         *  control.getChild('id'); //\u4ece\u63a7\u4ef6\u7684\u76f4\u63a5\u5b50\u63a7\u4ef6\u4e2d\u67e5\u627e
         *  control.getChild('id',true);//\u9012\u5f52\u67e5\u627e\u6240\u6709\u5b50\u63a7\u4ef6\uff0c\u5305\u542b\u5b50\u63a7\u4ef6\u7684\u5b50\u63a7\u4ef6
         * </code></pre>
         * @param  {String} id \u63a7\u4ef6\u7f16\u53f7
         * @param  {Boolean} deep \u662f\u5426\u7ee7\u7eed\u67e5\u627e\u5728\u5b50\u63a7\u4ef6\u4e2d\u67e5\u627e
         * @return {BUI.Component.Controller} \u5b50\u63a7\u4ef6\u6216\u8005null 
         */
        getChild : function(id,deep){
            return this.getChildBy(function(item){
                return item.get('id') === id;
            },deep);
        },
        /**
         * \u901a\u8fc7\u5339\u914d\u51fd\u6570\u67e5\u627e\u5b50\u63a7\u4ef6\uff0c\u8fd4\u56de\u7b2c\u4e00\u4e2a\u5339\u914d\u7684\u5bf9\u8c61
         * <pre><code>
         *  control.getChildBy(function(child){//\u4ece\u63a7\u4ef6\u7684\u76f4\u63a5\u5b50\u63a7\u4ef6\u4e2d\u67e5\u627e
         *    return child.get('id') = '1243';
         *  }); 
         *  
         *  control.getChild(function(child){//\u9012\u5f52\u67e5\u627e\u6240\u6709\u5b50\u63a7\u4ef6\uff0c\u5305\u542b\u5b50\u63a7\u4ef6\u7684\u5b50\u63a7\u4ef6
         *    return child.get('id') = '1243';
         *  },true);
         * </code></pre>
         * @param  {Function} math \u67e5\u627e\u7684\u5339\u914d\u51fd\u6570
         * @param  {Boolean} deep \u662f\u5426\u7ee7\u7eed\u67e5\u627e\u5728\u5b50\u63a7\u4ef6\u4e2d\u67e5\u627e
         * @return {BUI.Component.Controller} \u5b50\u63a7\u4ef6\u6216\u8005null 
         */
        getChildBy : function(math,deep){
            return this.getChildrenBy(math,deep)[0] || null;
        },
        /**
         * \u83b7\u53d6\u63a7\u4ef6\u7684\u9644\u52a0\u9ad8\u5ea6 = control.get('el').outerHeight() - control.get('el').height()
         * @protected
         * @return {Number} \u9644\u52a0\u5bbd\u5ea6
         */
        getAppendHeigtht : function(){
            var el = this.get('el');
            return el.outerHeight() - el.height();
        },
        /**
         * \u83b7\u53d6\u63a7\u4ef6\u7684\u9644\u52a0\u5bbd\u5ea6 = control.get('el').outerWidth() - control.get('el').width()
         * @protected
         * @return {Number} \u9644\u52a0\u5bbd\u5ea6
         */
        getAppendWidth : function(){
            var el = this.get('el');
            return el.outerWidth() - el.width();
        },
        /**
         * \u67e5\u627e\u7b26\u5408\u6761\u4ef6\u7684\u5b50\u63a7\u4ef6
         * <pre><code>
         *  control.getChildrenBy(function(child){//\u4ece\u63a7\u4ef6\u7684\u76f4\u63a5\u5b50\u63a7\u4ef6\u4e2d\u67e5\u627e
         *    return child.get('type') = '1';
         *  }); 
         *  
         *  control.getChildrenBy(function(child){//\u9012\u5f52\u67e5\u627e\u6240\u6709\u5b50\u63a7\u4ef6\uff0c\u5305\u542b\u5b50\u63a7\u4ef6\u7684\u5b50\u63a7\u4ef6
         *    return child.get('type') = '1';
         *  },true);
         * </code></pre>
         * @param  {Function} math \u67e5\u627e\u7684\u5339\u914d\u51fd\u6570
         * @param  {Boolean} deep \u662f\u5426\u7ee7\u7eed\u67e5\u627e\u5728\u5b50\u63a7\u4ef6\u4e2d\u67e5\u627e\uff0c\u5982\u679c\u7b26\u5408\u4e0a\u9762\u7684\u5339\u914d\u51fd\u6570\uff0c\u5219\u4e0d\u518d\u5f80\u4e0b\u67e5\u627e
         * @return {BUI.Component.Controller[]} \u5b50\u63a7\u4ef6\u6570\u7ec4 
         */
        getChildrenBy : function(math,deep){
            var self = this,
                results = [];
            if(!math){
                return results;
            }

            self.eachChild(function(child){
                if(math(child)){
                    results.push(child);
                }else if(deep){

                    results = results.concat(child.getChildrenBy(math,deep));
                }
            });
            return results;
        },
        /**
         * \u904d\u5386\u5b50\u5143\u7d20
         * <pre><code>
         *  control.eachChild(function(child,index){ //\u904d\u5386\u5b50\u63a7\u4ef6
         *  
         *  });
         * </code></pre>
         * @param  {Function} func \u8fed\u4ee3\u51fd\u6570\uff0c\u51fd\u6570\u539f\u578bfunction(child,index)
         */
        eachChild : function(func){
            BUI.each(this.get('children'),func);
        },
        /**
         * Handle dblclick events. By default, this performs its associated action by calling
         * {@link BUI.Component.Controller#performActionInternal}.
         * @protected
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleDblClick: function (ev) {
            this.performActionInternal(ev);
            if(!this.isChildrenElement(ev.target)){
                this.fire('dblclick',{domTarget : ev.target,domEvent : ev});
            }
        },

        /**
         * Called by it's container component to dispatch mouseenter event.
         * @private
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleMouseOver: function (ev) {
            var self = this,
                el = self.get('el');
            if (!isMouseEventWithinElement(ev, el)) {
                self.handleMouseEnter(ev);
                
            }
        },

        /**
         * Called by it's container component to dispatch mouseleave event.
         * @private
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleMouseOut: function (ev) {
            var self = this,
                el = self.get('el');
            if (!isMouseEventWithinElement(ev, el)) {
                self.handleMouseLeave(ev);
                
            }
        },

        /**
         * Handle mouseenter events. If the component is not disabled, highlights it.
         * @protected
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleMouseEnter: function (ev) {
            var self = this;
            this.set('highlighted', !!ev);
            self.fire('mouseenter',{domTarget : ev.target,domEvent : ev});
        },

        /**
         * Handle mouseleave events. If the component is not disabled, de-highlights it.
         * @protected
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleMouseLeave: function (ev) {
            var self = this;
            self.set('active', false);
            self.set('highlighted', !ev);
            self.fire('mouseleave',{domTarget : ev.target,domEvent : ev});
        },

        /**
         * Handles mousedown events. If the component is not disabled,
         * If the component is activeable, then activate it.
         * If the component is focusable, then focus it,
         * else prevent it from receiving keyboard focus.
         * @protected
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleMouseDown: function (ev) {
            var self = this,
                n,
                isMouseActionButton = ev['which'] === 1,
                el;
            if (isMouseActionButton) {
                el = self.getKeyEventTarget();
                if (self.get('activeable')) {
                    self.set('active', true);
                }
                if (self.get('focusable')) {
                    el[0].focus();
                    self.set('focused', true);
                }

                if (!self.get('allowTextSelection')) {
                    // firefox /chrome \u4e0d\u4f1a\u5f15\u8d77\u7126\u70b9\u8f6c\u79fb
                    n = ev.target.nodeName;
                    n = n && n.toLowerCase();
                    // do not prevent focus when click on editable element
                    if (n !== 'input' && n !== 'textarea') {
                        ev.preventDefault();
                    }
                }
                if(!self.isChildrenElement(ev.target)){
                    self.fire('mousedown',{domTarget : ev.target,domEvent : ev});
                }
                
            }
        },

        /**
         * Handles mouseup events.
         * If this component is not disabled, performs its associated action by calling
         * {@link BUI.Component.Controller#performActionInternal}, then deactivates it.
         * @protected
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleMouseUp: function (ev) {
            var self = this,
                isChildrenElement = self.isChildrenElement(ev.target);
            // \u5de6\u952e
            if (self.get('active') && ev.which === 1) {
                self.performActionInternal(ev);
                self.set('active', false);
                if(!isChildrenElement){
                    self.fire('click',{domTarget : ev.target,domEvent : ev});
                }
            }
            if(!isChildrenElement){
                self.fire('mouseup',{domTarget : ev.target,domEvent : ev});
            }
        },

        /**
         * Handles context menu.
         * @protected
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleContextMenu: function (ev) {
        },

        /**
         * Handles focus events. Style focused class.
         * @protected
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleFocus: function (ev) {
            this.set('focused', !!ev);
            this.fire('focus',{domEvent : ev,domTarget : ev.target});
        },

        /**
         * Handles blur events. Remove focused class.
         * @protected
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleBlur: function (ev) {
            this.set('focused', !ev);
            this.fire('blur',{domEvent : ev,domTarget : ev.target});
        },

        /**
         * Handle enter keydown event to {@link BUI.Component.Controller#performActionInternal}.
         * @protected
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleKeyEventInternal: function (ev) {
            var self = this,
                isChildrenElement = self.isChildrenElement(ev.target);
            if (ev.which === 13) {
                if(!isChildrenElement){
                    self.fire('click',{domTarget : ev.target,domEvent : ev});
                }
                
                return this.performActionInternal(ev);
            }
            if(!isChildrenElement){
                self.fire('keydown',{domTarget : ev.target,domEvent : ev});
            }
        },

        /**
         * Handle keydown events.
         * If the component is not disabled, call {@link BUI.Component.Controller#handleKeyEventInternal}
         * @protected
         * @param {jQuery.Event} ev DOM event to handle.
         */
        handleKeydown: function (ev) {
            var self = this;
            if (self.handleKeyEventInternal(ev)) {
                ev.halt();
                return true;
            }
        },
        handleKeyUp : function(ev){
            var self = this;
            if(!self.isChildrenElement(ev.target)){
                self.fire('keyup',{domTarget : ev.target,domEvent : ev});
            }
        },
        /**
         * Performs the appropriate action when this component is activated by the user.
         * @protected
         * @param {jQuery.Event} ev DOM event to handle.
         */
        performActionInternal: function (ev) {
        },
        /**
         * \u6790\u6784\u51fd\u6570
         * @protected
         */
        destructor: function () {
            var self = this,
                id,
                i,
                view,
                children = self.get('children');
            id = self.get(id);
            for (i = 0; i < children.length; i++) {
                children[i].destroy && children[i].destroy();
            }
            self.get('view').destroy();
            Manager.removeComponent(id);
        }
    },
    {
        ATTRS: 
        {
            /**
             * \u63a7\u4ef6\u7684Html \u5185\u5bb9
             * <pre><code>
             *  new Control({
             *     content : '\u5185\u5bb9',
             *     render : '#c1'
             *  });
             * </code></pre>
             * @cfg {String|jQuery} content
             */
            /**
             * \u63a7\u4ef6\u7684Html \u5185\u5bb9
             * @type {String|jQuery}
             */
            content:{
                view:1
            },
			/**
			 * \u63a7\u4ef6\u6839\u8282\u70b9\u4f7f\u7528\u7684\u6807\u7b7e
             * <pre><code>
             *  new Control({
             *     elTagName : 'ul',
             *      content : '<li>\u5185\u5bb9</li>',  //\u63a7\u4ef6\u7684DOM &lt;ul&gt;&lt;li&gt;\u5185\u5bb9&lt;/li&gt;&lt;/ul&gt;
             *     render : '#c1'
             *  });  
             * </code></pre>
			 * @cfg {String} elTagName
			 */
			elTagName: {
				// \u751f\u6210\u6807\u7b7e\u540d\u5b57
				view : true,
				value: 'div'
			},
            /**
             * \u5b50\u5143\u7d20\u7684\u9ed8\u8ba4 xclass,\u914d\u7f6echild\u7684\u65f6\u5019\u6ca1\u5fc5\u8981\u6bcf\u6b21\u90fd\u586b\u5199xclass
             * @type {String}
             */
            defaultChildClass : {
                
            },
            /**
             * \u5982\u679c\u63a7\u4ef6\u672a\u8bbe\u7f6e xclass\uff0c\u540c\u65f6\u7236\u5143\u7d20\u8bbe\u7f6e\u4e86 defaultChildClass\uff0c\u90a3\u4e48
             * xclass = defaultChildClass + '-' + xtype
             * <pre><code>
             *  A.ATTRS = {
             *    defaultChildClass : {
             *        value : 'b'
             *    }
             *  }
             *  //\u7c7bB \u7684xclass = 'b'\u7c7b B1\u7684xclass = 'b-1',\u7c7b B2\u7684xclass = 'b-2',\u90a3\u4e48
             *  var a = new A({
             *    children : [
             *        {content : 'b'}, //B\u7c7b
             *        {content : 'b1',xtype:'1'}, //B1\u7c7b
             *        {content : 'b2',xtype:'2'}, //B2\u7c7b
             *    ]
             *  });
             * </code></pre>
             * @type {String}
             */
            xtype : {

            },
            /**
             * \u6807\u793a\u63a7\u4ef6\u7684\u552f\u4e00\u7f16\u53f7\uff0c\u9ed8\u8ba4\u4f1a\u81ea\u52a8\u751f\u6210
             * @cfg {String} id
             */
            /**
             * \u6807\u793a\u63a7\u4ef6\u7684\u552f\u4e00\u7f16\u53f7\uff0c\u9ed8\u8ba4\u4f1a\u81ea\u52a8\u751f\u6210
             * @type {String}
             */
            id : {
                view : true
            },
            /**
             * \u63a7\u4ef6\u5bbd\u5ea6
             * <pre><code>
             * new Control({
             *   width : 200 // 200,'200px','20%'
             * });
             * </code></pre>
             * @cfg {Number|String} width
             */
            /**
             * \u63a7\u4ef6\u5bbd\u5ea6
             * <pre><code>
             *  control.set('width',200);
             *  control.set('width','200px');
             *  control.set('width','20%');
             * </code></pre>
             * @type {Number|String}
             */
            width:{
                view:1
            },
            /**
             * \u63a7\u4ef6\u5bbd\u5ea6
             * <pre><code>
             * new Control({
             *   height : 200 // 200,'200px','20%'
             * });
             * </code></pre>
             * @cfg {Number|String} height
             */
            /**
             * \u63a7\u4ef6\u5bbd\u5ea6
             * <pre><code>
             *  control.set('height',200);
             *  control.set('height','200px');
             *  control.set('height','20%');
             * </code></pre>
             * @type {Number|String}
             */
            height:{
                view:1
            },
            /**
             * \u63a7\u4ef6\u6839\u8282\u70b9\u5e94\u7528\u7684\u6837\u5f0f
             * <pre><code>
             *  new Control({
             *   elCls : 'test',
             *   content : '\u5185\u5bb9',
             *   render : '#t1'   //&lt;div id='t1'&gt;&lt;div class="test"&gt;\u5185\u5bb9&lt;/div&gt;&lt;/div&gt;
             *  });
             * </code></pre>
             * @cfg {String} elCls
             */
            /**
             * \u63a7\u4ef6\u6839\u8282\u70b9\u5e94\u7528\u7684\u6837\u5f0f css class
             * @type {String}
             */
            elCls:{
                view:1
            },
            /**
             * @cfg {Object} elStyle
			 * \u63a7\u4ef6\u6839\u8282\u70b9\u5e94\u7528\u7684css\u5c5e\u6027
             *  <pre><code>
             *    var cfg = {elStyle : {width:'100px', height:'200px'}};
             *  </code></pre>
             */
            /**
             * \u63a7\u4ef6\u6839\u8282\u70b9\u5e94\u7528\u7684css\u5c5e\u6027\uff0c\u4ee5\u952e\u503c\u5bf9\u5f62\u5f0f
             * @type {Object}
			 *  <pre><code>
             *	 control.set('elStyle',	{
             *		width:'100px',
             *		height:'200px'
             *   });
             *  </code></pre>
             */
            elStyle:{
                view:1
            },
            /**
             * @cfg {Object} elAttrs
			 * \u63a7\u4ef6\u6839\u8282\u70b9\u5e94\u7528\u7684\u5c5e\u6027\uff0c\u4ee5\u952e\u503c\u5bf9\u5f62\u5f0f:
             * <pre><code>
             *  new Control({
             *    elAttrs :{title : 'tips'}   
             *  });
             * </code></pre>
             */
            /**
             * @type {Object}
			 * \u63a7\u4ef6\u6839\u8282\u70b9\u5e94\u7528\u7684\u5c5e\u6027\uff0c\u4ee5\u952e\u503c\u5bf9\u5f62\u5f0f:
             * { title : 'tips'}
             * @ignore
             */
            elAttrs:{
                view:1
            },
            /**
             * \u5c06\u63a7\u4ef6\u63d2\u5165\u5230\u6307\u5b9a\u5143\u7d20\u524d
             * <pre><code>
             *  new Control({
             *      elBefore : '#t1'
             *  });
             * </code></pre>
             * @cfg {jQuery} elBefore
             */
            /**
             * \u5c06\u63a7\u4ef6\u63d2\u5165\u5230\u6307\u5b9a\u5143\u7d20\u524d
             * @type {jQuery}
             * @ignore
             */
            elBefore:{
                // better named to renderBefore, too late !
                view:1
            },

            /**
             * \u53ea\u8bfb\u5c5e\u6027\uff0c\u6839\u8282\u70b9DOM
             * @type {jQuery}
             */
            el:{
                view:1
            },
            /**
             * \u63a7\u4ef6\u652f\u6301\u7684\u4e8b\u4ef6
             * @type {Object}
             * @protected
             */
            events : {
                value : {
                    /**
                     * \u70b9\u51fb\u4e8b\u4ef6\uff0c\u6b64\u4e8b\u4ef6\u4f1a\u5192\u6ce1\uff0c\u6240\u4ee5\u53ef\u4ee5\u5728\u7236\u5143\u7d20\u4e0a\u76d1\u542c\u6240\u6709\u5b50\u5143\u7d20\u7684\u6b64\u4e8b\u4ef6
                     * @event
                     * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                     * @param {BUI.Component.Controller} e.target \u89e6\u53d1\u4e8b\u4ef6\u7684\u5bf9\u8c61
                     * @param {jQuery.Event} e.domEvent DOM\u89e6\u53d1\u7684\u4e8b\u4ef6
                     * @param {HTMLElement} e.domTarget \u89e6\u53d1\u4e8b\u4ef6\u7684DOM\u8282\u70b9
                     */
                    'click' : true,
                    /**
                     * \u53cc\u51fb\u4e8b\u4ef6\uff0c\u6b64\u4e8b\u4ef6\u4f1a\u5192\u6ce1\uff0c\u6240\u4ee5\u53ef\u4ee5\u5728\u7236\u5143\u7d20\u4e0a\u76d1\u542c\u6240\u6709\u5b50\u5143\u7d20\u7684\u6b64\u4e8b\u4ef6
                     * @event
                     * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                     * @param {BUI.Component.Controller} e.target \u89e6\u53d1\u4e8b\u4ef6\u7684\u5bf9\u8c61
                     * @param {jQuery.Event} e.domEvent DOM\u89e6\u53d1\u7684\u4e8b\u4ef6
                     * @param {HTMLElement} e.domTarget \u89e6\u53d1\u4e8b\u4ef6\u7684DOM\u8282\u70b9
                     */
                    'dblclick' : true,
                    /**
                     * \u9f20\u6807\u79fb\u5165\u63a7\u4ef6
                     * @event
                     * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                     * @param {BUI.Component.Controller} e.target \u89e6\u53d1\u4e8b\u4ef6\u7684\u5bf9\u8c61
                     * @param {jQuery.Event} e.domEvent DOM\u89e6\u53d1\u7684\u4e8b\u4ef6
                     * @param {HTMLElement} e.domTarget \u89e6\u53d1\u4e8b\u4ef6\u7684DOM\u8282\u70b9
                     */
                    'mouseenter' : true,
                    /**
                     * \u9f20\u6807\u79fb\u51fa\u63a7\u4ef6
                     * @event
                     * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                     * @param {BUI.Component.Controller} e.target \u89e6\u53d1\u4e8b\u4ef6\u7684\u5bf9\u8c61
                     * @param {jQuery.Event} e.domEvent DOM\u89e6\u53d1\u7684\u4e8b\u4ef6
                     * @param {HTMLElement} e.domTarget \u89e6\u53d1\u4e8b\u4ef6\u7684DOM\u8282\u70b9
                     */
                    'mouseleave' : true,
                    /**
                     * \u952e\u76d8\u6309\u4e0b\u6309\u952e\u4e8b\u4ef6\uff0c\u6b64\u4e8b\u4ef6\u4f1a\u5192\u6ce1\uff0c\u6240\u4ee5\u53ef\u4ee5\u5728\u7236\u5143\u7d20\u4e0a\u76d1\u542c\u6240\u6709\u5b50\u5143\u7d20\u7684\u6b64\u4e8b\u4ef6
                     * @event
                     * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                     * @param {BUI.Component.Controller} e.target \u89e6\u53d1\u4e8b\u4ef6\u7684\u5bf9\u8c61
                     * @param {jQuery.Event} e.domEvent DOM\u89e6\u53d1\u7684\u4e8b\u4ef6
                     * @param {HTMLElement} e.domTarget \u89e6\u53d1\u4e8b\u4ef6\u7684DOM\u8282\u70b9
                     */
                    'keydown' : true,
                    /**
                     * \u952e\u76d8\u6309\u952e\u62ac\u8d77\u63a7\u4ef6\uff0c\u6b64\u4e8b\u4ef6\u4f1a\u5192\u6ce1\uff0c\u6240\u4ee5\u53ef\u4ee5\u5728\u7236\u5143\u7d20\u4e0a\u76d1\u542c\u6240\u6709\u5b50\u5143\u7d20\u7684\u6b64\u4e8b\u4ef6
                     * @event
                     * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                     * @param {BUI.Component.Controller} e.target \u89e6\u53d1\u4e8b\u4ef6\u7684\u5bf9\u8c61
                     * @param {jQuery.Event} e.domEvent DOM\u89e6\u53d1\u7684\u4e8b\u4ef6
                     * @param {HTMLElement} e.domTarget \u89e6\u53d1\u4e8b\u4ef6\u7684DOM\u8282\u70b9
                     */
                    'keyup' : true,
                    /**
                     * \u63a7\u4ef6\u83b7\u53d6\u7126\u70b9\u4e8b\u4ef6
                     * @event
                     * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                     * @param {BUI.Component.Controller} e.target \u89e6\u53d1\u4e8b\u4ef6\u7684\u5bf9\u8c61
                     * @param {jQuery.Event} e.domEvent DOM\u89e6\u53d1\u7684\u4e8b\u4ef6
                     * @param {HTMLElement} e.domTarget \u89e6\u53d1\u4e8b\u4ef6\u7684DOM\u8282\u70b9
                     */
                    'focus' : false,
                    /**
                     * \u63a7\u4ef6\u4e22\u5931\u7126\u70b9\u4e8b\u4ef6
                     * @event
                     * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                     * @param {BUI.Component.Controller} e.target \u89e6\u53d1\u4e8b\u4ef6\u7684\u5bf9\u8c61
                     * @param {jQuery.Event} e.domEvent DOM\u89e6\u53d1\u7684\u4e8b\u4ef6
                     * @param {HTMLElement} e.domTarget \u89e6\u53d1\u4e8b\u4ef6\u7684DOM\u8282\u70b9
                     */
                    'blur' : false,
                    /**
                     * \u9f20\u6807\u6309\u4e0b\u63a7\u4ef6\uff0c\u6b64\u4e8b\u4ef6\u4f1a\u5192\u6ce1\uff0c\u6240\u4ee5\u53ef\u4ee5\u5728\u7236\u5143\u7d20\u4e0a\u76d1\u542c\u6240\u6709\u5b50\u5143\u7d20\u7684\u6b64\u4e8b\u4ef6
                     * @event
                     * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                     * @param {BUI.Component.Controller} e.target \u89e6\u53d1\u4e8b\u4ef6\u7684\u5bf9\u8c61
                     * @param {jQuery.Event} e.domEvent DOM\u89e6\u53d1\u7684\u4e8b\u4ef6
                     * @param {HTMLElement} e.domTarget \u89e6\u53d1\u4e8b\u4ef6\u7684DOM\u8282\u70b9
                     */
                    'mousedown' : true,
                    /**
                     * \u9f20\u6807\u62ac\u8d77\u63a7\u4ef6\uff0c\u6b64\u4e8b\u4ef6\u4f1a\u5192\u6ce1\uff0c\u6240\u4ee5\u53ef\u4ee5\u5728\u7236\u5143\u7d20\u4e0a\u76d1\u542c\u6240\u6709\u5b50\u5143\u7d20\u7684\u6b64\u4e8b\u4ef6
                     * @event
                     * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
                     * @param {BUI.Component.Controller} e.target \u89e6\u53d1\u4e8b\u4ef6\u7684\u5bf9\u8c61
                     * @param {jQuery.Event} e.domEvent DOM\u89e6\u53d1\u7684\u4e8b\u4ef6
                     * @param {HTMLElement} e.domTarget \u89e6\u53d1\u4e8b\u4ef6\u7684DOM\u8282\u70b9
                     */
                    'mouseup' : true,
                    /**
                     * \u63a7\u4ef6\u663e\u793a
                     * @event
                     */
                    'show' : false,
                    /**
                     * \u63a7\u4ef6\u9690\u85cf
                     * @event
                     */
                    'hide' : false
                }
            },
            /**
             * \u6307\u5b9a\u63a7\u4ef6\u7684\u5bb9\u5668
             * <pre><code>
             *  new Control({
             *    render : '#t1',
             *    elCls : 'test',
             *    content : '<span>123</span>'  //&lt;div id="t1"&gt;&lt;div class="test bui-xclass"&gt;&lt;span&gt;123&lt;/span&gt;&lt;/div&gt;&lt;/div&gt;
             *  });
             * </code></pre>
             * @cfg {jQuery} render
             */
            /**
             * \u6307\u5b9a\u63a7\u4ef6\u7684\u5bb9\u5668
             * @type {jQuery}
             * @ignore
             */
            render:{
                view:1
            },
            /**
             * \u72b6\u6001\u76f8\u5173\u7684\u6837\u5f0f,\u9ed8\u8ba4\u60c5\u51b5\u4e0b\u4f1a\u4f7f\u7528 \u524d\u7f00\u540d + xclass + '-' + \u72b6\u6001\u540d
             * <ol>
             *     <li>hover</li>
             *     <li>focused</li>
             *     <li>active</li>
             *     <li>disabled</li>
             * </ol>
             * @type {Object}
             */
            statusCls : {
                view : true,
                value : {

                }
            },
            /**
             * \u63a7\u4ef6\u7684\u53ef\u89c6\u65b9\u5f0f,\u503c\u4e3a\uff1a
             *  - 'display' 
             *  - 'visibility'
             *  <pre><code>
             *   new Control({
             *     visibleMode: 'visibility'
             *   });
             *  </code></pre>
             * @cfg {String} [visibleMode = 'display']
             */
            /**
             * \u63a7\u4ef6\u7684\u53ef\u89c6\u65b9\u5f0f,\u4f7f\u7528 css 
             *  - 'display' \u6216\u8005 
             *  - 'visibility'
             * <pre><code>
             *  control.set('visibleMode','display')
             * </code></pre>
             * @type {String}
             */
            visibleMode:{
                view:1,
                value : 'display'
            },
            /**
             * \u63a7\u4ef6\u662f\u5426\u53ef\u89c1
             * <pre><code>
             *  new Control({
             *    visible : false   //\u9690\u85cf
             *  });
             * </code></pre>
             * @cfg {Boolean} [visible = true]
             */
            /**
             * \u63a7\u4ef6\u662f\u5426\u53ef\u89c1
             * <pre><code>
             *  control.set('visible',true); //control.show();
             *  control.set('visible',false); //control.hide();
             * </code></pre>
             * @type {Boolean}
             * @default true
             */
            visible:{
                value:true,
                view:1
            },
            /**
             * \u662f\u5426\u5141\u8bb8\u5904\u7406\u9f20\u6807\u4e8b\u4ef6
             * @default true.
             * @type {Boolean}
             * @protected
             */
            handleMouseEvents: {
                value: true
            },

            /**
             * \u63a7\u4ef6\u662f\u5426\u53ef\u4ee5\u83b7\u53d6\u7126\u70b9
             * @default true.
             * @protected
             * @type {Boolean}
             */
            focusable: {
                value: false,
                view: 1
            },

            /**
             * 1. Whether allow select this component's text.<br/>
             * 2. Whether not to lose last component's focus if click current one (set false).
             *
             * Defaults to: false.
             * @type {Boolean}
             * @property allowTextSelection
             * @protected
             */
            /**
             * @ignore
             */
            allowTextSelection: {
                // \u548c focusable \u5206\u79bb
                // grid \u9700\u6c42\uff1a\u5bb9\u5668\u5141\u8bb8\u9009\u62e9\u91cc\u9762\u5185\u5bb9
                value: true
            },

            /**
             * \u63a7\u4ef6\u662f\u5426\u53ef\u4ee5\u6fc0\u6d3b
             * @default true.
             * @type {Boolean}
             * @protected
             */
            activeable: {
                value: true
            },

            /**
             * \u63a7\u4ef6\u662f\u5426\u83b7\u53d6\u7126\u70b9
             * @type {Boolean}
             * @readOnly
             */
            focused: {
                view: 1
            },

            /**
             * \u63a7\u4ef6\u662f\u5426\u5904\u4e8e\u6fc0\u6d3b\u72b6\u6001\uff0c\u6309\u94ae\u6309\u4e0b\u8fd8\u672a\u62ac\u8d77
             * @type {Boolean}
             * @default false
             * @protected
             */
            active: {
                view: 1
            },
            /**
             * \u63a7\u4ef6\u662f\u5426\u9ad8\u4eae
             * @cfg {Boolean} highlighted
             * @ignore
             */
            /**
             * \u63a7\u4ef6\u662f\u5426\u9ad8\u4eae
             * @type {Boolean}
             * @protected
             */
            highlighted: {
                view: 1
            },
            /**
             * \u5b50\u63a7\u4ef6\u96c6\u5408
             * @cfg {BUI.Component.Controller[]} children
             */
            /**
             * \u5b50\u63a7\u4ef6\u96c6\u5408
             * @type {BUI.Component.Controller[]}
             */
            children: {
                value: []
            },
            /**
             * \u63a7\u4ef6\u7684CSS\u524d\u7f00
             * @cfg {String} [prefixCls = BUI.prefix]
             */
            /**
             * \u63a7\u4ef6\u7684CSS\u524d\u7f00
             * @type {String}
             * @default BUI.prefix
             */
            prefixCls: {
                value: BUI.prefix, // box srcNode need
                view: 1
            },

            /**
             * \u7236\u63a7\u4ef6
             * @cfg {BUI.Component.Controller} parent
             * @ignore
             */
            /**
             * \u7236\u63a7\u4ef6
             * @type {BUI.Component.Controller}
             */
            parent: {
                setter: function (p) {
                    // \u4e8b\u4ef6\u5192\u6ce1\u6e90
                    this.addTarget(p);
                }
            },

            /**
             * \u7981\u7528\u63a7\u4ef6
             * @cfg {Boolean} [disabled = false]
             */
            /**
             * \u7981\u7528\u63a7\u4ef6
             * <pre><code>
             *  control.set('disabled',true); //==  control.disable();
             *  control.set('disabled',false); //==  control.enable();
             * </code></pre>
             * @type {Boolean}
             * @default false
             */
            disabled: {
                view: 1,
                value : false
            },
            /**
             * \u6e32\u67d3\u63a7\u4ef6\u7684View\u7c7b.
             * @protected
             * @cfg {BUI.Component.View} [xview = BUI.Component.View]
             */
            /**
             * \u6e32\u67d3\u63a7\u4ef6\u7684View\u7c7b.
             * @protected
             * @type {BUI.Component.View}
             */
            xview: {
                value: View
            }
        },
        PARSER : {
            visible : function(el){
                var _self = this,
                    display = el.css('display'),

                    visibility = el.css('visibility'),
                    visibleMode = _self.get('visibleMode');
                if((display == 'none' && visibleMode == 'display')  || (visibility == 'hidden' && visibleMode == 'visibility')){
                    return false;
                }
                return true;
            }
        }
    }, {
        xclass: 'controller',
        priority : 0
    });
    
    return Controller;
});
/**
 * @ignore
 * @fileOverview cookie
 * @author lifesinger@gmail.com
 */


define('bui/cookie',function () {

    var doc = document,
        MILLISECONDS_OF_DAY = 24 * 60 * 60 * 1000,
        encode = encodeURIComponent,
        decode = decodeURIComponent;

    function isNotEmptyString(val) {
        return typeof(val) === 'string' && val !== '';
    }

    /**
     * Provide Cookie utilities.
     * @class BUI.Cookie
     * @singleton
     */
    var Cookie = {

        /**
         * Returns the cookie value for given name
         * @return {String} name The name of the cookie to retrieve
         */
        get: function (name) {
            var ret, m;

            if (isNotEmptyString(name)) {
                if ((m = String(doc.cookie).match(
                    new RegExp('(?:^| )' + name + '(?:(?:=([^;]*))|;|$)')))) {
                    ret = m[1] ? decode(m[1]) : '';
                }
            }
            return ret;
        },

        /**
         * Set a cookie with a given name and value
         * @param {String} name The name of the cookie to set
         * @param {String} val The value to set for cookie
         * @param {Number|Date} expires
         * if Number secified how many days this cookie will expire
         * @param {String} domain set cookie's domain
         * @param {String} path set cookie's path
         * @param {Boolean} secure whether this cookie can only be sent to server on https
         */
        set: function (name, val, expires, domain, path, secure) {
            var text = String(encode(val)), date = expires;

            // \u4ece\u5f53\u524d\u65f6\u95f4\u5f00\u59cb\uff0c\u591a\u5c11\u5929\u540e\u8fc7\u671f
            if (typeof date === 'number') {
                date = new Date();
                date.setTime(date.getTime() + expires * MILLISECONDS_OF_DAY);
            }
            // expiration date
            if (date instanceof Date) {
                text += '; expires=' + date.toUTCString();
            }

            // domain
            if (isNotEmptyString(domain)) {
                text += '; domain=' + domain;
            }

            // path
            if (isNotEmptyString(path)) {
                text += '; path=' + path;
            }

            // secure
            if (secure) {
                text += '; secure';
            }

            doc.cookie = name + '=' + text;
        },

        /**
         * Remove a cookie from the machine by setting its expiration date to sometime in the past
         * @param {String} name The name of the cookie to remove.
         * @param {String} domain The cookie's domain
         * @param {String} path The cookie's path
         * @param {String} secure The cookie's secure option
         */
        remove: function (name, domain, path, secure) {
            this.set(name, '', -1, domain, path, secure);
        }
    };
    
    BUI.Cookie = Cookie;
    
    return Cookie;
});

/**
* @ignore
* 2012.02.14 yiminghe@gmail.com
* - jsdoc added
*
* 2010.04
* - get \u65b9\u6cd5\u8981\u8003\u8651 ie \u4e0b\uff0c
* \u503c\u4e3a\u7a7a\u7684 cookie \u4e3a 'test3; test3=3; test3tt=2; test1=t1test3; test3', \u6ca1\u6709\u7b49\u4e8e\u53f7\u3002
* \u9664\u4e86\u6b63\u5219\u83b7\u53d6\uff0c\u8fd8\u53ef\u4ee5 split \u5b57\u7b26\u4e32\u7684\u65b9\u5f0f\u6765\u83b7\u53d6\u3002
* - api \u8bbe\u8ba1\u4e0a\uff0c\u539f\u672c\u60f3\u501f\u9274 jQuery \u7684\u7b80\u660e\u98ce\u683c\uff1aS.cookie(name, ...), \u4f46\u8003\u8651\u5230\u53ef\u6269\u5c55\u6027\uff0c\u76ee\u524d
* \u72ec\u7acb\u6210\u9759\u6001\u5de5\u5177\u7c7b\u7684\u65b9\u5f0f\u66f4\u4f18\u3002
*/
/**
 * @fileOverview Data \u547d\u540d\u7a7a\u95f4\u7684\u5165\u53e3\u6587\u4ef6
 * @ignore
 */
(function(){
var BASE = 'bui/data/';
define('bui/data',['bui/common',BASE + 'sortable',BASE + 'proxy',BASE + 'abstractstore',BASE + 'store',
  BASE + 'node',BASE + 'treestore'],function(r) {
  
  var BUI = r('bui/common'),
    Data = BUI.namespace('Data');
  BUI.mix(Data,{
    Sortable : r(BASE + 'sortable'),
    Proxy : r(BASE + 'proxy'),
    AbstractStore : r(BASE + 'abstractstore'),
    Store : r(BASE + 'store'),
    Node : r(BASE + 'node'),
    TreeStore : r(BASE + 'treestore')
  });

  return Data;
});
})();
/**
 * @fileOverview \u53ef\u6392\u5e8f\u6269\u5c55\u7c7b
 * @ignore
 */

define('bui/data/sortable',function() {

  var ASC = 'ASC',
    DESC = 'DESC';
  /**
   * \u6392\u5e8f\u6269\u5c55\u65b9\u6cd5\uff0c\u65e0\u6cd5\u76f4\u63a5\u4f7f\u7528
   * \u8bf7\u5728\u7ee7\u627f\u4e86 {@link BUI.Base}\u7684\u7c7b\u4e0a\u4f7f\u7528
   * @class BUI.Data.Sortable
   * @extends BUI.Base
   */
  var sortable = function(){

  };

  sortable.ATTRS = 
  /**
   * @lends BUI.Data.Sortable#
   * @ignore
   */
  {
    /**
     * \u6bd4\u8f83\u51fd\u6570
     * @cfg {Function} compareFunction
     * \u51fd\u6570\u539f\u578b function(v1,v2)\uff0c\u6bd4\u8f832\u4e2a\u5b57\u6bb5\u662f\u5426\u76f8\u7b49
     * \u5982\u679c\u662f\u5b57\u7b26\u4e32\u5219\u6309\u7167\u672c\u5730\u6bd4\u8f83\u7b97\u6cd5\uff0c\u5426\u5219\u4f7f\u7528 > ,== \u9a8c\u8bc1
     */
    compareFunction:{
      value : function(v1,v2){
        if(v1 === undefined){
          v1 = '';
        }
        if(v2 === undefined){
          v2 = '';
        }
        if(BUI.isString(v1)){
          return v1.localeCompare(v2);
        }

        if(v1 > v2){
          return 1;
        }else if(v1 === v2){
          return 0;
        }else{
          return  -1;
        }
      }
    },
    /**
     * \u6392\u5e8f\u5b57\u6bb5
     * @cfg {String} sortField
     */
    /**
     * \u6392\u5e8f\u5b57\u6bb5
     * @type {String}
     */
    sortField : {

    },
    /**
     * \u6392\u5e8f\u65b9\u5411,'ASC'\u3001'DESC'
     * @cfg {String} [sortDirection = 'ASC']
     */
    /**
     * \u6392\u5e8f\u65b9\u5411,'ASC'\u3001'DESC'
     * @type {String}
     */
    sortDirection : {
      value : 'ASC'
    },
    /**
     * \u6392\u5e8f\u4fe1\u606f
     * <ol>
     * <li>field: \u6392\u5e8f\u5b57\u6bb5</li>
     * <li>direction: \u6392\u5e8f\u65b9\u5411,ASC(\u9ed8\u8ba4),DESC</li>
     * </ol>
     * @cfg {Object} sortInfo
     */
    /**
     * \u6392\u5e8f\u4fe1\u606f
     * <ol>
     * <li>field: \u6392\u5e8f\u5b57\u6bb5</li>
     * <li>direction: \u6392\u5e8f\u65b9\u5411,ASC(\u9ed8\u8ba4),DESC</li>
     * </ol>
     * @type {Object}
     */
    sortInfo: {
      getter : function(){
        var _self = this,
          field = _self.get('sortField');

        return {
          field : field,
          direction : _self.get('sortDirection')
        };
      },
      setter: function(v){
        var _self = this;

        _self.set('sortField',v.field);
        _self.set('sortDirection',v.direction);
      }
    }
  };

  BUI.augment(sortable,
  /**
   * @lends BUI.Data.Sortable.prototype
   * @ignore
   */
  {
    compare : function(obj1,obj2,field,direction){

      var _self = this,
        dir;
      field = field || _self.get('sortField');
      direction = direction || _self.get('sortDirection');
      //\u5982\u679c\u672a\u6307\u5b9a\u6392\u5e8f\u5b57\u6bb5\uff0c\u6216\u65b9\u5411\uff0c\u5219\u6309\u7167\u9ed8\u8ba4\u987a\u5e8f
      if(!field || !direction){
        return 1;
      }
      dir = direction === ASC ? 1 : -1;

      return _self.get('compareFunction')(obj1[field],obj2[field]) * dir;
    },
    /**
     * \u83b7\u53d6\u6392\u5e8f\u7684\u96c6\u5408
     * @protected
     * @return {Array} \u6392\u5e8f\u96c6\u5408
     */
    getSortData : function(){

    },
    /**
     * \u6392\u5e8f\u6570\u636e
     * @param  {String|Array} field   \u6392\u5e8f\u5b57\u6bb5\u6216\u8005\u6570\u7ec4
     * @param  {String} direction \u6392\u5e8f\u65b9\u5411
     * @param {Array} records \u6392\u5e8f
     * @return {Array}    
     */
    sortData : function(field,direction,records){
      var _self = this,
        records = records || _self.getSortData();

      if(BUI.isArray(field)){
        records = field;
        field = null;
      }

      field = field || _self.get('sortField');
      direction = direction || _self.get('sortDirection');

      _self.set('sortField',field);
      _self.set('sortDirection',direction);

      if(!field || !direction){
        return records;
      }

      records.sort(function(obj1,obj2){
        return _self.compare(obj1,obj2,field,direction);
      });
      return records;
    }
  });

  return sortable;
});
define('bui/data/proxy',['bui/data/sortable'],function(require) {

  var Sortable = require('bui/data/sortable');

  /**
   * \u6570\u636e\u4ee3\u7406\u5bf9\u8c61\uff0c\u52a0\u8f7d\u6570\u636e,
   * \u4e00\u822c\u4e0d\u76f4\u63a5\u4f7f\u7528\uff0c\u5728store\u91cc\u9762\u51b3\u5b9a\u4f7f\u7528\u4ec0\u4e48\u7c7b\u578b\u7684\u6570\u636e\u4ee3\u7406\u5bf9\u8c61
   * @class BUI.Data.Proxy
   * @extends BUI.Base
   * @abstract 
   */
  var proxy = function(config){
    proxy.superclass.constructor.call(this,config);
  };

  proxy.ATTRS = {
    
  };

  BUI.extend(proxy,BUI.Base);

  BUI.augment(proxy,
  /**
   * @lends BUI.Data.Proxy.prototype
   * @ignore
   */
  {
    /**
     * @protected
     * @private
     */
    _read : function(params,callback){

    },
    /**
     * \u8bfb\u6570\u636e
     * @param  {Object} params \u952e\u503c\u5bf9\u5f62\u5f0f\u7684\u53c2\u6570
     * @param {Function} callback \u56de\u8c03\u51fd\u6570\uff0c\u51fd\u6570\u539f\u578b function(data){}
     * @param {Object} scope \u56de\u8c03\u51fd\u6570\u7684\u4e0a\u4e0b\u6587
     */
    read : function(params,callback,scope){
      var _self = this;
      scope = scope || _self;

      _self._read(params,function(data){
        callback.call(scope,data);
      });
    },
    /**
     * \u66f4\u65b0\u6570\u636e
     * @protected
     */
    update : function(params,callback,scope){

    }
  });

  /**
   * \u5f02\u6b65\u52a0\u8f7d\u6570\u636e\u7684\u4ee3\u7406
   * @class BUI.Data.Proxy.Ajax
   * @extends BUI.Data.Proxy
   */
  var ajaxProxy = function(config){
    ajaxProxy.superclass.constructor.call(this,config);
  };

  ajaxProxy.ATTRS = BUI.mix(true,proxy.ATTRS,
  /**
   * @lends BUI.Data.Proxy.Ajax#
   * @ignore
   */
  {
    /**
     * \u9650\u5236\u6761\u6570
     * @cfg {String} [limitParam='limit'] 
     */
    /**
     * \u9650\u5236\u6761\u6570
     * @type {String}
     * @default 'limit'
     */
    limitParam : {
      value : 'limit'
    },
    /**
     * \u8d77\u59cb\u7eaa\u5f55\u4ee3\u8868\u7684\u5b57\u6bb5
     * @cfg {String} [startParam='start']
     */
    /**
     * \u8d77\u59cb\u7eaa\u5f55\u4ee3\u8868\u7684\u5b57\u6bb5
     * @type {String}
     */
    startParam : {
      value : 'start'
    },
    /**
     * \u9875\u7801\u7684\u5b57\u6bb5\u540d
     * @cfg {String} [pageIndexParam='pageIndex']
     */
    /**
     * \u9875\u7801\u7684\u5b57\u6bb5\u540d
     * @type {String}
     * @default 'pageIndex'
     */
    pageIndexParam : {
      value : 'pageIndex'
    },
    /**
    * \u52a0\u8f7d\u6570\u636e\u65f6\uff0c\u8fd4\u56de\u7684\u683c\u5f0f,\u76ee\u524d\u53ea\u652f\u6301"json\u3001jsonp"\u683c\u5f0f<br>
    * @cfg {String} [dataType='json']
    */
   /**
    * \u52a0\u8f7d\u6570\u636e\u65f6\uff0c\u8fd4\u56de\u7684\u683c\u5f0f,\u76ee\u524d\u53ea\u652f\u6301"json\u3001jsonp"\u683c\u5f0f<br>
    * @type {String}
    * @default "json"
    */
    dataType: {
      value : 'json'
    },
    /**
     * \u83b7\u53d6\u6570\u636e\u7684\u65b9\u5f0f,'GET'\u6216\u8005'POST',\u9ed8\u8ba4\u4e3a'GET'
     * @cfg {String} [method='GET']
     */
    /**
     * \u83b7\u53d6\u6570\u636e\u7684\u65b9\u5f0f,'GET'\u6216\u8005'POST',\u9ed8\u8ba4\u4e3a'GET'
     * @type {String}
     * @default 'GET'
     */
    method : {
      value : 'GET'
    },
    /**
     * \u662f\u5426\u4f7f\u7528Cache
     * @type {Boolean}
     */
    cache : {
      value : false
    },
    /**
     * \u52a0\u8f7d\u6570\u636e\u7684\u94fe\u63a5
     * @cfg {String} url
     * @required
     */
    /**
     * \u52a0\u8f7d\u6570\u636e\u7684\u94fe\u63a5
     * @type {String}
     * @required
     */
    url :{

    }

  });
  BUI.extend(ajaxProxy,proxy);

  BUI.augment(ajaxProxy,{
    _processParams : function(params){
      var _self = this,
        arr = ['start','limit','pageIndex'];

      $.each(arr,function(field){
        var fieldParam = _self.get(field+'Param');
        if(fieldParam !== field){
          params[fieldParam] = params[field];
          delete params[field];
        }
      });
    },
    /**
     * @protected
     * @private
     */
    _read : function(params,callback){
      var _self = this;

      params = BUI.cloneObject(params);
      _self._processParams(params);

      $.ajax({
        url: _self.get('url'),
        type : _self.get('method'),
        dataType: _self.get('dataType'),
        data : params,
        cache : _self.get('cache'),
        success: function(data) {
          callback(data);
        },
        error : function(jqXHR, textStatus, errorThrown){
          var result = {
            exception : {
              status : textStatus,
              errorThrown: errorThrown,
              jqXHR : jqXHR
            }
          };
          callback(result);
        }
      });
    }
  });

  /**
   * \u8bfb\u53d6\u7f13\u5b58\u7684\u4ee3\u7406
   * @class BUI.Data.Proxy.Memery
   * @extends BUI.Data.Proxy
   * @mixins BUI.Data.Sortable
   */
  var memeryProxy = function(config){
    memeryProxy.superclass.constructor.call(this,config);
  };

  BUI.extend(memeryProxy,proxy);

  BUI.mixin(memeryProxy,[Sortable]);

  BUI.augment(memeryProxy,{
    /**
     * @protected
     * @ignore
     */
    _read : function(params,callback){
      var _self = this,
        pageable = params.pageable,
        start = params.start,
        sortField = params.sortField,
        sortDirection = params.sortDirection,
        limit = params.limit,
        data = _self.get('data'),
        rows = []; 

      _self.sortData(sortField,sortDirection); 

      if(limit){//\u5206\u9875\u65f6
        rows = data.slice(start,start + limit);
        callback({rows:rows,results:data.length});
      }else{//\u4e0d\u5206\u9875\u65f6
        rows = data.slice(start);
        callback(rows);
      }
      
    }

  });

  proxy.Ajax = ajaxProxy;
  proxy.Memery = memeryProxy;

  return proxy;


});
/**
 * @fileOverview \u62bd\u8c61\u6570\u636e\u7f13\u51b2\u7c7b
 * @ignore
 */

define('bui/data/abstractstore',['bui/common','bui/data/proxy'],function (require) {
  var BUI = require('bui/common'),
    Proxy = require('bui/data/proxy');

  /**
   * @class BUI.Data.AbstractStore
   * \u6570\u636e\u7f13\u51b2\u62bd\u8c61\u7c7b,\u6b64\u7c7b\u4e0d\u8fdb\u884c\u5b9e\u4f8b\u5316
   * @extends BUI.Base
   */
  function AbstractStore(config){
    AbstractStore.superclass.constructor.call(this,config);
    this._init();
  }

  AbstractStore.ATTRS = {
    /**
    * \u521b\u5efa\u5bf9\u8c61\u65f6\u662f\u5426\u81ea\u52a8\u52a0\u8f7d
    * <pre><code>
    *   var store = new Data.Store({
    *     url : 'data.php',  //\u8bbe\u7f6e\u52a0\u8f7d\u6570\u636e\u7684URL
    *     autoLoad : true    //\u521b\u5efaStore\u65f6\u81ea\u52a8\u52a0\u8f7d\u6570\u636e
    *   });
    * </code></pre>
    * @cfg {Boolean} [autoLoad=false]
    */
    autoLoad: {
      value :false 
    },
    /**
     * \u4e0a\u6b21\u67e5\u8be2\u7684\u53c2\u6570
     * @type {Object}
     * @readOnly
     */
    lastParams : {
      value : {}
    },
    /**
     * \u521d\u59cb\u5316\u65f6\u67e5\u8be2\u7684\u53c2\u6570\uff0c\u5728\u521d\u59cb\u5316\u65f6\u6709\u6548
     * <pre><code>
     * var store = new Data.Store({
    *     url : 'data.php',  //\u8bbe\u7f6e\u52a0\u8f7d\u6570\u636e\u7684URL
    *     autoLoad : true,    //\u521b\u5efaStore\u65f6\u81ea\u52a8\u52a0\u8f7d\u6570\u636e
    *     params : {         //\u8bbe\u7f6e\u8bf7\u6c42\u65f6\u7684\u53c2\u6570
    *       id : '1',
    *       type : '1'
    *     }
    *   });
     * </code></pre>
     * @cfg {Object} params
     */
    params : {

    },
    /**
     * \u6570\u636e\u4ee3\u7406\u5bf9\u8c61,\u7528\u4e8e\u52a0\u8f7d\u6570\u636e\u7684ajax\u914d\u7f6e\uff0c{@link BUI.Data.Proxy}
     * <pre><code>
     *   var store = new Data.Store({
    *     url : 'data.php',  //\u8bbe\u7f6e\u52a0\u8f7d\u6570\u636e\u7684URL
    *     autoLoad : true,    //\u521b\u5efaStore\u65f6\u81ea\u52a8\u52a0\u8f7d\u6570\u636e
    *     proxy : {
    *       method : 'post',
    *       dataType : 'jsonp'
    *     }
    *   });
     * </code></pre>
     * @cfg {Object|BUI.Data.Proxy} proxy
     */
    proxy : {
      value : {
        
      }
    },
    /**
     * \u8bf7\u6c42\u6570\u636e\u7684\u5730\u5740\uff0c\u901a\u8fc7ajax\u52a0\u8f7d\u6570\u636e\uff0c
     * \u6b64\u53c2\u6570\u8bbe\u7f6e\u5219\u52a0\u8f7d\u8fdc\u7a0b\u6570\u636e
     * ** \u4f60\u53ef\u4ee5\u8bbe\u7f6e\u5728proxy\u5916\u90e8 **
     * <pre><code>
     *   var store = new Data.Store({
    *     url : 'data.php',  //\u8bbe\u7f6e\u52a0\u8f7d\u6570\u636e\u7684URL
    *     autoLoad : true,    //\u521b\u5efaStore\u65f6\u81ea\u52a8\u52a0\u8f7d\u6570\u636e
    *     proxy : {
    *       method : 'post',
    *       dataType : 'jsonp'
    *     }
    *   });
     * </code></pre>
     * ** \u4f60\u4e5f\u53ef\u4ee5\u8bbe\u7f6e\u5728proxy\u4e0a **
     * <pre><code>
     *   var store = new Data.Store({
    *     autoLoad : true,    //\u521b\u5efaStore\u65f6\u81ea\u52a8\u52a0\u8f7d\u6570\u636e
    *     proxy : {
    *       url : 'data.php',  //\u8bbe\u7f6e\u52a0\u8f7d\u6570\u636e\u7684URL
    *       method : 'post',
    *       dataType : 'jsonp'
    *     }
    *   });
     * </code></pre>
     * \u5426\u5219\u628a {BUI.Data.Store#cfg-data}\u4f5c\u4e3a\u672c\u5730\u7f13\u5b58\u6570\u636e\u52a0\u8f7d
     * @cfg {String} url
     */
    /**
     * \u8bf7\u6c42\u6570\u636e\u7684url
     * <pre><code>
     *   //\u66f4\u6539url
     *   store.get('proxy').set('url',url);
     * </code></pre>
     * @type {String}
     */
    url : {

    },
    events : {
      value : [
        /**  
        * \u6570\u636e\u63a5\u53d7\u6539\u53d8\uff0c\u6240\u6709\u589e\u52a0\u3001\u5220\u9664\u3001\u4fee\u6539\u7684\u6570\u636e\u8bb0\u5f55\u6e05\u7a7a
        * @name BUI.Data.Store#acceptchanges
        * @event  
        */
        'acceptchanges',
        /**  
        * \u5f53\u6570\u636e\u52a0\u8f7d\u5b8c\u6210\u540e
        * @name BUI.Data.Store#load  
        * @event  
        * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61\uff0c\u5305\u542b\u52a0\u8f7d\u6570\u636e\u65f6\u7684\u53c2\u6570
        */
        'load',

        /**  
        * \u5f53\u6570\u636e\u52a0\u8f7d\u524d
        * @name BUI.Data.Store#beforeload
        * @event  
        */
        'beforeload',

        /**  
        * \u53d1\u751f\u5728\uff0cbeforeload\u548cload\u4e2d\u95f4\uff0c\u6570\u636e\u5df2\u7ecf\u83b7\u53d6\u5b8c\u6210\uff0c\u4f46\u662f\u8fd8\u672a\u89e6\u53d1load\u4e8b\u4ef6\uff0c\u7528\u4e8e\u83b7\u53d6\u8fd4\u56de\u7684\u539f\u59cb\u6570\u636e
        * @name BUI.Data.Store#beforeProcessLoad
        * @event  
        * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
        * @param {Object} e.data \u4ece\u670d\u52a1\u5668\u7aef\u8fd4\u56de\u7684\u6570\u636e
        */
        'beforeProcessLoad',
        
        /**  
        * \u5f53\u6dfb\u52a0\u6570\u636e\u65f6\u89e6\u53d1\u8be5\u4e8b\u4ef6
        * @event  
        * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
        * @param {Object} e.record \u6dfb\u52a0\u7684\u6570\u636e
        */
        'add',

        /**
        * \u52a0\u8f7d\u6570\u636e\u53d1\u751f\u5f02\u5e38\u65f6\u89e6\u53d1
        * @event
        * @name BUI.Data.Store#exception
        * @param {jQuery.Event} e \u4e8b\u4ef6\u5bf9\u8c61
        * @param {String|Object} e.error \u52a0\u8f7d\u6570\u636e\u65f6\u8fd4\u56de\u7684\u9519\u8bef\u4fe1\u606f\u6216\u8005\u52a0\u8f7d\u6570\u636e\u5931\u8d25\uff0c\u6d4f\u89c8\u5668\u8fd4\u56de\u7684\u4fe1\u606f\uff08httpResponse \u5bf9\u8c61 \u7684textStatus\uff09
        * @param {String} e.responseText \u7f51\u7edc\u6216\u8005\u6d4f\u89c8\u5668\u52a0\u8f7d\u6570\u636e\u53d1\u751f\u9519\u8bef\u662f\u8fd4\u56de\u7684httpResponse \u5bf9\u8c61\u7684responseText
        */
        'exception',

        /**  
        * \u5f53\u5220\u9664\u6570\u636e\u662f\u89e6\u53d1\u8be5\u4e8b\u4ef6
        * @event  
        * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
        * @param {Object} e.data \u5220\u9664\u7684\u6570\u636e
        */
        'remove',
        
        /**  
        * \u5f53\u66f4\u65b0\u6570\u636e\u6307\u5b9a\u5b57\u6bb5\u65f6\u89e6\u53d1\u8be5\u4e8b\u4ef6 
        * @event  
        * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
        * @param {Object} e.record \u66f4\u65b0\u7684\u6570\u636e
        * @param {Object} e.field \u66f4\u65b0\u7684\u5b57\u6bb5
        * @param {Object} e.value \u66f4\u65b0\u7684\u503c
        */
        'update',

        /**  
        * \u524d\u7aef\u53d1\u751f\u6392\u5e8f\u65f6\u89e6\u53d1
        * @name BUI.Data.Store#localsort
        * @event  
        * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
        * @param {Object} e.field \u6392\u5e8f\u7684\u5b57\u6bb5
        * @param {Object} e.direction \u6392\u5e8f\u7684\u65b9\u5411 'ASC'\uff0c'DESC'
        */
        'localsort'
      ]
    },
    /**
     * \u672c\u5730\u6570\u636e\u6e90,\u4f7f\u7528\u672c\u5730\u6570\u636e\u6e90\u65f6\u4f1a\u4f7f\u7528{@link BUI.Data.Proxy.Memery}
     * @cfg {Array} data
     */
    /**
     * \u672c\u5730\u6570\u636e\u6e90
     * @type {Array}
     */
    data : {
      setter : function(data){
        var _self = this,
          proxy = _self.get('proxy');
        if(proxy.set){
          proxy.set('data',data);
        }else{
          proxy.data = data;
        }
        //\u8bbe\u7f6e\u672c\u5730\u6570\u636e\u65f6\uff0c\u628aautoLoad\u7f6e\u4e3atrue
        _self.set('autoLoad',true);
      }
    }
  };

  BUI.extend(AbstractStore,BUI.Base);

  BUI.augment(AbstractStore,{
    /**
     * \u662f\u5426\u662f\u6570\u636e\u7f13\u51b2\u5bf9\u8c61\uff0c\u7528\u4e8e\u5224\u65ad\u5bf9\u8c61
     * @type {Boolean}
     */
    isStore : true,
    /**
     * @private
     * \u521d\u59cb\u5316
     */
    _init : function(){
      var _self = this;

      _self.beforeInit();
      //\u521d\u59cb\u5316\u7ed3\u679c\u96c6
      _self._initParams();
      _self._initProxy();
      _self._initData();
    },
    /**
     * @protected
     * \u521d\u59cb\u5316\u4e4b\u524d
     */
    beforeInit : function(){

    },
    //\u521d\u59cb\u5316\u6570\u636e,\u5982\u679c\u9ed8\u8ba4\u52a0\u8f7d\u6570\u636e\uff0c\u5219\u52a0\u8f7d\u6570\u636e
    _initData : function(){
      var _self = this,
        autoLoad = _self.get('autoLoad');

      if(autoLoad){
        _self.load();
      }
    },
    //\u521d\u59cb\u5316\u67e5\u8be2\u53c2\u6570
    _initParams : function(){
      var _self = this,
        lastParams = _self.get('lastParams'),
        params = _self.get('params');

      //\u521d\u59cb\u5316 \u53c2\u6570
      BUI.mix(lastParams,params);
    },
    /**
     * @protected
     * \u521d\u59cb\u5316\u6570\u636e\u4ee3\u7406\u7c7b
     */
    _initProxy : function(){
      var _self = this,
        url = _self.get('url'),
        proxy = _self.get('proxy');

      if(!(proxy instanceof Proxy)){

        if(url){
          proxy.url = url;
        }

        //\u5f02\u6b65\u8bf7\u6c42\u7684\u4ee3\u7406\u7c7b
        if(proxy.type === 'ajax' || proxy.url){
          proxy = new Proxy.Ajax(proxy);
        }else{
          proxy = new Proxy.Memery(proxy);
        }

        _self.set('proxy',proxy);
      }
    },
    /**
     * \u52a0\u8f7d\u6570\u636e
     * <pre><code>
     *  //\u4e00\u822c\u8c03\u7528
     *  store.load(params);
     *  
     *  //\u4f7f\u7528\u56de\u8c03\u51fd\u6570
     *  store.load(params,function(data){
     *  
     *  });
     *
     *  //load\u6709\u8bb0\u5fc6\u53c2\u6570\u7684\u529f\u80fd
     *  store.load({id : '123',type="1"});
     *  //\u4e0b\u4e00\u6b21\u8c03\u7528
     *  store.load();\u9ed8\u8ba4\u4f7f\u7528\u4e0a\u6b21\u7684\u53c2\u6570\uff0c\u53ef\u4ee5\u5bf9\u5bf9\u5e94\u7684\u53c2\u6570\u8fdb\u884c\u8986\u76d6
     * </code></pre>
     * @param  {Object} params \u53c2\u6570\u952e\u503c\u5bf9
     * @param {Function} fn \u56de\u8c03\u51fd\u6570\uff0c\u9ed8\u8ba4\u4e3a\u7a7a
     */
    load : function(params,callback){
      var _self = this,
        proxy = _self.get('proxy'),
        lastParams = _self.get('lastParams');

      BUI.mix(true,lastParams,_self.getAppendParams(),params);

      _self.fire('beforeload',{params:lastParams});

      //\u9632\u6b62\u5f02\u6b65\u8bf7\u6c42\u672a\u7ed3\u675f\uff0c\u53c8\u53d1\u9001\u65b0\u8bf7\u6c42\u56de\u8c03\u53c2\u6570\u9519\u8bef
      params = BUI.cloneObject(lastParams);
      proxy.read(lastParams,function(data){
        _self.onLoad(data,params);
        if(callback){
          callback(data,params);
        }
      },_self);
    },
    /**
     * \u52a0\u8f7d\u5b8c\u6570\u636e
     * @protected
     * @template
     */
    onLoad : function(data,params){
      var _self = this;

      var processResult = _self.processLoad(data,params);
      //\u5982\u679c\u5904\u7406\u6210\u529f\uff0c\u8fd4\u56de\u9519\u8bef\u65f6\uff0c\u4e0d\u8fdb\u884c\u540e\u9762\u7684\u5904\u7406
      if(processResult){
        _self.afterProcessLoad(data,params);
      }
    },
    /**
     * @private
     * \u52a0\u8f7d\u5b8c\u6570\u636e\u5904\u7406\u6570\u636e
     */
    processLoad : function(data,params){
      var _self = this,
        hasErrorField = _self.get('hasErrorProperty');
      //\u83b7\u53d6\u7684\u539f\u59cb\u6570\u636e
      _self.fire('beforeProcessLoad',data);

      if(data[hasErrorField] || data.exception){
        _self.onException(data);
        return false;
      }
      return true;
    },
    /**
     * @protected
     * @template
     * \u5904\u7406\u6570\u636e\u540e
     */
    afterProcessLoad : function(data,params){

    },
    /**
     * @protected
     * \u5904\u7406\u9519\u8bef\u51fd\u6570
     * @param  {*} data \u51fa\u9519\u5bf9\u8c61
     */
    onException : function(data){
      var _self = this,
        errorProperty = _self.get('errorProperty'),
        obj = {};
      //\u7f51\u7edc\u5f02\u5e38\u3001\u8f6c\u7801\u9519\u8bef\u4e4b\u7c7b\uff0c\u53d1\u751f\u5728json\u83b7\u53d6\u6216\u8f6c\u53d8\u65f6
      if(data.exception){
        obj.type = 'exception';
        obj[errorProperty] = data.exception;
      }else{//\u7528\u6237\u5b9a\u4e49\u7684\u9519\u8bef
        obj.type = 'error';
        obj[errorProperty] = data[errorProperty];
      }
      _self.fire('exception',obj);

    },
    /**
     * \u662f\u5426\u5305\u542b\u6570\u636e
     * @return {Boolean} 
     */
    hasData : function(){

    },
    /**
     * \u83b7\u53d6\u9644\u52a0\u7684\u53c2\u6570
     * @template
     * @protected
     * @return {Object} \u9644\u52a0\u7684\u53c2\u6570
     */
    getAppendParams : function(){
      return {};
    }
  });

  return AbstractStore;
});/**
 * @fileOverview \u6811\u5f62\u6570\u636e\u7ed3\u6784\u7684\u8282\u70b9\u7c7b\uff0c\u65e0\u6cd5\u76f4\u63a5\u4f7f\u7528\u6570\u636e\u4f5c\u4e3a\u8282\u70b9\uff0c\u6240\u4ee5\u8fdb\u884c\u4e00\u5c42\u5c01\u88c5
 * \u53ef\u4ee5\u76f4\u63a5\u4f5c\u4e3aTreeNode\u63a7\u4ef6\u7684\u914d\u7f6e\u9879
 * @ignore
 */

define('bui/data/node',['bui/common'],function (require) {
  var BUI = require('bui/common');

  function mapNode(cfg,map){
    var rst = {};
    if(map){
      BUI.each(cfg,function(v,k){
        var name = map[k] || k;
        rst[name] = v;
      });
      rst.record = cfg;
    }else{
      rst = cfg;
    }
    return rst;
  }
  /**
   * @class BUI.Data.Node
   * \u6811\u5f62\u6570\u636e\u7ed3\u6784\u7684\u8282\u70b9\u7c7b
   */
  function Node (cfg,map) {
    var _self = this;
    cfg = mapNode(cfg,map);
    BUI.mix(this,cfg);
  }

  BUI.augment(Node,{
    /**
     * \u662f\u5426\u6839\u8282\u70b9
     * @type {Boolean}
     */
    root : false,
    /**
     * \u662f\u5426\u53f6\u5b50\u8282\u70b9
     * @type {Boolean}
     */
    leaf : false,
    /**
     * \u663e\u793a\u8282\u70b9\u65f6\u663e\u793a\u7684\u6587\u672c
     * @type {Object}
     */
    text : '',
    /**
     * \u4ee3\u8868\u8282\u70b9\u7684\u7f16\u53f7
     * @type {String}
     */
    id : null,
    /**
     * \u5b50\u8282\u70b9\u662f\u5426\u5df2\u7ecf\u52a0\u8f7d\u8fc7
     * @type {Boolean}
     */
    loaded : false,
    /**
     * \u4ece\u6839\u8282\u70b9\u5230\u6b64\u8282\u70b9\u7684\u8def\u5f84\uff0cid\u7684\u96c6\u5408\u5982\uff1a ['0','1','12'],
     * \u4fbf\u4e8e\u5feb\u901f\u5b9a\u4f4d\u8282\u70b9
     * @type {Array}
     */
    path : null,
    /**
     * \u7236\u8282\u70b9
     * @type {BUI.Data.Node}
     */
    parent : null,
    /**
     * \u6811\u8282\u70b9\u7684\u7b49\u7ea7
     * @type {Number}
     */
    level : 0,
    /**
     * \u8282\u70b9\u662f\u5426\u7531\u4e00\u6761\u8bb0\u5f55\u5c01\u88c5\u800c\u6210
     * @type {Object}
     */
    record : null,
    /**
     * \u5b50\u8282\u70b9\u96c6\u5408
     * @type {BUI.Data.Node[]}
     */
    children : null,
    /**
     * \u662f\u5426\u662fNode\u5bf9\u8c61
     * @type {Object}
     */
    isNode : true
  });
  return Node;
});/**
 * @fileOverview \u6811\u5f62\u5bf9\u8c61\u7f13\u51b2\u7c7b
 * @ignore
 */

define('bui/data/treestore',['bui/common','bui/data/node','bui/data/abstractstore','bui/data/proxy'],function (require) {

  var BUI = require('bui/common'),
    Node = require('bui/data/node'),
    Proxy = require('bui/data/proxy'),
    AbstractStore = require('bui/data/abstractstore');

  /**
   * @class BUI.Data.TreeStore
   * \u6811\u5f62\u6570\u636e\u7f13\u51b2\u7c7b
   * <p>
   * <img src="../assets/img/class-data.jpg"/>
   * </p>
   * <pre><code>
   *   //\u52a0\u8f7d\u9759\u6001\u6570\u636e
   *   var store = new TreeStore({
   *     root : {
   *       text : '\u6839\u8282\u70b9',
   *       id : 'root'
   *     },
   *     data : [{id : '1',text : 1},{id : '2',text : 2}] //\u4f1a\u52a0\u8f7d\u6210root\u7684children
   *   });
   *   //\u5f02\u6b65\u52a0\u8f7d\u6570\u636e\uff0c\u81ea\u52a8\u52a0\u8f7d\u6570\u636e\u65f6\uff0c\u4f1a\u8c03\u7528store.load({id : 'root'}); //root\u4e3a\u6839\u8282\u70b9\u7684id
   *   var store = new TreeStore({
   *     root : {
   *       text : '\u6839\u8282\u70b9',
   *       id : 'root'
   *     },
   *     url : 'data/nodes.php',
   *     autoLoad : true  //\u8bbe\u7f6e\u81ea\u52a8\u52a0\u8f7d\uff0c\u521d\u59cb\u5316\u540e\u81ea\u52a8\u52a0\u8f7d\u6570\u636e
   *   });
   *
   *   //\u52a0\u8f7d\u6307\u5b9a\u8282\u70b9
   *   var node = store.findNode('1');
   *   store.loadNode(node);
   *   //\u6216\u8005
   *   store.load({id : '1'});//\u53ef\u4ee5\u914d\u7f6e\u81ea\u5b9a\u4e49\u53c2\u6570\uff0c\u8fd4\u56de\u503c\u9644\u52a0\u5230\u6307\u5b9aid\u7684\u8282\u70b9\u4e0a
   * </code></pre>
   * @extends BUI.Data.AbstractStore
   */
  function TreeStore(config){
    TreeStore.superclass.constructor.call(this,config);
  }

  TreeStore.ATTRS = {
    /**
     * \u6839\u8282\u70b9
     * <pre><code>
     *  var store = new TreeStore({
     *    root : {text : '\u6839\u8282\u70b9',id : 'rootId',children : [{id : '1',text : '1'}]}
     *  });
     * </code></pre>
     * @cfg {Object} root
     */
    /**
     * \u6839\u8282\u70b9,\u521d\u59cb\u5316\u540e\u4e0d\u8981\u66f4\u6539\u5bf9\u8c61\uff0c\u53ef\u4ee5\u66f4\u6539\u5c5e\u6027\u503c
     * <pre><code>
     *  var root = store.get('root');
     *  root.text = '\u4fee\u6539\u7684\u6587\u672c'\uff1b
     *  store.update(root);
     * </code></pre>
     * @type {Object}
     * @readOnly
     */
    root : {

    },
    /**
     * \u6570\u636e\u6620\u5c04\uff0c\u7528\u4e8e\u8bbe\u7f6e\u7684\u6570\u636e\u8ddf@see {BUI.Data.Node} \u4e0d\u4e00\u81f4\u65f6\uff0c\u8fdb\u884c\u5339\u914d\u3002
     * \u5982\u679c\u6b64\u5c5e\u6027\u4e3anull,\u90a3\u4e48\u5047\u8bbe\u8bbe\u7f6e\u7684\u5bf9\u8c61\u662fNode\u5bf9\u8c61
     * <pre><code>
     *   //\u4f8b\u5982\u539f\u59cb\u6570\u636e\u4e3a {name : '123',value : '\u6587\u672c123',isLeaf: false,nodes : []}
     *   var store = new TreeStore({
     *     map : {
     *       id : 'name',
     *       text : 'value',
     *       leaf : 'isLeaf',
     *       children : 'nodes'
     *     }
     *   });
     *   //\u6620\u5c04\u540e\uff0c\u8bb0\u5f55\u4f1a\u53d8\u6210  {id : '123',text : '\u6587\u672c123',leaf: false,children : []};
     *   //\u6b64\u65f6\u539f\u59cb\u8bb0\u5f55\u4f1a\u4f5c\u4e3a\u5bf9\u8c61\u7684 record\u5c5e\u6027
     *   var node = store.findNode('123'),
     *     record = node.record;
     * </code></pre> 
     * **Notes:**
     * \u4f7f\u7528\u6570\u636e\u6620\u5c04\u7684\u8bb0\u5f55\u4ec5\u505a\u4e8e\u5c55\u793a\u6570\u636e\uff0c\u4e0d\u4f5c\u4e3a\u53ef\u66f4\u6539\u7684\u6570\u636e\uff0cadd,update\u4e0d\u4f1a\u66f4\u6539\u6570\u636e\u7684\u539f\u59cb\u6570\u636e
     * @cfg {Object} map
     */
    map : {

    },
    /**
     * \u8fd4\u56de\u6570\u636e\u6807\u793a\u6570\u636e\u7684\u5b57\u6bb5</br>
     * \u5f02\u6b65\u52a0\u8f7d\u6570\u636e\u65f6\uff0c\u8fd4\u56de\u6570\u636e\u53ef\u4ee5\u4f7f\u6570\u7ec4\u6216\u8005\u5bf9\u8c61
     * - \u5982\u679c\u8fd4\u56de\u7684\u662f\u5bf9\u8c61,\u53ef\u4ee5\u9644\u52a0\u5176\u4ed6\u4fe1\u606f,\u90a3\u4e48\u53d6\u5bf9\u8c61\u5bf9\u5e94\u7684\u5b57\u6bb5 {nodes : [],hasError:false}
     * - \u5982\u4f55\u83b7\u53d6\u9644\u52a0\u4fe1\u606f\u53c2\u770b @see {BUI.Data.AbstractStore-event-beforeProcessLoad}
     * <pre><code>
     *  //\u8fd4\u56de\u6570\u636e\u4e3a\u6570\u7ec4 [{},{}]\uff0c\u4f1a\u76f4\u63a5\u9644\u52a0\u5230\u52a0\u8f7d\u7684\u8282\u70b9\u540e\u9762
     *  
     *  var node = store.loadNode('123');
     *  store.loadNode(node);
     *  
     * </code></pre>
     * @cfg {Object} [dataProperty = 'nodes']
     */
    dataProperty : {
      value : 'nodes'
    },
    events : {
      value : [
        /**  
        * \u5f53\u6dfb\u52a0\u6570\u636e\u65f6\u89e6\u53d1\u8be5\u4e8b\u4ef6
        * @event  
        * <pre><code>
        *  store.on('add',function(ev){
        *    list.addItem(e.node,index);
        *  });
        * </code></pre>
        * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
        * @param {Object} e.node \u6dfb\u52a0\u7684\u8282\u70b9
        * @param {Number} index \u6dfb\u52a0\u7684\u4f4d\u7f6e
        */
        'add',
        /**  
        * \u5f53\u66f4\u65b0\u6570\u636e\u6307\u5b9a\u5b57\u6bb5\u65f6\u89e6\u53d1\u8be5\u4e8b\u4ef6 
        * @event  
        * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
        * @param {Object} e.node \u66f4\u65b0\u7684\u8282\u70b9
        */
        'update',
        /**  
        * \u5f53\u5220\u9664\u6570\u636e\u65f6\u89e6\u53d1\u8be5\u4e8b\u4ef6
        * @event  
        * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
        * @param {Object} e.node \u5220\u9664\u7684\u8282\u70b9
        * @param {Number} index \u5220\u9664\u8282\u70b9\u7684\u7d22\u5f15
        */
        'remove',
        /**  
        * \u8282\u70b9\u52a0\u8f7d\u5b8c\u6bd5\u89e6\u53d1\u8be5\u4e8b\u4ef6
        * <pre></code>
        *   //\u5f02\u6b65\u52a0\u8f7d\u8282\u70b9,\u6b64\u65f6\u8282\u70b9\u5df2\u7ecf\u9644\u52a0\u5230\u52a0\u8f7d\u8282\u70b9\u7684\u540e\u9762
        *   store.on('load',function(ev){
        *     var params = ev.params,
        *       id = params.id,
        *       node = store.findNode(id),
        *       children = node.children;  //\u8282\u70b9\u7684id
        *     //TO DO
        *   });
        * </code></pre>
        * 
        * @event  
        * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
        * @param {Object} e.node \u52a0\u8f7d\u7684\u8282\u70b9
        * @param {Object} e.params \u52a0\u8f7d\u8282\u70b9\u65f6\u7684\u53c2\u6570
        */
        'load'
      ]
    }
  }

  BUI.extend(TreeStore,AbstractStore);

  BUI.augment(TreeStore,{
    /**
     * @protected
     * @override
     * \u521d\u59cb\u5316\u524d
     */
    beforeInit:function(){
      this.initRoot();
    },
    //\u521d\u59cb\u5316\u6570\u636e,\u5982\u679c\u9ed8\u8ba4\u52a0\u8f7d\u6570\u636e\uff0c\u5219\u52a0\u8f7d\u6570\u636e
    _initData : function(){
      var _self = this,
        autoLoad = _self.get('autoLoad'),
        root = _self.get('root');

      if(autoLoad && !root.children){
        params = root.id ? {id : root.id}: {};
        _self.load(params);
      }
    },
    /**
     * @protected
     * \u521d\u59cb\u5316\u6839\u8282\u70b9
     */
    initRoot : function(){
      var _self = this,
        map = _self.get('map'),
        root = _self.get('root');
      if(!root){
        root = {};
      }
      if(!root.isNode){
        root = new Node(root,map);
        //root.children= [];
      }
      root.path = [root.id];
      root.level = 0;
      if(root.children){
        _self.setChildren(root,root.children);
      }
      _self.set('root',root);
    },
    /**
     * \u6dfb\u52a0\u8282\u70b9\uff0c\u89e6\u53d1{@link BUI.Data.TreeStore#event-add} \u4e8b\u4ef6
     * <pre><code>
     *  //\u6dfb\u52a0\u5230\u6839\u8282\u70b9\u4e0b
     *  store.add({id : '1',text : '1'});
     *  //\u6dfb\u52a0\u5230\u6307\u5b9a\u8282\u70b9
     *  var node = store.findNode('1'),
     *    subNode = store.add({id : '11',text : '11'},node);
     *  //\u63d2\u5165\u5230\u8282\u70b9\u7684\u6307\u5b9a\u4f4d\u7f6e
     *  var node = store.findNode('1'),
     *    subNode = store.add({id : '12',text : '12'},node,0);
     * </code></pre>
     * @param {BUI.Data.Node|Object} node \u8282\u70b9\u6216\u8005\u6570\u636e\u5bf9\u8c61
     * @param {BUI.Data.Node} [parent] \u7236\u8282\u70b9,\u5982\u679c\u672a\u6307\u5b9a\u5219\u4e3a\u6839\u8282\u70b9
     * @param {Number} [index] \u6dfb\u52a0\u8282\u70b9\u7684\u4f4d\u7f6e
     * @return {BUI.Data.Node} \u6dfb\u52a0\u5b8c\u6210\u7684\u8282\u70b9
     */
    add : function(node,parent,index){
      var _self = this;

      node = _self._add(node,parent,index);
      _self.fire('add',{node : node,index : index});
      return node;
    },
    //
    _add : function(node,parent,index){
      parent = parent || this.get('root');  //\u5982\u679c\u672a\u6307\u5b9a\u7236\u5143\u7d20\uff0c\u6dfb\u52a0\u5230\u8ddf\u8282\u70b9
      var _self = this,
        map = _self.get('map'),
        nodes = parent.children,
        nodeChildren = node.children || [];
      if(nodeChildren.length == 0 && node.leaf == null){
        node.leaf = true;
      }
      if(parent){
        parent.leaf = false;
      }
      if(!node.isNode){
        node = new Node(node,map);
      }
      node.parent = parent;
      node.level = parent.level + 1;
      node.path = parent.path.concat(node.id);
      index = index == null ? parent.children.length : index;
      BUI.Array.addAt(nodes,node,index);

      _self.setChildren(node,nodeChildren);
      return node;
    },
    /**
     * \u79fb\u9664\u8282\u70b9\uff0c\u89e6\u53d1{@link BUI.Data.TreeStore#event-remove} \u4e8b\u4ef6
     * 
     * <pre><code>
     *  var node = store.findNode('1'); //\u6839\u636e\u8282\u70b9id \u83b7\u53d6\u8282\u70b9
     *  store.remove(node);
     * </code></pre>
     * 
     * @param {BUI.Data.Node} node \u8282\u70b9\u6216\u8005\u6570\u636e\u5bf9\u8c61
     * @return {BUI.Data.Node} \u5220\u9664\u7684\u8282\u70b9
     */
    remove : function(node){
      var parent = node.parent || _self.get('root'),
        index = BUI.Array.indexOf(node,parent.children) ;

      BUI.Array.remove(parent.children,node);
      if(parent.children.length === 0){
        parent.leaf = true;
      }
      this.fire('remove',{node : node , index : index});
      node.parent = null;
      return node;
    },
    /**
     * \u66f4\u65b0\u8282\u70b9
     * <pre><code>
     *  var node = store.findNode('1'); //\u6839\u636e\u8282\u70b9id \u83b7\u53d6\u8282\u70b9
     *  node.text = 'modify text'; //\u4fee\u6539\u6587\u672c
     *  store.update(node);        //\u6b64\u65f6\u4f1a\u89e6\u53d1update\u4e8b\u4ef6\uff0c\u7ed1\u5b9a\u4e86store\u7684\u63a7\u4ef6\u4f1a\u66f4\u65b0\u5bf9\u5e94\u7684DOM
     * </code></pre>
     * @return {BUI.Data.Node} \u66f4\u65b0\u8282\u70b9
     */
    update : function(node){
      this.fire('update',{node : node});
    },
    /**
     * \u8fd4\u56de\u7f13\u5b58\u7684\u6570\u636e\uff0c\u6839\u8282\u70b9\u7684\u76f4\u63a5\u5b50\u8282\u70b9\u96c6\u5408
     * <pre><code>
     *   //\u83b7\u53d6\u6839\u8282\u70b9\u7684\u6240\u6709\u5b50\u8282\u70b9
     *   var data = store.getResult();
     *   //\u83b7\u53d6\u6839\u8282\u70b9
     *   var root = store.get('root');
     * </code></pre>
     * @return {Array} \u6839\u8282\u70b9\u4e0b\u9762\u7684\u6570\u636e
     */
    getResult : function(){
      return this.get('root').children;
    },
    /**
     * \u8bbe\u7f6e\u7f13\u5b58\u7684\u6570\u636e\uff0c\u8bbe\u7f6e\u4e3a\u6839\u8282\u70b9\u7684\u6570\u636e
    *   <pre><code>
    *     var data = [
    *       {id : '1',text : '\u6587\u672c1'},
    *       {id : '2',text : '\u6587\u672c2',children:[
    *         {id : '21',text : '\u6587\u672c21'}
    *       ]},
    *       {id : '3',text : '\u6587\u672c3'}
    *     ];
    *     store.setResult(data); //\u4f1a\u5bf9\u6570\u636e\u8fdb\u884c\u683c\u5f0f\u5316\uff0c\u6dfb\u52a0leaf\u7b49\u5b57\u6bb5\uff1a
    *                            //[{id : '1',text : '\u6587\u672c1',leaf : true},{id : '2',text : '\u6587\u672c2',leaf : false,children:[...]}....]
    *   </code></pre>
     * @param {Array} data \u7f13\u5b58\u7684\u6570\u636e
     */
    setResult : function(data){
      var _self = this,
        proxy = _self.get('proxy'),
        root = _self.get('root');
      if(proxy instanceof Proxy.Memery){
        _self.set('data',data);
        _self.load({id : root.id});
      }else{
        _self.setChildren(root,data);
      }
    },
    /**
     * \u8bbe\u7f6e\u5b50\u8282\u70b9
     * @protected
     * @param {BUI.Data.Node} node  \u8282\u70b9
     * @param {Array} children \u5b50\u8282\u70b9
     */
    setChildren : function(node,children){
      var _self = this;
      node.children = [];
      if(!children.length){
        return;
      }
      BUI.each(children,function(item){
        _self._add(item,node);
      });
    },
    /**
     * \u67e5\u627e\u8282\u70b9
     * <pre><code>
     *  var node = store.findNode('1');//\u4ece\u6839\u8282\u70b9\u5f00\u59cb\u67e5\u627e\u8282\u70b9
     *  
     *  var subNode = store.findNode('123',node); //\u4ece\u6307\u5b9a\u8282\u70b9\u5f00\u59cb\u67e5\u627e
     * </code></pre>
     * @param  {String} id \u8282\u70b9Id
     * @param  {BUI.Data.Node} [parent] \u7236\u8282\u70b9
     * @param {Boolean} [deep = true] \u662f\u5426\u9012\u5f52\u67e5\u627e
     * @return {BUI.Data.Node} \u8282\u70b9
     */
    findNode : function(id,parent,deep){
      var _self = this;
      deep = deep == null ? true : deep;
      if(!parent){
        var root = _self.get('root');
        if(root.id === id){
          return root;
        }
        return _self.findNode(id,root);
      }
      var children = parent.children,
        rst = null;
      BUI.each(children,function(item){
        if(item.id === id){
          rst = item;
        }else if(deep){
          rst = _self.findNode(id,item);
        }
        if(rst){
          return false;
        }
      });
      return rst;
    },
    /**
     * \u67e5\u627e\u8282\u70b9,\u6839\u636e\u5339\u914d\u51fd\u6570\u67e5\u627e
     * <pre><code>
     *  var nodes = store.findNodesBy(function(node){
     *   if(node.status == '0'){
     *     return true;
     *   }
     *   return false;
     *  });
     * </code></pre>
     * @param  {Function} func \u5339\u914d\u51fd\u6570
     * @param  {BUI.Data.Node} [parent] \u7236\u5143\u7d20\uff0c\u5982\u679c\u4e0d\u5b58\u5728\uff0c\u5219\u4ece\u6839\u8282\u70b9\u67e5\u627e
     * @return {Array} \u8282\u70b9\u6570\u7ec4
     */
    findNodesBy : function(func,parent){
      var _self = this,
        root,
        rst = [];

      if(!parent){
        parent = _self.get('root');
      }

      BUI.each(parent.children,function(item){
        if(func(item)){
          rst.push(item);
        }
        rst = rst.concat(_self.findNodesBy(func,item));
      });

      return rst;
    },
    /**
     * \u6839\u636epath\u67e5\u627e\u8282\u70b9
     * @return {BUI.Data.Node} \u8282\u70b9
     * @ignore
     */
    findNodeByPath : function(path){
      if(!path){
        return null;
      }
      var _self = this,
        root = _self.get('root'),
        pathArr = path.split(','),
        node,
        i,
        tempId = pathArr[0];
      if(!tempId){
        return null;
      }
      if(root.id == tempId){
        node = root;
      }else{
        node = _self.findNode(tempId,root,false);
      }
      if(!node){
        return;
      }
      for(i = 1 ; i < pathArr.length ; i = i + 1){
        var tempId = pathArr[i];
        node = _self.findNode(tempId,node,false);
        if(!node){
          break;
        }
      }
      return node;
    },
    /**
     * \u662f\u5426\u5305\u542b\u6307\u5b9a\u8282\u70b9\uff0c\u5982\u679c\u672a\u6307\u5b9a\u7236\u8282\u70b9\uff0c\u4ece\u6839\u8282\u70b9\u5f00\u59cb\u641c\u7d22
     * <pre><code>
     *  store.contains(node); //\u662f\u5426\u5b58\u5728\u8282\u70b9
     *
     *  store.contains(subNode,node); //\u8282\u70b9\u662f\u5426\u5b58\u5728\u6307\u5b9a\u5b50\u8282\u70b9
     * </code></pre>
     * @param  {BUI.Data.Node} node \u8282\u70b9
     * @param  {BUI.Data.Node} parent \u7236\u8282\u70b9
     * @return {Boolean} \u662f\u5426\u5305\u542b\u6307\u5b9a\u8282\u70b9
     */
    contains : function(node,parent){
      var _self = this,
        findNode = _self.findNode(node.id,parent);
      return !!findNode;
    },
    /**
     * \u52a0\u8f7d\u5b8c\u6570\u636e
     * @protected
     * @override
     */
    afterProcessLoad : function(data,params){
      var _self = this,
        id = params.id,
        dataProperty = _self.get('dataProperty'),
        node = _self.findNode(id) || _self.get('root');//\u5982\u679c\u627e\u4e0d\u5230\u7236\u5143\u7d20\uff0c\u5219\u653e\u7f6e\u5728\u8ddf\u8282\u70b9

      if(BUI.isArray(data)){
        _self.setChildren(node,data);
      }else{
        _self.setChildren(node,data[dataProperty]);
      }
      _self.fire('load',{node : node,params : params});
    },
    /**
     * \u662f\u5426\u5305\u542b\u6570\u636e
     * @return {Boolean} 
     */
    hasData : function(){
      return true;
      //return this.get('root').children && this.get('root').children.length !== 0;
    },
    /**
     * \u662f\u5426\u5df2\u7ecf\u52a0\u8f7d\u8fc7\uff0c\u53f6\u5b50\u8282\u70b9\u6216\u8005\u5b58\u5728\u5b57\u8282\u70b9\u7684\u8282\u70b9
     * @param   {BUI.Data.Node} node \u8282\u70b9
     * @return {Boolean}  \u662f\u5426\u52a0\u8f7d\u8fc7
     */
    isLoaded : function(node){
      if(!this.get('url')){ //\u5982\u679c\u4e0d\u4ece\u8fdc\u7a0b\u52a0\u8f7d\u6570\u636e,\u9ed8\u8ba4\u5df2\u7ecf\u52a0\u8f7d
        return true;
      }
      return node.leaf || (node.children && node.children.length);
    },
    /**
     * \u52a0\u8f7d\u8282\u70b9\u7684\u5b50\u8282\u70b9
     * @param  {BUI.Data.Node} node \u8282\u70b9
     */
    loadNode : function(node){
      var _self = this;
      //\u5982\u679c\u5df2\u7ecf\u52a0\u8f7d\u8fc7\uff0c\u6216\u8005\u8282\u70b9\u662f\u53f6\u5b50\u8282\u70b9
      if(_self.isLoaded(node)){
        return ;
      }
      if(!_self.get('url')){ //\u5982\u679c\u4e0d\u4ece\u8fdc\u7a0b\u52a0\u8f7d\u6570\u636e\uff0c\u4e0d\u662f\u6839\u8282\u70b9\u7684\u8bdd\uff0c\u53d6\u6d88\u52a0\u8f7d
        return;
      }else{
        _self.load({id:node.id,path : ''});
      }
      
    },
    /**
     * \u52a0\u8f7d\u8282\u70b9\uff0c\u6839\u636epath
     * @param  {String} path \u52a0\u8f7d\u8def\u5f84
     * @ignore
     */
    loadPath : function(path){
      var _self = this,
        arr = path.split(','),
        id = arr[0];
      if(_self.findNodeByPath(path)){ //\u52a0\u8f7d\u8fc7
        return;
      }
      _self.load({id : id,path : path});
    }
  });

  return TreeStore;

});/**
 * @fileOverview \u6570\u636e\u7f13\u51b2\u5bf9\u8c61
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/data/store',['bui/data/proxy','bui/data/abstractstore','bui/data/sortable'],function(require) {
  
  var Proxy = require('bui/data/proxy'),
    AbstractStore = require('bui/data/abstractstore'),
    Sortable = require('bui/data/sortable');

  //\u79fb\u9664\u6570\u636e
  function removeAt(index,array){
    if(index < 0){
      return;
    }
    var records = array,
      record = records[index];
    records.splice(index,1);
    return record;
  }

  function removeFrom(record,array){
    var index = BUI.Array.indexOf(record,array);   
    if(index >= 0){
      removeAt(index,array);
    }
  }

  function contains(record,array){
    return BUI.Array.indexOf(record,array) !== -1;
  }
  /**
   * \u7528\u4e8e\u52a0\u8f7d\u6570\u636e\uff0c\u7f13\u51b2\u6570\u636e\u7684\u7c7b
   * <p>
   * <img src="../assets/img/class-data.jpg"/>
   * </p>
   * ** \u7f13\u5b58\u9759\u6001\u6570\u636e ** 
   * <pre><code>
   *  var store = new Store({
   *    data : [{},{}]
   *  });
   * </code></pre>
   * ** \u5f02\u6b65\u52a0\u8f7d\u6570\u636e **
   * <pre><code>
   *  var store = new Store({
   *    url : 'data.json',
   *    autoLoad : true,
   *    params : {id : '123'},
   *    sortInfo : {
   *      field : 'id',
   *      direction : 'ASC' //ASC,DESC
   *    }
   *  });
   * </code></pre>
   * 
   * @class BUI.Data.Store
   * @extends BUI.Data.AbstractStore
   * @mixins BUI.Data.Sortable
   */
  var store = function(config){
    store.superclass.constructor.call(this,config);
    //this._init();
  };

  store.ATTRS = 
  /**
   * @lends BUI.Data.Store#
   * @ignore
   */
  {
    /**
     * \u5f53\u524d\u9875\u7801
     * @cfg {Number} [currentPage=0]
     * @ignore
     */
    /**
     * \u5f53\u524d\u9875\u7801
     * @type {Number}
     * @ignore
     * @readOnly
     */
    currentPage:{
      value : 0
    },
    
    /**
     * \u5220\u9664\u6389\u7684\u7eaa\u5f55
     * @readOnly
     * @private
     * @type {Array}
     */
    deletedRecords : {
      value:[]
    },
    /**
     * \u9519\u8bef\u5b57\u6bb5,\u5305\u542b\u5728\u8fd4\u56de\u4fe1\u606f\u4e2d\u8868\u793a\u9519\u8bef\u4fe1\u606f\u7684\u5b57\u6bb5
     * <pre><code>
     *   //\u53ef\u4ee5\u4fee\u6539\u63a5\u6536\u7684\u540e\u53f0\u53c2\u6570\u7684\u542b\u4e49
     *   var store = new Store({
     *     url : 'data.json',
     *     errorProperty : 'errorMsg', //\u5b58\u653e\u9519\u8bef\u4fe1\u606f\u7684\u5b57\u6bb5(error)
     *     hasErrorProperty : 'isError', //\u662f\u5426\u9519\u8bef\u7684\u5b57\u6bb5\uff08hasError)
     *     root : 'data',               //\u5b58\u653e\u6570\u636e\u7684\u5b57\u6bb5\u540d(rows)
     *     totalProperty : 'total'     //\u5b58\u653e\u8bb0\u5f55\u603b\u6570\u7684\u5b57\u6bb5\u540d(results)
     *   });
     * </code></pre>
     * @cfg {String} [errorProperty='error']
     */
    /**
     * \u9519\u8bef\u5b57\u6bb5
     * @type {String}
     * @ignore
     */
    errorProperty : {
      value : 'error'
    },
    /**
     * \u662f\u5426\u5b58\u5728\u9519\u8bef,\u52a0\u8f7d\u6570\u636e\u65f6\u5982\u679c\u8fd4\u56de\u9519\u8bef\uff0c\u6b64\u5b57\u6bb5\u8868\u793a\u6709\u9519\u8bef\u53d1\u751f
     * <pre><code>
     *   //\u53ef\u4ee5\u4fee\u6539\u63a5\u6536\u7684\u540e\u53f0\u53c2\u6570\u7684\u542b\u4e49
     *   var store = new Store({
     *     url : 'data.json',
     *     errorProperty : 'errorMsg', //\u5b58\u653e\u9519\u8bef\u4fe1\u606f\u7684\u5b57\u6bb5(error)
     *     hasErrorProperty : 'isError', //\u662f\u5426\u9519\u8bef\u7684\u5b57\u6bb5\uff08hasError)
     *     root : 'data',               //\u5b58\u653e\u6570\u636e\u7684\u5b57\u6bb5\u540d(rows)
     *     totalProperty : 'total'     //\u5b58\u653e\u8bb0\u5f55\u603b\u6570\u7684\u5b57\u6bb5\u540d(results)
     *   });
     * </code></pre>
     * @cfg {String} [hasErrorProperty='hasError']
     */
    /**
     * \u662f\u5426\u5b58\u5728\u9519\u8bef
     * @type {String}
     * @default 'hasError'
     * @ignore
     */
    hasErrorProperty : {
      value : 'hasError'
    },

    /**
     * \u5bf9\u6bd42\u4e2a\u5bf9\u8c61\u662f\u5426\u76f8\u5f53\uff0c\u5728\u53bb\u91cd\u3001\u66f4\u65b0\u3001\u5220\u9664\uff0c\u67e5\u627e\u6570\u636e\u65f6\u4f7f\u7528\u6b64\u51fd\u6570
     * @default  
     * function(obj1,obj2){
     *   return obj1 == obj2;
     * }
     * @type {Object}
     * @example
     * function(obj1 ,obj2){
     *   //\u5982\u679cid\u76f8\u7b49\uff0c\u5c31\u8ba4\u4e3a2\u4e2a\u6570\u636e\u76f8\u7b49\uff0c\u53ef\u4ee5\u5728\u6dfb\u52a0\u5bf9\u8c61\u65f6\u53bb\u91cd
     *   //\u66f4\u65b0\u5bf9\u8c61\u65f6\uff0c\u4ec5\u63d0\u4f9b\u6539\u53d8\u7684\u5b57\u6bb5
     *   return obj1.id == obj2.id;
     * }
     * 
     */
    matchFunction : {
      value : function(obj1,obj2){
        return obj1 == obj2;
      }
    },
    /**
     * \u66f4\u6539\u7684\u7eaa\u5f55\u96c6\u5408
     * @type {Array}
     * @private
     * @readOnly
     */
    modifiedRecords : {
      value:[]
    },
    /**
     * \u65b0\u6dfb\u52a0\u7684\u7eaa\u5f55\u96c6\u5408\uff0c\u53ea\u8bfb
     * @type {Array}
     * @private
     * @readOnly
     */
    newRecords : {
      value : []
    },
    /**
     * \u662f\u5426\u8fdc\u7a0b\u6392\u5e8f\uff0c\u9ed8\u8ba4\u72b6\u6001\u4e0b\u5185\u5b58\u6392\u5e8f
     *   - \u7531\u4e8e\u5f53\u524dStore\u5b58\u50a8\u7684\u4e0d\u4e00\u5b9a\u662f\u6570\u636e\u6e90\u7684\u5168\u96c6\uff0c\u6240\u4ee5\u6b64\u914d\u7f6e\u9879\u9700\u8981\u91cd\u65b0\u8bfb\u53d6\u6570\u636e
     *   - \u5728\u5206\u9875\u72b6\u6001\u4e0b\uff0c\u8fdb\u884c\u8fdc\u7a0b\u6392\u5e8f\uff0c\u4f1a\u8fdb\u884c\u5168\u96c6\u6570\u636e\u7684\u6392\u5e8f\uff0c\u5e76\u8fd4\u56de\u9996\u9875\u7684\u6570\u636e
     *   - remoteSort\u4e3a false\u7684\u60c5\u51b5\u4e0b\uff0c\u4ec5\u5bf9\u5f53\u524d\u9875\u7684\u6570\u636e\u8fdb\u884c\u6392\u5e8f
     * @cfg {Boolean} [remoteSort=false]
     */
    remoteSort : {
      value : false
    },
    /**
     * \u7f13\u5b58\u7684\u6570\u636e\uff0c\u5305\u542b\u4ee5\u4e0b\u51e0\u4e2a\u5b57\u6bb5
     * <ol>
     * <li>rows: \u6570\u636e\u96c6\u5408</li>
     * <li>results: \u603b\u7684\u6570\u636e\u6761\u6570</li>
     * </ol>
     * @type {Object}
     * @private
     * @readOnly
     */
    resultMap : {
      value : {}
    },
    /**
     * \u52a0\u8f7d\u6570\u636e\u65f6\uff0c\u8fd4\u56de\u6570\u636e\u7684\u6839\u76ee\u5f55
     * @cfg {String} [root='rows']
     * <pre><code>
     *    //\u9ed8\u8ba4\u8fd4\u56de\u6570\u636e\u7c7b\u578b\uff1a
     *    '{"rows":[{"name":"abc"},{"name":"bcd"}],"results":100}'
     *   //\u53ef\u4ee5\u4fee\u6539\u63a5\u6536\u7684\u540e\u53f0\u53c2\u6570\u7684\u542b\u4e49
     *   var store = new Store({
     *     url : 'data.json',
     *     errorProperty : 'errorMsg', //\u5b58\u653e\u9519\u8bef\u4fe1\u606f\u7684\u5b57\u6bb5(error)
     *     hasErrorProperty : 'isError', //\u662f\u5426\u9519\u8bef\u7684\u5b57\u6bb5\uff08hasError)
     *     root : 'data',               //\u5b58\u653e\u6570\u636e\u7684\u5b57\u6bb5\u540d(rows)
     *     totalProperty : 'total'     //\u5b58\u653e\u8bb0\u5f55\u603b\u6570\u7684\u5b57\u6bb5\u540d(results)
     *   });
     * </code></pre>
     *   
     */
    root: { value : 'rows'}, 

    /**
     * \u5f53\u524dStore\u7f13\u5b58\u7684\u6570\u636e\u6761\u6570
     * @type {Number}
     * @private
     * @readOnly
     */
    rowCount :{
      value : 0
    },
    /**
     * \u52a0\u8f7d\u6570\u636e\u65f6\uff0c\u8fd4\u56de\u8bb0\u5f55\u7684\u603b\u6570\u7684\u5b57\u6bb5\uff0c\u7528\u4e8e\u5206\u9875
     * @cfg {String} [totalProperty='results']
     *<pre><code>
     *    //\u9ed8\u8ba4\u8fd4\u56de\u6570\u636e\u7c7b\u578b\uff1a
     *    '{"rows":[{"name":"abc"},{"name":"bcd"}],"results":100}'
     *   //\u53ef\u4ee5\u4fee\u6539\u63a5\u6536\u7684\u540e\u53f0\u53c2\u6570\u7684\u542b\u4e49
     *   var store = new Store({
     *     url : 'data.json',
     *     errorProperty : 'errorMsg', //\u5b58\u653e\u9519\u8bef\u4fe1\u606f\u7684\u5b57\u6bb5(error)
     *     hasErrorProperty : 'isError', //\u662f\u5426\u9519\u8bef\u7684\u5b57\u6bb5\uff08hasError)
     *     root : 'data',               //\u5b58\u653e\u6570\u636e\u7684\u5b57\u6bb5\u540d(rows)
     *     totalProperty : 'total'     //\u5b58\u653e\u8bb0\u5f55\u603b\u6570\u7684\u5b57\u6bb5\u540d(results)
     *   });
     * </code></pre>
     */
    totalProperty: {value :'results'}, 

    /**
     * \u52a0\u8f7d\u6570\u636e\u7684\u8d77\u59cb\u4f4d\u7f6e
     * <pre><code>
     *  //\u521d\u59cb\u5316\u65f6\uff0c\u53ef\u4ee5\u5728params\u4e2d\u914d\u7f6e
     *  var store = new Store({
     *    url : 'data.json',
     *    params : {
     *      start : 100
     *    }
     *  });
     * </code></pre>
     * @type {Object}
     */
    start:{
      value : 0
    },
    /**
     * \u6bcf\u9875\u591a\u5c11\u6761\u8bb0\u5f55,\u9ed8\u8ba4\u4e3anull,\u6b64\u65f6\u4e0d\u5206\u9875\uff0c\u5f53\u6307\u5b9a\u4e86\u6b64\u503c\u65f6\u5206\u9875
     * <pre><code>
     *  //\u5f53\u8bf7\u6c42\u7684\u6570\u636e\u5206\u9875\u65f6
     *  var store = new Store({
     *    url : 'data.json',
     *    pageSize : 30
     *  });
     * </code></pre>
     * @cfg {Number} pageSize
     */
    pageSize : {

    }
  };
  BUI.extend(store,AbstractStore);

  BUI.mixin(store,[Sortable]);

  BUI.augment(store,
  /**
   * @lends BUI.Data.Store.prototype
   * @ignore
   */
  {
    /**
    * \u6dfb\u52a0\u8bb0\u5f55,\u9ed8\u8ba4\u6dfb\u52a0\u5728\u540e\u9762
    * <pre><code>
    *  //\u6dfb\u52a0\u8bb0\u5f55
    *  store.add({id : '2',text: 'new data'});
    *  //\u662f\u5426\u53bb\u91cd\uff0c\u91cd\u590d\u6570\u636e\u4e0d\u80fd\u6dfb\u52a0
    *  store.add(obj,true); //\u4e0d\u80fd\u6dfb\u52a0\u91cd\u590d\u6570\u636e\uff0c\u6b64\u65f6\u7528obj1 === obj2\u5224\u65ad
    *  //\u4f7f\u7528\u5339\u914d\u51fd\u53bb\u91cd
    *  store.add(obj,true,function(obj1,obj2){
    *    return obj1.id == obj2.id;
    *  });
    *  
    * </code></pre>
    * @param {Array|Object} data \u6dfb\u52a0\u7684\u6570\u636e\uff0c\u53ef\u4ee5\u662f\u6570\u7ec4\uff0c\u53ef\u4ee5\u662f\u5355\u6761\u8bb0\u5f55
    * @param {Boolean} [noRepeat = false] \u662f\u5426\u53bb\u91cd,\u53ef\u4ee5\u4e3a\u7a7a\uff0c\u9ed8\u8ba4\uff1a false 
    * @param {Function} [match] \u5339\u914d\u51fd\u6570\uff0c\u53ef\u4ee5\u4e3a\u7a7a\uff0c
    * @default \u914d\u7f6e\u9879\u4e2d matchFunction \u5c5e\u6027\u4f20\u5165\u7684\u51fd\u6570\uff0c\u9ed8\u8ba4\u662f\uff1a<br>
    *  function(obj1,obj2){
    *    return obj1 == obj2;
    *  }
    * 
    */
    add :function(data,noRepeat,match){
      var _self = this,
        count = _self.getCount();
      _self.addAt(data,count,noRepeat,match)
    },
    /**
    * \u6dfb\u52a0\u8bb0\u5f55,\u6307\u5b9a\u7d22\u5f15\u503c
    * <pre><code>
    *  //\u4f7f\u7528\u65b9\u5f0f\u8ddf\u7c7b\u4f3c\u4e8eadd,\u589e\u52a0\u4e86index\u53c2\u6570
    *  store.add(obj,0);//\u6dfb\u52a0\u5728\u6700\u524d\u9762
    * </code></pre>
    * @param {Array|Object} data \u6dfb\u52a0\u7684\u6570\u636e\uff0c\u53ef\u4ee5\u662f\u6570\u7ec4\uff0c\u53ef\u4ee5\u662f\u5355\u6761\u8bb0\u5f55
    * @param {Number} index \u5f00\u59cb\u6dfb\u52a0\u6570\u636e\u7684\u4f4d\u7f6e
    * @param {Boolean} [noRepeat = false] \u662f\u5426\u53bb\u91cd,\u53ef\u4ee5\u4e3a\u7a7a\uff0c\u9ed8\u8ba4\uff1a false 
    * @param {Function} [match] \u5339\u914d\u51fd\u6570\uff0c\u53ef\u4ee5\u4e3a\u7a7a\uff0c
     */
    addAt : function(data,index,noRepeat,match){
      var _self = this;

      match = match || _self._getDefaultMatch();
      if(!BUI.isArray(data)){
        data = [data];
      }

      $.each(data,function(pos,element){
        if(!noRepeat || !_self.contains(element,match)){
          _self._addRecord(element,pos + index);

          _self.get('newRecords').push(element);

          removeFrom(element,_self.get('deletedRecords'));
          removeFrom(element,_self.get('modifiedRecords'));
        }
      });
    },
    /**
    * \u9a8c\u8bc1\u662f\u5426\u5b58\u5728\u6307\u5b9a\u8bb0\u5f55
    * <pre><code>
    *  store.contains(obj); //\u662f\u5426\u5305\u542b\u6307\u5b9a\u7684\u8bb0\u5f55
    *
    *  store.contains(obj,function(obj1,obj2){ //\u4f7f\u7528\u5339\u914d\u51fd\u6570
    *    return obj1.id == obj2.id;
    *  });
    * </code></pre>
    * @param {Object} record \u6307\u5b9a\u7684\u8bb0\u5f55
    * @param {Function} [match = function(obj1,obj2){return obj1 == obj2}] \u9ed8\u8ba4\u4e3a\u6bd4\u8f832\u4e2a\u5bf9\u8c61\u662f\u5426\u76f8\u540c
    * @return {Boolean}
    */
    contains :function(record,match){
      return this.findIndexBy(record,match)!==-1;
    },
    /**
    * \u67e5\u627e\u8bb0\u5f55\uff0c\u4ec5\u8fd4\u56de\u7b2c\u4e00\u6761
    * <pre><code>
    *  var record = store.find('id','123');
    * </code></pre>
    * @param {String} field \u5b57\u6bb5\u540d
    * @param {String} value \u5b57\u6bb5\u503c
    * @return {Object|null}
    */
    find : function(field,value){
      var _self = this,
        result = null,
        records = _self.getResult();
      $.each(records,function(index,record){
        if(record[field] === value){
          result = record;
          return false;
        }
      });
      return result;
    },
    /**
    * \u67e5\u627e\u8bb0\u5f55\uff0c\u8fd4\u56de\u6240\u6709\u7b26\u5408\u67e5\u8be2\u6761\u4ef6\u7684\u8bb0\u5f55
    * <pre><code>
    *   var records = store.findAll('type','0');
    * </code></pre>
    * @param {String} field \u5b57\u6bb5\u540d
    * @param {String} value \u5b57\u6bb5\u503c
    * @return {Array}
    */
    findAll : function(field,value){
      var _self = this,
        result = [],
        records = _self.getResult();
      $.each(records,function(index,record){
        if(record[field] === value){
          result.push(record);
        }
      });
      return result;
    },
    /**
    * \u6839\u636e\u7d22\u5f15\u67e5\u627e\u8bb0\u5f55
    * <pre><code>
    *  var record = store.findByIndex(1);
    * </code></pre>
    * @param {Number} index \u7d22\u5f15
    * @return {Object} \u67e5\u627e\u7684\u8bb0\u5f55
    */
    findByIndex : function(index){
      return this.getResult()[index];
    },
    /**
    * \u67e5\u627e\u6570\u636e\u6240\u5728\u7684\u7d22\u5f15\u4f4d\u7f6e,\u82e5\u4e0d\u5b58\u5728\u8fd4\u56de-1
    * <pre><code>
    *  var index = store.findIndexBy(obj);
    *
    *  var index = store.findIndexBy(obj,function(obj1,obj2){
    *    return obj1.id == obj2.id;
    *  });
    * </code></pre>
    * @param {Object} target \u6307\u5b9a\u7684\u8bb0\u5f55
    * @param {Function} [match = matchFunction] @see {BUI.Data.Store#matchFunction}\u9ed8\u8ba4\u4e3a\u6bd4\u8f832\u4e2a\u5bf9\u8c61\u662f\u5426\u76f8\u540c
    * @return {Number}
    */
    findIndexBy :function(target,match){
      var _self = this,
        position = -1,
        records = _self.getResult();
      match = match || _self._getDefaultMatch();
      if(target === null || target === undefined){
        return -1;
      }
      $.each(records,function(index,record){
        if(match(target,record)){
          position = index;
          return false;
        }
      });
      return position;
    },
    /**
    * \u83b7\u53d6\u4e0b\u4e00\u6761\u8bb0\u5f55
    * <pre><code>
    *  var record = store.findNextRecord(obj);
    * </code></pre>
    * @param {Object} record \u5f53\u524d\u8bb0\u5f55
    * @return {Object} \u4e0b\u4e00\u6761\u8bb0\u5f55
    */
    findNextRecord : function(record){
      var _self = this,
        index = _self.findIndexBy(record);
      if(index >= 0){
        return _self.findByIndex(index + 1);
      }
      return;
    },
    /**
     * \u83b7\u53d6\u7f13\u5b58\u7684\u8bb0\u5f55\u6570
     * <pre><code>
     *  var count = store.getCount(); //\u7f13\u5b58\u7684\u6570\u636e\u6570\u91cf
     *
     *  var totalCount = store.getTotalCount(); //\u6570\u636e\u7684\u603b\u6570\uff0c\u5982\u679c\u6709\u5206\u9875\u65f6\uff0ctotalCount != count
     * </code></pre>
     * @return {Number} \u8bb0\u5f55\u6570
     */
    getCount : function(){
      return this.getResult().length;
    },
    /**
     * \u83b7\u53d6\u6570\u636e\u6e90\u7684\u6570\u636e\u603b\u6570\uff0c\u5206\u9875\u65f6\uff0c\u5f53\u524d\u4ec5\u7f13\u5b58\u5f53\u524d\u9875\u6570\u636e
     * <pre><code>
     *  var count = store.getCount(); //\u7f13\u5b58\u7684\u6570\u636e\u6570\u91cf
     *
     *  var totalCount = store.getTotalCount(); //\u6570\u636e\u7684\u603b\u6570\uff0c\u5982\u679c\u6709\u5206\u9875\u65f6\uff0ctotalCount != count
     * </code></pre>
     * @return {Number} \u8bb0\u5f55\u7684\u603b\u6570
     */
    getTotalCount : function(){
      var _self = this,
        resultMap = _self.get('resultMap'),
        total = _self.get('totalProperty');
      return resultMap[total] || 0;
    },
    /**
     * \u83b7\u53d6\u5f53\u524d\u7f13\u5b58\u7684\u7eaa\u5f55
     * <pre><code>
     *   var records = store.getResult();
     * </code></pre>
     * @return {Array} \u7eaa\u5f55\u96c6\u5408
     */
    getResult : function(){
      var _self = this,
        resultMap = _self.get('resultMap'),
        root = _self.get('root');
      return resultMap[root];
    },
    /**
     * \u662f\u5426\u5305\u542b\u6570\u636e
     * @return {Boolean} 
     */
    hasData : function(){
      return this.getCount() !== 0;
    },
    /**
     * \u8bbe\u7f6e\u6570\u636e\u6e90,\u975e\u5f02\u6b65\u52a0\u8f7d\u65f6\uff0c\u8bbe\u7f6e\u7f13\u5b58\u7684\u6570\u636e
     * <pre><code>
     *   store.setResult([]); //\u6e05\u7a7a\u6570\u636e
     *
     *   var data = [{},{}];
     *   store.setResult(data); //\u91cd\u8bbe\u6570\u636e
     * </code></pre>
     */
    setResult : function(data){
      var _self = this,
        proxy = _self.get('proxy');
      if(proxy instanceof Proxy.Memery){
        _self.set('data',data);
        _self.load({start:0});
      }else{
        _self._setResult(data);
      }
    },

    /**
    * \u5220\u9664\u4e00\u6761\u6216\u591a\u6761\u8bb0\u5f55\u89e6\u53d1 remove \u4e8b\u4ef6.
    * <pre><code>
    *  store.remove(obj);  //\u5220\u9664\u4e00\u6761\u8bb0\u5f55
    *
    *  store.remove([obj1,obj2...]); //\u5220\u9664\u591a\u4e2a\u6761\u8bb0\u5f55
    *
    *  store.remvoe(obj,funciton(obj1,obj2){ //\u4f7f\u7528\u5339\u914d\u51fd\u6570
    *    return obj1.id == obj2.id;
    *  });
    * </code></pre>
    * @param {Array|Object} data \u6dfb\u52a0\u7684\u6570\u636e\uff0c\u53ef\u4ee5\u662f\u6570\u7ec4\uff0c\u53ef\u4ee5\u662f\u5355\u6761\u8bb0\u5f55
    * @param {Function} [match = function(obj1,obj2){return obj1 == obj2}] \u5339\u914d\u51fd\u6570\uff0c\u53ef\u4ee5\u4e3a\u7a7a
    */
    remove :function(data,match){
      var _self =this,
        delData=[];
      match = match || _self._getDefaultMatch();
      if(!BUI.isArray(data)){
        data = [data];
      }
      $.each(data,function(index,element){
        var index = _self.findIndexBy(element,match),
            record = removeAt(index,_self.getResult());
        //\u6dfb\u52a0\u5230\u5df2\u5220\u9664\u961f\u5217\u4e2d,\u5982\u679c\u662f\u65b0\u6dfb\u52a0\u7684\u6570\u636e\uff0c\u4e0d\u8ba1\u5165\u5220\u9664\u7684\u6570\u636e\u96c6\u5408\u4e2d
        if(!contains(record,_self.get('newRecords')) && !contains(record,_self.get('deletedRecords'))){
          _self.get('deletedRecords').push(record);
        }
        removeFrom(record,_self.get('newRecords'));
        removeFrom(record,_self.get('modifiedRecords'));
        _self.fire('remove',{record:record});
      }); 
    },
    /**
     * \u6392\u5e8f\uff0c\u5982\u679cremoteSort = true,\u53d1\u9001\u8bf7\u6c42\uff0c\u540e\u7aef\u6392\u5e8f
     * <pre><code>
     *   store.sort('id','DESC'); //\u4ee5id\u4e3a\u6392\u5e8f\u5b57\u6bb5\uff0c\u5012\u5e8f\u6392\u5e8f
     * </code></pre>
     * @param  {String} field     \u6392\u5e8f\u5b57\u6bb5
     * @param  {String} direction \u6392\u5e8f\u65b9\u5411
     */
    sort : function(field,direction){
      var _self = this,
        remoteSort = _self.get('remoteSort');

      if(!remoteSort){
        _self._localSort(field,direction);
      }else{
        _self.set('sortField',field);
        _self.set('sortDirection',direction);
        _self.load(_self.get('sortInfo'));
      }
    },
    /**
     * \u8ba1\u7b97\u6307\u5b9a\u5b57\u6bb5\u7684\u548c
     * <pre><code>
     *   var sum = store.sum('number');
     * </code></pre>
     * @param  {String} field \u5b57\u6bb5\u540d
     * @param  {Array} [data] \u8ba1\u7b97\u7684\u96c6\u5408\uff0c\u9ed8\u8ba4\u4e3aStore\u4e2d\u7684\u6570\u636e\u96c6\u5408
     * @return {Number} \u6c47\u603b\u548c
     */
    sum : function(field,data){
      var  _self = this,
        records = data || _self.getResult(),
        sum = 0;
      BUI.each(records,function(record){
        var val = record[field];
        if(!isNaN(val)){
          sum += parseFloat(val);
        }
      });
      return sum;
    },
    /**
    * \u8bbe\u7f6e\u8bb0\u5f55\u7684\u503c \uff0c\u89e6\u53d1 update \u4e8b\u4ef6
    * <pre><code>
    *  store.setValue(obj,'value','new value');
    * </code></pre>
    * @param {Object} obj \u4fee\u6539\u7684\u8bb0\u5f55
    * @param {String} field \u4fee\u6539\u7684\u5b57\u6bb5\u540d
    * @param {Object} value \u4fee\u6539\u7684\u503c
    */
    setValue : function(obj,field,value){
      var record = obj,
        _self = this;

      record[field]=value;
      if(!contains(record,_self.get('newRecords')) && !contains(record,_self.get('modifiedRecords'))){
          _self.get('modifiedRecords').push(record);
      }
      _self.fire('update',{record:record,field:field,value:value});
    },
    /**
    * \u66f4\u65b0\u8bb0\u5f55 \uff0c\u89e6\u53d1 update\u4e8b\u4ef6
    * <pre><code>
    *   var record = store.find('id','12');
    *   record.value = 'new value';
    *   record.text = 'new text';
    *   store.update(record); //\u89e6\u53d1update\u4e8b\u4ef6\uff0c\u5f15\u8d77\u7ed1\u5b9a\u4e86store\u7684\u63a7\u4ef6\u66f4\u65b0
    * </code></pre>
    * @param {Object} obj \u4fee\u6539\u7684\u8bb0\u5f55
    * @param {Boolean} [isMatch = false] \u662f\u5426\u9700\u8981\u8fdb\u884c\u5339\u914d\uff0c\u68c0\u6d4b\u6307\u5b9a\u7684\u8bb0\u5f55\u662f\u5426\u5728\u96c6\u5408\u4e2d
    */
    update : function(obj,isMatch){
      var record = obj,
        _self = this,
        match = null,
        index = null;
      if(isMatch){
        match = _self._getDefaultMatch();
        index = _self.findIndexBy(obj,match);
        if(index >=0){
          record = _self.getResult()[index];
        }
      }
      record = BUI.mix(record,obj);
      if(!contains(record,_self.get('newRecords')) && !contains(record,_self.get('modifiedRecords'))){
          _self.get('modifiedRecords').push(record);
      }
      _self.fire('update',{record:record});
    },
    //\u6dfb\u52a0\u7eaa\u5f55
    _addRecord :function(record,index){
      var records = this.getResult();
      if(index == undefined){
        index = records.length;
      }
      records.splice(index,0,record);
      this.fire('add',{record:record,index:index});
    },
    //\u6e05\u9664\u6539\u53d8\u7684\u6570\u636e\u8bb0\u5f55
    _clearChanges : function(){
      var _self = this;
      _self.get('newRecords').splice(0);
      _self.get('modifiedRecords').splice(0);
      _self.get('deletedRecords').splice(0);
    },
    //\u83b7\u53d6\u9ed8\u8ba4\u7684\u5339\u914d\u51fd\u6570
    _getDefaultMatch :function(){

      return this.get('matchFunction');
    },

    //\u83b7\u53d6\u5206\u9875\u76f8\u5173\u7684\u4fe1\u606f
    _getPageParams : function(){
      var _self = this,
        sortInfo = _self.get('sortInfo'),
        params = {
          start : _self.get('start'),
          limit : _self.get('pageSize'),
          pageIndex : _self.get('pageIndex') //\u4e00\u822c\u800c\u8a00\uff0cpageIndex = start/limit
        };

      if(_self.get('remoteSort')){
        BUI.mix(params,sortInfo);
      }

      return params;
    },
     /**
     * \u83b7\u53d6\u9644\u52a0\u7684\u53c2\u6570,\u5206\u9875\u4fe1\u606f\uff0c\u6392\u5e8f\u4fe1\u606f
     * @override
     * @protected
     * @return {Object} \u9644\u52a0\u7684\u53c2\u6570
     */
    getAppendParams : function(){
      return this._getPageParams();
    },
    /**
     * @protected
     * \u521d\u59cb\u5316\u4e4b\u524d
     */
    beforeInit : function(){
      //\u521d\u59cb\u5316\u7ed3\u679c\u96c6
      this._setResult([]);
    },
    //\u672c\u5730\u6392\u5e8f
    _localSort : function(field,direction){
      var _self = this;

      _self._sortData(field,direction);

      _self.fire('localsort');
    },
    _sortData : function(field,direction,data){
      var _self = this;
      data = data || _self.getResult();

      _self.sortData(field,direction,data);
    },
    //\u5904\u7406\u6570\u636e
    afterProcessLoad : function(data,params){
      var _self = this,
        root = _self.get('root'),
        start = params.start,
        limit = params.limit,
        totalProperty = _self.get('totalProperty');

      if(BUI.isArray(data)){
        _self._setResult(data);
      }else{
        _self._setResult(data[root],data[totalProperty]);
      }

      _self.set('start',start);

      if(limit){
        _self.set('pageIndex',start/limit);
      }

      //\u5982\u679c\u672c\u5730\u6392\u5e8f,\u5219\u6392\u5e8f
      if(!_self.get('remoteSort')){
        _self._sortData();
      }

      _self.fire('load',{ params : params });
    },
    //\u8bbe\u7f6e\u7ed3\u679c\u96c6
    _setResult : function(rows,totalCount){
      var _self = this,
        resultMap = _self.get('resultMap');

      totalCount = totalCount || rows.length;
      resultMap[_self.get('root')] = rows;
      resultMap[_self.get('totalProperty')] = totalCount;

      //\u6e05\u7406\u4e4b\u524d\u53d1\u751f\u7684\u6539\u53d8
      _self._clearChanges();
    }
  });

  return store;
});/**
 * @fileOverview Overlay \u6a21\u5757\u7684\u5165\u53e3
 * @ignore
 */

define('bui/overlay',['bui/common','bui/overlay/overlay','bui/overlay/dialog','bui/overlay/message'],function (require) {
  var BUI = require('bui/common'),
    Overlay = BUI.namespace('Overlay');

  BUI.mix(Overlay,{
    Overlay : require('bui/overlay/overlay'),
    Dialog : require('bui/overlay/dialog'),
    Message : require('bui/overlay/message')
  });

  BUI.mix(Overlay,{
    OverlayView : Overlay.Overlay.View,
    DialogView : Overlay.Dialog.View
  });

  BUI.Message = BUI.Overlay.Message;
  return Overlay;

});/**
 * @fileOverview \u60ac\u6d6e\u5c42
 * @ignore
 */

define('bui/overlay/overlay',['bui/common'],function (require) {
  var BUI = require('bui/common'),
    Component =  BUI.Component,
    CLS_ARROW = 'x-align-arrow',
    UIBase = Component.UIBase;

  /**
   * \u60ac\u6d6e\u5c42\u7684\u89c6\u56fe\u7c7b
   * @class BUI.Overlay.OverlayView
   * @extends BUI.Component.View
   * @mixins BUI.Component.UIBase.PositionView
   * @mixins BUI.Component.UIBase.CloseView
   * @private
   */
  var overlayView = Component.View.extend([
      UIBase.PositionView,
      UIBase.CloseView
    ]);

  /**
   * \u60ac\u6d6e\u5c42\uff0c\u663e\u793a\u60ac\u6d6e\u4fe1\u606f\uff0cMessage\u3001Dialog\u7684\u57fa\u7c7b
   * <p>
   * <img src="../assets/img/class-overlay.jpg"/>
   * </p>
   * xclass : 'overlay'
   * ** \u4e00\u822c\u6765\u8bf4\uff0coverlay\u7684\u5b50\u7c7b\uff0cDialog \u3001Message\u3001ToolTip\u5df2\u7ecf\u80fd\u591f\u6ee1\u8db3\u65e5\u5e38\u5e94\u7528\uff0c\u4f46\u662f\u4f7f\u7528overay\u66f4\u9002\u5408\u4e00\u4e9b\u66f4\u52a0\u7075\u6d3b\u7684\u5730\u65b9 **
   * ## \u7b80\u5355overlay
   * <pre><code>
   *   BUI.use('bui/overlay',function(Overlay){
   *     //\u70b9\u51fb#btn\uff0c\u663e\u793aoverlay
   *     var overlay = new Overlay.Overlay({
   *       trigger : '#btn',
   *       content : '\u8fd9\u662f\u5185\u5bb9',
   *       elCls : '\u5916\u5c42\u5e94\u7528\u7684\u6837\u5f0f',
   *       autoHide : true //\u70b9\u51fboverlay\u5916\u9762\uff0coverlay \u4f1a\u81ea\u52a8\u9690\u85cf
   *     });
   *
   *     overlay.render();
   *   });
   * <code><pre>
   *
   * 
   * @class BUI.Overlay.Overlay
   * @extends BUI.Component.Controller
   * @mixins BUI.Component.UIBase.Position
   * @mixins BUI.Component.UIBase.Align
   * @mixins BUI.Component.UIBase.Close
   * @mixins BUI.Component.UIBase.AutoShow
   * @mixins BUI.Component.UIBase.AutoHide
   */
  var overlay = Component.Controller.extend([UIBase.Position,UIBase.Align,UIBase.Close,UIBase.AutoShow,UIBase.AutoHide],{
    renderUI : function(){
      var _self = this,
        el = _self.get('el'),
        arrowContainer = _self.get('arrowContainer'),
        container = arrowContainer ? el.one(arrowContainer) : el;
      if(_self.get('showArrow')){
        $(_self.get('arrowTpl')).appendTo(container);
      }
    },
    show : function(){
      var _self = this,
        effectCfg = _self.get('effect'),
        el = _self.get('el'),
		    visibleMode = _self.get('visibleMode'),
        effect = effectCfg.effect,
        duration = effectCfg.duration;

  	  if(visibleMode === 'visibility'){
    		overlay.superclass.show.call(_self);
    		if(effectCfg.callback){
              effectCfg.callback.call(_self);
        }
    		return;
  	  }
      //\u5982\u679c\u8fd8\u672a\u6e32\u67d3\uff0c\u5219\u5148\u6e32\u67d3\u63a7\u4ef6
      if(!_self.get('rendered')){
        _self.set('visible',true);
        _self.render();
        _self.set('visible',false);
        el = _self.get('el');
      }
      
      switch(effect){
        case  'linear' :
          el.show(duration,callback);
          break;
        case  'fade' :
          el.fadeIn(duration,callback);
          break;
        case  'slide' :
          el.slideDown(duration,callback);
          break;
        default:
          callback();
        break;
      }

      function callback(){
        _self.set('visible',true);
        if(effectCfg.callback){
          effectCfg.callback.call(_self);
        }
      }

    },
    hide : function(){
      var _self = this,
        effectCfg = _self.get('effect'),
        el = _self.get('el'),
        effect = effectCfg.effect,
        duration = effectCfg.duration;
  	  if(_self.get('visibleMode') === 'visibility'){
  		  callback();
  		  return;
  	  }
      switch(effect){
        case 'linear':
          el.hide(duration,callback);
          break;
        case  'fade' :
          el.fadeOut(duration,callback);
          break;
        case  'slide' :
          el.slideUp(duration,callback);
          break;
        default:
          callback();
        break;
      }
      function callback(){
        _self.set('visible',false);
        if(effectCfg.callback){
          effectCfg.callback.call(_self);
        }
      }

    }
  },{
    ATTRS : 
	/**
	* @lends BUI.Overlay.Overlay#
  * @ignore 
	**/	
	{
      /**
       * {Object} - \u53ef\u9009, \u663e\u793a\u6216\u9690\u85cf\u65f6\u7684\u7279\u6548\u652f\u6301, \u5bf9\u8c61\u5305\u542b\u4ee5\u4e0b\u914d\u7f6e
       * <ol>
       * <li>effect:\u7279\u6548\u6548\u679c\uff0c'none(\u9ed8\u8ba4\u65e0\u7279\u6548)','linear(\u7ebf\u6027)',fade(\u6e10\u53d8)','slide(\u6ed1\u52a8\u51fa\u73b0)'</li>
       * <li>duration:\u65f6\u95f4\u95f4\u9694 </li>
       * </ol>
       * @type {Object}
       */
      effect:{
        value : {
          effect : 'none',
          duration : 0,
          callback : null
        }
      },
      /**
       * whether this component can be closed.
       * @default false
       * @type {Boolean}
       * @protected
       */
      closable:{
          value:false
      },
      /**
       * \u662f\u5426\u663e\u793a\u6307\u5411\u7bad\u5934\uff0c\u8ddfalign\u5c5e\u6027\u7684points\u76f8\u5173
       * @type {Boolean}
       * @protected
       */
      showArrow : {
        value : false
      },
      /**
       * \u7bad\u5934\u653e\u7f6e\u5728\u7684\u4f4d\u7f6e\uff0c\u662f\u4e00\u4e2a\u9009\u62e9\u5668\uff0c\u4f8b\u5982 .arrow-wraper
       *     new Tip({ //\u53ef\u4ee5\u8bbe\u7f6e\u6574\u4e2a\u63a7\u4ef6\u7684\u6a21\u677f
       *       arrowContainer : '.arrow-wraper',
       *       tpl : '<div class="arrow-wraper"></div>'
       *     });
       *     
       * @type {String}
       * @protected
       */
      arrowContainer : {
        view : true
      },
      /**
       * \u6307\u5411\u7bad\u5934\u7684\u6a21\u677f
       * @type {Object}
       * @protected
       */
      arrowTpl : {
        value : '<s class="' + CLS_ARROW + '"><s class="' + CLS_ARROW + '-inner"></s></s>'
      },
      visibleMode : {
        value : 'visibility'
      },
      visible :{
        value:false
      },
      xview : {
        value : overlayView
      }
    }
  },{
    xclass:'overlay'
  });

  overlay.View = overlayView;
  return overlay;

});/**
 * @fileOverview \u5f39\u51fa\u6846
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/overlay/dialog',['bui/overlay/overlay'],function (require) {
  var Overlay = require('bui/overlay/overlay'),
    UIBase = BUI.Component.UIBase,
  	CLS_TITLE = 'header-title',
  	PREFIX = BUI.prefix,
    HEIGHT_PADDING = 20;

  /**
   * dialog\u7684\u89c6\u56fe\u7c7b
   * @class BUI.Overlay.DialogView
   * @extends BUI.Overlay.OverlayView
   * @mixins BUI.Component.UIBase.StdModView
   * @mixins BUI.Component.UIBase.MaskView
   * @private
   */
  var dialogView = Overlay.View.extend([UIBase.StdModView,UIBase.MaskView],{

    _uiSetTitle:function(v){
      var _self = this,
        el = _self.get('el');

      el.find('.' + CLS_TITLE).html(v);

    },
    _uiSetContentId : function(v){
      var _self = this,
        body = _self.get('body'),
        children = $('#'+v).children();

      children.appendTo(body);
    },
    _uiSetHeight : function(v){
      var _self = this,
        bodyHeight = v,
        header = _self.get('header'),
        body = _self.get('body'),
        footer = _self.get('footer');

      bodyHeight -= header.outerHeight()+footer.outerHeight();
      bodyHeight -=HEIGHT_PADDING * 2;
      body.height(bodyHeight);
    },
    _removeContent : function(){
      var _self = this,
        body = _self.get('body'),
        contentId = _self.get('contentId');
      if(contentId){
        body.children().appendTo($('#'+contentId));
      }else {
        body.children().remove();
      }
    }

  },{
    xclass:'dialog-view'
  });

  /**
   * \u5f39\u51fa\u6846 xclass:'dialog'
   * <p>
   * <img src="../assets/img/class-overlay.jpg"/>
   * </p>
   * ** \u666e\u901a\u5f39\u51fa\u6846 **
   * <pre><code>
   *  BUI.use('bui/overlay',function(Overlay){
   *      var dialog = new Overlay.Dialog({
   *        title:'\u975e\u6a21\u6001\u7a97\u53e3',
   *        width:500,
   *        height:300,
   *        mask:false,  //\u8bbe\u7f6e\u662f\u5426\u6a21\u6001
   *        buttons:[],
   *        bodyContent:'<p>\u8fd9\u662f\u4e00\u4e2a\u975e\u6a21\u6001\u7a97\u53e3,\u5e76\u4e14\u4e0d\u5e26\u6309\u94ae</p>'
   *      });
   *    dialog.show();
   *    $('#btnShow').on('click',function () {
   *      dialog.show();
   *    });
   *  });
   * </code></pre>
   *
   * ** \u4f7f\u7528\u73b0\u6709\u7684html\u7ed3\u6784 **
   * <pre><code>
   *  BUI.use('bui/overlay',function(Overlay){
   *      var dialog = new Overlay.Dialog({
   *        title:'\u914d\u7f6eDOM',
   *        width:500,
   *        height:250,
   *        contentId:'content',//\u914d\u7f6eDOM\u5bb9\u5668\u7684\u7f16\u53f7
   *        success:function () {
   *          alert('\u786e\u8ba4');
   *          this.hide();
   *        }
   *      });
   *    dialog.show();
   *    $('#btnShow').on('click',function () {
   *      dialog.show();
   *    });
   *  });
   * </code></pre>
   * @class BUI.Overlay.Dialog
   * @extends BUI.Overlay.Overlay
   * @mixins BUI.Component.UIBase.StdMod
   * @mixins BUI.Component.UIBase.Mask
   * @mixins BUI.Component.UIBase.Drag
   */
  var dialog = Overlay.extend([UIBase.StdMod,UIBase.Mask,UIBase.Drag],{
    
    show:function(){
      var _self = this;

      dialog.superclass.show.call(this);
      _self.center();
    },
    _uiSetButtons:function(buttons){
      var _self = this,
        footer = _self.get('footer');

      footer.children().remove();
      BUI.each(buttons,function(conf){
        _self._createButton(conf,footer);
      });

    },
    _createButton : function(conf,parent){
      var _self = this,
        temp = '<button class="'+conf.elCls+'">'+conf.text+'</button>',
        btn = $(temp).appendTo(parent);
      btn.on('click',function(){
        conf.handler.call(_self);
      });
    }
  },{

    ATTRS : 
  	/**
  	* @lends BUI.Overlay.Dialog#
    * @ignore 
  	*/
    {
      closeTpl:{
        view:true,
        value : '<a tabindex="0" href=javascript:void("\u5173\u95ed") role="button" class="' + PREFIX + 'ext-close" style=""><span class="' + PREFIX + 'ext-close-x x-icon x-icon-normal">\u00d7</span></a>'
      },
     /**
       * \u5f39\u51fa\u5e93\u7684\u6309\u94ae\uff0c\u53ef\u4ee5\u6709\u591a\u4e2a,\u67093\u4e2a\u53c2\u6570
       * var dialog = new Overlay.Dialog({
       *     title:'\u81ea\u5b9a\u4e49\u6309\u94ae',
       *     width:500,
       *     height:300,
       *     mask:false,
       *     buttons:[
       *       {
       *         text:'\u81ea\u5b9a\u4e49',
       *         elCls : 'button button-primary',
       *         handler : function(){
       *           //do some thing
       *           this.hide();
       *         }
       *       },{
       *         text:'\u5173\u95ed',
       *         elCls : 'button',
       *         handler : function(){
       *           this.hide();
       *         }
       *       }
       *     ],
       *     
       *     bodyContent:'<p>\u8fd9\u662f\u4e00\u4e2a\u81ea\u5b9a\u4e49\u6309\u94ae\u7a97\u53e3,\u53ef\u4ee5\u914d\u7f6e\u4e8b\u4ef6\u548c\u6587\u672c\u6837\u5f0f</p>'
       *   });
       *  dialog.show();
       * <ol>
       *   <li>text:\u6309\u94ae\u6587\u672c</li>
       *   <li>elCls:\u6309\u94ae\u6837\u5f0f</li>
       *   <li>handler:\u70b9\u51fb\u6309\u94ae\u7684\u56de\u8c03\u4e8b\u4ef6</li>
       * </ol>
       * @cfg {Array} buttons
       * @default '\u786e\u5b9a'\u3001'\u53d6\u6d88'2\u4e2a\u6309\u94ae
       * 
       */
      buttons:{
        value:[
          {
            text:'\u786e\u5b9a',
            elCls : 'button button-primary',
            handler : function(){
              var _self = this,
                success = _self.get('success');
              if(success){
                success.call(_self);
              }
            }
          },{
            text:'\u53d6\u6d88',
            elCls : 'button button-primary',
            handler : function(){
              this.hide();
            }
          }
        ]
      },
      /**
       * \u5f39\u51fa\u6846\u663e\u793a\u5185\u5bb9\u7684DOM\u5bb9\u5668ID
       * @cfg {Object} contentId
       */
      contentId:{
        view:true
      },
  	  /**
      * \u70b9\u51fb\u6210\u529f\u65f6\u7684\u56de\u8c03\u51fd\u6570
      * @cfg {Function} success
      */
      success : {
        value : function(){

        }
      },
      dragNode : {
        /**
         * @private
         */
        valueFn : function(){
          return this.get('header');
        }
      },
      /**
       * \u5f39\u51fa\u6846\u6807\u9898
       * @cfg {String} title
       */
      /**
       * \u5f39\u51fa\u6846\u6807\u9898
       * <pre><code>
       *  dialog.set('title','new title');
       * </code></pre>
       * @type {String}
       */
      title : {
        view:true,
        value : ''
      },
      mask : {
        value:true
      },
      maskShared:{
        value:false
      },
      headerContent:{
        value:'<div class="' + CLS_TITLE + '">\u6807\u9898</div>'
      },
      footerContent:{

      },
      closable:{
        value : true
      },
      xview:{
        value:dialogView
      }
    }
  },{
    xclass : 'dialog'
  });
  
  dialog.View = dialogView;
  return dialog;
  
});/**
 * @fileOverview \u6d88\u606f\u6846\uff0c\u8b66\u544a\u3001\u786e\u8ba4
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/overlay/message',['bui/overlay/dialog'],function (require) {
  var Dialog = require('bui/overlay/dialog'),
	  PREFIX = BUI.prefix,
    iconText ={
        info : 'i',
        error : '\u00d7',
        success : '<i class="icon-ok icon-white"></i>',
        question : '?',
        warning: '!'
    };

  /**
   * \u6d88\u606f\u6846\u7c7b\uff0c\u4e00\u822c\u4e0d\u76f4\u63a5\u521b\u5efa\u5bf9\u8c61\uff0c\u800c\u662f\u8c03\u7528\u5176Alert\u548cConfirm\u65b9\u6cd5
   * <pre><code>
   ** BUI.use('bui/overlay',function(overlay){
   * 
   *    BUI.Message.Alert('\u8fd9\u53ea\u662f\u7b80\u5355\u7684\u63d0\u793a\u4fe1\u606f','info');
   *    BUI.Message.Alert('\u8fd9\u53ea\u662f\u7b80\u5355\u7684\u6210\u529f\u4fe1\u606f','success');
   *    BUI.Message.Alert('\u8fd9\u53ea\u662f\u7b80\u5355\u7684\u8b66\u544a\u4fe1\u606f','warning');
   *    BUI.Message.Alert('\u8fd9\u53ea\u662f\u7b80\u5355\u7684\u9519\u8bef\u4fe1\u606f','error');
   *    BUI.Message.Alert('\u8fd9\u53ea\u662f\u7b80\u5355\u7684\u8be2\u95ee\u4fe1\u606f','question');
   *
   *    //\u56de\u8c03\u51fd\u6570
   *    BUI.Message.Alert('\u70b9\u51fb\u89e6\u53d1\u56de\u8c03\u51fd\u6570',function() {
   *         alert('\u6267\u884c\u56de\u8c03');
   *       },'error');
   *       
   *    //\u590d\u6742\u7684\u63d0\u793a\u4fe1\u606f
   *    var msg = '<h2>\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u4e0a\u4f2010M\u4ee5\u5185\u7684\u6587\u4ef6</h2>'+
   *       '<p class="auxiliary-text">\u5982\u8fde\u7eed\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u53ca\u65f6\u8054\u7cfb\u5ba2\u670d\u70ed\u7ebf\uff1a0511-23883767834</p>'+
   *       '<p><a href="#">\u8fd4\u56delist\u9875\u9762</a> <a href="#">\u67e5\u770b\u8be6\u60c5</a></p>';
   *     BUI.Message.Alert(msg,'error');
   *    //\u786e\u8ba4\u4fe1\u606f
   *    BUI.Message.Confirm('\u786e\u8ba4\u8981\u66f4\u6539\u4e48\uff1f',function(){
   *       alert('\u786e\u8ba4');
   *     },'question');
   * });
   * </code></pre>
   * @class BUI.Overlay.Message
   * @private
   * @extends BUI.Overlay.Dialog
   */
  var message = Dialog.extend({

    /**
     * @protected
     * @ignore
     */
    renderUI : function(){
      this._setContent();
    },
    bindUI : function(){
      var _self = this,
        body = _self.get('body');
      _self.on('afterVisibleChange',function(ev){
        if(ev.newVal){
          if(BUI.UA.ie < 8){
           /**
           * fix ie6,7 bug
           * @ignore
           */
            var outerWidth = body.outerWidth();
            if(BUI.UA.ie == 6){
              outerWidth = outerWidth > 350 ? 350 : outerWidth;
            }
            _self.get('header').width(outerWidth - 20);
            _self.get('footer').width(outerWidth);
          }
        }
      });
    },
    //\u6839\u636e\u6a21\u7248\u8bbe\u7f6e\u5185\u5bb9
    _setContent : function(){
      var _self = this,
        body = _self.get('body'),
        contentTpl = BUI.substitute(_self.get('contentTpl'),{
          msg : _self.get('msg'),
          iconTpl : _self.get('iconTpl')
        });
      body.empty();

      $(contentTpl).appendTo(body);
    },
    //\u8bbe\u7f6e\u7c7b\u578b
    _uiSetIcon : function(v){
       if (!this.get('rendered')) {
            return;
        }
        this._setContent();
    },
    //\u8bbe\u7f6e\u6587\u672c
    _uiSetMsg : function(v){
       if (!this.get('rendered')) {
            return;
        }
        this._setContent();
    }

  },{
    ATTRS : 
    {
      /**
       * \u56fe\u6807\u7c7b\u578b
       * <ol>
       * <li>\u63d0\u793a\u4fe1\u606f\uff0c\u7c7b\u578b\u53c2\u6570<code>info</code></li>
       * <li>\u6210\u529f\u4fe1\u606f\uff0c\u7c7b\u578b\u53c2\u6570<code>success</code></li>
       * <li>\u8b66\u544a\u4fe1\u606f\uff0c\u7c7b\u578b\u53c2\u6570<code>warning</code></li>
       * <li>\u9519\u8bef\u4fe1\u606f\uff0c\u7c7b\u578b\u53c2\u6570<code>error</code></li>
       * <li>\u786e\u8ba4\u4fe1\u606f\uff0c\u7c7b\u578b\u53c2\u6570<code>question</code></li>
       * </ol>
       * @type {String}
       */
      icon : {

      },
      /**
       * \u63d0\u793a\u6d88\u606f\uff0c\u53ef\u4ee5\u662f\u6587\u672c\u6216\u8005html
       * @cfg {String} msg
       */
      /**
       * \u63d0\u793a\u6d88\u606f\uff0c\u53ef\u4ee5\u662f\u6587\u672c\u6216\u8005html
       * @type {String}
       */
      msg : {

      },
      /**
       * @private
       */
      iconTpl : {
        /**
         * @private
         */
        getter:function(){
          var _self = this,
            type = _self.get('icon');
          return '<div class="x-icon x-icon-' + type + '">' + iconText[type] + '</div>';
        }
      },
      /**
       * \u5185\u5bb9\u7684\u6a21\u7248
       * @type {String}
       * @protected
       */
      contentTpl : {
        value : '{iconTpl}<div class="' + PREFIX + 'message-content">{msg}</div>'
      }
    }
  },{
    xclass : 'message',
    priority : 0
  });
  
  var singlelon = new message({
      icon:'info',
      title:''
  });
      
  function messageFun(buttons,defaultIcon){
   
    return function (msg,callback,icon){

      if(BUI.isString(callback)){
        icon = callback;
        callback = null;
      }
      icon = icon || defaultIcon;
      callback = callback || hide;
      showMessage({
        'buttons': buttons,
        'icon':icon,
        'msg':msg,
        'success' : callback
      });
    };
  }

  function showMessage(config){
    singlelon.set(config);
      
    singlelon.show();
  }

  function success(){
   var _self = this,
      success = _self.get('success');
    if(success){
      success.call(_self);
      _self.hide();
    }
  }

  function hide(){
     this.hide();
  }

  
  var Alert = messageFun([{
          text:'\u786e\u5b9a',
          elCls : 'button button-primary',
          handler : success
        }
      ],'info'),
    Confirm = messageFun([{
          text:'\u786e\u5b9a',
          elCls : 'button button-primary',
          handler : success
        },{
            text:'\u53d6\u6d88',
            elCls : 'button button-primary',
            handler : hide
          }
      ],'question');

  /**
   * \u63d0\u793a\u6846\u9759\u6001\u7c7b
   * @class BUI.Message
   */

  /**
   * \u663e\u793a\u63d0\u793a\u4fe1\u606f\u6846
   * @static
   * @method
   * @member BUI.Message
   * @param  {String}   msg      \u63d0\u793a\u4fe1\u606f
   * @param  {Function} callback \u786e\u5b9a\u7684\u56de\u8c03\u51fd\u6570
   * @param  {String}   icon     \u56fe\u6807\uff0c\u63d0\u4f9b\u4ee5\u4e0b\u51e0\u79cd\u56fe\u6807\uff1ainfo,error,success,question,warning
   */
  message.Alert = Alert;

  /**
   * \u663e\u793a\u786e\u8ba4\u6846
   * <pre><code>
   * BUI.Message.Confirm('\u786e\u8ba4\u8981\u66f4\u6539\u4e48\uff1f',function(){
   *       alert('\u786e\u8ba4');
   * },'question');
   * </code></pre>
   * @static
   * @method
   * @member BUI.Message
   * @param  {String}   msg      \u63d0\u793a\u4fe1\u606f
   * @param  {Function} callback \u786e\u5b9a\u7684\u56de\u8c03\u51fd\u6570
   * @param  {String}   icon     \u56fe\u6807\uff0c\u63d0\u4f9b\u4ee5\u4e0b\u51e0\u79cd\u56fe\u6807\uff1ainfo,error,success,question,warning
   */
  message.Confirm = Confirm;

  /**
   * \u81ea\u5b9a\u4e49\u6d88\u606f\u6846\uff0c\u4f20\u5165\u914d\u7f6e\u4fe1\u606f {@link BUI.Overlay.Dialog} \u548c {@link BUI.Overlay.Message}
   * @static
   * @method
   * @member BUI.Message
   * @param  {Object}   config  \u914d\u7f6e\u4fe1\u606f
   */
  message.Show = showMessage;

  return message;
});/**
 * @fileOverview \u5217\u8868\u6a21\u5757\u5165\u53e3\u6587\u4ef6
 * @ignore
 */
;(function(){
var BASE = 'bui/list/';
define('bui/list',['bui/common',BASE + 'list',BASE + 'listitem',BASE + 'simplelist',BASE + 'listbox'],function (r) {
  var BUI = r('bui/common'),
    List = BUI.namespace('List');

  BUI.mix(List,{
    List : r(BASE + 'list'),
    ListItem : r(BASE + 'listitem'),
    SimpleList : r(BASE + 'simplelist'),
    Listbox : r(BASE + 'listbox')
  });

  BUI.mix(List,{
    ListItemView : List.ListItem.View,
    SimpleListView : List.SimpleList.View
  });

  return List;
});  
})();
/**
 * @fileOverview \u4f7f\u7528DOM\u5143\u7d20\u4f5c\u4e3a\u9009\u9879\u7684\u6269\u5c55\u7c7b
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/list/domlist',['bui/common'],function (require) {
  'use strict';

  var BUI = require('bui/common'),
    Selection = BUI.Component.UIBase.Selection,
    FIELD_PREFIX = 'data-',
    List = BUI.Component.UIBase.List;

  function getItemStatusCls(name ,self) {
    var _self = self,
      itemCls = _self.get('itemCls'),
      itemStatusCls = _self.get('itemStatusCls');

    if(itemStatusCls && itemStatusCls[name]){
      return itemStatusCls[name];
    }
    return itemCls + '-' + name;
  }

  /**
   * \u9009\u9879\u662fDOM\u7684\u5217\u8868\u7684\u89c6\u56fe\u7c7b
   * @private
   * @class BUI.List.DomList.View
   */
  var domListView = function(){

  };

  domListView.ATTRS = {
    items : {}
  };

  domListView.prototype = {
    /**
     * @protected
     * \u6e05\u9664\u8005\u5217\u8868\u9879\u7684DOM
     */
    clearControl : function(){
      var _self = this,
        listEl = _self.getItemContainer(),
        itemCls = _self.get('itemCls');
      listEl.find('.'+itemCls).remove();
    },
    /**
     * \u6dfb\u52a0\u9009\u9879
     * @param {Object} item  \u9009\u9879\u503c
     * @param {Number} index \u7d22\u5f15
     */
    addItem : function(item,index){
      return this._createItem(item,index);
    },
    /**
     * \u83b7\u53d6\u6240\u6709\u7684\u8bb0\u5f55
     * @return {Array} \u8bb0\u5f55\u96c6\u5408
     */
    getItems : function(){
      var _self = this,
        elements = _self.getAllElements(),
        rst = [];
      BUI.each(elements,function(elem){
        rst.push(_self.getItemByElement(elem));
      });
      return rst;
    },
    /**
     * \u66f4\u65b0\u5217\u8868\u9879
     * @param  {Object} item \u9009\u9879\u503c
     * @ignore
     */
    updateItem : function(item){
      var _self = this, 
        items = _self.getItems(),
        index = BUI.Array.indexOf(item,items),
        element = null,
        tpl;
      if(index >=0 ){
        element = _self.findElement(item);
        tpl = _self.getItemTpl(item,index);
        if(element){
          $(element).html($(tpl).html());
        }
      }
      return element;
    },
    /**
     * \u79fb\u9664\u9009\u9879
     * @param  {jQuery} element
     * @ignore
     */
    removeItem:function(item,element){
      element = element || this.findElement(item);
      $(element).remove();
    },
    /**
     * \u83b7\u53d6\u5217\u8868\u9879\u7684\u5bb9\u5668
     * @return {jQuery} \u5217\u8868\u9879\u5bb9\u5668
     * @protected
     */
    getItemContainer : function  () {
      return this.get('itemContainer') || this.get('el');
    },
    /**
     * \u83b7\u53d6\u8bb0\u5f55\u7684\u6a21\u677f,itemTpl \u548c \u6570\u636eitem \u5408\u5e76\u4ea7\u751f\u7684\u6a21\u677f
     * @protected 
     */
    getItemTpl : function  (item,index) {
      var _self = this,
        render = _self.get('itemTplRender'),
        itemTpl = _self.get('itemTpl');  
      if(render){
        return render(item,index);
      }
      
      return BUI.substitute(itemTpl,item);
    },
    //\u521b\u5efa\u9879
    _createItem : function(item,index){
      var _self = this,
        listEl = _self.getItemContainer(),
        itemCls = _self.get('itemCls'),
        dataField = _self.get('dataField'),
        tpl = _self.getItemTpl(item,index),
        node = $(tpl);
      if(index !== undefined){
        var target = listEl.find('.'+itemCls)[index];
        if(target){
          node.insertBefore(target);
        }else{
          node.appendTo(listEl);
        }
      }else{
        node.appendTo(listEl);
      }
      node.addClass(itemCls);
      node.data(dataField,item);
      return node;
    },
    /**
     * \u83b7\u53d6\u5217\u8868\u9879\u5bf9\u5e94\u72b6\u6001\u7684\u6837\u5f0f
     * @param  {String} name \u72b6\u6001\u540d\u79f0
     * @return {String} \u72b6\u6001\u7684\u6837\u5f0f
     */
    getItemStatusCls : function(name){
      return getItemStatusCls(name,this);
    },
    /**
     * \u8bbe\u7f6e\u5217\u8868\u9879\u9009\u4e2d
     * @protected
     * @param {*} name \u72b6\u6001\u540d\u79f0
     * @param {HTMLElement} element DOM\u7ed3\u6784
     * @param {Boolean} value \u8bbe\u7f6e\u6216\u53d6\u6d88\u6b64\u72b6\u6001
     */
    setItemStatusCls : function(name,element,value){
      var _self = this,
        cls = _self.getItemStatusCls(name),
        method = value ? 'addClass' : 'removeClass';
      if(element){
        $(element)[method](cls);
      }
    },
    /**
     * \u662f\u5426\u6709\u67d0\u4e2a\u72b6\u6001
     * @param {*} name \u72b6\u6001\u540d\u79f0
     * @param {HTMLElement} element DOM\u7ed3\u6784
     * @return {Boolean} \u662f\u5426\u5177\u6709\u72b6\u6001
     */
    hasStatus : function(name,element){
      var _self = this,
        cls = _self.getItemStatusCls(name);
      return $(element).hasClass(cls);
    },
    /**
     * \u8bbe\u7f6e\u5217\u8868\u9879\u9009\u4e2d
     * @param {*} item   \u8bb0\u5f55
     * @param {Boolean} selected \u662f\u5426\u9009\u4e2d
     * @param {HTMLElement} element DOM\u7ed3\u6784
     */
    setItemSelected: function(item,selected,element){
      var _self = this;

      element = element || _self.findElement(item);
      _self.setItemStatusCls('selected',element,selected);
    },
    /**
     * \u83b7\u53d6\u6240\u6709\u5217\u8868\u9879\u7684DOM\u7ed3\u6784
     * @return {Array} DOM\u5217\u8868
     */
    getAllElements : function(){
      var _self = this,
        itemCls = _self.get('itemCls'),
        el = _self.get('el');
      return el.find('.' + itemCls);
    },
    /**
     * \u83b7\u53d6DOM\u7ed3\u6784\u4e2d\u7684\u6570\u636e
     * @param {HTMLElement} element DOM \u7ed3\u6784
     * @return {Object} \u8be5\u9879\u5bf9\u5e94\u7684\u503c
     */
    getItemByElement : function(element){
      var _self = this,
        dataField = _self.get('dataField');
      return $(element).data(dataField);
    },
    /**
     * \u6839\u636e\u72b6\u6001\u83b7\u53d6\u7b2c\u4e00\u4e2aDOM \u8282\u70b9
     * @param {String} name \u72b6\u6001\u540d\u79f0
     * @return {HTMLElement} Dom \u8282\u70b9
     */
    getFirstElementByStatus : function(name){
      var _self = this,
        cls = _self.getItemStatusCls(name),
        el = _self.get('el');
      return el.find('.' + cls)[0];
    },
    /**
     * \u6839\u636e\u72b6\u6001\u83b7\u53d6DOM
     * @return {Array} DOM\u6570\u7ec4
     */
    getElementsByStatus : function(status){
      var _self = this,
        cls = _self.getItemStatusCls(status),
        el = _self.get('el');
      return el.find('.' + cls);
    },
    /**
     * \u901a\u8fc7\u6837\u5f0f\u67e5\u627eDOM\u5143\u7d20
     * @param {String} css\u6837\u5f0f
     * @return {jQuery} DOM\u5143\u7d20\u7684\u6570\u7ec4\u5bf9\u8c61
     */
    getSelectedElements : function(){
      var _self = this,
        cls = _self.getItemStatusCls('selected'),
        el = _self.get('el');
      return el.find('.' + cls);
    },
    /**
     * \u67e5\u627e\u6307\u5b9a\u7684\u9879\u7684DOM\u7ed3\u6784
     * @param  {Object} item 
     * @return {HTMLElement} element
     */
    findElement : function(item){
      var _self = this,
        elements = _self.getAllElements(),
        result = null;

      BUI.each(elements,function(element){
        if(_self.getItemByElement(element) == item){
            result = element;
            return false;
        }
      });
      return result;
    },
    /**
     * \u5217\u8868\u9879\u662f\u5426\u9009\u4e2d
     * @param  {HTMLElement}  element \u662f\u5426\u9009\u4e2d
     * @return {Boolean}  \u662f\u5426\u9009\u4e2d
     */
    isElementSelected : function(element){
      var _self = this,
        cls = _self.getItemStatusCls('selected');
      return element && $(element).hasClass(cls);
    }
  };

  //\u8f6c\u6362\u6210Object
  function parseItem(element,self){
    var attrs = element.attributes,
      itemStatusFields = self.get('itemStatusFields'),
      item = {};

    BUI.each(attrs,function(attr){
      var name = attr.nodeName;
      if(name.indexOf(FIELD_PREFIX) !== -1){
        name = name.replace(FIELD_PREFIX,'');
        item[name] = attr.nodeValue;
      }
    });
    item.text = $(element).text();
    //\u83b7\u53d6\u72b6\u6001\u5bf9\u5e94\u7684\u503c
    BUI.each(itemStatusFields,function(v,k){
      var cls = getItemStatusCls(k,self);
      if($(element).hasClass(cls)){
        item[v] = true;
      }
    });
    return item;
  }

  /**
   * @class BUI.List.DomList
   * \u9009\u9879\u662fDOM\u7ed3\u6784\u7684\u5217\u8868
   * @extends BUI.Component.UIBase.List
   * @mixins BUI.Component.UIBase.Selection
   */
  var domList = function(){

  };

  domList.ATTRS =BUI.merge(true,List.ATTRS,Selection.ATTRS,{

    /**
     * \u5728DOM\u8282\u70b9\u4e0a\u5b58\u50a8\u6570\u636e\u7684\u5b57\u6bb5
     * @type {String}
     * @protected
     */
    dataField : {
        view:true,
        value:'data-item'
    },
    /**
     * \u9009\u9879\u6240\u5728\u5bb9\u5668\uff0c\u5982\u679c\u672a\u8bbe\u5b9a\uff0c\u4f7f\u7528 el
     * @type {jQuery}
     * @protected
     */
    itemContainer : {
        view : true
    },
    /**
     * \u9009\u9879\u72b6\u6001\u5bf9\u5e94\u7684\u9009\u9879\u503c
     * 
     *   - \u6b64\u5b57\u6bb5\u7528\u4e8e\u5c06\u9009\u9879\u8bb0\u5f55\u7684\u503c\u8ddf\u663e\u793a\u7684DOM\u72b6\u6001\u76f8\u5bf9\u5e94
     *   - \u4f8b\u5982\uff1a\u4e0b\u9762\u8bb0\u5f55\u4e2d <code> checked : true </code>\uff0c\u53ef\u4ee5\u4f7f\u5f97\u6b64\u8bb0\u5f55\u5bf9\u5e94\u7684DOM\u4e0a\u5e94\u7528\u5bf9\u5e94\u7684\u72b6\u6001(\u9ed8\u8ba4\u4e3a 'list-item-checked')
     *     <pre><code>{id : '1',text : 1,checked : true}</code></pre>
     *   - \u5f53\u66f4\u6539DOM\u7684\u72b6\u6001\u65f6\uff0c\u8bb0\u5f55\u4e2d\u5bf9\u5e94\u7684\u5b57\u6bb5\u5c5e\u6027\u4e5f\u4f1a\u8ddf\u7740\u53d8\u5316
     * <pre><code>
     *   var list = new List.SimpleList({
     *   render : '#t1',
     *   idField : 'id', //\u81ea\u5b9a\u4e49\u6837\u5f0f\u540d\u79f0
     *   itemStatusFields : {
     *     checked : 'checked',
     *     disabled : 'disabled'
     *   },
     *   items : [{id : '1',text : '1',checked : true},{id : '2',text : '2',disabled : true}]
     * });
     * list.render(); //\u5217\u8868\u6e32\u67d3\u540e\uff0c\u4f1a\u81ea\u52a8\u5e26\u6709checked,\u548cdisabled\u5bf9\u5e94\u7684\u6837\u5f0f
     *
     * var item = list.getItem('1');
     * list.hasStatus(item,'checked'); //true
     *
     * list.setItemStatus(item,'checked',false);
     * list.hasStatus(item,'checked');  //false
     * item.checked;                    //false
     * 
     * </code></pre>
     * ** \u6ce8\u610f **
     * \u6b64\u5b57\u6bb5\u8ddf {@link #itemStatusCls} \u4e00\u8d77\u4f7f\u7528\u6548\u679c\u66f4\u597d\uff0c\u53ef\u4ee5\u81ea\u5b9a\u4e49\u5bf9\u5e94\u72b6\u6001\u7684\u6837\u5f0f
     * @cfg {Object} itemStatusFields
     */
    itemStatusFields : {
      value : {}
    },
    /**
     * \u9879\u7684\u6837\u5f0f\uff0c\u7528\u6765\u83b7\u53d6\u5b50\u9879
     * @cfg {Object} itemCls
     */
    itemCls : {
      view : true
    },        
    /**
     * \u83b7\u53d6\u9879\u7684\u6587\u672c\uff0c\u9ed8\u8ba4\u83b7\u53d6\u663e\u793a\u7684\u6587\u672c
     * @type {Object}
     * @protected
     */
    textGetter : {

    },
    events : {
      value : {
        /**
         * \u9009\u9879\u5bf9\u5e94\u7684DOM\u521b\u5efa\u5b8c\u6bd5
         * @event
         * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
         * @param {Object} e.item \u6e32\u67d3DOM\u5bf9\u5e94\u7684\u9009\u9879
         * @param {HTMLElement} e.element \u6e32\u67d3\u7684DOM\u5bf9\u8c61
         */
        'itemrendered' : true,
        /**
         * @event
         * \u5220\u9664\u9009\u9879
         * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
         * @param {Object} e.item \u5220\u9664DOM\u5bf9\u5e94\u7684\u9009\u9879
         * @param {HTMLElement} e.element \u5220\u9664\u7684DOM\u5bf9\u8c61
         */
        'itemremoved' : true,
        /**
         * @event
         * \u66f4\u65b0\u9009\u9879
         * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
         * @param {Object} e.item \u66f4\u65b0DOM\u5bf9\u5e94\u7684\u9009\u9879
         * @param {HTMLElement} e.element \u66f4\u65b0\u7684DOM\u5bf9\u8c61
         */
        'itemupdated' : true,
        /**
        * \u8bbe\u7f6e\u8bb0\u5f55\u65f6\uff0c\u6240\u6709\u7684\u8bb0\u5f55\u663e\u793a\u5b8c\u6bd5\u540e\u89e6\u53d1
        * @event
        */
        'itemsshow' : false,
        /**
        * \u8bbe\u7f6e\u8bb0\u5f55\u540e\uff0c\u6240\u6709\u7684\u8bb0\u5f55\u663e\u793a\u524d\u89e6\u53d1
        * @event:
        */
        'beforeitemsshow' : false,
        /**
        * \u6e05\u7a7a\u6240\u6709\u8bb0\u5f55\uff0cDOM\u6e05\u7406\u5b8c\u6210\u540e
        * @event
        */
        'itemsclear' : false,
        /**
        * \u6e05\u7a7a\u6240\u6709Dom\u524d\u89e6\u53d1
        * @event
        */
        'beforeitemsclear' : false
         
      } 
    }
  });

  domList.PARSER = {
    items : function(el){
      var _self = this,
        rst = [],
        itemCls = _self.get('itemCls'),
        dataField = _self.get('dataField'),
        elements = el.find('.' + itemCls);
      BUI.each(elements,function(element){
        var item = parseItem(element,_self);
        rst.push(item);
        $(element).data(dataField,item);
      });
      //_self.setInternal('items',rst);
      return rst;
    }
  };

  BUI.augment(domList,List,Selection,{
     
    //\u8bbe\u7f6e\u8bb0\u5f55
    _uiSetItems : function (items) {
      var _self = this;
      //\u4f7f\u7528srcNode \u7684\u65b9\u5f0f\uff0c\u4e0d\u540c\u6b65
      if(_self.get('srcNode') && !_self.get('rendered')){
        return;
      }
      this.setItems(items);
    },
    __bindUI : function(){
      var _self = this,
        selectedEvent = _self.get('selectedEvent'),
        itemCls = _self.get('itemCls'),
        itemContainer = _self.get('view').getItemContainer();

      itemContainer.delegate('.'+itemCls,'click',function(ev){
        var itemEl = $(ev.currentTarget),
          item = _self.getItemByElement(itemEl);
        if(_self.isItemDisabled(item,itemEl)){ //\u7981\u7528\u72b6\u6001\u4e0b\u963b\u6b62\u9009\u4e2d
          return;
        }
        var rst = _self.fire('itemclick',{item:item,element : itemEl[0],domTarget:ev.target});
        if(rst !== false && selectedEvent == 'click'){
          setItemSelectedStatus(item,itemEl); 
        }
      });
      if(selectedEvent !== 'click'){ //\u5982\u679c\u9009\u4e2d\u4e8b\u4ef6\u4e0d\u7b49\u4e8eclick\uff0c\u5219\u8fdb\u884c\u76d1\u542c\u9009\u4e2d
        itemContainer.delegate('.'+itemCls,selectedEvent,function(ev){
          var itemEl = $(ev.currentTarget),
            item = _self.getItemByElement(itemEl);
          if(_self.isItemDisabled(item,itemEl)){ //\u7981\u7528\u72b6\u6001\u4e0b\u963b\u6b62\u9009\u4e2d
            return;
          }
          setItemSelectedStatus(item,itemEl); 
        });
      }

      itemContainer.delegate('.' + itemCls,'dbclick',function(ev){
        var itemEl = $(ev.currentTarget),
          item = _self.getItemByElement(itemEl);
        if(_self.isItemDisabled(item,itemEl)){ //\u7981\u7528\u72b6\u6001\u4e0b\u963b\u6b62\u9009\u4e2d
          return;
        }
        _self.fire('itemdbclick',{item:item,element : itemEl[0],domTarget:ev.target});
      });
      
      function setItemSelectedStatus(item,itemEl){
        var multipleSelect = _self.get('multipleSelect'),
          isSelected;
        isSelected = _self.isItemSelected(item,itemEl);
        if(!isSelected){
          if(!multipleSelect){
            _self.clearSelected();
          }
          _self.setItemSelected(item,true,itemEl);
        }else if(multipleSelect){
          _self.setItemSelected(item,false,itemEl);
        }           
      }
      _self.on('itemrendered itemupdated',function(ev){
        var item = ev.item,
          element = ev.element;
        _self._syncItemStatus(item,element);
      });
    },
    //\u83b7\u53d6\u503c\uff0c\u901a\u8fc7\u5b57\u6bb5
    getValueByField : function(item,field){
      return item && item[field];
    }, 
    //\u540c\u6b65\u9009\u9879\u72b6\u6001
    _syncItemStatus : function(item,element){
      var _self = this,
        itemStatusFields = _self.get('itemStatusFields');
      BUI.each(itemStatusFields,function(v,k){
        _self.get('view').setItemStatusCls(k,element,item[v]);
      });
    },
    /**
     * @protected
     * \u83b7\u53d6\u8bb0\u5f55\u4e2d\u7684\u72b6\u6001\u503c\uff0c\u672a\u5b9a\u4e49\u5219\u4e3aundefined
     * @param  {Object} item  \u8bb0\u5f55
     * @param  {String} status \u72b6\u6001\u540d
     * @return {Boolean|undefined}  
     */
    getStatusValue : function(item,status){
      var _self = this,
        itemStatusFields = _self.get('itemStatusFields'),
        field = itemStatusFields[status];
      return item[field];
    },
    /**
     * \u83b7\u53d6\u9009\u9879\u6570\u91cf
     * @return {Number} \u9009\u9879\u6570\u91cf
     */
    getCount : function(){
      return this.getItems().length;
    },
    /**
     * \u66f4\u6539\u72b6\u6001\u503c\u5bf9\u5e94\u7684\u5b57\u6bb5
     * @protected
     * @param  {String} status \u72b6\u6001\u540d
     * @return {String} \u72b6\u6001\u5bf9\u5e94\u7684\u5b57\u6bb5
     */
    getStatusField : function(status){
      var _self = this,
        itemStatusFields = _self.get('itemStatusFields');
      return itemStatusFields[status];
    },
    /**
     * \u8bbe\u7f6e\u8bb0\u5f55\u72b6\u6001\u503c
     * @protected
     * @param  {Object} item  \u8bb0\u5f55
     * @param  {String} status \u72b6\u6001\u540d
     * @param {Boolean} value \u72b6\u6001\u503c
     */
    setStatusValue : function(item,status,value){
      var _self = this,
        itemStatusFields = _self.get('itemStatusFields'),
        field = itemStatusFields[status];
      if(field){
        item[field] = value;
      }
    },
    /**
     * @ignore
     * \u83b7\u53d6\u9009\u9879\u6587\u672c
     */
    getItemText : function(item){
      var _self = this,
          textGetter = _self.get('textGetter');
      if(!item)
      {
          return '';
      }
      if(textGetter){
        return textGetter(item);
      }else{
        return $(_self.findElement(item)).text();
      }
    },
    /**
     * \u5220\u9664\u9879
     * @param  {Object} item \u9009\u9879\u8bb0\u5f55
     * @ignore
     */
    removeItem : function (item) {
      var _self = this,
        items = _self.get('items'),
        element = _self.findElement(item),
        index;
      index = BUI.Array.indexOf(item,items);
      if(index !== -1){
        items.splice(index, 1);
      }
      _self.get('view').removeItem(item,element);
      _self.fire('itemremoved',{item:item,domTarget: $(element)[0],element : element});
    },
    /**
     * \u5728\u6307\u5b9a\u4f4d\u7f6e\u6dfb\u52a0\u9009\u9879,\u9009\u9879\u503c\u4e3a\u4e00\u4e2a\u5bf9\u8c61
     * @param {Object} item \u9009\u9879
     * @param {Number} index \u7d22\u5f15
     * @ignore
     */
    addItemAt : function(item,index) {
      var _self = this,
        items = _self.get('items');
      if(index === undefined) {
          index = items.length;
      }
      items.splice(index, 0, item);
      _self.addItemToView(item,index);
      return item;
    }, 
    /**
     * @protected
     * \u76f4\u63a5\u5728View\u4e0a\u663e\u793a
     * @param {Object} item \u9009\u9879
     * @param {Number} index \u7d22\u5f15
     * 
     */
    addItemToView : function(item,index){
      var _self = this,
        element = _self.get('view').addItem(item,index);
      _self.fire('itemrendered',{item:item,domTarget : $(element)[0],element : element});
    },
    /**
     * \u66f4\u65b0\u5217\u8868\u9879
     * @param  {Object} item \u9009\u9879\u503c
     * @ignore
     */
    updateItem : function(item){
      var _self = this,
        element =  _self.get('view').updateItem(item);
      _self.fire('itemupdated',{item : item,domTarget : $(element)[0],element : element});
    },
    /**
     * \u8bbe\u7f6e\u5217\u8868\u8bb0\u5f55
     * <pre><code>
     *   list.setItems(items);
     *   //\u7b49\u540c 
     *   list.set('items',items);
     * </code></pre>
     * @param {Array} items \u5217\u8868\u8bb0\u5f55
     */
    setItems : function(items){
      var _self = this;
      //\u6e05\u7406\u5b50\u63a7\u4ef6
      _self.clearControl();
      _self.fire('beforeitemsshow');
      BUI.each(items,function(item,index){
        _self.addItemToView(item,index);
      });
      _self.fire('itemsshow');
    },
    /**
     * \u83b7\u53d6\u6240\u6709\u9009\u9879
     * @return {Array} \u9009\u9879\u96c6\u5408
     * @override
     * @ignore
     */
    getItems : function () {
      
      return this.get('items');
    },
     /**
     * \u83b7\u53d6DOM\u7ed3\u6784\u4e2d\u7684\u6570\u636e
     * @protected
     * @param {HTMLElement} element DOM \u7ed3\u6784
     * @return {Object} \u8be5\u9879\u5bf9\u5e94\u7684\u503c
     */
    getItemByElement : function(element){
      return this.get('view').getItemByElement(element);
    },
    /**
     * \u83b7\u53d6\u9009\u4e2d\u7684\u7b2c\u4e00\u9879,
     * <pre><code>
     * var item = list.getSelected(); //\u591a\u9009\u6a21\u5f0f\u4e0b\u7b2c\u4e00\u6761
     * </code></pre>
     * @return {Object} \u9009\u4e2d\u7684\u7b2c\u4e00\u9879\u6216\u8005\u4e3anull
     */
    getSelected : function(){ //this.getSelection()[0] \u7684\u65b9\u5f0f\u6548\u7387\u592a\u4f4e
      var _self = this,
        element = _self.get('view').getFirstElementByStatus('selected');
        return _self.getItemByElement(element) || null;
    },
    /**
     * \u6839\u636e\u72b6\u6001\u83b7\u53d6\u9009\u9879
     * <pre><code>
     *   //\u8bbe\u7f6e\u72b6\u6001
     *   list.setItemStatus(item,'active');
     *   
     *   //\u83b7\u53d6'active'\u72b6\u6001\u7684\u9009\u9879
     *   list.getItemsByStatus('active');
     * </code></pre>
     * @param  {String} status \u72b6\u6001\u540d
     * @return {Array}  \u9009\u9879\u7ec4\u96c6\u5408
     */
    getItemsByStatus : function(status){
      var _self = this,
        elements = _self.get('view').getElementsByStatus(status),
        rst = [];
      BUI.each(elements,function(element){
        rst.push(_self.getItemByElement(element));
      });
      return rst;
    },
    /**
     * \u67e5\u627e\u6307\u5b9a\u7684\u9879\u7684DOM\u7ed3\u6784
     * <pre><code>
     *   var item = list.getItem('2'); //\u83b7\u53d6\u9009\u9879
     *   var element = list.findElement(item);
     *   $(element).addClass('xxx');
     * </code></pre>
     * @param  {Object} item 
     * @return {HTMLElement} element
     */
    findElement : function(item){
      var _self = this;
      if(BUI.isString(item)){
        item = _self.getItem(item);
      }
      return this.get('view').findElement(item);
    },
    findItemByField : function(field,value){
      var _self = this,
        items = _self.get('items'),
        result = null;
      BUI.each(items,function(item){
        if(item[field] === value){
            result = item;
            return false;
        }
      });

      return result;
    },
    /**
     * @override
     * @ignore
     */
    setItemSelectedStatus : function(item,selected,element){
      var _self = this;
      element = element || _self.findElement(item);
      //_self.get('view').setItemSelected(item,selected,element);
      _self.setItemStatus(item,'selected',selected,element);
      //_self.afterSelected(item,selected,element);
    },
    /**
     * \u8bbe\u7f6e\u6240\u6709\u9009\u9879\u9009\u4e2d
     * @ignore
     */
    setAllSelection : function(){
      var _self = this,
        items = _self.getItems();
      _self.setSelection(items);
    },
    /**
     * \u9009\u9879\u662f\u5426\u88ab\u9009\u4e2d
     * <pre><code>
     *   var item = list.getItem('2');
     *   if(list.isItemSelected(item)){
     *     //do something
     *   }
     * </code></pre>
     * @override
     * @param  {Object}  item \u9009\u9879
     * @return {Boolean}  \u662f\u5426\u9009\u4e2d
     */
    isItemSelected : function(item,element){
      var _self = this;
      element = element || _self.findElement(item);

      return _self.get('view').isElementSelected(element);
    },
    /**
     * \u662f\u5426\u9009\u9879\u88ab\u7981\u7528
     * <pre><code>
     * var item = list.getItem('2');
     * if(list.isItemDisabled(item)){ //\u5982\u679c\u9009\u9879\u7981\u7528
     *   //do something
     * }
     * </code></pre>
     * @param {Object} item \u9009\u9879
     * @return {Boolean} \u9009\u9879\u662f\u5426\u7981\u7528
     */
    isItemDisabled : function(item,element){
      return this.hasStatus(item,'disabled',element);
    },
    /**
     * \u8bbe\u7f6e\u9009\u9879\u7981\u7528
     * <pre><code>
     * var item = list.getItem('2');
     * list.setItemDisabled(item,true);//\u8bbe\u7f6e\u9009\u9879\u7981\u7528\uff0c\u4f1a\u5728DOM\u4e0a\u6dfb\u52a0 itemCls + 'disabled'\u7684\u6837\u5f0f
     * list.setItemDisabled(item,false); //\u53d6\u6d88\u7981\u7528\uff0c\u53ef\u4ee5\u7528{@link #itemStatusCls} \u6765\u66ff\u6362\u6837\u5f0f
     * </code></pre>
     * @param {Object} item \u9009\u9879
     */
    setItemDisabled : function(item,disabled){
      
      var _self = this;
      /*if(disabled){
        //\u6e05\u9664\u9009\u62e9
        _self.setItemSelected(item,false);
      }*/
      _self.setItemStatus(item,'disabled',disabled);
    },
    /**
     * \u83b7\u53d6\u9009\u4e2d\u7684\u9879\u7684\u503c
     * @override
     * @return {Array} 
     * @ignore
     */
    getSelection : function(){
      var _self = this,
        elements = _self.get('view').getSelectedElements(),
        rst = [];
      BUI.each(elements,function(elem){
        rst.push(_self.getItemByElement(elem));
      });
      return rst;
    },
    /**
     * @protected
     * @override
     * \u6e05\u9664\u8005\u5217\u8868\u9879\u7684DOM
     */
    clearControl : function(){
      this.fire('beforeitemsclear');
      this.get('view').clearControl();
      this.fire('itemsclear');
    },
    /**
     * \u9009\u9879\u662f\u5426\u5b58\u5728\u67d0\u79cd\u72b6\u6001
     * <pre><code>
     * var item = list.getItem('2');
     * list.setItemStatus(item,'active',true);
     * list.hasStatus(item,'active'); //true
     *
     * list.setItemStatus(item,'active',false);
     * list.hasStatus(item,'false'); //true
     * </code></pre>
     * @param {*} item \u9009\u9879
     * @param {String} status \u72b6\u6001\u540d\u79f0\uff0c\u5982selected,hover,open\u7b49\u7b49
     * @param {HTMLElement} [element] \u9009\u9879\u5bf9\u5e94\u7684Dom\uff0c\u653e\u7f6e\u53cd\u590d\u67e5\u627e
     * @return {Boolean} \u662f\u5426\u5177\u6709\u67d0\u79cd\u72b6\u6001
     */
    hasStatus : function(item,status,element){
      var _self = this;
      element = element || _self.findElement(item);
      return _self.get('view').hasStatus(status,element);
    },
    /**
     * \u8bbe\u7f6e\u9009\u9879\u72b6\u6001,\u53ef\u4ee5\u8bbe\u7f6e\u4efb\u4f55\u81ea\u5b9a\u4e49\u72b6\u6001
     * <pre><code>
     * var item = list.getItem('2');
     * list.setItemStatus(item,'active',true);
     * list.hasStatus(item,'active'); //true
     *
     * list.setItemStatus(item,'active',false);
     * list.hasStatus(item,'false'); //true
     * </code></pre>
     * @param {*} item \u9009\u9879
     * @param {String} status \u72b6\u6001\u540d\u79f0
     * @param {Boolean} value \u72b6\u6001\u503c\uff0ctrue,false
     * @param {HTMLElement} [element] \u9009\u9879\u5bf9\u5e94\u7684Dom\uff0c\u653e\u7f6e\u53cd\u590d\u67e5\u627e
     */
    setItemStatus : function(item,status,value,element){
      var _self = this;
      element = element || _self.findElement(item);
      if(!_self.isItemDisabled(item,element) || status === 'disabled'){ //\u7981\u7528\u540e\uff0c\u963b\u6b62\u6dfb\u52a0\u4efb\u4f55\u72b6\u6001\u53d8\u5316
        if(status === 'disabled' && value){ //\u7981\u7528\uff0c\u540c\u65f6\u6e05\u7406\u5176\u4ed6\u72b6\u6001
          _self.clearItemStatus(item);
        }
        _self.setStatusValue(item,status,value);
        _self.get('view').setItemStatusCls(status,element,value);
        _self.fire('itemstatuschange',{item : item,status : status,value : value,element : element});
        if(status === 'selected'){ //\u5904\u7406\u9009\u4e2d
          _self.afterSelected(item,value,element);
        }
      }
      
    },
    /**
     * \u6e05\u9664\u6240\u6709\u9009\u9879\u72b6\u6001,\u5982\u679c\u6307\u5b9a\u6e05\u9664\u7684\u72b6\u6001\u540d\uff0c\u5219\u6e05\u9664\u6307\u5b9a\u7684\uff0c\u5426\u5219\u6e05\u9664\u6240\u6709\u72b6\u6001
     * @param {Object} item \u9009\u9879
     */
    clearItemStatus : function(item,status,element){
      var _self = this,
        itemStatusFields = _self.get('itemStatusFields');
      element = element || _self.findElement(item);
        
      if(status){
        _self.setItemStatus(item,status,false,element);
      }else{
        BUI.each(itemStatusFields,function(v,k){
          _self.setItemStatus(item,k,false,element);
        });
        if(!itemStatusFields['selected']){
          _self.setItemSelected(item,false);
        }
        //\u79fb\u9664hover\u72b6\u6001
        _self.setItemStatus(item,'hover',false);
      }
      
    }
  });

  domList.View = domListView;

  return domList;
});/**
 * @fileOverview \u5217\u8868\u9009\u9879\uff0c\u4f7f\u7528\u952e\u76d8\u5bfc\u822a
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/list/keynav',function () {
  'use strict';
  /**
   * @class BUI.List.KeyNav
   * \u5217\u8868\u5bfc\u822a\u6269\u5c55\u7c7b
   */
  var  KeyNav = function(){};

  KeyNav.ATTRS = {
    /**
     * \u9009\u9879\u9ad8\u4eae\u4f7f\u7528\u7684\u72b6\u6001,\u6709\u4e9b\u573a\u666f\u4e0b\uff0c\u4f7f\u7528selected\u66f4\u5408\u9002
     * @cfg {String} [highlightedStatus='hover']
     */
    highlightedStatus : {
      value : 'hover'
    }
  };

  BUI.augment(KeyNav,{

    /**
     * \u8bbe\u7f6e\u9009\u9879\u9ad8\u4eae\uff0c\u9ed8\u8ba4\u4f7f\u7528 'hover' \u72b6\u6001
     * @param  {Object} item \u9009\u9879
     * @param  {Boolean} value \u72b6\u6001\u503c\uff0ctrue,false
     * @protected
     */
    setHighlighted : function(item,element){
      var _self = this,
        highlightedStatus = _self.get('highlightedStatus'),
        lightedItem = _self.getHighlighted();
      if(lightedItem !== item){
        this.setItemStatus(lightedItem,highlightedStatus,false);
        this.setItemStatus(item,highlightedStatus,true,element);
      }
    },
    /**
     * \u83b7\u53d6\u9ad8\u4eae\u7684\u9009\u9879
     * @return {Object} item
     * @protected
     */
    getHighlighted : function(){
      var _self = this,
        highlightedStatus = _self.get('highlightedStatus'),
        element = _self.get('view').getFirstElementByStatus(highlightedStatus);
      return _self.getItemByElement(element) || null;
    },
    /**
     * \u83b7\u53d6\u5217\u6570
     * @return {Number} \u9009\u9879\u7684\u5217\u6570,\u9ed8\u8ba4\u4e3a1\u5217
     * @protected
     */
    getColumnCount : function(){
      var _self = this,
        firstItem = _self.getFirstItem(),
        element = _self.findElement(firstItem),
        node = $(element);
      if(element){
        return parseInt(node.parent().width() / node.outerWidth(),10);
      }
      return 1;
    },
    /**
     * \u83b7\u53d6\u9009\u9879\u7684\u884c\u6570 \uff0c\u603b\u6570/\u5217\u6570 = list.getCount / column
     * @protected
     * @return {Number} \u9009\u9879\u884c\u6570
     */
    getRowCount : function(columns){
      var _self = this;
      columns = columns || _self.getColumnCount();
      return (this.getCount() + columns - 1) / columns;
    },
    _getNextItem : function(forward,skip,count){
      var _self = this,
        currentIndx = _self._getCurrentIndex(),//\u9ed8\u8ba4\u7b2c\u4e00\u884c
        itemCount = _self.getCount(),
        factor = forward ? 1 : -1,
        nextIndex; 
      if(currentIndx === -1){
        return forward ? _self.getFirstItem() : _self.getLastItem();
      }
      if(!forward){
        skip = skip * factor;
      }
      nextIndex = (currentIndx + skip + count) % count;
      if(nextIndex > itemCount - 1){ //\u5982\u679c\u4f4d\u7f6e\u8d85\u51fa\u7d22\u5f15\u4f4d\u7f6e
        if(forward){
          nextIndex = nextIndex -  (itemCount - 1);
        }else{
          nextIndex = nextIndex + skip;
        }
        
      }
      return _self.getItemAt(nextIndex);
    },
    //\u83b7\u53d6\u5de6\u8fb9\u4e00\u9879
    _getLeftItem : function(){
      var _self = this,
        count = _self.getCount(),
        column = _self.getColumnCount();
      if(!count || column <= 1){ //\u5355\u5217\u65f6,\u6216\u8005\u4e3a0\u65f6
        return null;
      }
      return _self._getNextItem(false,1,count);
    },
    //\u83b7\u53d6\u5f53\u524d\u9879
    _getCurrentItem : function(){
      return this.getHighlighted();
    },
    //\u83b7\u53d6\u5f53\u524d\u9879
    _getCurrentIndex : function(){
      var _self = this,
        item = _self._getCurrentItem();
      return this.indexOfItem(item);
    },
    //\u83b7\u53d6\u53f3\u8fb9\u4e00\u9879
    _getRightItem : function(){
      var _self = this,
        count = _self.getCount(),
        column = _self.getColumnCount();
      if(!count || column <= 1){ //\u5355\u5217\u65f6,\u6216\u8005\u4e3a0\u65f6
        return null;
      }
      return this._getNextItem(true,1,count);
    },
    //\u83b7\u53d6\u4e0b\u9762\u4e00\u9879
    _getDownItem : function(){
      var _self = this,
        columns = _self.getColumnCount(),
        rows = _self.getRowCount(columns);
      if(rows <= 1){ //\u5355\u884c\u6216\u8005\u4e3a0\u65f6
        return null;
      }
      return  this._getNextItem(true,columns,columns * rows);

    },
    //\u83b7\u53d6\u4e0a\u9762\u4e00\u9879
    _getUpperItem : function(){
      var _self = this,
        columns = _self.getColumnCount(),
        rows = _self.getRowCount(columns);
      if(rows <= 1){ //\u5355\u884c\u6216\u8005\u4e3a0\u65f6
        return null;
      }
      return this._getNextItem(false,columns,columns * rows);
    },
    /**
     * \u5904\u7406\u5411\u4e0a\u5bfc\u822a
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavUp : function (ev) {
      var _self = this,
        upperItem = _self._getUpperItem();
      _self.setHighlighted(upperItem);
    },
    /**
     * \u5904\u7406\u5411\u4e0b\u5bfc\u822a
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavDown : function (ev) {
      this.setHighlighted(this._getDownItem());
    },
    /**
     * \u5904\u7406\u5411\u5de6\u5bfc\u822a
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavLeft : function (ev) {
      this.setHighlighted(this._getLeftItem());
    },
    
    /**
     * \u5904\u7406\u5411\u53f3\u5bfc\u822a
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavRight : function (ev) {
      this.setHighlighted(this._getRightItem());
    },
    /**
     * \u5904\u7406\u786e\u8ba4\u952e
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavEnter : function (ev) {
      var _self = this,
        current = _self._getCurrentItem();
      if(current){
        _self.setSelected(current);
      }
    },
    /**
     * \u5904\u7406 esc \u952e
     * @protected
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavEsc : function (ev) {
      this.setHighlighted(null); //\u79fb\u9664
    },
    /**
     * \u5904\u7406Tab\u952e
     * @param  {jQuery.Event} ev \u4e8b\u4ef6\u5bf9\u8c61
     */
    handleNavTab : function(ev){
      this.setHighlighted(this._getRightItem());
    }

  });

  return KeyNav;
});/**
 * @fileOverview \u7b80\u5355\u5217\u8868\uff0c\u76f4\u63a5\u4f7f\u7528DOM\u4f5c\u4e3a\u5217\u8868\u9879
 * @ignore
 */

define('bui/list/simplelist',['bui/common','bui/list/domlist','bui/list/keynav'],function (require) {

  /**
   * @name BUI.List
   * @namespace \u5217\u8868\u547d\u540d\u7a7a\u95f4
   * @ignore
   */
  var BUI = require('bui/common'),
    UIBase = BUI.Component.UIBase,
    DomList = require('bui/list/domlist'),
    KeyNav = require('bui/list/keynav'),
    CLS_ITEM = BUI.prefix + 'list-item';
  
  /**
   * @class BUI.List.SimpleListView
   * \u7b80\u5355\u5217\u8868\u89c6\u56fe\u7c7b
   * @extends BUI.Component.View
   */
  var simpleListView = BUI.Component.View.extend([DomList.View],{

    setElementHover : function(element,hover){
      var _self = this;

      _self.setItemStatusCls('hover',element,hover);
    }

  },{
    ATTRS : {
      itemContainer : {
        valueFn : function(){
          return this.get('el').children(this.get('listSelector'));
        }
      }
    }
  },{
    xclass:'simple-list-view'
  });

  /**
   * \u7b80\u5355\u5217\u8868\uff0c\u7528\u4e8e\u663e\u793a\u7b80\u5355\u6570\u636e
   * <p>
   * <img src="../assets/img/class-list.jpg"/>
   * </p>
   * xclass:'simple-list'
   * ## \u663e\u793a\u9759\u6001\u6570\u7ec4\u7684\u6570\u636e
   * 
   * ** \u6700\u7b80\u5355\u7684\u5217\u8868 **
   * <pre><code>
   * 
   * BUI.use('bui/list',function(List){
   *   var list = new List.SimpleList({
   *     render : '#t1',
   *     items : [{value : '1',text : '1'},{value : '2',text : '2'}]
   *   });
   *   list.render();
   * });
   * 
   * </code></pre>
   *
   * ** \u81ea\u5b9a\u4e49\u6a21\u677f\u7684\u5217\u8868 **
   *<pre><code>
   * 
   * BUI.use('bui/list',function(List){
   *   var list = new List.SimpleList({
   *     render : '#t1',
   *     items : [{value : '1',text : '1'},{value : '2',text : '2'}]
   *   });
   *   list.render();
   * });
   * 
   * </code></pre>
   * 
   * @class BUI.List.SimpleList
   * @extends BUI.Component.Controller
   * @mixins BUI.List.DomList
   * @mixins BUI.List.KeyNav
   * @mixins BUI.Component.UIBase.Bindable
   */
  var  simpleList = BUI.Component.Controller.extend([DomList,UIBase.Bindable,KeyNav],
  /**
   * @lends BUI.List.SimpleList.prototype
   * @ignore
   */
  {
    /**
     * @protected
     * @ignore
     */
    bindUI : function(){
      var _self = this,
        itemCls = _self.get('itemCls'),
        itemContainer = _self.get('view').getItemContainer();

      itemContainer.delegate('.'+itemCls,'mouseover',function(ev){
        var element = ev.currentTarget,
          item = _self.getItemByElement(element);
        if(_self.isItemDisabled(ev.item,ev.currentTarget)){ //\u5982\u679c\u7981\u7528
          return;
        }
        
        if(_self.get('highlightedStatus') === 'hover'){
          _self.setHighlighted(item,element)
        }else{
          _self.setItemStatus(item,'hover',true,element);
        }
      }).delegate('.'+itemCls,'mouseout',function(ev){
        var sender = $(ev.currentTarget);
        _self.get('view').setElementHover(sender,false);
      });
    },
    /**
     * \u6dfb\u52a0
     * @protected
     */
    onAdd : function(e){
      var _self = this,
        item = e.record;
      _self.addItemToView(item,e.index);
    },
    /**
     * \u5220\u9664
    * @protected
    */
    onRemove : function(e){
      var _self = this,
        item = e.record;
      _self.removeItem(item);
    },
    /**
     * \u66f4\u65b0
    * @protected
    */
    onUpdate : function(e){
      this.updateItem(e.record);
    },
    /**
    * \u672c\u5730\u6392\u5e8f
    * @protected
    */
    onLocalSort : function(e){
      this.onLoad(e);
    },
    /**
     * \u52a0\u8f7d\u6570\u636e
     * @protected
     */
    onLoad:function(){
      var _self = this,
        store = _self.get('store'),
        items = store.getResult();
      _self.set('items',items);
    }
  },{
    ATTRS : 
    /**
     * @lends BUI.List.SimpleList#
     * @ignore
     */
    {
      /**
       * \u9009\u9879\u96c6\u5408
       * @protected
       * @type {Array}
       */
      items : {
        view:true,
        value : []
      },
      /**
       * \u9009\u9879\u7684\u6837\u5f0f\uff0c\u7528\u6765\u83b7\u53d6\u5b50\u9879
       * <pre><code>
       * var list = new List.SimpleList({
       *   render : '#t1',
       *   itemCls : 'my-item', //\u81ea\u5b9a\u4e49\u6837\u5f0f\u540d\u79f0
       *   items : [{id : '1',text : '1',type : '0'},{id : '2',text : '2',type : '1'}]
       * });
       * list.render();
       * </code></pre>
       * @cfg {Object} [itemCl='list-item']
       */
      itemCls : {
        view:true,
        value : CLS_ITEM
      },
      /**
       * \u9009\u9879\u7684\u9ed8\u8ba4id\u5b57\u6bb5
       * <pre><code>
       * var list = new List.SimpleList({
       *   render : '#t1',
       *   idField : 'id', //\u81ea\u5b9a\u4e49\u9009\u9879 id \u5b57\u6bb5
       *   items : [{id : '1',text : '1',type : '0'},{id : '2',text : '2',type : '1'}]
       * });
       * list.render();
       *
       * list.getItem('1'); //\u4f7f\u7528idField\u6307\u5b9a\u7684\u5b57\u6bb5\u8fdb\u884c\u67e5\u627e
       * </code></pre>
       * @cfg {String} [idField = 'value']
       */
      idField : {
        value : 'value'
      },
      /**
       * \u5217\u8868\u7684\u9009\u62e9\u5668\uff0c\u5c06\u5217\u8868\u9879\u9644\u52a0\u5230\u6b64\u8282\u70b9
       * @protected
       * @type {Object}
       */
      listSelector:{
        view:true,
        value:'ul'
      },
      /**
       * \u5217\u8868\u9879\u7684\u9ed8\u8ba4\u6a21\u677f\u3002
       *<pre><code>
       * var list = new List.SimpleList({
       *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;', //\u5217\u8868\u9879\u7684\u6a21\u677f
       *   idField : 'value',
       *   render : '#t1',
       *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
       * });
       * list.render();
       * </code></pre>
       * @cfg {String} [itemTpl ='&lt;li role="option" class="bui-list-item" data-value="{value}"&gt;{text}&lt;/li&gt;']
       */
      
      itemTpl :{
        view : true,
        value : '<li role="option" class="' + CLS_ITEM + '">{text}</li>'
      },
      tpl : {
        value:'<ul></ul>'
      },
      xview:{
        value : simpleListView
      }
    }
  },{
    xclass : 'simple-list',
    prority : 0
  });

  simpleList.View = simpleListView;
  return simpleList;
});/**
 * @fileOverview \u53ef\u9009\u62e9\u7684\u5217\u8868
 * @author dengbin
 * @ignore
 */

define('bui/list/listbox',['bui/list/simplelist'],function (require) {
  var SimpleList = require('bui/list/simplelist');
  /**
   * \u5217\u8868\u9009\u62e9\u6846
   * @extends BUI.List.SimpleList
   * @class BUI.List.Listbox
   */
  var listbox = SimpleList.extend({
    bindUI : function(){
    	var _self = this;
      
    	_self.on('selectedchange',function(e){
    		var item = e.item,
    			sender = $(e.domTarget),
    			checkbox =sender.find('input');
    		if(item){
    			checkbox.attr('checked',e.selected);
    		}
    	});
    }
  },{
    ATTRS : {
      /**
       * \u9009\u9879\u6a21\u677f
       * @override
       * @type {String}
       */
      itemTpl : {
        value : '<li><span class="checkbox"><input type="checkbox" />{text}</span></li>'
      },
      /**
       * \u9009\u9879\u6a21\u677f
       * @override
       * @type {Boolean}
       */
      multipleSelect : {
        value : true
      }
    }
  },{
    xclass: 'listbox'
  });

  return listbox;
});/**
 * @fileOverview \u5217\u8868\u9879
 * @author dxq613@gmail.com
 * @ignore
 */
define('bui/list/listitem',function ($) {


  var Component = BUI.Component,
    UIBase = Component.UIBase;
    
  /**
   * @private
   * @class BUI.List.ItemView
   * @extends BUI.Component.View
   * @extends BUI.Component.View
   * @mixins BUI.Component.UIBase.ListItemView
   * \u5217\u8868\u9879\u7684\u89c6\u56fe\u5c42\u5bf9\u8c61
   */
  var itemView = Component.View.extend([UIBase.ListItemView],{
  });

  /**
   * \u5217\u8868\u9879
   * @private
   * @class BUI.List.ListItem
   * @extends BUI.Component.Controller
   * @mixins BUI.Component.UIBase.ListItem
   */
  var item = Component.Controller.extend([UIBase.ListItem],{
    
  },{
    ATTRS : 
    /**
     * @lends BUI.List.Item#
     * @ignore
     */
    {
      elTagName:{
        view:true,
        value:'li'
      },
      xview:{
        value:itemView
      },
      tpl:{
        view:true,
        value:'<span>{text}</span>'
      }
    }
  },{
    xclass:'list-item'
  });

  item.View = itemView;
  
  return item;
});/**
 * @fileOverview \u5217\u8868
 * @ignore
 */
define('bui/list/list',function (require) {
  
  var Component = BUI.Component,
    UIBase = Component.UIBase;

  /**
   * \u5217\u8868
   * <p>
   * <img src="../assets/img/class-list.jpg"/>
   * </p>
   * xclass:'list'
   * @class BUI.List.List
   * @extends BUI.Component.Controller
   * @mixins BUI.Component.UIBase.ChildList
   */
  var list = Component.Controller.extend([UIBase.ChildList],{
    
  },{
    ATTRS : 
    /**
     * @lends BUI.List.List#
     * @ignore
     */
    {
      elTagName:{
        view:true,
        value:'ul'
      },
      idField:{
        value:'id'
      },
      /**
       * \u5b50\u7c7b\u7684\u9ed8\u8ba4\u7c7b\u540d\uff0c\u5373\u7c7b\u7684 xclass
       * @type {String}
       * @override
       * @default 'list-item'
       */
      defaultChildClass : {
        value : 'list-item'
      }
    }
  },{
    xclass:'list'
  });

  return list;
});/**
 * @fileOverview Picker\u7684\u5165\u53e3
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/picker',['bui/common','bui/picker/picker','bui/picker/listpicker'],function (require) {
  var BUI = require('bui/common'),
    Picker = BUI.namespace('Picker');

  BUI.mix(Picker,{
    Picker : require('bui/picker/picker'),
    ListPicker : require('bui/picker/listpicker')
  });

  return Picker;
});/**
 * @fileOverview \u9009\u62e9\u5668
 * @ignore
 */

define('bui/picker/picker',['bui/overlay'],function (require) {
  
  var Overlay = require('bui/overlay').Overlay;

  /**
   * \u9009\u62e9\u5668\u63a7\u4ef6\u7684\u57fa\u7c7b\uff0c\u5f39\u51fa\u4e00\u4e2a\u5c42\u6765\u9009\u62e9\u6570\u636e\uff0c\u4e0d\u8981\u4f7f\u7528\u6b64\u7c7b\u521b\u5efa\u63a7\u4ef6\uff0c\u4ec5\u7528\u4e8e\u7ee7\u627f\u5b9e\u73b0\u63a7\u4ef6
   * xclass : 'picker'
   * <pre><code>
   * BUI.use(['bui/picker','bui/list'],function(Picker,List){
   *
   * var items = [
   *       {text:'\u9009\u98791',value:'a'},
   *       {text:'\u9009\u98792',value:'b'},
   *      {text:'\u9009\u98793',value:'c'}
   *     ],
   *   list = new List.SimpleList({
   *     elCls:'bui-select-list',
   *     items : items
   *   }),
   *   picker = new Picker.ListPicker({
   *     trigger : '#show',  
   *     valueField : '#hide', //\u5982\u679c\u9700\u8981\u5217\u8868\u8fd4\u56de\u7684value\uff0c\u653e\u5728\u9690\u85cf\u57df\uff0c\u90a3\u4e48\u6307\u5b9a\u9690\u85cf\u57df
   *     width:100,  //\u6307\u5b9a\u5bbd\u5ea6
   *     children : [list] //\u914d\u7f6epicker\u5185\u7684\u5217\u8868
   *   });
   * picker.render();
   * });
   * </code></pre>
   * @abstract
   * @class BUI.Picker.Picker
   * @extends BUI.Overlay.Overlay
   */
  var picker = Overlay.extend({
    
      bindUI : function(){
        var _self = this,
          innerControl = _self.get('innerControl'),
          hideEvent = _self.get('hideEvent'),
          trigger = $(_self.get('trigger'));

        trigger.on(_self.get('triggerEvent'),function(e){
          if(_self.get('autoSetValue')){
            var valueField = _self.get('valueField') || _self.get('textField') || this,
              val = $(valueField).val();
            _self.setSelectedValue(val);
          }
        });

        innerControl.on(_self.get('changeEvent'),function(e){
          var curTrigger = _self.get('curTrigger'),
            textField = _self.get('textField') || curTrigger,
            valueField = _self.get('valueField'),
            selValue = _self.getSelectedValue(),
            isChange = false;

          if(textField){
            var selText = _self.getSelectedText(),
              preText = $(textField).val();
            if(selText != preText){
              $(textField).val(selText);
              isChange = true;
            }
          }
          
          if(valueField){
            var preValue = $(valueField).val();  
            if(valueField != preValue){
              $(valueField).val(selValue);
              isChange = true;
            }
          }
          if(isChange){
            _self.onChange(selText,selValue,e);
          }
        });
        if(hideEvent){
          innerControl.on(_self.get('hideEvent'),function(){
            var curTrigger = _self.get('curTrigger');
            try{ //\u9690\u85cf\u65f6\uff0c\u5728ie6,7\u4e0b\u4f1a\u62a5\u9519
              if(curTrigger){
                curTrigger.focus();
              }
            }catch(e){
              BUI.log(e);
            }
            _self.hide();
          });
        }
      },
      /**
       * \u8bbe\u7f6e\u9009\u4e2d\u7684\u503c
       * @template
       * @protected
       * @param {String} val \u8bbe\u7f6e\u503c
       */
      setSelectedValue : function(val){
        
      },
      /**
       * \u83b7\u53d6\u9009\u4e2d\u7684\u503c\uff0c\u591a\u9009\u72b6\u6001\u4e0b\uff0c\u503c\u4ee5','\u5206\u5272
       * @template
       * @protected
       * @return {String} \u9009\u4e2d\u7684\u503c
       */
      getSelectedValue : function(){
        
      },
      /**
       * \u83b7\u53d6\u9009\u4e2d\u9879\u7684\u6587\u672c\uff0c\u591a\u9009\u72b6\u6001\u4e0b\uff0c\u6587\u672c\u4ee5','\u5206\u5272
       * @template
       * @protected
       * @return {String} \u9009\u4e2d\u7684\u6587\u672c
       */
      getSelectedText : function(){

      },
      /**
       * @protected
       * \u53d1\u751f\u6539\u53d8
       */
      onChange : function(selText,selValue,ev){
        var _self = this,
          curTrigger = _self.get('curTrigger');
        _self.fire('selectedchange',{value : selValue,text : selText,curTrigger : curTrigger});
      },
      _uiSetValueField : function(v){
        var _self = this;
        if(v){
          _self.setSelectedValue($(v).val());
        }
      },
      _getTextField : function(){
        var _self = this;
        return _self.get('textField') || _self.get('curTrigger');
      }
  },{
    ATTRS : {
      
      /**
       * \u7528\u4e8e\u9009\u62e9\u7684\u63a7\u4ef6\uff0c\u9ed8\u8ba4\u4e3a\u7b2c\u4e00\u4e2a\u5b50\u5143\u7d20,\u6b64\u63a7\u4ef6\u5b9e\u73b0 @see {BUI.Component.UIBase.Selection} \u63a5\u53e3
       * @protected
       * @type {Object|BUI.Component.Controller}
       */
      innerControl : {
        getter:function(){
          return this.get('children')[0];
        }
      },
      /**
       * \u663e\u793a\u9009\u62e9\u5668\u7684\u4e8b\u4ef6
       * @cfg {String} [triggerEvent='click']
       */
      /**
       * \u663e\u793a\u9009\u62e9\u5668\u7684\u4e8b\u4ef6
       * @type {String}
       * @default 'click'
       */
      triggerEvent:{
        value:'click'
      },
      /**
       * \u9009\u62e9\u5668\u9009\u4e2d\u7684\u9879\uff0c\u662f\u5426\u968f\u7740\u89e6\u53d1\u5668\u6539\u53d8
       * @cfg {Boolean} [autoSetValue=true]
       */
      /**
       * \u9009\u62e9\u5668\u9009\u4e2d\u7684\u9879\uff0c\u662f\u5426\u968f\u7740\u89e6\u53d1\u5668\u6539\u53d8
       * @type {Boolean}
       */
      autoSetValue : {
        value : true
      },
      /**
       * \u9009\u62e9\u53d1\u751f\u6539\u53d8\u7684\u4e8b\u4ef6
       * @cfg {String} [changeEvent='selectedchange']
       */
      /**
       * \u9009\u62e9\u53d1\u751f\u6539\u53d8\u7684\u4e8b\u4ef6
       * @type {String}
       */
      changeEvent : {
        value:'selectedchange'
      },
      /**
       * \u81ea\u52a8\u9690\u85cf
       * @type {Boolean}
       * @override
       */
      autoHide:{
        value : true
      },
      /**
       * \u9690\u85cf\u9009\u62e9\u5668\u7684\u4e8b\u4ef6
       * @protected
       * @type {String}
       */
      hideEvent:{
        value:'itemclick'
      },
      /**
       * \u8fd4\u56de\u7684\u6587\u672c\u653e\u5728\u7684DOM\uff0c\u4e00\u822c\u662finput
       * @cfg {String|HTMLElement|jQuery} textField
       */
      /**
       * \u8fd4\u56de\u7684\u6587\u672c\u653e\u5728\u7684DOM\uff0c\u4e00\u822c\u662finput
       * @type {String|HTMLElement|jQuery}
       */
      textField : {

      },
      align : {
        value : {
           points: ['bl','tl'], // ['tr', 'tl'] \u8868\u793a overlay \u7684 tl \u4e0e\u53c2\u8003\u8282\u70b9\u7684 tr \u5bf9\u9f50
           offset: [0, 0]      // \u6709\u6548\u503c\u4e3a [n, m]
        }
      },
      /**
       * \u8fd4\u56de\u7684\u503c\u653e\u7f6eDOM ,\u4e00\u822c\u662finput
       * @cfg {String|HTMLElement|jQuery} valueField
       */
      /**
       * \u8fd4\u56de\u7684\u503c\u653e\u7f6eDOM ,\u4e00\u822c\u662finput
       * @type {String|HTMLElement|jQuery}
       */
      valueField:{

      }
      /**
       * @event selectedchange
       * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
       * @param {String} text \u9009\u4e2d\u7684\u6587\u672c
       * @param {string} value \u9009\u4e2d\u7684\u503c
       * @param {jQuery} curTrigger \u5f53\u524d\u89e6\u53d1picker\u7684\u5143\u7d20
       */
    }
  },{
    xclass:'picker'
  });

  return picker;
});/**
 * @fileOverview \u5217\u8868\u9879\u7684\u9009\u62e9\u5668
 * @ignore
 */

define('bui/picker/listpicker',['bui/picker/picker','bui/list'],function (require) {

  var List = require('bui/list'),
    Picker = require('bui/picker/picker'),
    /**
     * \u5217\u8868\u9009\u62e9\u5668,xclass = 'list-picker'
     * <pre><code>
     * BUI.use(['bui/picker'],function(Picker){
     *
     * var items = [
     *       {text:'\u9009\u98791',value:'a'},
     *       {text:'\u9009\u98792',value:'b'},
     *      {text:'\u9009\u98793',value:'c'}
     *     ],
     *   picker = new Picker.ListPicker({
     *     trigger : '#show',  
     *     valueField : '#hide', //\u5982\u679c\u9700\u8981\u5217\u8868\u8fd4\u56de\u7684value\uff0c\u653e\u5728\u9690\u85cf\u57df\uff0c\u90a3\u4e48\u6307\u5b9a\u9690\u85cf\u57df
     *     width:100,  //\u6307\u5b9a\u5bbd\u5ea6
     *     children : [{
     *        elCls:'bui-select-list',
     *        items : items
     *     }] //\u914d\u7f6epicker\u5185\u7684\u5217\u8868
     *   });
     * picker.render();
     * });
     * </code></pre>
     * @class BUI.Picker.ListPicker
     * @extends BUI.Picker.Picker
     */
    listPicker = Picker.extend({
      initializer : function(){
        var _self = this,
          children = _self.get('children'),
          list = _self.get('list');
        if(!list){
          children.push({

          });
        }
      },
      /**
       * \u8bbe\u7f6e\u9009\u4e2d\u7684\u503c
       * @override
       * @protected
       * @param {String} val \u8bbe\u7f6e\u503c
       */
      setSelectedValue : function(val){
        val = val ? val.toString() : '';
        var _self = this,
          list = _self.get('list'),
          selectedValue = _self.getSelectedValue();
        if(val !== selectedValue){
          if(list.get('multipleSelect')){
            list.clearSelection();
          }
          list.setSelectionByField(val.split(','));
        }   
      },
      /**
       * @protected
       * @ignore
       */
      onChange : function(selText,selValue,ev){
        var _self = this,
          curTrigger = _self.get('curTrigger');
        _self.fire('selectedchange',{value : selValue,text : selText,curTrigger : curTrigger,item : ev.item});
      },
      /**
       * \u83b7\u53d6\u9009\u4e2d\u7684\u503c\uff0c\u591a\u9009\u72b6\u6001\u4e0b\uff0c\u503c\u4ee5','\u5206\u5272
       * @protected
       * @return {String} \u9009\u4e2d\u7684\u503c
       */
      getSelectedValue : function(){
        return this.get('list').getSelectionValues().join(',');
      },
      /**
       * \u83b7\u53d6\u9009\u4e2d\u9879\u7684\u6587\u672c\uff0c\u591a\u9009\u72b6\u6001\u4e0b\uff0c\u6587\u672c\u4ee5','\u5206\u5272
       * @protected
       * @return {String} \u9009\u4e2d\u7684\u6587\u672c
       */
      getSelectedText : function(){
        return this.get('list').getSelectionText().join(',');
      }
    },{
      ATTRS : {
        /**
         * \u9ed8\u8ba4\u5b50\u63a7\u4ef6\u7684\u6837\u5f0f,\u9ed8\u8ba4\u4e3a'simple-list'
         * @type {String}
         * @override
         */
        defaultChildClass:{
          value : 'simple-list'
        },
        /**
         * \u9009\u62e9\u7684\u5217\u8868
         * <pre><code>
         *  var list = picker.get('list');
         *  list.getSelected();
         * </code></pre>
         * @type {BUI.List.SimpleList}
         * @readOnly
         */
        list : {
          getter:function(){
            return this.get('children')[0];
          }
        }
        /**
         * @event selectedchange
         * \u9009\u62e9\u53d1\u751f\u6539\u53d8\u4e8b\u4ef6
         * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
         * @param {String} e.text \u9009\u4e2d\u7684\u6587\u672c
         * @param {string} e.value \u9009\u4e2d\u7684\u503c
         * @param {Object} e.item \u53d1\u751f\u6539\u53d8\u7684\u9009\u9879
         * @param {jQuery} e.curTrigger \u5f53\u524d\u89e6\u53d1picker\u7684\u5143\u7d20
         */
      }
    },{
      xclass : 'list-picker'
    });

  return listPicker;
});/**
 * @fileOverview form \u547d\u540d\u7a7a\u95f4\u5165\u53e3
 * @ignore
 */
;(function(){
var BASE = 'bui/form/';
define('bui/form',['bui/common',BASE + 'fieldcontainer',BASE + 'form',BASE + 'row',BASE + 'fieldgroup',BASE + 'horizontal',BASE + 'rules',BASE + 'field',BASE + 'fieldgroup'],function (r) {
  var BUI = r('bui/common'),
    Form = BUI.namespace('Form'),
    Tips = r(BASE + 'tips');

  BUI.mix(Form,{
    Tips : Tips,
    TipItem : Tips.Item,
    FieldContainer : r(BASE + 'fieldcontainer'),
    Form : r(BASE + 'form'),
    Row : r(BASE + 'row'),
    Group : r(BASE + 'fieldgroup'),
    HForm : r(BASE + 'horizontal'),
    Rules : r(BASE + 'rules'),
    Field : r(BASE + 'field'),
    FieldGroup : r(BASE + 'fieldgroup')
  });
  return Form;
});
})();
/**
 * @fileOverview \u8f93\u5165\u63d0\u793a\u4fe1\u606f
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/form/tips',['bui/common','bui/overlay'],function (require) {

  var BUI = require('bui/common'),
    prefix = BUI.prefix,
    Overlay = require('bui/overlay').Overlay,
    FIELD_TIP = 'data-tip',
    CLS_TIP_CONTAINER = prefix + 'form-tip-container';

  /**
   * \u8868\u5355\u63d0\u793a\u4fe1\u606f\u7c7b
   * xclass:'form-tip'
   * @class BUI.Form.TipItem
   * @extends BUI.Overlay.Overlay
   */
  var tipItem = Overlay.extend(
  /**
   * @lends BUI.Form.TipItem.prototype
   * @ignore
   */
  {
    initializer : function(){
      var _self = this,
        render = _self.get('render');
      if(!render){
        var parent = $(_self.get('trigger')).parent();
        _self.set('render',parent);
      }
    },
    renderUI : function(){
      var _self = this;

      _self.resetVisible();
      
    },
    /**
     * \u91cd\u7f6e\u662f\u5426\u663e\u793a
     */
    resetVisible : function(){
      var _self = this,
        triggerEl = $(_self.get('trigger'));

      if(triggerEl.val()){//\u5982\u679c\u9ed8\u8ba4\u6709\u6587\u672c\u5219\u4e0d\u663e\u793a\uff0c\u5426\u5219\u663e\u793a
        _self.set('visible',false);
      }else{
        _self.set('align',{
          node:$(_self.get('trigger')),
          points: ['cl','cl']
        });
        _self.set('visible',true);
      }
    },
    bindUI : function(){
      var _self = this,
        triggerEl = $(_self.get('trigger'));

      _self.get('el').on('click',function(){
        _self.hide();
        triggerEl.focus();
      });
      triggerEl.on('click focus',function(){
        _self.hide();
      });

      triggerEl.on('blur',function(){
        _self.resetVisible();
      });
    }
  },{
    ATTRS : 
    /**
     * @lends BUI.Form.TipItem#
     * @ignore
     */
    {
      /**
       * \u63d0\u793a\u7684\u8f93\u5165\u6846 
       * @cfg {String|HTMLElement|jQuery} trigger
       */
      /**
       * \u63d0\u793a\u7684\u8f93\u5165\u6846
       * @type {String|HTMLElement|jQuery}
       */
      trigger:{

      },
      /**
       * \u63d0\u793a\u6587\u672c
       * @cfg {String} text
       */
      /**
       * \u63d0\u793a\u6587\u672c
       * @type {String}
       */
      text : {

      },
      /**
       * \u63d0\u793a\u6587\u672c\u4e0a\u663e\u793a\u7684icon\u6837\u5f0f
       * @cfg {String} iconCls
       *     iconCls : icon-ok
       */
      /**
       * \u63d0\u793a\u6587\u672c\u4e0a\u663e\u793a\u7684icon\u6837\u5f0f
       * @type {String}
       *     iconCls : icon-ok
       */
      iconCls:{

      },
      /**
       * \u9ed8\u8ba4\u7684\u6a21\u7248
       * @type {String}
       * @default '<span class="{iconCls}"></span><span class="tip-text">{text}</span>'
       */
      tpl:{
        value:'<span class="{iconCls}"></span><span class="tip-text">{text}</span>'
      }
    }
  },{
    xclass : 'form-tip'
  });

  /**
   * \u8868\u5355\u63d0\u793a\u4fe1\u606f\u7684\u7ba1\u7406\u7c7b
   * @class BUI.Form.Tips
   * @extends BUI.Base
   */
  var Tips = function(config){
    if (this.constructor !== Tips){
      return new Tips(config);
    }

    Tips.superclass.constructor.call(this,config);
    this._init();
  };

  Tips.ATTRS = 
  /**
   * @lends BUI.Form.Tips
   * @ignore
   */
  {

    /**
     * \u8868\u5355\u7684\u9009\u62e9\u5668
     * @cfg {String|HTMLElement|jQuery} form
     */
    /**
     * \u8868\u5355\u7684\u9009\u62e9\u5668
     * @type {String|HTMLElement|jQuery}
     */
    form : {

    },
    /**
     * \u8868\u5355\u63d0\u793a\u9879\u5bf9\u8c61 {@link BUI.Form.TipItem}
     * @readOnly
     * @type {Array} 
     */
    items : {
      value:[]
    }
  };

  BUI.extend(Tips,BUI.Base);

  BUI.augment(Tips,{
    _init : function(){
      var _self = this,
        form = $(_self.get('form'));
      if(form.length){
        BUI.each($.makeArray(form[0].elements),function(elem){
          var tipConfig = $(elem).attr(FIELD_TIP);
          if(tipConfig){
            _self._initFormElement(elem,$.parseJSON(tipConfig));
          }
        });
        form.addClass(CLS_TIP_CONTAINER);
      }
    },
    _initFormElement : function(element,config){
      if(config){
        config.trigger = element;
        //config.render = this.get('form');
      }
      var _self = this,
        items = _self.get('items'),
        item = new tipItem(config);
      items.push(item);
    },
    /**
     * \u83b7\u53d6\u63d0\u793a\u9879
     * @param {String} name \u5b57\u6bb5\u7684\u540d\u79f0
     * @return {BUI.Form.TipItem} \u63d0\u793a\u9879
     */
    getItem : function(name){
      var _self = this,
        items = _self.get('items'),
        result = null;
      BUI.each(items,function(item){

        if($(item.get('trigger')).attr('name') === name){
          result = item;
          return false;
        }

      });

      return result;
    },
    /**
     * \u91cd\u7f6e\u6240\u6709\u63d0\u793a\u7684\u53ef\u89c6\u72b6\u6001
     */
    resetVisible : function(){
      var _self = this,
        items = _self.get('items');

      BUI.each(items,function(item){
        item.resetVisible();
      });
    },
    /**
     * \u751f\u6210 \u8868\u5355\u63d0\u793a
     */
    render:function(){
       var _self = this,
        items = _self.get('items');
      BUI.each(items,function(item){
        item.render();
      });
    },
    /**
     * \u5220\u9664\u6240\u6709\u63d0\u793a
     */
    destroy:function(){
      var _self = this,
        items = _self.get(items);

      BUI.each(items,function(item){
        item.destroy();
      });
    }
  });
  
  Tips.Item = tipItem;
  return Tips;

});/**
 * @fileOverview \u8868\u5355\u5143\u7d20
 * @ignore
 */

define('bui/form/basefield',['bui/common','bui/form/tips','bui/form/valid','bui/form/remote'],function (require){

  var BUI = require('bui/common'),
    Component = BUI.Component,
    TipItem = require('bui/form/tips').Item,
    Valid = require('bui/form/valid'),
    Remote = require('bui/form/remote'),
    CLS_FIELD_ERROR = BUI.prefix + 'form-field-error',
    DATA_ERROR = 'data-error';

  /**
   * \u5b57\u6bb5\u89c6\u56fe\u7c7b
   * @class BUI.Form.FieldView
   * @private
   */
  var fieldView = Component.View.extend([Remote.View,Valid.View],{
    //\u6e32\u67d3DOM
    renderUI : function(){
      var _self = this,
        control = _self.get('control');
      if(!control){
        var controlTpl = _self.get('controlTpl'),
          container = _self.getControlContainer();
          
        if(controlTpl){
          var control = $(controlTpl).appendTo(container);
          _self.set('control',control);
        }
      }else{
        //var controlContainer = control.parent();
        _self.set('controlContainer',control.parent());
      }
    },
    /**
     * \u6e05\u7406\u663e\u793a\u7684\u9519\u8bef\u4fe1\u606f
     * @protected
     */
    clearErrors : function(){
      var _self = this,
        msgEl = _self.get('msgEl');
      if(msgEl){
        msgEl.remove();
        _self.set('msgEl',null);
      }
      _self.get('el').removeClass(CLS_FIELD_ERROR);
    },
    /**
     * \u663e\u793a\u9519\u8bef\u4fe1\u606f
     * @param {String} msg \u9519\u8bef\u4fe1\u606f
     * @protected
     */
    showError : function(msg,errorTpl){
      var _self = this,
        control = _self.get('control'),
        errorMsg = BUI.substitute(errorTpl,{error : msg}),
        el = $(errorMsg);
      //_self.clearErrorMsg();
      
      el.appendTo(control.parent());
      _self.set('msgEl',el);
      _self.get('el').addClass(CLS_FIELD_ERROR);
    },
    /**
     * @internal \u83b7\u53d6\u63a7\u4ef6\u7684\u5bb9\u5668
     * @return {jQuery} \u63a7\u4ef6\u5bb9\u5668
     */
    getControlContainer : function(){
      var _self = this,
        el = _self.get('el'),
        controlContainer = _self.get('controlContainer');
      if(controlContainer){
        if(BUI.isString(controlContainer)){
          return el.find(controlContainer);
        }
        return controlContainer;
      }
      return el;
    },
    /**
     * \u83b7\u53d6\u663e\u793a\u52a0\u8f7d\u72b6\u6001\u7684\u5bb9\u5668
     * @protected
     * @override
     * @return {jQuery} \u52a0\u8f7d\u72b6\u6001\u7684\u5bb9\u5668
     */
    getLoadingContainer : function () {
      return this.getControlContainer();
    },
    //\u8bbe\u7f6e\u540d\u79f0
    _uiSetName : function(v){
      var _self = this;
      _self.get('control').attr('name',v);
    }
  },
  {
    ATTRS : {
      error:{},
      controlContainer : {},
      msgEl: {},
      control : {}
    }
  });

  /**
   * \u8868\u5355\u5b57\u6bb5\u57fa\u7c7b
   * @class BUI.Form.Field
   * @mixins BUI.Form.Remote
   * @extends BUI.Component.Controller
   */
  var field = Component.Controller.extend([Remote,Valid],{

    initializer : function(){
      var _self = this;
      _self.on('afterRenderUI',function(){
        var tip = _self.get('tip');
        if(tip){
          tip.trigger = _self.getTipTigger();
          tip.autoRender = true;
          tip = new TipItem(tip);
          _self.set('tip',tip);
        }
      });
    },
    //\u7ed1\u5b9a\u4e8b\u4ef6
    bindUI : function(){
      var _self = this,
        validEvent = _self.get('validEvent'),
        changeEvent = _self.get('changeEvent'),
        innerControl = _self.getInnerControl();

      //\u9009\u62e9\u6846\u53ea\u4f7f\u7528 select\u4e8b\u4ef6
      if(innerControl.is('select')){
        validEvent = 'change';
      }
      //\u9a8c\u8bc1\u4e8b\u4ef6
      innerControl.on(validEvent,function(){
        var value = _self.getControlValue(innerControl);
        _self.validControl(value);
      });
      //\u672a\u53d1\u751f\u9a8c\u8bc1\u65f6\uff0c\u9996\u6b21\u83b7\u53d6\u7126\u70b9\uff0c\u8fdb\u884c\u9a8c\u8bc1
      innerControl.on('focus',function(){
        if(!_self.get('hasValid')){
          var value = _self.getControlValue(innerControl);
          _self.validControl(value);
        }
      });

      //\u672c\u6765\u662f\u76d1\u542c\u63a7\u4ef6\u7684change\u4e8b\u4ef6\uff0c\u4f46\u662f\uff0c\u5982\u679c\u63a7\u4ef6\u8fd8\u672a\u89e6\u53d1change,\u4f46\u662f\u901a\u8fc7get('value')\u6765\u53d6\u503c\uff0c\u5219\u4f1a\u51fa\u73b0\u9519\u8bef\uff0c
      //\u6240\u4ee5\u5f53\u901a\u8fc7\u9a8c\u8bc1\u65f6\uff0c\u5373\u89e6\u53d1\u6539\u53d8\u4e8b\u4ef6
      _self.on(changeEvent,function(){
        _self.onValid();
      });

      _self.on('remotecomplete',function (ev) {
        _self._setError(ev.error);
      });

    },
    /**
     * \u9a8c\u8bc1\u6210\u529f\u540e\u6267\u884c\u7684\u64cd\u4f5c
     * @protected
     */
    onValid : function(){
      var _self = this,
        value =  _self.getControlValue();

      value = _self.parseValue(value);
      if(!_self.isCurrentValue(value)){
        _self.setInternal('value',value);
        _self.onChange();
      }
    },
    onChange : function () {
      this.fire('change');
    },
    /**
     * @protected
     * \u662f\u5426\u5f53\u524d\u503c\uff0c\u4e3b\u8981\u7528\u4e8e\u65e5\u671f\u7b49\u7279\u6b8a\u503c\u7684\u6bd4\u8f83\uff0c\u4e0d\u80fd\u7528 == \u8fdb\u884c\u6bd4\u8f83
     * @param  {*}  value \u8fdb\u884c\u6bd4\u8f83\u7684\u503c
     * @return {Boolean}  \u662f\u5426\u5f53\u524d\u503c
     */
    isCurrentValue : function (value) {
      return value == this.get('value');
    },
    //\u6e05\u7406\u9519\u8bef\u4fe1\u606f
    _clearError : function(){
      this.set('error',null);
      this.get('view').clearErrors();
    },
    //\u8bbe\u7f6e\u9519\u8bef\u4fe1\u606f
    _setError : function(msg){
      this.set('error',msg);
      this.showErrors();
    },

    /**
     * \u83b7\u53d6\u5185\u90e8\u8868\u5355\u5143\u7d20\u7684\u503c
     * @protected
     * @param  {jQuery} [innerControl] \u5185\u90e8\u8868\u5355\u5143\u7d20
     * @return {String|Boolean} \u8868\u5355\u5143\u7d20\u7684\u503c,checkbox\uff0cradio\u7684\u8fd4\u56de\u503c\u4e3a true,false
     */
    getControlValue : function(innerControl){
      var _self = this;
      innerControl = innerControl || _self.getInnerControl();
      return innerControl.val();
    },
    /**
     * @protected
     * \u83b7\u53d6\u5185\u90e8\u63a7\u4ef6\u7684\u5bb9\u5668
     */
    getControlContainer : function(){
      return this.get('view').getControlContainer();
    },
    /**
     * \u83b7\u53d6\u5f02\u6b65\u9a8c\u8bc1\u7684\u53c2\u6570\uff0c\u5bf9\u4e8e\u8868\u5355\u5b57\u6bb5\u57df\u800c\u8a00\uff0c\u662f{[name] : [value]}
     * @protected
     * @override
     * @return {Object} \u53c2\u6570\u952e\u503c\u5bf9
     */
    getRemoteParams : function  () {
      var _self = this,
        rst = {};
      rst[_self.get('name')] = _self.get('value');
      return rst;
    },
    /**
     * \u8bbe\u7f6e\u5b57\u6bb5\u7684\u503c
     * @protected
     * @param {*} value \u5b57\u6bb5\u503c
     */
    setControlValue : function(value){
      var _self = this,
        innerControl = _self.getInnerControl();
      innerControl.val(value);
    },
    /**
     * \u5c06\u5b57\u7b26\u4e32\u7b49\u683c\u5f0f\u8f6c\u6362\u6210
     * @protected
     * @param  {String} value \u539f\u59cb\u6570\u636e
     * @return {*}  \u8be5\u5b57\u6bb5\u6307\u5b9a\u7684\u7c7b\u578b
     */
    parseValue : function(value){
      return value;
    },
    valid : function(){
      var _self = this;
      _self.validControl();
    },
    /**
     * \u9a8c\u8bc1\u63a7\u4ef6\u5185\u5bb9
     * @return {Boolean} \u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
     */
    validControl : function(value){
      var _self = this, 
        errorMsg;
        value = value || _self.getControlValue(),
        preError = _self.get('error');
      errorMsg = _self.getValidError(value);
      _self.setInternal('hasValid',true);
      if (errorMsg) {
          _self._setError(errorMsg);
          _self.fire('error', {msg:errorMsg, value:value});
          if(preError !== errorMsg){//\u9a8c\u8bc1\u9519\u8bef\u4fe1\u606f\u6539\u53d8\uff0c\u8bf4\u660e\u9a8c\u8bc1\u6539\u53d8
            _self.fire('validchange',{ valid : false });
          }
      } else {
          _self._clearError();
          _self.fire('valid');
          if(preError){//\u5982\u679c\u4ee5\u524d\u5b58\u5728\u9519\u8bef\uff0c\u90a3\u4e48\u9a8c\u8bc1\u7ed3\u679c\u6539\u53d8
            _self.fire('validchange',{ valid : true });
          }
      }
      
      return !errorMsg;
    },
    /**
     * \u5b57\u6bb5\u83b7\u5f97\u7126\u70b9
     */
    focus : function(){
      this.getInnerControl().focus();
    },
    /**
     * \u5b57\u6bb5\u53d1\u751f\u6539\u53d8
     */
    change : function(){
      var control = this.getInnerControl();
      control.change();
    },
    /**
     * \u5b57\u6bb5\u4e22\u5931\u7126\u70b9
     */
    blur : function(){
      this.getInnerControl().blur();
    },

    /**
     * \u662f\u5426\u901a\u8fc7\u9a8c\u8bc1,\u5982\u679c\u672a\u53d1\u751f\u8fc7\u6821\u9a8c\uff0c\u5219\u8fdb\u884c\u6821\u9a8c\uff0c\u5426\u5219\u4e0d\u8fdb\u884c\u6821\u9a8c\uff0c\u76f4\u63a5\u6839\u636e\u5df2\u6821\u9a8c\u7684\u7ed3\u679c\u5224\u65ad\u3002
     * @return {Boolean} \u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
     */
    isValid : function(){
      var _self = this;
      if(!_self.get('hasValid')){
        _self.validControl();
      }
      return !_self.get('error');
    },
    /**
     * \u83b7\u53d6\u9a8c\u8bc1\u51fa\u9519\u4fe1\u606f
     * @return {String} \u51fa\u9519\u4fe1\u606f
     */
    getError : function(){
      return this.get('error');
    },
    /**
     * \u83b7\u53d6\u9a8c\u8bc1\u51fa\u9519\u4fe1\u606f\u96c6\u5408
     * @return {Array} \u51fa\u9519\u4fe1\u606f\u96c6\u5408
     */
    getErrors : function(){
      var error = this.getError();
      if(error){
        return [error];
      }
      return [];
    },
    /**
     * \u6e05\u7406\u51fa\u9519\u4fe1\u606f\uff0c\u56de\u6eda\u5230\u672a\u51fa\u9519\u72b6\u6001
     */
    clearErrors : function(){
      var _self = this;
      _self._clearError();
      if(_self.getControlValue()!= _self.get('value')){
        _self.setControlValue(_self.get('value'));
      }
    },
    /**
     * \u83b7\u53d6\u5185\u90e8\u7684\u8868\u5355\u5143\u7d20\u6216\u8005\u5185\u90e8\u63a7\u4ef6
     * @protected
     * @return {jQuery|BUI.Component.Controller} 
     */
    getInnerControl : function(){
      return this.get('view').get('control');
    },
    /**
     * \u63d0\u793a\u4fe1\u606f\u6309\u7167\u6b64\u5143\u7d20\u5bf9\u9f50
     * @protected
     * @return {HTMLElement}
     */
    getTipTigger : function(){
      return this.getInnerControl();
    },
    //\u6790\u6784\u51fd\u6570
    destructor : function(){
      var _self = this,
        tip = _self.get('tip');
      if(tip && tip.destroy){
        tip.destroy();
      }
    },
    /**
     * @protected
     * \u8bbe\u7f6e\u5185\u90e8\u5143\u7d20\u5bbd\u5ea6
     */
    setInnerWidth : function(width){
      var _self = this,
        innerControl = _self.getInnerControl(),
        appendWidth = innerControl.outerWidth() - innerControl.width();
      innerControl.width(width - appendWidth);
    },
    //\u91cd\u7f6e \u63d0\u793a\u4fe1\u606f\u662f\u5426\u53ef\u89c1
    _resetTip :function(){
      var _self = this,
        tip = _self.get('tip');
      if(tip){
        tip.resetVisible();
      }
    },
    /**
     * \u91cd\u7f6e\u663e\u793a\u63d0\u793a\u4fe1\u606f
     * field.resetTip();
     */
    resetTip : function(){
      this._resetTip();
    },
    //\u8bbe\u7f6e\u503c
    _uiSetValue : function(v){
      var _self = this;
      //v = v ? v.toString() : '';
      _self.setControlValue(v);
      if(_self.get('rendered')){
        _self.validControl();
        _self.onChange();
      } 
      _self._resetTip();
    },
    //\u7981\u7528\u63a7\u4ef6
    _uiSetDisabled : function(v){
      var _self = this,
        innerControl = _self.getInnerControl();
      innerControl.attr('disabled',v);
      if(_self.get('rendered')){
        if(v){//\u63a7\u4ef6\u4e0d\u53ef\u7528\uff0c\u6e05\u9664\u9519\u8bef
          _self.clearErrors();
        }
        if(!v){//\u63a7\u4ef6\u53ef\u7528\uff0c\u6267\u884c\u91cd\u65b0\u9a8c\u8bc1
          _self.valid();
        }
      }
    },
    _uiSetWidth : function(v){
      var _self = this;
      if(v != null && _self.get('forceFit')){
        _self.setInnerWidth(v);
      }
    }
  },{
    ATTRS : {
      /**
       * \u662f\u5426\u53d1\u751f\u8fc7\u6821\u9a8c\uff0c\u521d\u59cb\u503c\u4e3a\u7a7a\u65f6\uff0c\u672a\u8fdb\u884c\u8d4b\u503c\uff0c\u4e0d\u8fdb\u884c\u6821\u9a8c
       * @type {Boolean}
       */
      hasValid : {
        value : false
      },
      /**
       * \u5185\u90e8\u5143\u7d20\u662f\u5426\u6839\u636e\u63a7\u4ef6\u5bbd\u5ea6\u8c03\u6574\u5bbd\u5ea6
       * @type {Boolean}
       */
      forceFit : {
        value : false
      },
      /**
       * \u662f\u5426\u663e\u793a\u63d0\u793a\u4fe1\u606f
       * @type {Object}
       */
      tip : {

      },
      /**
       * \u8868\u5355\u5143\u7d20\u6216\u8005\u63a7\u4ef6\u5185\u5bb9\u6539\u53d8\u7684\u4e8b\u4ef6
       * @type {String}
       */
      changeEvent : {
        value : 'valid'
      },
      /**
       * \u8868\u5355\u5143\u7d20\u6216\u8005\u63a7\u4ef6\u89e6\u53d1\u6b64\u4e8b\u4ef6\u65f6\uff0c\u89e6\u53d1\u9a8c\u8bc1
       * @type {String}
       */
      validEvent : {
        value : 'keyup change'
      },
      /**
       * \u5b57\u6bb5\u7684name\u503c
       * @type {Object}
       */
      name : {
        view :true
      },
      /**
       * \u662f\u5426\u663e\u793a\u9519\u8bef
       * @type {Boolean}
       */
      showError : {
        view : true,
        value : true
      },
      /**
       * \u5b57\u6bb5\u7684\u503c,\u7c7b\u578b\u6839\u636e\u5b57\u6bb5\u7c7b\u578b\u51b3\u5b9a
       * @cfg {*} value
       */
      value : {
        view : true
      },
      /**
       * \u6807\u9898
       * @type {String}
       */
      label : {

      },
      /**
       * \u63a7\u4ef6\u5bb9\u5668\uff0c\u5982\u679c\u4e3a\u7a7a\u76f4\u63a5\u6dfb\u52a0\u5728\u63a7\u4ef6\u5bb9\u5668\u4e0a
       * @type {String|HTMLElement}
       */
      controlContainer : {
        view : true
      },
      /**
       * \u5185\u90e8\u8868\u5355\u5143\u7d20\u7684\u63a7\u4ef6
       * @protected
       * @type {jQuery}
       */
      control : {
        view : true
      },
      /**
       * \u5185\u90e8\u8868\u5355\u5143\u7d20\u7684\u5bb9\u5668
       * @type {String}
       */
      controlTpl : {
        view : true,
        value : '<input type="text"/>'
      },
      events: {
        value : {
          /**
           * \u672a\u901a\u8fc7\u9a8c\u8bc1
           * @event
           */
          error : false,
          /**
           * \u901a\u8fc7\u9a8c\u8bc1
           * @event
           */
          valid : false,
          /**
           * @event
           * \u503c\u6539\u53d8\uff0c\u4ec5\u5f53\u901a\u8fc7\u9a8c\u8bc1\u65f6\u89e6\u53d1
           */
          change : true,

          /**
           * @event
           * \u9a8c\u8bc1\u6539\u53d8
           * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
           * @param {Object} e.target \u89e6\u53d1\u4e8b\u4ef6\u7684\u5bf9\u8c61
           * @param {Boolean} e.valid \u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
           */
          validchange : true
        }  
      },
      tpl: {
        value : '<label>{label}</label>'
      },
      xview : {
        value : fieldView 
      }
    },
    PARSER : {
      control : function(el){
        var control = el.find('input,select,textarea');
        if(control.length){
          return control;
        }
        return el;
      },
      disabled : function(el){
        return !!el.attr('disabled');
      },
      value : function(el){
        var _self = this,
          value = _self.get('value');
        if(!value){
          value = el.val()
        }
        return  value;
      }
    }
  },{
    xclass:'form-field'
  });

  field.View = fieldView;
  
  return field;

});/**
 * @fileOverview \u8868\u5355\u6587\u672c\u57df
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/form/textfield',['bui/form/basefield'],function (require) {
  var Field = require('bui/form/basefield');

  /**
   * \u8868\u5355\u6587\u672c\u57df
   * @class BUI.Form.Field.Text
   * @extends BUI.Form.Field
   */
  var textField = Field.extend({

  },{
    xclass : 'form-field-text'
  });

  return textField;
});/**
 * @fileOverview \u8868\u5355\u6587\u672c\u57df
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/form/numberfield',['bui/form/basefield'],function (require) {

  /**
   * \u8868\u5355\u6570\u5b57\u57df
   * @class BUI.Form.Field.Number
   * @extends BUI.Form.Field
   */
  var Field = require('bui/form/basefield'),
    numberField = Field.extend({

     /**
     * \u5c06\u5b57\u7b26\u4e32\u7b49\u683c\u5f0f\u8f6c\u6362\u6210\u6570\u5b57
     * @protected
     * @param  {String} value \u539f\u59cb\u6570\u636e
     * @return {Number}  \u8be5\u5b57\u6bb5\u6307\u5b9a\u7684\u7c7b\u578b
     */
    parseValue : function(value){
      if(value == '' || value == null){
        return null;
      }
      if(BUI.isNumber(value)){
        return value;
      }
      var _self = this,
        allowDecimals = _self.get('allowDecimals');
      value = value.replace(/\,/g,'');
      if(!allowDecimals){
        return parseInt(value);
      }
      return parseFloat(parseFloat(value).toFixed(_self.get('decimalPrecision')));
    },
    _uiSetMax : function(v){
      this.addRule('max',v);
    },
    _uiSetMin : function(v){
      this.addRule('min',v);
    }
  },{
    ATTRS : {
      /**
       * \u6700\u5927\u503c
       * @type {Number}
       */
      max : {

      },
      /**
       * \u6700\u5c0f\u503c
       * @type {Number}
       */
      min : {

      },
      decorateCfgFields : {
        value : {
          min : true,
          max : true
        }
      },
      /**
       * \u8868\u5355\u5143\u7d20\u6216\u8005\u63a7\u4ef6\u89e6\u53d1\u6b64\u4e8b\u4ef6\u65f6\uff0c\u89e6\u53d1\u9a8c\u8bc1
       * @type {String}
       */
      validEvent : {
        value : 'keyup change'
      },
      defaultRules : {
        value : {
          number : true
        }
      },
      /**
       * \u662f\u5426\u5141\u8bb8\u5c0f\u6570\uff0c\u5982\u679c\u4e0d\u5141\u8bb8\uff0c\u5219\u6700\u7ec8\u7ed3\u679c\u8f6c\u6362\u6210\u6574\u6570
       * @type {Boolean}
       */
      allowDecimals : {
        value : true
      },
      /**
       * \u5141\u8bb8\u5c0f\u6570\u65f6\u7684\uff0c\u5c0f\u6570\u4f4d
       * @type {Number}
       */
      decimalPrecision : {
        value : 2
      },
      /**
       * \u5bf9\u6570\u5b57\u8fdb\u884c\u5fae\u8c03\u65f6\uff0c\u6bcf\u6b21\u589e\u52a0\u6216\u51cf\u5c0f\u7684\u6570\u5b57
       * @type {Object}
       */
      step : {
        value : 1
      }
    }
  },{
    xclass : 'form-field-number'
  });

  return numberField;
});/**
* @fileOverview \u9690\u85cf\u5b57\u6bb5
* @ignore
* @author dxq613@gmail.com
*/

define('bui/form/hiddenfield',['bui/form/basefield'],function (require) {
  var Field = require('bui/form/basefield');
  /**
   * \u8868\u5355\u9690\u85cf\u57df
   * @class BUI.Form.Field.Hidden
   * @extends BUI.Form.Field
   */
  var hiddenField = Field.extend({

  },{
    ATTRS : {
      /**
       * \u5185\u90e8\u8868\u5355\u5143\u7d20\u7684\u5bb9\u5668
       * @type {String}
       */
      controlTpl : {
        value : '<input type="hidden"/>'
      },
      tpl : {
        value : ''
      }
    }
  },{
    xclass : 'form-field-hidden'
  });

  return hiddenField;

});/**
* @fileOverview \u53ea\u8bfb\u5b57\u6bb5
* @ignore
* @author dxq613@gmail.com
*/

define('bui/form/readonlyfield',['bui/form/basefield'],function (require) {
  var Field = require('bui/form/basefield');
  /**
   * \u8868\u5355\u9690\u85cf\u57df
   * @class BUI.Form.Field.ReadOnly
   * @extends BUI.Form.Field
   */
  var readonlyField = Field.extend({

  },{
    ATTRS : {
      /**
       * \u5185\u90e8\u8868\u5355\u5143\u7d20\u7684\u5bb9\u5668
       * @type {String}
       */
      controlTpl : {
        value : '<input type="text" readonly="readonly"/>'
      }
    }
  },{
    xclass : 'form-field-readonly'
  });

  return readonlyField;

});/**
 * @fileOverview \u6a21\u62df\u9009\u62e9\u6846\u5728\u8868\u5355\u4e2d
 * @ignore
 */

define('bui/form/selectfield',['bui/common','bui/form/basefield'],function (require) {

  var BUI = require('bui/common'),
    Field = require('bui/form/basefield');

  function resetOptions (select,options,self) {
    select.children().remove();
    var emptyText = self.get('emptyText');
    if(emptyText){
      appendItem('',emptyText,select);
    }
    BUI.each(options,function (option) {
      appendItem(option.value,option.text,select);
    });
  }

  function appendItem(value,text,select){
     var str = '<option value="' + value +'">'+text+'</option>'
    $(str).appendTo(select);
  }
  /**
   * \u8868\u5355\u9009\u62e9\u57df
   * @class BUI.Form.Field.Select
   * @extends BUI.Form.Field
   */
  var selectField = Field.extend({
    //\u751f\u6210select
    renderUI : function(){
      var _self = this,
        innerControl = _self.getInnerControl(),
        select = _self.get('select');
      if(_self.get('srcNode') && innerControl.is('select')){ //\u5982\u679c\u4f7f\u7528\u73b0\u6709DOM\u751f\u6210\uff0c\u4e0d\u4f7f\u7528\u81ea\u5b9a\u4e49\u9009\u62e9\u6846\u63a7\u4ef6
        return;
      }
      //select = select || {};
      if($.isPlainObject(select)){
        _self._initSelect(select);
      }
    },
    _initSelect : function(select){
      var _self = this,
        items = _self.get('items');
      BUI.use('bui/select',function(Select){
        select.render = _self.getControlContainer();
        select.valueField = _self.getInnerControl();
        select.autoRender = true;
        if(items){
          select.items = items;
        }
        select = new Select.Select(select);
        _self.set('select',select);
        _self.set('isCreate',true);
        _self.get('children').push(select);
        select.on('change',function(ev){
          var val = select.getSelectedValue();
          _self.set('value',val);
        });
      })
    },
    /**
     * \u91cd\u65b0\u8bbe\u7f6e\u9009\u9879\u96c6\u5408
     * @param {Array} items \u9009\u9879\u96c6\u5408
     */
    setItems : function (items) {
      var _self = this,
        select = _self.get('select');

      if($.isPlainObject(items)){
        var tmp = [];
        BUI.each(items,function(v,n){
          tmp.push({value : n,text : v});
        });
        items = tmp;
      }
      if(select && !_self.get('srcNode')){
        if(select.set){
          select.set('items',items);
        }else{
          select.items = items;
        }
      }else{
        var control = _self.getInnerControl();
        if(control.is('select')){
          resetOptions(control,items,_self);
        }
        _self.setControlValue(_self.get('value'));
        if(!_self.getControlValue()){
          _self.setInternal('value','');
        }
      }
    },
    /**
     * \u8bbe\u7f6e\u5b57\u6bb5\u7684\u503c
     * @protected
     * @param {*} value \u5b57\u6bb5\u503c
     */
    setControlValue : function(value){
      var _self = this,
        select = _self.get('select'),
        innerControl = _self.getInnerControl();
      innerControl.val(value);
      if(select && select.set &&  select.getSelectedValue() !== value){
        select.setSelectedValue(value);
      }
    },
    /**
     * \u83b7\u53d6tip\u663e\u793a\u5bf9\u5e94\u7684\u5143\u7d20
     * @protected
     * @override
     * @return {HTMLElement} 
     */
    getTipTigger : function(){
      var _self = this,
        select = _self.get('select');
      if(select && select.rendered){
        return select.get('el').find('input');
      }
      return _self.get('el');
    },
    //\u8bbe\u7f6e\u9009\u9879
    _uiSetItems : function(v){
      if(v){
        this.setItems(v);
      }
    },
    /**
     * @protected
     * \u8bbe\u7f6e\u5185\u90e8\u5143\u7d20\u5bbd\u5ea6
     */
    setInnerWidth : function(width){
      var _self = this,
        innerControl = _self.getInnerControl(),
        select = _self.get('select'),
        appendWidth = innerControl.outerWidth() - innerControl.width();
      innerControl.width(width - appendWidth);
      if(select && select.set){
        select.set('width',width);
      }
    }
  },{
    ATTRS : {
      /**
       * \u9009\u9879
       * @type {Array}
       */
      items : {

      },
      /**
       * \u5185\u90e8\u8868\u5355\u5143\u7d20\u7684\u5bb9\u5668
       * @type {String}
       */
      controlTpl : {
        value : '<input type="hidden"/>'
      },
      /**
       * \u662f\u5426\u663e\u793a\u4e3a\u7a7a\u7684\u6587\u672c
       * @type {Boolean}
       */
      showBlank : {
        value : true
      },
      /**
       * \u9009\u62e9\u4e3a\u7a7a\u65f6\u7684\u6587\u672c
       * @type {String}
       */
      emptyText : {
        value : '\u8bf7\u9009\u62e9'
      },
      select : {
        value : {}
      }
    },
    PARSER : {
      emptyText : function(el){
        if(!this.get('showBlank')){
          return '';
        }
        var options = el.find('option'),
          rst = this.get('emptyText');
        if(options.length){
          rst = $(options[0]).text();
        }
        return rst;
      },
      value : function(el){
        var _self = this,
          value = _self.get('value');
        if(!value){
          if(el.is('select')){
            value = el.val();
          }else{
            value = el.find('input').val(); 
          }
          
        }
        return  value;
      }
    }
  },{
    xclass : 'form-field-select'
  });

  return selectField;
});/**
 * @fileOverview \u8868\u5355\u65e5\u5386\u57df
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/form/datefield',['bui/common','bui/form/basefield','bui/calendar'],function (require) {

  var BUI = require('bui/common'),
    Field = require('bui/form/basefield'),
    DateUtil = BUI.Date,
    DatePicker = require('bui/calendar').DatePicker;

  /**
   * \u8868\u5355\u6587\u672c\u57df
   * @class BUI.Form.Field.Date
   * @extends BUI.Form.Field
   */
  var dateField = Field.extend({
    //\u751f\u6210\u65e5\u671f\u63a7\u4ef6
    renderUI : function(){
      
      var _self = this,
        datePicker = _self.get('datePicker');
      if($.isPlainObject(datePicker)){
        datePicker.trigger = _self.getInnerControl();
        datePicker.autoRender = true;
        datePicker = new DatePicker(datePicker);
        _self.set('datePicker',datePicker);
        _self.set('isCreatePicker',true);
        _self.get('children').push(datePicker);
      }
      if(datePicker.get('showTime')){
        _self.getInnerControl().addClass('calendar-time');
      }

    },
    bindUI : function(){
      var _self = this,
        datePicker = _self.get('datePicker');
      datePicker.on('selectedchange',function(ev){
        var curTrigger = ev.curTrigger;
        if(curTrigger[0] == _self.getInnerControl()[0]){
          _self.set('value',ev.value);
        }
      });
    },
    /**
     * \u8bbe\u7f6e\u5b57\u6bb5\u7684\u503c
     * @protected
     * @param {Date} value \u5b57\u6bb5\u503c
     */
    setControlValue : function(value){
      var _self = this,
        innerControl = _self.getInnerControl();
      if(BUI.isDate(value)){
        value = DateUtil.format(value,_self._getFormatMask());
      }
      innerControl.val(value);
    },
    //\u83b7\u53d6\u683c\u5f0f\u5316\u51fd\u6570
    _getFormatMask : function(){
      var _self = this,
        datePicker = _self.get('datePicker');

      if(datePicker.get('showTime')){
        return 'yyyy-mm-dd HH:MM:ss';
      }
      return 'yyyy-mm-dd';
    },
     /**
     * \u5c06\u5b57\u7b26\u4e32\u7b49\u683c\u5f0f\u8f6c\u6362\u6210\u65e5\u671f
     * @protected
     * @override
     * @param  {String} value \u539f\u59cb\u6570\u636e
     * @return {Date}  \u8be5\u5b57\u6bb5\u6307\u5b9a\u7684\u7c7b\u578b
     */
    parseValue : function(value){
      if(BUI.isNumber(value)){
        return new Date(value);
      }
      return DateUtil.parse(value);
    },
    /**
     * @override
     * @protected
     * \u662f\u5426\u5f53\u524d\u503c
     */
    isCurrentValue : function (value) {
      return DateUtil.isEquals(value,this.get('value'));
    },
    //\u8bbe\u7f6e\u6700\u5927\u503c
    _uiSetMax : function(v){
      this.addRule('max',v);
      var _self = this,
        datePicker = _self.get('datePicker');
      if(datePicker && datePicker.set){
        datePicker.set('maxDate',v);
      }
    },
    //\u8bbe\u7f6e\u6700\u5c0f\u503c
    _uiSetMin : function(v){
      this.addRule('min',v);
      var _self = this,
        datePicker = _self.get('datePicker');
      if(datePicker && datePicker.set){
        datePicker.set('minDate',v);
      }
    }
  },{
    ATTRS : {
      /**
       * \u5185\u90e8\u8868\u5355\u5143\u7d20\u7684\u5bb9\u5668
       * @type {String}
       */
      controlTpl : {
        value : '<input type="text" class="calendar"/>'
      },
      defaultRules : {
        value : {
          date : true
        }
      },
      /**
       * \u6700\u5927\u503c
       * @type {Date|String}
       */
      max : {

      },
      /**
       * \u6700\u5c0f\u503c
       * @type {Date|String}
       */
      min : {

      },
      value : {
        setter : function(v){
          if(BUI.isNumber(v)){//\u5c06\u6570\u5b57\u8f6c\u6362\u6210\u65e5\u671f\u7c7b\u578b
            return new Date(v);
          }
          return v;
        }
      },
      /**
       * \u65f6\u95f4\u9009\u62e9\u63a7\u4ef6
       * @type {Object|BUI.Calendar.DatePicker}
       */
      datePicker : {
        value : {
          
        }
      },
      /**
       * \u65f6\u95f4\u9009\u62e9\u5668\u662f\u5426\u662f\u7531\u6b64\u63a7\u4ef6\u521b\u5efa
       * @type {Boolean}
       * @readOnly
       */
      isCreatePicker : {
        value : true
      }
    },
    PARSER : {
      datePicker : function(el){
        if(el.hasClass('calendar-time')){
          return {
            showTime : true
          }
        }
        return {};
      }
    }
  },{
    xclass : 'form-field-date'
  });

  return dateField;
});/**
 * @fileOverview  \u53ef\u52fe\u9009\u5b57\u6bb5
 * @ignore
 */

define('bui/form/checkfield',['bui/form/basefield'],function (require) {
  var Field = require('bui/form/basefield');

  /**
   * \u53ef\u9009\u4e2d\u83dc\u5355\u57df
   * @class BUI.Form.Field.Check
   * @extends BUI.Form.Field
   */
  var checkField = Field.extend({
    /**
     * \u9a8c\u8bc1\u6210\u529f\u540e\u6267\u884c\u7684\u64cd\u4f5c
     * @protected
     */
    onValid : function(){
      var _self = this,
        checked = _self._getControlChecked();
      _self.setInternal('checked',checked);
      _self.fire('change');
      if(checked){
        _self.fire('checked');
      }else{
        _self.fire('unchecked');
      }
    },
    //\u8bbe\u7f6e\u662f\u5426\u52fe\u9009
    _setControlChecked : function(checked){
      var _self = this,
        innerControl = _self.getInnerControl();
      innerControl.attr('checked',!!checked);
    },
    //\u83b7\u53d6\u662f\u5426\u52fe\u9009
    _getControlChecked : function(){
      var _self = this,
        innerControl = _self.getInnerControl();
      return !!innerControl.attr('checked');
    },
    //\u8986\u76d6 \u8bbe\u7f6e\u503c\u7684\u65b9\u6cd5
    _uiSetValue : function(v){

    },
    //\u8bbe\u7f6e\u662f\u5426\u52fe\u9009
    _uiSetChecked : function(v){
      var _self = this;
      _self._setControlChecked(v);
      if(_self.get('rendered')){
        _self.onValid();
      }
    }
  },{
    ATTRS : {
      /**
       * \u89e6\u53d1\u9a8c\u8bc1\u4e8b\u4ef6\uff0c\u8fdb\u800c\u5f15\u8d77change\u4e8b\u4ef6
       * @override
       * @type {String}
       */
      validEvent : {
        value : 'click'
      },
      /**
       * \u662f\u5426\u9009\u4e2d
       * @cfg {String} checked
       */
      /**
       * \u662f\u5426\u9009\u4e2d
       * @type {String}
       */
      checked : {
        value : false
      },
      events : {
        value : {
          /**
           * @event
           * \u9009\u4e2d\u4e8b\u4ef6
           */
          'checked' : false,
          /**
           * @event
           * \u53d6\u6d88\u9009\u4e2d\u4e8b\u4ef6
           */
          'unchecked' : false
        }
      }
    },
    PARSER : {
      checked : function(el){
        return !!el.attr('checked');
      }
    }
  },{
    xclass : 'form-check-field'
  });

  return checkField;
});/**
 * @fileOverview  \u590d\u9009\u6846\u8868\u5355\u57df
 * @ignore
 */

define('bui/form/checkboxfield',['bui/form/checkfield'],function (required) {
  
  var CheckField = required('bui/form/checkfield');

   /**
   * \u8868\u5355\u590d\u9009\u57df
   * @class BUI.Form.Field.Checkbox
   * @extends BUI.Form.Field.Check
   */
  var CheckBoxField = CheckField.extend({

  },{
    ATTRS : {
      /**
       * \u5185\u90e8\u8868\u5355\u5143\u7d20\u7684\u5bb9\u5668
       * @type {String}
       */
      controlTpl : {
        view : true,
        value : '<input type="checkbox"/>'
      },
       /**
       * \u63a7\u4ef6\u5bb9\u5668\uff0c\u5982\u679c\u4e3a\u7a7a\u76f4\u63a5\u6dfb\u52a0\u5728\u63a7\u4ef6\u5bb9\u5668\u4e0a
       * @type {String|HTMLElement}
       */
      controlContainer : {
        value : '.checkbox'
      },
      tpl : {
        value : '<label><span class="checkbox"></span>{label}</label>'
      }
    }
  },{
    xclass : 'form-field-checkbox'
  });

  return CheckBoxField;
});/**
 * @fileOverview  \u5355\u9009\u6846\u8868\u5355\u57df
 * @ignore
 */

define('bui/form/radiofield',['bui/form/checkfield'],function (required) {
  
  var CheckField = required('bui/form/checkfield');

  /**
   * \u8868\u5355\u5355\u9009\u57df
   * @class BUI.Form.Field.Radio
   * @extends BUI.Form.Field.Check
   */
  var RadioField = CheckField.extend({
    bindUI : function(){
      var _self = this,
        parent = _self.get('parent'),
        name = _self.get('name');

      if(parent){
        _self.getInnerControl().on('click',function(ev){
          var fields = parent.getFields(name);
          BUI.each(fields,function(field){
            if(field != _self){
              field.set('checked',false);
            }
          });
        });
      }
    }
  },{
    ATTRS : {
      /**
       * \u5185\u90e8\u8868\u5355\u5143\u7d20\u7684\u5bb9\u5668
       * @type {String}
       */
      controlTpl : {
        view : true,
        value : '<input type="radio"/>'
      },
      /**
       * \u63a7\u4ef6\u5bb9\u5668\uff0c\u5982\u679c\u4e3a\u7a7a\u76f4\u63a5\u6dfb\u52a0\u5728\u63a7\u4ef6\u5bb9\u5668\u4e0a
       * @type {String|HTMLElement}
       */
      controlContainer : {
        value : '.radio'
      },
      tpl : {
        value : '<label><span class="radio"></span>{label}</label>'
      }
    }
  },{
    xclass : 'form-field-radio'
  });

  return RadioField;
});/**
 * @fileOverview \u4ec5\u4ec5\u7528\u4e8e\u663e\u793a\u6587\u672c\uff0c\u4e0d\u80fd\u7f16\u8f91\u7684\u5b57\u6bb5
 * @ignore
 */

define('bui/form/plainfield',['bui/form/basefield'],function (require) {
  var Field = require('bui/form/basefield');


  var PlainFieldView = Field.View.extend({

    _uiSetValue : function(v){
      var _self = this,
        textEl = _self.get('textEl'),
        container = _self.getControlContainer(),
        renderer = _self.get('renderer'), 
        text = renderer ? renderer(v) : v,
        width = _self.get('width'),
        appendWidth = 0,
        textTpl;
      if(textEl){
        
        textEl.remove();
      }
      text = text || '&nbsp;';
      textTpl = BUI.substitute(_self.get('textTpl'),{text : text});
      textEl = $(textTpl).appendTo(container);
      appendWidth = textEl.outerWidth() - textEl.width();
      textEl.width(width - appendWidth);
      _self.set('textEl',textEl);
    }

  },{
    ATTRS : {
      textEl : {},
      value : {}
    }
  },{
    xclass : 'form-field-plain-view'
  });

  /**
   * \u8868\u5355\u9690\u85cf\u57df
   * @class BUI.Form.Field.PlainField
   * @extends BUI.Form.Field
   */
  var PlainField = Field.extend({
 
  },{
    ATTRS : {
      /**
       * \u5185\u90e8\u8868\u5355\u5143\u7d20\u7684\u5bb9\u5668
       * @type {String}
       */
      controlTpl : {
        value : '<input type="hidden"/>'
      },
      /**
       * \u663e\u793a\u6587\u672c\u7684\u6a21\u677f
       * @type {String}
       */
      textTpl : {
        view : true,
        value : '<span class="x-form-text">{text}</span>'
      },
      /**
       * \u5c06\u5b57\u6bb5\u7684\u503c\u683c\u5f0f\u5316\u8f93\u51fa
       * @type {Function}
       */
      renderer : {
        view : true,
        value : function(value){
          return value;
        }
      },
      tpl : {
        value : ''
      },
      xview : {
        value : PlainFieldView
      }
    }
  },{
    xclass : 'form-field-plain'
  });

  return PlainField;
});/**
 * @fileOverview \u8868\u5355\u57df\u7684\u5165\u53e3\u6587\u4ef6
 * @ignore
 */
;(function(){
var BASE = 'bui/form/';
define(BASE + 'field',['bui/common',BASE + 'textfield',BASE + 'datefield',BASE + 'selectfield',BASE + 'hiddenfield',
  BASE + 'numberfield',BASE + 'checkfield',BASE + 'radiofield',BASE + 'checkboxfield',BASE + 'plainfield'],function (require) {
  var BUI = require('bui/common'),
    Field = require(BASE + 'basefield');

  BUI.mix(Field,{
    Text : require(BASE + 'textfield'),
    Date : require(BASE + 'datefield'),
    Select : require(BASE + 'selectfield'),
    Hidden : require(BASE + 'hiddenfield'),
    Number : require(BASE + 'numberfield'),
    Check : require(BASE + 'checkfield'),
    Radio : require(BASE + 'radiofield'),
    Checkbox : require(BASE + 'checkboxfield'),
    Plain : require(BASE + 'plainfield')
  });

  return Field;
});

})();
/**
 * @fileOverview \u8868\u5355\u9a8c\u8bc1
 * @ignore
 */

define('bui/form/valid',['bui/common','bui/form/rules'],function (require) {

  var BUI = require('bui/common'),
    Rules = require('bui/form/rules');

  /**
   * @class BUI.Form.ValidView
   * @private
   * \u5bf9\u63a7\u4ef6\u5185\u7684\u5b57\u6bb5\u57df\u8fdb\u884c\u9a8c\u8bc1\u7684\u89c6\u56fe
   */
  var ValidView = function(){

  };

  ValidView.prototype = {
    /**
     * \u83b7\u53d6\u9519\u8bef\u4fe1\u606f\u7684\u5bb9\u5668
     * @protected
     * @return {jQuery} 
     */
    getErrorsContainer : function(){
      var _self = this,
        errorContainer = _self.get('errorContainer');
      if(errorContainer){
        if(BUI.isString(errorContainer)){
          return _self.get('el').find(errorContainer);
        }
        return errorContainer;
      }
      return _self.getContentElement();
    },
    /**
     * \u663e\u793a\u9519\u8bef
     */
    showErrors : function(errors){
      var _self = this,
        errorsContainer = _self.getErrorsContainer(),
        errorTpl = _self.get('errorTpl');     
      _self.clearErrors(); 

      if(!_self.get('showError')){
        return ;
      }
      //\u5982\u679c\u4ec5\u663e\u793a\u7b2c\u4e00\u6761\u9519\u8bef\u8bb0\u5f55
      if(_self.get('showOneError')){
        if(errors && errors.length){
          _self.showError(errors[0],errorTpl,errorsContainer);
        }
        return ;
      }

      BUI.each(errors,function(error){
        if(error){
          _self.showError(error,errorTpl,errorsContainer);
        }
      });
    },
    /**
     * \u663e\u793a\u4e00\u6761\u9519\u8bef
     * @protected
     * @template
     * @param  {String} msg \u9519\u8bef\u4fe1\u606f
     */
    showError : function(msg,errorTpl,container){

    },
    /**
     * @protected
     * @template
     * \u6e05\u9664\u9519\u8bef
     */
    clearErrors : function(){

    }
  };
  /**
   * \u5bf9\u63a7\u4ef6\u5185\u7684\u5b57\u6bb5\u57df\u8fdb\u884c\u9a8c\u8bc1
   * @class  BUI.Form.Valid
   */
  var Valid = function(){

  };

  Valid.ATTRS = {

    /**
     * \u63a7\u4ef6\u56fa\u6709\u7684\u9a8c\u8bc1\u89c4\u5219\uff0c\u4f8b\u5982\uff0c\u65e5\u671f\u5b57\u6bb5\u57df\uff0c\u6709\u7684date\u7c7b\u578b\u7684\u9a8c\u8bc1
     * @protected
     * @type {Object}
     */
    defaultRules : {
      value : {}
    },
    /**
     * \u63a7\u4ef6\u56fa\u6709\u7684\u9a8c\u8bc1\u51fa\u9519\u4fe1\u606f\uff0c\u4f8b\u5982\uff0c\u65e5\u671f\u5b57\u6bb5\u57df\uff0c\u4e0d\u662f\u6709\u6548\u65e5\u671f\u7684\u9a8c\u8bc1\u5b57\u6bb5
     * @protected
     * @type {Object}
     */
    defaultMessages : {
      value : {}
    },
    /**
     * \u9a8c\u8bc1\u89c4\u5219
     * @type {Object}
     */
    rules : {
      value : {}
    },
    /**
     * \u9a8c\u8bc1\u4fe1\u606f\u96c6\u5408
     * @type {Object}
     */
    messages : {
      value : {}
    },
    /**
     * \u9a8c\u8bc1\u5668 \u9a8c\u8bc1\u5bb9\u5668\u5185\u7684\u8868\u5355\u5b57\u6bb5\u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
     * @type {Function}
     */
    validator : {

    },
    /**
     * \u5b58\u653e\u9519\u8bef\u4fe1\u606f\u5bb9\u5668\u7684\u9009\u62e9\u5668\uff0c\u5982\u679c\u672a\u63d0\u4f9b\u5219\u9ed8\u8ba4\u663e\u793a\u5728\u63a7\u4ef6\u4e2d
     * @private
     * @type {String}
     */
    errorContainer : {
      view : true
    },
    /**
     * \u663e\u793a\u9519\u8bef\u4fe1\u606f\u7684\u6a21\u677f
     * @type {Object}
     */
    errorTpl : {
      view : true,
      value : '<span class="x-field-error"><span class="x-icon x-icon-mini x-icon-error">!</span><label class="x-field-error-text">{error}</label></span>'
    },
    /**
     * \u663e\u793a\u9519\u8bef
     * @type {Boolean}
     */
    showError : {
      view : true,
      value : true
    },
    /**
     * \u662f\u5426\u4ec5\u663e\u793a\u4e00\u4e2a\u9519\u8bef
     * @type {Boolean}
     */
    showOneError: {

    },
    /**
     * \u9519\u8bef\u4fe1\u606f\uff0c\u8fd9\u4e2a\u9a8c\u8bc1\u9519\u8bef\u4e0d\u5305\u542b\u5b50\u63a7\u4ef6\u7684\u9a8c\u8bc1\u9519\u8bef
     * @type {String}
     */
    error : {

    }
  };

  Valid.prototype = {
    /**
     * \u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
     * @template
     * @return {Boolean} \u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
     */
    isValid : function(){

    },
    /**
     * \u8fdb\u884c\u9a8c\u8bc1
     */
    valid : function(){

    },
    /**
     * @protected
     * @template
     * \u9a8c\u8bc1\u81ea\u8eab\u7684\u89c4\u5219\u548c\u9a8c\u8bc1\u5668
     */
    validControl : function(){

    },
    //\u9a8c\u8bc1\u89c4\u5219
    validRules : function(rules,value){
      var _self = this,
        messages = _self._getValidMessages(),
        error = null;

      for(var name in rules){
        if(rules.hasOwnProperty(name)){
          var baseValue = rules[name];
          error = Rules.valid(name,value,baseValue,messages[name],_self);
          if(error){
            break;
          }
        }
      }
      return error;
    },
    //\u83b7\u53d6\u9a8c\u8bc1\u9519\u8bef\u4fe1\u606f
    _getValidMessages : function(){
      var _self = this,
        defaultMessages = _self.get('defaultMessages'),
        messages = _self.get('messages');
      return BUI.merge(defaultMessages,messages);
    },
    /**
     * @template
     * @protected
     * \u63a7\u4ef6\u672c\u8eab\u662f\u5426\u901a\u8fc7\u9a8c\u8bc1\uff0c\u4e0d\u8003\u8651\u5b50\u63a7\u4ef6
     * @return {String} \u9a8c\u8bc1\u7684\u9519\u8bef
     */
    getValidError : function(value){
      var _self = this,
        validator = _self.get('validator'),
        error = null;

      error = _self.validRules(_self.get('defaultRules'),value) || _self.validRules(_self.get('rules'),value);

      if(!error){
        if(_self.parseValue){
          value = _self.parseValue(value);
        }
        error = validator ? validator.call(this,value) : '';
      }

      return error;
    },
    /**
     * \u83b7\u53d6\u9a8c\u8bc1\u51fa\u9519\u4fe1\u606f\uff0c\u5305\u62ec\u81ea\u8eab\u548c\u5b50\u63a7\u4ef6\u7684\u9a8c\u8bc1\u9519\u8bef\u4fe1\u606f
     * @return {Array} \u51fa\u9519\u4fe1\u606f
     */
    getErrors : function(){

    },
    /**
     * \u663e\u793a\u9519\u8bef
     * @param {Array} \u663e\u793a\u9519\u8bef
     */
    showErrors : function(errors){
      var _self = this,
        errors = errors || _self.getErrors();
      _self.get('view').showErrors(errors);
    },
    /**
     * \u6e05\u9664\u9519\u8bef
     */
    clearErrors : function(){
      var _self = this,
        children = _self.get('children');

      BUI.each(children,function(item){
        item.clearErrors && item.clearErrors();
      });
      _self.set('error',null);
      _self.get('view').clearErrors();
    },
    /**
     * \u6dfb\u52a0\u9a8c\u8bc1\u89c4\u5219
     * @param {String} name \u89c4\u5219\u540d\u79f0
     * @param {*} [value] \u89c4\u5219\u8fdb\u884c\u6821\u9a8c\u7684\u8fdb\u884c\u5bf9\u6bd4\u7684\u503c\uff0c\u5982max : 10 
     * @param {String} [message] \u51fa\u9519\u4fe1\u606f,\u53ef\u4ee5\u4f7f\u6a21\u677f
     * <ol>
     *   <li>\u5982\u679c value \u662f\u5355\u4e2a\u503c\uff0c\u4f8b\u5982\u6700\u5927\u503c value = 10,\u90a3\u4e48\u6a21\u677f\u53ef\u4ee5\u5199\u6210\uff1a '\u8f93\u5165\u503c\u4e0d\u80fd\u5927\u4e8e{0}!'</li>
     *   <li>\u5982\u679c value \u662f\u4e2a\u590d\u6742\u5bf9\u8c61\uff0c\u6570\u7ec4\u65f6\uff0c\u6309\u7167\u7d22\u5f15\uff0c\u5bf9\u8c61\u65f6\u6309\u7167 key \u963b\u6b62\u3002\u5982\uff1avalue= {max:10,min:5} \uff0c\u5219'\u8f93\u5165\u503c\u4e0d\u80fd\u5927\u4e8e{max},\u4e0d\u80fd\u5c0f\u4e8e{min}'</li>
     * </ol>
     *         var field = form.getField('name');
     *         field.addRule('required',true);
     *
     *         field.addRule('max',10,'\u4e0d\u80fd\u5927\u4e8e{0}');
     */
    addRule : function(name,value,message){
      var _self = this,
        rules = _self.get('rules'),
        messages = _self.get('messages');
      rules[name] = value;
      if(message){
        messages[name] = message;
      }
      
    },
    /**
     * \u6dfb\u52a0\u591a\u4e2a\u9a8c\u8bc1\u89c4\u5219
     * @param {Object} rules \u591a\u4e2a\u9a8c\u8bc1\u89c4\u5219
     * @param {Object} [messages] \u9a8c\u8bc1\u89c4\u5219\u7684\u51fa\u9519\u4fe1\u606f
     *         var field = form.getField('name');
     *         field.addRules({
     *           required : true,
     *           max : 10
     *         });
     */
    addRules : function(rules,messages){
      var _self = this;

      BUI.each(rules,function(value,name){
        var msg = messages ? messages[name] : null;
        _self.addRule(name,value,msg);
      });
    },
    /**
     * \u79fb\u9664\u6307\u5b9a\u540d\u79f0\u7684\u9a8c\u8bc1\u89c4\u5219
     * @param  {String} name \u9a8c\u8bc1\u89c4\u5219\u540d\u79f0
     *         var field = form.getField('name');
     *         field.remove('required');   
     */
    removeRule : function(name){
      var _self = this,
        rules = _self.get('rules');
      delete rules[name];
    },
    /**
     * \u6e05\u7406\u9a8c\u8bc1\u89c4\u5219
     */
    clearRules : function(){
      var _self = this;
      _self.set('rules',{});
    }
  };

  Valid.View = ValidView;
  return Valid;
});/**
 * @fileOverview \u8868\u5355\u5206\u7ec4\u9a8c\u8bc1
 * @ignore
 */

define('bui/form/groupvalid',['bui/form/valid'],function (require) {
  
  var CLS_ERROR = 'x-form-error',
    Valid = require('bui/form/valid');

   /**
   * @class BUI.Form.GroupValidView
   * @private
   * \u8868\u5355\u5206\u7ec4\u9a8c\u8bc1\u89c6\u56fe
   * @extends BUI.Form.ValidView
   */
  function GroupValidView(){

  }

  BUI.augment(GroupValidView,Valid.View,{
    /**
     * \u663e\u793a\u4e00\u6761\u9519\u8bef
     * @private
     * @param  {String} msg \u9519\u8bef\u4fe1\u606f
     */
    showError : function(msg,errorTpl,container){
      var errorMsg = BUI.substitute(errorTpl,{error : msg}),
           el = $(errorMsg);
        el.appendTo(container);
        el.addClass(CLS_ERROR);
    },
    /**
     * \u6e05\u9664\u9519\u8bef
     */
    clearErrors : function(){
      var _self = this,
        errorContainer = _self.getErrorsContainer();
      errorContainer.children('.' + CLS_ERROR).remove();
    }
  });

  /**
   * @class BUI.Form.GroupValid
   * \u8868\u5355\u5206\u7ec4\u9a8c\u8bc1
   * @extends BUI.Form.Valid
   */
  function GroupValid(){

  }

  GroupValid.ATTRS = ATTRS =BUI.merge(true,Valid.ATTRS,{
    events: {
      value : {
        validchange : true,
        change : true
      }
    }
  });

  BUI.augment(GroupValid,Valid,{
    __bindUI : function(){
      var _self = this,
        validEvent =  'validchange change';

      //\u5f53\u4e0d\u9700\u8981\u663e\u793a\u5b50\u63a7\u4ef6\u9519\u8bef\u65f6\uff0c\u4ec5\u9700\u8981\u76d1\u542c'change'\u4e8b\u4ef6\u5373\u53ef
      _self.on(validEvent,function(ev){
        var sender = ev.target;
        if(sender != this && _self.get('showError')){
          var valid = _self.isChildrenValid();
          if(valid){
            _self.validControl(_self.getRecord());
            valid = _self.isSelfValid();
          }
          if(!valid){
            _self.showErrors();
          }else{
            _self.clearErrors();
          }
        }
      });
    },
    /**
     * \u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
     */
    isValid : function(){
      var _self = this,
        isValid = _self.isChildrenValid();
      return isValid && _self.isSelfValid();
    },
    /**
     * \u8fdb\u884c\u9a8c\u8bc1
     */
    valid : function(){
      var _self = this,
        children = _self.get('children');

      BUI.each(children,function(item){
        item.valid();
      });
    },
    /**
     * \u6240\u6709\u5b50\u63a7\u4ef6\u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
     * @protected
     * @return {Boolean} \u6240\u6709\u5b50\u63a7\u4ef6\u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
     */
    isChildrenValid : function(){
      var _self = this,
        children = _self.get('children'),
        isValid = true;

      BUI.each(children,function(item){
        if(!item.isValid()){
          isValid = false;
          return false;
        }
      });
      return isValid;
    },
    isSelfValid : function () {
      return !this.get('error');
    },
    /**
     * \u9a8c\u8bc1\u63a7\u4ef6\u5185\u5bb9
     * @protected
     * @return {Boolean} \u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
     */
    validControl : function (record) {
      var _self = this,
        error = _self.getValidError(record);
      _self.set('error',error);
    },
    /**
     * \u83b7\u53d6\u9a8c\u8bc1\u51fa\u9519\u4fe1\u606f\uff0c\u5305\u62ec\u81ea\u8eab\u548c\u5b50\u63a7\u4ef6\u7684\u9a8c\u8bc1\u9519\u8bef\u4fe1\u606f
     * @return {Array} \u51fa\u9519\u4fe1\u606f
     */
    getErrors : function(){
      var _self = this,
        children = _self.get('children'),
        showChildError = _self.get('showChildError'),
        validError = null,
        rst = [];
      if(showChildError){
        BUI.each(children,function(child){
          if(child.getErrors){
            rst = rst.concat(child.getErrors());
          }
        });
      }
      //\u5982\u679c\u6240\u6709\u5b50\u63a7\u4ef6\u901a\u8fc7\u9a8c\u8bc1\uff0c\u624d\u663e\u793a\u81ea\u5df1\u7684\u9519\u8bef
      if(_self.isChildrenValid()){
        validError = _self.get('error');
        if(validError){
          rst.push(validError);
        }
      }
      
      return rst;
    },  
    //\u8bbe\u7f6e\u9519\u8bef\u6a21\u677f\u65f6\uff0c\u8986\u76d6\u5b50\u63a7\u4ef6\u8bbe\u7f6e\u7684\u9519\u8bef\u6a21\u677f
    _uiSetErrorTpl : function(v){
      var _self = this,
        children = _self.get('children');

      BUI.each(children,function(item){
        item.set('errorTpl',v);
      });
    }
  });

  GroupValid.View = GroupValidView;

  return GroupValid;
});/**
 * @fileOverview \u8868\u5355\u5b57\u6bb5\u7684\u5bb9\u5668\u6269\u5c55
 * @ignore
 */
define('bui/form/fieldcontainer',['bui/common','bui/form/field','bui/form/groupvalid'],function (require) {
  var BUI = require('bui/common'),
    Field = require('bui/form/field'),
    GroupValid = require('bui/form/groupvalid'),
    PREFIX = BUI.prefix;

  var FIELD_XCLASS = 'form-field',
    CLS_FIELD = PREFIX + FIELD_XCLASS,
    CLS_GROUP = PREFIX + 'form-group',
    FIELD_TAGS = 'input,select,textarea';

  function isField(node){
    return node.is(FIELD_TAGS);
  }
  /**
   * \u83b7\u53d6\u8282\u70b9\u9700\u8981\u5c01\u88c5\u7684\u5b50\u8282\u70b9
   * @ignore
   */
  function getDecorateChilds(node,srcNode){

    if(node != srcNode){

      if(isField(node)){
        return [node];
      }
      var cls = node.attr('class');
      if(cls && (cls.indexOf(CLS_GROUP) !== -1 || cls.indexOf(CLS_FIELD) !== -1)){
        return [node];
      }
    }
    var rst = [],
      children = node.children();
    BUI.each(children,function(subNode){
      rst = rst.concat(getDecorateChilds($(subNode),srcNode));
    });
    return rst;
  }

  var containerView = BUI.Component.View.extend([GroupValid.View]);

  /**
   * \u8868\u5355\u5b57\u6bb5\u5bb9\u5668\u7684\u6269\u5c55\u7c7b
   * @class BUI.Form.FieldContainer
   * @extends BUI.Component.Controller
   * @mixins BUI.Form.GroupValid
   */
  var container = BUI.Component.Controller.extend([GroupValid],
    {
      //\u540c\u6b65\u6570\u636e
      syncUI : function(){
        var _self = this,
          fields = _self.getFields(),
          validators = _self.get('validators');

        BUI.each(fields,function(field){
          var name = field.get('name');
          if(validators[name]){
            field.set('validator',validators[name]);
          }
        });
        BUI.each(validators,function(item,key){
          //\u6309\u7167ID\u67e5\u627e
          if(key.indexOf('#') == 0){
            var id = key.replace('#',''),
              child = _self.getChild(id,true);
            if(child){
              child.set('validator',item);
            }
          }
        });
      },
      /**
       * \u83b7\u53d6\u5c01\u88c5\u7684\u5b50\u63a7\u4ef6\u8282\u70b9
       * @protected
       * @override
       */
      getDecorateElments : function(){
        var _self = this,
          el = _self.get('el');
        var items = getDecorateChilds(el,el);
        return items;
      },
      /**
       * \u6839\u636e\u5b50\u8282\u70b9\u83b7\u53d6\u5bf9\u5e94\u7684\u5b50\u63a7\u4ef6 xclass
       * @protected
       * @override
       */
      findXClassByNode : function(childNode, ignoreError){


        if(childNode.attr('type') === 'checkbox'){
          return FIELD_XCLASS + '-checkbox';
        }

        if(childNode.attr('type') === 'radio'){
          return FIELD_XCLASS + '-radio';
        }

        if(childNode.attr('type') === 'number'){
          return FIELD_XCLASS + '-number';
        }

        if(childNode.hasClass('calendar')){
          return FIELD_XCLASS + '-date';
        }

        if(childNode[0].tagName == "SELECT"){
          return FIELD_XCLASS + '-select';
        }

        if(isField(childNode)){
          return FIELD_XCLASS;
        }

        return BUI.Component.Controller.prototype.findXClassByNode.call(this,childNode, ignoreError);
      },
      /**
       * \u83b7\u53d6\u8868\u5355\u7f16\u8f91\u7684\u5bf9\u8c61
       * @return {Object} \u7f16\u8f91\u7684\u5bf9\u8c61
       */
      getRecord : function(){
        var _self = this,
          rst = {},
          fields = _self.getFields();
        BUI.each(fields,function(field){
          var name = field.get('name'),
            value = _self._getFieldValue(field);

          if(!rst[name]){//\u6ca1\u6709\u503c\uff0c\u76f4\u63a5\u8d4b\u503c
            rst[name] = value;
          }else if(BUI.isArray(rst[name]) && value != null){//\u5df2\u7ecf\u5b58\u5728\u503c\uff0c\u5e76\u4e14\u662f\u6570\u7ec4\uff0c\u52a0\u5165\u6570\u7ec4
            rst[name].push(value);
          }else if(value != null){          //\u5426\u5219\u5c01\u88c5\u6210\u6570\u7ec4\uff0c\u5e76\u52a0\u5165\u6570\u7ec4
            var arr = [rst[name]]
            arr.push(value);
            rst[name] = arr; 
          }
        });
        return rst;
      },
      /**
       * \u83b7\u53d6\u8868\u5355\u5b57\u6bb5
       * @return {Array} \u8868\u5355\u5b57\u6bb5
       */
      getFields : function(name){
        var _self = this,
          rst = [],
          children = _self.get('children');
        BUI.each(children,function(item){
          if(item instanceof Field){
            if(!name || item.get('name') == name){
              rst.push(item);
            }
          }else if(item.getFields){
            rst = rst.concat(item.getFields(name));
          }
        });
        return rst;
      },
      /**
       * \u6839\u636ename \u83b7\u53d6\u8868\u5355\u5b57\u6bb5
       * @param  {String} name \u5b57\u6bb5\u540d
       * @return {BUI.Form.Field}  \u8868\u5355\u5b57\u6bb5\u6216\u8005 null
       */
      getField : function(name){
        var _self = this,
          fields = _self.getFields(),
          rst = null;

        BUI.each(fields,function(field){
          if(field.get('name') === name){
            rst = field;
            return false;
          }
        });
        return rst;
      },
      /**
       * \u6839\u636e\u7d22\u5f15\u83b7\u53d6\u5b57\u6bb5\u7684name
       * @param  {Number} index \u5b57\u6bb5\u7684\u7d22\u5f15
       * @return {String}   \u5b57\u6bb5\u540d\u79f0
       */
      getFieldAt : function (index) {
        return this.getFields()[index];
      },
      /**
       * \u6839\u636e\u5b57\u6bb5\u540d
       * @param {String} name \u5b57\u6bb5\u540d
       * @param {*} value \u5b57\u6bb5\u503c
       */
      setFieldValue : function(name,value){
        var _self = this,
          fields = _self.getFields(name);
          BUI.each(fields,function(field){
            _self._setFieldValue(field,value);
          });
      },
      //\u8bbe\u7f6e\u5b57\u6bb5\u57df\u7684\u503c
      _setFieldValue : function(field,value){
        //\u5982\u679c\u5b57\u6bb5\u4e0d\u53ef\u7528\uff0c\u5219\u4e0d\u80fd\u8bbe\u7f6e\u503c
        if(field.get('disabled')){
          return;
        }
        //\u5982\u679c\u662f\u53ef\u52fe\u9009\u7684
        if(field instanceof Field.Check){
          var fieldValue = field.get('value');
          if(value && (fieldValue === value || (BUI.isArray(value) && BUI.Array.contains(fieldValue,value)))){
            field.set('checked',true);
          }else{
            field.set('checked',false);
          }
        }else{
          field.set('value',value);
        }
      },
      /**
       * \u83b7\u53d6\u5b57\u6bb5\u503c,\u4e0d\u5b58\u5728\u5b57\u6bb5\u65f6\u8fd4\u56denull,\u591a\u4e2a\u540c\u540d\u5b57\u6bb5\u65f6\uff0ccheckbox\u8fd4\u56de\u4e00\u4e2a\u6570\u7ec4
       * @param  {String} name \u5b57\u6bb5\u540d
       * @return {*}  \u5b57\u6bb5\u503c
       */
      getFieldValue : function(name){
        var _self = this,
          fields = _self.getFields(name),
          rst = [];

        BUI.each(fields,function(field){
          var value = _self._getFieldValue(field);
          if(value){
            rst.push(value);
          }
        });
        if(rst.length === 0){
          return null;
        }
        if(rst.length === 1){
          return rst[0]
        }
        return rst;
      },
      //\u83b7\u53d6\u5b57\u6bb5\u57df\u7684\u503c
      _getFieldValue : function(field){
        if(!(field instanceof Field.Check) || field.get('checked')){
          return field.get('value');
        }
        return null;
      },
      /**
       * \u6e05\u9664\u6240\u6709\u8868\u5355\u57df\u7684\u503c
       */
      clearFields : function(){
        this.clearErrors();
        this.setRecord({})
      },
      /**
       * \u8bbe\u7f6e\u8868\u5355\u7f16\u8f91\u7684\u5bf9\u8c61
       * @param {Object} record \u7f16\u8f91\u7684\u5bf9\u8c61
       */
      setRecord : function(record){
        var _self = this,
          fields = _self.getFields();

        BUI.each(fields,function(field){
          var name = field.get('name');
          _self._setFieldValue(field,record[name]);
        });
      },
      /**
       * \u66f4\u65b0\u8868\u5355\u7f16\u8f91\u7684\u5bf9\u8c61
       * @param  {Object} record \u7f16\u8f91\u7684\u5bf9\u8c61
       */
      updateRecord : function(record){
        var _self = this,
          fields = _self.getFields();

        BUI.each(fields,function(field){
          var name = field.get('name');
          if(record.hasOwnProperty(name)){
            _self._setFieldValue(field,record[name]);
          }
        });
      },
      /**
       * \u8bbe\u7f6e\u63a7\u4ef6\u83b7\u53d6\u7126\u70b9\uff0c\u8bbe\u7f6e\u7b2c\u4e00\u4e2a\u5b50\u63a7\u4ef6\u83b7\u53d6\u7126\u70b9
       */
      focus : function(){
        var _self = this,
          fields = _self.getFields(),
          firstField = fields[0];
        if(firstField){
          firstField.focus();
        }
      },
      //\u7981\u7528\u63a7\u4ef6
      _uiSetDisabled : function(v){
        var _self = this,
          children = _self.get('children');

        BUI.each(children,function(item){
          item.set('disabled',v);
        });
      }
    },
    {
      ATTRS : {
        /**
         * \u8868\u5355\u7684\u6570\u636e\u8bb0\u5f55\uff0c\u4ee5\u952e\u503c\u5bf9\u7684\u5f62\u5f0f\u5b58\u5728
         * @type {Object}
         */
        record : {
          setter : function(v){
            this.setRecord(v);
          },
          getter : function(){
            return this.getRecord();
          }
        },
        /**
         * \u5185\u90e8\u5143\u7d20\u7684\u9a8c\u8bc1\u51fd\u6570\uff0c\u53ef\u4ee5\u4f7f\u75282\u4e2d\u9009\u62e9\u5668
         * <ol>
         *   <li>id: \u4f7f\u7528\u4ee5'#'\u4e3a\u524d\u7f00\u7684\u9009\u62e9\u5668\uff0c\u53ef\u4ee5\u67e5\u627e\u5b57\u6bb5\u6216\u8005\u5206\u7ec4\uff0c\u6dfb\u52a0\u8054\u5408\u6821\u9a8c</li>
         *   <li>name: \u4e0d\u4f7f\u7528\u4efb\u4f55\u524d\u7f00\uff0c\u6ca1\u67e5\u627e\u8868\u5355\u5b57\u6bb5</li>
         * </ol>
         * @type {Object}
         */
        validators : {
          value : {

          }
        },
        disabled : {
          sync : false
        },
        isDecorateChild : {
          value : true
        },
        xview : {
          value : containerView
        }
      }
    },{
      xclass : 'form-field-container'
    }
  ); 
  container.View = containerView;
  return container;
  
});/**
 * @fileOverview \u8868\u5355\u6587\u672c\u57df\u7ec4\uff0c\u53ef\u4ee5\u5305\u542b\u4e00\u4e2a\u81f3\u591a\u4e2a\u5b57\u6bb5
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/form/group/base',['bui/common','bui/form/fieldcontainer'],function (require) {
  var BUI = require('bui/common'),
    FieldContainer = require('bui/form/fieldcontainer');

  /**
   * @class BUI.Form.Group
   * \u8868\u5355\u5b57\u6bb5\u5206\u7ec4
   * @extends BUI.Form.FieldContainer
   */
  var Group = FieldContainer.extend({
    
  },{
    ATTRS : {
      /**
       * \u6807\u9898
       * @type {String}
       */
      label : {
        view : true
      },
      defaultChildClass : {
        value : 'form-field'
      }
    }
  },{
    xclass:'form-group'
  });

  return Group;
});/**
 * @fileOverview \u8303\u56f4\u7684\u5b57\u6bb5\u7ec4\uff0c\u6bd4\u5982\u65e5\u671f\u8303\u56f4\u7b49
 * @ignore
 */

define('bui/form/group/range',['bui/form/group/base'],function (require) {
  var Group = require('bui/form/group/base');

  function testRange (self,curVal,prevVal) {
    var allowEqual = self.get('allowEqual');

    if(allowEqual){
      return prevVal <= curVal;
    }

    return prevVal < curVal;
  }
  /**
   * @class BUI.Form.Group.Range
   * \u5b57\u6bb5\u8303\u56f4\u5206\u7ec4\uff0c\u7528\u4e8e\u65e5\u671f\u8303\u56f4\uff0c\u6570\u5b57\u8303\u56f4\u7b49\u573a\u666f
   * @extends BUI.Form.Group
   */
  var Range = Group.extend({

  },{
    ATTRS : {
      /**
       * \u9ed8\u8ba4\u7684\u9a8c\u8bc1\u51fd\u6570\u5931\u8d25\u540e\u663e\u793a\u7684\u6587\u672c\u3002
       * @type {Object}
       */
      rangeText : {
        value : '\u5f00\u59cb\u4e0d\u80fd\u5927\u4e8e\u7ed3\u675f\uff01'
      },
      /**
       * \u662f\u5426\u5141\u8bb8\u524d\u540e\u76f8\u7b49
       * @type {Boolean}
       */
      allowEqual : {
        value : true
      },
      /**
       * \u9a8c\u8bc1\u5668
       * @override
       * @type {Function}
       */
      validator : {
        value : function (record) {
          var _self = this,
            fields = _self.getFields(),
            valid = true;
          for(var i = 1; i < fields.length ; i ++){
            var cur = fields[i],
              prev = fields[i-1],
              curVal,
              prevVal;
            if(cur && prev){
              curVal = cur.get('value');
              prevVal = prev.get('value');
              if(!testRange(_self,curVal,prevVal)){
                valid = false;
                break;
              }
            }
          }
          if(!valid){
            return _self.get('rangeText');
          }
          return null;
        }
      }
    }
  },{
    xclass : 'form-group-range'
  });

  return Range;
});/**
 * @fileOverview \u9009\u62e9\u5206\u7ec4\uff0c\u5305\u542b\uff0ccheckbox,radio
 * @ignore
 */

define('bui/form/group/check',['bui/form/group/base'],function (require) {
  var Group = require('bui/form/group/base');

  function getFieldName (self) {
    var firstField = self.getFieldAt(0);
    if(firstField){
      return firstField.get('name');
    }
    return '';
  }
  /**
   * @class BUI.Form.Group.Check
   * \u5355\u9009\uff0c\u590d\u9009\u5206\u7ec4\uff0c\u53ea\u80fd\u5305\u542b\u540cname\u7684checkbox,radio
   * @extends BUI.Form.Group
   */
  var Check = Group.extend({
    bindUI : function(){
      var _self = this;
      _self.on('change',function(ev){
        var name = getFieldName(_self),
          range = _self.get('range'),
          record = _self.getRecord(),
          value = record[name],
          max = range[1];
        if(value && value.length >= max){
          _self._setFieldsEnable(name,false);
        }else{
          _self._setFieldsEnable(name,true);
        }
      });
    },
    _setFieldsEnable : function(name,enable){

      var _self = this,
        fields = _self.getFields(name);
      BUI.each(fields,function(field){
        if(enable){
          field.enable();
        }else{
          if(!field.get('checked')){
            field.disable();
          }
        }
      });
    },
    _uiSetRange : function(v){
      this.addRule('checkRange',v);
    }

  },{
    ATTRS : {
      /**
       * \u9700\u8981\u9009\u4e2d\u7684\u5b57\u6bb5,
       * <ol>
       *   <li>\u5982\u679c range:1\uff0crange:2 \u6700\u5c11\u52fe\u90091\u4e2a\uff0c2\u4e2a\u3002</li>
       *   <li>\u5982\u679c range :0,\u53ef\u4ee5\u5168\u90e8\u4e0d\u9009\u4e2d\u3002</li>
       *   <li>\u5982\u679c range:[1,2],\u5219\u5fc5\u987b\u9009\u4e2d1-2\u4e2a\u3002</li>
       * </ol>
       * @type {Array|Number}
       */
      range : {
        setter : function (v) {
          if(BUI.isString(v) || BUI.isNumber(v)){
            v = [parseInt(v)];
          }
          return v;
        }
      }
    }
  },{
    xclass : 'form-group-check'
  });

  return Check;

});/**
 * @fileOverview \u9009\u62e9\u6846\u5206\u7ec4
 * @ignore
 */

define('bui/form/group/select',['bui/form/group/base','bui/data'],function (require) {
  var Group = require('bui/form/group/base'),
    Data = require('bui/data'),
    Bindable = BUI.Component.UIBase.Bindable;
  
  function getItems(nodes){
    var items = [];
    BUI.each(nodes,function(node){
      items.push({
        text : node.text,
        value : node.id
      });
    });
    return items;
  }

  /**
   * @class BUI.Form.Group.Select
   * \u7ea7\u8054\u9009\u62e9\u6846\u5206\u7ec4
   * @extends BUI.Form.Group
   * @mixins BUI.Component.UIBase.Bindable
   */
  var Select = Group.extend([Bindable],{
    initializer : function(){
      var _self = this,
        url = _self.get('url'),
        store = _self.get('store') || _self._getStore();
      if(!store.isStore){
        store.autoLoad = true;
        if(url){
          store.url = url;
        }
        store = new Data.TreeStore(store);
        _self.set('store',store);
      }
    },
    bindUI : function  () {
      var _self = this;
      _self.on('change',function (ev) {
        var target = ev.target;
        if(target != _self){
          var field = target,
            value = field.get('value'),
            level = _self._getFieldIndex(field) + 1;
          _self._valueChange(value,level);
        }
      });
    },
    onLoad : function(e){
      var _self = this,
        node = e ? e.node : _self.get('store').get('root');
      _self._setFieldItems(node.level,node.children); 
    },
    //\u83b7\u53d6store\u7684\u914d\u7f6e\u9879
    _getStore : function(){
      var _self = this,
        type = _self.get('type');
      if(type && TypeMap[type]){
        return TypeMap[type];
      }
      return {};
    },
    _valueChange : function(value,level){
      var _self = this,
        store = _self.get('store');
      if(value){
        var node = store.findNode(value);
        if(!node){
          return;
        }
        if(store.isLoaded(node)){
          _self._setFieldItems(level,node.children);
        }else{
          store.loadNode(node);
        }
      }else{
        _self._setFieldItems(level,[]);
      }
    },
    _setFieldItems : function(level,nodes){
      var _self = this,
        field = _self.getFieldAt(level),
        items = getItems(nodes);
      if(field){
        field.setItems(items);
        _self._valueChange(field.get('value'),level + 1);
      }
    },
    //\u83b7\u53d6\u5b57\u6bb5\u7684\u7d22\u5f15\u4f4d\u7f6e
    _getFieldIndex : function (field) {
      var _self = this,
        fields = _self.getFields();
      return  BUI.Array.indexOf(field,fields);
    }
  },{
    ATTRS : {
      /**
       * \u7ea7\u8054\u9009\u62e9\u6846\u7684\u7c7b\u578b,\u76ee\u524d\u4ec5\u5185\u7f6e\u4e86 'city'\u4e00\u4e2a\u7c7b\u578b\uff0c\u7528\u4e8e\u9009\u62e9\u7701\u3001\u5e02\u3001\u53bf,
       * \u53ef\u4ee5\u81ea\u5b9a\u4e49\u6dfb\u52a0\u7c7b\u578b
       *         Select.addType('city',{
       *           proxy : {
       *             url : 'http://lp.taobao.com/go/rgn/citydistrictdata.php',
       *             dataType : 'jsonp'
       *           },
       *           map : {
       *             isleaf : 'leaf',
       *             value : 'text'
       *           }
       *         });
       * @type {String}
       */
      type : {

      },
      store : {

      }
    }
  },{
    xclass : 'form-group-select'
  });

  var TypeMap = {};

  /**
   * \u6dfb\u52a0\u4e00\u4e2a\u7c7b\u578b\u7684\u7ea7\u8054\u9009\u62e9\u6846\uff0c\u76ee\u524d\u4ec5\u5185\u7f6e\u4e86 'city'\u4e00\u4e2a\u7c7b\u578b\uff0c\u7528\u4e8e\u9009\u62e9\u7701\u3001\u5e02\u3001\u53bf
   * @static
   * @param {String} name \u7c7b\u578b\u540d\u79f0
   * @param {Object} cfg  \u914d\u7f6e\u9879\uff0c\u8be6\u7ec6\u4fe1\u606f\u8bf7\u53c2\u770b\uff1a @see{BUI.Data.TreeStore}
   */
  Select.addType = function(name,cfg){
    TypeMap[name] = cfg;
  };

  Select.addType('city',{
    proxy : {
      url : 'http://lp.taobao.com/go/rgn/citydistrictdata.php',
      dataType : 'jsonp'
    },
    map : {
      isleaf : 'leaf',
      value : 'text'
    }
  });


  return Select;
});/**
 * @fileOverview \u8868\u5355\u6587\u672c\u57df\u7ec4\uff0c\u53ef\u4ee5\u5305\u542b\u4e00\u4e2a\u81f3\u591a\u4e2a\u5b57\u6bb5
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/form/fieldgroup',['bui/common','bui/form/group/base','bui/form/group/range','bui/form/group/check','bui/form/group/select'],function (require) {
  var BUI = require('bui/common'),
    Group = require('bui/form/group/base');

  BUI.mix(Group,{
    Range : require('bui/form/group/range'),
    Check : require('bui/form/group/check'),
    Select : require('bui/form/group/select')
  });
  return Group;
});/**
 * @fileOverview \u521b\u5efa\u8868\u5355
 * @ignore
 */

define('bui/form/form',['bui/common','bui/toolbar','bui/form/fieldcontainer'],function (require) {
  
  var BUI = require('bui/common'),
    Bar = require('bui/toolbar').Bar,
    FieldContainer = require('bui/form/fieldcontainer'),
    Component = BUI.Component;

  var FormView = FieldContainer.View.extend({
    _uiSetMethod : function(v){
      this.get('el').attr('method',v);
    },
    _uiSetAction : function(v){
      this.get('el').attr('action',v);
    }
  },{
    ATTRS : {
      method : {},
      action : {}
    }
  },{
    xclass: 'form-view'
  });

  /**
   * @class BUI.Form.Form
   * \u8868\u5355\u63a7\u4ef6,\u8868\u5355\u76f8\u5173\u7684\u7c7b\u56fe\uff1a
   * <img src="../assets/img/class-form.jpg"/>
   * @extends BUI.Form.FieldContainer
   */
  var Form = FieldContainer.extend({
    renderUI : function(){
      var _self = this,
        buttonBar = _self.get('buttonBar'),
        cfg;
      if($.isPlainObject(buttonBar) && _self.get('buttons')){
        cfg = BUI.merge(_self.getDefaultButtonBarCfg(),buttonBar);
        buttonBar = new Bar(cfg);
        _self.set('buttonBar',buttonBar);
      }
    },
    bindUI : function(){
      var _self = this,
        formEl = _self.get('el');

      formEl.on('submit',function(ev){
        _self.valid();
        if(!_self.isValid() || _self.onBeforeSubmit() === false){
          ev.preventDefault();
        }
      });
    },
    /**
     * \u83b7\u53d6\u6309\u94ae\u680f\u9ed8\u8ba4\u7684\u914d\u7f6e\u9879
     * @protected
     * @return {Object} 
     */
    getDefaultButtonBarCfg : function(){
      var _self = this,
        buttons = _self.get('buttons');
      return {
        autoRender : true,
        elCls :'toolbar',
        render : _self.get('el'),
        items : buttons,
        defaultChildClass : 'bar-item-button'
      };
    },
    /**
     * \u8868\u5355\u63d0\u4ea4\uff0c\u5982\u679c\u672a\u901a\u8fc7\u9a8c\u8bc1\uff0c\u5219\u963b\u6b62\u63d0\u4ea4
     */
    submit : function(options){
      var _self = this;
      _self.valid();
      if(_self.isValid()){
        if(_self.onBeforeSubmit() == false){
          return;
        }
        if(!options){
          _self.get('el')[0].submit();
        }
      }
    },
    /**
     * \u5e8f\u5217\u5316\u8868\u5355\u6210\u5bf9\u8c61
     * @return {Object} \u5e8f\u5217\u5316\u6210\u5bf9\u8c61
     */
    serializeToObject : function(){
      return BUI.FormHelper.serializeToObject(this.get('el')[0]);
    },
    /**
     * \u8868\u5355\u63d0\u4ea4\u524d
     * @protected
     * @return {Boolean} \u662f\u5426\u53d6\u6d88\u63d0\u4ea4
     */
    onBeforeSubmit : function(){
      return this.fire('beforesubmit');
    },
    /**
     * \u8868\u5355\u6062\u590d\u521d\u59cb\u503c
     */
    reset : function(){
      var _self = this,
        initRecord = _self.get('initRecord');
      _self.setRecord(initRecord);
    },
    /**
     * \u91cd\u7f6e\u63d0\u793a\u4fe1\u606f\uff0c\u56e0\u4e3a\u5728\u8868\u5355\u9690\u85cf\u72b6\u6001\u4e0b\uff0c\u63d0\u793a\u4fe1\u606f\u5b9a\u4f4d\u9519\u8bef
     * <pre><code>
     * dialog.on('show',function(){
     *   form.resetTips();
     * });
     *   
     * </code></pre>
     */
    resetTips : function(){
      var _self = this,
        fields = _self.getFields();
      BUI.each(fields,function(field){
        field.resetTip();
      });
    },
    /**
     * @protected
     * @ignore
     */
    destructor : function(){
      var _self = this,
        buttonBar = _self.get('buttonBar');
      if(buttonBar && buttonBar.destroy){
        buttonBar.destroy();
      }
    },
    //\u8bbe\u7f6e\u8868\u5355\u7684\u521d\u59cb\u6570\u636e
    _uiSetInitRecord : function(v){
      //if(v){
        this.setRecord(v);
      //}
      
    }
  },{
    ATTRS : {
      /**
       * \u63d0\u4ea4\u7684\u8def\u5f84
       * @type {String}
       */
      action : {
        view : true,
        value : ''
      },
      allowTextSelection:{
        value : true
      },
      events : {
        value : {
          /**
           * @event
           * \u8868\u5355\u63d0\u4ea4\u524d\u89e6\u53d1\uff0c\u5982\u679c\u8fd4\u56defalse\u4f1a\u963b\u6b62\u8868\u5355\u63d0\u4ea4
           */
          beforesubmit : false
        }
      },
      /**
       * \u63d0\u4ea4\u7684\u65b9\u5f0f
       * @type {String}
       */
      method : {
        view : true,
        value : 'get'
      },
      decorateCfgFields : {
        value : {
          'method' : true,
          'action' : true
        }
      },
      /**
       * \u9ed8\u8ba4\u7684\u5b50\u63a7\u4ef6\u65f6\u6587\u672c\u57df
       * @type {String}
       */
      defaultChildClass : {
        value : 'form-field'
      },
      /**
       * \u4f7f\u7528\u7684\u6807\u7b7e\uff0c\u4e3aform
       * @type {String}
       */
      elTagName : {
        value : 'form'
      },
      /**
       * \u8868\u5355\u6309\u94ae
       * @type {Array}
       */
      buttons : {

      },
      /**
       * \u6309\u94ae\u680f
       * @type {BUI.Toolbar.Bar}
       */
      buttonBar : {
        value : {

        }
      },
      childContainer : {
        value : '.x-form-fields'
      },
      /**
       * \u8868\u5355\u521d\u59cb\u5316\u7684\u6570\u636e\uff0c\u7528\u4e8e\u521d\u59cb\u5316\u6216\u8005\u8868\u5355\u56de\u6eda
       * @type {Object}
       */
      initRecord : {

      },
      /**
       * \u8868\u5355\u9ed8\u8ba4\u4e0d\u663e\u793a\u9519\u8bef\uff0c\u4e0d\u5f71\u54cd\u8868\u5355\u5206\u7ec4\u548c\u8868\u5355\u5b57\u6bb5
       * @type {Boolean}
       */
      showError : {
        value : false
      },
      xview : {
        value : FormView
      },
      tpl : {
        value : '<div class="x-form-fields"></div>'
      }
    }
  },{
    xclass : 'form'
  });
  
  Form.View = FormView;
  return Form;
});/**
 * @fileOverview \u5782\u76f4\u8868\u5355
 * @ignore
 */

define('bui/form/horizontal',['bui/common','bui/form/form'],function (require) {
  var BUI = require('bui/common'),
    Form = require('bui/form/form');

  /**
   * @class BUI.Form.Horizontal
   * \u6c34\u5e73\u8868\u5355\uff0c\u5b57\u6bb5\u6c34\u5e73\u6392\u5217
   * @extends BUI.Form.Form
   * 
   */
  var Horizontal = Form.extend({
    /**
     * \u83b7\u53d6\u6309\u94ae\u680f\u9ed8\u8ba4\u7684\u914d\u7f6e\u9879
     * @protected
     * @return {Object} 
     */
    getDefaultButtonBarCfg : function(){
      var _self = this,
        buttons = _self.get('buttons');
      return {
        autoRender : true,
        elCls : 'actions-bar toolbar row',
        tpl : '<div class="form-actions span21 offset3"></div>',
        childContainer : '.form-actions',
        render : _self.get('el'),
        items : buttons,
        defaultChildClass : 'bar-item-button'
      };
    }
  },{
    ATTRS : {
      defaultChildClass : {
        value : 'form-row'
      },
      errorTpl : {
        value : '<span class="valid-text"><span class="estate error"><span class="x-icon x-icon-mini x-icon-error">!</span><em>{error}</em></span></span>'
      },
      elCls : {
        value : 'form-horizontal'
      }
    },
    PARSER : {
      
    }
  },{
    xclass : 'form-horizontal'
  });
  return Horizontal;
});/**
 * @fileOverview \u8868\u5355\u91cc\u7684\u4e00\u884c\u5143\u7d20
 * @ignore
 */

define('bui/form/row',['bui/common','bui/form/fieldcontainer'],function (require) {
  var BUI = require('bui/common'),
    FieldContainer = require('bui/form/fieldcontainer');

  /**
   * @class BUI.Form.Row
   * \u8868\u5355\u884c
   * @extends BUI.Form.FieldContainer
   */
  var Row = FieldContainer.extend({

  },{
    ATTRS : {
      elCls : {
        value : 'row'
      },
      defaultChildCfg:{
        value : {
          tpl : ' <label class="control-label">{label}</label>\
                <div class="controls">\
                </div>',
          childContainer : '.controls',
          showOneError : true,
          controlContainer : '.controls',
          elCls : 'control-group span8',
          errorTpl : '<span class="valid-text"><span class="estate error"><span class="x-icon x-icon-mini x-icon-error">!</span><em>{error}</em></span></span>'
        }
        
      },
      defaultChildClass : {
        value : 'form-field-text'
      }
    }
  },{
    xclass:'form-row'
  });

  return Row;
});/**
 * @fileOverview \u9a8c\u8bc1\u89c4\u5219
 * @ignore
 */

define('bui/form/rule',['bui/common'],function (require) {

  var BUI = require('bui/common');
  /**
   * @class BUI.Form.Rule
   * \u9a8c\u8bc1\u89c4\u5219
   * @extends BUI.Base
   */
  var Rule = function (config){
    Rule.superclass.constructor.call(this,config);
  }

  BUI.extend(Rule,BUI.Base);

  Rule.ATTRS = {
    /**
     * \u89c4\u5219\u540d\u79f0
     * @type {String}
     */
    name : {

    },
    /**
     * \u9a8c\u8bc1\u5931\u8d25\u4fe1\u606f
     * @type {String}
     */
    msg : {

    },
    /**
     * \u9a8c\u8bc1\u51fd\u6570
     * @type {Function}
     */
    validator : {
      value : function(value,baseValue,formatedMsg,control){

      }
    }
  }

  //\u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
  function valid(self,value,baseValue,msg,control){
    var _self = self,
      validator = _self.get('validator'),
      formatedMsg = formatError(self,baseValue,msg),
      valid = true;
    value = value == null ? '' : value;
    return validator.call(_self,value,baseValue,formatedMsg,control);
  }

  function parseParams(values){

    if(values == null){
      return {};
    }

    if($.isPlainObject(values)){
      return values;
    }

    var ars = values,
        rst = {};
    if(BUI.isArray(values)){

      for(var i = 0; i < ars.length; i++){
        rst[i] = ars[i];
      }
      return rst;
    }

    return {'0' : values};
  }

  function formatError(self,values,msg){
    var ars = parseParams(values); 
    msg = msg || self.get('msg');
    return BUI.substitute(msg,ars);
  }

  BUI.augment(Rule,{

    /**
     * \u662f\u5426\u901a\u8fc7\u9a8c\u8bc1\uff0c\u8be5\u51fd\u6570\u53ef\u4ee5\u63a5\u6536\u591a\u4e2a\u53c2\u6570
     * @param  {*}  [value] \u9a8c\u8bc1\u7684\u503c
     * @param  {*} [baseValue] \u8ddf\u4f20\u5165\u503c\u76f8\u6bd4\u8f83\u7684\u503c
     * @param {String} [msg] \u9a8c\u8bc1\u5931\u8d25\u540e\u7684\u9519\u8bef\u4fe1\u606f\uff0c\u663e\u793a\u7684\u9519\u8bef\u4e2d\u53ef\u4ee5\u663e\u793a baseValue\u4e2d\u7684\u4fe1\u606f
     * @param {BUI.Form.Field|BUI.Form.Group} [control] \u53d1\u751f\u9a8c\u8bc1\u7684\u63a7\u4ef6
     * @return {String}   \u901a\u8fc7\u9a8c\u8bc1\u8fd4\u56de null ,\u672a\u901a\u8fc7\u9a8c\u8bc1\u8fd4\u56de\u9519\u8bef\u4fe1\u606f
     * 
     *         var msg = '\u8f93\u5165\u6570\u636e\u5fc5\u987b\u5728{0}\u548c{1}\u4e4b\u95f4\uff01',
     *           rangeRule = new Rule({
     *             name : 'range',
     *             msg : msg,
     *             validator :function(value,range,msg){
     *               var min = range[0], //\u6b64\u5904\u6211\u4eec\u628arange\u5b9a\u4e49\u4e3a\u6570\u7ec4\uff0c\u4e5f\u53ef\u4ee5\u5b9a\u4e49\u4e3a{min:0,max:200},\u90a3\u4e48\u5728\u4f20\u5165\u6821\u9a8c\u65f6\u8ddf\u6b64\u5904\u4e00\u81f4\u5373\u53ef
     *                 max = range[1];   //\u5728\u9519\u8bef\u4fe1\u606f\u4e2d\uff0c\u4f7f\u7528\u7528 '\u8f93\u5165\u6570\u636e\u5fc5\u987b\u5728{min}\u548c{max}\u4e4b\u95f4\uff01',\u9a8c\u8bc1\u51fd\u6570\u4e2d\u7684\u5b57\u7b26\u4e32\u5df2\u7ecf\u8fdb\u884c\u683c\u5f0f\u5316
     *               if(value < min || value > max){
     *                 return false;
     *               }
     *               return true;
     *             }
     *           });
     *         var range = [0,200],
     *           val = 100,
     *           error = rangeRule.valid(val,range);//msg\u53ef\u4ee5\u5728\u6b64\u5904\u91cd\u65b0\u4f20\u5165
     *         
     */
    valid : function(value,baseValue,msg,control){
      var _self = this;
      return valid(_self,value,baseValue,msg,control);
    }
  });

  return Rule;


});/**
 * @fileOverview \u9a8c\u8bc1\u96c6\u5408
 * @ignore
 */

define('bui/form/rules',['bui/form/rule'],function (require) {

  var Rule = require('bui/form/rule');

  function toNumber(value){
    return parseFloat(value);
  }

  function toDate(value){
    return BUI.Date.parse(value);
  }

  var ruleMap = {

  };

  /**
   * @class BUI.Form.Rules
   * @singleton
   * \u8868\u5355\u9a8c\u8bc1\u7684\u9a8c\u8bc1\u89c4\u5219\u7ba1\u7406\u5668
   */
  var rules = {
    /**
     * \u6dfb\u52a0\u9a8c\u8bc1\u89c4\u5219
     * @param {Object|BUI.Form.Rule} rule \u9a8c\u8bc1\u89c4\u5219\u914d\u7f6e\u9879\u6216\u8005\u9a8c\u8bc1\u89c4\u5219\u5bf9\u8c61
     * @param  {String} name \u89c4\u5219\u540d\u79f0
     */
    add : function(rule){
      var name;
      if($.isPlainObject(rule)){
        name = rule.name;
        ruleMap[name] = new Rule(rule);        
      }else if(rule.get){
        name = rule.get('name'); 
        ruleMap[name] = rule;
      }
      return ruleMap[name];
    },
    /**
     * \u5220\u9664\u9a8c\u8bc1\u89c4\u5219
     * @param  {String} name \u89c4\u5219\u540d\u79f0
     */
    remove : function(name){
      delete ruleMap[name];
    },
    /**
     * \u83b7\u53d6\u9a8c\u8bc1\u89c4\u5219
     * @param  {String} name \u89c4\u5219\u540d\u79f0
     * @return {BUI.Form.Rule}  \u9a8c\u8bc1\u89c4\u5219
     */
    get : function(name){
      return ruleMap[name];
    },
    /**
     * \u9a8c\u8bc1\u6307\u5b9a\u7684\u89c4\u5219
     * @param  {String} name \u89c4\u5219\u7c7b\u578b
     * @param  {*} value \u9a8c\u8bc1\u503c
     * @param  {*} [baseValue] \u7528\u4e8e\u9a8c\u8bc1\u7684\u57fa\u7840\u503c
     * @param  {String} [msg] \u663e\u793a\u9519\u8bef\u7684\u6a21\u677f
     * @param  {BUI.Form.Field|BUI.Form.Group} [control] \u663e\u793a\u9519\u8bef\u7684\u6a21\u677f
     * @return {String} \u901a\u8fc7\u9a8c\u8bc1\u8fd4\u56de null,\u5426\u5219\u8fd4\u56de\u9519\u8bef\u4fe1\u606f
     */
    valid : function(name,value,baseValue,msg,control){
      var rule = rules.get(name);
      if(rule){
        return rule.valid(value,baseValue,msg,control);
      }
      return null;
    },
    /**
     * \u9a8c\u8bc1\u6307\u5b9a\u7684\u89c4\u5219
     * @param  {String} name \u89c4\u5219\u7c7b\u578b
     * @param  {*} values \u9a8c\u8bc1\u503c
     * @param  {*} [baseValue] \u7528\u4e8e\u9a8c\u8bc1\u7684\u57fa\u7840\u503c
     * @param  {BUI.Form.Field|BUI.Form.Group} [control] \u663e\u793a\u9519\u8bef\u7684\u6a21\u677f
     * @return {Boolean} \u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
     */
    isValid : function(name,value,baseValue,control){
      return rules.valid(name,value,baseValue,control) == null;
    }
  };
  
  /**
   * \u975e\u7a7a\u9a8c\u8bc1,\u4f1a\u5bf9\u503c\u53bb\u9664\u7a7a\u683c
   * <ol>
   *  <li>name: required</li>
   *  <li>msg: \u4e0d\u80fd\u4e3a\u7a7a\uff01</li>
   *  <li>required: boolean \u7c7b\u578b</li>
   * </ol>
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var required = rules.add({
    name : 'required',
    msg : '\u4e0d\u80fd\u4e3a\u7a7a\uff01',
    validator : function(value,required,formatedMsg){
      if(required !== false && /^\s*$/.test(value)){
        return formatedMsg;
      }
    }
  });

  /**
   * \u76f8\u7b49\u9a8c\u8bc1
   * <ol>
   *  <li>name: equalTo</li>
   *  <li>msg: \u4e24\u6b21\u8f93\u5165\u4e0d\u4e00\u81f4\uff01</li>
   *  <li>equalTo: \u4e00\u4e2a\u5b57\u7b26\u4e32\uff0cid\uff08#id_name) \u6216\u8005 name</li>
   * </ol>
   *         {
   *           equalTo : '#password'
   *         }
   *         //\u6216\u8005
   *         {
   *           equalTo : 'password'
   *         } 
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var equalTo = rules.add({
    name : 'equalTo',
    msg : '\u4e24\u6b21\u8f93\u5165\u4e0d\u4e00\u81f4\uff01',
    validator : function(value,equalTo,formatedMsg){
      var el = $(equalTo);
      if(el.length){
        equalTo = el.val();
      } 
      return value === equalTo ? undefined : formatedMsg;
    }
  });


  /**
   * \u4e0d\u5c0f\u4e8e\u9a8c\u8bc1
   * <ol>
   *  <li>name: min</li>
   *  <li>msg: \u8f93\u5165\u503c\u4e0d\u80fd\u5c0f\u4e8e{0}\uff01</li>
   *  <li>min: \u6570\u5b57\uff0c\u5b57\u7b26\u4e32</li>
   * </ol>
   *         {
   *           min : 5
   *         }
   *         //\u5b57\u7b26\u4e32
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var min = rules.add({
    name : 'min',
    msg : '\u8f93\u5165\u503c\u4e0d\u80fd\u5c0f\u4e8e{0}\uff01',
    validator : function(value,min,formatedMsg){
      if(value !== '' && toNumber(value) < toNumber(min)){
        return formatedMsg;
      }
    }
  });

  /**
   * \u4e0d\u5c0f\u4e8e\u9a8c\u8bc1,\u7528\u4e8e\u6570\u503c\u6bd4\u8f83
   * <ol>
   *  <li>name: max</li>
   *  <li>msg: \u8f93\u5165\u503c\u4e0d\u80fd\u5927\u4e8e{0}\uff01</li>
   *  <li>max: \u6570\u5b57\u3001\u5b57\u7b26\u4e32</li>
   * </ol>
   *         {
   *           max : 100
   *         }
   *         //\u5b57\u7b26\u4e32
   *         {
   *           max : '100'
   *         }
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var max = rules.add({
    name : 'max',
    msg : '\u8f93\u5165\u503c\u4e0d\u80fd\u5927\u4e8e{0}\uff01',
    validator : function(value,max,formatedMsg){
      if(value !== '' && toNumber(value) > toNumber(max)){
        return formatedMsg;
      }
    }
  });

  /**
   * \u8f93\u5165\u957f\u5ea6\u9a8c\u8bc1\uff0c\u5fc5\u987b\u662f\u6307\u5b9a\u7684\u957f\u5ea6
   * <ol>
   *  <li>name: length</li>
   *  <li>msg: \u8f93\u5165\u503c\u957f\u5ea6\u4e3a{0}\uff01</li>
   *  <li>length: \u6570\u5b57</li>
   * </ol>
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var length = rules.add({
    name : 'length',
    msg : '\u8f93\u5165\u503c\u957f\u5ea6\u4e3a{0}\uff01',
    validator : function(value,len,formatedMsg){
      if(value != null){
        value = $.trim(value.toString());
        if(len != value.length){
          return formatedMsg;
        }
      }
    }
  });
  /**
   * \u6700\u77ed\u957f\u5ea6\u9a8c\u8bc1,\u4f1a\u5bf9\u503c\u53bb\u9664\u7a7a\u683c
   * <ol>
   *  <li>name: minlength</li>
   *  <li>msg: \u8f93\u5165\u503c\u957f\u5ea6\u4e0d\u5c0f\u4e8e{0}\uff01</li>
   *  <li>minlength: \u6570\u5b57</li>
   * </ol>
   *         {
   *           minlength : 5
   *         }
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var minlength = rules.add({
    name : 'minlength',
    msg : '\u8f93\u5165\u503c\u957f\u5ea6\u4e0d\u5c0f\u4e8e{0}\uff01',
    validator : function(value,min,formatedMsg){
      if(value != null){
        value = $.trim(value.toString());
        var len = value.length;
        if(len < min){
          return formatedMsg;
        }
      }
    }
  });

  /**
   * \u6700\u77ed\u957f\u5ea6\u9a8c\u8bc1,\u4f1a\u5bf9\u503c\u53bb\u9664\u7a7a\u683c
   * <ol>
   *  <li>name: maxlength</li>
   *  <li>msg: \u8f93\u5165\u503c\u957f\u5ea6\u4e0d\u5927\u4e8e{0}\uff01</li>
   *  <li>maxlength: \u6570\u5b57</li>
   * </ol>
   *         {
   *           maxlength : 10
   *         }
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}   
   */
  var maxlength = rules.add({
    name : 'maxlength',
    msg : '\u8f93\u5165\u503c\u957f\u5ea6\u4e0d\u5927\u4e8e{0}\uff01',
    validator : function(value,max,formatedMsg){
      if(value){
        value = $.trim(value.toString());
        var len = value.length;
        if(len > max){
          return formatedMsg;
        }
      }
    }
  });

  /**
   * \u6b63\u5219\u8868\u8fbe\u5f0f\u9a8c\u8bc1,\u5982\u679c\u6b63\u5219\u8868\u8fbe\u5f0f\u4e3a\u7a7a\uff0c\u5219\u4e0d\u8fdb\u884c\u6821\u9a8c
   * <ol>
   *  <li>name: regexp</li>
   *  <li>msg: \u8f93\u5165\u503c\u4e0d\u7b26\u5408{0}\uff01</li>
   *  <li>regexp: \u6b63\u5219\u8868\u8fbe\u5f0f</li>
   * </ol> 
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var regexp = rules.add({
    name : 'regexp',
    msg : '\u8f93\u5165\u503c\u4e0d\u7b26\u5408{0}\uff01',
    validator : function(value,regexp,formatedMsg){
      if(regexp){
        return regexp.test(value) ? undefined : formatedMsg;
      }
    }
  });

  /**
   * \u90ae\u7bb1\u9a8c\u8bc1,\u4f1a\u5bf9\u503c\u53bb\u9664\u7a7a\u683c\uff0c\u65e0\u6570\u636e\u4e0d\u8fdb\u884c\u6821\u9a8c
   * <ol>
   *  <li>name: email</li>
   *  <li>msg: \u4e0d\u662f\u6709\u6548\u7684\u90ae\u7bb1\u5730\u5740\uff01</li>
   * </ol>
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var email = rules.add({
    name : 'email',
    msg : '\u4e0d\u662f\u6709\u6548\u7684\u90ae\u7bb1\u5730\u5740\uff01',
    validator : function(value,baseValue,formatedMsg){
      value = $.trim(value);
      if(value){
        return /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/.test(value) ? undefined : formatedMsg;
      }
    }
  });

  /**
   * \u65e5\u671f\u9a8c\u8bc1\uff0c\u4f1a\u5bf9\u503c\u53bb\u9664\u7a7a\u683c\uff0c\u65e0\u6570\u636e\u4e0d\u8fdb\u884c\u6821\u9a8c\uff0c
   * \u5982\u679c\u4f20\u5165\u7684\u503c\u4e0d\u662f\u5b57\u7b26\u4e32\uff0c\u800c\u662f\u6570\u5b57\uff0c\u5219\u8ba4\u4e3a\u662f\u6709\u6548\u503c
   * <ol>
   *  <li>name: date</li>
   *  <li>msg: \u4e0d\u662f\u6709\u6548\u7684\u65e5\u671f\uff01</li>
   * </ol>
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var date = rules.add({
    name : 'date',
    msg : '\u4e0d\u662f\u6709\u6548\u7684\u65e5\u671f\uff01',
    validator : function(value,baseValue,formatedMsg){
      if(BUI.isNumber(value)){ //\u6570\u5b57\u8ba4\u4e3a\u662f\u65e5\u671f
        return;
      }
      if(BUI.isDate(value)){
        return;
      }
      value = $.trim(value);
      if(value){
        return BUI.Date.isDateString(value) ? undefined : formatedMsg;
      }
    }
  });

  /**
   * \u4e0d\u5c0f\u4e8e\u9a8c\u8bc1
   * <ol>
   *  <li>name: minDate</li>
   *  <li>msg: \u8f93\u5165\u65e5\u671f\u4e0d\u80fd\u5c0f\u4e8e{0}\uff01</li>
   *  <li>minDate: \u65e5\u671f\uff0c\u5b57\u7b26\u4e32</li>
   * </ol>
   *         {
   *           minDate : '2001-01-01';
   *         }
   *         //\u5b57\u7b26\u4e32
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var minDate = rules.add({
    name : 'minDate',
    msg : '\u8f93\u5165\u65e5\u671f\u4e0d\u80fd\u5c0f\u4e8e{0}\uff01',
    validator : function(value,minDate,formatedMsg){
      if(value){
        var date = toDate(value);
        if(date && date < toDate(minDate)){
           return formatedMsg;
        }
      }
    }
  });

  /**
   * \u4e0d\u5c0f\u4e8e\u9a8c\u8bc1,\u7528\u4e8e\u6570\u503c\u6bd4\u8f83
   * <ol>
   *  <li>name: maxDate</li>
   *  <li>msg: \u8f93\u5165\u503c\u4e0d\u80fd\u5927\u4e8e{0}\uff01</li>
   *  <li>maxDate: \u65e5\u671f\u3001\u5b57\u7b26\u4e32</li>
   * </ol>
   *         {
   *           maxDate : '2001-01-01';
   *         }
   *         //\u6216\u65e5\u671f
   *         {
   *           maxDate : new Date('2001-01-01');
   *         }
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var maxDate = rules.add({
    name : 'maxDate',
    msg : '\u8f93\u5165\u65e5\u671f\u4e0d\u80fd\u5927\u4e8e{0}\uff01',
    validator : function(value,maxDate,formatedMsg){
      if(value){
        var date = toDate(value);
        if(date && date > toDate(maxDate)){
           return formatedMsg;
        }
      }
    }
  });
  /**
   * \u6570\u5b57\u9a8c\u8bc1\uff0c\u4f1a\u5bf9\u503c\u53bb\u9664\u7a7a\u683c\uff0c\u65e0\u6570\u636e\u4e0d\u8fdb\u884c\u6821\u9a8c
   * \u5141\u8bb8\u5343\u5206\u7b26\uff0c\u4f8b\u5982\uff1a 12,000,000\u7684\u683c\u5f0f
   * <ol>
   *  <li>name: number</li>
   *  <li>msg: \u4e0d\u662f\u6709\u6548\u7684\u6570\u5b57\uff01</li>
   * </ol>
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}
   */
  var number = rules.add({
    name : 'number',
    msg : '\u4e0d\u662f\u6709\u6548\u7684\u6570\u5b57\uff01',
    validator : function(value,baseValue,formatedMsg){
      if(BUI.isNumber(value)){
        return;
      }
      value = value.replace(/\,/g,'');
      return !isNaN(value) ? undefined : formatedMsg;
    }
  });

  //\u6d4b\u8bd5\u8303\u56f4
  function testRange (baseValue,curVal,prevVal) {
    var allowEqual = baseValue && (baseValue.equals !== false);

    if(allowEqual){
      return prevVal <= curVal;
    }

    return prevVal < curVal;
  }
  function isEmpty(value){
    return value == '' || value == null;
  }
  //\u6d4b\u8bd5\u662f\u5426\u540e\u9762\u7684\u6570\u636e\u5927\u4e8e\u524d\u9762\u7684
  function rangeValid(value,baseValue,formatedMsg,group){
    var fields = group.getFields(),
      valid = true;
    for(var i = 1; i < fields.length ; i ++){
      var cur = fields[i],
        prev = fields[i-1],
        curVal,
        prevVal;
      if(cur && prev){
        curVal = cur.get('value');
        prevVal = prev.get('value');
        if(!isEmpty(curVal) && !isEmpty(prevVal) && !testRange(baseValue,curVal,prevVal)){
          valid = false;
          break;
        }
      }
    }
    if(!valid){
      return formatedMsg;
    }
    return null;
  }
  /**
   * \u8d77\u59cb\u7ed3\u675f\u65e5\u671f\u9a8c\u8bc1\uff0c\u524d\u9762\u7684\u65e5\u671f\u4e0d\u80fd\u5927\u4e8e\u540e\u9762\u7684\u65e5\u671f
   * <ol>
   *  <li>name: dateRange</li>
   *  <li>msg: \u8d77\u59cb\u65e5\u671f\u4e0d\u80fd\u5927\u4e8e\u7ed3\u675f\u65e5\u671f\uff01</li>
   *  <li>dateRange: \u53ef\u4ee5\u4f7ftrue\u6216\u8005{equals : fasle}\uff0c\u6807\u793a\u662f\u5426\u5141\u8bb8\u76f8\u7b49</li>
   * </ol>
   *         {
   *           dateRange : true
   *         }
   *         {
   *           dateRange : {equals : false}
   *         }
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}   
   */
  var dateRange = rules.add({
    name : 'dateRange',
    msg : '\u7ed3\u675f\u65e5\u671f\u4e0d\u80fd\u5c0f\u4e8e\u8d77\u59cb\u65e5\u671f\uff01',
    validator : rangeValid
  });

  /**
   * \u6570\u5b57\u8303\u56f4
   * <ol>
   *  <li>name: numberRange</li>
   *  <li>msg: \u8d77\u59cb\u6570\u5b57\u4e0d\u80fd\u5927\u4e8e\u7ed3\u675f\u6570\u5b57\uff01</li>
   *  <li>numberRange: \u53ef\u4ee5\u4f7ftrue\u6216\u8005{equals : fasle}\uff0c\u6807\u793a\u662f\u5426\u5141\u8bb8\u76f8\u7b49</li>
   * </ol>
   *         {
   *           numberRange : true
   *         }
   *         {
   *           numberRange : {equals : false}
   *         }
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}   
   */
  var numberRange = rules.add({
    name : 'numberRange',
    msg : '\u7ed3\u675f\u6570\u5b57\u4e0d\u80fd\u5c0f\u4e8e\u5f00\u59cb\u6570\u5b57\uff01',
    validator : rangeValid
  });

  function getFieldName (self) {
    var firstField = self.getFieldAt(0);
    if(firstField){
      return firstField.get('name');
    }
    return '';
  }

  function testCheckRange(value,range){
    if(!BUI.isArray(range)){
      range = [range];
    }
    //\u4e0d\u5b58\u5728\u503c
    if(!value || !range.length){
      return false;
    }
    var len = !value ? 0 : !BUI.isArray(value) ? 1 : value.length;
    //\u5982\u679c\u53ea\u6709\u4e00\u4e2a\u9650\u5b9a\u503c
    if(range.length == 1){
      var number = range [0];
      if(!number){//range = [0],\u5219\u4e0d\u5fc5\u9009
        return true;
      }
      if(number > len){
        return false;
      }
    }else{
      var min = range [0],
        max = range[1];
      if(min > len || max < len){
        return false;
      }
    }
    return true;
  }

  /**
   * \u52fe\u9009\u7684\u8303\u56f4
   * <ol>
   *  <li>name: checkRange</li>
   *  <li>msg: \u5fc5\u987b\u9009\u4e2d{0}\u9879\uff01</li>
   *  <li>checkRange: \u52fe\u9009\u7684\u9879\u8303\u56f4</li>
   * </ol>
   *         //\u81f3\u5c11\u52fe\u9009\u4e00\u9879
   *         {
   *           checkRange : 1
   *         }
   *         //\u53ea\u80fd\u52fe\u9009\u4e24\u9879
   *         {
   *           checkRange : [2,2]
   *         }
   *         //\u53ef\u4ee5\u52fe\u90092-4\u9879
   *         {
   *           checkRange : [2,4
   *           ]
   *         }
   * @member BUI.Form.Rules
   * @type {BUI.Form.Rule}   
   */
  var checkRange = rules.add({
    name : 'checkRange',
    msg : '\u5fc5\u987b\u9009\u4e2d{0}\u9879\uff01',
    validator : function(record,baseValue,formatedMsg,group){
      var name = getFieldName(group),
        value,
        range = baseValue;
        
      if(name && range){
        value = record[name];
        if(!testCheckRange(value,range)){
          return formatedMsg;
        }
      }
      return null;
    }
  });
  

  return rules;
});/**
 * @fileOverview \u8868\u5355\u5f02\u6b65\u8bf7\u6c42\uff0c\u5f02\u6b65\u6821\u9a8c\u3001\u8fdc\u7a0b\u83b7\u53d6\u6570\u636e
 * @ignore
 */

define('bui/form/remote',['bui/common'],function(require) {
  var BUI = require('bui/common');

  /**
   * @class BUI.Form.RemoteView
   * @private
   * \u8868\u5355\u5f02\u6b65\u8bf7\u6c42\u7c7b\u7684\u89c6\u56fe\u7c7b
   */
  var RemoteView = function () {
    // body...
  };

  RemoteView.ATTRS = {
    isLoading : {},
    loadingEl : {}
  };

  RemoteView.prototype = {

    /**
     * \u83b7\u53d6\u663e\u793a\u52a0\u8f7d\u72b6\u6001\u7684\u5bb9\u5668
     * @protected
     * @template
     * @return {jQuery} \u52a0\u8f7d\u72b6\u6001\u7684\u5bb9\u5668
     */
    getLoadingContainer : function () {
      // body...
    },
    _setLoading : function () {
      var _self = this,
        loadingEl = _self.get('loadingEl'),
        loadingTpl = _self.get('loadingTpl');
      if(!loadingEl){
        loadingEl = $(loadingTpl).appendTo(_self.getLoadingContainer());
        _self.setInternal('loadingEl',loadingEl);
      }
    },
    _clearLoading : function () {
      var _self = this,
        loadingEl = _self.get('loadingEl');
      if(loadingEl){
        loadingEl.remove();
        _self.setInternal('loadingEl',null);
      }
    },
    _uiSetIsLoading : function (v) {
      var _self = this;
      if(v){
        _self._setLoading();
      }else{
        _self._clearLoading();
      }
    }
  };

  /**
   * @class  BUI.Form.Remote
   * \u8868\u5355\u5f02\u6b65\u8bf7\u6c42\uff0c\u6240\u6709\u9700\u8981\u5b9e\u73b0\u5f02\u6b65\u6821\u9a8c\u3001\u5f02\u6b65\u8bf7\u6c42\u7684\u7c7b\u53ef\u4ee5\u4f7f\u7528\u3002
   */
  var Remote = function(){

  };

  Remote.ATTRS = {

    /**
     * \u9ed8\u8ba4\u7684\u5f02\u6b65\u8bf7\u6c42\u914d\u7f6e\u9879\uff1a
     * method : 'GET',
     * cache : true,
     * dataType : 'text'
     * @protected
     * @type {Object}
     */
    defaultRemote : {
      value : {
        method : 'GET',
        cache : true,
        callback : function (data) {
          return data;
        }
      }
    },
    /**
     * \u5f02\u6b65\u8bf7\u6c42\u5ef6\u8fdf\u7684\u65f6\u95f4\uff0c\u5f53\u5b57\u6bb5\u9a8c\u8bc1\u901a\u8fc7\u540e\uff0c\u4e0d\u9a6c\u4e0a\u8fdb\u884c\u5f02\u6b65\u8bf7\u6c42\uff0c\u7b49\u5f85\u7ee7\u7eed\u8f93\u5165\uff0c
     * 300\uff08\u9ed8\u8ba4\uff09\u6beb\u79d2\u540e\uff0c\u53d1\u9001\u8bf7\u6c42\uff0c\u5728\u8fd9\u4e2a\u8fc7\u7a0b\u4e2d\uff0c\u7ee7\u7eed\u8f93\u5165\uff0c\u5219\u53d6\u6d88\u5f02\u6b65\u8bf7\u6c42\u3002
     * @type {Object}
     */
    remoteDaly : {
      value : 500
    },
    /**
     * \u52a0\u8f7d\u7684\u6a21\u677f
     * @type {String}
     */
    loadingTpl : {
      view : true,
      value : '<img src="http://img02.taobaocdn.com/tps/i2/T1NU8nXCVcXXaHNz_X-16-16.gif" alt="loading"/>'
    },
    /**
     * \u662f\u5426\u6b63\u5728\u7b49\u5f85\u5f02\u6b65\u8bf7\u6c42\u7ed3\u679c
     * @type {Boolean}
     */
    isLoading : {
      view : true,
      value : false
    },
    /**
     * \u5f02\u6b65\u8bf7\u6c42\u7684\u914d\u7f6e\u9879\uff0c\u53c2\u8003jQuery\u7684 ajax\u914d\u7f6e\u9879\uff0c\u5982\u679c\u4e3a\u5b57\u7b26\u4e32\u5219\u4e3a url\u3002
     * \u8bf7\u4e0d\u8981\u8986\u76d6success\u5c5e\u6027\uff0c\u5982\u679c\u9700\u8981\u56de\u8c03\u5219\u4f7f\u7528 callback \u5c5e\u6027
     *
     *        {
     *          remote : {
     *            url : 'test.php',
     *            dataType:'json',//\u9ed8\u8ba4\u4e3a\u5b57\u7b26\u4e32
     *            callback : function(data){
     *              if(data.success){ //data\u4e3a\u9ed8\u8ba4\u8fd4\u56de\u7684\u503c
     *                return ''  //\u8fd4\u56de\u503c\u4e3a\u7a7a\u65f6\uff0c\u9a8c\u8bc1\u6210\u529f
     *              }else{
     *                return '\u9a8c\u8bc1\u5931\u8d25\uff0cXX\u9519\u8bef\uff01' //\u663e\u793a\u8fd4\u56de\u7684\u5b57\u7b26\u4e32\u4e3a\u9519\u8bef
     *              }
     *            }
     *          }
     *        }
     * @type {String|Object}
     */
    remote : {
      setter : function  (v) {
        if(BUI.isString(v)){
          v = {url : v}
        }
        return v;
      }
    },
    /**
     * \u5f02\u6b65\u8bf7\u6c42\u7684\u51fd\u6570\u6307\u9488\uff0c\u4ec5\u5185\u90e8\u4f7f\u7528
     * @private
     * @type {Number}
     */
    remoteHandler : {

    },
    events : {
      value : {
        /**
         * \u5f02\u6b65\u8bf7\u6c42\u7ed3\u675f
         * @event
         * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
         * @param {*} e.error \u662f\u5426\u9a8c\u8bc1\u6210\u529f
         */
        remotecomplete : false,
        /**
         * \u5f02\u6b65\u8bf7\u6c42\u5f00\u59cb
         * @event
         * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
         * @param {Object} e.data \u53d1\u9001\u7684\u5bf9\u8c61\uff0c\u662f\u4e00\u4e2a\u952e\u503c\u5bf9\uff0c\u53ef\u4ee5\u4fee\u6539\u6b64\u5bf9\u8c61\uff0c\u9644\u52a0\u4fe1\u606f
         */
        remotestart : false
      }
    }
  };

  Remote.prototype = {

    __bindUI : function(){
      var _self = this;

      _self.on('change',function (ev) {
        if(_self.get('remote') && _self.isValid()){
          var data = _self.getRemoteParams();
          _self._startRemote(data);
        }
      });

      _self.on('error',function (ev) {
        if(_self.get('remote')){
          _self._cancelRemote();
        }
      });

    },
    //\u5f00\u59cb\u5f02\u6b65\u8bf7\u6c42
    _startRemote : function(data){
      var _self = this,
        remoteHandler = _self.get('remoteHandler'),
        remoteDaly = _self.get('remoteDaly');
      if(remoteHandler){
        //\u5982\u679c\u524d\u9762\u5df2\u7ecf\u53d1\u9001\u8fc7\u5f02\u6b65\u8bf7\u6c42\uff0c\u53d6\u6d88\u6389
        _self._cancelRemote(remoteHandler);
      }
      //\u4f7f\u7528\u95ed\u5305\u8fdb\u884c\u5f02\u6b65\u8bf7\u6c42
      function dalayFunc(){
        _self._remoteValid(data,remoteHandler);
        _self.set('isLoading',true);
      }
      remoteHandler = setTimeout(dalayFunc,remoteDaly);
      _self.setInternal('remoteHandler',remoteHandler);
      
    },
    //\u5f02\u6b65\u8bf7\u6c42
    _remoteValid : function(data,remoteHandler){
      var _self = this,
        remote = _self.get('remote'),
        defaultRemote = _self.get('defaultRemote'),
        options = BUI.merge(defaultRemote,remote,{data : data});

      function complete (error,data) {
        //\u786e\u8ba4\u5f53\u524d\u8fd4\u56de\u7684\u9519\u8bef\u662f\u5f53\u524d\u8bf7\u6c42\u7684\u7ed3\u679c\uff0c\u9632\u6b62\u8986\u76d6\u540e\u9762\u7684\u8bf7\u6c42
        if(remoteHandler == _self.get('remoteHandler')){
          _self.fire('remotecomplete',{error : error,data : data});
          _self.set('isLoading',false);
          _self.setInternal('remoteHandler',null);
        } 
      }

      options.success = function (data) {
        var callback = options.callback,
          error = callback(data);
        complete(error,data);
      };

      options.error = function (jqXHR, textStatus,errorThrown){
        complete(errorThrown);
      };

      _self.fire('remotestart',{data : data});
      $.ajax(options);
    },
    /**
     * \u83b7\u53d6\u5f02\u6b65\u8bf7\u6c42\u7684\u952e\u503c\u5bf9
     * @template
     * @protected
     * @return {Object} \u8fdc\u7a0b\u9a8c\u8bc1\u7684\u53c2\u6570\uff0c\u952e\u503c\u5bf9
     */
    getRemoteParams : function() {

    },
    //\u53d6\u6d88\u5f02\u6b65\u8bf7\u6c42
    _cancelRemote : function(remoteHandler){
      var _self = this;

      remoteHandler = remoteHandler || _self.get('remoteHandler');
      if(remoteHandler){
        clearTimeout(remoteHandler);
        _self.setInternal('remoteHandler',null);
      }
      _self.set('isLoading',false);
    }

  };

  Remote.View = RemoteView;
  return Remote;
});/**
 * @fileOverview \u9009\u62e9\u6846\u547d\u540d\u7a7a\u95f4\u5165\u53e3\u6587\u4ef6
 * @ignore
 */

define('bui/select',['bui/common','bui/select/select','bui/select/combox','bui/select/suggest'],function (require) {
  var BUI = require('bui/common'),
    Select = BUI.namespace('Select');

  BUI.mix(Select,{
    Select : require('bui/select/select'),
    Combox : require('bui/select/combox'),
    Suggest: require('bui/select/suggest')
  });
  return Select;
});/**
 * @fileOverview \u9009\u62e9\u63a7\u4ef6
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/select/select',['bui/common','bui/picker'],function (require) {
  'use strict';
  var BUI = require('bui/common'),
    ListPicker = require('bui/picker').ListPicker,
    PREFIX = BUI.prefix;

  var Component = BUI.Component,
    Picker = ListPicker,
    CLS_INPUT = PREFIX + 'select-input',
    /**
     * \u9009\u62e9\u63a7\u4ef6
     * xclass:'select'
     * <pre><code>
     *  BUI.use('bui/select',function(Select){
     * 
     *   var items = [
     *         {text:'\u9009\u98791',value:'a'},
     *         {text:'\u9009\u98792',value:'b'},
     *         {text:'\u9009\u98793',value:'c'}
     *       ],
     *       select = new Select.Select({  
     *         render:'#s1',
     *         valueField:'#hide',
     *         //multipleSelect: true, //\u662f\u5426\u591a\u9009
     *         items:items
     *       });
     *   select.render();
     *   select.on('change', function(ev){
     *     //ev.text,ev.value,ev.item
     *   });
     *   
     * });
     * </code></pre>
     * @class BUI.Select.Select
     * @extends BUI.Component.Controller
     */
    select = Component.Controller.extend({
      //\u521d\u59cb\u5316
      initializer:function(){
        var _self = this,
          multipleSelect = _self.get('multipleSelect'),
          xclass,
          picker = _self.get('picker');
        if(!picker){
          xclass = multipleSelect ? 'listbox' : 'simple-list';
          picker = new Picker({
            children:[
              {
                xclass : xclass,
                elCls:PREFIX + 'select-list',
                items:_self.get('items')/**/
              }
            ],
            valueField : _self.get('valueField')
          });
          
          //children.push(picker);
          _self.set('picker',picker);
        }else{
          picker.set('valueField',_self.get('valueField'));
        }
        if(multipleSelect){
          picker.set('hideEvent','');
        }
        
      },
      //\u6e32\u67d3DOM\u4ee5\u53ca\u9009\u62e9\u5668
      renderUI : function(){
        var _self = this,
          picker = _self.get('picker'),
          el = _self.get('el'),
          textEl = el.find('.' + _self.get('inputCls'));
        picker.set('trigger',el);
        picker.set('triggerEvent', _self.get('triggerEvent'));
        picker.set('autoSetValue', _self.get('autoSetValue'));
        picker.set('textField',textEl);
        if(_self.get('forceFit')){
          picker.set('width',el.outerWidth());
        }
        
        picker.render();
      },
      //\u7ed1\u5b9a\u4e8b\u4ef6
      bindUI : function(){
        var _self = this,
          picker = _self.get('picker');
          
        //\u9009\u9879\u53d1\u751f\u6539\u53d8\u65f6
        picker.on('selectedchange',function(ev){
          _self.fire('change',{text : ev.text,value : ev.value,item : ev.item});
        });
      },
      /**
       * \u662f\u5426\u5305\u542b\u5143\u7d20
       * @override
       */
      containsElement : function(elem){
        var _self = this,
          picker = _self.get('picker');

        return Component.Controller.prototype.containsElement.call(this,elem) || picker.containsElement(elem);
      },
      //\u8bbe\u7f6e\u5b50\u9879
      _uiSetItems : function(items){
        if(!items){
          return;
        }
        var _self = this,
          picker = _self.get('picker'),
          list = picker.get('list'),
          valueField = _self.get('valueField');
        list.set('items',items);
        if(valueField){
          picker.setSelectedValue($(valueField).val());
        }
      },
      //\u8bbe\u7f6eForm\u8868\u5355\u4e2d\u7684\u540d\u79f0
      _uiSetName:function(v){
        var _self = this,
          textEl = _self._getTextEl();
        if(v){
          textEl.attr('name',v);
        }
      },
      _uiSetWidth : function(v){
        var _self = this;
        if(v != null){
          var textEl = _self._getTextEl(),
            iconEl = _self.get('el').find('.x-icon'),
            appendWidth = textEl.outerWidth() - textEl.width(),
            picker = _self.get('picker'),
            width = v - iconEl.outerWidth() - appendWidth;
          textEl.width(width);
          if(_self.get('forceFit')){
            picker.set('width',v);
          }
          
        }
      },
      _getTextEl : function(){
         var _self = this,
          el = _self.get('el');
        return el.find('.' + _self.get('inputCls'));
      },
      /**
       * \u6790\u6784\u51fd\u6570
       */
      destructor:function(){
        var _self = this,
          picker = _self.get('picker');
        if(picker){
          picker.destroy();
        }
      },
      //\u83b7\u53d6List\u63a7\u4ef6
      _getList:function(){
        var _self = this,
          picker = _self.get('picker'),
          list = picker.get('list');
        return list;
      },
      /**
       * \u83b7\u53d6\u9009\u4e2d\u9879\u7684\u503c\uff0c\u5982\u679c\u662f\u591a\u9009\u5219\uff0c\u8fd4\u56de\u7684'1,2,3'\u5f62\u5f0f\u7684\u5b57\u7b26\u4e32
       * <pre><code>
       *  var value = select.getSelectedValue();
       * </code></pre>
       * @return {String} \u9009\u4e2d\u9879\u7684\u503c
       */
      getSelectedValue:function(){
        return this.get('picker').getSelectedValue();
      },
      /**
       * \u8bbe\u7f6e\u9009\u4e2d\u7684\u503c
       * <pre><code>
       * select.setSelectedValue('1'); //\u5355\u9009\u6a21\u5f0f\u4e0b
       * select.setSelectedValue('1,2,3'); //\u591a\u9009\u6a21\u5f0f\u4e0b
       * </code></pre>
       * @param {String} value \u9009\u4e2d\u7684\u503c
       */
      setSelectedValue : function(value){
        var _self = this,
          picker = _self.get('picker');
        picker.setSelectedValue(value);
      },
      /**
       * \u83b7\u53d6\u9009\u4e2d\u9879\u7684\u6587\u672c\uff0c\u5982\u679c\u662f\u591a\u9009\u5219\uff0c\u8fd4\u56de\u7684'text1,text2,text3'\u5f62\u5f0f\u7684\u5b57\u7b26\u4e32
       * <pre><code>
       *  var value = select.getSelectedText();
       * </code></pre>
       * @return {String} \u9009\u4e2d\u9879\u7684\u6587\u672c
       */
      getSelectedText:function(){
        return this.get('picker').getSelectedText();
      }
    },{
      ATTRS : 
      /**
       * @lends BUI.Select.Select#
       * @ignore
       */
      {

        /**
         * \u9009\u62e9\u5668\uff0c\u6d6e\u52a8\u51fa\u73b0\uff0c\u4f9b\u7528\u6237\u9009\u62e9
         * @cfg {BUI.Picker.ListPicker} picker
         * <pre><code>
         * var columns = [
         *       {title : '\u8868\u59341(30%)',dataIndex :'a', width:'30%'},
         *       {id: '123',title : '\u8868\u59342(30%)',dataIndex :'b', width:'30%'},
         *       {title : '\u8868\u59343(40%)',dataIndex : 'c',width:'40%'}
         *     ],   
         *   data = [{a:'123',b:'\u9009\u62e9\u6587\u672c1'},{a:'cdd',b:'\u9009\u62e9\u6587\u672c2'},{a:'1333',b:'\u9009\u62e9\u6587\u672c3',c:'eee',d:2}],
         *   grid = new Grid.SimpleGrid({
         *     idField : 'a', //\u8bbe\u7f6e\u4f5c\u4e3akey \u7684\u5b57\u6bb5\uff0c\u653e\u5230valueField\u4e2d
         *     columns : columns,
         *     textGetter: function(item){ //\u8fd4\u56de\u9009\u4e2d\u7684\u6587\u672c
         *       return item.b;
         *     }
         *   }),
         *   picker = new Picker.ListPicker({
         *     width:300,  //\u6307\u5b9a\u5bbd\u5ea6
         *     children : [grid] //\u914d\u7f6epicker\u5185\u7684\u5217\u8868
         *   }),
         *   select = new Select.Select({  
         *     render:'#s1',
         *     picker : picker,
         *     forceFit:false, //\u4e0d\u5f3a\u8feb\u5217\u8868\u8ddf\u9009\u62e9\u5668\u5bbd\u5ea6\u4e00\u81f4
         *     valueField:'#hide',
         *     items : data
         *   });
         * select.render();
         * </code></pre>
         */
        /**
         * \u9009\u62e9\u5668\uff0c\u6d6e\u52a8\u51fa\u73b0\uff0c\u4f9b\u7528\u6237\u9009\u62e9
         * @readOnly
         * @type {BUI.Picker.ListPicker}
         */
        picker:{

        },
        /**
         * \u5b58\u653e\u503c\u5f97\u5b57\u6bb5\uff0c\u4e00\u822c\u662f\u4e00\u4e2ainput[type='hidden'] ,\u7528\u4e8e\u5b58\u653e\u9009\u62e9\u6846\u7684\u503c
         * @cfg {Object} valueField
         */
        /**
         * @ignore
         */
        valueField : {

        },
        focusable:{
          value:true
        },
        /**
         * \u662f\u5426\u53ef\u4ee5\u591a\u9009
         * @cfg {Boolean} [multipleSelect=false]
         */
        /**
         * \u662f\u5426\u53ef\u4ee5\u591a\u9009
         * @type {Boolean}
         */
        multipleSelect:{
          value:false
        },
        /**
         * \u63a7\u4ef6\u7684name\uff0c\u7528\u4e8e\u5b58\u653e\u9009\u4e2d\u7684\u6587\u672c\uff0c\u4fbf\u4e8e\u8868\u5355\u63d0\u4ea4
         * @cfg {Object} name
         */
        /**
         * \u63a7\u4ef6\u7684name\uff0c\u4fbf\u4e8e\u8868\u5355\u63d0\u4ea4
         * @type {Object}
         */
        name:{

        },
        /**
         * \u9009\u9879
         * @cfg {Array} items
         * <pre><code>
         *  BUI.use('bui/select',function(Select){
         * 
         *   var items = [
         *         {text:'\u9009\u98791',value:'a'},
         *         {text:'\u9009\u98792',value:'b'},
         *         {text:'\u9009\u98793',value:'c'}
         *       ],
         *       select = new Select.Select({  
         *         render:'#s1',
         *         valueField:'#hide',
         *         //multipleSelect: true, //\u662f\u5426\u591a\u9009
         *         items:items
         *       });
         *   select.render();
         *   
         * });
         * </code></pre>
         */
        /**
         * \u9009\u9879
         * @type {Array}
         */
        items:{
          sync:false
        },
        /**
         * \u6807\u793a\u9009\u62e9\u5b8c\u6210\u540e\uff0c\u663e\u793a\u6587\u672c\u7684DOM\u8282\u70b9\u7684\u6837\u5f0f
         * @type {String}
         * @protected
         * @default 'bui-select-input'
         */
        inputCls:{
          value:CLS_INPUT
        },
        /**
         * \u662f\u5426\u4f7f\u9009\u62e9\u5217\u8868\u8ddf\u9009\u62e9\u6846\u540c\u7b49\u5bbd\u5ea6
         * <pre><code>
         *   picker = new Picker.ListPicker({
         *     width:300,  //\u6307\u5b9a\u5bbd\u5ea6
         *     children : [grid] //\u914d\u7f6epicker\u5185\u7684\u5217\u8868
         *   }),
         *   select = new Select.Select({  
         *     render:'#s1',
         *     picker : picker,
         *     forceFit:false, //\u4e0d\u5f3a\u8feb\u5217\u8868\u8ddf\u9009\u62e9\u5668\u5bbd\u5ea6\u4e00\u81f4
         *     valueField:'#hide',
         *     items : data
         *   });
         * select.render();
         * </code></pre>
         * @cfg {Boolean} [forceFit=true]
         */
        forceFit : {
          value : true
        },
        events : {
          value : {
            /**
             * \u9009\u62e9\u503c\u53d1\u751f\u6539\u53d8\u65f6
             * @event
             * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
             * @param {String} e.text \u9009\u4e2d\u7684\u6587\u672c
             * @param {String} e.value \u9009\u4e2d\u7684value
             * @param {Object} e.item \u53d1\u751f\u6539\u53d8\u7684\u9009\u9879
             */
            'change' : false
          }
        },
        /**
         * \u63a7\u4ef6\u7684\u9ed8\u8ba4\u6a21\u7248
         * @type {String}
         * @default 
         * '&lt;input type="text" readonly="readonly" class="bui-select-input"/&gt;&lt;span class="x-icon x-icon-normal"&gt;&lt;span class="bui-caret bui-caret-down"&gt;&lt;/span&gt;&lt;/span&gt;'
         */
        tpl : {
          view:true,
          value : '<input type="text" readonly="readonly" class="'+CLS_INPUT+'"/><span class="x-icon x-icon-normal"><span class="x-caret x-caret-down"></span></span>'
        },
        /**
         * \u89e6\u53d1\u7684\u4e8b\u4ef6
         * @cfg {String} triggerEvent
         * @default 'click'
         */
        triggerEvent:{
          value:'click'
        }  
      }
    },{
      xclass : 'select'
    });

  return select;

});/**
 * @fileOverview \u7ec4\u5408\u6846\u53ef\u7528\u4e8e\u9009\u62e9\u8f93\u5165\u6587\u672c
 * @ignore
 */

define('bui/select/combox',['bui/common','bui/select/select'],function (require) {

  var BUI = require('bui/common'),
    Select = require('bui/select/select'),
    CLS_INPUT = BUI.prefix + 'combox-input';

  function getFunction(textField,valueField,picker){
    var list = picker.get('list'),
      text = picker.getSelectedText();
    if(text){
      $(textField).val(text);
    }
  }

  /**
   * \u7ec4\u5408\u6846 \u7528\u4e8e\u63d0\u793a\u8f93\u5165
   * xclass:'combox'
   * <pre><code>
   * BUI.use('bui/select',function(Select){
   * 
   *  var select = new Select.Combox({
   *    render:'#c1',
   *    name:'combox',
   *    items:['\u9009\u98791','\u9009\u98792','\u9009\u98793','\u9009\u98794']
   *  });
   *  select.render();
   * });
   * </code></pre>
   * @class BUI.Select.Combox
   * @extends BUI.Select.Select
   */
  var combox = Select.extend({

    renderUI : function(){
      var _self = this,
        picker = _self.get('picker');

      picker.get('getFunction',getFunction);
    },
    _uiSetItems : function(v){
      var _self = this;

      for(var i = 0 ; i < v.length ; i++){
        var item = v[i];
        if(BUI.isString(item)){
          v[i] = {value:item,text:item};
        }
      }
      combox.superclass._uiSetItems.call(_self,v);
    }

  },{
    ATTRS : 
    /**
     * @lends BUI.Select.Combox#
     * @ignore
     */
    {
      /**
       * \u63a7\u4ef6\u7684\u6a21\u7248
       * @type {String}
       * @default  
       * '&lt;input type="text" class="'+CLS_INPUT+'"/&gt;'
       */
      tpl:{
        view:true,
        value:'<input type="text" class="'+CLS_INPUT+'"/>'
      },
      /**
       * \u663e\u793a\u9009\u62e9\u56de\u7684\u6587\u672cDOM\u8282\u70b9\u7684\u6837\u5f0f
       * @type {String}
       * @protected
       * @default 'bui-combox-input'
       */
      inputCls:{
        value:CLS_INPUT
      }
    }
  },{
    xclass:'combox'
  });

  return combox;
});/**
 * @fileOverview \u7ec4\u5408\u6846\u53ef\u7528\u4e8e\u9009\u62e9\u8f93\u5165\u6587\u672c
 * @ignore
 */

define('bui/select/suggest',['bui/common','bui/select/combox'],function (require) {
  'use strict';
  var BUI = require('bui/common'),
    Combox = require('bui/select/combox'),
    TIMER_DELAY = 200,
    EMPTY = '';

  /**
   * \u7ec4\u5408\u6846 \u7528\u4e8e\u63d0\u793a\u8f93\u5165
   * xclass:'suggest'
   * ** \u7b80\u5355\u4f7f\u7528\u9759\u6001\u6570\u636e **
   * <pre><code>
   * BUI.use('bui/select',function (Select) {
   *
   *  var suggest = new Select.Suggest({
   *     render:'#c2',
   *     name:'suggest', //\u5f62\u6210\u8f93\u5165\u6846\u7684name
   *     data:['1222224','234445','122','1111111']
   *   });
   *   suggest.render();
   *   
   * });
   * </code></pre>
   * ** \u67e5\u8be2\u670d\u52a1\u5668\u6570\u636e **
   * <pre><code>
   * BUI.use('bui/select',function(Select){
   *
   *  var suggest = new Select.Suggest({
   *    render:'#s1',
   *    name:'suggest', 
   *    url:'server-data.php'
   *  });
   *  suggest.render();
   *
   * });
   * <code></pre>
   * @class BUI.Select.Suggest
   * @extends BUI.Select.Combox
   */
  var suggest = Combox.extend({
    bindUI : function(){
      var _self = this,
        textEl = _self.get('el').find('input'),
        triggerEvent = (_self.get('triggerEvent') === 'keyup') ? 'keyup' : 'keyup click';

      //\u76d1\u542c keyup \u4e8b\u4ef6
      textEl.on(triggerEvent, function(){
        _self._start();
      });
    },
    //\u542f\u52a8\u8ba1\u65f6\u5668\uff0c\u5f00\u59cb\u76d1\u542c\u7528\u6237\u8f93\u5165
    _start:function(){
      var _self = this;
      _self._timer = _self.later(function(){
        _self._updateContent();
       // _self._timer = _self.later(arguments.callee, TIMER_DELAY);
      }, TIMER_DELAY);
    },
    //\u66f4\u65b0\u63d0\u793a\u5c42\u7684\u6570\u636e
    _updateContent:function(){
      var _self = this,
        isStatic = _self.get('data'),
        textEl = _self.get('el').find('input'),
        text;

      //\u68c0\u6d4b\u662f\u5426\u9700\u8981\u66f4\u65b0\u3002\u6ce8\u610f\uff1a\u52a0\u5165\u7a7a\u683c\u4e5f\u7b97\u6709\u53d8\u5316
      if (!isStatic && (textEl.val() === _self.get('query'))) {
        return;
      }

      _self.set('query', textEl.val());
      text = textEl.val();
      //\u8f93\u5165\u4e3a\u7a7a\u65f6,\u76f4\u63a5\u8fd4\u56de
      if (!isStatic && !text) {
        /*        _self.set('items',EMPTY_ARRAY);
        picker.hide();*/
        return;
      }

      //3\u79cd\u52a0\u8f7d\u65b9\u5f0f\u9009\u62e9
      var cacheable = _self.get('cacheable'),
        url = _self.get('url'),
        data = _self.get('data');

      if (cacheable && url) {
        var dataCache = _self.get('dataCache');
        if (dataCache[text] !== undefined) {
          //\u4ece\u7f13\u5b58\u8bfb\u53d6
          //BUI.log('use cache');
          _self._handleResponse(dataCache[text]);
        }else{
          //\u8bf7\u6c42\u670d\u52a1\u5668\u6570\u636e
          //BUI.log('no cache, data from server');
          _self._requestData();
        }
      }else if (url) {
        //\u4ece\u670d\u52a1\u5668\u83b7\u53d6\u6570\u636e
        //BUI.log('no cache, data always from server');
        _self._requestData();
      }else if (data) {
        //\u4f7f\u7528\u9759\u6001\u6570\u636e\u6e90
        //BUI.log('use static datasource');
        _self._handleResponse(data,true);
      }
    },
    //\u5982\u679c\u5b58\u5728\u6570\u636e\u6e90
    _getStore : function(){
      var _self = this,
        picker = _self.get('picker'),
        list = picker.get('list');
      if(list){
        return list.get('store');
      }
    },
    //\u901a\u8fc7 script \u5143\u7d20\u5f02\u6b65\u52a0\u8f7d\u6570\u636e
    _requestData:function(){
      var _self = this,
        textEl = _self.get('el').find('input'),
        callback = _self.get('callback'),
        store = _self.get('store'),
        param = {};

      param[textEl.attr('name')] = textEl.val();
      if(store){
        param.start = 0; //\u56de\u6eda\u5230\u7b2c\u4e00\u9875
        store.load(param,callback);
      }else{
        $.ajax({
          url:_self.get('url'),
          type:'post',
          dataType:_self.get('dataType'),
          data:param,
          success:function(data){
            _self._handleResponse(data);
            if(callback){
              callback(data);
            }
          }
        });
      }
      
    },
    //\u5904\u7406\u83b7\u53d6\u7684\u6570\u636e
    _handleResponse:function(data,filter){
      var _self = this,
        items = filter ? _self._getFilterItems(data) : data;
      _self.set('items',items);

      if(_self.get('cacheable')){
        _self.get('dataCache')[_self.get('query')] = items;
      }
    },
    //\u5982\u679c\u5217\u8868\u8bb0\u5f55\u662f\u5bf9\u8c61\u83b7\u53d6\u663e\u793a\u7684\u6587\u672c
    _getItemText : function(item){
      var _self = this,
        picker = _self.get('picker'),
        list = picker.get('list');
      if(list){
        return list.getItemText(item);
      }
      return '';
    },
    //\u83b7\u53d6\u8fc7\u6ee4\u7684\u6587\u672c
    _getFilterItems:function(data){
      var _self = this,
        result = [],
        textEl = _self.get('el').find('input'),
        text = textEl.val(),
        isStatic = _self.get('data');
      data = data || [];
      /**
       * @private
       * @ignore
       */
      function push(str,item){
        if(BUI.isString(item)){
          result.push(str);
        }else{
          result.push(item);
        }
      }
      BUI.each(data, function(item){
        var str = BUI.isString(item) ? item : _self._getItemText(item);
        if(isStatic){
          if(str.indexOf($.trim(text)) !== -1){
            push(str,item);
          }
        }else{
          push(str,item);
        }
      });
      
      return result;
    },
    /**
     * \u5ef6\u8fdf\u6267\u884c\u6307\u5b9a\u51fd\u6570 fn
     * @protected
     * @return {Object} \u64cd\u4f5c\u5b9a\u65f6\u5668\u7684\u5bf9\u8c61
     */
    later:function (fn, when, periodic) {
      when = when || 0;
      var r = periodic ? setInterval(fn, when) : setTimeout(fn, when);

      return {
        id:r,
        interval:periodic,
        cancel:function () {
          if (this.interval) {
            clearInterval(r);
          } else {
            clearTimeout(r);
          }
        }
      };
    }
  },{
    ATTRS : 
    /**
     * @lends BUI.Select.Suggest#
     * @ignore
     */
    {
      /**
       * \u7528\u4e8e\u663e\u793a\u63d0\u793a\u7684\u6570\u636e\u6e90
       * <pre><code>
       *   var suggest = new Select.Suggest({
       *     render:'#c2',
       *     name:'suggest', //\u5f62\u6210\u8f93\u5165\u6846\u7684name
       *     data:['1222224','234445','122','1111111']
       *   });
       * </code></pre>
       * @cfg {Array} data
       */
      /**
       * \u7528\u4e8e\u663e\u793a\u63d0\u793a\u7684\u6570\u636e\u6e90
       * @type {Array}
       * @ignore
       */
      data:{
        value : null
      },
      /**
       * \u8f93\u5165\u6846\u7684\u503c
       * @type {String}
       * @private
       */
      query:{
        value : EMPTY
      },
      /**
       * \u662f\u5426\u5141\u8bb8\u7f13\u5b58
       * @cfg {Boolean} cacheable
       * @default false
       */
      /**
       * \u662f\u5426\u5141\u8bb8\u7f13\u5b58
       * @type {Boolean}
       * @default false
       */
      cacheable:{
        value:false
      },
      /**
       * \u7f13\u5b58\u7684\u6570\u636e
       * @private
       */
      dataCache:{
        value:{}
      },
      /**
       * \u8bf7\u6c42\u8fd4\u56de\u7684\u6570\u636e\u683c\u5f0f\u9ed8\u8ba4\u4e3a'jsonp'
       * <pre><code>
       *  var suggest = new Select.Suggest({
       *    render:'#s1',
       *    name:'suggest', 
       *    dataType : 'json',
       *    url:'server-data.php'
       *  }); 
       * </code></pre>
       * @cfg {Object} [dataType = 'jsonp']
       */
      dataType : {
        value : 'jsonp'
      },
      /**
       * \u8bf7\u6c42\u6570\u636e\u7684url
       * <pre><code>
       *  var suggest = new Select.Suggest({
       *    render:'#s1',
       *    name:'suggest', 
       *    dataType : 'json',
       *    url:'server-data.php'
       *  }); 
       * </code></pre>
       * @cfg {String} url
       */
      url : {

      },
      /**
       * \u8bf7\u6c42\u5b8c\u6570\u636e\u7684\u56de\u8c03\u51fd\u6570
       * <pre><code>
       *  var suggest = new Select.Suggest({
       *    render:'#s1',
       *    name:'suggest', 
       *    dataType : 'json',
       *    callback : function(data){
       *      //do something
       *    },
       *    url:'server-data.php'
       *  }); 
       * </code></pre>
       * @type {Function}
       */
      callback : {

      },
      /**
       * \u89e6\u53d1\u7684\u4e8b\u4ef6
       * @cfg {String} triggerEvent
       * @default 'click'
       */
      triggerEvent:{
        valueFn:function(){
          if(this.get('data')){
            return 'click';
          }
          return 'keyup';
        }
      },
      /**
       * suggest\u4e0d\u63d0\u4f9b\u81ea\u52a8\u8bbe\u7f6e\u9009\u4e2d\u6587\u672c\u529f\u80fd
       * @type {Boolean}
       * @default true
       */
      autoSetValue:{
        value:false
      }
    }
  },{
    xclass:'suggest'
  });

  return suggest;
});/**
 * @fileOverview Mask\u7684\u5165\u53e3\u6587\u4ef6
 * @ignore
 */

define('bui/mask',['bui/common','bui/mask/mask','bui/mask/loadmask'],function (require) {
  var BUI = require('bui/common'),
    Mask = require('bui/mask/mask');
  Mask.LoadMask = require('bui/mask/loadmask');
  return Mask;
});/**
 * @fileOverview Mask\u5c4f\u853d\u5c42
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/mask/mask',['bui/common'],function (require) {

    var BUI = require('bui/common'),
      Mask = BUI.namespace('Mask'),
      UA = BUI.UA,
      CLS_MASK = BUI.prefix + 'ext-mask',
      CLS_MASK_MSG = CLS_MASK + '-msg';

    BUI.mix(Mask,
    /**
    * \u5c4f\u853d\u5c42
    * <pre><code>
    * BUI.use('bui/mask',function(Mask){
    *   Mask.maskElement('#domId'); //\u5c4f\u853ddom
    *   Mask.unmaskElement('#domId'); //\u89e3\u9664DOM\u5c4f\u853d
    * });
    * </code></pre>
    * @class BUI.Mask
    * @singleton
    */
    {
        /**
         * @description \u5c4f\u853d\u6307\u5b9a\u5143\u7d20
         * @param {String|HTMLElement} element \u88ab\u5c4f\u853d\u7684\u5143\u7d20
         * @param {String} [msg] \u5c4f\u853d\u5143\u7d20\u65f6\u663e\u793a\u7684\u6587\u672c
         * @param {String} [msgCls] \u663e\u793a\u6587\u672c\u5e94\u7528\u7684\u6837\u5f0f
         * <pre><code>
         *   BUI.Mask.maskElement('#domId');
         *   
         * </code></pre>
         */
        maskElement:function (element, msg, msgCls) {
            var maskedEl = $(element),
                maskDiv = $('.' + CLS_MASK, maskedEl),
                tpl = null,
                msgDiv = null,
                top = null,
                left = null;
            if (!maskDiv.length) {
                maskDiv = $('<div class="' + CLS_MASK + '"></div>').appendTo(maskedEl);
                maskedEl.addClass('x-masked-relative x-masked');
                if (UA.ie === 6) {
                    maskDiv.height(maskedEl.height());
                }
                if (msg) {
                    tpl = ['<div class="' + CLS_MASK_MSG + '"><div>', msg, '</div></div>'].join('');
                    msgDiv = $(tpl).appendTo(maskedEl);
                    if (msgCls) {
                        msgDiv.addClass(msgCls);
                    }
                    try {
                        top = (maskedEl.height() - msgDiv.height()) / 2;
                        left = (maskedEl.width() - msgDiv.width()) / 2;

                        msgDiv.css({ left:left, top:top });
                    } catch (ex) {
                        BUI.log('mask error occurred');
                    }
                }
            }
            return maskDiv;
        },
        /**
         * @description \u89e3\u9664\u5143\u7d20\u7684\u5c4f\u853d
         * @param {String|HTMLElement} \u5c4f\u853d\u7684\u5143\u7d20
         * <pre><code>
         * BUI.Mask.unmaskElement('#domId');
         * </code></pre>
         */
        unmaskElement:function (element) {
            var maskedEl = $(element),
                msgEl = maskedEl.children('.' + CLS_MASK_MSG),
                maskDiv = maskedEl.children('.' + CLS_MASK);
            if (msgEl) {
                msgEl.remove();
            }
            if (maskDiv) {
                maskDiv.remove();
            }
            maskedEl.removeClass('x-masked-relative x-masked');

        }
    });
    
    return Mask;
});/**
 * @fileOverview \u52a0\u8f7d\u6570\u636e\u65f6\u5c4f\u853d\u5c42
 * @ignore
 */

define('bui/mask/loadmask',['bui/mask/mask'],function (require) {
  
  var Mask = require('bui/mask/mask');

   /**
     * \u5c4f\u853d\u6307\u5b9a\u5143\u7d20\uff0c\u5e76\u663e\u793a\u52a0\u8f7d\u4fe1\u606f
     * <pre></code>
     * BUI.use('bui/mask',function(Mask){
     *    var loadMask = new Mask.LoadMask({
     *        el : '#domId',
     *        msg : 'loading ....'
     *    });
     *
     *    $('#btn').on('click',function(){
     *        loadMask.show();
     *    });
     *
     *    $('#btn1').on('click',function(){
     *        loadMask.hide();
     *    });
     * });
     * </code></pre>
     * @class BUI.Mask.LoadMask
     * @extends BUI.Base
     */
    function LoadMask(config) {
        var _self = this;
        LoadMask.superclass.constructor.call(_self, config);
    }

    BUI.extend(LoadMask, BUI.Base);

    LoadMask.ATTRS = {
        /**
         * \u5c4f\u853d\u7684\u5143\u7d20
         * <pre></code>
         *    var loadMask = new Mask.LoadMask({
         *        el : '#domId'
         *    });
         * </code></pre>
         * @cfg {jQuery} el
         */
        el : {

        },
        /**
         * \u52a0\u8f7d\u65f6\u663e\u793a\u7684\u52a0\u8f7d\u4fe1\u606f
         * <pre></code>
         *    var loadMask = new Mask.LoadMask({
         *        el : '#domId',
         *        msg : '\u6b63\u5728\u52a0\u8f7d\uff0c\u8bf7\u7a0d\u540e\u3002\u3002\u3002'
         *    });
         * </code></pre>
         * @cfg {String} msg [msg = 'Loading...']
         */
        msg:{
            value : 'Loading...'
        },
        /**
         * \u52a0\u8f7d\u65f6\u663e\u793a\u7684\u52a0\u8f7d\u4fe1\u606f\u7684\u6837\u5f0f
         * <pre></code>
         *    var loadMask = new Mask.LoadMask({
         *        el : '#domId',
         *        msgCls : 'custom-cls'
         *    });
         * </code></pre>
         * @cfg {String} [msgCls = 'x-mask-loading']
         */
        msgCls:{
            value : 'x-mask-loading'
        },
        /**
         * \u52a0\u8f7d\u63a7\u4ef6\u662f\u5426\u7981\u7528
         * @type {Boolean}
         * @field
         * @default false
         * @ignore
         */
        disabled:{
           value : false
        }
    };

    //\u5bf9\u8c61\u539f\u578b
    BUI.augment(LoadMask,
    /** 
    * @lends BUI.Mask.LoadMask.prototype 
    * @ignore
    */
    {
        
        /**
         * \u8bbe\u7f6e\u63a7\u4ef6\u4e0d\u53ef\u7528
         */
        disable:function () {
            this.set('disabled',true);
        },
        /**
         * @private \u52a0\u8f7d\u5df2\u7ecf\u5b8c\u6bd5\uff0c\u89e3\u9664\u5c4f\u853d
         */
        onLoad:function () {
            Mask.unmaskElement(this.get('el'));
        },
        /**
         * @private \u5f00\u59cb\u52a0\u8f7d\uff0c\u5c4f\u853d\u5f53\u524d\u5143\u7d20
         */
        onBeforeLoad:function () {
            var _self = this;
            if (!_self.get('disabled')) {
                Mask.maskElement(_self.get('el'), _self.get('msg'), this.get('msgCls'));
            }
        },
        /**
         * \u663e\u793a\u52a0\u8f7d\u6761\uff0c\u5e76\u906e\u76d6\u5143\u7d20
         */
        show:function () {
            this.onBeforeLoad();
        },

        /**
         * \u9690\u85cf\u52a0\u8f7d\u6761\uff0c\u5e76\u89e3\u9664\u906e\u76d6\u5143\u7d20
         */
        hide:function () {
            this.onLoad();
        },

        /*
         * \u6e05\u7406\u8d44\u6e90
         */
        destroy:function () {
            this.hide();
            this.clearAttrVals();
            this.off();
        }
    });

    return LoadMask;
});/**
 * @fileOverview \u83dc\u5355\u547d\u540d\u7a7a\u95f4\u5165\u53e3\u6587\u4ef6
 * @ignore
 */

define('bui/menu',['bui/common','bui/menu/menu','bui/menu/menuitem','bui/memu/contextmenu','bui/menu/popmenu','bui/menu/sidemenu'],function (require) {
  
  var BUI = require('bui/common'),
    Menu = BUI.namespace('Menu');
  BUI.mix(Menu,{
    Menu : require('bui/menu/menu'),
    MenuItem : require('bui/menu/menuitem'),
    ContextMenu : require('bui/memu/contextmenu'),
    PopMenu : require('bui/menu/popmenu'),
    SideMenu : require('bui/menu/sidemenu')
  });

  Menu.ContextMenuItem = Menu.ContextMenu.Item;
  return Menu;
});/**
 * @fileOverview \u83dc\u5355\u9879
 * @ignore
 */
define('bui/menu/menuitem',['bui/common'],function(require){

  var BUI = require('bui/common'),
      Component =  BUI.Component,
      UIBase = Component.UIBase,
      PREFIX = BUI.prefix,
      CLS_OPEN = PREFIX + 'menu-item-open',
      CLS_CARET = 'x-caret',
      CLS_COLLAPSE = PREFIX + 'menu-item-collapsed',
      DATA_ID = 'data-id';

  /**
   * @private
   * @class BUI.Menu.MenuItemView
   * @mixins BUI.Component.UIBase.ListItemView
   * @mixins BUI.Component.UIBase.CollapseableView
   * \u83dc\u5355\u9879\u7684\u89c6\u56fe\u7c7b
   */
  var menuItemView = Component.View.extend([UIBase.ListItemView,UIBase.CollapseableView],{

    _uiSetOpen : function (v) {
      var _self = this,
        cls = _self.getStatusCls('open');
      if(v){
        _self.get('el').addClass(cls);
      }else{
        _self.get('el').removeClass(cls);
      }
    }
  },{
    ATTRS : {
    }
  },{
    xclass:'menu-item-view'
  });

  /**
   * \u83dc\u5355\u9879
   * @class BUI.Menu.MenuItem
   * @extends BUI.Component.Controller
   * @mixins BUI.Component.UIBase.ListItem
   */
  var menuItem = Component.Controller.extend([UIBase.ListItem,UIBase.Collapseable],{
    /**
     * \u6e32\u67d3
     * @protected
     */
    renderUI : function(){
      var _self = this,
        el = _self.get('el'),
        id = _self.get('id'),
        temp = null;
      //\u672a\u8bbe\u7f6eid\u65f6\u81ea\u52a8\u751f\u6210
      if(!id){
        id = BUI.guid('menu-item');
        _self.set('id',id);
      }
      el.attr(DATA_ID,id);   
    },
     /**
     * \u5904\u7406\u9f20\u6807\u79fb\u5165
     * @protected
     */
    handleMouseEnter : function (ev) {
      var _self = this;
      if(this.get('subMenu')){
        this.set('open',true);
      }
      menuItem.superclass.handleMouseEnter.call(this,ev);
    },
    /**
     * \u5904\u7406\u9f20\u6807\u79fb\u51fa
     * @protected
     */
    handleMouseLeave :function (ev) {
      var _self = this,
        subMenu = _self.get('subMenu'),
        toElement = ev.toElement;
      if(toElement && subMenu && subMenu.containsElement(toElement)){
        _self.set('open',true);
      }else{
        _self.set('open',false);
      }
      menuItem.superclass.handleMouseLeave.call(this,ev);
    },
    /**
     * \u81ea\u5df1\u548c\u5b50\u83dc\u5355\u662f\u5426\u5305\u542b
     * @override
     */
    containsElement:function (elem) {
      var _self = this,
        subMenu,
        contains = menuItem.superclass.containsElement.call(_self,elem);
      if(!contains){
        subMenu = _self.get('subMenu');
        contains = subMenu && subMenu.containsElement(elem);
      }
      return contains;
    }, 
    //\u8bbe\u7f6e\u6253\u5f00\u5b50\u83dc\u5355 
    _uiSetOpen : function (v) {
      var _self = this,
        subMenu = _self.get('subMenu'),
        subMenuAlign = _self.get('subMenuAlign');
      if(subMenu){
        if(v){
          subMenuAlign.node = _self.get('el');
          subMenu.set('align',subMenuAlign);
          subMenu.show();
        }else{
          var menuAlign = subMenu.get('align');
          //\u9632\u6b62\u5b50\u83dc\u5355\u88ab\u516c\u7528\u65f6
          if(!menuAlign || menuAlign.node == _self.get('el')){
            subMenu.hide();
          }
          
        }
      }
    },
    //\u8bbe\u7f6e\u4e0b\u7ea7\u83dc\u5355
    _uiSetSubMenu : function (subMenu) {
      if(subMenu){
        var _self = this,
          el = _self.get('el'),
          parent = _self.get('parent');
        //\u8bbe\u7f6e\u83dc\u5355\u9879\u6240\u5c5e\u7684\u83dc\u5355\u4e3a\u4e0a\u4e00\u7ea7\u83dc\u5355
        if(!subMenu.get('parentMenu')){
          subMenu.set('parentMenu',parent);
          if(parent.get('autoHide')){
            subMenu.set('autoHide',false);
          } 
        }
        $(_self.get('arrowTpl')).appendTo(el);
      }
    },
    /** 
     * \u6790\u6784\u51fd\u6570
     * @protected
     */
    destructor : function () {
      var _self = this,
        subMenu = _self.get('subMenu');
      if(subMenu){
        subMenu.destroy();
      }
    }

  },{
    ATTRS : 
    /**
     * @lends BUI.Menu.MenuItem#
     * @ignore
     */
    {
      /**
       * \u9ed8\u8ba4\u7684Html \u6807\u7b7e
       * @type {String}
       */
      elTagName : {
          value: 'li'
      },
      xview : {
        value : menuItemView
      },
      /**
       * \u83dc\u5355\u9879\u662f\u5426\u5c55\u5f00\uff0c\u663e\u793a\u5b50\u83dc\u5355
       * @cfg {Boolean} [open=false]
       */
      /**
       * \u83dc\u5355\u9879\u662f\u5426\u5c55\u5f00\uff0c\u663e\u793a\u5b50\u83dc\u5355
       * @type {Boolean}
       * @default false
       */
      open :{
        view : true,
        value : false
      },
      /**
       * \u4e0b\u7ea7\u83dc\u5355
       * @cfg {BUI.Menu.Menu} subMenu
       */
      /**
       * \u4e0b\u7ea7\u83dc\u5355
       * @type {BUI.Menu.Menu}
       */
      subMenu : {
        view : true
      },
       /**
       * \u4e0b\u7ea7\u83dc\u5355\u548c\u83dc\u5355\u9879\u7684\u5bf9\u9f50\u65b9\u5f0f
       * @type {Object}
       * @protected
       * @default \u9ed8\u8ba4\u5728\u4e0b\u9762\u663e\u793a
       */
      subMenuAlign : {
        valueFn : function (argument) {
          return {
             //node: this.get('el'), // \u53c2\u8003\u5143\u7d20, falsy \u6216 window \u4e3a\u53ef\u89c6\u533a\u57df, 'trigger' \u4e3a\u89e6\u53d1\u5143\u7d20, \u5176\u4ed6\u4e3a\u6307\u5b9a\u5143\u7d20
             points: ['tr','tl'], // ['tr', 'tl'] \u8868\u793a overlay \u7684 tl \u4e0e\u53c2\u8003\u8282\u70b9\u7684 tr \u5bf9\u9f50
             offset: [-5, 0]      // \u6709\u6548\u503c\u4e3a [n, m]
          }
        }
      },
      /**
       * \u5f53\u5b58\u5728\u5b50\u83dc\u5355\u65f6\u7684\u7bad\u5934\u6a21\u7248
       * @protected
       * @type {String}
       */
      arrowTpl : {
        value : '<span class="' + CLS_CARET + ' ' + CLS_CARET + '-left"></span>'
      },
      events : {
        value : {
          'afterOpenChange' : true
        }
      }
    }
  },{
    xclass : 'menu-item',
    priority : 0
  });

  var separator = menuItem.extend({

  },{
    ATTRS : {
      focusable : {
        value : false
      },
      selectable:{
        value : false
      },
      handleMouseEvents:{
        value:false
      }
    }
  },{
    xclass:'menu-item-sparator'
  });

  menuItem.View = menuItemView;
  menuItem.Separator = separator;
  
  return menuItem;
});/**
 * @fileOverview \u83dc\u5355\u57fa\u7c7b
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/menu/menu',['bui/common'],function(require){

  var BUI = require('bui/common'),
    Component =  BUI.Component,
    UIBase = Component.UIBase;

  /**
   * \u83dc\u5355\u7684\u89c6\u56fe\u7c7b
   * @class BUI.Menu.MenuView
   * @extends BUI.Component.View
   * @mixins BUI.Component.UIBase.PositionView
   * @private
   */
  var menuView = Component.View.extend([UIBase.PositionView],{
    
  });

  /**
   * \u83dc\u5355
   * xclass:'menu'
   * <img src="../assets/img/class-menu.jpg"/>
   * @class BUI.Menu.Menu
   * @extends BUI.Component.Controller
   * @mixins BUI.Component.UIBase.ChildList
   * @mixins BUI.Component.UIBase.Position
   * @mixins BUI.Component.UIBase.Align
   * @mixins BUI.Component.UIBase.AutoHide
   */
  var Menu = Component.Controller.extend([UIBase.Position,UIBase.Align,UIBase.ChildList,UIBase.AutoHide],{
	  /**
     * \u7ed1\u5b9a\u4e8b\u4ef6
     * @protected
     */
	  bindUI:function(){
      var _self = this;

      _self.on('click',function(e){
        var item = e.target,
          multipleSelect = _self.get('multipleSelect');
        if(_self != item){
          //\u5355\u9009\u60c5\u51b5\u4e0b\uff0c\u5141\u8bb8\u81ea\u52a8\u9690\u85cf\uff0c\u4e14\u6ca1\u6709\u5b50\u83dc\u5355\u7684\u60c5\u51b5\u4e0b\uff0c\u83dc\u5355\u9690\u85cf
          if(!multipleSelect && _self.get('clickHide') && !item.get('subMenu')){
            _self.getTopAutoHideMenu().hide();
          }
        }
      });

      _self.on('afterOpenChange',function (ev) {
        var target = ev.target,
          opened = ev.newVal,
          children = _self.get('children');
        if(opened){
          BUI.each(children,function(item) {
            if(item !== target && item.get('open')){
              item.set('open',false);
            }
          });
        }
      });

      _self.on('afterVisibleChange',function (ev) {
        var visible = ev.newVal,
          parent = _self.get('parentMenu');
        _self._clearOpen();
      });
    },
   
    //\u70b9\u51fb\u81ea\u52a8\u9690\u85cf\u65f6
    getTopAutoHideMenu : function() {
      var _self = this,
        parentMenu = _self.get('parentMenu'),
        topHideMenu;
      if(parentMenu && parentMenu.get('autoHide')){
        return parentMenu.getTopAutoHideMenu();
      }
      if(_self.get('autoHide')){
        return _self;
      }
      return null;
    },
    //\u6e05\u9664\u83dc\u5355\u9879\u7684\u6fc0\u6d3b\u72b6\u6001
    _clearOpen : function () {
      var _self = this,
        children = _self.get('children');
      BUI.each(children,function (item) {
        if(item.set){
          item.set('open',false);
        }
      });
    },
    /**
     * \u6839\u636eID\u67e5\u627e\u83dc\u5355\u9879
     * @param  {String} id \u7f16\u53f7
     * @return {BUI.Menu.MenuItem} \u83dc\u5355\u9879
     */
    findItemById : function(id){ 

      return this.findItemByField('id',id);
    },
    _uiSetSelectedItem : function(item){
      if(item){
        _self.setSelected(item);
      }
    }
  },{
    ATTRS:
    /**
     * @lends BUI.Menu.Menu#
     * @ignore
     */
    {

      elTagName:{
        view : true,
        value : 'ul'
      },
		  idField:{
        value:'id'
      },
      /**
       * \u5b50\u7c7b\u7684\u9ed8\u8ba4\u7c7b\u540d\uff0c\u5373\u7c7b\u7684 xclass
       * @type {String}
       * @default 'menu-item'
       */
      defaultChildClass : {
        value : 'menu-item'
      },
      /**
       * \u9009\u4e2d\u7684\u83dc\u5355\u9879
       * @type {Object}
       */
      selectedItem : {

      },
      /**
       * \u70b9\u51fb\u6216\u79fb\u51fa\u83dc\u5355\u5916\u65f6\uff0c\u83dc\u5355\u662f\u5426\u9690\u85cf
       * @type {Boolean} 
       * @protected
       */
      autoHide : {
        value : false
      },
      /**
       * \u70b9\u51fb\u83dc\u5355\u65f6\uff0c\u83dc\u5355\u662f\u5426\u9690\u85cf\uff0c\u591a\u9009\u65f6\u4e0d\u9690\u85cf
       * @type {Boolean} 
       * @protected
       */
      clickHide : {
        value : false
      },
      /**
       * \u4e0a\u4e00\u7ea7\u83dc\u5355
       * @type {BUI.Menu.Menu}
       * @readOnly
       */
      parentMenu : {

      },
      xview:{
        value:menuView
      }
    }
    
  },{
    xclass : 'menu',
    priority : 0
  });
  
  Menu.View = menuView;
  return Menu;
});/**
 * @fileOverview \u4e0b\u62c9\u83dc\u5355\uff0c\u4e00\u822c\u7528\u4e8e\u4e0b\u62c9\u663e\u793a\u83dc\u5355
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/menu/popmenu',['bui/common','bui/menu/menu'],function (require) {

  var BUI = require('bui/common'),
    UIBase = BUI.Component.UIBase,
    Menu = require('bui/menu/menu');

   /**
   * @class BUI.Menu.PopMenu
   * \u4e0a\u4e0b\u6587\u83dc\u5355\uff0c\u4e00\u822c\u7528\u4e8e\u5f39\u51fa\u83dc\u5355
   * xclass:'drop-menu'
   * @extends BUI.Menu.Menu
   * @mixins BUI.Component.UIBase.AutoShow
   */
  var popMenu =  Menu.extend([UIBase.AutoShow],{

  },{
    ATTRS:{
       /** \u70b9\u51fb\u83dc\u5355\u9879\uff0c\u5982\u679c\u83dc\u5355\u4e0d\u662f\u591a\u9009\uff0c\u83dc\u5355\u9690\u85cf
       * @type {Boolean} 
       * @default true
       */
      clickHide : {
        value : true
      },
      align : {
        value : {
           points: ['bl','tl'], // ['tr', 'tl'] \u8868\u793a overlay \u7684 tl \u4e0e\u53c2\u8003\u8282\u70b9\u7684 tr \u5bf9\u9f50
           offset: [0, 0]      // \u6709\u6548\u503c\u4e3a [n, m]
        }
      },
      visibleMode : {
        value : 'visibility'
      },
      /**
       * \u70b9\u51fb\u83dc\u5355\u5916\u9762\uff0c\u83dc\u5355\u9690\u85cf
       * \u70b9\u51fb\u83dc\u5355\u9879\uff0c\u5982\u679c\u83dc\u5355\u4e0d\u662f\u591a\u9009\uff0c\u83dc\u5355\u9690\u85cf
       * @type {Boolean} 
       * @default true
       */
      autoHide : {
        value : true
      },
      visible : {
        value : false
      }
    }
  },{
    xclass:'pop-menu'
  });
  
  return popMenu;

});/**
 * @fileOverview \u5f39\u51fa\u83dc\u5355\uff0c\u4e00\u822c\u7528\u4e8e\u53f3\u952e\u83dc\u5355
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/memu/contextmenu',['bui/common','bui/menu/menuitem','bui/menu/popmenu'],function (require) {

  var BUI = require('bui/common'),
    MenuItem = require('bui/menu/menuitem'),
    PopMenu = require('bui/menu/popmenu'),
    PREFIX = BUI.prefix,
    CLS_Link = PREFIX + 'menu-item-link',
    CLS_ITEM_ICON =  PREFIX + 'menu-item-icon',
    Component = BUI.Component,
    UIBase = Component.UIBase;

  /**
   * \u4e0a\u4e0b\u6587\u83dc\u5355\u9879
   * xclass:'context-menu-item'
   * @class BUI.Menu.ContextMenuItem 
   * @extends BUI.Menu.MenuItem
   */
  var contextMenuItem = MenuItem.extend({
   
    bindUI:function(){
      var _self = this;

      _self.get('el').delegate('.' + CLS_Link,'click',function(ev){
        ev.preventDefault();
      });
    }, 
    //\u8bbe\u7f6e\u56fe\u6807\u6837\u5f0f
    _uiSetIconCls : function (v,ev) {
      var _self = this,
        preCls = ev.prevVal,
        iconEl = _self.get('el').find('.'+CLS_ITEM_ICON);
      iconEl.removeClass(preCls);
      iconEl.addClass(v);
    }
  },{

    ATTRS:
    /**
     * @lends BUI.Menu.MenuItem#
     * @ignore
     */
    {
      /**
       * \u663e\u793a\u7684\u6587\u672c
       * @type {String}
       */
      text:{
        veiw:true,
        value:''
      },
      /**
       * \u83dc\u5355\u9879\u56fe\u6807\u7684\u6837\u5f0f
       * @type {String}
       */
      iconCls:{
        sync:false,
        value:''
      },
      tpl:{
        value:'<a class="' + CLS_Link + '" href="#">\
        <span class="' + CLS_ITEM_ICON + ' {iconCls}"></span><span class="' + PREFIX + 'menu-item-text">{text}</span></a>'
      }
    }
  },{
    xclass:'context-menu-item'
  });

  /**
   * \u4e0a\u4e0b\u6587\u83dc\u5355\uff0c\u4e00\u822c\u7528\u4e8e\u5f39\u51fa\u83dc\u5355
   * xclass:'context-menu'
   * @class BUI.Menu.ContextMenu
   * @extends BUI.Menu.PopMenu
   */
  var contextMenu = PopMenu.extend({

  },{
    ATTRS:{
      /**
       * \u5b50\u7c7b\u7684\u9ed8\u8ba4\u7c7b\u540d\uff0c\u5373\u7c7b\u7684 xclass
       * @type {String}
       * @override
       * @default 'menu-item'
       */
      defaultChildClass : {
        value : 'context-menu-item'
      },
      align : {
        value : null
      }
    }
  },{
    xclass:'context-menu'
  });

  contextMenu.Item = contextMenuItem;
  return contextMenu;
});
/**
 * @fileOverview \u4fa7\u8fb9\u680f\u83dc\u5355
 * @author dxq613@gmail.com
 * @ignore
 */
define('bui/menu/sidemenu',['bui/common','bui/menu/menu'],function(require){

  var BUI = require('bui/common'),
    Menu = require('bui/menu/menu'),
    Component =  BUI.Component,
    CLS_MENU_TITLE = BUI.prefix + 'menu-title',
    CLS_MENU_LEAF = 'menu-leaf';
    
  /**
   * \u4fa7\u8fb9\u680f\u83dc\u5355
   * xclass:'side-menu'
   * @class BUI.Menu.SideMenu
   * @extends BUI.Menu.Menu
   */
  var sideMenu = Menu.extend(
  /**
   * @lends BUI.Menu.SideMenu.prototype
   * @ignore
   */
  {
    //\u521d\u59cb\u5316\u914d\u7f6e\u9879
    initializer : function(){
      var _self = this,
        items = _self.get('items'),
        children = _self.get('children');

      BUI.each(items,function(item){
        var menuCfg = _self._initMenuCfg(item);
        children.push(menuCfg);
      });
    },
    bindUI : function(){
      var _self = this,
        children = _self.get('children');
      BUI.each(children,function(item){
        var menu = item.get('children')[0];
        if(menu){
          menu.publish('click',{
            bubbles:1
          });
        }
      });
      //\u9632\u6b62\u94fe\u63a5\u8df3\u8f6c
      _self.get('el').delegate('a','click',function(ev){
        ev.preventDefault();
      });
      //\u5904\u7406\u70b9\u51fb\u4e8b\u4ef6\uff0c\u5c55\u5f00\u3001\u6298\u53e0\u3001\u9009\u4e2d
      _self.on('itemclick',function(ev){
        var item = ev.item,
          titleEl = $(ev.domTarget).closest('.' + CLS_MENU_TITLE);
        if(titleEl.length){
          var collapsed = item.get('collapsed');
            item.set('collapsed',!collapsed);
        }else if(item.get('el').hasClass(CLS_MENU_LEAF)){
          _self.fire('menuclick',{item:item});
          _self.clearSelection();
          _self.setSelected(item);
        }
      });
    },
    /**
     * @protected
     * @ignore
     */
    getItems:function(){
      var _self = this,
        items = [],
        children = _self.get('children');
      BUI.each(children,function(item){
        var menu = item.get('children')[0];
        items = items.concat(menu.get('children'));
      }); 
      return items;
    },
    //\u521d\u59cb\u5316\u83dc\u5355\u914d\u7f6e\u9879
    _initMenuCfg : function(item){
      var _self = this,
        items = item.items,
        subItems = [],
        cfg = {
          xclass : 'menu-item',
          elCls : 'menu-second',
          collapsed : item.collapsed,
          selectable: false,
          children : [{
            xclass : 'menu',
            children : subItems
          }],
          content: '<div class="'+CLS_MENU_TITLE+'"><s></s><span class="'+CLS_MENU_TITLE+'-text">'+item.text+'</span></div>'
        };
      BUI.each(items,function(subItem){
        var subItemCfg = _self._initSubMenuCfg(subItem);
        subItems.push(subItemCfg);
      });

      return cfg;

    },
    //\u521d\u59cb\u5316\u4e8c\u7ea7\u83dc\u5355
    _initSubMenuCfg : function(subItem){
      var _self = this,
        cfg = {
          xclass : 'menu-item',
          elCls : 'menu-leaf',
          tpl : '<a href="{href}"><em>{text}</em></a>'
        };
      return BUI.mix(cfg,subItem);
    }
  },{

    ATTRS : 
    /**
     * @lends BUI.Menu.SideMenu.prototype
     * @ignore
     */
    {
      
      /**
       * \u914d\u7f6e\u7684items \u9879\u662f\u5728\u521d\u59cb\u5316\u65f6\u4f5c\u4e3achildren
       * @protected
       * @type {Boolean}
       */
      autoInitItems : {
          value : false
      },
      events : {
        value : {
          /**
           * \u70b9\u51fb\u83dc\u5355\u9879
		       * @name BUI.Menu.SideMenu#menuclick
           * @event 
           * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
           * @param {Object} e.item \u5f53\u524d\u9009\u4e2d\u7684\u9879
           */
          'menuclick' : false
        }
      }
    }
  },{
    xclass :'side-menu'
  });

  return sideMenu;
});/**
 * @fileOverview \u5207\u6362\u6807\u7b7e\u5165\u53e3
 * @ignore
 */

define('bui/tab',['bui/common','bui/tab/tab','bui/tab/tabitem','bui/tab/navtabitem','bui/tab/navtab','bui/tab/tabpanel','bui/tab/tabpanelitem'],function (require) {
  var BUI = require('bui/common'),
    Tab = BUI.namespace('Tab');

  BUI.mix(Tab,{
    Tab : require('bui/tab/tab'),
    TabItem : require('bui/tab/tabitem'),
    NavTabItem : require('bui/tab/navtabitem'),
    NavTab : require('bui/tab/navtab'),
    TabPanel : require('bui/tab/tabpanel'),
    TabPanelItem : require('bui/tab/tabpanelitem')
  });

  return Tab;
});/**
 * @fileOverview \u5bfc\u822a\u9879
 * @author dxq613@gmail.com
 * @ignore
 */
define('bui/tab/navtabitem',['bui/common'],function(requrie){

  var BUI = requrie('bui/common'),
    Component =  BUI.Component,
    CLS_ITEM_TITLE = 'tab-item-title',
    CLS_ITEM_CLOSE = 'tab-item-close',
    CLS_NAV_ACTIVED = 'tab-nav-actived',
    CLS_CONTENT = 'tab-content';

  /**
   * \u5bfc\u822a\u6807\u7b7e\u9879\u7684\u89c6\u56fe\u7c7b
   * @class BUI.Tab.NavTabItemView
   * @extends BUI.Component.View
   * @private
   */
  var navTabItemView =  Component.View.extend({
    renderUI : function(){
      var _self = this,
        contentContainer = _self.get('tabContentContainer'),
        contentTpl = _self.get('tabContentTpl');
      if(contentContainer){
        var tabContentEl = $(contentTpl).appendTo(contentContainer);
        _self.set('tabContentEl',tabContentEl);
      }
    },
    //\u8bbe\u7f6e\u94fe\u63a5\u5730\u5740
    _uiSetHref : function(v){
      this._setHref(v);
    },
    _setHref : function(href){
      var _self = this,
        tabContentEl = _self.get('tabContentEl');
      href = href || _self.get('href');
      if(tabContentEl){
        $('iframe',tabContentEl).attr('src',href);
      }
    },
    resetHref : function(){
      this._setHref();
    },
    //\u8bbe\u7f6e\u6807\u9898
    _uiSetTitle : function(v){
      var _self = this,
        el = _self.get('el');
      el.attr('title',v);
      $('.' + CLS_ITEM_TITLE,el).text(v);
    },
    _uiSetActived : function(v){
      var _self = this,
        el = _self.get('el');

      _self.setTabContentVisible(v);
      if(v){
        el.addClass(CLS_NAV_ACTIVED);
      }else{
        el.removeClass(CLS_NAV_ACTIVED);
      }

    },
    //\u6790\u6784\u51fd\u6570
    destructor : function(){
      var _self = this,
        tabContentEl = _self.get('tabContentEl');
      if(tabContentEl){
        tabContentEl.remove();
      }
    },
    //\u8bbe\u7f6e\u6807\u7b7e\u5185\u5bb9\u662f\u5426\u53ef\u89c1
    setTabContentVisible : function(v){
      var _self = this,
        tabContentEl = _self.get('tabContentEl');

      if(tabContentEl){
        if(v){
          tabContentEl.show();
        }else{
          tabContentEl.hide();
        }
      }
    }

  },{

    ATTRS : {

      tabContentContainer:{

      },
      tabContentEl: {

      },
      title:{

      },
      href:{

      }
    }
  });

  /**
   * \u5bfc\u822a\u6807\u7b7e\u9879
   * xclass : 'nav-tab-item'
   * @class BUI.Tab.NavTabItem
   * @extends BUI.Component.Controller
   */
  var navTabItem = Component.Controller.extend(
  /**
   * @lends BUI.Tab.NavTabItem.prototype
   * @ignore
   */
  {
    /**
     * \u521b\u5efaDOM
     * @protected
     */
    createDom : function(){
      var _self = this,
          parent = _self.get('parent');
      if(parent){
        _self.set('tabContentContainer',parent.getTabContentContainer());
      }
    },
    /**
     * \u7ed1\u5b9a\u4e8b\u4ef6
     * @protected
     */
    bindUI : function(){
      var _self = this,
        el = _self.get('el'),
        events = _self.get('events');

      el.on('click',function(ev){
        var sender = $(ev.target);
       if(sender.hasClass(CLS_ITEM_CLOSE)){
          if(_self.fire('closing')!== false){
            _self.close();
          }
        }
      });
    },
    /**
     * \u5904\u7406\u53cc\u51fb
     * @protected
     */
    handleDblClick:function(ev){
      var _self = this;

      if(_self.fire('closing')!== false){
        _self.close();
      }
      _self.fire('dblclick',{domTarget : ev.target,domEvent : ev});
    },
    /**
     * \u5904\u7406\u53f3\u952e
     * @protected
     */
    handleContextMenu:function(ev){
      ev.preventDefault();
      this.fire('showmenu',{position:{x:ev.pageX,y:ev.pageY}});
    },
    /**
     * \u8bbe\u7f6e\u6807\u9898
     * @param {String} title \u6807\u9898
     */
    setTitle : function(title){
      this.set('title',title);
    },
    /**
    * \u5173\u95ed
    */
    close:function(){
      this.fire('closed');
    },
    /**
     * \u91cd\u65b0\u52a0\u8f7d\u9875\u9762
     */
    reload : function(){
      this.get('view').resetHref();
    },
    /**
     * @protected
     * @ignore
     */
    show : function(){
      var _self = this;
        _self.get('el').show(500,function(){
          _self.set('visible',true);
        });
    },
    /**
     * @protected
     * @ignore
     */
    hide : function(callback){
      var _self = this;
      this.get('el').hide(500,function(){
        _self.set('visible',false);
        callback && callback();
      });
    },

    _uiSetActived : function(v){
      var _self = this,
        parent = _self.get('parent');
      if(parent && v){
        parent._setItemActived(_self);
      }
    },
    _uiSetCloseable : function(v){
      var _self = this,
        el = _self.get('el'),
        closeEl = el.find('.' + CLS_ITEM_CLOSE);
      if(v){
        closeEl.show();
      }else{
        closeEl.hide();
      }
    }
  },{
    ATTRS : 
    /**
     * @lends BUI.Tab.NavTabItem#
     * @ignore
     */
    {
      elTagName : {
        value: 'li'
      },
      /**
       * \u6807\u7b7e\u662f\u5426\u9009\u4e2d
       * @type {Boolean}
       */
      actived : {
        view:true,
        value : false
      }, 
      /**
       * \u662f\u5426\u53ef\u5173\u95ed
       * @type {Boolean}
       */
      closeable : {
        value : true
      },
      allowTextSelection:{
        view:false,
        value:false
      },
      events:{
        value : {
          /**
           * \u70b9\u51fb\u83dc\u5355\u9879
           * @name BUI.Tab.NavTabItem#click
           * @event 
           * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
           * @param {BUI.Tab.NavTabItem} e.target \u6b63\u5728\u70b9\u51fb\u7684\u6807\u7b7e
           */
          'click' : true,
          /**
           * \u6b63\u5728\u5173\u95ed\uff0c\u8fd4\u56defalse\u53ef\u4ee5\u963b\u6b62\u5173\u95ed\u4e8b\u4ef6\u53d1\u751f
           * @name BUI.Tab.NavTabItem#closing
           * @event 
           * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
           * @param {BUI.Tab.NavTabItem} e.target \u6b63\u5728\u5173\u95ed\u7684\u6807\u7b7e
           */
          'closing' : true,
          /**
           * \u5173\u95ed\u4e8b\u4ef6
           * @name BUI.Tab.NavTabItem#closed
           * @event 
           * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
           * @param {BUI.Tab.NavTabItem} e.target \u5173\u95ed\u7684\u6807\u7b7e
           */
          'closed' : true,
          /**
           * @name BUI.Tab.NavTabItem#showmenu
           * @event
           * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
           * @param {BUI.Tab.NavTabItem} e.target \u663e\u793a\u83dc\u5355\u7684\u6807\u7b7e
           */
          'showmenu' : true,
          'afterVisibleChange' : true
        }
      },
      /**
       * @private
       * @type {Object}
       */
      tabContentContainer:{
        view : true
      },
      /**
       * @private
       * @type {Object}
       */
      tabContentTpl : {
        view : true,
        value : '<div class="' + CLS_CONTENT + '" style="display:none;"><iframe src="" width="100%" height="100%" frameborder="0"></iframe></div>'
      },
      /**
       * \u6807\u7b7e\u9875\u6307\u5b9a\u7684URL
       * @cfg {String} href
       */
      /**
       * \u6807\u7b7e\u9875\u6307\u5b9a\u7684URL
       * @type {String}
       */
      href : {
        view : true,
        value:''
      },
      visible:{
        view:true,
        value:true
      },
      /**
       * \u6807\u7b7e\u6587\u672c
       * @cfg {String} title
       */
      /**
       * \u6807\u7b7e\u6587\u672c
       * tab.getItem('id').set('title','new title');
       * @type {String}
       * @default ''
       */
      title : {
        view:true,
        value : ''
      },
      tpl : {
        view:true,
        value :'<span class="' + CLS_ITEM_TITLE + '"></span><s class="' + CLS_ITEM_CLOSE + '"></s>'
      },
      xview:{
        value : navTabItemView
      }
    }
  },{
    xclass : 'nav-tab-item',
    priority : 0
  });

  navTabItem.View = navTabItemView;
  return navTabItem;
});/**
 * @fileOverview \u5bfc\u822a\u6807\u7b7e
 * @author dxq613@gmail.com
 * @ignore              
 */
define('bui/tab/navtab',['bui/common','bui/menu'],function(require){

  var BUI = require('bui/common'),
    Menu = require('bui/menu'),
    Component =  BUI.Component,
    CLS_NAV_LIST = 'tab-nav-list',
    CLS_ARROW_LEFT = 'arrow-left',
    CLS_ARROW_RIGHT = 'arrow-right',
    ID_CLOSE = 'm_close',
    ITEM_WIDTH = 140;

  /**
   * \u5bfc\u822a\u6807\u7b7e\u7684\u89c6\u56fe\u7c7b
   * @class BUI.Tab.NavTabView
   * @extends BUI.Component.View
   * @private
   */
  var navTabView = Component.View.extend({
    renderUI : function(){
      var _self = this,
        el = _self.get('el'),
        //tpl = _self.get('tpl'),
        listEl = null;

      //$(tpl).appendTo(el);
      listEl = el.find('.' + CLS_NAV_LIST);
      _self.setInternal('listEl',listEl);
    },
    getContentElement : function(){
      
      return this.get('listEl');
    },
    getTabContentContainer : function(){
      return this.get('el').find('.tab-content-container');
    },
    _uiSetHeight : function(v){
      var _self = this,
        el = _self.get('el'),
        barEl = el.find('.tab-nav-bar'),
        containerEl = _self.getTabContentContainer();
      if(v){
        containerEl.height(v - barEl.height());
      }
      el.height(v);
    }
  },{

  },{
    xclass : 'nav-tab-view',
    priority:0
  });
  /**
   * \u5bfc\u822a\u6807\u7b7e
   * @class BUI.Tab.NavTab
   * @extends BUI.Component.Controller
   */
  var navTab = Component.Controller.extend(
    /**
     * @lends BUI.Tab.NavTab.prototype
     * @ignore
     */
    {
      /**
       * \u6dfb\u52a0\u6807\u7b7e\u9879
       * @param {Object} config \u83dc\u5355\u9879\u7684\u914d\u7f6e\u9879
       * @param {Boolean} reload \u5982\u679c\u6807\u7b7e\u9875\u5df2\u5b58\u5728\uff0c\u5219\u91cd\u65b0\u52a0\u8f7d
       */
      addTab:function(config,reload){
        var _self = this,
          id = config.id || BUI.guid('tab-item'),
          item = _self.getItemById(id);

        if(item){
          var hrefChage = false;
          if(config.href && item.get('href') != config.href){
            item.set('href',config.href);
            hrefChage = true;
          }
          _self._setItemActived(item);
          if(reload && !hrefChage){
            item.reload();
          }
        }else{

          config = BUI.mix({
            id : id,
            visible : false,
            actived : true,
            xclass : 'nav-tab-item'
          },config);

          item = _self.addChild(config);
          item.show();
          _self._resetItemList();
        }
        return item;
      },
      /**
       * \u83b7\u53d6\u5bfc\u822a\u6807\u7b7e\uff0c\u5b58\u653e\u5185\u5bb9\u7684\u8282\u70b9
       * @return {jQuery} \u5bfc\u822a\u5185\u5bb9\u7684\u5bb9\u5668
       */
      getTabContentContainer : function(){
        return this.get('view').getTabContentContainer();
      },
      //\u7ed1\u5b9a\u4e8b\u4ef6
      bindUI: function(){
        var _self = this;

        _self._bindScrollEvent();

        //\u76d1\u542c\u70b9\u51fb\u6807\u7b7e
        _self.on('click',function(ev){
          var item = ev.target;
          if(item != _self){
            _self._setItemActived(item);
            _self.fire('itemclick',{item:item});
          }
        });

        //\u5173\u95ed\u6807\u7b7e
        _self.on('closed',function(ev){
          var item = ev.target;
          _self._closeItem(item);
        });

        _self.on('showmenu',function(ev){
          _self._showMenu(ev.target,ev.position);
        });

        _self.on('afterVisibleChange',function(ev){
          var item = ev.target;
          if(item.get('actived')){
            _self._scrollToItem(item);
          }
        });
      },
      //\u7ed1\u5b9a\u6eda\u52a8\u4e8b\u4ef6
      _bindScrollEvent : function(){
        var _self = this,
          el = _self.get('el');

        el.find('.arrow-left').on('click',function(){
          if(el.hasClass(CLS_ARROW_LEFT + '-active')){
            _self._scrollLeft();
          }
        });

        el.find('.arrow-right').on('click',function(){
          if(el.hasClass(CLS_ARROW_RIGHT + '-active')){
            _self._scrllRight();
          }
        });
      },
      _showMenu : function(item,position){
        var _self = this,
            menu = _self._getMenu(),
            closeable = item.get('closeable'),
            closeItem;

        _self.set('showMenuItem',item);

        menu.set('xy',[position.x,position.y]);
        menu.show();
        closeItem = menu.getItem(ID_CLOSE);
        if(closeItem){
          closeItem.set('disabled',!closeable);
        }
      },
      /**
       * \u901a\u8fc7id,\u8bbe\u7f6e\u9009\u4e2d\u7684\u6807\u7b7e\u9879
       * @param {String} id \u6807\u7b7e\u7f16\u53f7
       */
      setActived : function(id){
        var _self = this,
          item = _self.getItemById(id);
        _self._setItemActived(item);
      },
      /**
       * \u83b7\u53d6\u5f53\u524d\u9009\u4e2d\u7684\u6807\u7b7e\u9879
       * @return {BUI.Tab.NavTabItem} \u9009\u4e2d\u7684\u6807\u7b7e\u5bf9\u8c61
       */
      getActivedItem : function(){
        var _self = this,
          children = _self.get('children'),
          result = null;
        BUI.each(children,function(item){
          if(item.get('actived')){
            result = item;
            return false;
          }
        });
        return result;
      },
      /**
       * \u901a\u8fc7\u7f16\u53f7\u83b7\u53d6\u6807\u7b7e\u9879
       * @param  {String} id \u6807\u7b7e\u9879\u7684\u7f16\u53f7
       * @return {BUI.Tab.NavTabItem} \u6807\u7b7e\u9879\u5bf9\u8c61
       */
      getItemById : function(id){
        var _self = this,
          children = _self.get('children'),
          result = null;
        BUI.each(children,function(item){
          if(item.get('id') === id){
            result = item;
            return false;
          }
        });
        return result;
      },
      _getMenu : function(){
        var _self = this;

        return _self.get('menu') || _self._initMenu();
      },
      _initMenu : function(){
        var _self = this,
          menu = new Menu.ContextMenu({
              children : [
              {

                xclass : 'context-menu-item',
                iconCls:'icon icon-refresh',
                text : '\u5237\u65b0',
                listeners:{
                  'click':function(){
                    var item = _self.get('showMenuItem');
                    if(item){
                      item.reload();
                    }
                  }
                }
              },
              {
                id : ID_CLOSE,
                xclass : 'context-menu-item',
                iconCls:'icon icon-remove',
                text: '\u5173\u95ed',
                listeners:{
                  'click':function(){
                    var item = _self.get('showMenuItem');
                    if(item){
                      item.close();
                    }
                  }
                }
              },
              {
                xclass : 'context-menu-item',
                iconCls:'icon icon-remove-sign',
                text : '\u5173\u95ed\u5176\u4ed6',
                listeners:{
                  'click':function(){
                    var item = _self.get('showMenuItem');
                    if(item){
                      _self.closeOther(item);
                    }
                  }
                }
              },
              {
                xclass : 'context-menu-item',
                iconCls:'icon icon-remove-sign',
                text : '\u5173\u95ed\u6240\u6709',
                listeners:{
                  'click':function(){
                    _self.closeAll();
                  }
                }
              }

            ]
          });
          
        _self.set('menu',menu);
        return menu;
      },
      //\u5173\u95ed\u6807\u7b7e\u9879
      _closeItem : function(item){
        var _self = this,
          index = _self._getIndex(item),
          activedItem = _self.getActivedItem(),
          preItem = _self._getItemByIndex(index -1),
          nextItem = _self._getItemByIndex(index + 1);

        item.hide(function(){
          _self.removeChild(item,true);
          _self._resetItemList();
          if(activedItem === item){
            if(preItem){
              _self._setItemActived(preItem);
            }else{
              _self._setItemActived(nextItem);
            }
          }else{//\u5220\u9664\u6807\u7b7e\u9879\u65f6\uff0c\u53ef\u80fd\u4f1a\u5f15\u8d77\u6eda\u52a8\u6309\u94ae\u72b6\u6001\u7684\u6539\u53d8
            _self._scrollToItem(activedItem);;
          }
          
        });
        
      },
      closeAll:function(){
        var _self = this,
          children = _self.get('children');
        BUI.each(children,function(item){
          item.close();
        });
      },
      closeOther : function(curItem){
        var _self = this,
          children = _self.get('children');
        BUI.each(children,function(item){
          if(curItem !==item){
            item.close();
          }
          
        });
      },
      //\u901a\u8fc7\u4f4d\u7f6e\u67e5\u627e\u6807\u7b7e\u9879
      _getItemByIndex : function(index){
        var _self = this,
          children = _self.get('children');  
        return children[index];
      },
      //\u83b7\u53d6\u6807\u7b7e\u9879\u7684\u4f4d\u7f6e
      _getIndex : function(item){
        var _self = this,
          children = _self.get('children');    
        return BUI.Array.indexOf(item,children);
      },
      //\u91cd\u65b0\u8ba1\u7b97\u6807\u7b7e\u9879\u5bb9\u5668\u7684\u5bbd\u5ea6\u4f4d\u7f6e
      _resetItemList : function(){
        var _self = this,
          children = _self.get('children'),
          container = _self.getContentElement(),
          totalWidth = children.length * ITEM_WIDTH;

        container.width(totalWidth);

      },
      //\u4f7f\u6307\u5b9a\u6807\u7b7e\u9879\u5728\u7528\u6237\u53ef\u89c6\u533a\u57df\u5185
      _scrollToItem : function(item){
        var _self = this,
          container = _self.getContentElement(),
          containerPosition = container.position(),
          disWidth = _self._getDistanceToEnd(item,container,containerPosition),
          disBegin = _self._getDistanceToBegin(item,containerPosition); //\u5f53\u524d\u6d3b\u52a8\u7684\u9879\u8ddd\u79bb\u6700\u53f3\u7aef\u7684\u8ddd\u79bb

        //\u5982\u679c\u6807\u7b7e\u9879\u5217\u8868\u5c0f\u4e8e\u6574\u4e2a\u6807\u7b7e\u5bb9\u5668\u7684\u5927\u5c0f\uff0c\u5219\u5de6\u5bf9\u9f50
        if(container.width() < container.parent().width()){
          _self._scrollTo(container,0);  
        }else if(disBegin < 0){//\u5982\u679c\u5de6\u8fb9\u88ab\u906e\u6321\uff0c\u5411\u53f3\u79fb\u52a8

          _self._scrollTo(container,containerPosition.left - (disBegin));

        }else if(disWidth > 0){//\u5982\u679c\u5f53\u524d\u8282\u70b9\u88ab\u53f3\u7aef\u906e\u6321\uff0c\u5219\u5411\u5de6\u6eda\u52a8\u5230\u663e\u793a\u4f4d\u7f6e
        
          _self._scrollTo(container,containerPosition.left + (disWidth) * -1);

        }else if(containerPosition.left < 0){//\u5c06\u5de6\u8fb9\u79fb\u52a8\uff0c\u4f7f\u6700\u540e\u4e00\u4e2a\u6807\u7b7e\u9879\u79bb\u53f3\u8fb9\u6700\u8fd1
          var lastDistance = _self._getLastDistance(container,containerPosition),
            toLeft = 0;
          if(lastDistance < 0){
            toLeft = containerPosition.left - lastDistance;
            toLeft = toLeft < 0 ? toLeft : 0;
            _self._scrollTo(container,toLeft);  
          }
        }
      },
      //\u83b7\u53d6\u6807\u7b7e\u5230\u6700\u5de6\u7aef\u7684\u8ddd\u79bb
      _getDistanceToBegin : function(item,containerPosition){
        var position = item.get('el').position();

        return position.left + containerPosition.left;
      },
      /**
       * \u83b7\u53d6\u6807\u7b7e\u5230\u6700\u53f3\u7aef\u7684\u8ddd\u79bb
       * @return  {Number} \u50cf\u7d20
       * @private
       */
      _getDistanceToEnd : function(item,container,containerPosition){
        var _self = this,
          container = container || _self.getContentElement(),
          wraperWidth = container.parent().width(),
          containerPosition = containerPosition || container.position(),
          offsetLeft = _self._getDistanceToBegin(item,containerPosition),
          disWidth = offsetLeft + ITEM_WIDTH - wraperWidth; 
        return disWidth;
      },
      //\u83b7\u53d6\u6700\u540e\u4e00\u4e2a\u6807\u7b7e\u9879\u79bb\u53f3\u8fb9\u7684\u95f4\u8ddd
      _getLastDistance : function(container,containerPosition){
        var _self = this,
          children = _self.get('children'),
          lastItem = children[children.length - 1];
        if(lastItem)
        {
          return _self._getDistanceToEnd(lastItem,container,containerPosition);
        }
        return 0;
      },
      _scrollTo : function(el,left,callback){
        var _self = this;
        el.animate({left:left},500,function(){
           _self._setArrowStatus(el);
        });
      },
      _scrollLeft : function(){
        var _self = this,
          container = _self.getContentElement(),
          position = container.position(),
          disWidth = _self._getLastDistance(container,position),
          toLeft;
        if(disWidth > 0 ){
          toLeft = disWidth > ITEM_WIDTH ? ITEM_WIDTH : disWidth;
          _self._scrollTo(container,position.left - toLeft);
        }

      },
      //\u5411\u53f3\u6eda\u52a8
      _scrllRight : function(){
        var _self = this,
          container = _self.getContentElement(),
          position = container.position(),
          toRight;
        if(position.left < 0){
          toRight = position.left + ITEM_WIDTH;
          toRight = toRight < 0 ? toRight : 0;
          _self._scrollTo(container,toRight);
        }
      },
      //\u8bbe\u7f6e\u5411\u5de6\uff0c\u5411\u53f3\u7684\u7bad\u5934\u662f\u5426\u53ef\u7528
      _setArrowStatus : function(container,containerPosition){

        container = container || this.getContentElement();
        var _self = this,
          wapperEl = _self.get('el'),
          position = containerPosition || container.position(),
          disWidth = _self._getLastDistance(container,containerPosition);

        //\u53ef\u4ee5\u5411\u5de6\u8fb9\u6eda\u52a8
        if(position.left < 0){
          wapperEl.addClass(CLS_ARROW_RIGHT+'-active');
        }else{
          wapperEl.removeClass(CLS_ARROW_RIGHT+'-active');
        }

        if(disWidth > 0){
          wapperEl.addClass(CLS_ARROW_LEFT+'-active');
        }else{
          wapperEl.removeClass(CLS_ARROW_LEFT+'-active');
        }
      },
      //\u8bbe\u7f6e\u5f53\u524d\u9009\u4e2d\u7684\u6807\u7b7e
      _setItemActived:function(item){
        var _self = this,
          preActivedItem = _self.getActivedItem();
        if(item === preActivedItem){
          return;
        }

        if(preActivedItem){
          preActivedItem.set('actived',false);
        }
        if(item){
          if(!item.get('actived')){
            item.set('actived',true);
          }
          //\u5f53\u6807\u7b7e\u9879\u53ef\u89c1\u65f6\uff0c\u5426\u5219\u65e0\u6cd5\u8ba1\u7b97\u4f4d\u7f6e\u4fe1\u606f
          if(item.get('visible')){
            _self._scrollToItem(item);
          }
          
          _self.fire('activeChange',{item:item});
        }
      }

    },
    
    {
      ATTRS : 
    /**
      * @lends BUI.Tab.NavTab.prototype
      * @ignore
      */    
    {
        defaultChildClass:{
          value : 'nav-tab-item'
        },
        /**
         * @private
         * \u53f3\u952e\u83dc\u5355
         * @type {Object}
         */
        menu : {

        },
        /**
         * \u6e32\u67d3\u6807\u7b7e\u7684\u6a21\u7248
         * @type {String}
         */
        tpl : {
          view : true,
          value : '<div class="tab-nav-bar">'+
            '<s class="tab-nav-arrow arrow-left"></s><div class="tab-nav-wrapper"><div class="tab-nav-inner"><ul class="'+CLS_NAV_LIST+'"></ul></div></div><s class="tab-nav-arrow arrow-right"></s>'+
            '</div>'+
            '<div class="tab-content-container"></div>'
        },
        xview : {
          value : navTabView
        },
        events : {
                
          value : {
            /**
             * \u70b9\u51fb\u6807\u7b7e\u9879
             * @event
             * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
             * @param {BUI.Tab.NavTabItem} e.item \u6807\u7b7e\u9879
             */
            'itemclick' : false
          }
        }
      }
    },
    {
      xclass:'nav-tab',
      priority : 0

    }
  );

  return navTab;
});/**
 * @fileOverview 
 * @ignore
 */

define('bui/tab/tabitem',['bui/common'],function (require) {
  

  var BUI = require('bui/common'),
    Component = BUI.Component,
    UIBase = Component.UIBase;

  /**
   * @private
   * @class BUI.Tab.TabItemView
   * @extends BUI.Component.View
   * @mixins BUI.Component.UIBase.ListItemView
   * \u6807\u7b7e\u9879\u7684\u89c6\u56fe\u5c42\u5bf9\u8c61
   */
  var itemView = Component.View.extend([UIBase.ListItemView],{
  },{
    xclass:'tab-item-view'
  });


  /**
   * \u6807\u7b7e\u9879
   * @class BUI.Tab.TabItem
   * @extends BUI.Component.Controller
   * @mixins BUI.Component.UIBase.ListItem
   */
  var item = Component.Controller.extend([UIBase.ListItem],{

  },{
    ATTRS : 
    {
     
      elTagName:{
        view:true,
        value:'li'
      },
      xview:{
        value:itemView
      },
      tpl:{
        view:true,
        value:'<span class="bui-tab-item-text">{text}</span>'
      }
    }
  },{
    xclass:'tab-item'
  });

  
  item.View = itemView;
  return item;
});/**
 * @fileOverview \u5207\u6362\u6807\u7b7e
 * @ignore
 */

define('bui/tab/tab',['bui/common'],function (require) {
  

  var BUI = require('bui/common'),
    Component = BUI.Component,
    UIBase = Component.UIBase;

  /**
   * \u5217\u8868
   * xclass:'tab'
   * <pre><code>
   * BUI.use('bui/tab',function(Tab){
   *   
   *     var tab = new Tab.Tab({
   *         render : '#tab',
   *         elCls : 'nav-tabs',
   *         autoRender: true,
   *         children:[
   *           {text:'\u6807\u7b7e\u4e00',value:'1'},
   *           {text:'\u6807\u7b7e\u4e8c',value:'2'},
   *           {text:'\u6807\u7b7e\u4e09',value:'3'}
   *         ]
   *       });
   *     tab.on('selectedchange',function (ev) {
   *       var item = ev.item;
   *       $('#log').text(item.get('text') + ' ' + item.get('value'));
   *     });
   *     tab.setSelected(tab.getItemAt(0)); //\u8bbe\u7f6e\u9009\u4e2d\u7b2c\u4e00\u4e2a
   *   
   *   });
   *  </code></pre>
   * @class BUI.Tab.Tab
   * @extends BUI.Component.Controller
   * @mixins BUI.Component.UIBase.ChildList
   */
  var tab = Component.Controller.extend([UIBase.ChildList],{

  },{
    ATTRS : {
      elTagName:{
        view:true,
        value:'ul'
      },
      /**
       * \u5b50\u7c7b\u7684\u9ed8\u8ba4\u7c7b\u540d\uff0c\u5373\u7c7b\u7684 xclass
       * @type {String}
       * @override
       * @default 'tab-item'
       */
      defaultChildClass : {
        value : 'tab-item'
      }
    }
  },{
    xclass : 'tab'
  });

  return tab;

});/**
 * @fileOverview 
 * @ignore
 */

define('bui/tab/tabpanelitem',['bui/common','bui/tab/tabitem'],function (require) {
  

  var BUI = require('bui/common'),
    TabItem = require('bui/tab/tabitem'),
    Component = BUI.Component;

  /**
   * @private
   * @class BUI.Tab.TabPanelItemView
   * @extends BUI.Tab.TabItemView
   * \u5b58\u5728\u9762\u677f\u7684\u6807\u7b7e\u9879\u89c6\u56fe\u5c42\u5bf9\u8c61
   */
  var itemView = TabItem.View.extend({
  },{
    xclass:'tab-panel-item-view'
  });


  /**
   * \u6807\u7b7e\u9879
   * @class BUI.Tab.TabPanelItem
   * @extends BUI.Tab.TabItem
   */
  var item = TabItem.extend({
    
    renderUI : function(){
      var _self = this,
        selected = _self.get('selected');
        _self._setPanelVisible(selected);
    },
    //\u8bbe\u7f6e\u9762\u677f\u662f\u5426\u53ef\u89c1
    _setPanelVisible : function(visible){
      var _self = this,
        panel = _self.get('panel'),
        method = visible ? 'show' : 'hide';
      if(panel){
        $(panel)[method]();
      }
    },
    //\u9009\u4e2d\u6807\u7b7e\u9879\u65f6\u663e\u793a\u9762\u677f
    _uiSetSelected : function(v){
      this._setPanelVisible(v);
    },
    destructor: function(){
      var _self = this,
        panel = _self.get('panel');
      if(panel && _self.get('panelDestroyable')){
        $(panel).remove();
      }
    }
  },{
    ATTRS : 
    {
      /**
       * \u6807\u7b7e\u9879\u5bf9\u5e94\u7684\u9762\u677f\u5bb9\u5668\uff0c\u5f53\u6807\u7b7e\u9009\u4e2d\u65f6\uff0c\u9762\u677f\u663e\u793a
       * @cfg {String|HTMLElement|jQuery} panel
       * @internal \u9762\u677f\u5c5e\u6027\u4e00\u822c\u7531 tabPanel\u8bbe\u7f6e\u800c\u4e0d\u5e94\u8be5\u7531\u7528\u6237\u624b\u5de5\u8bbe\u7f6e
       */
      /**
       * \u6807\u7b7e\u9879\u5bf9\u5e94\u7684\u9762\u677f\u5bb9\u5668\uff0c\u5f53\u6807\u7b7e\u9009\u4e2d\u65f6\uff0c\u9762\u677f\u663e\u793a
       * @type {String|HTMLElement|jQuery}
       * @readOnly
       */
      panel : {

      },
      /**
       * \u79fb\u9664\u6807\u7b7e\u9879\u65f6\u662f\u5426\u79fb\u9664\u9762\u677f\uff0c\u9ed8\u8ba4\u4e3a false
       * @type {Boolean}
       */
      panelDestroyable : {
        value : true
      },
      xview:{
        value:itemView
      }
    }
  },{
    xclass:'tab-panel-item'
  });
  
  item.View = itemView;
  return item;

});/**
 * @fileOverview \u6bcf\u4e2a\u6807\u7b7e\u5bf9\u5e94\u4e00\u4e2a\u9762\u677f
 * @ignore
 */

define('bui/tab/tabpanel',['bui/common','bui/tab/tab'],function (require) {
  
  var BUI = require('bui/common'),
    Tab = require('bui/tab/tab');

  /**
   * \u5e26\u6709\u9762\u677f\u7684\u5207\u6362\u6807\u7b7e
   * <pre><code>
   * BUI.use('bui/tab',function(Tab){
   *   
   *     var tab = new Tab.TabPanel({
   *       render : '#tab',
   *       elCls : 'nav-tabs',
   *       panelContainer : '#panel',
   *       autoRender: true,
   *       children:[
   *         {text:'\u6e90\u4ee3\u7801',value:'1'},
   *         {text:'HTML',value:'2'},
   *         {text:'JS',value:'3'}
   *       ]
   *     });
   *     tab.setSelected(tab.getItemAt(0));
   *   });
   * </code></pre>
   * @class BUI.Tab.TabPanel
   * @extends BUI.Tab.Tab
   */
  var tabPanel = Tab.extend({
    initializer : function(){
      var _self = this,
        children = _self.get('children'),
        panelContainer = $(_self.get('panelContainer')),
        panelCls = _self.get('panelCls'),
        panels = panelCls ? panelContainer.find('.' + panels) : panelContainer.children();

      BUI.each(children,function(item,index){
        if(item.set){
          item.set('panel',panels[index]);
        }else{
          item.panel = panels[index];
        }
      });
    }
  },{
    ATTRS : {

      /**
       * \u9ed8\u8ba4\u5b50\u63a7\u4ef6\u7684xclass
       * @type {String}
       */
      defaultChildClass:{
        value : 'tab-panel-item'
      },
      /**
       * \u9762\u677f\u7684\u5bb9\u5668
       * @type {String|HTMLElement|jQuery}
       */
      panelContainer : {
        
      },
      /**
       * panel \u9762\u677f\u4f7f\u7528\u7684\u6837\u5f0f\uff0c\u5982\u679c\u521d\u59cb\u5316\u65f6\uff0c\u5bb9\u5668\u5185\u5df2\u7ecf\u5b58\u5728\u6709\u8be5\u6837\u5f0f\u7684DOM\uff0c\u5219\u4f5c\u4e3a\u9762\u677f\u4f7f\u7528
       * \u5bf9\u5e94\u540c\u4e00\u4e2a\u4f4d\u7f6e\u7684\u6807\u7b7e\u9879,\u5982\u679c\u4e3a\u7a7a\uff0c\u9ed8\u8ba4\u53d6\u9762\u677f\u5bb9\u5668\u7684\u5b50\u5143\u7d20
       * @type {String}
       */
      panelCls : {

      }
    }
  },{
    xclass : 'tab-panel'
  });

  return tabPanel;
});/**
 * @fileOverview \u5de5\u5177\u680f\u547d\u540d\u7a7a\u95f4\u5165\u53e3
 * @ignore
 */

define('bui/toolbar',['bui/common','bui/toolbar/baritem','bui/toolbar/bar','bui/toolbar/pagingbar','bui/toolbar/numberpagingbar'],function (require) {
  var BUI = require('bui/common'),
    Toolbar = BUI.namespace('Toolbar');

  BUI.mix(Toolbar,{
    BarItem : require('bui/toolbar/baritem'),
    Bar : require('bui/toolbar/bar'),
    PagingBar : require('bui/toolbar/pagingbar'),
    NumberPagingBar : require('bui/toolbar/numberpagingbar')
  });
  return Toolbar;
});/**
 * @fileOverview buttons or controls of toolbar
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */
define('bui/toolbar/baritem',function(){

  /**
   * @name BUI.Toolbar
   * @namespace \u5de5\u5177\u680f\u547d\u540d\u7a7a\u95f4
   * @ignore
   */
  var PREFIX = BUI.prefix,
    Component = BUI.Component,
    UIBase = Component.UIBase;
    
  /**
   * barItem\u7684\u89c6\u56fe\u7c7b
   * @class BUI.Toolbar.BarItemView
   * @extends BUI.Component.View
   * @mixins BUI.Component.UIBase.ListItemView
   * @private
   */
  var BarItemView = Component.View.extend([UIBase.ListItemView]);
  /**
     * \u5de5\u5177\u680f\u7684\u5b50\u9879\uff0c\u5305\u62ec\u6309\u94ae\u3001\u6587\u672c\u3001\u94fe\u63a5\u548c\u5206\u9694\u7b26\u7b49
     * @class BUI.Toolbar.BarItem
     * @extends BUI.Component.Controller
     */
  var BarItem = Component.Controller.extend([UIBase.ListItem],{
    
    /**
    * render baritem 's dom
    * @protected
    */
    renderUI:function() {
        var el = this.get('el');
        el.addClass(PREFIX + 'inline-block');
        if (!el.attr('id')) {
            el.attr('id', this.get('id'));
        }
    }
  },{
    ATTRS:
    /**
     * @lends BUI.Toolbar.BarItem.prototype
     * @ignore
     */
    {
      elTagName :{
          view : true,
          value : 'li'
      },
      /**
       * \u662f\u5426\u53ef\u9009\u62e9
       * <pre><code>
       * 
       * </code></pre>
       * @cfg {Object} [selectable = false]
       */
      selectable : {
        value : false
      },
      /**
      * \u662f\u5426\u83b7\u53d6\u7126\u70b9
      * @default {boolean} false
      */
      focusable : {
        value : false
      },
      xview: {
        value : BarItemView
      }
    }
  },{
    xclass : 'bar-item',
    priority : 1  
  });

  /**
     * \u5de5\u5177\u680f\u7684\u5b50\u9879\uff0c\u6dfb\u52a0\u6309\u94ae
     * xclass : 'bar-item-button'
     * @extends  BUI.Toolbar.BarItem
     * @class BUI.Toolbar.BarItem.Button
     */
  var ButtonBarItem = BarItem.extend({
    
    _uiSetDisabled : function(value){
      var _self = this,
        el = _self.get('el'),
        method = value ? 'addClass' : 'removeClass';
      
      el.find('button').attr('disabled',value)[method](PREFIX + 'button-disabled');
    },
    _uiSetChecked: function(value){
      var _self = this,
        el = _self.get('el'),
        method = value ? 'addClass' : 'removeClass';

        el.find('button')[method](PREFIX + 'button-checked');
    },
    _uiSetText : function(v){
      var _self = this,
        el = _self.get('el');
      el.find('button').text(v);
    },
    _uiSetbtnCls : function(v){
      var _self = this,
        el = _self.get('el');
      el.find('button').addClass(v);
    }
    
  },{
    ATTRS:
    /**
     * @lends BUI.Toolbar.BarItem.Button.prototype
     * @ignore
     */
    {
      /**
       * \u662f\u5426\u9009\u4e2d
       * @type {Boolean}
       */
      checked : {
        value :false
      },
      /**
       * \u6a21\u677f
       * @type {String}
       */
      tpl : {
        view : true,
        value : '<button type="button" class="{btnCls}">{text}</button>'
      },
      /**
       * \u6309\u94ae\u7684\u6837\u5f0f
       * @cfg {String} btnCls
       */
      /**
       * \u6309\u94ae\u7684\u6837\u5f0f
       * @type {String}
       */
      btnCls:{
        sync:false
      },
      /**
      * The text to be used as innerHTML (html tags are accepted).
      * @cfg {String} text
      */
      /**
      * The text to be used as innerHTML (html tags are accepted).
      * @type {String} 
      */
      text : {
        sync:false,
        value : ''
      }
    }
  },{
    xclass : 'bar-item-button',
    priority : 2  
  });
  
  /**
     * \u5de5\u5177\u680f\u9879\u4e4b\u95f4\u7684\u5206\u9694\u7b26
     * xclass:'bar-item-separator'
     * @extends  BUI.Toolbar.BarItem
     * @class BUI.Toolbar.BarItem.Separator
     */
  var SeparatorBarItem = BarItem.extend({
    /* render separator's dom
    * @protected
        *
    */
    renderUI:function() {
            var el = this.get('el');
            el .attr('role', 'separator');
        }
  },
  {
    xclass : 'bar-item-separator',
    priority : 2  
  });

  
  /**
     * \u5de5\u5177\u680f\u9879\u4e4b\u95f4\u7684\u7a7a\u767d
     * xclass:'bar-item-spacer'
     * @extends  BUI.Toolbar.BarItem
     * @class BUI.Toolbar.BarItem.Spacer
     */
  var SpacerBarItem = BarItem.extend({
    
  },{
    ATTRS:
    /** 
    * @lends BUI.Toolbar.BarItem.Spacer.prototype
    * @ignore
    */
    {
      /**
      * \u7a7a\u767d\u5bbd\u5ea6
      * @type {Number}
      */
      width : {
        view:true,
        value : 2
      }
    }
  },{
    xclass : 'bar-item-spacer',
    priority : 2  
  });
  

  /**
     * \u663e\u793a\u6587\u672c\u7684\u5de5\u5177\u680f\u9879
     * xclass:'bar-item-text'
     * @extends  BUI.Toolbar.BarItem
     * @class BUI.Toolbar.BarItem.Text
     */
  var TextBarItem = BarItem.extend({
    _uiSetText : function(text){
      var _self = this,
        el = _self.get('el');
      el.html(text);
    }
  },{
    ATTRS:
    /**
     * @lends BUI.Toolbar.BarItem.Text.prototype
     * @ignore
     */
    {
      
      /**
      * \u6587\u672c\u7528\u4f5c innerHTML (html tags are accepted).
      * @cfg {String} text
      */
      /**
      * \u6587\u672c\u7528\u4f5c innerHTML (html tags are accepted).
      * @default {String} ""
      */
      text : {
        value : ''
      }
    }
  },{
    xclass : 'bar-item-text',
    priority : 2  
  });
  

  BarItem.types = {
    'button' : ButtonBarItem,
    'separator' : SeparatorBarItem,
    'spacer' : SpacerBarItem,
    'text'  : TextBarItem
  };
  

  return BarItem;
});/**
 * @fileOverview A collection of commonly used function buttons or controls represented in compact visual form.
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */
define('bui/toolbar/bar',function(){

	var Component = BUI.Component,
    UIBase = Component.UIBase;
		
	/**
	 * bar\u7684\u89c6\u56fe\u7c7b
	 * @class BUI.Toolbar.BarView
	 * @extends BUI.Component.View
	 * @private
	 */
	var barView = Component.View.extend({

		renderUI:function() {
        var el = this.get('el');
        el.attr('role', 'toolbar');
           
        if (!el.attr('id')) {
            el.attr('id', BUI.guid('bar'));
        }
    }
	});

	/**
	 * \u5de5\u5177\u680f
   * \u53ef\u4ee5\u653e\u7f6e\u6309\u94ae\u3001\u6587\u672c\u3001\u94fe\u63a5\u7b49\uff0c\u662f\u5206\u9875\u680f\u7684\u57fa\u7c7b
   * xclass : 'bar'
   * <p>
   * <img src="../assets/img/class-toolbar.jpg"/>
   * </p>
   * ## \u6309\u94ae\u7ec4
   * <pre><code>
   *   BUI.use('bui/toolbar',function(Toolbar){
   *     var buttonGroup = new Toolbar.Bar({
   *       elCls : 'button-group',
   *       defaultChildCfg : {
   *         elCls : 'button button-small'
   *       },
   *       children : [{content : '\u589e\u52a0'},{content : '\u4fee\u6539'},{content : '\u5220\u9664'}],
   *       
   *       render : '#b1'
   *     });
   *
   *     buttonGroup.render();
   *   });
   * </code></pre>
   * @class BUI.Toolbar.Bar
   * @extends BUI.Component.Controller
   * @mixins BUI.Component.UIBase.ChildList
   */
	var Bar = Component.Controller.extend([UIBase.ChildList],
	 /**
	 * @lends BUI.Toolbar.Bar.prototype
   * @ignore 
	 */	
	{
		/**
		* \u901a\u8fc7id \u83b7\u53d6\u9879
		* @param {String|Number} id the id of item 
		* @return {BUI.Toolbar.BarItem}
		*/
		getItem : function(id){
			return this.getChild(id);
		}
	},{
		ATTRS:
    /** 
    * @lends BUI.Toolbar.Bar.prototype
    * @ignore
    */
		{
      elTagName :{
          view : true,
          value : 'ul'
      },
      /**
       * \u9ed8\u8ba4\u5b50\u9879\u7684\u6837\u5f0f
       * @type {String}
       * @override
       */
      defaultChildClass: {
        value : 'bar-item'
      },
			/**
			* \u83b7\u53d6\u7126\u70b9
      * @protected
      * @ignore
			*/
			focusable : {
				value : false
			},
			/**
			* @private
      * @ignore
			*/
			xview : {
				value : barView	
			}
		}
	},{
		xclass : 'bar',
		priority : 1	
	});

	return Bar;
});/**
 * @fileOverview  a specialized toolbar that is bound to a Grid.Store and provides automatic paging control.
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */
define('bui/toolbar/pagingbar',['bui/toolbar/bar'],function(require) {

    var Bar = require('bui/toolbar/bar'),
        Component = BUI.Component,
        Bindable = Component.UIBase.Bindable;

    var PREFIX = BUI.prefix,
		ID_FIRST = 'first',
        ID_PREV = 'prev',
        ID_NEXT = 'next',
        ID_LAST = 'last',
        ID_SKIP = 'skip',
        ID_TOTAL_PAGE = 'totalPage',
        ID_CURRENT_PAGE = 'curPage',
        ID_TOTAL_COUNT = 'totalCount';

    /**
     * \u5206\u9875\u680f
     * xclass:'pagingbar'
     * @extends BUI.Toolbar.Bar
     * @mixins BUI.Component.UIBase.Bindable
     * @class BUI.Toolbar.PagingBar
     */
    var PagingBar = Bar.extend([Bindable],
        /** 
        * @lends BUI.Toolbar.PagingBar.prototype
        * @ignore
        */
        {
            /**
             * From Bar, Initialize this paging bar items.
             *
             * @protected
             */
            initializer:function () {
                var _self = this,
                    children = _self.get('children'),
                    items = _self.get('items'),
                    store = _self.get('store');
                if(!items || items.length){
                    items = _self._getItems();
                    BUI.each(items, function (item) {
                        children.push(item);//item
                    });
                }
                
                if (store && store.get('pageSize')) {
                    _self.set('pageSize', store.get('pageSize'));
                }
            },
            /**
             * bind page change and store events
             *
             * @protected
             */
            bindUI:function () {
                var _self = this;
                _self._bindButtonEvent();
                //_self._bindStoreEvents();

            },
            /**
             * skip to page
             * this method can fire "beforepagechange" event,
             * if you return false in the handler the action will be canceled
             * @param {Number} page target page
             */
            jumpToPage:function (page) {
                if (page <= 0 || page > this.get('totalPage')) {
                    return;
                }
                var _self = this,
                    store = _self.get('store'),
                    pageSize = _self.get('pageSize'),
                    index = page - 1,
                    start = index * pageSize;
                var result = _self.fire('beforepagechange', {from:_self.get('curPage'), to:page});
                if (store && result !== false) {
                    store.load({ start:start, limit:pageSize, pageIndex:index });
                }
            },
            //after store loaded data,reset the information of paging bar and buttons state
            _afterStoreLoad:function (store, params) {
                var _self = this,
                    pageSize = _self.get('pageSize'),
                    start = 0, //\u9875\u9762\u7684\u8d77\u59cb\u8bb0\u5f55
                    end, //\u9875\u9762\u7684\u7ed3\u675f\u8bb0\u5f55
                    totalCount, //\u8bb0\u5f55\u7684\u603b\u6570
                    curPage, //\u5f53\u524d\u9875
                    totalPage;//\u603b\u9875\u6570;

                start = store.get('start');
                
                //\u8bbe\u7f6e\u52a0\u8f7d\u6570\u636e\u540e\u7ffb\u9875\u680f\u7684\u72b6\u6001
                totalCount = store.getTotalCount();
                end = totalCount - start > pageSize ? start + store.getCount() : totalCount;
                totalPage = parseInt((totalCount + pageSize - 1) / pageSize, 10);
                totalPage = totalPage > 0 ? totalPage : 1;
                curPage = parseInt(start / pageSize, 10) + 1;

                _self.set('start', start);
                _self.set('end', end);
                _self.set('totalCount', totalCount);
                _self.set('curPage', curPage);
                _self.set('totalPage', totalPage);

                //\u8bbe\u7f6e\u6309\u94ae\u72b6\u6001
                _self._setAllButtonsState();
                _self._setNumberPages();
            },

            //bind page change events
            _bindButtonEvent:function () {
                var _self = this;

                //first page handler
                _self._bindButtonItemEvent(ID_FIRST, function () {
                    _self.jumpToPage(1);
                });

                //previous page handler
                _self._bindButtonItemEvent(ID_PREV, function () {
                    _self.jumpToPage(_self.get('curPage') - 1);
                });

                //previous page next
                _self._bindButtonItemEvent(ID_NEXT, function () {
                    _self.jumpToPage(_self.get('curPage') + 1);
                });

                //previous page next
                _self._bindButtonItemEvent(ID_LAST, function () {
                    _self.jumpToPage(_self.get('totalPage'));
                });
                //skip to one page
                _self._bindButtonItemEvent(ID_SKIP, function () {
                    handleSkip();
                });
                //input page number and press key "enter"
                var curPage = _self.getItem(ID_CURRENT_PAGE);
                if(curPage){
                    curPage.get('el').on('keyup', function (event) {
                        event.stopPropagation();
                        if (event.keyCode === 13) {
                            handleSkip();
                        }
                    });
                }
                
                //when click skip button or press key "enter",cause an action of skipping page
                /**
                 * @private
                 * @ignore
                 */
                function handleSkip() {
                    var value = parseInt(_self._getCurrentPageValue(), 10);
                    if (_self._isPageAllowRedirect(value)) {
                        _self.jumpToPage(value);
                    } else {
                        _self._setCurrentPageValue(_self.get('curPage'));
                    }
                }
            },
            // bind button item event
            _bindButtonItemEvent:function (id, func) {
                var _self = this,
                    item = _self.getItem(id);
                if (item) {
                    item.on('click', func);
                }
            },
            onLoad:function (params) {
                var _self = this,
                    store = _self.get('store');
                _self._afterStoreLoad(store, params);
            },
            //get the items of paging bar
            _getItems:function () {
                var _self = this,
                    items = _self.get('items');
                if (items && items.length) {
                    return items;
                }
                //default items
                items = [];
                //first item
                items.push(_self._getButtonItem(ID_FIRST));
                //previous item
                items.push(_self._getButtonItem(ID_PREV));
                //separator item
                items.push(_self._getSeparator());
                //total page of store
                items.push(_self._getTextItem(ID_TOTAL_PAGE));
                //current page of store
                items.push(_self._getTextItem(ID_CURRENT_PAGE));
                //button for skip to
                items.push(_self._getButtonItem(ID_SKIP));
                //separator item
                items.push(_self._getSeparator());
                //next item
                items.push(_self._getButtonItem(ID_NEXT));
                //last item
                items.push(_self._getButtonItem(ID_LAST));
                //separator item
                items.push(_self._getSeparator());
                //current page of store
                items.push(_self._getTextItem(ID_TOTAL_COUNT));
                return items;
            },
            //get item which the xclass is button
            _getButtonItem:function (id) {
                var _self = this;
                return {
                    id:id,
                    xclass:'bar-item-button',
                    text:_self.get(id + 'Text'),
                    disabled:true,
                    elCls:_self.get(id + 'Cls')
                };
            },
            //get separator item
            _getSeparator:function () {
                return {xclass:'bar-item-separator'};
            },
            //get text item
            _getTextItem:function (id) {
                var _self = this;
                return {
                    id:id,
                    xclass:'bar-item-text',
                    text:_self._getTextItemTpl(id)
                };
            },
            //get text item's template
            _getTextItemTpl:function (id) {
                var _self = this,
                    obj = {};
                obj[id] = _self.get(id);
                return BUI.substitute(this.get(id + 'Tpl'), obj);
            },
            //Whether to allow jump, if it had been in the current page or not within the scope of effective page, not allowed to jump
            _isPageAllowRedirect:function (value) {
                var _self = this;
                return value && value > 0 && value <= _self.get('totalPage') && value !== _self.get('curPage');
            },
            //when page changed, reset all buttons state
            _setAllButtonsState:function () {
                var _self = this,
                    store = _self.get('store');
                if (store) {
                    _self._setButtonsState([ID_PREV, ID_NEXT, ID_FIRST, ID_LAST, ID_SKIP], true);
                }

                if (_self.get('curPage') === 1) {
                    _self._setButtonsState([ID_PREV, ID_FIRST], false);
                }
                if (_self.get('curPage') === _self.get('totalPage')) {
                    _self._setButtonsState([ID_NEXT, ID_LAST], false);
                }
            },
            //if button id in the param buttons,set the button state
            _setButtonsState:function (buttons, enable) {
                var _self = this,
                    children = _self.get('children');
                BUI.each(children, function (child) {
                    if (BUI.Array.indexOf(child.get('id'), buttons) !== -1) {
                        child.set('disabled', !enable);
                    }
                });
            },
            //show the information of current page , total count of pages and total count of records
            _setNumberPages:function () {
                var _self = this,
                    totalPageItem = _self.getItem(ID_TOTAL_PAGE),
                    totalCountItem = _self.getItem(ID_TOTAL_COUNT);
                if (totalPageItem) {
                    totalPageItem.set('content', _self._getTextItemTpl(ID_TOTAL_PAGE));
                }
                _self._setCurrentPageValue(_self.get(ID_CURRENT_PAGE));
                if (totalCountItem) {
                    totalCountItem.set('content', _self._getTextItemTpl(ID_TOTAL_COUNT));
                }
            },
            _getCurrentPageValue:function (curItem) {
                var _self = this;
                curItem = curItem || _self.getItem(ID_CURRENT_PAGE);
                var textEl = curItem.get('el').find('input');
                return textEl.val();
            },
            //show current page in textbox
            _setCurrentPageValue:function (value, curItem) {
                var _self = this;
                curItem = curItem || _self.getItem(ID_CURRENT_PAGE);
                var textEl = curItem.get('el').find('input');
                textEl.val(value);
            }
        }, {
            ATTRS:
            /** 
            * @lends BUI.Toolbar.PagingBar.prototype
            * @ignore
            */
            {
               
                /**
                 * the text of button for first page
                 * @default {String} "\u9996 \u9875"
                 */
                firstText:{
                    value:'\u9996 \u9875'
                },
                /**
                 * the cls of button for first page
                 * @default {String} "bui-pb-first"
                 */
                firstCls:{
                    value:PREFIX + 'pb-first'
                },
                /**
                 * the text for previous page button
                 * @default {String} "\u524d\u4e00\u9875"
                 */
                prevText:{
                    value:'\u4e0a\u4e00\u9875'
                },
                /**
                 * the cls for previous page button
                 * @default {String} "bui-pb-prev"
                 */
                prevCls:{
                    value: PREFIX + 'pb-prev'
                },
                /**
                 * the text for next page button
                 * @default {String} "\u4e0b\u4e00\u9875"
                 */
                nextText:{
                    value:'\u4e0b\u4e00\u9875'
                },
                /**
                 * the cls for next page button
                 * @default {String} "bui-pb-next"
                 */
                nextCls:{
                    value: PREFIX + 'pb-next'
                },
                /**
                 * the text for last page button
                 * @default {String} "\u672b \u9875"
                 */
                lastText:{
                    value:'\u672b \u9875'
                },
                /**
                 * the cls for last page button
                 * @default {String} "bui-pb-last"
                 */
                lastCls:{
                    value:PREFIX + 'pb-last'
                },
                /**
                 * the text for skip page button
                 * @default {String} "\u8df3 \u8f6c"
                 */
                skipText:{
                    value:'\u786e\u5b9a'
                },
                /**
                 * the cls for skip page button
                 * @default {String} "bui-pb-last"
                 */
                skipCls:{
                    value:PREFIX + 'pb-skip'
                },
                /**
                 * the template of total page info
                 * @default {String} '\u5171 {totalPage} \u9875'
                 */
                totalPageTpl:{
                    value:'\u5171 {totalPage} \u9875'
                },
                /**
                 * the template of current page info
                 * @default {String} '\u7b2c &lt;input type="text" autocomplete="off" class="bui-pb-page" size="20" name="inputItem"&gt; \u9875'
                 */
                curPageTpl:{
                    value:'\u7b2c <input type="text" '+
                        'autocomplete="off" class="'+PREFIX+'pb-page" size="20" name="inputItem"> \u9875'
                },
                /**
                 * the template of total count info
                 * @default {String} '\u7b2c &lt;input type="text" autocomplete="off" class="bui-pb-page" size="20" name="inputItem"&gt; \u9875'
                 */
                totalCountTpl:{
                    value:'\u5171{totalCount}\u6761\u8bb0\u5f55'
                },
                /**
                 * current page of the paging bar
                 * @private
                 * @default {Number} 0
                 */
                curPage:{
                    value:0
                },
                /**
                 * total page of the paging bar
                 * @private
                 * @default {Number} 0
                 */
                totalPage:{
                    value:0
                },
                /**
                 * total count of the store that the paging bar bind to
                 * @private
                 * @default {Number} 0
                 */
                totalCount:{
                    value:0
                },
                /**
                 * The number of records considered to form a 'page'.
                 * if store set the property ,override this value by store's pageSize
                 * @private
                 */
                pageSize:{
                    value:30
                },
                /**
                 * The {@link BUI.Data.Store} the paging toolbar should use as its data source.
                 * @protected
                 */
                store:{

                }
            },
            ID_FIRST:ID_FIRST,
            ID_PREV:ID_PREV,
            ID_NEXT:ID_NEXT,
            ID_LAST:ID_LAST,
            ID_SKIP:ID_SKIP,
            ID_TOTAL_PAGE:ID_TOTAL_PAGE,
            ID_CURRENT_PAGE:ID_CURRENT_PAGE,
            ID_TOTAL_COUNT:ID_TOTAL_COUNT
        }, {
            xclass:'pagingbar',
            priority:2
        });

    return PagingBar;

});/**
 * @fileOverview  a specialized toolbar that is bound to a Grid.Store and provides automatic paging control.
 * @author 
 * @ignore
 */
define('bui/toolbar/numberpagingbar',['bui/toolbar/pagingbar'],function(require) {

    var Component = BUI.Component,
        PBar = require('bui/toolbar/pagingbar');

    var PREFIX = BUI.prefix,
        NUMBER_CONTAINER = 'numberContainer',
        CLS_NUMBER_BUTTON = PREFIX + 'button-number';

    /**
     * \u6570\u5b57\u5206\u9875\u680f
     * xclass:'pagingbar-number'
     * @extends BUI.Toolbar.PagingBar
     * @class BUI.Toolbar.NumberPagingBar
     */
    var NumberPagingBar = PBar.extend(
        /** 
        * @lends BUI.Toolbar.NumberPagingBar.prototype
        * @ignore
        */
        {
        /**
        * get the initial items of paging bar
        * @protected
        *
        */
        _getItems : function(){
            var _self = this,
                items = _self.get('items');

            if(items){
                return items;
            }
            //default items
            items = [];
            //previous item
            items.push(_self._getButtonItem(PBar.ID_PREV));
            //next item
            items.push(_self._getButtonItem(PBar.ID_NEXT));
            return items;
        },
        _getButtonItem : function(id){
          var _self = this;

          return {
              id:id,
              content:'<a href="javascript:;">'+_self.get(id + 'Text')+'</a>',
              disabled:true
          };
        },
        /**
        * bind buttons event
        * @protected
        *
        */
        _bindButtonEvent : function(){
            var _self = this,
                cls = _self.get('numberButtonCls');
            _self.constructor.superclass._bindButtonEvent.call(this);
            _self.get('el').delegate('a','click',function(ev){
              ev.preventDefault();
            });
            _self.on('click',function(ev){
              var item = ev.target;
              if(item && item.get('el').hasClass(cls)){
                var page = item.get('id');
                _self.jumpToPage(page);
              }
            });
        },
        //\u8bbe\u7f6e\u9875\u7801\u4fe1\u606f\uff0c\u8bbe\u7f6e \u9875\u6570 \u6309\u94ae
        _setNumberPages : function(){
            var _self = this;

            _self._setNumberButtons();
        },
        //\u8bbe\u7f6e \u9875\u6570 \u6309\u94ae
        _setNumberButtons : function(){
            var _self = this,
                curPage = _self.get('curPage'),
                totalPage = _self.get('totalPage'),
                numberItems = _self._getNumberItems(curPage,totalPage),
                curItem;

            _self._clearNumberButtons();

            BUI.each(numberItems,function(item){
                _self._appendNumberButton(item);
            });
            curItem = _self.getItem(curPage);
            if(curItem){
                curItem.set('selected',true);
            }
               
        },
        _appendNumberButton : function(cfg){
          var _self = this,
            count = _self.getItemCount();
          var item = _self.addItemAt(cfg,count - 1);
        },
        _clearNumberButtons : function(){
          var _self = this,
            items = _self.getItems(),
            count = _self.getItemCount();

          while(count > 2){
            _self.removeItemAt(count-2);  
            count = _self.getItemCount();          
          }
        },
        //\u83b7\u53d6\u6240\u6709\u9875\u7801\u6309\u94ae\u7684\u914d\u7f6e\u9879
        _getNumberItems : function(curPage, totalPage){
            var _self = this,
                result = [],
                maxLimitCount = _self.get('maxLimitCount'),
                showRangeCount = _self.get('showRangeCount'),
                maxPage;

            function addNumberItem(from,to){
                for(var i = from ;i<=to;i++){
                    result.push(_self._getNumberItem(i));
                }
            }

            function addEllipsis(){
                result.push(_self._getEllipsisItem());
            }

            if(totalPage < maxLimitCount){
                maxPage = totalPage;
                addNumberItem(1,totalPage);
            }else{
                var startNum = (curPage <= maxLimitCount) ? 1 : (curPage - showRangeCount),
                    lastLimit = curPage + showRangeCount,
                    endNum = lastLimit < totalPage ? (lastLimit > maxLimitCount ? lastLimit : maxLimitCount) : totalPage;
                if (startNum > 1) {
                    addNumberItem(1, 1);
                    if(startNum > 2){
                        addEllipsis();
                    }
                }
                maxPage = endNum;
                addNumberItem(startNum, endNum);
            }

            if (maxPage < totalPage) {
                if(maxPage < totalPage -1){
                    addEllipsis();
                }
                addNumberItem(totalPage, totalPage);
            }

            return result;
        },
        //\u83b7\u53d6\u7701\u7565\u53f7
        _getEllipsisItem : function(){
            var _self = this;
            return {
                disabled: true,           
                content : _self.get('ellipsisTpl')
            };
        },
        //\u751f\u6210\u9875\u9762\u6309\u94ae\u914d\u7f6e\u9879
        _getNumberItem : function(page){
            var _self = this;
            return {
                id : page,
                elCls : _self.get('numberButtonCls')
            };
        }
        
    },{
        ATTRS:{
            itemStatusCls : {
              value : {
                selected : 'active',
                disabled : 'disabled'
              }
            },
            itemTpl : {
              value : '<a href="">{id}</a>'
            },
            prevText : {
              value : '<<'
            },
            nextText : {
              value : '>>'
            },
            /**
            * \u5f53\u9875\u7801\u8d85\u8fc7\u8be5\u8bbe\u7f6e\u9875\u7801\u65f6\u5019\u663e\u793a\u7701\u7565\u53f7
            * @default {Number} 4
            */
            maxLimitCount : {
                value : 4
            },
            showRangeCount : {
                value : 1   
            },
            /**
            * the css used on number button
            */
            numberButtonCls:{
                value : CLS_NUMBER_BUTTON
            },
            /**
            * the template of ellipsis which represent the omitted pages number
            */
            ellipsisTpl : {
                value : '<a href="#">...</a>'
            }
        }
    },{
        xclass : 'pagingbar-number',
        priority : 3    
    });

    return NumberPagingBar;

});/**
 * @fileOverview \u8fdb\u5ea6\u6761\u547d\u540d\u7a7a\u95f4\u5165\u53e3
 * @ignore
 */

define('bui/progressbar',['bui/common','bui/progressbar/base','bui/progressbar/load'],function (require) {
  var BUI = require('bui/common'),
    ProgressBar = BUI.namespace('ProgressBar');
  BUI.mix(ProgressBar,{
    Base : require('bui/progressbar/base'),
    Load : require('bui/progressbar/load')
  });

  return ProgressBar;
});/**
 * @fileOverview \u8fdb\u5ea6\u6761
 * @author dengbin
 * @ignore
 */

define('bui/progressbar/base',['bui/common'],function(require){

	var BUI = require('bui/common');

	var progressBarView = BUI.Component.View.extend({
		_uiSetPercent : function (v) {

			var _self = this,
				innerEl = _self.get('el').children();
			if(!BUI.isArray(v)){
				v = [v];
			}
			BUI.each(innerEl,function (item,index) {
				$(item).width(v[index] + '%');
			});

		}
	},{
		ATTRS:{
			percent:{}
		}
	});
	/**
 	* \u57fa\u7840\u8fdb\u5ea6\u6761\uff0c\u7528\u4e8e\u663e\u793a\u8fdb\u5ea6
 	* xclass:'progress-bar'
 	* <pre><code>
 	*  BUI.use('bui/progressbar',function(ProgressBar){
  *   
  *     var Progressbar = ProgressBar.Base,
  *       progressbar = new Progressbar({
  *         elCls : 'progress progress-striped active',
  *         render : '#progressbar',
  *         tpl : '<div class="bar"></div>',
  *         percent:10
  *       });
  *     progressbar.render();
  *  });
  * </code></pre>
 	* @class BUI.ProgressBar.Base
	* @extends BUI.Component.Controller
	*/
	var progressBar = BUI.Component.Controller.extend({

	},{
		ATTRS : {
			/**
	        * \u8fdb\u5ea6\u767e\u5206\u6bd4
	        * @type {number}
	        */
			percent : {
				view:true,
				value: 0
			},
			tpl : {
				value : '<div class="progress-bar-inner"></div>'
			},
			xview : {
				value : progressBarView
			}
		}

	},{
		xclass:'progress-bar'
	});

	return progressBar;
});/**
 * @fileOverview \u5f02\u6b65\u8fdb\u5ea6\u6761
 * @author dengbin
 * @ignore
 */

define('bui/progressbar/load',['bui/progressbar/base'],function(require){

	var Base = require('bui/progressbar/base'),
	 	notStarted = 0,
		hasStarted = 1,
		hasEnded = 2;
	/**
	 * \u5f02\u6b65\u52a0\u8f7d\u8fdb\u5ea6\u6761
	 *<pre><code>
	 *  BUI.use('bui/progressbar',function(ProgressBar){
   *   
   *    var Progressbar = ProgressBar.Load;
   *    var num = 10,
   *      ajaxCfg = {     
   *        url : 'data/progress-bar-data.php',
   *        dataType : 'json',
   *        data : {
   *          id :num
   *        }
   *      };
   *    var progressbar = new Progressbar({
   *      render : '#progressbar',
   *      tpl : '<div class="bar"></div>',
   *      elCls:'progress progress-striped active',
   *      ajaxCfg : ajaxCfg,
   *      interval : 1000
   *    });
   *
   *    progressbar.render();
	 *		$('.button-primary').click(function(){
   *      num = 10;
   *      ajaxCfg.data.id = num;
   *      progressbar.start();
   *    });
 
   *    $('.button-danger').click(function(){
   *      progressbar.cancel();
   *    });
   *      
   *  });
   * </code></pre>
	 * @extends BUI.ProgressBar.Base
	 * @class  BUI.ProgressBar.Load
	 */
	var loadProgressBar = Base.extend({
		/**
	     * @protected
	     * @ignore
	     */
		bindUI : function () {
			var _self = this;

			_self.on('afterPercentChange',function (ev) {
				if(_self.isLoading()){
					var percent = _self.get('percent');
					if(percent == 100 ){
						_self.onCompleted();
					}
					_self.onChange();
				}
			});

		},
		/**
		 * \u5f00\u59cb
		 * <pre><code>
		 *   progressbar.start();
		 * </code></pre>
		 */
		start : function  () {
			var _self = this;
			if(!_self.isLoading()){
				_self.onstart();
			}
		},
		/**
		 * \u5b8c\u6210
		 * <pre><code>
		 *   progressbar.complete();
		 * </code></pre>
		 */
		complete : function(){
			var _self = this;
			clearTimeout(_self.get('t'));
			_self.set('percent',100);
			
		},
		/**
		 * \u53d6\u6d88
		 * <pre><code>
		 *   progressbar.cancel();
		 * </code></pre>
		 */
		cancel : function(){
			var _self = this;
			clearTimeout(_self.get('t'));
			if(_self.get('percent')){
				_self.set('percent',0);
			}
			_self.set('status',notStarted);
		},
		/**
		 * \u5f00\u59cb
		 * @protected
		 */
		onstart : function(){
			var _self = this,
				cfg = _self.get('cfg');

			_self.set('percent',0);
			_self.set('status',hasStarted);
			
			_self.fire('start',cfg);
			_self._startLoad();
		},
		/**
		 * \u52a0\u8f7d\u53d8\u5316
		 * @protected
		 */
		onChange : function(){
			var _self = this;
			_self.fire('loadchange');
		},

		/**
		 * \u5b8c\u6210
		 * @protected
		 */
		onCompleted : function(){
			var _self = this;
			_self.set('status',hasEnded);
			_self.fire('completed');
			
		},
		/**
		 * \u662f\u5426\u6b63\u5728\u52a0\u8f7d
		 * @return {Boolean} \u662f\u5426\u6b63\u5728\u52a0\u8f7d
		 */
		isLoading : function  () {
			return this.get('status') === hasStarted;
		},
		/**
		 * \u662f\u5426\u5df2\u7ecf\u52a0\u8f7d\u5b8c\u6bd5
		 * @return {Boolean} \u662f\u5426\u52a0\u8f7d\u5b8c\u6bd5
		 */
		isCompleted : function () {
			return this.get('status') === hasEnded;
		},
		_startLoad : function () {
			var _self = this,
				ajaxCfg = _self.get('ajaxCfg'),
				interval = _self.get('interval'),
				t;
			ajaxCfg.success = function(data){
				var percent = data.percent;
				_self.set('percent',percent);
				if(percent < 100 && _self.isLoading()){
					t = setTimeout(function(){
						$.ajax(ajaxCfg);
					},interval);
					_self.set('t',t);
				}
			};
			$.ajax(ajaxCfg);
			
		}
	},{
		ATTRS : {
			/**
			 * \u8fdb\u5ea6\u6761\u72b6\u6001
			 * 0\uff1a \u672a\u5f00\u59cb
			 * 1 \uff1a \u5df2\u5f00\u59cb
			 * 2 \uff1a \u4ee5\u7ed3\u675f
			 * @type {Number}
			 */
			status : {
				value : 0
			},
			/**
			 * ajax\u914d\u7f6e\u9879
			 * @type {Object}
			 */
			ajaxCfg : {

			},
			/**
			 * \u53d1\u9001\u8bf7\u6c42\u65f6\u95f4\u95f4\u9694
			 * @type {number}
			 */
			interval : {
				value : 500
			},
			/**  
	        * \u5f53\u6570\u636e\u52a0\u8f7d\u5b8c\u6210\u540e
	        * @name BUI.ProgressBar.Load  
	        * @event  
	        * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61\uff0c\u5305\u542b\u52a0\u8f7d\u6570\u636e\u65f6\u7684\u53c2\u6570
	        */
			events : {
				value : [
					'start',
					'loadchange',
					'completed'
				]
			}
		}
	},{
		xclass : 'progress-bar-load'
	});

	return loadProgressBar;
});
/**
 * @fileOverview \u65e5\u5386\u547d\u540d\u7a7a\u95f4\u5165\u53e3
 * @ignore
 */

define('bui/calendar',['bui/common','bui/calendar/calendar','bui/calendar/monthpicker','bui/calendar/datepicker'],function (require) {
  var BUI = require('bui/common'),
    Calendar = BUI.namespace('Calendar');
  BUI.mix(Calendar,{
    Calendar : require('bui/calendar/calendar'),
    MonthPicker : require('bui/calendar/monthpicker'),
    DatePicker : require('bui/calendar/datepicker')
  });

  return Calendar;
});/**
 * @fileOverview \u9009\u62e9\u5e74\u6708
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/calendar/monthpicker',['bui/common','bui/overlay','bui/list','bui/toolbar'],function (require){
  var BUI = require('bui/common'),
    Component = BUI.Component,
    Overlay = require('bui/overlay').Overlay,
    List = require('bui/list').SimpleList,
    Toolbar = require('bui/toolbar'),
	  PREFIX = BUI.prefix,
    CLS_MONTH = 'x-monthpicker-month',
    DATA_MONTH = 'data-month',
    DATA_YEAR = 'data-year',
    CLS_YEAR = 'x-monthpicker-year',
    CLS_YEAR_NAV = 'x-monthpicker-yearnav',
    CLS_SELECTED = 'x-monthpicker-selected',
    CLS_ITEM = 'x-monthpicker-item',
    months = ['\u4e00\u6708','\u4e8c\u6708','\u4e09\u6708','\u56db\u6708','\u4e94\u6708','\u516d\u6708','\u4e03\u6708','\u516b\u6708','\u4e5d\u6708','\u5341\u6708','\u5341\u4e00\u6708','\u5341\u4e8c\u6708'];

  function getMonths(){
    return $.map(months,function(month,index){
      return {text:month,value:index};
    });
  }

  var MonthPanel = List.extend({

    
    bindUI : function(){
      var _self = this;
      _self.get('el').delegate('a','click',function(ev){
        ev.preventDefault();
      }).delegate('.' + CLS_MONTH,'dblclick',function(){
        _self.fire('dblclick');
      });
    }
  },{
    ATTRS:{
      itemTpl:{
        view:true,
        value : '<li class="'+CLS_ITEM+' x-monthpicker-month"><a href="#" hidefocus="on">{text}</a></li>'
      },
      
      itemCls : {
        value : CLS_ITEM
      },
      items:{
        view:true,
        value:getMonths()
      },
      elCls : {
        view:true,
        value:'x-monthpicker-months'
      }
    }
  },{
    xclass:'calendar-month-panel'
  });


  var YearPanel = List.extend({

    bindUI : function(){
      var _self = this,
        el = _self.get('el');
      el.delegate('a','click',function(ev){
        ev.preventDefault();
      });

      el.delegate('.' + CLS_YEAR,'dblclick',function(){
        _self.fire('dblclick');
      });

      el.delegate('.x-icon','click',function(ev){
        var sender = $(ev.currentTarget);

        if(sender.hasClass(CLS_YEAR_NAV + '-prev')){
          _self._prevPage();
        }else if(sender.hasClass(CLS_YEAR_NAV + '-next')){
          _self._nextPage();
        }
      });
      _self.on('itemselected',function(ev){
        if(ev.item){
          _self.setInternal('year',ev.item.value);
        }
        
      });
    },
    _prevPage : function(){
      var _self = this,
        start = _self.get('start'),
        yearCount = _self.get('yearCount');
      _self.set('start',start - yearCount);
    },
    _nextPage : function(){
      var _self = this,
        start = _self.get('start'),
        yearCount = _self.get('yearCount');
      _self.set('start',start + yearCount);
    },
    _uiSetStart : function(){
      var _self = this;
      _self._setYearsContent();
    },
    _uiSetYear : function(v){
      var _self = this,
        item = _self.findItemByField('value',v);
      if(item){
        _self.setSelectedByField(v);
      }else{
        _self.set('start',v);
      }
    },
    _setYearsContent : function(){
      var _self = this,
        year = _self.get('year'),
        start = _self.get('start'),
        yearCount = _self.get('yearCount'),
        items = [];

      for(var i = start;i< start + yearCount;i++){
        var text = i.toString();

        items.push({text:text,value:i});
      }
      _self.set('items',items);
      _self.setSelectedByField(year);
    }

  },{
    ATTRS:{
      items:{
        view:true,
        value:[]
      },
      elCls : {
        view:true,
        value:'x-monthpicker-years'
      },
      itemCls : {
        value : CLS_ITEM
      },
      year:{

      },
      /**
       * \u8d77\u59cb\u5e74
       * @private
       * @ignore
       * @type {Number}
       */
      start:{
        value: new Date().getFullYear()
      },
      /**
       * \u5e74\u6570
       * @private
       * @ignore
       * @type {Number}
       */
      yearCount:{
        value:10
      },
      itemTpl : {
        view:true,
        value : '<li class="'+CLS_ITEM+' '+CLS_YEAR+'"><a href="#" hidefocus="on">{text}</a></li>'
      },
      tpl : {
        view:true,
        value:'<div class="'+CLS_YEAR_NAV+'">'+
              '<span class="'+CLS_YEAR_NAV+'-prev x-icon x-icon-normal x-icon-small"><span class="icon icon-caret icon-caret-left"></span></span>'+
              '<span class="'+CLS_YEAR_NAV+'-next x-icon x-icon-normal x-icon-small"><span class="icon icon-caret icon-caret-right"></span></span>'+
              '</div>'+
              '<ul></ul>'
      }
    }
  },{
    xclass:'calendar-year-panel'
  });
  
  /**
   * \u6708\u4efd\u9009\u62e9\u5668
   * xclass : 'calendar-monthpicker'
   * @class BUI.Calendar.MonthPicker
   * @extends BUI.Overlay.Overlay
   */
  var monthPicker = Overlay.extend({

    initializer : function(){
      var _self = this,
        children = _self.get('children'),
        monthPanel = new MonthPanel(),
        yearPanel = new YearPanel(),
        footer = _self._createFooter();

      children.push(monthPanel);
      children.push(yearPanel);
      children.push(footer);

      _self.set('yearPanel',yearPanel);
      _self.set('monthPanel',monthPanel);
    },
    bindUI : function(){
      var _self = this;

      _self.get('monthPanel').on('itemselected',function(ev){
        if(ev.item){
          _self.setInternal('month',ev.item.value);
        }
      }).on('dblclick',function(){
        _self._successCall();
      });

      _self.get('yearPanel').on('itemselected',function(ev){
        if(ev.item){
          _self.setInternal('year',ev.item.value);
        }
      }).on('dblclick',function(){
        _self._successCall();
      });

    },
    _successCall : function(){
      var _self = this,
        callback = _self.get('success');

      if(callback){
        callback.call(_self);
      }
    },
    _createFooter : function(){
      var _self = this;
      return new Toolbar.Bar({
          elCls : PREFIX + 'clear x-monthpicker-footer',
          children:[
            {
              xclass:'bar-item-button',
              text:'\u786e\u5b9a',
              btnCls: 'button button-small button-primary',
              handler:function(){
                _self._successCall();
              }
            },{
              xclass:'bar-item-button',
              text:'\u53d6\u6d88',
              btnCls:'button button-small last',
              handler:function(){
                var callback = _self.get('cancel');
                if(callback){
                  callback.call(_self);
                }
              }
            }
          ]
        });
    },
    _uiSetYear : function(v){
      this.get('yearPanel').set('year',v);
    },
    _uiSetMonth:function(v){
      this.get('monthPanel').setSelectedByField(v);
    }
  },{
    ATTRS:
    /**
     * @lends BUI.Calendar.MonthPicker#
     * @ignore
     */
    {
      /**
       * \u4e0b\u90e8\u5de5\u5177\u680f
       * @private
       * @type {Object}
       */
      footer : {

      },
      align : {
        value : {}
      },
      /**
       * \u9009\u4e2d\u7684\u5e74
       * @type {Number}
       */
      year : {
        
      },
      /**
       * \u6210\u529f\u7684\u56de\u8c03\u51fd\u6570
       * @type {Function}
       */
      success:{
        value : function(){

        }
      },
      /**
       * \u53d6\u6d88\u7684\u56de\u8c03\u51fd\u6570
       * @type {Function}
       */
      cancel :{

      value : function(){} 
 
      },
      width:{
        value:180
      },
      /**
       * \u9009\u4e2d\u7684\u6708
       * @type {Number}
       */
      month:{
        
      },
      /**
       * \u9009\u62e9\u5e74\u7684\u63a7\u4ef6
       * @private
       * @type {Object}
       */
      yearPanel : {

      },
      /**
       * \u9009\u62e9\u6708\u7684\u63a7\u4ef6
       * @private
       * @type {Object}
       */
      monthPanel:{

      }

    }
  },{
    xclass :'monthpicker'
  });
  return monthPicker;

});/**
 * @fileOverview \u65e5\u671f\u63a7\u4ef6\u6765\u9009\u62e9\u5e74\u6708\u7684\u90e8\u5206
 * @ignore
 */

define('bui/calendar/header',['bui/common'],function (require) {
  
  var BUI = require('bui/common'),
    PREFIX = BUI.prefix,
    Component = BUI.Component,
    CLS_TEXT_YEAR = 'year-text',
    CLS_TEXT_MONTH = 'month-text',
    CLS_ARROW = 'x-datepicker-arrow',
    CLS_PREV = 'x-datepicker-prev',
    CLS_NEXT = 'x-datepicker-next';
      
  /**
   * \u65e5\u5386\u63a7\u4ef6\u663e\u793a\u9009\u62e9\u5e74\u6708
   * xclass:'calendar-header'
   * @class BUI.Calendar.Header
   * @private
   * @extends BUI.Component.Controller
   */
  var header = Component.Controller.extend({

    bindUI : function(){
      var _self = this,
        el = _self.get('el');
		
      el.delegate('.' + CLS_ARROW,'click',function(e){
        e.preventDefault();
        var sender = $(e.currentTarget);
        if(sender.hasClass(CLS_NEXT)){
          _self.nextMonth();
        }else if(sender.hasClass(CLS_PREV)){
          _self.prevMonth();
        }
      });

      el.delegate('.x-datepicker-month','click',function(){
        _self.fire('headerclick');
      });
	  
    },
    /**
     * \u8bbe\u7f6e\u5e74\u6708
     * @ignore
     * @param {Number} year  \u5e74
     * @param {Number} month \u6708
     */
    setMonth : function(year,month){
      var _self = this,
        curYear = _self.get('year'),
        curMonth = _self.get('month');
      if(year !== curYear || month !== curMonth){
        _self.set('year',year);
        _self.set('month',month);
        _self.fire('monthchange',{year:year,month:month});
      }
    },
    /**
     * \u4e0b\u4e00\u6708
     * @ignore
     */
    nextMonth : function(){
      var _self = this,
        date = new Date(_self.get('year'),_self.get('month') + 1);

      _self.setMonth(date.getFullYear(),date.getMonth());
    },
    /**
     * \u4e0a\u4e00\u6708
     * @ignore
     */
    prevMonth : function(){
      var _self = this,
        date = new Date(_self.get('year'),_self.get('month') - 1);

       _self.setMonth(date.getFullYear(),date.getMonth());
    },
    _uiSetYear : function(v){
      var _self = this;
      _self.get('el').find('.' + CLS_TEXT_YEAR).text(v);
    },
    _uiSetMonth : function(v){
        var _self = this;
      _self.get('el').find('.' + CLS_TEXT_MONTH).text(v+1);
    }

  },{
    ATTRS : {
      /**
       * \u5e74
       * @type {Number}
       */
      year:{
        sync:false
      },
      /**
       * \u6708
       * @type {Number}
       */
      month:{
        sync:false,
        setter:function(v){
          this.set('monthText',v+1);
        }
      },
      /**
       * @private
       * @type {Object}
       */
      monthText : {
        
      },
      tpl:{
        view:true,
        value:'<div class="'+CLS_ARROW+' ' + CLS_PREV + '"><span class="icon icon-white icon-caret  icon-caret-left"></span></div>'+
          '<div class="x-datepicker-month">'+
            '<div class="month-text-container">'+
              '<span><span class="year-text">{year}</span>\u5e74 <span class="month-text">{monthText}</span>\u6708</span>'+
              '<span class="' + PREFIX + 'caret ' + PREFIX + 'caret-down"></span>'+
            '</div>'+
          '</div>' +
          '<div class="'+CLS_ARROW+' ' + CLS_NEXT + '"><span class="icon icon-white icon-caret  icon-caret-right"></span></div>'
      },
      elCls:{
        view:true,
        value:'x-datepicker-header'
      },
  	  events:{
    		value:{
          /**
           * \u6708\u53d1\u751f\u6539\u53d8\uff0c\u5e74\u53d1\u751f\u6539\u53d8\u4e5f\u610f\u5473\u7740\u6708\u53d1\u751f\u6539\u53d8
           * @event
           * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
           * @param {Number} e.year \u5e74
           * @param {Number} e.month \u6708
           */
    			'monthchange' : true
    		}
  	  }
    }
  },{
    xclass:'calendar-header'
  });

  return header;

});/**
 * @fileOverview \u65e5\u5386\u63a7\u4ef6\u663e\u793a\u4e00\u6708\u7684\u65e5\u671f
 * @author dxq613@gmail.com
 * @ignore
 */
define('bui/calendar/panel',['bui/common'],function (require) {

  var BUI = require('bui/common'),
    Component = BUI.Component,
    DateUtil = BUI.Date,
    CLS_DATE = 'x-datepicker-date',
    CLS_TODAY = 'x-datepicker-today',
    CLS_DISABLED = 'x-datepicker-disabled',
    CLS_ACTIVE = 'x-datepicker-active',
    DATA_DATE = 'data-date',//\u5b58\u50a8\u65e5\u671f\u5bf9\u8c61
    DATE_MASK = 'isoDate',
    CLS_SELECTED = 'x-datepicker-selected',
    SHOW_WEEKS = 6,//\u5f53\u524d\u5bb9\u5668\u663e\u793a6\u5468
    dateTypes = {
      deactive : 'prevday',
      active : 'active',
      disabled : 'disabled'
    },
    weekDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  /**
   * \u65e5\u5386\u9762\u677f\u7684\u89c6\u56fe\u7c7b
   * @class BUI.Calendar.PanelView
   * @extends BUI.Component.View
   * @private
   */
  var panelView = Component.View.extend({

    renderUI : function(){
      this.updatePanel();
    },

    //\u66f4\u65b0\u5bb9\u5668\uff0c\u5f53\u6708\u3001\u5e74\u53d1\u751f\u6539\u53d8\u65f6
    updatePanel : function(){
      var _self = this,
        el = _self.get('el'),
        bodyEl = el.find('tbody'),
        innerTem = _self._getPanelInnerTpl();

      bodyEl.empty();
      $(innerTem).appendTo(bodyEl);
    },
    //\u83b7\u53d6\u5bb9\u5668\u5185\u5bb9
    _getPanelInnerTpl : function(){
      var _self = this,
        startDate = _self._getFirstDate(),
        temps = [];

      for (var i = 0; i < SHOW_WEEKS; i++) {
        var weekStart = DateUtil.addWeek(i,startDate);
        temps.push(_self._getWeekTpl(weekStart));
      };

      return temps.join('');
    },
    //\u83b7\u53d6\u5468\u6a21\u7248
    _getWeekTpl : function(startDate){
      var _self = this,
        weekTpl = _self.get('weekTpl'),
        daysTemps = [];
      for (var i = 0; i < weekDays.length; i++) {
        var date = DateUtil.addDay(i,startDate);
        daysTemps.push(_self._getDayTpl(date));  
      }

      return BUI.substitute(weekTpl,{
        daysTpl:daysTemps.join('')
      });
    },
    //\u83b7\u53d6\u65e5\u6a21\u7248
    _getDayTpl : function(date){
      var _self = this,
        dayTpl = _self.get('dayTpl'),
        day = date.getDay(),
        todayCls = _self._isToday(date) ? CLS_TODAY:'',
        dayOfWeek = weekDays[day],
        dateNumber = date.getDate(),
        //\u4e0d\u662f\u672c\u6708\u5219\u5904\u4e8e\u4e0d\u6d3b\u52a8\u72b6\u6001
        //\u4e0d\u5728\u6307\u5b9a\u7684\u6700\u5927\u6700\u5c0f\u8303\u56f4\u5185\uff0c\u7981\u6b62\u9009\u4e2d
        dateType = _self._isInRange(date) ? (_self._isCurrentMonth(date) ? dateTypes.active : dateTypes.deactive) : dateTypes.disabled;

      return BUI.substitute(dayTpl,{
        dayOfWeek : dayOfWeek,
        dateType : dateType,
        dateNumber : dateNumber,
        todayCls : todayCls,
        date : DateUtil.format(date,DATE_MASK)
      });
    },
    //\u83b7\u53d6\u5f53\u524d\u5bb9\u5668\u7684\u7b2c\u4e00\u5929
    _getFirstDate : function(year,month){
      var _self = this,
        monthFirstDate = _self._getMonthFirstDate(year,month),
        day = monthFirstDate.getDay();
      return DateUtil.addDay(day * -1,monthFirstDate);
    },
    //\u83b7\u53d6\u5f53\u6708\u7684\u7b2c\u4e00\u5929
    _getMonthFirstDate : function(year,month){
      var _self = this,
        year = year || _self.get('year'),
        month = month || _self.get('month');
      return new Date(year,month);
    },
    //\u662f\u5426\u662f\u5f53\u524d\u663e\u793a\u7684\u6708
    _isCurrentMonth : function(date){
      return date.getMonth() === this.get('month');
    },
    //\u662f\u5426\u662f\u4eca\u5929
    _isToday : function(date){
      var tody = new Date();
      return tody.getFullYear() === date.getFullYear() && tody.getMonth() === date.getMonth() && tody.getDate() === date.getDate();
    },
    //\u662f\u5426\u5728\u5141\u8bb8\u7684\u8303\u56f4\u5185
    _isInRange : function(date){
      var _self = this,
        maxDate = _self.get('maxDate'),
        minDate = _self.get('minDate');

      if(minDate && date < minDate){
        return false;
      }
      if(maxDate && date > maxDate){
        return false;
      }
      return true;
    },
    //\u6e05\u9664\u9009\u4e2d\u7684\u65e5\u671f
    _clearSelectedDate : function(){
      var _self = this;
      _self.get('el').find('.'+CLS_SELECTED).removeClass(CLS_SELECTED);
    },
    //\u67e5\u627e\u65e5\u671f\u5bf9\u5e94\u7684DOM\u8282\u70b9
    _findDateElement : function(date){
      var _self = this,
        dateStr = DateUtil.format(date,DATE_MASK),
        activeList = _self.get('el').find('.' + CLS_DATE),
        result = null;
      if(dateStr){
        activeList.each(function(index,item){
          if($(item).attr('title') === dateStr){
            result = $(item);
            return false;
          }
        });
      }
      return result;
    },
    //\u8bbe\u7f6e\u9009\u4e2d\u7684\u65e5\u671f
    _setSelectedDate : function(date){
      var _self = this,
        dateEl = _self._findDateElement(date);

      _self._clearSelectedDate();
      if(dateEl){
        dateEl.addClass(CLS_SELECTED);
      }
    }
  },{
    ATTRS : {

    }
  });
  
  /**
   * \u65e5\u5386\u63a7\u4ef6\u663e\u793a\u65e5\u671f\u7684\u5bb9\u5668
   * xclass:'calendar-panel'
   * @class BUI.Calendar.Panel
   * @private
   * @extends BUI.Component.Controller
   */
  var panel = Component.Controller.extend(
  /**
  * @lends  BUI.Calendar.Panel.prototype 
  * @ignore
  */
  {

    /**
     * \u8bbe\u7f6e\u9ed8\u8ba4\u5e74\u6708
     * @protected
     */
    initializer : function(){
      var _self = this,
        now = new Date();
      if(!_self.get('year')){
        _self.set('year',now.getFullYear());
      }

      if(!_self.get('month')){
        _self.set('month',now.getMonth());
      }
    },
    /**
     * @protected
     * @ignore
     */
    bindUI : function(){
      var _self = this,
        el = _self.get('el');
      el.delegate('.' + CLS_DATE,'click',function(e){
        e.preventDefault();
      });
      //\u963b\u6b62\u7981\u7528\u7684\u65e5\u671f\u88ab\u9009\u62e9
      el.delegate('.' + CLS_DISABLED,'mouseup',function(e){
        e.stopPropagation();
      });
    },
    /**
     * @protected
     * @ignore
     */
    performActionInternal : function(ev){
      var _self = this,
        sender = $(ev.target).closest('.' + CLS_DATE);
      if(sender){
        var date = sender.attr('title');
        if(date){
          date = DateUtil.parse(date);
          if(_self.get('view')._isInRange(date)){
            _self.set('selected',date);
          }
          //_self.fire('click',{date:date});
        }
      }
    },
    /**
     * \u8bbe\u7f6e\u5e74\u6708
     * @param {Number} year  \u5e74
     * @param {Number} month \u6708
     */
    setMonth : function(year,month){
      var _self = this,
        curYear = _self.get('year'),
        curMonth = _self.get('month');
      if(year !== curYear || month !== curMonth){
        _self.set('year',year);
        _self.set('month',month);
    		//if(_self.get('rendered')){
    			_self.get('view').updatePanel();
    		//}
      }
    },
    //\u9009\u4e2d\u65e5\u671f
    _uiSetSelected : function(date,ev){
      var _self = this;
      
      if(!(ev && ev.prevVal && DateUtil.isDateEquals(date,ev.prevVal))){
        _self.setMonth(date.getFullYear(),date.getMonth());
        _self.get('view')._setSelectedDate(date);
        _self.fire('selectedchange',{date:date});
      } 
    },
    //\u8bbe\u7f6e\u6700\u65e5\u671f
    _uiSetMaxDate : function(v){
      if(v){
        this.get('view').updatePanel();
      }
    },
    //\u8bbe\u7f6e\u6700\u5c0f\u65e5\u671f
    _uiSetMinDate : function(v){
      if(v){
        this.get('view').updatePanel();
      }
    }
  },{
    ATTRS:
    /**
     * @lends BUI.Calendar.Panel#
     * @ignore
     */
    {
      /**
       * \u5c55\u793a\u7684\u6708\u6240\u5c5e\u5e74
       * @type {Number}
       */
      year : {
        view :true
      },
      /**
       * \u5c55\u793a\u7684\u6708
       * @type {Number}
       */
      month:{
        view :true
      },
      /**
       * \u9009\u4e2d\u7684\u65e5\u671f
       * @type {Date}
       */
      selected : {

      },
      focusable:{
        value:true
      },
      /**
       * \u65e5\u671f\u7684\u6a21\u677f
       * @private
       * @type {Object}
       */
      dayTpl:{
        view : true,
        value:'<td class="x-datepicker-date x-datepicker-{dateType} {todayCls} day-{dayOfWeek}" title="{date}">'+
                '<a href="#" hidefocus="on" tabindex="1">'+
                  '<em><span>{dateNumber}</span></em>'+
                '</a>'+
              '</td>'
      },
      events:{
        value : {
          /**
           * @event
           * @name BUI.Calendar.Panel#click
           * @param {Object} e \u70b9\u51fb\u4e8b\u4ef6
           * @param {Date} e.date
           */
          'click' : false,
          /**
           * @name BUI.Calendar.Panel#selectedchange
           * @param {Object} e \u70b9\u51fb\u4e8b\u4ef6
           * @param {Date} e.date
           */
          'selectedchange' : false
        }
      },
      /**
       * \u6700\u5c0f\u65e5\u671f
       * @type {Date | String}
       */
      maxDate : {
        view : true,
        setter : function(val){
          if(val){
            if(BUI.isString(val)){
              return DateUtil.parse(val);
            }
            return val;
          }
        }
      },
      /**
       * \u6700\u5c0f\u65e5\u671f
       * @type {Date | String}
       */
      minDate : {
        view : true,
        setter : function(val){
          if(val){
            if(BUI.isString(val)){
              return DateUtil.parse(val);
            }
            return val;
          }
        }
      },
      /**
       * \u5468\u7684\u6a21\u677f
       * @private
       * @type {Object}
       */
      weekTpl:{
        view : true,
        value : '<tr>{daysTpl}</tr>'
      },
      tpl:{
        view:true,
        value:'<table class="x-datepicker-inner" cellspacing="0">' +
                '<thead>' +
                   '<tr>' +
                    '<th  title="Sunday"><span>\u65e5</span></th>' +
                    '<th  title="Monday"><span>\u4e00</span></th>' +
                    '<th  title="Tuesday"><span>\u4e8c</span></th>' +
                    '<th  title="Wednesday"><span>\u4e09</span></th>' +
                    '<th  title="Thursday"><span>\u56db</span></th>' +
                    '<th  title="Friday"><span>\u4e94</span></th>' +
                    '<th  title="Saturday"><span>\u516d</span></th>' +
                  '</tr>' +
                '</thead>' +
                '<tbody class="x-datepicker-body">' +
                '</tbody>' +
              '</table>'
      },
      xview : {value : panelView}
    }
  },{
    xclass:'calendar-panel',
    priority:0
  });

  return panel;
});/**
 * @fileOverview \u65e5\u671f\u63a7\u4ef6
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/calendar/calendar',['bui/picker','bui/calendar/monthpicker','bui/calendar/header','bui/calendar/panel','bui/toolbar'],function(require){
  
  var BUI = require('bui/common'),
    PREFIX = BUI.prefix,
    CLS_PICKER_TIME = 'x-datepicker-time',
    CLS_PICKER_HOUR = 'x-datepicker-hour',
    CLS_PICKER_MINUTE = 'x-datepicker-minute',
    CLS_PICKER_SECOND = 'x-datepicker-second',
    CLS_TIME_PICKER = 'x-timepicker',
    Picker = require('bui/picker').ListPicker,
    MonthPicker = require('bui/calendar/monthpicker'),
    Header = require('bui/calendar/header'),
    Panel = require('bui/calendar/panel'),
    Toolbar = require('bui/toolbar'),
    Component = BUI.Component,
    DateUtil = BUI.Date;

  function today(){
    var now = new Date();
    return new Date(now.getFullYear(),now.getMonth(),now.getDate());
  }

  function fixedNumber(n){
    if( n< 10 ){
      return '0'+n;
    }
    return n.toString();
  }
  function getNumberItems(end){
    var items = [];
    for (var i = 0; i < end; i++) {
      items.push({text:fixedNumber(i),value:fixedNumber(i)});
    }
    return items;
  }

  function getTimeUnit (self,cls){
    var inputEl = self.get('el').find('.' + cls);
    return parseInt(inputEl.val());

  }

  function setTimeUnit (self,cls,val){
    var inputEl = self.get('el').find('.' + cls);
    if(BUI.isNumber(val)){
      val = fixedNumber(val);
    }
    inputEl.val(val);
  }



  /**
   * \u65e5\u671f\u63a7\u4ef6
   * <p>
   * <img src="../assets/img/class-calendar.jpg"/>
   * </p>
   * xclass:'calendar'
   * <pre><code>
   *  BUI.use('bui/calendar',function(Calendar){
   *    var calendar = new Calendar.Calendar({
   *      render:'#calendar'
   *    });
   *    calendar.render();
   *    calendar.on('selectedchange',function (ev) {
   *      alert(ev.date);
   *    });
   * });
   * </code></pre>
   * @class BUI.Calendar.Calendar
   * @extends BUI.Component.Controller
   */
  var calendar = Component.Controller.extend({

    //\u8bbe\u7f6e\u5185\u5bb9
    initializer: function(){
      var _self = this,
        children = _self.get('children'),
        header = new Header(),
        panel = new Panel(),
        footer = _self.get('footer') || _self._createFooter(),
        monthPicker = _self.get('monthPicker') || _self._createMonthPicker();
        

      //\u6dfb\u52a0\u5934
      children.push(header);
      //\u6dfb\u52a0panel
      children.push(panel);
      children.push(footer);
      children.push(monthPicker);

      _self.set('header',header);
      _self.set('panel',panel);
      _self.set('footer',footer);
      _self.set('monthPicker',monthPicker);

    },
    renderUI : function(){
      var _self = this,
      children = _self.get('children');
      if(_self.get('showTime')){
        var  timepicker = _self.get('timepicker') || _self._initTimePicker();
        children.push(timepicker);
        _self.set('timepicker',timepicker);
      }
    },
    //\u7ed1\u5b9a\u4e8b\u4ef6
    bindUI : function(){
      var _self = this,
        header = _self.get('header'),
        panel = _self.get('panel');

      panel.on('selectedchange',function(e){
        var date = e.date;
        if(!DateUtil.isDateEquals(date,_self.get('selectedDate'))){
          _self.set('selectedDate',date);
        }
      });
      if(!_self.get('showTime')){
        panel.on('click',function(){
          _self.fire('accept');
        });
      }else{
        _self._initTimePickerEvent();
      }
    
      header.on('monthchange',function(e){
        _self._setYearMonth(e.year,e.month);
      });

      header.on('headerclick',function(){
        var monthPicker = _self.get('monthPicker');
        monthPicker.set('year',header.get('year'));
        monthPicker.set('month',header.get('month'));
        monthPicker.show();
      });
    },
    _initTimePicker : function(){
      var _self = this,
        picker = new Picker({
          elCls : CLS_TIME_PICKER,
          children:[{
            itemTpl : '<li><a href="#">{text}</a></li>'
          }],
          autoAlign : false,
          align : {
            node : _self.get('el'),
            points:['bl','bl'],
            offset:[0,-30]
          },
          trigger : _self.get('el').find('.' + CLS_PICKER_TIME)
        });
      picker.render();
      _self._initTimePickerEvent(picker);
      return picker;
    },
    _initTimePickerEvent : function(picker){
      var _self = this,
        picker= _self.get('timepicker');

      if(!picker){
        return;
      }

      picker.get('el').delegate('a','click',function(ev){
        ev.preventDefault();
      });
      picker.on('triggerchange',function(ev){
        var curTrigger = ev.curTrigger;
        if(curTrigger.hasClass(CLS_PICKER_HOUR)){
          picker.get('list').set('items',getNumberItems(24));
        }else{
          picker.get('list').set('items',getNumberItems(60));
        }
      });

      picker.on('selectedchange',function(ev){
        var curTrigger = ev.curTrigger,
          val = ev.value;
        if(curTrigger.hasClass(CLS_PICKER_HOUR)){
          _self.setInternal('hour',val);
        }else if(curTrigger.hasClass(CLS_PICKER_MINUTE)){
          _self.setInternal('minute',val);
        }else{
          _self.setInternal('second',val);
        }
      });
    },
    //\u66f4\u6539\u5e74\u548c\u6708
    _setYearMonth : function(year,month){
      var _self = this,
        selectedDate = _self.get('selectedDate'),
        date = selectedDate.getDate();
      if(year !== selectedDate.getFullYear() || month !== selectedDate.getMonth()){
        _self.set('selectedDate',new Date(year,month,date));
      }
    },
    //\u521b\u5efa\u9009\u62e9\u6708\u7684\u63a7\u4ef6
    _createMonthPicker: function(){
      var _self = this;

      return new MonthPicker({
        effect : {
          effect:'slide',
          duration:300
        },
        visibleMode:'display',
        success : function(){
          var picker = this;
          _self._setYearMonth(picker.get('year'),picker.get('month'));
          picker.hide();
        },
        cancel : function(){
          this.hide();
        }
      });
    },
    //\u521b\u5efa\u5e95\u90e8\u6309\u94ae\u680f
    _createFooter : function(){
      var _self = this,
        showTime = this.get('showTime'),
        items = [];

      if(showTime){
        items.push({
          content : _self.get('timeTpl')
        });
        items.push({
          xclass:'bar-item-button',
          text:'\u786e\u5b9a',
          btnCls: 'button button-small button-primary',
          listeners:{
            click:function(){            
              _self.fire('accept');
            }
          }  
        });
      }else{
        items.push({
          xclass:'bar-item-button',
          text:'\u4eca\u5929',
          btnCls: 'button button-small',
          listeners:{
            click:function(){
              var day = today();
              _self.set('selectedDate',day);
              _self.fire('accept');
            }
          }  
        });
      }
      
      return new Toolbar.Bar({
          elCls : PREFIX + 'calendar-footer',
          children:items
        });
    },
    //\u8bbe\u7f6e\u6240\u9009\u65e5\u671f
    _uiSetSelectedDate : function(v){
      var _self = this,
        year = v.getFullYear(),
        month = v.getMonth();

      _self.get('header').setMonth(year,month);
      _self.get('panel').set('selected',v);
      _self.fire('datechange',{date:v});
    },
    _uiSetHour : function(v){
      setTimeUnit(this,CLS_PICKER_HOUR,v);
    },
    _uiSetMinute : function(v){
      setTimeUnit(this,CLS_PICKER_MINUTE,v);
    },
    _uiSetSecond : function(v){
      setTimeUnit(this,CLS_PICKER_SECOND,v);
    },
    //\u8bbe\u7f6e\u6700\u5927\u503c
    _uiSetMaxDate : function(v){
      var _self = this;
      _self.get('panel').set('maxDate',v);
    },
    //\u8bbe\u7f6e\u6700\u5c0f\u503c
    _uiSetMinDate : function(v){
      var _self = this;
      _self.get('panel').set('minDate',v);
    }

  },{
    ATTRS : 
    /**
     * @lends BUI.Calendar.Calendar#
     * @ignore
     */
    {
      /**
       * \u65e5\u5386\u63a7\u4ef6\u5934\u90e8\uff0c\u9009\u62e9\u5e74\u6708
       * @private
       * @type {Object}
       */
      header:{

      },

      /**
       * \u65e5\u5386\u63a7\u4ef6\u9009\u62e9\u65e5
       * @private
       * @type {Object}
       */
      panel:{

      },
      /**
       * \u6700\u5927\u65e5\u671f
       * <pre><code>
       *   calendar.set('maxDate','2013-07-29');
       * </code></pre>
       * @type {Date}
       */
      maxDate : {

      },
      /**
       * \u6700\u5c0f\u65e5\u671f
       * <pre><code>
       *   calendar.set('minDate','2013-07-29');
       * </code></pre>
       * @type {Date}
       */
      minDate : {

      },
      /**
       * \u9009\u62e9\u6708\u4efd\u63a7\u4ef6
       * @private
       * @type {Object}
       */
      monthPicker : {

      },
      /**
       * \u9009\u62e9\u65f6\u95f4\u63a7\u4ef6
       * @private
       * @type {Object}
       */
      timepicker:{

      },
      width:{
        value:180
      },
      events:{
        value:{
           /**
           * @event
           * @name BUI.Calendar.Calendar#click
           * @param {Object} e \u70b9\u51fb\u4e8b\u4ef6
           * @param {Date} e.date
           */
          'click' : false,
          /**
           * \u786e\u8ba4\u65e5\u671f\u66f4\u6539\uff0c\u5982\u679c\u4e0d\u663e\u793a\u65e5\u671f\u5219\u5f53\u70b9\u51fb\u65e5\u671f\u6216\u8005\u70b9\u51fb\u4eca\u5929\u6309\u94ae\u65f6\u89e6\u53d1\uff0c\u5982\u679c\u663e\u793a\u65e5\u671f\uff0c\u5219\u5f53\u70b9\u51fb\u786e\u8ba4\u6309\u94ae\u65f6\u89e6\u53d1\u3002
           * @event
           */
          'accept' : false,
          /**
           * @event
           * @name BUI.Calendar.Calendar#datechange
           * @param {Object} e \u9009\u4e2d\u7684\u65e5\u671f\u53d1\u751f\u6539\u53d8
           * @param {Date} e.date
           */
          'datechange' : false,
           /**
           * @event
           * @name BUI.Calendar.Calendar#monthchange
           * @param {Object} e \u6708\u4efd\u53d1\u751f\u6539\u53d8
           * @param {Number} e.year
           * @param {Number} e.month
           */
          'monthchange' : false
        }
      },
      /**
       * \u662f\u5426\u9009\u62e9\u65f6\u95f4,\u6b64\u9009\u9879\u51b3\u5b9a\u662f\u5426\u53ef\u4ee5\u9009\u62e9\u65f6\u95f4
       * 
       * @cfg {Boolean} showTime
       */
      showTime : {
        value : false
      },
      timeTpl : {
        value : '<input type="text" readonly class="' + CLS_PICKER_TIME + ' ' + CLS_PICKER_HOUR + '" />:<input type="text" readonly class="' + CLS_PICKER_TIME + ' ' + CLS_PICKER_MINUTE + '" />:<input type="text" readonly class="' + CLS_PICKER_TIME + ' ' + CLS_PICKER_SECOND + '" />'
      },
      /**
       * \u9009\u62e9\u7684\u65e5\u671f,\u9ed8\u8ba4\u4e3a\u5f53\u5929
       * <pre><code>
       *  var calendar = new Calendar.Calendar({
       *  render:'#calendar',
       *   selectedDate : new Date('2013/07/01') //\u4e0d\u80fd\u4f7f\u7528\u5b57\u7b26\u4e32
       * });
       * </code></pre>
       * @cfg {Date} selectedDate
       */
      /**
       * \u9009\u62e9\u7684\u65e5\u671f
       * <pre><code>
       *   calendar.set('selectedDate',new Date('2013-9-01'));
       * </code></pre>
       * @type {Date}
       * @default today
       */
      selectedDate : {
        value : today()
      },
      /**
       * \u5c0f\u65f6,\u9ed8\u8ba4\u4e3a\u5f53\u524d\u5c0f\u65f6
       * @type {Number}
       */
      hour : {
        value : new Date().getHours()
  
      },
      /**
       * \u5206,\u9ed8\u8ba4\u4e3a\u5f53\u524d\u5206
       * @type {Number}
       */
      minute:{
        value : new Date().getMinutes()
      },
      /**
       * \u79d2,\u9ed8\u8ba4\u4e3a\u5f53\u524d\u79d2
       * @type {Number}
       */
      second : {
        value : 0
      }
    }
  },{
    xclass : 'calendar',
    priority : 0
  });

  return calendar;
});/**
 * @fileOverview \u65e5\u671f\u9009\u62e9\u5668
 * @author dxq613@gmail.com
 * @ignore
 */
define('bui/calendar/datepicker',['bui/common','bui/picker','bui/calendar/calendar'],function(require){
  
  var BUI = require('bui/common'),
    Picker = require('bui/picker').Picker,
    Calendar = require('bui/calendar/calendar'),
    DateUtil = BUI.Date;

  /**
   * \u65e5\u671f\u9009\u62e9\u5668\uff0c\u53ef\u4ee5\u7531\u8f93\u5165\u6846\u7b49\u89e6\u53d1
   * <p>
   * <img src="../assets/img/class-calendar.jpg"/>
   * </p>
   * xclass : 'calendar-datepicker'
   * <pre><code>
   *   BUI.use('bui/calendar',function(Calendar){
   *      var datepicker = new Calendar.DatePicker({
   *        trigger:'.calendar',
   *        //delegateTigger : true, //\u5982\u679c\u8bbe\u7f6e\u6b64\u53c2\u6570\uff0c\u90a3\u4e48\u65b0\u589e\u52a0\u7684.calendar\u5143\u7d20\u4e5f\u4f1a\u652f\u6301\u65e5\u5386\u9009\u62e9
   *        autoRender : true
   *      });
   *    });
   * </code></pre>
   * @class BUI.Calendar.DatePicker
   * @extends BUI.Picker.Picker
   */
  var datepicker = Picker.extend({

    initializer:function(){
      var _self = this,
        children = _self.get('children'),
        calendar = new Calendar({
          showTime : _self.get('showTime')
        });

      children.push(calendar);
      _self.set('calendar',calendar);
    },
    /**
     * \u8bbe\u7f6e\u9009\u4e2d\u7684\u503c
     * <pre><code>
     *   datePicker.setSelectedValue('2012-01-1');
     * </code></pre>
     * @param {String} val \u8bbe\u7f6e\u503c
     * @protected
     */
    setSelectedValue : function(val){
      var _self = this,
        calendar = this.get('calendar'),
        date = DateUtil.parse(val);
      date = date || new Date(new Date().setSeconds(0));
      calendar.set('selectedDate',DateUtil.getDate(date));
      if(_self.get('showTime')){
        calendar.set('hour',date.getHours());
        calendar.set('minute',date.getMinutes());
        calendar.set('second',date.getSeconds());
      }
    },
    /**
     * \u83b7\u53d6\u9009\u4e2d\u7684\u503c
     * @protected
     * @return {String} \u9009\u4e2d\u7684\u503c
     */
    getSelectedValue : function(){
      var _self = this, 
        calendar = _self.get('calendar'),
      date =  DateUtil.getDate(calendar.get('selectedDate'));
      if(_self.get('showTime')){
        date = DateUtil.addHour(calendar.get('hour'),date);
        date = DateUtil.addMinute(calendar.get('minute'),date);
        date = DateUtil.addSecond(calendar.get('second'),date);
      }
      return date;
    },
    /**
     * \u83b7\u53d6\u9009\u4e2d\u9879\u7684\u6587\u672c\uff0c\u591a\u9009\u72b6\u6001\u4e0b\uff0c\u6587\u672c\u4ee5','\u5206\u5272
     * @protected
     * @return {String} \u9009\u4e2d\u7684\u6587\u672c
     */
    getSelectedText : function(){
      return DateUtil.format(this.getSelectedValue(),this._getFormatType());
    },
    _getFormatType : function(){
      if(this.get('showTime')){
        return 'yyyy-mm-dd HH:MM:ss';
      }
      return 'yyyy-mm-dd';
    },
    //\u8bbe\u7f6e\u6700\u5927\u503c
    _uiSetMaxDate : function(v){
      var _self = this;
      _self.get('calendar').set('maxDate',v);
    },
    //\u8bbe\u7f6e\u6700\u5c0f\u503c
    _uiSetMinDate : function(v){
      var _self = this;
      _self.get('calendar').set('minDate',v);
    }

  },{
    ATTRS : 
    /**
     * @lends BUI.Calendar.DatePicker#
     * @ignore
     */
    {
      /**
       * \u662f\u5426\u663e\u793a\u65e5\u671f
       * <pre><code>
       *  var datepicker = new Calendar.DatePicker({
       *    trigger:'.calendar',
       *    showTime : true, //\u53ef\u4ee5\u9009\u62e9\u65e5\u671f
       *    autoRender : true
       *  });
       * </code></pre>
       * @type {Boolean}
       */
      showTime : {
        value:false
      },
      /**
       * \u6700\u5927\u65e5\u671f
       * <pre><code>
       *   var datepicker = new Calendar.DatePicker({
       *     trigger:'.calendar',
       *     maxDate : '2014-01-01',
       *     minDate : '2013-7-25',
       *     autoRender : true
       *   });
       * </code></pre>
       * @type {Date}
       */
      maxDate : {

      },
      /**
       * \u6700\u5c0f\u65e5\u671f
       * <pre><code>
       *   var datepicker = new Calendar.DatePicker({
       *     trigger:'.calendar',
       *     maxDate : '2014-01-01',
       *     minDate : '2013-7-25',
       *     autoRender : true
       *   });
       * </code></pre>
       * @type {Date}
       */
      minDate : {

      },
      changeEvent:{
        value:'accept'
      },
      hideEvent:{
        value:'accept'
      },
      /**
       * \u65e5\u5386\u5bf9\u8c61,\u53ef\u4ee5\u8fdb\u884c\u66f4\u591a\u7684\u64cd\u4f5c\uff0c\u53c2\u770b{@link BUI.Calendar.Calendar}
       * @type {BUI.Calendar.Calendar}
       */
      calendar:{

      }
    }
  },{
    xclass : 'datepicker',
    priority : 0
  });
  return datepicker;
  
});/**
 * @fileOverview \u8868\u683c\u547d\u540d\u7a7a\u95f4\u5165\u53e3
 * @ignore
 */

define('bui/grid',['bui/common','bui/grid/simplegrid','bui/grid/grid','bui/grid/column','bui/grid/header','bui/grid/format','bui/grid/plugins'],function (require) {

  var BUI = require('bui/common'),
    Grid = BUI.namespace('Grid');

  BUI.mix(Grid,{
    SimpleGrid : require('bui/grid/simplegrid'),
    Grid : require('bui/grid/grid'),
    Column : require('bui/grid/column'),
    Header : require('bui/grid/header'),
    Format : require('bui/grid/format'),
    Plugins : require('bui/grid/plugins')
  });

  return Grid;

});/**
 * @fileOverview \u7b80\u5355\u8868\u683c,\u4ec5\u7528\u4e8e\u5c55\u793a\u6570\u636e
 * @author dxq613@gmail.com
 * @ignore
 */
define('bui/grid/simplegrid',['bui/common','bui/list'],function(require) {
  
  var BUI = require('bui/common'),
    List = require('bui/list'),
    Component = BUI.Component,
    UIBase = Component.UIBase,
    PREFIX = BUI.prefix,
    CLS_GRID = PREFIX + 'grid',
    CLS_GRID_ROW = CLS_GRID + '-row',
    CLS_ROW_ODD = PREFIX + 'grid-row-odd',
    CLS_ROW_EVEN = PREFIX + 'grid-row-even',
    CLS_GRID_BORDER = PREFIX + 'grid-border',
    CLS_ROW_FIRST = PREFIX + 'grid-row-first';


  /**
   * \u7b80\u5355\u8868\u683c\u7684\u89c6\u56fe\u7c7b
   * @class BUI.Grid.SimpleGridView
   * @extends BUI.List.SimpleListView
   * @private
   */
  var simpleGridView = List.SimpleListView.extend({
    /**
     * \u8bbe\u7f6e\u5217
     * @internal 
     * @param {Array} columns \u5217\u96c6\u5408
     */
    setColumns : function(columns){
      var _self = this,
        headerRowEl = _self.get('headerRowEl');

      columns = columns || _self.get('columns');
      //\u6e05\u7a7a\u8868\u5934
      headerRowEl.empty();

      BUI.each(columns,function(column){
        _self._createColumn(column,headerRowEl);
      });
    },
    //\u521b\u5efa\u5217
    _createColumn : function(column,parent){
      var _self = this,
        columnTpl = BUI.substitute(_self.get('columnTpl'),column);
      $(columnTpl).appendTo(parent);
    },
    /**
     * \u83b7\u53d6\u884c\u6a21\u677f
     * @ignore
     */
    getItemTpl : function  (record,index) {
      var _self = this,
          columns = _self.get('columns'),
          rowTpl = _self.get('rowTpl'),
          oddCls = index % 2 === 0 ? CLS_ROW_ODD : CLS_ROW_EVEN,
          cellsTpl = [],
          rowEl;

      BUI.each(columns, function (column) {
          var dataIndex = column['dataIndex'];
          cellsTpl.push(_self._getCellTpl(column, dataIndex, record));
      });

      rowTpl = BUI.substitute(rowTpl,{cellsTpl:cellsTpl.join(''), oddCls:oddCls});
      return rowTpl;
    },
    //get cell template by config and record
    _getCellTpl:function (column, dataIndex, record) {
        var _self = this,
            renderer = column.renderer,
            text = renderer ? renderer(record[dataIndex], record) : record[dataIndex],
            cellTpl = _self.get('cellTpl');
        return BUI.substitute(cellTpl,{elCls : column.elCls,text:text});    
    },
    /**
     * \u6e05\u9664\u6570\u636e
     * @ignore
     */
    clearData : function(){
      var _self = this,
        tbodyEl = _self.get('itemContainer');
       tbodyEl.empty();
    },
    showData : function(data){

      var _self = this;
      BUI.each(data,function(record,index){
        _self._createRow(record,index);
      });
    },
    //\u8bbe\u7f6e\u5355\u5143\u683c\u8fb9\u6846
    _uiSetInnerBorder : function(v){
        var _self = this,
            el = _self.get('el');
        if(v){
            el.addClass(CLS_GRID_BORDER);
        }else{
            el.removeClass(CLS_GRID_BORDER);
        }
    },
    _uiSetTableCls : function(v){
      var _self = this,
        tableEl = _self.get('el').find('table');
      tableEl.attr('class',v);
    }
  },{
    ATTRS : {
      /**
       * @private
       * @ignore
       */
      headerRowEl : {
        valueFn :function(){
          var _self = this,
            thead = _self.get('el').find('thead');
          return thead.children('tr');
        }
      },
      /**
       * @private 
       * @ignore
       * @type {Object}
       */
      itemContainer :{
        valueFn :function(){
          return this.get('el').find('tbody');
        }
      },
      tableCls : {

      }
    }
  },{
    xclass:'simple-grid-veiw'
  });

  /**
   * \u7b80\u5355\u8868\u683c
   * xclass:'simple-grid'
   * <pre><code>
   *  BUI.use('bui/grid',function(Grid){
   *     
   *    var columns = [{
   *             title : '\u8868\u59341(10%)',
   *             dataIndex :'a',
   *             width:'10%'
   *           },{
   *             id: '123',
   *             title : '\u8868\u59342(20%)',
   *             dataIndex :'b',
   *             width:'20%'
   *           },{
   *             title : '\u8868\u59343(70%)',
   *             dataIndex : 'c',
   *             width:'70%'
   *         }],
   *         data = [{a:'123'},{a:'cdd',b:'edd'},{a:'1333',c:'eee',d:2}];
   *
   *     var grid = new Grid.SimpleGrid({
   *       render:'#grid',
   *       columns : columns,
   *       items : data,
   *       idField : 'a'
   *     });
   *
   *     grid.render();
   *   });
   * </code></pre>
   * @class BUI.Grid.SimpleGrid
   * @extends BUI.List.SimpleList
   */
  var simpleGrid = BUI.List.SimpleList.extend(
  /**
   * @lends BUI.Grid.SimpleGrid.prototype
   * @ignore
   */
  {
    renderUI : function(){
      this.get('view').setColumns();
    },
    /**
     * \u7ed1\u5b9a\u4e8b\u4ef6
     * @protected
     */
    bindUI : function(){
      var _self = this,
        itemCls = _self.get('itemCls'),
        hoverCls = itemCls + '-hover',
        el = _self.get('el');

      el.delegate('.'+itemCls,'mouseover',function(ev){
        var sender = $(ev.currentTarget);
        sender.addClass(hoverCls);
      }).delegate('.'+itemCls,'mouseout',function(ev){
        var sender = $(ev.currentTarget);
        sender.removeClass(hoverCls);
      });
    },
    /**
     * \u663e\u793a\u6570\u636e
     * <pre><code>
     *   var data = [{},{}];
     *   grid.showData(data);
     *
     *   //\u7b49\u540c
     *   grid.set('items',data);
     * </code></pre>
     * @param  {Array} data \u8981\u663e\u793a\u7684\u6570\u636e
     */
    showData : function(data){
      this.clearData();
      //this.get('view').showData(data);
      this.set('items',data);
    },
    /**
     * \u6e05\u9664\u6570\u636e
     */
    clearData : function(){
      this.get('view').clearData();
    },
    _uiSetColumns : function(columns){
      var _self = this;

      //\u91cd\u7f6e\u5217\uff0c\u5148\u6e05\u7a7a\u6570\u636e
      _self.clearData();
      _self.get('view').setColumns(columns);
    }
  },{
    ATTRS : 
    /**
     * @lends BUI.Grid.SimpleGrid#
     * @ignore
     */
    {
      /**
       * \u8868\u683c\u53ef\u70b9\u51fb\u9879\u7684\u6837\u5f0f
       * @protected
       * @type {String}
       */
      itemCls : {
        view:true,
        value : CLS_GRID_ROW
      },
      /**
       * \u8868\u683c\u5e94\u7528\u7684\u6837\u5f0f\uff0c\u66f4\u6539\u6b64\u503c\uff0c\u5219\u4e0d\u5e94\u7528\u9ed8\u8ba4\u8868\u683c\u6837\u5f0f
       * <pre><code>
       * grid = new Grid.SimpleGrid({
       *   render:'#grid',
       *   columns : columns,
       *   innerBorder : false,
       *   tableCls:'table table-bordered table-striped', 
       *   store : store 
       * }); 
       * </code></pre>
       * @type {Object}
       */
      tableCls : {
        view : true,
        value : CLS_GRID + '-table'
      },
      /**
       * \u5217\u4fe1\u606f
       * @cfg {Array} columns
       */
      /**
       * \u5217\u4fe1\u606f\uff0c\u4ec5\u652f\u6301\u4ee5\u4e0b\u914d\u7f6e\u9879\uff1a
       * <ol>
       *   <li>title\uff1a\u6807\u9898</li>
       *   <li>elCls: \u5e94\u7528\u5230\u672c\u5217\u7684\u6837\u5f0f</li>
       *   <li>width\uff1a\u5bbd\u5ea6\uff0c\u6570\u5b57\u6216\u8005\u767e\u5206\u6bd4</li>
       *   <li>dataIndex: \u5b57\u6bb5\u540d</li>
       *   <li>renderer: \u6e32\u67d3\u51fd\u6570</li>
       * </ol>
       * \u5177\u4f53\u5b57\u6bb5\u7684\u89e3\u91ca\u6e05\u53c2\u770b \uff1a {@link BUI.Grid.Column}
       * @type {Array}
       */
      columns : {
        view : true,
        sync:false,
        value : []
      },
      /**
       * \u6a21\u677f
       * @protected
       */
      tpl:{
        view : true,
        value:'<table cellspacing="0" class="{tableCls}" cellpadding="0"><thead><tr></tr></thead><tbody></tbody></table>'
      },
      /**
       * \u5355\u5143\u683c\u5de6\u53f3\u4e4b\u95f4\u662f\u5426\u51fa\u73b0\u8fb9\u6846
       * <pre><code>
       * <pre><code>
       * grid = new Grid.SimpleGrid({
       *   render:'#grid',
       *   columns : columns,
       *   innerBorder : false,
       *   store : store 
       * }); 
       * </code></pre>
       * </code></pre>
       * @cfg {Boolean} [innerBorder=true]
       */
      /**
       * \u5355\u5143\u683c\u5de6\u53f3\u4e4b\u95f4\u662f\u5426\u51fa\u73b0\u8fb9\u6846
       * @type {Boolean}
       * @default true
       */
      innerBorder : {
          view:true,
          value : true
      },
      /**
       * \u884c\u6a21\u7248
       * @type {Object}
       */
      rowTpl:{
        view : true,
        value:'<tr class="' + CLS_GRID_ROW + ' {oddCls}">{cellsTpl}</tr>'
      },
      /**
       * \u5355\u5143\u683c\u7684\u6a21\u7248
       * @type {String}
       */
      cellTpl:{
        view:true,
        value:'<td class="' + CLS_GRID + '-cell {elCls}"><div class="' + CLS_GRID + '-cell-inner"><span class="' + CLS_GRID + '-cell-text">{text}</span></div></td>'
      },
      /**
       * \u5217\u7684\u914d\u7f6e\u6a21\u7248
       * @type {String}
       */
      columnTpl : {
        view:true,
        value : '<th class="' + CLS_GRID + '-hd {elCls}" width="{width}"><div class="' + CLS_GRID + '-hd-inner"><span class="' + CLS_GRID + '-hd-title">{title}</span></div></th>'
      },
      /**
       * @private
       */
      events :{ 

          value : {
            
          }
      },
      xview : {
        value : simpleGridView
      }
    }
  },{
    xclass:'simple-grid'
  });
  
  simpleGrid.View = simpleGridView;
  return  simpleGrid;
});/**
 * @fileOverview This class specifies the definition for a column of a grid.
 * @author dxq613@gmail.com
 * @ignore
 */

define('bui/grid/column',['bui/common'],function (require) {

    var	BUI = require('bui/common'),
        PREFIX = BUI.prefix,
		CLS_HD_TITLE = PREFIX + 'grid-hd-title',
        CLS_OPEN = PREFIX + 'grid-hd-open',
        SORT_PREFIX = 'sort-',
        SORT_ASC = 'ASC',
        SORT_DESC = 'DESC',
        CLS_TRIGGER = PREFIX + 'grid-hd-menu-trigger',
        CLS_HD_TRIGGER = 'grid-hd-menu-trigger';

    /**
    * \u8868\u683c\u5217\u7684\u89c6\u56fe\u7c7b
    * @class BUI.Grid.ColumnView
    * @extends BUI.Component.View
    * @private
    */
    var columnView = BUI.Component.View.extend({

		/**
		* @protected
        * @ignore
		*/
		setTplContent : function(attrs){
			var _self = this,
				sortTpl = _self.get('sortTpl'),
                triggerTpl = _self.get('triggerTpl'),
				el = _self.get('el'),
                titleEl;

			columnView.superclass.setTplContent.call(_self,attrs);
            titleEl = el.find('.' + CLS_HD_TITLE);
			$(sortTpl).insertAfter(titleEl);
            $(triggerTpl).insertAfter(titleEl);

		},
        //use template to fill the column
        _setContent:function () {
           this.setTplContent();
        },
        _uiSetShowMenu : function(v){
            var _self = this,
                triggerTpl = _self.get('triggerTpl'),
                el = _self.get('el'),
                titleEl = el.find('.' + CLS_HD_TITLE);
            if(v){
                $(triggerTpl).insertAfter(titleEl);
            }else{
                el.find('.' + CLS_TRIGGER).remove();
            }   
        },
        //set the title of column
        _uiSetTitle:function (title) {
            if (!this.get('rendered')) {
                return;
            }
            this._setContent();
        },
        //set the draggable of column
        _uiSetDraggable:function (v) {
            if (!this.get('rendered')) {
                return;
            }
            this._setContent();
        },
        //set the sortableof column
        _uiSetSortable:function (v) {

            if (!this.get('rendered')) {
                return;
            }
            this._setContent();
        },
        //set the template of column
        _uiSetTpl:function (v) {
            if (!this.get('rendered')) {
                return;
            }
            this._setContent();
        },
        //set the sort state of column
        _uiSetSortState:function (v) {
            var _self = this,
                el = _self.get('el'),
                method = v ? 'addClass' : 'removeClass',
                ascCls = SORT_PREFIX + 'asc',
                desCls = SORT_PREFIX + 'desc';
            el.removeClass(ascCls + ' ' + desCls);
            if (v === 'ASC') {
                el.addClass(ascCls);
            } else if (v === 'DESC') {
                el.addClass(desCls);
            }
        },
        //\u5c55\u5f00\u8868\u5934
        _uiSetOpen : function (v) {
            var _self = this,
                el = _self.get('el');
            if(v){
                el.addClass(CLS_OPEN);
            }else{
                el.removeClass(CLS_OPEN);
            }
        }
    }, {
        ATTRS:{
            
            /**
             * @private
             */
            sortTpl : {
                view: true,
                getter: function(){
                    var _self = this,
                        sortable = _self.get('sortable');
                    if(sortable){
                        return '<span class="' + PREFIX + 'grid-sort-icon">&nbsp;</span>';
                    }
                    return '';
                }
            },
            tpl:{
            }
        }
    });

    /**
     * \u8868\u683c\u7684\u5217\u5bf9\u8c61\uff0c\u5b58\u50a8\u5217\u4fe1\u606f\uff0c\u6b64\u5bf9\u8c61\u4e0d\u4f1a\u7531\u7528\u6237\u521b\u5efa\uff0c\u800c\u662f\u914d\u7f6e\u5728Grid\u4e2d
     * xclass:'grid-column'
     * <pre><code>
     * columns = [{
     *        title : '\u8868\u59341',
     *        dataIndex :'a',
     *        width:100
     *      },{
     *        title : '\u8868\u59342',
     *        dataIndex :'b',
     *        visible : false, //\u9690\u85cf
     *        width:200
     *      },{
     *        title : '\u8868\u59343',
     *        dataIndex : 'c',
     *        width:200
     *    }];
     * </code></pre>
     * @class BUI.Grid.Column
     * @extends BUI.Component.Controller
     */
    var column = BUI.Component.Controller.extend(
        /**
         * @lends BUI.Grid.Column.prototype
         * @ignore
         */
        {    //toggle sort state of this column ,if no sort state set 'ASC',else toggle 'ASC' and 'DESC'
            _toggleSortState:function () {
                var _self = this,
                    sortState = _self.get('sortState'),
                    v = sortState ? (sortState === SORT_ASC ? SORT_DESC : SORT_ASC) : SORT_ASC;
                _self.set('sortState', v);
            },
            /**
             * {BUI.Component.Controller#performActionInternal}
             * @ignore
             */
            performActionInternal:function (ev) {
                var _self = this,
                    sender = $(ev.target),
                    prefix = _self.get('prefixCls');
                if (sender.hasClass(prefix + CLS_HD_TRIGGER)) {

                } else {
                    if (_self.get('sortable')) {
                        _self._toggleSortState();
                    }
                }
                //_self.fire('click',{domTarget:ev.target});
            },
            _uiSetWidth : function(v){
                if(v){
                    this.set('originWidth',v);
                }
            }
        }, {
            ATTRS:
            /*** 
            * @lends BUI.Grid.Column.prototype 
            * @ignore
            */
            {
                /**
                 * The tag name of the rendered column
                 * @private
                 */
                elTagName:{
                    value:'th'
                },
                /**
                 * \u8868\u5934\u5c55\u5f00\u663e\u793a\u83dc\u5355\uff0c
                 * @type {Boolean}
                 * @protected
                 */
                open : {
                    view : true,
                    value : false
                },
                /**
                 * \u6b64\u5217\u5bf9\u5e94\u663e\u793a\u6570\u636e\u7684\u5b57\u6bb5\u540d\u79f0
                 * <pre><code>
                 * {
                 *     title : '\u8868\u59341',
                 *     dataIndex :'a', //\u5bf9\u5e94\u7684\u6570\u636e\u7684\u5b57\u6bb5\u540d\u79f0\uff0c\u5982 \uff1a {a:'123',b:'456'}
                 *     width:100
                 * }
                 * </code></pre>
                 * @cfg {String} dataIndex
                 */
                /**
                 * \u6b64\u5217\u5bf9\u5e94\u663e\u793a\u6570\u636e\u7684\u5b57\u6bb5\u540d\u79f0
                 * @type {String}
                 * @default {String} empty string
                 */
                dataIndex:{
                    view:true,
                    value:''
                },
                /**
                 * \u662f\u5426\u53ef\u62d6\u62fd\uff0c\u6682\u65f6\u672a\u652f\u6301
                 * @private
                 * @type {Boolean}
                 * @defalut true
                 */
                draggable:{
					sync:false,
                    view:true,
                    value:true
                },
                /**
                 * \u7f16\u8f91\u5668,\u7528\u4e8e\u53ef\u7f16\u8f91\u8868\u683c\u4e2d<br>
                 * ** \u5e38\u7528\u7f16\u8f91\u5668 **
                 *  - xtype \u6307\u7684\u662f\u8868\u5355\u5b57\u6bb5\u7684\u7c7b\u578b {@link BUI.Form.Field}
                 *  - \u5176\u4ed6\u7684\u914d\u7f6e\u9879\u5bf9\u5e94\u4e8e\u8868\u5355\u5b57\u6bb5\u7684\u914d\u7f6e\u9879
                 * <pre><code>
                 * columns = [
                 *   {title : '\u6587\u672c',dataIndex :'a',editor : {xtype : 'text'}}, 
                 *   {title : '\u6570\u5b57', dataIndex :'b',editor : {xtype : 'number',rules : {required : true}}},
                 *   {title : '\u65e5\u671f',dataIndex :'c', editor : {xtype : 'date'},renderer : Grid.Format.dateRenderer},
                 *   {title : '\u5355\u9009',dataIndex : 'd', editor : {xtype :'select',items : enumObj},renderer : Grid.Format.enumRenderer(enumObj)},
                 *   {title : '\u591a\u9009',dataIndex : 'e', editor : {xtype :'select',select:{multipleSelect : true},items : enumObj},
                 *       renderer : Grid.Format.multipleItemsRenderer(enumObj)
                 *   }
                 * ]
                 * </code></pre>
                 * @type {Object}
                 */
                editor:{

                },
                /**
                 * \u662f\u5426\u53ef\u4ee5\u83b7\u53d6\u7126\u70b9
                 * @protected
                 */
                focusable:{
                    value:false
                },
                /**
                 * \u56fa\u5b9a\u5217,\u4e3b\u8981\u7528\u4e8e\u5728\u9996\u884c\u663e\u793a\u4e00\u4e9b\u7279\u6b8a\u5185\u5bb9\uff0c\u5982\u5355\u9009\u6846\uff0c\u590d\u9009\u6846\uff0c\u5e8f\u53f7\u7b49\u3002\u63d2\u4ef6\u4e0d\u80fd\u5bf9\u6b64\u5217\u8fdb\u884c\u7279\u6b8a\u64cd\u4f5c\uff0c\u5982\uff1a\u79fb\u52a8\u4f4d\u7f6e\uff0c\u9690\u85cf\u7b49
                 * @cfg {Boolean} fixed
                 */
                fixed : {
                    value : false
                },
                /**
                 * \u63a7\u4ef6\u7684\u7f16\u53f7
                 * @cfg {String} id
                 */
                id:{

                },
                /**
                 * \u6e32\u67d3\u8868\u683c\u5355\u5143\u683c\u7684\u683c\u5f0f\u5316\u51fd\u6570
                 * "function(value,obj,index){return value;}"
                 * <pre><code>
                 * {title : '\u64cd\u4f5c',renderer : function(){
                 *     return '<span class="grid-command btn-edit">\u7f16\u8f91</span>'
                 *   }}
                 * </code></pre>
                 * @cfg {Function} renderer
                 */
                renderer:{

                },
                /**
                 * \u662f\u5426\u53ef\u4ee5\u8c03\u6574\u5bbd\u5ea6\uff0c\u5e94\u7528\u4e8e\u62d6\u62fd\u6216\u8005\u81ea\u9002\u5e94\u5bbd\u5ea6\u65f6
                 * @type {Boolean}
                 * @protected
                 * @default true
                 */
                resizable:{
                    value:true
                },
                /* \u662f\u5426\u53ef\u4ee5\u6309\u7167\u6b64\u5217\u6392\u5e8f\uff0c\u5982\u679c\u8bbe\u7f6etrue,\u90a3\u4e48\u70b9\u51fb\u5217\u5934\u65f6
                 * <pre><code>
                 *     {title : '\u6570\u5b57', dataIndex :'b',sortable : false},
                 * </code></pre>
                 * @cfg {Boolean} [sortable=true]
                 */
                sortable:{
					sync:false,
                    view:true,
                    value:true
                },
                /**
                 * \u6392\u5e8f\u72b6\u6001\uff0c\u5f53\u524d\u6392\u5e8f\u662f\u6309\u7167\u5347\u5e8f\u3001\u964d\u5e8f\u3002\u67093\u79cd\u503c null, 'ASC','DESC'
                 * @type {String}
                 * @protected
                 * @default null
                 */
                sortState:{
                    view:true,
                    value:null
                },
                /**
                 * \u5217\u6807\u9898
                 * @cfg {String} [title=&#160;]
                 */
                /**
                 * \u5217\u6807\u9898
                 * <pre><code>
                 * var column = grid.findColumn('id');
                 * column.get('title');
                 * </code></pre>
                 * Note: to have a clickable header with no text displayed you can use the default of &#160; aka &nbsp;.
                 * @type {String}
                 * @default {String} &#160;
                 */
                title:{
					sync:false,
                    view:true,
                    value:'&#160;'
                },
                /**
                 * \u5217\u7684\u5bbd\u5ea6,\u53ef\u4ee5\u4f7f\u6570\u5b57\u6216\u8005\u767e\u5206\u6bd4,\u4e0d\u8981\u4f7f\u7528 width : '100'\u6216\u8005width : '100px'
                 * <pre><code>
                 *  {title : '\u6587\u672c',width:100,dataIndex :'a',editor : {xtype : 'text'}}
                 *  
                 *  {title : '\u6587\u672c',width:'10%',dataIndex :'a',editor : {xtype : 'text'}}
                 * </code></pre>
                 * @type {Number|String}
                 * @cfg {Number} [width = 80]
                 */
                
                /**
                 * \u5217\u5bbd\u5ea6
                 * <pre><code>
                 *  grid.findColumn(id).set('width',200);
                 * </code></pre>
                 * 
                 * @type {Object}
                 */
                width:{
                    value:100
                },
                /**
                 * \u662f\u5426\u663e\u793a\u83dc\u5355
                 * @cfg {Boolean} [showMenu=false]
                 */
                /**
                 * \u662f\u5426\u663e\u793a\u83dc\u5355
                 * @type {Boolean}
                 * @default false
                 */
                showMenu:{
                    view:true,
                    value:false
                },
                /**
                 * @private
                 * @type {Object}
                 */
                triggerTpl:{
					view:true,
                    value:'<span class="' + CLS_TRIGGER + '"></span>'
                    
                },
                /**
                 * An template used to create the internal structure inside this Component's encapsulating Element.
                 * User can use the syntax of KISSY 's template component.
                 * Only in the configuration of the column can set this property.
                 * @type {String}
                 */
                tpl:{
					sync:false,
                    view:true,
                    value:'<div class="' + PREFIX + 'grid-hd-inner">' +
                        '<span class="' + CLS_HD_TITLE + '">{title}</span>' +
                        '</div>'
                },
                /**
                 * \u5355\u5143\u683c\u7684\u6a21\u677f\uff0c\u5728\u5217\u4e0a\u8bbe\u7f6e\u5355\u5143\u683c\u7684\u6a21\u677f\uff0c\u53ef\u4ee5\u5728\u6e32\u67d3\u5355\u5143\u683c\u65f6\u4f7f\u7528\uff0c\u66f4\u6539\u5355\u5143\u683c\u7684\u5185\u5bb9
                 * @cfg {String} cellTpl
                 */
                /**
                 * \u5355\u5143\u683c\u7684\u6a21\u677f\uff0c\u5728\u5217\u4e0a\u8bbe\u7f6e\u5355\u5143\u683c\u7684\u6a21\u677f\uff0c\u53ef\u4ee5\u5728\u6e32\u67d3\u5355\u5143\u683c\u65f6\u4f7f\u7528\uff0c\u66f4\u6539\u5355\u5143\u683c\u7684\u5185\u5bb9
                 * @type {String}
                 */
                cellTpl:{
                    value:''
                },
                /**
                 * the collection of column's events
                 * @protected
                 * @type {Array}
                 */
                events:{
                    value:{
                    /**
                     * @event
                     * Fires when this column's width changed
                     * @param {jQuery.Event} e the event object
                     * @param {BUI.Grid.Column} target
                     */
                        'afterWidthChange' : true,
                    /**
                     * @event
                     * Fires when this column's sort changed
                     * @param {jQuery.Event} e the event object
                     * @param {BUI.Grid.Column} e.target
                     */
                        'afterSortStateChange' : true,
                    /**
                     * @event
                     * Fires when this column's hide or show
                     * @param {jQuery.Event} e the event object
                     * @param {BUI.Grid.Column} e.target
                     */
                        'afterVisibleChange' : true,
                    /**
                     * @event
                     * Fires when use clicks the column
                     * @param {jQuery.Event} e the event object
                     * @param {BUI.Grid.Column} e.target
                     * @param {HTMLElement} domTarget the dom target of this event
                     */
                        'click' : true,
                    /**
                     * @event
                     * Fires after the component is resized.
                     * @param {BUI.Grid.Column} target
                     * @param {Number} adjWidth The box-adjusted width that was set
                     * @param {Number} adjHeight The box-adjusted height that was set
                     */
                        'resize' : true,
                    /**
                     * @event
                     * Fires after the component is moved.
                     * @param {jQuery.Event} e the event object
                     * @param {BUI.Grid.Column} e.target
                     * @param {Number} x The new x position
                     * @param {Number} y The new y position
                     */
                        'move' : true
                    }
                },
                /**
                 * @private
                 */
                xview:{
                    value:columnView
                }

            }
        }, {
            xclass:'grid-hd',
            priority:1
        });

    column.Empty = column.extend({

    }, {
        ATTRS:{
            type:{
                value:'empty'
            },
            sortable:{
                view:true,
                value:false
            },
            width:{
                view:true,
                value:null
            },
            tpl:{
                view:true,
                value:'<div class="' + PREFIX + 'grid-hd-inner"></div>'
            }
        }
    }, {
        xclass:'grid-hd-empty',
        priority:1
    });

    return column;

});
	
/**
 * @fileOverview \u8868\u683c\u7684\u5934\u90e8
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */

define('bui/grid/header',['bui/common','bui/grid/column'],function(require) {

  var BUI = require('bui/common'),
    PREFIX = BUI.prefix,
    Grid = BUI.namespace('Grid'),
    Column = require('bui/grid/column'),
    View = BUI.Component.View,
    Controller = BUI.Component.Controller,
    CLS_SCROLL_WITH = 17,
	  UA = BUI.UA;

  /**
  * \u8868\u683c\u63a7\u4ef6\u4e2d\u8868\u5934\u7684\u89c6\u56fe\u7c7b
  * @class BUI.Grid.HeaderView
  * @extends BUI.Component.View
  * @private
  */
  var headerView = View.extend({

    /**
     * @see {Component.Render#getContentElement}
     * @ignore
     */
    getContentElement:function () {
      return this.get('el').find('tr');
    },
    scrollTo:function (obj) {
      var _self = this,
          el = _self.get('el');
      if (obj.top !== undefined) {
          el.scrollTop(obj.top);
      }
      if (obj.left !== undefined) {
          el.scrollLeft(obj.left);
      }
    },
    _uiSetTableCls : function(v){
      var _self = this,
        tableEl = _self.get('el').find('table');
      tableEl.attr('class',v);
    }
  }, {
    ATTRS:{
      emptyCellEl:{},
      tableCls : {

      }
    }
  },{
    xclass : 'header-view'
  });
  /**
   * Container which holds headers and is docked at the top or bottom of a Grid.
   * The HeaderContainer drives resizing/moving/hiding of columns within the GridView.
   * As headers are hidden, moved or resized,
   * the header container is responsible for triggering changes within the view.
   * If you are not in the writing plugins, don't direct manipulation this control.
   * @class BUI.Grid.Header
   * @protected
   * xclass:'grid-header'
   * @extends BUI.Component.Controller
   */
  var header = Controller.extend(
    /**
     * @lends BUI.Grid.Header.prototype
     * @ignore
     */
    {
      /**
       * add a columns to header
       * @param {Object|BUI.Grid.Column} c The column object or column config.
       * @index {Number} index The position of the column in a header,0 based.
       */
      addColumn:function (c, index) {
        var _self = this,
          insertIndex = 0,
          columns = _self.get('columns');
        c = _self._createColumn(c);
        if (index === undefined) {
          index = columns.length;
          insertIndex = _self.get('children').length - 1;
        }
        columns.splice(index, 0, c);
        _self.addChild(c, insertIndex);
        _self.fire('add', {column:c, index:index});
        return c;
      },
      /**
       * remove a columns from header
       * @param {BUI.Grid.Column|Number} c is The column object or The position of the column in a header,0 based.
       */
      removeColumn:function (c) {
        var _self = this,
            columns = _self.get('columns'),
            index;
        c = BUI.isNumber(c) ? columns[c] : c;
        index = BUI.Array.indexOf(c, columns);
        columns.splice(index, 1);
        _self.fire('remove', {column:c, index:index});
        return _self.removeChild(c, true);
      },
      /**
       * For overridden.
       * @see Component.Controller#bindUI
       */
      bindUI:function () {
        var _self = this;
        _self._bindColumnsEvent();
      },
      /*
       * For overridden.
       * @protected
       *
       */
      initializer:function () {
        var _self = this,
            children = _self.get('children'),
            columns = _self.get('columns'),
            emptyColumn = _self._createEmptyColumn();
        $.each(columns, function (index,item) {
            var columnControl = _self._createColumn(item);
            children[index] = columnControl;
            columns[index] = columnControl;
        });
        children.push(emptyColumn);
        _self.set('emptyColumn',emptyColumn);
      },
      /**
       * get the columns of this header,the result equals the 'children' property .
       * @return {Array} columns
       * @example var columns = header.getColumns();
       *    <br>or</br>
       * var columns = header.get('children');
       */
      getColumns:function () {
        return this.get('columns');
      },
      /**
       * Obtain the sum of the width of all columns
       * @return {Number}
       */
      getColumnsWidth:function () {
        var _self = this,
          columns = _self.getColumns(),
          totalWidth = 0;

        $.each(columns, function (index,column) {
          if (column.get('visible')) {
            totalWidth += column.get('el').outerWidth();//column.get('width')
          }
        });
        return totalWidth;
      },
      getColumnOriginWidth : function(){
        var _self = this,
          columns = _self.getColumns(),
          totalWidth = 0;

        $.each(columns, function (index,column) {
          if (column.get('visible')) {
            var width = column.get('originWidth') || column.get('width');
            totalWidth += width;
          }
        });
        return totalWidth;
      },
      /**
       * get {@link BUI.Grid.Column} instance by index,when column moved ,the index changed.
       * @param {Number} index The index of columns
       * @return {BUI.Grid.Column} the column in the header,if the index outof the range,the result is null
       */
      getColumnByIndex:function (index) {
        var _self = this,
          columns = _self.getColumns(),
          result = columns[index];
        return result;
      },
      /**
       * \u67e5\u627e\u5217
       * @param  {Function} func \u5339\u914d\u51fd\u6570\uff0cfunction(column){}
       * @return {BUI.Grid.Column}  \u67e5\u627e\u5230\u7684\u5217
       */
      getColumn:function (func) {
        var _self = this,
          columns = _self.getColumns(),
          result = null;
        $.each(columns, function (index,column) {
          if (func(column)) {
              result = column;
              return false;
          }
        });
        return result;
      },
      /**
       * get {@link BUI.Grid.Column} instance by id,when column rendered ,this id can't to be changed
       * @param {String|Number}id The id of columns
       * @return {BUI.Grid.Column} the column in the header,if the index out of the range,the result is null
       */
      getColumnById:function (id) {
        var _self = this;
        return _self.getColumn(function(column){
          return column.get('id') === id;
        });
      },
      /**
       * get {@link BUI.Grid.Column} instance's index,when column moved ,the index changed.
       * @param {BUI.Grid.Column} column The instance of column
       * @return {Number} the index of column in the header,if the column not in the header,the index is -1
       */
      getColumnIndex:function (column) {
        var _self = this,
            columns = _self.getColumns();
        return BUI.Array.indexOf(column, columns);
      },
      /**
       * move the header followed by body's or document's scrolling
       * @param {Object} obj the scroll object which has two value:top(scrollTop),left(scrollLeft)
       */
      scrollTo:function (obj) {
        this.get('view').scrollTo(obj);
      },
      //when column's event fire ,this header must handle them.
      _bindColumnsEvent:function () {
        var _self = this;

        _self.on('afterWidthChange', function (e) {
          var sender = e.target;
          if (sender !== _self) {
              _self.setTableWidth();
          }
        });
        _self.on('afterVisibleChange', function (e) {
          var sender = e.target;
          if (sender !== _self) {
              _self.setTableWidth();
          }
        });
        _self.on('afterSortStateChange', function (e) {
          var sender = e.target,
            columns = _self.getColumns(),
            val = e.newVal;
          if (val) {
            $.each(columns, function (index,column) {
                if (column !== sender) {
                    column.set('sortState', '');
                }
            });
          }
        });

        _self.on('add',function(){
          _self.setTableWidth();
        });
        _self.on('remove',function(){
          _self.setTableWidth();
        });
      },
      //create the column control
      _createColumn:function (cfg) {
        if (cfg instanceof Column) {
          return cfg;
        }
        if (!cfg.id) {
          cfg.id = BUI.guid('col');
        }
        return new Column(cfg);
      },
      _createEmptyColumn:function () {
        return new Column.Empty();
      },
      //when set grid's height, scroll bar emerged.
      _isAllowScrollLeft:function () {
        var _self = this,
          parent = _self.get('parent');

        return parent && !!parent.get('height');
      },
      /**
       * force every column fit the table's width
       */
      forceFitColumns:function () {
          
        var _self = this,
          columns = _self.getColumns(),
          width = _self.get('width'),
          totalWidth = width,
          totalColumnsWidth = _self.getColumnOriginWidth(),
					realWidth = 0,
					appendWidth = 0,
					lastShowColumn = null,
          allowScroll = _self._isAllowScrollLeft();

				/**
				* @private
				*/
				function setColoumnWidthSilent(column,colWidth){
					var columnEl = column.get('el');
					column.set('width',colWidth , {
						silent:1
					});
					columnEl.width(colWidth);
				}
        //if there is not a width config of grid ,The forceFit action can't work
        if (width) {
          if (allowScroll) {
            width -= CLS_SCROLL_WITH;
            totalWidth = width;
          }

          var adjustCount = 0;

          $.each(columns, function (index,column) {
            if (column.get('visible') && column.get('resizable')) {
              adjustCount++;
            }
            if (column.get('visible') && !column.get('resizable')) {
              var colWidth = column.get('el').outerWidth();
              totalWidth -= colWidth;
              totalColumnsWidth -= colWidth;
            }
          });

          var colWidth = Math.floor(totalWidth / adjustCount),
              ratio = totalWidth / totalColumnsWidth;
          if(ratio ===1){
            return;
          }
          $.each(columns, function (index,column) {
            if (column.get('visible') && column.get('resizable')) {

              var borderWidth = _self._getColumnBorderWith(column,index),
                  originWidth = column.get('originWidth');
              if(!originWidth){
                  column.set('originWidth',column.get('width'));
                  originWidth = column.get('width');
              }
              colWidth = Math.floor((originWidth + borderWidth) * ratio);
                 /* parseInt(columnEl.css('border-left-width')) || 0 +
                      parseInt(columnEl.css('border-right-width')) || 0;*/
              // \uff01 note
              //
              // \u4f1a\u518d\u8c03\u7528 setTableWidth\uff0c \u5faa\u73af\u8c03\u7528 || 
              setColoumnWidthSilent(column,colWidth - borderWidth);
							realWidth += colWidth;
							lastShowColumn = column;
            }
          });

					if(lastShowColumn){
						appendWidth = totalWidth - realWidth;
						setColoumnWidthSilent(lastShowColumn,lastShowColumn.get('width') + appendWidth);
					}

          _self.fire('forceFitWidth');
        }

      },
      _getColumnBorderWith : function(column,index){
        //chrome \u4e0bborder-left-width\u53d6\u7684\u503c\u4e0d\u5c0f\u6570\uff0c\u6240\u4ee5\u6682\u65f6\u4f7f\u7528\u56fa\u5b9a\u8fb9\u6846
        //\u7b2c\u4e00\u4e2a\u8fb9\u6846\u65e0\u5bbd\u5ea6\uff0cie \u4e0b\u4ecd\u7136\u5b58\u5728Bug\uff0c\u6240\u4ee5\u505aie \u7684\u517c\u5bb9
        var columnEl = column.get('el'),
          borderWidth = Math.round(parseFloat(columnEl.css('border-left-width')) || 0)  + 
               Math.round(parseFloat(columnEl.css('border-right-width')) || 0);
        
        borderWidth = UA.ie && UA.ie < 8 ? (index === 0 ? 1 : borderWidth) : borderWidth;
        return borderWidth;                   
      },
      /**
       * set the header's inner table's width
       */
      setTableWidth:function () {
        var _self = this,
          width = _self.get('width'),
          totalWidth = 0,
          emptyColumn = null;
        if(width == 'auto'){
          //_self.get('el').find('table').width()
          return;
        }
        if (_self.get('forceFit')) {
          _self.forceFitColumns();
        }else if(_self._isAllowScrollLeft()){
          totalWidth = _self.getColumnsWidth();
          emptyColumn = _self.get('emptyColumn');
          if(width < totalWidth){
              emptyColumn.get('el').width(CLS_SCROLL_WITH);
          }else{
              emptyColumn.get('el').width('auto');
          }
        }
      },
      //when header's width changed, it also effects its columns.
      _uiSetWidth:function () {
        var _self = this;
        _self.setTableWidth();
      },
      _uiSetForceFit:function (v) {
        var _self = this;
        if (v) {
          _self.setTableWidth();
        }
      }

    }, {
      ATTRS:
      /** 
      * @lends BUI.Grid.Header.prototype
      * @ignore
      * */
      {
        /**
         * \u5217\u96c6\u5408
         * @type {Array}
         */
        columns:{
            value:[]
        },
        /**
         * @private
         */
        emptyColumn:{

        },
        /**
         * \u662f\u5426\u53ef\u4ee5\u83b7\u53d6\u7126\u70b9
         * @protected
         */
        focusable:{
            value:false
        },
        /**
         * true to force the columns to fit into the available width. Headers are first sized according to configuration, whether that be a specific width, or flex.
         * Then they are all proportionally changed in width so that the entire content width is used.
         * @type {Boolean}
         * @default 'false'
         */
        forceFit:{
            sync:false,
            view:true,
            value:false
        },
        /**
         * \u8868\u5934\u7684\u6a21\u7248
         * @type {String}
         */
        tpl : {

          view : true,
          value : '<table cellspacing="0" class="' + PREFIX + 'grid-table" cellpadding="0">' +
          '<thead><tr></tr></thead>' +
          '</table>'
        },
        /**
         * \u8868\u683c\u5e94\u7528\u7684\u6837\u5f0f.
         */
        tableCls:{
            view:true
        },
        /**
         * @private
         */
        xview:{
            value:headerView
        },
        /**
         * the collection of header's events
         * @type {Array}
         * @protected
         */
        events:{
          value:{
          /**
           * @event
           * \u6dfb\u52a0\u5217\u65f6\u89e6\u53d1
           * @param {jQuery.Event} e the event object
           * @param {BUI.Grid.Column} e.column which column added
           * @param {Number} index the add column's index in this header
           *
           */
              'add' : false,
          /**
           * @event
           * \u79fb\u9664\u5217\u65f6\u89e6\u53d1
           * @param {jQuery.Event} e the event object
           * @param {BUI.Grid.Column} e.column which column removed
           * @param {Number} index the removed column's index in this header
           */
              'remove' : false
          }
        } 
      }
    }, {
      xclass:'grid-header',
      priority:1
    });
  
  return header;
});/**
 * @fileOverview \u8868\u683c
 * @ignore
 * @author dxq613@gmail.com
 */

define('bui/grid/grid',['bui/common','bui/mask','bui/toolbar','bui/list','bui/grid/header','bui/grid/column'],function (require) {

  var BUI = require('bui/common'),
    Mask = require('bui/mask'),
    UA = BUI.UA,
    Component = BUI.Component,
    toolbar = require('bui/toolbar'),
    List = require('bui/list'),
    Header = require('bui/grid/header'),
    Column = require('bui/grid/column');

  function isPercent(str){
    if(BUI.isString(str)){
      return str.indexOf('%') !== -1;
    }
    return false;
  }

  var PREFIX = BUI.prefix,
    CLS_GRID_HEADER_CONTAINER = PREFIX + 'grid-header-container',
    CLS_GRID_BODY = PREFIX + 'grid-body',
    CLS_GRID_WITH = PREFIX + 'grid-width',
    CLS_GRID_HEIGHT = PREFIX + 'grid-height',
    CLS_GRID_BORDER = PREFIX + 'grid-border',
    CLS_GRID_TBAR = PREFIX + 'grid-tbar',
    CLS_GRID_BBAR = PREFIX + 'grid-bbar',
    CLS_BUTTON_BAR= PREFIX + 'grid-button-bar',
    CLS_GRID_STRIPE = PREFIX + 'grid-strip',
    CLS_GRID_ROW = PREFIX + 'grid-row',
    CLS_ROW_ODD = PREFIX + 'grid-row-odd',
    CLS_ROW_EVEN = PREFIX + 'grid-row-even',
    CLS_ROW_FIRST = PREFIX + 'grid-row-first',
    CLS_GRID_CELL = PREFIX + 'grid-cell',
    CLS_GRID_CELL_INNER = PREFIX + 'grid-cell-inner',
    CLS_TD_PREFIX = 'grid-td-',
    CLS_CELL_TEXT = PREFIX + 'grid-cell-text',
    CLS_CELL_EMPTY = PREFIX + 'grid-cell-empty',
    CLS_SCROLL_WITH = '17',
    CLS_HIDE = PREFIX + 'hidden',
    ATTR_COLUMN_FIELD = 'data-column-field',
    WIDTH_BORDER = 2,
    HEIGHT_BAR_PADDING = 1;  

  function getInnerWidth(width){
    var _self = this;
      if(BUI.isNumber(width)){
        width -= WIDTH_BORDER;
      }
      return width;
  }

  /**
   * @class BUI.Grid.GridView
   * @private
   * @extends BUI.List.SimpleListView
   * \u8868\u683c\u7684\u89c6\u56fe\u5c42
   */
  var gridView = List.SimpleListView.extend({

    //\u8bbe\u7f6e body\u548ctable\u7684\u6807\u7b7e
    renderUI : function(){
      var _self = this,
        el = _self.get('el'),
        bodyEl = el.find('.' + CLS_GRID_BODY);
      _self.set('bodyEl',bodyEl);
      _self._setTableTpl();
    },
    /**
     * \u83b7\u53d6\u884c\u6a21\u677f
     * @ignore
     */
    getItemTpl : function  (record,index) {
      var _self = this,
        columns =  _self._getColumns(),
        tbodyEl = _self.get('tbodyEl'),
        rowTpl = _self.get('rowTpl'),
        oddCls = index % 2 === 0 ? CLS_ROW_ODD : CLS_ROW_EVEN,
        cellsTpl = [],
        rowEl;

      $.each(columns, function (index,column) {
        var dataIndex = column.get('dataIndex');
        cellsTpl.push(_self._getCellTpl(column, dataIndex, record));
      });

      if(_self.get('useEmptyCell')){
        cellsTpl.push(_self._getEmptyCellTpl());
      }

      rowTpl = BUI.substitute(rowTpl,{cellsTpl:cellsTpl.join(''), oddCls:oddCls});
      return rowTpl;
    },
    /**
     * find the dom by the record in this component
     * @param {Object} record the record used to find row dom
     * @return jQuery
     */
    findRow:function (record) {
        var _self = this;
        return $(_self.findElement(record));
    },
    /**
     * find the cell dom by record and column id
     * @param {String} id the column id
     * @param {jQuery} rowEl the dom that showed in this component
     * @return  {jQuery}
     */
    findCell : function(id,rowEl){
      var cls = CLS_TD_PREFIX + id;
        return rowEl.find('.' + cls);
    },
    /**
     * \u91cd\u65b0\u521b\u5efa\u8868\u683c\u7684\u9996\u884c\uff0c\u4e00\u822c\u5728\u8868\u683c\u521d\u59cb\u5316\u5b8c\u6210\u540e\uff0c\u6216\u8005\u5217\u53d1\u751f\u6539\u53d8\u65f6
     */
    resetHeaderRow:function () {
      if(!this.get('useHeaderRow')){
        return;
      }
      var _self = this,
        headerRowEl = _self.get('headerRowEl'),
        tbodyEl = _self.get('tbodyEl');
      if(headerRowEl){
        headerRowEl.remove();
      }
      headerRowEl = _self._createHeaderRow();
      headerRowEl.prependTo(tbodyEl);
      _self.set('headerRowEl', headerRowEl);
    },
    /**
     * when header's column width changed, column in this component changed followed
     * @ignore
     */
    resetColumnsWidth:function (column,width) {
      var _self = this,
        headerRowEl = _self.get('headerRowEl'),
        cell = _self.findCell(column.get('id'), headerRowEl);
      width = width || column.get('width');
      if (cell) {
        cell.width(width);
      }
      _self.setTableWidth();
    },
    //set table width
    setTableWidth:function (columnsWidth) {
      if(!columnsWidth && isPercent(this.get('width'))){
        this.get('tableEl').width('100%');
        return;
      }
      var _self = this,
        width = _self._getInnerWidth(),
        height = _self.get('height'),
        tableEl = _self.get('tableEl'),
        forceFit = _self.get('forceFit'),
        headerRowEl = _self.get('headerRowEl');
      //\u4f7f\u7528\u767e\u5206\u6bd4\u7684\u5bbd\u5ea6\uff0c\u4e0d\u8fdb\u884c\u8ba1\u7b97
      if(!isPercent(columnsWidth)){
        
        columnsWidth = columnsWidth || _self._getColumnsWidth();
        if (!width) {
          return;
        }
        if (width >= columnsWidth) {
          columnsWidth = width;
          if (height) {
            var scrollWidth = (UA.ie == 6 || UA.ie == 7) ? CLS_SCROLL_WITH + 2 : CLS_SCROLL_WITH;
            columnsWidth = width - scrollWidth;
          }
        }
      }
      
      tableEl.width(columnsWidth);
    },
    /**
     * \u8868\u683c\u8868\u4f53\u7684\u5bbd\u5ea6
     * @param {Number} width \u5bbd\u5ea6
     */
    setBodyWidth : function(width){
      var _self = this,
        bodyEl = _self.get('bodyEl');
      width = width || _self._getInnerWidth();
      bodyEl.width(width);

    },
    /**
     * \u8bbe\u7f6e\u8868\u4f53\u9ad8\u5ea6
     * @param {Number} height \u9ad8\u5ea6
     */
    setBodyHeight : function(height){
      var _self = this,
        bodyEl = _self.get('bodyEl'),
        bodyHeight = height,
        siblings = bodyEl.siblings();

      BUI.each(siblings,function(item){
        if($(item).css('display') !== 'none'){
          bodyHeight -= $(item).outerHeight();
        }
      });
      bodyEl.height(bodyHeight);
    },
    //show or hide column
    setColumnVisible:function (column) {
      var _self = this,
        hide = !column.get('visible'),
        colId = column.get('id'),
        tbodyEl = _self.get('tbodyEl'),
        cells = $('.' + CLS_TD_PREFIX + colId,tbodyEl);
      if (hide) {
        cells.hide();
      } else {
        cells.show();
      }
    },
    /**
     * \u66f4\u65b0\u6570\u636e
     * @param  {Object} record \u66f4\u65b0\u7684\u6570\u636e
     */
    updateItem : function(record){
      var _self = this, 
        items = _self.getItems(),
        index = BUI.Array.indexOf(record,items),
        columns = _self._getColumns(),
        element = null,
        tpl;
      if(index >=0 ){
        element = _self.findElement(record);

        BUI.each(columns,function(column){
          var cellEl = _self.findCell(column.get('id'),$(element)),
            innerEl = cellEl.find('.' + CLS_GRID_CELL_INNER),
            textTpl = _self._getCellText(column,record);
          innerEl.html(textTpl);
        });
        return element;
      }
    },
    /**
     * \u663e\u793a\u6ca1\u6709\u6570\u636e\u65f6\u7684\u63d0\u793a\u4fe1\u606f
     */
    showEmptyText : function(){
      var _self = this,
        bodyEl = _self.get('bodyEl'),
        emptyDataTpl = _self.get('emptyDataTpl'),
        emptyEl = _self.get(emptyEl);
      if(emptyEl){
        emptyEl.remove();
      }
      var emptyEl = $(emptyDataTpl).appendTo(bodyEl);
      _self.set('emptyEl',emptyEl);
    },
    /**
     * \u6e05\u9664\u6ca1\u6709\u6570\u636e\u65f6\u7684\u63d0\u793a\u4fe1\u606f
     */
    clearEmptyText : function(){
       var _self = this,
        emptyEl = _self.get(emptyEl);
      if(emptyEl){
        emptyEl.remove();
      }
    },
    //\u8bbe\u7f6e\u7b2c\u4e00\u884c\u7a7a\u767d\u884c\uff0c\u4e0d\u663e\u793a\u4efb\u4f55\u6570\u636e\uff0c\u4ec5\u7528\u4e8e\u8bbe\u7f6e\u5217\u7684\u5bbd\u5ea6
    _createHeaderRow:function () {
      var _self = this,
          columns = _self._getColumns(),
          tbodyEl = _self.get('tbodyEl'),
          rowTpl = _self.get('headerRowTpl'),
          rowEl,
          cellsTpl = [];

      $.each(columns, function (index,column) {
        cellsTpl.push(_self._getHeaderCellTpl(column));
      });

      //if this component set width,add a empty column to fit row width
      if(_self.get('useEmptyCell')){
        cellsTpl.push(_self._getEmptyCellTpl());
      }
      rowTpl = BUI.substitute(rowTpl,{cellsTpl:cellsTpl.join('')});
      rowEl = $(rowTpl).appendTo(tbodyEl);
      return rowEl;
    },
    //get the sum of the columns' width
    _getColumnsWidth:function () {
      var _self = this,
        columns = _self.get('columns'),
        totalWidth = 0;

      BUI.each(columns, function (column) {
          if (column.get('visible')) {
              totalWidth += column.get('el').outerWidth();
          }
      });
      return totalWidth;
    },
    //\u83b7\u53d6\u5217\u96c6\u5408
    _getColumns : function(){
      return this.get('columns');
    },
    //get cell text by record and column
    _getCellText:function (column, record) {
        var _self = this,
          dataIndex = column.get('dataIndex'),
          textTpl = column.get('cellTpl') || _self.get('cellTextTpl'),
          text = _self._getCellInnerText(column,dataIndex, record);
        return BUI.substitute(textTpl,{text:text, tips:_self._getTips(column, dataIndex, record)});
    },
    _getCellInnerText : function(column,dataIndex, record){
      //renderer \u65f6\u53d1\u751f\u9519\u8bef\u53ef\u80fd\u6027\u5f88\u9ad8
      try{
        var _self = this,
          renderer = column.get('renderer'),
          text = renderer ? renderer(record[dataIndex], record) : record[dataIndex];
        return text == null ? '' : text;
      }catch(ex){
        throw 'column:' + column.get('title') +' fomat error!';
      }
    },
    //get cell template by config and record
    _getCellTpl:function (column, dataIndex, record) {
      var _self = this,
        cellText = _self._getCellText(column, record),
        cellTpl = _self.get('cellTpl');
      return BUI.substitute(cellTpl,{
        elCls : column.get('elCls'),
        id:column.get('id'),
        dataIndex:dataIndex,
        cellText:cellText,
        hideCls:!column.get('visible') ? CLS_HIDE : ''
      });
    },
    //\u83b7\u53d6\u7a7a\u767d\u5355\u5143\u683c\u7684\u6a21\u677f
    _getEmptyCellTpl:function () {
      return '<td class="' + CLS_GRID_CELL + ' ' + CLS_CELL_EMPTY + '">&nbsp;</td>';
    },
    //\u83b7\u53d6\u7a7a\u767d\u884c\u5355\u5143\u683c\u6a21\u677f
    _getHeaderCellTpl:function (column) {
      var _self = this,
        headerCellTpl = _self.get('headerCellTpl');
      return BUI.substitute(headerCellTpl,{
        id:column.get('id'),
        width:column.get('width'),
        hideCls:!column.get('visible') ? CLS_HIDE : ''
      });
    },
    //\u83b7\u53d6\u8868\u683c\u5185\u5bbd\u5ea6
    _getInnerWidth : function(){
      return getInnerWidth(this.get('width'));
    },
    //get cell tips
    _getTips:function (column, dataIndex, record) {
      var showTip = column.get('showTip'),
          value = '';
      if (showTip) {
        value = record[dataIndex];
        if (BUI.isFunction(showTip)) {
          value = showTip(value, record);
        }
      }
      return value;
    },
    //\u8bbe\u7f6e\u5355\u5143\u683c\u8fb9\u6846
    _uiSetInnerBorder : function(v){
      var _self = this,
        el = _self.get('el');
      if(v){
        el.addClass(CLS_GRID_BORDER);
      }else{
        el.removeClass(CLS_GRID_BORDER);
      }
    },
    //\u8bbe\u7f6e\u8868\u683c\u6a21\u677f
    _setTableTpl : function(tpl){
      var _self = this,
        bodyEl = _self.get('bodyEl');

      tpl = tpl || _self.get('tableTpl');
      $(tpl).appendTo(bodyEl);
      var tableEl = bodyEl.find('table'),
        tbodyEl = bodyEl.find('tbody');
        //headerRowEl = _self._createHeaderRow();
            
      _self.set('tableEl',tableEl);
      _self.set('tbodyEl',tbodyEl);
      //_self.set('headerRowEl', headerRowEl);
      _self.set('itemContainer',tbodyEl);
      _self._setTableCls(_self.get('tableCls'));
    },
    //\u8bbe\u7f6etable\u4e0a\u7684\u6837\u5f0f
    _uiSetTableCls : function(v){
      this._setTableCls(v);
    },
    //when set grid's height,the scroll can effect the width of its body and header
    _uiSetHeight:function (h) {
      var _self = this,
        bodyEl = _self.get('bodyEl');
      _self.get('el').height(h);
      _self.get('el').addClass(CLS_GRID_HEIGHT);

    },
    _uiSetWidth:function (w) {
      var _self = this;
      _self.get('el').width(w);
      _self.setBodyWidth(_self._getInnerWidth(w));
      _self.get('el').addClass(CLS_GRID_WITH);
      
    },
    _uiSetStripeRows : function(v){
      var _self = this,
        method = v ? 'addClass' : 'removeClass';
      _self.get('el')[method](CLS_GRID_STRIPE);
    },
    _setTableCls : function(cls){
      var _self = this,
        tableEl = _self.get('tableEl');
      tableEl.attr('class',cls);
    }
  },{
    ATTRS : {
      tableCls : {},
      bodyEl : {},
      tbodyEl : {},
      headerRowEl:{},
      tableEl : {},
      emptyEl : {}
    }
  },{
    xclass : 'grid-view'
  });

  /**
   * @class BUI.Grid.Grid
   *
   * \u8868\u683c\u63a7\u4ef6,\u8868\u683c\u63a7\u4ef6\u7c7b\u56fe\uff0c\u4e00\u822c\u60c5\u51b5\u4e0b\u914d\u5408{@link BUI.Data.Store} \u4e00\u8d77\u4f7f\u7528
   * <p>
   * <img src="../assets/img/class-grid.jpg"/>
   * </p>
   * <p>\u8868\u683c\u63d2\u4ef6\u7684\u7c7b\u56fe\uff1a</p>
   * <p>
   * <img src="../assets/img/class-grid-plugins.jpg"/>
   * </p>
   *
   * <pre><code>
   *  BUI.use(['bui/grid','bui/data'],function(Grid,Data){
   *    var Grid = Grid,
   *      Store = Data.Store,
   *      columns = [{  //\u58f0\u660e\u5217\u6a21\u578b
   *          title : '\u8868\u59341(20%)',
   *          dataIndex :'a',
   *          width:'20%'
   *        },{
   *          id: '123',
   *          title : '\u8868\u59342(30%)',
   *          dataIndex :'b',
   *          width:'30%'
   *        },{
   *          title : '\u8868\u59343(50%)',
   *          dataIndex : 'c',
   *          width:'50%'
   *      }],
   *      data = [{a:'123'},{a:'cdd',b:'edd'},{a:'1333',c:'eee',d:2}]; //\u663e\u793a\u7684\u6570\u636e
   *
   *    var store = new Store({
   *        data : data,
   *        autoLoad:true
   *      }),
   *       grid = new Grid.Grid({
   *         render:'#grid',
   *         width:'100%',//\u8fd9\u4e2a\u5c5e\u6027\u4e00\u5b9a\u8981\u8bbe\u7f6e
   *         columns : columns,
   *         idField : 'a',
   *         store : store
   *       });
   *
   *     grid.render();
   *   });
   * </code></pre>
   * @extends BUI.List.SimpleList
   */
  var grid = List.SimpleList.extend({
    
    /**
     * \u521d\u59cb\u5316\uff0c\u5982\u679c\u672a\u8bbe\u7f6e\u5bbd\u5ea6\uff0c\u5219\u4f7f\u7528\u8868\u683c\u5bb9\u5668\u7684\u5bbd\u5ea6
     * @protected
     * @ignore
     */
    initializer : function(){
        var _self = this,
            render = _self.get('render'),
            width = _self.get('width');
        if(!width){
            _self.set('width',$(render).width() - WIDTH_BORDER);
        }
    },
    /**
     * @protected
     * @ignore
     */
    createDom:function () {
      var _self = this;

      // \u63d0\u524d,\u4e2d\u9014\u8bbe\u7f6e\u5bbd\u5ea6\u65f6\u4f1a\u5931\u8d25\uff01\uff01
      if (_self.get('width')) {
          _self.get('el').addClass(CLS_GRID_WITH);
      }

      if (_self.get('height')) {
        _self.get('el').addClass(CLS_GRID_HEIGHT);
      }

      //\u56e0\u4e3a\u5185\u90e8\u7684\u8fb9\u8ddd\u5f71\u54cdheader\u7684forceFit\u8ba1\u7b97\uff0c\u6240\u4ee5\u5fc5\u987b\u5728header\u8ba1\u7b97forceFit\u524d\u7f6e\u6b64\u9879
      if(_self.get('innerBorder')){
          _self.get('el').addClass(CLS_GRID_BORDER);
      } 
    },
    /**
     * @protected
     * @ignore
     */
    renderUI : function(){
      var _self = this;
      _self._initHeader();
      _self._initBars();
      _self._initLoadMask();
      _self.get('view').resetHeaderRow();
    },
    /**
     * @private
     */
    bindUI:function () {
      var _self = this;
      _self._bindHeaderEvent();
      _self._bindBodyEvent();
      _self._bindItemsEvent();
    },
    /**
     * \u6dfb\u52a0\u5217
     * <pre><code>
     *   //\u6dfb\u52a0\u5230\u6700\u540e
     *   grid.addColumn({title : 'new column',dataIndex : 'new',width:100});
     *   //\u6dfb\u52a0\u5230\u6700\u524d
     *   grid.addColumn({title : 'new column',dataIndex : 'new',width:100},0);
     * </code></pre>
     * @param {Object|BUI.Grid.Column} column \u5217\u7684\u914d\u7f6e\uff0c\u5217\u7c7b\u7684\u5b9a\u4e49 {@link BUI.Grid.Column}
     * @param {Number} index \u6dfb\u52a0\u5230\u7684\u4f4d\u7f6e
     * @return {BUI.Grid.Column}
     */
    addColumn : function(column, index){
      var _self = this,
        header = _self.get('header');

      if(header){
        column = header.addColumn(column, index);
      }else{
        column = new Column(column);
        _self.get('columns').splice(index,0,column);
      }  
      return column;
    },
    /**
     * \u6e05\u9664\u663e\u793a\u7684\u6570\u636e
     * <pre><code>
     *   grid.clearData();
     * </code></pre>       
     */
    clearData : function(){
      this.clearItems();
    },
    /**
     * \u5f53\u524d\u663e\u793a\u5728\u8868\u683c\u4e2d\u7684\u6570\u636e
     * @return {Array} \u7eaa\u5f55\u96c6\u5408
     * @private
     */
    getRecords : function(){
      return this.getItems();
    },
    /**
     * \u4f7f\u7528\u7d22\u5f15\u6216\u8005id\u67e5\u627e\u5217
     * <pre><code>
     *  //\u8bbe\u7f6e\u5217\u7684id,\u5426\u5219\u4f1a\u81ea\u52a8\u751f\u6210
     *  {id : '1',title : '\u8868\u5934',dataIndex : 'a'}
     *  //\u83b7\u53d6\u5217
     *  var column = grid.findColumn('id');
     *  //\u64cd\u4f5c\u5217
     *  column.set('visible',false);
     * </code></pre>
     * @param {String|Number} id|index  \u6587\u672c\u503c\u4ee3\u8868\u7f16\u53f7\uff0c\u6570\u5b57\u4ee3\u8868\u7d22\u5f15
     */
    findColumn : function(id){
      var _self = this,
        header = _self.get('header');
      if(BUI.isNumber(id)){
        return header.getColumnByIndex(id);
      }else{
        return header.getColumnById(id);
      }
    },
    /**
     * \u4f7f\u7528\u5b57\u6bb5\u540d\u67e5\u627e\u5217
     * <pre><code>
     * //\u8bbe\u7f6e\u5217dataIndex
     *  {id : '1',title : '\u8868\u5934',dataIndex : 'a'}
     *  //\u83b7\u53d6\u5217
     *  var column = grid.findColumnByField('a');
     *  //\u64cd\u4f5c\u5217
     *  column.set('visible',false);
     * </code></pre>
     * @param {String} field \u5217\u7684\u5b57\u6bb5\u540d dataIndex
     */
    findColumnByField : function(field){
      var _self = this,
        header = _self.get('header');
      return header.getColumn(function(column){
        return column.get('dataIndex') === field;
      });
    },
    /**
     * \u6839\u636e\u5217\u7684Id\u67e5\u627e\u5bf9\u5e94\u7684\u5355\u5143\u683c
     * @param {String|Number} id \u5217id
     * @param {Object|jQuery} record \u672c\u884c\u5bf9\u5e94\u7684\u8bb0\u5f55\uff0c\u6216\u8005\u662f\u672c\u884c\u7684\uff24\uff2f\uff2d\u5bf9\u8c61
     * @protected
     * @return  {jQuery}
     */
    findCell:function (id, record) {
        var _self = this,
            rowEl = null;
        if (record instanceof $) {
            rowEl = record;
        } else {
            rowEl = _self.findRow(record);
        }
        if (rowEl) {
            return _self.get('view').findCell(id, rowEl);
        }
        return null;
    },
    /**
     * find the dom by the record in this component
     * @param {Object} record the record used to find row dom
     * @protected
     * @return jQuery
     */
    findRow:function (record) {
        var _self = this;
        return _self.get('view').findRow(record);
    },
    /**
     * \u79fb\u9664\u5217
     * <pre><code>
     *   var column = grid.findColumn('id');
     *   grid.removeColumn(column);
     * </code></pre>
     * @param {BUI.Grid.Column} column \u8981\u79fb\u9664\u7684\u5217
     */
    removeColumn:function (column) {
      var _self = this;
        _self.get('header').removeColumn(column);
    },
    /**
     * \u663e\u793a\u6570\u636e,\u5f53\u4e0d\u4f7f\u7528store\u65f6\uff0c\u53ef\u4ee5\u5355\u72ec\u663e\u793a\u6570\u636e
     * <pre><code>
     *   var data = [{},{}];
     *   grid.showData(data);
     * </code></pre>
     * @param  {Array} data \u663e\u793a\u7684\u6570\u636e\u96c6\u5408
     */
    showData : function(data){
      var _self = this;
      _self.set('items',data);
    },
    /**
     * \u91cd\u7f6e\u5217\uff0c\u5f53\u5217\u53d1\u751f\u6539\u53d8\u65f6\u540c\u6b65DOM\u548c\u6570\u636e
     * @protected
     */
    resetColumns:function () {
      var _self = this,
          store = _self.get('store');
      //recreate the header row
      _self.get('view').resetHeaderRow();
      //show data
      if (store) {
          _self.onLoad();
      }
    },
    //when body scrolled,the other component of grid also scrolled
    _bindScrollEvent:function () {
      var _self = this,
        el = _self.get('el'),
        bodyEl = el.find('.' + CLS_GRID_BODY),
        header = _self.get('header');

      bodyEl.on('scroll', function () {
        var left = bodyEl.scrollLeft(),
            top = bodyEl.scrollTop();
        header.scrollTo({left:left, top:top});
        _self.fire('scroll', {scrollLeft:left, scrollTop:top,bodyWidth : bodyEl.width(),bodyHeight : bodyEl.height()});
      });
    },
    //bind header event,when column changed,followed this component
    _bindHeaderEvent:function () {
        var _self = this,
          header = _self.get('header'),
          view = _self.get('view'),
          store = _self.get('store');
        header.on('afterWidthChange', function (e) {
          var sender = e.target;
          if (sender !== header) {
              view.resetColumnsWidth(sender);
          }
        });

        header.on('afterSortStateChange', function (e) {
          var column = e.target,
              val = e.newVal;
          if (val && store) {
            store.sort(column.get('dataIndex'), column.get('sortState'));
          }
        });

        header.on('afterVisibleChange', function (e) {
          var sender = e.target;
          if (sender !== header) {
            view.setColumnVisible(sender);
            _self.fire('columnvisiblechange',{column:sender});
          }
        });

        header.on('click', function (e) {
          var sender = e.target;
          if (sender !== header) {
            _self.fire('columnclick',{column:sender,domTarget:e.domTarget});
          }
        });

        header.on('forceFitWidth', function () {
          if (_self.get('rendered')) {
              _self.resetColumns();
          }
        });

        header.on('add', function (e) {
          if (_self.get('rendered')) {
            _self.fire('columnadd',{column:e.column,index:e.index});
              _self.resetColumns();
          }
        });

        header.on('remove', function (e) {
          if (_self.get('rendered')) {
            _self.resetColumns();
            _self.fire('columnremoved',{column:e.column,index:e.index});
          }
        });

    },
    //when body scrolled, header can followed
    _bindBodyEvent:function () {
      var _self = this;
      _self._bindScrollEvent();       
    },
    //\u7ed1\u5b9a\u8bb0\u5f55DOM\u76f8\u5173\u7684\u4e8b\u4ef6
    _bindItemsEvent : function(){
      var _self = this,
        store = _self.get('store');

      _self.on('itemsshow',function(){
        _self.fire('aftershow');

        if(_self.get('emptyDataTpl')){
          if(store && store.getCount() == 0){
            _self.get('view').showEmptyText();
          }else{
            _self.get('view').clearEmptyText();
          }
        }
      });

      _self.on('itemsclear',function(){
        _self.fire('clear');
      });

      _self.on('itemclick',function(ev){
        var target = ev.domTarget,
          record = ev.item,
          cell = $(target).closest('.' + CLS_GRID_CELL),
          rowEl = $(target).closest('.' + CLS_GRID_ROW),
          rst; //\u7528\u4e8e\u662f\u5426\u963b\u6b62\u4e8b\u4ef6\u89e6\u53d1

        if(cell.length){
          rst = _self.fire('cellclick', {record:record, row:rowEl[0], cell:cell[0], field:cell.attr(ATTR_COLUMN_FIELD), domTarget:target,domEvent:ev.domEvent});
        }

        if(rst === false){
          return rst;
        }

        return _self.fire('rowclick', {record:record, row:rowEl[0], domTarget:target});
          
      });

      _self.on('itemunselected',function(ev){
        _self.fire('rowunselected',getEventObj(ev));
      });

      _self.on('itemselected',function(ev){
        _self.fire('rowselected',getEventObj(ev));
      });

      _self.on('itemrendered',function(ev){
        _self.fire('rowcreated',getEventObj(ev));
      });
      
      _self.on('itemremoved',function(ev){
        _self.fire('rowremoved',getEventObj(ev));
      });

      _self.on('itemupdated',function(ev){
        _self.fire('rowupdated',getEventObj(ev));
      });

      function getEventObj(ev){
        return {record : ev.item, row : ev.domTarget, domTarget : ev.domTarget};
      }
    },
    //\u83b7\u53d6\u8868\u683c\u5185\u90e8\u7684\u5bbd\u5ea6\uff0c\u53d7\u8fb9\u6846\u7684\u5f71\u54cd\uff0c
    //\u5185\u90e8\u7684\u5bbd\u5ea6\u4e0d\u80fd\u7b49\u4e8e\u8868\u683c\u5bbd\u5ea6
    _getInnerWidth : function(width){
      width = width || this.get('width');
      return getInnerWidth(width);
    },
    //init header,if there is not a header property in config,instance it
    _initHeader:function () {
      var _self = this,
        header = _self.get('header'),
        container = _self.get('el').find('.'+ CLS_GRID_HEADER_CONTAINER);
      if (!header) {
        header = new Header({
          columns:_self.get('columns'),
          tableCls:_self.get('tableCls'),
          forceFit:_self.get('forceFit'),
          width:_self._getInnerWidth(),
          render: container,
          parent : _self
        }).render();
        //_self.addChild(header);
        _self.set('header', header);
      }
    },
    //\u521d\u59cb\u5316 \u4e0a\u4e0b\u5de5\u5177\u680f
    _initBars:function () {
      var _self = this,
          bbar = _self.get('bbar'),
          tbar = _self.get('tbar');
      _self._initBar(bbar, CLS_GRID_BBAR, 'bbar');
      _self._initBar(tbar, CLS_GRID_TBAR, 'tbar');
    },
    //set bar's elCls to identify top bar or bottom bar
    _initBar:function (bar, cls, name) {
      var _self = this,
        store = null,
        pagingBarCfg = null;
      if (bar) {
        //\u672a\u6307\u5b9axclass,\u540c\u65f6\u4e0d\u662fController\u65f6
        if(!bar.xclass && !(bar instanceof Component.Controller)){
          bar.xclass = 'bar';
          bar.children = bar.children || [];

          if(bar.items){
            bar.children.push({
                xclass : 'bar',
                defaultChildClass : "bar-item-button",
                elCls : CLS_BUTTON_BAR,
                children : bar.items
            });
            bar.items=null;
          }

          // modify by fuzheng
          if(bar.pagingBar){
            store = _self.get('store');
            pagingBarCfg = {
              xclass : 'pagingbar',
              store : store,
              pageSize : store.pageSize
            };
            if(bar.pagingBar !== true){
              pagingBarCfg = S.merge(pagingBarCfg, bar.pagingBar);
            }
            bar.children.push(pagingBarCfg);
          }
        }
        if (bar.xclass) {
          var barContainer = _self.get('el').find('.' + cls);
          barContainer.show();
          bar.render = barContainer;
          //bar.parent=_self;
          bar.elTagName = 'div';
          bar.autoRender = true;
          bar = _self.addChild(bar); //Component.create(bar).create();
        }
        _self.set(name, bar);
      }
      return bar;
    },
    //when set 'loadMask = true' ,create a loadMask instance
    _initLoadMask:function () {
      var _self = this,
        loadMask = _self.get('loadMask');
      if (loadMask && !loadMask.show) {
        loadMask = new BUI.Mask.LoadMask({el:_self.get('el')});
        _self.set('loadMask', loadMask);
      }
    },
    //\u8c03\u6574\u5bbd\u5ea6\u65f6\uff0c\u8c03\u6574\u5185\u90e8\u63a7\u4ef6\u5bbd\u5ea6
    _uiSetWidth:function (w) {
      var _self = this;
      if (_self.get('rendered')) {
        if(!isPercent(w)){
          _self.get('header').set('width', _self._getInnerWidth(w));
        }else{
          _self.get('header').set('width','100%');
        }
        
      }
      _self.get('view').setTableWidth();
    },
    //\u8bbe\u7f6e\u81ea\u9002\u5e94\u5bbd\u5ea6
    _uiSetForceFit:function (v) {
      var _self = this;
      _self.get('header').set('forceFit', v);
    },
    //when set grid's height,the scroll can effect the width of its body and header
    _uiSetHeight:function (h,obj) {
      var _self = this,
        header = _self.get('header');
      _self.get('view').setBodyHeight(h);
      if (_self.get('rendered')) {
        if (_self.get('forceFit') && !obj.prevVal) {
          header.forceFitColumns();
          //\u5f3a\u8feb\u5bf9\u9f50\u65f6\uff0c\u7531\u672a\u8bbe\u7f6e\u9ad8\u5ea6\u6539\u6210\u8bbe\u7f6e\u9ad8\u5ea6\uff0c\u589e\u52a0\u4e8617\u50cf\u7d20\u7684\u6eda\u52a8\u6761\u5bbd\u5ea6\uff0c\u6240\u4ee5\u91cd\u7f6e\u8868\u683c\u5bbd\u5ea6
          _self.get('view').setTableWidth();
        }
        header.setTableWidth();
      }
      
    }
  },{
    ATTRS : {
      /**
       * \u8868\u5934\u5bf9\u8c61
       * @type {BUI.Grid.Header}
       * @protected
       */
      header:{

      },
      /**
       * @see {BUI.Grid.Grid#tbar}
       * <pre><code>
       * grid = new Grid.Grid({
       *    render:'#grid',
       *    columns : columns,
       *    width : 700,
       *    forceFit : true,
       *    tbar:{ //\u6dfb\u52a0\u3001\u5220\u9664
       *        items : [{
       *          btnCls : 'button button-small',
       *          text : '<i class="icon-plus"></i>\u6dfb\u52a0',
       *          listeners : {
       *            'click' : addFunction
       *          }
       *        },
       *        {
       *          btnCls : 'button button-small',
       *          text : '<i class="icon-remove"></i>\u5220\u9664',
       *          listeners : {
       *            'click' : delFunction
       *          }
       *        }]
       *    },
       *    store : store
       *  });
       *
       * grid.render();
       * </code></pre>
       * @cfg {Object|BUI.Toolbar.Bar} bbar
       */
      /**
       * @see {BUI.Grid.Grid#tbar}
       * @type {Object}
       * @ignore
       */
      bbar:{

      },
      itemCls : {
        value : CLS_GRID_ROW
      },
      /**
       * \u5217\u7684\u914d\u7f6e \u7528\u6765\u914d\u7f6e \u8868\u5934 \u548c \u8868\u5185\u5bb9\u3002{@link BUI.Grid.Column}
       * @cfg {Array} columns
       */
      columns:{
        view : true,
        value:[]
      },
      /**
       * \u5f3a\u8feb\u5217\u81ea\u9002\u5e94\u5bbd\u5ea6\uff0c\u5982\u679c\u5217\u5bbd\u5ea6\u5927\u4e8eGrid\u6574\u4f53\u5bbd\u5ea6\uff0c\u7b49\u6bd4\u4f8b\u7f29\u51cf\uff0c\u5426\u5219\u7b49\u6bd4\u4f8b\u589e\u52a0
       * <pre><code>
       *  var grid = new Grid.Grid({
       *    render:'#grid',
       *    columns : columns,
       *    width : 700,
       *    forceFit : true, //\u81ea\u9002\u5e94\u5bbd\u5ea6
       *    store : store
       *  });
       * </code></pre>
       * @cfg {Boolean} [forceFit= false]
       */
      /**
       * \u5f3a\u8feb\u5217\u81ea\u9002\u5e94\u5bbd\u5ea6\uff0c\u5982\u679c\u5217\u5bbd\u5ea6\u5927\u4e8eGrid\u6574\u4f53\u5bbd\u5ea6\uff0c\u7b49\u6bd4\u4f8b\u7f29\u51cf\uff0c\u5426\u5219\u7b49\u6bd4\u4f8b\u589e\u52a0
       * <pre><code>
       *  grid.set('forceFit',true);
       * </code></pre>
       * @type {Boolean}
       * @default 'false'
       */
      forceFit:{
        sync:false,
        value:false
      },
      /**
       * \u6570\u636e\u4e3a\u7a7a\u65f6\uff0c\u663e\u793a\u7684\u63d0\u793a\u5185\u5bb9
       * <pre><code>
       *  var grid = new Grid({
       *   render:'#J_Grid4',
       *   columns : columns,
       *   store : store,
       *   emptyDataTpl : '&lt;div class="centered"&gt;&lt;img alt="Crying" src="http://img03.taobaocdn.com/tps/i3/T1amCdXhXqXXXXXXXX-60-67.png"&gt;&lt;h2&gt;\u67e5\u8be2\u7684\u6570\u636e\u4e0d\u5b58\u5728&lt;/h2&gt;&lt;/div&gt;',
       *   width:'100%'
       *
       * });
       * 
       * grid.render();
       * </code></pre>
       ** @cfg {Object} emptyDataTpl
       */
      emptyDataTpl : {
        view : true
      },
      /**
       * \u8868\u683c\u9996\u884c\u8bb0\u5f55\u6a21\u677f\uff0c\u9996\u884c\u8bb0\u5f55\uff0c\u9690\u85cf\u663e\u793a\uff0c\u7528\u4e8e\u786e\u5b9a\u8868\u683c\u5404\u5217\u7684\u5bbd\u5ea6
       * @type {String}
       * @protected
       */
      headerRowTpl:{
        view:true,
        value:'<tr class="' + PREFIX + 'grid-header-row">{cellsTpl}</tr>'
      },
      /**
       * \u8868\u683c\u9996\u884c\u8bb0\u5f55\u7684\u5355\u5143\u683c\u6a21\u677f
       * @protected
       * @type {String}
       */
      headerCellTpl:{
        view:true,
        value:'<td class="{hideCls} ' + CLS_TD_PREFIX + '{id}" width="{width}" style="height:0"></td>'
      },
      /**
       * \u8868\u683c\u6570\u636e\u884c\u7684\u6a21\u677f
       * @type {String}
       * @default  <pre>'&lt;tr class="' + CLS_GRID_ROW + ' {{oddCls}}"&gt;{{cellsTpl}}&lt;/tr&gt;'</pre>
       */
      rowTpl:{
        view:true,
        value:'<tr class="' + CLS_GRID_ROW + ' {oddCls}">{cellsTpl}</tr>'
      },
      /**
       * \u5355\u5143\u683c\u7684\u6a21\u677f
       * @type {String}
       * <pre>
       *     '&lt;td  class="' + CLS_GRID_CELL + ' grid-td-{{id}}" data-column-id="{{id}}" data-column-field = {{dataIndex}}&gt;'+
       *        '&lt;div class="' + CLS_GRID_CELL_INNER + '" &gt;{{cellText}}&lt;/div&gt;'+
       *    '&lt;/td&gt;'
       *</pre>
       */
      cellTpl:{
        view:true,
        value:'<td  class="{elCls} {hideCls} ' + CLS_GRID_CELL + ' ' + CLS_TD_PREFIX + '{id}" data-column-id="{id}" data-column-field = "{dataIndex}" >' +
            '<div class="' + CLS_GRID_CELL_INNER + '" >{cellText}</div>' +
            '</td>'

      },
      /**
       * \u5355\u5143\u683c\u6587\u672c\u7684\u6a21\u677f
       * @default &lt;span class="' + CLS_CELL_TEXT + ' " title = "{{tips}}"&gt;{{text}}&lt;/span&gt;
       * @type {String}
       */
      cellTextTpl:{
        view:true,
        value:'<span class="' + CLS_CELL_TEXT + ' " title = "{tips}">{text}</span>'
      },
      /**
       * \u4e8b\u4ef6\u96c6\u5408
       * @type {Object}
       */
      events:{
        value:{
          /**
           * \u663e\u793a\u5b8c\u6570\u636e\u89e6\u53d1
           * @event
           */
          'aftershow' : false,
           /**
           * \u8868\u683c\u7684\u6570\u636e\u6e05\u7406\u5b8c\u6210\u540e
           * @event
           */
          'clear' : false,
          /**
           * \u70b9\u51fb\u5355\u5143\u683c\u65f6\u89e6\u53d1,\u5982\u679creturn false,\u5219\u4f1a\u963b\u6b62 'rowclick' ,'rowselected','rowunselected'\u4e8b\u4ef6
           * @event
           * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
           * @param {Object} e.record \u6b64\u884c\u7684\u8bb0\u5f55
           * @param {String} e.field \u70b9\u51fb\u5355\u5143\u683c\u5217\u5bf9\u5e94\u7684\u5b57\u6bb5\u540d\u79f0
           * @param {HTMLElement} e.row \u70b9\u51fb\u884c\u5bf9\u5e94\u7684DOM
           * @param {HTMLElement} e.cell \u70b9\u51fb\u5bf9\u5e94\u7684\u5355\u5143\u683c\u7684DOM
           * @param {HTMLElement} e.domTarget \u70b9\u51fb\u7684DOM
           * @param {jQuery.Event} e.domEvent \u70b9\u51fb\u7684jQuery\u4e8b\u4ef6
           */
          'cellclick' : false,
          /**
           * \u70b9\u51fb\u8868\u5934
           * @event 
           * @param {jQuery.Event} e \u4e8b\u4ef6\u5bf9\u8c61
           * @param {BUI.Grid.Column} e.column \u5217\u5bf9\u8c61
           * @param {HTMLElement} e.domTarget \u70b9\u51fb\u7684DOM
           */
          'columnclick' : false,
          /**
           * \u70b9\u51fb\u884c\u65f6\u89e6\u53d1\uff0c\u5982\u679creturn false,\u5219\u4f1a\u963b\u6b62'rowselected','rowunselected'\u4e8b\u4ef6
           * @event
           * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
           * @param {Object} e.record \u6b64\u884c\u7684\u8bb0\u5f55
           * @param {HTMLElement} e.row \u70b9\u51fb\u884c\u5bf9\u5e94\u7684DOM
           * @param {HTMLElement} e.domTarget \u70b9\u51fb\u7684DOM
           */
          'rowclick' : false,
          /**
           * \u5f53\u4e00\u884c\u6570\u636e\u663e\u793a\u5728\u8868\u683c\u4e2d\u540e\u89e6\u53d1
           * @event
           * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
           * @param {Object} e.record \u6b64\u884c\u7684\u8bb0\u5f55
           * @param {HTMLElement} e.row \u884c\u5bf9\u5e94\u7684DOM
           * @param {HTMLElement} e.domTarget \u6b64\u4e8b\u4ef6\u4e2d\u7b49\u4e8e\u884c\u5bf9\u5e94\u7684DOM
           */
          'rowcreated' : false,
          /**
           * \u79fb\u9664\u4e00\u884c\u7684DOM\u540e\u89e6\u53d1
           * @event
           * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
           * @param {Object} e.record \u6b64\u884c\u7684\u8bb0\u5f55
           * @param {HTMLElement} e.row \u884c\u5bf9\u5e94\u7684DOM
           * @param {HTMLElement} e.domTarget \u6b64\u4e8b\u4ef6\u4e2d\u7b49\u4e8e\u884c\u5bf9\u5e94\u7684DOM
           */
          'rowremoved' : false,
          /**
           * \u9009\u4e2d\u4e00\u884c\u65f6\u89e6\u53d1
           * @event
           * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
           * @param {Object} e.record \u6b64\u884c\u7684\u8bb0\u5f55
           * @param {HTMLElement} e.row \u884c\u5bf9\u5e94\u7684DOM
           * @param {HTMLElement} e.domTarget \u6b64\u4e8b\u4ef6\u4e2d\u7b49\u4e8e\u884c\u5bf9\u5e94\u7684DOM
           */
          'rowselected' : false,
          /**
           * \u6e05\u9664\u9009\u4e2d\u4e00\u884c\u65f6\u89e6\u53d1\uff0c\u53ea\u6709\u591a\u9009\u60c5\u51b5\u4e0b\u89e6\u53d1
           * @event
           * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
           * @param {Object} e.record \u6b64\u884c\u7684\u8bb0\u5f55
           * @param {HTMLElement} e.row \u884c\u5bf9\u5e94\u7684DOM
           * @param {HTMLElement} e.domTarget \u6b64\u4e8b\u4ef6\u4e2d\u7b49\u4e8e\u884c\u5bf9\u5e94\u7684DOM
           */
          'rowunselected' : false,
          /**
           * \u8868\u683c\u5185\u90e8\u53d1\u751f\u6eda\u52a8\u65f6\u89e6\u53d1
           * @event
           * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
           * @param {Number} e.scrollLeft \u6eda\u52a8\u5230\u7684\u6a2a\u5750\u6807
           * @param {Number} e.scrollTop \u6eda\u52a8\u5230\u7684\u7eb5\u5750\u6807
           * @param {Number} e.bodyWidth \u8868\u683c\u5185\u90e8\u7684\u5bbd\u5ea6
           * @param {Number} e.bodyHeight \u8868\u683c\u5185\u90e8\u7684\u9ad8\u5ea6
           */
          'scroll' : false
        }
      },
      /**
       * \u662f\u5426\u5947\u5076\u884c\u6dfb\u52a0\u5206\u5272\u8272
       * @type {Boolean}
       * @default true
       */
      stripeRows:{
        view:true,
        value:true
      },
      /**
       * \u9876\u5c42\u7684\u5de5\u5177\u680f\uff0c\u8ddfbbar\u7ed3\u6784\u4e00\u81f4,\u53ef\u4ee5\u662f\u5de5\u5177\u680f\u5bf9\u8c61@see {BUI.Toolbar.Bar},\u4e5f\u53ef\u4ee5\u662fxclass\u5f62\u5f0f\u7684\u914d\u7f6e\u9879\uff0c
       * \u8fd8\u53ef\u4ee5\u662f\u5305\u542b\u4ee5\u4e0b\u5b57\u6bb5\u7684\u914d\u7f6e\u9879
       * <ol>
       * <li>items:\u5de5\u5177\u680f\u7684\u9879\uff0c
       *    - \u9ed8\u8ba4\u662f\u6309\u94ae(xtype : button)\u3001
       *    - \u6587\u672c(xtype : text)\u3001
       *    - \u94fe\u63a5(xtype : link)\u3001
       *    - \u5206\u9694\u7b26(bar-item-separator)\u4ee5\u53ca\u81ea\u5b9a\u4e49\u9879
       * </li>
       * <li>pagingBar:\u8868\u660e\u5305\u542b\u5206\u9875\u680f</li>
       * </ol>
       * @type {Object|BUI.Toolbar.Bar}
       * @example
       * tbar:{
       *     items:[
       *         {
       *             text:'\u547d\u4ee4\u4e00' //\u9ed8\u8ba4\u662f\u6309\u94ae
       *             
       *         },
       *         {
       *             xtype:'text',
       *             text:'\u6587\u672c'
       *         }
       *     ],
       *     pagingBar:true
       * }
       */
      tbar:{

      },
      /**
       * \u53ef\u4ee5\u9644\u52a0\u5230\u8868\u683c\u4e0a\u7684\u6837\u5f0f.
       * @cfg {String} tableCls
       * @default 'bui-grid-table' this css cannot be overridden
       */
      tableCls:{
        view : true,
        sync : false,
        value:PREFIX + 'grid-table'
      },
      /**
       * \u8868\u4f53\u7684\u6a21\u677f
       * @protected
       * @type {String}
       */
      tableTpl : {
        view:true,
        value:'<table cellspacing="0" cellpadding="0" >' +
            '<tbody></tbody>' +
            '</table>'
      },
      tpl : {
        value : '<div class="'+CLS_GRID_TBAR+'" style="display:none"></div><div class="'+CLS_GRID_HEADER_CONTAINER+'"></div><div class="'+CLS_GRID_BODY+'"></div><div style="display:none" class="' + CLS_GRID_BBAR + '"></div>'
      },
      /**
       * \u5355\u5143\u683c\u5de6\u53f3\u4e4b\u95f4\u662f\u5426\u51fa\u73b0\u8fb9\u6846
       * 
       * @cfg {Boolean} [innerBorder=true]
       */
      /**
       * \u5355\u5143\u683c\u5de6\u53f3\u4e4b\u95f4\u662f\u5426\u51fa\u73b0\u8fb9\u6846
       * <pre><code>
       *   var  grid = new Grid.Grid({
       *     render:'#grid',
       *     innerBorder: false, // \u9ed8\u8ba4\u4e3atrue
       *     columns : columns,
       *     store : store
       *   });
       * </code></pre>
       * @type {Boolean}
       * @default true
       */
      innerBorder : {
        sync:false,
        value : true
      },
      /**
       * \u662f\u5426\u4f7f\u7528\u7a7a\u767d\u5355\u5143\u683c\u7528\u4e8e\u5360\u4f4d\uff0c\u4f7f\u5217\u5bbd\u7b49\u4e8e\u8bbe\u7f6e\u7684\u5bbd\u5ea6
       * @type {Boolean}
       * @private
       */
      useEmptyCell : {
        view : true,
        value : true
      },
      /**
       * \u662f\u5426\u9996\u884c\u4f7f\u7528\u7a7a\u767d\u884c\uff0c\u7528\u4ee5\u786e\u5b9a\u8868\u683c\u5217\u7684\u5bbd\u5ea6
       * @type {Boolean}
       * @private
       */
      useHeaderRow : {
        view : true,
        value : true
      },
      /**
       * Grid \u7684\u89c6\u56fe\u7c7b\u578b
       * @type {BUI.Grid.GridView}
       */
      xview : {
        value : gridView
      }
    }
  },{
    xclass : 'grid'
  });

  return grid;
});

/**
 * @ignore
 * 2013.1.18 
 *   \u8fd9\u662f\u4e00\u4e2a\u91cd\u6784\u7684\u7248\u672c\uff0c\u5c06Body\u53d6\u6d88\u6389\u4e86\uff0c\u76ee\u7684\u662f\u4e3a\u4e86\u53ef\u4ee5\u5c06Grid\u548cSimpleGrid\u8054\u7cfb\u8d77\u6765\uff0c
 *   \u540c\u65f6\u5c06selection \u7edf\u4e00         
 *//**
 * @fileOverview this class details some util tools of grid,like loadMask, formatter for grid's cell render
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */
define('bui/grid/format',function (require) {

    function formatTimeUnit(v) {
        if (v < 10) {
            return '0' + v;
        }
        return v;
    }

    /**
     * This class specifies some formatter for grid's cell renderer
     * @class BUI.Grid.Format
     * @singleton
     */
    var Format =
    /** 
    * @lends BUI.Grid.Format 
    * @ignore
    */
    {
        /**
         * \u65e5\u671f\u683c\u5f0f\u5316\u51fd\u6570
         * @param {Number|Date} d \u683c\u5f0f\u8bdd\u7684\u65e5\u671f\uff0c\u4e00\u822c\u4e3a1970 \u5e74 1 \u6708 1 \u65e5\u81f3\u4eca\u7684\u6beb\u79d2\u6570
         * @return {String} \u683c\u5f0f\u5316\u540e\u7684\u65e5\u671f\u683c\u5f0f\u4e3a 2011-10-31
         * @example
         * \u4e00\u822c\u7528\u6cd5\uff1a<br>
         * BUI.Grid.Format.dateRenderer(1320049890544);\u8f93\u51fa\uff1a2011-10-31 <br>
         * \u8868\u683c\u4e2d\u7528\u4e8e\u6e32\u67d3\u5217\uff1a<br>
         * {title:"\u51fa\u5e93\u65e5\u671f",dataIndex:"date",renderer:BUI.Grid.Format.dateRenderer}
         */
        dateRenderer:function (d) {
            if (!d) {
                return '';
            }
            if (BUI.isString(d)) {
                return d;
            }
            var date = null;
            try {
                date = new Date(d);
            } catch (e) {
                return '';
            }
            if (!date || !date.getFullYear) {
                return '';
            }
            return date.getFullYear() + '-' + formatTimeUnit(date.getMonth() + 1) + '-' + formatTimeUnit(date.getDate());
        },
        /**
         * @description \u65e5\u671f\u65f6\u95f4\u683c\u5f0f\u5316\u51fd\u6570
         * @param {Number|Date} d \u683c\u5f0f\u8bdd\u7684\u65e5\u671f\uff0c\u4e00\u822c\u4e3a1970 \u5e74 1 \u6708 1 \u65e5\u81f3\u4eca\u7684\u6beb\u79d2\u6570
         * @return {String} \u683c\u5f0f\u5316\u540e\u7684\u65e5\u671f\u683c\u5f0f\u65f6\u95f4\u4e3a 2011-10-31 16 : 41 : 02
         */
        datetimeRenderer:function (d) {
            if (!d) {
                return '';
            }
            if (BUI.isString(d)) {
                return d;
            }
            var date = null;
            try {
                date = new Date(d);
            } catch (e) {
                return '';
            }
            if (!date || !date.getFullYear) {
                return '';
            }
            return date.getFullYear() + '-' + formatTimeUnit(date.getMonth() + 1) + '-' + formatTimeUnit(date.getDate()) + ' ' + formatTimeUnit(date.getHours()) + ':' + formatTimeUnit(date.getMinutes()) + ':' + formatTimeUnit(date.getSeconds());
        },
        /**
         * \u6587\u672c\u622a\u53d6\u51fd\u6570\uff0c\u5f53\u6587\u672c\u8d85\u51fa\u4e00\u5b9a\u6570\u5b57\u65f6\uff0c\u4f1a\u622a\u53d6\u6587\u672c\uff0c\u6dfb\u52a0...
         * @param {Number} length \u622a\u53d6\u591a\u5c11\u5b57\u7b26
         * @return {Function} \u8fd4\u56de\u5904\u7406\u51fd\u6570 \u8fd4\u56de\u622a\u53d6\u540e\u7684\u5b57\u7b26\u4e32\uff0c\u5982\u679c\u672c\u8eab\u5c0f\u4e8e\u6307\u5b9a\u7684\u6570\u5b57\uff0c\u8fd4\u56de\u539f\u5b57\u7b26\u4e32\u3002\u5982\u679c\u5927\u4e8e\uff0c\u5219\u8fd4\u56de\u622a\u65ad\u540e\u7684\u5b57\u7b26\u4e32\uff0c\u5e76\u9644\u52a0...
         */
        cutTextRenderer:function (length) {
            return function (value) {
                value = value || '';
                if (value.toString().length > length) {
                    return value.toString().substring(0, length) + '...';
                }
                return value;
            };
        },
        /**
         * \u679a\u4e3e\u683c\u5f0f\u5316\u51fd\u6570
         * @param {Object} enumObj \u952e\u503c\u5bf9\u7684\u679a\u4e3e\u5bf9\u8c61 {"1":"\u5927","2":"\u5c0f"}
         * @return {Function} \u8fd4\u56de\u6307\u5b9a\u679a\u4e3e\u7684\u683c\u5f0f\u5316\u51fd\u6570
         * @example
         * //Grid \u7684\u5217\u5b9a\u4e49
         *  {title:"\u72b6\u6001",dataIndex:"status",renderer:BUI.Grid.Format.enumRenderer({"1":"\u5165\u5e93","2":"\u51fa\u5e93"})}
         */
        enumRenderer:function (enumObj) {
            return function (value) {
                return enumObj[value] || '';
            };
        },
        /*
         * \u5c06\u591a\u4e2a\u503c\u8f6c\u6362\u6210\u4e00\u4e2a\u5b57\u7b26\u4e32
         * @param {Object} enumObj \u952e\u503c\u5bf9\u7684\u679a\u4e3e\u5bf9\u8c61 {"1":"\u5927","2":"\u5c0f"}
         * @return {Function} \u8fd4\u56de\u6307\u5b9a\u679a\u4e3e\u7684\u683c\u5f0f\u5316\u51fd\u6570
         * @example
         * <code>
         *  //Grid \u7684\u5217\u5b9a\u4e49
         *  {title:"\u72b6\u6001",dataIndex:"status",renderer:BUI.Grid.Format.multipleItemsRenderer({"1":"\u5165\u5e93","2":"\u51fa\u5e93","3":"\u9000\u8d27"})}
         *  //\u6570\u636e\u6e90\u662f[1,2] \u65f6\uff0c\u5219\u8fd4\u56de "\u5165\u5e93,\u51fa\u5e93"
         * </code>
         */
        multipleItemsRenderer:function (enumObj) {
            var enumFun = Format.enumRenderer(enumObj);
            return function (values) {
                var result = [];
                if (!values) {
                    return '';
                }
                if (!BUI.isArray(values)) {
                    values = values.toString().split(',');
                }
                $.each(values, function (index,value) {
                    result.push(enumFun(value));
                });

                return result.join(',');
            };
        },
        /*
         * \u5c06\u8d22\u52a1\u6570\u636e\u5206\u8f6c\u6362\u6210\u5143
         * @param {Number|String} enumObj \u952e\u503c\u5bf9\u7684\u679a\u4e3e\u5bf9\u8c61 {"1":"\u5927","2":"\u5c0f"}
         * @return {Number} \u8fd4\u56de\u5c06\u5206\u8f6c\u6362\u6210\u5143\u7684\u6570\u5b57
         */
        moneyCentRenderer:function (v) {
            if (BUI.isString(v)) {
                v = parseFloat(v);
            }
            if ($.isNumberic(v)) {
                return (v * 0.01).toFixed(2);
            }
            return v;
        }
    };

    return Format;
});/**
 * @fileOverview \u8868\u683c\u63d2\u4ef6\u7684\u5165\u53e3
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */
;(function(){
var BASE = 'bui/grid/plugins/';
define('bui/grid/plugins',['bui/common',BASE + 'selection',BASE + 'cascade',BASE + 'cellediting',BASE + 'rowediting',BASE + 'dialogediting',BASE + 'menu',BASE + 'summary'],function (r) {
	var BUI = r('bui/common'),
		Selection = r(BASE + 'selection'),

		Plugins = {};

		BUI.mix(Plugins,{
			CheckSelection : Selection.CheckSelection,
			RadioSelection : Selection.RadioSelection,
			Cascade : r(BASE + 'cascade'),
			CellEditing : r(BASE + 'cellediting'),
			RowEditing : r(BASE + 'rowediting'),
			DialogEditing : r(BASE + 'dialogediting'),
			GridMenu : r(BASE + 'menu'),
			Summary : r(BASE + 'summary')
		});
		
	return Plugins;
});
})();
/**
 * @fileOverview Grid \u83dc\u5355
 * @ignore
 */
define('bui/grid/plugins/menu',['bui/common','bui/menu'],function (require) {

  var BUI = require('bui/common'),
    Menu = require('bui/menu'),
    PREFIX = BUI.prefix,
    ID_SORT_ASC = 'sort-asc',
    ID_SORT_DESC = 'sort-desc',
    ID_COLUMNS_SET = 'column-setting',
    CLS_COLUMN_CHECKED = 'icon-check';

  /**
   * @class BUI.Grid.Plugins.GridMenu
   * @extends BUI.Base
   * \u8868\u683c\u83dc\u5355\u63d2\u4ef6
   */
  var gridMenu = function (config) {
    gridMenu.superclass.constructor.call(this,config);
  };

  BUI.extend(gridMenu,BUI.Base);

  gridMenu.ATTRS = 
  {
    /**
     * \u5f39\u51fa\u83dc\u5355
     * @type {BUI.Menu.ContextMenu}
     */
    menu : {

    },
    /**
     * @private
     */
    activedColumn : {

    },
    triggerCls : {
      value : PREFIX + 'grid-hd-menu-trigger'
    },
    /**
     * \u83dc\u5355\u7684\u914d\u7f6e\u9879
     * @type {Array}
     */
    items : {
      value : [
        {
          id:ID_SORT_ASC,
          text:'\u5347\u5e8f',
          iconCls:'icon-arrow-up'
        },
        {
          id:ID_SORT_DESC,
          text:'\u964d\u5e8f',
          iconCls : 'icon-arrow-down'
        },
        {
          xclass:'menu-item-sparator'
        },
        {
          id : ID_COLUMNS_SET,
          text:'\u8bbe\u7f6e\u5217',
          iconCls:'icon-list-alt'
        }
      ]
    }
  };

  BUI.augment(gridMenu,{
    /**
     * \u521d\u59cb\u5316
     * @protected
     */
    initializer : function (grid) {
      var _self = this;
      _self.set('grid',grid);

    },
    /**
     * \u6e32\u67d3DOM
     */
    renderUI : function(grid){
      var _self = this, 
        columns = grid.get('columns');
      BUI.each(columns,function(column){
        _self._addShowMenu(column);
      });
    },
    /**
     * \u7ed1\u5b9a\u8868\u683c
     * @protected
     */
    bindUI : function (grid){
      var _self = this;

      grid.on('columnadd',function(ev){
        _self._addShowMenu(ev.column);
      });
      grid.on('columnclick',function (ev) {
        var sender = $(ev.domTarget),
          column = ev.column,
          menu;

        _self.set('activedColumn',column);
        
        if(sender.hasClass(_self.get('triggerCls'))){
          menu = _self.get('menu') || _self._initMenu();
          menu.set('align',{
            node: sender, // \u53c2\u8003\u5143\u7d20, falsy \u6216 window \u4e3a\u53ef\u89c6\u533a\u57df, 'trigger' \u4e3a\u89e6\u53d1\u5143\u7d20, \u5176\u4ed6\u4e3a\u6307\u5b9a\u5143\u7d20
            points: ['bl','tl'], // ['tr', 'tl'] \u8868\u793a overlay \u7684 tl \u4e0e\u53c2\u8003\u8282\u70b9\u7684 tr \u5bf9\u9f50
            offset: [0, 0] 
          });
          menu.show();
          _self._afterShow(column,menu);
        }
      });
    },
    _addShowMenu : function(column){
      if(!column.get('fixed')){
        column.set('showMenu',true);
      }
    },
    //\u83dc\u5355\u663e\u793a\u540e
    _afterShow : function (column,menu) {
      var _self = this,
        grid = _self.get('grid');

      menu = menu || _self.get('menu');
      _self._resetSortMenuItems(column,menu);
      _self._resetColumnsVisible(menu);
    },
    //\u8bbe\u7f6e\u83dc\u5355\u9879\u662f\u5426\u9009\u4e2d
    _resetColumnsVisible : function (menu) {
      var _self = this,
        settingItem = menu.findItemById(ID_COLUMNS_SET),
        subMenu = settingItem.get('subMenu') || _self._initColumnsMenu(settingItem),
        columns = _self.get('grid').get('columns');
      subMenu.removeChildren(true);
      $.each(columns,function (index,column) {
        if(!column.get('fixed')){
          var config = {
              xclass : 'context-menu-item',
              text : column.get('title'),
              column : column,
              iconCls : 'icon'
            },
            menuItem = subMenu.addChild(config);
          if(column.get('visible')){
            menuItem.set('selected',true);
          }
        }
      });
    },
    //\u8bbe\u7f6e\u6392\u5e8f\u83dc\u5355\u9879\u662f\u5426\u53ef\u7528
    _resetSortMenuItems : function(column,menu) {
      var ascItem = menu.findItemById(ID_SORT_ASC),
        descItem = menu.findItemById(ID_SORT_DESC);
      if(column.get('sortable')){
        ascItem.set('disabled',false);
        descItem.set('disabled',false);
      }else{
        ascItem.set('disabled',true);
        descItem.set('disabled',true);
      }
    },
    //\u521d\u59cb\u5316\u83dc\u5355
    _initMenu : function () {
      var _self = this,
        menu = _self.get('menu'),
        menuItems;

      if(!menu){
        menuItems = _self.get('items');
        $.each(menuItems,function (index,item) {
          if(!item.xclass){
            item.xclass = 'context-menu-item'
          }
        });
        menu = new Menu.ContextMenu({
          children : menuItems,
          elCls : 'grid-menu'
        });
        _self._initMenuEvent(menu);
        _self.set('menu',menu)
      }
      return menu;
    },
    _initMenuEvent : function  (menu) {
      var _self = this;

      menu.on('itemclick',function(ev) {
        var item = ev.item,
          id = item.get('id'),
          activedColumn = _self.get('activedColumn');
        if(id === ID_SORT_ASC){
          activedColumn.set('sortState','ASC');
        }else if(id === ID_SORT_DESC){
          activedColumn.set('sortState','DESC');
        }
      });

      menu.on('afterVisibleChange',function (ev) {
        var visible = ev.newVal,
          activedColumn = _self.get('activedColumn');
        if(visible && activedColumn){
          activedColumn.set('open',true);
        }else{
          activedColumn.set('open',false);
        }
      });
    },
    _initColumnsMenu : function (settingItem) {
      var subMenu = new Menu.ContextMenu({
          multipleSelect : true,
          elCls : 'grid-column-menu'
        });  
      settingItem.set('subMenu',subMenu);
      subMenu.on('itemclick',function (ev) {
        var item = ev.item,
          column = item.get('column'),
          selected = item.get('selected');
        if(selected){
          column.set('visible',true);
        }else{
          column.set('visible',false);
        }
      });
      return subMenu;
    },
    destructor:function () {
      var _self = this,
        menu = _self.get('menu');
      if(menu){
        menu.destroy();
      }
      _self.off();
      _self.clearAttrVals();
    }

  });

  return gridMenu;

});/**
 * @fileOverview \u7ea7\u8054\u8868\u683c
 * @ignore
 */

define('bui/grid/plugins/cascade',['bui/common'],function(require){

  var BUI = require('bui/common'),
    PREFIX = BUI.prefix,
    CLS_GRID_CASCADE = '',
    DATA_RECORD = 'data-record',
    CLS_CASCADE = PREFIX + 'grid-cascade',
    CLS_CASCADE_EXPAND = CLS_CASCADE + '-expand',
    CLS_CASCADE_ROW = CLS_CASCADE + '-row',
    CLS_CASCADE_CELL = CLS_CASCADE + '-cell',
    CLS_CASCADE_ROW_COLLAPSE = CLS_CASCADE + '-collapse';

  /**
   * \u7ea7\u8054\u8868\u683c
   * <pre><code>
   *  // \u5b9e\u4f8b\u5316 Grid.Plugins.Cascade \u63d2\u4ef6
   *    var cascade = new Grid.Plugins.Cascade({
   *      renderer : function(record){
   *        return '<div style="padding: 10px 20px;"><h2>\u8be6\u60c5\u4fe1\u606f</h2><p>' + record.detail + '</p></div>';
   *      }
   *    });
   *    var store = new Store({
   *        data : data,
   *        autoLoad:true
   *      }),
   *      grid = new Grid.Grid({
   *        render:'#grid',
   *        columns : columns,
   *        store: store,
   *        plugins: [cascade]  // Grid.Plugins.Cascade \u63d2\u4ef6
   *      });
   *
   *    grid.render();
   *    
   *    cascade.expandAll();//\u5c55\u5f00\u6240\u6709
   * </code></pre>
   * @class BUI.Grid.Plugins.Cascade
   * @extends BUI.Base
   */
  var cascade = function(config){
    cascade.superclass.constructor.call(this, config);
  };

  BUI.extend(cascade,BUI.Base);

  cascade.ATTRS = 
  /**
   * @lends BUI.Grid.Plugins.Cascade#
   * @ignore
   */
  {
    /**
     * \u663e\u793a\u5c55\u5f00\u6309\u94ae\u5217\u7684\u5bbd\u5ea6
     * @cfg {Number} width
     */
    /**
     * \u663e\u793a\u5c55\u5f00\u6309\u94ae\u5217\u7684\u5bbd\u5ea6
     * @type {Number}
     * @default 40
     */
    width:{
      value:40
    },
    /**
     * \u5c55\u5f00\u5217\u7684\u9ed8\u8ba4\u5185\u5bb9
     * @type {String}
     * @protected
     */
    cellInner:{
      value:'<span class="' + CLS_CASCADE + '"><i class="' + CLS_CASCADE + '-icon"></i></span>'
    },
    /**
     * \u5c55\u5f00\u884c\u7684\u6a21\u7248
     * @protected
     * @type {String}
     */
    rowTpl : {
      value:'<tr class="' + CLS_CASCADE_ROW + '"><td class="'+ CLS_CASCADE_CELL + '"></td></tr>'
    },
    /**
     * \u751f\u6210\u7ea7\u8054\u5217\u65f6\u9700\u8981\u6e32\u67d3\u7684\u5185\u5bb9
     * @cfg {Function} renderer
     */
    /**
     * \u751f\u6210\u7ea7\u8054\u5217\u65f6\u9700\u8981\u6e32\u67d3\u7684\u5185\u5bb9
     * @type {Function}
     */
    renderer:{

    },
    events : [
      /**
       * \u5c55\u5f00\u7ea7\u8054\u5185\u5bb9\u65f6\u89e6\u53d1
       * @name  BUI.Grid.Plugins.Cascade#expand
       * @event
       * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
       * @param {Object} e.record \u7ea7\u8054\u5185\u5bb9\u5bf9\u5e94\u7684\u7eaa\u5f55
       * @param {HTMLElement} e.row \u7ea7\u8054\u7684\u884cDOM
       */
      'expand',
      /**
       * \u6298\u53e0\u7ea7\u8054\u5185\u5bb9\u65f6\u89e6\u53d1
       * @name  BUI.Grid.Plugins.Cascade#collapse
       * @event
       * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
       * @param {Object} e.record \u7ea7\u8054\u5185\u5bb9\u5bf9\u5e94\u7684\u7eaa\u5f55
       * @param {HTMLElement} e.row \u7ea7\u8054\u7684\u884cDOM
       */
      'collapse',
      /**
       * \u5220\u9664\u7ea7\u8054\u5185\u5bb9\u65f6\u89e6\u53d1
       * @name  BUI.Grid.Plugins.Cascade#removed
       * @event
       * @param {jQuery.Event} e  \u4e8b\u4ef6\u5bf9\u8c61
       * @param {Object} e.record \u7ea7\u8054\u5185\u5bb9\u5bf9\u5e94\u7684\u7eaa\u5f55
       * @param {HTMLElement} e.row \u7ea7\u8054\u7684\u884cDOM
       */
      'removed'
    ]
  };

  BUI.augment(cascade,
  /**
   * @lends BUI.Grid.Plugins.Cascade.prototype
   * @ignore
   */
  {
    /**
     * \u521d\u59cb\u5316
     * @protected
     */
    initializer:function(grid){
      var _self = this;
      var cfg = {
            title : '',
            elCls:'center',//\u5c45\u4e2d\u5bf9\u9f50
            width : _self.get('width'),
            resizable:false,
            fixed : true,
            sortable : false,
            cellTpl : _self.get('cellInner')
        },
        expandColumn = grid.addColumn(cfg,0);
      //\u5217\u4e4b\u95f4\u7684\u7ebf\u53bb\u6389
      grid.set('innerBorder',false);

      _self.set('grid',grid);
    },
    /**
     * \u7ed1\u5b9a\u4e8b\u4ef6
     * @protected
     */
    bindUI:function(grid){
      var _self = this;
      grid.on('cellclick',function(ev){
        var sender = $(ev.domTarget),
          cascadeEl = sender.closest('.' + CLS_CASCADE);
        //\u5982\u679c\u70b9\u51fb\u5c55\u5f00\u3001\u6298\u53e0\u6309\u94ae
        if(cascadeEl.length){
          if(!cascadeEl.hasClass(CLS_CASCADE_EXPAND)){
            _self._onExpand(ev.record,ev.row,cascadeEl);
          }else{
            _self._onCollapse(ev.record,ev.row,cascadeEl);
          }
        }
      });

      grid.on('columnvisiblechange',function(){
        _self._resetColspan();
      });

      grid.on('rowremoved',function(ev){
        _self.remove(ev.record);
      });

      grid.on('clear',function(){
        _self.removeAll();
      });
    },
    /**
     * \u5c55\u5f00\u6240\u6709\u7ea7\u8054\u6570\u636e
     * <pre><code>
     *   cascade.expandAll();
     * </code></pre>
     */
    expandAll : function(){
      var _self = this,
        grid = _self.get('grid'),
        records = grid.getRecords();
        $.each(records,function(index,record){
          _self.expand(record);
        });
    },
    /**
     * \u5c55\u5f00\u67d0\u6761\u7eaa\u5f55
     * <pre><code>
     *   var record = grid.getItem('a');
     *   cascade.expand(record);
     * </code></pre>
     * @param  {Object} record \u7eaa\u5f55
     */
    expand : function(record){
      var _self = this,
        grid = _self.get('grid');

      var row = grid.findRow(record);
      if(row){
        _self._onExpand(record,row);
      }
    },
    /**
     * \u6298\u53e0\u67d0\u6761\u7eaa\u5f55
     * <pre><code>
     *   var record = grid.getItem('a');
     *   cascade.collapse(record);
     * </code></pre>
     * @param  {Object} record \u7eaa\u5f55
     */
    collapse : function(record){
      var _self = this,
        grid = _self.get('grid');

      var row = grid.findRow(record);
      if(row){
        _self._onCollapse(record,row);
      }
    },
    /**
     * \u79fb\u9664\u6240\u6709\u7ea7\u8054\u6570\u636e\u7684\uff24\uff2f\uff2d
     * @protected
     */
    removeAll : function(){
      var _self = this,
        rows = _self._getAllCascadeRows();

      rows.each(function(index,row){
      
        _self._removeCascadeRow(row);
      });
    },
    /**
     * \u6839\u636e\u7eaa\u5f55\u5220\u9664\u7ea7\u8054\u4fe1\u606f
     * @protected
     * @param  {Object} record \u7ea7\u8054\u4fe1\u606f\u5bf9\u5e94\u7684\u7eaa\u5f55
     */
    remove : function(record){
      var _self = this,
        cascadeRow = _self._findCascadeRow(record);
      if(cascadeRow){
        _self._removeCascadeRow(cascadeRow);
      }

    },
    /**
     * \u6298\u53e0\u6240\u6709\u7ea7\u8054\u6570\u636e
     * <pre><code>
     *  cascade.collapseAll();
     * </code></pre>
     */
    collapseAll : function(){
      var _self = this,
        grid = _self.get('grid'),
        records = grid.getRecords();
        $.each(records,function(index,record){
          _self.collapse(record);
        });
    },
    //\u83b7\u53d6\u7ea7\u8054\u6570\u636e
    _getRowRecord : function(cascadeRow){
      return $(cascadeRow).data(DATA_RECORD);
    },
    //\u79fb\u9664\u7ea7\u8054\u884c
    _removeCascadeRow : function(row){

      this.fire('removed',{record: $(row).data(DATA_RECORD),row : row});
      $(row).remove();
    },
    //\u901a\u8fc7\u7eaa\u5f55\u67e5\u627e
    _findCascadeRow: function(record){
      var _self = this,
        rows = _self._getAllCascadeRows(),
        result = null;

      $.each(rows,function(index,row){
        if(_self._getRowRecord(row) === record){
          result = row;
          return false;
        }
      });
      return result;
    },
    _getAllCascadeRows : function(){
      var _self = this,
        grid = _self.get('grid');
      return grid.get('el').find('.' + CLS_CASCADE_ROW);
    },
    //\u83b7\u53d6\u751f\u6210\u7684\u7ea7\u8054\u884c
    _getCascadeRow : function(gridRow){
      var nextRow = $(gridRow).next();
      if((nextRow).hasClass(CLS_CASCADE_ROW)){
        return nextRow;
      }
      return null;
      //return $(gridRow).next('.' + CLS_CASCADE_ROW);
    },
    //\u83b7\u53d6\u7ea7\u8054\u5185\u5bb9
    _getRowContent : function(record){
      var _self = this,
        renderer = _self.get('renderer'),
        content = renderer ? renderer(record) : '';
      return content;
    },
    //\u521b\u5efa\u7ea7\u8054\u884c
    _createCascadeRow : function(record,gridRow){
      var _self = this,
        rowTpl = _self.get('rowTpl'),
        content = _self._getRowContent(record),
        rowEl = $(rowTpl).insertAfter(gridRow);

      rowEl.find('.' + CLS_CASCADE_CELL).append($(content));
      rowEl.data(DATA_RECORD,record);
      return rowEl;
    },
    //\u5c55\u5f00
    _onExpand : function(record,row,cascadeEl){
      var _self = this,
        cascadeRow = _self._getCascadeRow(row),
        colspan = _self._getColumnCount(row);

      cascadeEl = cascadeEl || $(row).find('.'+CLS_CASCADE);
      cascadeEl.addClass(CLS_CASCADE_EXPAND);

      if(!cascadeRow || !cascadeRow.length){
        cascadeRow = _self._createCascadeRow(record,row);
      }
      $(cascadeRow).removeClass(CLS_CASCADE_ROW_COLLAPSE);

      _self._setColSpan(cascadeRow,row);
      
      _self.fire('expand',{record : record,row : cascadeRow[0]});
    },
    //\u6298\u53e0
    _onCollapse : function(record,row,cascadeEl){

      var _self = this,
        cascadeRow = _self._getCascadeRow(row);
      cascadeEl = cascadeEl || $(row).find('.'+CLS_CASCADE);
      cascadeEl.removeClass(CLS_CASCADE_EXPAND);

      if(cascadeRow || !cascadeRow.length){
        $(cascadeRow).addClass(CLS_CASCADE_ROW_COLLAPSE);
        _self.fire('collapse',{record : record,row : cascadeRow[0]});
      }
      
    },
    //\u83b7\u53d6\u663e\u793a\u7684\u5217\u6570
    _getColumnCount : function(row){
      return $(row).children().filter(function(){
        return $(this).css('display') !== 'none';
      }).length;
    },
    //\u8bbe\u7f6ecolspan
    _setColSpan : function(cascadeRow,gridRow){
      gridRow = gridRow || $(cascadeRow).prev();
      var _self = this,
        colspan = _self._getColumnCount(gridRow);

      $(cascadeRow).find('.' + CLS_CASCADE_CELL).attr('colspan',colspan)
    },
    //\u91cd\u7f6e\u6240\u6709\u7684colspan
    _resetColspan : function(){
      var _self = this,
        cascadeRows =  _self._getAllCascadeRows();
      $.each(cascadeRows,function(index,cascadeRow){
        _self._setColSpan(cascadeRow);
      });
    },
    /**
     * \u6790\u6784\u51fd\u6570
     */
    destructor : function(){
      var _self = this;
      _self.removeAll();
      _self.off();
      _self.clearAttrVals();
    }
  });

  return cascade;
});/**
 * @fileOverview \u9009\u62e9\u7684\u63d2\u4ef6
 * @ignore
 */

define('bui/grid/plugins/selection',['bui/common'],function(require){

  var BUI = require('bui/common'),
    PREFIX = BUI.prefix,
    CLS_CHECKBOX = PREFIX + 'grid-checkBox',
    CLS_CHECK_ICON = 'x-grid-checkbox',
    CLS_RADIO = PREFIX + 'grid-radio';
    
  /**
  * \u9009\u62e9\u884c\u63d2\u4ef6
  * <pre><code>
  ** var store = new Store({
  *       data : data,
  *       autoLoad:true
  *     }),
  *     grid = new Grid.Grid({
  *       render:'#grid',
  *       columns : columns,
  *       itemStatusFields : { //\u8bbe\u7f6e\u6570\u636e\u8ddf\u72b6\u6001\u7684\u5bf9\u5e94\u5173\u7cfb
  *         selected : 'selected',
  *         disabled : 'disabled'
  *       },
  *       store : store,
  *       plugins : [Grid.Plugins.CheckSelection] // \u63d2\u4ef6\u5f62\u5f0f\u5f15\u5165\u591a\u9009\u8868\u683c
  *      //multiSelect: true  // \u63a7\u5236\u8868\u683c\u662f\u5426\u53ef\u4ee5\u591a\u9009\uff0c\u4f46\u662f\u8fd9\u79cd\u65b9\u5f0f\u6ca1\u6709\u524d\u9762\u7684\u590d\u9009\u6846 \u9ed8\u8ba4\u4e3afalse
  *     });
  *
  *   grid.render();
  * </code></pre>
  * @class BUI.Grid.Plugins.CheckSelection
  * @extends BUI.Base
  */
  function checkSelection(config){
    checkSelection.superclass.constructor.call(this, config);
  }

  BUI.extend(checkSelection,BUI.Base);

  checkSelection.ATTRS = 
  /**
   * @lends BUI.Grid.Plugins.CheckSelection.prototype
   * @ignore
   */ 
  {
    /**
    * column's width which contains the checkbox
    */
    width : {
      value : 40
    },
    /**
    * @private
    */
    column : {
      
    },
    /**
    * @private
    * <input  class="' + CLS_CHECKBOX + '" type="checkbox">
    */
    cellInner : {
      value : '<div class="'+CLS_CHECKBOX+'-container"><span class="' + CLS_CHECK_ICON +'"></span></div>'
    }
  };

  BUI.augment(checkSelection, 
  /**
   * @lends BUI.Grid.Plugins.CheckSelection.prototype
   * @ignore
   */ 
  {
    createDom : function(grid){
      var _self = this;
      var cfg = {
            title : '',
            width : _self.get('width'),
            fixed : true,
            resizable:false,
            sortable : false,
            tpl : '<div class="' + PREFIX + 'grid-hd-inner">' + _self.get('cellInner') + '',
            cellTpl : _self.get('cellInner')
        },
        checkColumn = grid.addColumn(cfg,0);
      grid.set('multipleSelect',true);
      _self.set('column',checkColumn);
    },
    /**
    * @private
    */
    bindUI : function(grid){
      var _self = this,
        col = _self.get('column'),
        colEl = col.get('el'),
        checkBox = colEl.find('.' + CLS_CHECK_ICON);
      checkBox.on('click',function(){
        var checked = colEl.hasClass('checked');     
        if(!checked){
          grid.setAllSelection();
          colEl.addClass('checked');
        }else{
          grid.clearSelection();
          colEl.removeClass('checked');
        }
      });
      grid.on('rowunselected',function(e){
        
        colEl.removeClass('checked');
      });
      
      //\u6e05\u9664\u7eaa\u5f55\u65f6\u53d6\u5168\u9009
      grid.on('clear',function(){
        //checkBox.attr('checked',false);
        colEl.removeClass('checked');
      });
    }
  });
  
  /**
   * \u8868\u683c\u5355\u9009\u63d2\u4ef6
   * @class BUI.Grid.Plugins.RadioSelection
   * @extends BUI.Base
   */
  var radioSelection = function(config){
    radioSelection.superclass.constructor.call(this, config);
  };

  BUI.extend(radioSelection,BUI.Base);

  radioSelection.ATTRS = 
  /**
   * @lends BUI.Grid.Plugins.RadioSelection#
   * @ignore
   */ 
  {
    /**
    * column's width which contains the checkbox
    */
    width : {
      value : 40
    },
    /**
    * @private
    */
    column : {
      
    },
    /**
    * @private
    */
    cellInner : {
      value : '<div class="' + PREFIX + 'grid-radio-container"><input  class="' + CLS_RADIO + '" type="radio"></div>'
    }
  };

  BUI.augment(radioSelection, {
    createDom : function(grid){
      var _self = this;
      var cfg = {
            title : '',
            width : _self.get('width'),
            resizable:false,
            fixed : true,
            sortable : false,
            cellTpl : _self.get('cellInner')
        },
        column = grid.addColumn(cfg,0);
      grid.set('multipleSelect',false);
      _self.set('column',column);
    },
    /**
    * @private
    */
    bindUI : function(grid){
      var _self = this;

      grid.on('rowselected',function(e){
        _self._setRowChecked(e.row,true);
      });

      grid.on('rowunselected',function(e){
        _self._setRowChecked(e.row,false);
      });
    },
    _setRowChecked : function(row,checked){
      var rowEl = $(row),
        radio = rowEl.find('.' + CLS_RADIO);
      radio.attr('checked',checked);
    }
  });

  /**
  * @name BUI.Grid.Plugins
  * @namespace \u8868\u683c\u63d2\u4ef6\u547d\u540d\u7a7a\u95f4
  * @ignore
  */
  var Selection  = {
    CheckSelection : checkSelection,
    RadioSelection : radioSelection
  };

  
  return Selection;
});/**
 * @fileOverview \u8868\u683c\u6570\u636e\u6c47\u603b
 * @author dxq613@gmail.com
 * @ignore
 */
define('bui/grid/plugins/summary',['bui/common'],function (require) {

  var BUI = require('bui/common'),
    PREFIX = BUI.prefix,
    CLS_GRID_ROW = PREFIX + 'grid-row',
    CLS_GRID_BODY = PREFIX + 'grid-body',
    CLS_SUMMARY_ROW = PREFIX + 'grid-summary-row',
    CLS_GRID_CELL_INNER = PREFIX + 'grid-cell-inner',
    CLS_COLUMN_PREFIX = 'grid-td-',
    CLS_GRID_CELL_TEXT = PREFIX + 'grid-cell-text',
    CLS_GRID_CELL = PREFIX + 'grid-cell';

  /**
  * @private
  * @ignore
  */
  function getEmptyCellTemplate(colspan){
    if(colspan > 0) {
      return '<td class="' + CLS_GRID_CELL + '" colspan="' + colspan + '">&nbsp;</td>';
    } 
    return '';
  }

  /**
   * @private
   * @ignore
   */
  function getCellTemplate(text,id){
    return '<td class="' + CLS_GRID_CELL + ' '+ CLS_COLUMN_PREFIX + id + '">' +
      getInnerTemplate(text) +
    '</td>';
  }

  /**
   * @private
   * @ignore
   */
  function getInnerTemplate(text){
    return '<div class="' + CLS_GRID_CELL_INNER + '" >' + 
      '<span class="'+CLS_GRID_CELL_TEXT+' ">' + text + '</span>' + 
      '</div>' ;
  }

  /**
   * @private
   * @ignore
   */
  function getLastEmptyCell(){
    return '<td class="' + CLS_GRID_CELL + ' ' + CLS_GRID_CELL + '-empty">&nbsp;</td>';
  }


  /**
   * \u8868\u683c\u83dc\u5355\u63d2\u4ef6 
   * <pre><code>
   * var store = new Store({
   *      url : 'data/summary.json',
   *      pageSize : 10,
   *      autoLoad:true
   *    }),
   *    grid = new Grid.Grid({
   *      render:'#grid',
   *      columns : columns,
   *      store: store,
   *      bbar : {pagingBar : true},
   *      plugins : [Grid.Plugins.Summary] // \u63d2\u4ef6\u5f62\u5f0f\u5f15\u5165\u5355\u9009\u8868\u683c
   *    });
   *
   *  grid.render();
   * </code></pre>
   * @class BUI.Grid.Plugins.Summary
   */
  var summary = function (config) {
    summary.superclass.constructor.call(this,config);
  };

  summary.ATTRS = 
  {

    footerTpl : {
      value : '<tfoot></tfoot>'
    },
    footerEl : {

    },
    /**
     * \u603b\u6c47\u603b\u884c\u7684\u6807\u9898
     * @type {String}
     * @default '\u603b\u6c47\u603b'
     */
    summaryTitle : {
      value : '\u67e5\u8be2\u5408\u8ba1'
    },
    /**
     * \u672c\u9875\u6c47\u603b\u7684\u6807\u9898
     * @type {String}
     */
    pageSummaryTitle : {
      value : '\u672c\u9875\u5408\u8ba1'
    },
    /**
     * \u5728\u5217\u5bf9\u8c61\u4e2d\u914d\u7f6e\u7684\u5b57\u6bb5
     * @type {String}
     * @default 'summary'
     */
    field : {
      value : 'summary'
    },
    /**
     * \u672c\u9875\u6c47\u603b\u503c\u7684\u8bb0\u5f55
     * @type {String}
     */
    pageSummaryField: {
      value : 'pageSummary'
    },
    /**
     * \u603b\u6c47\u603b\u503c\u7684\u8bb0\u5f55
     * @type {String}
     */
    summaryField : {
      value : 'summary'
    },
    /**
     * @private
     * \u672c\u9875\u6c47\u603b\u503c
     * @type {Object}
     */
    pageSummary : {

    },
    /**
     * @private
     * \u603b\u6c47\u603b
     * @type {Object}
     */
    summary : {

    }
  };

  BUI.extend(summary,BUI.Base);

  BUI.augment(summary,{
    //\u521d\u59cb\u5316
    initializer : function (grid) {
      var _self = this;
      _self.set('grid',grid);
    },
    //\u6dfb\u52a0DOM\u7ed3\u6784
    renderUI : function(grid){
      var _self = this,
        bodyEl = grid.get('el').find('.' + CLS_GRID_BODY),
        bodyTable = bodyEl.find('table'),
        footerEl = $(_self.get('footerTpl')).appendTo(bodyTable);
      _self.set('footerEl',footerEl);
    },
    //\u7ed1\u5b9a\u4e8b\u4ef6
    bindUI : function(grid){
      //\u7ed1\u5b9a\u83b7\u53d6\u6570\u636e
      var _self = this,
        store = grid.get('store');
      if(store){
        store.on('beforeProcessLoad',function(data){
          _self._processSummary(data);
        });
        store.on('add',function(){
          _self.resetPageSummary();
        });
        store.on('remove',function(){
          _self.resetPageSummary();
        });
        store.on('update',function(){
          _self.resetPageSummary();
        });
      }
      grid.on('aftershow',function(){
        _self.resetSummary();
      });

      grid.get('header').on('afterVisibleChange',function(){
        _self.resetSummary();
      });
    },
    //\u5904\u7406\u6c47\u603b\u6570\u636e
    _processSummary : function(data){
      var _self = this,
        footerEl = _self.get('footerEl');

      footerEl.empty();
      if(!data){
        return;
      }

      var pageSummary = data[_self.get('pageSummaryField')],
        summary = data[_self.get('summaryField')];

      _self.set('pageSummary',pageSummary);
      _self.set('summary',summary);
    },
    /**
     * \u91cd\u65b0\u8bbe\u7f6e\u672c\u9875\u6c47\u603b
     */
    resetPageSummary : function(){
      var _self = this,
        grid = _self.get('grid'),
        columns = grid.get('columns'),
        pageSummary = _self._calculatePageSummary(),
        pageEl = _self.get('pageEl');
      _self.set('pageSummary',pageSummary);
      if(pageEl){
        BUI.each(columns,function(column){
          if(column.get('summary') && column.get('visible')){
            var id = column.get('id'),
              cellEl = pageEl.find('.' + CLS_COLUMN_PREFIX + id),
              text = _self._getSummaryCellText(column,pageSummary);
            cellEl.find('.' + CLS_GRID_CELL_TEXT).text(text);
          }
        });
        _self._updateFirstRow(pageEl,_self.get('pageSummaryTitle'));
      }
    },
    //\u91cd\u7f6e\u6c47\u603b\u6570\u636e
    resetSummary : function(pageSummary,summary){
      var _self = this,
        footerEl = _self.get('footerEl'),
        pageEl = null;

      footerEl.empty();

      pageSummary = pageSummary || _self.get('pageSummary');
      if(!pageSummary){
        pageSummary = _self._calculatePageSummary();
        _self.set('pageSummary',pageSummary);
      }
      summary = summary || _self.get('summary');
      pageEl = _self._creatSummaryRow(pageSummary,_self.get('pageSummaryTitle'));
      _self.set('pageEl',pageEl);
      _self._creatSummaryRow(summary,_self.get('summaryTitle'));
    },
    //\u521b\u5efa\u6c47\u603b
    _creatSummaryRow : function(summary,title){
      if(!summary){
        return null;
      }
      var _self = this,
        footerEl = _self.get('footerEl'),
        tpl = _self._getSummaryTpl(summary),
        rowEl = $(tpl).appendTo(footerEl);
      
      _self._updateFirstRow(rowEl,title);
      return rowEl;
    },
    _updateFirstRow : function(rowEl,title){
      var firstCell = rowEl.find('td').first(),
          textEl = firstCell.find('.' + CLS_GRID_CELL_INNER);
      if(textEl.length){
        var textPrefix = title + ': ';
          text = textEl.text();
        if(text.indexOf(textPrefix) === -1){
          text = textPrefix + text;
        }
        firstCell.html(getInnerTemplate(text));
      }else{
        firstCell.html(getInnerTemplate(title + ':'));
      }
    },
    //\u83b7\u53d6\u6c47\u603b\u6a21\u677f
    _getSummaryTpl : function(summary){
      var _self = this,
        grid = _self.get('grid'),
        columns = grid.get('columns'),
        cellTempArray = [],
        prePosition = -1, //\u4e0a\u6b21\u6c47\u603b\u5217\u7684\u4f4d\u7f6e
        currentPosition = -1,//\u5f53\u524d\u4f4d\u7f6e
        rowTemplate = null;

      $.each(columns, function (colindex,column) {
        if(column.get('visible')){
          currentPosition += 1;
          if(column.get('summary')){
            cellTempArray.push(getEmptyCellTemplate(currentPosition-prePosition - 1));

            var text = _self._getSummaryCellText(column,summary),
              temp = getCellTemplate(text,column.get('id'));
            cellTempArray.push(temp);
            prePosition = currentPosition;
          }
        }
      });
      if(prePosition !== currentPosition){
        cellTempArray.push(getEmptyCellTemplate(currentPosition-prePosition));
      }

      rowTemplate = ['<tr class="', CLS_SUMMARY_ROW,' ', CLS_GRID_ROW, '">', cellTempArray.join(''),getLastEmptyCell(), '</tr>'].join('');
      return rowTemplate;
    },
    //\u83b7\u53d6\u6c47\u603b\u5355\u5143\u683c\u5185\u5bb9
    _getSummaryCellText : function(column,summary){
      var _self = this,
        val = summary[column.get('dataIndex')],
        value = val == null ? '' : val,
        renderer = column.get('renderer'),
        text = renderer ? renderer(value,summary) : value;
      return text;
    },
    _calculatePageSummary : function(){
      var _self = this,
        grid = _self.get('grid'),
        store = grid.get('store'),
        columns = grid.get('columns'),
        rst = {};

      BUI.each(columns,function(column){
        if(column.get('summary')){
          var dataIndex = column.get('dataIndex');
          rst[dataIndex] = store.sum(dataIndex);
        }
      });
      
      return rst;
    }
  });

  return summary;
});/**
 * @fileOverview \u8868\u683c\u7f16\u8f91\u63d2\u4ef6
 * @ignore
 */

define('bui/grid/plugins/editing',function (require) {

  var CLS_CELL_INNER = BUI.prefix + 'grid-cell-inner',
    CLS_CELL_ERROR = BUI.prefix + 'grid-cell-error';
  /**
   * \u8868\u683c\u7684\u7f16\u8f91\u63d2\u4ef6
   * @class BUI.Grid.Plugins.Editing
   */
  function Editing(config){
    Editing.superclass.constructor.call(this, config);
  }

  BUI.extend(Editing,BUI.Base);

  Editing.ATTRS = {
    /**
     * @protected
     * \u7f16\u8f91\u5668\u7684\u5bf9\u9f50\u8bbe\u7f6e
     * @type {Object}
     */
    align : {
      value : {
        points: ['cl','cl']
      }
    },
    /**
     * \u662f\u5426\u76f4\u63a5\u5728\u8868\u683c\u4e0a\u663e\u793a\u9519\u8bef\u4fe1\u606f
     * @type {Boolean}
     */
    showError : {
      value : true
    },
    errorTpl : {
      value : '<span class="x-icon ' + CLS_CELL_ERROR + ' x-icon-mini x-icon-error" title="{error}">!</span>'
    },
    /**
     * \u662f\u5426\u521d\u59cb\u5316\u8fc7\u7f16\u8f91\u5668
     * @protected
     * @type {Boolean}
     */
    isInitEditors : {
      value : false
    },
    /**
     * \u6b63\u5728\u7f16\u8f91\u7684\u8bb0\u5f55
     * @type {Object}
     */
    record : {

    },
    /**
     * \u5f53\u524d\u7f16\u8f91\u7684\u7f16\u8f91\u5668
     * @type {Object}
     */
    curEditor : {

    },
    /**
     * \u662f\u5426\u53d1\u751f\u8fc7\u9a8c\u8bc1
     * @type {Boolean}
     */
    hasValid : {

    },
    /**
     * \u7f16\u8f91\u5668
     * @protected
     * @type {Object}
     */
    editors : {
      value : []
    },
    /**
     * \u89e6\u53d1\u7f16\u8f91\u6837\u5f0f\uff0c\u4e3a\u7a7a\u65f6\u9ed8\u8ba4\u70b9\u51fb\u6574\u884c\u90fd\u4f1a\u89e6\u53d1\u7f16\u8f91
     * @type {String}
     */
    triggerCls : {

    },
    /**
     * \u8fdb\u884c\u7f16\u8f91\u65f6\u662f\u5426\u89e6\u53d1\u9009\u4e2d
     * @type {Boolean}
     */
    triggerSelected : {
      value : true
    }
  };

  BUI.augment(Editing,{
    /**
     * \u521d\u59cb\u5316
     * @protected
     */
    initializer : function (grid) {
      var _self = this;
      _self.set('grid',grid);
      _self.initEditing(grid);
      //\u5ef6\u8fdf\u52a0\u8f7d editor\u6a21\u5757
      BUI.use('bui/editor',function(Editor){
        _self.initEditors(Editor);
        _self._initGridEvent(grid);
        _self.set('isInitEditors',true);
      });
    },
    /**
     * \u521d\u59cb\u5316\u63d2\u4ef6
     * @protected
     */
    initEditing : function(grid){

    },
    _getCurEditor : function(){
      return this.get('curEditor');
    },
    _initGridEvent : function(grid){
      var _self = this,
        header = grid.get('header');

      grid.on('cellclick',function(ev){

        var editor = null,
          domTarget = ev.domTarget,
          triggerCls = _self.get('triggerCls'),
          curEditor = _self._getCurEditor();
        if(curEditor && curEditor.get('acceptEvent')){
          curEditor.accept();
          curEditor.hide();
        }else{
          curEditor && curEditor.cancel();
        }

        //if(ev.field){
          editor = _self.getEditor(ev.field);
        //}
        if(editor && $(domTarget).closest('.' + triggerCls).length){
          _self.showEditor(editor,ev);
          //if(curEditor && curEditor.get('acceptEvent')){
          if(!_self.get('triggerSelected')){
            return false; //\u6b64\u65f6\u4e0d\u89e6\u53d1\u9009\u4e2d\u4e8b\u4ef6
          }
            
          //}
        }
      });

      grid.on('rowcreated',function(ev){
        validRow(ev.record,ev.row);
      });

      grid.on('rowremoved',function(ev){
        if(_self.get('record') == ev.record){
          _self.cancel();
        }
      });

      grid.on('rowupdated',function(ev){
        validRow(ev.record,ev.row);
      });

      grid.on('scroll',function(ev){
        var editor = _self._getCurEditor();
        if(editor){

          var align = editor.get('align'),
            node = align.node,
            pos = node.position();
          if(pos.top < 0 || pos.top > ev.bodyHeight){
            editor.hide();
          }else{
            editor.set('align',align);
            editor.show();
          }
          
        }
      });

      header.on('afterVisibleChange',function(ev){
        if(ev.target && ev.target != header){
          var column = ev.target;
          _self.onColumnVisibleChange(column);
        }
      });

      function validRow(record,row){
        if(_self.get('hasValid')){
          _self.validRecord(record,_self.getFields(),$(row));
        }
      }

    },
    /**
     * \u521d\u59cb\u5316\u6240\u6709
     * @protected
     */
    initEditors : function(Editor){
      var _self = this,
        grid = _self.get('grid'),
        fields = [],
        columns = grid.get('columns');
      BUI.each(columns,function(column){
        var field = _self.getFieldConfig(column);
        if(field){
          field.name = column.get('dataIndex');
          field.id = column.get('id');
          if(field.validator){
            field.validator = _self.wrapValidator(field.validator);
          }
          fields.push(field);
        }
      });
      var cfgs = _self.getEditorCfgs(fields);
      BUI.each(cfgs,function(cfg){
        _self.initEidtor(cfg,Editor);
      });
    },
    /**
     * @protected
     * \u83b7\u53d6\u5217\u5b9a\u4e49\u4e2d\u7684\u5b57\u6bb5\u5b9a\u4e49\u4fe1\u606f
     * @param  {BUI.Grid.Column} column \u5217\u5b9a\u4e49
     * @return {Object}  \u5b57\u6bb5\u5b9a\u4e49
     */
    getFieldConfig : function(column){
      return column.get('editor');
    },
    /**
     * \u5c01\u88c5\u9a8c\u8bc1\u65b9\u6cd5
     * @protected
     */
    wrapValidator : function(validator){
      var _self = this;
      return function(value){
        var record = _self.get('record');
        return validator(value,record);
      };
    },
    /**
     * @protected
     * \u5217\u663e\u793a\u9690\u85cf\u65f6
     */
    onColumnVisibleChange : function(column){

    },
    /**
     * @protected
     * @template
     * @param  {Array} fields \u5b57\u6bb5\u914d\u7f6e
     * @return {Array} \u7f16\u8f91\u5668\u7684\u914d\u7f6e\u9879
     */
    getEditorCfgs : function(fields){

    },
    /**
     * \u83b7\u53d6\u7f16\u8f91\u5668\u7684\u6784\u9020\u51fd\u6570
     * @param  {Object} Editor \u547d\u540d\u7a7a\u95f4
     * @return {Function}       \u6784\u9020\u51fd\u6570
     */
    getEditorConstructor : function(Editor){
      return Editor.Editor;
    },
    /**
     * \u521d\u59cb\u5316\u7f16\u8f91\u5668
     * @private
     */
    initEidtor : function(cfg,Editor){
      var _self = this,
        con = _self.getEditorConstructor(Editor),
        editor = new con(cfg);
      editor.render();
      _self.get('editors').push(editor);
      _self.bindEidtor(editor);
      return editor;
    },
    /**
     * @protected
     * \u7ed1\u5b9a\u7f16\u8f91\u5668\u4e8b\u4ef6
     * @param  {BUI.Editor.Editor} editor \u7f16\u8f91\u5668
     */
    bindEidtor : function(editor){
      var _self = this,
        grid = _self.get('grid'),
        store = grid.get('store');
      editor.on('accept',function(){
        var record = _self.get('record');
        _self.updateRecord(store,record,editor);
        _self.set('curEditor',null);
      });

      editor.on('cancel',function(){
        _self.set('curEditor',null);
      });
    },
    /**
     * \u83b7\u53d6\u7f16\u8f91\u5668
     * @protected
     * @param  {String} field \u5b57\u6bb5\u503c
     * @return {BUI.Editor.Editor}  \u7f16\u8f91\u5668
     */
    getEditor : function(options){

    },
    /**
     * @protected
     * \u83b7\u53d6\u5bf9\u9f50\u7684\u8282\u70b9
     * @template
     * @param  {Object} options \u70b9\u51fb\u5355\u5143\u683c\u7684\u4e8b\u4ef6\u5bf9\u8c61
     * @return {jQuery} 
     */
    getAlignNode : function(options){

    },
    /**
     * @protected
     * \u83b7\u53d6\u7f16\u8f91\u7684\u503c
     * @param  {Object} options \u70b9\u51fb\u5355\u5143\u683c\u7684\u4e8b\u4ef6\u5bf9\u8c61
     * @return {*}   \u7f16\u8f91\u7684\u503c
     */
    getEditValue : function(options){

    },
    /**
     * \u663e\u793a\u7f16\u8f91\u5668
     * @protected
     * @param  {BUI.Editor.Editor} editor 
     */
    showEditor : function(editor,options){
      var _self = this,
        value = _self.getEditValue(options),
        alignNode = _self.getAlignNode(options);

      _self.beforeShowEditor(editor,options);
      _self.set('record',options.record);
      editor.setValue(value);
      if(alignNode){
        var align = _self.get('align');
        align.node = alignNode;
        editor.set('align',align);
      }

      editor.show();
      _self.focusEditor(editor,options.field);
      _self.set('curEditor',editor);
    },
    /**
     * @protected
     * \u7f16\u8f91\u5668\u5b57\u6bb5\u5b9a\u4f4d
     */
    focusEditor : function(editor,field){
      editor.focus();
    },
    /**
     * \u663e\u793a\u7f16\u8f91\u5668\u524d
     * @protected
     * @template
     * @param  {BUI.Editor.Editor} editor 
     * @param  {Object} options
     */
    beforeShowEditor : function(editor,options){

    },
    //\u521b\u5efa\u7f16\u8f91\u7684\u914d\u7f6e\u9879
    _createEditOptions : function(record,field){
      var _self = this,
        grid = _self.get('grid'),
        rowEl = grid.findRow(record),
        column = grid.findColumnByField(field),
        cellEl = grid.findCell(column.get('id'),rowEl);
      return {
        record : record,
        field : field,
        cell : cellEl[0],
        row : rowEl[0]
      };
    },
    /**
     * \u9a8c\u8bc1\u8868\u683c\u662f\u5426\u901a\u8fc7\u9a8c\u8bc1
     */
    valid : function(){
      var _self = this,
        grid = _self.get('grid'),
        store = grid.get('store');

      if(store){
        var records = store.getResult();
        BUI.each(records,function(record){
          _self.validRecord(record,_self.getFields());
        });
      }
      _self.set('hasValid',true);
    },
    isValid : function(){
      var _self = this,
        grid = _self.get('grid');
      if(!_self.get('hasValid')){
        _self.valid();
      }
      return !grid.get('el').find('.' + CLS_CELL_ERROR).length;
    },
    /**
     * \u6e05\u7406\u9519\u8bef
     */
    clearErrors : function(){
      var _self = this,
        grid = _self.get('grid');
      grid.get('el').find('.' + CLS_CELL_ERROR).remove();
    },
    /**
     * \u83b7\u53d6\u7f16\u8f91\u7684\u5b57\u6bb5
     * @protected
     * @param  {Array} editors \u7f16\u8f91\u5668
     * @return {Array}  \u5b57\u6bb5\u96c6\u5408
     */
    getFields : function(editors){
      
    },
    /**
     * \u6821\u9a8c\u8bb0\u5f55
     * @protected
     * @param  {Object} record \u6821\u9a8c\u7684\u8bb0\u5f55
     * @param  {Array} fields \u5b57\u6bb5\u7684\u96c6\u5408
     */
    validRecord : function(record,fields,row){
      var _self = this,
        errors = [];
      _self.setInternal('record',record);
      fields = fields || _self.getFields();
      BUI.each(fields,function(field){
        var name = field.get('name'),
          value = record[name] || '',
          error = field.getValidError(value);
        if(error){
          errors.push({name : name,error : error,id : field.get('id')});
        }
      });
      _self.showRecordError(record,errors,row);
    },
    showRecordError : function(record,errors,row){
      var _self = this,
        grid = _self.get('grid');
      row = row || grid.findRow(record);
      if(row){
        _self._clearRowError(row);
        BUI.each(errors,function(item){
          var cell = grid.findCell(item.id,row);
          _self._showCellError(cell,item.error);
        });
      }
    },
    /**
     * \u66f4\u65b0\u6570\u636e
     * @protected
     * @param  {Object} record \u7f16\u8f91\u7684\u6570\u636e
     * @param  {*} value  \u7f16\u8f91\u503c
     */
    updateRecord : function(store,record,editor){
     
    },
    _clearRowError : function(row){
      row.find('.' + CLS_CELL_ERROR).remove();
    },
    _showCellError : function(cell,error){
      var _self = this,
        errorTpl = BUI.substitute(_self.get('errorTpl'),{error : error}),
        innerEl = cell.find('.' + CLS_CELL_INNER);
      $(errorTpl).appendTo(innerEl);
    },
    /**
     * \u7f16\u8f91\u8bb0\u5f55
     * @param  {Object} record \u9700\u8981\u7f16\u8f91\u7684\u8bb0\u5f55
     * @param  {String} field \u7f16\u8f91\u7684\u5b57\u6bb5
     */
    edit : function(record,field){
      var _self = this,
        options = _self._createEditOptions(record,field),
        editor = _self.getEditor(field);
      _self.showEditor(editor,options);
    },
    /**
     * \u53d6\u6d88\u7f16\u8f91
     */
    cancel : function(){
      var _self = this,
        editors = _self.get('editors');
      BUI.each(editors,function(editor){
        if(editor.get('visible')){
          editor.cancel();
        }
      });
      _self.set('curEditor',null);
      _self.set('record',null);
    },  
    /**
     * \u6790\u6784\u51fd\u6570
     * @protected
     */
    destructor:function () {
      var _self = this,
        editors = _self.get('editors');
      
      BUI.each(editors,function(editor){
        editor.destroy || editor.destroy();
      });
      _self.off();
      _self.clearAttrVals();
    }

  });

  return Editing;
});/**
 * @fileOverview \u8868\u683c\u5355\u5143\u683c\u7f16\u8f91
 * @ignore
 */

define('bui/grid/plugins/cellediting',['bui/grid/plugins/editing'],function (require) {
  var Editing = require('bui/grid/plugins/editing'),
    CLS_BODY = BUI.prefix + 'grid-body',
    CLS_CELL = BUI.prefix + 'grid-cell';

  /**
   * @class BUI.Grid.Plugins.CellEditing
   * @extends BUI.Grid.Plugins.Editing
   * \u5355\u5143\u683c\u7f16\u8f91\u63d2\u4ef6
   */
  var CellEditing = function(config){
    CellEditing.superclass.constructor.call(this, config);
  };

  CellEditing.ATTRS = {
    /**
     * \u89e6\u53d1\u7f16\u8f91\u6837\u5f0f\uff0c\u4e3a\u7a7a\u65f6\u9ed8\u8ba4\u70b9\u51fb\u6574\u884c\u90fd\u4f1a\u89e6\u53d1\u7f16\u8f91
     * @cfg {String} [triggerCls = 'bui-grid-cell']
     */
    triggerCls : {
      value : CLS_CELL
    }
  };

  BUI.extend(CellEditing,Editing);

  BUI.augment(CellEditing,{
    /**
     * @protected
     * \u83b7\u53d6\u7f16\u8f91\u5668\u7684\u914d\u7f6e\u9879
     * @param  {Array} fields \u5b57\u6bb5\u914d\u7f6e
     */ 
    getEditorCfgs : function(fields){
      var _self = this,
        grid = _self.get('grid'),
        bodyNode = grid.get('el').find('.' + CLS_BODY),
        rst = [];
      BUI.each(fields,function(field){
         rst.push({field : field,changeSourceEvent : null,hideExceptNode : bodyNode,autoUpdate : false,preventHide : false});
      });

      return rst;
    },
    /**
     * \u83b7\u53d6\u7f16\u8f91\u5668
     * @protected
     * @param  {String} field \u5b57\u6bb5\u503c
     * @return {BUI.Editor.Editor}  \u7f16\u8f91\u5668
     */
    getEditor : function(field){
      if(!field){
        return null;
      }
      var  _self = this,
        editors = _self.get('editors'),
        editor = null;

      BUI.each(editors,function(item){
        if(item.get('field').get('name') === field){
          editor = item;
          return false;
        }
      });
      return editor;
    },
    /**
     * \u663e\u793a\u7f16\u8f91\u5668\u524d
     * @protected
     * @param  {BUI.Editor.Editor} editor 
     * @param  {Object} options
     */
    beforeShowEditor : function(editor,options){
      var _self = this,
        cell = $(options.cell);
      _self.resetWidth(editor,cell.outerWidth());
    },
    resetWidth : function(editor,width){
      editor.set('width',width);
    },
    /**
     * \u66f4\u65b0\u6570\u636e
     * @protected
     * @param  {Object} record \u7f16\u8f91\u7684\u6570\u636e
     * @param  {*} value  \u7f16\u8f91\u503c
     */
    updateRecord : function(store,record,editor){
      var _self = this,
          value = editor.getValue(),
          fieldName = editor.get('field').get('name'),
          preValue = record[fieldName];
        value = BUI.isDate(value) ? value.getTime() : value;
        if(preValue !== value){
          store.setValue(record,fieldName,value);
        }
    },
    /**
     * @protected
     * \u83b7\u53d6\u5bf9\u9f50\u7684\u8282\u70b9
     * @override
     * @param  {Object} options \u70b9\u51fb\u5355\u5143\u683c\u7684\u4e8b\u4ef6\u5bf9\u8c61
     * @return {jQuery} 
     */
    getAlignNode : function(options){
      return $(options.cell);
    },
    /**
     * \u83b7\u53d6\u7f16\u8f91\u7684\u5b57\u6bb5
     * @protected
     * @return {Array}  \u5b57\u6bb5\u96c6\u5408
     */
    getFields : function(){
      var rst = [],
        _self = this,
        editors = _self.get('editors');
      BUI.each(editors,function(editor){
        rst.push(editor.get('field'));
      });
      return rst;
    },
    /**
     * @protected
     * \u83b7\u53d6\u8981\u7f16\u8f91\u7684\u503c
     * @param  {Object} options \u70b9\u51fb\u5355\u5143\u683c\u7684\u4e8b\u4ef6\u5bf9\u8c61
     * @return {*}   \u7f16\u8f91\u7684\u503c
     */
    getEditValue : function(options){
      if(options.record && options.field){
        var value = options.record[options.field];
        return value == null ? '' : value;
      }
      return '';
    }
  });

  return CellEditing;
});/**
 * @fileOverview \u8868\u683c\u884c\u7f16\u8f91
 * @ignore
 */

define('bui/grid/plugins/rowediting',['bui/common','bui/grid/plugins/editing'],function (require) {
   var BUI = require('bui/common'),
    Editing = require('bui/grid/plugins/editing'),
    CLS_ROW = BUI.prefix + 'grid-row';

  /**
   * @class BUI.Grid.Plugins.RowEditing
   * @extends BUI.Grid.Plugins.Editing
   * \u5355\u5143\u683c\u7f16\u8f91\u63d2\u4ef6
   */
  var RowEditing = function(config){
    RowEditing.superclass.constructor.call(this, config);
  };

  RowEditing.ATTRS = {
     /**
     * @protected
     * \u7f16\u8f91\u5668\u7684\u5bf9\u9f50\u8bbe\u7f6e
     * @type {Object}
     */
    align : {
      value : {
        points: ['tl','tl'],
        offset : [-2,0]
      }
    },
    /**
     * \u89e6\u53d1\u7f16\u8f91\u6837\u5f0f\uff0c\u4e3a\u7a7a\u65f6\u9ed8\u8ba4\u70b9\u51fb\u6574\u884c\u90fd\u4f1a\u89e6\u53d1\u7f16\u8f91
     * @cfg {String} [triggerCls = 'bui-grid-row']
     */
    triggerCls : {
      value : CLS_ROW
    }
  };

  BUI.extend(RowEditing,Editing);

  BUI.augment(RowEditing,{

    /**
     * @protected
     * \u83b7\u53d6\u7f16\u8f91\u5668\u7684\u914d\u7f6e\u9879
     * @param  {Array} fields \u5b57\u6bb5\u914d\u7f6e
     */ 
    getEditorCfgs : function(fields){
      var rst = [];
      rst.push({
        changeSourceEvent : null,
        autoUpdate : false,
        form : {
          children : fields,
          buttonBar : {
            elCls : 'centered toolbar'
          }
        }
      });
      return rst;
    },
    /**
     * \u5c01\u88c5\u9a8c\u8bc1\u65b9\u6cd5
     * @protected
     */
    wrapValidator : function(validator){
      var _self = this;
      return function(value){
        var editor = _self.get('curEditor'),
          record = editor ? editor.getValue() : _self.get('record');
        if(record){
          return validator(value,record);
        }
      };
    },
    /**
     * @protected
     * \u7f16\u8f91\u5668\u5b57\u6bb5\u5b9a\u4f4d
     */
    focusEditor : function(editor,field){
      var form = editor.get('form'),
        control = form.getField(field);
      if(control){
        control.focus();
      }
    },
    /**
     * @protected
     * \u83b7\u53d6\u5217\u5b9a\u4e49\u4e2d\u7684\u5b57\u6bb5\u5b9a\u4e49\u4fe1\u606f
     * @param  {BUI.Grid.Column} column \u5217\u5b9a\u4e49
     * @return {Object}  \u5b57\u6bb5\u5b9a\u4e49
     */
    getFieldConfig : function(column){
      var editor = column.get('editor');
      if(editor){
        return editor;
      }
      var cfg = {xtype : 'plain'};
      if(column.get('dataIndex') && column.get('renderer')){
        cfg.renderer = column.get('renderer');
        //cfg.id = column.get('id');
      }
      return cfg;
    },
    /**
     * \u66f4\u65b0\u6570\u636e
     * @protected
     * @param  {Object} record \u7f16\u8f91\u7684\u6570\u636e
     * @param  {*} value  \u7f16\u8f91\u503c
     */
    updateRecord : function(store,record,editor){
      var _self = this,
          value = editor.getValue();
        BUI.each(value,function(v,k){
          if(BUI.isDate(v)){
            value[k] = v.getTime();
          }
        });
        BUI.mix(record,value);
        
        store.update(record);
    },
     /**
     * \u83b7\u53d6\u7f16\u8f91\u6b64\u5355\u5143\u683c\u7684\u7f16\u8f91\u5668
     * @protected
     * @param  {String} field \u70b9\u51fb\u5355\u5143\u683c\u7684\u5b57\u6bb5
     * @return {BUI.Editor.Editor}  \u7f16\u8f91\u5668
     */
    getEditor : function(field){
      var _self = this,
        editors = _self.get('editors');
      return editors[0];
    },
    /**
     * @override
     * \u5217\u53d1\u751f\u6539\u53d8
     */
    onColumnVisibleChange : function(column){
      var _self = this,
        id = column.get('id'),
        editor = _self.getEditor(),
        field = editor.getChild(id,true);
      if(field){
        field.set('visible',column.get('visible'));
      }
    },
    /**
     * \u663e\u793a\u7f16\u8f91\u5668\u524d
     * @protected
     * @template
     * @param  {BUI.Editor.Editor} editor 
     * @param  {Object} options
     */
    beforeShowEditor : function(editor,options){
      var _self = this,
        grid = _self.get('grid'),
        columns = grid.get('columns'),
        form = editor.get('form'),
        row = $(options.row);
      editor.set('width',row.width());
      BUI.each(columns,function(column){
        if(!column.get('visible')){
          field.set('visible',false);
        }else{
          var fieldName = column.get('dataIndex'),
            field = form.getField(fieldName),
            width = column.get('el').outerWidth() - field.getAppendWidth();
          field.set('width',width);
        }
      });
    },
    /**
     * @protected
     * \u83b7\u53d6\u8981\u7f16\u8f91\u7684\u503c
     * @param  {Object} options \u70b9\u51fb\u5355\u5143\u683c\u7684\u4e8b\u4ef6\u5bf9\u8c61
     * @return {*}   \u7f16\u8f91\u7684\u503c
     */
    getEditValue : function(options){
      return options.record;
    },
    /**
     * \u83b7\u53d6\u7f16\u8f91\u5668\u7684\u6784\u9020\u51fd\u6570
     * @param  {Object} Editor \u547d\u540d\u7a7a\u95f4
     * @return {Function}       \u6784\u9020\u51fd\u6570
     */
    getEditorConstructor : function(Editor){
      return Editor.RecordEditor;
    },
     /**
     * @protected
     * \u83b7\u53d6\u5bf9\u9f50\u7684\u8282\u70b9
     * @override
     * @param  {Object} options \u70b9\u51fb\u5355\u5143\u683c\u7684\u4e8b\u4ef6\u5bf9\u8c61
     * @return {jQuery} 
     */
    getAlignNode : function(options){
      return $(options.row);
    },
    /**
     * \u83b7\u53d6\u7f16\u8f91\u7684\u5b57\u6bb5
     * @protected
     * @return {Array}  \u5b57\u6bb5\u96c6\u5408
     */
    getFields : function(){
      var _self = this,
        editors = _self.get('editors');
      return editors[0].get('form').get('children');
    }
  });
  return RowEditing;
});/**
 * @fileOverview \u8868\u683c\u8ddf\u8868\u5355\u8054\u7528
 * @ignore
 */

define('bui/grid/plugins/dialogediting',['bui/common'],function (require) {
  var BUI = require('bui/common'),
    TYPE_ADD = 'add',
    TYPE_EDIT = 'edit';

  /**
   * \u8868\u683c\u7684\u7f16\u8f91\u63d2\u4ef6
   * @class BUI.Grid.Plugins.DialogEditing
   */
  function Dialog(config){
     Dialog.superclass.constructor.call(this, config);
  }

  Dialog.ATTRS = {
    /**
     * \u7f16\u8f91\u7684\u8bb0\u5f55
     * @type {Object}
     * @readOnly
     */
    record : {

    },
    /**
     * @private
     * \u7f16\u8f91\u8bb0\u5f55\u7684index
     * @type {Object}
     */
    curIndex : {

    },
    /**
     * Dialog\u7684\u5185\u5bb9\uff0c\u5185\u90e8\u5305\u542b\u8868\u5355(form)
     * @cfg {String} contentId
     */
    /**
     * Dialog\u7684\u5185\u5bb9\uff0c\u5185\u90e8\u5305\u542b\u8868\u5355(form)
     * @type {String}
     */
    contentId:{

    },
    /**
     * \u7f16\u8f91\u5668
     * @type {BUI.Editor.DialogEditor}
     * @readOnly
     */
    editor : {

    },
    /**
     * Dialog\u4e2d\u7684\u8868\u5355
     * @type {BUI.Form.Form}
     * @readOnly
     */
    form : {

    },
    events : {
      value : {
        /**
         * @event
         * \u7f16\u8f91\u7684\u8bb0\u5f55\u53d1\u751f\u66f4\u6539
         * @param {Object} e \u4e8b\u4ef6\u5bf9\u8c61
         * @param {Object} e.record \u8bb0\u5f55
         * @param {Object} e.editType \u7f16\u8f91\u7684\u7c7b\u578b add \u6216\u8005 edit
         */
        recordchange : false
      }
    },
    editType : {

    }
  };

  BUI.extend(Dialog,BUI.Base);

  BUI.augment(Dialog,{
    /**
     * \u521d\u59cb\u5316
     * @protected
     */
    initializer : function (grid) {
      var _self = this;
      _self.set('grid',grid);
      //\u5ef6\u8fdf\u52a0\u8f7d editor\u6a21\u5757
      BUI.use('bui/editor',function(Editor){
        _self._initEditor(Editor);
      });
    },
    bindUI : function(grid){
      var _self = this,
        triggerCls = _self.get('triggerCls');
      if(triggerCls){
        grid.on('cellclick',function(ev){
          var sender = $(ev.domTarget),
            editor = _self.get('editor');
          if(sender.hasClass(triggerCls) && editor){

            _self.edit(ev.record);
            if(grid.get('multipleSelect')){
              return false;
            }
          }
        });
      }
    },
    //\u521d\u59cb\u5316\u7f16\u8f91\u5668
    _initEditor : function(Editor){
      var _self = this,
        contentId = _self.get('contentId'),
        formNode = $('#' + contentId).find('form'),
        editor = _self.get('editor'),
        cfg = BUI.merge(editor,{
            contentId : contentId,
            form : {
              srcNode : formNode
            }
        });

      editor = new Editor.DialogEditor(cfg);
      _self._bindEditor(editor);
      _self.set('editor',editor);
      _self.set('form',editor.get('form'));
    },
    //\u7ed1\u5b9a\u7f16\u8f91\u5668\u4e8b\u4ef6
    _bindEditor : function(editor){
      var _self = this;
      editor.on('accept',function(){
        var form = editor.get('form'),
          record = form.serializeToObject();
        _self.saveRecord(record);
      });
    },
    /**
     * \u7f16\u8f91\u8bb0\u5f55
     * @param  {Object} record \u8bb0\u5f55
     */
    edit : function(record){
      var _self = this;
      _self.set('editType',TYPE_EDIT);
      _self.showEditor(record);
    },
    /**
     * \u6dfb\u52a0\u8bb0\u5f55
     * @param  {Object} record \u8bb0\u5f55
     * @param {Number} [index] \u6dfb\u52a0\u5230\u7684\u4f4d\u7f6e\uff0c\u9ed8\u8ba4\u6dfb\u52a0\u5728\u6700\u540e
     */
    add : function(record,index){
      var _self = this;
      _self.set('editType',TYPE_ADD);
      _self.set('curIndex',index);
      _self.showEditor(record);
    },
    /**
     * @private
     * \u4fdd\u5b58\u8bb0\u5f55
     */
    saveRecord : function(record){
      var _self = this,
        grid = _self.get('grid'),
        editType = _self.get('editType'),
        curIndex = _self.get('curIndex'),
        store = grid.get('store'),
        curRecord = _self.get('record');

      BUI.mix(curRecord,record);

      if(editType == TYPE_ADD){
        if(curIndex != null){
          store.addAt(curRecord,curIndex);
        }else{
          store.add(curRecord);
        }
      }else{
        store.update(curRecord);
      }
    },
    /**
     * @private
     * \u663e\u793a\u7f16\u8f91\u5668
     */
    showEditor : function(record){
      var _self = this,
        editor = _self.get('editor');

      editor.show();
      editor.setValue(record);
      _self.set('record',record);
      _self.fire('recordchange',{record : record,editType : _self.get('editType')});
    },
    /**
     * \u53d6\u6d88\u7f16\u8f91
     */
    cancel : function(){
      var _self = this,
        editor = _self.get('editor');
      editor.cancel();
    },
    destructor : function(){
      var _self = this,
        editor = _self.get('editor');
      editor && editor.destroy();
      _self.off();
      _self.clearAttrVals();
    }

  });

  return Dialog;
});BUI.use(['bui/common','bui/data','bui/list','bui/picker',
  'bui/menu','bui/toolbar','bui/progressbar','bui/cookie',
  'bui/form','bui/mask','bui/select','bui/tab',
  'bui/calendar','bui/overlay','bui/grid'
]);
