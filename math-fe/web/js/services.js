angular.module('cmServices', [])
  .factory('ParameterManager', ['$log', function($log) {
    // do we even need this damn thing? Why don't we just set model values and let
    // angular handle it?
    var ParameterManager = function(parameters) {
      this.parameters = parameters;
      angular.forEach(this.parameters, function(v) {
        v.default = v.value;
      }, this);
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
      $log.debug('pm.set', ps);
      angular.forEach(this.parameters, function(v, k) {
        if (ps[k] !== undefined) {
          v.value = ps[k];
        } else {
          v.value = v.default;
        }
      }, this);
    };
    return ParameterManager;
  }])
  .constant('wrap_pi', function wrap_pi(angle) {
    var pi = Math.PI;
    var a = angle;
    if (-pi > angle || angle >= pi) {
      a = angle - 2 * pi * Math.floor(angle / 2.0 / pi);
      a = a < pi ? a : a - 2 * pi;
    }
    return a;
  })
  .factory('GraphDraw', ['$interval', '$log', '$http', 'wrap_pi', function($interval, $log, $http, wrap_pi) {
    var margin = { left: 40, right: 20, top: 20, bottom: 25 };
    function id(x) { return x; }
    var GraphDraw = function(controller, options) {
      this.controller = controller;
      this.options = options;
    };

    GraphDraw.prototype.fetchAnimation = function(extra_params, action) {
      if (!this.options.endpoint) {
        $log.error('no endpoint');
        return;
      }
      var max_trace_points = 2000;
      this.dt = Math.max((this.controller.parameters.t.value * Object.keys(this.options.traces).length) / max_trace_points, 1/60);
      $log.debug('dt computed', this.dt);
      var self = this;
      if (this.interval) {
        $log.debug('cancelling interval');
        $interval.cancel(this.interval);
      }
      var url_params = {dt: this.dt};
      angular.forEach(this.controller.parameters, function(value, name) {
        url_params[name] = value.value;
      });
      angular.extend(url_params, extra_params);
      ++self.controller.busy;
      $log.debug('busy', self.controller.busy);
      $log.debug('get', this.options.endpoint, url_params);
      $http.get(this.options.endpoint, {params: url_params})
        .success(function(data) {
          self.interval = action(data, self.controller.parameters);
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

    GraphDraw.prototype.animate = function(data, action) {
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
      }, 1000 * this.dt, data.length);
      timer.then(function() {
        var ms = new Date() - t0;
        $log.debug(data.length, 'points in', ms, 'msec', 1000 * data.length/ms, 'Hz');
      });
      return timer;
    };

    return GraphDraw;
  }]);

