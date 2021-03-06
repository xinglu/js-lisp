function toJSON (object, pretty, levels, level) {
	levels = levels || 2; // Default levels
	level = level || 0;
	
	var done = level >= levels;
	var newline = pretty ? '\n' : '';
	var singleprefix = pretty ? times(' ', 2) : '';
	var prefix  = pretty ? times(singleprefix, level) : '';
	
	var json;
	var value;
	
	switch (typeof(object))
	{
	case 'undefined':
		return 'undefined';
	case 'object':
		if (!object) {
			// 'object' is null.
			return 'null';
		} else if (object instanceof Array) {
			// 'object' is an Array.
			json = '[';
			
			if (!done) {
				json += newline;
				value = null;
				for (var i = 0; i < object.length; i++) {
					value = toJSON(object[i], pretty, levels, level+1);
					json += prefix + singleprefix + value + ', ' + newline;
				}
				json = json.replace(/[\s\n]*$/g, '');
				json = json.replace(/,$/, '');
				if (object.length > 0) {
					json += newline + prefix;
				}
			} else {
				json += ' ... ';
			}
			
			return json + ']';
		} else if (object instanceof Date) {
			// 'object' is a Date.
			// Taken from http://www.json.org/json2.js
			function f (n) {
				// Format integers to have at least two digits.
				return n < 10 ? '0' + n : n;
			}
			
			return '"' +
				   object.getUTCFullYear()	   + '-' +
				   f(object.getUTCMonth() + 1) + '-' +
				   f(object.getUTCDate())	   + ' ' +
				   f(object.getUTCHours())	   + ':' +
				   f(object.getUTCMinutes())   + ':' +
				   f(object.getUTCSeconds())   +
				   '"';
		} else {
			json = '{';
			
			if (!done) {
				json = json + newline;
				count = 0;
				value = null;
				for (var key in object) {
					count++;
					if (object[key] == global) {
						value = "[global]";
					} else {
						value = toJSON(object[key], pretty, levels, level+1);
					}
					json += prefix + singleprefix + '"' + key + '": ' + value;
					json += ', ' + newline;
				}
				json = json.replace(/[\s\n]*$/g, '');
				json = json.replace(/,$/, '');
				if (count > 0) {
					json += newline + prefix;
				}
			} else {
				json += ' ... ';
			}
			
			return json + '}';
		}
	case 'function':
		var match = object.toString().match(/[^\(]+\([^\)]*\)/);
		return (match ? match[0] : 'function ()') + ' { ... }';
	case 'string':
		return '"' + object.replace(/"/g, '\\"') + '"';
	case 'number':
		return object;
	case 'boolean':	
	default:
		return object.toString();
	}
}
