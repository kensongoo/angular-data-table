'use strict';

/* global angular, $, jQuery */

angular.module('angularDataTable')
    .directive('angularDataTable', ['$log', '$timeout', '$compile', 'dataTableExtend', function($log, $timeout, $compile, dataTableExtend) {
        return {
            restrict: 'A', // DataTable will throw error if the element is not a table
            scope   : {
                'headers'       : '=',
                'data'          : '=',
                'settings'      : '=',
                'ajaxLoad'      : '=',
                'onSorting'     : '=',
                'onSearch'      : '=',
                'onNavigatePage': '=',
                'drawCallback'  : '=',
                'saveState'     : '=',
                'rowPerPage'    : '@',
                'scope'         : '=',
                'tableObject'   : '='
            },
            link    : function($scope, element, attrs) {

                // first time loading, hide the element first to fix the problem of table flicking
                $(element).hide();

                // make datatable throw errors instead of using window.alert
                $.fn.dataTableExt.sErrMode = 'throw';

                $scope.$watchCollection(function() {
                    return $scope.data;
                }, function() {
                    buildSettings();
                });

                $scope.$watchCollection(function(newData, oldData) {
                    return $scope.headers;
                }, function(newData, oldData) {
                    if(newData !== oldData) {
                        buildSettings(true);
                    }
                });

                function buildSettings(reRender) {
                    var settings = {
                        'aoColumns'  : $scope.headers,
                        'aaData'     : $scope.data,
                        'fnStateSave': stateSave,
                        'fnStateLoad': stateLoad
                    };

                    // if save state is set
                    $scope.saveState && _.extend(settings, {
                        'bStateSave': true
                    });

                    $scope.rowPerPage && _.extend(settings, {
                        'iDisplayLength': parseInt($scope.rowPerPage)
                    });

                    $scope.settings && _.extend(settings, $scope.settings);

                    render(settings, reRender);
                }

                function angularizeTable(element, settings) {

                    var table = jQuery(element).find('table').dataTable();
                    var oSettings = table.fnSettings();

                    if($scope.tableObject) {
                        $scope.tableObject = table;
                    }

                    settings.fnDrawCallback = function(oSettings) {
                        $timeout(function() {
                            jQuery(element).find('tbody tr').each(function(key, item) {
                                if(! jQuery(this).hasClass('is-angularized')) {
                                    jQuery(this).html($compile(jQuery(item).html())($scope.scope || $scope))
                                        .addClass('is-angularized');
                                }
                            });
                        });

                        if($scope.drawCallback) {
                            $scope.drawCallback.call(undefined, arguments);
                        }
                    };
                }

                function stateSave(oSettings, oData) {
                    // save state using session storage
                    if(sessionStorage && $scope.saveState) {
                        sessionStorage[oSettings.sCookiePrefix + oSettings.sInstance] = angular.toJson(oData);
                    }
                }

                function stateLoad(oSettings) {
                    if(sessionStorage && $scope.saveState && sessionStorage[oSettings.sCookiePrefix + oSettings.sInstance]) {
                        return angular.fromJson(sessionStorage[oSettings.sCookiePrefix + oSettings.sInstance]);
                    }
                }

                function render(settings, reRender) {
                    if(settings && settings.aoColumns && settings.aaData) {

                        // make the table connect to Angular
                        angularizeTable(element, settings);

                        if(! jQuery(element).hasClass('initialized')) {
                            jQuery(element).not('.initialized').addClass('initialized').dataTable(settings);

                            // add additional header if found
                            var newHeader = null;
                            if($scope.settings.secondHeader) {
                                newHeader = jQuery('<tr role="row"></tr>');
                                angular.forEach($scope.settings.secondHeader, function(item, key) {
                                    if(item) {
                                        newHeader.append($compile('<th>' + item + '</th>')($scope.scope || $scope));
                                    }
                                    else {
                                        newHeader.append('<th></th>');
                                    }
                                });
                            }

                            jQuery(element).find('thead').append(newHeader);
                        }
                        else {
                            var table = jQuery(element).dataTable();
                            var oSettings = table.fnSettings();

                            if($scope.tableObject) {
                                $scope.tableObject = table;
                            }

                            table.dataTable().fnClearTable();
                            for(var i = 0; i < $scope.data.length; i ++) {
                                table.fnAddData($scope.data[i], false);
                            }
                            table.dataTable().fnStandingRedraw();
                        }

                        // show the element
                        $(element).show();
                    }

                    prettifySearchBox();
                    autoResizeSearchBox();
                }

                function prettifySearchBox() {

                    // this DOM manipulation make the dataTable looks pixel perfect to UX design
                    var $tableParentElement = jQuery(element).parent();
                    if($tableParentElement.hasClass('dataTables_wrapper')) {
                        if($tableParentElement.find('.btn-icon').length < 1) {
                            $tableParentElement
                                .find('.dataTables_filter')
                                .addClass('input-append')
                                .find('label')
                                .replaceWith($tableParentElement.find('.dataTables_filter input').after('<button class="btn btn-icon"><i class="icon-search"></i></button>'));
                        }
                    }
                }

                function autoResizeSearchBox() {
                    jQuery(element).parent().find('.dataTables_filter input').on('focus',function() {
                        jQuery(this).css({width: '300px'});
                    }).on('blur', function() {
                        if(jQuery(this).val().toString().length < 1) {
                            jQuery(this).css({width: '170px'});
                        }
                    });
                }
            }
        };
    }])

    .service('dataTableExtend', function() {
        // extend the dataTable to allow custom column based filter
        $.extend($.fn.dataTableExt.ofnSearch, {
            'url-numeric': function(sData) {
                sData = sData.match(/<a[^>]*>(.*?)<\/a>/);
                return sData[1] ? parseInt(sData[1]) : 0;
            }
        });

        // extend the dataTable to support custom sorting
        $.extend($.fn.dataTableExt.oSort, {

            // currency sorting
            'currency-pre'      : function(a) {
                if(typeof(a) === 'undefined' || a === null || a === '') {
                    a = - 1; // fixed for problem that $0 is treated the same like empty string
                }
                else {
                    a = (a === "-") ? 0 : a.replace(/[^\d\-\.]/g, "");
                }

                return parseFloat(a);
            },
            'currency-asc'      : function(a, b) {
                return a - b;
            },
            'currency-desc'     : function(a, b) {
                return b - a;
            },

            // numeric sorting
            'numeric-comma-asc' : function(a, b) {
                var x = (a === "-") ? 0 : a.replace(/,/, ".");
                var y = (b === "-") ? 0 : b.replace(/,/, ".");
                x = parseFloat(x);
                y = parseFloat(y);
                return ((x < y) ? - 1 : ((x > y) ? 1 : 0));
            },
            'numeric-comma-desc': function(a, b) {
                var x = (a === "-") ? 0 : a.replace(/,/, ".");
                var y = (b === "-") ? 0 : b.replace(/,/, ".");
                x = parseFloat(x);
                y = parseFloat(y);
                return ((x < y) ? 1 : ((x > y) ? - 1 : 0));
            },

            // url numeric sorting
            // example: <a href="http://test.com/1">1</a>
            'url-numeric-pre'   : function(a) {
                a = a.match(/<a[^>]*>(.*?)<\/a>/);
                return a[1] ? parseInt(a[1]) : 0;
            },
            'url-numeric-asc'   : function(a, b) {
                return a - b;
            },
            'url-numeric-desc'  : function(a, b) {
                return b - a;
            },

            // month year
            // example: 4-2009
            'month-year-pre'    : function(a) {
                a = '1-' + a;
                return Date.parse(a);
            },
            'month-year-asc'    : function(a, b) {
                return a - b;
            },
            'month-year-desc'   : function(a, b) {
                return b - a;
            },

            'percentage-range-pre' : function(a) {
                if(typeof(a) === 'undefined' || a === null || a === '') {
                    a = - 1; // fixed for problem that 0% is treated the same like empty string
                }
                else if(typeof(a) === 'string') {

                    // if it is a range, remove the the second part
                    // example: 5-10%  become 5
                    if(a.indexOf('-') !== - 1) {
                        a = a.toString().substr(0, a.indexOf('-'));
                    }
                    // remove the percentage if found
                    a = a.replace(/%/, '');
                    a = parseFloat(a);
                }
                else {
                    a = 0;
                }

                return a;
            },
            'percentage-range-asc' : function(a, b) {
                return a - b;
            },
            'percentage-range-desc': function(a, b) {
                return b - a;
            }

        });

        // fix the problem that pagination is lost when table is redrawn
        $.fn.dataTableExt.oApi.fnStandingRedraw = function(oSettings) {
            if(oSettings.oFeatures.bServerSide === false) {
                var before = oSettings._iDisplayStart;

                oSettings.oApi._fnReDraw(oSettings);

                // iDisplayStart has been reset to zero - so lets change it back
                oSettings._iDisplayStart = before;
                oSettings.oApi._fnCalculateEnd(oSettings);
            }

            // draw the 'current' page
            oSettings.oApi._fnDraw(oSettings);
        };

    });