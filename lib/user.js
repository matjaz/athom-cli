var path		= require('path');

var express		= require('express');
var bodyParser	= require('body-parser');
var open		= require("open");
var portfinder	= require('portfinder');

module.exports.login = function( callback ) {
	
	portfinder.getPort(function (err, port) {
	
		if( err ) throw err;
	
		var app = express();
		var urlencodedParser = bodyParser.urlencoded({ extended: false })
		
		app
			.use('/', express.static( path.join( __dirname, '..', 'www') ) )
			.post('/', urlencodedParser, function(req, res){
				
				// respond
				res.send('ok');
				
				// save tokens
				global.settings.accessToken		= req.body.accessToken;
				global.settings.refreshToken	= req.body.refreshToken;
				
				// get user info
				lib.api({
					path: '/user/me'
				}, function(err, result, body){
					if( err ) throw( err );
					
					// save user info
					global.settings.me = body;
					//delete global.settings.me.homeys;
					
					// say hi
					console.log("Welcome, " + body.firstname + '! You are now logged in on this computer.');
				
					// callback
					if( typeof callback == 'function' ) {
						callback();
					} else {
						setTimeout(process.exit, 1000);
					}
				});
			})
			.listen(port);
		
		// open browser
		var address = "http://localhost:" + port;
		console.log("Opening browser at " + address);
		open(address);
	
	});
	
}

module.exports.logout = function(){
	delete global.settings.accessToken;
	delete global.settings.refreshToken;
	delete global.settings.me;
	delete global.settings.homey;
	setTimeout(process.exit, 1000);
}