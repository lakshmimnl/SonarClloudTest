// This js is not used anymore (apica.managechecks.bulk2.js is used now). Can be removed

(function () {

	var defaultAttemptPause = 30000;

	var emptyFieldsMessage = 'Field(s) cannot be empty';
	var duplicateFieldsMessage = 'Key-Field cannot be duplicate';
	var invalidRegexpFieldsMessage = 'Field cannot be invalid regexp';

	apica.managechecks.UrlsListViewModel = function (isEnableFunc, validationsRules) {

		var self = this;
		self.urls = ko.observableArray();

		self.isEnable = ko.computed(function () {
			return isEnableFunc();
		});

		var UrlModel = function (urlString, urls) {
			var self = this;

			self.url = ko.observable(urlString);
			self.isNewElement = ko.observable(false);
			self.validationMessage = ko.observable();

			var validationFunctions = [];
			if (validationsRules && validationsRules.checkEmpty) {
				validationFunctions.push({
					validator: function () {
						if (!isEnableFunc()) return true;
						return !(urlString.trim() == "");
						
					},
					message: emptyFieldsMessage
				});
			}

			if (validationsRules && validationsRules.checkDuplicates) {
				validationFunctions.push({
					validator: function () {
						if (!isEnableFunc()) return true;
						var count = 0;
						for (var i = 0; i < urls().length; i++) {
							if (urls()[i].url() == urlString) {
								count++;
							}
						}
						return count > 1 ? false : true;
					},
					message: duplicateFieldsMessage
				});
			}

			if (validationsRules && validationsRules.checkRegexp) {
				validationFunctions.push({
					validator: function () {
						if (!isEnableFunc()) return true;
						try {
							new RegExp(urlString)
						} catch (e) {
							return false;
						}
						return true;
					},
					message: invalidRegexpFieldsMessage
				});
			}

			self.validationMessage.extend({
				validation: validationFunctions
			});
		};

		self.newUrl = new UrlModel('');
		self.newUrl.isNewElement(true);

		self.urlAction = function (element) {
			if (self.isEnable()) {
				if (element.isNewElement()) {

					var url = self.newUrl.url();
					self.urls.push(new UrlModel(url, self.urls));
					self.newUrl.url('');
				} else {

					self.urls.remove(element);
				}
			}
		};

		self.urlChange = function (element) {
			if (self.isEnable()) {
				if (!element.isNewElement()) {

					var val = element.url();
					var index = self.urls.indexOf(element);

					self.urls.remove(element);
					self.urls.splice(index, 0, new UrlModel(val, self.urls));
				}
			}
		};

		self.checkInfoErrors = ko.computed(function () {
			return ko.validation.group(self.urls(), { deep: true });
		});
	}

	apica.managechecks.StatusCodesViewModel = function (isEnableFunc, validationsRules) {
		var self = this;

		self.items = ko.observableArray();
		self.isEnable = ko.computed(function () {
			return isEnableFunc();
		});

		var StatusCodesModel = function (statusCode, fileType, items) {
			var self = this;

			self.statusCode = ko.observable(statusCode);
			self.fileType = ko.observable(fileType);
			self.isNewElement = ko.observable(false);
			self.validationMessage = ko.observable();

			var validationFunctions = [];
			if (validationsRules && validationsRules.checkEmpty) {
				validationFunctions.push({
					validator: function () {
						if (!isEnableFunc()) return true;
						if (statusCode.trim() == "" || fileType == "") return false;
						return true;
					},
					message: emptyFieldsMessage
				});
			}

			if (validationsRules && validationsRules.checkDuplicates) {
				validationFunctions.push({
					validator: function () {
						if (!isEnableFunc()) return true;
						var count = 0;
						for (var i = 0; i < items().length; i++) {
							if (items()[i].statusCode() == statusCode) {
								count++;
							}
						}
						return count > 1 ? false : true;
					},
					message: duplicateFieldsMessage
				});
			}

			self.validationMessage.extend({
				validation: validationFunctions
			});
		};

		self.newItem = new StatusCodesModel('', '');
		self.newItem.isNewElement(true);

		self.itemAction = function (element) {
			if (self.isEnable()) {
				if (element.isNewElement()) {
					var statusCode = element.statusCode();
					var fileType = element.fileType();

					self.items.push(new StatusCodesModel(statusCode, fileType, self.items));
					self.newItem.statusCode('');
					self.newItem.fileType('');
				} else {

					self.items.remove(element);
				}
			}
		};

		self.itemChange = function (element) {
			if (self.isEnable()) {
				if (!element.isNewElement()) {

					var key = element.statusCode();
					var val = element.fileType();
					var index = self.items.indexOf(element);

					self.items.remove(element);
					self.items.splice(index, 0, new StatusCodesModel(key, val, self.items));
				}
			}
		};

		self.checkInfoErrors = ko.computed(function () {
			return ko.validation.group(self.items(), { deep: true });
		});
	};

	apica.managechecks.ChecksEditorViewModel = function(isGodlikePowers, manageChecksModel) {
		var self = this;

		var checksInGroupsIndex = manageChecksModel.checksInGroupsIndex;

		self.checksToEdit = ko.observableArray();
		self.checksToEditCount = ko.computed(function() {
			return (self.checksToEdit) ? self.checksToEdit().length : 0;
		});

		self.allChecksToEditSelected = ko.computed(new apica.ko.computedHelpers.AllItemsTrue(self.checksToEdit, 'selectedInBulkPreview'));
		var getSelectedChecksToEdit = function() {
			var result = [];
			ko.utils.arrayForEach(self.checksToEdit(), function(check) {
				if (check.visible() && check.selectedInBulkPreview()) {
					result.push(check);
				}
			});
			return result;
		};
		self.getSelectedChecksToEdit = getSelectedChecksToEdit;
		self.selectedChecksToEditCount = ko.pauseableComputed(function () {
			apica.managechecks.getEditor();
			return getSelectedChecksToEdit().length;
		});

		// tricky thing to prevent multiple apica.managechecks.getEditor() calls caused by allChecksToEditSelected dependent property implementation
		self.allChecksToEditClick = function (item, event) {
			var checked = event.target.checked;
			self.selectedChecksToEditCount.pause();
			setTimeout(function () {
				self.selectedChecksToEditCount.resume();
				event.target.checked = checked;
			}, 100);
		}

		var getSelectedChecksToEditIds = function() {
			var checks = getSelectedChecksToEdit();
			var selectedCheckIds = ko.utils.arrayMap(checks, function(item) {
				return item.checkId();
			});
			return selectedCheckIds;
		}

		self.bulkUpdateChecks = function() {
			apica.managechecks.bulkUpdateChecks();
		}

		// bulk quick operations

		self.bulkEnableClick = function() {
			manageChecksModel.enableChecks(true, getSelectedChecksToEditIds());
		};

		self.bulkDisableClick = function() {
			manageChecksModel.enableChecks(false, getSelectedChecksToEditIds());
		};

		self.bulkDeleteClick = function() {
			if (confirm('Are you sure you want to delete ' + self.selectedChecksToEditCount() + ' selected check(s) permanently?')) {
				manageChecksModel.deleteChecks(getSelectedChecksToEditIds(), function() {
					manageChecksModel.refreshBulkPanel();
					if (self.checksToEditCount() == 0) {
						manageChecksModel.showChecksPanel();
					}
				});
			}
		};

		self.bulkRunClick = function() {
			manageChecksModel.runChecks(getSelectedChecksToEditIds());
		};

		// end bulk quick operations

		self.deleteCheck = function(check) {
			if (confirm("Are you sure you want to delete this check permanently?")) {
				manageChecksModel.deleteChecks([ko.utils.unwrapObservable(check.checkId)], function () {
					manageChecksModel.refreshBulkPanel();
					if (self.checksToEditCount() == 0) {
						manageChecksModel.showChecksPanel();
					}
				});
			}
		};

		self.checkName = ko.observable();
		self.editCheckName = ko.observable();

		self.checkName.extend({
			required: {
				onlyIf: function() {
					return self.editCheckName();
				}
			}
		});

		self.checkDescription = ko.observable();
		self.editCheckDescription = ko.observable();

		self.interval = ko.observable();
		self.editInterval = ko.observable();

		self.editInterval.subscribe(function() {
			if (self.editInterval()) {
				self.onEditIntervalChange();
			} else {
				self.editIntervalListReady(false);
			}
		});

		self.editIntervalListReady = ko.observable(false);
		// todo: this is reduced intervals list for now

		self.intervals = ko.observableArray([
			{ value: '0', text: 'Manual', visible: true }
		]);

		function getListElement(value) {

			var text = "Manual";

			if (value / 60 < 60) {
				text = (value / 60) + "m";
			} else if (value / 3600 < 24) {
				text = (value / 3600) + "h";
			} else {
				text = (value / (3600 * 24)) + "days";
			}

			return { value: value, text: text };
		};

		self.onEditIntervalChange = function() {

			self.intervals.removeAll();
			self.intervals.push({ value: '0', text: 'Manual' });

			var checkPairs = [];
			var checksToEdit = getSelectedChecksToEdit();

			checksToEdit.forEach(function(check) {
				var checkPair = { id: check.checkId(), checkType: check.checkType() };

				if (!_.contains(checkPairs, checkPair)) {
					checkPairs.push(checkPair);
				}
			});

			apica.ajax.apiCallPost(
				'/ManageChecks/GetIntersectionCheckIntervals',
				checkPairs,
				function(result) {

					if (result) {
						result.forEach(function(intervalValue) {
							self.intervals.push(getListElement(intervalValue));
						});
					}

					self.editIntervalListReady(true);
				},
				function() {
					self.editIntervalListReady(true);
				}
			);
		};

		self.onChecksToEditSelected = function () {
			if (manageChecksModel.isBulkMode()) {
				if (self.editInterval() === true) {
					self.editInterval(false);
					self.editIntervalListReady(false);
					self.intervals.removeAll();
					self.intervals.push({ value: '0', text: 'Manual', visible: true });
				}

				if (self.editLocation() === true) {
					self.editLocation(false);
					self.editLocationReady(false);
					locationsMap = {};
				}
			}
		};

		self.editMaxAttempts = ko.observable();
		self.maxAttempts = ko.observable();
		self.maxAttemptss = ko.observableArray();
		
		self.editMaxAttempts.subscribe(function () {
			if (self.editMaxAttempts()) {
				self.onEditMaxAttempts();
			} else {
				self.editMaxAttemptsListReady(false);
			}
		});

		self.editMaxAttemptsListReady = ko.observable(false);

		self.onEditMaxAttempts = function () {

			self.maxAttemptss.removeAll();

			apica.ajax.apiCallGet(
				'/ManageChecks/GetMaxAttempts',
				null,
				function (result) {

					if (result) {
						result.forEach(function (element) {
							self.maxAttemptss.push({ text: element.text, value: element.value });
						});
					}

					self.editMaxAttemptsListReady(true);
				},
				function () {
					self.editMaxAttemptsListReady(true);
				}
			);
		};

		self.editAttemptPause = ko.observable();
		self.attemptPause = ko.observable();
		self.attemptPauses = ko.observableArray();

		self.editAttemptPause.subscribe(function () {
			if (self.editAttemptPause()) {
				self.onEditAttemptPause();
			} else {
				self.editAttemptPauseListReady(false);
			}
		});

		self.editAttemptPauseListReady = ko.observable(false);

		self.onEditAttemptPause = function () {

			self.attemptPauses.removeAll();

			apica.ajax.apiCallGet(
				'/ManageChecks/GetAttemptPauses',
				null,
				function (result) {

					if (result) {
						result.forEach(function (element) {
							self.attemptPauses.push({ text: element.text, value: element.value });

							if (element.value == defaultAttemptPause) {
								self.attemptPause(defaultAttemptPause);
							}
						});
					}

					self.editAttemptPauseListReady(true);
				},
				function () {
					self.editAttemptPauseListReady(true);
				}
			);
		};

		self.editUseFailoverAgent = ko.observable(false);

		self.useFailoverAgent = ko.observable();
		self.useFailoverAgent('No');

		self.useFailoverAgentBoolValue = ko.computed(function () {
			return self.useFailoverAgent() == 'Yes';
		});

		self.editWarningThreshold = ko.observable();
		self.warningThreshold = ko.observable();
		self.warningThreshold.extend({
			number: true
		});

		self.editErrorThreshold = ko.observable();
		self.errorThreshold = ko.observable();
		self.errorThreshold.extend({
			number: true,
		});

		self.runInclusionPeriod = ko.observable();
		self.editRunInclusionPeriod = ko.observable();

		self.runExclusionPeriod = ko.observable();
		self.editRunExclusionPeriod = ko.observable();
		self.executeCheckFromVisible = ko.observable(false);
		self.filterIsApplied = ko.observable(false);

		self.fprChecksEditor = new fprChecksEditorModel(self);

		self.editLocation = ko.observable(false);
		ko.computed(function() {
			if (!self.editLocation()) {
				self.fprChecksEditor.manualOverride('No');
			}
		});

		self.editLocationReady = ko.observable(false);

		self.editLocation.subscribe(function() {
			if (self.editLocation()) {
				self.onEditLocationChange();
			} else {
				self.locations = { text: '', value: 0 };
				self.location(0);
				self.editLocationReady(false);
			}
		});

		self.onEditLocationChange = function() {

			var checkType = self.checkType().toLowerCase();

			self.locations = { text: 'Please wait...', value: 0 };
			self.location(0);

			if (locationsMap[checkType] == undefined) {

				var browsersAndVersions = [];
				if (checkType === 'fpr' || checkType === 'fprxnet' || checkType === 'fprxnet:bnet') {
					browsersAndVersions = getFprBrowserVersions();
				}

				
				var checksIds = _.map(getSelectedChecksToEdit(), function (item) { return item.checkId(); });

				apica.ajax.apiCallPost(
					'/ManageChecks/GetLocations',
					{
						checkType: checkType,
						browsersAndVersions: browsersAndVersions,
						checksIds: checksIds
					},
					function(data) {

						locationsMap[checkType] = ko.mapping.fromJS(data.checksLocations, {});

						setLocationListAccordingChekType(checkType);
						self.editLocationReady(true);

						ko.mapping.fromJS(data.agentPlaces, {}, self.fprChecksEditor.agentPlaces);
					},
					function() {
						self.editLocationReady(true);
					}
				);
			} else {
				setLocationListAccordingChekType(checkType);
				self.editLocationReady(true);
			}
		}

		self.locations = ko.observableArray();
		self.location = ko.observable();

		self.isGodlikePowers = ko.observable(isGodlikePowers);

		self.checkInfoErrors = ko.validation.group({
			checkName: self.checkName,
			warningThreshold: self.warningThreshold,
			errorThreshold: self.errorThreshold,
		});

		function fprChecksEditorModel(checkEditor) {
			var fprEditor = this;

			fprEditor.agentPlaces = ko.observableArray();
			fprEditor.agentPlace = ko.observable();

			fprEditor.geoLoc = ko.observable();
			fprEditor.xNetRootUrl = ko.observable();
			fprEditor.xNetTicket = ko.observable();
			fprEditor.geoLocationFailover = ko.observable();
			fprEditor.xNetRootUrlFailover = ko.observable();
			fprEditor.XNetTicketFailover = ko.observable();
			fprEditor.OsName = ko.observable();
			fprEditor.OsVersion = ko.observable();
			fprEditor.BrowserName = ko.observable();
			fprEditor.BrowserVersion = ko.observable();
			fprEditor.TimeToLive = ko.observable();
			fprEditor.TimeoutSecs = ko.observable();
			fprEditor.ClearCookies = ko.observable();
			fprEditor.ClearCache = ko.observable();

			fprEditor.manualOverride = ko.observable();
			fprEditor.manualOverride('No');

			fprEditor.manualOverrideBoolValue = ko.computed(function() {
				return fprEditor.manualOverride() == 'Yes';
			});

			fprEditor.userAgent = ko.observable();
			fprEditor.editUserAgent = ko.observable(false);

			fprEditor.editBlockUrls = ko.observable(false);
			fprEditor.replaceBlockUrls = ko.observable(false);
			fprEditor.blockUrls = new apica.managechecks.UrlsListViewModel(fprEditor.editBlockUrls, {
				checkEmpty: true,
				checkDuplicates: true,
				checkRegexp: true
			});

			fprEditor.editAllowUrls = ko.observable(false);
			fprEditor.replaceAllowUrls = ko.observable(false);
			fprEditor.allowUrls = new apica.managechecks.UrlsListViewModel(fprEditor.editAllowUrls, {
				checkEmpty: true,
				checkDuplicates: true,
				checkRegexp: true
			});

			fprEditor.editStopUrls = ko.observable(false);
			fprEditor.replaceStopUrls = ko.observable(false);
			fprEditor.stopURLs = new apica.managechecks.UrlsListViewModel(fprEditor.editStopUrls, {
				checkEmpty: true,
				checkDuplicates: true,
			});

			fprEditor.editIgnoreStatusCode = ko.observable(false);
			fprEditor.editMimeTypes = ko.observable(false);

			fprEditor.replaceIgnoreStatusCodes = ko.observable(false);
			fprEditor.replaceIgnoreMimeTypes = ko.observable(false);

			fprEditor.ignoreStatusCodes = new apica.managechecks.StatusCodesViewModel(fprEditor.editIgnoreStatusCode, {
				checkEmpty: true,
				checkDuplicates: true,
			});

			fprEditor.ignoreMimeTypes = new apica.managechecks.StatusCodesViewModel(fprEditor.editMimeTypes, {
				checkEmpty: true,
				checkDuplicates: true,
			});

			fprEditor.isListsUpdateSelected = ko.computed(function() {
				return fprEditor.editBlockUrls() || fprEditor.editAllowUrls()
					|| fprEditor.editIgnoreStatusCode || fprEditor.editMimeTypes || fprEditor.editStopUrls();
			});

			fprEditor.populateFPRData = function(data) {
				data.userAgent = ko.utils.unwrapObservable(fprEditor.userAgent);
				data.editUserAgent = ko.utils.unwrapObservable(fprEditor.editUserAgent);

				data.blockUrls = ko.utils.arrayMap(fprEditor.blockUrls.urls(), function (element) { return element.url(); });
				data.editBlockUrls = ko.utils.unwrapObservable(fprEditor.editBlockUrls);
				data.replaceBlockUrls = ko.utils.unwrapObservable(fprEditor.replaceBlockUrls);

				data.allowUrls = ko.utils.arrayMap(fprEditor.allowUrls.urls(), function (element) { return element.url(); });
				data.editAllowUrls = ko.utils.unwrapObservable(fprEditor.editAllowUrls);
				data.replaceAllowUrls = ko.utils.unwrapObservable(fprEditor.replaceAllowUrls);

				data.stopUrls = ko.utils.arrayMap(fprEditor.stopURLs.urls(), function(element) { return element.url(); });
				data.editStopUrls = ko.utils.unwrapObservable(fprEditor.editStopUrls);
				data.replaceStopUrls = ko.utils.unwrapObservable(fprEditor.replaceStopUrls);

				data.ignoreMimeTypes = ko.mapping.toJS(fprEditor.ignoreMimeTypes.items);
				data.editMimeTypes = ko.utils.unwrapObservable(fprEditor.editMimeTypes);
				data.replaceIgnoreMimeTypes = ko.utils.unwrapObservable(fprEditor.replaceIgnoreMimeTypes);

				data.ignoreStatusCodes = ko.mapping.toJS(fprEditor.ignoreStatusCodes.items);
				data.editIgnoreStatusCode = ko.utils.unwrapObservable(fprEditor.editIgnoreStatusCode);
				data.replaceIgnoreStatusCodes = ko.utils.unwrapObservable(fprEditor.replaceIgnoreStatusCodes);


				data.useFailoverAgent = self.useFailoverAgentBoolValue();
				data.editUseFailoverAgent = ko.utils.unwrapObservable(self.editUseFailoverAgent) && !ko.utils.unwrapObservable(fprEditor.manualOverrideBoolValue);

				data.manualOverride = fprEditor.manualOverrideBoolValue();

				data.geoLocation = ko.mapping.toJS(checkEditor.location);

				data.geoLoc = fprEditor.geoLoc();
				data.xNetRootUrl = fprEditor.xNetRootUrl();
				data.xNetTicket = fprEditor.xNetTicket();
				data.geoLocationFailover = fprEditor.geoLocationFailover();
				data.xNetRootUrlFailover = fprEditor.xNetRootUrlFailover();
				data.XNetTicketFailover = fprEditor.XNetTicketFailover();
				data.OsName = fprEditor.OsName();
				data.OsVersion = fprEditor.OsVersion();
				data.BrowserName = fprEditor.BrowserName();
				data.BrowserVersion = fprEditor.BrowserVersion();
				data.TimeToLive = fprEditor.TimeToLive();
				data.TimeoutSecs = fprEditor.TimeoutSecs();
				data.ClearCookies = fprEditor.ClearCookies();
				data.ClearCache = fprEditor.ClearCache();
			};
		}

		var locationsMap = {};

		self.getFprCheckBrowserVersion = function (check) {
			var browser = self.getFprCheckBrowserVersionStructure(check);
			if (browser) {
				return browser.family + " " + browser.version;
			}
			return "firefox old";
		}

		self.getFprCheckBrowserVersionStructure = function (check) {
			var family;

			switch (check.checkTypeFriendly) {
				case 'Real Browser, Firefox':
				case 'Mobile Website':
					family = 'firefox';
					break;
				case 'Real Browser, Chrome':
					family = 'chromium';
					break;
				case 'Real Browser, Internet Explorer':
					family = 'ie';
					break;
				case 'Real Browser, Edge':
					family = 'edge';
					break;
				default:
					return null;
			}

            var version = (check.checkFriendlyVersion == "Latest Version" ? "9999999" : check.checkFriendlyVersion.replace('v', ''));

			return { family: family.trim(), version: version.trim() }
		}

		function getFprBrowserVersions() {
			var browserVersions = [];
			var checksToEdit = getSelectedChecksToEdit();
			_.each(checksToEdit, function (check) {
				var bv = self.getFprCheckBrowserVersion(check);
				if (!_.contains(browserVersions, bv) && bv.trim() !== '') {
					browserVersions.push(bv);
				}
			});

			return browserVersions;
		}

		function setLocationListAccordingChekType(checkType) {
			if (checkType != 'all') {

				self.locations = locationsMap[checkType];
				self.location(null);
				self.editLocationReady(true);
			}
		}

		self.fprCheckParamsVisible = ko.observable(false);

		// this value is selected filter by check type
		self.checkType = ko.observable();
		self.checkActivity = ko.observable();

		self.checkType.subscribe(function (currentCheckType) {
			var checkType = self.checkType().toLowerCase();
			var isFprCheck = currentCheckType == 'fpr';
			var isFprWithExecOptionsCheck = currentCheckType == 'fprxnet' || currentCheckType == 'fprxnet:bnet';

			self.fprCheckParamsVisible(isFprCheck || isFprWithExecOptionsCheck);
			self.executeCheckFromVisible(checkType != 'all');
			self.filterIsApplied(checkType != 'all');
		});

		var checksUpdateUrlsByFilter = {
			'all': '/ManageChecks/UpdateSimpleCheck',
			'fpr': '/ManageChecks/UpdateFprChecks',
			'prx': '/ManageChecks/UpdatePrxCheck',
			'fprxnet': '/ManageChecks/UpdateFprXNetChecks',
			'fprxnet:bnet': '/ManageChecks/UpdateFprBNetChecks',
			'urlxnet': '/ManageChecks/UpdateUrlXNetChecks'
		};

		var getData = function () {
			var checkType = self.checkType();
			var result = {};

			var updateModel = {};

			updateModel.name = self.checkName();
			updateModel.editName = self.editCheckName();

			updateModel.description = self.checkDescription();
			updateModel.editDescription = self.editCheckDescription();

			updateModel.interval = self.interval();
			updateModel.editInterval = self.editInterval();

			updateModel.maxAttempts = self.maxAttempts();
			updateModel.editMaxAttempts = self.editMaxAttempts();

			updateModel.attemptPause = self.attemptPause();
			updateModel.editAttemptPause = self.editAttemptPause();

			updateModel.warningThreshold = self.warningThreshold();
			updateModel.editWarningThreshold = self.editWarningThreshold();

			updateModel.errorThreshold = self.errorThreshold();
			updateModel.editErrorThreshold = self.editErrorThreshold();

			updateModel.runInclusionPeriod = self.runInclusionPeriod();
			updateModel.editRunInclusionPeriod = self.editRunInclusionPeriod();

			updateModel.runExclusionPeriod = self.runExclusionPeriod();
			updateModel.editRunExclusionPeriod = self.editRunExclusionPeriod();

			if (checkType == 'fpr' || checkType == 'fprxnet' || checkType == 'fprxnet:bnet' || checkType == 'urlxnet') {
				self.fprChecksEditor.populateFPRData(updateModel);
			}

			if (checkType == 'prx') {
				updateModel.useFailoverAgent = self.useFailoverAgentBoolValue();
				updateModel.editUseFailoverAgent = ko.utils.unwrapObservable(self.editUseFailoverAgent);
			}

			if (checkType != 'all' && self.location()) {
				updateModel.editLocation = self.editLocation();
				if (updateModel.editLocation) {
					updateModel.location = self.location().value();
				}
			}

			result.updateModel = updateModel;

			return result;
		};

		self.visibleManualOverrideControl = ko.computed(function () {
			return self.checkType() == 'fprxnet' || self.checkType() == 'urlxnet';
		});

		self.visibleUseFailoverAgent = ko.computed(function () {
			return self.checkType() == 'fprxnet' || self.checkType() == 'urlxnet' || self.checkType() == 'prx';
		});

		function updateValidation() {
			var validationOk = true;

			if (self.checkInfoErrors().length > 0) {
				self.checkInfoErrors.showAllMessages(true);
				validationOk = false;
			}

			if (self.fprChecksEditor.blockUrls.checkInfoErrors()().length > 0) {
				self.fprChecksEditor.blockUrls.checkInfoErrors().showAllMessages(true);
				validationOk = false;
			}

			if (self.fprChecksEditor.allowUrls.checkInfoErrors()().length > 0) {
				self.fprChecksEditor.allowUrls.checkInfoErrors().showAllMessages(true);
				validationOk = false;
			}

			if (self.fprChecksEditor.stopURLs.checkInfoErrors()().length > 0) {
				self.fprChecksEditor.stopURLs.checkInfoErrors().showAllMessages(true);
				validationOk = false;
			}

			if (self.fprChecksEditor.ignoreStatusCodes.checkInfoErrors()().length > 0) {
				self.fprChecksEditor.ignoreStatusCodes.checkInfoErrors().showAllMessages(true);
				validationOk = false;
			}

			if (self.fprChecksEditor.ignoreMimeTypes.checkInfoErrors()().length > 0) {
				self.fprChecksEditor.ignoreMimeTypes.checkInfoErrors().showAllMessages(true);
				validationOk = false;
			}

			return validationOk;
		}

		self.updateChecks = function () {

			if (!updateValidation()) {
				return;
			}

			if (!isThereSomeDataToSend()) {
				notifier.warning("There is no data for update. You have to check at least one field.");
				return;
			}

			var ids = getSelectedChecksToEditIds();

			if (!confirm(ids.length + ' check(s) are going to be updated. Continue?')) {
				return;
			}

			var checkType = self.checkType();

			var checkUpdateData = getData();
			checkUpdateData.checkIds = ids;
			checkUpdateData.filterType = self.checkType();

			var url;
			if (checksUpdateUrlsByFilter[checkType]) {
				url = checksUpdateUrlsByFilter[checkType];
			} else {
				url = checksUpdateUrlsByFilter['all'];
			}

			apica.ajax.apiCallPost(
				url, checkUpdateData,
				function (data) {
					var currServerCheck;
					var check;
					for (var i = 0; i < data.length; i++) {
						currServerCheck = data[i];
						apica.managechecks.helper.renameCheckFields(currServerCheck);

						check = checksInGroupsIndex[currServerCheck.checkId].check;
						check.country(currServerCheck.country);
						check.location(currServerCheck.location);
						check.name(currServerCheck.name);
						check.interval(currServerCheck.interval);
						check.thresholdWarn(currServerCheck.thresholdWarn);
						check.thresholdError(currServerCheck.thresholdError);
					}
				}
			);
		};

		var commonEditFields = [self.editCheckName, self.editCheckDescription, self.editInterval, self.editMaxAttempts, self.editAttemptPause, self.editWarningThreshold, self.editErrorThreshold, self.editRunInclusionPeriod, self.editRunExclusionPeriod];
		var commonEditFieldsWithLocation = commonEditFields.concat([self.editLocation]);
		var fprEditFields = commonEditFieldsWithLocation.concat([self.fprChecksEditor.editUserAgent, self.fprChecksEditor.editBlockUrls, self.fprChecksEditor.editAllowUrls, self.fprChecksEditor.editStopUrls, self.fprChecksEditor.editIgnoreStatusCode, self.fprChecksEditor.editMimeTypes, self.editUseFailoverAgent]);
		var fprxnetEditFields = fprEditFields;

		var prxEditFields = commonEditFieldsWithLocation.concat([self.editUseFailoverAgent]);
		var urlXnetEditFields = commonEditFieldsWithLocation.concat([self.editUseFailoverAgent]);

		var checkTypeFields = {
			'all': commonEditFields,
			'fpr': fprEditFields,
			'fprxnet': fprxnetEditFields,
			'fprxnet:bnet': fprxnetEditFields,
			'prx': prxEditFields,
			'urlxnet': urlXnetEditFields
		};

		function isThereSomeDataToSend() {
			var checkType = self.checkType();
			var checkTypeFieldsEditCollection = checkTypeFields[checkType];

			if (!checkTypeFieldsEditCollection) {
				checkTypeFieldsEditCollection = commonEditFieldsWithLocation;
			}

			for (var i = 0; i < checkTypeFieldsEditCollection.length; i++) {
				if (checkTypeFieldsEditCollection[i]()) {
					return true;
				}
			}

			return false;
		}

		$('.inclusion_help').click(function () {
			$("#divScheduleHelp").dialog({
				autoOpen: true,
				width: 520,
				modal: true,
				resizable: false,
				open: function () {
					$('.ui-dialog-buttonset').find('button').attr('class', '');
				},
				close: function () {
				}
			});
		});
	};
	
	//todo: move other bulk operation (bulkIntervalClick e.t.c) into this file
})();
