var isMobile = (function() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent);
})();

require([
  'esri/config',

  'esri/geometry/geometryEngineAsync',
  'esri/geometry/Point',
  'esri/geometry/Polyline',
  'esri/Graphic',
  'esri/layers/GraphicsLayer',
  'esri/layers/WebTileLayer',
  'esri/Map',

  'esri/symbols/LineSymbol3D',
  'esri/symbols/LineSymbol3DLayer',
  'esri/symbols/ObjectSymbol3DLayer',
  'esri/symbols/PathSymbol3DLayer',
  'esri/symbols/PointSymbol3D',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/SimpleMarkerSymbol',

  'esri/views/' + (isMobile ? 'MapView' : 'SceneView')
], function(
  esriConfig,
  geometryEngineAsync, Point, Polyline, Graphic, GraphicsLayer, WebTileLayer, Map,
  LineSymbol3D, LineSymbol3DLayer, ObjectSymbol3DLayer, PathSymbol3DLayer, PointSymbol3D, SimpleLineSymbol, SimpleMarkerSymbol,
  ViewModule
) {
  var rotateControl = document.getElementById('rotateControl'),
    handleOuterNode = document.querySelector('.handle'),
    handleInnerNode = document.querySelector('.esri-icon-rotate'),
    creditsNode = document.getElementById('credits'),
    instructionsNode = document.getElementById('instructions'),
    antipodeInfoNode = document.getElementById('antipodeInfo'),
    dragdealerElement = null,
    clickedMapPoint = null,
    previousTimeoutID = null;

  // establish conditional line and point symbols depending on if MapView or SceneView
  var lineSymbol = isMobile ?
    new SimpleLineSymbol({
      color: '#673ab7',
      width: 6
    }) :
    new LineSymbol3D({
      symbolLayers: [new LineSymbol3DLayer({
        size: 6,
        material: {
          color: '#673ab7'
        }
      })]
    });

  var pointSymbol = isMobile ?
    new SimpleMarkerSymbol({
      color: '#f44336',
      outline: null
    }) :
    new PointSymbol3D({
      symbolLayers: [new ObjectSymbol3DLayer({
        width: 150000,
        height: 350000,
        resource: {
          primitive: 'cone'
        },
        material: {
          color: '#f44336'
        }
      })]
    });

  // add Stamen tile servers to esriConfig cors
  esriConfig.request.corsEnabledServers.push(
    'stamen-tiles-a.a.ssl.fastly.net',
    'stamen-tiles-b.a.ssl.fastly.net',
    'stamen-tiles-c.a.ssl.fastly.net',
    'stamen-tiles-d.a.ssl.fastly.net'
  );

  // geodesic lines and antipodes will be added to this graphics layer
  var analysisGraphicsLayer = new GraphicsLayer();

  // the view is either a MapView or a SceneView
  var view = new ViewModule({
    container: 'viewDiv',
    map: new Map({
      layers: [
        // use Stamen Toner for the basemap tiles
        new WebTileLayer({
          urlTemplate: '//stamen-tiles-{subDomain}.a.ssl.fastly.net/toner/{level}/{col}/{row}.png',
          subDomains: ['a', 'b', 'c', 'd'],
          copyright: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ' +
            'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ' +
            'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ' +
            'under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
        }),
        analysisGraphicsLayer
      ]
    }),
    center: [0, 0],
    // zoom out a little if on a mobile device
    zoom: isMobile ? 1 : 3,
    ui: {
      components: ['attribution', 'zoom']
    }
  });

  view.then(function(view) {
    // position and show the credits element and rotate control element
    view.ui.add(creditsNode, 'bottom-right');
    creditsNode.style.display = 'block';

    view.ui.add(rotateControl);
    rotateControl.style.display = 'block';

    view.ui.add(instructionsNode);
    instructionsNode.style.display = 'block';

    view.ui.add(antipodeInfoNode);

    // establish conditional DOM properties based on the view width
    viewWidthChange(view.widthBreakpoint);
    view.watch('widthBreakpoint', function(newValue) {
      viewWidthChange(newValue);
    });

    // establish the rotate control drag widget
    dragdealerElement = new Dragdealer('dragdealerSlider', {
      x: 0.5,
      slide: true,
      // callback: function(x) {
      //   if (!clickedMapPoint) {
      //     return;
      //   }
      //   wrapAround();
      // },
      animationCallback: function(x) {
        // transform the inner handle icon as if it is rotating like a wheel along a track
        var width = rotateControl.clientWidth,
          circumference = handleOuterNode.clientWidth * Math.PI,
          rotateDeg = width / circumference * 360 * x;
        handleInnerNode.style.transform = 'rotate(' + rotateDeg + 'deg)';

        // wrap geometries around the Earth if there is a clicked point
        if (!clickedMapPoint) {
          return;
        }
        // apply a timeout to debounce the number of operations
        if (previousTimeoutID) {
          clearTimeout(previousTimeoutID);
        }
        previousTimeoutID = setTimeout(function() {
          wrapAround(clickedMapPoint);
        }, 50);
      }
    });

    view.on('click', handleViewClick);
    // perform a pseudo synthetic click as a workaround
    // for a startup error with the geometryEngineAsync at v4.1
    handleViewClick({
      mapPoint: {
        latitude: 0,
        longitude: 0
      }
    });
  });

  function handleViewClick(evt) {
    // wrap geometries around the Earth if there is a clicked point
    // set the (shared) clickedMapPoint variable value for other functions
    clickedMapPoint = evt.mapPoint;
    if (!clickedMapPoint) {
      analysisGraphicsLayer.removeAll();
      return;
    }
    wrapAround(clickedMapPoint);
  }

  function wrapAround(clickedMapPoint) {
    // the rotate control drag widget must be available and ready
    if (!dragdealerElement) {
      return;
    }

    var latitudeShift = (dragdealerElement.getValue()[0] - 0.5) * 180;

    // create a basic line at the clicked point and wrap it around the Earth
    var wrapAroundLine = new Polyline({
      paths: [
        [
          [clickedMapPoint.longitude, clickedMapPoint.latitude],
          [clickedMapPoint.longitude + 90, -latitudeShift],
          [clickedMapPoint.longitude + 180, -clickedMapPoint.latitude],
          [clickedMapPoint.longitude + 270, latitudeShift],
          [clickedMapPoint.longitude + 360, clickedMapPoint.latitude]
        ],
      ],
      spatialReference: {
        wkid: 4326
      }
    });

    // geodetically densify the basic wrap around line
    geometryEngineAsync.geodesicDensify(wrapAroundLine, 10000).then(function(geodesicLine) {
      // render the geodesic line and the antipodes in the view
      handleGeodesicDensify(geodesicLine, wrapAroundLine);

      // hide the instructions text (once)
      if (instructionsNode.style.display !== 'none') {
        // with css transition this will fade out
        instructionsNode.style.opacity = '0';
        // also set display to be none after the transition
        setTimeout(function() {
          instructionsNode.style.display = 'none';
          viewWidthChange(view.widthBreakpoint);
          antipodeInfoNode.style.display = 'block';
          setTimeout(function() {
            antipodeInfoNode.style.opacity = '1';
          }, 300);
        }, 300);
      }
    }, function(err) {
      console.error(err);
    });
  }

  function handleGeodesicDensify(geodesicLine, wrapAroundLine) {
    analysisGraphicsLayer.removeAll();

    analysisGraphicsLayer.add(new Graphic({
      geometry: geodesicLine,
      symbol: lineSymbol
    }));

    wrapAroundLine.paths[0].forEach(function(vertex, idx) {
      if (idx === 0 || idx === 2) {
        analysisGraphicsLayer.add(new Graphic({
          geometry: new Point(vertex[0], vertex[1]),
          symbol: pointSymbol
        }));
      }
    });
  }

  function viewWidthChange(widthBreakpoint) {
    if (widthBreakpoint === 'xsmall') {
      view.ui.move(rotateControl, 'manual');
      if (instructionsNode.style.display !== 'none') {
        view.ui.move(instructionsNode, 'manual');
      } else {
        view.ui.move(antipodeInfoNode, 'manual');
      }
      view.ui.move('zoom', 'bottom-left');
    } else {
      view.ui.move(rotateControl, 'top-right');
      if (instructionsNode.style.display !== 'none') {
        view.ui.move(instructionsNode, 'top-right');
      } else {
        view.ui.move(antipodeInfoNode, 'top-right');
      }
      view.ui.move('zoom', 'top-left');
    }
  }
});
