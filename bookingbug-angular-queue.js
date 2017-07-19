'use strict';

angular.module('BBQueue.controllers', []);
angular.module('BBQueue.services', []);
angular.module('BBQueue.directives', []);
angular.module('BBQueue.translations', []);

angular.module('BBQueue', ['BBQueue.controllers', 'BBQueue.services', 'BBQueue.directives', 'BBQueue.translations', 'ngDragDrop', 'timer']);
'use strict';

angular.module('BBQueue').config(function (AdminCoreOptionsProvider) {
    'ngInject';

    AdminCoreOptionsProvider.setOption('side_navigation', [{
        group_name: 'SIDE_NAV_QUEUING',
        items: ['queue']
    }, {
        group_name: 'SIDE_NAV_BOOKINGS',
        items: ['calendar', 'clients']
    }, {
        group_name: 'SIDE_NAV_CONFIG',
        items: ['config-iframe', 'publish-iframe', 'settings-iframe']
    }]);
});
'use strict';

angular.module('BBQueue').run(function (RuntimeStates, AdminQueueOptions, SideNavigationPartials) {
    if (AdminQueueOptions.use_default_states) {
        RuntimeStates.state('queue', {
            parent: AdminQueueOptions.parent_state,
            url: "queue",
            resolve: {
                company: function company(user) {
                    return user.$getCompany();
                },
                services: function services(company) {
                    return company.$getServices();
                },
                people: function people(company) {
                    return company.$getPeople();
                },
                bookings: function bookings(company, BBModel) {
                    var params = {
                        company: company,
                        start_date: moment().format('YYYY-MM-DD'),
                        end_date: moment().format('YYYY-MM-DD'),
                        start_time: moment().format('HH:mm'),
                        skip_cache: false
                    };
                    return BBModel.Admin.Booking.$query(params);
                }
            },
            controller: function controller($scope, company, services, people, bookings, BBModel) {
                $scope.bookings = bookings;
                $scope.services = services;
                $scope.people = people;

                var refreshBookings = function refreshBookings() {
                    var params = {
                        company: company,
                        start_date: moment().format('YYYY-MM-DD'),
                        end_date: moment().format('YYYY-MM-DD'),
                        start_time: moment().format('HH:mm'),
                        skip_cache: false
                    };
                    BBModel.Admin.Booking.$query(params).then(function (bookings) {
                        $scope.bookings = bookings;
                        $scope.$broadcast('updateBookings', bookings);
                    });
                };

                var pusherSubscribe = function pusherSubscribe() {
                    var pusher_channel = company.getPusherChannel('bookings');
                    if (pusher_channel) {
                        pusher_channel.bind('create', refreshBookings);
                        pusher_channel.bind('update', refreshBookings);
                        pusher_channel.bind('destroy', refreshBookings);
                    }
                };

                pusherSubscribe();
            },

            templateUrl: "queue/index.html"
        }).state('queue.concierge', {
            parent: 'queue',
            url: "/concierge",
            templateUrl: "queue/concierge.html",
            controller: 'QueueConciergePageCtrl'
        }).state('queue.server', {
            parent: 'queue',
            url: "/server/:id",
            resolve: {
                person: function person(people, $stateParams) {
                    var person = _.findWhere(people, {
                        id: parseInt($stateParams.id),
                        queuing_disabled: false
                    });
                    return person.$refetch();
                }
            },
            templateUrl: "queue/server.html",
            controller: function controller($scope, $stateParams, person) {
                $scope.person = person;
            }
        });
    }

    if (AdminQueueOptions.show_in_navigation) {
        SideNavigationPartials.addPartialTemplate('queue', 'queue/nav.html');
    }
});

angular.module('BBQueue').run(function ($injector, BBModel, $translate) {
    var models = ['Queuer', 'ClientQueue'];

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = Array.from(models)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var model = _step.value;

            BBModel['Admin'][model] = $injector.get('Admin' + model + 'Model');
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
});
'use strict';

/**
 * @ngdoc controller
 * @name BBQueue.controllers.controller:QueueConciergePageCtrl
 *
 * @description
 * Controller for the queue concierge page
 */
angular.module('BBQueue.controllers').controller('QueueConciergePageCtrl', ['$scope', '$state', function ($scope, $state) {}]);
'use strict';

var QueueServerController = function QueueServerController($scope, $log, AdminQueueService, ModalForm, BBModel, CheckSchema, $uibModal, AdminPersonService, $q, AdminQueuerService, adminQueueLoading, Dialog, $translate) {

    $scope.adminQueueLoading = {
        isLoadingServerInProgress: adminQueueLoading.isLoadingServerInProgress
    };

    $scope.loadingServer = false;

    var init = function init() {
        var bookings = _.filter($scope.bookings.items, function (booking) {
            return booking.person_id == $scope.person.id;
        });
        if (bookings && bookings.length > 0) {
            $scope.person.next_booking = bookings[0];
        } else {
            $scope.person.next_booking = null;
        }
    };

    $scope.setAttendance = function (person, status, duration) {
        $scope.loadingServer = true;
        person.setAttendance(status, duration).then(function (person) {
            $scope.loadingServer = false;
        }, function (err) {
            $log.error(err.data);
            $scope.loadingServer = false;
        });
    };

    var upcomingBookingCheck = function upcomingBookingCheck(person) {
        return person.next_booking && person.next_booking.start.isBefore(moment().add(1, 'hour'));
    };

    $scope.startServingQueuer = function (person, queuer) {
        $scope.loadingServer = true;
        adminQueueLoading.setLoadingServerInProgress(true);
        if (upcomingBookingCheck(person)) {
            Dialog.confirm({
                title: $translate.instant('ADMIN_DASHBOARD.QUEUE_PAGE.NEXT_BOOKING_DIALOG_HEADING'),
                body: $translate.instant('ADMIN_DASHBOARD.QUEUE_PAGE.NEXT_BOOKING_DIALOG_BODY', {
                    name: person.name, time: person.next_booking.start.format('HH:mm')
                }),
                success: function success() {
                    person.startServing(queuer).then(function () {
                        if ($scope.selectQueuer) $scope.selectQueuer(null);
                        $scope.getQueuers();
                        $scope.loadingServer = false;
                        adminQueueLoading.setLoadingServerInProgress(false);
                    });
                },
                fail: function fail() {
                    $scope.loadingServer = false;
                    adminQueueLoading.setLoadingServerInProgress(false);
                }
            });
        } else {
            person.startServing(queuer).then(function () {
                if ($scope.selectQueuer) $scope.selectQueuer(null);
                $scope.getQueuers();
                $scope.loadingServer = false;
                adminQueueLoading.setLoadingServerInProgress(false);
            });
        }
    };

    $scope.finishServingQueuer = function (options) {
        var person = options.person;
        var serving = person.serving;

        $scope.loadingServer = true;
        adminQueueLoading.setLoadingServerInProgress(true);
        if (options.status) {
            person.finishServing().then(function () {
                serving.$get('booking').then(function (booking) {
                    booking = new BBModel.Admin.Booking(booking);
                    booking.current_multi_status = options.status;
                    booking.$update(booking).then(function (res) {
                        $scope.loadingServer = false;
                        adminQueueLoading.setLoadingServerInProgress(false);
                    }, function (err) {
                        $scope.loadingServer = false;
                        adminQueueLoading.setLoadingServerInProgress(false);
                    });
                });
            });
        } else {
            serving.$get('booking').then(function (booking) {
                booking = new BBModel.Admin.Booking(booking);
                booking.current_multi_status = options.status;
                if (booking.$has('edit')) {
                    finishServingOutcome(person, booking);
                } else {
                    $scope.loadingServer = false;
                    adminQueueLoading.setLoadingServerInProgress(false);
                }
            });
        }
    };

    var finishServingOutcome = function finishServingOutcome(person, booking) {
        var modalInstance = $uibModal.open({
            templateUrl: 'queue/finish_serving_outcome.html',
            resolve: {
                person: person,
                booking: booking,
                schema: function schema() {
                    var defer = $q.defer();
                    booking.$get('edit').then(function (schema) {
                        var form = _.reject(schema.form, function (x) {
                            return x.type === 'submit';
                        });
                        form[0].tabs = [form[0].tabs[form[0].tabs.length - 1]];
                        var showModalPopUp = false;
                        var _iteratorNormalCompletion = true;
                        var _didIteratorError = false;
                        var _iteratorError = undefined;

                        try {
                            for (var _iterator = form[0].tabs[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                                var tab = _step.value;

                                if (tab.title === 'Outcomes') showModalPopUp = true;
                            }
                        } catch (err) {
                            _didIteratorError = true;
                            _iteratorError = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion && _iterator.return) {
                                    _iterator.return();
                                }
                            } finally {
                                if (_didIteratorError) {
                                    throw _iteratorError;
                                }
                            }
                        }

                        if (showModalPopUp === true) {
                            schema.schema = CheckSchema(schema.schema);
                            defer.resolve(schema);
                        } else defer.reject('No outcomes');
                    }, function () {
                        defer.reject();
                    });
                    return defer.promise;
                }
            },
            controller: function controller($scope, $uibModalInstance, schema, booking, person) {

                $scope.person = person;

                $scope.form_model = booking;

                $scope.form = schema.form;

                $scope.schema = schema.schema;

                $scope.submit = function () {
                    return $uibModalInstance.close();
                };

                $scope.close = function () {
                    return $uibModalInstance.dismiss('cancel');
                };
            }
        });

        modalInstance.result.then(function () {
            booking.$update(booking).then(function () {
                person.finishServing().finally(function () {
                    person.attendance_status = 1;
                    $scope.loadingServer = false;
                    adminQueueLoading.setLoadingServerInProgress(false);
                });
            });
        }, function (err) {
            if (err === 'No outcomes') {
                person.finishServing().then(function () {
                    person.attendance_status = 1;
                    $scope.loadingServer = false;
                    adminQueueLoading.setLoadingServerInProgress(false);
                });
            } else {
                $scope.loadingServer = false;
                adminQueueLoading.setLoadingServerInProgress(false);
            }
        });
    };

    $scope.updateQueuer = function () {
        $scope.person.$get('queuers').then(function (collection) {
            collection.$get('queuers').then(function (queuers) {
                queuers = _.map(queuers, function (q) {
                    return new BBModel.Admin.Queuer(q);
                });
                $scope.person.serving = null;
                var queuer = _.find(queuers, function (queuer) {
                    return queuer.$has('person') && queuer.$href('person') == $scope.person.$href('self');
                });
                $scope.person.serving = queuer;
            });
        });
    };

    $scope.extendAppointment = function (mins) {
        $scope.loadingServer = true;
        $scope.person.serving.extendAppointment(mins).then(function (queuer) {
            $scope.person.serving = queuer;
            $scope.loadingServer = false;
        });
    };

    $scope.$on('updateBookings', function () {
        return init();
    });

    init();
};

angular.module('BBQueue.controllers').controller('bbQueueServerController', QueueServerController);
'use strict';

angular.module('BBQueue.directives').directive('countdown', function () {

    var controller = function controller($scope) {

        $scope.$watch('$$value$$', function (value) {
            if (value != null) {
                return $scope.updateModel(value);
            }
        });
    };

    var link = function link(scope, element, attrs, ngModel) {

        ngModel.$render = function () {
            if (ngModel.$viewValue) {
                return scope.$$value$$ = ngModel.$viewValue;
            }
        };

        scope.updateModel = function (value) {
            ngModel.$setViewValue(value);

            var secs = parseInt((value % 60).toFixed(0));
            var mins = parseInt((value / 60).toFixed(0));

            if (mins > 1) {
                return scope.due = mins + ' Mins';
            } else if (mins === 1) {
                return scope.due = "1 Min";
            } else if (mins === 0 && secs > 10) {
                return scope.due = "< 1 Min";
            } else {
                return scope.due = "Next Up";
            }
        };

        return scope.due = "";
    };

    return {
        require: 'ngModel',
        link: link,
        controller: controller,
        scope: {
            min: '@'
        },
        template: '{{due}}'
    };
});
'use strict';

angular.module('BBQueue.directives').directive('bbQueueServer', function (PusherQueue) {
    return {
        controller: 'bbQueueServerController',
        link: function link(scope, element, attrs) {
            PusherQueue.subscribe(scope.bb.company);
            PusherQueue.channel.bind('notification', function (data) {
                scope.updateQueuer();
            });
            scope.updateQueuer();
        }
    };
});
'use strict';

angular.module('BBQueue.directives').directive('bbServerListItem', function () {
    return {
        controller: 'bbQueueServerController',
        templateUrl: 'queue/queue_server_list_item.html'
    };
});
"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

angular.module('BB.Models').factory("AdminClientQueueModel", function ($q, BBModel, BaseModel) {

    return function (_BaseModel) {
        _inherits(Admin_ClientQueue, _BaseModel);

        function Admin_ClientQueue() {
            _classCallCheck(this, Admin_ClientQueue);

            return _possibleConstructorReturn(this, _BaseModel.apply(this, arguments));
        }

        return Admin_ClientQueue;
    }(BaseModel);
});
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

angular.module('BB.Models').factory("AdminQueuerModel", function ($q, BBModel, BaseModel) {

    return function (_BaseModel) {
        _inherits(Admin_Queuer, _BaseModel);

        function Admin_Queuer(data) {
            _classCallCheck(this, Admin_Queuer);

            var _this = _possibleConstructorReturn(this, _BaseModel.call(this, data));

            _this.start = moment.parseZone(_this.start);
            _this.due = moment.parseZone(_this.due);
            _this.end = moment(_this.start).add(_this.duration, 'minutes');
            _this.created_at = moment.parseZone(_this.created_at);
            return _this;
        }

        Admin_Queuer.prototype.remaining = function remaining() {
            var d = this.due.diff(moment.utc(), 'seconds');
            this.remaining_unsigned = Math.abs(d);
            return this.remaining_signed = d;
        };

        Admin_Queuer.prototype.getName = function getName() {
            var str = "";
            if (this.first_name) {
                str += this.first_name;
            }
            if (str.length > 0 && this.last_name) {
                str += " ";
            }
            if (this.last_name) {
                str += this.last_name;
            }
            return str;
        };

        /***
         * @ngdoc method
         * @name fullMobile
         * @methodOf BB.Models:Address
         * @description
         * Full mobile phone number of the client
         *
         * @returns {object} The returned full mobile number
         */


        Admin_Queuer.prototype.fullMobile = function fullMobile() {
            if (!this.mobile) {
                return;
            }
            if (!this.mobile_prefix) {
                return this.mobile;
            }
            return '+' + this.mobile_prefix + (this.mobile.substr(0, 1) === '0' ? this.mobile.substr(1) : this.mobile);
        };

        Admin_Queuer.prototype.startServing = function startServing(person) {
            var _this2 = this;

            var defer = $q.defer();
            if (this.$has('start_serving')) {
                console.log('start serving url ', this.$href('start_serving'));
                person.$flush('self');
                this.$post('start_serving', { person_id: person.id }).then(function (q) {
                    person.$get('self').then(function (p) {
                        return person.updateModel(p);
                    });
                    _this2.updateModel(q);
                    return defer.resolve(_this2);
                }, function (err) {
                    return defer.reject(err);
                });
            } else {
                defer.reject('start_serving link not available');
            }
            return defer.promise;
        };

        Admin_Queuer.prototype.finishServing = function finishServing() {
            var _this3 = this;

            var defer = $q.defer();
            if (this.$has('finish_serving')) {
                this.$post('finish_serving').then(function (q) {
                    _this3.updateModel(q);
                    return defer.resolve(_this3);
                }, function (err) {
                    return defer.reject(err);
                });
            } else {
                defer.reject('finish_serving link not available');
            }
            return defer.promise;
        };

        Admin_Queuer.prototype.extendAppointment = function extendAppointment(minutes) {
            var _this4 = this;

            var new_duration = void 0;
            var defer = $q.defer();
            if (this.end.isBefore(moment())) {
                var d = moment.duration(moment().diff(this.start));
                new_duration = d.as('minutes') + minutes;
            } else {
                new_duration = this.duration + minutes;
            }
            this.$put('self', {}, { duration: new_duration }).then(function (q) {
                _this4.updateModel(q);
                _this4.end = moment(_this4.start).add(_this4.duration, 'minutes');
                return defer.resolve(_this4);
            }, function (err) {
                return defer.reject(err);
            });
            return defer.promise;
        };

        Admin_Queuer.prototype.$refetch = function $refetch() {
            var _this5 = this;

            var defer = $q.defer();
            this.$flush('self');
            this.$get('self').then(function (res) {
                _this5.constructor(res);
                return defer.resolve(_this5);
            }, function (err) {
                return defer.reject(err);
            });
            return defer.promise;
        };

        Admin_Queuer.prototype.$delete = function $delete() {
            var _this6 = this;

            var defer = $q.defer();
            this.$flush('self');
            this.$del('self').then(function (res) {
                _this6.constructor(res);
                return defer.resolve(_this6);
            }, function (err) {
                return defer.reject(err);
            });
            return defer.promise;
        };

        return Admin_Queuer;
    }(BaseModel);
});
'use strict';

angular.module('BBQueue.services').factory('AdminQueueService', function ($q, BBModel) {
    return {
        query: function query(params) {
            var defer = $q.defer();
            params.company.$get('client_queues').then(function (collection) {
                return collection.$get('client_queues').then(function (client_queues) {
                    var models = Array.from(client_queues).map(function (q) {
                        return new BBModel.Admin.ClientQueue(q);
                    });
                    return defer.resolve(models);
                }, function (err) {
                    return defer.reject(err);
                });
            }, function (err) {
                return defer.reject(err);
            });
            return defer.promise;
        }
    };
});
'use strict';

angular.module('BBQueue.services').factory('adminQueueLoading', function () {
    var loadingServerInProgress = false;
    return {
        isLoadingServerInProgress: function isLoadingServerInProgress() {
            return loadingServerInProgress;
        },
        setLoadingServerInProgress: function setLoadingServerInProgress(bool) {
            loadingServerInProgress = bool;
        }
    };
});
'use strict';

/**
 * @ngdoc service
 * @name BBQueue.services.service:AdminQueueOptions
 *
 * @description
 * Returns a set of admin queueing configuration options
 */

/**
 * @ngdoc service
 * @name BBQueue.services.service.AdminQueueOptionsProvider
 *
 * @description
 * Provider
 *
 * @example
 <pre module='BBQueue.services.service.AdminQueueOptionsProvider'>
     angular.module('ExampleModule').config ['AdminQueueOptionsProvider', (AdminQueueOptionsProvider) ->
        AdminQueueOptionsProvider.setOption('option', 'value')
     ]
 </pre>
 */
angular.module('BBQueue.services').provider('AdminQueueOptions', function () {
    var options = {
        use_default_states: true,
        show_in_navigation: true,
        parent_state: 'root'
    };

    this.setOption = function (option, value) {
        if (options.hasOwnProperty(option)) {
            options[option] = value;
        }
    };

    this.getOption = function (option) {
        if (options.hasOwnProperty(option)) {
            return options[option];
        }
    };
    this.$get = function () {
        return options;
    };
});
'use strict';

angular.module('BBQueue.services').factory('AdminQueuerService', function ($q, BBModel) {
    return {
        query: function query(params) {
            var defer = $q.defer();
            params.company.$flush('queuers');
            params.company.$get('queuers').then(function (collection) {
                return collection.$get('queuers').then(function (queuers) {
                    var models = Array.from(queuers).map(function (q) {
                        return new BBModel.Admin.Queuer(q);
                    });
                    return defer.resolve(models);
                }, function (err) {
                    return defer.reject(err);
                });
            }, function (err) {
                return defer.reject(err);
            });
            return defer.promise;
        }
    };
});
'use strict';

// THIS IS CRUFTY AND SHOULD BE REMOVE WITH AN API UPDATE THAT TIDIES UP THE SCEMA RESPONE
// fix the issues we have with the the sub client and question blocks being in doted notation, and
// not in child objects
angular.module('BBQueue.services').service('CheckSchema', function ($q, BBModel) {
    return function (schema) {
        for (var k in schema.properties) {
            var v = schema.properties[k];
            var vals = k.split(".");
            if (vals[0] === "questions" && vals.length > 1) {
                if (!schema.properties.questions) {
                    schema.properties.questions = { type: "object", properties: {} };
                }
                if (!schema.properties.questions.properties[vals[1]]) {
                    schema.properties.questions.properties[vals[1]] = {
                        type: "object",
                        properties: { answer: v }
                    };
                }
            }
            if (vals[0] === "client" && vals.length > 2) {
                if (!schema.properties.client) {
                    schema.properties.client = {
                        type: "object",
                        properties: { q: { type: "object", properties: {} } }
                    };
                }
                if (schema.properties.client.properties) {
                    if (!schema.properties.client.properties.q.properties[vals[2]]) {
                        schema.properties.client.properties.q.properties[vals[2]] = {
                            type: "object",
                            properties: { answer: v }
                        };
                    }
                }
            }
        }
        return schema;
    };
});
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

angular.module('BBQueue.services').factory('PusherQueue', function ($sessionStorage, AppConfig) {
    return function () {
        function PusherQueue() {
            _classCallCheck(this, PusherQueue);
        }

        PusherQueue.subscribe = function subscribe(company) {
            if (company != null && typeof Pusher !== 'undefined' && Pusher !== null) {
                if (this.client == null) {
                    this.pusher = new Pusher('c8d8cea659cc46060608', {
                        authEndpoint: '/api/v1/push/' + company.id + '/pusher.json',
                        auth: {
                            headers: {
                                'App-Id': AppConfig['App-Id'],
                                'App-Key': AppConfig['App-Key'],
                                'Auth-Token': $sessionStorage.getItem('auth_token')
                            }
                        }
                    });
                    return this.channel = this.pusher.subscribe('mobile-queue-' + company.id);
                }
            }
        };

        return PusherQueue;
    }();
});
'use strict';

/**
* @ngdoc overview
* @name BBQueue.translations
*
* @description
* Translations for the queue people module
*/
angular.module('BBQueue.translations').config(['$translateProvider', function ($translateProvider) {
    return $translateProvider.translations('en', {
        'SIDE_NAV_QUEUING': 'QUEUING',
        'ADMIN_DASHBOARD': {
            'SIDE_NAV': {
                'QUEUE_PAGE': {
                    'QUEUE': 'Concierge',
                    'REPORT': 'Queue Reports',
                    'BOOKING_REPORT': 'Booking Reports',
                    'PERF_REPORT': 'Performance Reports',
                    'MAP_REPORT': 'Map Reports',
                    'LIST': 'Queue Display'
                }
            },
            'QUEUE_PAGE': {
                'NEXT_BOOKING_DIALOG_HEADING': 'Upcoming Appointment',
                'NEXT_BOOKING_DIALOG_BODY': '{{name}} has an appointment at {{time}}. Are you sure they want to serve another customer beforehand?',
                'NEW_QUEUER': 'New Queuer',
                'ADD_CUSTOMER_FORM': {
                    'TITLE': "Add Customer",
                    'FIRST_NAME_LBL': "First Name *",
                    'FIRST_NAME_PLACEHOLDER': "First Name",
                    'LAST_NAME_LBL': "@:COMMON.TERMINOLOGY.LAST_NAME",
                    'LAST_NAME_PLACEHOLDER': "@:COMMON.TERMINOLOGY.LAST_NAME",
                    'MOBILE_LBL': "@:COMMON.TERMINOLOGY.MOBILE",
                    'MOBILE_PLACEHOLDER': "@:COMMON.TERMINOLOGY.MOBILE",
                    'NOTES_LBL': "Notes",
                    'NOTES_PLACEHOLDER': "Notes",
                    'MAKE_APPOINTMENT_BTN': "Make Appointment",
                    'SERVE_NOW_BTN': "Serve Now",
                    'ADD_TO_QUEUE_BTN': "Add to Queue"
                },
                'SERVE_NOW_MODAL': {
                    'TITLE': 'Serve Now',
                    'PICK_A_SERVICE_LBL': "Pick a service",
                    'PICK_A_SERVER_LBL': "Pick a server",
                    'DISMISS_BTN': 'Dismiss',
                    'SERVE_NOW_BTN': "Serve Now"
                },
                'PICK_A_SERVICE_MODAL': {
                    'TITLE': 'Pick a Service',
                    'CANCEL_BTN': 'Cancel'
                },
                'FINISH_SERVING_OUTCOME_MODAL': {
                    'EDIT_CUSTOMER_BTN': 'Edit Customer',
                    'SAVE_AND_FINISH_SERVING_BTN': 'Save and Finish Serving'
                },
                'QUEUE_SERVER_ACTIONS': {
                    'ACTIONS_BTN': 'Actions',
                    'TOGGLE_DROPDOWN_CARET_LBL': 'Toggle Dropdown',
                    'SET_FREE': 'Set Free',
                    'SET_AS_AVAILABLE': 'Set as Available',
                    'AVAILABLE_END_BREAK': 'Available / End Break',
                    'END_SHIFT': 'End Shift',
                    'ON_BREAK_FOR': 'On Break for',
                    'MARK_AS_BUSY_FOR': 'Mark as busy for',
                    'FINISH_SERVING_BTN': 'Finish Serving',
                    'SERVE_BTN': 'Serve',
                    'SERVE_NEXT_BTN': 'Serve Next',
                    'MARK_ABSENT_BTN': 'Mark Absent'
                },
                'QUEUE_SERVER_LIST_ITEM': {
                    'AVAILABLE': 'Available',
                    'ON_BREAK_UNTIL': 'On break until',
                    'ESTIMATED': 'estimated',
                    'BUSY_UNTIL': 'Busy until',
                    'SERVING': 'Serving',
                    'SINCE': 'Since',
                    'FINISH_ESTIMATE': 'Finish Estimate',
                    'NEXT_APPOINTMENT': 'Next appointment'
                },
                'QUEUERS': {
                    'ARRIVED_AT': 'Arrived at',
                    'DUE_AT': 'Due at',
                    'SERVICE': 'Service',
                    'CHECK_IN': 'Check in',
                    'NO_SHOW': 'No Show',
                    'WALKED_OUT': 'Walked out'
                },
                'SELECTED_QUEUER': {
                    'QUEUER': 'Queuer',
                    'DUE': 'Due',
                    'POSITION': 'Position',
                    'ARRIVED': 'Arrived',
                    'ESTIMATED_WAIT_TIME': 'Estimated Wait Time ',
                    'MINUTE': 'minute',
                    'SERVICE': 'Service',
                    'NAME': 'Name',
                    'MOBILE': 'Mobile',
                    'EMAIL': 'Email',
                    'NOTES': 'Notes',
                    'TOGGLE_DROPDOWN_CARET_LBL': 'Toggle Dropdown',
                    'BACK_BTN': 'Back',
                    'FORWARD_BTN': 'Forward',
                    'LEAVE_QUEUE_BTN': 'Leave Queue',
                    'EDIT_CUSTOMER_BTN': 'Edit Customer',
                    'CLOSE_BTN': 'Close'
                },
                'SERVER': {
                    'SERVING': 'Serving',
                    'APPOINTMENT_STARTED_AT': 'Appointment started at',
                    'APPOINTMENT_DUE_TO_FINISH_AT': 'Appointment due to finish at',
                    'EXTEND_APPOINTMENT': 'Extend Appointment',
                    'TOGGLE_DROPDOWN_CARET_LBL': 'Toggle Dropdown',
                    'IDLE': 'Idle',
                    'NEXT_APPOINTMENT': 'Next appointment'
                }
            }
        }
    });
}]);
'use strict';

var AddQueueCustomerController = function AddQueueCustomerController($scope, $log, AdminServiceService, AdminQueuerService, ModalForm, BBModel, $interval, $sessionStorage, $uibModal, $q, AdminBookingPopup) {

    var addQueuer = function addQueuer(form) {
        var defer = $q.defer();
        var service = form.service;
        var person = form.server;
        $scope.new_queuer.service_id = service.id;
        service.$post('queuers', {}, $scope.new_queuer).then(function (response) {
            var queuer = new BBModel.Admin.Queuer(response);
            if (person) {
                queuer.startServing(person).then(function () {
                    defer.resolve();
                }, function () {
                    defer.reject();
                });
            } else {
                defer.resolve();
            }
        });
        return defer.promise;
    };

    var resetQueuer = function resetQueuer() {
        $scope.new_queuer = {};
        $scope.loading = false;
    };

    $scope.addToQueue = function () {
        $scope.loading = true;
        var modalInstance = $uibModal.open({
            templateUrl: 'queue/pick_a_service.html',
            scope: $scope,
            controller: function controller($scope, $uibModalInstance) {

                $scope.dismiss = function () {
                    return $uibModalInstance.dismiss('cancel');
                };

                $scope.submit = function (form) {
                    return $uibModalInstance.close(form);
                };
            }
        });

        modalInstance.result.then(addQueuer).then(resetQueuer).finally(function () {
            return $scope.loading = false;
        });
    };

    $scope.availableServers = function () {
        return _.filter($scope.servers, function (server) {
            return server.attendance_status == 1;
        });
    };

    $scope.serveCustomerNow = function () {
        $scope.loading = true;
        var modalInstance = $uibModal.open({
            templateUrl: 'queue/serve_now.html',
            resolve: {
                services: function services() {
                    return $scope.services;
                },
                servers: function servers() {
                    return $scope.availableServers();
                }
            },
            controller: function controller($scope, $uibModalInstance, services, servers) {

                $scope.form = {};

                $scope.services = services;

                $scope.servers = servers;

                $scope.dismiss = function () {
                    return $uibModalInstance.dismiss('cancel');
                };

                $scope.submit = function (form) {
                    return $uibModalInstance.close(form);
                };
            }
        });

        modalInstance.result.then(addQueuer).then(resetQueuer).finally(function () {
            return $scope.loading = false;
        });
    };

    $scope.makeAppointment = function (options) {
        var defaultOptions = {
            item_defaults: {
                pick_first_time: true,
                merge_people: true,
                merge_resources: true,
                date: moment().format('YYYY-MM-DD')
            },
            on_conflict: "cancel()",
            company_id: $scope.company.id
        };

        options = _.extend(defaultOptions, options);

        var popup = AdminBookingPopup.open(options);

        popup.result.finally(resetQueuer);
    };
};

angular.module('BBQueue.controllers').controller('bbQueueAddCustomer', AddQueueCustomerController);
'use strict';

angular.module('BBQueue.directives').directive('bbQueueAddCustomer', function () {
    return {
        controller: 'bbQueueAddCustomer',
        templateUrl: 'queue/add_customer.html',
        scope: {
            services: '=',
            servers: '=',
            company: '='
        }
    };
});
'use strict';

var QueueDashboardController = function QueueDashboardController($scope, $log, AdminServiceService, AdminQueuerService, ModalForm, BBModel, $interval, $sessionStorage, $uibModal, $q, AdminPersonService) {

    $scope.loading = true;
    $scope.waiting_for_queuers = false;
    $scope.queuers = [];
    $scope.new_queuer = {};

    // this is used to retrigger a scope check that will update service time
    $interval(function () {
        if ($scope.queuers) {
            return Array.from($scope.queuers).map(function (queuer) {
                return queuer.remaining();
            });
        }
    }, 5000);

    $scope.getSetup = function () {
        var params = { company: $scope.company };
        AdminServiceService.query(params).then(function (services) {
            $scope.services = [];
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = Array.from(services)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var service = _step.value;

                    if (!service.queuing_disabled) {
                        $scope.services.push(service);
                    }
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }

            return $scope.loading = false;
        }, function (err) {
            $log.error(err.data);
            return $scope.loading = false;
        });
    };

    $scope.getQueuers = function () {
        if ($scope.waiting_for_queuers) {
            return;
        }
        $scope.waiting_for_queuers = true;
        var params = { company: $scope.company };
        return AdminQueuerService.query(params).then(function (queuers) {
            $scope.queuers = queuers;
            $scope.waiting_queuers = [];
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = Array.from(queuers)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var queuer = _step2.value;

                    queuer.remaining();
                    if (queuer.position > 0) {
                        $scope.waiting_queuers.push(queuer);
                    }
                }
            } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion2 && _iterator2.return) {
                        _iterator2.return();
                    }
                } finally {
                    if (_didIteratorError2) {
                        throw _iteratorError2;
                    }
                }
            }

            $scope.waiting_queuers = _.sortBy($scope.waiting_queuers, function (x) {
                return x.position;
            });

            $scope.loading = false;
            return $scope.waiting_for_queuers = false;
        }, function (err) {
            $log.error(err.data);
            $scope.loading = false;
            return $scope.waiting_for_queuers = false;
        });
    };

    $scope.dropQueuer = function (event, ui, server, trash) {
        if ($scope.drag_queuer) {
            if (trash) {
                $scope.trash_hover = false;
                $scope.drag_queuer.$del('self').then(function (queuer) {});
            }

            if (server) {
                return $scope.drag_queuer.startServing(server).then(function () {});
            }
        }
    };

    $scope.walkedOut = function (queuer) {
        return queuer.$delete().then(function () {
            return $scope.selected_queuer = null;
        });
    };

    $scope.selectQueuer = function (queuer) {
        if ($scope.selected_queuer && $scope.selected_queuer === queuer) {
            return $scope.selected_queuer = null;
        } else {
            return $scope.selected_queuer = queuer;
        }
    };

    $scope.selectDragQueuer = function (queuer) {
        return $scope.drag_queuer = queuer;
    };

    $scope.getServers = function () {
        if ($scope.getting_people) {
            return;
        }
        $scope.company.$flush('people');
        $scope.getting_people = true;
        return AdminPersonService.query({ company: $scope.company }).then(function (people) {
            $scope.getting_people = false;
            $scope.all_people = people;
            $scope.servers = [];
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
                for (var _iterator3 = Array.from($scope.all_people)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                    var person = _step3.value;

                    if (!person.queuing_disabled) {
                        $scope.servers.push(person);
                    }
                }
            } catch (err) {
                _didIteratorError3 = true;
                _iteratorError3 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion3 && _iterator3.return) {
                        _iterator3.return();
                    }
                } finally {
                    if (_didIteratorError3) {
                        throw _iteratorError3;
                    }
                }
            }

            $scope.servers = _.sortBy($scope.servers, function (server) {
                if (server.attendance_status === 1) {
                    // available
                    return 0;
                }
                if (server.attendance_status === 4) {
                    // serving/busy
                    return 1;
                }
                if (server.attendance_status === 2) {
                    // on a break
                    return 2;
                }
                if (server.attendance_status === 3) {
                    // other
                    return 3;
                }
                if (server.attendance_status === 3) {
                    // off shift
                    return 4;
                }
            });

            $scope.loading = false;
            return $scope.updateQueuers();
        }, function (err) {
            $scope.getting_people = false;
            $log.error(err.data);
            return $scope.loading = false;
        });
    };

    $scope.setAttendance = function (person, status, duration) {
        $scope.loading = true;
        return person.setAttendance(status, duration).then(function (person) {
            $scope.loading = false;
        }, function (err) {
            $log.error(err.data);
            return $scope.loading = false;
        });
    };

    $scope.$watch('queuers', function (newValue, oldValue) {
        return $scope.getServers();
    });

    $scope.updateQueuers = function () {
        if ($scope.queuers && $scope.servers) {
            var shash = {};
            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;
            var _iteratorError4 = undefined;

            try {
                for (var _iterator4 = Array.from($scope.servers)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                    var server = _step4.value;

                    server.serving = null;
                    shash[server.self] = server;
                }
            } catch (err) {
                _didIteratorError4 = true;
                _iteratorError4 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion4 && _iterator4.return) {
                        _iterator4.return();
                    }
                } finally {
                    if (_didIteratorError4) {
                        throw _iteratorError4;
                    }
                }
            }

            return function () {
                var result = [];
                var _iteratorNormalCompletion5 = true;
                var _didIteratorError5 = false;
                var _iteratorError5 = undefined;

                try {
                    for (var _iterator5 = Array.from($scope.queuers)[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                        var queuer = _step5.value;

                        var item = void 0;
                        if (queuer.$href('person') && shash[queuer.$href('person')] && queuer.position === 0) {
                            item = shash[queuer.$href('person')].serving = queuer;
                        }
                        result.push(item);
                    }
                } catch (err) {
                    _didIteratorError5 = true;
                    _iteratorError5 = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion5 && _iterator5.return) {
                            _iterator5.return();
                        }
                    } finally {
                        if (_didIteratorError5) {
                            throw _iteratorError5;
                        }
                    }
                }

                return result;
            }();
        }
    };

    $scope.dropCallback = function (event, ui, queuer, $index) {
        $scope.$apply(function () {
            return $scope.selectQueuer(null);
        });
        return false;
    };

    $scope.dragStart = function (event, ui, queuer) {
        $scope.$apply(function () {
            $scope.selectDragQueuer(queuer);
            return $scope.selectQueuer(queuer);
        });
        return false;
    };

    return $scope.dragStop = function (event, ui) {
        $scope.$apply(function () {
            return $scope.selectQueuer(null);
        });
        return false;
    };
};

angular.module('BBQueue.controllers').controller('bbQueueDashboard', QueueDashboardController);
'use strict';

angular.module('BBQueue.directives').directive('bbQueueDashboard', function () {
    return {
        controller: 'bbQueueDashboard',
        link: function link(scope, element, attrs) {
            return scope.getSetup();
        }
    };
});
'use strict';

var QueuersController = function QueuersController($scope, $log, AdminQueuerService, AdminQueueService, ModalForm, $interval, $q, BBModel, AlertService, ErrorService, $translate) {

    $scope.loading = true;

    var getServerQueuers = function getServerQueuers() {
        var defer = $q.defer();
        $scope.person.$flush('queuers');
        $scope.person.$get('queuers').then(function (collection) {
            collection.$get('queuers').then(function (queuers) {
                queuers = _.map(queuers, function (q) {
                    return new BBModel.Admin.Queuer(q);
                });
                defer.resolve(queuers);
            });
        });
        return defer.promise;
    };

    $scope.getQueuers = function () {
        if ($scope.waiting_for_queuers) {
            return;
        }
        $scope.waiting_for_queuers = true;
        var params = { company: $scope.company };

        var proms = [];
        var queuer_prom = void 0;
        if ($scope.person) {
            queuer_prom = getServerQueuers();
        } else {
            queuer_prom = AdminQueuerService.query(params);
        }
        proms.push(queuer_prom);
        queuer_prom.then(function (queuers) {
            return $scope.new_queuers = queuers;
        }, function (err) {
            $scope.waiting_for_queuers = false;
            $log.error(err.data);
            $scope.loading = false;
        });

        var queue_prom = AdminQueueService.query(params);
        proms.push(queue_prom);
        queue_prom.then(function (queues) {
            return $scope.new_queues = queues;
        });

        $q.all(proms).then(function () {
            $scope.queuers = $scope.new_queuers;
            $scope.queues = $scope.new_queues;
            $scope.waiting_queuers = [];
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = Array.from($scope.queuers)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var queuer = _step.value;

                    queuer.remaining();
                    if (queuer.position > 0) {
                        $scope.waiting_queuers.push({ type: "Q", data: queuer, position: queuer.position });
                    }
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }

            $scope.waiting_queuers = _.sortBy($scope.waiting_queuers, function (x) {
                return x.position;
            });
            $scope.waiting_for_queuers = false;

            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = Array.from($scope.queues)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var q = _step2.value;

                    q.waiting_queuers = [];
                    var _iteratorNormalCompletion3 = true;
                    var _didIteratorError3 = false;
                    var _iteratorError3 = undefined;

                    try {
                        for (var _iterator3 = Array.from($scope.waiting_queuers)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                            queuer = _step3.value;

                            if (queuer.type === "Q" && queuer.data.client_queue_id === q.id || queuer.type === "B") {
                                q.waiting_queuers.push(queuer);
                            }
                        }
                    } catch (err) {
                        _didIteratorError3 = true;
                        _iteratorError3 = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion3 && _iterator3.return) {
                                _iterator3.return();
                            }
                        } finally {
                            if (_didIteratorError3) {
                                throw _iteratorError3;
                            }
                        }
                    }

                    q.waiting_queuers = _.sortBy(q.waiting_queuers, function (x) {
                        return x.position;
                    });
                }
            } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion2 && _iterator2.return) {
                        _iterator2.return();
                    }
                } finally {
                    if (_didIteratorError2) {
                        throw _iteratorError2;
                    }
                }
            }

            $scope.loading = false;
        }, function (err) {
            $scope.waiting_for_queuers = false;
            $log.error(err.data);
            $scope.loading = false;
        });
    };

    $scope.getAppointments = function (currentPage, filterBy, filterByFields, orderBy, orderByReverse, skipCache) {

        if (skipCache == null) {
            skipCache = true;
        }
        if (filterByFields && filterByFields.name != null) {
            filterByFields.name = filterByFields.name.replace(/\s/g, '');
        }
        if (filterByFields && filterByFields.mobile != null) {
            var mobile = filterByFields.mobile;

            if (mobile.indexOf('0') === 0) {
                filterByFields.mobile = mobile.substring(1);
            }
        }
        var defer = $q.defer();
        var params = {
            company: $scope.company,
            date: moment().format('YYYY-MM-DD'),
            url: $scope.bb.api_url
        };

        if (skipCache) {
            params.skip_cache = true;
        }
        if (filterBy) {
            params.filter_by = filterBy;
        }
        if (filterByFields) {
            params.filter_by_fields = filterByFields;
        }
        if (orderBy) {
            params.order_by = orderBy;
        }
        if (orderByReverse) {
            params.order_by_reverse = orderByReverse;
        }

        BBModel.Admin.Booking.$query(params).then(function (res) {
            var bookings = [];
            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;
            var _iteratorError4 = undefined;

            try {
                for (var _iterator4 = Array.from(res.items)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                    var item = _step4.value;

                    if (item.status !== 3) {
                        // not blocked
                        bookings.push(item);
                    }
                }
            } catch (err) {
                _didIteratorError4 = true;
                _iteratorError4 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion4 && _iterator4.return) {
                        _iterator4.return();
                    }
                } finally {
                    if (_didIteratorError4) {
                        throw _iteratorError4;
                    }
                }
            }

            defer.resolve(bookings);
        }, function (err) {
            return defer.reject(err);
        });
        return defer.promise;
    };

    $scope.setStatus = function (booking, status) {
        var clone = _.clone(booking);
        clone.current_multi_status = status;
        booking.$update(clone).then(function (res) {
            $scope.getQueuers();
        }, function (err) {
            AlertService.danger(ErrorService.getError('GENERIC'));
        });
    };

    $scope.newQueuerModal = function () {
        ModalForm.new({
            company: $scope.company,
            title: $translate.instant('ADMIN_DASHBOARD.QUEUE_PAGE.NEW_QUEUER'),
            new_rel: 'new_queuer',
            post_rel: 'queuers',
            success: function success(queuer) {
                $scope.queuers.push(queuer);
            }
        });
    };

    $scope.getQueuers();

    // this is used to retrigger a scope check that will update service time
    $interval(function () {
        if ($scope.queuers) {
            Array.from($scope.queuers).map(function (queuer) {
                return queuer.remaining();
            });
        }
    }, 5000);
};

angular.module('BBQueue.controllers').controller('bbQueuers', QueuersController);
'use strict';

angular.module('BBQueue.directives').directive('bbQueuers', function (PusherQueue) {
    return {
        controller: 'bbQueuers',
        link: function link(scope, element, attrs) {
            PusherQueue.subscribe(scope.bb.company);
            PusherQueue.channel.bind('notification', function (data) {
                scope.getQueuers();
            });
        },
        templateUrl: 'queue/queuers.html'
    };
});