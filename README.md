# Tumblrrr

A Node.JS wrapper for [Tumblr's API].

v0.1.1

Demo
---------
	var tumblr = require('tumblrrr').Tumblr,
		staff = tumblr('staff');

	staff.read('account', function(data){
		console.log('Title: ' + data['Title']);
	});

Usage
---------

    var tumblr = require('tumblrrr').Tumblr,
        you = tumblr('you');

For POST-like methods you must pass email and password, otherwise it will return false.
If the email or the password are incorrects it will return HTTP 403 (not authorized).

	var tumblr = require('tumblrrr).Tumblr,
		you = tumblr('you', 'you@email.com', 'password');

**_Methods:_**

_read_

`you.read([ read_api ], [ query ], callback(data));`

If `read_api` isn't set it will return data from _/api/dashboard/json_ only if email and password are set, if they are not it return data from _/api/read/json_.

- *read_api*
    - `account`
    - `posts`
    - `dashboard`

- *query*
    - see [parameters]

_delete_

`you.delete(id, callback);`

_reblog_

`you.reblog([ id, key ], callback);`

`you.reblog([ obj ], callback);`

- _obj_
    - { id : number, key : 'string' [ , comment : 'string', as : 'string' ] }

_like_

`you.like([ id, key ], callback);`

`you.like([ obj ], callback);`

- _obj_
    - { id : number, key : 'string' }

_unlike_

`you.unlike([ id, key ], callback);`

`you.unlike([ obj ], callback);`

- _obj_
    - { id : number, key : 'string' }

_write_

`soon`

_edit_

`soon`

**_Debugging:_**

`tumblr.debug = true`

Info
-----

- Under maintenance, Tumblr will return HTTP 503.
- When sending queries, `id` is an alias for `post-id` just like `key` is for `reblog-key`.
- Issues
    - Data from _/api/authenticate_ and _/api/likes_ are only available in XML and for now I don't want to be in any way dependent of other modules. Again: for now.
    - _/api/read/json_ has often not been accessible, if that occurs the client will shot an event error and will return false when trying to connect.

License
-----------

See [LICENSE]

[parameters]: http://www.tumblr.com/docs/en/api
[Tumblr's API]: http://www.tumblr.com/docs/en/api
[demo]: http://www.github.com/mvrilo/tumblrrr/tree/master/demo/
[LICENSE]: http://www.github.com/mvrilo/tumblrrr/blob/master/LICENSE
