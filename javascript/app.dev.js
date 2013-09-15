/*

Copyright (C) 2011 by Yehuda Katz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/

// lib/handlebars/browser-prefix.js
var Handlebars = {};

(function(Handlebars, undefined) {
;
// lib/handlebars/base.js

Handlebars.VERSION = "1.0.0";
Handlebars.COMPILER_REVISION = 4;

Handlebars.REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '>= 1.0.0'
};

Handlebars.helpers  = {};
Handlebars.partials = {};

var toString = Object.prototype.toString,
    functionType = '[object Function]',
    objectType = '[object Object]';

Handlebars.registerHelper = function(name, fn, inverse) {
  if (toString.call(name) === objectType) {
    if (inverse || fn) { throw new Handlebars.Exception('Arg not supported with multiple helpers'); }
    Handlebars.Utils.extend(this.helpers, name);
  } else {
    if (inverse) { fn.not = inverse; }
    this.helpers[name] = fn;
  }
};

Handlebars.registerPartial = function(name, str) {
  if (toString.call(name) === objectType) {
    Handlebars.Utils.extend(this.partials,  name);
  } else {
    this.partials[name] = str;
  }
};

Handlebars.registerHelper('helperMissing', function(arg) {
  if(arguments.length === 2) {
    return undefined;
  } else {
    throw new Error("Missing helper: '" + arg + "'");
  }
});

Handlebars.registerHelper('blockHelperMissing', function(context, options) {
  var inverse = options.inverse || function() {}, fn = options.fn;

  var type = toString.call(context);

  if(type === functionType) { context = context.call(this); }

  if(context === true) {
    return fn(this);
  } else if(context === false || context == null) {
    return inverse(this);
  } else if(type === "[object Array]") {
    if(context.length > 0) {
      return Handlebars.helpers.each(context, options);
    } else {
      return inverse(this);
    }
  } else {
    return fn(context);
  }
});

Handlebars.K = function() {};

Handlebars.createFrame = Object.create || function(object) {
  Handlebars.K.prototype = object;
  var obj = new Handlebars.K();
  Handlebars.K.prototype = null;
  return obj;
};

Handlebars.logger = {
  DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, level: 3,

  methodMap: {0: 'debug', 1: 'info', 2: 'warn', 3: 'error'},

  // can be overridden in the host environment
  log: function(level, obj) {
    if (Handlebars.logger.level <= level) {
      var method = Handlebars.logger.methodMap[level];
      if (typeof console !== 'undefined' && console[method]) {
        console[method].call(console, obj);
      }
    }
  }
};

Handlebars.log = function(level, obj) { Handlebars.logger.log(level, obj); };

Handlebars.registerHelper('each', function(context, options) {
  var fn = options.fn, inverse = options.inverse;
  var i = 0, ret = "", data;

  var type = toString.call(context);
  if(type === functionType) { context = context.call(this); }

  if (options.data) {
    data = Handlebars.createFrame(options.data);
  }

  if(context && typeof context === 'object') {
    if(context instanceof Array){
      for(var j = context.length; i<j; i++) {
        if (data) { data.index = i; }
        ret = ret + fn(context[i], { data: data });
      }
    } else {
      for(var key in context) {
        if(context.hasOwnProperty(key)) {
          if(data) { data.key = key; }
          ret = ret + fn(context[key], {data: data});
          i++;
        }
      }
    }
  }

  if(i === 0){
    ret = inverse(this);
  }

  return ret;
});

Handlebars.registerHelper('if', function(conditional, options) {
  var type = toString.call(conditional);
  if(type === functionType) { conditional = conditional.call(this); }

  if(!conditional || Handlebars.Utils.isEmpty(conditional)) {
    return options.inverse(this);
  } else {
    return options.fn(this);
  }
});

Handlebars.registerHelper('unless', function(conditional, options) {
  return Handlebars.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn});
});

Handlebars.registerHelper('with', function(context, options) {
  var type = toString.call(context);
  if(type === functionType) { context = context.call(this); }

  if (!Handlebars.Utils.isEmpty(context)) return options.fn(context);
});

Handlebars.registerHelper('log', function(context, options) {
  var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
  Handlebars.log(level, context);
});
;
// lib/handlebars/utils.js

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

Handlebars.Exception = function(message) {
  var tmp = Error.prototype.constructor.apply(this, arguments);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }
};
Handlebars.Exception.prototype = new Error();

// Build out our basic SafeString type
Handlebars.SafeString = function(string) {
  this.string = string;
};
Handlebars.SafeString.prototype.toString = function() {
  return this.string.toString();
};

var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

var badChars = /[&<>"'`]/g;
var possible = /[&<>"'`]/;

var escapeChar = function(chr) {
  return escape[chr] || "&amp;";
};

Handlebars.Utils = {
  extend: function(obj, value) {
    for(var key in value) {
      if(value.hasOwnProperty(key)) {
        obj[key] = value[key];
      }
    }
  },

  escapeExpression: function(string) {
    // don't escape SafeStrings, since they're already safe
    if (string instanceof Handlebars.SafeString) {
      return string.toString();
    } else if (string == null || string === false) {
      return "";
    }

    // Force a string conversion as this will be done by the append regardless and
    // the regex test will do this transparently behind the scenes, causing issues if
    // an object's to string has escaped characters in it.
    string = string.toString();

    if(!possible.test(string)) { return string; }
    return string.replace(badChars, escapeChar);
  },

  isEmpty: function(value) {
    if (!value && value !== 0) {
      return true;
    } else if(toString.call(value) === "[object Array]" && value.length === 0) {
      return true;
    } else {
      return false;
    }
  }
};
;
// lib/handlebars/runtime.js

Handlebars.VM = {
  template: function(templateSpec) {
    // Just add water
    var container = {
      escapeExpression: Handlebars.Utils.escapeExpression,
      invokePartial: Handlebars.VM.invokePartial,
      programs: [],
      program: function(i, fn, data) {
        var programWrapper = this.programs[i];
        if(data) {
          programWrapper = Handlebars.VM.program(i, fn, data);
        } else if (!programWrapper) {
          programWrapper = this.programs[i] = Handlebars.VM.program(i, fn);
        }
        return programWrapper;
      },
      merge: function(param, common) {
        var ret = param || common;

        if (param && common) {
          ret = {};
          Handlebars.Utils.extend(ret, common);
          Handlebars.Utils.extend(ret, param);
        }
        return ret;
      },
      programWithDepth: Handlebars.VM.programWithDepth,
      noop: Handlebars.VM.noop,
      compilerInfo: null
    };

    return function(context, options) {
      options = options || {};
      var result = templateSpec.call(container, Handlebars, context, options.helpers, options.partials, options.data);

      var compilerInfo = container.compilerInfo || [],
          compilerRevision = compilerInfo[0] || 1,
          currentRevision = Handlebars.COMPILER_REVISION;

      if (compilerRevision !== currentRevision) {
        if (compilerRevision < currentRevision) {
          var runtimeVersions = Handlebars.REVISION_CHANGES[currentRevision],
              compilerVersions = Handlebars.REVISION_CHANGES[compilerRevision];
          throw "Template was precompiled with an older version of Handlebars than the current runtime. "+
                "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").";
        } else {
          // Use the embedded version info since the runtime doesn't know about this revision yet
          throw "Template was precompiled with a newer version of Handlebars than the current runtime. "+
                "Please update your runtime to a newer version ("+compilerInfo[1]+").";
        }
      }

      return result;
    };
  },

  programWithDepth: function(i, fn, data /*, $depth */) {
    var args = Array.prototype.slice.call(arguments, 3);

    var program = function(context, options) {
      options = options || {};

      return fn.apply(this, [context, options.data || data].concat(args));
    };
    program.program = i;
    program.depth = args.length;
    return program;
  },
  program: function(i, fn, data) {
    var program = function(context, options) {
      options = options || {};

      return fn(context, options.data || data);
    };
    program.program = i;
    program.depth = 0;
    return program;
  },
  noop: function() { return ""; },
  invokePartial: function(partial, name, context, helpers, partials, data) {
    var options = { helpers: helpers, partials: partials, data: data };

    if(partial === undefined) {
      throw new Handlebars.Exception("The partial " + name + " could not be found");
    } else if(partial instanceof Function) {
      return partial(context, options);
    } else if (!Handlebars.compile) {
      throw new Handlebars.Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
    } else {
      partials[name] = Handlebars.compile(partial, {data: data !== undefined});
      return partials[name](context, options);
    }
  }
};

Handlebars.template = Handlebars.VM.template;
;
// lib/handlebars/browser-suffix.js
})(Handlebars);
;

this["JST"] = this["JST"] || {};

this["JST"]["templates/feed.hbs"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var stack1, options, functionType="function", escapeExpression=this.escapeExpression, self=this, blockHelperMissing=helpers.blockHelperMissing;

function program1(depth0,data,depth1) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n	<section>\n	<h2 class=\"ui header\">\n		<i class=\"docs icon\"></i>\n		<div class=\"content\">\n			";
  if (stack1 = helpers.title) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.title; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\n			<div class=\"sub header\">";
  if (stack1 = helpers.description) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.description; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</div>\n		</div>\n	</h2>\n	<a class=\"superfeeds action\" data-action=\"deleteFeed\" data-p1=\""
    + escapeExpression(((stack1 = ((stack1 = depth1.opts),stack1 == null || stack1 === false ? stack1 : stack1.url)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\">Delete Feed</a>\n	<div class=\"ui divider\"></div>\n	";
  options = {hash:{},inverse:self.noop,fn:self.program(2, program2, data),data:data};
  if (stack2 = helpers.entries) { stack2 = stack2.call(depth0, options); }
  else { stack2 = depth0.entries; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  if (!helpers.entries) { stack2 = blockHelperMissing.call(depth0, stack2, options); }
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n	";
  options = {hash:{},inverse:self.program(7, program7, data),fn:self.noop,data:data};
  if (stack2 = helpers.entries) { stack2 = stack2.call(depth0, options); }
  else { stack2 = depth0.entries; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  if (!helpers.entries) { stack2 = blockHelperMissing.call(depth0, stack2, options); }
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n	</section>\n";
  return buffer;
  }
function program2(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n		<article>\n			<h3><a href=\"";
  if (stack1 = helpers.link) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.link; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\">";
  if (stack1 = helpers.title) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.title; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</a></h3>\n			<p class=\"time\">";
  if (stack1 = helpers.publishedDate) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.publishedDate; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</p>\n			<div class=\"body\">\n			";
  stack1 = helpers['if'].call(depth0, depth0.content, {hash:{},inverse:self.program(5, program5, data),fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n			</div>\n		</article>\n		<div class=\"ui divider\"></div>\n	";
  return buffer;
  }
function program3(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n				";
  if (stack1 = helpers.content) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.content; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n			";
  return buffer;
  }

function program5(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n				";
  if (stack1 = helpers.description) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.description; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n			";
  return buffer;
  }

function program7(depth0,data) {
  
  
  return "\n		<i class=\"massive cancel icon\"></i>\n		<p>There are no items for this feed.</p>\n	";
  }

  options = {hash:{},inverse:self.noop,fn:self.programWithDepth(1, program1, data, depth0),data:data};
  if (stack1 = helpers.feed) { stack1 = stack1.call(depth0, options); }
  else { stack1 = depth0.feed; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  if (!helpers.feed) { stack1 = blockHelperMissing.call(depth0, stack1, options); }
  if(stack1 || stack1 === 0) { return stack1; }
  else { return ''; }
  });

this["JST"]["templates/sidebar.hbs"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, functionType="function", escapeExpression=this.escapeExpression, self=this, blockHelperMissing=helpers.blockHelperMissing;

function program1(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n<li>\n	<a class=\"superfeeds action\" data-action=\"loadFeed\" data-p1=\"";
  if (stack1 = helpers.feedurl) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.feedurl; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\">";
  if (stack1 = helpers.title) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.title; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</a>\n</li>\n";
  return buffer;
  }

  buffer += "<ul>\n";
  options = {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data};
  if (stack1 = helpers.feeds) { stack1 = stack1.call(depth0, options); }
  else { stack1 = depth0.feeds; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  if (!helpers.feeds) { stack1 = blockHelperMissing.call(depth0, stack1, options); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n</ul>";
  return buffer;
  });
(function(){
	var exports = {};
	exports.allowedElements = ("strong em b i p code pre tt samp kbd var sub q sup dfn cite big small address hr " +
	                           "br div span h1 h2 h3 h4 h5 h6 ul ol li dl dt dd abbr acronym a img blockquote del " +
	                           "ins table caption tbody tfoot thead tr th td article aside canvas details figcaption " +
	                           "figure footer header hgroup menu nav section summary time mark").split(" ");
	exports.allowedProperties = ("azimuth background-color border-bottom-color border-collapse border-color " +
	                             "border-left-color border-right-color border-top-color clear color cursor direction " +
	                             "display elevation float font font-family font-size font-style font-variant font-weight " +
	                             "height letter-spacing line-height overflow pause pause-after pause-before pitch " +
	                             "pitch-range richness speak speak-header speak-numeral speak-punctuation speech-rate " +
	                             "stress text-align text-decoration text-indent unicode-bidi vertical-align voice-family " +
	                             "volume white-space width").split(" ");
	exports.allowedKeywords = ("auto aqua black block blue bold both bottom brown center collapse dashed dotted " +
	                           "fuchsia gray green !important italic left lime maroon medium none navy normal nowrap " +
	                           "olive pointer purple red right solid silver teal top transparent underline white yellow").split(" ");
	exports.shorthandProperties = ("background border margin padding").split(" ");
	exports.allowedAttributes = ("href src width height alt cite datetime title class name xml:lang abbr style").split(" ");
	exports.uriAttributes = ("href src cite action longdesc xlink:href lowsrc").split(" ");
	exports.allowedProtocols = ("ed2k ftp http https irc mailto news gopher nntp telnet webcal xmpp callto feed svn " +
	                            "urn aim rsync tag ssh sftp rtsp afs tel smsto mmsto").split(" ");

	function mapArray (arr) {var res = {};
	    for (var i = 0, n = arr.length; i < n; i++) res[arr[i]] = true;
	    return res;
	}

	// rules based on
	// https://github.com/rails/rails/blob/master/actionpack/lib/action_controller/vendor/html-scanner/html/sanitizer.rb
	exports.sanitiseHTML = function (html, options) {
	    if (html == null || !html.length) return "";
	    var options = options || {}
	    ,   allowedElements = mapArray(options.allowedElements || exports.allowedElements)
	    ,   allowedAttributes = mapArray(options.allowedAttributes || exports.allowedAttributes)
	    ,   uriAttributes = mapArray(options.uriAttributes || exports.uriAttributes)
	    ,   allowedProtocols = mapArray(options.allowedProtocols || exports.allowedProtocols)
	    ;
	    // strip comments
	    html = html.replace(/<!--(?:[\s\S]*?)-->[\n]?/g, "");
	    // parse without processing anything
	    var doc = $.parseHTML(html);
	    if(doc.length){
	    	doc = doc[0];
	    }

	    // process elements
	    var els = doc.getElementsByTagName("*");
	    
	    for (var i = 0, n = els.length; i < n; i++) {
	        var el = els[i];
	        // remove elements that aren't on the whitelist
	        if (!allowedElements[el.tagName.toLowerCase()]) {
	            el.parentNode.removeChild(el);
	            continue;
	        }
	        
	        // remove attributes that aren't on the whitelist
	        for (var j = 0, m = el.attributes.length; j < m; j++) {
	            var att = el.attributes[j];
	            if(typeof att == 'undefined'){
	            	continue;
	            }
	            var an = att.nodeName.toLowerCase();
	            if (!allowedAttributes[an]) el.removeAttribute(att.nodeName);
	            // only allowed protocols
	            if (uriAttributes[an]) {
	                if (/(^[^\/:]*):|(&#0*58)|(&#x70)|(%|&#37;)3A/.test(att.nodeValue) &&
	                    !allowedProtocols[att.nodeValue.split(/:|(&#0*58)|(&#x70)|(%|&#37;)3A/)[0].toLowerCase()]) {
	                        el.removeAttribute(att.nodeName);
	                }
	            }
	        }
	        
	        // handle style
	        if (el.hasAttribute("style")) el.setAttribute("style", exports.sanitiseCSS(el.getAttribute("style"), options));
	    }
	    return doc.innerHTML;
	};

	exports.sanitiseCSS = function (css, options) {
	    var options = options || {}
	    ,   allowedProperties = mapArray(options.allowedProperties || exports.allowedProperties)
	    ,   allowedKeywords = mapArray(options.allowedKeywords || exports.allowedKeywords)
	    ,   shorthandProperties = mapArray(options.shorthandProperties || exports.shorthandProperties)
	    ;
	    
	    // kill URIs
	    css = css.replace(/url\s*\(\s*[^\s)]+?\s*\)\s*/gi, "");
	    
	    // gauntlet
	    if (!/^([:,;#%.\sa-zA-Z0-9!]|\w-\w|\'[\s\w]+\'|\"[\s\w]+\"|\([\d,\s]+\))*$/.test(css) ||
	        !/^(\s*[-\w]+\s*:\s*[^:;]*(;|$)\s*)*$/.test(css)) return "";
	    
	    var clean = "";
	    css.replace(/([-\w]+)\s*:\s*([^:;]*)/g, function (str, prop, val) {
	        if (allowedProperties[prop.toLowerCase()]) clean += prop + ": " + val + "; ";
	        else if (shorthandProperties[prop.split("-")[0].toLowerCase()]) {
	            var keywords = val.trim().split(" ");
	            for (var i = 0, n = keywords.length; i < n; i++) {
	                var kw = keywords[i];
	                if (!allowedKeywords[kw.toLowerCase()] && 
	                    !/^(#[0-9a-f]+|rgb\(\d+%?,\d*%?,?\d*%?\)?|\d{0,2}\.?\d{0,2}(cm|em|ex|in|mm|pc|pt|px|%|,|\))?)$/.test(kw)) {
	                        continue;
	                }
	                clean += prop + ": " + val + "; ";
	            }
	        }
	    });
	    return clean;
	};

	exports.sanitiseHTMLFragmment = function(fragment){
		return exports.sanitiseHTML('<div>'+fragment+'</div>');
	}

	window.sanitiseHTML = exports.sanitiseHTML;
	window.sanitiseHTMLFragmment = exports.sanitiseHTMLFragmment;
	window.sanitiseCSS = exports.sanitiseCSS;
})(jQuery);
function JAtom(xml) {
    this._parse(xml);
};

JAtom.prototype = {

    _parse: function(xml) {
        this.type = 'atom';
        if(typeof xml == 'string'){
            xml = jQuery.parseXML(xml);
        }

        var channel = jQuery('feed', xml).eq(0);

        this.version = '1.0';
		this.type += '10';
        this.title = jQuery(channel).find('title:first').text();
        this.link = jQuery(channel).find('link:first').attr('href');
        this.description = jQuery(channel).find('subtitle:first').text();
        this.language = jQuery(channel).attr('xml:lang');
        this.updated = jQuery(channel).find('updated:first').text();

        this.entries = new Array();

        var feed = this;

        jQuery('entry', xml).each( function() {

            var item = new JFeedItem();

            var t = jQuery(this);

            item.title = t.find('title').eq(0).text();

            /*
             * RFC 4287 - 4.2.7.2: take first encountered 'link' node
             *                     to be of the 'alternate' type.
             */
            t.find('link').each(function() {
               var rel = $(this).attr('rel');
               if ((rel == 'alternate') || !rel) {
                  item.link = $(this).attr('href');
                  return false;
               }
               return true;
            });

            item.description = t.find('content').eq(0).text();
            item.publishedDate = t.find('updated').eq(0).text();
            item.id = t.find('id').eq(0).text();
            item.author = t.find('author name').eq(0).text();

            var point = t.find('georss\\:point').eq(0).text();
            if (!point) point = t.find('point').eq(0).text();
            if (point.length > 0) {
              point = point.split(" ");
              item.coordinates = [point[1], point[0]];
            }

            feed.entries.push(item);
        });
    }
};


/* jFeed : jQuery feed parser plugin
 * Copyright (C) 2007 Jean-François Hovinne - http://www.hovinne.com/
 * Dual licensed under the MIT (MIT-license.txt)
 * and GPL (GPL-license.txt) licenses.
 */

jQuery.getFeed = function(options) {

    options = jQuery.extend({

        url: null,
        data: null,
        cache: true,
        success: null,
        failure: null,
        error: null,
        global: true

    }, options);

    if (options.url) {

        if (jQuery.isFunction(options.failure) && jQuery.type(options.error)==='null') {
          // Handle legacy failure option
          options.error = function(xhr, msg, e){
            options.failure(msg, e);
          }
        } else if (jQuery.type(options.failure) === jQuery.type(options.error) === 'null') {
          // Default error behavior if failure & error both unspecified
          options.error = function(xhr, msg, e){
            window.console&&console.log('getFeed failed to load feed', xhr, msg, e);
          }
        }

        return jQuery.ajax({
            type: 'GET',
            url: options.url,
            data: options.data,
            cache: options.cache,
            dataType: (document.all) ? "text" : "xml",
            success: function(xml) {
                var feed = new JFeed(xml);
                feed.feedUrl = options.url;
                if (jQuery.isFunction(options.success)) options.success(feed);
            },
            error: options.error,
            global: options.global
        });
    }
};

function JFeed(xml) {
    if (xml) this.parse(xml);
}
;

JFeed.prototype = {

    feedUrl: '',
    title: '',
    link: '',
    author: '',
    description: '',
    type: '',
    entries: [],
    version: '',
    language: '',
    updated: '',
    parse: function(xml) {

        if (window.ActiveXObject) {
            var xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.loadXML(xml);
            xml = xmlDoc;
        } else {
            xml = $.parseXML(xml);
        }

        if (jQuery('channel', xml).length == 1) {

            var feedClass = new JRss(xml);

        } else if (jQuery('feed', xml).length == 1) {

            var feedClass = new JAtom(xml);
        }

        if (feedClass) jQuery.extend(this, feedClass);
    }
};


function JFeedItem() {};

JFeedItem.prototype = {

    title: '',
    link: '',
    author: '',
    publishedDate: '',
    description: '',
    content: '',
    categories: [],
    id: '',
	coordinates: ''
};


function JRss(xml) {
    this._parse(xml);
};

JRss.prototype  = {

    _parse: function(xml) {
        this.type = 'rss';
        if(typeof xml == 'string'){
            xml = jQuery.parseXML(xml);
        }

        if(jQuery('rss', xml).length == 0) {
            this.version = '1.0';
            this.type += '10';
        } else {
            this.version = jQuery('rss', xml).eq(0).attr('version');
            this.type += this.version.toString().split('.').join('');
        }

        var channel = jQuery('channel', xml).eq(0);

        this.title = jQuery(channel).find('title:first').text();
        this.link = jQuery(channel).find('link:first').text();
        this.description = jQuery(channel).find('description:first').text();
        this.language = jQuery(channel).find('language:first').text();
        this.updated = jQuery(channel).find('lastBuildDate:first').text();

        this.entries = new Array();

        var feed = this;

        jQuery('item', xml).each( function() {

            var item = new JFeedItem();

            var t = jQuery(this);

            item.title = t.find('title').eq(0).text();
            item.link = t.find('link').eq(0).text();
            item.description = t.find('description').eq(0).text();

            item.content = t.find('content\\:encoded').eq(0).text();
            if (!item.content) item.content = t.find('encoded').eq(0).text();
            item.author = t.find('dc\\:creator').eq(0).text();
            if (!item.author) item.author = t.find('creator').eq(0).text();

            item.publishedDate = t.find('pubDate').eq(0).text();
            item.id = t.find('guid').eq(0).text();
            item.enclosure = t.find('enclosure').attr('url');

            var point = t.find('georss\\:point').eq(0).text();
            if (!point) point = t.find('point').eq(0).text();
            if (point.length > 0) {
              point = point.split(" ");
              item.coordinates = [point[1], point[0]];
            }

            feed.entries.push(item);
        });
    }
};


"use strict";
var SprFeed = function(opts){
	this.opts = $.extend(this.opts,opts);

	this.db = new SprDb({
		name : 'SprFeed'+opts.url,
		schema : {
			feed : false
		}
	});
}

SprFeed.prototype = {
	opts : {
		useProxy : true,
		proxyUrl : 'http://assets.kyd.com.au/jsonproxy/?uri={url}'
	},
	getRemoteUrl : function(url,callback){
		var ajaxOpts = {};
		if(this.opts.useProxy){
			ajaxOpts.url = this.opts.proxyUrl.replace('{url}',url);
			ajaxOpts.dataType = 'jsonp';
		} else {
			ajaxOpts.url = url;
		}

		ajaxOpts.success = function(data){
			callback(data);
		}

		ajaxOpts.error = function(){
			callback(false);
		}

		$.ajax(ajaxOpts);
	},
	load : function(callback){
		var _this = this;
		if(_this.db.data.feed && _this.opts.onLoad){
			_this.feed = _this.db.data.feed;
			_this.opts.onLoad(_this);
		}
		this.getRemoteUrl(this.opts.url,function(data){
			_this.feed = new JFeed(data);

			for(var i=0;i<_this.feed.entries.length;i++){
				_this.feed.entries[i].description = sanitiseHTMLFragmment(_this.feed.entries[i].description);
			}
			_this.db.data.feed = _this.feed;
			_this.db.save();

			_this.opts.onLoad && _this.opts.onLoad(_this);
		})
	},
	getOverview : function(){
		return {
			title : this.feed.title,
			link : this.feed.link,
			feedurl : this.opts.url
		}
	}
};

var SprDb = function(opts){
	this.opts = opts;
	this.open();
}
SprDb.prototype = {
	open : function(){
		var data = localStorage[this.opts.name];
		try{
			this.data = JSON.parse(data);
		}catch(e){
			this.data = $.extend({},this.opts.schema);
		}
	},
	save : function(){
		localStorage[this.opts.name] = JSON.stringify(this.data);
		this.opts.onPostSave && this.opts.onPostSave(this);
	}

}

var SprFeeds = function(){
	this.db = new SprDb({
		name : 'SprFeeds',
		schema : {
			feeds : []
		},
		onPostSave : function(db){
			$('.sidebar').empty().append(JST["templates/sidebar.hbs"](db.data));
		}
	});
	this.db.opts.onPostSave(this.db);
}

SprFeeds.prototype = {
	_getFeedByUrl : function(url){
		for(var i=0; i < this.db.data.feeds.length; i++){
			if(this.db.data.feeds[i].feedurl == url){
				return i;
			}
		}
		return false;
	},
	createFeed : function(url,callback){
		var _this = this;
		var newFeed = new SprFeed({
			url : url
		});
		newFeed.load(function(){
			_this.db.data.feeds.push(newFeed.getOverview());
			_this.db.save();
			callback(newFeed);
		})
	},
	loadFeed : function(url){
		var feed = this._getFeedByUrl(url);
		if(feed === false) return;
		var thisFeed = new SprFeed({
			url : this.db.data.feeds[feed].feedurl,
			onLoad : function(){
				$('.feed.content').empty().append(JST["templates/feed.hbs"](thisFeed));
			},
			onUpdate : function(){

			}
		});
		thisFeed.load();
	},
	deleteFeed : function(url){
		var feed = this._getFeedByUrl(url);
		if(!feed === false) return;
		this.db.data.feeds.splice(feed,1);
		this.db.save();
	}
}

window.onload = function(){
	window.onresize();

	var feeds = new SprFeeds();

	$('.showmodal').click(function(){
		var target = $(this).data('modal');
		$(target).modal('show');
		return true;
	});

	$('#addfeed .primary').click(function(){
		var url = $(this).closest('.ui.modal').find('input[type="text"]').val();
		var feed = feeds.createFeed(url,function(){
			feeds.loadFeed(url);
		});
		
	});

	$(document).on('click','.superfeeds.action',function(){
		var action = $(this).data('action');
		var p1 = $(this).data('p1');
		feeds[action](p1);
		return false;
	});
}

window.onresize = function(){
	$('body').height(window.innerHeight+'px');
}