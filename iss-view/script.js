require([
  'dojo/request/script',

  'esri/Basemap',
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
  Basemap, Circle, /*Graphic, GraphicsLayer,*/ WebTileLayer, Map, SimpleFillSymbol, QueryTask, Query, SceneView, BasemapToggle
) {
  var previousCoordinates;

  var astroPhotosToggle = document.getElementById('astroPhotosToggle');
  var photosParentNode = document.getElementById('photosParentNode');
  var photosNode = document.getElementById('photosNode');
  var creditsNode = document.getElementById('creditsNode');
  var infoMessageNode = document.getElementById('infoMessageNode');

  var issLocationUrl = 'http://api.open-notify.org/iss-now.json';

  var firstTimeUpdateDelay = 15000;
  var updateDelay = 30000;
  var cameraViewChangeDuration = 30000;

  var queryTaskExecute = null;

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

  view.when(function(view) {
    startupMappingComponents(view);
  });

  function startupMappingComponents(view) {
    infoMessageNode.innerHTML = 'We\'re looking around for the space station. Hold on!';
    infoMessageNode.style.display = 'flex';

    establishIssLocation();

    view.ui.add('smallButtonsControl', 'top-right');
    addDaylightToggle(view);
    addAstroPhotosToggle(view);
    addCustomBasemap(view);
  }

  function addAstroPhotosToggle(view) {
    // view.ui.add('astroPhotosToggle', 'top-right');
    view.ui.add('photosParentNode', 'top-right');
    astroPhotosToggle.style.display = 'flex';
    photosParentNode.style.display = 'block';

    astroPhotosToggle.addEventListener('click', function() {
      if (photosParentNode.style.display === 'none') {
        photosParentNode.style.display = 'block';
        if (view.stationary) {
          getPhotos(view.extent.center);
        }
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
      baseLayers: [
        new WebTileLayer({
          urlTemplate: '//stamen-tiles-{subDomain}.a.ssl.fastly.net/toner/{level}/{col}/{row}.png',
          subDomains: ['a', 'b', 'c', 'd'],
          copyright: [
            'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ',
            'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
            'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ',
            'under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
          ].join('')
        })
      ],
      title: 'Toner',
      id: 'toner',
      thumbnailUrl: '//stamen-tiles.a.ssl.fastly.net/toner/10/177/409.png'
    });

    var basemapToggle = new BasemapToggle({
      view: view,
      nextBasemap: stamenBasemap,
      titleVisible: false
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
        setTimeout(establishIssLocation, 750);
      } else {
        infoMessageNode.innerHTML = '';
        infoMessageNode.style.display = 'none';

        updateCameraPosition({
          latitude: res.iss_position.latitude,
          longitude: res.iss_position.longitude
        }, 1000);

        astroPhotosToggle.style.display = 'flex';
        photosParentNode.style.display = 'block';

        // update the location after a delay (only once from here)
        setTimeout(getCurrentIssLocation, 1000);
      }
    }
  }

  function establishIssLocationError(err) {
    console.error(err);
    infoMessageNode.innerHTML = 'We had trouble finding out where the space station is right now. Please try later.';
    infoMessageNode.style.display = 'flex';

    setTimeout(function() {
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

      if (
        (Number(previousCoordinates.latitude).toFixed(3) !== view.camera.position.latitude.toFixed(3)) ||
          (Number(previousCoordinates.longitude).toFixed(3) !== view.camera.position.longitude.toFixed(3))
      ) {
        infoMessageNode.innerHTML = 'Get ready. You\'re going to get moved.';
        infoMessageNode.style.display = 'flex';
      }

      // delay the next position if the user got off track to display a warning message
      // setTimeout(function() {
      infoMessageNode.innerHTML = '';
      infoMessageNode.style.display = 'none';

      updateCameraPosition({
        latitude: res.iss_position.latitude,
        longitude: res.iss_position.longitude
      }, cameraViewChangeDuration);

      // update the location after a delay (continue indefinitely from here)
      setTimeout(function() {
        getCurrentIssLocation();
      }, updateDelay);

      // }, 3000);
    }
  }

  function getCurrentIssLocationError(err) {
    console.error(err);
    infoMessageNode.innerHTML =
        '<div>It seems that we\'ve misplaced the space station.</div>' +
        '<div>We\'ll try to look again in a minute or two.</div>' +
        '<div>Go click on something else.</div>';
    infoMessageNode.style.display = 'flex';
    setTimeout(function() {
      infoMessageNode.style.display = 'none';
    }, 15000);
    setTimeout(getCurrentIssLocation, 60000);
  }

  function updateCameraPosition(nextCoordinates, cameraViewChangeDuration) {
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
    }, {
      speedFactor: 1,
      duration: cameraViewChangeDuration,
      maxDuration: 60000,
      easing: 'linear'
    });
  }

  function getPhotos(centerPoint) {
    if (photosParentNode.style.display === 'none') {
      return;
    }

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

    var queryTask = new QueryTask({
      url: '//services2.arcgis.com/gLefH1ihsr75gzHY/arcgis/rest/services/ISSPhotoLocations_20_34/FeatureServer/0',
    });
    var query = new Query();
    query.geometry = searchGeometry;
    query.returnGeometry = false;
    query.outFields = ['missionRollFrame', 'mission', 'roll', 'frame'];

    // if (queryTaskExecute && !queryTaskExecute.isResolved()) {
    if (queryTaskExecute && !queryTaskExecute.isFulfilled()) {
      queryTaskExecute.cancel();
      queryTaskExecute = null;
    }

    queryTaskExecute = queryTask.execute(query);

    queryTaskExecute.then(function(results) {
      queryTaskExecute = null;

      while (photosNode.hasChildNodes()) {
        photosNode.removeChild(photosNode.firstChild);
      }

      var docFragment = document.createDocumentFragment();

      results.features.slice(0, 25).forEach(function(feature) {
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

  // github.com/chrisveness/geodesy
  function calculateGeodesyMethod(esriPointA, esriPointB, geodesyMethodName) {
    var geodesyPointA = new LatLon(esriPointA.latitude, esriPointA.longitude);
    var geodesyPointB = new LatLon(esriPointB.latitude, esriPointB.longitude);
    return geodesyPointA[geodesyMethodName](geodesyPointB);
  }
});
