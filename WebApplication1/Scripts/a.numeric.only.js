(function(window, undefined) {

	var ns = namespace('apica.thresholds');

	ns.activateNumericInput = function () {

		$(".decimal-positive-only").bind('keypress', function(e) {
			return checkCode(e, false, true);
		});

		$(".integer-positive-only").bind('keypress', function(e) {
			return checkCode(e, false, false);
		});

		$(".integer-only").bind('keypress', function (e) {
			return checkCode(e, true, false);
		});

		function checkCode(e, negative, floating) {
			if (e.keyCode == '9' || e.keyCode == '16') {
				return false;
			}
			var code;
			if (e.keyCode) code = e.keyCode;
			else if (e.which) code = e.which;
			if (code == 8)
				return true;
			if (negative && code == 45)
				return true;
			if (floating && code == 46)
				return true;
			if (code < 48 || code > 57)
				return false;

			return true;
		}
	}

	$(document).ready(function () {

		ns.activateNumericInput();
	});

})(this);