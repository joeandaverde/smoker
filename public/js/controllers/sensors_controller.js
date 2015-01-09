(function () {
'use strict';

var appControllers = angular.module('appControllers');

var updateSensors = function ($scope, smoker) {
   var sensors = smoker.data.sensors;
   var target = smoker.info.target;
   var power = smoker.info.power;

   for (var i = 0; i < $scope.sensors.length; i++) {
      var sensor = $scope.sensors[i];
      var latest_data = sensors[sensor.name];

      sensor.data.push(latest_data);
      if (sensor.data.length > 200) {
         sensor.data.shift();
      }

      var recent = sensor.data.last(10);
      var temp_diff = recent.last().temperature - recent.first().temperature;
      var time_diff = Math.abs(recent.first().time - recent.last().time) / 1000;
      var roc = time_diff == 0 ? 0 : Math.round(temp_diff / time_diff);

      if (sensor.is_primary) {
         sensor.power = power;
         sensor.target = target;
      }

      sensor.roc = roc > 0 ? ("+" + roc) : roc;
      sensor.temp = Number(latest_data.temperature);
   }
};

appControllers.controller(
   'SensorsController', ['$scope', 'SmokerService', 'amMoment',
   function ($scope, SmokerService, amMoment) {
      var time_window = 4 * 60 * 1000;

      $scope.update_config = function () {
         if ($scope.target) {
            SmokerService.setTargetTemp($scope.target);
         }

         if ($scope.duty_cycle) {
            SmokerService.setDutyCycle($scope.duty_cycle);
         }

         $scope.target = null;
         $scope.duty_cycle = null;
      };

      $scope.reset = function () {
         SmokerService.reset(function (started_on) {
            $scope.started_on = started_on;
            $scope.sensors.forEach(function (s) {
               s.data.length = 0;
            });
         });
      };

      $scope.shutdown = function () {
         SmokerService.shutdown();
      };

      $scope.form = {};

      $scope.sendCommands = function () {
         for (var k in $scope.form) {
            SmokerService.perform(k, $scope.form[k], function () {

            });
         }

         $scope.form = {};
      };

      $scope.power_data = [];

      SmokerService.initialize(function (sensors, commands, history) {
         $scope.sensors = sensors;
         $scope.commands = commands;

         var primarySensor = sensors.filter(function (s) {
            return s.is_primary;
         }).first();

         $scope.power_data = getPowerData(primarySensor, history.data);

         $scope.sensors.forEach(function (s) {
            s.data = getHistory(s.name, history.data, time_window);
            s.power_data = $scope.power_data;
         });

         $scope.started_on = history.started_on;

         $scope.$on('smoker:update', function (event, smoker) {
            $scope.target = smoker.info.target;

            if ($scope.power_data.last() && $scope.power_data.last().state !== smoker.info.power) {
               $scope.power_data.last().end = smoker.info.time;
               $scope.power_data.push({
                  state: smoker.info.power,
                  start: smoker.info.time
               });
            }

            updateSensors($scope, smoker);
         });
      });
   }
]);

var getPowerData = function (primarySensor, history) {
   var current;
   var result = [];

   history.forEach(function (x) {
      var d = x.sensors[primarySensor.name];

      if (!d || !d.power) return;

      if (current && current.state !== d.power) {
         current.id = result.length + '_' + 0;
         current.end = d.time;

         result.push(current);

         current = {
            start: d.time,
            state: d.power
         };
      }
      else if (!current) {
         current = {
            start: d.time,
            state: d.power
         };
      }
   });

   if (current) {
      result.push(current);
   }

   return result;
};

var getHistory = function (name, data, timespan) {
   var result = [];
   var oldest_time = new Date().getTime() - timespan;

   for (var i = data.length - 1; i >= 0; i--) {
      var entry = data[i].sensors[name];

      if (entry) {
         if (entry.time >= oldest_time) {
           result.unshift(entry);
         }
         else {
            break;
         }
      }
   }
   return result;
};
})();
