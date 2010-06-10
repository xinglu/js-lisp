(defun repl-represent (value)
	"Returns a lispy string representation of the given value"
	(cond ((is-null value) "nil")
		  ((is-true value) "t")
		  ((is-false value) "f")
		  ((instanceof value lisp.Symbol) (to-string value))
		  ((instanceof value lisp.Keyword) (concat ":" (to-string value)))
		  ((instanceof value Array)
			(concat "(" (join " " (map repl-represent value)) ")"))
		  (t (to-json value t))))