var _			= require('underscore');
var inquirer	= require("inquirer");

module.exports.select = function( save, callback ){
	
	if( typeof global.settings.me == 'undefined' ) return console.error("please login first".red);
	var homeys = global.settings.me.homeys;
		
	// generate list of choices
	var choices = [];
	homeys.forEach(function(homey){
		choices.push({
			value: homey._id,
			name: homey.name + ' @ ' + homey.ip_internal
		});
	});
	
	// ask
	inquirer.prompt([
		{
			type: "list",
			name: "homey",
			message: "Select active Homey",
			choices: choices
		}
	], function(answers){
		
		// show which homey is active
		var activeHomey = _.findWhere(homeys, { _id: answers.homey });
		delete activeHomey.users;
		
		if( save ) {
			// save
			global.settings.homey = activeHomey;
		
			// give feedback
			console.log("Saved active Homey: " + activeHomey.name );
		} else {
			if( typeof callback == 'function' ){
				callback(activeHomey);
			}
		}
	});
	
}

module.exports.unselect = function(){
	delete global.settings.homey;
	console.log('unselected homey');
}

module.exports.list = function(){
	
	if( typeof global.settings.me == 'undefined' ) return console.error("please login first".red);
	var homeys = global.settings.me.homeys;
	
	console.log("");
	console.log("Your Homeys:");
	console.log("");
	homeys.forEach(function(homey, i){
		
		var me = _.findWhere(homey.users, { user: global.settings.me._id });
		
		console.log('-------------------------------------');
		console.log(' name:      ' 	+ homey.name);
		console.log(' id:        '	+ homey._id);
		console.log(' lan ip:    ' 	+ homey.ip_internal);
		console.log(' wan ip:    ' 	+ homey.ip_external);
//		console.log(' my role:   ' 	+ me.role);
		console.log(' my token:  ' 	+ homey.token); // TOFIX by joachim
		console.log(' # users:   ' 	+ homey.users.length);
		
		if( i == homeys.length-1 ) {
			console.log('-------------------------------------');
		}
	})
}