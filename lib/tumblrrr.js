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
function tumblr(hostname, key, secret, access_key, access_secret) {
  if (!(this instanceof tumblr)) return new tumblr(hostname, key, secret, access_key, access_secret);

  var obj = (typeof hostname !== 'object') ? {
    hostname : hostname,
    secret : secret,
    key : key,
    access_secret : access_secret,
    access_key : access_key
  } : hostname;

  // reference
  if (obj && obj.hostname) this.hostname = !/\./.test(obj.hostname) ? obj.hostname + '.tumblr.com' : obj.hostname;
  this.key = obj.key;
  this.secret = obj.secret;
  this.access_key = obj.access_key;
  this.access_secret = obj.access_secret;

  // output the log to console
  this.debug = false;

  // keeping the logs even if debug is false
  this.log = [];

  // caching requests
  this.caches = false;
  this._cache = {};

  // oauth access
  this._oauth_access = this.access_key && this.access_secret;

  if (this.key && this.secret && this._oauth_access) {
    this._oa = oa = new OAuth('http://www.tumblr.com/oauth/request_token',
                              'http://www.tumblr.com/oauth/access_token',
                              this.key, this.secret, '1.0A',
                              null, 'HMAC-SHA1');

    var self = this;
    oa.getOAuthRequestToken(function(err, req_key, req_secret, res) {
      if (!err) {
        var url = ['http://www.tumblr.com/oauth/authorize/?oauth_token=', req_key].join('');
        self.OAuthAuthorizationURL = url;
        self._oa.session = self._oa.session || {};
        self._oa.session.key = req_key;
        self._oa.session.secret = req_secret;
      }
      else {
        debug(err);
      }
    });
  }
  return this;
}

tumblr.fn = tumblr.prototype;

tumblr.fn.setOAuthVerifier = function(verifier, fn) {
  var self = this;
  this._oa.getOAuthAccessToken(this._oa.session.key, this._oa.session.secret, verifier, function(er, key, secret, res) {
    if (!er) {
      self.access_key = key;
      self.access_secret = secret;
    }
    else {
      debug(er);
    }
  });
  return this;
};

tumblr.fn._request = function(obj, fn) {
  var cache = this._cache, log_key = obj.type + '/' + obj.path;
  if (!cache[log_key]) cache[log_key] = {};
  var cached = cache[log_key];

  if (this.caches && cached._data) {
    if (fn) fn(cached._data);
    return this;
  }

  // consumer key is required
  if (obj.method == 'GET' && /^\/(posts|info)/.test(obj.path)) {
    obj.query = obj.query || {};
    obj.query.api_key = this.key;
  }

  // cleaning the query
  for (var i in obj.query) {
    if (typeof obj.query[i] !== 'number' && !obj.query[i]) delete obj.query[i];
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

  var self = this,
      body = "";

  if (!/^\/(user\/posts|blog\/(info|avatar))/.test(settings.path)) {
    if (this.key && this.secret && this._oauth_access) {
      settings.pathname = settings.path;
      settings.protocol = 'http';
      var method = obj.method.toLowerCase();
      cached._req = req = this._oa[method](url.format(settings), this.access_key, this.access_secret, method === 'post' ? obj.query : null).on('response', onRes);
    }
    else {
      debug('Missing or invalid information')
    }
  }
  else {
    cached._req = req = http.request(settings, onRes);
  }

  function onRes(res) {
    cached._res = res;
    res.on('data', function (data) {
      body += data;
    }).on('end', function() {
      debug(self, ['HTTP', res.httpVersion, settings.method, res.statusCode, settings.path].join(' '));
      cached._data = JSON.parse(body);
      if (fn) fn(cached._data);
    });
  }

  req.on('error', debug).end();

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

tumblr.fn.user_info = function(fn) {
  return this._post({
    type : 'user',
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
      reblog_info : obj.reblog_info || null,
      notes_info : obj.notes_info || null,
      format : obj.format || null
    }
  }, fn);
};

tumblr.fn.followers = function(obj, fn) {
  fn = typeof obj === 'function' ? obj : fn;
  obj = obj || {};

  return this._get({
    type : 'blog',
    path : '/followers',
    query : {
      limit : obj.limit || 20,
      offset : obj.offset || 0
    }
  }, fn);
};

tumblr.fn.following = function(obj, fn) {
  fn = typeof obj === 'function' ? obj : fn;
  obj = obj || {};

  return this._get({
    type : 'blog',
    path : '/following',
    query : {
      limit : obj.limit || 20,
      offset : obj.offset || 0
    }
  }, fn);
};

['follow', 'unfollow'].forEach(function(f) {
  tumblr.fn[f] = function(url, fn) {
    if (typeof url !== 'object') url = {url:url};

    return this._post({
      type : 'blog',
      path : '/' + f,
      query : url
    }, fn);
  };
});

tumblr.fn.reblog = function(obj, fn) {
  fn = typeof obj === 'function' ? obj : fn;
  obj = obj || {};

  return this._post({
    type : 'blog',
    path : '/post/reblog',
    query : obj
  }, fn);
};

['like', 'unlike'].forEach(function(l) {
  tumblr.fn[l] = function(obj, fn) {
    fn = typeof obj === 'function' ? obj : fn;
    obj = obj || {};

    return this._post({
      type : 'user',
      path : '/' + l,
      query : obj
    }, fn);
  };
});

tumblr.fn.likes = function(obj, fn) {
  fn = typeof obj === 'function' ? obj : fn;
  obj = obj || {};

  return this._get({
    type : 'user',
    path : '/likes',
    query : obj 
  }, fn);
};

tumblr.fn['delete'] = function(id, fn) {
  if (typeof id !== 'object') id = {id:id};

  return this._post({
    type : 'blog',
    path : '/post/delete',
    query : id
  }, fn);
};

module.exports = tumblr;
