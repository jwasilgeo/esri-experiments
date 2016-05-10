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
    container: 'viewDiv',
    map: map,
    center: [0, 0],
    zoom: -5,
    // camera: {
    //     fov: 55,
    //     heading: 90, // face due east
    //     tilt: 60, // looking from a bird's eye view
    //     position: {
    //       latitude: lat,
    //       longitude: long,
    //       z: 412500,
    //       spatialReference: {
    //         wkid: 3857
    //       }
    //     }
    //   },
    environment: {
      lighting: {
        date: Date.now(),
        // ambientOcclusionEnabled: true,
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

  view.ui.add('contentDiv', 'top-right');
  var contentDiv = document.getElementById('contentDiv');
  var photosDiv = document.getElementById('photosDiv');

  var url = 'https://api.open-notify.org/iss-now.json';

  view.then(function() {
    findISS();
  });

  function findISS() {
    dojoRequestScript.get(url, {
      jsonp: 'callback'
    }).then(findISSSuccess);
  }

  function findISSSuccess(res) {
    if (res.message === 'success') {
      if (!previousCoordinates) {
        previousCoordinates = {
          latitude: res.iss_position.latitude,
          longitude: res.iss_position.longitude
        };
        setTimeout(findISS(), 500);
      } else if (!nextCoordinates) {
        nextCoordinates = {
          latitude: res.iss_position.latitude,
          longitude: res.iss_position.longitude
        };

        var heading = calculateGeodesyMethod(previousCoordinates, nextCoordinates, 'bearingTo');

        view.goTo({
          position: {
            latitude: nextCoordinates.latitude,
            longitude: nextCoordinates.longitude,
            z: 412500 // altitude in meters
          },
          tilt: 65,
          heading: heading
        });

        previousCoordinates = nextCoordinates;
        setTimeout(updateISS, 2000);
      }
    }
  }

  function updateISS() {
    dojoRequestScript.get(url, {
      jsonp: 'callback'
    }).then(updateISSSuccess);
  }

  function updateISSSuccess(res) {
    if (res.message === 'success') {
      updatePosition({
        latitude: res.iss_position.latitude,
        longitude: res.iss_position.longitude
      });
    }
  }

  function updatePosition(nextCoordinates) {
    console.log(arguments);

    var heading = calculateGeodesyMethod(previousCoordinates, nextCoordinates, 'bearingTo');
    previousCoordinates = nextCoordinates;

    console.log(heading);

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
    }).then(function(e) {
      console.log(e);
    });

    setTimeout(updateISS, 10000);

  }

  function getPhotos(centerPoint) {
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
      // Do something with the resulting FeatureSet (zoom to it, highlight features, get other attributes, etc)
      console.log(results.features);

      contentDiv.style.display = 'none';
      while (photosDiv.hasChildNodes()) {
        photosDiv.removeChild(photosDiv.firstChild);
      }

      var docFragment = document.createDocumentFragment();

      results.features.forEach(function(feature) {
        var div = document.createElement('div');
        var a = document.createElement('a');
        a.href = 'http://eol.jsc.nasa.gov/SearchPhotos/photo.pl?mission=' + feature.attributes.mission + '&roll=' + feature.attributes.roll + '&frame=' + feature.attributes.frame;
        a.target = '_blank';
        // a.innerHTML = feature.attributes.missionRollFrame;

        var img = document.createElement('img');
        img.width = '150';
        img.src = 'http://eol.jsc.nasa.gov/DatabaseImages/ESC/small/' + feature.attributes.mission + '/' + feature.attributes.missionRollFrame + '.JPG';

        a.appendChild(img);
        div.appendChild(a);
        docFragment.appendChild(div);
      });

      if (results.features.length) {
        contentDiv.style.display = 'block';
        photosDiv.appendChild(docFragment);
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
