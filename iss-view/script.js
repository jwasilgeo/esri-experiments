require([
  'esri/Map',
  'esri/views/SceneView',
  'esri/tasks/QueryTask',
  'esri/tasks/support/Query',
  'esri/geometry/Circle',
  'esri/Graphic',
  // 'esri/layers/GraphicsLayer',
  // 'esri/symbols/SimpleFillSymbol',
  'dojo/request/script',
  'dojo/domReady!'
], function(Map, SceneView, QueryTask, Query, Circle, Graphic, /*GraphicsLayer, SimpleFillSymbol,*/ dojoRequestScript) {
  var previousCoordinates;

  var astroPhotosToggle = document.getElementById('astroPhotosToggle');
  var contentNode = document.getElementById('contentNode');
  var photosNode = document.getElementById('photosNode');
  var creditsNode = document.getElementById('creditsNode');
  var errorMessageNode = document.getElementById('errorMessageNode');

  var issLocationUrl = 'http://api.open-notify.org/iss-now.json';

  var updateDelay = 15000;

  var queryTaskExecute;

  var map = new Map({
    basemap: 'satellite',
    ground: 'world-elevation'
  });
  // var graphicsLayer = new GraphicsLayer();
  // map.add(graphicsLayer);

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
    }
  });

  view.then(function() {
    if (checkWebGLSupport()) {
      errorMessageNode.innerHTML = 'We\'re looking around for the space station. Hold on!';
      errorMessageNode.style.display = 'flex';

      astroPhotosToggle.style.display = 'flex';
      contentNode.style.display = 'block';

      view.watch('stationary', function(newValue) {
        if (newValue) {
          getPhotos(view.extent.center);
        }
      });

      establishIssLocation();
    }
  }, function() {
    checkWebGLSupport();
  });

  function checkWebGLSupport() {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent)) {
      errorMessageNode.innerHTML = 'You\'ll need a device/browser that supports WebGL. This must be awkward for you. Here\'s a gif instead.';
      errorMessageNode.setAttribute('class', 'errorMessage errorBackground');
      return false;
    } else {
      return true;
    }
  }

  view.ui.add('astroPhotosToggle', 'top-right');
  view.ui.add('contentNode', 'top-right');
  view.ui.add('creditsNode', 'bottom-right');

  creditsNode.style.display = 'block';

  astroPhotosToggle.addEventListener('click', function(evt) {
    if (contentNode.style.display === 'none') {
      contentNode.style.display = 'block';
    } else {
      contentNode.style.display = 'none';
    }
  });

  /*view.ui.add('daylightToggle', 'top-left');
  var daylightToggle = document.getElementById('daylightToggle');
  daylightToggle.style.display = 'flex';
  daylightToggle.addEventListener('click', function(evt) {
    if (view.environment.lighting.cameraTrackingEnabled) {
      view.environment.lighting.date = Date.now();
      view.environment.lighting.cameraTrackingEnabled = false;
    } else {
      view.environment.lighting.date = new Date('March 15, 2015 12:00:00');
      view.environment.lighting.cameraTrackingEnabled = true;
    }
  });*/

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
        setTimeout(establishIssLocation, 750);
      } else {
        errorMessageNode.innerHTML = '';
        errorMessageNode.style.display = 'none';

        updateCameraPosition({
          latitude: res.iss_position.latitude,
          longitude: res.iss_position.longitude
        });

        astroPhotosToggle.style.display = 'flex';
        contentNode.style.display = 'block';

        // update the location after a delay (only once from here)
        setTimeout(getCurrentIssLocation, updateDelay);
      }
    }
  }

  function establishIssLocationError(err) {
    console.error(err);
    errorMessageNode.innerHTML = 'We had trouble finding out where the space station is right now. Please try later!';
    errorMessageNode.style.display = 'flex';

    setTimeout(function() {
      errorMessageNode.innerHTML = '';
      errorMessageNode.style.display = 'none';

      previousCoordinates = {
        latitude: 0,
        longitude: 0
      };

      updateCameraPosition(previousCoordinates);
    }, 6000);
  }

  function getCurrentIssLocation() {
    dojoRequestScript.get(issLocationUrl, {
      jsonp: 'callback'
    }).then(getCurrentIssLocationSuccess, getCurrentIssLocationError);
  }

  function getCurrentIssLocationSuccess(res) {
    if (res.message === 'success') {

      if (
        (previousCoordinates.latitude.toFixed(3) !== view.camera.position.latitude.toFixed(3)) ||
        (previousCoordinates.longitude.toFixed(3) !== view.camera.position.longitude.toFixed(3))
      ) {
        errorMessageNode.innerHTML = 'Get ready. You\'re going to get moved.';
        errorMessageNode.style.display = 'flex';
      }

      setTimeout(function() {
        errorMessageNode.innerHTML = '';
        errorMessageNode.style.display = 'none';

        updateCameraPosition({
          latitude: res.iss_position.latitude,
          longitude: res.iss_position.longitude
        });

        // update the location after a delay (continue indefinitely from here)
        setTimeout(function() {
          getCurrentIssLocation();
        }, updateDelay);

      }, 3000);
    }
  }

  function getCurrentIssLocationError(err) {
    console.error(err);
    errorMessageNode.innerHTML =
      '<div>It seems that we\'ve misplaced the space station.</div>' +
      '<div>We\'ll try to look again in a minute or two.</div>' +
      '<div>Go click on something else.</div>';
    errorMessageNode.style.display = 'flex';
    setTimeout(function() {
      errorMessageNode.style.display = 'none';
    }, 15000);
    setTimeout(getCurrentIssLocation, 60000);
  }

  function updateCameraPosition(nextCoordinates) {
    var heading = calculateGeodesyMethod(previousCoordinates, nextCoordinates, 'bearingTo');
    previousCoordinates = nextCoordinates;

    // getPhotos(view.extent.center);
    // getPhotos([nextCoordinates.longitude, nextCoordinates.latitude]);

    view.goTo({
      position: {
        latitude: nextCoordinates.latitude,
        longitude: nextCoordinates.longitude,
        z: 412500 // altitude in meters
      },
      tilt: 65,
      heading: heading
    });
  }

  function getPhotos(centerPoint) {
    if (contentNode.style.display !== 'none') {

      var searchGeometry = new Circle({
        center: centerPoint,
        radius: 100,
        radiusUnit: 'kilometers',
        geodesic: true
      });

      /*graphicsLayer.add(new Graphic({
        geometry: searchGeometry,
        symbol: new SimpleFillSymbol({
          color: [51, 51, 204, 0.9],
          style: 'solid',
          outline: {
            color: 'white',
            width: 1
          }
        })
      }));*/

      queryTask = new QueryTask({
        url: '//services2.arcgis.com/gLefH1ihsr75gzHY/arcgis/rest/services/ISSPhotoLocations_20_34/FeatureServer/0',
      });
      var query = new Query();
      query.geometry = searchGeometry;
      query.returnGeometry = false;
      query.outFields = ['missionRollFrame', 'mission', 'roll', 'frame'];

      // if (queryTaskExecute && !queryTaskExecute.isResolved()) {
      if (queryTaskExecute && !queryTaskExecute.isFulfilled()) {
        queryTaskExecute.cancel();
      }

      queryTaskExecute = queryTask.execute(query);

      queryTaskExecute.then(function(results) {

        while (photosNode.hasChildNodes()) {
          photosNode.removeChild(photosNode.firstChild);
        }

        var docFragment = document.createDocumentFragment();

        results.features.slice(0, 25).forEach(function(feature, idx) {
          var div = document.createElement('div');
          var a = document.createElement('a');
          a.href = '//eol.jsc.nasa.gov/SearchPhotos/photo.pl?mission=' + feature.attributes.mission + '&roll=' + feature.attributes.roll + '&frame=' + feature.attributes.frame;
          a.target = '_blank';

          var img = document.createElement('img');
          img.width = '150';
          img.src = '//eol.jsc.nasa.gov/DatabaseImages/ESC/small/' + feature.attributes.mission + '/' + feature.attributes.missionRollFrame + '.JPG';
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

  }

  // github.com/chrisveness/geodesy
  function calculateGeodesyMethod(esriPointA, esriPointB, geodesyMethodName) {
    var geodesyPointA = new LatLon(esriPointA.latitude, esriPointA.longitude);
    var geodesyPointB = new LatLon(esriPointB.latitude, esriPointB.longitude);
    return geodesyPointA[geodesyMethodName](geodesyPointB);
  }
});
