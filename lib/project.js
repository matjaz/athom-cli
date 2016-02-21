var fs			= require('fs');
var path		= require('path');
var zlib		= require('zlib');

var _			= require('underscore');
var inquirer	= require('inquirer');
var request		= require('request');
var tmp			= require('tmp');
var tar			= require('tar-fs');
var open		= require("open");
var socket_io_client = require('socket.io-client');
var keypress	= require('keypress');
var homey_lib	= require('homey-lib');
var semver		= require('semver');

module.exports.create = function( app_path ) {
	
	app_path = ( typeof app_path == 'string' ) ? app_path : process.cwd();
	
	if( !fs.existsSync(app_path) ) return console.error("Error: path does not exist");
	if( !fs.lstatSync(app_path).isDirectory() ) return console.error("Error: path is not a directory");
	
	inquirer.prompt([
		{
			type: "input",
			name: "id",
			message: "What is your app's unique ID?",
			default: "com.athom.hello",
			validate: function( input ) {
				return input.length > 0 && input.split('.').length > 1;
			}
		},
		{
			type: "input",
			name: "name",
			message: "What is your app's name?",
			default: "Hello World!",
			validate: function( input ) {
				return input.length > 0;
			}
		},
		{
			type: "input",
			name: "version",
			message: "What is your app's version?",
			default: "0.0.1",
			validate: function( input ) {
				return semver.valid(input) === input;
			}
		},
		{
			type: "input",
			name: "compatibility",
			message: "What is your app's compatibility?",
			default: "0.x || 1.x",
			validate: function( input ) {
				return semver.validRange(input) !== null;
			}
		},
		{
			type: "confirm",
			name: "confirm",
			message: "Seems good?"
		}
	], function(answers){
		
		var project_path = path.join(app_path, answers.id);
		
		if( fs.existsSync(project_path) ) return console.error("Error: path " + project_path + " already exist");
		
		// == create the project ==
		fs.mkdirSync( project_path );
		
		// == create app.json ==
		var manifest = {
			"id": answers.id,
			"name": {
				"en": answers.name
			},
			"version": answers.version,
			"compatibility": answers.compatibility
		};
		
		// add author info, if logged in
		if( typeof global.settings.me == 'object' ) {
			manifest.author = {
				"name": global.settings.me.firstname + ' ' + global.settings.me.lastname,
				"email": global.settings.me.email
			}
		}
		
		fs.writeFileSync( path.join( project_path, 'app.json'), JSON.stringify(manifest, null, 4) );
		
		// == create app.js ==
		var appjs_template = fs.readFileSync( path.join(__dirname, '..', 'templates', 'app.js') )
		fs.writeFileSync( path.join( project_path, 'app.js'), appjs_template );
		
		// == create locales ==
		fs.mkdirSync( path.join(project_path, 'locales') );
		fs.writeFileSync( path.join(project_path, 'locales', 'en.json'), '{}' );
		
		// == create assets ==
		fs.mkdirSync( path.join(project_path, 'assets') );
		fs.writeFileSync( path.join(project_path, 'assets', 'icon.svg'), fs.readFileSync( path.join(__dirname, '..', 'templates', 'icon.svg') ) );
		
		setTimeout(process.exit, 1000);
		
	});
}

module.exports.run = function( app_path ) {
	
	run_app( app_path, true );
	
}

module.exports.install = function( app_path ) {
	
	run_app( app_path, false );
	
}

module.exports.validate = function( app_path ) {
	validate_app( app_path, false );
}

module.exports.validateAppStore = function( app_path ) {
	validate_app( app_path, true )
}

function validate_app( app_path, appstore ) {
			
	app_path = ( typeof app_path == 'string' ) ? app_path : process.cwd();
	
	if( appstore ) {
		console.log('Validating ' + app_path + ' for App Store use...')
	} else {
		console.log('Validating ' + app_path + ' for private use...')
	}
	
	var app = new homey_lib.App( app_path );
	
	var valid = app.validate( appstore );
	if( valid.success ) {
		console.log("App validated successfully!".green)
	} else {
		console.log("App failed to validate!".red);
		valid.errors.forEach(function(error){
			console.log( 'Error: ' + error)
		});
	}
	
}

function run_app( app_path, debug ) {
	app_path = ( typeof app_path == 'string' ) ? app_path : process.cwd();
	debug = ( typeof debug == 'undefined' ) ? false : debug;
		
	// verify if the folder has a homey app
	if( !fs.existsSync( path.join( app_path, 'app.json' ) ) ) return console.error("invalid app folder. Give the folder as argument (--run <path>), or change your current directory to the app folder".red);
	
	// get active homey
	if( typeof global.settings.homey == 'undefined' ) {
		var homey = global.lib.homey.select( false, step2);
	} else {
		step2(global.settings.homey);
	}
	
	function step2( homey ){
		
		// get access token
		var token = _.findWhere(global.settings.me.homeys, { _id: homey._id }).token;
		
		// prepare environment vars
		var env = '{}';
		var env_path = path.join( app_path, 'env.json' );
		if( fs.existsSync( env_path ) ) {
			env = fs.readFileSync( env_path ).toString();
		}
		
		pack( app_path, function( tmppath ){
			upload( tmppath, homey.ipInternal, token, debug, env, function( err, response ){
				if( err ) return console.error(err.toString().red);
				
				if( typeof response.result == 'undefined' ) {
					return console.error('Invalid response, got:', response)
				}
				
				if( response.status != 200 ) {
					return console.error(response.result.red);
				}
				
				if( debug ) {
					console.log("Running `" + response.result.app_id + "`...");
									
					/*
					// open debugger
					open("http://" + homey.ipInternal + "/manager/devkit/?bearer_token=" + token)
					*/
					
					var logs = [];
					function printLog( log ) {
						if( logs.indexOf(log.id) > -1 ) return; // skip duplicate logs
						if( log.app != response.result.app_id ) return; // don't show other apps in debug mode
						
						// make errors red
						if( log.type == 'error' ) {
							for( var arg in log.args ) {
								if( typeof log.args[arg] == 'string' ) {
									log.args[arg] = log.args[arg].red;
								}
							}
						}
						
						console.log.apply(null, log.args);
						
						logs.push(log.id);
					}
									
					var socket = socket_io_client( 'http://' + homey.ipInternal + '/realtime/manager/devkit/', {
						query: 'token=' + token
					});
					
					socket.on('connect', function(){
						
						console.log('Debugging...');
						
						// get the log buffer
						request.get({
							url: 'http://' + homey.ipInternal + '/api/manager/devkit/log/',
							headers: {
					    		'Authorization': 'Bearer ' + token
							},
							json: true
						}, function( err, data, response ){
							if( err ) throw( err );
													
							response.result.forEach(printLog);
						});
						
					});
					
					socket.on('error', console.error)
					
					socket.on('log', printLog);
					
					keypress(process.stdin);
	
					// listen for the "keypress" event
					process.stdin.on('keypress', function (ch, key) {
					  if (key && key.ctrl && key.name == 'c') {
					    stop( homey.ipInternal, token, response.result.app_id, function(){
						    process.exit();
					    })
					  }
					});
	
					// Prevent failure on setRawMode when piping process.stdin
					if ( typeof process.stdin.setRawMode === "function") {
						process.stdin.setRawMode( true );
					}
					
					process.stdin.resume();
				
				} else {
					console.log("Installed `" + response.result.app_id + "`");					
				}
			})
		});
		
	}
	
	// functions for packing & uploading
	function pack( app_path, callback ){
		
		console.log('Archiving...');
	
		// create a temporary file (.tar)
		tmp.file(function(err, tmppath, fd, cleanupCallback) {
			
			var tarOpts = {
				ignore: function(name) {
					
					if( name == path.join( app_path, 'env.json' ) ) return false
					
					// ignore dotfiles (.git, .gitignore, .mysecretporncollection etc.)
					return path.basename(name).charAt(0) === '.'
				}
			};

			tar
				.pack( app_path, tarOpts )
				.pipe( zlib.createGzip() )
				.pipe(
					fs
						.createWriteStream(tmppath)
						.on('close', function(){
							callback( tmppath );
						})
					);
				
		});
	}
	
	function upload( tmppath, address, token, debug, env, callback ) {
		
		console.log('Uploading to ' + address + '...');
							
		// POST the tmp file to Homey
		req = request.post({
			url: 'http://' + address + '/api/manager/devkit/',
			headers: {
	    		'Authorization': 'Bearer ' + token
			}
		}, function( err, data, response ){
			if( err ) return callback(err);
			
			callback( null, JSON.parse(response) );
			
			// clean up the tmp file
			fs.unlink( tmppath );
		});
		
		var form = req.form();
		form.append('app', fs.createReadStream(tmppath));
		form.append('debug', debug.toString());		
		form.append('env', env.toString());
		
	}
	
	function stop( address, token, app_id, callback ) {
		
		console.log('Stopping...');
		
		req = request.del({
			url: 'http://' + address + '/api/manager/devkit/' + app_id,
			headers: {
	    		'Authorization': 'Bearer ' + token
			},
			json: true
		}, callback);
	}
}
