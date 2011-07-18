var http = require('http'),
Oauth = require('oauth').Oauth,
events = require('events'),
log = require('util').log,
url = require('url');

function debug (str) {
  if (str) {
    tumblr.log.push(str);
    if (tumblr.debug) {
      log(str);
    }
  }
}

// first arg can be an object
function tumblr (hostname, key, secret) {
  if (typeof hostname !== 'object') {
    var obj = {
      hostname : hostname,
      secret : secret,
      key : key
    };
  }

  // reference
  tumblr.key = key;
  tumblr.secret = secret;

  // keeping the logs even if debug is false
  tumblr.log = [];

  // output the log to console
  tumblr.debug = false;

  if (obj && obj.hostname) {
    obj.hostname = !/\./.test(obj.hostname) ? obj.hostname + '.tumblr.com' : obj.hostname;
    tumblr.hostname = obj.hostname;
  }

  if (obj && obj.key && obj.secret) {
    var oa = new Oauth('http://www.tumblr.com/oauth/request_token',
                          'http://www.tumblr.com/oauth/access_token',
                          obj.key, obj.secret, '1.0A',
                          null, 'HMAC-SHA1');
  }

  return api;
}

var req = {
  evented : function (request, fn) {
    var event = new events.EventEmitter();
    request.on('end', function(res) {
      event.emit('end', res);
      if (fn) {
        fn(res);
      }
    });
    return event;
  },
  base : function (obj, fn) {
    var options = {
      host : "api.tumblr.com",
      method : obj.method,
      path : "/v2/",
      port : 80
    },
    query = url.format({ query : obj.query });

    options.path += (obj.type === "blog") ? "blog/" + tumblr.hostname : "user";
    options.path += obj.path;
    options.path += (obj.method === 'GET') ? query : '';

    // authorization filter 
    if (/^\/(posts|info)/.test(obj.path)) { // key is required
      //console.log('api key');
    }
    else if (/avatar/.test(obj.path)) { // authentication not required
      //console.log('none');
    }
    else { // oauth!
      //console.log('oauth');
    }

    var body = "",
    event = new events.EventEmitter(),
    req = http.request(options, function (res) {
      res.setEncoding('utf8');
      res.on('data', function (data) {
        body += data;
      });
      res.on('end', function() {
        debug('HTTP ' + res.httpVersion + ' ' + options.method + ' ' + res.statusCode + ' ' + options.path);
        event.emit('end', body);
        if (fn) {
          fn(body);
        }
      });
    });

    if (obj.method === "POST") {
      req.write(query.replace("?", ""));
    }

    req.on('error', function (er) {
      debug(er);
    });
    
    req.end();

    return event;
  },
  post : function(obj, fn) {
    obj.method = "POST";
    var request = req.base(obj, fn);
    return req.evented(request, fn);
  },
  get : function(obj, fn) {
    obj.method = "GET";
    var request = req.base(obj, fn);
    return req.evented(request, fn);
  }
};

// api
var api = {
  avatar : function (size, fn) {
    size = !size ? 64 : size;
    if (typeof size === 'function') {
      fn = size;
      size = 64;
    }
    var request = req.get({
      type : 'blog',
      path : '/avatar',
      query : {
        size : size
      }
    });
    return req.evented(request, fn);
  },
  info : function (fn) {
    var request = req.get({
      type : 'blog',
      path : '/info',
      query : {
        api_key : tumblr.key
      }
    });
    return req.evented(request, fn);
  }
};

module.exports = tumblr;
