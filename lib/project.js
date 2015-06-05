var fs			= require('fs');
var path		= require('path');
var zlib		= require('zlib');

var _			= require('underscore');
var inquirer	= require('inquirer');
var request		= require('request');
var tmp			= require('tmp');
var tar			= require('tar-fs');
var open		= require("open");

module.exports.create = function( app_path ) {
	
	app_path = ( typeof app_path == 'string' ) ? app_path : process.cwd();
	
	if( !fs.existsSync(app_path) ) return console.error("Error: path does not exist");
	if( !fs.lstatSync(app_path).isDirectory() ) return console.error("Error: path is not a directory");
	
	inquirer.prompt([
		{
			type: "input",
			name: "id",
			message: "What is your app's unique ID?",
			default: "nl.athom.hello"
		},
		{
			type: "input",
			name: "name",
			message: "What is your app's name?",
			default: "Hello World!"
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
			}
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

module.exports.run = function( app_path, brk ) {
	
	app_path = ( typeof app_path == 'string' ) ? app_path : process.cwd();
	brk = ( typeof brk == 'undefined' ) ? false : brk;
	
	// verify if the folder has a homey app
	if( !fs.existsSync( path.join( app_path, 'app.json' ) ) ) return console.error("invalid app folder");
	
	// get active homey
	if( typeof global.settings.homey == 'undefined' ) {
		var homey = global.lib.homey.select( false, step2);
	} else {
		step2(global.settings.homey);
	}
	
	function step2( homey ){
		
		// get access token
		var token = _.findWhere(global.settings.me.homeys, { _id: homey._id }).token;
		
		pack( app_path, function( tmppath ){
			upload( tmppath, homey.ip_internal, token, brk, function( err, response ){
				if( err ) return console.error(err.toString().red);
				
				if( response.status != 200 ) {
					return console.error(response.result.red);
				}
				
				// open debugger
				open("http://" + homey.ip_internal + "/manager/devkit/?bearer_token=" + token)
				
				console.log("app " + response.result.app_id + " is running");
				
				setTimeout(process.exit, 1000);
			})
		});
		
	}
	
	// functions for packing & uploading
	function pack( app_path, callback ){
		
		console.log('archiving...');
	
		// create a temporary file (.tar)
		tmp.file(function(err, tmppath, fd, cleanupCallback) {
			
			var tarOpts = {
				ignore: function(name) {
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
	
	function upload( tmppath, address, token, brk, callback ) {
		
		console.log('uploading...');
							
		// POST the tmp file to Homey
		request = request.post({
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
		
		var form = request.form();
		form.append('app', fs.createReadStream(tmppath));
		form.append('brk', brk.toString());
		
	}
	
}

