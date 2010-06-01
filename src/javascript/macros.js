/**
 * Returns an anonymous function.
 */
defmacro("lambda", function (arglist /*, ... */) {
	var env  = new Env(lisp.env);
	var args = argsToArray(arguments);
	return (function (env, args) {
		var body = args.slice(1);
		return function () {
			var tempEnv = lisp.env;
			var i;
			lisp.env = env;
			lisp.env.let("this", this);
			for (i = 0; i < arglist.length; i++) {
				lisp.env.let(arglist[i], arguments[i]);
			}
			var ret = null;
			for (i = 0; i < body.length; i++) {
				ret = resolve(body[i]);
			}
			lisp.env = tempEnv;
			return ret;
		};
	})(env, args);
});

/**
 * Defines a function.
 */
defmacro("defun", function () {
	var args = argsToArray(arguments);
	var name = args[0];
	var arglist = args[1];
	var body = args.slice(2);
	
	lisp.env.set(name, function () {
		var i;
		lisp.env = new Env(lisp.env);
		for (i = 0; i < arglist.length; i++) {
			lisp.env.set(arglist[i], arguments[i]);
		}
		var ret = null;
		for (i = 0; i < body.length; i++) {
			ret = resolve(body[i]);
		}
		lisp.env = lisp.env.parent;
		return ret;
	});
});

/**
 * Provides JavaScript's try/catch feature to the lisp environment.
 * 
 * @return The return value of the last evaluated expression.
 * 
 * @example Does nothing
 *   > (try)
 *   nil
 * @example Empty catch block (silences the error)
 *   > (try
 *         (throw (new Error))
 *       (catch))
 *   nil
 * @example Multiple expressions with a full catch block
 *   > (try
 *         (print "This will print")
 *         (throw (new Error "This cuts the expression short"))
 *         (print "This will not print")
 *       (catch (e)
 *         (format t "This will print when the error is thrown: %s" e)))
 *   (no return value)
 */
defmacro("try", function () {
	var args = argsToArray(arguments);
	var lastExpression = args[args.length-1];
	var catchExpression;
	
	if ((lastExpression instanceof Array) && // The "catch" expression must be a list
		(lastExpression.length >= 1) && // It must at least have the symbol catch
		(lastExpression[0] instanceof Symbol) &&
	    (lastExpression[0].value == "catch")) {
		catchExpression = lastExpression;
		args = args.slice(0, -1);
	}
	
	var ret = null;	
	
	try {		
		for (var i = 0; i < args.length; i++) {
			ret = resolve(args[i]);
		}
	} catch (e) {
		if (catchExpression) {
			catchExpression[0].value = "lambda"; // Just make it a lambda
			if (catchExpression.length === 1) { // Add an arglist if there isn't one
				catchExpression.push([]);
			}
			var callback = resolve(catchExpression);
			callback(e);
		} else {
			throw e;
		}
	}
	
	return ret;
});

/**
 * Returns the function that the given symbol points to.
 */
defmacro("getfunc", function (symbol) {
	if (arguments.length !== 1) {
		throw new Error("(getfunc) requires 1 argument (got " +
			arguments.length + ")");
	}
	var object = lisp.env.get(symbol);
	if (typeof(object) == "function") {
		return object;
	} else if (object instanceof Macro) {
		return object.callable;
	}
	throw new Error("'" + symbol + "' is not a function or macro");
});

/**
 * Takes an object and a dotpath and calls the dotpath as a function
 * on the given object (with the given arguments).
 */
defmacro("funcall", function (object, dotpath) {
	if (arguments.length < 2) {
		throw new Error("(funcall) requires at least 2 arguments " +
			"(got " + arguments.length + ")");
	}
	// Grab the object.
	object = resolve(object);
	// Make sure we can get a string dotpath from the supplied argument.
	if (dotpath instanceof Symbol || dotpath instanceof Keyword) {
		dotpath = dotpath.value;
	} else if (typeof(dotpath) != "string") {
		throw new Error("Unknown function key in (funcall): " + String(dotpath));
	}
	// Resolve the object down to the second-to-last part of the dot path.
	var parts = String(dotpath).split(".");
	for (var i = 0; i < parts.length-1; i++) {
		object = object[parts[i]];
	}
	// Make sure what's being "called" is actually a function.
	var funckey = parts[parts.length-1];
	if (typeof(object[funckey]) != "function") {
		throw new Error(String(dotpath) + " on " + object + " is not a function");
	}
	var args = argsToArray(arguments).slice(2).map(resolve);
	return object[funckey].apply(object, args);
});

/**
 * 
 */
defmacro("let", function () {
	var args = argsToArray(arguments);
	var letset = args[0];
	var i;
	lisp.env = new Env(lisp.env);
	args = args.slice(1);
	
	for (i = 0; i < letset.length; i++) {
		var symbol = letset[i][0];
		var value = resolve(letset[i][1]);
		lisp.env.let(symbol, value);
	}
	
	var ret = null;
	for (i = 0; i < args.length; i++) {
		ret = resolve(args[i]);
	}
	lisp.env = lisp.env.parent;
	return ret;
});

/**
 * 
 */
defmacro("setq", function () {
	var args = argsToArray(arguments);
	var symbol = args[0];
	var value  = resolve(args[1]);
	lisp.env.set(symbol, value);
	return value;
});

/**
 * Simply executes all of the given expressions in order. This
 * is mainly for being able to execute multiple expressions inside
 * of places in other macros/functions where only one expression
 * can go.
 * 
 * @return The return value of the last expression, or nil if there
 *         are no expression.
 * 
 * @tested
 */
defmacro("progn", function (/* .. */) {
	var ret = null;
	for (var i = 0; i < arguments.length; i++) {
		ret = resolve(arguments[i]);
	}
	return ret;
});

/**
 * If the first expression evaluates to true in a boolean context,
 * this macro evaluates and returns the result of the second
 * expression, otherwise it evaluates all of the remaining expression
 * and returns the return value of the last one.
 * 
 * @return The return value of either the second or last expression, or
 *         nil if testExpression evaluates to false and there are no
 *         remaining expressions to evaluate.
 * 
 * @tested
 */
defmacro("if", function (testExpression, ifTrueExpression /*, ... */) {
	if (arguments.length < 2) {
		throw new Error("(if) requires at least 2 arguments (got " +
			arguments.length + ")");
	}
	if (!!resolve(testExpression)) { // testExpression evaluates to true
		return resolve(ifTrueExpression);
	} else { // Evaluate all of the expressions after ifTrueExpression
		var ret = null;
		var i = 2; // Start at the 3rd expression
		for (; i < arguments.length; i++) {
			ret = resolve(arguments[i]);
		}
		return ret;
	}
	return null; // This will never happen
});

/**
 * Executes the rest of the arguments if the first argument
 * is true.
 * 
 * @return The return value of the last expression.
 * 
 * @tested
 */
defmacro("when", function () {
	if (arguments.length === 0) {
		throw new Error("(when) requires at least 1 argument " +
			"(got " + arguments.length + ")");
	}
	if (!!resolve(arguments[0])) {
		var args = argsToArray(arguments).slice(1).map(resolve);
		return args[args.length-1];
	}
	return null;
});

/**
 * Performs a logical negation on the given value.
 * 
 * @tested
 */
defmacro("not", function (value) {	
	if (arguments.length === 0) {
		throw new Error("(not) requires at least 1 argument");
	}
	return predicate(arguments, function (value) {
		return !value;
	});
});

/**
 * 
 */
defmacro("or", function () {
	for (var i = 0; i < arguments.length; i++) {
		if (resolve(arguments[i])) {
			return true;
		}
	}
	return false;
});

/**
 * 
 */
defmacro("and", function () {
	if (arguments.length === 0) {
		return true;
	}
	return predicate(arguments, function (value) {
		return !!value;
	});
});

/**
 * 
 */
defmacro("==", function () {
	if (arguments.length < 2) {
		throw new Error("Macro '==' requires at least 2 arguments");
	}
	return comparator(arguments, function (a, b) {
		return a == b;
	});
});

/**
 * 
 */
defmacro("===", function () {
	if (arguments.length < 2) {
		throw new Error("Macro '===' requires at least 2 arguments");
	}
	return comparator(arguments, function (a, b) {
		return a === b;
	});
});

/**
 * 
 */
defmacro("!=", function () {
	if (arguments.length < 2) {
		throw new Error("Macro '!=' requires at least 2 arguments");
	}
	return comparator(arguments, function (a, b) {
		return a != b;
	});
});

/**
 * 
 */
defmacro("!==", function () {
	if (arguments.length < 2) {
		throw new Error("Macro '!==' requires at least 2 arguments");
	}
	return comparator(arguments, function (a, b) {
		return a !== b;
	});
});

/**
* Examples:
*    * (< x y)
*    * (< -1 0 1 2 3)
 */
defmacro("<", function () {
	if (arguments.length < 2) {
		throw new Error("Macro '<' requires at least 2 arguments");
	}
	return comparator(arguments, function (a, b) {
		return a < b;
	});
});

/**
 * Examples:
 *    * (> x y)
 *    * (> 3 2 1 0 -1)
 */
defmacro(">", function () {
	if (arguments.length < 2) {
		throw new Error("Macro '>' requires at least 2 arguments");
	}
	return comparator(arguments, function (a, b) {
		return a > b;
	});
});

/**
 * Examples:
 *    * (<= x y)
 *    * (<= 1 1 2 3 4)
 */
defmacro("<=", function () {
	if (arguments.length < 2) {
		throw new Error("Macro '>' requires at least 2 arguments");
	}
	return comparator(arguments, function (a, b) {
		return a <= b;
	});
});

/**
 * Examples:
 *    * (>= x y)
 *    * (>= 4 3 2 2 1)
 */
defmacro(">=", function () {
	if (arguments.length < 2) {
		throw new Error("Macro '>' requires at least 2 arguments");
	}
	return comparator(arguments, function (a, b) {
		return a >= b;
	});
});

/**
 * Returns true if the given values === true.
 */
defmacro("is-true", function () {
	return predicate(arguments, function (value) {
		return value === true;
	});
});

/**
 * Returns true if the given values === false.
 */
defmacro("is-false", function () {
	return predicate(arguments, function (value) {
		return value === false;
	});
});

/**
 * Returns true if the given values === null.
 */
defmacro("is-null", function () {
	return predicate(arguments, function (value) {
		return value === null;
	});
});

/**
 * 
 */
defmacro("is-undefined", function () {
	return predicate(arguments, function (value) {
		return value === undefined;
	});
});

/**
 * Returns true if the given values are strings.
 */
defmacro("is-string", function () {
	return predicate(arguments, function (value) {
		return typeof(value) == "string";
	});
});

/**
 * Returns true if the given values are numbers.
 */
defmacro("is-number", function () {
	return predicate(arguments, function (value) {
		return typeof(value) == "number";
	});
});

/**
 * Returns true if the given values are booleans.
 */
defmacro("is-boolean", function () {
	return predicate(arguments, function (value) {
		return typeof(value) == "boolean";
	});
});

/**
 * Returns true if the given values are functions.
 */
defmacro("is-function", function () {
	return predicate(arguments, function (value) {
		return typeof(value) == "function";
	});
});

/**
 * Returns true if the given values are objects.
 */
defmacro("is-object", function () {
	return predicate(arguments, function (value) {
		return typeof(value) == "object";
	});
});
