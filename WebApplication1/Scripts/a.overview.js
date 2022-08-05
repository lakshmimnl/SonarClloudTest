namespace("apica.overview");

var tooltipOffset = 200;
var app;
var filterValueDefaults;
var autoRefreshIntervalDelay = 120 * 1000;
var autoScreenScanDelay = 0.999 * 1000;
var maxReloadTriesOnError = 3;
var checkIndexOfClosedGroups;
var checkIndexOfClosedGroupsLifeTime = 15 * 1000; // 15 seconds cache
var $autoRefreshCheckbox;
var timeAccumulatorLocal = 0;
var timeAccumulatorGlobal = 0;
var lastAccumulatorTimestamp = moment().utc().valueOf();
var firstOverviewUpdateFinished = false;

function setTooltipPosition($tt, e) {
	var offset = $tt.offset(),
		scrolltop = parseFloat($(window).scrollTop()),
		winWidth = parseFloat(window.innerWidth),
		winHeight = parseFloat(window.innerHeight),
		height = $tt.height();

	var top;
	// if the tooltip gets cut off, place it above element instead
	if (offset.top + height > scrolltop + winHeight) {
		top = offset.top - height - 40;
	} else {
		top = offset.top;
	}

	//if tooltip trigger is on right side of screen, show tooltip on left side, else right side
	var left = e.clientX > winWidth / 2 ? e.clientX - $tt.width() - 40 : e.clientX + 40;
	$tt.offset({ top: top, left: left });
}

function isListType(viewType) {
	return viewType == 'list' || viewType == 'split';
}

function isGridMonitorGroup($monitorGroup) {
	return $monitorGroup.find('.checks-list-iterator').hasClass('checks-grid');
}

$(document).ready(function () {

	apica.ui.initializeUi(function () {

		LoadMonitorGroupChecks();

		$('#edit-layout-handler').on('click', function (e) {
			$('#edit-layout-popup .popup').toggleClass('hidden');
			e.stopPropagation();
		});

		$(document).on('click', function (e) {
			if ($(e.target).parents(".popup").length === 0) {
				$('#edit-layout-popup .popup').addClass('hidden');
			}
		});

		$filterApplyButton = $('#filterApplyButton');

		$('#filterApplyButton').on('click', function () {

			app.applyFilter();
		});

		$filterApplyButton.show();

		$('#filterResetButton').on('click', function () {
			app.resetFilterValues();
			app.resetPresetSelection();

			$(this).hide();
		});

		$('#save-layout-handler').on('click', function () { saveLayout(); });

		$('#collapse-all-monitor-groups').on('click', function () { CollapseAll(); });

		$('#expand-all-monitor-groups').on('click', function () { ExpandAll(); });

		// review: it seems that this is not used - there is no check-project-title anywhere?
		$('#main').on('click', '.check-project-title', function (evt) {
			var $li = $(this).closest('.check-project');
			// Toggle between open and closed status
			if ($li.hasClass('open')) {
				$li.removeClass('open').children('.check-container, .sorting').hide();
				$('.sortable', '#main').masonry('reload');
			}
			else {
				//LoadChecks($(this));
				$li.addClass('open').children('.check-container, .sorting').show();
				$('.sortable', '#main').masonry('reload');
				$li.find('.check').show();
			}

			evt.preventDefault();
		});

		$('#main').on('click', '.topgroup-header', function (evt) {
			var $topGroup = $(this).closest('li.col');
			var $topGroupContainer = $topGroup.find('.topgroup-box');
			// Toggle between open and closed status
			var $topGroupContent = $topGroupContainer.find('.topgroup-content');

			if ($topGroupContainer.hasClass('open')) {
				$topGroupContainer.removeClass('open');
				$topGroupContent.hide();
			}
			else {
				$topGroupContainer.addClass('open');
				$topGroupContent.show();

				if (shouldBeLoaded($topGroup)) {
					var topGroupsRequests = [];

					var topGroupIdInt = parseInt($topGroup.attr('data-monitorgroup-id'));
					var viewType = $topGroup.find('.view-grid.active').length === 0 ? 'list' : 'grid';
					topGroupsRequests.push({ $topGroup: $topGroup, id: topGroupIdInt, viewType: viewType });

					monitorGroupsDeferred.push(LoadMonitorGroupContents(topGroupsRequests, true, true));

					$.when.apply($, monitorGroupsDeferred).then(function () {
						setLoadImageForEachLoadingGroup(false);

						// load checks in expanded subgroups
						var subGroupsRequests = [];
						$topGroupContent.find('.check-project.open').each(function () {
							var $subGroup = $(this);
							var subGroupId = $subGroup.attr('data-id').split('-')[1];
							$subGroup.find('.check-container[load!="true"]').each(function () {
								subGroupsRequests.push({ $checksContainer: $(this), id: parseInt(subGroupId) });
							});
						});
						LoadChecksContents(subGroupsRequests, true);
						app.applyFilter();
					});
				}
			}

			reloadMasonry();
			evt.preventDefault();
		});

		$(document).on('click', '#view-grid-all-handler', function (evt) {
			evt.preventDefault();

			var $viewGrid = $('.view-grid');
			var $notActive = $viewGrid.filter(':not(.active)');
			if ($notActive.length) {
				$notActive.click();
				$('.view-grid-all', '#main').toggleClass('active', true);
			} else {
				$viewGrid.click();
				$('.view-grid-all', '#main').toggleClass('active');
			}

			reloadMasonry();
		});

		$(document).on('click', '#view-split-all-handler', function (evt) {
			evt.preventDefault();
			$('.view-list-all', '#main').removeClass('active');
			$('.view-split-all', '#main').addClass('active');
			$('.col', '#main').addClass('split-view').removeClass('list-view');
			$('.view-split').click();
			reloadMasonry();
		});

		$(document).on('click', '#view-list-all-handler', function (evt) {
			evt.preventDefault();
			$('.col', '#main').removeClass('split-view').addClass('list-view');
			$('.view-split-all', '#main').removeClass('active');
			$('.view-list-all', '#main').addClass('active');
			$('.view-list').click();
			reloadMasonry();
		});

		//when 'handheld' resolution then you can click anywhere on the row to get to check details.
		if (IsHandheldResolution()) {
			$(document).on('mousedown', '.checks-list-iterator .has_tooltip', function (e) {
				e.preventDefault();
				tabs.insertCheckTab($(this).parents('li.check').attr('checkid'), true, null, "check");
			});
		}

		$('#main').on('click', '.view-grid, .view-split, .view-list', function (e) {
			e.stopPropagation();
			var $btn = $(this);
			var $monitorGroup = $btn.closest('li.col');
			if ($monitorGroup.length === 0)
				return;

			var monitorgroupId = $monitorGroup.attr("data-monitorgroup-id");
			var viewType = $btn.attr('viewtype');

			var isPrevViewListType = !isGridMonitorGroup($monitorGroup);
			var isCurrViewListType = isListType(viewType);

			function switchMonitorGroupClass() {
				if (viewType === 'split') {
					$monitorGroup.addClass('split-view');
					$monitorGroup.removeClass('list-view');
				} else if (viewType === 'list') {
					$monitorGroup.removeClass('split-view');
					$monitorGroup.addClass('list-view');
				}
			}

			var $splitBtn = $btn.closest('ul').find('.view-split');
			var $listBtn = $btn.closest('ul').find('.view-list');

			if ($btn.hasClass('view-split')) {
				$splitBtn.addClass('active');
				$listBtn.removeClass('active');
			}

			if ($btn.hasClass('view-list')) {
				$splitBtn.removeClass('active');
				$listBtn.addClass('active');
			}

			switchMonitorGroupClass();

			var $gridBtn = $btn.closest('ul').find('.view-grid');

			if ($btn.hasClass('view-grid')) {
				$gridBtn.toggleClass('active');
				viewType = $gridBtn.hasClass('active') ? 'grid'
					: $listBtn.hasClass('active') ? 'list' : 'split';
				log(viewType);
				LoadMonitorGroupContent($monitorGroup, monitorgroupId, viewType, true, true).then(function () {
					refreshCheckFilter();
				});
			} else {
				reloadMasonry();
			}
		});

		if (!IsHandheldResolution()) {
			initTooltips('.has_tooltip', '.tooltip', setTooltipPosition);
		}

		apica.tags.init();
	});

	$autoRefreshCheckbox = $('#main-container').find('.action-buttons__layout').find('.autoRefresh')[0];

	window.onscroll = function () {
		timeAccumulatorLocal = 0;
	}

	setInterval(function () {
		var currentTime = moment().utc().valueOf();

		var diffTime = currentTime - lastAccumulatorTimestamp;
		timeAccumulatorLocal += diffTime;
		timeAccumulatorGlobal += diffTime;

		lastAccumulatorTimestamp = currentTime;

		if (timeAccumulatorLocal > autoScreenScanDelay && firstOverviewUpdateFinished) {
			timeAccumulatorLocal = 0;
			updateGroupsWithChecksOnScreen();
		}
	}, 250);

});

function addLoadersToElements($elements) {
	$elements.contents().hide();
	$elements.append('<img style="margin: auto !important;" class="loader" src="/Assets/Common/Images/System/ajaxload.gif">');
}

function reloadMasonry() {
	$('.sortable', '#main').masonry('reload');
	apica.ui.initializeBrokenImages(); // todo: fix this call because it costs some memory leak when there are wrong icons (tmpl cmd checks with not existing icon configured)
}

var filterValue = {
	"text-search": '',
	"checktype": {},
	"location": {},
	"group": {},
	"tag": {}
};

function applyFilterToMonitorGroups(groups, filter) {
	if (groups && groups.length) {
		var idsOfGroupsToInclude = filter && filter.include && filter.include.length
			? filter.include
			: [];
		var idsOfGroupsToExclude = filter && filter.exclude && filter.exclude.length
			? filter.exclude
			: [];
		var isFilterEmpty = !idsOfGroupsToExclude.length && !idsOfGroupsToInclude.length;

		return groups.reduce(function (map, topGroup) {
			var topGroupIdStr = topGroup.id.toString();
			if (isFilterEmpty || !idsOfGroupsToExclude.includes(topGroupIdStr)) {
				var isTopGroupIncluded = !isFilterEmpty && idsOfGroupsToInclude.includes(topGroupIdStr);
				for (var i = 0; i < topGroup.subGroups.length; i++) {
					var subGroup = topGroup.subGroups[i];
					var subGroupIdStr = subGroup.id.toString();
					if (isFilterEmpty ||
						isTopGroupIncluded ||
						idsOfGroupsToInclude.includes(subGroupIdStr) ||
						(idsOfGroupsToExclude.length && !idsOfGroupsToExclude.includes(subGroupIdStr))) {
						map[topGroupIdStr] = true;
						map[topGroupIdStr + "-" + subGroupIdStr] = true;
					}
				}
			}

			return map;
		}, {});
	}

	return {};
}

function needToHideCheck(description, groupId, hasGroupPassedFilterByIdMap, checkTypeAttr, locationAttr, tagIds) {

	// Groups
	if (groupId) {
		if (!hasGroupPassedFilterByIdMap[groupId]) {
			return true;
		}
	}

	// Name
	if (filterValue["text-search"] && description.toLowerCase().indexOf(filterValue["text-search"].toLowerCase()) < 0) {
		return true;
	}

	// Type
	if ((filterValue["checktype"] && ((filterValue["checktype"].include && filterValue["checktype"].include.length) || (filterValue["checktype"].exclude && filterValue["checktype"].exclude.length))) &&
		(filterValue["checktype"].include && filterValue["checktype"].include.length && _.all(filterValue["checktype"].include, function (checkType) { return checkTypeAttr.toLowerCase() !== checkType.toLowerCase(); }) ||
			(filterValue["checktype"].exclude && filterValue["checktype"].exclude.length && _.any(filterValue["checktype"].exclude, function (checkType) { return checkTypeAttr.toLowerCase() === checkType.toLowerCase(); })))) {
		return true;
	}

	// Location
	if ((filterValue["location"] && ((filterValue["location"].include && filterValue["location"].include.length) || (filterValue["location"].exclude && filterValue["location"].exclude.length))) &&
		(filterValue["location"].include && filterValue["location"].include.length && _.all(filterValue["location"].include, function (location) { return locationAttr.toLowerCase() !== location.toLowerCase(); }) ||
			(filterValue["location"].exclude && filterValue["location"].exclude.length && _.any(filterValue["location"].exclude, function (location) { return locationAttr.toLowerCase() === location.toLowerCase(); })))) {
		return true;
	}

	// Tags
	var tagIdsDict = {};
	_.each(tagIds.split(','), function (id) { tagIdsDict[id] = true; });
	if ((filterValue["tag"] && ((filterValue["tag"].include && filterValue["tag"].include.length) || (filterValue["tag"].exclude && filterValue["tag"].exclude.length))) &&
		(filterValue["tag"].include && filterValue["tag"].include.length && _.all(filterValue["tag"].include, function (id) { return !tagIdsDict[id] })) ||
		(filterValue["tag"].exclude && filterValue["tag"].exclude.length && _.any(filterValue["tag"].exclude, function (id) { return tagIdsDict[id] }))) {
		return true;
	}

	return false;
}

function filterChecks(serverSideInfoAboutClosedGroups) {

	var hasGroupPassedFilterByIdMap =
		applyFilterToMonitorGroups(apica.overview.topGroups, filterValue["group"]);

	// Hide or show checks
	$('#main-container li.check').each(function () {
		var $check = $(this);
		var description = $check.attr('descr');
		var subGroupId = $check.attr('subgroupid');
		var checkTypeAttr = $check.attr('checkTypeSourceId');
		var locationAttr = $check.attr('location');
		var tagIds = $check.attr('tagids');

		if (needToHideCheck(description, subGroupId, hasGroupPassedFilterByIdMap, checkTypeAttr, locationAttr, tagIds)) {
			$check.addClass('hidden');
		} else {
			$check.removeClass('hidden');
		}
	});

	// Hide or show groups
	$('#main-container > ul > li').each(function () {
		var $topGroup = $(this);
		var $topGroupBox = $topGroup.children(".topgroup-box");
		var topGroupId = $topGroupBox.attr("data-id");
		var showTopGroup = false;
		var needToCheckTopGroupWithServerSideInfo = false;

		if (hasGroupPassedFilterByIdMap[topGroupId]) {

			if (!$topGroupBox.hasClass('open') && shouldBeLoaded($topGroup)) {
				showTopGroup = true;
				needToCheckTopGroupWithServerSideInfo = true;
			}

			var $subGroups = $topGroup.find('ul.checks-list-iterator >li');
			var countSubGroupsWasHidden = 0;

			$subGroups.each(function () {
				var $subGroup = $(this);
				var subGroupId = $subGroup.attr("data-id");
				var showSubGroup = false;
				var needToCheckSubGroupWithServerSideInfo = false;

				if (hasGroupPassedFilterByIdMap[subGroupId]) {
					if (!$subGroup.hasClass('open') && shouldBeLoaded($subGroup.find('.check-container'))) {
						showSubGroup = true;
						showTopGroup = true;
						needToCheckSubGroupWithServerSideInfo = true;
					}

					$subGroup.find('ul > li.check').each(function () {
						var $check = $(this);
						if (!$check.hasClass('hidden')) {
							showSubGroup = true;
							showTopGroup = true;
						}
					});
				}

				var $subGroupElement = $subGroup;
				if (showSubGroup) {
					if (needToCheckSubGroupWithServerSideInfo && serverSideInfoAboutClosedGroups) {
						var subGroupsFromTopGroups = _.flatten(_.map(serverSideInfoAboutClosedGroups.TopGroups, function (topGroup) { return topGroup.SubGroups; }));
						var checksAttributesFromServerSideSubGroup = _.filter(serverSideInfoAboutClosedGroups.SubGroups.concat(subGroupsFromTopGroups), function (subGroup) { return subGroup.Id == subGroupId.split('-')[1]; });

						if (checksAttributesFromServerSideSubGroup.length > 0) {
							if (_.all(checksAttributesFromServerSideSubGroup[0].ChecksAttributes, function (checkAttributes) {
								return needToHideCheck(
									checkAttributes.Name,
									topGroupId,
									hasGroupPassedFilterByIdMap,
									checkAttributes.TypeSourceId,
									checkAttributes.Location,
									checkAttributes.TagIds);
							})) {
								$subGroupElement.addClass('hidden');
								countSubGroupsWasHidden++;
							} else {
								$subGroupElement.removeClass('hidden');
							}
						}
					} else {
						$subGroupElement.removeClass('hidden');
					}
				} else {
					$subGroupElement.addClass('hidden');
					countSubGroupsWasHidden++;
				}
			});

			// Case: Top Group opened, Sub Groups closed
			if ($subGroups.length === countSubGroupsWasHidden && countSubGroupsWasHidden !== 0) {
				showTopGroup = false;
			}
		}

		var $topGroupElement = $topGroup.find('>div');
		if (showTopGroup) {
			if (needToCheckTopGroupWithServerSideInfo && serverSideInfoAboutClosedGroups) {
				var subGroupsFromServerSideInfo = _.filter(serverSideInfoAboutClosedGroups.TopGroups, function (topGroup) { return topGroup.Id == topGroupId; })[0].SubGroups;
				var checksAttributesFromServerSideSubGroups = _.flatten(_.map(subGroupsFromServerSideInfo, function (subGroup) { return subGroup.ChecksAttributes; }));

				if (_.all(checksAttributesFromServerSideSubGroups, function (checkAttributes) {
					return needToHideCheck(
						checkAttributes.Name,
						topGroupId,
						hasGroupPassedFilterByIdMap,
						checkAttributes.TypeSourceId,
						checkAttributes.Location,
						checkAttributes.TagIds);
				})) {
					$topGroupElement.addClass('hidden');
				} else {
					$topGroupElement.removeClass('hidden');
				}
			} else {
				$topGroupElement.removeClass('hidden');
			}
		} else {
			$topGroupElement.addClass('hidden');
		}
	});

	// Reset Filter button
	var $filterResetButton = $('#filterResetButton');
	if (JSON.stringify(filterValue) !== JSON.stringify(filterValueDefaults)) {
		$filterResetButton.show();
	} else {
		$filterResetButton.hide();
	}

	reloadMasonry();
}

function refreshCheckFilter(doNotGetCheckIndexOfClosedGroups) {

	app.applyFilter(doNotGetCheckIndexOfClosedGroups);
}

// these promises will be used to load expanded subgroups in time
var monitorGroupsDeferred = [];

function loadAndApplyChecksData(firstTime) {

	if (firstTime) {
		var userProfile = apica.overview.userProfile;

		var topGroupsRequests = [];

		//processing the tmp container
		//this will be done only once on page load
		//handle groups from userProfile first and apply the view settings saved there (grid view / list view)
		if (userProfile.monitorGroupDisplayStates !== null) {
			// Copy the originals in sequence, add them to the monitorgroup container in the order they are saved.
			$(userProfile.monitorGroupDisplayStates).each(function (i, element) {
				//find the monitorgroup element
				var $topGroup = $('li.col[data-monitorgroup-id="' + element.monitorGroupId + '"]', '#temporary-widget-holder');
				if ($topGroup.length === 0)
					return;

				// The code below only runs once on document ready. All other runs #temporary-widget-holder is empty

				//if this monitorgroup should be displayed as grid.
				var isGridView = element.isGridView;
				//if this monitorgroup should be in split view.
				var isSplitView = element.isSplitView;
				var viewType = isGridView ? 'grid' : 'list';

				// Add split view class if we should.

				$topGroup.find('a.view-grid').toggleClass('active', isGridView);
				$topGroup.find('a.view-split').toggleClass('active', isSplitView);
				$topGroup.find('a.view-list').toggleClass('active', !isSplitView);
				if (isSplitView) {
					$topGroup.addClass('split-view').removeClass('list-view');
				} else {
					$topGroup.addClass('list-view').removeClass('split-view');

				}
				if (isGridView) {
					$topGroup.find('.checks-list-iterator').addClass('checks-grid').removeClass('checks-list');
				} else {
					$topGroup.find('.checks-list-iterator').addClass('checks-list').removeClass('checks-grid');
				}

				//Add the monitorgroup to the container
				$('.widgetcontainer', '#main-container').append($topGroup);

				if (_.contains(userProfile.expandedTopGroups, element.monitorGroupId)) {
					//add request for the group to load it later on
					topGroupsRequests.push({ $topGroup: $topGroup, id: element.monitorGroupId, viewType: viewType });
				}
			});
		}

		//continue processing the tmp container
		//this will be done only once on page load
		//handle the rest of monitorgroups (that not presented in userProfile) - they must be shown in default view state
		$('#temporary-widget-holder').children("li").each(function () {
			var $topGroup = $(this);
			//split-view is default.
			$topGroup.find('.view-split').addClass('active');
			//add the monitorgroup to the container.
			$('.widgetcontainer', '#main-container').append($topGroup);

			var topGroupId = $topGroup.attr("data-monitorgroup-id");
			var topGroupIdInt = parseInt(topGroupId);
			if (_.contains(userProfile.expandedTopGroups, topGroupIdInt)) {
				//add request for the group to load it later on
				topGroupsRequests.push({ $topGroup: $topGroup, id: topGroupIdInt, viewType: 'list' });
			}

		});

		monitorGroupsDeferred.push(LoadMonitorGroupContents(topGroupsRequests, false, false));

		if (userProfile.expandedTopGroups) {
			for (var i = 0; i < userProfile.expandedTopGroups.length; i++) {
				var $topGroupContainer = $('.topgroup-box:not(.open)[data-id="' + userProfile.expandedTopGroups[i] + '"]');
				$topGroupContainer.addClass('open');
				$topGroupContainer.children('.topgroup-content').removeClass('hidden').show();
			}
		}
	}

	var checksDeferred = [];

	$.when.apply($, monitorGroupsDeferred).then(function () {
		setLoadImageForEachLoadingGroup(firstTime);

		checksDeferred.push(getAndApplyOverviewUpdate(firstTime === true));

		$.when.apply($, checksDeferred).then(function () {
			log('all monitor groups loaded!');
			firstOverviewUpdateFinished = true;
		});
	});
}

function getAndApplyOverviewUpdate(firstTime, partialUpdateRequest) {

	var includeGroupHeaders = !firstTime;

	var userProfile = getActualUserProfile(true);

	if (firstTime && userProfile.expandedTopGroups.length === 0) {
		refreshCheckFilter(true);
		return null;
	}

	if (!firstTime && !firstOverviewUpdateFinished) {
		return;
	}

	return apica.ajax.apiCallPost('/Check/GetOverviewUpdate/',
		{
			UserProfile: userProfile, // Now need send full state of all groups instead collapsed groups, so let's send profile
			IgnoreCache: true,
			IncludeResults: !firstTime,
			IncludeGroupHeaders: includeGroupHeaders === true,
			PartialUpdateRequest: partialUpdateRequest
		},
		function (result) {
			var checksModels = result.monitorGroupChecksModels.Data;

			WriteCheckErrorNotification(checksModels);

			apica.tags.setTags(JSON.parse(result.tagsJson));

			for (var checkIdStr in checksModels.CheckTagValueAssociationsByCheckIdStringMap) {
				if (checksModels.CheckTagValueAssociationsByCheckIdStringMap.hasOwnProperty(checkIdStr)) {
					apica.tags.model.checkTagValueAssociationsByCheckIdMap[parseInt(checkIdStr)] =
						checksModels.CheckTagValueAssociationsByCheckIdStringMap[checkIdStr];
				}
			}

			var fatalTotal = 0;
			var errorTotal = 0;
			var warningTotal = 0;
			var informationTotal = 0;
			var unknownTotal = 0;

			$('.check-project').each(function () {
				var $monitorGroup = $(this);
				var monitorGroupId = GetSubMonitorGroupId($monitorGroup);
				var monitorGroupChecksList = FindChecksByMonitorGroupId(result.monitorGroupChecksModels.Data.Data, monitorGroupId);

				if (monitorGroupChecksList) {
					var $checkContainer = $monitorGroup.find('.check-container');

					if (monitorGroupChecksList.ChecksList) {
						// Update whole group
						$checkContainer.html(monitorGroupChecksList.ChecksList.replace(String.fromCharCode(65279), ""));

						if (monitorGroupChecksList.Detailed) {
							$checkContainer.find('.check').each(function () {
								setUpdateTimestamp($(this));
							});
						};
					} else if (monitorGroupChecksList.Checks) {
						// Update only some checks
						for (var i = 0; i < monitorGroupChecksList.Checks.length; i++) {
							var checkId = monitorGroupChecksList.Checks[i].Id;
							var check = monitorGroupChecksList.Checks[i].Check;
							var selector = '.check[checkid="' + checkId + '"]';

							var $check = $checkContainer.find(selector);
							$check.replaceWith(check.replace(String.fromCharCode(65279), ""));
							$check = $checkContainer.find(selector);

							setUpdateTimestamp($check);
						}
					}

					markAsLoaded($checkContainer);
					if (monitorGroupChecksList.Detailed) {
						setUpdateTimestamp($monitorGroup);
					};

					$(this).addClass('open').children('.check-container, .sorting').show();
				}

				if (userProfile.showStatusColors) {
					$(this).find('a').addClass('severity-font');
				}
			});

			$('.project').each(function () {
				var $monitorGroup = $(this);
				var monitorGroupId = GetMonitorGroupId($monitorGroup);

				var monitorGroupChecksGrid = FindChecksByMonitorGroupId(result.monitorGroupChecksModels.Data.Data, monitorGroupId);

				if (monitorGroupChecksGrid) {
					var $checkContainer = $monitorGroup.parent().parent();

					if (monitorGroupChecksGrid.ChecksList) {
						// Update whole group
						$checkContainer.html(monitorGroupChecksGrid.ChecksList.replace(String.fromCharCode(65279), ""));

						if (monitorGroupChecksGrid.Detailed) {
							$checkContainer.find('.check').each(function () {
								setUpdateTimestamp($(this));
							});
						};

					} else if (monitorGroupChecksGrid.Checks) {
						// Update only some checks
						for (var i = 0; i < monitorGroupChecksGrid.Checks.length; i++) {
							var checkId = monitorGroupChecksGrid.Checks[i].Id;
							var check = monitorGroupChecksGrid.Checks[i].Check;
							var selector = '.check[checkid="' + checkId + '"]';

							var $check = $checkContainer.find(selector);
							$check.replaceWith(check.replace(String.fromCharCode(65279), ""));
							$check = $checkContainer.find(selector);

							setUpdateTimestamp($check);
						}
					}

					markAsLoaded($checkContainer);
					if (monitorGroupChecksGrid.Detailed) {
						setUpdateTimestamp($checkContainer.find('.project'));
					};
				}
			});

			if (!firstTime) {
				refreshCheckFilter();
			} else {
				reloadMasonry();
			}

			if (includeGroupHeaders) {
				var monitorGroupId;
				var monitorGroup;
				var monitorGroupSeverity;
				var anythingUpdated;

				// todo: fix the problem here - if monitor group is shown before but then it's gone it will not be updated
				// and vice versa - if there was no monitor group shown but then it's appeared it will not be added
				$('.topgroup-box').each(function () {

					var $topGroupContainer = $(this);
					monitorGroupId = GetTopMonitorGroupId($topGroupContainer);
					monitorGroup = GetMonitorGroupById(result.checkOverviewSiteGroupViewModels.Data, monitorGroupId);

					if (monitorGroup != null) {

						monitorGroupSeverity = monitorGroup.SumChecksCountBySeverity;

						if (parseInt($(this).attr('data-id')) == monitorGroup.MonitorGroup.Id) {

							var groupRed = $topGroupContainer.find('.in-header-controls > .severity.red');
							var groupOrange = $topGroupContainer.find('.in-header-controls > .severity.orange');
							var groupYellow = $topGroupContainer.find('.in-header-controls > .severity.yellow');
							var groupGreen = $topGroupContainer.find('.in-header-controls > .severity.green');

							anythingUpdated =
								updateSeverity(groupRed, monitorGroupSeverity.Fatal, true) |
								updateSeverity(groupOrange, monitorGroupSeverity.Error, true) |
								updateSeverity(groupYellow, monitorGroupSeverity.Warning, true) |
								updateSeverity(groupGreen, monitorGroupSeverity.Information, true);

							var headerGradient = $('#box[data-id=' + monitorGroup.MonitorGroup.Id + '] > .header-gradient');
							updateWorstSeverity(headerGradient, monitorGroup.WorstSeverityColor);

							// If severity updated in closed state then we should mark all subGroups as not loaded (even if loaded)
							// because we need actual info about checks when Group will we opened
							if (anythingUpdated && !$topGroupContainer.hasClass('open')) {

								$(this).find('.check-project').each(function () {
									resetContent($(this));
								});
							}

							fatalTotal += monitorGroupSeverity.Fatal;
							errorTotal += monitorGroupSeverity.Error;
							warningTotal += monitorGroupSeverity.Warning;
							informationTotal += monitorGroupSeverity.Information;
							unknownTotal += monitorGroupSeverity.Unknown;
						}

						var monitorSubGroups = GetMonitorSubGroupsById(result.checkOverviewSiteGroupViewModels.Data, monitorGroupId);

						_.each(monitorSubGroups, function (e) {
							var monitorSubGroupSeverity = e.ChecksCountBySeverity;

							var topGroupSubGroupId = monitorGroupId + '-' + e.MonitorGroup.Id;
							var $subGroupContainer = $topGroupContainer.find('.check-project[data-id="' + topGroupSubGroupId + '"]');

							if ($subGroupContainer.length > 0) {
								var subgroupRed = $subGroupContainer.find('.tests > .severity.red');
								var subgroupOrange = $subGroupContainer.find('.tests > .severity.orange');
								var subgroupYellow = $subGroupContainer.find('.tests > .severity.yellow');
								var subgroupGreen = $subGroupContainer.find('.tests > .severity.green');

								anythingUpdated =
									updateSeverity(subgroupRed, monitorSubGroupSeverity.Fatal, true) |
									updateSeverity(subgroupOrange, monitorSubGroupSeverity.Error, true) |
									updateSeverity(subgroupYellow, monitorSubGroupSeverity.Warning, true) |
									updateSeverity(subgroupGreen, monitorSubGroupSeverity.Information, true);

								var $subrgoupSummaryContainer = $subGroupContainer.find('.group-average');
								updateSubGroupSummary($subrgoupSummaryContainer, e.Status);

								var $projectTitle = $subGroupContainer.find('.project-title');
								updateWorstSeverity($projectTitle, e.WorstSeverityColor);

								// If severity updated in closed state then we should mark this subGroup as not loaded (even if loaded)
								// because we need actual info about checks when subGroup will we opened
								if (anythingUpdated && !$subGroupContainer.hasClass('open')) {
									resetContent($subGroupContainer);
								}
							}
						});
					}
				});

				// Update SlideBar QuickChecks
				var severityTotal = fatalTotal + errorTotal + warningTotal + informationTotal + unknownTotal;
				updateSeverity($('#quick-checks .severity-nogradient.red'), fatalTotal, false);
				updateSeverity($('#quick-checks .severity-nogradient.orange'), errorTotal, false);
				updateSeverity($('#quick-checks .severity-nogradient.yellow'), warningTotal, false);
				updateSeverity($('#quick-checks .severity-nogradient.green'), informationTotal, false);
				$('.nav-checks span.notification').html(severityTotal);
			}

		firstOverviewUpdateFinished = true;
		},
		function (xhr, err) {

			if (firstOverviewUpdateFinished === false) {
				getAndApplyOverviewUpdate(true); // Run first overview update again
				return;
			}

			if (partialUpdateRequest && (partialUpdateRequest.subGroups || partialUpdateRequest.topGroups)) {
				updateFailedResults(partialUpdateRequest);
			}

			log('responseText: ' + xhr.responseText + 'readyState: ' + xhr.readyState + '\nstatus: ' + xhr.status);
			reloadMasonry();
		});
}

function resetContent(checkProject) {

	var $container = checkProject.find('.check-container');

	$container.empty();
	markAsNotLoaded($container);
}

function updateWorstSeverity(header, worstSeverityColor) {

	header.removeClass('green');
	header.removeClass('yellow');
	header.removeClass('orange');
	header.removeClass('red');
	header.removeClass('black');

	header.addClass(worstSeverityColor);
}

function updateSeverity(element, value, needHide) {

	if (element !== undefined && value !== undefined) {

		var updated = element.text().trim() != value;

		element.text(value);
		element.css('display', 'block');

		if (needHide && value <= 0) {
			element.css('display', 'none');
		}

		return updated;
	}

	return false;
}

function updateFailedResults(partialUpdateRequest) {

	var loadingErrorImg = '<img title="Loading check results failed" src="/Assets/Common/Images/Dashboard/check-bar-stub-error.png">';
	var waitReloadingImg = '<img title="Pending to reload" src="/Assets/Common/Images/Dashboard/check-bar-stub-reload.png">';

	$('.check-project').each(function () {
		var $monitorGroup = $(this);
		var monitorGroupId = GetSubMonitorGroupId($monitorGroup);
		var subGroupFromRequest = _.filter(partialUpdateRequest.subGroups, function (subGroup) { return subGroup.id === monitorGroupId; });

		if (subGroupFromRequest) {

			$monitorGroup.find('.check').each(function () {
				var $check = $(this);
				var checkId = $check.attr('checkid');

				if (subGroupFromRequest.allChecks ||
					(subGroupFromRequest.length > 0 && subGroupFromRequest[0].checks && _.contains(subGroupFromRequest[0].checks, checkId))) {
					$check.removeAttr('update-utc');
					var tries = $check.attr('tries');
					if (!tries) {
						$check.attr('tries', maxReloadTriesOnError);
					} else {
						if (tries > 0) {
							$check.attr('tries', tries - 1);
							$check.find('.bar').html(waitReloadingImg);
						} else {
							$check.attr('update-utc', '');
							$check.find('.bar').html(loadingErrorImg);
						}
					}
				}
			});
		}
	});

	$('.project').each(function () {
		var $monitorGroup = $(this);
		var monitorGroupId = GetTopMonitorGroupId($monitorGroup);
		var topGroupFromRequest = _.filter(partialUpdateRequest.topGroups, function (topGroup) { return topGroup.id === monitorGroupId; });

		if (topGroupFromRequest) {

			$monitorGroup.find('.check').each(function () {
				var $check = $(this);
				var checkId = $check.attr('checkid');

				if (topGroupFromRequest.allChecks || _.contains(topGroupFromRequest[0].checks, checkId)) {
					$check.removeAttr('update-utc');
					var tries = $check.attr('tries');
					if (!tries) {
						$check.attr('tries', maxReloadTriesOnError);
					} else {
						if (tries > 0) {
							$check.attr('tries', tries - 1);
							$check.find('.bar').html(waitReloadingImg);
						} else {
							$check.attr('update-utc', '');
							$check.find('.bar').html(loadingErrorImg);
						}
					}
				}
			});
		}
	});
}

// LoadMonitorGroupChecks - called only once on document ready
function LoadMonitorGroupChecks() {
	// move originals to temporary container.

	$('#temporary-widget-holder').append($('.widgetcontainer .col', '#main'));

	var userProfile = apica.overview.userProfile;

	loadAndApplyChecksData(true);

	if (userProfile.showStatusColors) {
		$('.header-gradient').addClass('severity-nogradient');
		$('.statusColors').prop('checked', true);
	} else {
		$('.statusColors').prop('checked', false);
	}

	$('.autoRefresh').prop('checked', userProfile.enableAutoRefresh);

	var hasSplitView = _.any(userProfile.monitorGroupDisplayStates || [], function (ds) { return ds.isSplitView; });
	var hasListView = _.any(userProfile.monitorGroupDisplayStates || [], function (ds) { return !ds.isSplitView; });
	var hasGridView = _.any(userProfile.monitorGroupDisplayStates || [], function (ds) { return ds.isGridView; });
	var hasNonGridView = _.any(userProfile.monitorGroupDisplayStates || [], function (ds) { return !ds.isGridView; });
	$('a.view-split-all').toggleClass('active', hasSplitView && !hasListView);
	$('a.view-list-all').toggleClass('active', hasListView && !hasSplitView);
	$('a.view-grid-all').toggleClass('active', hasGridView && !hasNonGridView);

	$('.hideTopMenu').prop('checked', $('body').hasClass('lightweight'));
}

function GetMonitorGroupId(element) {
	return element.attr('data-id');
}

function GetTopMonitorGroupId(element) {
	return element.attr('data-id').split('-')[0];
}

function GetSubMonitorGroupId(element) {
	return element.attr('data-id').split('-')[1];
}

function getActualUserProfile(onlyVisibleGroups) {
	var expandedTopGroups = [];
	var expandedSubGroups = [];

	// expanded top groups
	$('div.topgroup-box.open').each(function () {
		expandedTopGroups.push(parseInt($(this).attr('data-id')));
	});

	// expanded sub groups (if onlyVisibleGroups then only in expanded top groups)
	var subGroupsSelector = onlyVisibleGroups ? 'div.topgroup-box.open .check-project.open' : '.check-project.open';
	$(subGroupsSelector).each(function () {
		expandedSubGroups.push(parseInt(GetSubMonitorGroupId($(this))));
	});

	var monitorGroupDisplayStateView = [];

	var col = $('.col', '#main');
	var colLength = col.length, i;

	for (i = 0; i < colLength; i++) {
		var currentCol = $(col[i]);
		var monitorGroupId = currentCol.attr('data-monitorgroup-id');
		var splitStatus = false;
		var gridStatus = false;

		if (currentCol.hasClass('split-view')) {
			splitStatus = true;
		}

		if (currentCol.find('.checks-list-iterator').hasClass('checks-grid')) {
			gridStatus = true;
		}

		monitorGroupDisplayStateView.push({
			MonitorGroupId: parseInt(monitorGroupId),
			IsSplitView: splitStatus,
			IsGridView: gridStatus
		});
	}

	var showStatusColors = $('.statusColors').attr('checked') == 'checked';
	var enableAutoRefresh = $('.autoRefresh').attr('checked') == 'checked';

	return {
		monitorGroupDisplayStates: monitorGroupDisplayStateView,
		expandedTopGroups: expandedTopGroups,
		expandedSubGroups: expandedSubGroups,
		showStatusColors: showStatusColors,
		enableAutoRefresh: enableAutoRefresh,
		userTooltipSettings: null
	};
}

function saveLayout() {

	var userProfile = getActualUserProfile(false);

	return apica.ajax.apiCallPost('/Check/UpdateUserProfile/',
		userProfile,
		function () {
			apica.overview.userProfile = userProfile;
			notifier.success("Overview layout have been successfully saved.");
		});
}

function updateSubGroupSummary($container, summary) {
	if (summary == null)
		return;

	if (summary.ContainsMixedResultUnits) {
		$container.find('.time span.info-circle').removeClass('hide');
	} else {
		$container.find('.time span.info-circle').addClass('hide');
	}

	$container.find('.time span:first').html(summary.AvgLrValue);
	$container.find('.last24 span').html(summary.Avg24Value);
	$container.find('.sla span').html(summary.AvgSlaPercentCurrentMonth);
}

function FindChecksByMonitorGroupId(monitorGroupsChecks, monitorGroupId) {
	var result = null;
	for (var i = 0; i < monitorGroupsChecks.length; i++) {
		var currentMonitorGroup = monitorGroupsChecks[i];
		if (currentMonitorGroup.MonitorGroupId == monitorGroupId) {
			result = currentMonitorGroup;
			break;
		}
	}

	return result;
}

function GetMonitorGroupById(monitorGroupsChecksList, monitorGroupId) {
	var result = null;
	for (var i = 0; i < monitorGroupsChecksList.length; i++) {
		var currentMonitorGroup = monitorGroupsChecksList[i];
		if (currentMonitorGroup.MonitorGroup.Id == monitorGroupId) {
			result = currentMonitorGroup;
			break;
		}
	}

	return result;
}

function GetMonitorSubGroupsById(monitorGroupsChecksList, monitorGroupId) {
	var result = null;
	for (var i = 0; i < monitorGroupsChecksList.length; i++) {
		var currentMonitorGroup = monitorGroupsChecksList[i];
		if (currentMonitorGroup.MonitorGroup.Id == monitorGroupId) {
			result = currentMonitorGroup.ChildMonitorGroups;
			break;
		}
	}

	return result;
}

//Gets monitorgroup content html from the server and loads it into the '.contents' container.
function LoadMonitorGroupContent($monitorGroupContainer, monitorGroupId, viewType, ignoreCache, includeResults) {
	//get the content container for this monitorgroup.
	//we will load the content into this element with ajax.
	var $content = $monitorGroupContainer.find(".contents");

	return $.ajax({
		url: '/Check/GetSitePartial/',
		data: {
			siteGroupId: monitorGroupId,
			viewtype: viewType,
			ignoreCache: ignoreCache,
			includeResults: includeResults
		},
		dataType: 'html',
		type: 'GET',
		success: function (result) {
			$content.html(result);

			setUpdateTimestamp($content.find('.project'));

			BindLoadChecks($content, monitorGroupId, viewType, includeResults);
			log(monitorGroupId + ' grid loaded.');
		},
		error: function (xhr, err) {
			log('responseText: ' + xhr.responseText + 'readyState: ' + xhr.readyState + '\nstatus: ' + xhr.status);
			$content.html('<div class="errormsg">Could not load monitor group</div>');
			reloadMasonry();
		}
	});
}

function LoadMonitorGroupContents(topGroupsRequests, ignoreCache, includeResults, hasGroupPassedFilterByIdMap) {

	if (topGroupsRequests.length === 0)
		return null;

	var request = _.map(topGroupsRequests, function (item) {
		return {
			siteGroupId: item.id,
			viewType: item.viewType
		};
	});

	return apica.ajax.apiCallPost('/Check/GetSitePartials/',
		{
			request: request,
			ignoreCache: ignoreCache,
			includeResults: includeResults
		},
		function (result) {
			_.each(topGroupsRequests, function (r) {
				var $topGroupContent = r.$topGroup.find(".contents");
				var mgResult = _.find(result, function (resultItem) { return resultItem.SiteGroupId === r.id; });
				if (mgResult.Success) {
					markAsLoaded(r.$topGroup);

					// needs trim, because content may have indents that break the layout
					var trimmedResultHtmlText = mgResult.Content.trim();

					if (hasGroupPassedFilterByIdMap) {
						var $tmpContent = $(trimmedResultHtmlText);
						$tmpContent.find('.check-project').filter(function (i, el) {

							var id = $(el).attr('data-id');

							if (checkIndexOfClosedGroups) {

								var topGroupId = id.split('-')[0];
								var subGroupId = id.split('-')[1];

								var subGroupsFromTopGroups = _.flatten(_.map(checkIndexOfClosedGroups.TopGroups, function (topGroup) { return topGroup.SubGroups; }));
								var checksAttributesFromServerSideSubGroup = _.filter(checkIndexOfClosedGroups.SubGroups.concat(subGroupsFromTopGroups), function (subGroup) {
									return subGroup.Id == subGroupId;
								})[0].ChecksAttributes;

								return !hasGroupPassedFilterByIdMap[id] ||
									_.all(checksAttributesFromServerSideSubGroup,
										function (checkAttributes) {
											return needToHideCheck(
												checkAttributes.Name,
												topGroupId,
												hasGroupPassedFilterByIdMap,
												checkAttributes.TypeSourceId,
												checkAttributes.Location,
												checkAttributes.TagIds);
										});
							}

							return !hasGroupPassedFilterByIdMap[id];
						}).addClass('hidden');

						$topGroupContent.html($tmpContent);
					} else {
						$topGroupContent.html(trimmedResultHtmlText);
					}

					BindLoadChecks($topGroupContent, r.id, r.viewType, includeResults);

				} else {
					$topGroupContent.html('<div class="errormsg">Could not load monitor group</div>');
				}
			});
		},
		function (xhr, err) {
			_.each(topGroupsRequests, function (r) {
				var $content = r.$topGroup.find(".contents");
				$content.html('<div class="errormsg">Could not load monitor group</div>');
			});
			log('Error when calling GetSitePartials');
			reloadMasonry();
		}
	);
}

function setLoadImageForEachLoadingGroup(firstTime) {
	var expandedSubGroups = [];

	if (firstTime) { // in this case need use user profile from server
		expandedSubGroups = apica.overview.userProfile.expandedSubGroups;
	} else { // in other cases need use actual/client user profile
		expandedSubGroups = getActualUserProfile(false).expandedSubGroups;
	}

	$('.check-project').each(function () {
		var $this = $(this);
		var monitorGroupId = parseInt(GetSubMonitorGroupId($this));
		if ($.inArray(monitorGroupId, expandedSubGroups) >= 0) {
			$this.addClass('open');
			$this.children('.check-container, .sorting').show();
		}
	});
	$('.sortable', '#main').masonry('reload');
}

function CollapseAll() {
	var $subGroupContainers = $('.check-project.open');
	$subGroupContainers.removeClass('open').children('.check-container, .sorting').hide();

	var $topGroupContainers = $('.topgroup-box.open');
	$topGroupContainers.removeClass('open');
	$topGroupContainers.find('.topgroup-content').hide();

	$('.sortable', '#main').masonry('reload');
}

function ExpandAll() {

	var hasGroupPassedFilterByIdMap =
		applyFilterToMonitorGroups(apica.overview.topGroups, filterValue["group"]);

	var $topGroupContainers = $('.topgroup-box:not(.open)').filter(function (i, el) {
		return hasGroupPassedFilterByIdMap[$(el).attr('data-id')];
	});
	$topGroupContainers.addClass('open');
	$topGroupContainers.find('.topgroup-content').show();

	var $subGroupContainers = $('.check-project:not(.open)').filter(function (i, el) {
		return hasGroupPassedFilterByIdMap[$(el).attr('data-id')];
	});
	$subGroupContainers.addClass('open').children('.check-container, .sorting').show();

	var topGroupsRequests = [];
	_.each($topGroupContainers, function (item) {
		var $topGroupContainer = $(item);
		var $topGroup = $topGroupContainer.parent();
		var viewType = $topGroup.find('.view-grid.active').length === 0 ? 'list' : 'grid';
		if (shouldBeLoaded($topGroup)) {
			var topGroupIdInt = parseInt($topGroup.attr('data-monitorgroup-id'));
			topGroupsRequests.push({ $topGroup: $topGroup, id: topGroupIdInt, viewType: viewType });
		}
	});

	monitorGroupsDeferred.push(LoadMonitorGroupContents(topGroupsRequests, true, true, hasGroupPassedFilterByIdMap));

	$.when.apply($, monitorGroupsDeferred).then(function () {
		var $subGroupContainersNotExpandedYet = $('.check-project:not(.open)').filter(function (i, el) {
			return hasGroupPassedFilterByIdMap[$(el).attr('data-id')];
		});
		$subGroupContainersNotExpandedYet.addClass('open').children('.check-container, .sorting').show();

		reloadMasonry();
		var subGroupsRequests = [];
		_.each($subGroupContainers.get().concat($subGroupContainersNotExpandedYet.get()), function (item) {
			var $subGroup = $(item);
			var subGroupId = $subGroup.attr('data-id').split('-')[1];
			var $checksContainer = $subGroup.find('.check-container');
			if (shouldBeLoaded($checksContainer)) {
				subGroupsRequests.push({ $checksContainer: $checksContainer, id: parseInt(subGroupId) });
			}
		});

		LoadChecksContents(subGroupsRequests, false);
	});

	reloadMasonry();
}

function BindLoadChecks($container, groupId, viewType, includeResults) {
	$container.find('.project-title').click(function () {
		var $checkProjectGroup = $(this).closest('.check-project');

		var monitorGroupId = $checkProjectGroup.attr('data-id').split('-')[1];

		// Toggle between open and closed status
		if ($checkProjectGroup.hasClass('open')) {
			$checkProjectGroup.removeClass('open').children('.check-container, .sorting').hide();
			$('.sortable', '#main').masonry('reload');
		}
		else {
			$checkProjectGroup.addClass('open').children('.check-container, .sorting').show();
			var $checksContainer = $checkProjectGroup.find('.check-container');
			if (shouldBeLoaded($checksContainer)) {
				var callback = function (result) {
					$checkProjectGroup.find('.check').show();
					refreshCheckFilter();
				};
				LoadChecksContent($checksContainer, callback, monitorGroupId, includeResults);
			}
		}
	});
}

function WriteCheckErrorNotification(result) {
	if (!result.AllChecksValid) {
		notifier.warning(result.Message);
	}
}

function HandleUpdatingTagsByGetMonitorGroupsChecksResult(result) {
	if (!result.IsGetCheckTagValueAssociationsOk) {
		notifier.warning(
			"Tag associations can not be loaded at the moment. Please refresh the page. Contact your system administrator if this problem persists.");
	} else {
		for (var checkIdStr in result.CheckTagValueAssociationsByCheckIdStringMap) {
			if (result.CheckTagValueAssociationsByCheckIdStringMap.hasOwnProperty(checkIdStr)) {
				apica.tags.model.checkTagValueAssociationsByCheckIdMap[parseInt(checkIdStr)] =
					result.CheckTagValueAssociationsByCheckIdStringMap[checkIdStr];
			}
		}
	}
}

function LoadChecksContent($container, callback, monitorGroupId, includeResults) {
	var dataToPass = {
		"subgroupsIds[0]": monitorGroupId,
		includeResults: includeResults
	};

	return $.ajax({
		url: '/Check/GetMonitorGroupsChecks/',
		data: dataToPass,
		dataType: 'json',
		type: 'POST',
		beforeSend: null,
		complete: null,
		success: function (result) {
			WriteCheckErrorNotification(result);
			HandleUpdatingTagsByGetMonitorGroupsChecksResult(result);

			if (result.Data.length) {
				$container.html(result.Data[0].ChecksList);
			} else {
				$container.html('');
			}

			markAsLoaded($container);

			if (includeResults) {

				var $checkContainer = $container.parent();
				setUpdateTimestamp($checkContainer);

				$checkContainer.find('.check').each(function () {
					setUpdateTimestamp($(this));
				});
			}

			$('.sortable', '#main').masonry('reload');

			callback(result);
		},
		error: function (xhr, err) {
			log('responseText: ' + xhr.responseText + 'readyState: ' + xhr.readyState + '\nstatus: ' + xhr.status);
			$container.html('<div class="errormsg">Could not load checks</div>');
			reloadMasonry();
		}
	});
}

function LoadChecksContents(subGroupsRequests, includeResults) {
	if (subGroupsRequests.length === 0) {
		return;
	}

	var data = {
		subgroupsIds: _.map(subGroupsRequests, function (item) { return item.id; }),
		includeResults: includeResults
	}

	$.ajax({
		url: '/Check/GetMonitorGroupsChecks/',
		data: JSON.stringify(data),
		contentType: 'application/json; charset=utf-8',
		type: 'POST',
		beforeSend: null,
		complete: null,
		success: function (result) {
			HandleUpdatingTagsByGetMonitorGroupsChecksResult(result);

			_.each(subGroupsRequests, function (r) {
				var sgResult = _.find(result.Data, function (resultItem) {
					return resultItem.MonitorGroupId == r.id;
				});

				// needs trim, because content may have indents that break the layout
				r.$checksContainer.html(sgResult.ChecksList.trim());
				markAsLoaded(r.$checksContainer);

				if (includeResults) {

					var $checkContainer = r.$checksContainer.parent();
					setUpdateTimestamp($checkContainer);

					r.$checksContainer.find('.check').each(function() {
						setUpdateTimestamp($(this));
					});
				}
			});

			refreshCheckFilter();
		},
		error: function (xhr, err) {
			_.each(subGroupsRequests, function (r) {
				r.$checksContainer.html('<div class="errormsg">Could not load checks</div>');
			});
		}
	});
}

function toggleSeverityColor(sender) {
	if ($(sender).attr('checked') == 'checked') {
		$('.header-gradient').addClass('severity-nogradient');
		$('.project-title').addClass('severity-font');
	} else {
		$('.header-gradient').removeClass('severity-nogradient');
		$('.project-title').removeClass('severity-font');
	}
}

function toggleHideTopMenu(sender) {
	$('body').toggleClass('lightweight', $(sender).attr('checked') == 'checked');
	if (apica.Header) { apica.Header.recalculateSize(); }
}

function markAsLoaded($element) {
	$element.attr('load', 'true');
}

function setUpdateTimestamp($element) {
	$element.attr('update-utc', moment.utc().valueOf());
}

function markAsNotLoaded($element) {
	$element.attr('load', 'false');
}

function shouldBeLoaded($element) {
	var isLoaded = $element.attr('load') === 'true';
	return !isLoaded;
}

function getGroupsWithChecksOnScreen() {
	var result = { topGroups: [] };
	var windowHeight = $(window).height();
	var windowScrollTop = $(window).scrollTop();

	// Top groups
	$('.topgroup-box').each(function () {
		var $topGroup = $(this);
		var isTopGroupOpened = $(this).hasClass('open');

		if (isTopGroupOpened && $topGroup.is(':visible')) {
			var topGroupPosOnScreeStart = $topGroup.offset().top - windowScrollTop;
			var topGroupPosOnScreeEnd = topGroupPosOnScreeStart + $topGroup.height();

			if (topGroupPosOnScreeStart < windowHeight && topGroupPosOnScreeEnd > 0) {
				var topGroupId = GetMonitorGroupId($topGroup);
				var hasAttrLoad = $topGroup.parents('li').attr('load') || false;

				var topGroup = {
					id: topGroupId,
					open: isTopGroupOpened,
					load: hasAttrLoad,
					subGroups: [],
					checks: []
				}

				// Sub groups in list view mode
				$topGroup.find('.check-project').each(function () {
					var $subGroup = $(this);
					var isSubGroupOpened = $subGroup.hasClass('open');

					if (isSubGroupOpened && $subGroup.is(':visible')) {
						var subGroupPosOnScreeStart = $subGroup.offset().top - windowScrollTop;
						var subGroupPosOnScreeEnd = subGroupPosOnScreeStart + $subGroup.height();

						if (subGroupPosOnScreeStart < windowHeight && subGroupPosOnScreeEnd > 0) {
							var subGroupId = GetSubMonitorGroupId($subGroup);
							var hasAttrLoad = $subGroup.find('.check-container').attr('load') || false;
							var updateUtc = $subGroup.attr('update-utc');
							var $checksContainer = $subGroup.find('.check-container');

							topGroup.viewType = "list";

							var subGroup = {
								id: subGroupId,
								open: isSubGroupOpened,
								load: hasAttrLoad,
								checks: [],
								updateUtc: updateUtc,
								$checksContainer: $checksContainer
							}

							$subGroup.find('.check').each(function () {
								var $check = $(this);
								var checkPosOnScreeStart = $check.offset().top - windowScrollTop;
								var checkPosOnScreeEnd = checkPosOnScreeStart + $check.height();

								if (checkPosOnScreeStart < windowHeight && checkPosOnScreeEnd > 0) {
									var checkId = $check.attr('checkid');
									var updateUtc = $check.attr('update-utc');

									var check = {
										id: checkId,
										updateUtc: updateUtc,
										group: subGroupId
									}

									subGroup.checks.push(check);
								}
							});

							subGroup.checksCount = $subGroup.find('.check').length;

							topGroup.subGroups.push(subGroup);
						}
					}
				});

				// Sub groups in grid view mode
				$topGroup.find('.project').each(function () {
					var $subGroups = $(this);

					topGroup.viewType = "grid";
					topGroup.checks = [];
					topGroup.updateUtc = $subGroups.attr('update-utc');

					$subGroups.find('.check').each(function () {
						var $check = $(this);
						var checkPosOnScreeStart = $check.offset().top - windowScrollTop;
						var checkPosOnScreeEnd = checkPosOnScreeStart + $check.height();

						if (checkPosOnScreeStart < windowHeight && checkPosOnScreeEnd > 0) {
							var checkId = $check.attr('checkid');
							var updateUtc = $check.attr('update-utc');

							var check = {
								id: checkId,
								updateUtc: updateUtc,
								group: topGroupId
							}

							topGroup.checks.push(check);
						}
					});

					topGroup.checksCount = $subGroups.find('.check').length;
				});

				result.topGroups.push(topGroup);
			}
		}
	});

	return result;
}

function updateGroupsWithChecksOnScreen() {
	var groupsWithChecksOnScreen = getGroupsWithChecksOnScreen();

	var topGroups = _.filter(groupsWithChecksOnScreen.topGroups, function (topGroup) { return topGroup.load; });
	var subGroups = _.flatten(_.map(topGroups, function (topGroup) { return topGroup.subGroups; }));

	var checksFromSubGroups = _.flatten(_.map(subGroups, function (subGroup) { return subGroup.checks; }));
	var checksFromTopGroups = _.flatten(_.map(topGroups, function (topGroup) { return topGroup.checks; }));
	var allChecks = _.union(checksFromSubGroups, checksFromTopGroups);

	var checksForDetails = _.filter(allChecks, function (check) {
		return check.updateUtc === undefined ||
			($autoRefreshCheckbox && $autoRefreshCheckbox.checked && check.updateUtc !== '' &&
				moment.utc().valueOf() - check.updateUtc > autoRefreshIntervalDelay);
	});

	var subGroupsForDetails = _.filter(subGroups, function (subGroup) {
		var needUpdateGroup = subGroup.open && subGroup.load &&
			(subGroup.updateUtc === undefined ||
				($autoRefreshCheckbox && $autoRefreshCheckbox.checked && subGroup.updateUtc !== '' &&
					moment.utc().valueOf() - subGroup.updateUtc > autoRefreshIntervalDelay));

		var needUpdateChecks = _.intersect(checksForDetails, subGroup.checks).length > 0;

		return needUpdateGroup || needUpdateChecks;
	});

	var topGroupsForDetails = _.filter(topGroups, function (topGroup) {
		var needUpdateGroup = topGroup.viewType === 'grid' &&
			(topGroup.updateUtc === undefined ||
				($autoRefreshCheckbox && $autoRefreshCheckbox.checked && topGroup.updateUtc !== '' &&
					moment.utc().valueOf() - topGroup.updateUtc > autoRefreshIntervalDelay));

		var needUpdateChecks = _.intersect(checksForDetails, topGroup.checks).length > 0;

		return needUpdateGroup || needUpdateChecks;
	});

	if (subGroupsForDetails.length || topGroupsForDetails.length) {

		var subGroupsForDetailsIds = _.map(subGroupsForDetails, function (subGroup) { return subGroup.id; });
		var topGroupsForDetailsIds = _.map(topGroupsForDetails, function (topGroup) { return topGroup.id; });
		var checksForDetailsObjs = _.map(checksForDetails, function (check) { return { checkId: check.id, groupId: check.group } });
		var checksForDetailsIds = _.map(checksForDetailsObjs, function (obj) { return obj.checkId; });

		$('.check-project').each(function () {
			var $monitorGroup = $(this);
			var monitorGroupId = GetSubMonitorGroupId($monitorGroup);

			if (_.contains(subGroupsForDetailsIds, monitorGroupId)) {
				$monitorGroup.attr('update-utc', '');

				$monitorGroup.find('.check').each(function () {
					var $check = $(this);
					var checkId = $check.attr('checkid');
					var checksForDetailsInGroupIds = _.map(_.filter(checksForDetailsObjs, function (check) { return check.groupId == monitorGroupId; }), function (check) { return check.checkId; });

					if (_.contains(checksForDetailsInGroupIds, checkId)) {
						$check.attr('update-utc', '');

						addLoadersToElements($check.find('.bar'));
					}
				});
			}
		});

		$('.project').each(function () {
			var $monitorGroup = $(this);
			var monitorGroupId = GetTopMonitorGroupId($monitorGroup);

			if (_.contains(topGroupsForDetailsIds, monitorGroupId)) {
				$monitorGroup.attr('update-utc', '');

				$monitorGroup.find('.check').each(function () {
					var $check = $(this);
					var checkId = $check.attr('checkid');
					var checksForDetailsInGroupIds = _.map(_.filter(checksForDetailsObjs, function (check) { return check.groupId == monitorGroupId; }), function (check) { return check.checkId; });

					if (_.contains(checksForDetailsInGroupIds, checkId)) {
						$check.attr('update-utc', '');

						addLoadersToElements($check.find('.bar'));
					}
				});
			}
		});

		var partialUpdateRequest = {
			subGroups: _.map(subGroupsForDetails, function (subGroupForDetails) {
				var checks = _.intersect(_.map(subGroupForDetails.checks, function (check) { return check.id }), checksForDetailsIds) || [];
				return {
					id: subGroupForDetails.id,
					allChecks: subGroupForDetails.checksCount === checks.length,
					checks: checks
				}
			}),
			topGroups: _.map(topGroupsForDetails, function (topGroupForDetails) {
				var checks = _.intersect(_.map(topGroupForDetails.checks, function (check) { return check.id }), checksForDetailsIds) || [];
				return {
					id: topGroupForDetails.id,
					allChecks: topGroupForDetails.checksCount === checks.length,
					checks: checks
				}
			})
		};

		getAndApplyOverviewUpdate(false, partialUpdateRequest);
	} else {

		if ($autoRefreshCheckbox && $autoRefreshCheckbox.checked && timeAccumulatorGlobal > autoRefreshIntervalDelay) {
			getAndApplyOverviewUpdate(false, {});
			timeAccumulatorGlobal = 0;
		}
	}
}

apica.overview.initFilterComponents = function (filterTarget, checkTypes, locationsGroups) {

	app = new Vue({
		el: "#filter-container-app",
		data: {
			filterTarget: filterTarget,
			checkTypes: _.map(checkTypes, function (group) {
				return {
					group: group.name,
					options: group.checkTypes
				};
			}),
			locations: _.map(locationsGroups, function (group) {
				return {
					group: group.name,
					options: group.locations
				};
			}),
			groups: [
				{
					group: null,
					options: _.map(apica.overview.topGroups,
						function (t) {
							var list = _.map(t.subGroups,
								function (sg) { return { text: sg.descriptor, value: sg.id, isGroup: false, parentGroup: t.id }; });
							list.unshift({ text: t.descriptor, value: t.id, isGroup: true, items: t.subGroups });
							return list;
						}).reduce(function (prev, curr) {
							return prev.concat(curr);
						}, [])
				}],
			tags: _.map(apica.tags.model.tags, function (t) {
				return {
					group: t.key.name,
					options: _.map(t.values, function (tv) { return { text: tv.value, value: tv.id }; })
				};
			}),
			preventFilterCheck: false
		},
		methods: {
			onSearchFilterChanged: function (e) {
				filterValue["text-search"] = e.value;
			},
			onCheckTypeFilterChanged: function (e) {
				filterValue["checktype"] = createFilterBlockObject(e);
			},
			onLocationFilterChanged: function (e) {
				filterValue["location"] = createFilterBlockObject(e);
			},
			onGroupFilterChanged: function (e) {
				filterValue["group"] = createFilterBlockObject(e);
			},
			onTagFilterChanged: function (e) {
				filterValue["tag"] = createFilterBlockObject(e);
			},
			onFilterPresetSelected: function (preset) {
				if (preset.value) {
					this.resetFilterValues(preset.value);
				}
			},
			getCurrentFilterValue: function () {
				return Object.assign({}, filterValue);
			},
			applyFilter: function (doNotGetCheckIndexOfClosedGroups) {

				if (!this.preventFilterCheck) {

					if (doNotGetCheckIndexOfClosedGroups) {
						filterChecks(checkIndexOfClosedGroups);
						return;
					}

					var topGroupIds = _.map($('.topgroup-box').not('.open'), function (group) {
						return $(group).attr('data-id');
					});

					var subGroupIds = _.map($('.check-project').not('.open'), function (group) {
						return $(group).attr('data-id').split('-')[1];
					});

					if (!checkIndexOfClosedGroups && (topGroupIds.length > 0 || subGroupIds.length > 0)) {

						var $filtersBar = $('#main-container .filters-bar');

						$filtersBar.addClass('disabled');

						apica.ajax.apiCallCustomHandler(
							'POST',
							'/Check/GetCheckIndexOfClosedGroups/',
							{
								topGroupIds: topGroupIds,
								subGroupIds: subGroupIds
							},
							function (result) {

								checkIndexOfClosedGroups = result.Data;

								// Delete check index for closed groups after checkIndexOfClosedGroupsLifeTime milliseconds
								setTimeout(function () {
									if (checkIndexOfClosedGroups) {
										delete checkIndexOfClosedGroups.TopGroups;
										delete checkIndexOfClosedGroups.SubGroups;
									}
									checkIndexOfClosedGroups = undefined;
								},
									checkIndexOfClosedGroupsLifeTime);

								$filtersBar.removeClass('disabled');

								filterChecks(checkIndexOfClosedGroups);
							},
							function (err) {
								$filtersBar.removeClass('disabled');
								notifier.error('Cannot receive information about closed groups.');
							}
						);
					} else {
						filterChecks(checkIndexOfClosedGroups);
					}
				}
			},
			resetFilterValues: function (initValues) {
				var resetStates = [];

				this.preventFilterCheck = true;
				this.$children.forEach(function (child) {
					if (child.reset) {
						if (initValues) {
							var key = child.id;
							var resetState = child.reset(initValues[key]);

							resetStates.push(resetState);
						} else {
							child.reset();
						}
					}
				});
				this.preventFilterCheck = false;
				this.applyFilter();

				if (resetStates.filter(function (state) { return state === 1; }).length > 0) {
					notifier.warning('The filter contains values that cannot be restored. To avoid such situations in the future, please resave the filter.');
				}
			},
			resetPresetSelection: function () {
				this.$children.filter(function (child) { return child.id === 'presets'; })[0].unselectOption();
			}
		}
	});

	filterValueDefaults = Object.assign({}, filterValue);

	function createFilterBlockObject(e) {
		return e.selectedValues.length > 0
			? {
				include: e.filterMode === 'include' ? e.selectedValues : {},
				exclude: e.filterMode === 'exclude' ? e.selectedValues : {}
			}
			: {};
	}
};