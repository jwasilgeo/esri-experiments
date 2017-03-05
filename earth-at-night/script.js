require([
  'esri/config',
  'esri/layers/WebTileLayer',
  'esri/Map',
  'esri/views/SceneView'
], function(esriConfig, WebTileLayer, Map, SceneView) {
  var credits = document.getElementById('credits');

  esriConfig.request.corsEnabledServers.push(
    'gibs.earthdata.nasa.gov',
    'cartodb-basemaps-a.global.ssl.fastly.net',
    'cartodb-basemaps-b.global.ssl.fastly.net',
    'cartodb-basemaps-c.global.ssl.fastly.net',
    'cartodb-basemaps-d.global.ssl.fastly.net'
  );

  var view = new SceneView({
    container: 'viewDiv',
    map: new Map({
      basemap: 'satellite'
    }),
    camera: {
      position: [31, 28, 2000000],
      heading: 180
    },
    environment: {
      atmosphere: {
        quality: 'high'
      },
      lighting: {
        date: Date.now(),
        cameraTrackingEnabled: false
      }
    },
    constraints: {
      altitude: {
        min: 500000
      }
    }
  });

  var earthAtNightLayer = new WebTileLayer({
    urlTemplate: 'https://gibs.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default//GoogleMapsCompatible_Level8/{level}/{row}/{col}.jpg',
    copyright: 'Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (<a href="https://earthdata.nasa.gov">ESDIS</a>) with funding provided by NASA/HQ.'
  });

  var labelsLayer = new WebTileLayer({
    visible: false,
    urlTemplate: 'https://cartodb-basemaps-{subDomain}.global.ssl.fastly.net/dark_only_labels/{level}/{col}/{row}.png',
    copyright: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attribution">CARTO</a>',
    subDomains: ['a', 'b', 'c', 'd']
  });

  view.map.add(earthAtNightLayer);
  view.map.add(labelsLayer);

  view.watch('camera.position', function() {
    var sunPosition = SunCalc.getPosition(view.environment.lighting.date, view.camera.position.latitude, view.camera.position.longitude);
    var sunAltitudeDegrees = sunPosition.altitude * (180 / Math.PI);

    var cutoff = 15;
    var opacity = 1;

    if (sunAltitudeDegrees > 0) {
      if (sunAltitudeDegrees <= cutoff) {
        opacity = 1 - (sunAltitudeDegrees / cutoff);
      } else {
        opacity = 0;
      }
    }

    earthAtNightLayer.opacity = opacity;
  });

  view.then(function(view) {
    view.ui.add('credits', 'bottom-right');
    credits.style.display = 'flex';

    setTimeout(function() {
      view.goTo({
        position: [31, 28, 15000000],
        heading: 0
      }, {
        speedFactor: 0.25
      }).then(function() {
        labelsLayer.visible = true;
      });
    }, 5000);
  });
});
