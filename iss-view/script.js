var view,
  previousCoordinates,
  nextCoordinates;

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

  var map = new Map({
    basemap: 'satellite'
  });
  // var graphicsLayer = new GraphicsLayer();
  // map.add(graphicsLayer);

  view = new SceneView({
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
    establishIssLocation();
  });

  view.ui.add('astroPhotosToggle', 'top-right');
  view.ui.add('contentNode', 'top-right');
  view.ui.add('authorInfo', 'bottom-right');

  var astroPhotosToggle = document.getElementById('astroPhotosToggle');
  var contentNode = document.getElementById('contentNode');
  var photosNode = document.getElementById('photosNode');
  var authorInfo = document.getElementById('authorInfo');

  astroPhotosToggle.style.display = 'flex';
  contentNode.style.display = 'block';
  authorInfo.style.display = 'block';

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

  var openNotifyIssNowUrl = 'https://api.open-notify.org/iss-now.json';

  function establishIssLocation() {
    dojoRequestScript.get(openNotifyIssNowUrl, {
      jsonp: 'callback'
    }).then(establishIssLocationSuccess);
  }

  function establishIssLocationSuccess(res) {
    if (res.message === 'success') {
      if (!previousCoordinates) {
        previousCoordinates = {
          latitude: res.iss_position.latitude,
          longitude: res.iss_position.longitude
        };
        setTimeout(establishIssLocation(), 750);
      } else if (!nextCoordinates) {
        // nextCoordinates = ;

        updateCameraPosition({
          latitude: res.iss_position.latitude,
          longitude: res.iss_position.longitude
        });
        setTimeout(updateIssLocation, 10000);
      }
    }
  }

  function updateIssLocation() {
    dojoRequestScript.get(openNotifyIssNowUrl, {
      jsonp: 'callback'
    }).then(updateIssLocationSuccess);
  }

  function updateIssLocationSuccess(res) {
    if (res.message === 'success') {
      updateCameraPosition({
        latitude: res.iss_position.latitude,
        longitude: res.iss_position.longitude
      });
    }
    setTimeout(updateIssLocation, 10000);
  }

  function updateCameraPosition(nextCoordinates) {
    var heading = calculateGeodesyMethod(previousCoordinates, nextCoordinates, 'bearingTo');
    previousCoordinates = nextCoordinates;

    getPhotos(view.extent.center);
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

      var queryTask = new QueryTask({
        url: '//services2.arcgis.com/gLefH1ihsr75gzHY/arcgis/rest/services/ISSPhotoLocations_20_34/FeatureServer/0',
      });
      var query = new Query();
      query.geometry = searchGeometry;
      query.returnGeometry = false;
      query.outFields = ['missionRollFrame', 'mission', 'roll', 'frame'];
      queryTask.execute(query).then(function(results) {

        while (photosNode.hasChildNodes()) {
          photosNode.removeChild(photosNode.firstChild);
        }

        var docFragment = document.createDocumentFragment();

        results.features.slice(0, 25).forEach(function(feature, idx) {
          var div = document.createElement('div');
          var a = document.createElement('a');
          a.href = 'http://eol.jsc.nasa.gov/SearchPhotos/photo.pl?mission=' + feature.attributes.mission + '&roll=' + feature.attributes.roll + '&frame=' + feature.attributes.frame;
          a.target = '_blank';

          var img = document.createElement('img');
          img.width = '150';
          img.src = 'http://eol.jsc.nasa.gov/DatabaseImages/ESC/small/' + feature.attributes.mission + '/' + feature.attributes.missionRollFrame + '.JPG';

          a.appendChild(img);
          div.appendChild(a);
          docFragment.appendChild(div);
        });

        if (results.features.length) {
          photosNode.appendChild(docFragment);
        } else {
          photosNode.innerHTML = 'No photos found here.'
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
