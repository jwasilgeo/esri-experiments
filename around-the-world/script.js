require([
  'esri/core/urlUtils',

  'esri/geometry/support/geodesicUtils',
  'esri/geometry/Point',
  'esri/geometry/Polyline',
  'esri/Graphic',
  'esri/layers/GraphicsLayer',
  'esri/layers/WebTileLayer',
  'esri/Map',

  'esri/symbols/LineSymbol3D',
  'esri/symbols/LineSymbol3DLayer',
  'esri/symbols/ObjectSymbol3DLayer',
  'esri/symbols/PointSymbol3D',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/SimpleMarkerSymbol',

  'esri/views/MapView',
  'esri/views/SceneView',

  'esri/widgets/Locate'
], function(
  urlUtils,
  geodesicUtils, Point, Polyline, Graphic, GraphicsLayer, WebTileLayer, Map,
  LineSymbol3D, LineSymbol3DLayer, ObjectSymbol3DLayer, PointSymbol3D, SimpleLineSymbol, SimpleMarkerSymbol,
  MapView, SceneView,
  Locate
) {
  var rotateControl = document.getElementById('rotateControl'),
    // handleOuterNode = document.querySelector('.handle'),
    handleInnerNode = document.querySelector('.esri-icon-rotate'),
    creditsNode = document.getElementById('credits'),
    instructionsNode = document.getElementById('instructions'),
    antipodeInfoNode = document.getElementById('antipodeInfo'),
    switch2dViewNode = document.getElementById('switch2dView'),
    switch3dViewNode = document.getElementById('switch3dView'),
    dragdealerElement = null,
    clickedMapPoint = null,
    locateWidget;

  var is2dView = (
    urlUtils.urlToObject(window.location.href).query &&
    !!(Number(urlUtils.urlToObject(window.location.href).query.is2dView))
  );

  var ViewModule = is2dView ? MapView : SceneView;

  // establish conditional line and point symbols depending on if MapView or SceneView
  var lineSymbol = is2dView ?
    new SimpleLineSymbol({
      color: '#673ab7',
      width: 7
    }) :
    {
      type: 'line-3d',
      symbolLayers: [{
        type: 'path',
        profile: 'quad',
        material: {
          color: '#673ab7'
        },
        width: 200000, // the width in m
        height: 200000, // the height in m
        profileRotation: 'heading'
      }]
    };
    // new LineSymbol3D({
    //   symbolLayers: [new LineSymbol3DLayer({
    //     size: 8.5,
    //     material: {
    //       color: '#673ab7'
    //     }
    //   })]
    // });

  var pointSymbol = is2dView ?
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
          // opacity: 0.4,
          urlTemplate: 'https://stamen-tiles-{subDomain}.a.ssl.fastly.net/toner/{level}/{col}/{row}.png',
          subDomains: ['a', 'b', 'c', 'd'],
          copyright: [
            'Map tiles by <a href="https://stamen.com/">Stamen Design</a>, ',
            'under <a href="https://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
            'Data by <a href="https://openstreetmap.org">OpenStreetMap</a>, ',
            'under <a href="https://www.openstreetmap.org/copyright">ODbL</a>.'
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


  view.when(function(view) {
    if (!is2dView) {
      // set SceneView atmosphere to best quality
      // view.environment.atmosphere.quality = 'high';
      view.map.ground.layers.removeAll();
      // view.map.ground.opacity = 0.4;
    }

    // position and show the credits element and rotate control element
    view.ui.add(creditsNode, 'bottom-right');
    creditsNode.style.display = 'block';

    view.ui.add(rotateControl);
    rotateControl.style.display = 'block';

    view.ui.add(instructionsNode);
    instructionsNode.style.display = 'block';

    // conditionally show the button to switch to 2d mapview
    if (!is2dView) {
      view.ui.add(switch2dViewNode, 'bottom-left');
      switch2dViewNode.style.display = 'flex';
    } else {
      view.ui.add(switch3dViewNode, 'bottom-left');
      switch3dViewNode.style.display = 'flex';
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
    var maxSegmentLength = is2dView ? 100000 : 1000000;
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
      }
      view.ui.move('zoom', 'bottom-left');
      view.ui.move(switch2dViewNode, 'bottom-left');
      view.ui.move(switch3dViewNode, 'bottom-left');
      view.ui.move(locateWidget, 'bottom-left');
    } else {
      view.ui.move(rotateControl, 'top-right');
      if (instructionsNode.style.display !== 'none') {
        view.ui.move(instructionsNode, 'top-right');
      }
      view.ui.move('zoom', 'top-left');
    }
  }
});
