(function() {
	namespace('apica.threshold.stats');

	apica.threshold.stats.ThresholdStats = function (seriesId, sourceDetailTitles, metricName, metricUnit) {
		var self = this;

		self.metricUnit = metricUnit || "";
		self.axisModel = ko.observable(null);
		self.show = ko.observable(false);
		self.seriesId = seriesId;
		self.check = sourceDetailTitles;
		self.metric = metricName;
		self.threshold = ko.observable("-");
		self.thresholdNumber = ko.observable("-");
		self.rate = ko.observable(null);
		self.displayRate = ko.computed(function() {
			if (self.rate() != null) {
				return self.rate() + "%";
			} else
				return "-";
		});
		self.metricAverageForSeries = ko.observable("-");
		self.innerMetricAverage = "";
		self.metricAverage = ko.computed(function () {
			if (self.axisModel() != null) {
				var averageValue = self.axisModel().averageValue();
				if (averageValue !== "") {
					self.innerMetricAverage = averageValue;
				}
				// we don't show metricUnit in the same property, so CSV export doesn't contain it in one cell
				// return self.innerMetricAverage + " " + self.metricUnit;
				return self.innerMetricAverage;
			};
			return "-";
		});

		self.updateData = function(thresholdCount, allData, thresholdValue) {
			self.thresholdNumber(thresholdCount);
			if (thresholdValue != null) {
				// we don't show metricUnit in the same property, so CSV export doesn't contain it in one cell
				//self.threshold(thresholdValue + " " + self.metricUnit);
				self.threshold(thresholdValue);
			}
			self.rate((100 - (thresholdCount * 100 / allData.length)).toFixed(2));

			var summ = 0;
			for (var i = 0; i < allData.length; i++) {
				summ += allData[i].value;
			}

			// we don't show metricUnit in the same property, so CSV export doesn't contain it in one cell
			//self.metricAverageForSeries((summ / allData.length).toFixed(0) + " " + self.metricUnit);
			self.metricAverageForSeries((summ / allData.length).toFixed(0));

			self.show(true);
		}
	}


	apica.threshold.stats.exportToCsv = function(thresholdStats, dateFrom, dateTo) {

		function getData() {
			var content = [];
			content.push(["Check", "Metric", "Metric Average", "Threshold", "No. Threshold Violations", "Success Rate %"]);
			_.each(_.map(thresholdStats, function (ts) { return [ts.check, ts.metric, ts.metricAverageForSeries(), ts.threshold(), ts.thresholdNumber(), ts.rate()]; }), function (a) { content.push(a) });

			var csvData = Papa.unparse(content, {
				quotes: false,
				delimiter: "\t",
				newline: "\r\n"
			});

			return csvData;
		}

		function getFileName() {return 'Threshold violation ' + moment(dateFrom).format('YYYYMMDD') + '-' + moment(dateTo).format('YYYYMMDD') + '.csv';}

		function getInternetExplorerVersion() {
			var rv = -1;
			if (window.navigator.appName == 'Microsoft Internet Explorer') {
				var ua = window.navigator.userAgent;
				var re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
				if (re.exec(ua) != null)
					rv = parseFloat(RegExp.$1);
			} else if (window.navigator.appName == 'Netscape') {
				var ua = window.navigator.userAgent;
				var re = new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})");
				if (re.exec(ua) != null)
					rv = parseFloat(RegExp.$1);
			}
			return rv;
		}

		function isInternetExplorer() {
			var ua = window.navigator.userAgent;
			var msie = ua.indexOf("MSIE ");
			if (msie != -1 || !!navigator.userAgent.match(/Trident.*rv\:11\./)) {
				return true;
			}
			return false;
		}

		if (isInternetExplorer()) {
			if (getInternetExplorerVersion() < 9) {
				alert('Export to CSV is not supported in Internet Explorer 8 or older.');
			} else {
				var iframe = document.getElementById('csvDownloadFrame');
				iframe = iframe.contentWindow || iframe.contentDocument;

				iframe.document.open("text/html", "replace");
				iframe.document.write(getData());
				iframe.document.close();
				iframe.focus();
				iframe.document.execCommand('SaveAs', true, getFileName());
			}

		} else {
			var uri = 'data:application/csv;charset=utf-8,' + escape(getData());
			var link = document.createElement("a");
			link.href = uri;
			link.style = "visibility:hidden";
			link.download = getFileName();
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}

	}
})();