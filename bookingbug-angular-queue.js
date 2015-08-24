(function() {
  'use strict';
  var queueapp;

  queueapp = angular.module('BBQueue', ['BB', 'BBAdmin.Services', 'BBAdmin.Directives', 'BBQueue.Services', 'BBQueue.Directives', 'BBQueue.Controllers', 'trNgGrid', 'ngDragDrop', 'pusher-angular']);

  angular.module('BBQueue.Directives', ['timer']);

  angular.module('BBQueue.Controllers', []);

  angular.module('BBQueue.Services', ['ngResource', 'ngSanitize', 'ngLocalData']);

  angular.module('BBQueueMockE2E', ['BBQueue', 'BBAdminMockE2E']);

  queueapp.run(function($rootScope, $log, DebugUtilsService, FormDataStoreService, $bbug, $document, $sessionStorage, AppConfig, AdminLoginService) {});

}).call(this);

(function() {
  angular.module('BBQueue').controller('bbQueueDashboardController', function($scope, $log, AdminServiceService, AdminQueuerService, ModalForm, BBModel, $interval, $sessionStorage) {
    $scope.loading = true;
    $scope.waiting_for_queuers = false;
    $scope.queuers = [];
    $scope.new_queuer = {};
    $scope.getSetup = function() {
      var params;
      params = {
        company: $scope.company
      };
      AdminServiceService.query(params).then(function(services) {
        var i, len, service;
        $scope.services = [];
        for (i = 0, len = services.length; i < len; i++) {
          service = services[i];
          if (!service.queuing_disabled) {
            $scope.services.push(service);
          }
        }
        return $scope.loading = false;
      }, function(err) {
        $log.error(err.data);
        return $scope.loading = false;
      });
      $scope.pusherSubscribe();
      return $scope.getQueuers();
    };
    $scope.getQueuers = function() {
      var params;
      if ($scope.waiting_for_queuers) {
        return;
      }
      $scope.waiting_for_queuers = true;
      params = {
        company: $scope.company
      };
      return AdminQueuerService.query(params).then(function(queuers) {
        var i, len, queuer;
        $scope.queuers = queuers;
        $scope.waiting_queuers = [];
        for (i = 0, len = queuers.length; i < len; i++) {
          queuer = queuers[i];
          queuer.remaining();
          if (queuer.position > 0) {
            $scope.waiting_queuers.push(queuer);
          }
        }
        $scope.loading = false;
        return $scope.waiting_for_queuers = false;
      }, function(err) {
        $log.error(err.data);
        $scope.loading = false;
        return $scope.waiting_for_queuers = false;
      });
    };
    $scope.overTrash = function(event, ui, set) {
      return $scope.$apply(function() {
        return $scope.trash_hover = set;
      });
    };
    $scope.hoverOver = function(event, ui, obj, set) {
      console.log(event, ui, obj, set);
      return $scope.$apply(function() {
        return obj.hover = set;
      });
    };
    $scope.dropQueuer = function(event, ui, server, trash) {
      if ($scope.drag_queuer) {
        if (trash) {
          $scope.trash_hover = false;
          $scope.drag_queuer.$del('self').then(function(queuer) {});
        }
        if (server) {
          return $scope.drag_queuer.startServing(server).then(function() {});
        }
      }
    };
    $scope.selectQueuer = function(queuer) {
      if ($scope.selected_queuer && $scope.selected_queuer === queuer) {
        return $scope.selected_queuer = null;
      } else {
        return $scope.selected_queuer = queuer;
      }
    };
    $scope.selectDragQueuer = function(queuer) {
      return $scope.drag_queuer = queuer;
    };
    $scope.addQueuer = function(service) {
      $scope.new_queuer.service_id = service.id;
      return service.$post('queuers', {}, $scope.new_queuer).then(function(queuer) {});
    };
    $scope.pusherSubscribe = (function(_this) {
      return function() {
        var channelName, pusherEvent;
        if (($scope.company != null) && (typeof Pusher !== "undefined" && Pusher !== null)) {
          if ($scope.pusher == null) {
            $scope.pusher = new Pusher('c8d8cea659cc46060608', {
              authEndpoint: "/api/v1/push/" + $scope.company.id + "/pusher.json",
              auth: {
                headers: {
                  'App-Id': 'f6b16c23',
                  'App-Key': 'f0bc4f65f4fbfe7b4b3b7264b655f5eb',
                  'Auth-Token': $sessionStorage.getItem('auth_token')
                }
              }
            });
          }
          channelName = "mobile-queue-" + $scope.company.id;
          if ($scope.pusher.channel(channelName) == null) {
            $scope.pusher_channel = $scope.pusher.subscribe(channelName);
            pusherEvent = function(res) {
              return $scope.getQueuers();
            };
            return $scope.pusher_channel.bind('notification', pusherEvent);
          }
        }
      };
    })(this);
    return $interval(function() {
      var i, len, queuer, ref, results;
      if ($scope.queuers) {
        ref = $scope.queuers;
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
          queuer = ref[i];
          results.push(queuer.remaining());
        }
        return results;
      }
    }, 5000);
  });

}).call(this);

(function() {
  angular.module('BBQueue').controller('bbQueueServers', function($scope, $log, AdminQueueService, ModalForm, AdminPersonService) {
    $scope.loading = true;
    $scope.getServers = function() {
      return AdminPersonService.query({
        company: $scope.company
      }).then(function(people) {
        var i, len, person, ref;
        $scope.all_people = people;
        $scope.servers = [];
        ref = $scope.all_people;
        for (i = 0, len = ref.length; i < len; i++) {
          person = ref[i];
          if (!person.queuing_disabled) {
            $scope.servers.push(person);
          }
        }
        $scope.loading = false;
        return $scope.updateQueuers();
      }, function(err) {
        $log.error(err.data);
        return $scope.loading = false;
      });
    };
    $scope.setAttendance = function(person, status) {
      $scope.loading = true;
      return person.setAttendance(status).then(function(person) {
        return $scope.loading = false;
      }, function(err) {
        $log.error(err.data);
        return $scope.loading = false;
      });
    };
    $scope.$watch('queuers', (function(_this) {
      return function(newValue, oldValue) {
        return $scope.updateQueuers();
      };
    })(this));
    $scope.updateQueuers = function() {
      var i, j, len, len1, queuer, ref, ref1, results, server, shash;
      if ($scope.queuers && $scope.servers) {
        shash = {};
        ref = $scope.servers;
        for (i = 0, len = ref.length; i < len; i++) {
          server = ref[i];
          server.serving = null;
          shash[server.self] = server;
        }
        ref1 = $scope.queuers;
        results = [];
        for (j = 0, len1 = ref1.length; j < len1; j++) {
          queuer = ref1[j];
          if (queuer.$href('person') && shash[queuer.$href('person')] && queuer.position === 0) {
            results.push(shash[queuer.$href('person')].serving = queuer);
          } else {
            results.push(void 0);
          }
        }
        return results;
      }
    };
    $scope.startServingQueuer = function(person, queuer) {
      return queuer.startServing(person).then(function() {
        return $scope.getQueuers();
      });
    };
    $scope.finishServingQueuer = function(person) {
      person.finishServing();
      return $scope.getQueuers();
    };
    $scope.dropCallback = function(event, ui, queuer, $index) {
      console.log("dropcall");
      $scope.$apply(function() {
        return $scope.selectQueuer(null);
      });
      return false;
    };
    $scope.dragStart = function(event, ui, queuer) {
      $scope.$apply(function() {
        $scope.selectDragQueuer(queuer);
        return $scope.selectQueuer(queuer);
      });
      console.log("start", queuer);
      return false;
    };
    return $scope.dragStop = function(event, ui) {
      console.log("stop", event, ui);
      $scope.$apply(function() {
        return $scope.selectQueuer(null);
      });
      return false;
    };
  });

}).call(this);

(function() {
  'use strict';
  angular.module('BBQueue.Controllers').controller('QueuerPosition', [
    "QueuerService", "$scope", "$pusher", "QueryStringService", function(QueuerService, $scope, $pusher, QueryStringService) {
      var params;
      params = {
        id: QueryStringService('id'),
        url: $scope.apiUrl
      };
      console.log("Params: ", params);
      return QueuerService.query(params).then(function(queuer) {
        var channel, client, pusher;
        console.log("Queuer: ", queuer);
        $scope.queuer = {
          name: queuer.first_name,
          position: queuer.position,
          dueTime: queuer.due.valueOf(),
          serviceName: queuer.service.name,
          spaceId: queuer.space_id,
          ticketNumber: queuer.ticket_number
        };
        client = new Pusher("c8d8cea659cc46060608");
        console.log("Client: ", client);
        pusher = $pusher(client);
        console.log("Pusher: ", pusher);
        channel = pusher.subscribe("mobile-queue-" + $scope.queuer.spaceId);
        console.log("Channel: ", channel);
        return channel.bind('notification', function(data) {
          $scope.queuer.dueTime = data.due.valueOf();
          $scope.queuer.ticketNumber = data.ticket_number;
          return $scope.queuer.position = data.position;
        });
      });
    }
  ]);

}).call(this);

(function() {
  angular.module('BBQueue').controller('bbQueuers', function($scope, $log, AdminQueuerService, ModalForm, $interval) {
    $scope.loading = true;
    $scope.getQueuers = function() {
      var params;
      params = {
        company: $scope.company
      };
      return AdminQueuerService.query(params).then(function(queuers) {
        var i, len, queuer;
        $scope.queuers = queuers;
        $scope.waiting_queuers = [];
        for (i = 0, len = queuers.length; i < len; i++) {
          queuer = queuers[i];
          queuer.remaining();
          if (queuer.position > 0) {
            $scope.waiting_queuers.push(queuer);
          }
        }
        return $scope.loading = false;
      }, function(err) {
        $log.error(err.data);
        return $scope.loading = false;
      });
    };
    $scope.newQueuerModal = function() {
      return ModalForm["new"]({
        company: $scope.company,
        title: 'New Queuer',
        new_rel: 'new_queuer',
        post_rel: 'queuers',
        success: function(queuer) {
          return $scope.queuers.push(queuer);
        }
      });
    };
    return $interval(function() {
      var i, len, queuer, ref, results;
      if ($scope.queuers) {
        ref = $scope.queuers;
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
          queuer = ref[i];
          results.push(queuer.remaining());
        }
        return results;
      }
    }, 5000);
  });

}).call(this);

(function() {
  angular.module('BBQueue').controller('bbQueues', function($scope, $log, AdminQueueService, ModalForm) {
    $scope.loading = true;
    return $scope.getQueues = function() {
      var params;
      params = {
        company: $scope.company
      };
      return AdminQueueService.query(params).then(function(queues) {
        $scope.queues = queues;
        return $scope.loading = false;
      }, function(err) {
        $log.error(err.data);
        return $scope.loading = false;
      });
    };
  });

}).call(this);

(function() {
  angular.module('BBQueue').directive('bbIfLogin', function($modal, $log, $q, $rootScope, AdminQueueService, AdminCompanyService, $compile, $templateCache, ModalForm, BBModel) {
    var compile, link;
    compile = function() {
      return {
        pre: function(scope, element, attributes) {
          this.whenready = $q.defer();
          scope.loggedin = this.whenready.promise;
          return AdminCompanyService.query(attributes).then(function(company) {
            scope.company = company;
            return this.whenready.resolve();
          });
        },
        post: function(scope, element, attributes) {}
      };
    };
    link = function(scope, element, attrs) {};
    return {
      compile: compile
    };
  });

  angular.module('BBQueue').directive('bbQueueDashboard', function($modal, $log, $rootScope, $compile, $templateCache, ModalForm, BBModel) {
    var link;
    link = function(scope, element, attrs) {
      return scope.loggedin.then(function() {
        return scope.getSetup();
      });
    };
    return {
      link: link,
      controller: 'bbQueueDashboardController'
    };
  });

  angular.module('BBQueue').directive('bbQueues', function($modal, $log, $rootScope, $compile, $templateCache, ModalForm, BBModel) {
    var link;
    link = function(scope, element, attrs) {
      return scope.loggedin.then(function() {
        return scope.getQueues();
      });
    };
    return {
      link: link,
      controller: 'bbQueues'
    };
  });

  angular.module('BBQueue').directive('bbQueueServers', function($modal, $log, $rootScope, $compile, $templateCache, ModalForm, BBModel) {
    var link;
    link = function(scope, element, attrs) {
      return scope.loggedin.then(function() {
        return scope.getServers();
      });
    };
    return {
      link: link,
      controller: 'bbQueueServers'
    };
  });

}).call(this);

(function() {
  angular.module('BBQueue').directive('bbQueueServer', function(BBModel, AdminCompanyService, PusherQueue, ModalForm) {
    var controller, link, pusherListen;
    pusherListen = function(scope) {
      PusherQueue.subscribe(scope.company);
      return PusherQueue.channel.bind('notification', (function(_this) {
        return function(data) {
          return scope.getQueuers(scope.server);
        };
      })(this));
    };
    controller = function($scope) {
      $scope.getQueuers = function() {
        return $scope.server.getQueuers();
      };
      $scope.getQueuers = _.throttle($scope.getQueuers, 10000);
      return $scope.newQueuerModal = function() {
        return ModalForm["new"]({
          company: $scope.company,
          title: 'New Queuer',
          new_rel: 'new_queuer',
          post_rel: 'queuers',
          success: function(queuer) {
            return $scope.server.queuers.push(queuer);
          }
        });
      };
    };
    link = function(scope, element, attrs) {
      if (scope.company) {
        pusherListen(scope);
        return scope.server.getQueuers();
      } else {
        return AdminCompanyService.query(attrs).then(function(company) {
          scope.company = company;
          if (scope.user.$has('person')) {
            return scope.user.$get('person').then(function(person) {
              scope.server = new BBModel.Admin.Person(person);
              scope.server.getQueuers();
              return pusherListen(scope);
            });
          }
        });
      }
    };
    return {
      link: link,
      controller: controller
    };
  });

  angular.module('BBQueue').directive('bbQueueServerCustomer', function() {
    var controller;
    controller = function($scope) {
      $scope.selected_queuers = [];
      $scope.serveCustomer = function() {
        if ($scope.selected_queuers.length > 0) {
          $scope.loading = true;
          return $scope.server.startServing($scope.selected_queuers).then(function() {
            $scope.loading = false;
            return $scope.getQueuers();
          });
        }
      };
      $scope.serveNext = function() {
        $scope.loading = true;
        return $scope.server.startServing().then(function() {
          $scope.loading = false;
          return $scope.getQueuers();
        });
      };
      $scope.extendAppointment = function(mins) {
        $scope.loading = true;
        return $scope.server.serving.extendAppointment(mins).then(function() {
          $scope.loading = false;
          return $scope.getQueuers();
        });
      };
      $scope.finishServing = function() {
        $scope.loading = true;
        return $scope.server.finishServing().then(function() {
          $scope.loading = false;
          return $scope.getQueuers();
        });
      };
      $scope.loading = true;
      if ($scope.server) {
        return $scope.server.setCurrentCustomer().then(function() {
          return $scope.loading = false;
        });
      }
    };
    return {
      controller: controller,
      templateUrl: 'queue_server_customer.html'
    };
  });

}).call(this);

(function() {
  angular.module('BBQueue').directive('bbAdminQueueTable', function($modal, $log, $rootScope, AdminQueueService, AdminCompanyService, $compile, $templateCache, ModalForm, BBModel) {
    var link;
    link = function(scope, element, attrs) {
      scope.fields || (scope.fields = ['ticket_number', 'first_name', 'last_name', 'email']);
      if (scope.company) {
        return scope.getQueuers();
      } else {
        return AdminCompanyService.query(attrs).then(function(company) {
          scope.company = company;
          return scope.getQueuers();
        });
      }
    };
    return {
      link: link,
      controller: 'bbQueuers',
      templateUrl: 'queuer_table.html'
    };
  });

}).call(this);

(function() {
  'use strict';
  angular.module('BBQueue.Directives').directive('bbQueuerPosition', function() {
    return {
      restrict: 'AE',
      replace: true,
      controller: 'QueuerPosition',
      templateUrl: 'queuer_position.html',
      scope: {
        id: '=',
        apiUrl: '@'
      }
    };
  });

}).call(this);

(function() {
  'use strict';
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  angular.module('BB.Models').factory("Admin.ClientQueueModel", function($q, BBModel, BaseModel) {
    var Admin_ClientQueue;
    return Admin_ClientQueue = (function(superClass) {
      extend(Admin_ClientQueue, superClass);

      function Admin_ClientQueue() {
        return Admin_ClientQueue.__super__.constructor.apply(this, arguments);
      }

      return Admin_ClientQueue;

    })(BaseModel);
  });

}).call(this);

(function() {
  'use strict';
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  angular.module('BB.Models').factory("Admin.QueuerModel", function($q, BBModel, BaseModel) {
    var Admin_Queuer;
    return Admin_Queuer = (function(superClass) {
      extend(Admin_Queuer, superClass);

      function Admin_Queuer(data) {
        Admin_Queuer.__super__.constructor.call(this, data);
        this.start = moment.parseZone(this.start);
        this.due = moment.parseZone(this.due);
        this.end = moment(this.start).add(this.duration, 'minutes');
      }

      Admin_Queuer.prototype.remaining = function() {
        var d;
        d = this.due.diff(moment.utc(), 'seconds');
        this.remaining_signed = Math.abs(d);
        return this.remaining_unsigned = d;
      };

      Admin_Queuer.prototype.startServing = function(person) {
        var defer;
        defer = $q.defer();
        if (this.$has('start_serving')) {
          person.$flush('self');
          this.$post('start_serving', {
            person_id: person.id
          }).then((function(_this) {
            return function(q) {
              person.$get('self').then(function(p) {
                return person.updateModel(p);
              });
              _this.updateModel(q);
              return defer.resolve(_this);
            };
          })(this), (function(_this) {
            return function(err) {
              return defer.reject(err);
            };
          })(this));
        } else {
          defer.reject('start_serving link not available');
        }
        return defer.promise;
      };

      Admin_Queuer.prototype.finishServing = function() {
        var defer;
        defer = $q.defer();
        if (this.$has('finish_serving')) {
          this.$post('finish_serving').then((function(_this) {
            return function(q) {
              _this.updateModel(q);
              return defer.resolve(_this);
            };
          })(this), (function(_this) {
            return function(err) {
              return defer.reject(err);
            };
          })(this));
        } else {
          defer.reject('finish_serving link not available');
        }
        return defer.promise;
      };

      Admin_Queuer.prototype.extendAppointment = function(minutes) {
        var d, defer, new_duration;
        defer = $q.defer();
        if (this.end.isBefore(moment())) {
          d = moment.duration(moment().diff(this.start));
          new_duration = d.as('minutes') + minutes;
        } else {
          new_duration = this.duration + minutes;
        }
        this.$put('self', {}, {
          duration: new_duration
        }).then((function(_this) {
          return function(q) {
            _this.updateModel(q);
            _this.end = moment(_this.start).add(_this.duration, 'minutes');
            return defer.resolve(_this);
          };
        })(this), function(err) {
          return defer.reject(err);
        });
        return defer.promise;
      };

      return Admin_Queuer;

    })(BaseModel);
  });

}).call(this);

(function() {
  'use strict';
  var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  angular.module('BB.Models').factory("QueuerModel", [
    "$q", "BBModel", "BaseModel", function($q, BBModel, BaseModel) {
      var Queuer;
      return Queuer = (function(superClass) {
        extend(Queuer, superClass);

        function Queuer() {
          return Queuer.__super__.constructor.apply(this, arguments);
        }

        return Queuer;

      })(BaseModel);
    }
  ]);

}).call(this);

(function() {
  angular.module('BBQueue.Services').factory('AdminQueueService', function($q, $window, halClient, BBModel) {
    return {
      query: function(prms) {
        var deferred;
        deferred = $q.defer();
        prms.company.$get('client_queues').then(function(collection) {
          return collection.$get('client_queues').then(function(client_queues) {
            var models, q;
            models = (function() {
              var i, len, results;
              results = [];
              for (i = 0, len = client_queues.length; i < len; i++) {
                q = client_queues[i];
                results.push(new BBModel.Admin.ClientQueue(q));
              }
              return results;
            })();
            return deferred.resolve(models);
          }, function(err) {
            return deferred.reject(err);
          });
        }, function(err) {
          return deferred.reject(err);
        });
        return deferred.promise;
      }
    };
  });

}).call(this);

(function() {
  angular.module('BBQueue.Services').factory('AdminQueuerService', function($q, $window, halClient, BBModel) {
    return {
      query: function(params) {
        var defer;
        defer = $q.defer();
        params.company.$flush('queuers');
        params.company.$get('queuers').then(function(collection) {
          return collection.$get('queuers').then(function(queuers) {
            var models, q;
            models = (function() {
              var i, len, results;
              results = [];
              for (i = 0, len = queuers.length; i < len; i++) {
                q = queuers[i];
                results.push(new BBModel.Admin.Queuer(q));
              }
              return results;
            })();
            return defer.resolve(models);
          }, function(err) {
            return defer.reject(err);
          });
        }, function(err) {
          return defer.reject(err);
        });
        return defer.promise;
      }
    };
  });

}).call(this);

(function() {
  angular.module('BBQueue.Services').factory('PusherQueue', function($sessionStorage, $pusher, AppConfig) {
    var PusherQueue;
    return PusherQueue = (function() {
      function PusherQueue() {}

      PusherQueue.subscribe = function(company) {
        if ((company != null) && (typeof Pusher !== "undefined" && Pusher !== null)) {
          if (this.client == null) {
            this.client = new Pusher('c8d8cea659cc46060608', {
              authEndpoint: "/api/v1/push/" + company.id + "/pusher.json",
              auth: {
                headers: {
                  'App-Id': AppConfig['App-Id'],
                  'App-Key': AppConfig['App-Key'],
                  'Auth-Token': $sessionStorage.getItem('auth_token')
                }
              }
            });
          }
          this.pusher = $pusher(this.client);
          return this.channel = this.pusher.subscribe("mobile-queue-" + company.id);
        }
      };

      return PusherQueue;

    })();
  });

}).call(this);

(function() {
  angular.module('BBQueue.Services').factory('QueuerService', [
    "$q", "$window", "halClient", "BBModel", function($q, UriTemplate, halClient, BBModel) {
      return {
        query: function(params) {
          var deferred, href, uri, url;
          deferred = $q.defer();
          url = "";
          if (params.url) {
            url = params.url;
          }
          href = url + "/api/v1/queuers/{id}";
          uri = new UriTemplate(href).fillFromObject(params || {});
          halClient.$get(uri, {}).then((function(_this) {
            return function(found) {
              return deferred.resolve(found);
            };
          })(this));
          return deferred.promise;
        },
        removeFromQueue: function(params) {
          var deferred, href, uri, url;
          deferred = $q.defer();
          url = "";
          if (params.url) {
            url = params.url;
          }
          href = url + "/api/v1/queuers/{id}";
          uri = new UriTemplate(href).fillFromObject(params || {});
          halClient.$del(uri).then((function(_this) {
            return function(found) {
              return deferred.resolve(found);
            };
          })(this));
          return deferred.promise;
        }
      };
    }
  ]);

}).call(this);
