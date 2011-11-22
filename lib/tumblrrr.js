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

  // if response should omit "meta"
  this.onlyResponse = true;

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

tumblr.version = '1.0.0';

tumblr.fn = tumblr.prototype;

tumblr.fn.setOAuthVerifier = function(verifier, fn) {
  var self = this;
  this._oa.getOAuthAccessToken(this._oa.session.key, this._oa.session.secret, verifier, function(er, key, secret, res) {
    if (!er) {
      self.access_key = key;
      self.access_secret = secret;
      if (fn) fn(key, secret);
    }
    else {
      debug(er);
    }
  });
  return this;
};

tumblr.fn._request = function(obj, fn) {
  var cache = this._cache,
      log_key = [obj.type, obj.path].join('/');

  if (!cache[log_key]) cache[log_key] = {};
  var cached = cache[log_key];

  if (this.caches && cached._data) {
    if (fn) fn(cached._data);
    return this;
  }

  // consumer key is required
  if (obj.method == 'GET' && /^\/(posts|info)$/.test(obj.path)) {
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

  if (!/^\/(user\/posts|blog\/(info|avatar))$/.test(settings.path)) {
    if (this.key && this.secret && this._oauth_access) {
      settings.pathname = settings.path;
      settings.protocol = 'http';
      var method = obj.method.toLowerCase();
      cached._req = req = this._oa[method](url.format(settings), this.access_key, this.access_secret, method === 'post' ? obj.query : null).on('response', onRes);
    }
    else {
      debug('Missing or invalid information');
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
      var json = JSON.parse(body);
      cached._data = json;
      if (self.onlyResponse) json = json.response;
      if (fn) fn(json);
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

tumblr.fn.info = function(type, fn) {
  if (typeof type === 'string') {
    if (type !== 'user') type = 'blog';
  }
  else {
    fn = type;
    type = 'blog';
  }
  return this[type + '_info'](fn);
};

tumblr.fn.blog_info = function(fn) {
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

['posts', 'followers', 'following'].forEach(function(method) {
  tumblr.fn[method] = function(obj, fn) {
    if (typeof obj === 'function') {
      fn = obj;
      obj = {};
    }

    return this._get({
      type : 'blog',
      path : '/' + method,
      query : obj
    }, fn);
  };
});

['follow', 'unfollow'].forEach(function(f) {
  tumblr.fn[f] = function(url, fn) {
    if (typeof url !== 'object') url = { url : url };

    return this._post({
      type : 'blog',
      path : '/' + f,
      query : url
    }, fn);
  };
});

tumblr.fn.reblog = function(obj, fn) {
  if (typeof obj === 'function') {
    fn = obj;
    obj = {};
  }

  return this._post({
    type : 'blog',
    path : '/post/reblog',
    query : obj
  }, fn);
};

['like', 'unlike'].forEach(function(l) {
  tumblr.fn[l] = function(obj, fn) {
    if (typeof obj === 'function') {
      fn = obj;
      obj = {};
    }

    return this._post({
      type : 'user',
      path : '/' + l,
      query : obj
    }, fn);
  };
});

tumblr.fn.likes = function(obj, fn) {
  if (typeof obj === 'function') {
    fn = obj;
    obj = {};
  }

  return this._get({
    type : 'user',
    path : '/likes',
    query : obj
  }, fn);
};

['queue', 'draft', 'submission'].forEach(function(method) {
  tumblr.fn[method] = function(fn) {
    return this._get({
      type : 'blog',
      path : ['/posts', method].join('/')
    }, fn);
  };
});

tumblr.fn['delete'] = function(id, fn) {
  return this._post({
    type : 'blog',
    path : '/post/delete',
    query : {
      id : id
    }
  }, fn);
};

['post', 'edit'].forEach(function(method) {
  tumblr.fn[method] = function(obj, fn) {
    return this._post({
      type : 'blog',
      path : '/post' + (method === 'edit' ? '/edit' : ''),
      query : obj
    }, fn);
  };
});

tumblr.fn.dashboard = function(obj, fn) {
  if (typeof obj === 'function') {
    fn = obj;
    obj = {};
  }

  return this._post({
    type : 'user',
    path : '/dashboard',
    query : obj
  }, fn);
};

module.exports = tumblr;
