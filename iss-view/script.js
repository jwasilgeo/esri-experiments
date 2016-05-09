var view,
  previousCoordinates,
  nextCoordinates;

require([
  'esri/Map',
  'esri/views/SceneView',
  'dojo/request/script',
  'dojo/domReady!'
], function(Map, SceneView, dojoRequestScript) {

  var map = new Map({
    basemap: 'satellite'
  });

  view = new SceneView({
    container: "viewDiv",
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

  // view.ui.add('photosDiv', 'top-right');

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

    view.goTo({
      position: {
        latitude: nextCoordinates.latitude,
        longitude: nextCoordinates.longitude,
        z: 412500 // altitude in meters
      },
      tilt: 65,
      heading: heading
    });

    setTimeout(updateISS, 5000);

  }



  // github.com/chrisveness/geodesy
  function calculateGeodesyMethod(esriPointA, esriPointB, geodesyMethodName) {
    var geodesyPointA = new LatLon(esriPointA.latitude, esriPointA.longitude);
    var geodesyPointB = new LatLon(esriPointB.latitude, esriPointB.longitude);
    return geodesyPointA[geodesyMethodName](geodesyPointB);
  }
});
