var Logger = require('winston');
var serialPort = require('serialport');
var Q = require('q');

var AutomatedDriver = function (config) {
   this.config = config;
   this.data = null;
   this.log = [];
   this.commands = [{
      command: 'setTarget',
      display_name: 'Target Temperature'
   }, {
      command: 'setThreshold',
      display_name: 'Threshold'
   }];
};

/* Driver interface */
AutomatedDriver.prototype.start = function () {
   var driver = this;
   var deferred = Q.defer();

   var port = new serialPort.SerialPort(driver.config.options.port, {
      baudrate: driver.config.options.baudrate,
      parser: serialPort.parsers.readline('\n')
   });

   port.on('open', function (err) {
      if (err) {
         deferred.fail();
         return Logger.error('Error opening serialport', err);
      }

      deferred.resolve();

      driver.portOpened = true;

      Logger.info('Serial Port Open', driver.config);

      driver.writeToPort('A');

      var firstPoint = null;

      port.on('data', function (data) {
         Logger.debug('USB DATA', data);

         // Ignore the first point because we may have enterd in the
         // middle of a stream of data
         if (!firstPoint) {
            firstPoint = true;
            return;
         }

         var parts = data.trim().split(',');

         driver.data = {
            name: 'main',
            is_primary: true,
            type: 'usb',
            temperature: Number(parts[1]),
            mode: parts[0] === 'M' ? 'Manual' : 'Automatic',
            power: parts[3],
            battery: Number(parts[5]),
            target: Number(parts[6]),
            threshold: Number(parts[7]),
            time: +new Date(),
            rate: Number(parts[2]),
            raw: data
         };

         driver.log.push({
            sensors: {
               main: driver.data
            }
         });
      });
   });

   driver.port = port;

   return deferred.promise;
};

AutomatedDriver.prototype.heatOff = function () {
   return this.writeToPort('m')
   .then(this.writeToPort('-'));
};

/// Returns Array of sensors current value
AutomatedDriver.prototype.readSensors = function () {
   return Q.fcall(function () {
      return {
         main: {
            temperature: this.data.temperature,
            time: this.data.time,
            rate: this.data.rate
         }
      };
   }.bind(this));
};

AutomatedDriver.prototype.getInfo = function () {
   return Q.fcall(function () {
      return this.data;
   }.bind(this));
};

AutomatedDriver.prototype.getHistory = function (since) {
   return Q.fcall(function () {
      return this.log;
   }.bind(this));
};

AutomatedDriver.prototype.getSensors = function () {
   return Q.fcall(function () {
      return [this.data];
   }.bind(this));
};

AutomatedDriver.prototype.getCommands = function () {
   return Q.fcall(function () {
      return this.commands;
   }.bind(this));
};

/* Commands */
AutomatedDriver.prototype.perform = function (command, parameter) {
   return Q.fcall(function () {
      if (!this[command]) {
         return;
      }
      this[command](parameter);
   }.bind(this));
};

AutomatedDriver.prototype.setThreshold = function (threshold) {
   return this.writeToPort('t' + parseInt(Number(threshold)));
};

AutomatedDriver.prototype.setTarget = function (target) {
   return this.writeToPort('s' + parseInt(Number(target)));
};

AutomatedDriver.prototype.writeToPort = function (data) {
   Logger.info('Sending data to usb port.', data);
   return Q.nbind(this.port.write, this.port)(data + '\n');
};

module.exports = AutomatedDriver;