require([
  'esri/config',
  'esri/core/urlUtils',

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

  'esri/views/MapView',
  'esri/views/SceneView',

  'esri/widgets/Locate'
], function(
  esriConfig, urlUtils,
  geometryEngineAsync, Point, Polyline, Graphic, GraphicsLayer, WebTileLayer, Map,
  LineSymbol3D, LineSymbol3DLayer, ObjectSymbol3DLayer, PathSymbol3DLayer, PointSymbol3D, SimpleLineSymbol, SimpleMarkerSymbol,
  MapView, SceneView,
  Locate
) {
  esriConfig.request.corsEnabledServers.push(
    'stamen-tiles-a.a.ssl.fastly.net',
    'stamen-tiles-b.a.ssl.fastly.net',
    'stamen-tiles-c.a.ssl.fastly.net',
    'stamen-tiles-d.a.ssl.fastly.net'
  );

  var rotateControl = document.getElementById('rotateControl'),
    // handleOuterNode = document.querySelector('.handle'),
    handleInnerNode = document.querySelector('.esri-icon-rotate'),
    creditsNode = document.getElementById('credits'),
    instructionsNode = document.getElementById('instructions'),
    antipodeInfoNode = document.getElementById('antipodeInfo'),
    switchViewNode = document.getElementById('switchView'),
    dragdealerElement = null,
    clickedMapPoint = null,
    locateWidget;

  var isMobile = (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent) ||
    (urlUtils.urlToObject(window.location.href).query && !!(Number(urlUtils.urlToObject(window.location.href).query.isMobile)))
  );

  var ViewModule = isMobile ? MapView : SceneView;

  // establish conditional line and point symbols depending on if MapView or SceneView
  var lineSymbol = isMobile ?
    new SimpleLineSymbol({
      color: '#673ab7',
      width: 7
    }) :
    new LineSymbol3D({
      symbolLayers: [new LineSymbol3DLayer({
        size: 8.5,
        material: {
          color: '#673ab7'
        }
      })]
    });

  var pointSymbol = isMobile ?
    new SimpleMarkerSymbol({
      color: '#f44336',
      outline: {
        color: 'orange',
        width: 1.75
      },
      size: 17
    }) :
    new PointSymbol3D({
      symbolLayers: [new ObjectSymbol3DLayer({
        width: 400000,
        height: 900000,
        resource: {
          primitive: 'cone'
        },
        material: {
          color: '#f44336'
        }
      })]
    });

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
          copyright: [
            'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ',
            'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
            'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ',
            'under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
          ].join()
        }),
        analysisGraphicsLayer
      ]
    }),
    center: [0, 0],
    zoom: 2,
    ui: {
      components: ['attribution', 'zoom']
    }
  });

  if (!isMobile) {
    // set SceneView atmosphere to best quality
    view.environment.atmosphere.quality = 'high';
  }

  view.then(function(view) {
    // position and show the credits element and rotate control element
    view.ui.add(creditsNode, 'bottom-right');
    creditsNode.style.display = 'block';

    view.ui.add(rotateControl);
    rotateControl.style.display = 'block';

    view.ui.add(instructionsNode);
    instructionsNode.style.display = 'block';

    view.ui.add(antipodeInfoNode);

    // conditionally show the button to switch to 2d mapview
    if (!isMobile) {
      view.ui.add(switchViewNode, 'bottom-left');
      switchViewNode.style.display = 'flex';
    }

    locateWidget = new Locate({
      view: view,
      goToLocationEnabled: false,
      graphic: false
    });
    view.ui.add(locateWidget, 'bottom-left');
    locateWidget.on('locate', function(e) {
      view.goTo({
        center: [e.position.coords.longitude, e.position.coords.latitude]
      });

      handleViewClick({
        mapPoint: {
          latitude: e.position.coords.latitude,
          longitude: e.position.coords.longitude
        }
      });
    });

    // establish conditional DOM properties based on the view width
    viewWidthChange(view.widthBreakpoint);
    view.watch('widthBreakpoint', function(newValue) {
      viewWidthChange(newValue);
    });

    // establish the rotate control drag widget
    dragdealerElement = new Dragdealer('dragdealerSlider', {
      x: 0.5,
      slide: true,
      loose: true,
      animationCallback: function(x) {
        // transform the inner handle icon as if it is rotating like a wheel along a track
        var width = rotateControl.clientWidth,
          // handleOuterNode.clientWidth should be 50px (:hover size) but on startup it is 40px (non-:hover size)
          // this messes up the intiial state of the inner icon rotation
          circumference = 50 * Math.PI,
          rotateDeg = width / circumference * 360 * x;
        handleInnerNode.style.transform = 'rotate(' + rotateDeg + 'deg)';

        // wrap geometries around the Earth if there is a clicked point
        if (!clickedMapPoint) {
          return;
        }

        var latitudeShift = (x - 0.5) * 180;
        if (latitudeShift > 90) {
          latitudeShift -= 180;
        } else if (latitudeShift < -90) {
          latitudeShift += 180;
        }
        wrapAround(clickedMapPoint, latitudeShift);
      }
    });

    view.on('click', handleViewClick);
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

  function wrapAround(clickedMapPoint, latitudeShift) {
    // the rotate control drag widget must be available and ready
    if (!dragdealerElement) {
      return;
    }

    latitudeShift = latitudeShift || (dragdealerElement.getValue()[0] - 0.5) * 180;

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
      view.ui.move(switchViewNode, 'bottom-left');
      view.ui.move(locateWidget, 'bottom-left');
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
