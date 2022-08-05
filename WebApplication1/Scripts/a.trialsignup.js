(function (window) {
	namespace('a.trialsignup');

	var emptyCountryText = "Select country";
	var emptyLocationText = "Select location";

	$(window).load(function () {
		$(window).resize();
	});

	$(window).resize(function () {
		var width = $(window).width();
		var header = $(".trial-signup-form-header");
		var part = $(".trial-signup-form-part");
		var fieldsExpired = $(".trial-signup-fields-container-expired");
		
		if (width < 1000) {
			header.width('100%');
			part.width('100%');
		} else {
			var dw = width / screen.width;
			var new_header_width = 100 - 3 * dw;
			var new_part_width = 100 - 20 * dw;
			var fieldsExpired_width = 100 - 65 * (dw > 0.2 ? dw : 0);
			
			header.width(new_header_width.toString() + '%');
			part.width(new_part_width.toString() + '%');
			fieldsExpired.width(fieldsExpired_width.toString() + '%');
		}
	});

	function BrowserCheckViewModel(number, locations, browserIcons) {
		var self = this;

		self.browserCheckLocations = ko.observableArray();

		self.browserCheckCaption = ko.observable("Check " + number);
		self.browserCheckName = ko.observable().extend({
			required: { message: 'The \"name\" property is required'},
			maxLength: 255
		});

		self.browserCheckUrl = ko.observable().extend({
			required: { message: 'The \"url\" property is required' },
			url: true,
			maxLength: 512
		});

		self.browserCheckLocationId = ko.observable().extend({
			validation: {
				validator: notEqual,
				message: 'Please select a location',
				params: emptyLocationText
			}
		});
		
		self.selectedBrowser = ko.observable('Chromium');

		self.browserIcons = ko.observableArray();
		
		for (var i = 0; i < browserIcons().length; i++) {
			self.browserIcons.push(new BrowserIconViewModel(self.selectedBrowser, self.browserCheckLocations, locations, browserIcons()[i]));
		}
		if (browserIcons().length > 0) {
			self.browserIcons()[0].toggleBrowser();
		}

		self.browserCheckAlerting = ko.observable();
		self.browserCheckAnalyzeReport = ko.observable();

		self.validationModel = ko.validatedObservable(
		{
			browserCheckName: self.browserCheckName,
			browserCheckUrl: self.browserCheckUrl,
			browserCheckLocationId: self.browserCheckLocationId
		});

		self.errors = ko.validation.group({
			browserCheckName: self.browserCheckName,
			browserCheckUrl: self.browserCheckUrl,
			browserCheckLocationId: self.browserCheckLocationId
		});
		
		self.needValidate = function () {
			return self.browserCheckName() || self.browserCheckUrl() || self.browserCheckLocationId() != emptyLocationText || self.browserCheckAlerting() || self.browserCheckAnalyzeReport();
		};
	}
	

	function BrowserIconViewModel(selected, browserCheckLocations, locations, icon) {
		var self = this;

		self.iconValue = ko.observable(icon.value());
		self.iconPath = ko.observable(icon.path());
		self.iconCursor = ko.observable(icon.cursor());
		self.iconTitle = ko.observable(icon.title());
		self.iconEnabled = ko.observable(icon.enabled());

		self.toggleBrowser = function () {
			if (icon.enabled()) {
				selected(icon.value());

				browserCheckLocations.removeAll();

				ko.utils.arrayForEach(locations(), function (item) {
					if (item.browser() == null || item.browser().toLowerCase() == icon.value().toLowerCase()) {
						browserCheckLocations.push(item);
					}
				});
			}
		};

		self.iconSelected = ko.computed(function () {
			return selected() == self.iconValue();
		});
	}

	function browserChecksToRequestModel(browserCheckArray) {

		var result = [];
		
		ko.utils.arrayForEach(browserCheckArray, function (item) {
			if (item.needValidate()) {
				result.push({
					name: item.browserCheckName(),
					url: item.browserCheckUrl(),
					location_code: item.browserCheckLocationId(),
					enable_alerting: item.browserCheckAlerting(),
					include_in_analyze_report: item.browserCheckAnalyzeReport()
				});
			}
		});

		return result;
	}

	function UrlCheckViewModel(number, locations) {
		var self = this;

		self.urlCheckLocations = locations;
		
		self.urlCheckCaption = ko.observable("Check " + number);

		self.urlCheckName = ko.observable().extend({
			required: { message: 'The \"name\" property is required' },
			maxLength: 255
		});

		self.urlCheckUrl = ko.observable().extend({
			required: { message: 'The \"url\" property is required' },
			url: true,
			maxLength: 512
		});

		self.urlCheckLocationId = ko.observable().extend({
			validation: {
				validator: notEqual,
				message: 'Please select a location',
				params: emptyLocationText
			}
		});
		
		self.urlCheckAlerting = ko.observable();
		self.urlCheckAnalyzeReport = ko.observable(false);

		self.validationModel = ko.validatedObservable(
		{
			urlCheckName: self.urlCheckName,
			urlCheckUrl: self.urlCheckUrl,
			urlCheckLocationId: self.urlCheckLocationId
		});

		self.errors = ko.validation.group({
			urlCheckName: self.urlCheckName,
			urlCheckUrl: self.urlCheckUrl,
			urlCheckLocationId: self.urlCheckLocationId
		});
		
		self.needValidate = function () {
			return self.urlCheckName() || self.urlCheckUrl() || self.urlCheckLocationId() != emptyLocationText || self.urlCheckAlerting() || self.urlCheckAnalyzeReport();
		};
	}

	function urlChecksToRequestModel(urlCheckArray) {

		var result = [];

		var urlregex = new RegExp("^(http|https|ftp)\://");

		ko.utils.arrayForEach(urlCheckArray, function (item) {
			if (item.needValidate()) {
				result.push({
					name: item.urlCheckName(),
					url: (urlregex.test(item.urlCheckUrl()) ? "" : "http://") + item.urlCheckUrl(),
					location_code: item.urlCheckLocationId(),
					enable_alerting: item.urlCheckAlerting(),
					include_in_analyze_report: item.urlCheckAnalyzeReport()
				});
			}
		});

		return result;
	}

	function TrialSignupViewModel(model) {
		var self = this;

		var externalLeadForm = new ExternalLeadForm(model.landingPageUrl);

		ko.mapping.fromJS(model, {}, self);

		self.password = ko.observable().extend({
			required: true,
			maxLength: 128,
			minLength: 3
		});

		self.confirmPassword = ko.observable().extend({
			required: true,
			maxLength: 128,
			minLength: 3,
			validation: {
				validator: mustEqual,
				message: 'Passwords do not match',
				params: self.password
			}
		});

		self.countryCode = ko.observable().extend({
			validation: {
				validator: notEqual,
				message: 'Please select a country',
				params: emptyCountryText
			}
		});
		
		self.timezoneId = ko.observable(model.defaultTimezoneId);

		self.browserChecks = ko.observableArray();
		self.urlChecks = ko.observableArray();

		self.alertIncluded = ko.computed(function () {
			return		_.any(self.browserChecks(), function (item) {
							return item.browserCheckAlerting();
						})
						||
						_.any(self.urlChecks(), function (item) {
							return item.urlCheckAlerting();
						});
		});
		
		self.alertEmail = ko.observable(model.alertEmail).extend({
			email_optional: self.alertIncluded,
			maxLength: 256
		});

		self.alertPhone = ko.observable(model.alertPhone).extend({
			maxLength: 256
		});

		self.reportAllCheck = ko.observable();
		self.reportDaily = ko.observable();
		self.reportWeekly = ko.observable();

		self.reportIncluded = ko.computed(function () {
			return self.reportAllCheck()
					|| _.any(self.browserChecks(), function (item) {
						return item.browserCheckAnalyzeReport();
					})
					|| _.any(self.urlChecks(), function (item) {
						return item.urlCheckAnalyzeReport();
					});
		});

		self.reportRecipients = ko.observable(model.alertEmail).extend({
			email_list: self.reportIncluded,
			maxLength: 1024
		});

		self.reportWhen = ko.observable().extend({
			validation: {
				validator: function () {
					if (self.reportIncluded() && !self.reportDaily() && !self.reportWeekly()) return false;
					return true;
				},
				message: 'Please select one or all checkboxes'
			}
		});

		self.clickAll = function () {
			if (self.reportAllCheck()) {
				var value = !self.reportDaily() || !self.reportWeekly();

				self.reportDaily(value);
				self.reportWeekly(value);
			}
		};

		self.isOnSaveProcess = ko.observable(false);

		var browserCheckViewModel = new BrowserCheckViewModel(1, self.browserCheckLocations, self.browserIcons);
		self.browserChecks.push(browserCheckViewModel);
		ko.validation.group({
			brw: browserCheckViewModel.browserCheckLocationId
		}).showAllMessages(false);
		self.addBrowserCheckButtonCaption = "Add additional check (" + (model.browserCheckCount - 1) + ")";

		var urlCheckViewModel = new UrlCheckViewModel(1, self.urlCheckLocations, self.browserIcons)
		self.urlChecks.push(urlCheckViewModel);
		ko.validation.group({
			url: urlCheckViewModel.urlCheckLocationId
		}).showAllMessages(false);
		self.addUrlCheckButtonCaption = ko.observable("Add additional check (" + (model.urlCheckCount - 1) + ")");

		self.canAddBrowserCheck = ko.computed(function() {
			return !model.browserCheckCount || self.browserChecks().length < model.browserCheckCount;
		});

		self.canAddUrlCheck = ko.computed(function() {
			return !model.urlCheckCount || self.urlChecks().length < model.urlCheckCount;
		});

		self.addBrowserCheck = function() {
			var browserCheckViewModel = new BrowserCheckViewModel(self.browserChecks().length + 1, self.browserCheckLocations, self.browserIcons);
			self.browserChecks.push(browserCheckViewModel);
			ko.validation.group({
				brw: browserCheckViewModel.browserCheckLocationId
			}).showAllMessages(false);
			self.addBrowserCheckButtonCaption = "Add additional check (" + (model.browserCheckCount - self.browserChecks().length) + ")";
		};

		self.addUrlCheck = function() {
			var urlCheckViewModel = new UrlCheckViewModel(self.urlChecks().length + 1, self.urlCheckLocations);
			self.urlChecks.push(urlCheckViewModel);
			ko.validation.group({
				url: urlCheckViewModel.urlCheckLocationId
			}).showAllMessages(false);
			self.addUrlCheckButtonCaption("Add additional check (" + (model.urlCheckCount - self.urlChecks().length) + ")");
		};

		self.canStartSaveProcess = function() {
			return !self.isOnSaveProcess();
		};

		self.needValidateAlertingEmail = function () {
			return self.alertEmail();
		};

		self.DropDownValidationGroup = ko.validation.group({
			brw: browserCheckViewModel.browserCheckLocationId,
			url: urlCheckViewModel.urlCheckLocationId,
			cnt: self.countryCode
		});

		self.validationModel = ko.validatedObservable(
		{
			password: self.password,
			confirmPassword: self.confirmPassword,
			countryCode: self.countryCode,
			email: self.alertEmail,
			reportRecipients: self.reportRecipients,
			reportWhen: self.reportWhen
		});

		self.errors = ko.validation.group({
			password: self.password,
			confirmPassword: self.confirmPassword,
			countryCode: self.countryCode,
			email: self.alertEmail,
			reportRecipients: self.reportRecipients,
			reportWhen: self.reportWhen
		});

		self.save = function() {
			if (self.canStartSaveProcess()) {

				self.isOnSaveProcess(true);

				var valid = true;

				if (!self.validationModel.isValid()) {
					valid = false;
					self.errors.showAllMessages(true);
				}

				self.browserChecks().forEach(function (check) {
					check.errors.showAllMessages(false);
					if (check.needValidate()) {
						if (!check.validationModel.isValid()) {
							valid = false;
							check.errors.showAllMessages(true);
						}
					}
				});

				self.urlChecks().forEach(function (check) {
					check.errors.showAllMessages(false);
					if (check.needValidate()) {
						if (!check.validationModel.isValid()) {
							valid = false;
							check.errors.showAllMessages(true);
						}
					}
				});

				if (valid) {

					apica.ajax.apiCall('POST', '/TrialSignup/CreateTrialSignup/',
						{
							signupCreationModel: {
								signup_token: self.signupToken(),
								country_code: self.countryCode(),
								user_password: self.password(),
								timezone_id: self.timezoneId(),

								browser_checks: browserChecksToRequestModel(self.browserChecks()),
								url_checks: urlChecksToRequestModel(self.urlChecks()),

								alert_target_email: self.alertEmail(),
								alert_target_phone: self.alertPhone(),

								report: {
									recipients: self.reportRecipients(),
									summary_enabled: self.reportAllCheck(),
									daily: self.reportDaily(),
									weekly: self.reportWeekly()
								}
							}
						},
						function (result) {
							self.isOnSaveProcess(false);
							
							$('#TrialSignupError').hide();

							var status = result && result.status ? result.status : 0;
							// todo: get rid of this messy statuses.
							if (status != 0 && status != 3) {
								// kissmetrics logging
								if (typeof _kmq !== "undefined") {
									_kmq.push(['record', 'Apica Synthetic Monitoring Trial Account Creation', { 'email': self.username(), 'username': self.username(), 'company': self.companyName() }]);
									_kmq.push(['identify', self.companyName()]);
								}
							}

							// Call external marketing form which trigers when account successfully created to add the lead to campaign.
							externalLeadForm.submit(function () {
								window.location = '/Account/GoToLoginFromTrial?status=' + status;
							});
						},
						function () {
							self.isOnSaveProcess(false);
							
							$('#TrialSignupError').show();
						});
				} else {
					self.isOnSaveProcess(false);
				}
			};
		};
	}

	function ExternalLeadForm(landingPageUrl) {
		var containerId = 'externalLeadFormContainer';
		var formTargetName = 'externalLeadFormRedirectTarget';

		$('body').append('<div style="display: none" id="' +containerId + '"></div>');
		$('body').append('<iframe style="display: none" name="' + formTargetName + '" id="' +formTargetName + '"></iframe>');

		hbspt.forms.create({
			portalId: '488396',
			formId: '483a67ce-80ad-49c6-b129-18f4bf208eb5',
			target: '#' +containerId,
			onFormReady: function ($form) {
					$form.attr('target', formTargetName);
			},
			redirectUrl: landingPageUrl
		});

		this.submit = function (handler) {
			$('iframe[name="' +formTargetName + '"]').load(function () {
				if (handler) {
					handler();
					}
				});
			$('#' + containerId + ' .hs-form .hs_submit input[type="submit"]').click();
		}
	}

	function TrialSignupExpiredViewModel() {
		var self = this;

		self.companyName = ko.observable().extend({
			required: true,
			maxLength: 128,
			minLength: 3
		});
		
		self.email = ko.observable().extend({
			required: true,
			email: true,
			maxLength: 256
		});

		self.phone = ko.observable().extend({
			maxLength: 256
		});

		self.isOnSubmitProccess = ko.observable(false);

		self.validationModel = ko.validatedObservable(
		{
			companyName: self.companyName,
			email: self.email,
		});
		
		self.errors = ko.validation.group({
			companyName: self.companyName,
			email: self.email,
		});

		self.canStartSubmitProcess = function () {
			return !self.isOnSubmitProccess();
		};

		self.sendMessage = function (data) {
			data.submit();
		};

		self.submit = function (value) {
			if (self.canStartSubmitProcess()) {

				self.isOnSubmitProccess(true);

				var valid = true;

				if (!self.validationModel.isValid()) {
					valid = false;
					self.errors.showAllMessages(true);
				};

				if (valid) {

					apica.ajax.apiCall('POST', '/TrialSignup/CreateTrialSignupToken',
						{
							signupTokenCreationModel: {
								company_name: self.companyName(),
								email: self.email(),
								phone: self.phone()
							}
						},
						function(response) {
							self.isOnSubmitProccess(false);

							self.showCreationStatus();

							if (!response) {
								self.showCreationFailed();
							}

							if (response.isCreated) {
								$('#CreatingStatusMessage').text('Your trial has been created. Please check your email for further information.');
								$('#CreatingTryAgain').hide();
							} else if (response.tokenExist) {
								$('#CreatingStatusMessage').text('The email you have entered is already registered. Please provide another email.');
								$('#CreatingTryAgain').show();
							} else if (response.userExist) {
								$('#CreatingStatusMessage').text('The email you have entered is already registered. Please provide another email.');
								$('#CreatingTryAgain').show();
							} else {
								self.showCreationFailed();
							}
						},
						function (response) {
							self.isOnSubmitProccess(false);
							self.showCreationFailed();
						});

				} else {
					self.isOnSubmitProccess(false);
				}
			}
		};

		self.showCreationStatus = function () {
			$('#CreationForm').hide();
			$('#CreatingFail').hide();
			$('#CreatingTryAgain').hide();
			$('#CreatingStatus').show();
		};

		self.showCreationFailed = function() {
			$('#CreationForm').hide();
			$('#CreatingStatus').hide();
			$('#CreatingFail').show();
			$('#CreatingTryAgain').show();
		};

		self.tryAgain = function () {
			$('#CreationForm').show();
			$('#CreatingFail').hide();
			$('#CreatingStatus').hide();
			$('#CreatingTryAgain').hide();
		};
	}

	var mustEqual = function (val, other) {
		return val == other();
	};
	
	var notEqual = function (val, other) {
		return val != other;
	};

	// expose ExternalLeadForm for test purposes only
	apica.trialsignup.__ExternalLeadForm = ExternalLeadForm;

	apica.trialsignup.initMainView = function (model) {
		apica.ui.initializeUi(function () {
			var trialSignupViewModel = new TrialSignupViewModel(model);
			ko.applyBindings(trialSignupViewModel, document.body);

			trialSignupViewModel.DropDownValidationGroup.showAllMessages(false);
		});
	};
	
	apica.trialsignup.initExpiredView = function () {
		apica.ui.initializeUi(function () {
			var trialSignupExpiredViewModel = new TrialSignupExpiredViewModel();
			
			ko.bindingHandlers.returnAction = {
				init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
					var value = ko.utils.unwrapObservable(valueAccessor());
					$(element).keyup(function (e) {
						if (e.which === 13) {
							value(viewModel);
						}
					});
				}
			};

			ko.applyBindings(trialSignupExpiredViewModel, document.body);
		});
	};

	$(document).ready(function () {
		
		ko.validation.configure({
			registerExtenders: true,
			messagesOnModified: true,
			insertMessages: false,
			parseInputAttributes: true,
			decorateElement: true,
			messageTemplate: null
		});
		
		ko.validation.rules['email_list'] = {
			validator: function (val, validate) {
				if (!validate) return true;
				if (!validate()) return true;
				if (ko.validation.utils.isEmptyVal(val)) return false;
				
				var emailrule = ko.validation.rules['email'];

				var vals = val.split(/\s*,\s*/);
				for (var i = 0; i < vals.length; i++) {
					if (!emailrule.validator(vals[i], true)) {
						return false;
					}
				}

				return true;
			},
			message: 'Please enter proper comma-separated email addresses'
		};
		
		ko.validation.rules['email_optional'] = {
			validator: function (val, validate) {
				if (!validate) return true;
				if (!validate()) return true;
				if (ko.validation.utils.isEmptyVal(val)) return false;

				var emailrule = ko.validation.rules['email'];

				return emailrule.validator(val, true);
			},
			message: 'Please enter proper email address'
		};

		ko.validation.rules['url'] = {
			async: true,
			validator: function (val, parms, callback) {
				apica.ajax.apiCallGet(apica.ajax.validation.urlOptionalProtocol + '?Url=' + encodeURIComponent(val),
					null,
					function (data) {
						callback(data);
					}
				);
			},
			message: 'URL is not valid.'
		};
		
		ko.validation.addExtender('email_list');
		ko.validation.addExtender('email_optional');
		ko.validation.addExtender('url');
	});
	
})(this);