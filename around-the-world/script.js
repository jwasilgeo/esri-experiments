require([
  'esri/geometry/support/geodesicUtils',
  'esri/geometry/Point',
  'esri/geometry/Polyline',
  'esri/Graphic',
  'esri/layers/GraphicsLayer',
  'esri/layers/WebTileLayer',
  'esri/Map',

  'esri/symbols/ObjectSymbol3DLayer',
  'esri/symbols/PointSymbol3D',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/SimpleMarkerSymbol',

  'esri/views/MapView',
  'esri/views/SceneView',

  'esri/widgets/Locate'
], function(
  geodesicUtils, Point, Polyline, Graphic, GraphicsLayer, WebTileLayer, Map,
  ObjectSymbol3DLayer, PointSymbol3D, SimpleLineSymbol, SimpleMarkerSymbol,
  MapView, SceneView,
  Locate
) {
  var rotateControl = document.getElementById('rotateControl'),
    // handleOuterNode = document.querySelector('.handle'),
    handleInnerNode = document.querySelector('.esri-icon-rotate'),
    creditsNode = document.getElementById('credits'),
    instructionsNode = document.getElementById('instructions'),
    antipodeInfoNode = document.getElementById('antipodeInfo'),
    dragdealerElement = null,
    clickedMapPoint = null,
    locateWidget;

  var lineSymbol2D = new SimpleLineSymbol({
    color: '#673ab7',
    width: 7
  });

  var lineSymbol3D = {
    type: 'line-3d',
    symbolLayers: [{
      type: 'path',
      profile: 'quad',
      material: {
        color: '#673ab7'
      },
      width: 300000, // the width in m
      height: 500000, // the height in m
      profileRotation: 'heading'
    }]
  };

  var pointSymbol2D = new SimpleMarkerSymbol({
    color: '#f44336',
    outline: {
      color: 'orange',
      width: 1.75
    },
    size: 15
  });

  var pointSymbol3D = new PointSymbol3D({
    symbolLayers: [
      new ObjectSymbol3DLayer({
        width: 700000,
        height: 1100000,
        resource: {
          primitive: 'cone'
        },
        material: {
          color: '#f44336'
        }
      })
    ]
  });

  // geodesic lines and antipodes will be added to this graphics layer
  var analysisGraphicsLayer2D = new GraphicsLayer();
  var analysisGraphicsLayer3D = new GraphicsLayer();

  var basemap = {
    baseLayers: [
      // use Stamen Toner for the basemap tiles
      new WebTileLayer({
        urlTemplate: 'https://stamen-tiles-{subDomain}.a.ssl.fastly.net/toner/{level}/{col}/{row}.png',
        subDomains: ['a', 'b', 'c', 'd'],
        copyright: [
          'Map tiles by <a href="https://stamen.com/">Stamen Design</a>, ',
          'under <a href="https://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
          'Data by <a href="https://openstreetmap.org">OpenStreetMap</a>, ',
          'under <a href="https://www.openstreetmap.org/copyright">ODbL</a>.'
        ].join('')
      })
    ]
  };

  var mapView = new MapView({
    container: 'mapViewDiv',
    map: new Map({
      basemap: 'satellite',
      layers: [
        analysisGraphicsLayer2D
      ]
    }),
    zoom: 2,
    ui: {
      components: []
    }
  });

  // the view is either a MapView or a SceneView
  var sceneView = new SceneView({
    container: 'sceneViewDiv',
    map: new Map({
      basemap: basemap,
      layers: [
        analysisGraphicsLayer3D
      ]
    }),
    center: [38.8, -42],
    alphaCompositingEnabled: true,
    environment: {
      starsEnabled: false,
      background: {
        type: 'color',
        color: [255, 255, 255, 0]
      },
    },
    constraints: {
      altitude: {
        min: 50000000,
        max: 50000000
      }
    },
    ui: {
      components: ['attribution', 'compass']
    }
  });

  sceneView.ui.move('compass', 'top-left');

  sceneView.when(function() {
    mapView.center = sceneView.center;
    mapView.rotation = -sceneView.camera.heading;

    sceneView.watch('center', function(newCenter) {
      mapView.center = newCenter;
    });

    sceneView.watch('camera.heading', function(newHeading) {
      mapView.rotation = -newHeading;
    });

    sceneView.environment.atmosphere.quality = 'high';
    sceneView.map.ground.opacity = 0.55;
    sceneView.map.ground.layers.removeAll();

    // position and show the credits element and rotate control element
    sceneView.ui.add(creditsNode, 'bottom-right');
    creditsNode.style.display = 'block';

    sceneView.ui.add(rotateControl);
    rotateControl.style.display = 'block';

    sceneView.ui.add(instructionsNode);
    instructionsNode.style.display = 'block';

    locateWidget = new Locate({
      view: sceneView,
      goToLocationEnabled: false,
      graphic: false
    });

    sceneView.ui.add(locateWidget, 'top-left');

    locateWidget.on('locate', function(e) {
      handleViewClick({
        mapPoint: {
          latitude: e.position.coords.latitude,
          longitude: e.position.coords.longitude
        }
      });

      sceneView.goTo({
        center: [e.position.coords.longitude, e.position.coords.latitude]
      }, {
        speedFactor: 0.1, // animation is 10 times slower than default
      });
    });

    // establish conditional DOM properties based on the view width
    viewWidthChange(sceneView.widthBreakpoint);
    sceneView.watch('widthBreakpoint', function(newValue) {
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

    sceneView.on('click', handleViewClick);
  });

  function handleViewClick(evt) {
    // wrap geometries around the Earth if there is a clicked point
    // set the (shared) clickedMapPoint variable value for other functions
    if (!evt.mapPoint) {
      return;
    }
    clickedMapPoint = evt.mapPoint;
    wrapAround(clickedMapPoint);
  }

  function wrapAround(clickedMapPoint, latitudeShift) {
    // the rotate control drag widget must be available and ready
    if (!dragdealerElement) {
      return;
    }

    latitudeShift = latitudeShift || (dragdealerElement.getValue()[0] - 0.5) * 180;

    // create a simple line at the clicked point and wrap it around the Earth
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

    // geodetically densify the simple wrap-around line
    var maxSegmentLength = 250000;
    var geodesicLine = geodesicUtils.geodesicDensify(wrapAroundLine, maxSegmentLength);

    // render the geodesic line and the antipodes in the view
    handleGeodesicDensify(geodesicLine, wrapAroundLine);

    // show the results text (once)
    if (antipodeInfoNode.style.opacity !== '1') {
      // with css transition this will fade in
      antipodeInfoNode.style.display = 'block';
      setTimeout(function() {
        antipodeInfoNode.style.opacity = '1';
      }, 300);
    }
  }

  function handleGeodesicDensify(geodesicLine, wrapAroundLine) {
    analysisGraphicsLayer2D.removeAll();
    analysisGraphicsLayer3D.removeAll();

    analysisGraphicsLayer2D.add(new Graphic({
      geometry: geodesicLine,
      symbol: lineSymbol2D
    }));

    analysisGraphicsLayer3D.add(new Graphic({
      geometry: geodesicLine,
      symbol: lineSymbol3D
    }));

    wrapAroundLine.paths[0].forEach(function(vertex, idx) {
      if (idx === 0 || idx === 2) {
        analysisGraphicsLayer2D.add(new Graphic({
          geometry: new Point(vertex[0], vertex[1]),
          symbol: pointSymbol2D
        }));

        analysisGraphicsLayer3D.add(new Graphic({
          geometry: new Point(vertex[0], vertex[1]),
          symbol: pointSymbol3D
        }));
      }
    });
  }

  function viewWidthChange(widthBreakpoint) {
    if (widthBreakpoint === 'xsmall') {
      sceneView.ui.move(rotateControl, 'manual');
      sceneView.ui.move(instructionsNode, 'manual');
      instructionsNode.style.lineHeight = '1.0em';
      sceneView.ui.move('compass', 'bottom-left');
      sceneView.ui.add(locateWidget, 'bottom-left');

      sceneView.constraints.altitude.set({
        min: 27500000,
        max: 27500000
      });

      mapView.zoom = 1;
    } else if (widthBreakpoint === 'small') {
      sceneView.ui.move(rotateControl, 'manual');
      sceneView.ui.move(instructionsNode, 'manual');
      instructionsNode.style.lineHeight = 'inherit';
      sceneView.ui.move('compass', 'bottom-left');
      sceneView.ui.add(locateWidget, 'bottom-left');

      sceneView.constraints.altitude.set({
        min: 30000000,
        max: 30000000
      });

      mapView.zoom = 2;
    } else {
      sceneView.ui.move(rotateControl, 'top-right');
      sceneView.ui.move(instructionsNode, 'top-right');
      instructionsNode.style.lineHeight = 'inherit';
      sceneView.ui.move('compass', 'top-left');
      sceneView.ui.add(locateWidget, 'top-left');

      sceneView.constraints.altitude.set({
        min: 40000000,
        max: 40000000
      });

      mapView.zoom = 2;
    }
  }
});
