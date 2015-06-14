angular.module('cmServices', [])
  .factory('ParameterManager', ['$log', '$interval', '$http', function($log, $interval, $http) {
    var ParameterManager = function(controller, endpoint) {
      this.controller = controller;
      this.parameters = controller.parameters;
      angular.forEach(this.parameters, function(v) {
        v.default = v.value;
      }, this);
      this.endpoint = endpoint;
      this.interval = undefined;
    };

    ParameterManager.prototype.watch = function($scope, action) {
      var self = this;
      angular.forEach(this.parameters, function(value) {
        $scope.$watch(function() {
          return value.value;
        }, function() {
          action(self.parameters);
        })
      });
    };

    ParameterManager.prototype.set = function(ps) {
      angular.forEach(this.parameters, function(v, k) {
        if (ps[k] !== undefined) {
          v.value = ps[k];
        } else {
          v.value = v.default;
        }
      }, this);
    };
    // Arguably this doesn't belong here.
    ParameterManager.prototype.fetchAnimation = function(extra_params, action) {
      if (!this.endpoint) return;
      var self = this;
      if (this.interval) {
        $log.debug('cancelling interval');
        $interval.cancel(this.interval);
      }
      var url_params = {};
      angular.forEach(this.parameters, function(value, name) {
        url_params[name] = value.value;
      });
      angular.extend(url_params, extra_params);
      ++self.controller.busy;
      $log.debug('busy', self.controller.busy);
      $http.get(this.endpoint, {params: url_params})
        .success(function(data) {
          self.interval = action(data, url_params);
          self.interval.then(function() {
            $log.debug('interval complete');
            self.interval = undefined;
          }, function() {
            $log.debug('interval cancelled');
            self.interval = undefined;
          })
        })
        .error(function(data, status) {
          $log.error(status);
          document.write(data);
        })
        .finally(function() {
          --self.controller.busy;
          $log.debug('busy', self.controller.busy);
        });
    };
    return ParameterManager;
  }])
  .factory('GraphDraw', ['$interval', '$log', function($interval, $log) {
    var margin = { left: 40, right: 20, top: 20, bottom: 25 };
    function id(x) { return x; }
    function wrap_pi(angle) {
      var pi = Math.PI;
      var a = angle;
      if (-pi > angle || angle >= pi) {
        a = angle - 2 * pi * Math.floor(angle / 2.0 / pi);
        a = a < pi ? a : a - 2 * pi;
      }
      return a;
    }
    var GraphDraw = function(options) {
      this.options = options;
    };

    GraphDraw.prototype.draw = function(data, x_min, x_max) {
      var options = this.options;
      var container = document.getElementById(options.element);
      var cWidth = container.clientWidth;
      var cHeight = container.clientHeight;
      $log.debug('graph container', cWidth, cHeight);
      var height = cHeight - margin.top - margin.bottom;
      var width = cWidth - margin.left - margin.right;
      var x_scale = d3.scale.linear().domain([x_min, x_max]).range([0, width]);
      var y_scale = d3.scale.linear().domain([options.y_min, options.y_max]).range([height, 0]);
      var x_axis = d3.svg.axis().scale(x_scale).orient('bottom');
      var y_axis = d3.svg.axis().scale(y_scale).orient('left');


      d3.select('#' + options.element + ' svg').remove();
      var svg = d3.select('#' + options.element)
        .append('svg')
        .attr('width', cWidth)
        .attr('height', cHeight)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      svg.append('g')
        .attr('class','x_axis')
        .attr('transform','translate(0,' + height + ')')
        .call(x_axis);
      svg.append('g')
        .attr('class', 'y_axis')
        .call(y_axis);

      var wrapper = options.wrap_pi ? wrap_pi : id;

      angular.forEach(options.traces, function(trace, t) {
        svg.selectAll('circle.' + t)
          .data(data)
          .enter()
          .append('circle')
          .attr('cx', function(d) {
            return x_scale(options.x(d));
          })
          .attr('cy', function(d) {
            return y_scale(wrapper(trace.y(d)));
          })
          .classed('graph-point ' + t, true)
          .attr('r', 1)
          .style('fill', trace.color);
      });
    };

    GraphDraw.prototype.animate = function(data, dt, action) {
      var i = 0;
      var dot_sets = [];
      angular.forEach(this.options.traces, function(trace, t) {
        dot_sets.push(document.getElementsByClassName('graph-point ' + t));
      });

      function animate_step() {
        action(data[i]);
        for (var j = 0; j < dot_sets.length; ++j) {
          var dot_set = dot_sets[j];
          dot_set[i].setAttribute('r', 3);
          if (i > 0) {
            dot_set[i-1].setAttribute('r', 1);
          }
        }
        i++;
      }

      var t0 = new Date();
      var timer = $interval(function() {
        animate_step();
      }, 1000 * dt, data.length, false);
      timer.then(function() {
        var ms = new Date() - t0;
        $log.debug(data.length, 'points in', ms, 'msec', 1000 * data.length/ms, 'Hz');
      });
      return timer;
    };

    return GraphDraw;
  }]);

