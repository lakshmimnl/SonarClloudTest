var ManageAlerts = ManageAlerts || {};
var alertsViewModel;
var autoScreenScanDelay = 0.9 * 1000;
var timeAccumulatorLocal = 0;
var timeAccumulatorGlobal = 0;
var lastAccumulatorTimestamp = moment().utc().valueOf();
var ungroupedGroupId = -2;
var minimalSearchStringLength = 2;

function refreshContainstAlertsAllChecksViewModels(checkId) {
	_(alertsViewModel.getAllChecksViewModelById(checkId)).each(function (item) {
		item.refreshContainsAlerts();
	});
}

function bindAlertsToCheck($check) {

	var checkId = $check.attr('data-check-id');

	if ($check.find('.alerts-container').length > 0) {
		return;
	}

	var $alertsContainer =
		$check
			.find('.descr')
			.after($('#alerts-container-js-partial').text())
			.next();

	var partialModel = {
		CheckId: checkId,
		alerterFiltersForCheck: alertsViewModel.alerterFiltersForCheck,
		alerterFilterTargetsGroupedByUser: alertsViewModel.alerterFilterTargetsGroupedByUser,
		groupsForFilter: alertsViewModel.groupsForFilter,
		groupUserTargetsGroupedByUser: alertsViewModel.groupUserTargetsGroupedByUser,
		removeAlerterFilter: alertsViewModel.removeAlerterFilter,
		getTargetUserById: alertsViewModel.getTargetUserById,
		getTargetDisplayName: alertsViewModel.getTargetDisplayName
	}

	ko.applyBindings(partialModel, $alertsContainer[0]);

	delete partialModel;
}

function addCreateAlertIconToCheck($check) {

	$check
		.find('input[name=checks]')
		.after($('#add-target-js-partial').text());
}

function bindEnableDisableButtonsToCheck(groupId, $check) {

	var checkId = $check.attr('data-check-id');

	var $buttons =
		$check
			.find('input[name=checks]')
			.next()
			.after($('#enable-disable-alert-js-partial').text())
			.next();

	var check = alertsViewModel.getSubGroup(groupId).getCheckById(checkId);

	var partialModel = {
		partiallyEnabled: check.partiallyEnabled,
		enabledAlert: check.enabledAlert,
		enableCheck: check.enableCheck,
		disableCheck: check.disableCheck,
		containsAlerts: check.containsAlerts
	}

	ko.applyBindings(partialModel, $buttons[0]);

	delete partialModel;
}

function showCheckSelectedChaeckbox($check) {
	$check.find('input[name=checks]').show();
}

function getElementsForUpdatingOnScreen() {
	var result = [];
	var windowHeight = $(window).height();
	var windowScrollTop = $(window).scrollTop();

	$('.project').each(function () {
		var $subGroup = $(this);

		if ($subGroup.is(':visible') && $subGroup.hasClass('open')) {
			var subGroupPosOnScreeStart = $subGroup.offset().top - windowScrollTop;
			var subGroupPosOnScreeEnd = subGroupPosOnScreeStart + $subGroup.height();

			if (subGroupPosOnScreeStart < windowHeight && subGroupPosOnScreeEnd > 0) {

				var checkIds = [];
				var checkIdsWithAlerts = [];

				$subGroup.find('.check').each(function () {
					var $check = $(this);

					if ($check.is(':visible') && !$check.is('[binded]')) {
						var checkPosOnScreeStart = $check.offset().top - windowScrollTop;
						var checkPosOnScreeEnd = checkPosOnScreeStart + $check.height();

						if (checkPosOnScreeStart < windowHeight && checkPosOnScreeEnd > 0) {

							var checkId = $check.attr('data-check-id');

							checkIds.push(checkId);

							if (_.any(alertsViewModel.alerterFilters(),
								function(alerterFilter) {
									return alerterFilter.CheckId == checkId;
								})) {
								checkIdsWithAlerts.push(checkId);
							};
						}
					}
				});

				if (checkIds.length > 0) {
					result.push({ groupElement: $subGroup, checkIds: checkIds, checkIdsWithAlerts: checkIdsWithAlerts });
				}
			}
		}
	});

	return result;
}

function updateChecksWithAlertsOnScreen() {

	var elementsForUpdatingOnScreen = getElementsForUpdatingOnScreen();

	if (_.any(elementsForUpdatingOnScreen, function(group) { return group.checkIds && group.checkIds.length > 0; })) {
		
		$('#ajaxBusyBottom').fadeIn(50,
			function() {
				window.setTimeout(function() {
						$('#ajaxBusyBottom').fadeOut(200);
					},
					200);
			});

		for (var i = 0; i < elementsForUpdatingOnScreen.length; i++) {

			var $groupForUpdate = elementsForUpdatingOnScreen[i].groupElement;

			var checkIds = elementsForUpdatingOnScreen[i].checkIds;
			var checkIdsWithAlerts = elementsForUpdatingOnScreen[i].checkIdsWithAlerts;
			var groupId = $groupForUpdate.find('input.monitorGroupCheckBox').attr('value');

			for (var j = 0; j < checkIds.length; j++) {

				var checkId = checkIds[j];
				var $check = $groupForUpdate.find('.check[data-check-id=' + checkId + ']');

				addCreateAlertIconToCheck($check);

				bindEnableDisableButtonsToCheck(groupId, $check);

				if (_.contains(checkIdsWithAlerts, checkId)) {
					bindAlertsToCheck($check);
				}

				showCheckSelectedChaeckbox($check);

				$check.attr('binded', '');
			}
		}
	}
}

utils = apica.managealerts.utils;

ManageAlerts.Alerts = (function () {

	function relocateAlertForm() {
		var $newAlertForm = $("#newAlertForm");
		$newAlertForm.data("alerterFilter-id", 0);
		$newAlertForm.appendTo($('#alerts-container'));
		$newAlertForm.slideUp();
	}

	function initSelect2Targets() {
		var $alertTargetsSelector = $('#AlertTargetsSelectorModel');
		var users = _.sortBy(alertsViewModel.alerterTargetUsers(), function (item) { return item.Name.toLowerCase(); });

		$alertTargetsSelector.select2('destroy');

		$alertTargetsSelector.select2({
			allowClear: true,
			multiple: true,
			closeOnSelect: false,
			width: '380px',
			data: _.map(users, function (user) {
				var targets = _.flatten(_.map(_.groupBy(alertsViewModel.targetsForUser(user), function (item) { return item.TargetType; }), function (group) {
					return _.sortBy(group, function (groupItem) { return groupItem.TargetName.toLowerCase(); });
				}));

				return {
					text: user.Name,
					children: _.map(targets, function (target) {
						return {
							id: target.Id,
							type: target.TargetType,
							iconUrl: alerting.getTargetTypeImageUrl(target.TargetType),
							userName: user.Name,
							text: target.TargetName + " (" + target.targetDisplayValue() + ")"
						}
					})
				}
			}),
			query: function (query) {
				var searchText = (query.term || '').toLowerCase().trim();

				var data = { results: [] };

				for (var i = 0; i < this.data.length; i++) {
					var group = this.data[i];

					if (group.text.toLowerCase().trim().indexOf(searchText) !== -1) {
						data.results.push(group);
						continue;
					}

					var possibleGroupToAdd = { text: group.text, children: [] };
					for (var j = 0; j < group.children.length; j++) {
						var child = group.children[j];

						if (child.text.toLowerCase().trim().indexOf(searchText) !== -1) {
							possibleGroupToAdd.children.push(child);
						}
					}

					if (possibleGroupToAdd.children.length > 0) {
						data.results.push(possibleGroupToAdd);
					}
				}

				query.callback(data);
			},
			formatResult: function (item) {
				if (item.children) {
					return "<div class='alert-targets-selector__recipient-option'>" +
						"<img src='/Assets/Themes/FiveMonkeys/Images/user_single.png' />" +
						"<label>" + _.escape(item.text) + "</label>" +
						"</div>";
				} else {
					return "<div class='alert-targets-selector__target-option'>" +
						"<div><img src='" + item.iconUrl + "'/></div>" +
						"<label>" + _.escape(item.text) + "</label>" +
						"</div>";
				}
			},
			formatSelection: function (item) {
				if (!item || item.length === 0) {
					return "";
				}
				return "<div title='" + _.escape(item.userName) + ': ' + _.escape(item.text) + "' class='alert-targets-selector__selected-option'>" +
					"<img src='/Assets/Themes/FiveMonkeys/Images/user_single.png' />" +
					"<span>" + _.escape(item.userName) + ": </span>" +
					"<img src='" + item.iconUrl + "' />" +
					"<label>" + _.escape(item.text) + "</label>" +
					"<input type='hidden' name='" + alerting.getTargetTypeText(item.type) + "' value='" + item.id + "' />" +
					"</div>";
			}
		});

		$alertTargetsSelector.select2('data', null);
	}

	function initSelect2Groups() {
		var $alertGroupsSelector = $('#AlertGroupsSelectorModel');
		var targetGroups = _.sortBy(alertsViewModel.targetGroups(), function (item) { return item.Name.toLowerCase(); });

		$alertGroupsSelector.select2('destroy');

		$alertGroupsSelector.select2({
			allowClear: true,
			multiple: true,
			closeOnSelect: false,
			width: '380px',
			data: _.map(targetGroups, function (targetGroup) {
				return {
					id: targetGroup.Id,
					text: targetGroup.Name
				}
			}),
			formatResult: function (item) {
				return "<div class='alert-groups-selector__target-option'>" +
					"<img src='/Assets/Themes/FiveMonkeys/Images/user_multiple.png' />" +
					"<label>" + _.escape(item.text) + "</label>" +
					"</div>";
			},
			formatSelection: function (item) {
				if (!item || item.length === 0) {
					return "";
				}
				return "<div title='" + _.escape(item.text) + "' class='alert-groups-selector__selected-option'>" +
					"<img src='/Assets/Themes/FiveMonkeys/Images/user_multiple.png' />" +
					"<span>" + _.escape(item.text) + "</span>" +
					"<input type='hidden' name='groups' value='" + item.id + "' />" +
					"</div>";
			}
		});

		$alertGroupsSelector.select2('data', null);
	}

	function isEnabledCheck(check, alertsViewModel) {
		var alertersFiltersForCheck = alertsViewModel.alerterFiltersForCheck(check.CheckId);
		var isAllEnabled = !_(alertersFiltersForCheck).some(function (item) { return !item.Enabled; });
		return isAllEnabled;
	}

	function isPartiallyEnabledCheck(check, alertsViewModel) {
		var alertersFiltersForCheck = alertsViewModel.alerterFiltersForCheck(check.CheckId);
		var hasEnabled = _.any(alertersFiltersForCheck, function (item) { return item.Enabled });
		var hasDisabled = _.any(alertersFiltersForCheck, function (item) { return !item.Enabled });
		return hasEnabled && hasDisabled;
	}

	function enableTarget(value, checks, alertsViewModel) {
		return apica.ajax.apiCallPost(
			"/ManageAlerts/EnableCheckAlerts",
			{
				enable: value,
				checksIds: _(checks).map(function (item) { return item.CheckId; })
			},
			function (data) {
				_(checks).each(function (check) {
					var alertersFiltersForCheck = alertsViewModel.alerterFiltersForCheck(check.CheckId);

					_(alertersFiltersForCheck).each(function (item) {
						var isUpdated = _(data.updatedAlertsIds).some(function (updatedItem) { return updatedItem == item.Id; });
						if (isUpdated) {
							var changedAlertIndex = _.indexOf(alertsViewModel.alerterFilters(), function (filter) { return filter.Id == item.Id; });
							item.Enabled = value;
							alertsViewModel.alerterFilters.remove(alertsViewModel.alerterFilters()[changedAlertIndex]);
							alertsViewModel.alerterFilters.push(item);
						}
					});

					check.refreshStatus();
				});

				notifier.success("Check Alerts were successfully " + ((value) ? "enabled" : "disabled"));
			}
		);
	}

	function getCheckForGroup(group, context) {

		group.checksLoading(true);

		var data = group.Id !== ungroupedGroupId
			? { groupId: group.Id }
			: null;

		return $.ajax({
			url: "/ManageAlerts/AlertsByGroup",
			type: "GET",
			data: data,
			success: function (result) {
				if (result) {

					relocateAlertForm();

					if (result.AlerterFilters) {
						var existingAlerterFilterIds = _.map(context.alerterFilters(), function (alerterFilter) { return alerterFilter.Id; });
						var newAlerterFilters = _.filter(result.AlerterFilters, function (alerterFilter) { return !_.contains(existingAlerterFilterIds, alerterFilter.Id); });

						_.each(newAlerterFilters, function (alerterFilter) { context.alerterFilters.push(alerterFilter); });
					}

					var index = 0;
					ko.mapping.fromJS(
						result.Checks,
						{
							create: function (check) {
								if (group.Id === ungroupedGroupId) {
									check.data.MonitorGroupId = ungroupedGroupId;
								}
								context.checks.splice(index, 0, new CheckViewModel(check.data, context));
								index++;
							}
						}
					);

					var newSubGroup = new SubGroupViewModel({
						Id: group.Id,
						ParentGroupId: group.ParentGroupId,
						Descriptor: group.Descriptor,
						ChecksCount: result.Checks.length,
					}, context);

					newSubGroup.checksLoading(false);
					newSubGroup.checksLoaded(true);
					newSubGroup.isOpened = true;

					var topGroup = context.getTopGroup(group.ParentGroupId);
					var indexOfGroup = _.map(topGroup.subGroups(), function(subGroup) { return subGroup.Id; }).indexOf(group.Id);

					topGroup.subGroups.splice(indexOfGroup, 1, newSubGroup);

					context.applyFilter();
				} else {
					notifier.error(result.Message);
				}

				group.checksLoading(false);
			}
		});
	}

	function CheckViewModel(data, alertsViewModel) {
		var self = this;
		$.extend(self, data);

		self.CheckDescriptorWithLocation = self.CheckDescriptor + ' (' + self.Location + ')';
		self.FullCheckTypeImageUrl = apica.ui.settings.imagesChecktypeFolder + self.CheckTypeImageUrl;
		self.FullCountryImageUrl = apica.ui.settings.imagesCountryFolder + self.Country + '.gif';

		self.forceShow = ko.observable(false);

		self.isFiltered = ko.observable(false);

		self.disableCheck = function () {
			enableTarget(false, [self], alertsViewModel);
		};

		self.enableCheck = function () {
			enableTarget(true, [self], alertsViewModel);
		};

		self.enabledAlert = ko.observable(true);
		self.partiallyEnabled = ko.observable(false);
		self.checked = ko.observable();

		self.notifyCheckedChange = function () {
			var monitorGroup = alertsViewModel.getSubGroup(self.MonitorGroupId);
			monitorGroup.notifyCheckedChange();
		}

		self.containsAlerts = ko.observable();

		self.refreshStatus = function () {
			self.enabledAlert(isEnabledCheck(self, alertsViewModel));
			self.partiallyEnabled(isPartiallyEnabledCheck(self, alertsViewModel));
		};

		self.refreshContainsAlerts = function () {
			var isContainAlerts = alertsViewModel.alerterFiltersForCheck(self.CheckId).length > 0;
			self.containsAlerts(isContainAlerts);
			var monitorGroup = alertsViewModel.getSubGroup(self.MonitorGroupId);
			if (monitorGroup) {
				monitorGroup.recountAlerts();

				if (!isContainAlerts) {
					monitorGroup.notifyCheckedChange();
				}
			}
			self.refreshStatus();
		};

		self.containsAlerts(alertsViewModel.alerterFiltersForCheck(self.CheckId).length > 0);
		self.refreshStatus();
	};

	function TopGroupViewModel(topGroupData, alertsViewModel, subGroups) {
		var self = this;
		$.extend(self, topGroupData);

		self.subGroups = ko.observableArray();

		ko.mapping.fromJS(
			subGroups,
			{
				create: function (group) {
					return new SubGroupViewModel(group.data, alertsViewModel);
				}
			},
			self.subGroups
		);

		self.subGroupsVisible = ko.observableArray();

		self.extendedDescriptor = ko.observable('');
	};

	function SubGroupViewModel(subGroupData, alertsViewModel) {
		var self = this;
		$.extend(self, subGroupData);

		self.checksInGroup = alertsViewModel.monitorGroupChecks(self.Id);

		function isChecksContainAlerts(checks) {
			var sumOfAlertsChecks =
				_(checks)
					.map(function (item) { return alertsViewModel.alerterFiltersForCheck(item.CheckId).length })
					.reduce(function (memo, num) { return memo + num; }, 0);

			return sumOfAlertsChecks > 0;
		}

		self.containsAlerts = ko.observable();
		self.isChecksSelected = ko.observable(false);
		self.checked = ko.observable();

		self.recountAlerts = function () {
			var checks = self.checksInGroup;
			var checksContainAlerts = isChecksContainAlerts(checks);
			self.containsAlerts(checksContainAlerts);
		}

		self.recountAlerts();

		self.notifyCheckedChange = function () {
			var checks = alertsViewModel.monitorGroupChecks(self.Id);

			var isChecksSelected = _(checks).filter(function (item) {
				return alertsViewModel.alerterFiltersForCheck(item.CheckId).length > 0;
			}).some(function (item) {
				return item.checked() && !item.isFiltered();
			});
			self.isChecksSelected(isChecksSelected);
		};
		
		self.checksVisible = ko.observableArray();

		self.getCheckById = function (id) {
			var checks = _.filter(self.checksInGroup, function (check) {
				return check.CheckId == id;
			});

			return checks[0];
		};

		self.isOpened = false;

		self.checksLoading = ko.observable(false);
		self.checksLoaded = ko.observable(false);

		self.extendedDescriptor = ko.observable('');
	}

	var AlertsViewModel = function (model) {
		var self = this;
		var cliCommands = model.cliCommands;

		self.extendTargets = function (targets) {
			ko.utils.arrayForEach(targets, function (item) {
				item.isVisible = function () {
					return item.TargetType !== TargetType.CLI || isCommandExists(item.DisplayValue, cliCommands);
				}

				item.targetDisplayValue = function () {
					var self = this;

					if (self.TargetType === TargetType.CLI) {
						var neededCliCommands = ko.utils.arrayFilter(cliCommands, function (item) {
							return item.Command === self.DisplayValue;
						});

						if (neededCliCommands.length > 0) {
							return neededCliCommands[0].DisplayName;
						}

						return '';
					}

					return self.DisplayValue;
				};
			});
		};

		self.checksIndex = model.checksIndex;

		self.filterCheckNameValue = ko.observable('');
		self.filterObject = {};
		self.isFilterObjectEmpty = function (filterObject) {
			return (!filterObject.searchString || filterObject.searchString.length < minimalSearchStringLength) &&
				(!filterObject.includeCheckTypes || filterObject.includeCheckTypes.length === 0) &&
				(!filterObject.excludeCheckTypes || filterObject.excludeCheckTypes.length === 0) &&
				(!filterObject.includeLocations || filterObject.includeLocations.length === 0) &&
				(!filterObject.excludeLocations || filterObject.excludeLocations.length === 0) &&
				(!filterObject.includeGroupIds || filterObject.includeGroupIds.length === 0) &&
				(!filterObject.excludeGroupIds || filterObject.excludeGroupIds.length === 0) &&
				(!filterObject.includeTagIds || filterObject.includeTagIds.length === 0) &&
				(!filterObject.excludeTagIds || filterObject.excludeTagIds.length === 0); 
		}

		self.topGroups = ko.observableArray();
		self.checks = ko.observableArray();

		self.alerterFilters = ko.observableArray();
		self.alerterFilters(model.alerterFilters);

		self.extendTargets(model.targets);

		self.targets = ko.observableArray(model.targets);
		self.alerterTargetUsers = ko.observableArray(model.alerterTargetUsers);
		self.targetGroups = ko.observableArray(model.targetGroups);

		self.pagerDutyServices = ko.observableArray(model.pagerDutyServices);

		self.topGroupsVisible = ko.observableArray();

		self.monitorGroupChecks = function (monitorGroupId) {
			return _.filter(self.checks(), function (check) { return check.MonitorGroupId == monitorGroupId; });
		};

		self.checkById = function (checkId) {
			return _(self.checks()).find(function (check) { return check.CheckId == checkId; });
		};

		self.getAllChecksViewModelById = function (checkId) {
			return _(self.checks()).filter(function (check) { return check.CheckId == checkId; });
		};

		self.getTopGroup = function (topGroupId) {
			return _.find(self.topGroups(), function (group) {
				return group.Id == topGroupId;
			});
		};

		self.getSubGroup = function (subGroupId) {
			for (var i = 0; i < self.topGroups().length; i++) {
				var subGroups = self.topGroups()[i].subGroups();
				for (var j = 0; j < subGroups.length; j++) {
					var subGroup = subGroups[j];
					if (subGroup.Id == subGroupId) {
						return subGroup;
					}
				}
			}
		};

		self.getTargetUserById = _.memoize(function (userId) {
			if (userId === "undefined")
				return { Name: "(no user)" };

			var user = _.find(self.alerterTargetUsers(), function (user) {
				return parseInt(user.Id, 10) === parseInt(userId, 10);
			});
			if (typeof (user) === "undefined") {
				return { Name: "(no user)" };
			}

			return user;
		});

		self.alerterFilterTargetsGroupedByUser = function (alerterFilter) {
			var targetsGrouped = _.chain(self.targets()).filter(function (target) {
				return _.some(alerterFilter.AlerterFilterTargets, function (filterTarget) {
					return (target.TargetType === TargetType.SMTP && filterTarget.SmtpTargetId === parseInt(target.Id, 10))
						|| (target.TargetType === TargetType.SMS && filterTarget.SmsTargetId === parseInt(target.Id, 10))
						|| (target.TargetType === TargetType.PAGERDUTY && filterTarget.PagerdutyTargetId === parseInt(target.Id, 10))
						|| (target.TargetType === TargetType.CLI && filterTarget.CliTargetId === parseInt(target.Id, 10))
						|| (target.TargetType === TargetType.WEBHOOK && filterTarget.WebhookTargetId === parseInt(target.Id, 10));
				});
			}).groupBy(function (target) { return target.Users[0]; /* We can assume a target only have one user */ })
				.value();

			var userTargets = [];

			for (var key in targetsGrouped) {
				userTargets.push({ userId: key, targets: targetsGrouped[key], alerterFilterId: alerterFilter.Id });
			}

			return _.sortBy(userTargets, function (userTarget) {
				return self.getTargetUserById(userTarget.userId).Name.toLowerCase().trim();
			});
		};
		self.groupsForFilter = function (alerterFilterTargetGroup) {
			return _.filter(self.targetGroups(), function (targetGroup) {
				return parseInt(targetGroup.Id, 10) === alerterFilterTargetGroup.TargetGroupId;
			});
		};

		self.alerterFiltersForCheck = function (checkId) {

			var alerterFilters = _.filter(self.alerterFilters(), function (alerterFilter) {
				return alerterFilter.CheckId == parseInt(checkId, 10);
			});

			for (var i = 0; i < alerterFilters.length; i++) {
				var alerterFilter = alerterFilters[i];

				alerterFilter.AlerterFilterTargetGroups = _.sortBy(alerterFilter.AlerterFilterTargetGroups, function (alerterFilterTargetGroup) {
					return self.groupsForFilter(alerterFilterTargetGroup)[0].Name.toLowerCase().trim();
				});
			}

			var sortedAlerterFilters = _.sortBy(alerterFilters, function (alerterFilter) {

				var alerterFilterTargetsGroupedByUser = self.alerterFilterTargetsGroupedByUser(alerterFilter)[0];
				if (alerterFilterTargetsGroupedByUser) {
					return self.getTargetUserById(alerterFilterTargetsGroupedByUser.userId).Name.toLowerCase().trim();
				}

				var alerterFilterTargetGroups = alerterFilter.AlerterFilterTargetGroups[0];
				if (alerterFilterTargetGroups) {
					return self.groupsForFilter(alerterFilterTargetGroups)[0].Name.toLowerCase().trim();
				}
			});

			return sortedAlerterFilters;
		};

		ko.mapping.fromJS(
			model.checks,
			{
				create: function (check) {
					return new CheckViewModel(check.data, self);
				}
			},
			self.checks
		);

		var topGroups = _.filter(model.monitorGroups, function (group) {
			return group.Root == 1;
		});

		ko.mapping.fromJS(
			topGroups,
			{
				create: function (topGroup) {
					var subGroups = _.filter(model.monitorGroups, function (group) {
						return group.ParentGroupId && group.ParentGroupId == topGroup.data.Id;
					});

					return new TopGroupViewModel(topGroup.data, self, subGroups);
				}
			},
			self.topGroups
		);

		self.targetsForUser = function (alerterTargetUser) {
			return _.filter(self.targets(), function (target) {
				return _.some(alerterTargetUser.AlerterTargetUsersMappings, function (targetUserMapping) {
					return targetUserMapping.TargetId === parseInt(target.Id, 10) && targetUserMapping.TargetType === target.TargetType;
				});
			});
		};

		self.groupUserTargetsGroupedByUser = function (alerterTargetGroup) {
			var userTargets = [];

			if (alerterTargetGroup.AlerterTargetGroupsMappings.length === 0) {
				return userTargets;
			}

			var targetsGrouped = _.chain(self.targets()).filter(function (target) {
				return _.some(alerterTargetGroup.AlerterTargetGroupsMappings, function (targetMapping) {
					return (targetMapping.TargetId === parseInt(target.Id, 10) && targetMapping.TargetType === target.TargetType);
				});
			}).groupBy(function (target) { return target.Users[0]; /* We can assume a target only have one user */ })
				.value();

			for (var key in targetsGrouped) {
				userTargets.push({ userId: key, targets: targetsGrouped[key] });
			}

			return _.sortBy(userTargets, function (userTarget) {
				return self.getTargetUserById(userTarget.userId).Name.toLowerCase().trim();
			});
		};

		self.removeAlerterFilter = function (alerterFilterId, checkId) {
			var data = { 'alerterFilterId': alerterFilterId, 'checkId': checkId };
			return function () {
				utils.deleteConfirmDialog("Are you sure you want to delete this Recipient from the Alert?", "Delete Recipient from Alert", function () {
					ManageAlerts.Server.removeAlerterFilter(data, function (result) {
						self.alerterFilters.remove(function (alerterFilter) {
							return alerterFilter.Id === alerterFilterId;
						});

						self.alerterFilters.notifySubscribers();
						refreshContainstAlertsAllChecksViewModels(checkId);

						alertsViewModel.updateChecksIndex([checkId]);
						alertsViewModel.applyFilter();
					});
				});
			};
		};

		self.removeSelectedAlertersFilters = function (monitorGroup) {
			return function () {
				utils.deleteConfirmDialog("Are you sure you want to delete Recipients from the selected Alerts?", "Delete Recipients from Alerts", function () {

					var checkAlertIds = [];
					var checks = checksWithAlerts(monitorGroup).filter(function (check) { return check.checked() && !check.isFiltered(); });

					for (var i = 0; i < checks.length; i++) {
						var check = checks[i];

						var alertIds = _.map(self.alerterFiltersForCheck(check.CheckId), function (alert) {
							return alert.Id;
						});

						checkAlertIds.push({ Key: check.CheckId, Value: alertIds });
					}

					apica.ajax.apiCallPost(
						"/ManageAlerts/RemoveAlertersFilters",
						checkAlertIds,
						function (result) {

							var checkIds = [];

							for (var index in checkAlertIds) {
								var key = checkAlertIds[index].Key;
								var value = checkAlertIds[index].Value;
								for (var alerterIndex in value) {
									var alerterId = value[alerterIndex];

									self.alerterFilters.remove(function (alerterFilter) {
										checkIds.push(alerterFilter.CheckId);
										return alerterFilter.Id === alerterId;
									});

									self.alerterFilters.notifySubscribers();
									refreshContainstAlertsAllChecksViewModels(key);
								}
							};

							alertsViewModel.updateChecksIndex(checkIds);
							alertsViewModel.applyFilter();

							if (checkAlertIds && checkAlertIds.length) {
								monitorGroup.notifyCheckedChange();
							}
						}
					);
				});
			};
		};

		self.addAlertFilters = function (alertFilters) {
			self.alerterFilters.push.apply(self.alerterFilters, alertFilters);

			ManageAlerts.Server.getTargets(function (targets) {
				self.targets = ko.observableArray(targets);
				self.alerterFilters.notifySubscribers();
			});
		};

		self.getTargetDisplayName = function (target) {
			if (target.TargetType === TargetType.PAGERDUTY) {
				return alerting.getPagerDutyServiceName(target.DisplayValue, self.pagerDutyServices());
			} else {
				return target.DisplayValue;
			}
		};

		function checksWithAlerts(monitorGroup) {
			return _(self.monitorGroupChecks(monitorGroup.Id)).filter(function (check) { return check.containsAlerts(); });
		}

		self.enableAllChecksInGroup = function (monitorGroup) {
			var checks = checksWithAlerts(monitorGroup);

			enableTarget(true, checks, self);
		};

		self.disableAllChecksInGroup = function (monitorGroup) {
			var checks = checksWithAlerts(monitorGroup);

			enableTarget(false, checks, self);
		};

		self.enableSelectedChecksInGroup = function (monitorGroup) {
			var checks = checksWithAlerts(monitorGroup).filter(function (check) { return check.checked() && !check.isFiltered(); });

			enableTarget(true, checks, self);
		};

		self.disableSelectedChecksInGroup = function (monitorGroup) {
			var checks = checksWithAlerts(monitorGroup).filter(function (check) { return check.checked() && !check.isFiltered(); });

			enableTarget(false, checks, self);
		};

		self.clickOnSubGroup = function (group) {
			if (!group.checksLoading() && !group.checksLoaded()) {
				getCheckForGroup(group, self);
			}

			group.isOpened = !group.isOpened;

			if (group.isOpened) {
				filtrateChecks(group.checksInGroup, self.filterObject);
			}
		}

		self.applyFilter = function () {

			relocateAlertForm();

			filtrateChecks(self.checks(), self.filterObject);
		}

		self.GetCheckIdsForAlerterFilters = function(alerterFilterIds) {
			var alerterFilters = _.filter(self.alerterFilters, function(alerterFilter) {
				return _.contains(alerterFilterIds, alerterFilter.Id);
			});

			return _.map(alerterFilters, function(alerterFilter) {
				return alerterFilter.CheckId;
			});
		};

		self.isCheckVisibleAfterFiltrating = function (groupId, checkId, filterObject) {
			return  self.checksIndex[groupId] &&
					self.checksIndex[groupId][checkId] &&
					!needToHideCheck(self.checksIndex[groupId][checkId], filterObject);
		};

		self.countVisibleChecksInGroupAfterIndexFiltrating = function (groupId, filterObject) {
			return _.filter(alertsViewModel.checksIndex[groupId], function (checkIndex) {
				return !needToHideCheck(checkIndex, filterObject);
			}).length;
		};
		
		self.updateChecksIndex = function (checkIds) {

			checkIds = _.uniq(checkIds);

			for (var i = 0; i < checkIds.length; i++) {

				var checkId = checkIds[i];

				var checksWithSpecifiedId = _.filter(self.checks(), function (check) { return check.CheckId == checkId; });

				if (checksWithSpecifiedId.length === 0) continue;

				var checkWithSpecifiedId = checksWithSpecifiedId[0];

				var alerterFilters = self.alerterFiltersForCheck(checkId);

				var alerterFilterTargetGroups = _.flatten(_.pluck(alerterFilters, 'AlerterFilterTargetGroups'));
				var alerterFilterTargets = _.flatten(_.pluck(alerterFilters, 'AlerterFilterTargets'));

				// Groups
				var targetGroupIds = _.map(alerterFilterTargetGroups, function (group) { return group.TargetGroupId; });
				var targetGroups = _.filter(self.targetGroups(), function (group) { return _.contains(targetGroupIds, group.Id); });

				// Targets
				var groupCliTargetIds = _.uniq(_.map(_.flatten(_.pluck(targetGroups, 'AlerterCliTargetGroups')), function(target) { return target.CliTarget; }));
				var groupPagerDutyTargetIds = _.uniq(_.map(_.flatten(_.pluck(targetGroups, 'AlerterPagerDutyTargetGroups')), function (target) { return target.PagerdutyTargetId; }));
				var groupSmsTargetIds = _.uniq(_.map(_.flatten(_.pluck(targetGroups, 'AlerterSmsTargetGroups')), function (target) { return target.SmsTargetId; }));
				var groupSmtpTargetIds = _.uniq(_.map(_.flatten(_.pluck(targetGroups, 'AlerterSmtpTargetGroups')), function (target) { return target.SmtpTargetId; }));
				var groupWebHookTargetIds = _.uniq(_.map(_.flatten(_.pluck(targetGroups, 'AlerterWebHookTargetGroups')), function (target) { return target.WebhookTargetId; }));

				var cliTargetIds = _.uniq(_.map(_.filter(alerterFilterTargets, function (target) { return target.CliTargetId; }), function (target) { return target.CliTargetId; }));
				var pagerDutyTargetIds = _.uniq(_.map(_.filter(alerterFilterTargets, function (target) { return target.PagerdutyTargetId; }), function (target) { return target.PagerdutyTargetId; }));
				var smsTargetIds = _.uniq(_.map(_.filter(alerterFilterTargets, function (target) { return target.SmsTargetId; }), function (target) { return target.SmsTargetId; }));
				var smtpTargetIds = _.uniq(_.map(_.filter(alerterFilterTargets, function (target) { return target.SmtpTargetId; }), function (target) { return target.SmtpTargetId; }));
				var webHookTargetIds = _.uniq(_.map(_.filter(alerterFilterTargets, function (target) { return target.WebhookTargetId; }), function (target) { return target.WebhookTargetId; }));

				var targets = _.filter(self.targets(),
					function(target) {
						return	target.TargetType === TargetType.CLI && _.contains(_.flatten([groupCliTargetIds, cliTargetIds]), target.Id) ||
								target.TargetType === TargetType.PAGERDUTY && _.contains(_.flatten([groupPagerDutyTargetIds, pagerDutyTargetIds]), target.Id) ||
								target.TargetType === TargetType.SMS && _.contains(_.flatten([groupSmsTargetIds, smsTargetIds]), target.Id) ||
								target.TargetType === TargetType.SMTP && _.contains(_.flatten([groupSmtpTargetIds, smtpTargetIds]), target.Id) ||
								target.TargetType === TargetType.WEBHOOK && _.contains(_.flatten([groupWebHookTargetIds, webHookTargetIds]), target.Id);
					});

				// Users
				var userIds = _.uniq(_.flatten(_.pluck(targets, 'Users')));
				var users = _.filter(self.alerterTargetUsers(), function (user) { return _.contains(userIds, user.Id); });

				var words = [];

				words.push(checkWithSpecifiedId.CheckDescriptor.toLowerCase());
				if (checkWithSpecifiedId.Target) {
					words.push(checkWithSpecifiedId.Target.toLowerCase());
				}
				for (var index in targetGroups) { words.push(targetGroups[index].Name.toLowerCase()); }
				for (var index in targets) { words.push(targets[index].TargetName.toLowerCase()); }
				for (var index in users) { words.push(users[index].Name.toLowerCase()); }

				var checkIndex = _.uniq(words).join(String.fromCharCode(65520));

				for (var monitorGroupId in self.checksIndex) {
					if (self.checksIndex[monitorGroupId][checkId]) {
						self.checksIndex[monitorGroupId][checkId].E = checkIndex;
					}
				}
			}
		};

		$.subscribe(apica.filter.ApplyFilterTopic, function (obj, filter) {
			self.filterObject = filter;
			self.applyFilter();
		});

		self.filterCheckName = ko.computed(function () {
			self.filterObject = { searchString: self.filterCheckNameValue() };
			return self.filterObject.searchString;
		}).extend({ throttle: 500 });

		self.filterCheckName.subscribe(self.applyFilter);

		self.alerterFilters().forEach(function (alerterFilter) {
			if (alerterFilter.AlerterFilterTargetGroups && alerterFilter.AlerterFilterTargetGroups.length) {
				alerterFilter.AlerterFilterTargetGroups = _.sortBy(alerterFilter.AlerterFilterTargetGroups, function (alerterFilterTargetGroup) {
					return self.groupsForFilter(alerterFilterTargetGroup)[0].Name.toLowerCase().trim();
				});
			}
		});

		function filtrateChecks(checks, filterObject) {
			var subGroupsForNotify = [];

			for (var index in checks) {
				var isCheckFiltered = true;
				var check = checks[index];

				if (alertsViewModel.isFilterObjectEmpty(filterObject) || alertsViewModel.isCheckVisibleAfterFiltrating(check.MonitorGroupId, check.CheckId, filterObject)) {
					isCheckFiltered = false;

					var subGroup = alertsViewModel.getSubGroup(check.MonitorGroupId);

					if (!subGroupsForNotify.includes(subGroup)) {
						subGroupsForNotify.push(subGroup);
					}
				}

				check.isFiltered(isCheckFiltered);
			}

			for (var i = 0; i < subGroupsForNotify.length; i++) {
				subGroupsForNotify[i].notifyCheckedChange();
			}

			var isFilterObjectEmpty = alertsViewModel.isFilterObjectEmpty(filterObject);

			// Change checks visibility
			_.each(alertsViewModel.topGroups(), function (topGroup) {
				_.each(topGroup.subGroups(), function (subGroup) {

					if (isFilterObjectEmpty) {
						subGroup.checksVisible(subGroup.checksInGroup);
					} else {
						var visibleChecksAfterFiltrating = _.filter(subGroup.checksInGroup, function (check) {
							return !needToHideCheck(alertsViewModel.checksIndex[subGroup.Id][check.CheckId], filterObject);
						});

						subGroup.checksVisible(visibleChecksAfterFiltrating);
					}
				});
			});

			// Change groups visibility
			if (isFilterObjectEmpty) {
				alertsViewModel.topGroupsVisible(alertsViewModel.topGroups());
				_.each(alertsViewModel.topGroups(), function(topGroup) {
					topGroup.subGroupsVisible(topGroup.subGroups());
				});
			} else {
				_.each(alertsViewModel.topGroups(), function (topGroup) {

					var visibleSubGroupsAfterFiltrating = _.filter(topGroup.subGroups(), function(subGroup) {
						return alertsViewModel.countVisibleChecksInGroupAfterIndexFiltrating(subGroup.Id, filterObject) > 0;
					});

					topGroup.subGroupsVisible(visibleSubGroupsAfterFiltrating);
				});

				var visibleTopGroupsAfterFiltrating = _.filter(alertsViewModel.topGroups(), function (topGroup) {
					return topGroup.subGroupsVisible().length > 0;
				});

				alertsViewModel.topGroupsVisible(visibleTopGroupsAfterFiltrating);
			};

			// Change group names after filtering
			if (isFilterObjectEmpty) {
				_.each(alertsViewModel.topGroups(), function (topGroup) {
					_.each(topGroup.subGroups(), function (subGroup) {
						subGroup.extendedDescriptor(subGroup.Descriptor + ' (' + subGroup.ChecksCount + ')');
					});

					topGroup.extendedDescriptor(topGroup.Descriptor + ' (' + topGroup.ChecksCount + ')');
				});
			} else {
				_.each(alertsViewModel.topGroups(), function (topGroup) {

					var checksCountAfterFilteringInTopGroup = 0;

					_.each(topGroup.subGroups(), function (subGroup) {

						var checksCountAfterFilteringInSubGroup = alertsViewModel.countVisibleChecksInGroupAfterIndexFiltrating(subGroup.Id, filterObject);
						subGroup.extendedDescriptor(subGroup.Descriptor + ' (' + checksCountAfterFilteringInSubGroup + ' / ' + subGroup.ChecksCount + ')');

						checksCountAfterFilteringInTopGroup += checksCountAfterFilteringInSubGroup;
					});

					topGroup.extendedDescriptor(topGroup.Descriptor + ' (' + checksCountAfterFilteringInTopGroup + ' / ' + topGroup.ChecksCount + ')');
				});
			}
		}

		function needToHideCheck(checkIndex, filterObject) {

			// Search String
			if (filterObject.searchString && filterObject.searchString.length >= minimalSearchStringLength &&
				checkIndex.E.toLowerCase().indexOf(filterObject.searchString.toLowerCase()) < 0) {
				return true;
			};

			// Type
			if ((filterObject.includeCheckTypes && filterObject.includeCheckTypes.length || filterObject.excludeCheckTypes && filterObject.excludeCheckTypes.length) &&
				(filterObject.includeCheckTypes && filterObject.includeCheckTypes.length && _.all(filterObject.includeCheckTypes, function (checkType) { return checkIndex.A.toLowerCase() !== checkType.toLowerCase(); }) ||
				(filterObject.excludeCheckTypes && filterObject.excludeCheckTypes.length && _.any(filterObject.excludeCheckTypes, function (checkType) { return checkIndex.A.toLowerCase() === checkType.toLowerCase(); })))) {
				return true;
			}

			// Location
			if ((filterObject.includeLocations && filterObject.includeLocations.length || filterObject.excludeLocations && filterObject.excludeLocations.length) &&
				(filterObject.includeLocations && filterObject.includeLocations.length && _.all(filterObject.includeLocations, function (location) { return checkIndex.D.toLowerCase() !== location.toLowerCase(); }) ||
				(filterObject.excludeLocations && filterObject.excludeLocations.length && _.any(filterObject.excludeLocations, function (location) { return checkIndex.D.toLowerCase() === location.toLowerCase(); })))) {
				return true;
			}

			// Group
			if ((filterObject.includeGroupIds && filterObject.includeGroupIds.length || filterObject.excludeGroupIds && filterObject.excludeGroupIds.length) &&
				(filterObject.includeGroupIds && filterObject.includeGroupIds.length && _.all(filterObject.includeGroupIds, function (groupId) { return groupId.indexOf(':') === -1 ? checkIndex.B.split(':')[0] !== groupId : checkIndex.B !== groupId }) ||
				(filterObject.excludeGroupIds && filterObject.excludeGroupIds.length && _.any(filterObject.excludeGroupIds, function (groupId) { return groupId.indexOf(':') === -1 ? checkIndex.B.split(':')[0] === groupId : checkIndex.B === groupId; })))) {
				return true;
			}

			// Tags
			if ((filterObject.includeTagIds && filterObject.includeTagIds.length || filterObject.excludeTagIds && filterObject.excludeTagIds.length) &&
				(filterObject.includeTagIds && filterObject.includeTagIds.length && _.all(filterObject.includeTagIds, function (id) { return !_.contains(checkIndex.C, id); }) ||
				(filterObject.excludeTagIds && filterObject.excludeTagIds.length && _.any(filterObject.excludeTagIds, function (id) { return _.contains(checkIndex.C, id); })))) {
				return true;
			}

			return false;
		}
	};

	return {
		Init: function (model) {

			apica.ui.initializeUi(function () {

				apica.filter.init();

				alertsViewModel = new AlertsViewModel(model);
				ko.applyBindings(alertsViewModel, document.body);

				initSelect2Targets();
				initSelect2Groups();

				$("#alerts-container").show();

				if (model.searchString) {
					alertsViewModel.filterObject = { searchString: model.searchString}
					var searchInput = document.querySelector('.filter-text-search input')
					searchInput.focus();
					document.execCommand('insertText', false, model.searchString);
					searchInput.dispatchEvent(new Event("keyup"))
				}
				alertsViewModel.applyFilter();
				if (model.expandedGroup) {
					alertsViewModel.clickOnSubGroup(alertsViewModel.getSubGroup(model.expandedGroup))
				}
			});
		}
	};
})();

$(document).ready(function () {
	var onEditAlert = function () {
		var $parent;
		var $newAlertForm = $("#newAlertForm");
		//Get the alerterFilters binding object.
		var $alerterFilter = $(this).closest("li.alert-identifier");
		var alerterFilter = ko.dataFor($alerterFilter[0]);

		//check corresponding severity checkboxes for alert
		$newAlertForm.find("#createalert > span").html("Save Alert");
		$newAlertForm.find(":checkbox[value='I']").prop("checked", false);
		$newAlertForm.find(":checkbox[value='W']").prop("checked", false);
		$newAlertForm.find(":checkbox[value='E']").prop("checked", false);
		$newAlertForm.find(":checkbox[value='F']").prop("checked", false);
		$.each(alerterFilter.SeverityList.split(''), function (index, severity) {
			$newAlertForm.find(":checkbox[value='" + severity + "']").prop("checked", true);
		});

		var alertTargets = alerting.getAlertTargetsDataForSelect2(
			alerterFilter.AlerterFilterTargets,
			$('#AlertTargetsSelectorModel').data('select2').opts.data);

		var alertGroups = alerting.getAlertGroupsDataForSelect2(
			alerterFilter.AlerterFilterTargetGroups,
			$('#AlertGroupsSelectorModel').data('select2').opts.data);

		$parent = $alerterFilter.closest("li.check");
		var oldAlerterId = $newAlertForm.data("alerterFilter-id");

		if (parseInt(oldAlerterId, 10) === alerterFilter.Id) { //Same as before, toggle;
			$newAlertForm.slideToggle();
		} else {
			$newAlertForm.slideUp(function () {
				$newAlertForm.data("alerterFilter-id", alerterFilter.Id);

				$('#AlertTargetsSelectorModel').select2('data', alertTargets);
				$('#AlertGroupsSelectorModel').select2('data', alertGroups);

				$(this).appendTo($parent).slideDown();
			});
		}
	};

	var onAddAlert = function () {
		var $parent;
		var $newAlertForm = $("#newAlertForm");
		$newAlertForm.find(":checkbox").prop("checked", false);
		$newAlertForm.find("#createalert > span").html("Create Alert");
		$newAlertForm.data("alerterFilter-id", 0); //clear edit alerterfilter-id

		$('#AlertTargetsSelectorModel').select2('data', null);
		$('#AlertGroupsSelectorModel').select2('data', null);

		//figure out if its single or bulk insert and select the appropriate parent.
		if ($(this).hasClass('bulk-add-user-handler')) {
			$parent = $(this).closest("div.project-bar");
		} else {
			$parent = $(this).closest("li.check");
		}

		//Show add alert form or hide if same button is clicked again
		if ($newAlertForm.parent()[0] === $parent[0]) { //Same as before, toggle;            
			$newAlertForm.slideToggle();
		} else {
			$newAlertForm.slideUp(function () {
				$(this).appendTo($parent).slideDown();
			});
		}
	};

	var updateAlert = function (data) {
		ManageAlerts.Server.updateAlert(data, function (result) {
			var changedAlertIndex = _.indexOf(alertsViewModel.alerterFilters(), function (filter) {
				return filter.Id === result.AlerterFilter.Id;
			});

			alertsViewModel.alerterFilters.replace(alertsViewModel.alerterFilters()[changedAlertIndex], result.AlerterFilter);

			alertsViewModel.updateChecksIndex([result.AlerterFilter.CheckId]);
			alertsViewModel.applyFilter();
			
			$("#newAlertForm").slideUp();
		});
	};

	var addAlerts = function (data) {
		return ManageAlerts.Server.addAlerts(data, function (result) {
			alertsViewModel.addAlertFilters(result.AlerterFilters);

			$("#newAlertForm").slideUp();
		});
	};

	var createAlert = function (evt) {
		evt.preventDefault();
		var $form = $("#newAlertForm");
		var data = $form.serialize();

		if ($form.find("#createalert > span").html() === "Save Alert") {
			var alerterFilterId = $form.data("alerterFilter-id");
			var checkId = $form.closest("li.check").data("check-id");
			refreshContainstAlertsAllChecksViewModels(checkId);

			data = data + "&alerterFilterId=" + alerterFilterId + "&checkId=" + checkId;
			updateAlert(data);
		} else {
			if ($form.parent(".project-bar").length > 0) { //if bulk check add
				var checks = $("[name='checks']").serialize();
				data = data + "&" + checks;
				var checkIds = _.map($("[name='checks']:checked"), function (item) {
					return item.value;
				});
				addAlerts(data).done(function () {

					// Force show all checks with ids (in all groups)
					_.each(_.filter(alertsViewModel.checks(), function (check) { return _.contains(checkIds, check.CheckId) }),
						function(check) {
							check.forceShow(true);
						});

					for (var i = 0; i < checkIds.length; i++) {

						var $checks = $("li.check[data-check-id=" + checkIds[i] + "]");
						$checks.each(function() {
							bindAlertsToCheck($(this));
						});

						refreshContainstAlertsAllChecksViewModels(checkIds[i]);
					}

					alertsViewModel.updateChecksIndex(checkIds);
				});
			} else { //if single check add

				var $check = $form.closest("li.check");
				var checkIdSingle = $check.data("check-id");

				data = data + "&checks=" + checkIdSingle;
				addAlerts(data).done(function (response) {
					if (response.Success) {
						// Force show all checks with id (in all groups)
						_.each(_.filter(alertsViewModel.checks(), function(check) { return check.CheckId == checkIdSingle; }), function(check) {
							check.forceShow(true);
						});

						var $checks = $("li.check[data-check-id=" + checkIdSingle + "]");
						$checks.each(function() {
							bindAlertsToCheck($(this));
						});

						refreshContainstAlertsAllChecksViewModels(checkIdSingle);

						alertsViewModel.updateChecksIndex([checkIdSingle]);
					}
				});
			}
		}
	};

	function onCheckClick(evt) {
		var $element = $(this);
		var id = $element.val();
		var isChecked = $element.is(":checked");

		var check = alertsViewModel.checkById(id);

		check.checked(isChecked);
		check.notifyCheckedChange();

		var $commonContainer = $element.closest(".project");
		var isAllChecked = !$commonContainer.find("[name='checks']").is(":not(:checked)");

		var monitorGroup = alertsViewModel.getSubGroup(check.MonitorGroupId);
		monitorGroup.checked(isAllChecked);
	}

	function monitorGroupClick() {
		var $this = $(this);
		var isChecked = $this.is(":checked");

		var monitorGroupId = parseInt($this.val());
		var monitorGroup = alertsViewModel.getSubGroup(monitorGroupId);

		var checks = alertsViewModel.monitorGroupChecks(monitorGroupId);

		_(checks).each(function (check) {
			check.checked(isChecked);
		});

		monitorGroup.checked(isChecked);
		monitorGroup.notifyCheckedChange();
	}

	//Edit alert click
	$(document).on("click", "img.edit-alert", onEditAlert);
	//Add alert click
	$(document).on("click", "a.add-alert", onAddAlert);
	//Create alert click
	$(document).on("click", "#createalert", createAlert);

	// On check checkbox click
	$(document).on("click", "[name='checks']", onCheckClick);

	$(document).on("click", ".monitorGroupCheckBox", monitorGroupClick);

	window.onscroll = function () {
		timeAccumulatorLocal = 0;
	}

	setInterval(function () {
		var currentTime = moment().utc().valueOf();

		var diffTime = currentTime - lastAccumulatorTimestamp;
		timeAccumulatorLocal += diffTime;
		timeAccumulatorGlobal += diffTime;

		lastAccumulatorTimestamp = currentTime;

		if (timeAccumulatorLocal > autoScreenScanDelay) {
			timeAccumulatorLocal = 0;
			updateChecksWithAlertsOnScreen();
		}
	}, 250);
});