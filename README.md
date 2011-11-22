# Tumblrrr

Usage
---------

The basics is passing the blog hostname as first argument and for methods requiring `api_key`, a second argument using your application's OAuth Consumer Key. For OAuth authorization you will also have to set the `token_secret`, `token_access_key` and `token_access_secret`.

You can get more info [reading the docs].

``` javascript
var tumblr = require('tumblr'),
    staff = tumblr('staff');

/*
    staff = tumblr('staff', 'key', 'secret', 'access_key', 'access_secret');

    or

    staff = tumblr({
      hostname : 'staff',
      key : 'key',
      secret : 'secret',
      access_key : 'access_key',
      access_secret : 'access_secret'
    });
*/
```

Demo
---------

``` javascript
var tumblr = require('tumblr'),
    staff = tumblr('staff');

staff.avatar(function(json) {
  console.log(json);
});
```

Tips
---------

After setting the `token_key` and the `token_secret` you can call the instance variable `OAuthAuthorizationURL` which will return the url for connecting the Tumblr account with the application.

After accepting the connection, it will redirect for your application's callback URL with an `oauth_verifier` as parameter and with that you can set the access variables to your instance using `setOAuthVerifier`.


``` javascript
var tumblr = require('tumblr'),
    staff = tumblr('staff', 'key', 'secret');

staff.setOAuthVerifier('verifier');

// then you will have
console.log(staff.access_key, staff.access_secret);
```

License
-----------

See [LICENSE]

[reading the docs]: http://www.tumblr.com/docs/en/api/v2
[LICENSE]: http://www.github.com/mvrilo/tumblrrr/blob/master/LICENSE
