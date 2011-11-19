var http = require('http'),
    OAuth = require('oauth').OAuth,
    url = require('url');

/* From /node/lib/utils.js */
function timestamp() {
  function pad(n) {
    return n < 10 ? '0' + n.toString(10) : n.toString(10);
  }
  var d = new Date(),
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

function debug(self, str) {
  if (self && str) {
    str = [timestamp(), str.toString()].join(' - ');
    self.log.push(str);
    if (self.debug) console.log(str);
  }
}

// first argument can be string or object
function tumblr(hostname, key, secret) {
  if (!(this instanceof tumblr)) return new tumblr(hostname, key, secret);

  var obj = (typeof hostname !== 'object') ? {
    hostname : hostname,
    secret : secret,
    key : key
  } : hostname;

  // reference
  if (obj && obj.hostname) this.hostname = !/\./.test(obj.hostname) ? obj.hostname + '.tumblr.com' : obj.hostname;
  this.key = obj.key;
  this.secret = obj.secret;

  // output the log to console
  this.debug = false;

  // keeping the logs even if debug is false
  this.log = [];

  // caching?
  this.caches = false;
  this._cache = {};

  /*
  if (this.key && this.secret) {
    var oa = new OAuth('http://www.tumblr.com/oauth/request_token',
                       'http://www.tumblr.com/oauth/access_token',
                       obj.key, obj.secret, '1.0A',
                       'http://www.tumblr.com/', 'HMAC-SHA1');
  }
  */
}

tumblr.fn = tumblr.prototype;

tumblr.fn._request = function(obj, fn) {
  var cache = this._cache;
  if (!cache[obj.path]) cache[obj.path] = {};
  var cached = cache[obj.path];

  if (this.caches && cached._data) {
    if (fn) fn(cached._data);
    return this;
  }

  // consumer key is required
  if (/^\/(posts|info)/.test(obj.path)) {
    obj.query = obj.query || {};
    obj.query.api_key = this.key;
  }

  var settings = {
    host : "api.tumblr.com",
    method : obj.method,
    path : "/v2/",
    port : 80
  },
  query = url.format({ query : obj.query });

  settings.path += (obj.type === "blog") ? "blog/" + this.hostname : "user";
  settings.path += obj.path;
  settings.path += (obj.method === 'GET') ? query : '';

  if (!/posts|info|avatar/.test(obj.path)) {
    // console.log('oauth');
  }

  var self = this,
      body = "";
  cached._req = req = http.request(settings, function (res) {
    cached._res = res;
    res.on('data', function (data) {
      body += data;
    }).on('end', function() {
      debug(self, ['HTTP', res.httpVersion, settings.method, res.statusCode, settings.path].join(' '));
      cached._data = JSON.parse(body);
      if (fn) fn(cached._data);
    });
  });

  if (obj.method === "POST") req.write(query.replace("?", ""));

  req.on('error', function (er) {
    debug(er);
  });

  req.end();

  return this;
};

tumblr.fn._get = function(obj, fn) {
  obj.method = 'GET';
  return this._request(obj, fn);
};

tumblr.fn._post = function(obj, fn) {
  obj.method = 'POST';
  return this._request(obj, fn);
};

// api
tumblr.fn.avatar = function(size, fn) {
  size = size || 64;
  if (typeof size === 'function') {
    fn = size;
    size = 64;
  }

  return this._get({
    type : 'blog',
    path : '/avatar',
    query : {
      size : size
    }
  }, fn);
};

tumblr.fn.info = function(fn) {
  return this._get({
    type : 'blog',
    path : '/info'
  }, fn);
};

tumblr.fn.posts = function(obj, fn) {
  fn = typeof obj === 'function' ? obj : fn;
  obj = obj || {};

  return this._get({
    type : 'blog',
    path : '/posts',
    query : {
      type : obj.type || null,
      id : obj.id || null,
      tag : obj.tag || null,
      limit : obj.limit || 20,
      offset : obj.offset || 0,
      reblog_info : obj.reblog_info || false,
      notes_info : obj.notes_info || false,
      format : obj.format || null
    }
  }, fn);
};

module.exports = tumblr;
