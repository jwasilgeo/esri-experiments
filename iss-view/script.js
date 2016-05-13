require([
  'dojo/request/script',

  'esri/Basemap',
  'esri/config',
  'esri/geometry/Circle',
  // 'esri/Graphic',
  // 'esri/layers/GraphicsLayer',
  'esri/layers/WebTileLayer',
  'esri/Map',
  'esri/symbols/SimpleFillSymbol',
  'esri/tasks/QueryTask',
  'esri/tasks/support/Query',
  'esri/views/SceneView',
  'esri/widgets/BasemapToggle',

  'dojo/domReady!'
], function(
  dojoRequestScript,
  Basemap, esriConfig, Circle, /*Graphic, GraphicsLayer,*/ WebTileLayer, Map, SimpleFillSymbol, QueryTask, Query, SceneView, BasemapToggle
) {
  esriConfig.request.corsEnabledServers.push('a.tile.stamen.com', 'b.tile.stamen.com', 'c.tile.stamen.com', 'd.tile.stamen.com');

  var previousCoordinates;

  var astroPhotosToggle = document.getElementById('astroPhotosToggle');
  var photosParentNode = document.getElementById('photosParentNode');
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

  view.ui.add('creditsNode', 'bottom-right');
  creditsNode.style.display = 'block';

  view.then(function(view) {
    if (checkWebGLSupport()) {
      startupMappingComponents(view);
    }
  }, function() {
    checkWebGLSupport();
  });

  function startupMappingComponents(view) {
    errorMessageNode.innerHTML = 'We\'re looking around for the space station. Hold on!';
    errorMessageNode.style.display = 'flex';

    establishIssLocation();

    view.ui.add('smallButtonsControl', 'top-right');
    addDaylightToggle(view);
    addAstroPhotosToggle(view);
    addCustomBasemap(view);
  }

  function checkWebGLSupport() {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent)) {
      errorMessageNode.innerHTML = 'You\'ll need a device/browser that supports WebGL. This must be awkward for you. Here\'s a gif instead.';
      errorMessageNode.setAttribute('class', 'errorMessage errorBackground');
      return false;
    } else {
      return true;
    }
  }

  function addAstroPhotosToggle(view) {
    // view.ui.add('astroPhotosToggle', 'top-right');
    view.ui.add('photosParentNode', 'top-right');
    astroPhotosToggle.style.display = 'flex';
    photosParentNode.style.display = 'block';

    astroPhotosToggle.addEventListener('click', function(evt) {
      if (photosParentNode.style.display === 'none') {
        photosParentNode.style.display = 'block';
      } else {
        photosParentNode.style.display = 'none';
      }
    });

    view.watch('stationary', function(value) {
      if (value) {
        getPhotos(view.extent.center);
      }
    });
  }

  function addDaylightToggle(view) {
    // view.ui.add('daylightToggle', 'top-right');
    var daylightToggle = document.getElementById('daylightToggle');
    daylightToggle.style.display = 'flex';

    var timeAtCreation = view.environment.lighting.clone().date;
    daylightToggle.addEventListener('click', function() {
      if (view.environment.lighting.date.getTime() === timeAtCreation.getTime()) {
        view.environment.lighting.date = timeAtCreation.getTime() + (12 * 3.6e+6);
      } else {
        view.environment.lighting.date = timeAtCreation;
      }
    });
  }

  function addCustomBasemap(view) {
    var stamenBasemap = new Basemap({
      baseLayers: [new WebTileLayer({
        urlTemplate: 'http://{subDomain}.tile.stamen.com/toner/{level}/{col}/{row}.png',
        subDomains: ['a', 'b', 'c', 'd'],
        copyright: [
          'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ',
          'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
          'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ',
          'under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
        ].join()
      })],
      title: 'Toner',
      id: 'toner',
      thumbnailUrl: '//stamen-tiles.a.ssl.fastly.net/toner/10/177/409.png'
    });

    var basemapToggle = new BasemapToggle({
      view: view,
      nextBasemap: stamenBasemap,
      titleVisible: false
    });
    basemapToggle.startup();
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
        setTimeout(establishIssLocation, 750);
      } else {
        errorMessageNode.innerHTML = '';
        errorMessageNode.style.display = 'none';

        updateCameraPosition({
          latitude: res.iss_position.latitude,
          longitude: res.iss_position.longitude
        });

        astroPhotosToggle.style.display = 'flex';
        photosParentNode.style.display = 'block';

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
    if (photosParentNode.style.display !== 'none') {

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
