namespace("a.dashboard");

(function (window) {
	function empty(value) {
		if (typeof (value) === "undefined") {
			return true;
		}

		if (value == null) {
			return true;
		}

		if (typeof (value) === "string" && $.trim(value) === "") {
			return true;
		}

		return (typeof (value) === "object" && (value instanceof Array) && value.length === 0) 
	}

	apica.dashboard.utils = {
		empty: empty
	};
})(this);