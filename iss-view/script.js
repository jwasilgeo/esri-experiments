require([
  'dojo/request/script',

  'esri/Basemap',
  'esri/geometry/Circle',
  'esri/layers/WebTileLayer',
  'esri/Map',
  'esri/tasks/QueryTask',
  'esri/tasks/support/Query',
  'esri/views/SceneView',
  'esri/widgets/BasemapToggle',

  'dojo/domReady!'
], function (
  dojoRequestScript,
  Basemap, Circle, WebTileLayer, Map, QueryTask, Query, SceneView, BasemapToggle
) {
  var previousCoordinates;

  var astroPhotosToggle = document.getElementById('astroPhotosToggle');
  var photosParentNode = document.getElementById('photosParentNode');
  var photosNode = document.getElementById('photosNode');
  var creditsNode = document.getElementById('creditsNode');
  var infoMessageNode = document.getElementById('infoMessageNode');

  // var issLocationUrl = 'http://api.open-notify.org/iss-now.json';
  var issLocationUrl = 'https://open-notify-api.herokuapp.com/iss-now.json';

  // var firstUpdateDelay = 3000;
  var firstCameraViewChangeDuration = 3000;
  var updateDelay = 10000;
  var cameraViewChangeDuration = updateDelay * 2;

  var map = new Map({
    basemap: 'satellite',
    // ground: 'world-elevation'
  });

  var locatorView = new SceneView({
    container: 'locatorViewNode',
    map: map,
    environment: {
      lighting: {
        date: Date.now(),
        cameraTrackingEnabled: false
      }
    },
    ui: {
      components: []
    },
    navigation: {
      browserTouchPanEnabled: false,
      mouseWheelZoomEnabled: false,
      gamepad: {
        enabled: false
      }
    }
  });

  var view = new SceneView({
    container: 'viewNode',
    map: map,
    center: [0, 0],
    zoom: -5,
    environment: {
      lighting: {
        date: Date.now(),
        cameraTrackingEnabled: false
      },
      atmosphere: {
        quality: 'high'
      }
    },
    constraints: {
      altitude: {
        max: 10000000000
      }
    },
    ui: {
      components: ['attribution']
    },
    navigation: {
      browserTouchPanEnabled: false,
      mouseWheelZoomEnabled: false,
      gamepad: {
        enabled: false
      }
    }
  });

  view.ui.add('creditsNode', 'bottom-right');
  creditsNode.style.display = 'flex';

  view.when(function (view) {
    startupMappingComponents(view);
    disableZooming(view);

    disableZooming(locatorView);
    locatorView.graphics.add({
      geometry: {
        type: 'polygon',
        rings: [
          [
            [view.center.longitude, view.center.latitude],
            [0, 0],
            [20, 20],
            [view.center.longitude, view.center.latitude]
          ]
        ]
      },
      symbol: {
        type: 'simple-fill',
        color: [255, 0, 255, 0.5],
        style: 'solid',
        outline: {
          color: 'magenta',
          width: '5px'
        }
      }
    });
    view.watch('center', function (centerValue) {
      var newlocatorViewCenter = locatorView.center.clone();
      newlocatorViewCenter.longitude = centerValue.longitude;
      locatorView.center = newlocatorViewCenter;

      var locatorGraphic = locatorView.graphics.getItemAt(0);
      var newGeometry = locatorGraphic.geometry.clone();
      newGeometry.rings = [
        [
          [view.center.longitude, view.center.latitude],
          [0, 0],
          [20, 20],
          [view.center.longitude, view.center.latitude]
        ]
      ];
      locatorGraphic.geometry = newGeometry;
    });
  });

  function startupMappingComponents(view) {
    infoMessageNode.innerHTML = '<div>We\'re looking around for the space station. Hold on!</div><img src="./favicon.ico" width="80" alt="International Space Station icon" style="animation: 2s rotate-station-icon infinite linear; filter: brightness(500%);">';
    infoMessageNode.style.display = 'flex';

    establishIssLocation();
  }

  function addAstroPhotosToggle(view) {
    // view.ui.add('astroPhotosToggle', 'top-right');
    view.ui.add('photosParentNode', 'top-right');
    astroPhotosToggle.style.display = 'flex';
    photosParentNode.style.display = 'none';

    astroPhotosToggle.addEventListener('click', function () {
      if (photosParentNode.style.display === 'none') {
        photosParentNode.style.display = 'block';
        getPhotos(view.extent.center);
      } else {
        photosParentNode.style.display = 'none';
      }
    });
  }

  function addDaylightToggle(view) {
    // view.ui.add('daylightToggle', 'top-right');
    var daylightToggle = document.getElementById('daylightToggle');
    daylightToggle.style.display = 'flex';

    var timeAtCreation = view.environment.lighting.clone().date;
    daylightToggle.addEventListener('click', function () {
      if (view.environment.lighting.date.getTime() === timeAtCreation.getTime()) {
        view.environment.lighting.date = timeAtCreation.getTime() + (12 * 3.6e+6);
      } else {
        view.environment.lighting.date = timeAtCreation;
      }
    });
  }

  function addCustomBasemap(view) {
    var stamenBasemap = new Basemap({
      baseLayers: [
        new WebTileLayer({
          urlTemplate: 'https://stamen-tiles-{subDomain}.a.ssl.fastly.net/toner/{level}/{col}/{row}.png',
          subDomains: ['a', 'b', 'c', 'd'],
          copyright: [
            'Map tiles by <a href="https://stamen.com">Stamen Design</a>, ',
            'under <a href="https://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
            'Data by <a href="https://openstreetmap.org">OpenStreetMap</a>, ',
            'under <a href="https://www.openstreetmap.org/copyright">ODbL</a>.'
          ].join('')
        })
      ],
      title: 'Toner',
      id: 'toner',
      thumbnailUrl: 'https://stamen-tiles.a.ssl.fastly.net/toner/10/177/409.png'
    });

    var basemapToggle = new BasemapToggle({
      view: view,
      nextBasemap: stamenBasemap,
      visibleElements: {
        title: false
      }
    });
    view.ui.add(basemapToggle, 'bottom-left');
  }

  function establishIssLocation() {
    dojoRequestScript.get(issLocationUrl, {
      jsonp: 'callback'
    }).then(establishIssLocationSuccess, establishIssLocationError);
  }

  function establishIssLocationSuccess(res) {
    // get two initial locations to be able to determine the heading
    if (res.message === 'success') {
      if (!previousCoordinates) {
        previousCoordinates = {
          latitude: res.iss_position.latitude,
          longitude: res.iss_position.longitude
        };
        setTimeout(establishIssLocation, 1000);
      } else {
        updateCameraPosition({
          latitude: res.iss_position.latitude,
          longitude: res.iss_position.longitude
        }, firstCameraViewChangeDuration)
          .then(function () {
            getCurrentIssLocation();

            infoMessageNode.innerHTML = '';
            infoMessageNode.style.display = 'none';

            view.ui.add('smallButtonsControl', 'top-right');
            addDaylightToggle(view);
            addAstroPhotosToggle(view);

            addCustomBasemap(view);
          });
      }
    }
  }

  function establishIssLocationError(err) {
    console.error(err);
    infoMessageNode.innerHTML = 'We had trouble finding out where the space station is right now. Please try later.';
    infoMessageNode.style.display = 'flex';

    setTimeout(function () {
      infoMessageNode.innerHTML = '';
      infoMessageNode.style.display = 'none';

      previousCoordinates = {
        latitude: 0,
        longitude: 0
      };

      updateCameraPosition(previousCoordinates, 1000);
    }, 6000);
  }

  function getCurrentIssLocation() {
    dojoRequestScript.get(issLocationUrl, {
      jsonp: 'callback'
    }).then(getCurrentIssLocationSuccess, getCurrentIssLocationError);
  }

  function getCurrentIssLocationSuccess(res) {
    if (res.message === 'success') {
      infoMessageNode.innerHTML = '';
      infoMessageNode.style.display = 'none';

      updateCameraPosition({
        latitude: res.iss_position.latitude,
        longitude: res.iss_position.longitude
      }, cameraViewChangeDuration);

      // update the location after a delay (continue indefinitely from here)
      setTimeout(function () {
        getCurrentIssLocation();
      }, updateDelay);
    }
  }

  function getCurrentIssLocationError(err) {
    console.error(err);
    infoMessageNode.innerHTML =
      '<div>It seems that we\'ve misplaced the space station.</div>' +
      '<div>We\'ll try to look again in a minute or two.</div>'
    infoMessageNode.style.display = 'flex';
    setTimeout(function () {
      infoMessageNode.style.display = 'none';
    }, 15000);
    setTimeout(getCurrentIssLocation, 60000);
  }

  function updateCameraPosition(nextCoordinates, cameraViewChangeDuration) {
    var heading = calculateGeodesyMethod(previousCoordinates, nextCoordinates, 'bearingTo');
    previousCoordinates = nextCoordinates;

    // getPhotos(view.extent.center);
    getPhotos([nextCoordinates.longitude, nextCoordinates.latitude]);

    return view.goTo({
      position: {
        latitude: nextCoordinates.latitude,
        longitude: nextCoordinates.longitude,
        z: 412500 // altitude in meters
      },
      tilt: 60,
      heading: heading
    }, {
      speedFactor: 1,
      duration: cameraViewChangeDuration,
      maxDuration: 60000,
      easing: 'linear'
    });
  }

  function getPhotos(centerPoint) {
    if (photosParentNode.style.display === 'none' || photosParentNode.style.display === '') {
      return;
    }

    var searchGeometry = new Circle({
      center: centerPoint,
      radius: 100,
      radiusUnit: 'kilometers',
      geodesic: true
    });

    var query = new Query();
    query.geometry = searchGeometry;
    query.returnGeometry = false;
    query.outFields = ['missionRollFrame', 'mission', 'roll', 'frame'];

    var queryTask = new QueryTask({
      url: 'https://services2.arcgis.com/gLefH1ihsr75gzHY/arcgis/rest/services/ISSPhotoLocations_20_34/FeatureServer/0',
    });

    queryTask.execute(query).then(function (results) {
      while (photosNode.hasChildNodes()) {
        photosNode.removeChild(photosNode.firstChild);
      }

      var docFragment = document.createDocumentFragment();

      results.features.slice(0, 25).forEach(function (feature) {
        var div = document.createElement('div');
        var a = document.createElement('a');
        a.href = 'https://eol.jsc.nasa.gov/SearchPhotos/photo.pl?mission=' + feature.attributes.mission + '&roll=' + feature.attributes.roll + '&frame=' + feature.attributes.frame;
        a.target = '_blank';

        var img = document.createElement('img');
        img.width = '150';
        img.src = 'https://eol.jsc.nasa.gov/DatabaseImages/ESC/small/' + feature.attributes.mission + '/' + feature.attributes.missionRollFrame + '.JPG';
        img.title = 'NASA Johnson Space Center';

        a.appendChild(img);
        div.appendChild(a);
        docFragment.appendChild(div);
      });

      if (results.features.length) {
        photosNode.appendChild(docFragment);
      } else {
        photosNode.innerHTML = 'No photos found here.';
      }
    });
  }

  // github.com/chrisveness/geodesy
  function calculateGeodesyMethod(esriPointA, esriPointB, geodesyMethodName) {
    var geodesyPointA = new LatLon(esriPointA.latitude, esriPointA.longitude);
    var geodesyPointB = new LatLon(esriPointB.latitude, esriPointB.longitude);
    return geodesyPointA[geodesyMethodName](geodesyPointB);
  }

  function disableZooming(view) {
    // stops propagation of default behavior when an event fires
    function stopEvtPropagation(event) {
      event.stopPropagation();
    }

    // disable mouse wheel scroll zooming on the view
    view.on('mouse-wheel', stopEvtPropagation);

    view.on('pointer-down', stopEvtPropagation);
    view.on('pointer-move', stopEvtPropagation);
    view.on('hold', stopEvtPropagation);

    // disable zooming via double-click on the view
    view.on('double-click', stopEvtPropagation);

    // disable zooming out via double-click + Control on the view
    view.on('double-click', ['Control'], stopEvtPropagation);

    // disables pinch-zoom and panning on the view
    view.on('drag', stopEvtPropagation);

    // disable the view's zoom box to prevent the Shift + drag
    // and Shift + Control + drag zoom gestures.
    view.on('drag', ['Shift'], stopEvtPropagation);
    view.on('drag', ['Shift', 'Control'], stopEvtPropagation);

    // prevent any keyboard interaction (zooming and panning)
    view.on('key-down', function (event) {
      // prevents zooming with the + and - keys
      // var prohibitedKeys = ['+', '-', 'Shift', '_', '='];
      // var keyPressed = event.key;
      // if (prohibitedKeys.indexOf(keyPressed) !== -1) {
      //  stopEvtPropagation();
      // }

      stopEvtPropagation(event);
    });

    return view;
  }
});
