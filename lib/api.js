var request			= require('request');
var _				= require('underscore');

var apiUrl = 'https://api.athom.com/';

module.exports = function call( options, callback ) {
	
	// create the options object
	options = _.extend({
		path			: '/',
		method			: 'GET',
		access_token	: global.settings.accessToken,
		refresh_token	: global.settings.refreshToken,
		json			: true
	}, options);
	
	// remove the first trailing slash, to prevent `.nl//foo`
	if( options.path.charAt(0) === '/' ) path = options.path.substring(1);
	
	// make the request
	request({
		method	: options.method,
		url		: apiUrl + path,
		json	: options.json,
		headers	: {
			'Authorization': 'Bearer ' + options.access_token
		}
	}, function( err, response, body ){
				
		if( err ) return callback( err );
		
		if( response.statusCode == 401 ) {
			
			// token expired. refresh it!
			console.log('Error! Token expired, refresh it! TODO');
			
			request({
				method: 'POST',
				url: 'https://devkit.athom.com/auth/refresh',
				json: {
					'refresh_token': options.refresh_token
				}
			}, function( err, result, body ){
				console.log(body)
			});
			
			/*
			passportRefresh.requestNewAccessToken(
				'athom',
				options.refresh_token,
				function(err, accessToken, refreshToken) {
					
					// save the new access token
					global.db.models.User.update({
						api_access_token: options.access_token
					}, {
						api_access_token: accessToken
					}, function (err) {
						if (err) return console.error(err)
						
						// retry the call with the new access token
						options.access_token = accessToken;
						call( options, callback );
					});
					
				}
			);
			*/
			
			return;
		}
		
		if( typeof callback == 'function' ) {
			callback( null, response, body );
		}
		
	});
	
}