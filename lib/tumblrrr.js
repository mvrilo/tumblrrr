var http = require('http'),
	qs = require('querystring').stringify;

Tumb = function(user, email, pwd) {
	if (!user.match(/\.tumblr\.com$/i)) {
		user = user + '.tumblr.com';
	}

	function Debug(logd) {
		if (Tumblr.debug) console.log(logd);
	}

	function Request(type, host, path, query, fn) {
		var client = http.createClient(80, host),
			header = {}, resp = {},
			uri = path, body = '';


		header['User-Agent'] = 'NodeJS Tumblr Client';
		header['Host'] = host;

		if (type === 'POST') { header['Content-Type'] = 'application/x-www-form-urlencoded'; }
		else { uri = path + '?' + qs(query); }

		request = client.request(type, uri, header);

		// if it can't connect
		client.on('error', function(e){
			Debug('tumblr> ERROR trying to connect. Try again later.');
			return false;
		});

		if (type === 'POST') { request.write(qs(query)); }
		
		request.end();

		request.on('response', function(res){
			res.setEncoding('utf8');
			if (res.statusCode === 200 || res.statusCode === 201) {
				resp = res;
				body = '';
				res.on('data', function(data){
					body += data;
				});
				res.on('end', function() {
					body = body.replace('var tumblr_api_read = ', '').replace('};','}').replace(/\n/g,'');
					fn(body);
				});
			}
			else if (res.statusCode === 403 || res.statusCode === 400 || res.statusCode === 503) {
				Debug('tumblr> ERROR, HTTP ' + res.statusCode);
				return false;
			}
		});
	}

	this.main = {
		read : function(optMain, opt, fn) {
			var readMethods = {
				account : function(fn) { // OK
					Request('GET', user, '/api/read/json', {filter:'text'}, function(data) {
						var body = JSON.parse(data)['tumblelog'];
						Debug('tumblr> GET /api/read/json | account');
						if (fn) fn(body);
					});
				},
				dashboard : function(opt, fn) { // OK
					if (!email || !pwd) {
						Debug('tumblr> ERROR, missing email and/or password');
						return false;
					}

					if (!fn && typeof opt === 'function') { fn = opt; }
					else { opt = opt || {}; }
	
					if (opt.likes === true) { opt.likes = 1; }

					var thequery = {email:email, password:pwd, filter:opt.filter||'text', num:opt.num||20, start:opt.start||0, likes:opt.likes||1};

					// optional queries
					if (opt.type) { thequery.type = opt.type; }
		
					Request('POST', 'www.tumblr.com', '/api/dashboard/json', thequery, function(data) {
						var body = JSON.parse(data)['posts'];
						Debug('tumblr> GET /api/dashboard/json | posts');
						if (fn) fn(body);
					});
				},
				posts : function(opt, fn) { // OK
					if (!fn && typeof opt === 'function') fn = opt;
					else { opt = opt || {}; }

					var thequery = {filter:opt.filter||'text', num:opt.num||20};

					// optional queries
					var type = 'POST';
					if (!email || !pwd) { type = 'GET'; }
					else {
						thequery.email = opt.email;
						thequery.password = opt.pwd;
						if (opt.state) { thequery.state = opt.state; }
					}
					if (opt.tagged) {
						thequery.tagged = opt.tagged;
						if (opt.chrono) { thequery.chrono = opt.chrono||0; }
					}
					if (opt.id) { thequery.id = opt.id; }
					if (opt.search) {thequery.search = opt.search; }
					else { 
						thequery.num = opt.num||20;
						thequery.start = opt.start||0;
						if (opt.type) { thequery.type = opt.type; }
					}

					Request(type, user, '/api/read/json', thequery, function(data) {
						var body = JSON.parse(data)['posts']; 
						Debug('tumblr> POST /api/read/json | posts');
						if (fn) fn(body);
					});
				}
			};

			// if not specified what to 'read' return readMethod.posts() or readMethod.dashboard() if email and password are set
			if (typeof optMain === 'function' || typeof optMain === 'object' && typeof opt === 'function') {
				if (!email || !pwd ) {
					readMethods.posts.apply(this, arguments);
				}
				else {
					readMethods.dashboard.apply(this, arguments);
				}
			}

			// reading methods via arguments[0]
			if (typeof optMain === 'string') {
				if (optMain in readMethods) {
					return readMethods[optMain].apply(this, arguments);
				}
			}

		},
		delete : function(id, fn) { // OK
			if (/[0-9]*/.test(id)) { return false; }
			else {
				Request('POST', 'www.tumblr.com', '/api/delete', {email:email, password:pwd, 'post-id':id}, function() {
					Debug('tumblr> POST ' + id + ' deleted');
					if (fn) fn();
				});
			}
		},
/*		edit : function(opt, fn) { 
			TODO
		},
*/		like : function(id, key, fn, api) { // OK
			var thequery = {email:email, password:pwd};
			if (typeof id === 'object') {
				fn = key;
				api = fn;
				thequery['post-id'] = id['id'];
				thequery['reblog-key'] = id['key'];
			}
			else {
				thequery['post-id'] = id;
				thequery['reblog-key'] = key;
			}

			var what = 'liked';

			if (api === '/api/like' || !api) { api = '/api/like'; }
			else if (api === '/api/unlike') { 
				api = '/api/unlike'; 
				what = 'unliked';
			}

			Request('POST', 'www.tumblr.com', api, thequery, function(){
				Debug('tumblr> POST ' + what);
				if (fn) fn();
			});
		},
		unlike : function(id, key, fn, api) { // OK
			return this.like(id, key, fn, '/api/unlike');
		},
		reblog : function(id, key, fn) { // OK
			var thequery = {email:email, password:pwd};
			if (typeof id === 'object') {
				fn = key;
				api = fn;
				thequery['post-id'] = id['id'];
				thequery['reblog-key'] = id['key'];
				if (id.comment) { thequery.comment = id['comment']; }
				if (id.as) { thequery.as = id['as']; }
			}
			else {
				thequery['post-id'] = id;
				thequery['reblog-key'] = key;
			}

			Request('POST', 'www.tumblr.com', '/api/reblog', thequery, function(){
				Debug('tumblr> POST ' + thequery['post-id'] + 'reblogged');
				if (fn) fn();
			});
		}
/*		write : function(opt, fn) { 
			TODO
		}
*/	};

	// expose main methods
	for (i in this.main) { this[i] = this.main[i]; }
	delete this.main;
};

exports.Tumblr = Tumblr = function(user, email, pwd){
	return new Tumb(user, email, pwd);
};

// debugging on console (experimental)
Tumblr.debug = true;
